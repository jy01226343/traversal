# 架构决策记录（ADR）

## ADR-001：技术栈以代码实际为准，后端采用 Cloudflare 全家桶

- 状态：Accepted（2026-07-16）
- 决策者：项目 Owner
- 背景：施工方案 §1.1 假设 monorepo + Cesium + Fastify + Prisma+PostGIS + BullMQ+Redis；实际代码是单仓 Vite + three.js + Leaflet + Cloudflare Pages，无后端业务层。
- 约束：项目为个人自用，记录生活与出游；用户基数小（1 人，未来可能扩展至朋友）；运维预算越省心越好；需同时访问境内（高德/百度/中国天气）和境外（OSM/Wikipedia/各国旅游局）API。

### 决策

**前端**：保留现有栈，不重写。

| 层 | 决策 | 理由 |
|---|---|---|
| 框架 | React 18 + Vite（保留） | 已有可视化原型基于此 |
| 3D 地球 | **three.js**（保留，非 Cesium） | 现有 globe 已可用；个人规模无需 Cesium 全球级数据 |
| 2D 降级 | **Leaflet**（保留，非 MapLibre） | 现有 flat-map 已可用 |
| UI | Tailwind v4 + Radix + gsap + lucide（保留） | - |
| 路由 | react-router v6（M1 引入） | 当前无路由 |
| 状态 | Zustand + TanStack Query（M1 引入） | 当前纯 useState |

**后端**：采用 Cloudflare 全家桶（替代 Fastify+PostgreSQL+Redis）。

| 层 | 决策 | 替代规格原假设 | 理由 |
|---|---|---|---|
| 计算 | Cloudflare Workers | Fastify 长进程 | 零运维、按请求计费、个人用量在免费层 |
| 数据库 | Cloudflare D1（SQLite） | PostgreSQL+PostGIS | 个人数据量小（<5GB）；PostGIS 空间运算改用 Turf.js（浏览器/Worker） |
| 对象存储 | Cloudflare R2 | S3/MinIO | **零 egress 费**，媒体重应用成本最优 |
| 队列 | Cloudflare Queues + Durable Objects | BullMQ+Redis | 托管，无需维护 Redis；DO 做 SSE 长连接 |
| 定时 | Cron Triggers | - | 定时刷新签证/天气 |
| 媒体处理 | sharp + exifr（Workers WASM）；**ffmpeg 本地转码后上传** | sharp+ffmpeg+exifr 服务端 | Workers 不支持 ffmpeg 二进制；个人视频量小，本地转码可接受 |
| AI 网关 | Workers + 外接 AI API | 服务端统一网关 | 草稿态原则不变，仅承载件不同 |
| ORM | Drizzle ORM | Prisma | Drizzle 对 D1/Workers 友好，无需 Prisma engine 二进制 |
| 测试 | Vitest + Playwright + Miniflare | Vitest + Playwright + supertest | Miniflare 替代 supertest 测 Workers |

### 境内外 API 处理策略（关键决策依据）

项目需同时访问：

- **境外 API**：Open-Meteo、Wikipedia REST、OSM Overpass、各国官方旅游局（NPS.gov、visit-hokkaido.jp、Parks Canada 等）。
- **境内 API**（M3 起接入）：高德/百度地图、中国天气网/和风天气、携程开放平台、各省文旅局。

部署位置选择矩阵：

| 部署位置 | 境外 API | 境内 API | 中国延迟 | 备案 |
|---|---|---|---|---|
| Cloudflare 全球边缘 | ✅ | ❌ 多数限中国 IP/CORS | 30-100ms 抖动 | 否 |
| 香港 VPS | ✅ | ✅ 可达 | 30-50ms | 否 |
| 国内云 | 🟡 部分被墙 | ✅ 原生 | 5-20ms | 是 |

**Cloudflare 全家桶选择理由**：

1. **零运维**：全托管，个人自用无需维护服务器/备份/安全更新。
2. **几乎免费**：免费层对 1 人绰绰有余；R2 零 egress（反复看照片不花钱）。
3. **境内外 API 双通道**：境外走 Workers scrape-proxy（已有 `functions/api/scrape-proxy.ts`）；境内前端直连带 AK 域名白名单。
4. **无 PostGIS 可接受**：个人轨迹用 Turf.js 在浏览器算完全够（当前 globe/flat-map 已用客户端几何运算）。
5. **演进路径清晰**：用户破 500 时加 Workers Paid；破 5000 时迁 Supabase Pro 或腾讯云 TDSQL-C；不需推倒重来。

### 取舍与风险

- **D1 是 SQLite**：无 PostGIS、无并发写优势。个人单写场景无影响；多账号（V4）时评估迁移。
- **Workers 无 ffmpeg**：视频节点（V2.0）、记忆电影（V3.0）需本地转码后上传，或外接 Mux/Cloudinary（V3 再评估）。
- **Workers 30s CPU/请求**：长同步任务用 Queues 分片，单次请求不超时。
- **境内 API 延迟**：Cloudflare 边缘对中国用户 30-100ms 抖动，可接受（非实时交互场景）；若未来需要 <10ms 极致体验，走国内云 + 备案。
- **中国用户访问**：Cloudflare 在中国有节点但性能不稳定；个人自用可接受，规模化时评估国内 CDN 前置。

### 后续触发重新评估的条件

- 用户 > 500 或媒体 > 500GB：加 R2 主存储，本机只存热点。
- 用户 > 5000 或需多账号并发：迁 DB 到 Supabase Pro / 腾讯云 TDSQL-C，分离 DB 与计算。
- 需要中国境内 <10ms：走国内云 + ICP 备案。
- 视频功能成核心：接入 Mux/Cloudinary 转码服务。

### 参考

- `doc/复盘报告_功能完成与分期方案.md`：完整功能盘点与分期排期。
- `docs/current-baseline.md`：当前代码基线。
- `docs/cloudflare-setup.md`：Cloudflare 资源创建与部署指南。
