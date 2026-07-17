/**
 * 首次抵达（§6.3）：只显示名称、类型/核心自然属性、当前最值得看的景观、当前主要玩法。
 * 纯场景观察（scene.arrival.observeMs，由 runArrivalObserve 驱动）结束后主题入口才淡入。
 */

import { useEffect, useRef } from "react"
import type { ExplorationEntity, ImmersiveSceneDefinition } from "../domain/types"
import { FAMILY_LABELS } from "./ui-utils"

export interface ArrivalIntroProps {
  entity: ExplorationEntity
  scene: ImmersiveSceneDefinition
  onSkip: () => void
}

export function ArrivalIntro({ entity, scene, onSkip }: ArrivalIntroProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  return (
    <div className="ix-center-stage ix-arrival" data-testid="ix-arrival">
      <p className="ix-eyebrow">{scene.regionLabel} · {FAMILY_LABELS[scene.family]}探索</p>
      <h2 ref={headingRef} tabIndex={-1} className="ix-stage-title">{entity.name}</h2>
      <p className="ix-stage-subtitle">{scene.arrival.subtitle}</p>
      <dl className="ix-arrival__highlights">
        <div className="ix-arrival__row">
          <dt>核心景观</dt>
          <dd>{scene.arrival.headlineSight}</dd>
        </div>
        <div className="ix-arrival__row">
          <dt>主要玩法</dt>
          <dd>{scene.arrival.headlineActivity}</dd>
        </div>
      </dl>
      <button type="button" className="ix-btn ix-btn--ghost ix-arrival__skip" onClick={onSkip}>
        跳过介绍
      </button>
    </div>
  )
}
