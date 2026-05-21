from __future__ import annotations

import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT_DIR))

from backend.app.services.longbridge_auth import get_longbridge_config, token_storage_hint


def main() -> None:
    get_longbridge_config()
    print("Longbridge OAuth finished.")
    print(f"Token storage: {token_storage_hint()}")


if __name__ == "__main__":
    try:
        main()
    except RuntimeError as exc:
        print(f"Longbridge OAuth setup error: {exc}")
        raise SystemExit(1)
