export type DestinationLifecycle =
  | "untouched"
  | "wishlist"
  | "preparing"
  | "ready"
  | "in_journey"
  | "completed"
  | "visited_unlogged"

/** Converts the persisted progress state into the single UI CTA lifecycle. */
export function lifecycleFromProgressState(state: string): DestinationLifecycle {
  if (state === "WISHLIST") return "wishlist"
  if (state === "PREPARING") return "preparing"
  if (state === "UNLOCKED") return "ready"
  if (state === "EXPLORED" || state === "DEEP_EXPLORED") return "completed"
  return "untouched"
}

export function getDestinationStatusLabel(state: DestinationLifecycle) {
  return ({ untouched: "待探索", wishlist: "心愿中", preparing: "准备中", ready: "准备完成", in_journey: "旅程中", completed: "已到访", visited_unlogged: "待补录" } as const)[state]
}

export function getDestinationPrimaryAction(state: DestinationLifecycle) {
  return ({ untouched: "加入心愿", wishlist: "开始准备", preparing: "继续准备", ready: "加入旅程", in_journey: "继续规划", completed: "查看回忆", visited_unlogged: "补录旅程" } as const)[state]
}

export function getDestinationSecondaryAction(state: DestinationLifecycle) {
  return ({ untouched: "查看详情", wishlist: "移出心愿", preparing: "查看清单", ready: "调整准备项", in_journey: "调整顺序", completed: "再次规划", visited_unlogged: "查看详情" } as const)[state]
}

export interface FitnessResult {
  score: number | null
  calculatedAt: string | null
  isDynamic: boolean
  isExplainable: boolean
}

export function canShowFitness(result?: FitnessResult | null) {
  return Boolean(result && result.score !== null && result.calculatedAt && result.isDynamic && result.isExplainable)
}
