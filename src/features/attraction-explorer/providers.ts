import { getOfficialAttractions } from "./official-attractions"
import { getCatalogAttractions } from "./region-catalog"
import { createScrapeAttractionProvider } from "./scraper"
import type { Attraction, AttractionProvider, AttractionQuery } from "./types"

/** Unified durable store — API / scrape / seed / catalog all land here.
 *  Bumped to -v2 after the spot-coordinate accuracy fix so stale v1 caches
 *  (which carried incorrect region-center fallbacks) are ignored. */
const FIXED_STORE = "atlas-attractions-fixed-v2"
const API_STORE = "atlas-attractions-api-v2"
const SCRAPE_STORE = "atlas-attractions-scrape-v2"

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
 * 1. Live API → land fixed
 * 2. Live crawler (OSM/Wiki/official) → land fixed
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

      // 1) Live API
      if (api) {
        try {
          const remote = await api.query(query)
          if (remote?.length) {
            console.info(`[attractions] API hit ${key}: ${remote.length} → saved`)
            return land(key, remote, API_STORE)
          }
          console.warn(`[attractions] API empty for ${key}, trying crawler`)
        } catch (error) {
          console.warn("[attractions] API failed, trying crawler", error)
        }
      }

      // 2) Live crawler
      try {
        const scraped = await scraper.query(query)
        if (scraped?.length) {
          console.info(`[attractions] scrape hit ${key}: ${scraped.length} → saved`)
          return land(key, scraped, SCRAPE_STORE)
        }
        console.warn(`[attractions] scrape empty for ${key}`)
      } catch (error) {
        console.warn("[attractions] crawler failed", error)
      }

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

export { createScrapeAttractionProvider }
