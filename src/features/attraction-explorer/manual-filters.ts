import type { Attraction } from "./types"

export const EXPERIENCE_FILTERS = ["徒步", "温泉", "湖泊", "花田", "亲子", "摄影", "滑雪", "文化"] as const
export type AttractionExperience = typeof EXPERIENCE_FILTERS[number]

export function filterAttractionsByExperiences(items: Attraction[], experiences: AttractionExperience[]) {
  if (!experiences.length) return items
  return items.filter(item => {
    const searchable = `${item.category_l1} ${item.category_l2} ${item.tags.join(" ")}`
    return experiences.every(experience => searchable.includes(experience))
  })
}

export function toggleExperience(current: AttractionExperience[], value: AttractionExperience) {
  return current.includes(value) ? current.filter(item => item !== value) : [...current, value]
}
