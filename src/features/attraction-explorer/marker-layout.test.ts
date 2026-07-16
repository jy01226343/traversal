import { describe, expect, it } from "vitest"
import { resolveMarkerPresentations } from "./marker-layout"

describe("resolveMarkerPresentations", () => {
  it("keeps the selected marker expanded and compacts a collision peer", () => {
    const output = resolveMarkerPresentations([{ id: "a", x: 0, y: 0, priority: 1, selected: true }, { id: "b", x: 20, y: 20, priority: 9 }])
    expect(output.get("a")).toBe("selected")
    expect(output.get("b")).toBe("compact")
  })
  it("uses priority to retain one readable label in a dense zone", () => {
    const output = resolveMarkerPresentations([{ id: "a", x: 0, y: 0, priority: 1 }, { id: "b", x: 25, y: 0, priority: 9 }])
    expect(output.get("b")).toBe("label")
    expect(output.get("a")).toBe("compact")
  })
})
