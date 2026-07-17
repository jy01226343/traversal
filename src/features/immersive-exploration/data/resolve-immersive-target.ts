/**
 * 沉浸入口解析（main.jsx 入口用，CONTRACT DATA 节）
 *
 * 仅当 Attraction 适配出的 entity 命中黄金样例三件套配置时返回
 * { entity, scene }；其余情况（推断失败、generic 场景、time_event、
 * 未启用家族）返回 null —— 调用方走标准图文降级页。
 */

import type { Attraction } from "../../attraction-explorer/types";
import type { ExplorationEntity, ImmersiveSceneDefinition } from "../domain/types";
import { toExplorationEntity } from "./adapters/attraction-adapter";
import { GOLDEN_ENTITIES, getSceneDefinition } from "./scene-configs";

export interface ImmersiveTarget {
  entity: ExplorationEntity;
  scene: ImmersiveSceneDefinition;
}

export function resolveImmersiveTarget(attraction: Attraction): ImmersiveTarget | null {
  const entity = toExplorationEntity(attraction);
  if (!entity) return null;
  const scene = getSceneDefinition(entity.sceneDefinitionId);
  if (!scene) return null;
  return { entity, scene };
}

/**
 * 快捷验收入口：直接按黄金样例 entityId（如 "mount-fuji"）构造目标，
 * 跳过 Attraction 适配——供 ?ix=<entityId> 直达链接使用。
 */
export function resolveImmersiveTargetByEntityId(entityId: string): ImmersiveTarget | null {
  const entity = GOLDEN_ENTITIES[entityId];
  if (!entity) return null;
  const scene = getSceneDefinition(entity.sceneDefinitionId);
  if (!scene) return null;
  return { entity, scene };
}
