export type AttractionCategoryL1 = "自然风光" | "人文历史" | "户外极限" | "超级工程" | "网红奇观" | "休闲露营"
export type AttractionPreference = "popular" | "niche"
export type AttractionSelectionKind = "must" | "alternative" | "easter-egg"

export interface Attraction {
  id: string
  country_code: string
  region_id: string
  name: string
  name_en: string
  lat_wgs84: number
  lng_wgs84: number
  category_l1: AttractionCategoryL1
  category_l2: string
  popularity_score: number
  niche_score: number
  tags: string[]
  best_season: string
  address: string
  rating: number | null
  review_count: number | null
  price: string
  opening_hours: string
  data_source: string
  source_url: string
  image_url: string
  score_basis: string
  last_updated: string
}

export interface MapBoundsWgs84 {
  north: number
  south: number
  east: number
  west: number
}

export interface RankedAttraction extends Attraction {
  selection_kind: AttractionSelectionKind
  selection_rank: number
}

export interface AttractionQuery {
  bbox?: MapBoundsWgs84
  zoom: number
  category?: AttractionCategoryL1 | "全部"
  preference?: AttractionPreference
  limit?: number
}

export interface AttractionProvider {
  query(query: AttractionQuery & { countryCode?: string; regionId?: string }): Promise<Attraction[]>
}

export interface AttractionMapView {
  zoom: number
  bounds?: MapBoundsWgs84
}
