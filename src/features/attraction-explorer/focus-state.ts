export type AttractionMarkerMode = "default" | "hover" | "selected" | "dimmed"

/** The map and list consume the same ids; neither infers state from DOM events. */
export function getAttractionMarkerMode(id: string, selectedId?: string | null, hoveredId?: string | null): AttractionMarkerMode {
  if (id === selectedId) return "selected"
  if (selectedId) return "dimmed"
  if (id === hoveredId) return "hover"
  return "default"
}
