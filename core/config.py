"""Konfigurasi terpusat untuk atlas-poly.

Dua sumber, dipisah dengan sengaja:
  * SECRET   -> .env       (private key, API key)  — TIDAK di-commit
  * STRATEGI -> settings.yaml (parameter risiko/edge) — boleh di-commit

Loader ini menggabungkan keduanya dan memvalidasi invariant keamanan
yang paling penting: mode default WAJIB 'paper'.
"""

from __future__ import annotations

from enum import Enum
from pathlib import Path
from typing import Any

import yaml
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parent.parent
CONFIG_DIR = PROJECT_ROOT / "config"
ENV_FILE = CONFIG_DIR / ".env"
SETTINGS_FILE = CONFIG_DIR / "settings.yaml"


class Mode(str, Enum):
    PAPER = "paper"
    LIVE = "live"


class Secrets(BaseSettings):
    """Secret dari .env. Semua opsional di Fase 0–5 (paper tidak butuh wallet)."""

    model_config = SettingsConfigDict(
        env_prefix="ATLAS_",
        env_file=str(ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    mode: Mode = Mode.PAPER
    private_key: str = ""
    wallet_address: str = ""
    clob_host: str = "https://clob.polymarket.com"
    chain_id: int = 137
    api_key: str = ""
    api_secret: str = ""
    api_passphrase: str = ""
    telegram_bot_token: str = ""
    telegram_chat_id: str = ""

    def requires_wallet(self) -> bool:
        """True kalau mode butuh wallet (live). Paper tidak butuh."""
        return self.mode == Mode.LIVE


def load_strategy(path: Path = SETTINGS_FILE) -> dict[str, Any]:
    """Muat parameter strategi/risiko dari settings.yaml."""
    if not path.exists():
        raise FileNotFoundError(f"settings.yaml tidak ditemukan di {path}")
    with path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


class Config:
    """Gabungan secret + strategi, dengan guard keamanan."""

    def __init__(self) -> None:
        self.secrets = Secrets()
        self.strategy = load_strategy()
        self._enforce_safety_invariants()

    def _enforce_safety_invariants(self) -> None:
        # Guard 1: live mode WAJIB punya wallet — kalau tidak, refuse.
        if self.secrets.mode == Mode.LIVE and not self.secrets.private_key:
            raise ValueError(
                "MODE=live tapi ATLAS_PRIVATE_KEY kosong. "
                "Refuse to start: tidak akan pura-pura live tanpa wallet."
            )
        # Guard 2: Kelly fraction tidak boleh > 1 (full Kelly sudah agresif; >1 = bunuh diri).
        kf = self.risk.get("kelly_fraction", 0.25)
        if kf > 1.0:
            raise ValueError(f"kelly_fraction={kf} berbahaya (>1). Periksa settings.yaml.")

    @property
    def mode(self) -> Mode:
        return self.secrets.mode

    @property
    def is_live(self) -> bool:
        return self.secrets.mode == Mode.LIVE

    @property
    def risk(self) -> dict[str, Any]:
        return self.strategy.get("risk", {})

    @property
    def edge(self) -> dict[str, Any]:
        return self.strategy.get("edge", {})

    @property
    def execution(self) -> dict[str, Any]:
        return self.strategy.get("execution", {})


def get_config() -> Config:
    """Entry point: ambil konfigurasi tervalidasi."""
    return Config()
