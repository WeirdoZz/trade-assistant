# Trade Assistant

基于 Electron + React 的 macOS 股票研究助手原型。应用定位是用户端桌面 App，由 Electron 主进程直接调用券商 API、本地存储和模型接口，不部署服务器后端。

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

然后安装依赖并启动桌面开发模式。当前仓库使用 `yarn.lock` 锁定依赖：

```bash
yarn install
yarn dev
```

如果你更习惯 npm，也可以使用 `npm install` 和 `npm run dev`，但不要同时提交两套 lockfile。

启动后会同时运行：

- React/Vite UI: `http://127.0.0.1:5173`，仅作为 Electron 开发模式热更新页面
- Electron 桌面窗口，真实应用入口

当前版本使用 Electron 主进程里的占位数据，后续会把 `electron/services/marketData.cjs` 替换为长桥 OpenAPI 数据源。

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

首次授权可以直接在 App 左侧点击“连接长桥”。它会调用长桥 JavaScript SDK：

```js
const { Config, OAuth } = require("longbridge");

const oauth = await OAuth.build(clientId, (_, url) => {
  console.log("请访问此 URL 进行授权：" + url);
});
const config = Config.fromOAuth(oauth);
```

App 会自动打开授权 URL。完成长桥授权后，SDK 会自动把 Token 保存到：

```bash
~/.longbridge/openapi/tokens/<client_id>
```

之后 Electron 主进程会通过 `electron/services/longbridgeClient.cjs` 复用同一个授权配置。

## 当前骨架

- `src/`：React 仪表盘 UI，占位展示趋势、新闻、期权流、AI 分析和观察列表
- `electron/main.cjs`：Electron 主进程、窗口和 IPC 注册
- `electron/preload.cjs`：安全暴露 `window.tradeAssistant`
- `electron/services/`：长桥 OAuth、市场数据、本地配置读取

## 下一步建议

1. 用长桥 JavaScript SDK 接入真实行情、新闻和期权链。
2. 把新闻、期权链、K 线数据拆成独立 Electron service。
3. 增加 SQLite 缓存层，避免每次打开都重复拉取。
4. 接入 OpenAI 或本地模型时，把“分析依据”和“风险提示”一起返回。
