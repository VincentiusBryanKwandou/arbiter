# ARBITER

> **"I build only the best systems. This is the best political-market quant bot
> ever created — nobody does arbitrage like this. Nobody."**

**Arbiter** is a process-first, evidence-gated quant bot for political prediction
markets (Polymarket). It hunts cross-market arbitrage — no-arbitrage violations
between correlated election and political outcome markets — sizes positions with
fractional Kelly, and **refuses to place a single trade without a backtested,
out-of-sample edge.** Default mode is always `PAPER`. Live trading requires
passing every guard explicitly.

---

## Why This Exists

Every viral "AI quant bot" screenshot is a dashboard mockup. This is the opposite:
a modular, test-driven system that earns the right to trade through backtest,
then walk-forward validation, then paper observation — before a single dollar
touches a real market.

**Survival over profit. Process over aesthetics.**

---

## Architecture

```
arbiter/
├── core/
│   ├── data/         # Polymarket CLOB + Kalshi + Manifold read clients
│   ├── edge/         # Arbitrage detection, signal validation, strategy library
│   ├── risk/         # Fractional Kelly, kill-switch, per-market caps
│   ├── execution/    # Simulated broker (paper) + Live broker (guarded)
│   ├── venues/       # Multi-venue normalizer + cross-venue discrepancy detector
│   └── analytics/    # Per-strategy / per-venue aggregation, equity curves
├── backtest/         # Event-driven backtest engine, Monte Carlo, walk-forward
├── paper/            # Paper trading loop + trade journal
├── live/             # Live executor (refuses to run without all guards cleared)
├── dashboard/        # HTML report generator + alert system
├── tests/            # 66 tests, 66 passing
└── prompts/          # Build spec, edge hypothesis, capital reality check
```

### Key Invariants

| Guard | Behavior |
|---|---|
| `ATLAS_MODE != live` | Live executor refuses construction |
| `ATLAS_PRIVATE_KEY` empty | Live executor refuses construction |
| `ATLAS_LIVE_CONFIRM != "I_UNDERSTAND_THE_RISK"` | Live executor refuses construction |
| Kelly fraction > 1.0 | Config loading fails hard |
| Paper mode missing wallet | Allowed — paper needs no wallet |

---

## Edge Strategy: Cross-Market Arbitrage

The primary edge hunted is **binary dutch-book violations**: when two related
political markets price the same underlying event such that the implied
probabilities sum to less than 1.0 after transaction costs, a risk-free
(or near-risk-free) position exists.

Secondary strategies in the library:
- **Longshot bias fade** — political markets systematically overprice long-shots
- **Mean reversion** — short-term price oscillation around fundamental value
- **Cross-venue discrepancy** — same event priced differently on Polymarket vs Kalshi vs Manifold

All strategies are hypothesis-gated: see [`prompts/01_EDGE_HYPOTHESIS.md`](prompts/01_EDGE_HYPOTHESIS.md).

---

## Quick Start (Paper Trading — No Real Money)

```powershell
# Clone & setup
git clone https://github.com/nayrbryanGaming/arbiter.git
cd arbiter
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Copy env template (no keys needed for paper)
cp config/.env.example config/.env

# Verify 66/66 tests pass
pytest -q

# Run paper trading loop (one cycle, real prices, fake money)
python -m paper.loop --once
```

---

## Run Modes

### Paper (default — safe, always)
```powershell
python -m paper.loop --cycles 10 --interval 60
```
Fetches live prices from Polymarket. Executes simulated fills. No wallet required.
Run for ≥14 days before treating results as meaningful.

### Backtest
```powershell
# Place historical snapshots in storage/snapshots/ then:
python -m backtest.run
```
Event-driven replay. No look-ahead. Outputs Sharpe, max-drawdown, Monte Carlo
ruin probability at 1,000 paths.

### Live (real money — all guards must clear)
```powershell
# Only after paper ≥14 days shows positive edge:
# 1. Set ATLAS_MODE=live in config/.env
# 2. Set ATLAS_PRIVATE_KEY=<dedicated bot wallet, funded minimally>
# 3. Set ATLAS_LIVE_CONFIRM=I_UNDERSTAND_THE_RISK
python -m live.loop --max-trades 1
```
Starts with `--max-trades 1`. Verify manually. Increase only when confident.

---

## Risk Parameters (defaults in `config/settings.yaml`)

| Parameter | Default | Meaning |
|---|---|---|
| `kelly_fraction` | `0.25` | Quarter-Kelly — 4x conservative |
| `max_position_pct` | `0.02` | Max 2% of bankroll per trade |
| `max_market_exposure_pct` | `0.05` | Max 5% per market |
| `daily_loss_kill_pct` | `0.10` | Kill-switch trips at 10% daily loss |
| `min_orderbook_depth_usd` | `50.0` | Skip thin books |
| `min_edge_threshold` | `0.05` | Skip edges < 5% after costs |
| `max_open_positions` | `5` | Never hold more than 5 positions |

---

## Test Suite

```
66 passed in 7.90s
```

Coverage: config, data models, CLOB parsing, edge detection, signal validation,
risk sizing, kill-switch, simulated execution, journal, analytics, backtest
engine, Monte Carlo, walk-forward, venues, cross-venue discrepancy.

Run: `pytest -v`

---

## Multi-Venue Support

| Venue | Read | Cross-venue arb |
|---|---|---|
| Polymarket | ✅ | ✅ |
| Kalshi | ✅ | ✅ |
| Manifold | ✅ | ✅ (free-money signal only) |

---

## Capital Reality

**$20 is a learning budget, not a trading budget.**

Read [`prompts/02_MODAL_20_USD_REALITA.md`](prompts/02_MODAL_20_USD_REALITA.md)
before touching live mode. The minimum meaningful live test is $50–$100 *that
you are prepared to lose entirely.* Paper trade for 14 days first. No exceptions.

---

## Build Spec & Phases

Full 7-phase implementation plan: [`prompts/00_MASTER_BUILD_PROMPT.md`](prompts/00_MASTER_BUILD_PROMPT.md)

| Phase | Status | Description |
|---|---|---|
| 0 | ✅ | Scaffolding, config, guards, env |
| 1 | ✅ | Polymarket read client, data models, snapshot store |
| 2 | ✅ | Edge detection (binary arb, mutually-exclusive arb) |
| 3 | ✅ | Risk module (Kelly, kill-switch, limits) |
| 4 | ✅ | Backtest engine (event-driven, Monte Carlo, walk-forward) |
| 5 | ✅ | Paper trading loop + journal |
| 6 | ✅ | Live executor (guarded — all guards must pass) |
| + | ✅ | Multi-venue (Kalshi, Manifold), dashboard, analytics |

---

## Runbook

Full operational commands: [`runbook.md`](runbook.md)

---

## Disclaimer

Trading prediction markets carries **100% loss risk.** This system does not
guarantee profit. It is provided for educational and research purposes. Past
simulated performance does not predict future live performance. Never trade
money you cannot afford to lose.

---

*Built by Vincentius Bryan Kwandou. Process-first. Survival over profit.*
