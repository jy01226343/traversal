export interface MarkerLayoutInput { id: string; x: number; y: number; priority: number; selected?: boolean }
export type MarkerPresentation = "selected" | "label" | "compact"

/** Keeps one complete card per collision zone; compact markers remain keyboard/click reachable. */
export function resolveMarkerPresentations(items: MarkerLayoutInput[], minDistance = 74): Map<string, MarkerPresentation> {
  const result = new Map<string, MarkerPresentation>()
  const accepted: MarkerLayoutInput[] = []
  const ordered = [...items].sort((a, b) => Number(Boolean(b.selected)) - Number(Boolean(a.selected)) || b.priority - a.priority || a.id.localeCompare(b.id))
  for (const item of ordered) {
    if (item.selected) { result.set(item.id, "selected"); accepted.push(item); continue }
    const overlaps = accepted.some(other => Math.hypot(other.x - item.x, other.y - item.y) < minDistance)
    result.set(item.id, overlaps ? "compact" : "label")
    if (!overlaps) accepted.push(item)
  }
  return result
}
