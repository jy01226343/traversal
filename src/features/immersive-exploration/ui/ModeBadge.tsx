/**
 * 三态口径标识（§4.2 / §10.2，施工要求：场景角标、InfoPanel、总结页均不得抹平）
 * - live            →「当前实况 · {sourceName} · {本地化时间}」（仅快照 fresh 时）
 * - typical_preview →「典型景色预览」
 * - risk_simulation →「风险情境演示 · 非当前实况」
 * 不仅依赖颜色：live=● / preview=◐ / risk=▲ 图标字符 + 文案。
 */

import type { PresentationMode, ImmersiveTheme } from "../domain/types"
import type { ImmersiveStatus } from "../state/immersive-machine"
import { formatLocalTime, type LiveBadgeInfo } from "./ui-utils"

export interface ModeBadgeProps {
  mode: PresentationMode
  live?: LiveBadgeInfo | null
  size?: "sm" | "md"
}

export function ModeBadge({ mode, live, size = "md" }: ModeBadgeProps) {
  if (mode === "live") {
    const time = formatLocalTime(live?.updatedAt)
    return (
      <span className={`ix-badge ix-badge--live ix-badge--${size}`} data-testid="ix-mode-badge" data-mode="live">
        <span className="ix-badge__icon" aria-hidden="true">●</span>
        <span>
          当前实况{live?.sourceName ? ` · ${live.sourceName}` : ""}
          {time ? ` · ${time}` : ""}
        </span>
      </span>
    )
  }
  if (mode === "risk_simulation") {
    return (
      <span className={`ix-badge ix-badge--risk ix-badge--${size}`} data-testid="ix-mode-badge" data-mode="risk_simulation">
        <span className="ix-badge__icon" aria-hidden="true">▲</span>
        <span>风险情境演示 · 非当前实况</span>
      </span>
    )
  }
  return (
    <span className={`ix-badge ix-badge--preview ix-badge--${size}`} data-testid="ix-mode-badge" data-mode="typical_preview">
      <span className="ix-badge__icon" aria-hidden="true">◐</span>
      <span>典型景色预览</span>
    </span>
  )
}

/**
 * 场景左上角「当前口径」推导：
 * 风险演示中 → risk_simulation；景色主题/有预览选择 → typical_preview；
 * 有 fresh 实况 → live；否则场景正在渲染默认预览 → typical_preview。
 */
export function resolveCurrentMode(
  status: ImmersiveStatus,
  activeTheme: ImmersiveTheme | null,
  live: LiveBadgeInfo | null,
): { mode: PresentationMode; live: LiveBadgeInfo | null } {
  if (status === "RISK_ACTIVE") return { mode: "risk_simulation", live: null }
  if (activeTheme === "highlights") return { mode: "typical_preview", live: null }
  if (live) return { mode: "live", live }
  return { mode: "typical_preview", live: null }
}
