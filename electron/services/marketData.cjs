function makeRandom(seedText) {
  let seed = 0;
  for (let index = 0; index < seedText.length; index += 1) {
    seed = (seed * 31 + seedText.charCodeAt(index)) >>> 0;
  }

  return () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getDashboard(symbol = "NVDA") {
  const normalized = String(symbol || "NVDA").trim().toUpperCase();
  const random = makeRandom(normalized);
  const start = addDays(new Date(), -120);
  const base = 140 + random() * 160;
  const prices = [];

  for (let index = 0; index <= 120; index += 1) {
    const current = addDays(start, index);
    const drift = index * (0.22 + random() * 0.02);
    const cycle = Math.sin(index / 7) * 7.5;
    const noise = random() * 8.4 - 4.2;
    const close = Number((base + drift + cycle + noise).toFixed(2));
    const volume = Math.floor(28_000_000 + random() * 75_000_000);

    prices.push({
      date: current.toISOString().slice(0, 10),
      close,
      volume
    });
  }

  const lastClose = prices[prices.length - 1].close;
  const previousClose = prices[prices.length - 2].close;
  const changePercent = Number((((lastClose - previousClose) / previousClose) * 100).toFixed(2));

  return {
    symbol: normalized,
    quote: {
      name: `${normalized} Inc.`,
      price: lastClose,
      changePercent,
      market: "US",
      updatedAt: new Date().toISOString().slice(0, 10)
    },
    prices,
    signals: [
      { label: "趋势强度", value: "偏强", score: 78 },
      { label: "消息情绪", value: "谨慎乐观", score: 64 },
      { label: "期权异动", value: "Call 放量", score: 71 },
      { label: "波动风险", value: "中高", score: 58 }
    ],
    news: [
      {
        title: `${normalized} 近月营收预期被上调，机构关注 AI 与云端支出`,
        source: "Market Wire",
        time: "2 小时前",
        sentiment: "positive"
      },
      {
        title: "美债收益率回落，成长股估值压力短线缓解",
        source: "Macro Desk",
        time: "5 小时前",
        sentiment: "neutral"
      },
      {
        title: `${normalized} 本周看涨期权成交量高于 30 日均值`,
        source: "Options Flow",
        time: "昨天",
        sentiment: "positive"
      }
    ],
    analysis: {
      stance: "观察偏多",
      buyZone: `${(lastClose * 0.96).toFixed(2)} - ${(lastClose * 0.985).toFixed(2)}`,
      sellZone: `${(lastClose * 1.08).toFixed(2)} - ${(lastClose * 1.14).toFixed(2)}`,
      risk: `若跌破 ${(lastClose * 0.93).toFixed(2)}，短线趋势可能转弱。`,
      summary: "占位分析：价格维持上行通道，成交量未出现明显背离，新闻与期权流目前偏正面。接入长桥数据后，这里会输出可追溯的综合研判。"
    }
  };
}

module.exports = { getDashboard };
