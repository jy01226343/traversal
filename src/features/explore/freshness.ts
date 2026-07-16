export type DataFreshnessStatus = "fresh" | "usable" | "stale" | "unavailable" | "syncing"
export type SyncState = "idle" | "queued" | "syncing" | "success" | "partial" | "failed" | "unavailable"

export function getFreshnessLabel(status: DataFreshnessStatus) {
  return ({ fresh: "已更新", usable: "可用缓存", stale: "数据可能已变化", unavailable: "暂不可用", syncing: "同步中" } as const)[status]
}

export function freshnessFromUpdatedAt(updatedAt?: string | null, staleAfterMs = 3_600_000, now = Date.now()): DataFreshnessStatus {
  if (!updatedAt) return "unavailable"
  const value = Date.parse(updatedAt)
  if (!Number.isFinite(value)) return "unavailable"
  return now - value > staleAfterMs ? "stale" : "fresh"
}
