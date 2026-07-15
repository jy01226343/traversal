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

function takeWithGridLimit(
  candidates: Attraction[],
  amount: number,
  kind: AttractionSelectionKind,
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
    result.push({ ...item, selection_kind: kind, selection_rank: 0 })
  }
  return result
}

export function selectAttractions(items: Attraction[], query: AttractionQuery): RankedAttraction[] {
  const category = query.category || "全部"
  const filtered = items.filter(item => inBounds(item, query.bbox) && (category === "全部" || item.category_l1 === category))
  if (!filtered.length) return []
  const bounds = query.bbox && query.bbox.east >= query.bbox.west ? query.bbox : inferredBounds(filtered)
  const preference = query.preference || "popular"
  const primaryKey = preference === "popular" ? "popularity_score" : "niche_score"
  const secondaryKey = preference === "popular" ? "niche_score" : "popularity_score"
  const primaryKind: AttractionSelectionKind = preference === "popular" ? "must" : "alternative"
  const secondaryKind: AttractionSelectionKind = preference === "popular" ? "alternative" : "must"
  const selectedIds = new Set<string>()
  const cells = new Map<string, number>()
  const primary = [...filtered].sort((a, b) => b[primaryKey] - a[primaryKey])
  const secondary = [...filtered].sort((a, b) => b[secondaryKey] - a[secondaryKey])
  const result = [
    ...takeWithGridLimit(primary, 4, primaryKind, bounds, selectedIds, cells),
    ...takeWithGridLimit(secondary, 2, secondaryKind, bounds, selectedIds, cells),
  ]
  const easterEggAmount = query.zoom >= 15 ? 4 : query.zoom >= 12 ? 2 : 0
  if (easterEggAmount) {
    const easterEggs = [...filtered].sort((a, b) => (b.niche_score - b.popularity_score) - (a.niche_score - a.popularity_score))
    result.push(...takeWithGridLimit(easterEggs, easterEggAmount, "easter-egg", bounds, selectedIds, cells))
  }
  return result.slice(0, query.limit || 10).map((item, index) => ({ ...item, selection_rank: index + 1 }))
}
