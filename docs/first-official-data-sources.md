# 首批官方数据源

本清单仅登记公开官方入口与数据口径；`manual-review` 状态的站点尚未抓取。每个站点在启用 Adapter 前，必须完成 robots、使用条款、限频及结构化字段审查。

| 目的地/POI | 国家/地区 | 官方网页 | 获取内容 | 优先级 | 口径 |
| --- | --- | --- | --- | --- | --- |
| 洞爷湖温泉 | 日本北海道 | [北海道官方旅游网站](https://www.visit-hokkaido.jp/cn/spot/detail_10616.html) | 景区基础信息、活动入口 | P0 | 目的地官方 |
| 洞爷湖町 | 日本北海道 | [洞爷湖町官网](https://www.town.toyako.hokkaido.jp/) | 临时关闭、公共活动、灾害公告 | P0 | 地方政府 |
| 北海道全域 | 日本北海道 | [北海道防灾信息](https://www.pref.hokkaido.lg.jp/sm/ktk/a001/) | 灾害、避难与风险公告 | P0 | 地方政府 |
| 北海道道路 | 日本北海道 | [北の道ナビ](https://northern-road.ceri.go.jp/navi/) | 道路通行限制、施工与出行风险 | P0 | 政府/道路信息 |
| 日本目的地 | 日本 | [中国驻日本大使馆领事提醒](https://jp.china-embassy.gov.cn/lsfw_0/lstx_138409/) | 中国公民风险提醒 | P0 | 中国官方、面向中国旅客 |
| 日本目的地 | 日本 | [中国领事服务网](https://cs.mfa.gov.cn/) | 中国公民旅行与领事提醒 | P0 | 中国官方、面向中国旅客 |
| 日本目的地 | 英国 | [GOV.UK Japan](https://www.gov.uk/foreign-travel-advice/japan) | 第二参考风险口径 | P1 | 英国政府；不得标为中国官方建议 |

## 启用规则

- 风险卡按来源分组展示，不合成为单一“全球官方等级”。
- 中国领事服务网和中国驻外使领馆优先展示给中国用户。
- OSM/Overpass 已获用户授权并启用，响应与前端均须显示 OpenStreetMap attribution；`opening_hours` 固定标为“参考营业时间”，不得包装为实时开放。
- Provider 访问失败时保留最后成功缓存或返回明确不可用状态，不能阻塞地图和列表的基础浏览。
