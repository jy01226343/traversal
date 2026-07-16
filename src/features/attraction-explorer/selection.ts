import type { Attraction, AttractionQuery, AttractionSelectionKind, MapBoundsWgs84, RankedAttraction } from "./types"

function inBounds(item: Attraction, bounds?: MapBoundsWgs84) {
  if (!bounds) return true
  const inLongitude = bounds.west <= bounds.east
    ? item.lng_wgs84 >= bounds.west && item.lng_wgs84 <= bounds.east
    : item.lng_wgs84 >= bounds.west || item.lng_wgs84 <= bounds.east
  return item.lat_wgs84 >= bounds.south && item.lat_wgs84 <= bounds.north && inLongitude
}

function gridCell(item: Attraction, bounds: MapBoundsWgs84) {
  const width = Math.max(0.00001, bounds.east - bounds.west)
  const height = Math.max(0.00001, bounds.north - bounds.south)
  const column = Math.min(2, Math.max(0, Math.floor((item.lng_wgs84 - bounds.west) / width * 3)))
  const row = Math.min(2, Math.max(0, Math.floor((item.lat_wgs84 - bounds.south) / height * 3)))
  return `${row}:${column}`
}

function inferredBounds(items: Attraction[]): MapBoundsWgs84 {
  const latitudes = items.map(item => item.lat_wgs84)
  const longitudes = items.map(item => item.lng_wgs84)
  return {
    north: Math.max(...latitudes) + 0.001,
    south: Math.min(...latitudes) - 0.001,
    east: Math.max(...longitudes) + 0.001,
    west: Math.min(...longitudes) - 0.001,
  }
}

const NICHE_TAG = /小众|秘境|静谧|人少|隐秘|秘藏/i
const DESTINATION_TAG = /世界遗产|地标|标志|必看|代表性/i

/**
 * Classify the presentation label from explicit source metadata only.
 * It deliberately does not derive a recommendation from popularity, niche, rating,
 * or any opaque aggregate score. The label remains stable across map interactions.
 */
function inferKind(item: Attraction): AttractionSelectionKind {
  if (item.tags.some(tag => NICHE_TAG.test(tag))) return "easter-egg"
  if (item.tags.some(tag => DESTINATION_TAG.test(tag)) || item.category_l1 === "超级工程" || item.category_l1 === "网红奇观") return "must"
  return "alternative"
}

function compareByFreshnessThenName(a: RankedAttraction, b: RankedAttraction) {
  const freshness = Date.parse(b.last_updated) - Date.parse(a.last_updated)
  if (Number.isFinite(freshness) && freshness !== 0) return freshness
  return a.name.localeCompare(b.name, "zh-CN") || a.id.localeCompare(b.id)
}

function takeWithGridLimit(
  candidates: RankedAttraction[],
  amount: number,
  bounds: MapBoundsWgs84,
  selectedIds: Set<string>,
  cells: Map<string, number>,
) {
  const result: RankedAttraction[] = []
  for (const item of candidates) {
    if (result.length >= amount || selectedIds.has(item.id)) continue
    const cell = gridCell(item, bounds)
    if ((cells.get(cell) || 0) >= 2) continue
    selectedIds.add(item.id)
    cells.set(cell, (cells.get(cell) || 0) + 1)
    result.push(item)
  }
  return result
}

export function selectAttractions(items: Attraction[], query: AttractionQuery): RankedAttraction[] {
  const category = query.category || "全部"
  const filtered = items.filter(item => inBounds(item, query.bbox) && (category === "全部" || item.category_l1 === category))
  if (!filtered.length) return []
  const bounds = query.bbox && query.bbox.east >= query.bbox.west ? query.bbox : inferredBounds(filtered)
  const preference = query.preference || "popular"

  // Assign intrinsic kind to every item (stable, independent of view state)
  const ranked: RankedAttraction[] = filtered.map(item => ({
    ...item,
    selection_kind: inferKind(item),
    selection_rank: 0,
  }))

  // Preferences reorder transparent presentation groups; no synthetic score is used.
  const groupOrder: AttractionSelectionKind[] = preference === "niche"
    ? ["easter-egg", "alternative", "must"]
    : ["must", "alternative", "easter-egg"]
  const sorted = [...ranked].sort((a, b) => {
    const groupDifference = groupOrder.indexOf(a.selection_kind) - groupOrder.indexOf(b.selection_kind)
    return groupDifference || compareByFreshnessThenName(a, b)
  })

  // Pick top items with spatial distribution (grid limit avoids clustering)
  const selectedIds = new Set<string>()
  const cells = new Map<string, number>()
  const result = takeWithGridLimit(sorted, query.limit || 6, bounds, selectedIds, cells)

  return result.map((item, index) => ({ ...item, selection_rank: index + 1 }))
}
