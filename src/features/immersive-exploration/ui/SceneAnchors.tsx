/**
 * HTML 空间标签层（§6.4）：
 * - 可见集合由 CORE selectVisibleAnchors 给出（默认 ≤3，主题态 ≤5，priority 升序截断，选中始终保留）；
 *   组件再用 ANCHOR_CAP_* 做防御性截断。
 * - 位置由 useAnchorPositions（SceneController.projectAnchor / onFrame）跟随；出屏锚点返回 null 时不渲染。
 * - 点击 → selectAnchor（再次点击取消）；选中后其他非相关标签加 ix-anchor--dimmed（selectDimmedAnchorIds）。
 * - 标签带小圆点 + 引线样式（CSS ::after），触控区 ≥44pt。
 */

import { useMemo } from "react"
import type { ImmersiveSceneDefinition, ImmersiveTheme, SceneAnchorDefinition } from "../domain/types"
import {
  ANCHOR_CAP_DEFAULT,
  ANCHOR_CAP_THEME,
  selectDimmedAnchorIds,
  selectVisibleAnchors,
} from "../domain/selectors"
import { useAnchorPositions } from "../runtime/anchor-controller"
import type { SceneController } from "../runtime/scene-controller"

export interface SceneAnchorsProps {
  scene: ImmersiveSceneDefinition
  activeTheme: ImmersiveTheme | null
  selectedAnchorId: string | null
  controller: SceneController | null
  onSelect: (anchorId: string | null) => void
}

/** 防御性截断：保留选中锚点（契约规定选中始终可见） */
function capVisible(
  visible: SceneAnchorDefinition[],
  cap: number,
  selectedAnchorId: string | null,
): SceneAnchorDefinition[] {
  if (visible.length <= cap) return visible
  const sliced = visible.slice(0, cap)
  if (!selectedAnchorId || sliced.some((a) => a.id === selectedAnchorId)) return sliced
  const selected = visible.find((a) => a.id === selectedAnchorId)
  return selected ? [...sliced.slice(0, cap - 1), selected] : sliced
}

export function SceneAnchors({ scene, activeTheme, selectedAnchorId, controller, onSelect }: SceneAnchorsProps) {
  const cap = activeTheme ? ANCHOR_CAP_THEME : ANCHOR_CAP_DEFAULT
  // memo 保持数组/集合身份稳定：useAnchorPositions 以 anchors 为 effect 依赖，
  // 每次渲染新建数组会导致 effect → setState → 渲染 的无限循环
  const visible = useMemo(
    () => capVisible(selectVisibleAnchors(scene, activeTheme, selectedAnchorId), cap, selectedAnchorId),
    [scene, activeTheme, selectedAnchorId, cap],
  )
  const dimmed = useMemo(() => selectDimmedAnchorIds(visible, selectedAnchorId), [visible, selectedAnchorId])
  const positions = useAnchorPositions(controller, visible)

  return (
    <div className="ix-anchors" role="group" aria-label="场景空间标签" data-testid="ix-anchors">
      {visible.map((anchor) => {
        // CORE 实现按 positionRef 键控返回；此处兼容 positionRef 与 id 两种键控
        const pos = positions[anchor.positionRef] ?? positions[anchor.id]
        if (!pos) return null
        const selected = anchor.id === selectedAnchorId
        const cls = [
          "ix-anchor",
          selected ? "ix-anchor--selected" : "",
          !selected && dimmed.has(anchor.id) ? "ix-anchor--dimmed" : "",
        ].filter(Boolean).join(" ")
        return (
          <button
            key={anchor.id}
            type="button"
            className={cls}
            style={{ left: pos.x, top: pos.y }}
            aria-pressed={selected}
            onClick={() => onSelect(selected ? null : anchor.id)}
          >
            <span className="ix-anchor__dot" aria-hidden="true" />
            <span className="ix-anchor__label">{anchor.label}</span>
          </button>
        )
      })}
    </div>
  )
}
