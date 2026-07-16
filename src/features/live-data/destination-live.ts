import { freshnessFromUpdatedAt, type DataFreshnessStatus } from "../explore/freshness"

export type DestinationLiveLayerId = "weather" | "opening" | "traffic" | "events" | "risk"

export interface DestinationLiveLayer {
  id: DestinationLiveLayerId
  label: string
  status: DataFreshnessStatus
  sourceLabel: string
  updatedAt: string | null
  message: string
}

export interface DestinationLiveSnapshot {
  destination: string | null
  syncedAt: string | null
  layers: DestinationLiveLayer[]
}

export function getDestinationSyncState(snapshot: DestinationLiveSnapshot | null, syncing: boolean) {
  if (syncing) return "syncing" as const
  if (!snapshot) return "idle" as const
  const freshCount = snapshot.layers.filter(layer => freshnessFromUpdatedAt(layer.updatedAt, 30 * 60_000) === "fresh").length
  if (freshCount === snapshot.layers.length) return "success" as const
  if (freshCount > 0) return "partial" as const
  return "unavailable" as const
}

export async function fetchDestinationLiveData(input: { name: string; lat: number; lng: number }, signal?: AbortSignal): Promise<DestinationLiveSnapshot> {
  const query = new URLSearchParams({ name: input.name, lat: String(input.lat), lng: String(input.lng) })
  const response = await fetch(`/api/v1/destinations/live?${query}`, { signal, headers: { accept: "application/json" } })
  if (!response.ok) throw new Error(`Destination live data unavailable (${response.status})`)
  return response.json() as Promise<DestinationLiveSnapshot>
}
