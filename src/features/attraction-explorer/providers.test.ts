import { describe, it, expect, beforeEach } from "vitest"
import { peekLocalAttractions, createDefaultAttractionProvider, mergeWithCurated } from "./providers"
import { getOfficialAttractions } from "./official-attractions"
import { getCatalogAttractions } from "./region-catalog"

const FIXED_KEY = "atlas-attractions-fixed-v3:JPN:hokkaido"

function cachedPayload(count: number) {
  return JSON.stringify({
    savedAt: new Date().toISOString(),
    data: getOfficialAttractions("JPN", "hokkaido").slice(0, count),
    count,
  })
}

describe("peekLocalAttractions（同步本地快照）", () => {
  beforeEach(() => localStorage.clear())

  it("优先返回持久缓存", () => {
    localStorage.setItem(FIXED_KEY, cachedPayload(2))
    const items = peekLocalAttractions("JPN", "hokkaido")
    expect(items.length).toBe(2)
  })

  it("无缓存时回退官方种子+区域目录并集（同步非空）", () => {
    const items = peekLocalAttractions("JPN", "hokkaido")
    const seed = getOfficialAttractions("JPN", "hokkaido")
    const catalog = getCatalogAttractions("JPN", "hokkaido")
    expect(items.length).toBeGreaterThan(0)
    expect(items.length).toBeGreaterThanOrEqual(Math.max(seed.length, catalog.length))
  })

  it("未知区域返回空数组而不抛出", () => {
    expect(peekLocalAttractions("XX", "nowhere")).toEqual([])
  })
})

describe("mergeWithCurated（策展条目常驻保护）", () => {
  it("live 结果缺失策展条目时按并集补回（独库公路不再被替换吞掉）", () => {
    const seed = getOfficialAttractions("CHN", "northwest")
    expect(seed.some(a => a.id === "cn-xj-duku")).toBe(true)
    const live = [{ id: "osm-1", name: "那拉提草原" } as never]
    const merged = mergeWithCurated(live, "CHN", "northwest")
    expect(merged.some(a => a.id === "cn-xj-duku")).toBe(true)
    expect(merged.some(a => a.id === "osm-1")).toBe(true)
    // 策展条目置顶
    expect(merged[0].id).toBe(seed[0].id)
  })

  it("同 id 或同名条目以 live 数据为准且不重复", () => {
    const seed = getOfficialAttractions("CHN", "northwest")
    const duku = seed.find(a => a.id === "cn-xj-duku")!
    const live = [{ ...duku, id: "osm-duku", popularity_score: 1 } as never]
    const merged = mergeWithCurated(live, "CHN", "northwest")
    expect(merged.filter(a => (a.name || "").trim() === "独库公路").length).toBe(1)
  })

  it("无策展种子的区域原样返回 live 结果", () => {
    const live = [{ id: "a" } as never, { id: "b" } as never]
    expect(mergeWithCurated(live, "XX", "nowhere")).toEqual(live)
  })
})

describe("createDefaultAttractionProvider（实时竞速与回退）", () => {
  beforeEach(() => localStorage.clear())

  it("实时源全部失败时在预算内回退本地数据（不空等）", async () => {
    const hangingFetch = (() => new Promise<Response>(() => {})) as unknown as typeof fetch
    const provider = createDefaultAttractionProvider(hangingFetch)
    const started = Date.now()
    const items = await provider.query({
      zoom: 7.4,
      category: "全部",
      preference: "popular",
      limit: 30,
      countryCode: "JPN",
      regionId: "hokkaido",
    })
    // 挂起的爬虫端点各有自带超时；结果必须非空（种子/目录兜底）
    expect(items.length).toBeGreaterThan(0)
    expect(Date.now() - started).toBeLessThan(45000)
  }, 50000)
})
