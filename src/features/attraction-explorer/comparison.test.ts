import { describe, expect, it } from "vitest"
import { toggleComparedAttraction } from "./comparison"

describe("destination comparison", () => {
  it("supports two to three items and never adds a fourth", () => {
    expect(toggleComparedAttraction(["a", "b"], "c")).toEqual(["a", "b", "c"])
    expect(toggleComparedAttraction(["a", "b", "c"], "d")).toEqual(["a", "b", "c"])
  })
  it("removes an existing comparison item", () => {
    expect(toggleComparedAttraction(["a", "b"], "a")).toEqual(["b"])
  })
})
