# atlas-poly

Polymarket quant bot. **Proses dulu, profit belakangan.** Default mode: `PAPER`.

Ini bukan tiruan dashboard viral — ini sistem yang menolak trade tanpa edge terbukti.
Baca dulu, berurutan:

1. [`prompts/00_MASTER_BUILD_PROMPT.md`](prompts/00_MASTER_BUILD_PROMPT.md) — spesifikasi & 7 fase.
2. [`prompts/02_MODAL_20_USD_REALITA.md`](prompts/02_MODAL_20_USD_REALITA.md) — kenapa $20 = modal belajar.
3. [`prompts/01_EDGE_HYPOTHESIS.md`](prompts/01_EDGE_HYPOTHESIS.md) — keputusan edge (perlu input Anda).
4. [`runbook.md`](runbook.md) — cara menjalankan + status fase.

## Quick start (paper, tanpa uang)
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
pytest -q
```

## Peringatan
Trading prediction market berisiko kehilangan 100% modal. Bot ini tidak menjamin profit.
Default mode paper; live butuh tindakan eksplisit Anda sendiri. Jangan pakai uang kebutuhan hidup.
