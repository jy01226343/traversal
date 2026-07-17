# M0 施工计划：代码基线校准 + Cloudflare 骨架

## 目标与边界

**M0 结束时达成**：
1. `npm run build` 绿，`npm test` 有最小用例且绿，`npx tsc --noEmit` 绿
2. 有一份 `docs/current-baseline.md`（基于已存档的复盘报告转写）
3. ZCODE.md / 施工方案 §1.1 的技术选型表更新为 Cloudflare 全家桶（three.js/Leaflet/D1/R2/Workers/Queues），消除"假设 monorepo+Cesium+Fastify"的文档-代码冲突
4. 足迹 6 态命名对齐产品规格
5. `weather-sync.ts` 接通最小版（按钮 + 状态反馈，不渲染粒子）
6. 死代码处理：`utils.ts` 接入（被 shadcn 组件用）或删除；`weather-fx.ts`、`terrain-material.ts` 标注待 M2/M5 启用并加 README 注释，不删除（它们是已写好的未来资产）
7. Cloudflare 后端骨架可 `wrangler deploy`：D1 迁移脚手架 + Workers 路由骨架 + R2 binding + 一个 `/api/v1/health` 端点验证部署链路

**M0 不做**：D1 schema 业务表（Journey/Memory 等，归 M1）、react-router、Zustand、真实 API 逻辑。

---

## 任务清单（按依赖顺序）

### T1　文档校准（无代码依赖，先做）
- 新建 `docs/current-baseline.md`：从 `doc/复盘报告_功能完成与分期方案.md` 提炼"当前栈实情 + 文档-代码不一致项 + 可复用清单"
- 修订 `ZCODE.md`：
  - "绝对禁令1 禁止框架重写"补充："前端栈以代码实际为准（three.js/Leaflet），后端走 Cloudflare 全家桶"
  - "性能降级"条目 MapLibre->Leaflet
- 修订 `doc/Family_Atlas_Agent施工方案_V2.0_融合修订版.md` §1.1 技术选型表（**只改选型表这一节，不动业务规格**）：
  - 语言 TS strict 保留
  - Monorepo -> 单仓 + Cloudflare Pages Functions
  - 前端 React18+Vite 保留；3D Cesium+deck.gl -> **three.js**；2D MapLibre -> **Leaflet**
  - 后端 Fastify+Prisma -> **Cloudflare Workers + Drizzle ORM**
  - 数据库 PostgreSQL+PostGIS -> **Cloudflare D1（SQLite）**；空间运算用 Turf.js（浏览器/Worker）
  - 对象存储 S3/MinIO -> **Cloudflare R2**
  - 队列 BullMQ+Redis -> **Cloudflare Queues + Durable Objects**
  - 媒体 sharp+ffmpeg+exifr -> sharp+exifr（Workers 兼容）；**ffmpeg 改为本地转码后上传**（个人场景）
  - AI 服务端网关 -> Workers + 外接 AI API
  - 测试 Vitest+Playwright 保留；supertest -> Miniflare 本地测试
- 输出 `docs/architecture-decisions.md`（ADR-001：选 Cloudflare 全家桶的理由，含境内境外 API 处理策略）

### T2　足迹 6 态命名对齐规格
- 改 `src/data/destination-status.ts`：
  - `LOCKED` -> `UNEXPLORED`（label "未探索"）
  - `RECOMMENDED` -> 并入 `UNEXPLORED`（规格无此态；当季推荐通过 UI 层的 `isInSeasonalList` 标记，不作为独立足迹态）
  - `WISHLIST` 保留
  - `PREPARING` 保留
  - `VISITED` -> `EXPLORED`（label "已探索"）
  - `MASTERED` -> `DEEP_EXPLORED`（label "深度探索"）
  - **新增 `UNLOCKED`** 态：表示"准备完成但尚未出行"（规格明确区分 unlocked vs explored）。当前代码用 VISITED 的免签变体近似，拆出来。
  - 重写 `resolveDestinationStatus` 状态优先级：`DEEP_EXPLORED > EXPLORED > UNLOCKED > PREPARING > WISHLIST > UNEXPLORED`
  - `fanStatusFromMeta` 相应调整
- 全局搜索引用并更新：`beacons.ts`、`cobe-globe-weather.tsx`、`flat-atlas-map.tsx`、`main.jsx`、`card-fan-carousel.tsx`、CSS 里的 tone 类名（`locked`/`recommend`/`wish`/`prep`/`visited`/`mastered` -> 对齐）
- 加迁移：localStorage 旧 key `atlas-wishlist-v1`/`atlas-mastered-v1` 数据兼容（mastered->deep_explored 映射），避免老数据丢失

### T3　Vitest 测试基建
- `npm i -D vitest @testing-library/react jsdom`
- 新建 `vitest.config.ts`（environment jsdom，alias @ -> src）
- package.json 加 `"test": "vitest"`、`"test:run": "vitest run"`
- 先覆盖纯函数（无副作用，易测）：
  - `destination-status.ts`：resolveDestinationStatus 各状态组合、hasPreparingProgress、loadWishlist/saveWishlist round-trip（mock localStorage）
  - `unlock-destinations.ts`：getUnlockProfile 命中/未命中 fallback
  - `travel-access.ts`：resolveTravelAccess 5 护照 × 免签/需解锁/本国
  - `attraction-explorer/selection.ts`：selectAttractions 4+2+X、inBounds 跨日界线
  - `attraction-explorer/coordinates.ts`：wgs84<->gcj02 往返一致性
- 目标：这些文件行覆盖 > 70%，作为后续重构的安全网

### T4　weather-sync 最小接通
- 在 `main.jsx` 加一个"同步天气"按钮（world-hero 区，复用现有样式）+ 状态文字（"已同步 N 站 · Open-Meteo · 时间 X" / "同步失败，使用气候档案"）
- `useEffect` 调 `syncLiveWeather`，结果存 state，AbortController 在 unmount 时取消
- **不接通 weather-fx 粒子渲染**（留 M2，避免 M0 视觉回归）
- 加 vitest 测试：mock fetch，验证 SyncResult 的 source 字段在成功/失败时正确

### T5　死代码处理
- `src/lib/utils.ts`（`cn` helper）：检查是否真无引用；若 M1 会引入 shadcn 组件则保留，否则删除。**倾向保留**（M1 拆组件会用）
- `src/lib/weather-fx.ts`：文件头加注释 `// TODO(M2): 接通到 globe 粒子系统`，不删
- `src/lib/terrain-material.ts`：文件头加注释 `// TODO(M5): 评估是否替换 globe 内联 shader`，不删
- `main.jsx:624` 死按钮（生成分享长图）：`disabled` + tooltip "V1.0 实现"，避免用户点击无反应
- `main.jsx:544` 死按钮（新建旅程）：同上处理

### T6　Cloudflare 后端骨架
- **wrangler.toml** 扩展：
  ```toml
  name = "traversal"
  compatibility_date = "2025-07-01"
  main = "functions/api/index.ts"   # 新增：Worker 入口

  [assets]
  directory = "./dist"
  not_found_handling = "single-page-application"

  [[d1_databases]]
  binding = "DB"
  database_name = "family-atlas"
  database_id = "<M0 阶段先本地，id 留空占位>"

  [[r2_buckets]]
  binding = "MEDIA"
  bucket_name = "family-atlas-media"

  [[queues_producers]]
  binding = "SYNC_QUEUE"
  queue = "sync-jobs"

  [[queues_consumers]]
  queue = "sync-jobs"
  max_batch_size = 10
  ```
- 新建 `functions/api/index.ts`：Workers 路由入口，注册 `/api/v1/health` 返回 `{ok:true, ts, version}`，并把现有 `scrape-proxy.ts` 挂到 `/api/scrape-proxy`
- 新建 `functions/api/v1/health.ts`：hello-world 端点
- 新建 `db/schema.ts`（Drizzle ORM）：M0 只建一张 `_migrations` 元表 + 一张 `kv` 测试表，验证 D1 连通；**业务表归 M1**
- 新建 `db/migrations/0000_init.sql`：对应上面的 schema
- package.json 加 `"db:migrate:local": "wrangler d1 migrations apply family-atlas --local"`、`"db:generate": "drizzle-kit generate"`、`"deploy": "wrangler deploy"`
- `npm i drizzle-orm drizzle-kit`
- tsconfig `include` 加 `["src", "functions", "db"]`；给 `functions/` 单独的兼容 Workers 类型的 tsconfig（`types: ["@cloudflare/workers-types"]`）或用三斜线指令
- **验证**：`wrangler dev` 本地起，`curl /api/v1/health` 通；`wrangler d1 execute family-atlas --local --command "select count(*) from kv"` 通

### T7　Cloudflare 全家桶使用文档
- 新建 `docs/cloudflare-setup.md`：
  - 如何创建 D1 数据库（`wrangler d1 create family-atlas`，拿 database_id 填回 wrangler.toml）
  - 如何创建 R2 bucket（`wrangler r2 bucket create family-atlas-media`）
  - 如何创建 Queue（`wrangler queues create sync-jobs`）
  - 本地开发：`wrangler dev` + `npm run dev` 双开说明
  - 部署：`npm run build && npm run deploy`
  - 境内境外 API 代理分工：境外（OSM/Wikipedia/官方旅游局）走 Workers scrape-proxy；境内（高德/百度/中国天气）前端直连带 AK 白名单
  - 备份：`wrangler d1 export` 定时导出到本地

---

## 验收标准（AC）

1. `npm run build` 绿（bundle 大小允许，后续 M1 优化）
2. `npm run test:run` 绿，至少覆盖 T3 列出的 5 个纯函数文件
3. `npx tsc --noEmit` 绿（含 functions/ 和 db/）
4. `wrangler dev` 本地起，`curl http://localhost:8787/api/v1/health` 返回 `{ok:true,...}`
5. `wrangler d1 execute family-atlas --local --command "select * from kv"` 成功
6. 足迹 6 态在 UI 上显示为：未探索/心愿/准备中/已解锁/已探索/深度探索（6 个，无"当季推荐"作为独立态）
7. "同步天气"按钮可点，点击后显示来源和时间，失败回退气候档案且不白屏
8. 死按钮 disabled 且有 tooltip 说明
9. `docs/current-baseline.md`、`docs/architecture-decisions.md`、`docs/cloudflare-setup.md` 三份文档存在且内容完整

---

## 不在 M0 范围（推到 M1）

- D1 业务表 schema（Journey/Member/Track/Media/MemoryNode/ShareCopy）
- react-router 引入与 main.jsx 拆分
- Zustand / TanStack Query 引入
- Journey CRUD
- 轨迹导入
- 任何业务 API 逻辑

## 风险与缓解

- **6 态重命名视觉回归**：T3 的测试先写好状态解析逻辑测试，重命名后跑测试 + 手动点 4 个关键页面（地球/flat-map/卡片轮播/解锁 modal）
- **wrangler.toml main 入口与 static assets 共存**：Cloudflare Workers + Assets 模式要求 `main` 指向 Worker，assets 仍由 `[assets]` 提供。需验证 SPA fallback 在此模式下仍工作。若不行，退回 Pages Functions 模式（`functions/` 目录约定，不加 `main`）
- **D1 无 PostGIS**：M0 不涉及空间查询，Turf.js 在 M1 引入。ADR-001 记录此取舍
- **functions/ tsconfig**：Workers 类型与 DOM 类型有冲突，单独 tsconfig 隔离

## 预计工期

约 1.5-2 周（T1-T2 文档+重命名 3-4 天，T3 测试 2-3 天，T4-T5 接通+死代码 1-2 天，T6 Cloudflare 骨架 3-4 天，T7 文档 1 天）。