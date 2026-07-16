import type { JourneySummary } from "./home-mode"

export interface HomeContext {
  isFirstVisit: boolean
  departureThresholdHours: number
  activeJourney: (JourneySummary & {
    name: string
    destinationLabel?: string | null
    preparedness: number
    pendingItemCount: number
  }) | null
}

export async function fetchHomeContext(signal?: AbortSignal): Promise<HomeContext> {
  const response = await fetch("/api/v1/home/context", { signal, headers: { accept: "application/json" } })
  if (!response.ok) throw new Error(`Home context unavailable (${response.status})`)
  return response.json() as Promise<HomeContext>
}

export async function saveFirstVisit(signal?: AbortSignal): Promise<HomeContext> {
  const response = await fetch("/api/v1/home/preference", {
    method: "PUT",
    signal,
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ isFirstVisit: false }),
  })
  if (!response.ok) throw new Error(`Home preference unavailable (${response.status})`)
  return response.json() as Promise<HomeContext>
}

export interface CreateJourneyInput {
  name: string
  destinationLabel?: string
  departureAt?: string
}

export interface UpdateJourneyInput {
  name?: string
  status?: "draft" | "planning" | "preparing" | "ready" | "ongoing" | "completed" | "archived"
  destinationLabel?: string | null
  departureAt?: string | null
  preparedness?: number
  pendingItemCount?: number
}

export interface JourneyStop { id: string; attractionId: string | null; label: string; latitude: number; longitude: number; order: number }

export async function createJourney(input: CreateJourneyInput, signal?: AbortSignal) {
  const response = await fetch("/api/v1/journeys", {
    method: "POST",
    signal,
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(input),
  })
  if (!response.ok) throw new Error(`Unable to create Journey (${response.status})`)
  return response.json()
}

export async function updateJourney(id: string, input: UpdateJourneyInput, signal?: AbortSignal) {
  const response = await fetch(`/api/v1/journeys/${encodeURIComponent(id)}`, {
    method: "PATCH",
    signal,
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(input),
  })
  if (!response.ok) throw new Error(`Unable to update Journey (${response.status})`)
  return response.json()
}

export async function fetchJourneyStops(id: string, signal?: AbortSignal): Promise<JourneyStop[]> {
  const response = await fetch(`/api/v1/journeys/${encodeURIComponent(id)}/stops`, { signal, headers: { accept: "application/json" } })
  if (!response.ok) throw new Error(`Journey stops unavailable (${response.status})`)
  const payload = await response.json() as { stops: JourneyStop[] }
  return payload.stops
}

export async function createJourneyStop(id: string, input: Omit<JourneyStop, "id" | "order">, signal?: AbortSignal) {
  const response = await fetch(`/api/v1/journeys/${encodeURIComponent(id)}/stops`, { method: "POST", signal, headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify(input) })
  if (!response.ok) throw new Error(`Unable to add destination to Journey (${response.status})`)
  return response.json() as Promise<JourneyStop>
}
