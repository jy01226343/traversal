export function toggleComparedAttraction(ids: string[], id: string, max = 3) {
  if (ids.includes(id)) return ids.filter(current => current !== id)
  return ids.length >= max ? ids : [...ids, id]
}
