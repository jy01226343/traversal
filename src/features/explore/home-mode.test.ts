import { describe, expect, it } from "vitest"
import { DEFAULT_DEPARTURE_THRESHOLD_HOURS, resolveHomeMode } from "./home-mode"

const now = new Date("2026-07-16T00:00:00.000Z")

describe("resolveHomeMode", () => {
  it("keeps the configured 72-hour default outside the resolver body", () => {
    expect(DEFAULT_DEPARTURE_THRESHOLD_HOURS).toBe(72)
    expect(resolveHomeMode({ isFirstVisit: false, activeJourney: { id: "j1", status: "planning", departureAt: "2026-07-18T23:00:00.000Z" }, now })).toBe("departure_soon")
  })

  it("honours an experiment override and never treats a departed journey as departure soon", () => {
    const journey = { id: "j1", status: "planning", departureAt: "2026-07-18T00:30:00.000Z" } as const
    expect(resolveHomeMode({ isFirstVisit: false, activeJourney: journey, departureThresholdHours: 24, now })).toBe("active_journey")
    expect(resolveHomeMode({ isFirstVisit: true, activeJourney: { ...journey, departureAt: "2026-07-15T00:00:00.000Z" }, now })).toBe("active_journey")
  })

  it("has stable new-user and explore fallbacks", () => {
    expect(resolveHomeMode({ isFirstVisit: true, now })).toBe("new_user")
    expect(resolveHomeMode({ isFirstVisit: false, now })).toBe("explore")
  })
})
