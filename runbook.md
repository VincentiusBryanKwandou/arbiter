# RUNBOOK — atlas-poly

SOP operasional + prosedur darurat. Diisi bertahap tiap fase. Default mode = **PAPER**.

## Setup (sekali)
```powershell
cd "E:\000VSCODE PROJECT MULAI DARI DESEMBER 2025\quant bot polymarket"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy config\.env.example config\.env   # lalu isi seperlunya (paper: biarkan kosong)
pytest -q                              # harus hijau sebelum lanjut
```

## Status fase
- [x] FASE 0 — Setup & hipotesis (struktur, config, test fondasi)
- [x] FASE 1 — Data ingestion read-only (CLOB publik) — `python -m core.data.collect`
- [x] FASE 2 — Edge engine (arbitrage + validasi sinyal)
- [x] FASE 3 — Risk module (Kelly, kill-switch, hard limits)
- [x] (bonus) Scanner integrasi read-only — `python -m core.edge.scanner`
- [x] Multi-venue (Polymarket + Manifold + Kalshi) + multi-strategi — `python -m core.edge.research`
- [x] Dashboard HTML + analytics — `python -m dashboard.html` (buka storage/dashboard.html)
- [x] FASE 4 — Backtest engine + walk-forward + Monte Carlo — `python -m backtest.run`
- [x] FASE 5 — Paper trading loop + journal — `python -m paper.loop --once`
- [x] FASE 6 — Live executor (guarded, default MENOLAK) — `python -m live.loop --once`
- [x] FASE 7 — Monitoring: report + alert — `python -m dashboard.report`

## Cara mengaktifkan LIVE (HANYA setelah Fase 4 & 5 lolos)
Semua wajib terpenuhi, kalau tidak live menolak jalan (by design):
1. `config/.env`: `ATLAS_MODE=live`
2. `config/.env`: `ATLAS_PRIVATE_KEY=<wallet khusus bot, dana minimal>`
3. `config/.env`: `ATLAS_LIVE_CONFIRM=I_UNDERSTAND_THE_RISK`
4. `pip install py-clob-client`
Mulai `--max-trades 1` di SATU market, awasi ketat.

## Prosedur darurat (diisi di fase live)
- **Kill-switch manual:** _(TBD Fase 3)_ — cara hentikan bot instan.
- **Bot rugi beruntun:** stop, jangan "balas dendam", review audit log.
- **Data feed mati / API error berulang:** circuit breaker halt otomatis (Fase 3).

## Aturan yang tidak bisa ditawar
1. Mode default PAPER. Live butuh flag eksplisit + saldo kecil + konfirmasi.
2. Private key hanya di `config/.env` (sudah di-.gitignore).
3. Jangan live sebelum backtest out-of-sample positif setelah biaya.
