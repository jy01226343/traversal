import { describe, expect, it } from "vitest"
import { getAttractionMarkerMode } from "./focus-state"

describe("getAttractionMarkerMode", () => {
  it("keeps the selected marker unique and dims its peers", () => {
    expect(getAttractionMarkerMode("a", "a", "b")).toBe("selected")
    expect(getAttractionMarkerMode("b", "a", "b")).toBe("dimmed")
  })

  it("uses hover only when no marker is selected", () => {
    expect(getAttractionMarkerMode("a", null, "a")).toBe("hover")
    expect(getAttractionMarkerMode("b", null, "a")).toBe("default")
  })
})
