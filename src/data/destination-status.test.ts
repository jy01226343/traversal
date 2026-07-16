import { describe, it, expect, beforeEach } from "vitest"
import {
  DESTINATION_STATUS,
  resolveDestinationStatus,
  fanStatusFromMeta,
  hasPreparingProgress,
  loadWishlist,
  saveWishlist,
  loadMastered,
  saveMastered,
  toggleId,
} from "@/data/destination-status"
import type { SeasonalRecommendation } from "@/data/seasonal-recommendations"

// 最小可用的 SeasonalRecommendation 测试替身（字段按 interface 补齐）
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

describe("DESTINATION_STATUS", () => {
  it("暴露规格要求的 6 态", () => {
    const ids = Object.keys(DESTINATION_STATUS)
    expect(ids).toEqual(
      expect.arrayContaining([
        "UNEXPLORED",
        "WISHLIST",
        "PREPARING",
        "UNLOCKED",
        "EXPLORED",
        "DEEP_EXPLORED",
      ]),
    )
    expect(ids).toHaveLength(6)
  })

  it("不再包含旧的 LOCKED/RECOMMENDED/VISITED/MASTERED 态", () => {
    const ids = Object.keys(DESTINATION_STATUS)
    expect(ids).not.toContain("LOCKED")
    expect(ids).not.toContain("RECOMMENDED")
    expect(ids).not.toContain("VISITED")
    expect(ids).not.toContain("MASTERED")
  })
})

describe("resolveDestinationStatus", () => {
  const baseInput = (overrides: Partial<Parameters<typeof resolveDestinationStatus>[0]>) => ({
    destination: makeDest(),
    unlockedKeys: [],
    wishlistIds: [],
    masteredIds: [],
    ...overrides,
  })

  it("深度探索优先级最高：masteredIds 命中返回 DEEP_EXPLORED", () => {
    const meta = resolveDestinationStatus(baseInput({ masteredIds: ["hokkaido-summer"] }))
    expect(meta.id).toBe("DEEP_EXPLORED")
  })

  it("masteredIds 也可按 destinationKey 命中", () => {
    const meta = resolveDestinationStatus(baseInput({ masteredIds: ["JPN:hokkaido"] }))
    expect(meta.id).toBe("DEEP_EXPLORED")
  })

  it("本国护照不会自动将目的地标为准备完成", () => {
    const meta = resolveDestinationStatus(
      baseInput({
        destination: makeDest({ countryCode: "CHN", regionId: "northwest" }),
        passportCode: "CHN",
      }),
    )
    expect(meta.id).toBe("UNEXPLORED")
  })

  it("免签条件不会自动将目的地标为准备完成", () => {
    const meta = resolveDestinationStatus(
      baseInput({
        destination: makeDest({ countryCode: "THA", regionId: "south-th", id: "thai-south" }),
        passportCode: "CHN",
      }),
    )
    expect(meta.id).toBe("UNEXPLORED")
  })

  it("用户确认准备完成后 -> UNLOCKED", () => {
    const meta = resolveDestinationStatus(
      baseInput({
        destination: makeDest({ countryCode: "USA", regionId: "west", id: "usa-west" }),
        passportCode: "CHN",
        unlockedKeys: ["USA:west"],
      }),
    )
    expect(meta.id).toBe("UNLOCKED")
  })

  it("有任务进度但未完成 -> PREPARING", () => {
    localStorage.setItem(
      "atlas-unlock-tasks:USA:west",
      JSON.stringify({ a: true, b: false }),
    )
    const meta = resolveDestinationStatus(
      baseInput({
        destination: makeDest({ countryCode: "USA", regionId: "west", id: "usa-west" }),
        passportCode: "CHN",
      }),
    )
    expect(meta.id).toBe("PREPARING")
  })

  it("在心愿单 -> WISHLIST", () => {
    const meta = resolveDestinationStatus(
      baseInput({
        destination: makeDest({ countryCode: "USA", regionId: "west", id: "usa-west" }),
        passportCode: "CHN",
        wishlistIds: ["usa-west"],
      }),
    )
    expect(meta.id).toBe("WISHLIST")
  })

  it("默认未探索 -> UNEXPLORED", () => {
    const meta = resolveDestinationStatus(
      baseInput({
        destination: makeDest({ countryCode: "USA", regionId: "west", id: "usa-west" }),
        passportCode: "CHN",
      }),
    )
    expect(meta.id).toBe("UNEXPLORED")
  })

  it("优先级：DEEP_EXPLORED 压过准备完成", () => {
    const meta = resolveDestinationStatus(
      baseInput({
        destination: makeDest({ countryCode: "THA", regionId: "south-th", id: "thai-south" }),
        passportCode: "CHN",
        masteredIds: ["thai-south"],
        unlockedKeys: ["THA:south-th"],
      }),
    )
    expect(meta.id).toBe("DEEP_EXPLORED")
  })
})

describe("fanStatusFromMeta", () => {
  it("DEEP_EXPLORED -> mastered", () => {
    expect(fanStatusFromMeta(DESTINATION_STATUS.DEEP_EXPLORED)).toBe("mastered")
  })
  it("EXPLORED -> unlocked", () => {
    expect(fanStatusFromMeta(DESTINATION_STATUS.EXPLORED)).toBe("unlocked")
  })
  it("UNLOCKED -> unlocked", () => {
    expect(fanStatusFromMeta(DESTINATION_STATUS.UNLOCKED)).toBe("unlocked")
  })
  it("WISHLIST -> wishlist", () => {
    expect(fanStatusFromMeta(DESTINATION_STATUS.WISHLIST)).toBe("wishlist")
  })
  it("PREPARING -> preparing", () => {
    expect(fanStatusFromMeta(DESTINATION_STATUS.PREPARING)).toBe("preparing")
  })
  it("UNEXPLORED -> locked", () => {
    expect(fanStatusFromMeta(DESTINATION_STATUS.UNEXPLORED)).toBe("locked")
  })
})

describe("hasPreparingProgress", () => {
  beforeEach(() => localStorage.clear())

  it("无任务记录返回 false", () => {
    expect(hasPreparingProgress("USA:west")).toBe(false)
  })
  it("全部未完成返回 false", () => {
    localStorage.setItem("atlas-unlock-tasks:USA:west", JSON.stringify({ a: false, b: false }))
    expect(hasPreparingProgress("USA:west")).toBe(false)
  })
  it("全部完成返回 false", () => {
    localStorage.setItem("atlas-unlock-tasks:USA:west", JSON.stringify({ a: true, b: true }))
    expect(hasPreparingProgress("USA:west")).toBe(false)
  })
  it("部分完成返回 true", () => {
    localStorage.setItem("atlas-unlock-tasks:USA:west", JSON.stringify({ a: true, b: false }))
    expect(hasPreparingProgress("USA:west")).toBe(true)
  })
})

describe("wishlist / mastered localStorage", () => {
  beforeEach(() => localStorage.clear())

  it("save -> load round-trip 且去重", () => {
    saveWishlist(["a", "b", "a"])
    expect(loadWishlist()).toEqual(["a", "b"])
  })

  it("兼容旧 atlas-mastered-v1 key 读取（语义迁移）", () => {
    // 旧数据里存的是 mastered 语义，现在解读为 deep_explored
    localStorage.setItem("atlas-mastered-v1", JSON.stringify(["x", "y"]))
    expect(loadMastered()).toEqual(["x", "y"])
  })

  it("saveMastered round-trip", () => {
    saveMastered(["m1", "m2", "m1"])
    expect(loadMastered()).toEqual(["m1", "m2"])
  })

  it("toggleId 增删", () => {
    expect(toggleId(["a", "b"], "c")).toEqual(["a", "b", "c"])
    expect(toggleId(["a", "b", "c"], "b")).toEqual(["a", "c"])
  })
})
