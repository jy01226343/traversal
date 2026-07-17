/**
 * 进入转场（§6.2）：只显示地点名称、地点类型、Journey 月份或当前预览条件、取消入口、beat 文案。
 * 不显示完整详情面板、全部标签或旅行总结。
 */

import { useEffect, useRef } from "react"
import type { ExplorationEntity, ImmersiveSceneDefinition } from "../domain/types"
import { FAMILY_LABELS, SHAPE_LABELS } from "./ui-utils"

export interface EnteringViewProps {
  entity: ExplorationEntity
  scene: ImmersiveSceneDefinition
  plannedMonth?: number | null
  previewLabel?: string | null
  beat?: { text: string; index: number } | null
  beatCount?: number
  onCancel: () => void
}

export function EnteringView({ entity, scene, plannedMonth, previewLabel, beat, beatCount, onCancel }: EnteringViewProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  const condition = plannedMonth != null
    ? `计划月份：${plannedMonth} 月`
    : previewLabel
      ? `预览：${previewLabel}`
      : "预览：当前季节"
  const totalBeats = beatCount ?? scene.arrival.transitionBeats.length

  return (
    <div className="ix-center-stage ix-entering" data-testid="ix-entering">
      <p className="ix-eyebrow">沉浸式探索</p>
      <h2 ref={headingRef} tabIndex={-1} className="ix-stage-title">{entity.name}</h2>
      <p className="ix-stage-subtitle">
        {scene.regionLabel} · {scene.arrival.subtitle}
      </p>
      <p className="ix-stage-type">{FAMILY_LABELS[scene.family]} · {SHAPE_LABELS[entity.shape]}</p>
      <p className="ix-stage-condition">{condition}</p>
      <p className="ix-entering__beat" aria-live="polite">
        {beat ? beat.text : "准备进入 3D 探索…"}
      </p>
      {totalBeats > 0 && (
        <div className="ix-entering__beats" aria-hidden="true">
          {Array.from({ length: totalBeats }, (_, i) => (
            <span key={i} className={`ix-entering__beat-dot${beat && i <= beat.index ? " ix-entering__beat-dot--done" : ""}`} />
          ))}
        </div>
      )}
      <button type="button" className="ix-btn ix-btn--ghost ix-entering__cancel" onClick={onCancel}>
        取消进入
      </button>
    </div>
  )
}
