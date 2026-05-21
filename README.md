# Trade Assistant

基于 Electron + React + Python FastAPI 的 macOS 股票研究助手原型。

## 本地启动

先确认 Node.js/npm 已安装：

```bash
node --version
npm --version
```

如果刚安装 Homebrew，可以用：

```bash
brew install node
```

然后安装依赖并启动：

```bash
npm install
npm run setup:py
npm run dev
```

启动后会同时运行：

- React/Vite UI: `http://127.0.0.1:5173`
- Python FastAPI: `http://127.0.0.1:8765`
- Electron 桌面窗口

当前版本使用占位数据和模拟分析接口，后续可以把 `backend/app/services/market_data.py` 替换为长桥 OpenAPI 数据源。

## 长桥 OAuth 授权

复制环境变量模板：

```bash
cp .env.example .env
```

编辑 `.env`，填入长桥 OAuth 注册得到的 `client_id`：

```bash
LONGBRIDGE_CLIENT_ID=你的_client_id
LONGBRIDGE_REGION=cn
```

首次授权：

```bash
source .venv/bin/activate
python scripts/longbridge_auth.py
```

脚本会打印一个授权 URL。用浏览器打开 URL，完成长桥授权后，SDK 会自动把 Token 保存到：

```bash
~/.longbridge/openapi/tokens/<client_id>
```

之后后端可以通过 `backend/app/services/longbridge_auth.py` 复用同一个授权配置。

## 当前骨架

- `src/`：React 仪表盘 UI，占位展示趋势、新闻、期权流、AI 分析和观察列表
- `electron/`：Electron 主进程和 preload
- `backend/app/`：FastAPI 后端与模拟市场数据服务

## 下一步建议

1. 接入长桥 OpenAPI 鉴权和行情接口。
2. 把新闻、期权链、K 线数据拆成独立 service。
3. 增加 SQLite 缓存层，避免每次打开都重复拉取。
4. 接入 OpenAI 或本地模型时，把“分析依据”和“风险提示”一起返回。
