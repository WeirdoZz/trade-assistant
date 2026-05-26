export type TradingViewWidgetKind =
  | "symbol-info"
  | "symbol-profile"
  | "advanced-chart"
  | "financials"
  | "timeline";

export type TradingViewTheme = "light" | "dark";

export function normalizeTradingViewSymbol(symbol: string) {
  const normalized = symbol.trim().toUpperCase();

  if (normalized.includes(":")) {
    return normalized;
  }

  return `NASDAQ:${normalized}`;
}

export function getTradingViewScriptSource(kind: TradingViewWidgetKind) {
  const widgetNameByKind: Record<TradingViewWidgetKind, string> = {
    "symbol-info": "symbol-info",
    "symbol-profile": "symbol-profile",
    "advanced-chart": "advanced-chart",
    financials: "financials",
    timeline: "timeline"
  };

  return `https://s3.tradingview.com/external-embedding/embed-widget-${widgetNameByKind[kind]}.js`;
}

export function buildTradingViewWidgetConfig(
  kind: TradingViewWidgetKind,
  symbol: string,
  theme: TradingViewTheme
) {
  const tvSymbol = normalizeTradingViewSymbol(symbol);

  if (kind === "advanced-chart") {
    return {
      autosize: true,
      symbol: tvSymbol,
      interval: "D",
      timezone: "exchange",
      theme,
      backgroundColor: theme === "light" ? "rgba(255, 255, 255, 1)" : "rgba(19, 23, 34, 1)",
      style: "0",
      locale: "zh_CN",
      allow_symbol_change: true,
      calendar: false,
      support_host: "https://www.tradingview.com",
      withdateranges: true,
      save_image: false,
      details: true,
      hotlist: true
    };
  }

  if (kind === "symbol-profile") {
    return {
      symbol: tvSymbol,
      colorTheme: theme,
      isTransparent: false,
      locale: "zh_CN",
      width: "100%",
      height: 550
    };
  }

  if (kind === "financials") {
    return {
      symbol: tvSymbol,
      colorTheme: theme,
      displayMode: "adaptive",
      isTransparent: false,
      locale: "zh_CN",
      width: "100%",
      height: 550
    };
  }

  if (kind === "timeline") {
    return {
      displayMode: "adaptive",
      feedMode: "symbol",
      symbol: tvSymbol,
      colorTheme: theme,
      isTransparent: false,
      locale: "zh_CN",
      width: "100%",
      height: 550
    };
  }

  return {
    symbol: tvSymbol,
    colorTheme: theme,
    isTransparent: false,
    locale: "zh_CN",
    width: "100%"
  };
}

export function getTradingViewSymbolUrl(symbol: string, suffix = "") {
  const slug = normalizeTradingViewSymbol(symbol).replace(":", "-");
  return `https://cn.tradingview.com/symbols/${slug}/${suffix}`;
}
