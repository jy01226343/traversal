/**
 * V1.0 目的地状态机（产品文档 §9 / §11）
 * LOCKED → RECOMMENDED → WISHLIST → PREPARING → VISITED → MASTERED
 */
import type { SeasonalRecommendation } from "./seasonal-recommendations"
import { getDestinationKey } from "./seasonal-recommendations"
import { resolveTravelAccess } from "./travel-access"

export type DestinationStatusId =
  | "LOCKED"
  | "RECOMMENDED"
  | "WISHLIST"
  | "PREPARING"
  | "VISITED"
  | "MASTERED"

export interface DestinationStatusMeta {
  id: DestinationStatusId
  label: string
  short: string
  tone: "locked" | "recommend" | "wish" | "prep" | "visited" | "mastered"
}

export const DESTINATION_STATUS: Record<DestinationStatusId, DestinationStatusMeta> = {
  LOCKED: { id: "LOCKED", label: "未解锁", short: "锁定", tone: "locked" },
  RECOMMENDED: { id: "RECOMMENDED", label: "当季推荐", short: "推荐", tone: "recommend" },
  WISHLIST: { id: "WISHLIST", label: "心愿收藏", short: "心愿", tone: "wish" },
  PREPARING: { id: "PREPARING", label: "准备中", short: "准备", tone: "prep" },
  VISITED: { id: "VISITED", label: "已点亮", short: "已去", tone: "visited" },
  MASTERED: { id: "MASTERED", label: "深度探索", short: "精通", tone: "mastered" },
}

const WISH_KEY = "atlas-wishlist-v1"
const MASTERED_KEY = "atlas-mastered-v1"

export function loadWishlist(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(WISH_KEY) || "[]")
    return Array.isArray(raw) ? raw.map(String) : []
  } catch {
    return []
  }
}

export function saveWishlist(ids: string[]) {
  localStorage.setItem(WISH_KEY, JSON.stringify([...new Set(ids)]))
}

export function loadMastered(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(MASTERED_KEY) || "[]")
    return Array.isArray(raw) ? raw.map(String) : []
  } catch {
    return []
  }
}

export function saveMastered(ids: string[]) {
  localStorage.setItem(MASTERED_KEY, JSON.stringify([...new Set(ids)]))
}

export function toggleId(list: string[], id: string) {
  return list.includes(id) ? list.filter(item => item !== id) : [...list, id]
}

/** 是否有解锁任务进度但未完成 */
export function hasPreparingProgress(destinationKey: string) {
  try {
    const raw = JSON.parse(localStorage.getItem(`atlas-unlock-tasks:${destinationKey}`) || "{}")
    const values = Object.values(raw)
    if (!values.length) return false
    const done = values.filter(Boolean).length
    return done > 0 && done < values.length
  } catch {
    return false
  }
}

export interface ResolveStatusInput {
  destination: SeasonalRecommendation
  unlockedKeys: string[]
  wishlistIds: string[]
  masteredIds: string[]
  /** 是否出现在当前当季推荐列表中 */
  isInSeasonalList?: boolean
  /** 护照国籍 ISO 代码，用于本国 / 免签直达 */
  passportCode?: string | null
}

export function resolveDestinationStatus(input: ResolveStatusInput): DestinationStatusMeta {
  const key = getDestinationKey(input.destination)
  const id = input.destination.id
  const access = resolveTravelAccess({
    destinationCountryCode: input.destination.countryCode,
    destinationKey: key,
    passportCode: input.passportCode,
    unlockedKeys: input.unlockedKeys,
  })

  if (input.masteredIds.includes(id) || input.masteredIds.includes(key)) {
    return DESTINATION_STATUS.MASTERED
  }
  if (access.free) {
    if (access.tier === "domestic") {
      return { ...DESTINATION_STATUS.VISITED, label: "本国开放", short: "本国" }
    }
    if (access.tier === "visa_free") {
      return { ...DESTINATION_STATUS.VISITED, label: "免签开放", short: "免签" }
    }
    return DESTINATION_STATUS.VISITED
  }
  if (hasPreparingProgress(key)) return DESTINATION_STATUS.PREPARING
  if (input.wishlistIds.includes(id) || input.wishlistIds.includes(key)) {
    return DESTINATION_STATUS.WISHLIST
  }
  if (input.isInSeasonalList) return DESTINATION_STATUS.RECOMMENDED
  return DESTINATION_STATUS.LOCKED
}

export function fanStatusFromMeta(meta: DestinationStatusMeta): "locked" | "unlocked" | "wishlist" | "preparing" | "mastered" {
  if (meta.id === "VISITED" || meta.id === "MASTERED") return meta.id === "MASTERED" ? "mastered" : "unlocked"
  if (meta.id === "WISHLIST") return "wishlist"
  if (meta.id === "PREPARING") return "preparing"
  return "locked"
}
