import { describe, it, expect } from "vitest"
import { selectAttractions } from "./selection"
import type { Attraction, AttractionQuery, MapBoundsWgs84 } from "./types"

function makeAttraction(overrides: Partial<Attraction> & { id: string }): Attraction {
  return {
    country_code: "JPN",
    region_id: "hokkaido",
    name: overrides.id,
    name_en: overrides.id,
    lat_wgs84: 43.06,
    lng_wgs84: 141.35,
    category_l1: "自然风光",
    category_l2: "山",
    popularity_score: 50,
    niche_score: 50,
    tags: [],
    best_season: "夏",
    address: "",
    rating: null,
    review_count: null,
    price: "",
    opening_hours: "",
    data_source: "seed",
    source_url: "#",
    image_url: "",
    score_basis: "test",
    last_updated: "2026-07-15",
    ...overrides,
  }
}

const BOUNDS: MapBoundsWgs84 = { north: 44, south: 42, east: 142, west: 141 }

describe("selectAttractions", () => {
  it("空输入返回空数组", () => {
    expect(selectAttractions([], { zoom: 8 })).toEqual([])
  })

  it("bbox 过滤：超出范围的点被排除", () => {
    const items = [
      makeAttraction({ id: "in", lat_wgs84: 43, lng_wgs84: 141.5 }),
      makeAttraction({ id: "out", lat_wgs84: 50, lng_wgs84: 150 }),
    ]
    const result = selectAttractions(items, { bbox: BOUNDS, zoom: 8, limit: 10 })
    expect(result.map(r => r.id)).toEqual(["in"])
  })

  it("bbox 跨日界线（west > east）：经度环绕判定", () => {
    // 跨 180° 经线：west=179, east=-179
    const antimeridian: MapBoundsWgs84 = { north: 30, south: 10, east: -179, west: 179 }
    const items = [
      makeAttraction({ id: "cross", lat_wgs84: 20, lng_wgs84: 179.5 }),
      makeAttraction({ id: "other", lat_wgs84: 20, lng_wgs84: 0 }),
    ]
    const result = selectAttractions(items, { bbox: antimeridian, zoom: 8, limit: 10 })
    expect(result.map(r => r.id)).toEqual(["cross"])
  })

  it("category 过滤：仅返回匹配类别", () => {
    const items = [
      makeAttraction({ id: "nat", category_l1: "自然风光" }),
      makeAttraction({ id: "his", category_l1: "人文历史" }),
    ]
    const result = selectAttractions(items, { bbox: BOUNDS, zoom: 8, category: "自然风光", limit: 10 })
    expect(result.map(r => r.id)).toEqual(["nat"])
  })

  it("category '全部' 不过滤类别", () => {
    const items = [
      makeAttraction({ id: "nat", category_l1: "自然风光" }),
      makeAttraction({ id: "his", category_l1: "人文历史" }),
    ]
    const result = selectAttractions(items, { bbox: BOUNDS, zoom: 8, category: "全部", limit: 10 })
    expect(result).toHaveLength(2)
  })

  it("popular 偏好：主选 4 个按 popularity_score 排序", () => {
    const items = [
      makeAttraction({ id: "a", popularity_score: 90, niche_score: 10 }),
      makeAttraction({ id: "b", popularity_score: 80, niche_score: 10 }),
      makeAttraction({ id: "c", popularity_score: 70, niche_score: 10 }),
      makeAttraction({ id: "d", popularity_score: 60, niche_score: 10 }),
      makeAttraction({ id: "e", popularity_score: 50, niche_score: 10 }),
    ]
    const result = selectAttractions(items, { bbox: BOUNDS, zoom: 8, preference: "popular", limit: 10 })
    // 5 个点散布在 3x3 网格，主选最多 4 + 次选 2 = 最多 6，但只有 5 个
    expect(result.length).toBeLessThanOrEqual(6)
    expect(result[0].selection_kind).toBe("must")
    // rank 从 1 开始递增
    expect(result[0].selection_rank).toBe(1)
  })

  it("zoom >= 12 时加入彩蛋；zoom < 12 无彩蛋", () => {
    // 12 个点分散到 3x3 网格的不同格，确保主选/次选/彩蛋都有候选
    const items = Array.from({ length: 12 }, (_, i) => {
      const row = Math.floor(i / 4)
      const col = i % 4 >= 3 ? 2 : i % 4
      return makeAttraction({
        id: `e${i}`,
        popularity_score: 50 + i,
        niche_score: 5 + i,
        lat_wgs84: 42.2 + row * 0.3,
        lng_wgs84: 141.2 + col * 0.3,
      })
    })
    const noEgg = selectAttractions(items, { bbox: BOUNDS, zoom: 10, limit: 20 })
    const withEgg = selectAttractions(items, { bbox: BOUNDS, zoom: 15, limit: 20 })
    const eggKinds = withEgg.filter(r => r.selection_kind === "easter-egg")
    expect(noEgg.some(r => r.selection_kind === "easter-egg")).toBe(false)
    expect(eggKinds.length).toBeGreaterThan(0)
    expect(eggKinds.length).toBeLessThanOrEqual(4)
  })

  it("limit 截断结果数量", () => {
    // 6 个点分散到不同网格，确保能选出至少 3 个（不受单格 2 限制）
    const items = Array.from({ length: 6 }, (_, i) =>
      makeAttraction({
        id: `n${i}`,
        popularity_score: 100 - i,
        lat_wgs84: 42.2 + (i % 3) * 0.4,
        lng_wgs84: 141.2 + Math.floor(i / 3) * 0.4 + (i % 2) * 0.2,
      }),
    )
    const result = selectAttractions(items, { bbox: BOUNDS, zoom: 8, limit: 3 })
    expect(result).toHaveLength(3)
    expect(result.map(r => r.selection_rank)).toEqual([1, 2, 3])
  })

  it("3x3 网格每格最多 2 个（防止扎堆）", () => {
    // 9 个点全挤在同一格
    const items = Array.from({ length: 9 }, (_, i) =>
      makeAttraction({ id: `c${i}`, popularity_score: 100 - i, lat_wgs84: 43, lng_wgs84: 141.5 }),
    )
    const result = selectAttractions(items, { bbox: BOUNDS, zoom: 8, limit: 10 })
    // 单格最多 2 个主选 + 2 个次选 = 4（彩蛋 zoom<12 不触发）
    expect(result.length).toBeLessThanOrEqual(4)
  })
})
