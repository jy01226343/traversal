import { describe, it, expect } from "vitest"
import { selectAttractions } from "./selection"
import { mergeWithCurated } from "./providers"
import { hasImmersiveScene } from "../immersive-exploration/data/adapters/attraction-adapter"
import type { Attraction, MapBoundsWgs84 } from "./types"

function makeAttraction(overrides: Partial<Attraction> & { id: string }): Attraction {
  return {
    country_code: "MDV",
    region_id: "ari-atolls",
    name: overrides.id,
    name_en: overrides.id,
    lat_wgs84: 3.579,
    lng_wgs84: 72.812,
    category_l1: "自然风光",
    category_l2: "潜水",
    popularity_score: 50,
    niche_score: 50,
    tags: [],
    best_season: "12—04月",
    address: "",
    rating: null,
    review_count: null,
    price: "",
    opening_hours: "",
    data_source: "test",
    source_url: "#",
    image_url: "",
    score_basis: "test",
    last_updated: "2026-07-15T00:00:00+08:00",
    ...overrides,
  }
}

const ARI_BOUNDS: MapBoundsWgs84 = { north: 4.2, south: 3.0, east: 73.4, west: 72.4 }

describe("curated 策展条目保护", () => {
  it("阿里环礁种子+目录混合数据：珊瑚花园永远入选且保留 3D 场景", () => {
    // 复现线上 bug 的数据形态：官方种子（固定时间戳）+ 区域目录（last_updated=now）
    const mixed = mergeWithCurated([], "MDV", "ari-atolls")
    //  sanity：目录条目确实混入，且只有官方种子被打了 curated 标记
    expect(mixed.some(a => a.id.startsWith("catalog-"))).toBe(true)
    const coralGarden = mixed.find(a => a.id === "maldives-coral-garden")
    expect(coralGarden?.curated).toBe(true)
    expect(mixed.filter(a => a.curated).every(a => !a.id.startsWith("catalog-"))).toBe(true)

    const result = selectAttractions(mixed, { bbox: ARI_BOUNDS, zoom: 10, limit: 6 })
    const picked = result.find(item => item.id === "maldives-coral-garden")
    expect(picked).toBeDefined()
    expect(hasImmersiveScene(picked!)).toBe(true)
    // 同区域另一枚种子（玛雅提拉）同样受保护
    expect(result.some(item => item.id === "mv-ari-maya-thila")).toBe(true)
  })

  it("curated 条目不受 3×3 网格每格 2 个限制", () => {
    // 3 个 curated 全部挤在同一格：普通条目单格最多 2 个，curated 必须全入选
    const items = [
      makeAttraction({ id: "curated-1", curated: true }),
      makeAttraction({ id: "curated-2", curated: true, lat_wgs84: 3.58, lng_wgs84: 72.813 }),
      makeAttraction({ id: "curated-3", curated: true, lat_wgs84: 3.581, lng_wgs84: 72.814 }),
    ]
    const result = selectAttractions(items, { bbox: ARI_BOUNDS, zoom: 10, limit: 6 })
    expect(result.map(item => item.id)).toEqual(["curated-1", "curated-2", "curated-3"])
  })

  it("curated 条目先入选并占用 limit 名额，哪怕同格有更新的目录条目", () => {
    // 目录条目 last_updated=now 永远比种子固定时间戳新 → 排序靠前并占满同格名额，
    // 修复前 curated 会被挤出；修复后 pinned 先入选。
    const now = new Date().toISOString()
    const items = [
      makeAttraction({ id: "catalog-fresh-1", last_updated: now }),
      makeAttraction({ id: "catalog-fresh-2", last_updated: now, lat_wgs84: 3.58, lng_wgs84: 72.813 }),
      makeAttraction({ id: "seed-3d-poi", curated: true, lat_wgs84: 3.579, lng_wgs84: 72.812 }),
    ]
    const limited = selectAttractions(items, { bbox: ARI_BOUNDS, zoom: 10, limit: 1 })
    expect(limited.map(item => item.id)).toEqual(["seed-3d-poi"])

    const result = selectAttractions(items, { bbox: ARI_BOUNDS, zoom: 10, limit: 6 })
    expect(result[0].id).toBe("seed-3d-poi")
    expect(result).toHaveLength(3)
  })

  it("普通（非 curated）条目网格限制仍然生效", () => {
    // 5 个普通条目全挤在同一格：最多入选 2 个
    const items = Array.from({ length: 5 }, (_, i) =>
      makeAttraction({ id: `plain-${i}`, last_updated: `2026-07-1${i}T00:00:00+08:00` }),
    )
    const result = selectAttractions(items, { bbox: ARI_BOUNDS, zoom: 10, limit: 10 })
    expect(result.length).toBeLessThanOrEqual(2)
  })

  it("curated 超出 limit 后按普通条目规则处理", () => {
    // limit=2，3 个 curated 同格：前 2 个 pinned 入选，第 3 个回落普通流程（同格已被 pinned 无视网格占用？不占用 cells，故仍可入选 2 个普通名额）
    const items = [
      makeAttraction({ id: "curated-a", curated: true }),
      makeAttraction({ id: "curated-b", curated: true, lat_wgs84: 3.58, lng_wgs84: 72.813 }),
      makeAttraction({ id: "curated-c", curated: true, lat_wgs84: 3.581, lng_wgs84: 72.814 }),
    ]
    const result = selectAttractions(items, { bbox: ARI_BOUNDS, zoom: 10, limit: 2 })
    expect(result).toHaveLength(2)
    expect(result.map(item => item.id)).toEqual(["curated-a", "curated-b"])
  })
})
