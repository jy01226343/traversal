# Family Atlas API 申请与配置 — 用户行动清单 V1.0

> 这份清单只写你本人需要完成的事情。  
> 首期需要申请的 Key 只有两个：高德和 TomTom。  
> Open-Meteo 已接入，不需要 Key。  
> Google、Ticketmaster、OpenAI 暂时都不要申请。

---

# 一、今天完成：申请两个 Key

## 1. 申请高德 Web 服务 Key

### 去哪里

高德开放平台：

<https://lbs.amap.com/api/webservice/create-project-and-key>

### 怎么做

- [ ] 打开高德开放平台并注册/登录。
- [ ] 完成个人开发者认证。
- [ ] 进入“控制台”或“应用管理”。
- [ ] 点击“创建新应用”。
- [ ] 应用名称可填写：`Family Atlas`。
- [ ] 进入新应用，点击“添加 Key”。
- [ ] 服务平台选择：**Web 服务**。
- [ ] 创建并复制 Key。
- [ ] 将 Key 保存为：

```env
AMAP_WEB_SERVICE_KEY=你的高德Key
```

### 注意

- 不要把 Key 发到公开聊天、GitHub Issue 或截图中。
- 不要把 Key 写入前端 `VITE_*` 环境变量。
- 只交给 Codex 配置到 Worker/后端 Secret。

---

## 2. 申请 TomTom API Key

### 去哪里

TomTom Developer Portal：

<https://developer.tomtom.com/platform/documentation/my-tomtom/how-to-get-a-tomtom-api-key>

### 怎么做

- [ ] 注册或登录 TomTom 开发者账号。
- [ ] 进入 Key Management / Keys。
- [ ] 找到系统创建的第一个 API Key，或新建一个 Key。
- [ ] 复制 Key。
- [ ] 将 Key 保存为：

```env
TOMTOM_API_KEY=你的TomTomKey
```

### 注意

- 不把 Key 写入前端代码。
- 不在截图或日志中公开 Key。
- 境外路线和实时交通只在用户主动查看时调用，避免浪费额度。

---

# 二、确认后端/Worker

## 已经有 Cloudflare Worker 或其他后端

- [ ] 将仓库和现有部署方式交给 Codex。
- [ ] 告诉 Codex继续使用现有后端，不要重建第二套后端。
- [ ] 将高德和 TomTom Key 配成服务端 Secret。

## 还没有后端或 Worker

### 去哪里

Cloudflare Dashboard：

<https://dash.cloudflare.com/>

### 怎么做

- [ ] 注册/登录 Cloudflare。
- [ ] 进入 Workers & Pages。
- [ ] 创建一个 Worker，或让 Codex连接仓库并创建。
- [ ] 在 Worker 的 Settings / Variables and Secrets 中添加：

```env
AMAP_WEB_SERVICE_KEY
TOMTOM_API_KEY
```

- [ ] 两个变量都选择 **Secret**，不要选择普通明文变量。
- [ ] 如 Codex要求，再创建 KV 或 D1；不要自己提前创建一堆不用的资源。
- [ ] 将 Worker 项目名称或现有部署信息告诉 Codex。

---

# 三、检查 Open-Meteo

Open-Meteo 无需申请 Key。

- [ ] 确认当前天气接口仍可正常返回。
- [ ] 确认页面显示“天气数据：Open-Meteo”或等效署名。
- [ ] 将当前 Open-Meteo 代码位置告诉 Codex。
- [ ] 不要为 Open-Meteo 创建假 Key。

官方文档：

<https://open-meteo.com/en/docs>

---

# 四、准备第一批官方数据源

Codex 能写 Adapter，但你需要告诉它“先抓哪些官方网页”。

首批只准备 **5–10 个重点 POI/目的地**，不要准备全球所有地点。

建议优先：

1. 当前 Journey 中的目的地；
2. 北海道；
3. 中国境内最常用的目的地；
4. 心愿中最常查看的地点；
5. 临近出发的景区、博物馆和交通线路。

请复制下面表格填写：

| 目的地/POI | 国家/地区 | 官方网页 | 需要获取什么 | 优先级 |
|---|---|---|---|---|
| 示例：洞爷湖 | 日本北海道 | 官方网址 | 开放、活动、风险 | P0 |
|  |  |  |  |  |
|  |  |  |  |  |
|  |  |  |  |  |
|  |  |  |  |  |

### 合格来源

- 政府官网；
- 中国领事服务网；
- 中国驻外使领馆；
- 地方旅游局；
- 景区官网；
- 博物馆/场馆官网；
- 交通运营方官网。

### 不要提供

- Google Maps；
- 大众点评；
- 美团；
- 大麦；
- 猫眼；
- 小红书；
- 需要登录或验证码的页面；
- 用户评论页面。

---

# 五、风险提醒来源

你需要告诉 Codex：本项目以中国用户出行为主要口径。

- [ ] 中国用户出境主要来源：**中国领事服务网和中国驻外使领馆**。
- [ ] GOV.UK 只能作为第二参考。
- [ ] 前端必须标明每条提醒由哪个国家/机构发布。
- [ ] 不允许把 GOV.UK 写成中国官方建议。
- [ ] 多个来源意见不同，需要并列展示。

中国领事服务网：

<https://cs.mfa.gov.cn/>

GOV.UK Content API：

<https://content-api.publishing.service.gov.uk/reference.html>

---

# 六、境外 POI 数据

境外基础 POI 使用 OSM/Overpass，不需要申请 Key。

你只需要：

- [ ] 同意 Codex接入 OSM/Overpass。
- [ ] 同意页面显示 OpenStreetMap attribution。
- [ ] 同意 OSM 营业时间只显示为“参考营业时间”。
- [ ] 不把公开 Overpass/Nominatim 当作高频无限服务。
- [ ] 同意 Codex加入缓存、限频和失败降级。

官方入口：

- Overpass：<https://wiki.openstreetmap.org/wiki/Overpass_API>
- Nominatim 使用政策：<https://operations.osmfoundation.org/policies/nominatim/>

---

# 七、把这些材料交给 Codex

请一次性交给 Codex：

- [ ] 项目仓库或代码工作区。
- [ ] 《Family Atlas API 数据接入 — Codex 施工方案 V1.0》。
- [ ] `AMAP_WEB_SERVICE_KEY`。
- [ ] `TOMTOM_API_KEY`。
- [ ] 当前后端/Worker 部署信息。
- [ ] 当前 Open-Meteo 代码位置。
- [ ] 你填写好的首批官方数据源表。
- [ ] 首批重点目的地清单。
- [ ] 告诉 Codex：Google、Ticketmaster、OpenAI 首期不接。

Key 不要直接粘贴进施工文档。请通过 Codex 的 Secret/环境变量配置方式提供。

---

# 八、Codex 完成后你要验收

- [ ] 中国境内路线和 POI 使用高德。
- [ ] 日本和其他境外路线使用 TomTom。
- [ ] 天气继续使用 Open-Meteo。
- [ ] 境外基础 POI 使用 OSM。
- [ ] OSM 营业时间标明“参考”。
- [ ] 中国风险提醒优先显示中国领事/使领馆来源。
- [ ] GOV.UK 标明“英国政府旅行建议”。
- [ ] 每条动态信息都有来源和更新时间。
- [ ] 手动同步能看到天气、开放、交通、活动、风险的分项进度。
- [ ] 某一数据源失败时，其他数据仍能显示。
- [ ] 上游失败时保留最后成功数据。
- [ ] 浏览器前端代码中找不到完整 API Key。
- [ ] Git 仓库中没有 API Key。
- [ ] 地图拖动不会大量请求天气或交通。
- [ ] 缺 Key 时页面不会崩溃，而是显示降级状态。

---

# 九、现在不要做

- [ ] 不申请 Google Maps / Places。
- [ ] 不申请 OpenAI。
- [ ] 不申请 Ticketmaster。
- [ ] 不注册多个 AI 平台。
- [ ] 不抓取商业聚合网站。
- [ ] 不要求 Codex 一开始抓全球所有目的地。
- [ ] 不把 API Key 写进 `.md`、截图或前端代码。
- [ ] 不根据文档里的旧免费额度做预算承诺；每月查看一次官方政策即可。

---

# 十、以后什么时候再申请其他服务

## Ticketmaster

只有同时满足以下条件再申请：

- 活动模块已经完成；
- 你确实需要欧美大型演出和体育赛事；
- 官方地方活动源覆盖不足。

## Google Places

只有同时满足以下条件再评估：

- 大量 POI 缺少营业时间；
- 官方 Adapter 维护成本明显过高；
- 你确实依赖“现在是否营业”；
- 已设置预算、调用限制和账单提醒。

## AI API

只有同时满足以下条件再接：

- 本地规则解析失败率高；
- 经常出现复杂、多语言或模糊需求；
- 你愿意承担少量费用或平台维护；
- 已设置 Feature Flag、缓存和预算上限。

---

# 十一、最短执行顺序

1. [ ] 申请高德 Web 服务 Key。
2. [ ] 申请 TomTom API Key。
3. [ ] 确认或创建服务端 Worker。
4. [ ] 将两个 Key 设置为 Secret。
5. [ ] 填写 5–10 个重点官方来源。
6. [ ] 把 Codex 施工方案、仓库和来源表交给 Codex。
7. [ ] 等 Codex 完成后按第八部分验收。
8. [ ] Google、Ticketmaster、OpenAI 暂时不动。

---

# 最终需要维护的环境变量

```env
# 现在需要
AMAP_WEB_SERVICE_KEY=
TOMTOM_API_KEY=

# 当前不需要
TICKETMASTER_API_KEY=
OPENAI_API_KEY=
GOOGLE_MAPS_API_KEY=
```
