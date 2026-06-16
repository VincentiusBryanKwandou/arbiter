"""FastAPI bot control server — versi 24/7 cloud (Railway).

Satu proses menjalankan SEMUA:
  * FastAPI HTTP server (port $PORT)
  * Paper trading loop via APScheduler (setiap SCAN_INTERVAL_MINUTES, default 5)
  * Export data ke state JSON (dibaca oleh Vercel dashboard)

Environment variables:
  PORT                    : port HTTP (Railway set otomatis)
  STORAGE_PATH            : path persistent storage (Railway volume: /data)
  ATLAS_MODE              : paper (default, JANGAN ubah ke live di cloud)
  SCAN_INTERVAL_MINUTES   : interval scan (default 5)

Jalankan lokal:
    uvicorn api.server:app --host 0.0.0.0 --port 8001

Jalankan di Railway:
    uvicorn api.server:app --host 0.0.0.0 --port $PORT
"""

from __future__ import annotations

import json
import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

import structlog
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

log = structlog.get_logger()

ROOT = Path(__file__).resolve().parent.parent

# STORAGE_PATH: override ke Railway persistent volume (/data) via env var
STORAGE = Path(os.getenv("STORAGE_PATH", str(ROOT / "storage")))
STATE_FILE = STORAGE / "api_state.json"
JOURNAL_FILE = STORAGE / "paper_journal.jsonl"
SCAN_INTERVAL = int(os.getenv("SCAN_INTERVAL_MINUTES", "5"))

scheduler = AsyncIOScheduler(timezone="UTC")


# ── State helpers ──────────────────────────────────────────────────────────────

def load_state() -> dict:
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {"bankroll_usd": 1000.0, "positions": [], "last_scan": None, "opportunities": []}


def save_state(state: dict) -> None:
    STORAGE.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


def read_journal() -> list[dict]:
    entries = []
    if not JOURNAL_FILE.exists():
        return entries
    for line in JOURNAL_FILE.read_text(encoding="utf-8").splitlines():
        if line.strip():
            try:
                entries.append(json.loads(line))
            except Exception:
                pass
    return entries


# ── Paper scan (dijalankan oleh scheduler) ────────────────────────────────────

async def paper_scan_job() -> None:
    """Satu siklus SCAN → DETECT → VALIDATE → SIZE → FILL(paper)."""
    log.info("paper_scan_start")
    try:
        from core.config import get_config
        from core.data.clob_client import PolymarketReadClient
        from core.edge.scanner import find_opportunities
        from core.execution.sim import SimulatedBroker
        from core.risk.limits import RiskManager
        from paper.journal import TradeJournal

        cfg = get_config()
        state = load_state()
        bankroll = state["bankroll_usd"]
        cost = float(cfg.strategy["backtest"]["cost_model"]["gas_usd_per_tx"])

        broker = SimulatedBroker(starting_cash=bankroll)
        risk = RiskManager(cfg.risk, bankroll_usd=bankroll)
        journal = TradeJournal(path=JOURNAL_FILE)

        with PolymarketReadClient() as client:
            opps_raw = find_opportunities(
                client,
                limit=300,
                max_markets=80,
                min_edge=float(cfg.edge.get("min_edge_threshold", 0.05)),
                min_notional=float(cfg.risk.get("min_orderbook_depth_usd", 50.0)),
            )

        n_trades = 0
        scanned_opps = []

        for market_id, desc, opp in opps_raw:
            scanned_opps.append({
                "market_id": market_id,
                "question": desc,
                "edge_pct": round(opp.edge_pct, 4),
                "cost_per_set": round(opp.cost_per_set, 4),
                "executable_sets": round(opp.executable_sets, 4),
                "strategy": opp.type.value,
                "venue": "polymarket",
                "detected_at": utcnow(),
            })
            sizing = risk.size_arbitrage(opp, market_id)
            if not sizing.approved:
                continue
            res = broker.place_arb(opp, market_id, sizing.sets, cost_per_tx=cost)
            risk.register_open(market_id, sizing.notional_usd)
            risk.register_close(market_id, res.locked_profit)
            journal.record(desc, res)
            n_trades += 1

        state["bankroll_usd"] = round(broker.cash, 2)
        state["last_scan"] = utcnow()
        state["opportunities"] = scanned_opps
        save_state(state)

        log.info("paper_scan_done", trades=n_trades, equity=broker.cash, opps=len(scanned_opps))

    except Exception as e:
        log.error("paper_scan_error", err=str(e))


# ── Lifespan (startup / shutdown) ─────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    STORAGE.mkdir(parents=True, exist_ok=True)
    scheduler.add_job(paper_scan_job, "interval", minutes=SCAN_INTERVAL, id="paper_loop",
                      max_instances=1, coalesce=True)
    scheduler.start()
    log.info("scheduler_started", interval_minutes=SCAN_INTERVAL, storage=str(STORAGE))
    # Jalankan scan pertama segera saat startup
    await paper_scan_job()
    yield
    scheduler.shutdown(wait=False)


# ── App ────────────────────────────────────────────────────────────────────────

app = FastAPI(title="Arbiter Bot API", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Models ─────────────────────────────────────────────────────────────────────

class FundsRequest(BaseModel):
    bankroll_usd: float
    note: str = ""


class OpenPositionRequest(BaseModel):
    market_id: str
    question: str
    sets: float = 1.0
    edge_pct: float = 0.05
    cost_per_set: float = 0.95
    strategy: str = "arbitrage"
    venue: str = "polymarket"
    note: str = ""


# ── Read endpoints (dipakai Vercel dashboard) ──────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "ts": utcnow(), "storage": str(STORAGE)}


@app.get("/status")
def status():
    state = load_state()
    entries = read_journal()
    total_pnl = sum(e.get("locked_profit", 0) for e in entries)
    wins = sum(1 for e in entries if e.get("locked_profit", 0) > 0)
    win_rate = wins / len(entries) if entries else 0
    open_count = sum(1 for p in state.get("positions", []) if p.get("status") == "open")
    return {
        "mode": os.getenv("ATLAS_MODE", "paper"),
        "bankroll_usd": state["bankroll_usd"],
        "open_positions": open_count,
        "max_open_positions": 5,
        "total_trades": len(entries),
        "total_pnl": round(total_pnl, 4),
        "win_rate": round(win_rate, 4),
        "kill_switch_active": False,
        "daily_loss_pct": 0,
        "last_scan": state.get("last_scan"),
        "opportunities_count": len(state.get("opportunities", [])),
        "ts": utcnow(),
    }


@app.get("/dashboard")
def dashboard():
    """Endpoint tunggal untuk semua data dashboard — dipanggil Vercel."""
    state = load_state()
    entries = read_journal()

    total_pnl = sum(e.get("locked_profit", 0) for e in entries)
    wins = sum(1 for e in entries if e.get("locked_profit", 0) > 0)
    win_rate = wins / len(entries) if entries else 0
    open_count = sum(1 for p in state.get("positions", []) if p.get("status") == "open")
    bankroll = state["bankroll_usd"]

    # Equity curve
    equity = bankroll - total_pnl  # starting equity
    equity_curve = []
    for e in entries:
        equity += e.get("locked_profit", 0)
        equity_curve.append({"date": e.get("ts", utcnow()), "equity": round(equity, 4),
                              "pnl": round(e.get("locked_profit", 0), 6)})

    recent = entries[-20:][::-1]
    trades_out = [{
        "id": str(i),
        "timestamp": e.get("ts", ""),
        "market_id": e.get("market_id", ""),
        "description": e.get("desc", ""),
        "strategy": e.get("strategy", "arbitrage"),
        "venue": e.get("venue", "polymarket"),
        "sets": e.get("filled_sets", 0),
        "notional_usd": round(e.get("filled_sets", 0) * 0.95, 2),
        "locked_profit": round(e.get("locked_profit", 0), 4),
        "fill_pct": 1.0,
        "note": e.get("note", ""),
        "mode": "paper",
    } for i, e in enumerate(recent)]

    opps_out = [{
        "market_id": o.get("market_id", ""),
        "question": o.get("question", ""),
        "edge_pct": o.get("edge_pct", 0),
        "implied_prob_yes": 0.5,
        "implied_prob_no": 0.5,
        "depth_usd": round(o.get("executable_sets", 0) * o.get("cost_per_set", 0.95), 2),
        "strategy": o.get("strategy", "arbitrage"),
        "venue": o.get("venue", "polymarket"),
        "detected_at": o.get("detected_at", utcnow()),
    } for o in state.get("opportunities", [])[:20]]

    return {
        "stats": {
            "mode": os.getenv("ATLAS_MODE", "paper"),
            "uptime_hours": 0,
            "last_scan_at": state.get("last_scan") or utcnow(),
            "opportunities_found_today": len(state.get("opportunities", [])),
            "trades_today": len([e for e in entries
                                 if e.get("ts", "").startswith(datetime.now(timezone.utc).date().isoformat())]),
            "realized_pnl_today": 0,
            "realized_pnl_total": round(total_pnl, 4),
            "win_rate": round(win_rate, 4),
            "avg_edge_pct": 0,
            "kill_switch_active": False,
            "daily_loss_pct": 0,
            "bankroll_usd": bankroll,
            "open_positions": open_count,
            "max_open_positions": 5,
        },
        "recent_trades": trades_out,
        "opportunities": opps_out,
        "equity_history": equity_curve[-100:],
        "backtest": None,
        "last_updated": utcnow(),
    }


@app.get("/trades")
def get_trades(limit: int = 100):
    entries = read_journal()
    recent = entries[-limit:][::-1]
    return [{
        "id": str(i),
        "timestamp": e.get("ts", ""),
        "market_id": e.get("market_id", ""),
        "description": e.get("desc", ""),
        "strategy": e.get("strategy", "arbitrage"),
        "venue": e.get("venue", "polymarket"),
        "sets": e.get("filled_sets", 0),
        "notional_usd": round(e.get("filled_sets", 0) * 0.95, 2),
        "locked_profit": round(e.get("locked_profit", 0), 4),
        "fill_pct": 1.0,
        "note": e.get("note", ""),
        "mode": "paper",
    } for i, e in enumerate(recent)]


@app.get("/opportunities")
def get_opportunities():
    state = load_state()
    return state.get("opportunities", [])


# ── Write endpoints ────────────────────────────────────────────────────────────

@app.post("/funds")
def set_funds(req: FundsRequest):
    if req.bankroll_usd <= 0:
        raise HTTPException(status_code=400, detail="bankroll_usd harus positif")
    if req.bankroll_usd > 1_000_000:
        raise HTTPException(status_code=400, detail="Max 1M USD")
    state = load_state()
    old = state["bankroll_usd"]
    state["bankroll_usd"] = round(req.bankroll_usd, 2)
    save_state(state)
    log.info("funds_updated", old=old, new=req.bankroll_usd)
    return {"ok": True, "old": old, "new": state["bankroll_usd"]}


@app.get("/markets/scan")
def scan_markets(limit: int = 50, min_edge: float = 0.03):
    try:
        from core.config import get_config
        from core.data.clob_client import PolymarketReadClient
        from core.edge.scanner import find_opportunities

        cfg = get_config()
        with PolymarketReadClient() as client:
            opps = find_opportunities(
                client, limit=limit, max_markets=limit,
                min_edge=min_edge,
                min_notional=float(cfg.risk.get("min_orderbook_depth_usd", 15.0)),
            )
    except Exception as e:
        log.warning("scan_failed", err=str(e))
        return {"opportunities": [], "count": 0, "error": str(e)}

    results = [{"market_id": mid, "question": desc,
                "edge_pct": round(opp.edge_pct, 4), "edge": round(opp.edge, 4),
                "cost_per_set": round(opp.cost_per_set, 4),
                "executable_sets": round(opp.executable_sets, 4),
                "required_capital": round(opp.required_capital, 2),
                "strategy": opp.type.value, "venue": "polymarket", "detected_at": utcnow()}
               for mid, desc, opp in opps]
    return {"opportunities": results, "count": len(results)}


@app.post("/positions/open")
def open_position(req: OpenPositionRequest):
    if req.sets <= 0:
        raise HTTPException(status_code=400, detail="sets harus > 0")
    if req.cost_per_set <= 0 or req.cost_per_set >= 1:
        raise HTTPException(status_code=400, detail="cost_per_set harus antara 0 dan 1")

    state = load_state()
    bankroll = state["bankroll_usd"]
    locked_profit = round(req.sets * (1.0 - req.cost_per_set), 4)
    notional = round(req.sets * req.cost_per_set, 2)

    if notional > bankroll * 0.02:
        max_sets = (bankroll * 0.02) / req.cost_per_set
        locked_profit = round(max_sets * (1.0 - req.cost_per_set), 4)
        notional = round(max_sets * req.cost_per_set, 2)
        req.sets = round(max_sets, 4)

    position_id = str(uuid.uuid4())[:8]
    position = {"id": position_id, "market_id": req.market_id, "question": req.question,
                "sets": req.sets, "cost_per_set": req.cost_per_set, "notional_usd": notional,
                "locked_profit": locked_profit, "edge_pct": req.edge_pct,
                "strategy": req.strategy, "venue": req.venue, "status": "open",
                "opened_at": utcnow(), "note": req.note}

    JOURNAL_FILE.parent.mkdir(parents=True, exist_ok=True)
    entry = {"ts": utcnow(), "market_id": req.market_id, "desc": req.question,
             "filled_sets": req.sets, "locked_profit": locked_profit, "fully_filled": True,
             "note": f"manual|{req.note}", "strategy": req.strategy, "venue": req.venue}
    with JOURNAL_FILE.open("a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")

    state["positions"].append(position)
    state["bankroll_usd"] = round(bankroll + locked_profit, 2)
    save_state(state)
    log.info("position_opened", id=position_id, profit=locked_profit)
    return {"ok": True, "position": position}


@app.get("/positions")
def list_positions():
    return {"positions": load_state().get("positions", [])}


@app.delete("/positions/{position_id}")
def close_position(position_id: str):
    state = load_state()
    for p in state.get("positions", []):
        if p["id"] == position_id:
            p["status"] = "closed"
            p["closed_at"] = utcnow()
            save_state(state)
            return {"ok": True, "position": p}
    raise HTTPException(status_code=404, detail=f"Posisi {position_id} tidak ditemukan")
