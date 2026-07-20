import { getOfficialAttractions } from "./official-attractions"
import { getCatalogAttractions } from "./region-catalog"
import { createScrapeAttractionProvider } from "./scraper"
import type { Attraction, AttractionProvider, AttractionQuery } from "./types"

/** Unified durable store — API / scrape / seed / catalog all land here.
 *  Bumped to -v3 after the curated-merge fix: stale v2 caches were written by
 *  live-only replacements that dropped curated POIs (e.g. 独库公路), so they
 *  are ignored and the seed/catalog snapshot is re-landed on next refresh. */
const FIXED_STORE = "atlas-attractions-fixed-v3"
const API_STORE = "atlas-attractions-api-v3"
const SCRAPE_STORE = "atlas-attractions-scrape-v3"

function storageKey(countryCode?: string, regionId?: string) {
  return `${countryCode || "ALL"}:${regionId || "ALL"}`
}

function readStore(store: string, key: string): Attraction[] | null {
  try {
    const raw = localStorage.getItem(`${store}:${key}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { data?: Attraction[]; savedAt?: string }
    if (!parsed?.data?.length) return null
    return parsed.data
  } catch {
    return null
  }
}

function writeStore(store: string, key: string, data: Attraction[]) {
  if (!data?.length) return
  try {
    const payload = JSON.stringify({ savedAt: new Date().toISOString(), data, count: data.length })
    localStorage.setItem(`${store}:${key}`, payload)
    // Mirror into unified fixed store so UI always has a durable snapshot
    if (store !== FIXED_STORE) {
      localStorage.setItem(`${FIXED_STORE}:${key}`, payload)
    }
  } catch {
    /* quota / private mode — try smaller payload */
    try {
      localStorage.setItem(`${FIXED_STORE}:${key}`, JSON.stringify({
        savedAt: new Date().toISOString(),
        data: data.slice(0, 24),
        count: data.length,
      }))
    } catch {
      /* ignore */
    }
  }
}

function land(key: string, data: Attraction[], bucket: string) {
  if (!data?.length) return data
  writeStore(bucket, key, data)
  writeStore(FIXED_STORE, key, data)
  return data
}

export function createApiAttractionProvider(baseUrl: string, fetcher: typeof fetch = fetch): AttractionProvider {
  return {
    async query(query) {
      const url = new URL("/v1/attractions", baseUrl.replace(/\/$/, ""))
      if (query.bbox) url.searchParams.set("bbox", `${query.bbox.west},${query.bbox.south},${query.bbox.east},${query.bbox.north}`)
      url.searchParams.set("zoom", String(query.zoom ?? 7))
      if (query.countryCode) url.searchParams.set("country_code", query.countryCode)
      if (query.regionId) url.searchParams.set("region_id", query.regionId)
      if (query.category && query.category !== "全部") url.searchParams.set("category_l1", query.category)
      if (query.preference) url.searchParams.set("preference", query.preference)
      if (query.limit) url.searchParams.set("limit", String(query.limit))
      const response = await fetcher(url, { headers: { Accept: "application/json" } })
      if (!response.ok) throw new Error(`Attraction API returned ${response.status}`)
      const payload = await response.json() as { data: Attraction[] }
      return Array.isArray(payload.data) ? payload.data : []
    },
  }
}

export const officialSeedProvider: AttractionProvider = {
  async query(query: AttractionQuery & { countryCode?: string; regionId?: string }) {
    return getOfficialAttractions(query.countryCode, query.regionId)
  },
}

function envBase() {
  return typeof import.meta !== "undefined"
    ? (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_ATTRACTION_API_BASE || ""
    : ""
}

/**
 * Resolution order (every non-empty result is written to localStorage):
 * 1. Live API → merge with curated seed → land fixed
 * 2. Live crawler (OSM/Wiki/official) → merge with curated seed → land fixed
 * 3. Previously fixed snapshot
 * 4. Official seed catalog → land fixed
 * 5. Region resource catalog (always has POIs) → land fixed
 */
export function createDefaultAttractionProvider(fetcher: typeof fetch = fetch): AttractionProvider {
  const base = envBase()
  const api = base ? createApiAttractionProvider(base, fetcher) : null
  const scraper = createScrapeAttractionProvider(fetcher)

  return {
    async query(query) {
      const key = storageKey(query.countryCode, query.regionId)
      const previousFixed = readStore(FIXED_STORE, key)
        || readStore(API_STORE, key)
        || readStore(SCRAPE_STORE, key)

      // Live stages race in PARALLEL with an overall budget. Previously the API
      // stage was awaited serially before the crawler even started, so a hanging
      // endpoint held the whole pipeline for 30s+. First non-empty source wins;
      // if the budget expires we fall through to durable/seed/catalog instantly.
      const live = await raceLiveProviders(
        [
          api
            ? { label: "API", store: API_STORE, run: () => api.query(query) }
            : null,
          { label: "scrape", store: SCRAPE_STORE, run: () => scraper.query(query) },
        ].filter(Boolean) as LiveStage[],
        LIVE_BUDGET_MS,
      )
      if (live?.items.length) {
        const merged = mergeWithCurated(live.items, query.countryCode, query.regionId)
        console.info(`[attractions] ${live.label} hit ${key}: ${live.items.length} live + ${merged.length - live.items.length} curated → saved`)
        return land(key, merged, live.store)
      }
      console.warn(`[attractions] live unavailable for ${key}, using local fallback`)

      // 3) Durable snapshot from earlier sessions
      if (previousFixed?.length) {
        console.info(`[attractions] fixed cache ${key}: ${previousFixed.length}`)
        return previousFixed
      }

      // 4) Official curated seed
      const seed = await officialSeedProvider.query(query)
      if (seed?.length) {
        console.info(`[attractions] seed ${key}: ${seed.length} → saved`)
        return land(key, seed, FIXED_STORE)
      }

      // 5) Region resource catalog — never empty for known regions
      const catalog = getCatalogAttractions(query.countryCode, query.regionId)
      if (catalog?.length) {
        console.info(`[attractions] catalog ${key}: ${catalog.length} → saved`)
        return land(key, catalog, FIXED_STORE)
      }

      return previousFixed || []
    },
  }
}

interface LiveStage {
  label: string
  store: string
  run: () => Promise<Attraction[] | null | undefined>
}

/**
 * 本地策展数据（官方种子 + 区域资源目录）常驻保护。
 * live 源（OSM/Wiki 等）通常不含这些条目，若直接用 live 结果整体替换，
 * 它们会连同 3D 徽标/CTA 一起从列表与地图上消失（独库公路数据消失 bug）。
 * 这里按 id / 规范化名称求并集：同 id/同名以 live 数据为准；
 * 排序为 官方种子（含 3D POI，置顶）→ live 新数据 → 区域目录补充条目。
 */
export function mergeWithCurated(live: Attraction[], countryCode?: string, regionId?: string): Attraction[] {
  const seed = getOfficialAttractions(countryCode, regionId) || []
  const catalog = getCatalogAttractions(countryCode, regionId) || []
  if (!seed.length && !catalog.length) return live
  const seenIds = new Set(live.map(a => a.id))
  const seenNames = new Set(live.map(a => (a.name || "").trim().toLowerCase()).filter(Boolean))
  const pick = (items: Attraction[]) => items.filter(c => {
    if (seenIds.has(c.id)) return false
    const name = (c.name || "").trim().toLowerCase()
    if (name && seenNames.has(name)) return false
    seenIds.add(c.id)
    if (name) seenNames.add(name)
    return true
  })
  const keptSeed = pick(seed)
  const keptCatalog = pick(catalog)
  return keptSeed.length || keptCatalog.length ? [...keptSeed, ...live, ...keptCatalog] : live
}

/** 实时管线整体预算：超出即回退本地数据（UI 已用 peekLocalAttractions 秒出）。 */
const LIVE_BUDGET_MS = 15000

/**
 * 并行竞速：首个非空结果胜出；全部为空/失败/超预算 → null。
 * 胜出的 promise 决定落库 bucket；未完成的请求放任后台结束（fetcher 自带超时兜底）。
 */
function raceLiveProviders(stages: LiveStage[], budgetMs: number): Promise<{ label: string; store: string; items: Attraction[] } | null> {
  return new Promise(resolve => {
    if (!stages.length) return resolve(null)
    let settled = false
    let pending = stages.length
    const finish = (value: { label: string; store: string; items: Attraction[] } | null) => {
      if (settled) return
      settled = true
      resolve(value)
    }
    const timer = setTimeout(() => finish(null), budgetMs)
    const clear = (value: { label: string; store: string; items: Attraction[] } | null) => {
      clearTimeout(timer)
      finish(value)
    }
    for (const stage of stages) {
      stage
        .run()
        .then(items => {
          if (items?.length) return clear({ label: stage.label, store: stage.store, items })
          if (--pending === 0) clear(null)
        })
        .catch(() => {
          if (--pending === 0) clear(null)
        })
    }
  })
}

export async function resolveAttractions(countryCode?: string, regionId?: string, options: Partial<AttractionQuery> = {}) {
  const provider = createDefaultAttractionProvider()
  const key = storageKey(countryCode, regionId)

  // Instant paint from fixed store while live path runs
  const cached = typeof localStorage !== "undefined"
    ? (readStore(FIXED_STORE, key) || readStore(API_STORE, key) || readStore(SCRAPE_STORE, key))
    : null

  const live = await provider.query({
    zoom: options.zoom ?? 7.4,
    category: options.category ?? "全部",
    preference: options.preference ?? "popular",
    limit: options.limit ?? 50,
    bbox: options.bbox,
    countryCode,
    regionId,
  })

  if (live?.length) return live
  if (cached?.length) return cached

  // Absolute last resort: build catalog even if provider path failed
  const catalog = getCatalogAttractions(countryCode, regionId)
  if (catalog.length) {
    land(key, catalog, FIXED_STORE)
    return catalog
  }

  return []
}

export function peekFixedAttractions(countryCode?: string, regionId?: string) {
  const key = storageKey(countryCode, regionId)
  return readStore(FIXED_STORE, key) || readStore(API_STORE, key) || readStore(SCRAPE_STORE, key) || []
}

/**
 * 同步本地快照：持久缓存 → 官方种子 → 区域资源目录。
 * 供 UI 在进入区域的第一帧即刻绘制景点列表（实时管线随后后台刷新替换），
 * 避免弱网/数据源不可达时面板长时间空等。
 */
export function peekLocalAttractions(countryCode?: string, regionId?: string): Attraction[] {
  const key = storageKey(countryCode, regionId)
  const cached = readStore(FIXED_STORE, key) || readStore(API_STORE, key) || readStore(SCRAPE_STORE, key)
  if (cached?.length) return cached
  // 种子 + 区域目录并集，首帧即给出完整本地数据
  return mergeWithCurated([], countryCode, regionId)
}

export { createScrapeAttractionProvider }
