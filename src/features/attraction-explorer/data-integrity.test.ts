/**
 * 景点数据完整性 / 防污染回归测试。
 *
 * 背景 bug：独库公路等官方策展 POI 在实时管线刷新时被 live 结果整体替换，
 * 从列表与地图上消失。此测试把"检测所有被污染的数据"固化为 CI 级检查：
 * 1. 种子数据自身无重复 / 无非法坐标 / 区域引用有效；
 * 2. 所有 3D 沉浸场景 POI 在种子中存在且场景注册表可解析；
 * 3. 对每个有种子数据的区域模拟 live 污染，断言策展条目 100% 存活。
 */
import { describe, it, expect } from "vitest"
import { OFFICIAL_ATTRACTIONS, getOfficialAttractions } from "./official-attractions"
import { getCatalogAttractions } from "./region-catalog"
import { mergeWithCurated } from "./providers"
import { REGIONS_BY_COUNTRY } from "@/data/destinations"
import { hasImmersiveScene } from "@/features/immersive-exploration/data/adapters/attraction-adapter"
import type { Attraction } from "./types"

const IMMERSIVE_POI_IDS = [
  "mount-fuji",
  "jp-hkd-lake-toya",
  "maldives-coral-garden",
  "ke-mara",
  "tz-serengeti",
  "jp-kt-tokyo-skytree",
  "cn-xj-duku",
]

describe("官方种子数据完整性", () => {
  it("无重复 id", () => {
    const seen = new Map<string, number>()
    for (const a of OFFICIAL_ATTRACTIONS) seen.set(a.id, (seen.get(a.id) || 0) + 1)
    const dup = [...seen.entries()].filter(([, n]) => n > 1)
    expect(dup).toEqual([])
  })

  it("同一区域内无重复名称", () => {
    const key = (a: Attraction) => `${a.country_code}:${a.region_id}:${(a.name || "").trim().toLowerCase()}`
    const seen = new Map<string, number>()
    for (const a of OFFICIAL_ATTRACTIONS) seen.set(key(a), (seen.get(key(a)) || 0) + 1)
    const dup = [...seen.entries()].filter(([, n]) => n > 1)
    expect(dup).toEqual([])
  })

  it("坐标全部在合法范围内", () => {
    const bad = OFFICIAL_ATTRACTIONS.filter(a =>
      !Number.isFinite(a.lat_wgs84) || !Number.isFinite(a.lng_wgs84) ||
      Math.abs(a.lat_wgs84) > 90 || Math.abs(a.lng_wgs84) > 180)
    expect(bad.map(a => a.id)).toEqual([])
  })

  it("种子条目引用的区域在目的地目录中存在", () => {
    const missing = OFFICIAL_ATTRACTIONS.filter(a => {
      const regions = REGIONS_BY_COUNTRY[a.country_code] || []
      return !regions.some(r => r.id === a.region_id)
    })
    expect(missing.map(a => `${a.id} (${a.country_code}:${a.region_id})`)).toEqual([])
  })
})

describe("3D 沉浸场景 POI 完整性", () => {
  it("7 个 3D 场景 POI 全部在种子中且场景可解析", () => {
    for (const id of IMMERSIVE_POI_IDS) {
      const poi = OFFICIAL_ATTRACTIONS.find(a => a.id === id)
      expect(poi, `missing curated POI: ${id}`).toBeTruthy()
      expect(hasImmersiveScene(poi!), `scene not resolvable: ${id}`).toBe(true)
    }
  })
})

describe("live 刷新防污染（全区域扫描）", () => {
  // 收集所有有种子数据的 (country, region) 组合
  const pairs = [...new Set(OFFICIAL_ATTRACTIONS.map(a => `${a.country_code}::${a.region_id}`))]
    .map(k => k.split("::"))

  it.each(pairs.map(([c, r]) => ({ country: c, region: r })))(
    "$country:$region — live 结果缺失策展条目时全部存活",
    ({ country, region }) => {
      const seed = getOfficialAttractions(country, region)
      // 模拟污染源：live 源返回一堆与策展无关的条目
      const live: Attraction[] = [
        { ...seed[0], id: "osm-x1", name: "OSM 实时景点甲" },
        { ...seed[0], id: "osm-x2", name: "OSM 实时景点乙" },
      ]
      const merged = mergeWithCurated(live, country, region)
      const mergedIds = new Set(merged.map(a => a.id))
      const lost = seed.filter(s => !mergedIds.has(s.id))
      expect(lost.map(s => s.id)).toEqual([])
      // live 条目也保留
      expect(mergedIds.has("osm-x1")).toBe(true)
    },
  )

  it.each(pairs.map(([c, r]) => ({ country: c, region: r })))(
    "$country:$region — live 命中同名条目时不产生重复",
    ({ country, region }) => {
      const seed = getOfficialAttractions(country, region)
      const live: Attraction[] = seed.map(s => ({ ...s, id: `live-${s.id}` }))
      const merged = mergeWithCurated(live, country, region)
      const names = merged.map(a => (a.name || "").trim().toLowerCase())
      expect(new Set(names).size).toBe(names.length)
    },
  )

  it("区域目录自身对已知区域恒非空（兜底链不被污染）", () => {
    for (const [country, regions] of Object.entries(REGIONS_BY_COUNTRY)) {
      for (const region of regions) {
        const catalog = getCatalogAttractions(country, region.id)
        expect(catalog.length, `empty catalog: ${country}:${region.id}`).toBeGreaterThan(0)
      }
    }
  })
})
