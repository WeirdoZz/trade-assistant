from __future__ import annotations

from datetime import date, timedelta
from math import sin
from random import Random


def build_mock_dashboard(symbol: str) -> dict:
    rng = Random(symbol)
    start = date.today() - timedelta(days=120)
    base = 140 + rng.random() * 160
    prices = []

    for index in range(121):
        current = start + timedelta(days=index)
        drift = index * (0.22 + rng.random() * 0.02)
        cycle = sin(index / 7) * 7.5
        noise = rng.uniform(-4.2, 4.2)
        close = round(base + drift + cycle + noise, 2)
        volume = int(28_000_000 + rng.random() * 75_000_000)
        prices.append(
            {
                "date": current.isoformat(),
                "close": close,
                "volume": volume,
            }
        )

    last_close = prices[-1]["close"]
    previous_close = prices[-2]["close"]
    change_percent = round(((last_close - previous_close) / previous_close) * 100, 2)

    return {
        "symbol": symbol,
        "quote": {
            "name": f"{symbol} Inc.",
            "price": last_close,
            "changePercent": change_percent,
            "market": "US",
            "updatedAt": date.today().isoformat(),
        },
        "prices": prices,
        "signals": [
            {"label": "趋势强度", "value": "偏强", "score": 78},
            {"label": "消息情绪", "value": "谨慎乐观", "score": 64},
            {"label": "期权异动", "value": "Call 放量", "score": 71},
            {"label": "波动风险", "value": "中高", "score": 58},
        ],
        "news": [
            {
                "title": f"{symbol} 近月营收预期被上调，机构关注 AI 与云端支出",
                "source": "Market Wire",
                "time": "2 小时前",
                "sentiment": "positive",
            },
            {
                "title": "美债收益率回落，成长股估值压力短线缓解",
                "source": "Macro Desk",
                "time": "5 小时前",
                "sentiment": "neutral",
            },
            {
                "title": f"{symbol} 本周看涨期权成交量高于 30 日均值",
                "source": "Options Flow",
                "time": "昨天",
                "sentiment": "positive",
            },
        ],
        "analysis": {
            "stance": "观察偏多",
            "buyZone": f"{round(last_close * 0.96, 2)} - {round(last_close * 0.985, 2)}",
            "sellZone": f"{round(last_close * 1.08, 2)} - {round(last_close * 1.14, 2)}",
            "risk": f"若跌破 {round(last_close * 0.93, 2)}，短线趋势可能转弱。",
            "summary": "占位分析：价格维持上行通道，成交量未出现明显背离，新闻与期权流目前偏正面。接入长桥与大模型后，这里会输出可追溯的综合研判。",
        },
    }
