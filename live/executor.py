"""Live executor (FASE 6) — UANG NYATA. DEFAULT MENOLAK BERJALAN.

⚠️  BACA SEBELUM MENGAKTIFKAN:
Modul ini memasang order SUNGGUHAN di Polymarket. Ia HANYA boleh dipakai
setelah Fase 4 (backtest) DAN Fase 5 (paper ≥14 hari) lolos. Berlapis guard:

  1. settings/.env: ATLAS_MODE harus "live"
  2. .env: ATLAS_PRIVATE_KEY harus terisi (wallet KHUSUS bot, dana minimal)
  3. .env: ATLAS_LIVE_CONFIRM harus persis "I_UNDERSTAND_THE_RISK"
  4. py-clob-client harus terpasang

Kalau salah satu tak terpenuhi -> konstruksi GAGAL (sengaja). Tidak ada
"diam-diam live".

⚠️  LEG-RISK: arbitrage multi-leg tidak atomik di on-chain CLOB. Satu leg bisa
terisi sementara leg lain tidak -> Anda memegang posisi telanjang. Implementasi
ini memasang order lalu MEMANTAU; strategi unwinding parsial yang matang adalah
pekerjaan lanjutan dan WAJIB diuji di modal sangat kecil dulu.
"""

from __future__ import annotations

import os

import structlog

from core.config import Config, Mode
from core.edge.arbitrage import ArbOpportunity
from core.execution.base import ArbResult, Broker, orders_from_opportunity

log = structlog.get_logger()

LIVE_CONFIRM_TOKEN = "I_UNDERSTAND_THE_RISK"


class LiveGuardError(RuntimeError):
    """Diangkat kalau prasyarat keamanan live tidak terpenuhi."""


def assert_live_allowed(cfg: Config) -> None:
    """Periksa SEMUA guard. Raise LiveGuardError kalau ada yang gagal."""
    if cfg.mode != Mode.LIVE:
        raise LiveGuardError("ATLAS_MODE != live. Live executor menolak berjalan.")
    if not cfg.secrets.private_key:
        raise LiveGuardError("ATLAS_PRIVATE_KEY kosong. Tidak akan trade tanpa wallet.")
    if os.getenv("ATLAS_LIVE_CONFIRM", "") != LIVE_CONFIRM_TOKEN:
        raise LiveGuardError(
            f"ATLAS_LIVE_CONFIRM != '{LIVE_CONFIRM_TOKEN}'. "
            "Set token konfirmasi eksplisit untuk mengaktifkan live."
        )


class LiveBroker(Broker):
    """Broker live via py-clob-client. Konstruksi gagal kalau guard tak lolos."""

    def __init__(self, cfg: Config):
        assert_live_allowed(cfg)  # <-- gerbang utama
        self.cfg = cfg
        self._client = self._build_client()
        log.warning("LIVE_BROKER_ACTIVE", host=cfg.secrets.clob_host,
                    wallet=cfg.secrets.wallet_address[:10] + "...")

    def _build_client(self):
        try:
            from py_clob_client.client import ClobClient  # type: ignore
        except ImportError as e:  # pragma: no cover
            raise LiveGuardError(
                "py-clob-client belum terpasang. `pip install py-clob-client`."
            ) from e
        return ClobClient(
            host=self.cfg.secrets.clob_host,
            key=self.cfg.secrets.private_key,
            chain_id=self.cfg.secrets.chain_id,
        )

    def place_arb(
        self, opp: ArbOpportunity, market_id: str, sets: float, cost_per_tx: float = 0.0
    ) -> ArbResult:  # pragma: no cover — tidak dijalankan tanpa wallet nyata
        from py_clob_client.clob_types import OrderArgs  # type: ignore

        orders = orders_from_opportunity(opp, sets)
        fills = []
        for o in orders:
            args = OrderArgs(token_id=o.token_id, price=o.price, size=o.size, side="BUY")
            signed = self._client.create_order(args)
            resp = self._client.post_order(signed)
            log.warning("live_order_posted", token=o.token_id, resp=str(resp)[:120])
            # NOTE: parsing fill nyata + penanganan partial/leg-risk = pekerjaan lanjutan.
        return ArbResult(market_id=market_id, fills=fills, requested_sets=sets,
                         note="LIVE order(s) posted — verifikasi fill manual via dashboard")

    def balance(self) -> float:  # pragma: no cover
        """Query saldo USDC on-chain via py-clob-client (Polygon).

        Mengembalikan 0.0 kalau query gagal supaya loop tidak crash —
        risk manager akan menolak trade kalau bankroll terlalu kecil.
        """
        try:
            raw = self._client.get_balance()
            # py-clob-client >= 0.17 mengembalikan dict {"USDC": "<amount>"}
            # atau float tergantung versi; tangani keduanya.
            if isinstance(raw, dict):
                usdc = raw.get("USDC") or raw.get("usdc") or 0.0
                return float(usdc)
            return float(raw)
        except Exception as exc:  # noqa: BLE001
            log.warning("balance_query_failed", error=str(exc))
            return 0.0
