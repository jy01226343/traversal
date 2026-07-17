# Family Atlas API 数据接入 — Codex 施工方案 V1.0

> 用途：将本文件直接交给 Codex，作为境内外天气、交通、POI、开放状态、风险提醒、活动与语义筛选的数据施工基线。  
> 项目原则：个人使用、首期零成本优先、免费 API 优先、官方公告优先、少量定点 Adapter 补充。  
> 当前首期只依赖两个第三方密钥：`AMAP_WEB_SERVICE_KEY` 与 `TOMTOM_API_KEY`。  
> 暂不接入：Google Places、OpenAI、Ticketmaster。  
> 已接入：Open-Meteo。

---

## 0. Codex 执行边界

### 必须执行

1. 先审计现有仓库，再修改代码。
2. 复用当前后端或 Worker；若仓库没有服务端代理，再创建 Cloudflare Worker。
3. 前端只能访问项目自己的 `/api/*`，不得直接调用需要 Key 的第三方服务。
4. 所有第三方结果必须归一化为项目内部统一数据结构。
5. 所有结果必须返回：
   - 数据来源；
   - 来源口径；
   - 抓取/请求时间；
   - 发布时间（若有）；
   - 是否来自缓存；
   - 新鲜度状态；
   - 错误或降级状态。
6. 任一 Provider 失败不得拖垮其他 Provider。
7. 自动同步与手动同步必须复用同一数据网关。
8. 所有请求必须支持缓存、超时、取消、去重、重试和熔断。
9. 不得把调用额度或免费政策硬编码到业务逻辑；额度阈值使用环境变量配置。
10. 不得自行新增付费供应商。

### 禁止执行

- 不申请或接入 Google Places / Routes。
- 不接入 OpenAI。
- 不接入 Ticketmaster，先保留接口和 Feature Flag。
- 不抓取 Google Maps、大众点评、美团、大麦、猫眼、小红书或搜索结果页。
- 不绕过登录、验证码、会员限制和反爬机制。
- 不将高德、TomTom 或未来 AI Key 写入 `VITE_*`、前端源码、日志或错误响应。
- 不把 OSM 营业时间包装成“实时开放”。
- 不把 GOV.UK 内容包装成“中国官方风险建议”。
- 不将多个国家政府的风险建议合并为虚构的“全球官方风险等级”。

---

# 1. 开工前仓库审计

Codex 首次执行时先输出审计报告，至少回答：

1. 当前前端框架、后端框架、部署方式和环境变量体系。
2. 是否已有 Cloudflare Worker、Serverless Function 或传统后端。
3. 当前 Open-Meteo 调用位置、缓存策略、返回结构和署名位置。
4. 当前地图 SDK 与坐标系。
5. 是否已有以下模块：
   - API client；
   - cache；
   - retry；
   - request cancellation；
   - feature flags；
   - cron jobs；
   - database/KV；
   - source metadata；
   - destination sync progress。
6. 计划新增、修改、删除的文件。
7. 现有数据模型与本方案模型的映射关系。
8. 存在阻塞时先报告，不得凭空替换整个技术栈。

---

# 2. 最终数据源路由

| 能力 | 中国境内 | 中国境外 | 首期状态 |
|---|---|---|---|
| 天气 | Open-Meteo | Open-Meteo | 已接入，继续使用 |
| 路线与交通 | 高德 Web 服务 | TomTom Routing / Traffic | 接入 |
| 基础 POI | 高德 POI | OSM / Overpass | 接入 |
| 开放状态 | 高德基础字段 + 官方 Adapter + 人工确认 | OSM `opening_hours` + 官方 Adapter + 人工确认 | 接入 |
| 风险提醒 | 中国领事服务网、使领馆、境内政府和目的地公告 | 中国官方口径为主，GOV.UK 为第二参考口径 | 接入 |
| 当地活动 | 官方文旅局、景区、博物馆和场馆 Adapter | 官方旅游局/场馆 Adapter | 只建骨架和少量重点来源 |
| 国际大型活动 | 暂无 | Ticketmaster | Feature Flag，首期关闭 |
| 语义筛选 | 本地规则解析器 | 本地规则解析器 | 接入，不调用 LLM |
| 复杂语义兜底 | 暂无 | 暂无 | 保留接口，首期关闭 |

---

# 3. 目录与模块建议

Codex 应优先适配现有仓库目录；若无对应结构，采用：

```text
src/
├── api/
│   ├── routes/
│   │   ├── weather.ts
│   │   ├── route.ts
│   │   ├── traffic.ts
│   │   ├── places.ts
│   │   ├── advisories.ts
│   │   ├── destination-sync.ts
│   │   └── semantic-filter.ts
│   ├── gateway/
│   │   ├── DataGateway.ts
│   │   ├── provider-router.ts
│   │   └── source-health.ts
│   ├── providers/
│   │   ├── weather/OpenMeteoProvider.ts
│   │   ├── traffic/AmapTrafficProvider.ts
│   │   ├── traffic/TomTomTrafficProvider.ts
│   │   ├── places/AmapPlaceProvider.ts
│   │   ├── places/OsmPlaceProvider.ts
│   │   ├── advisory/GovUkProvider.ts
│   │   ├── advisory/ChinaConsularAdapter.ts
│   │   ├── advisory/EmbassyAdapter.ts
│   │   ├── official/OfficialSourceAdapter.ts
│   │   └── semantic/RuleBasedParser.ts
│   ├── cache/
│   ├── rate-limit/
│   ├── normalize/
│   └── errors/
├── data-sources/
│   ├── destinations/
│   │   └── <destination-code>/source-config.json
│   └── schemas/
└── jobs/
    ├── advisory-sync.ts
    ├── opening-status-sync.ts
    └── event-sync.ts
```

---

# 4. 环境变量与 Secret

## 4.1 当前必须配置

```env
AMAP_WEB_SERVICE_KEY=
TOMTOM_API_KEY=
```

## 4.2 运行配置

```env
API_CACHE_NAMESPACE=
API_DATABASE_ID=

AMAP_DAILY_SOFT_LIMIT=
TOMTOM_DAILY_SOFT_LIMIT=

UPSTREAM_TIMEOUT_MS=8000
UPSTREAM_RETRY_COUNT=2
UPSTREAM_CIRCUIT_FAILURE_THRESHOLD=5
UPSTREAM_CIRCUIT_RESET_SECONDS=300

FEATURE_TICKETMASTER=false
FEATURE_LLM_SEMANTIC_FILTER=false
FEATURE_OFFICIAL_SCRAPERS=true
```

## 4.3 以后才允许添加

```env
TICKETMASTER_API_KEY=
OPENAI_API_KEY=
GOOGLE_MAPS_API_KEY=
```

首期不得读取后三个变量。

## 4.4 Secret 安全要求

- 使用 Worker Secret、平台 Secret 或后端环境变量。
- 不写入前端 `.env`、`VITE_*`、源码、测试快照和日志。
- 错误消息不得包含完整 Key。
- 日志中的 URL 必须移除 `key`、`apikey`、`token` 参数。
- 支持 Key 轮换，不把 Key 与数据库记录绑定。

---

# 5. 内部统一数据结构

## 5.1 来源元数据

```ts
type SourceConfidence = "official" | "map_provider" | "secondary" | "manual";

interface SourceMeta {
  provider: string;
  sourceName: string;
  sourceUrl?: string;
  authorityCountry?: string;
  audience?: "chinese_traveler" | "uk_traveler" | "destination_public" | "general";
  confidence: SourceConfidence;
  fetchedAt: string;
  publishedAt?: string;
  expiresAt?: string;
  fromCache: boolean;
  stale: boolean;
}
```

## 5.2 Provider 通用结果

```ts
interface ProviderSuccess<T> {
  ok: true;
  data: T;
  source: SourceMeta;
  warnings?: string[];
}

interface ProviderFailure {
  ok: false;
  provider: string;
  code:
    | "MISSING_SECRET"
    | "TIMEOUT"
    | "RATE_LIMITED"
    | "UPSTREAM_ERROR"
    | "PARSE_ERROR"
    | "UNSUPPORTED_REGION"
    | "STALE_CACHE_ONLY";
  message: string;
  retryable: boolean;
  staleDataAvailable: boolean;
}

type ProviderResult<T> = ProviderSuccess<T> | ProviderFailure;
```

## 5.3 天气

```ts
interface WeatherSnapshot {
  latitude: number;
  longitude: number;
  timezone: string;
  observedAt: string;
  temperatureC?: number;
  precipitationMm?: number;
  windSpeedKph?: number;
  weatherCode?: number;
  forecast?: Array<{
    time: string;
    temperatureC?: number;
    precipitationProbability?: number;
    windSpeedKph?: number;
  }>;
}
```

## 5.4 路线与交通

```ts
interface RouteRequest {
  countryCode: string;
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  mode: "driving" | "walking" | "cycling" | "transit";
  departAt?: string;
}

interface RouteResult {
  distanceMeters: number;
  durationSeconds: number;
  trafficDelaySeconds?: number;
  geometry?: string;
  incidents?: TrafficIncident[];
  provider: "amap" | "tomtom";
}
```

## 5.5 POI 与开放状态

```ts
interface PlaceSummary {
  id: string;
  name: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  address?: string;
  categories: string[];
  phone?: string;
  website?: string;
}

interface PlaceStatus {
  placeId: string;
  status: "open" | "closed" | "unknown" | "reservation_required";
  regularHours?: OpeningHours;
  temporaryNotice?: string;
  lastEntryTime?: string;
  sourceType: "map_provider" | "official" | "manual";
  manuallyConfirmedAt?: string;
  manuallyConfirmedNote?: string;
}
```

## 5.6 风险提醒

```ts
interface TravelAdvisory {
  destinationCode: string;
  audience:
    | "chinese_traveler"
    | "uk_traveler"
    | "destination_public"
    | "general";
  level?: "info" | "caution" | "avoid_nonessential" | "avoid";
  category: "security" | "weather" | "disaster" | "traffic" | "health" | "closure";
  title: string;
  summary: string;
  sourceAuthority: string;
  sourceUrl: string;
  publishedAt?: string;
  fetchedAt: string;
}
```

## 5.7 官方网页 Adapter 输出

```ts
interface OfficialNotice {
  externalId: string;
  destinationCode: string;
  title: string;
  summary: string;
  category: "opening" | "event" | "traffic" | "risk";
  effectiveFrom?: string;
  effectiveTo?: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt?: string;
  fetchedAt: string;
  confidence: "official" | "secondary";
  parserVersion: string;
}
```

---

# 6. Provider 接口

```ts
interface WeatherProvider {
  getWeather(input: {
    lat: number;
    lng: number;
    timezone?: string;
    mode: "global" | "destination";
  }): Promise<ProviderResult<WeatherSnapshot>>;
}

interface TrafficProvider {
  supports(countryCode: string): boolean;
  getRoute(input: RouteRequest): Promise<ProviderResult<RouteResult>>;
  getTraffic(input: RouteRequest): Promise<ProviderResult<TrafficSnapshot>>;
}

interface PlaceProvider {
  supports(countryCode: string): boolean;
  search(input: PlaceSearchRequest): Promise<ProviderResult<PlaceSummary[]>>;
  getStatus(placeId: string): Promise<ProviderResult<PlaceStatus>>;
}

interface AdvisoryProvider {
  supports(destinationCode: string): boolean;
  list(destinationCode: string): Promise<ProviderResult<TravelAdvisory[]>>;
}

interface EventProvider {
  supports(destinationCode: string): boolean;
  list(input: EventSearchRequest): Promise<ProviderResult<TravelEvent[]>>;
}

interface SemanticFilterProvider {
  parse(input: string): Promise<ProviderResult<EditableFilterDraft>>;
}
```

---

# 7. Provider 路由规则

```ts
function trafficProviderFor(countryCode: string): TrafficProvider {
  return countryCode === "CN"
    ? amapTrafficProvider
    : tomTomTrafficProvider;
}

function placeProviderFor(countryCode: string): PlaceProvider {
  return countryCode === "CN"
    ? amapPlaceProvider
    : osmPlaceProvider;
}
```

## 风险提醒排序

面向中国用户时：

1. 中国领事服务网；
2. 中国驻目的国使领馆；
3. 目的地政府灾害/交通公告；
4. 景区官方关闭公告；
5. GOV.UK 第二参考口径。

不得覆盖或折叠为一个等级。冲突内容并列显示。

---

# 8. 坐标系处理

项目内部统一保存 WGS84。

- TomTom、Open-Meteo、OSM：按 WGS84 调用。
- 高德：在 `AmapProvider` 边界完成 WGS84 ↔ GCJ-02 转换。
- 转换代码集中在 `normalize/coordinates.ts`。
- 业务层不得直接处理坐标转换。
- 返回结果应标记原始 Provider，避免重复转换。
- 添加北京、上海、深圳、香港、东京和北海道的坐标回归测试。

---

# 9. API 路由

## 9.1 天气

```http
GET /api/weather?lat=...&lng=...&mode=global|destination
```

行为：

- 全球模式缓存 30–60 分钟。
- 目的地模式缓存 15–30 分钟。
- 支持批量坐标时优先合并请求。
- 地图拖动不得自动触发请求。
- 返回 Open-Meteo 来源和署名信息。

## 9.2 路线

```http
POST /api/route
Content-Type: application/json
```

请求体使用 `RouteRequest`。

行为：

- 中国境内走高德。
- 境外走 TomTom。
- 路线基础结果缓存 24 小时。
- 同一出发地、目的地、模式和出发时间请求去重。
- 新请求取消旧请求。

## 9.3 实时交通

```http
POST /api/traffic
```

行为：

- 只在具体目的地、路线页、手动同步和临近出发时调用。
- 不在全球地图常驻轮询。
- 当前交通缓存 10–15 分钟。
- 交通事件缓存 10–20 分钟。

## 9.4 POI 搜索

```http
GET /api/places/search?countryCode=CN&q=...&lat=...&lng=...
```

行为：

- CN：高德。
- 非 CN：OSM/Overpass。
- 公共 OSM 服务必须缓存并限频；不得作为高频自动补全后端。
- OSM 数据必须保留 attribution。

## 9.5 POI 开放状态

```http
GET /api/places/:id/status
POST /api/places/:id/manual-confirmation
```

合并优先级：

1. 官方公告；
2. 用户人工确认；
3. 地图 Provider / OSM 参考营业时间；
4. unknown。

OSM 文案固定为：

> 参考营业时间 · 来源 OpenStreetMap · 建议出发前查看官方公告

## 9.6 风险提醒

```http
GET /api/advisories?destinationCode=JP
```

行为：

- 返回按来源口径分组的数组。
- 每条风险显示来源机构、适用受众、发布时间和抓取时间。
- GOV.UK 明确标注“英国政府旅行建议”。

## 9.7 目的地同步

```http
POST /api/destinations/:destinationCode/sync
```

返回 Server-Sent Events、流式 JSON 或轮询任务：

```ts
interface DestinationSyncProgress {
  jobId: string;
  percent: number;
  steps: Array<{
    key: "weather" | "opening" | "traffic" | "events" | "risk";
    status: "queued" | "running" | "success" | "failed" | "stale";
    message?: string;
  }>;
}
```

要求：

- 单项失败不终止整体同步。
- 失败项保留最后成功数据。
- 自动同步与手动同步调用同一个 job。
- 用户手动同步优先于后台低优先级同步。

## 9.8 语义筛选

```http
POST /api/semantic-filter/parse
```

首期只调用 `RuleBasedParser`：

- 关键词；
- 同义词；
- 年龄；
- 月份；
- 时长；
- 体验类型；
- 交通难度；
- 家庭友好；
- 预算等。

输出可编辑 Filter Draft，必须由用户确认后应用。

---

# 10. 缓存策略

| 数据 | 普通场景 | Journey / 临近出发 |
|---|---:|---:|
| 全球天气 | 30–60 分钟 | — |
| 目的地天气 | 15–30 分钟 | 10–15 分钟 |
| 路线基础结果 | 24 小时 | 6–12 小时 |
| 实时交通 | 10–15 分钟 | 5–10 分钟 |
| 交通事故 | 10–20 分钟 | 5–10 分钟 |
| 常规营业时间 | 3–7 天 | 12–24 小时 |
| 临时关闭公告 | 6–12 小时 | 1–3 小时 |
| 当地活动 | 12–24 小时 | 6–12 小时 |
| GOV.UK 风险 | 6–24 小时 | 3–6 小时 |
| 中国领事/使领馆提醒 | 3–6 小时 | 1–3 小时 |

缓存 Key 必须包括：

- Provider；
- 地区/坐标；
- 查询参数；
- 数据版本；
- 语言；
- 出发日期或时间桶（适用时）。

采用 stale-while-revalidate：

1. 新鲜缓存：直接返回；
2. 陈旧但可用：先返回旧数据并后台刷新；
3. 无缓存：同步请求上游；
4. 上游失败：返回最后成功结果并标记 stale；
5. 永不因一次解析失败删除最后成功数据。

---

# 11. 调用额度保护

建立 `UsageGuard`：

```ts
interface ProviderUsage {
  provider: string;
  date: string;
  requestCount: number;
  cacheHitCount: number;
  failureCount: number;
  softLimit?: number;
}
```

要求：

- 每个 Provider 单独计数。
- 达到 80% soft limit 时写告警。
- 达到 soft limit 时：
  - 禁止非必要后台刷新；
  - 优先使用缓存；
  - 手动同步提示“当前使用缓存数据”；
  - 不自动切换到付费 Provider。
- 免费政策和配额不得写死；通过配置和月度人工检查更新。
- 不在日志记录完整请求 Key。

---

# 12. 官方网页 Adapter

## 12.1 只允许抓取

- 政府公开公告；
- 外交与领事提醒；
- 中国驻外使领馆公告；
- 地方旅游局；
- 景区官方开放公告；
- 博物馆、场馆官方活动日历；
- 交通运营方停运和施工公告；
- 无 API、RSS 或结构化数据的公开官方页面。

## 12.2 禁止抓取

- Google Maps；
- 大众点评；
- 美团；
- 大麦；
- 猫眼；
- 小红书；
- 搜索引擎结果页；
- 需要登录、验证码或会员访问的内容；
- 用户评论和完整版权正文。

## 12.3 Adapter 接口

```ts
interface OfficialSourceAdapter {
  id: string;
  supports(config: OfficialSourceConfig): boolean;
  fetch(config: OfficialSourceConfig): Promise<ProviderResult<OfficialNotice[]>>;
}
```

## 12.4 配置文件

```json
{
  "destinationCode": "JP-HOKKAIDO",
  "sources": [
    {
      "id": "official-tourism",
      "name": "官方旅游信息",
      "url": "https://example.gov/...",
      "category": "event",
      "audience": "general",
      "refreshHours": 24,
      "adapter": "generic-jsonld-or-html"
    }
  ]
}
```

## 12.5 抓取要求

- 每个站点单独 Adapter，禁止万能爬虫。
- 抓取前检查条款和 `robots.txt`。
- 设置清晰 User-Agent 和项目联系方式。
- 支持 `ETag`、`If-Modified-Since`。
- 每域名限制并发和频率。
- 优先解析 JSON-LD、RSS、公开 JSON，再解析 HTML。
- 只保存结构化字段与摘要，不保存完整正文。
- Parser 版本变化必须记录。
- Parser 失败时只停用该 Adapter。
- 页面变更不得拖垮同步任务。
- 输出内容进行 HTML 清理与长度限制。
- 外部文本不得作为系统指令执行。

---

# 13. 首批数据范围

首期只覆盖：

1. 中国境内重点目的地；
2. 日本北海道；
3. 当前 Journey 的目的地；
4. 用户心愿中的高频目的地；
5. 5–10 个最关键 POI 的官方来源。

不得首期抓取全球全部目的地。

Codex 应建立 `source-config.example.json`，由用户填写官方来源，再启用具体 Adapter。

---

# 14. 前端显示与数据可信度

所有动态信息都要显示：

- 来源；
- 更新时间；
- 数据口径；
- 新鲜度；
- 同步状态。

建议文案：

```text
天气 · Open-Meteo · 12 分钟前
参考营业时间 · OpenStreetMap · 3 天前
官方开放公告 · 洞爷湖官网 · 2 小时前
中国公民旅行提醒 · 中国领事服务网
第二参考 · 英国政府旅行建议
```

禁止文案：

```text
实时开放（来源只是 OSM）
全球官方风险等级
中国官方建议（来源是 GOV.UK）
```

---

# 15. 测试要求

## 15.1 单元测试

- Provider 路由：中国→高德，境外→TomTom/OSM。
- WGS84 与 GCJ-02 转换。
- Cache Key 与 TTL。
- stale-while-revalidate。
- UsageGuard。
- RuleBasedParser。
- 风险来源排序与口径。
- 官方 Adapter 解析与失败保留旧数据。
- Key 缺失与 Secret 脱敏。

## 15.2 集成测试

- Open-Meteo 正常、超时、失败。
- 高德路线/POI 正常、限流、缺 Key。
- TomTom 正常、限流、缺 Key。
- Overpass 超时和空结果。
- GOV.UK 返回结构变化。
- 中国官方 Adapter HTML 变化。
- Destination sync 部分成功。
- 离线/缓存结果。
- 手动确认覆盖参考营业时间。

## 15.3 E2E

1. 中国目的地查看路线，走高德。
2. 日本目的地查看路线，走 TomTom。
3. 境外 POI 返回 OSM 参考时间。
4. 官方关闭公告覆盖 OSM 常规营业时间。
5. 风险卡同时显示中国官方口径和 GOV.UK 第二参考。
6. 手动同步显示分项进度。
7. 单项失败仍完成同步。
8. 无 Key 时给出可理解降级，不泄露 Secret。
9. 规则语义筛选输出可编辑条件，用户确认后应用。
10. 地图拖动不触发天气或交通风暴请求。

---

# 16. 分阶段施工

## Phase 1：基础骨架

- DataGateway；
- Provider 接口；
- Provider Router；
- SourceMeta；
- Cache；
- UsageGuard；
- Secret 检查；
- 统一错误；
- Feature Flags。

## Phase 2：核心免费数据

- Open-Meteo 整理为 Provider；
- GOV.UK Provider；
- OSM/Overpass Provider；
- RuleBasedParser；
- 前端来源和更新时间显示。

## Phase 3：境内外路线和 POI

- 高德交通、路线、POI；
- TomTom 路线和交通；
- 坐标转换；
- 请求去重、取消和缓存。

## Phase 4：官方来源与同步

- 中国领事服务 Adapter；
- Embassy / Destination Authority Adapter；
- 北海道和首批重点 POI Adapter；
- Destination Sync Job；
- Cron；
- last-good-data 保留。

## Phase 5：测试与交付

- 单元、集成、E2E；
- 使用量面板；
- 异常与降级；
- Secret 扫描；
- 文档；
- 截图/录屏。

Ticketmaster、Google、OpenAI 不进入以上阶段。

---

# 17. Codex 最终交付格式

完成后输出：

1. 仓库审计结论。
2. 新增、修改、删除文件清单。
3. Provider 路由表。
4. 新增环境变量清单。
5. 用户仍需人工完成的步骤。
6. 数据库/KV 迁移。
7. 每个 API 路由的请求与响应示例。
8. 缓存 TTL 和 UsageGuard 配置。
9. 测试结果。
10. 已接入官方来源列表。
11. 失败/降级演示。
12. 暂未实现项目及原因。
13. Secret 泄露扫描结果。
14. 本地运行、部署与回滚命令。

---

# 18. 完成定义

只有同时满足以下条件才算完成：

- 前端没有第三方 Secret。
- 中国路线/POI正确走高德。
- 境外路线/交通正确走 TomTom。
- 全球天气继续走 Open-Meteo，并显示署名。
- 境外基础 POI 可以走 OSM/Overpass。
- 中国官方风险源为中国用户主要口径。
- GOV.UK 明确标记为第二参考口径。
- OSM 开放时间明确标记为参考数据。
- 官方 Adapter 失败保留最后成功数据。
- 同步支持部分成功。
- 地图失败或 Provider 缺失不阻断核心页面。
- Google、Ticketmaster、OpenAI 未进入首期运行依赖。
- 所有测试与 Secret 扫描通过。

---

# 19. 官方文档入口

- 高德创建 Web 服务 Key：<https://lbs.amap.com/api/webservice/create-project-and-key>
- TomTom 获取 API Key：<https://developer.tomtom.com/platform/documentation/my-tomtom/how-to-get-a-tomtom-api-key>
- Open-Meteo：<https://open-meteo.com/en/docs>
- GOV.UK Content API：<https://content-api.publishing.service.gov.uk/reference.html>
- Overpass API：<https://wiki.openstreetmap.org/wiki/Overpass_API>
- Nominatim 使用政策：<https://operations.osmfoundation.org/policies/nominatim/>
- Cloudflare Dashboard：<https://dash.cloudflare.com/>
