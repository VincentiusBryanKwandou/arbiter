"""Alert sender (FASE 7) — READ-ONLY notifikasi (Telegram).

HANYA mengirim pesan teks (alert) — TIDAK bisa trade, TIDAK bisa copytrade.
Kalau token/chat_id kosong -> no-op aman (cocok untuk dev/CI). Dipakai untuk:
kill-switch tripped, trade dieksekusi, error beruntun, ringkasan harian.
"""

from __future__ import annotations

import httpx
import structlog

from core.config import Config

log = structlog.get_logger()


def format_alert(kind: str, message: str) -> str:
    icons = {"info": "ℹ️", "trade": "✅", "warn": "⚠️", "halt": "🛑"}
    return f"{icons.get(kind, 'ℹ️')} [atlas-poly] {message}"


class AlertSender:
    def __init__(self, cfg: Config):
        self.token = cfg.secrets.telegram_bot_token
        self.chat_id = cfg.secrets.telegram_chat_id

    @property
    def enabled(self) -> bool:
        return bool(self.token and self.chat_id)

    def send(self, kind: str, message: str) -> bool:
        text = format_alert(kind, message)
        if not self.enabled:
            log.info("alert_noop", text=text)  # tetap tercatat di log lokal
            return False
        try:
            r = httpx.post(
                f"https://api.telegram.org/bot{self.token}/sendMessage",
                json={"chat_id": self.chat_id, "text": text},
                timeout=10.0,
            )
            r.raise_for_status()
            return True
        except Exception as e:  # noqa: BLE001
            log.warning("alert_failed", err=str(e))
            return False
