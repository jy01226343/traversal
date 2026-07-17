/**
 * 旅行判断总结页（§11.3）：
 * 四卡（最适合季节/最适合玩法/适合人群/主要风险）+ 适配结论与原因 + 准备事项
 * + 五动作（加入心愿/查看准备事项/加入 Journey/继续规划/返回地图）。
 * 结论由 CORE buildTravelDecisionSummary 动态生成（无固定星级；无选择走默认规则 §4.7）；
 * 各内容块口径标识（modeBadges）在总结页保留，不抹平（§4.2）。
 * 业务入口未接入时按钮禁用并注明，不伪装成已完成（§11.3）。
 */

import { useEffect, useMemo, useRef } from "react"
import { CalendarCheck2, CloudSun, Heart, ListChecks, Map as MapIcon, TriangleAlert, Users } from "lucide-react"
import type { ExplorationEntity, ImmersiveSceneDefinition, Suitability } from "../domain/types"
import type { ImmersiveEvent, ImmersiveState } from "../state/immersive-machine"
import { buildTravelDecisionSummary } from "../domain/decision-engine"
import { ModeBadge } from "./ModeBadge"
import { findAudience, type LiveBadgeInfo } from "./ui-utils"

const SUITABILITY_LABELS: Record<Suitability, string> = {
  very_suitable: "非常适合",
  suitable_with_conditions: "适合，但需留意条件",
  not_recommended_now: "当前不太推荐",
  insufficient_information: "信息不足，无法判断",
}

export interface DecisionSummaryProps {
  entity: ExplorationEntity
  scene: ImmersiveSceneDefinition
  state: ImmersiveState
  defaultPreviewId: string | null
  plannedMonth?: number | null
  live: LiveBadgeInfo | null
  hasLiveSnapshot: boolean
  dispatch: (event: ImmersiveEvent) => void
  onAddWishlist?: (entity: ExplorationEntity) => void
  onViewPreparation?: (entity: ExplorationEntity) => void
  onAddJourney?: (entity: ExplorationEntity) => void
  onContinuePlanning: () => void
  onReturnMap: () => void
}

export function DecisionSummary(props: DecisionSummaryProps) {
  const { entity, scene, state, defaultPreviewId, plannedMonth, live, hasLiveSnapshot, dispatch } = props
  const { selectedPreviewId, selectedActivityId, selectedAudienceId } = state.context
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  const summary = useMemo(
    () =>
      buildTravelDecisionSummary({
        scene,
        previewId: (selectedPreviewId ?? defaultPreviewId) ?? undefined,
        activityId: selectedActivityId ?? undefined,
        audienceId: selectedAudienceId ?? undefined,
        plannedMonth: plannedMonth ?? undefined,
        dataCompleteness: hasLiveSnapshot ? 0.9 : 0.6,
      }),
    [scene, selectedPreviewId, defaultPreviewId, selectedActivityId, selectedAudienceId, plannedMonth, hasLiveSnapshot],
  )

  const audience = findAudience(scene, selectedAudienceId)
  const audienceText = audience ? audience.label : "未选择具体人群"

  const businessActions: Array<{
    key: "add_wishlist" | "view_preparation" | "add_journey"
    label: string
    icon: typeof Heart
    handler?: (entity: ExplorationEntity) => void
    primary?: boolean
  }> = [
    { key: "add_wishlist", label: "加入心愿单", icon: Heart, handler: props.onAddWishlist },
    { key: "view_preparation", label: "查看准备事项", icon: ListChecks, handler: props.onViewPreparation },
    { key: "add_journey", label: "加入 Journey", icon: CalendarCheck2, handler: props.onAddJourney, primary: true },
  ]

  return (
    <div className="ix-summary" data-testid="ix-summary">
      <div className="ix-summary__inner">
        <header className="ix-summary__header">
          <p className="ix-eyebrow">本次探索总结</p>
          <h2 ref={headingRef} tabIndex={-1} className="ix-summary__title">{entity.name}</h2>
          <p className="ix-stage-subtitle">{scene.regionLabel}</p>
          <div className="ix-summary__badges">
            {live && <ModeBadge mode="live" live={live} size="sm" />}
            <ModeBadge mode={summary.modeBadges.preview} size="sm" />
            <ModeBadge mode={summary.modeBadges.cautions} size="sm" />
          </div>
        </header>

        <div className="ix-summary__grid">
          <section className="ix-summary-card" aria-label="最适合的季节">
            <h3 className="ix-summary-card__title"><CloudSun size={16} aria-hidden="true" /> 最适合的季节</h3>
            <p className="ix-summary-card__value">{summary.bestTimeText}</p>
            <ModeBadge mode={summary.modeBadges.preview} size="sm" />
          </section>
          <section className="ix-summary-card" aria-label="最适合的玩法">
            <h3 className="ix-summary-card__title"><MapIcon size={16} aria-hidden="true" /> 最适合的玩法</h3>
            <p className="ix-summary-card__value">{summary.bestExperienceText}</p>
            {!selectedActivityId && <p className="ix-summary-card__note">代表性玩法（未手动选择）</p>}
          </section>
          <section className="ix-summary-card" aria-label="适合的人群">
            <h3 className="ix-summary-card__title"><Users size={16} aria-hidden="true" /> 适合的人群</h3>
            <p className="ix-summary-card__value">{audienceText}</p>
            <p className="ix-summary-card__note">{SUITABILITY_LABELS[summary.suitability]}</p>
          </section>
          <section className="ix-summary-card ix-summary-card--risk" aria-label="需要留意的风险">
            <h3 className="ix-summary-card__title"><TriangleAlert size={16} aria-hidden="true" /> 需要留意的风险</h3>
            {summary.mainCautions.length > 0 ? (
              <ul className="ix-summary-card__list">
                {summary.mainCautions.map((c) => <li key={c}>▲ {c}</li>)}
              </ul>
            ) : (
              <p className="ix-summary-card__value">暂无已配置的主要风险</p>
            )}
            <ModeBadge mode={summary.modeBadges.cautions} size="sm" />
          </section>
        </div>

        <section className="ix-summary__block" aria-label="适配结论与原因">
          <h3 className="ix-summary__block-title">适配结论：{SUITABILITY_LABELS[summary.suitability]}</h3>
          <ul className="ix-summary__reasons">
            {summary.suitabilityReasons.map((reason) => <li key={reason}>{reason}</li>)}
          </ul>
        </section>

        <section className="ix-summary__block" aria-label="准备事项">
          <h3 className="ix-summary__block-title">准备事项</h3>
          <ul className="ix-summary__preparations">
            {summary.preparationItems.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>

        <footer className="ix-summary__actions" aria-label="下一步行动">
          {businessActions.map(({ key, label, icon: Icon, handler, primary }) => (
            <button
              key={key}
              type="button"
              className={`ix-btn${primary ? " ix-btn--primary" : ""}`}
              disabled={!handler}
              title={handler ? undefined : "业务入口待接入"}
              onClick={() => {
                if (!handler) return
                dispatch({ type: "summaryAction", action: key })
                handler(entity)
              }}
            >
              <Icon size={16} aria-hidden="true" /> {label}
              {!handler && <span className="ix-btn__note">（待接入）</span>}
            </button>
          ))}
          <button type="button" className="ix-btn" onClick={props.onContinuePlanning}>
            继续规划
          </button>
          <button type="button" className="ix-btn ix-btn--ghost" onClick={props.onReturnMap}>
            返回地图
          </button>
        </footer>
      </div>
    </div>
  )
}
