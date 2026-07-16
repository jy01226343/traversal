import { describe, expect, it } from "vitest"
import { getDestinationSyncState } from "./destination-live"

const now = new Date().toISOString()
const unavailableLayer = { id: "opening" as const, label: "开放状态", status: "unavailable" as const, sourceLabel: "官方公告", updatedAt: null, message: "尚未接入" }

describe("getDestinationSyncState", () => {
  it("keeps partial results visible when only one provider succeeds", () => {
    expect(getDestinationSyncState({ destination: "北海道", syncedAt: now, layers: [{ id: "weather", label: "天气", status: "fresh", sourceLabel: "Open-Meteo", updatedAt: now, message: "晴朗" }, unavailableLayer] }, false)).toBe("partial")
  })

  it("reports in-flight work before evaluating cached layers", () => {
    expect(getDestinationSyncState(null, true)).toBe("syncing")
  })
})
