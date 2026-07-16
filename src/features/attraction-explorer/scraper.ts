import type { Attraction, AttractionCategoryL1, AttractionProvider, AttractionQuery, MapBoundsWgs84 } from "./types"
import { boundsFromFocus, getRegionScrapeTarget, isHostAllowlisted, type RegionScrapeTarget, type ScrapeTargetSpot } from "./scrape-targets"

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
]

const WIKI_SUMMARY = "https://en.wikipedia.org/api/rest_v1/page/summary/"
const SCORE_BASIS = "爬虫聚合：OpenStreetMap 兴趣点 + Wikipedia 摘要/配图 + 官方旅游站白名单页面；评分按标签完整度派生，非OTA评分"
const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=900&q=80"

interface WikiSummary {
  title?: string
  extract?: string
  description?: string
  content_urls?: { desktop?: { page?: string } }
  thumbnail?: { source?: string }
  originalimage?: { source?: string }
  coordinates?: { lat: number; lon: number }
  type?: string
}

interface OverpassElement {
  type: string
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

const memoryCache = new Map<string, { at: number; data: Attraction[] }>()
const CACHE_TTL_MS = 15 * 60 * 1000

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-").replace(/^-|-$/g, "").slice(0, 48)
}

/** OSM tag 值 → 中文翻译表 */
const OSM_TAG_ZH: Record<string, string> = {
  // tourism
  attraction: "景点", museum: "博物馆", gallery: "美术馆", viewpoint: "观景点",
  theme_park: "主题乐园", zoo: "动物园", aquarium: "水族馆", artwork: "艺术品",
  camp_site: "露营地",
  // historic
  castle: "城堡", monument: "纪念碑", ruins: "遗址", archaeological_site: "考古遗址",
  memorial: "纪念馆",
  // natural
  peak: "山峰", volcano: "火山", hot_spring: "温泉", beach: "海滩", cliff: "悬崖",
  // leisure
  picnic_table: "野餐区", park: "公园",
  // sport
  skiing: "滑雪",
}

/** 将 OSM 英文 tag 值翻译为中文 */
function zhTag(value: string): string {
  return OSM_TAG_ZH[value] || value
}

function mapCategory(tags: Record<string, string> = {}): { l1: AttractionCategoryL1; l2: string } {
  const tourism = tags.tourism || ""
  const historic = tags.historic || ""
  const natural = tags.natural || ""
  const leisure = tags.leisure || ""
  if (historic || tourism === "museum" || tourism === "gallery") return { l1: "人文历史", l2: zhTag(historic || tourism || "文化") }
  if (natural === "peak" || tags.sport === "skiing" || tags.highway === "path") return { l1: "户外极限", l2: zhTag(natural || tags.sport || "徒步") }
  if (tourism === "theme_park" || tourism === "zoo" || tourism === "aquarium") return { l1: "超级工程", l2: zhTag(tourism) }
  if (tourism === "viewpoint" || natural === "hot_spring") return { l1: "网红奇观", l2: zhTag(tourism || natural) }
  if (leisure === "picnic_table" || leisure === "park" || tourism === "camp_site") return { l1: "休闲露营", l2: zhTag(leisure || tourism) }
  if (natural || tourism === "attraction") return { l1: "自然风光", l2: zhTag(natural || "景点") }
  return { l1: "自然风光", l2: zhTag(tourism || "景点") }
}

function deriveScores(tags: Record<string, string> = {}, wikiBoost = 0) {
  const richness = Object.keys(tags).length
  const wikipedia = tags.wikipedia || tags["wikipedia:en"] ? 12 : 0
  const popularity = Math.min(99, 62 + Math.min(richness, 18) + wikipedia + wikiBoost)
  const niche = Math.min(99, 55 + Math.max(0, 20 - Math.min(richness, 15)) + (tags.tourism === "attraction" ? 8 : 14))
  return { popularity_score: popularity, niche_score: niche }
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 12000, fetcher: typeof fetch = fetch) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetcher(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/** Prefer same-origin Vite/Worker proxy to bypass browser CORS for allowlisted hosts. */
function proxyUrl(target: string) {
  if (typeof window === "undefined") return target
  return `/api/scrape-proxy?url=${encodeURIComponent(target)}`
}

async function fetchWikipedia(title: string, fetcher: typeof fetch): Promise<WikiSummary | null> {
  if (!title) return null
  try {
    const url = `${WIKI_SUMMARY}${encodeURIComponent(title.replace(/ /g, "_"))}`
    const response = await fetchWithTimeout(proxyUrl(url), { headers: { Accept: "application/json" } }, 10000, fetcher)
    if (!response.ok) return null
    const data = await response.json() as WikiSummary
    if (data.type === "disambiguation" || data.type === "https://mediawiki.org/wiki/HyperSwitch/errors/not_found") return null
    return data
  } catch {
    return null
  }
}

async function scrapeOfficialHtml(pageUrl: string, fetcher: typeof fetch): Promise<{ title?: string; image?: string; description?: string } | null> {
  try {
    const host = new URL(pageUrl).hostname
    if (!isHostAllowlisted(host)) return null
    const response = await fetchWithTimeout(proxyUrl(pageUrl), {
      headers: { Accept: "text/html,application/xhtml+xml" },
    }, 12000, fetcher)
    if (!response.ok) return null
    const html = await response.text()
    const title = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1]
      || html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]
    const image = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1]
      || html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)?.[1]
    const description = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1]
      || html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1]
    return {
      title: title?.replace(/\s+/g, " ").trim(),
      image: image?.trim(),
      description: description?.replace(/\s+/g, " ").trim(),
    }
  } catch {
    return null
  }
}

async function queryOverpass(bbox: MapBoundsWgs84, limit: number, fetcher: typeof fetch): Promise<OverpassElement[]> {
  const { south, west, north, east } = bbox
  const query = `
[out:json][timeout:22];
(
  node["tourism"~"attraction|museum|viewpoint|zoo|theme_park|artwork|gallery"](${south},${west},${north},${east});
  node["historic"~"castle|monument|ruins|archaeological_site|memorial"](${south},${west},${north},${east});
  node["natural"~"peak|volcano|hot_spring|beach|cliff"](${south},${west},${north},${east});
  way["tourism"~"attraction|museum|viewpoint|zoo|theme_park"](${south},${west},${north},${east});
  way["historic"~"castle|monument|ruins|archaeological_site"](${south},${west},${north},${east});
  relation["tourism"="attraction"](${south},${west},${north},${east});
);
out center ${Math.min(Math.max(limit, 12), 40)};
`.trim()

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetchWithTimeout(proxyUrl(endpoint), {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: `data=${encodeURIComponent(query)}`,
      }, 20000, fetcher)
      if (!response.ok) continue
      const payload = await response.json() as { elements?: OverpassElement[] }
      if (payload.elements?.length) return payload.elements
    } catch {
      /* try next endpoint */
    }
  }
  return []
}

function overpassToAttraction(
  element: OverpassElement,
  countryCode: string,
  regionId: string,
  portalUrl: string,
  wiki?: WikiSummary | null,
): Attraction | null {
  const tags = element.tags || {}
  const nameEn = tags["name:en"] || tags.name || tags["name:zh"] || ""
  const nameZh = tags["name:zh"] || tags["name:zh-Hans"] || tags.name || nameEn
  if (!nameEn && !nameZh) return null
  const lat = element.lat ?? element.center?.lat
  const lon = element.lon ?? element.center?.lon
  if (lat == null || lon == null || Number.isNaN(lat) || Number.isNaN(lon)) return null

  const { l1, l2 } = mapCategory(tags)
  const scores = deriveScores(tags, wiki?.thumbnail ? 8 : 0)
  const wikiPage = wiki?.content_urls?.desktop?.page
  const image = wiki?.originalimage?.source || wiki?.thumbnail?.source || DEFAULT_IMAGE
  const wikiTitle = tags.wikipedia?.split(":").slice(1).join(":") || tags["wikipedia:en"] || nameEn

  return {
    id: `osm-${element.type}-${element.id}`,
    country_code: countryCode,
    region_id: regionId,
    name: nameZh,
    name_en: nameEn || nameZh,
    lat_wgs84: lat,
    lng_wgs84: lon,
    category_l1: l1,
    category_l2: l2,
    popularity_score: scores.popularity_score,
    niche_score: scores.niche_score,
    tags: [tags.tourism, tags.historic, tags.natural, tags.leisure].filter(Boolean).slice(0, 4).map(zhTag),
    best_season: "以当地官方公告为准",
    address: [tags["addr:city"], tags["addr:suburb"], tags["addr:street"]].filter(Boolean).join(" · ") || `${countryCode} / ${regionId}`,
    rating: null,
    review_count: null,
    price: "以现场或官方页面为准",
    opening_hours: tags.opening_hours || "以官方公告为准",
    data_source: "OpenStreetMap + Wikipedia 爬虫聚合",
    source_url: wikiPage || tags.website || portalUrl || `https://www.openstreetmap.org/${element.type}/${element.id}`,
    image_url: image,
    score_basis: SCORE_BASIS,
    last_updated: new Date().toISOString(),
    // keep wiki title for enrichment path
    ...(wikiTitle ? {} : {}),
  }
}

/** Offline landmark card — always succeeds when lat/lng known (no network). */
function offlineLandmark(spot: ScrapeTargetSpot, target: RegionScrapeTarget): Attraction {
  const portal = target.officialPortals[0]
  const scores = deriveScores({ tourism: "attraction" }, 0)
  return {
    id: `crawl-${slug(target.countryCode)}-${slug(target.regionId)}-${slug(spot.name_en || spot.name)}`,
    country_code: target.countryCode,
    region_id: target.regionId,
    name: spot.name,
    name_en: spot.name_en,
    lat_wgs84: spot.lat ?? target.focus[0],
    lng_wgs84: spot.lng ?? target.focus[1],
    category_l1: spot.category_l1 || "自然风光",
    category_l2: spot.category_l2 || "景点",
    popularity_score: scores.popularity_score,
    niche_score: scores.niche_score,
    tags: spot.tags || [],
    best_season: "以当地官方公告为准",
    address: `${target.english}`,
    rating: null,
    review_count: null,
    price: "以现场或官方页面为准",
    opening_hours: "以官方公告为准",
    data_source: portal?.label ? `官方旅游局索引 · ${portal.label}` : "地区地标索引",
    source_url: spot.officialUrl || portal?.url || "#",
    image_url: DEFAULT_IMAGE,
    score_basis: SCORE_BASIS,
    last_updated: new Date().toISOString(),
  }
}

async function enrichLandmark(spot: ScrapeTargetSpot, target: RegionScrapeTarget, fetcher: typeof fetch): Promise<Attraction> {
  const base = offlineLandmark(spot, target)
  try {
    const wiki = spot.wiki ? await fetchWikipedia(spot.wiki, fetcher) : null
    const official = spot.officialUrl ? await scrapeOfficialHtml(spot.officialUrl, fetcher) : null
    const portal = target.officialPortals[0]
    // Prefer the curated spot coordinate; only fall back to Wikipedia / region focus
    // (Wikipedia article coordinates can land on an adjacent POI, e.g. a building
    // next to a lake, so we never let them override a known-accurate spot lat/lng).
    const lat = spot.lat ?? wiki?.coordinates?.lat ?? target.focus[0]
    const lng = spot.lng ?? wiki?.coordinates?.lon ?? target.focus[1]
    const scores = deriveScores({ tourism: "attraction", wikipedia: spot.wiki || "" }, wiki ? 10 : 0)
    const image = official?.image || wiki?.originalimage?.source || wiki?.thumbnail?.source || base.image_url
    const sourceUrl = spot.officialUrl || wiki?.content_urls?.desktop?.page || portal?.url || base.source_url
    return {
      ...base,
      lat_wgs84: lat,
      lng_wgs84: lng,
      popularity_score: scores.popularity_score,
      niche_score: scores.niche_score,
      data_source: official?.title
        ? `官方页面爬取 · ${portal?.label || "Tourism Board"}`
        : wiki
          ? "Wikipedia REST 爬取 + 官方旅游局索引"
          : base.data_source,
      source_url: sourceUrl,
      image_url: image,
      last_updated: new Date().toISOString(),
    }
  } catch {
    return base
  }
}

function dedupeAttractions(items: Attraction[]) {
  const seen = new Set<string>()
  const result: Attraction[] = []
  for (const item of items) {
    const key = `${item.name_en.toLowerCase()}|${item.lat_wgs84.toFixed(3)}|${item.lng_wgs84.toFixed(3)}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(item)
  }
  return result
}

async function scrapeRegion(target: RegionScrapeTarget, query: AttractionQuery, fetcher: typeof fetch): Promise<Attraction[]> {
  const bbox = query.bbox || boundsFromFocus(target.focus, target.span)
  const limit = query.limit ?? 30
  const portalUrl = target.officialPortals[0]?.url || ""

  // Offline baseline first — always land POIs even if network fails later
  const offlineBase = target.landmarks.slice(0, 12).map(spot => offlineLandmark(spot, target))

  const landmarkPromise = Promise.all(
    target.landmarks.slice(0, 12).map(spot => enrichLandmark(spot, target, fetcher).catch(() => offlineLandmark(spot, target))),
  )
  const overpassPromise = queryOverpass(bbox, limit, fetcher).catch(() => [] as OverpassElement[])

  const [landmarks, elements] = await Promise.all([landmarkPromise, overpassPromise])

  // Enrich a subset of OSM nodes with Wikipedia when a wikipedia tag exists
  const osmBase = elements
    .map(element => overpassToAttraction(element, target.countryCode, target.regionId, portalUrl))
    .filter((item): item is Attraction => Boolean(item))

  const enrichCount = Math.min(8, osmBase.length)
  const enrichedOsm = await Promise.all(osmBase.slice(0, enrichCount).map(async (item, index) => {
    try {
      const element = elements[index]
      const wikiTag = element?.tags?.["wikipedia:en"] || element?.tags?.wikipedia
      const title = wikiTag?.includes(":") ? wikiTag.split(":").slice(1).join(":") : wikiTag || item.name_en
      const wiki = title ? await fetchWikipedia(title, fetcher) : null
      if (!wiki) return item
      return {
        ...item,
        image_url: wiki.originalimage?.source || wiki.thumbnail?.source || item.image_url,
        source_url: wiki.content_urls?.desktop?.page || item.source_url,
        data_source: "OpenStreetMap + Wikipedia 爬虫聚合",
        // Keep the precise OSM node coordinate; Wikipedia article coordinates can
        // land on an adjacent feature (e.g. a building beside a lake), so we never
        // let them displace an accurate OSM point.
        lat_wgs84: item.lat_wgs84,
        lng_wgs84: item.lng_wgs84,
      }
    } catch {
      return item
    }
  }))

  const restOsm = osmBase.slice(enrichCount)
  let merged = dedupeAttractions([...landmarks, ...enrichedOsm, ...restOsm, ...offlineBase])

  if (query.category && query.category !== "全部") {
    const filtered = merged.filter(item => item.category_l1 === query.category)
    // Keep unfiltered offline baseline if filter would wipe the list
    merged = filtered.length ? filtered : merged
  }

  return merged
    .sort((a, b) => Date.parse(b.last_updated) - Date.parse(a.last_updated) || a.name.localeCompare(b.name, "zh-CN"))
    .slice(0, limit)
}

export function createScrapeAttractionProvider(fetcher: typeof fetch = fetch): AttractionProvider {
  return {
    async query(query: AttractionQuery & { countryCode?: string; regionId?: string }) {
      const target = getRegionScrapeTarget(query.countryCode, query.regionId)
      if (!target) return []

      const cacheKey = `${target.countryCode}:${target.regionId}:${query.category || "全部"}:${query.preference || "popular"}:${query.limit || 30}`
      const cached = memoryCache.get(cacheKey)
      if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.data

      const data = await scrapeRegion(target, query, fetcher)
      if (data.length) memoryCache.set(cacheKey, { at: Date.now(), data })
      return data
    },
  }
}

export function clearScrapeCache() {
  memoryCache.clear()
}
