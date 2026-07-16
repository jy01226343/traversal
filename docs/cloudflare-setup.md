# Cloudflare 全家桶使用指南

> 对应 ADR-001（`docs/architecture-decisions.md`）：后端采用 Cloudflare Workers 全家桶。
> 本文记录如何创建资源、本地开发、部署、备份，以及境内境外 API 代理策略。

## 1. 架构总览

```
前端（静态）  Cloudflare Pages          ./dist
API（函数）   Pages Functions           functions/api/**/*.ts
数据库        Cloudflare D1（SQLite）   binding: DB
对象存储      Cloudflare R2             binding: MEDIA
队列（M3）    Cloudflare Queues         binding: SYNC_QUEUE
定时（M3）    Cron Triggers             （部署后配置）
```

Pages Functions 模式：`functions/api/` 目录下的 `.ts` 文件按路径自动映射为 API 端点。
- `functions/api/v1/health.ts` -> `GET /api/v1/health`
- `functions/api/scrape-proxy.ts` -> `GET/POST /api/scrape-proxy`

## 2. 创建 Cloudflare 资源（首次部署前一次性操作）

### 2.1 登录
```bash
npx wrangler login
```
浏览器弹出授权页，授权后回到终端。

### 2.2 创建 D1 数据库
```bash
npx wrangler d1 create family-atlas
```
输出类似：
```
✅ Successfully created DB 'family-atlas'
[[d1_databases]]
binding = "DB"
database_name = "family-atlas"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"   <-- 复制这个
```
将 `database_id` 填回 `wrangler.toml`（替换占位值 `local-placeholder`）。

> **本地开发不需要真实 id**：`local-placeholder` 即可，wrangler 用本地 SQLite 文件（`.wrangler/state/v3/d1/`）。只有部署到生产前才需要填真实 id。

### 2.3 创建 R2 存储桶
```bash
npx wrangler r2 bucket create family-atlas-media
```

### 2.4 创建队列（M3 数据同步阶段才需要）
```bash
npx wrangler queues create sync-jobs
```
创建后在 `wrangler.toml` 取消注释 `[[queues_producers]]` 段。M0 阶段保持注释。

## 3. 本地开发

### 3.1 双进程开发（前端 + API）
两个终端分别运行：

**终端 A（前端热更新）**：
```bash
npm run dev
# Vite dev server，默认 http://localhost:5173
# 含 scrape-proxy dev 中间件（scripts/vite-scrape-plugin.mjs）
```

**终端 B（Pages Functions + D1 + R2 本地模拟）**：
```bash
npm run build          # 先 build 一次产出 dist
npm run dev:pages
# wrangler pages dev ./dist，默认 http://localhost:8788
# 自动注入 DB/MEDIA binding，读取本地 D1
```

> 日常前端开发只需终端 A。只有调试 API 或验证 D1/R2 时才需终端 B。

### 3.2 数据库迁移（本地）
```bash
npm run db:migrate:local
# 等价 wrangler d1 migrations apply family-atlas --local
```

### 3.3 数据库直查（本地）
```bash
npx wrangler d1 execute family-atlas --local --command "SELECT * FROM kv"
npx wrangler d1 execute family-atlas --local --command "SELECT name FROM sqlite_master WHERE type='table'"
```

### 3.4 Schema 修改流程
1. 编辑 `db/schema.ts`（Drizzle ORM 定义）
2. 生成迁移：`npm run db:generate`（产出 `db/migrations/XXXX_*.sql`）
3. 或手写 SQL 放 `db/migrations/`
4. 本地应用：`npm run db:migrate:local`
5. 提交 schema.ts + 迁移 SQL 一起进 git

### 3.5 Drizzle Studio（可视化浏览本地 D1）
```bash
npm run db:studio
```

## 4. 部署

### 4.1 首次部署前检查
- [ ] `wrangler.toml` 的 `database_id` 已填真实值（非 `local-placeholder`）
- [ ] D1 远程迁移已应用：`npm run db:migrate:remote`
- [ ] R2 bucket 已创建
- [ ] `npm run build` 绿

### 4.2 部署命令
```bash
npm run deploy
# 等价 npm run build && wrangler pages deploy ./dist
```

### 4.3 部署后验证
```bash
curl https://<your-project>.pages.dev/api/v1/health
# 期望 {"ok":true,...,"checks":{"d1":{"ok":true},"r2":{"ok":true}}}
```

## 5. 境内境外 API 代理策略

项目需同时访问境内和境外数据源，部署位置（Cloudflare 全球边缘）决定策略：

### 5.1 境外 API（走 Workers scrape-proxy）
- **Open-Meteo**（天气）：前端直连，无 CORS 问题
- **Wikipedia REST**：经 `/api/scrape-proxy?url=...`（allowlist 内）
- **OSM Overpass**：经 `/api/scrape-proxy`
- **官方旅游局**（visit-hokkaido.jp、NPS.gov、Parks Canada 等）：经 `/api/scrape-proxy`

allowlist 维护在：
- `scripts/attraction-scrape-proxy.mjs`（dev 共享）
- `functions/api/scrape-proxy.ts`（生产，独立内联，需同步）

合规要求（施工方案 §5.3）：
- 仅抓取公开可访问且条款允许的页面
- 遵守 robots、频率限制和版权
- 禁止绕过登录/验证码/付费墙
- 解析失败返回 PARTIAL，不静默用旧字段

### 5.2 境内 API（前端直连 + AK 白名单）
M3 起接入：
- **高德/百度地图**（POI、路线）：前端直连，AK 绑定域名白名单
- **中国天气网/和风天气**：前端直连或 Workers 代理（视 CORS）
- **携程开放平台**：需企业认证 + 备案域名

境内 API 的 AK 配置通过环境变量注入：
```bash
# .env（不提交）
VITE_AMAP_KEY=xxx
VITE_QWEATHER_KEY=xxx
```

> Cloudflare 边缘节点对中国境内 API 的可达性：多数可用但偶有延迟。若境内 API 强制中国 IP，需在 Workers 中加 `cf: { resolveOverride: 'origin' }` 或评估国内云代理。

## 6. 备份

### 6.1 D1 导出
```bash
npx wrangler d1 export family-atlas --remote --output=backup-$(date +%Y%m%d).sql
```
建议加入定时任务（本地 cron 或 GitHub Actions）每日导出。

### 6.2 R2 媒体
R2 自带冗余，无需额外备份。如需冷备：
```bash
npx wrangler r2 object list family-atlas-media
# 用 r2 object get 批量下载
```

## 7. 成本（个人自用预期）

| 资源 | 免费层 | 预估月费 |
|---|---|---|
| Pages | 500 次构建/月，无限请求 | ¥0 |
| Pages Functions | 10 万次/天 | ¥0 |
| D1 | 5GB 存储，500 万行读/天 | ¥0 |
| R2 | 10GB 存储，零 egress | ¥0（50GB 媒体约 ¥3） |
| Queues（M3） | 10 万消息/月 | ¥0 |

**个人自用预期：¥0-5/月**。用户增长到 500+ 或媒体超 100GB 时评估升级。

## 8. 常见问题

### Q: `wrangler pages dev` 报 `'' == true` 错误？
A: D1 `database_id` 为空字符串触发 miniflare 断言。本地开发填 `local-placeholder` 即可。

### Q: 修改 schema 后怎么同步？
A: `npm run db:generate`（生成 SQL）-> `npm run db:migrate:local`（本地）-> `npm run db:migrate:remote`（生产）。

### Q: Pages Functions 和 Workers 的区别？
A: 本项目用 Pages Functions（`functions/` 目录约定自动路由）。Workers 模式（`main` 入口）适合无前端的纯 API。两者 binding 配置相同。

### Q: 为什么没有用 Queues？
A: M0 不需要队列。M3 数据同步阶段取消注释 wrangler.toml 的 queue 配置并创建队列资源。
