/**
 * Resolve wishlist-able destination cards from seasonal data or map regions.
 */
import type { DestinationCountry, DestinationRegion } from "./destinations"
import {
  SEASONAL_RECOMMENDATIONS,
  type SeasonalRecommendation,
} from "./seasonal-recommendations"

const REGION_WISH_PREFIX = "region:"

export function isRegionWishId(id: string) {
  return id.startsWith(REGION_WISH_PREFIX)
}

export function regionWishId(countryCode: string, regionId: string) {
  return `${REGION_WISH_PREFIX}${countryCode}:${regionId}`
}

export function findSeasonalByRegion(countryCode: string, regionId: string) {
  return SEASONAL_RECOMMENDATIONS.find(
    item => item.countryCode === countryCode && item.regionId === regionId,
  )
}

/** Build a destination card for a country-map region pin (wishlist / unlock). */
export function destinationFromRegion(
  country: DestinationCountry,
  region: DestinationRegion,
  continent: string,
): SeasonalRecommendation {
  const seasonal = findSeasonalByRegion(country.code, region.id)
  if (seasonal) return seasonal

  const primary = region.resources[0]
  return {
    id: regionWishId(country.code, region.id),
    months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    continent: continent as SeasonalRecommendation["continent"],
    countryCode: country.code,
    regionId: region.id,
    title: `${country.name} · ${region.name}`,
    location: `${country.name} / ${region.english || region.name}`,
    theme: primary ? `${primary.type} · 探索` : "地区 · 探索",
    reason: region.summary || `${region.name} 尚无足迹，加入心愿单后可开始解锁准备。`,
    image: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=900&q=85",
    score: region.heat || 80,
    priority: 5,
    grade: region.heat >= 96 ? "S" : region.heat >= 90 ? "A" : "B",
    sourceLabel: "OUR ATLAS · 地区节点",
    sourceUrl: "#",
    verifiedAt: "2026-07-15",
    bestSeasonLabel: "全年",
    difficulty: 2,
    destinationType: "城市",
  }
}

export function resolveWishlistItem(
  id: string,
  lookup?: {
    findCountry: (code: string) => DestinationCountry | null | undefined
    getRegionsForCountry: (country: DestinationCountry) => DestinationRegion[]
    continentOf?: (country: DestinationCountry) => string
  },
): SeasonalRecommendation | null {
  const seasonal = SEASONAL_RECOMMENDATIONS.find(item => item.id === id)
  if (seasonal) return seasonal
  if (!isRegionWishId(id)) return null
  const raw = id.slice(REGION_WISH_PREFIX.length)
  const [countryCode, regionId] = raw.split(":")
  if (!countryCode || !regionId) return null
  const seasonalMatch = findSeasonalByRegion(countryCode, regionId)
  if (seasonalMatch) return seasonalMatch
  if (lookup?.findCountry) {
    const country = lookup.findCountry(countryCode)
    if (country) {
      const region = lookup.getRegionsForCountry(country).find(item => item.id === regionId)
      if (region) {
        const continent = lookup.continentOf?.(country) || "亚洲"
        return destinationFromRegion(country, region, continent)
      }
    }
  }
  return {
    id,
    months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    continent: "亚洲",
    countryCode,
    regionId,
    title: `${countryCode} · ${regionId}`,
    location: `${countryCode} / ${regionId}`,
    theme: "地区 · 探索",
    reason: "从国家地图节点加入的心愿目的地，可在此开始解锁准备。",
    image: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=900&q=85",
    score: 84,
    priority: 4,
    grade: "B",
    sourceLabel: "OUR ATLAS · 地区节点",
    sourceUrl: "#",
    verifiedAt: "2026-07-15",
    bestSeasonLabel: "全年",
    difficulty: 2,
    destinationType: "城市",
  }
}

/** Normalize wishlist membership for a country map pin */
export function regionKeyFromWishId(id: string): string | null {
  if (isRegionWishId(id)) return id.slice(REGION_WISH_PREFIX.length)
  const seasonal = SEASONAL_RECOMMENDATIONS.find(item => item.id === id)
  return seasonal ? `${seasonal.countryCode}:${seasonal.regionId}` : null
}
