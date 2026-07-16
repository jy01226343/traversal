import { describe, expect, it } from "vitest"
import { filterAttractionsByExperiences, toggleExperience } from "./manual-filters"
import type { Attraction } from "./types"

const attraction = (tags: string[]): Attraction => ({
  id: tags.join("-"), country_code: "JPN", region_id: "hokkaido", name: "测试地点", name_en: "Test", lat_wgs84: 1, lng_wgs84: 1,
  category_l1: "自然风光", category_l2: "湖泊", popularity_score: 0, niche_score: 0, tags, best_season: "夏", address: "", rating: null, review_count: null,
  price: "", opening_hours: "", data_source: "test", source_url: "#", image_url: "", score_basis: "", last_updated: "2026-07-16",
})

describe("manual attraction filters", () => {
  it("only returns items that satisfy every selected experience", () => {
    const items = [attraction(["亲子", "摄影"]), attraction(["亲子"])]
    expect(filterAttractionsByExperiences(items, ["亲子", "摄影"])).toHaveLength(1)
  })

  it("toggles selected experiences without duplicates", () => {
    expect(toggleExperience(["徒步"], "摄影")).toEqual(["徒步", "摄影"])
    expect(toggleExperience(["徒步"], "徒步")).toEqual([])
  })
})
