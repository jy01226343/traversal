import { describe, expect, it } from "vitest"
import { canShowFitness, getDestinationPrimaryAction, getDestinationStatusLabel, lifecycleFromProgressState } from "./destination-presentation"

describe("destination presentation", () => {
  it("uses one CTA matrix for every lifecycle", () => {
    expect(getDestinationPrimaryAction("wishlist")).toBe("开始准备")
    expect(getDestinationStatusLabel("completed")).toBe("已到访")
    expect(lifecycleFromProgressState("UNLOCKED")).toBe("ready")
  })

  it("does not display an unverifiable fitness score", () => {
    expect(canShowFitness({ score: 86, calculatedAt: null, isDynamic: true, isExplainable: true })).toBe(false)
    expect(canShowFitness({ score: 86, calculatedAt: "2026-07-16T00:00:00Z", isDynamic: true, isExplainable: true })).toBe(true)
  })
})
