/**
 * 沉浸式景点探索 · 顶层组件（main.jsx 唯一集成点，CONTRACT UI 节）
 *
 * 职责：
 * - ImmersiveStoreProvider 包裹；挂载即 dispatch selectEntity({entity, scene}) → enter；
 * - SceneCanvas 持有 canvas ref，SceneController.mount 失败 → dispatch fatalError（→ FALLBACK）；
 * - 状态变化 → controller.syncState(state)；
 * - ENTERING → runEnterSequence（onDone→arrivalComplete，取消→cancelEnter，enterToken 守卫）；
 * - ARRIVAL → runArrivalObserve（→introComplete）；RISK_ACTIVE → runRiskPlayback（onStep→riskStep）；
 * - 退出流程：returnMap/continuePlanning/cancel → RETURNING → 300ms 恢复淡出 → mapRestored → onExit(outcome)；
 * - 卸载清理：dispose 控制器、取消时序控制器与定时器、移除键盘监听（§12.3）；
 * - Esc 逐级返回：RISK_ACTIVE→restoreCalm / THEME_ACTIVE→clearTheme / SUMMARY·EXPLORE_IDLE→returnMap / ENTERING→cancelEnter。
 *
 * feature flag 关闭时直接渲染等价图文页（§12.1 非沉浸入口），不渲染沉浸层。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ExplorationEntity, ImmersiveSceneDefinition } from "../domain/types"
import type { DestinationLiveSnapshot } from "../../live-data/destination-live"
import { resolveDefaultPreviewId } from "../state/immersive-machine"
import { ImmersiveStoreProvider, useImmersiveStore } from "../state/immersive-store"
import { SceneController } from "../runtime/scene-controller"
import { runArrivalObserve, runEnterSequence } from "../runtime/transition-controller"
import { runRiskPlayback } from "../runtime/risk-controller"
import { isImmersiveExplorationEnabled } from "../config"
import { getScenePhotos } from "../data/scene-photos"
import { getLiveBadgeInfo } from "./ui-utils"
import { ImmersiveOverlay } from "./ImmersiveOverlay"
import { SceneCanvas } from "./SceneCanvas"
import { FallbackInfoView } from "./FallbackInfoView"
import "../immersive-exploration.css"

export interface ImmersiveExperienceProps {
  entity: ExplorationEntity
  scene: ImmersiveSceneDefinition
  plannedMonth?: number | null
  liveSnapshot?: DestinationLiveSnapshot | null
  quality?: "high" | "standard" | "low"
  reducedMotion?: boolean
  onAddWishlist?: (entity: ExplorationEntity) => void
  onViewPreparation?: (entity: ExplorationEntity) => void
  onAddJourney?: (entity: ExplorationEntity) => void
  onContinuePlanning?: (entity: ExplorationEntity) => void
  onExit: (outcome: "return_map" | "continue_planning" | "cancel" | "fallback_info") => void
}

type ExitOutcome = "return_map" | "continue_planning" | "cancel" | "fallback_info"

export function ImmersiveExperience(props: ImmersiveExperienceProps) {
  // flag 关闭：非沉浸式等价图文入口（§12.1），不渲染沉浸层
  if (!isImmersiveExplorationEnabled()) {
    return (
      <div className="ix-overlay ix-overlay--fallback-only">
        <FallbackInfoView
          entity={props.entity}
          scene={props.scene}
          standalone
          onReturnMap={() => props.onExit("return_map")}
        />
      </div>
    )
  }
  return (
    <ImmersiveStoreProvider>
      <ImmersiveExperienceInner {...props} />
    </ImmersiveStoreProvider>
  )
}

function ImmersiveExperienceInner(props: ImmersiveExperienceProps) {
  const { entity, scene, plannedMonth = null, liveSnapshot = null, quality = "standard", reducedMotion = false } = props
  const { state, dispatch } = useImmersiveStore()
  const { status, context: ctx } = state

  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null)
  const [controller, setController] = useState<SceneController | null>(null)
  const [enteringBeat, setEnteringBeat] = useState<{ text: string; index: number } | null>(null)

  const controllerRef = useRef<SceneController | null>(null)
  const stateRef = useRef(state)
  const enterTokenRef = useRef(ctx.enterToken)
  const mountedRef = useRef(true)
  const didInitRef = useRef(false)
  const becameActiveRef = useRef(false)
  const exitedRef = useRef(false)
  const exitOutcomeRef = useRef<ExitOutcome>("return_map")
  const prevStatusRef = useRef(status)

  /* -------------------------------- 初始化：选择目标并进入 -------------------------------- */
  useEffect(() => {
    if (didInitRef.current) return
    didInitRef.current = true
    mountedRef.current = true
    dispatch({ type: "selectEntity", entity, scene })
    dispatch({ type: "enter" })
    // entity/scene 按契约视为挂载期常量
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ------------------------- SceneController 挂载（token 变化时重挂） ------------------------- */
  useEffect(() => {
    enterTokenRef.current = ctx.enterToken
  }, [ctx.enterToken])

  useEffect(() => {
    if (!canvasEl) return
    const next = new SceneController()
    let ok = false
    try {
      ok = next.mount(canvasEl, scene)
    } catch {
      ok = false
    }
    if (!ok) {
      try { next.dispose() } catch { /* 防御 */ }
      dispatch({ type: "fatalError", reason: "scene_mount_failed" })
      return
    }
    controllerRef.current = next
    next.setQuality(quality)
    next.setReducedMotion(reducedMotion)
    next.syncState(stateRef.current)
    setController(next)
    return () => {
      controllerRef.current = null
      setController(null)
      try { next.dispose() } catch { /* 防御 */ }
    }
    // enterToken：retryEnter / 新目标时重新挂载
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasEl, ctx.enterToken])

  /* -------------------------------- 状态同步到场景 -------------------------------- */
  useEffect(() => {
    stateRef.current = state
    controllerRef.current?.syncState(state)
  }, [state])

  /* -------------------------------- ENTERING：进入时序（可取消） -------------------------------- */
  useEffect(() => {
    if (status !== "ENTERING") return
    const token = ctx.enterToken
    setEnteringBeat(null)
    const cancel = runEnterSequence({
      scene,
      token,
      isCurrent: (t) => mountedRef.current && t === enterTokenRef.current,
      reducedMotion,
      onBeat: (text, index) => setEnteringBeat({ text, index }),
      onDone: () => {
        if (!mountedRef.current || token !== enterTokenRef.current) return
        dispatch({ type: "arrivalComplete" })
      },
    })
    return () => cancel()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, ctx.enterToken])

  /* -------------------------------- ARRIVAL：纯场景观察 -------------------------------- */
  useEffect(() => {
    if (status !== "ARRIVAL") return
    const cancel = runArrivalObserve(scene, reducedMotion, () => dispatch({ type: "introComplete" }))
    return () => cancel()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  /* ---------------- EXPLORE_IDLE：简介结束后自动展开首个主题（避免空场景页） ---------------- */
  useEffect(() => {
    const cameFromArrival = prevStatusRef.current === "ARRIVAL"
    prevStatusRef.current = status
    if (status !== "EXPLORE_IDLE" || !cameFromArrival) return
    // 仅 ARRIVAL→EXPLORE_IDLE（含「跳过简介」）时自动展开；用户主动 clearTheme 回来的不重复展开
    const firstTheme = scene.themes[0]?.id
    if (firstTheme) dispatch({ type: "activateTheme", theme: firstTheme })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  /* -------------------------------- RISK_ACTIVE：播放推进 -------------------------------- */
  const activeRisk = ctx.risk ? scene.risks.find((r) => r.id === ctx.risk?.riskId) ?? null : null
  useEffect(() => {
    if (status !== "RISK_ACTIVE" || !ctx.risk || !activeRisk) return
    const cancel = runRiskPlayback({
      risk: activeRisk,
      stepIndex: ctx.risk.stepIndex,
      playing: ctx.risk.playing,
      onStep: (nextIndex) => dispatch({ type: "riskStep", stepIndex: nextIndex }),
    })
    return () => cancel()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, ctx.risk?.riskId, ctx.risk?.stepIndex, ctx.risk?.playing, activeRisk])

  /* -------------------------------- RETURNING：恢复淡出 → mapRestored -------------------------------- */
  useEffect(() => {
    if (status !== "RETURNING") return
    const timer = setTimeout(() => dispatch({ type: "mapRestored" }), reducedMotion ? 60 : 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  /* -------------------------------- 退出回调：回到 MAP_IDLE 后通知宿主 -------------------------------- */
  useEffect(() => {
    if (status !== "MAP_IDLE") {
      becameActiveRef.current = true
      return
    }
    if (becameActiveRef.current && !exitedRef.current) {
      exitedRef.current = true
      props.onExit(exitOutcomeRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  /* -------------------------------- Esc 逐级返回（§12.4） -------------------------------- */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      if (status === "RISK_ACTIVE") {
        dispatch({ type: "restoreCalm" })
      } else if (status === "THEME_ACTIVE") {
        dispatch({ type: "clearTheme" })
      } else if (status === "SUMMARY" || status === "EXPLORE_IDLE") {
        exitOutcomeRef.current = "return_map"
        dispatch({ type: "returnMap" })
      } else if (status === "ENTERING") {
        exitOutcomeRef.current = "cancel"
        dispatch({ type: "cancelEnter" })
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  /* -------------------------------- 卸载清理（§12.3） -------------------------------- */
  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  /* -------------------------------- 衍生数据 -------------------------------- */
  const defaultPreviewId = useMemo(
    () =>
      ctx.defaultPreviewId ??
      resolveDefaultPreviewId(scene, plannedMonth ?? ctx.plannedMonth, null, new Date().getMonth() + 1),
    [ctx.defaultPreviewId, ctx.plannedMonth, scene, plannedMonth],
  )
  const live = useMemo(() => getLiveBadgeInfo(liveSnapshot), [liveSnapshot])
  const scenePhotos = useMemo(() => getScenePhotos(scene.id), [scene])

  const handleCanvasChange = useCallback((el: HTMLCanvasElement | null) => setCanvasEl(el), [])

  const handleBack = useCallback(() => {
    if (stateRef.current.status === "ENTERING") {
      exitOutcomeRef.current = "cancel"
      dispatch({ type: "cancelEnter" })
    } else {
      exitOutcomeRef.current = "return_map"
      dispatch({ type: "returnMap" })
    }
  }, [dispatch])

  const handleFinishExplore = useCallback(() => dispatch({ type: "finishExplore" }), [dispatch])

  const handleShowFallbackInfo = useCallback(() => {
    exitOutcomeRef.current = "fallback_info"
    dispatch({ type: "returnMap" })
  }, [dispatch])

  const handleRetryEnter = useCallback(() => dispatch({ type: "retryEnter" }), [dispatch])

  const handleSkipIntro = useCallback(() => dispatch({ type: "introComplete" }), [dispatch])

  const handleContinuePlanning = useCallback(() => {
    props.onContinuePlanning?.(entity)
    exitOutcomeRef.current = "continue_planning"
    dispatch({ type: "continuePlanning" })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, entity])

  const handleSummaryReturnMap = useCallback(() => {
    exitOutcomeRef.current = "return_map"
    dispatch({ type: "returnMap" })
  }, [dispatch])

  return (
    <ImmersiveOverlay
      entity={entity}
      scene={scene}
      state={state}
      dispatch={dispatch}
      controller={controller}
      stage={<SceneCanvas onCanvasChange={handleCanvasChange} photos={scenePhotos} reducedMotion={reducedMotion} />}
      defaultPreviewId={defaultPreviewId}
      plannedMonth={plannedMonth}
      live={live}
      hasLiveSnapshot={Boolean(liveSnapshot)}
      enteringBeat={enteringBeat}
      reducedMotion={reducedMotion}
      onBack={handleBack}
      onFinishExplore={handleFinishExplore}
      onShowFallbackInfo={handleShowFallbackInfo}
      onRetryEnter={handleRetryEnter}
      onSkipIntro={handleSkipIntro}
      onAddWishlist={props.onAddWishlist}
      onViewPreparation={props.onViewPreparation}
      onAddJourney={props.onAddJourney}
      onContinuePlanning={handleContinuePlanning}
      onSummaryReturnMap={handleSummaryReturnMap}
    />
  )
}
