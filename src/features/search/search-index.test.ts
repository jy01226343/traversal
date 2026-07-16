import { describe, expect, it } from "vitest"
import { dedupeRecentSearches, searchAtlas, type AtlasSearchItem } from "./search-index"

const item = (id: string, label: string): AtlasSearchItem => ({ id, kind: "country", label, context: "亚洲 · 国家", continent: "亚洲", country: { code: id, name: label, english: label, focus: [0, 0], score: 0, tagline: "", season: "", visited: false } })

describe("atlas search index", () => {
  it("matches labels and context without creating a lifecycle state", () => {
    expect(searchAtlas([item("JPN", "日本"), item("FRA", "法国")], "亚洲").map(result => result.id)).toEqual(["JPN", "FRA"])
    expect(searchAtlas([item("JPN", "日本")], "本").map(result => result.label)).toEqual(["日本"])
  })

  it("keeps only the latest three user-opened results", () => {
    expect(dedupeRecentSearches([item("A", "甲"), item("B", "乙"), item("C", "丙")], item("B", "乙")).map(result => result.id)).toEqual(["B", "A", "C"])
  })
})
