import { findCountry, getRegionsForCountry } from "./destinations"
import type { DestinationStatusId } from "./destination-status"
import type { RecommendationGrade, SeasonalRecommendation } from "./seasonal-recommendations"
import { SEASONAL_RECOMMENDATIONS, getDestinationKey } from "./seasonal-recommendations"

export type GlobeLayerId = "recommend" | "footprint" | "dream" | "status"

export type BeaconVisualType = "mountain" | "lake" | "city" | "island" | "route"

export interface DestinationBeacon {
  id: string
  destinationKey: string
  title: string
  location: string
  focus: [number, number]
  grade: RecommendationGrade
  visual: BeaconVisualType
  status: DestinationStatusId
  layers: GlobeLayerId[]
  symbol: string
}

export const GLOBE_LAYERS: Array<{ id: GlobeLayerId; label: string; hint: string }> = [
  { id: "recommend", label: "推荐", hint: "当季/热门目的地" },
  { id: "footprint", label: "足迹", hint: "已点亮地区" },
  { id: "dream", label: "心愿", hint: "收藏未完成" },
  { id: "status", label: "状态", hint: "全量状态着色" },
]

const TYPE_MAP: Record<SeasonalRecommendation["destinationType"], BeaconVisualType> = {
  山峰: "mountain",
  湖泊: "lake",
  城市: "city",
  海岛: "island",
  公路: "route",
  遗址: "city",
  草原: "route",
  沙漠: "route",
  峡湾: "lake",
  花田: "route",
}

const SYMBOL: Record<BeaconVisualType, string> = {
  mountain: "▲",
  lake: "≈",
  city: "◈",
  island: "◌",
  route: "⟡",
}

export function getDestinationFocus(item: Pick<SeasonalRecommendation, "countryCode" | "regionId">): [number, number] {
  const country = findCountry(item.countryCode)
  if (!country) return [20, 0]
  const region = getRegionsForCountry(country).find(entry => entry.id === item.regionId)
  return region?.focus || country.focus
}

export function buildDestinationBeacons(input: {
  seasonalIds: string[]
  unlockedKeys: string[]
  wishlistIds: string[]
  masteredIds: string[]
  resolveStatus: (item: SeasonalRecommendation) => { id: DestinationStatusId }
}): DestinationBeacon[] {
  return SEASONAL_RECOMMENDATIONS.map(item => {
    const key = getDestinationKey(item)
    const status = input.resolveStatus(item).id
    const layers: GlobeLayerId[] = ["status"]
    if (input.seasonalIds.includes(item.id)) layers.push("recommend")
    if (status === "EXPLORED" || status === "DEEP_EXPLORED" || input.unlockedKeys.includes(key)) {
      layers.push("footprint")
    }
    if (input.wishlistIds.includes(item.id) || status === "WISHLIST") layers.push("dream")

    return {
      id: item.id,
      destinationKey: key,
      title: item.title,
      location: item.location,
      focus: getDestinationFocus(item),
      grade: item.grade,
      visual: TYPE_MAP[item.destinationType] || "route",
      status,
      layers,
      symbol: SYMBOL[TYPE_MAP[item.destinationType] || "route"],
    }
  })
}

export function filterBeaconsByLayers(beacons: DestinationBeacon[], active: GlobeLayerId[]) {
  if (!active.length) return []
  const contentLayers = active.filter(layer => layer !== "status")
  // 仅开「状态」层：显示全部节点并用状态着色
  if (!contentLayers.length) return active.includes("status") ? beacons : []
  return beacons.filter(beacon => contentLayers.some(layer => beacon.layers.includes(layer)))
}
