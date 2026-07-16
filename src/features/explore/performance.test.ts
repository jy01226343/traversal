import { describe, expect, it } from "vitest"
import { resolveGlobeQuality } from "./performance"

describe("resolveGlobeQuality", () => {
  it("keeps a user's explicit quality choice", () => {
    expect(resolveGlobeQuality("low", 16, 16)).toBe("low")
  })
  it("protects low-resource devices in automatic mode", () => {
    expect(resolveGlobeQuality("auto", 2, 4)).toBe("low")
  })
  it("uses standard quality when capability is mixed or unknown", () => {
    expect(resolveGlobeQuality("auto", 4, 8)).toBe("standard")
    expect(resolveGlobeQuality("auto")).toBe("standard")
  })
})
