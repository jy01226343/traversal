import type { DestinationCountry, DestinationRegion } from "@/data/destinations"
import type { Attraction } from "@/features/attraction-explorer"

export type AtlasSearchKind = "country" | "region" | "poi"

export interface AtlasSearchItem {
  id: string
  kind: AtlasSearchKind
  label: string
  context: string
  continent: string
  country: DestinationCountry
  region?: DestinationRegion
  attraction?: Attraction
}

export function buildAtlasSearchIndex(
  countriesByContinent: Record<string, DestinationCountry[]>,
  getRegions: (country: DestinationCountry) => DestinationRegion[],
  attractions: Attraction[],
) {
  const index: AtlasSearchItem[] = []
  for (const [continent, countries] of Object.entries(countriesByContinent)) {
    for (const country of countries) {
      index.push({ id: `country:${country.code}`, kind: "country", label: country.name, context: `${continent} · 国家`, continent, country })
      for (const region of getRegions(country)) index.push({ id: `region:${country.code}:${region.id}`, kind: "region", label: region.name, context: `${country.name} · ${continent}`, continent, country, region })
    }
  }
  for (const attraction of attractions) {
    const country = Object.values(countriesByContinent).flat().find(item => item.code === attraction.country_code)
    if (!country) continue
    const continent = Object.entries(countriesByContinent).find(([, items]) => items.some(item => item.code === country.code))?.[0] || "世界"
    const region = getRegions(country).find(item => item.id === attraction.region_id)
    index.push({ id: `poi:${attraction.id}`, kind: "poi", label: attraction.name, context: `${country.name}${region ? ` · ${region.name}` : ""}`, continent, country, region, attraction })
  }
  return index
}

export function searchAtlas(index: AtlasSearchItem[], query: string, limit = 12) {
  const normalized = query.trim().toLocaleLowerCase()
  if (!normalized) return []
  return index.filter(item => `${item.label} ${item.context}`.toLocaleLowerCase().includes(normalized)).slice(0, limit)
}

export function dedupeRecentSearches(items: AtlasSearchItem[], next: AtlasSearchItem, limit = 3) {
  return [next, ...items.filter(item => item.id !== next.id)].slice(0, limit)
}
