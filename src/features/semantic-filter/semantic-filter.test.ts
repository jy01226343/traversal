import { describe, expect, it } from "vitest"
import { canApplySemanticFilters, unavailableSemanticFilterProvider } from "./semantic-filter"

describe("semantic filter safety", () => {
  it("does not apply low-confidence interpretations", () => {
    expect(canApplySemanticFilters({ filters: { month: 7 }, confidence: 0.79, unsupportedTerms: [] })).toBe(false)
  })
  it("keeps manual filtering available when no provider is configured", async () => {
    await expect(unavailableSemanticFilterProvider.parse("带孩子看花", { locale: "zh-CN", availableFilterSchema: {} })).rejects.toThrow("尚未配置")
  })
})
