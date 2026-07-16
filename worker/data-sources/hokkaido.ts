export interface OfficialSourceConfig {
  id: string
  destinationCode: string
  name: string
  url: string
  category: "opening" | "event" | "traffic" | "risk"
  audience: "chinese_traveler" | "destination_public" | "general"
  authorityCountry: string
  confidence: "official" | "secondary"
  refreshHours: number
  adapter: "manual-review" | "official-html"
  status: "configured" | "enabled" | "pending_review"
}

/**
 * The first batch is deliberately narrow.  These are official entry points,
 * not scraped notices: each source needs a robots/terms review before its
 * `official-html` adapter is enabled.
 */
export const HOKKAIDO_OFFICIAL_SOURCES: OfficialSourceConfig[] = [
  {
    id: "hokkaido-love-toyako",
    destinationCode: "JP-HOKKAIDO-TOYAKO",
    name: "北海道官方旅游网站 · 洞爷湖温泉",
    url: "https://www.visit-hokkaido.jp/cn/spot/detail_10616.html",
    category: "event",
    audience: "destination_public",
    authorityCountry: "JP",
    confidence: "official",
    refreshHours: 24,
    adapter: "manual-review",
    status: "configured",
  },
  {
    id: "toyako-town",
    destinationCode: "JP-HOKKAIDO-TOYAKO",
    name: "洞爷湖町官网",
    url: "https://www.town.toyako.hokkaido.jp/",
    category: "opening",
    audience: "destination_public",
    authorityCountry: "JP",
    confidence: "official",
    refreshHours: 12,
    adapter: "manual-review",
    status: "pending_review",
  },
  {
    id: "hokkaido-disaster",
    destinationCode: "JP-HOKKAIDO",
    name: "北海道防灾信息",
    url: "https://www.pref.hokkaido.lg.jp/sm/ktk/a001/",
    category: "risk",
    audience: "destination_public",
    authorityCountry: "JP",
    confidence: "official",
    refreshHours: 3,
    adapter: "manual-review",
    status: "configured",
  },
  {
    id: "northern-road-navi",
    destinationCode: "JP-HOKKAIDO",
    name: "北海道道路信息综合指南 · 北海道开发局",
    url: "https://northern-road.ceri.go.jp/navi/",
    category: "traffic",
    audience: "destination_public",
    authorityCountry: "JP",
    confidence: "official",
    refreshHours: 3,
    adapter: "manual-review",
    status: "configured",
  },
  {
    id: "cn-embassy-japan",
    destinationCode: "JP",
    name: "中国驻日本大使馆领事提醒",
    url: "https://jp.china-embassy.gov.cn/lsfw_0/lstx_138409/",
    category: "risk",
    audience: "chinese_traveler",
    authorityCountry: "CN",
    confidence: "official",
    refreshHours: 3,
    adapter: "manual-review",
    status: "configured",
  },
  {
    id: "cn-consular-service",
    destinationCode: "JP",
    name: "中国领事服务网",
    url: "https://cs.mfa.gov.cn/",
    category: "risk",
    audience: "chinese_traveler",
    authorityCountry: "CN",
    confidence: "official",
    refreshHours: 3,
    adapter: "manual-review",
    status: "configured",
  },
  {
    id: "govuk-japan-secondary",
    destinationCode: "JP",
    name: "英国政府旅行建议（第二参考）",
    url: "https://www.gov.uk/foreign-travel-advice/japan",
    category: "risk",
    audience: "general",
    authorityCountry: "GB",
    confidence: "secondary",
    refreshHours: 12,
    adapter: "manual-review",
    status: "configured",
  },
]

export function officialSourcesFor(destinationCode: string) {
  return HOKKAIDO_OFFICIAL_SOURCES.filter(source => source.destinationCode === destinationCode || (destinationCode === "JP-HOKKAIDO-TOYAKO" && source.destinationCode === "JP-HOKKAIDO") || (destinationCode.startsWith("JP-") && source.destinationCode === "JP"))
}
