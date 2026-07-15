# Attraction Explorer 集成说明

`attraction-explorer` 是可独立导入的 React/TypeScript 组件包。当前家庭地图已经使用它驱动三级地图的 WGS-84 景点锚点、右侧列表、4+2+X 筛选及双向联动。

## 导出能力

```ts
import {
  AttractionExplorerPanel,
  createApiAttractionProvider,
  selectAttractions,
  wgs84ToGcj02,
  gcj02ToWgs84,
  bd09ToWgs84,
  type Attraction,
  type AttractionMapView,
} from "@/features/attraction-explorer"
```

`AttractionExplorerPanel` 的必要入参：

- `items: RankedAttraction[]`：已经过 4+2+X 计算的当前地图点。
- `total: number`：当前地区数据总量。
- `zoom: number`：地图实时缩放级别。
- `preference: "popular" | "niche"`：热门/小众排序模式。
- `category`：一级分类或“全部”。
- `selectedId`：地图或列表当前选中的景点 ID。
- `onSelect(item)`：列表选择出参；宿主应据此移动地图。
- `onPreferenceChange`、`onCategoryChange`：宿主重新计算列表与锚点。
- `onClearSelection`：回到地区级视野。
- `onBack`：返回国家地区列表。

地图组件向宿主输出 `{ zoom, bounds }`，宿主调用：

```ts
const ranked = selectAttractions(attractions, {
  zoom: mapView.zoom,
  bbox: mapView.bounds,
  category,
  preference,
  limit: 10,
})
```

算法固定执行：热门必玩 4 个、小众高替 2 个；3×3 网格每格最多 2 个；Zoom ≥ 12 增加 2 个彩蛋，Zoom ≥ 15 增加 4 个；结果最多 10 个。UI 默认显示前三个。

## HTTP API 契约

生产环境建议由服务端完成文旅部/地方开放平台、高德、UNESCO 等数据汇聚，前端只查询统一接口：

```http
GET /v1/attractions?bbox=west,south,east,north&zoom=8.75&country_code=JPN&region_id=hokkaido&category_l1=自然风光&preference=popular&limit=50
Accept: application/json
```

```json
{
  "data": [{
    "id": "jp-hkd-lake-toya",
    "name": "洞爷湖",
    "name_en": "Lake Toya",
    "lat_wgs84": 42.603,
    "lng_wgs84": 140.852,
    "category_l1": "自然风光",
    "category_l2": "湖泊",
    "popularity_score": 99,
    "niche_score": 86,
    "tags": ["火山湖", "亲子", "温泉"],
    "data_source": "Hokkaido Tourism Organization · HOKKAIDO LOVE!",
    "source_url": "https://www.visit-hokkaido.jp/en/spot/detail_10050.html",
    "last_updated": "2026-07-15T00:00:00+08:00"
  }],
  "meta": { "coordinate_system": "WGS-84", "next_cursor": null }
}
```

错误约定：`400` 参数错误、`401/403` 上游密钥/权限问题、`429` 限流、`502` 上游数据源不可用。服务端应返回 `Retry-After` 与可追踪的 `request_id`。

## 环境变量

```env
VITE_ATTRACTION_API_BASE=https://api.example.com
VITE_ATLAS_REGION=auto
VITE_AMAP_KEY=
VITE_MAPBOX_TOKEN=
```

- 国内地图渲染前调用 `wgs84ToGcj02`；高德响应入库前调用 `gcj02ToWgs84`。
- 百度响应入库前调用 `bd09ToWgs84`。
- 海外 Mapbox/Leaflet 直接使用 WGS-84。
- 密钥必须通过服务端代理或域名白名单保护，不能提交到仓库。

## 数据回退链（API → 爬虫 → 种子）

`resolveAttractions` / `createDefaultAttractionProvider` 固定按以下顺序取数：

1. **统一 API**：当设置 `VITE_ATTRACTION_API_BASE` 时请求 `GET /v1/attractions`；非 2xx、空数组或网络错误则进入下一步。
2. **爬虫 Provider**（`createScrapeAttractionProvider`）：
   - OpenStreetMap Overpass：按地区 bbox 拉取 `tourism` / `historic` / `natural` 兴趣点；
   - Wikipedia REST：补全摘要页配图与坐标；
   - 官方旅游站 HTML：仅通过白名单代理抓取 `og:title` / `og:image` / `description`；
   - 15 分钟内存缓存，避免重复打爆上游。
3. **官方种子数据**：`official-attractions.ts` 中已核验的静态目录。

### 爬虫代理

浏览器直连官方站会遇 CORS，因此开发与生产都提供同源代理：

| 环境 | 入口 |
|------|------|
| Vite 开发 | `scripts/vite-scrape-plugin.mjs` → `GET/POST /api/scrape-proxy?url=` |
| Cloudflare Pages | `functions/api/scrape-proxy.ts` → 同路径 |

只允许 `scrape-targets.ts` / `attraction-scrape-proxy.mjs` 中的旅游局与开放数据域名；未在白名单的 host 返回 `403`。

## 数据合规与更新

首批内置数据只包含已经逐页核验的北海道官方旅游数据。缺失的评分、评论数不会虚构，使用 `null`；用于排序的两个 score 必须记录 `score_basis`。新增 Provider 时应保留 `data_source`、`source_url`、`last_updated`，并在服务端做来源白名单、限速、增量更新和删除同步。

推荐更新链：官方数据集/开放 API → 原始层 → 坐标转换 → 去重与来源合并 → score 派生 → WGS-84 标准表 → `/v1/attractions`。  
API 不可用时：白名单爬虫（OSM + Wikipedia + 官方 og 元数据）→ 种子目录。
