from __future__ import annotations

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.services.market_data import build_mock_dashboard

app = FastAPI(title="Trade Assistant API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/dashboard")
def dashboard(symbol: str = "NVDA") -> dict:
    return build_mock_dashboard(symbol.upper())


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("TRADE_ASSISTANT_PORT", "8765"))
    uvicorn.run(app, host="127.0.0.1", port=port)
