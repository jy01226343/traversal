/**
 * 沉浸式景点探索 · 公共出口
 * 集成方（main.jsx）只需从本文件 import。
 */

export { ImmersiveExperience } from "./ui/ImmersiveExperience";
export type { ImmersiveExperienceProps } from "./ui/ImmersiveExperience";
export { resolveImmersiveTarget } from "./data/resolve-immersive-target";
export type { ImmersiveTarget } from "./data/resolve-immersive-target";
export { toExplorationEntity, isImmersiveEligible } from "./data/adapters/attraction-adapter";
export { getSceneDefinition, GOLDEN_SCENE_IDS } from "./data/scene-configs";
export { isImmersiveExplorationEnabled } from "./config";
export {
  trackImmersiveEvent,
  readImmersiveEvents,
  clearImmersiveEvents,
  setImmersiveEventSink,
} from "./analytics/immersive-events";
export type {
  ExplorationEntity,
  ImmersiveSceneDefinition,
  SceneFamily,
  ExplorationEntityShape,
  TravelDecisionSummary,
  Suitability,
} from "./domain/types";
