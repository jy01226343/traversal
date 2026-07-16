/**
 * 足迹六态状态机（产品文档 §6.2 / §9）
 *
 * 对齐产品规格命名：
 *   UNEXPLORED -> WISHLIST -> PREPARING -> UNLOCKED -> EXPLORED -> DEEP_EXPLORED
 *   未探索      心愿        准备中       已解锁     已探索      深度探索
 *
 * 语义说明（§9.2）：
 * - UNLOCKED 表示用户完成或确认旅行准备，不等于官方签证/入境许可。
 * - EXPLORED 表示存在已完成的 Journey；DEEP_EXPLORED 表示同区域多次完整旅行。
 * - 「当季推荐」不是独立足迹态，由调用方通过 isInSeasonalList 标记，UI 层显示推荐徽标。
 *
 * 向后兼容：旧 localStorage（atlas-mastered-v1 等）数据在读取时无感迁移到新语义。
 */
import type { SeasonalRecommendation } from "./seasonal-recommendations"
import { getDestinationKey } from "./seasonal-recommendations"

export type DestinationStatusId =
  | "UNEXPLORED"
  | "WISHLIST"
  | "PREPARING"
  | "UNLOCKED"
  | "EXPLORED"
  | "DEEP_EXPLORED"

export interface DestinationStatusMeta {
  id: DestinationStatusId
  label: string
  short: string
  /** CSS tone 类名，保留旧名以减少 CSS 改动 */
  tone: "locked" | "recommend" | "wish" | "prep" | "visited" | "mastered"
}

export const DESTINATION_STATUS: Record<DestinationStatusId, DestinationStatusMeta> = {
  UNEXPLORED: { id: "UNEXPLORED", label: "未探索", short: "未探索", tone: "locked" },
  WISHLIST: { id: "WISHLIST", label: "心愿收藏", short: "心愿", tone: "wish" },
  PREPARING: { id: "PREPARING", label: "准备中", short: "准备", tone: "prep" },
  UNLOCKED: { id: "UNLOCKED", label: "准备完成", short: "准备好", tone: "recommend" },
  EXPLORED: { id: "EXPLORED", label: "已探索", short: "已去", tone: "visited" },
  DEEP_EXPLORED: { id: "DEEP_EXPLORED", label: "深度探索", short: "精通", tone: "mastered" },
}

/**
 * 扇形卡片视觉态（fanStatusFromMeta 的返回值），用于 card-fan-carousel 等组件。
 * 注意：unlocked 与 explored 视觉相近（都已"开放"），但 unlocked 无真实足迹。
 */
export type FanStatus = "locked" | "unlocked" | "wishlist" | "preparing" | "mastered"

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

/**
 * 加载深度探索（深度探索）列表。
 * 兼容旧 atlas-mastered-v1 数据：语义从 "mastered" 迁移为 "deep_explored"，
 * key 名保留以避免老数据丢失，读取即迁移。
 */
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
  /** 保留字段兼容调用方；目的地状态不再由护照访问权决定。 */
  passportCode?: string | null
}

/**
 * 解析目的地足迹态。优先级（高 -> 低）：
 *   DEEP_EXPLORED > EXPLORED > UNLOCKED > PREPARING > WISHLIST > UNEXPLORED
 *
 * UNLOCKED 的判定（§9.2）：用户确认准备完成（unlockedKeys 含此目的地）。
 * 它不表示地图访问权，也不会因为本国或免签条件自动成立。
 */
export function resolveDestinationStatus(input: ResolveStatusInput): DestinationStatusMeta {
  const key = getDestinationKey(input.destination)
  const id = input.destination.id

  // 深度探索：用户显式标记为 mastered（多次完整旅行）
  if (input.masteredIds.includes(id) || input.masteredIds.includes(key)) {
    return DESTINATION_STATUS.DEEP_EXPLORED
  }

  // 用户主动确认准备完成；这与公开浏览和已到访均无关。
  if (input.unlockedKeys.includes(key) || input.unlockedKeys.includes(id)) {
    return DESTINATION_STATUS.UNLOCKED
  }

  // 准备中：有任务进度但未完成
  if (hasPreparingProgress(key)) return DESTINATION_STATUS.PREPARING

  // 心愿
  if (input.wishlistIds.includes(id) || input.wishlistIds.includes(key)) {
    return DESTINATION_STATUS.WISHLIST
  }

  // 未探索（当季推荐由调用方通过 isInSeasonalList 在 UI 层标记徽标，不影响足迹态）
  return DESTINATION_STATUS.UNEXPLORED
}

export function fanStatusFromMeta(meta: DestinationStatusMeta): FanStatus {
  if (meta.id === "EXPLORED" || meta.id === "DEEP_EXPLORED") {
    return meta.id === "DEEP_EXPLORED" ? "mastered" : "unlocked"
  }
  if (meta.id === "UNLOCKED") return "unlocked"
  if (meta.id === "WISHLIST") return "wishlist"
  if (meta.id === "PREPARING") return "preparing"
  return "locked"
}
