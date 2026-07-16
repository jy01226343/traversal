export type HomeMode = "new_user" | "explore" | "active_journey" | "departure_soon"

export interface JourneySummary {
  id: string
  status: "planning" | "preparing" | "ready" | "ongoing"
  departureAt?: string | null
}

export interface HomeModeContext {
  isFirstVisit: boolean
  activeJourney?: JourneySummary | null
  departureThresholdHours?: number
  now?: Date
}

export const DEFAULT_DEPARTURE_THRESHOLD_HOURS = 72

/**
 * The homepage always resolves from one source of truth.  The threshold is an
 * input so experiments and different journey types can override the default.
 */
export function resolveHomeMode({
  isFirstVisit,
  activeJourney,
  departureThresholdHours = DEFAULT_DEPARTURE_THRESHOLD_HOURS,
  now = new Date(),
}: HomeModeContext): HomeMode {
  if (activeJourney?.departureAt) {
    const departure = new Date(activeJourney.departureAt)
    const hoursUntilDeparture = (departure.getTime() - now.getTime()) / 3_600_000
    if (Number.isFinite(hoursUntilDeparture) && hoursUntilDeparture >= 0 && hoursUntilDeparture <= departureThresholdHours) {
      return "departure_soon"
    }
  }
  if (activeJourney) return "active_journey"
  return isFirstVisit ? "new_user" : "explore"
}
