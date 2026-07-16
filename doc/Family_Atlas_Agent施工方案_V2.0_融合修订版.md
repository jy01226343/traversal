# FAMILY ATLAS — Agent 施工方案 V2.0（融合修订版）

- 对应产品文档：《Family Atlas 产品设计说明书 V3.0（融合定稿版）》
- 施工对象：Codex / AI Agent / 工程团队
- 技术决策原则：**保留现有实现栈，增量演进，不进行无价值的框架重写**
- 特别说明：本方案基于现有产品文档、Agent施工文档和已展示的PC/移动原型确定；执行前必须由Agent对实际代码仓库完成基线审计，以代码事实覆盖文档假设。

---

## 0. 全局硬性约束

1. **自适应首页**：根路由不得固定为旅行列表或固定地球。存在未完成 Journey 时默认进入 Journey Focus；新用户或无未完成 Journey 时进入 World Explore；始终提供双向切换。
2. **快照原则**：清单、装备、知识进入 PrepPlan/Journey 时 deep-copy，保留来源和版本，禁止直接引用可变模板。
3. **默认私密**：所有数据默认 private；分享必须使用 ShareCopy 冻结副本。
4. **AI草稿态**：AI生成的节点、摘要、文案、规则解释均为 draft，确认后才能进入正式档案。
5. **解锁语义**：解锁仅表示用户准备完成，不等于官方签证/入境许可。
6. **清单门槛**：HARD不可waive；ACKNOWLEDGED可waive但必须填写原因；ADVISORY不影响解锁。
7. **实时数据透明**：最新数据同步必须展示来源、更新时间、进度和部分失败；签证/入境规则优先官方来源。
8. **不做用户排行榜**：允许T1/T2/T3目的地编辑分级和个性化排序；禁止用户竞争榜、粉丝榜和家庭攀比。
9. **性能降级**：所有3D页面必须具备粒子减档→环境关闭→地形关闭→MapLibre 2D降级，不允许白屏。
10. **可撤销**：删除、公开分享、批量整理和AI应用必须可确认、可撤销；删除软删除30天。
11. **V1-V3单Owner**：成员为档案成员，可分配任务，由Owner确认；V4才开放真实多账号协作。
12. **不做范围**：导航、实时路况、预订交易、社区评论/关注/点赞、绕过限制的爬虫、用户竞争排行榜。

---

## 1. 技术方案最终决策

### 1.1 决策结论

保留现有前端技术路线，不迁移到Next.js，不重建前端；后端采用 Cloudflare 全家桶替代文档原假设的 Fastify+PostGIS+BullMQ（详见 `docs/architecture-decisions.md` ADR-001）。**本表以代码实际栈为准，已覆盖文档早期假设**：

| 层 | 最终选型 | 决策 |
|---|---|---|
| 语言 | TypeScript strict | 保留，前后端共享类型 |
| 仓库 | 单仓（npm）+ Cloudflare Pages Functions | 以代码实际为准；非 pnpm monorepo |
| 前端 | React 18 + Vite | 保留，不因新首页重写框架 |
| 路由 | react-router v6 | M1 引入（当前无路由） |
| 状态 | Zustand + TanStack Query | M1 引入（当前纯 useState） |
| UI | Tailwind CSS v4 + Radix UI + gsap + lucide | 保留；新增Quest/Icon/Progress组件 |
| 3D | **three.js** | 保留（代码实际，非 Cesium）；地球、足迹与媒体叠加 |
| 2D降级 | **Leaflet** | 保留（代码实际，非 MapLibre） |
| 后端 | **Cloudflare Workers + Drizzle ORM** | 替代 Fastify+Prisma；零运维 |
| 数据库 | **Cloudflare D1（SQLite）** | 替代 PostgreSQL+PostGIS；空间运算用 Turf.js（浏览器/Worker） |
| 对象存储 | **Cloudflare R2** | 替代 S3/MinIO；零 egress 费 |
| 队列 | **Cloudflare Queues + Durable Objects** | 替代 BullMQ+Redis；SSE 走 DO |
| 定时 | Cloudflare Cron Triggers | 新增；定时刷新签证/天气 |
| 媒体 | sharp + exifr（Workers WASM）；ffmpeg 本地转码后上传 | Workers 不支持 ffmpeg 二进制，个人视频量小可接受 |
| 轨迹 | fast-xml-parser（GPX/KML） | 保留解析；M1 实现 |
| AI | Workers + 外接 AI API 网关 | 保留草稿态，不允许浏览器直连 |
| 最新数据 | Provider Adapter + Queues + SSE（Durable Objects） | 新增；API优先，合规爬虫为受控后备 |
| 测试 | Vitest + Playwright + Miniflare | 保留；Miniflare 替代 supertest 测 Workers |

### 1.2 为什么不切换技术栈

- 前端已有方案和原型围绕 React/Vite、three.js 和 Leaflet 构建，迁移不会产生产品价值。
- three.js 适合个人规模的 3D 地球与相机飞行；Leaflet 适合 2D 降级与卫星瓦片。
- Cloudflare 全家桶（Workers/D1/R2/Queues/DO）托管队列、同步、媒体存储，零运维，个人用量在免费层；R2 零 egress 对媒体重应用成本最优。
- 境内（高德/百度/中国天气）与境外（OSM/Wikipedia/官方旅游局）API 双通道：境外走 Workers scrape-proxy，境内前端直连带 AK 白名单。
- 新需求主要是路由判定、数据同步和交互状态增加，不需要前端框架重构。

### 1.3 执行前代码基线审计

Agent开始施工前必须输出 `docs/current-baseline.md`：

- 当前package.json与锁文件；
- React/Vite/three.js/Leaflet/wrangler 实际版本；
- 已实现路由和页面（注意：当前无 react-router，为单文件 App）；
- 已存在 Cloudflare 资源（D1/R2/Queues）与迁移；
- 已实现地图、景点管道、scrape-proxy 和分享能力（注意：Journey/Memory/Share 实体尚未实现，见 `docs/current-baseline.md` §5 不一致项）；
- 当前测试和构建状态；
- 文档与代码不一致项。

原则：**代码已存在且可用的能力不得为了匹配文档而重写。**

---

## 2. 仓库结构修订

沿用原monorepo，新增或强化以下领域：

```text
family-atlas/
├── apps/web/src/features/
│   ├── home/                 # 自适应首页判定与模式切换
│   ├── world/                # 动态地球、足迹、推荐、愿望
│   ├── destination/          # 国家/目的地详情
│   ├── prepare/              # 游戏化解锁任务
│   ├── live-data/            # 最新数据同步UI与SSE进度
│   ├── journey/              # 计划、进行中、完整档案
│   ├── memory/               # 基础/高级Memory Chain
│   ├── share/                # 固定羊皮纸MVP与完整Share Studio
│   └── family/               # 单Owner档案成员，V4协作
├── apps/api/src/modules/
│   ├── home/
│   ├── destination/
│   ├── sync/
│   ├── prepare/
│   ├── journey/
│   ├── memory/
│   └── share/
├── packages/
│   ├── globe/                # Cesium封装与降级
│   ├── content/              # 目的地、规则、模板内容包
│   ├── providers/            # 官方API/公开页面数据适配器
│   ├── track/
│   ├── shared/
│   └── ui/
└── docs/
    ├── current-baseline.md
    ├── architecture-decisions.md
    └── source-policy.md
```

---

## 3. 领域模型增量修订

### 3.1 Journey状态

```text
DRAFT → PLANNING → PREPARING → READY → ONGOING → COMPLETED → ARCHIVED
```

未完成Journey定义：`PLANNING | PREPARING | READY | ONGOING`。

### 3.2 自适应首页

新增用户首页偏好：

```prisma
model HomePreference {
  userId        String @unique
  mode          HomeMode @default(AUTO) // AUTO|WORLD|JOURNEY
  pinnedJourneyId String?
}
```

`GET /api/v1/home/context` 返回：

```ts
{
  resolvedMode: 'WORLD' | 'JOURNEY',
  reason: 'NEW_USER' | 'NO_ACTIVE_JOURNEY' | 'ACTIVE_JOURNEY' | 'USER_OVERRIDE',
  activeJourneys: JourneySummary[],
  primaryJourney?: JourneySummary,
  worldSummary: { explored, wishlist, recommendations }
}
```

判定优先级：用户手动固定 > 置顶Journey > ONGOING > 最近更新的READY/PREPARING/PLANNING > World。

### 3.3 护照按成员存储

新增：

```prisma
model MemberPassport {
  memberId       String
  countryCode    String
  passportNumberEncrypted String?
  expiryMonth    String?
  isPrimary      Boolean @default(false)
}
```

产品早期不强制存护照号码；仅在用户主动上传材料时加密存储。入境规则匹配以成员护照国家为准。

### 3.4 清单门槛

`TripChecklistItem`新增：

```text
gateType: HARD | ACKNOWLEDGED | ADVISORY
status: TODO | IN_PROGRESS | DONE | NEEDS_REVIEW | WAIVED | LOCAL_PURCHASE
waiveReason?: string
```

约束：

- HARD不得WAIVED；
- ACKNOWLEDGED可WAIVED但waiveReason必填；
- ADVISORY不参与硬准备度；
- 解锁条件：所有HARD为DONE；所有ACKNOWLEDGED为DONE或WAIVED。

### 3.5 最新数据同步

新增：

```prisma
model LiveDataSnapshot {
  destinationId String
  kind           LiveDataKind // WEATHER|ENTRY_RULE|TRANSPORT|ADVISORY|EVENT
  payload        Json
  sourceRecords  Json
  fetchedAt      DateTime
  validUntil     DateTime?
  confidence     Int
  status         SnapshotStatus // FRESH|STALE|PARTIAL|ERROR
  version        Int
}

model SyncJob {
  destinationId String
  requestedBy   String
  status         SyncStatus // QUEUED|RUNNING|VERIFYING|COMPLETED|PARTIAL|FAILED|CANCELLED
  progress       Int
  currentStep    String?
  resultSummary  Json?
  errorSummary   Json?
}
```

### 3.6 基础Memory Chain前置

V1即启用`MemoryNode`正式表，但自动生成范围受限：

- 轨迹起点/终点；
- 长停留点；
- 用户精选照片叠卡；
- 手工事件；
- 每日开始/结束。

高级AI节点仍为draft，并在V3实现。

### 3.7 分享MVP

V1固定羊皮纸长图可不创建公开ShareCopy，但必须：

- 本地或服务端临时渲染；
- 只使用用户明确勾选内容；
- 默认应用脱敏；
- 导出后不产生可访问公开URL。

---

## 4. API契约增量

```text
Home
  GET   /api/v1/home/context
  PUT   /api/v1/home/preference

Live Data
  GET   /api/v1/destinations/:slug/live-snapshots
  POST  /api/v1/destinations/:slug/sync
  GET   /api/v1/sync-jobs/:id
  GET   /api/v1/sync-jobs/:id/events       # SSE
  POST  /api/v1/sync-jobs/:id/cancel
  POST  /api/v1/sync-jobs/:id/retry?kind=WEATHER

Prepare
  POST  /api/v1/prep-plans
  PATCH /api/v1/checklist-items/:id
  POST  /api/v1/checklist-items/:id/waive
  POST  /api/v1/prep-plans/:id/unlock

Memory V1
  GET   /api/v1/journeys/:id/memory-chain
  POST  /api/v1/journeys/:id/memory-chain/build-basic

Share V1
  POST  /api/v1/journeys/:id/share-preview/parchment
  GET   /api/v1/jobs/:id/events             # 生成进度SSE
```

统一进度事件：

```ts
type ProgressEvent = {
  jobId: string
  progress: number
  step: string
  message: string
  source?: { name: string; url?: string }
  completedKinds?: string[]
  failedKinds?: { kind: string; reason: string }[]
}
```

---

## 5. 数据同步子系统

### 5.1 来源优先级

1. 官方开放API；
2. 官方公开页面/公告；
3. 获得授权或明确允许使用的可信数据服务；
4. 编辑内容包；
5. 其他来源只用于线索，不直接发布为签证/入境结论。

### 5.2 Provider Adapter

```ts
interface DestinationDataProvider {
  kind: LiveDataKind
  supports(input: SyncContext): boolean
  fetch(input: SyncContext, signal: AbortSignal): Promise<ProviderResult>
  normalize(raw: unknown): NormalizedSnapshot
  freshness(snapshot: NormalizedSnapshot): Freshness
}
```

`packages/providers`中每个来源独立实现，API与抓取方式对上层透明。

### 5.3 合规爬虫边界

- 仅抓取公开可访问且条款允许的页面；
- 遵守robots、频率限制和版权要求；
- 禁止绕过登录、验证码、付费墙或反爬措施；
- 页面结构变化导致解析失败时返回PARTIAL，不静默使用旧字段；
- 原始抓取响应保存短期审计摘要，不长期复制受版权保护全文。

### 5.4 同步步骤和进度

```text
0-5%    创建任务与读取缓存
5-25%   天气/季节数据
25-50%  入境与签证规则
50-65%  交通与直飞限制
65-80%  安全/近期提醒
80-92%  来源去重、冲突检测、时间有效性
92-100% 生成版本快照并发布
```

任何一个模块失败不应使其他模块失效。结果状态可为`PARTIAL`。

### 5.5 前端展示

- “同步最新数据”按钮；
- 上次更新时间与缓存状态；
- 总进度条和当前步骤；
- 来源列表；
- 成功/失败模块；
- 取消、重试失败模块；
- 页面离开后任务继续，返回可恢复进度。

---

## 6. 自适应首页施工规格

### 6.1 根路由流程

```text
App Bootstrap
  → Auth/Family加载
  → GET /home/context
  → resolvedMode=JOURNEY ? JourneyFocusHome : WorldExploreHome
  → 用户可用顶部模式切换器即时切换
```

### 6.2 Journey Focus

必须包含：

- 当前Journey封面、状态和倒计时；
- 路线规划与Day摘要；
- 硬准备度/建议完成率；
- 最重要的三个下一步任务；
- 最新数据同步入口和数据新鲜度；
- 天气、签证、交通近期变化摘要；
- 基础Memory Chain预览（有轨迹/媒体时）；
- “探索世界”缩略地球入口。

### 6.3 World Explore

必须包含：

- 动态地球六层；
- 洲际幻灯；
- T1推荐；
- 足迹六态；
- 愿望清单；
- 最近Journey入口；
- 若有未完成Journey，显示“继续旅程”浮动卡。

---

## 7. 游戏化Unlock Quest施工规格

### 7.1 任务类别组件

新增`QuestCategoryCard`，支持十类图标：

- passport/visa
- currency/payment
- power/adapter
- sim/network
- apps
- transport
- health/insurance
- clothing/gear
- culture/language
- safety/weather

卡片状态：LOCKED、AVAILABLE、IN_PROGRESS、DONE、NEEDS_REVIEW、WAIVED。

### 7.2 准备度

```text
hardReadiness = HARD done / HARD total
ackReadiness  = ACK done or waived / ACK total
advisoryRate  = ADVISORY done / ADVISORY total
```

界面不得把WAIVED显示为普通DONE；必须显示跳过数和原因入口。

### 7.3 解锁动画

动画序列6-9秒，可跳过：

1. 图标任务逐项发光；
2. 清单卷轴撕裂；
3. 护照盖章；
4. 地球转向；
5. 出发城市到目的地的航线与飞机；
6. 国家地貌放大；
7. T1灯塔闪烁；
8. 进入国家页。

`prefers-reduced-motion`下使用无粒子、短转场版本。

---

## 8. Memory Chain前置施工规格

### 8.1 V1基础节点生成

规则：

- 每日首个轨迹点→DAY_START；
- 每日最后轨迹点→DAY_END；
- 停留超过配置阈值→PLACE；
- 精选照片叠卡→MEDIA；
- 用户事故/心得→EVENT；
- 用户可合并、重命名、移动和删除节点。

### 8.2 V1交互

- 时间轴点击联动地图；
- 上一站/下一站；
- 节点缩略→记忆卡→高清全屏；
- 关闭媒体后恢复原相机和选中节点；
- 可从头到尾手动播放。

### 8.3 V3高级能力

- AI自动节点草稿；
- 成员视角；
- 路线自动回放；
- 记忆电影；
- 时间胶囊；
- 地图皮肤。

---

## 9. 分期施工里程碑

### M0 代码基线与文档校准

- 输出当前仓库审计；
- 确认已实现能力与缺口；
- 修复现有build/test；
- 建立ADR，禁止未经批准的框架迁移。

**AC**：`pnpm build && pnpm test`全绿；形成已完成/部分完成/未开始矩阵。

### M1 V0.8旅行底座稳定

- 稳定Journey CRUD、成员档案、轨迹导入、媒体导入；
- 3D路线、照片三层、海拔联动；
- 基础数据卡、装备/注意事项；
- 2D降级和响应式布局。

**AC**：样例Journey可在PC/移动完整浏览；5000点轨迹达到基准性能；地图上下文不丢。

### M2 Public V1.0 世界与旅行首发

- 自适应首页；
- World Engine基础六层与T1推荐；
- 足迹/愿望；
- 基础Memory Chain；
- 固定羊皮纸长图MVP；
- Journey和World双向入口。

**AC**：新用户默认地球；存在未完成Journey默认旅程指挥中心；用户可切换；可从地球进入回忆并导出脱敏长图。

### M3 V1.5探索与准备

- T1/T2/T3内容包与可解释推荐；
- 位置/时区/成员护照；
- LiveDataSnapshot与同步进度；
- 游戏化十类任务；
- HARD/ACK/ADVISORY门槛；
- 解锁动画与国家探索页。

**AC**：同一目的地因护照不同显示不同规则；同步可显示完整进度与部分失败；HARD未完成时前后端均禁止解锁。

### M4 V2.0完整旅行记录

- 旅行进行中移动页；
- 离线包、IndexedDB队列和同步；
- 花费五视图；
- 装备库、快照和评价；
- 注意事项/知识快照；
- 视频节点与每日时间线；
- 数据导出。

**AC**：飞行模式记录10条数据恢复网络后零丢失；旅行结束可完成完整复盘。

### M5 V3.0高级记忆与分享

- AI节点草稿；
- 自由探索、成员视角、路线回放；
- 记忆电影和时间胶囊；
- AI文案/转写；
- ShareCopy、互动网页、长图、PDF、多主题和隐私配置。

**AC**：自动回放旅行；分享副本不影响原档案；关闭链接立即失效；儿童脱敏默认开启。

### M6 V4.0家庭人生地图

- 多账号Editor/Viewer；
- 变更历史；
- 成员成长线和里程碑；
- 家庭护照与非竞争型徽章；
- 年度回顾与代际记忆。

**AC**：不同成员的多年Journey可汇总为家庭成长地图；多人编辑重要操作可撤销。

---

## 10. 测试与质量门槛

### 10.1 新增关键测试

- 自适应首页判定的所有状态组合；
- 用户偏好覆盖AUTO逻辑；
- HARD不可waive、ACK waive需原因、解锁422；
- 同步任务SSE断线重连；
- 某数据模块失败时PARTIAL结果可用；
- 来源时间超过阈值显示STALE；
- 基础Memory Chain节点生成与地图联动；
- 长图默认脱敏；
- 3D低帧率自动降级2D。

### 10.2 性能预算

沿用现有NFR：

- 地球首屏PC≤3s、移动4G≤5s；
- 目标60fps，最低30fps，持续<24fps自动降级；
- 1000张照片+5000轨迹点Journey打开≤4s；
- 同屏Beacon按缩放聚簇；
- 最新数据同步后台任务化，页面不阻塞。

### 10.3 Definition of Done

每个任务必须满足：

- 类型检查、lint、单测、API测试、E2E冒烟全绿；
- PC和375px移动布局无溢出；
- 加载、空态、失败、权限不足、离线和降级状态完整；
- 数据来源和更新时间可见；
- 重要操作可撤销；
- 文档与实际API/schema同步；
- 不以静态mock替代验收要求，除非任务明确为Prototype。

---

## 11. Codex执行指令

1. 先审计仓库，不根据文档猜测已实现状态。
2. 保留现有技术栈和可用组件，禁止整仓重写。
3. 每个里程碑建立独立分支或PR，前序AC未通过不得宣称后序完成。
4. 数据同步与AI必须后台任务化，前端只消费状态和进度。
5. 所有受监管/高风险信息必须保留来源、更新时间、快照和免责声明。
6. 每次完成任务后更新：`docs/progress-matrix.md`、数据库迁移、API文档和E2E用例。
7. 视觉效果必须有无动画/2D降级路径。
8. 最终验收以用户可完成的端到端流程为准，不以组件数量为准。
