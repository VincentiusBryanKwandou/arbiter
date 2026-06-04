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
- [ ] FASE 1 — Data ingestion read-only (CLOB publik)
- [ ] FASE 2 — Edge engine
- [ ] FASE 3 — Risk module
- [ ] FASE 4 — Backtest (titik keputusan: ada edge atau tidak)
- [ ] FASE 5 — Paper trading (≥14 hari)
- [ ] FASE 6 — Live mikro ($5–$10, opsional, hanya jika 4 & 5 lolos)
- [ ] FASE 7 — Monitoring & alert

## Prosedur darurat (diisi di fase live)
- **Kill-switch manual:** _(TBD Fase 3)_ — cara hentikan bot instan.
- **Bot rugi beruntun:** stop, jangan "balas dendam", review audit log.
- **Data feed mati / API error berulang:** circuit breaker halt otomatis (Fase 3).

## Aturan yang tidak bisa ditawar
1. Mode default PAPER. Live butuh flag eksplisit + saldo kecil + konfirmasi.
2. Private key hanya di `config/.env` (sudah di-.gitignore).
3. Jangan live sebelum backtest out-of-sample positif setelah biaya.
