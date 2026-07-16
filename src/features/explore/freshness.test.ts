import { describe, expect, it } from "vitest"
import { freshnessFromUpdatedAt, getFreshnessLabel } from "./freshness"

describe("freshness", () => {
  it("keeps unavailable data explicit", () => {
    expect(freshnessFromUpdatedAt(null)).toBe("unavailable")
    expect(getFreshnessLabel("stale")).toBe("数据可能已变化")
  })

  it("marks old cache stale", () => {
    expect(freshnessFromUpdatedAt("2026-07-16T00:00:00.000Z", 60_000, Date.parse("2026-07-16T00:02:00.000Z"))).toBe("stale")
  })
})
