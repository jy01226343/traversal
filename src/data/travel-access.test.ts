import { describe, it, expect } from "vitest"
import {
  resolveTravelAccess,
  isDomesticDestination,
  isVisaFreeDestination,
  isCountryFreeAccess,
  type AccessTier,
} from "@/data/travel-access"

describe("isDomesticDestination", () => {
  it("护照与目的地同国 -> true", () => {
    expect(isDomesticDestination("CHN", "CHN")).toBe(true)
    expect(isDomesticDestination("chn", "CHN")).toBe(true) // 大小写不敏感
  })
  it("不同国 -> false", () => {
    expect(isDomesticDestination("CHN", "JPN")).toBe(false)
  })
  it("无护照 -> false", () => {
    expect(isDomesticDestination("CHN", null)).toBe(false)
    expect(isDomesticDestination("CHN", undefined)).toBe(false)
  })
})

describe("isVisaFreeDestination", () => {
  it("CHN 护照去 THA/IDN/MAR/FJI 免签", () => {
    expect(isVisaFreeDestination("THA", "CHN")).toBe(true)
    expect(isVisaFreeDestination("IDN", "CHN")).toBe(true)
  })
  it("CHN 护照去 USA 不免签", () => {
    expect(isVisaFreeDestination("USA", "CHN")).toBe(false)
  })
  it("JPN 护照免签范围广", () => {
    expect(isVisaFreeDestination("USA", "JPN")).toBe(true)
    expect(isVisaFreeDestination("FRA", "JPN")).toBe(true)
  })
})

describe("resolveTravelAccess", () => {
  it("unlockedKeys 命中 -> already_unlocked", () => {
    const r = resolveTravelAccess({
      destinationCountryCode: "USA",
      destinationKey: "USA:west",
      passportCode: "CHN",
      unlockedKeys: ["USA:west"],
    })
    expect(r.free).toBe(true)
    expect(r.tier).toBe("already_unlocked")
  })

  it("本国 + 需额外通行证（港澳）-> requires_unlock", () => {
    const r = resolveTravelAccess({
      destinationCountryCode: "CHN",
      destinationKey: "CHN:greater-bay-area",
      passportCode: "CHN",
    })
    expect(r.free).toBe(false)
    expect(r.tier).toBe("requires_unlock")
    expect(r.label).toContain("港澳")
  })

  it("本国普通目的地 -> domestic", () => {
    const r = resolveTravelAccess({
      destinationCountryCode: "CHN",
      destinationKey: "CHN:northwest",
      passportCode: "CHN",
    })
    expect(r.free).toBe(true)
    expect(r.tier).toBe("domestic")
  })

  it("免签国 -> visa_free", () => {
    const r = resolveTravelAccess({
      destinationCountryCode: "THA",
      destinationKey: "THA:south-th",
      passportCode: "CHN",
    })
    expect(r.free).toBe(true)
    expect(r.tier).toBe("visa_free")
  })

  it("需签证 -> requires_unlock", () => {
    const r = resolveTravelAccess({
      destinationCountryCode: "USA",
      destinationKey: "USA:west",
      passportCode: "CHN",
    })
    expect(r.free).toBe(false)
    expect(r.tier).toBe("requires_unlock")
  })

  it("无护照 -> requires_unlock（不当作免签）", () => {
    const r = resolveTravelAccess({
      destinationCountryCode: "THA",
      destinationKey: "THA:south-th",
      passportCode: null,
    })
    expect(r.free).toBe(false)
    expect(r.tier).toBe("requires_unlock")
  })

  it("AccessTier 四值穷举", () => {
    const tiers: AccessTier[] = ["domestic", "visa_free", "already_unlocked", "requires_unlock"]
    expect(tiers).toHaveLength(4)
  })
})

describe("isCountryFreeAccess", () => {
  it("本国或免签 -> true", () => {
    expect(isCountryFreeAccess("CHN", "CHN")).toBe(true)
    expect(isCountryFreeAccess("THA", "CHN")).toBe(true)
  })
  it("需签证 -> false", () => {
    expect(isCountryFreeAccess("USA", "CHN")).toBe(false)
  })
})
