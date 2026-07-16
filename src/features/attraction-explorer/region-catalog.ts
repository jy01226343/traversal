/**
 * Always-on region attraction catalog built from destination resource spots.
 * Used when API/scrape return empty so the map never shows zero POIs.
 */
import { getRegionResourceSpots, REGIONS_BY_COUNTRY, type DestinationRegion } from "@/data/destinations"
import type { Attraction, AttractionCategoryL1 } from "./types"

const CATEGORY_FROM_RESOURCE: Record<string, { l1: AttractionCategoryL1; l2: string }> = {
  滑雪: { l1: "户外极限", l2: "滑雪" },
  徒步: { l1: "户外极限", l2: "徒步" },
  潜水: { l1: "自然风光", l2: "潜水" },
  海岛: { l1: "自然风光", l2: "海岛" },
  海岸: { l1: "自然风光", l2: "海岸" },
  温泉: { l1: "休闲露营", l2: "温泉" },
  自驾: { l1: "户外极限", l2: "自驾" },
  摄影: { l1: "网红奇观", l2: "摄影" },
  文化: { l1: "人文历史", l2: "文化" },
  美食: { l1: "人文历史", l2: "美食" },
  城市: { l1: "人文历史", l2: "城市" },
  亲子: { l1: "休闲露营", l2: "亲子" },
  骑行: { l1: "户外极限", l2: "骑行" },
  露营: { l1: "休闲露营", l2: "露营" },
  冲浪: { l1: "户外极限", l2: "冲浪" },
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)
}

function mapCategory(resourceType: string) {
  return CATEGORY_FROM_RESOURCE[resourceType] || { l1: "自然风光" as AttractionCategoryL1, l2: resourceType || "景点" }
}

/** Build offline attractions from a destination region definition (resources + spot coordinates). */
export function buildAttractionsFromRegion(countryCode: string, region: DestinationRegion): Attraction[] {
  const now = new Date().toISOString()
  const seen = new Set<string>()
  const items: Attraction[] = []

  region.resources.forEach((resource, resourceIndex) => {
    const spots = getRegionResourceSpots(region, resource.type)
    spots.forEach((spot, spotIndex) => {
      const key = `${spot.name}|${spot.focus[0].toFixed(3)}|${spot.focus[1].toFixed(3)}`
      if (seen.has(key)) return
      seen.add(key)
      const cat = mapCategory(resource.type)
      const heat = Math.min(99, Math.max(70, resource.score - resourceIndex * 2 - spotIndex))
      items.push({
        id: `catalog-${slug(countryCode)}-${slug(region.id)}-${slug(spot.name)}-${resourceIndex}${spotIndex}`,
        country_code: countryCode,
        region_id: region.id,
        name: spot.name,
        name_en: spot.name,
        lat_wgs84: spot.focus[0],
        lng_wgs84: spot.focus[1],
        category_l1: cat.l1,
        category_l2: cat.l2,
        popularity_score: heat,
        niche_score: Math.min(99, 100 - Math.floor(heat * 0.35) + spotIndex * 3),
        tags: [resource.type, region.name].filter(Boolean),
        best_season: "以当地官方公告为准",
        address: `${region.name} · ${region.english}`,
        rating: null,
        review_count: null,
        price: "以现场或官方页面为准",
        opening_hours: "以官方公告为准",
        data_source: spot.imageSource || "OUR ATLAS · 地区资源目录",
        source_url: spot.sourceUrl || "#",
        image_url: spot.image,
        score_basis: "地区资源热度与目录位置的派生分；非 OTA 评分",
        last_updated: now,
      })
    })
  })

  // Guarantee at least one anchor at region center
  if (!items.length) {
    items.push({
      id: `catalog-${slug(countryCode)}-${slug(region.id)}-center`,
      country_code: countryCode,
      region_id: region.id,
      name: region.name,
      name_en: region.english,
      lat_wgs84: region.focus[0],
      lng_wgs84: region.focus[1],
      category_l1: "自然风光",
      category_l2: "地区中心",
      popularity_score: Math.min(99, region.heat || 80),
      niche_score: 85,
      tags: [region.summary.slice(0, 12)],
      best_season: "以当地官方公告为准",
      address: region.english,
      rating: null,
      review_count: null,
      price: "以现场或官方页面为准",
      opening_hours: "以官方公告为准",
      data_source: "OUR ATLAS · 地区中心锚点",
      source_url: "#",
      image_url: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=900&q=80",
      score_basis: "地区中心占位锚点",
      last_updated: now,
    })
  }

  return items.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"))
}

export function getCatalogAttractions(countryCode?: string, regionId?: string): Attraction[] {
  if (!countryCode || !regionId) return []
  const region = (REGIONS_BY_COUNTRY[countryCode] || []).find(item => item.id === regionId)
  if (!region) return []
  return buildAttractionsFromRegion(countryCode, region)
}
