# 技术栈与工程约定（多 Agent 协同参考）

> **本文档面向所有参与 Family Atlas 开发的 Agent（含人类工程师）。**
> 目标：让任何新 Agent 在 5 分钟内理解项目技术栈、目录结构、开发约定和禁忌，避免重复犯"假设 monorepo/Cesium/Fastify"的错误。
>
> 配套文档：
> - `ZCODE.md` -- 项目宪法（绝对禁令 + 硬性约束）
> - `docs/current-baseline.md` -- 当前代码基线审计
> - `docs/architecture-decisions.md` -- ADR-001 栈决策理由
> - `docs/cloudflare-setup.md` -- Cloudflare 资源操作指南
> - `doc/复盘报告_功能完成与分期方案.md` -- 功能完成度 + 分期排期

---

## 1. 一句话技术栈

**前端**：React 18 + Vite + TypeScript + three.js（3D 地球）+ Leaflet（2D 地图）+ Tailwind CSS v4 + GSAP
**后端**：Cloudflare Pages Functions（TypeScript）+ D1（SQLite）+ R2（对象存储）+ Queues（M3+）
**ORM**：Drizzle ORM
**测试**：Vitest + jsdom
**部署**：Cloudflare Pages

> ⚠️ **重要**：文档早期版本（施工方案 §1.1、ZCODE.md 旧版）假设的技术栈是 monorepo + Cesium + Fastify + PostgreSQL/PostGIS + BullMQ/Redis。**这些假设已被 ADR-001 覆盖，以本文档和 `wrangler.toml` 为准。** 不得建议迁移到 Next.js、Cesium、Fastify、Prisma 或 BullMQ。

---

## 2. 目录结构

```
family-atlas/                       单仓（非 monorepo，npm 管理）
├── src/                            前端源码（Vite 入口）
│   ├── main.jsx                    ⚠️ 单文件 App（729 行），M1 起拆分为路由
│   ├── components/ui/              3 个核心可视化组件
│   │   ├── cobe-globe-weather.tsx  three.js 3D 地球（⚠️ 文件名误导，非 Cobe）
│   │   ├── flat-atlas-map.tsx      Leaflet 2D 地图（降级 + 区域视图）
│   │   └── card-fan-carousel.tsx   GSAP 扇形卡片轮播
│   ├── data/                       静态 TypeScript 数据模块（前端内置）
│   │   ├── destinations.ts         28 国 / ~120 区域 / ~150 地标
│   │   ├── seasonal-recommendations.ts  22 条季节推荐（grade S/A/B ≈ T1/T2/T3）
│   │   ├── destination-status.ts   足迹 6 态状态机（见 §4）
│   │   ├── travel-access.ts        5 护照 × 28 国签证准入矩阵
│   │   ├── unlock-destinations.ts  15 档准备任务（每档 4 任务，M3 扩为十类）
│   │   ├── passports.ts            5 护照选项
│   │   ├── beacons.ts              地球 beacon 派生（运行时从 seasonal 生成）
│   │   ├── climate.ts              21 气候站（天气粒子数据源）
│   │   ├── province-sectors.ts      admin1 -> region 映射 + 色板
│   │   └── wishlist-destinations.ts 心愿单 ID 归一化
│   ├── features/
│   │   └── attraction-explorer/    景点 POI 数据管道（完整可用，见 §5）
│   ├── lib/                        工具库
│   │   ├── utils.ts                cn() shadcn helper（M1 拆组件时启用）
│   │   ├── weather-sync.ts         Open-Meteo 实时天气同步（已接通最小版）
│   │   ├── weather-fx.ts           ⚠️ 死代码（M2 接通粒子系统）
│   │   └── terrain-material.ts     ⚠️ 死代码（M5 评估替换 globe shader）
│   ├── *.css                       样式（按页面/组件拆分，非 CSS-in-JS）
│   └── *.test.ts                   Vitest 测试（与源码同目录）
├── functions/                      Cloudflare Pages Functions（后端 API）
│   ├── api/
│   │   ├── v1/health.ts            健康检查端点（验证 D1+R2 链路）
│   │   └── scrape-proxy.ts         境外 API 抓取代理（allowlist）
│   └── tsconfig.json               ⚠️ 独立 tsconfig（Workers 类型，与前端隔离）
├── db/                             Drizzle ORM schema + 迁移
│   ├── schema.ts                   D1 表定义（M0 仅元表+kv，M1 加业务表）
│   └── migrations/                 SQL 迁移文件（wrangler d1 apply 消费）
├── scripts/                        构建辅助脚本
│   ├── vite-scrape-plugin.mjs      Vite dev 中间件（scrape-proxy dev 版）
│   ├── attraction-scrape-proxy.mjs 共享 allowlist（dev/prod 同步源）
│   └── split-geo.mjs               GeoJSON 切分（一次性，未入 npm scripts）
├── public/                         静态资源
│   ├── earth/                      地球纹理（2K/8K）
│   └── geo/                        GeoJSON（countries/admin1/continents）
├── docs/                           工程文档（本文件所在目录）
├── doc/                            产品文档（设计说明书、施工方案、复盘报告）
├── tests/setup.ts                  Vitest 全局 setup
├── vitest.config.ts                Vitest 配置（jsdom + @ alias）
├── drizzle.config.ts               Drizzle Kit 配置
├── wrangler.toml                   Cloudflare 配置（D1/R2/vars binding）
├── vite.config.ts                  Vite 配置（react + tailwind + scrape 插件）
├── tsconfig.json                   前端 TS 配置（include: src + db）
└── package.json                    npm 依赖 + scripts
```

---

## 3. 开发命令速查

```bash
# 前端开发（热更新）
npm run dev                    # Vite dev server, http://localhost:5173

# 后端 + 前端本地模拟（调试 API/D1/R2 时用）
npm run build                  # 先 build 产出 dist
npm run dev:pages              # wrangler pages dev, http://localhost:8788

# 测试
npm run test                   # vitest watch 模式
npm run test:run               # vitest 单次运行（CI 用）

# 类型检查
npm run typecheck              # tsc --noEmit（前端 + db）
npx tsc -p functions/tsconfig.json --noEmit   # 后端单独检查

# 数据库
npm run db:generate            # 从 schema.ts 生成迁移 SQL
npm run db:migrate:local       # 应用迁移到本地 D1
npm run db:migrate:remote      # 应用迁移到远程 D1（部署前）
npm run db:studio              # Drizzle Studio 可视化

# 部署
npm run deploy                 # build + wrangler pages deploy ./dist

# 构建
npm run build                  # vite build -> dist/
```

---

## 4. 核心业务概念对齐（避免命名混乱）

### 4.1 足迹 6 态（`src/data/destination-status.ts`）

**已对齐产品规格命名**（M0 修正）。不得使用旧名 LOCKED/RECOMMENDED/VISITED/MASTERED。

| ID | label | 含义 | CSS tone |
|---|---|---|---|
| `UNEXPLORED` | 未探索 | 未收藏或前往 | `locked` |
| `WISHLIST` | 心愿收藏 | 已加入愿望清单 | `wish` |
| `PREPARING` | 准备中 | 有任务进度但未完成 | `prep` |
| `UNLOCKED` | 已解锁 | 准备完成，不等于官方签证/入境许可 | `recommend` |
| `EXPLORED` | 已探索 | 存在已完成 Journey | `visited` |
| `DEEP_EXPLORED` | 深度探索 | 同区域多次完整旅行 | `mastered` |

> `tone` CSS 类名保留旧名（`locked/wish/prep/recommend/visited/mastered`）以减少 CSS 改动。
> 「当季推荐」不是独立足迹态，由调用方通过 `isInSeasonalList` 标记。
> localStorage 旧 key（`atlas-mastered-v1`）语义从 "mastered" 迁移为 "deep_explored"，读取即迁移。

### 4.2 目的地分级（T1/T2/T3）

当前 `seasonal-recommendations.ts` 用 `grade: "S" | "A" | "B"`，对应：
- S ≈ T1（世界级，全球视角，金色脉冲）
- A ≈ T2（国家级，洲级视角，银蓝光点）
- B ≈ T3（特色线路，地区级，普通光点）

M2 将把 T1/T2/T3 分级传播到 country/region 实体并实现分层视觉。

### 4.3 Journey 状态机（M1 实现，当前未开始）

```
DRAFT -> PLANNING -> PREPARING -> READY -> ONGOING -> COMPLETED -> ARCHIVED
```
未完成 Journey 定义：`PLANNING | PREPARING | READY | ONGOING`。

### 4.4 准备清单门槛（M3 实现，当前未开始）

| 类型 | 可 Waive | 解锁影响 |
|---|---|---|
| `HARD` | 否 | 未完成则解锁按钮禁用 |
| `ACKNOWLEDGED` | 是（需填原因） | 需 DONE 或 WAIVED |
| `ADVISORY` | 是（无影响） | 不参与硬准备度 |

---

## 5. 景点 POI 数据管道（已完整可用，禁止重写）

`src/features/attraction-explorer/` 是项目当前最完整的实时数据管道：

```
resolveAttractions(countryCode, regionId)
  ├─ 1. Live API（需 VITE_ATTRACTION_API_BASE，默认未设，休眠）
  ├─ 2. Live scraper（OSM Overpass + Wikipedia REST + 官方站 og）
  ├─ 3. localStorage 持久快照（atlas-attractions-{fixed,api,scrape}-v2）
  ├─ 4. 官方种子（official-attractions.ts，38KB 策展）
  └─ 5. 区域目录兜底（region-catalog.ts，永不空）
```

- 选择算法 `selectAttractions`：4 主选 + 2 次选 + X 彩蛋，3×3 网格每格 ≤2
- 合规抓取：allowlist-only（`scrape-targets.ts:30-64`），遵守 robots/频率/版权
- **M3 升级方向**：将 `AttractionProvider` 接口升级为规格的 `DestinationDataProvider` shape（加 `kind/supports/normalize/freshness`），不要另起炉灶

---

## 6. Cloudflare 后端约定

### 6.1 Pages Functions 路由约定

`functions/api/` 目录下的 `.ts` 文件按路径自动映射：
- `functions/api/v1/health.ts` → `GET /api/v1/health`
- `functions/api/scrape-proxy.ts` → `GET/POST /api/scrape-proxy`
- `functions/api/v1/journeys/[id].ts` → `GET /api/v1/journeys/:id`（M1 起）

每个文件导出 `onRequestGet` / `onRequestPost` / `onRequestPatch` 等，类型为 `PagesFunction<Env>`。

### 6.2 Env 类型

```typescript
interface Env {
  DB: D1Database          // SQLite 数据库
  MEDIA: R2Bucket        // 对象存储（照片/视频）
  ENV: string            // "production" | "development"
  APP_VERSION: string
  // M3: SYNC_QUEUE: Queue
}
```

### 6.3 D1 schema 流程

1. 编辑 `db/schema.ts`（Drizzle ORM 定义）
2. `npm run db:generate` 产出 `db/migrations/XXXX_*.sql`
3. `npm run db:migrate:local` 本地应用
4. 部署前 `npm run db:migrate:remote` 远程应用
5. schema.ts + 迁移 SQL 一起提交 git

### 6.4 境内外 API 代理分工

| API 类型 | 通道 | 位置 |
|---|---|---|
| 境外（OSM/Wikipedia/官方旅游局） | Workers scrape-proxy | `functions/api/scrape-proxy.ts` |
| 境内（高德/百度/中国天气） | 前端直连 + AK 白名单 | `src/` 调用，AK 在 `.env` |

---

## 7. 绝对禁令（来自 ZCODE.md）

1. **禁止框架重写**：不迁移 Next.js，不重构现有 React/Vite 前端。前端栈以代码实际为准（three.js + Leaflet），后端走 Cloudflare 全家桶。
2. **禁止删除重写可用代码**：现有 globe、flat-map、attraction-explorer 管道、scrape-proxy 必须复用。可复用清单见 `docs/current-baseline.md` §7。
3. **禁止用户排行榜**：不设计粉丝榜/打卡榜/家庭攀比。
4. **禁止直连 AI**：AI 生成内容走 Workers 网关，前端只消费 draft 草稿态。

## 8. 硬性约束（来自施工方案 §0）

1. **自适应首页**：根路由动态判定（有未完成 Journey → Focus，新用户 → World）。
2. **快照原则**：清单/装备进入 Journey 必须 deep-copy。
3. **默认私密**：分享必须用冻结副本（ShareCopy）。
4. **清单门槛**：HARD 不可 waive；ACKNOWLEDGED 需填原因；ADVISORY 不阻塞。
5. **解锁语义**：UNLOCKED 仅表示准备完成，不等于官方签证/入境许可。
6. **实时数据透明**：展示来源、更新时间、进度和部分失败。
7. **性能降级**：粒子减档 → 关环境 → 关地形 → 2D（Leaflet）。

---

## 9. 里程碑进度（截至 M0 完成）

| 里程碑 | 主题 | 状态 | 完成度 |
|---|---|---|---|
| M0 | 基线校准 + Cloudflare 骨架 | ✅ 完成 | 100% |
| M1 | V0.8 旅行底座（Journey/轨迹/照片三层/海拔） | ⬜ 未开始 | ~5% |
| M2 | V1.0 首发版（自适应首页/Memory/羊皮纸长图） | ⬜ 未开始 | ~25% |
| M3 | V1.5 探索准备（数据同步/十类清单/解锁动画） | ⬜ 未开始 | ~15% |
| M4 | V2.0 完整记录（离线/花费/装备/视频/导出） | ⬜ 未开始 | 0% |
| M5 | V3.0 高级记忆分享（AI/回放/记忆电影/Share Studio） | ⬜ 未开始 | 0% |
| M6 | V4.0 家庭地图（多账号/成长线/年度回顾） | ⬜ 未开始 | 0% |

详细任务清单见 `doc/复盘报告_功能完成与分期方案.md` 第二部分。

---

## 10. Agent 协同约定

### 10.1 开始任何任务前
1. 读本文档（`docs/TECH-STACK.md`）了解技术栈和约定
2. 读 `ZCODE.md` 了解禁令和约束
3. 运行 `npm run typecheck && npm run test:run` 确认基线绿
4. 查 `docs/current-baseline.md` 确认相关能力是否已存在

### 10.2 代码风格
- TypeScript strict，`allowJs: true`（main.jsx 例外）
- 测试与源码同目录，`*.test.ts` / `*.test.tsx`
- 纯函数优先，副作用隔离到组件/useEffect
- CSS 按页面/组件拆分（`src/*.css`），不用 CSS-in-JS
- import alias `@/` 指向 `src/`（tsconfig + vitest + vite 三处一致）

### 10.3 提交前必查
```bash
npm run typecheck          # tsc --noEmit（root）
npx tsc -p functions/tsconfig.json --noEmit   # 后端
npm run test:run           # vitest 全绿
npm run build              # vite build 绿
```

### 10.4 不要做的事
- 不要假设 monorepo / pnpm workspaces / Turborepo
- 不要引入 Cesium / MapLibre / Fastify / Prisma / BullMQ / Redis
- 不要重写 cobe-globe-weather.tsx / flat-atlas-map.tsx / attraction-explorer/
- 不要把 `RECOMMENDED` 当作独立足迹态（已合并进 UNEXPLORED）
- 不要把 `weather-fx.ts` / `terrain-material.ts` 当垃圾删除（M2/M5 资产）
- 不要提交 `.wrangler/`（本地 D1 状态）或 `.zcode/`（agent 会话）
