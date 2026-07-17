/**
 * 全屏壳（§6）：顶栏（返回/标题/模式角标）+ 场景画布（stage 注入）+ 空间标签层
 * + 底栏（图文信息入口 / ThemeMenu / 结束探索）+ 右栏（移动端底部抽屉）InfoPanel
 * + 各阶段视图（EnteringView / ArrivalIntro / RiskControls / DecisionSummary / FallbackInfoView）
 * + RETURNING 恢复遮罩 + aria-live 阶段播报。
 */

import type { ReactNode } from "react"
import { useState } from "react"
import { ChevronLeft, Orbit, RotateCcw, ZoomIn, ZoomOut } from "lucide-react"
import type { ExplorationEntity, ImmersiveSceneDefinition, ImmersiveTheme } from "../domain/types"
import type { ImmersiveEvent, ImmersiveState } from "../state/immersive-machine"
import type { SceneController } from "../runtime/scene-controller"
import { ModeBadge, resolveCurrentMode } from "./ModeBadge"
import { SceneAnchors } from "./SceneAnchors"
import { ThemeMenu } from "./ThemeMenu"
import { InfoPanel } from "./InfoPanel"
import { RiskControls } from "./RiskControls"
import { DecisionSummary } from "./DecisionSummary"
import { EnteringView } from "./EnteringView"
import { ArrivalIntro } from "./ArrivalIntro"
import { FallbackInfoView } from "./FallbackInfoView"
import { themeLabel, type LiveBadgeInfo } from "./ui-utils"

export interface ImmersiveOverlayProps {
  entity: ExplorationEntity
  scene: ImmersiveSceneDefinition
  state: ImmersiveState
  dispatch: (event: ImmersiveEvent) => void
  controller: SceneController | null
  stage: ReactNode
  defaultPreviewId: string | null
  plannedMonth?: number | null
  live: LiveBadgeInfo | null
  hasLiveSnapshot: boolean
  enteringBeat: { text: string; index: number } | null
  reducedMotion: boolean
  onBack: () => void
  onFinishExplore: () => void
  onShowFallbackInfo: () => void
  onRetryEnter: () => void
  onSkipIntro: () => void
  onAddWishlist?: (entity: ExplorationEntity) => void
  onViewPreparation?: (entity: ExplorationEntity) => void
  onAddJourney?: (entity: ExplorationEntity) => void
  onContinuePlanning: () => void
  onSummaryReturnMap: () => void
}

function stageAnnouncement(state: ImmersiveState, scene: ImmersiveSceneDefinition, entityName: string): string {
  const { status, context: ctx } = state
  switch (status) {
    case "ENTERING":
      return `正在进入 ${entityName}`
    case "ARRIVAL":
      return `已抵达 ${entityName}，正在展示核心景观`
    case "EXPLORE_IDLE":
      return "探索就绪，可从底部选择主题"
    case "THEME_ACTIVE":
      return ctx.activeTheme ? `已打开主题：${themeLabel(scene, ctx.activeTheme)}` : "已返回探索"
    case "RISK_ACTIVE": {
      const risk = scene.risks.find((r) => r.id === ctx.risk?.riskId)
      return `风险情境演示：${risk?.label ?? ""}，非当前实况`
    }
    case "SUMMARY":
      return "旅行判断总结已生成"
    case "FALLBACK":
      return "沉浸场景不可用，已切换为等价图文信息"
    case "RETURNING":
      return "正在返回地图"
    default:
      return ""
  }
}

export function ImmersiveOverlay(props: ImmersiveOverlayProps) {
  const { entity, scene, state, dispatch, controller, stage } = props
  const { status, context: ctx } = state
  const [autoRotate, setAutoRotate] = useState(false)

  const exploring = status === "EXPLORE_IDLE" || status === "THEME_ACTIVE" || status === "RISK_ACTIVE"
  const showTopbar = status !== "SUMMARY" && status !== "FALLBACK"
  const showPanel = status === "THEME_ACTIVE" || (status === "EXPLORE_IDLE" && ctx.selectedAnchorId != null)
  const activeRisk = ctx.risk ? scene.risks.find((r) => r.id === ctx.risk?.riskId) ?? null : null
  const currentMode = resolveCurrentMode(status, ctx.activeTheme, props.live)
  const defaultPreviewLabel = scene.previewPresets.find((p) => p.id === props.defaultPreviewId)?.label ?? null

  const toggleTheme = (theme: ImmersiveTheme) => {
    if (theme === ctx.activeTheme) dispatch({ type: "clearTheme" })
    else dispatch({ type: "activateTheme", theme })
  }

  const toggleAutoRotate = () => {
    const next = !autoRotate
    setAutoRotate(next)
    controller?.setAutoRotate(next)
  }

  return (
    <div
      className={`ix-overlay ix-overlay--${status.toLowerCase()}${props.reducedMotion ? " ix-reduced-motion" : ""}`}
      aria-label={`沉浸式探索：${entity.name}`}
    >
      {stage}
      <div className="ix-vignette" aria-hidden="true" />

      {showTopbar && (
        <header className="ix-topbar">
          <button type="button" className="ix-btn ix-btn--ghost ix-topbar__back" onClick={props.onBack}>
            <ChevronLeft size={18} aria-hidden="true" /> 返回地图
          </button>
          <div className="ix-topbar__title">
            <b>{entity.name}</b>
            <span>{scene.regionLabel}</span>
          </div>
          {exploring && (
            <div className="ix-topbar__mode">
              <ModeBadge mode={currentMode.mode} live={currentMode.live} />
            </div>
          )}
        </header>
      )}

      {exploring && (
        <SceneAnchors
          scene={scene}
          activeTheme={ctx.activeTheme}
          selectedAnchorId={ctx.selectedAnchorId}
          controller={controller}
          onSelect={(anchorId) => dispatch({ type: "selectAnchor", anchorId })}
        />
      )}

      {status === "ENTERING" && (
        <EnteringView
          entity={entity}
          scene={scene}
          plannedMonth={props.plannedMonth}
          previewLabel={defaultPreviewLabel}
          beat={props.enteringBeat}
          onCancel={props.onBack}
        />
      )}

      {status === "ARRIVAL" && (
        <ArrivalIntro entity={entity} scene={scene} onSkip={props.onSkipIntro} />
      )}

      {showPanel && (
        <InfoPanel
          scene={scene}
          state={state}
          defaultPreviewId={props.defaultPreviewId}
          live={props.live}
          dispatch={dispatch}
        />
      )}

      {status === "RISK_ACTIVE" && activeRisk && ctx.risk && (
        <RiskControls risk={activeRisk} playback={ctx.risk} dispatch={dispatch} />
      )}

      {status === "SUMMARY" && (
        <DecisionSummary
          entity={entity}
          scene={scene}
          state={state}
          defaultPreviewId={props.defaultPreviewId}
          plannedMonth={props.plannedMonth}
          live={props.live}
          hasLiveSnapshot={props.hasLiveSnapshot}
          dispatch={dispatch}
          onAddWishlist={props.onAddWishlist}
          onViewPreparation={props.onViewPreparation}
          onAddJourney={props.onAddJourney}
          onContinuePlanning={props.onContinuePlanning}
          onReturnMap={props.onSummaryReturnMap}
        />
      )}

      {status === "FALLBACK" && (
        <FallbackInfoView
          entity={entity}
          scene={scene}
          errorReason={ctx.error?.reason ?? null}
          onRetry={props.onRetryEnter}
          onReturnMap={props.onSummaryReturnMap}
        />
      )}

      {exploring && (
        <div className="ix-camera-dock" role="group" aria-label="场景视角控制">
          <span className="ix-camera-dock__hint">拖拽旋转 · 滚轮缩放</span>
          <div className="ix-camera-dock__row">
            <button type="button" className="ix-camera-btn" aria-label="放大" onClick={() => controller?.zoomBy(0.76)}>
              <ZoomIn size={16} aria-hidden="true" />
            </button>
            <button type="button" className="ix-camera-btn" aria-label="缩小" onClick={() => controller?.zoomBy(1.32)}>
              <ZoomOut size={16} aria-hidden="true" />
            </button>
            <button type="button" className="ix-camera-btn" aria-label="复位视角" onClick={() => controller?.resetCamera()}>
              <RotateCcw size={16} aria-hidden="true" />
            </button>
            {!props.reducedMotion && (
              <button
                type="button"
                className={`ix-camera-btn${autoRotate ? " ix-camera-btn--on" : ""}`}
                aria-label="自动环绕"
                aria-pressed={autoRotate}
                onClick={toggleAutoRotate}
              >
                <Orbit size={16} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      )}

      {exploring && (
        <footer className="ix-bottombar">
          <button type="button" className="ix-btn ix-btn--ghost ix-bottombar__side" onClick={props.onShowFallbackInfo}>
            图文信息
          </button>
          <ThemeMenu themes={scene.themes} activeTheme={ctx.activeTheme} onToggle={toggleTheme} />
          <button type="button" className="ix-btn ix-btn--primary ix-bottombar__side" onClick={props.onFinishExplore}>
            结束探索
          </button>
        </footer>
      )}

      {status === "RETURNING" && (
        <div className="ix-returning" role="status">
          <p>正在返回地图…</p>
        </div>
      )}

      <div className="ix-sr-only" aria-live="polite">
        {stageAnnouncement(state, scene, entity.name)}
      </div>
    </div>
  )
}
