"""Test Fase 0: konfigurasi & invariant keamanan.

Tujuan test ini: membuktikan bahwa fondasi aman SEBELUM ada satu order pun.
"""

from __future__ import annotations

import pytest

from core.config import Config, Mode, get_config, load_strategy


def test_strategy_loads():
    s = load_strategy()
    assert "risk" in s
    assert "edge" in s


def test_default_mode_is_paper():
    """Invariant terpenting: tanpa .env, mode HARUS paper (bukan live)."""
    cfg = get_config()
    assert cfg.mode == Mode.PAPER
    assert cfg.is_live is False


def test_paper_mode_needs_no_wallet():
    cfg = get_config()
    assert cfg.secrets.requires_wallet() is False


def test_risk_limits_present_and_sane():
    cfg = get_config()
    assert 0 < cfg.risk["kelly_fraction"] <= 1.0
    assert 0 < cfg.risk["max_per_trade_pct"] <= 0.05
    assert cfg.risk["daily_loss_limit_pct"] > 0


def test_live_without_wallet_refuses_to_start(monkeypatch):
    """Guard: live tanpa private key harus gagal keras, bukan diam-diam jalan."""
    monkeypatch.setenv("ATLAS_MODE", "live")
    monkeypatch.setenv("ATLAS_PRIVATE_KEY", "")
    with pytest.raises(ValueError, match="PRIVATE_KEY"):
        Config()


def test_dangerous_kelly_rejected(monkeypatch, tmp_path):
    """Guard: kelly_fraction > 1 ditolak."""
    bad = tmp_path / "settings.yaml"
    bad.write_text("risk:\n  kelly_fraction: 2.0\n", encoding="utf-8")
    import core.config as c

    monkeypatch.setattr(c, "SETTINGS_FILE", bad)
    monkeypatch.setattr(c, "load_strategy", lambda path=bad: load_strategy(bad))
    with pytest.raises(ValueError, match="kelly_fraction"):
        Config()
