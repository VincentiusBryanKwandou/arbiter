"""Test FASE 5/6: broker simulasi, journal, report, dan guard live."""

from __future__ import annotations

import pytest

from core.config import Config, Mode
from core.data.models import BookLevel, OrderBook
from core.edge.arbitrage import detect_binary_dutch_book
from core.execution.sim import SimulatedBroker
from dashboard.alerts import AlertSender, format_alert
from dashboard.report import build_report
from live.executor import LiveBroker, LiveGuardError, assert_live_allowed
from paper.journal import TradeJournal


def book(ask: float, size: float) -> OrderBook:
    return OrderBook(token_id=f"t{ask}", bids=[BookLevel(price=ask - 0.02, size=size)],
                     asks=[BookLevel(price=ask, size=size)])


def test_simulated_broker_locks_profit():
    opp = detect_binary_dutch_book(book(0.45, 100), book(0.50, 100))
    broker = SimulatedBroker(starting_cash=1000)
    res = broker.place_arb(opp, "m1", sets=100, cost_per_tx=0.0)
    assert res.fully_filled
    assert res.filled_sets == 100
    # profit = 100 * (1 - 0.95) = 5
    assert abs(res.locked_profit - 5.0) < 1e-9
    assert abs(broker.balance() - 1005.0) < 1e-9


def test_simulated_broker_partial_when_thin_leg():
    opp = detect_binary_dutch_book(book(0.45, 30), book(0.50, 100))
    broker = SimulatedBroker(starting_cash=1000)
    res = broker.place_arb(opp, "m1", sets=100, cost_per_tx=0.0)
    assert not res.fully_filled
    assert res.filled_sets == 30  # leg tertipis


def test_journal_roundtrip_and_report(tmp_path):
    journal = TradeJournal(path=tmp_path / "j.jsonl")
    opp = detect_binary_dutch_book(book(0.45, 100), book(0.50, 100))
    broker = SimulatedBroker(1000)
    journal.record("[BINARY] test", broker.place_arb(opp, "m1", 100))
    assert abs(journal.total_pnl() - 5.0) < 1e-9
    rep = build_report(journal)
    assert rep.n_trades == 1
    assert rep.win_rate == 1.0


# --- guard live ---
def _cfg(mode: Mode, key: str = "") -> Config:
    c = Config.__new__(Config)
    from types import SimpleNamespace
    c.secrets = SimpleNamespace(mode=mode, private_key=key, clob_host="h", chain_id=137,
                                wallet_address="0xabc", telegram_bot_token="", telegram_chat_id="")
    c.strategy = {}
    return c


def test_live_guard_blocks_when_not_live():
    with pytest.raises(LiveGuardError, match="MODE"):
        assert_live_allowed(_cfg(Mode.PAPER))


def test_live_guard_blocks_without_wallet(monkeypatch):
    monkeypatch.setenv("ATLAS_LIVE_CONFIRM", "I_UNDERSTAND_THE_RISK")
    with pytest.raises(LiveGuardError, match="PRIVATE_KEY"):
        assert_live_allowed(_cfg(Mode.LIVE, key=""))


def test_live_guard_blocks_without_confirm(monkeypatch):
    monkeypatch.delenv("ATLAS_LIVE_CONFIRM", raising=False)
    with pytest.raises(LiveGuardError, match="CONFIRM"):
        assert_live_allowed(_cfg(Mode.LIVE, key="0xdeadbeef"))


def test_live_broker_construction_blocked_in_paper():
    with pytest.raises(LiveGuardError):
        LiveBroker(_cfg(Mode.PAPER))


# --- alerts ---
def test_alert_format():
    assert "atlas-poly" in format_alert("halt", "kill-switch tripped")
    assert format_alert("halt", "x").startswith("🛑")


def test_alert_noop_when_disabled():
    sender = AlertSender(_cfg(Mode.PAPER))
    assert sender.enabled is False
    assert sender.send("info", "test") is False  # no-op aman, tak crash
