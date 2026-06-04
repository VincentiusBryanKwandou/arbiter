# 01 — HIPOTESIS EDGE (artefak keputusan FASE 0)

> Aturan dari master prompt: **No edge, no trade.** Bot tidak boleh dibangun lebih jauh
> sampai ada satu hipotesis yang bisa difalsifikasi (bisa dibuktikan SALAH).
> File ini adalah keputusan yang harus Anda (user) isi/konfirmasi.

## Status: ✅ LOCKED (2026-06-04)

- **Edge:** `cross_market_arb`
- **Domain:** POLITIK (politik = best case; market politik likuid, banyak market saling terkait → lahan arbitrage paling subur)
- **Window observasi:** 14 hari sebelum menyimpulkan
- **Threshold edge:** `0.05` (default settings.yaml)

---

## Kandidat edge (default pilihan untuk modal kecil)

`settings.yaml` saat ini menyetel `active_edge: cross_market_arb`. Alasannya:

| Edge | Butuh kecepatan? | Butuh modal besar? | Cocok pemula+$kecil? |
|------|------------------|--------------------|----------------------|
| Stale pricing / latency | Ya (kompetitif) | Sedang | ❌ kalah cepat dari pro |
| **Cross-market arbitrage** | Tidak | Kecil–sedang | ✅ **dipilih** |
| Longshot bias | Tidak | Sedang | ⚠️ butuh data historis |
| Market making | Tidak | Besar | ❌ butuh inventory |
| Fundamental model | Tidak | Kecil | ✅ kalau punya niche |

**Cross-market arbitrage** dipilih karena: matematis (bukan adu kecepatan), bisa diuji murni dari data publik, dan tidak menuntut modal besar untuk membuktikan konsepnya di paper.

---

## Hipotesis (TEMPLATE — isi setajam mungkin)

> Tulis sespesifik ini contoh: *"Polymarket NBA game-winner bereaksi >90 detik setelah skor berubah di feed X."*

**Pernyataan:**
> Di Polymarket terdapat set market yang secara logika saling terkait (mis. market "Kandidat X menang pemilu" vs gabungan market per-negara-bagian, atau market "YES" + "NO" yang seharusnya berjumlah ~1.00 setelah biaya). Kadang jumlah harga implisitnya menyimpang dari batas no-arbitrage lebih besar daripada biaya transaksi.

**Prediksi yang bisa difalsifikasi:**
> Dalam window observasi N hari, akan muncul ≥K kesempatan di mana penyimpangan harga > (biaya + threshold), dan strategi yang mengeksploitasinya menghasilkan ekspektasi positif setelah biaya di data out-of-sample.

**Cara membuktikan SALAH (penting!):**
> Kalau setelah N hari observasi: (a) penyimpangan < biaya hampir selalu, atau (b) saat ada penyimpangan, likuiditas terlalu tipis untuk dieksekusi tanpa menghapus edge → hipotesis GUGUR. Kita pivot atau berhenti. Itu hasil yang valid dan menyelamatkan modal.

---

## Yang harus user putuskan sebelum FASE 1

- [ ] Setujui `cross_market_arb` sebagai edge awal? (atau pilih lain)
- [ ] Tentukan domain market: politik / olahraga / crypto / makro? (sempit dulu)
- [ ] Window observasi data: berapa hari sebelum menyimpulkan? (saran: 14–30)
- [ ] Threshold edge minimal: pakai default `0.05` di settings.yaml? 

Setelah kotak di atas terisi, ubah **Status** jadi `✅ LOCKED` dan lanjut FASE 1.
