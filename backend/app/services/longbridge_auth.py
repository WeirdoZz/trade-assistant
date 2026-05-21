from __future__ import annotations

import os
from functools import lru_cache

from dotenv import load_dotenv
from longbridge.openapi import Config, OAuthBuilder

load_dotenv()


def _client_id() -> str:
    client_id = os.getenv("LONGBRIDGE_CLIENT_ID", "").strip()
    if not client_id:
        raise RuntimeError("Missing LONGBRIDGE_CLIENT_ID. Copy .env.example to .env and fill it.")
    return client_id


def _apply_region_env() -> None:
    region = os.getenv("LONGBRIDGE_REGION", "").strip()
    if region:
        os.environ.setdefault("LONGBRIDGE_REGION", region)


@lru_cache(maxsize=1)
def get_longbridge_config() -> Config:
    _apply_region_env()
    oauth = OAuthBuilder(_client_id()).build(
        lambda url: print(f"Please open this URL to authorize Longbridge: {url}")
    )
    return Config.from_oauth(oauth)


def token_storage_hint() -> str:
    return os.path.expanduser(f"~/.longbridge/openapi/tokens/{_client_id()}")
