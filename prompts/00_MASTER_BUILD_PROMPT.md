# MASTER BUILD PROMPT — Polymarket Quant Bot ("Atlas-Poly")

> **Cara pakai file ini:** Buka Claude Code di folder project ini, lalu ketik:
> `Baca prompts/00_MASTER_BUILD_PROMPT.md dan mulai dari FASE 0. Jangan lompat fase. Konfirmasi tiap akhir fase sebelum lanjut.`
>
> File ini adalah *spesifikasi*, bukan janji profit. Profit datang dari edge yang terbukti di backtest + disiplin risiko, bukan dari dashboard yang keren.

---

## 0. FILOSOFI (baca sekali, pegang selamanya)

Bot di screenshot viral itu menjual **estetika**. Kita bangun **proses**. Tiga hukum:

1. **No edge, no trade.** Bot tidak boleh pasang order kalau tidak bisa membuktikan harga pasar salah secara terukur. "Feeling" = 0 trade.
2. **Backtest dulu, uang belakangan.** Urutan wajib: simulasi → paper trading (uang palsu, harga live) → live mikro ($5–$20) → scale. Tidak boleh lompat.
3. **Kelangsungan hidup > profit.** Satu aturan risiko bisa membatalkan 100 sinyal bagus. Drawdown yang membunuh akun lebih buruk daripada profit yang terlewat.

**Target realistis:** Fase 1–4 ini tujuannya BUKAN cuan, tapi **membuktikan apakah Anda punya edge sama sekali**. 90% kemungkinan jawabannya "belum" — dan itu hasil yang berharga karena menyelamatkan modal Anda.

---

## 1. APA ITU EDGE DI POLYMARKET (bagian yang diloncati semua tutorial)

Polymarket = pasar prediksi. Harga share = probabilitas implisit (share "YES" $0.61 ≈ pasar bilang 61% kemungkinan terjadi). Anda untung HANYA jika estimasi probabilitas Anda **lebih akurat** daripada konsensus pasar, secara konsisten, setelah dikurangi biaya.

Sumber edge yang nyata (pilih 1–2, jangan semua):

- **A. Stale pricing / latency.** Berita keluar, harga belum bergerak. Bot baca sumber (RSS, API berita, oracle, hasil resmi) lebih cepat dari trader manual. → butuh infra cepat, kompetitif.
- **B. Cross-market arbitrage.** Market berkorelasi yang harganya tidak konsisten (mis. "Kandidat X menang" vs gabungan market negara bagian). → matematika, bukan kecepatan. **Paling cocok untuk pemula + modal kecil.**
- **C. Mispriced longshots / favorite-longshot bias.** Pasar prediksi sistematis salah harga di ekor (event 2% sering dihargai 5%). → butuh data historis untuk kalibrasi.
- **D. Market making.** Pasang bid/ask, makan spread. → butuh modal & manajemen inventory, **bukan untuk $20**.
- **E. Model fundamental.** Anda punya model (statistik olahraga, polling, on-chain) yang prediksinya lebih baik dari pasar di niche sempit. → ini edge paling tahan lama.

**Keputusan Fase 0:** Bot HARUS mendeklarasikan satu hipotesis edge yang bisa difalsifikasi. Contoh: *"Polymarket NBA game-winner markets bereaksi >90 detik setelah skor berubah di feed X; saya bisa baca dalam <5 detik."* Kalau tidak bisa dituliskan setajam ini → belum siap build.

---

## 2. ARSITEKTUR (modular, tiap modul bisa dites sendiri)

```
atlas-poly/
├── prompts/                 # spec (file ini & turunannya)
├── config/
│   ├── settings.yaml        # parameter strategi, risk limits
│   └── .env                 # SECRET: private key, API keys (jangan commit)
├── core/
│   ├── data/                # ingestion: CLOB API, harga, orderbook, berita
│   ├── edge/                # model probabilitas + deteksi mispricing
│   ├── risk/                # Kelly sizing, limits, kill-switch
│   ├── execution/           # order placement, fill tracking, retry
│   └── portfolio/           # posisi, PnL, accounting
├── backtest/                # engine simulasi + walk-forward + Monte Carlo
├── paper/                   # paper trading loop (harga live, uang palsu)
├── live/                    # live loop (uang nyata, default OFF)
├── storage/                 # SQLite/Parquet: tick data, trades, logs
├── dashboard/               # monitoring read-only (opsional, fase akhir)
├── tests/                   # pytest untuk tiap modul
└── runbook.md               # SOP operasional + prosedur darurat
```

**Loop eksekusi** (versi jujur dari "Scan→Detect→Validate→Size→Fill→Settle" di screenshot):

```
SCAN     → tarik market aktif + orderbook + sumber data eksternal
DETECT   → model hitung P(event). Bandingkan vs harga pasar. Hitung edge = |P_model - P_market|
VALIDATE → lolos filter? (edge > threshold, likuiditas cukup, spread oke,
            tidak melanggar risk limit, market belum mau resolve)
SIZE     → fractional Kelly (lihat §4). Cap keras.
ROUTE    → mode PAPER atau LIVE. PAPER mencatat tanpa kirim order.
FILL     → kirim limit order via CLOB, lacak status, handle partial/reject
SETTLE   → update posisi, PnL, log alasan tiap trade (audit trail)
LEARN    → bandingkan prediksi vs hasil resmi → update kalibrasi model
```

---

## 3. TECH STACK

- **Bahasa:** Python 3.11+ (ekosistem quant + ada SDK Polymarket resmi).
- **Polymarket:** `py-clob-client` (CLOB API resmi). Chain: **Polygon**. Settlement token: **USDC**. Butuh wallet (private key) + USDC + sedikit MATIC untuk gas/approval.
- **Data & numerik:** `pandas`, `numpy`, `polars` (cepat), `scipy` (statistik).
- **Penyimpanan:** SQLite untuk trades/log; Parquet untuk tick data historis.
- **Penjadwalan:** `asyncio` loop + `apscheduler`. WebSocket untuk harga real-time bila tersedia.
- **Config/secret:** `pydantic-settings` + `.env` (WAJIB di `.gitignore`).
- **Test:** `pytest`. **Lint:** `ruff`. **Types:** `mypy`.
- **Monitoring:** logging terstruktur (`structlog`) + notifikasi Telegram/Discord (read-only, hanya alert — BUKAN copytrade).

---

## 4. RISK MANAGEMENT (modul paling penting — bangun ini SEBELUM execution)

Hard rules, di-hardcode, tidak bisa di-override oleh strategi:

- **Fractional Kelly.** Pakai `f = 0.25 × Kelly` (quarter-Kelly). Full Kelly terlalu liar; satu salah estimasi probabilitas = drawdown brutal. Kelly butuh estimasi probabilitas yang Anda percaya — kalau ragu, pakai fixed-fraction kecil (mis. 1% modal/trade).
- **Per-trade cap:** maksimal 2% modal per posisi (keras, di atas hasil Kelly).
- **Per-market cap:** maksimal 5% modal di satu market.
- **Daily loss limit / kill-switch:** kalau rugi > X% dalam sehari → bot stop sendiri, kirim alert, butuh konfirmasi manual untuk lanjut.
- **Max open positions:** batasi (mis. 5) supaya tidak over-leverage.
- **Liquidity gate:** jangan masuk market dengan kedalaman orderbook tipis (slippage memakan edge).
- **Resolution buffer:** jangan buka posisi baru terlalu dekat waktu resolve (risiko ambiguitas/oracle).
- **Circuit breaker:** kalau model error / data feed mati / API gagal berulang → halt, jangan trade buta.

> Aturan emas: **mode default adalah PAPER.** Live mode butuh flag eksplisit + konfirmasi + saldo nyata yang kecil. Tidak ada "auto-go-live".

---

## 5. BACKTEST & VALIDASI (ini yang membedakan bot beneran dari mockup)

Screenshot pamer "Monte Carlo 7,448 paths". Kita lakukan yang sebenarnya, dengan kejujuran:

1. **Kumpulkan data historis** market Polymarket (harga, orderbook snapshot, hasil resolve) ke Parquet. Tanpa data, tidak ada backtest.
2. **Backtest event-driven** (bukan vektor) — replay tick demi tick, hormati likuiditas & biaya. Hindari look-ahead bias.
3. **Walk-forward validation:** kalibrasi parameter di periode A, uji di periode B yang belum dilihat. Kalau cuma jago di in-sample → overfit, buang.
4. **Cost model realistis:** masukkan gas, slippage, spread, kemungkinan order tidak terisi. Banyak "edge" hilang setelah biaya.
5. **Monte Carlo / bootstrap:** acak urutan trade ribuan kali → distribusi drawdown & ruin probability. Pertanyaan kunci: *"Berapa probabilitas akun saya nol?"*
6. **Metrik yang dilaporkan jujur:** Sharpe, max drawdown, win rate, avg R/R, **calibration curve** (apakah prediksi 60% Anda benar-benar terjadi 60% kali), dan **probability of ruin**. Bukan cuma "total profit" yang gemuk.

**Gate untuk lanjut ke live:** edge tetap positif setelah biaya, di out-of-sample, dengan ruin probability rendah. Kalau tidak lolos → **jangan live**. Itu fitur, bukan kegagalan.

---

## 6. FASE PEMBANGUNAN (Claude Code kerjakan berurutan)

> Di tiap akhir fase: tampilkan ringkasan, jalankan test, minta konfirmasi user. Jangan lanjut tanpa "OK".

- **FASE 0 — Setup & Hipotesis.** Init repo, struktur folder, `.gitignore`, virtualenv, dependencies, `settings.yaml`, `.env.example`. Tulis hipotesis edge yang falsifiable (§1) ke `prompts/01_EDGE_HYPOTHESIS.md`. **Belum sentuh uang/wallet.**
- **FASE 1 — Data ingestion (read-only).** Konek `py-clob-client` mode read-only: tarik daftar market, orderbook, harga. Simpan snapshot ke storage. Test koneksi. **Tanpa private key dulu — pakai endpoint publik.**
- **FASE 2 — Edge engine.** Implementasi model probabilitas untuk hipotesis terpilih + deteksi mispricing + filter validasi. Unit test dengan data sintetis.
- **FASE 3 — Risk module.** Kelly fraksional + semua hard limit + kill-switch (§4). Test: pastikan limit tidak bisa ditembus.
- **FASE 4 — Backtest engine.** §5 lengkap. Jalankan di data historis. **Laporkan apakah edge nyata.** Ini titik keputusan terbesar: lanjut atau pivot.
- **FASE 5 — Paper trading.** Loop live: harga real, order disimulasikan, PnL dicatat. Jalankan **minimal 2–4 minggu**. Bandingkan paper-PnL vs ekspektasi backtest.
- **FASE 6 — Live mikro (opsional, hanya jika 4 & 5 lolos).** Wallet + USDC + MATIC, modal **sangat kecil**, semua limit aktif, kill-switch hidup. Mulai 1 market. Awasi seperti elang.
- **FASE 7 — Monitoring & runbook.** Dashboard read-only + alert Telegram + `runbook.md` (cara start/stop, prosedur darurat, apa yang dilakukan saat bot rugi beruntun).

---

## 7. KEAMANAN (jangan sampai kehilangan modal karena kebodohan teknis)

- Private key **HANYA** di `.env`, **WAJIB** di `.gitignore`. Jangan pernah paste ke chat, commit, atau screenshot.
- Pakai **wallet khusus bot** dengan dana minimal — bukan wallet utama Anda.
- Set **allowance/approval USDC terbatas**, bukan unlimited, kalau memungkinkan.
- Validasi semua input dari API eksternal (jangan percaya data feed buta).
- Rate-limit & retry dengan backoff. Jangan spam API (bisa kena ban).
- Log semua keputusan trade (audit trail) — untuk debug & evaluasi, bukan untuk pamer.

---

## 8. YANG TIDAK BOLEH DILAKUKAN

- ❌ Lompat langsung ke live trading "karena tidak sabar".
- ❌ Naikkan ukuran posisi setelah kalah untuk "balas dendam" (martingale = jalan menuju nol).
- ❌ Percaya backtest yang terlalu indah (kemungkinan besar overfit/look-ahead bug).
- ❌ Pakai modal yang Anda butuhkan untuk hidup. (lihat `02_MODAL_20_USD_REALITA.md`)
- ❌ Kirim uang ke bot copytrade pihak ketiga dari iklan.

---

## 9. DEFINITION OF DONE per modul

Setiap modul "selesai" hanya jika: ada unit test yang lulus, ada docstring, error handling untuk kasus gagal (API down, data kosong, order reject), dan tercatat di `runbook.md` cara mengoperasikannya. Dashboard keren = paling akhir, opsional, dan tidak menambah satu sen pun profit.

---

*Akhir master prompt. Mulai dari FASE 0. Ingat Hukum #3: kelangsungan hidup dulu.*
