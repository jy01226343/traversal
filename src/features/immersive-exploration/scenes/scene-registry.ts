/**
 * 沉浸式景点探索 · 场景注册表（SCENES 拥有）
 *
 * 契约（CONTRACT.md §SCENES）：导出 SceneFactory / SceneHandle / getSceneFactory。
 * 六大家族均已注册；若某家族被移除注册，getSceneFactory 返回 null，调用方走 FALLBACK。
 *
 * 注意：本模块静态 import 三个场景工厂模块——这些模块顶层只有常量与函数定义，
 * `new WebGLRenderer` 只发生在工厂函数被调用时，因此 jsdom 下 import 本模块是安全的。
 */
import type {
  ActivityDefinition,
  AudienceDefinition,
  ImmersiveSceneDefinition,
  ImmersiveTheme,
  RiskScenarioDefinition,
  SceneFamily,
  ScenePreset,
} from "../domain/types"
import { createMountainScene } from "./mountain/MountainScene"
import { createWatersideScene } from "./waterside/WatersideScene"
import { createUnderwaterScene } from "./underwater/UnderwaterScene"
import { createWildernessScene } from "./wilderness/WildernessScene"
import { createHumanCityScene } from "./human_city/HumanCityScene"
import { createEngineeringRouteScene } from "./engineering_route/EngineeringRouteScene"

export type SceneFactory = (canvas: HTMLCanvasElement, scene: ImmersiveSceneDefinition) => SceneHandle

export interface SceneHandle {
  applyTheme(theme: ImmersiveTheme | null): void
  applyPreset(preset: ScenePreset | null): void
  applyActivity(activity: ActivityDefinition | null): void
  applyAudience(audience: AudienceDefinition | null): void
  applyRiskStep(risk: RiskScenarioDefinition, stepIndex: number): void
  restoreCalm(): void
  setAnchorEmphasis(selectedAnchorId: string | null, dimmedIds: ReadonlySet<string>): void
  projectToScreen(positionRef: string): { x: number; y: number } | null
  onFrame(cb: () => void): () => void
  setQuality(q: "high" | "standard" | "low"): void
  setReducedMotion(reduced: boolean): void
  /** V1.2 视角控制：factor<1 放大 / >1 缩小 */
  zoomBy(factor: number): void
  /** V1.2 视角控制：回默认机位 */
  resetCamera(): void
  /** V1.2 视角控制：自动环绕（reducedMotion 或用户拖拽时自动关闭） */
  setAutoRotate(on: boolean): void
  dispose(): void
}

const FACTORIES: Partial<Record<SceneFamily, SceneFactory>> = {
  mountain: createMountainScene,
  waterside: createWatersideScene,
  underwater: createUnderwaterScene,
  wilderness: createWildernessScene,
  human_city: createHumanCityScene,
  engineering_route: createEngineeringRouteScene,
}

/** 未启用家族 → null（调用方走标准图文降级页）。 */
export function getSceneFactory(family: SceneFamily): SceneFactory | null {
  return FACTORIES[family] ?? null
}
