import { describe, expect, it } from "vitest"
import { getCameraBottomPadding, resolveInitialDetent, resolveMobileBackAction, resolveSheetHeight } from "./mobile-state"

describe("mobile explore state", () => {
  it("chooses a semantic initial detent from the entry path", () => {
    expect(resolveInitialDetent({ entry: "region" })).toBe("peek")
    expect(resolveInitialDetent({ entry: "search" })).toBe("browse")
    expect(resolveInitialDetent({ entry: "detail" })).toBe("detail")
  })

  it("keeps the sheet inside the visual viewport with keyboard and safe areas", () => {
    const height = resolveSheetHeight("browse", { viewportWidth: 375, viewportHeight: 800, safeAreaTop: 24, safeAreaBottom: 20, keyboardHeight: 280, fontScale: 1.3, hasStickyCta: true })
    expect(height).toBeGreaterThanOrEqual(286 * 1.3)
    expect(height).toBeLessThanOrEqual(476)
  })

  it("uses a predictable layered back sequence", () => {
    expect(resolveMobileBackAction({ filterOpen: true, detailOpen: false, selectedEntityId: "a", detent: "detail", canNavigateUp: true })).toBe("close_filter")
    expect(resolveMobileBackAction({ filterOpen: false, detailOpen: false, selectedEntityId: "a", detent: "browse", canNavigateUp: true })).toBe("clear_selection")
    expect(resolveMobileBackAction({ filterOpen: false, detailOpen: false, selectedEntityId: null, detent: "browse", canNavigateUp: true })).toBe("collapse_sheet")
  })

  it("reserves enough map space above each sheet", () => {
    expect(getCameraBottomPadding("detail", 600)).toBeGreaterThanOrEqual(600)
  })
})
