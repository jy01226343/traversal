import { describe, it, expect } from "vitest"
import { getUnlockProfile } from "@/data/unlock-destinations"
import { SEASONAL_RECOMMENDATIONS } from "@/data/seasonal-recommendations"
import type { SeasonalRecommendation } from "@/data/seasonal-recommendations"

function makeDest(overrides: Partial<SeasonalRecommendation> = {}): SeasonalRecommendation {
  return {
    id: "hokkaido-summer",
    months: [6, 7, 8],
    continent: "亚洲",
    countryCode: "JPN",
    regionId: "hokkaido",
    title: "北海道 · 花田盛夏",
    location: "日本 / 富良野与美瑛",
    theme: "花田",
    reason: "测试",
    image: "",
    score: 99,
    priority: 10,
    grade: "S",
    sourceLabel: "test",
    sourceUrl: "#",
    verifiedAt: "2026-07-15",
    bestSeasonLabel: "06-08 月",
    difficulty: 2,
    destinationType: "花田",
    ...overrides,
  }
}

describe("getUnlockProfile", () => {
  it("命中已收录的 profile（北海道）", () => {
    const profile = getUnlockProfile(makeDest())
    expect(profile.key).toBe("JPN:hokkaido")
    expect(profile.name).not.toBe("")
    expect(profile.tasks.length).toBeGreaterThan(0)
    // 命中的 profile 任务应有真实来源（非占位 #）
    expect(profile.tasks[0].sourceUrl).not.toBe("#")
  })

  it("未命中时返回通用 fallback 模板", () => {
    // 用一个未收录在 profiles 里的目的地（南极区域不在 15 档内）
    const profile = getUnlockProfile(
      makeDest({
        countryCode: "EGY",
        regionId: "nonexistent-region",
        id: "egy-fake",
        title: "某地 · 子标题",
        location: "EGY",
        continent: "非洲",
      }),
    )
    expect(profile.key).toBe("EGY:nonexistent-region")
    // fallback 恒为 4 任务
    expect(profile.tasks).toHaveLength(4)
    // fallback 任务带占位 sourceUrl
    expect(profile.tasks.every(t => t.sourceUrl === "#")).toBe(true)
  })

  it("所有已收录 profile 的 key 与 SEASONAL_RECOMMENDATIONS 一致", () => {
    // 抽样：每个季节推荐都能解析出 profile，不抛异常
    for (const item of SEASONAL_RECOMMENDATIONS) {
      const profile = getUnlockProfile(item)
      expect(profile.key).toMatch(/^[A-Z]{3}:[a-z0-9-]+$/)
      expect(profile.tasks.length).toBeGreaterThanOrEqual(4)
    }
  })

  it("fallback 的 name 取 title 的首段（· 分割）", () => {
    const profile = getUnlockProfile(
      makeDest({
        title: "某地 · 子标题",
        countryCode: "EGY",
        regionId: "another-fake",
        location: "FR",
      }),
    )
    expect(profile.name).toBe("某地")
  })
})
