# 代码基线审计（current-baseline）

> 对应施工方案 §1.3「执行前代码基线审计」。
> 基线日期：2026-07-16，commit `7b931a5`。
> 配套文档：`doc/复盘报告_功能完成与分期方案.md`（完整功能盘点）、`docs/architecture-decisions.md`（ADR-001 栈决策）。

## 1. 包与版本（package.json）

| 项 | 实际版本 |
|---|---|
| name | `family-atlas-demo` |
| 包管理 | npm（**无 pnpm-lock.yaml**，有 package-lock.json） |
| 仓库结构 | **单仓**（非 monorepo，无 workspaces） |
| React / react-dom | `latest`（未锁定） |
| Vite | `latest`（实际 v8.1.4） |
| 3D | **three** ^0.185.1（**非 Cesium/deck.gl**） |
| 2D 地图 | **leaflet** ^1.9.4（**非 MapLibre GL**） |
| UI | tailwindcss ^4.3.2 + @tailwindcss/vite + gsap + lucide-react + class-variance-authority + clsx + tailwind-merge |
| 后端 | **无 Fastify / Prisma / BullMQ / Redis 依赖** |
| 部署 | wrangler ^4.111.0（Cloudflare），@cloudflare/workerd-windows-64 optional |
| 测试 | **无 vitest / jest / playwright / supertest**（M0 引入 Vitest） |
| scripts | 仅 `dev` / `build` / `preview`（**无 test / deploy / lint**） |

## 2. 路由与页面

- **无 react-router**。整个应用是 `src/main.jsx` 单文件 729 行的 `<App/>` 组件。
- "页面"是锚点滚动的 `<section>`：`#top`（探索）、`#journey`（旅行档案）、`#stories`（记忆链）、`#guide`（攻略手册）、`#gear`（装备库）。
- 导航见 `main.jsx:542,546`。`<Route` token（`main.jsx:608`）是 lucide-react 图标，非路由组件。
- 状态：纯 `useState`/`useRef`/`useMemo` + 散落 `localStorage`（`main.jsx:47,58,159,375,391`、`destination-status.ts`）。**无 Zustand / TanStack Query / Context。**
- 核心状态机 `mapLevel ∈ world|continent|country|region`（`main.jsx:40`）驱动 three.js 地球↔Leaflet 地图切换（`main.jsx:559`）。

## 3. 已实现的数据库迁移 / 后端

- **无 Prisma schema、无数据库迁移**。
- 后端仅 1 个 Cloudflare Pages Function：`functions/api/scrape-proxy.ts`（景点抓取的 allowlist 代理，`onRequest`，CORS + host 白名单）。
- 对应 dev 代理：`scripts/vite-scrape-plugin.mjs`（Vite 中间件，`/api/scrape-proxy`），共享 `scripts/attraction-scrape-proxy.mjs` 的 allowlist。
- `wrangler.toml` 仅 `[assets]` 静态托管 + SPA fallback，**无 D1/R2/Queues/Durable Objects binding**。

## 4. 已实现的三层能力（可复用，禁止重写）

### World Earth（世界地球舞台）
- `src/components/ui/cobe-globe-weather.tsx`（833 行，**实为 raw three.js，非 Cobe**）：SphereGeometry 地球 + 大气 shader + 国家/admin1 边界 + 大圆航线飞机动画 + beacons + raycaster 拾取。自转（`speed=0.0014`）。
- `src/components/ui/flat-atlas-map.tsx`（658 行）：Leaflet + Esri 卫星瓦片 + 洲/国/admin1 边界 + 省份色块 + 雾罩 + 资源/景点 pins。
- `src/components/ui/card-fan-carousel.tsx`（157 行）：GSAP 扇形轮播，compact 断点 760px。
- 静态资源：`public/earth/` 纹理、`public/geo/` GeoJSON（countries 838KB、admin1-all 2.3MB、continents、per-country admin1）。

### Destination（目的地体系）
- `src/data/destinations.ts`：28 国、~120 区域、~150 地标点。
- `src/data/seasonal-recommendations.ts`：22 条季节推荐，`grade: S|A|B`（约等于 T1/T2/T3，但未传播到 country/region）。
- `src/data/travel-access.ts`：5 护照 × 28 国免签/需解锁二元矩阵（自述"V1 demo matrix"）。
- `src/data/province-sectors.ts`：18+ 国 admin1->region 映射 + 色板。

### Attraction Explorer（景点 POI 管道，完整可用）
- `src/features/attraction-explorer/`：OSM Overpass + Wikipedia REST + 官方站 og 抓取，5 层 fallback（API->scraper->localStorage snapshot->official seed->region catalog），`4+2+X` 选择算法，已集成进 `main.jsx:468-498,575`。
- 合规抓取：allowlist-only，遵守 robots/频率/版权，不绕登录/验证码/付费墙。

### 准备/解锁（部分）
- `src/data/unlock-destinations.ts`：15 档 × 每档 4 任务（规格要十类）。无 HARD/ACK/ADVISORY 门槛。
- `src/data/passports.ts`：5 护照全局选项 + 遗留 ICELAND_UNLOCK/ICELAND_TASKS（与 unlock-destinations 重复）。

### 实时数据同步（写就但未启用）
- `src/lib/weather-sync.ts`：Open-Meteo 批量同步，21 站，WMO->WeatherKind 映射，失败回退气候档案。**从未被调用，死代码**。返回 `SyncResult`（最近 SyncJob 雏形，但瞬时无持久化）。
- `src/lib/weather-fx.ts`：完整 three.js 粒子系统（雨/雪/雾/热/雷），**从未被导入，死代码**（M2 接通）。
- `src/lib/terrain-material.ts`：完整 globe 地形 ShaderMaterial，**从未被导入，死代码**（M5 评估）。
- `src/lib/utils.ts`：`cn()` shadcn helper，无引用（M1 拆组件时启用）。

## 5. 文档与代码不一致项（M0 修复）

| 项 | 文档假设 | 代码实际 | M0 处理 |
|---|---|---|---|
| 仓库 | pnpm monorepo | 单仓 npm | ADR-001 记录，单仓 + Cloudflare Pages Functions |
| 3D | Cesium + deck.gl | three.js | 保留 three.js，修订施工方案 §1.1 |
| 2D 降级 | MapLibre GL | Leaflet | 保留 Leaflet，修订 §1.1 |
| 后端 | Fastify + Prisma + PostGIS | 无 | Cloudflare Workers + Drizzle + D1，修订 §1.1 |
| 队列 | BullMQ + Redis | 无 | Cloudflare Queues + Durable Objects，修订 §1.1 |
| 路由 | react-router v6 | 无 | M1 引入 |
| 状态 | Zustand + TanStack Query | useState + localStorage | M1 引入 |
| 测试 | Vitest + Playwright + supertest | 无 | M0 引入 Vitest，supertest->Miniflare |
| 足迹 6 态 | unexplored/wishlist/preparing/unlocked/explored/deep-explored | LOCKED/RECOMMENDED/WISHLIST/PREPARING/VISITED/MASTERED | M0 T2 重命名对齐 |
| Journey 实体 | 7 态 + 九区块 | 零 | M1 |
| Memory Chain | MemoryNode | 零 | M2 |
| Share Copy | 羊皮纸长图 MVP | 死按钮 | M2 |

## 6. 当前构建状态

- `npm run build`：**绿**（vite build，849ms，bundle 1.2MB / gzip 343KB，偏大，M1 优化 code-split）。
- `npm test`：**无**（M0 引入）。
- `npx tsc --noEmit`：当前 `include: ["src"]`，functions/db 不在范围（M0 扩展）。

## 7. 可复用清单（禁止重写）

按施工方案 §0「代码已存在且可用的能力不得重写」：

1. **three.js 地球**（`cobe-globe-weather.tsx`）- 保留，M5 评估是否换 terrain-material shader。
2. **Leaflet 地图**（`flat-atlas-map.tsx`）- 保留为 2D 降级层。
3. **景点 POI 管道**（`attraction-explorer/`）- 保留，M3 升级 `AttractionProvider`->`DestinationDataProvider` shape。
4. **scrape-proxy allowlist 合规抓取**（`functions/api/scrape-proxy.ts` + `scripts/vite-scrape-plugin.mjs`）- 保留，作为 Workers 上境外 API 代理的基础。
5. **静态数据目录**（`src/data/`）- 保留，M1 起逐步迁入 D1（数据先双写）。
6. **weather-sync Open-Meteo 同步**（`src/lib/weather-sync.ts`）- M0 接通最小版，M3 升级为 SyncJob+Provider。
7. **seasonal grade S/A/B** - 保留语义，M2 对齐为 T1/T2/T3。
