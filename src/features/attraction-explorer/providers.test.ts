import { describe, it, expect, beforeEach } from "vitest"
import { peekLocalAttractions, createDefaultAttractionProvider } from "./providers"
import { getOfficialAttractions } from "./official-attractions"
import { getCatalogAttractions } from "./region-catalog"

const FIXED_KEY = "atlas-attractions-fixed-v2:JPN:hokkaido"

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

  it("无缓存时回退官方种子/区域目录（同步非空）", () => {
    const items = peekLocalAttractions("JPN", "hokkaido")
    const seed = getOfficialAttractions("JPN", "hokkaido")
    const catalog = getCatalogAttractions("JPN", "hokkaido")
    expect(items.length).toBeGreaterThan(0)
    expect(items.length).toBe(Math.max(seed.length, 0) || catalog.length)
  })

  it("未知区域返回空数组而不抛出", () => {
    expect(peekLocalAttractions("XX", "nowhere")).toEqual([])
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
