/**
 * 黄金样例三件套注册表（CONTRACT DATA 节）
 *
 * getSceneDefinition(id)：仅三件套命中返回场景定义，其余（含 scene-<family>-generic）
 * 返回 null —— 调用方走标准图文降级。
 */

import type { AnchorContent, ExplorationEntity, ImmersiveSceneDefinition } from "../../domain/types";
import {
  MOUNT_FUJI_ENTITY,
  MOUNT_FUJI_SCENE,
  MOUNT_FUJI_ANCHOR_CONTENTS,
} from "./mount-fuji";
import {
  LAKE_TOYA_ENTITY,
  LAKE_TOYA_SCENE,
  LAKE_TOYA_ANCHOR_CONTENTS,
} from "./lake-toya";
import {
  MALDIVES_CORAL_GARDEN_ENTITY,
  MALDIVES_CORAL_GARDEN_SCENE,
  MALDIVES_CORAL_GARDEN_ANCHOR_CONTENTS,
} from "./maldives-coral-garden";
import {
  MASAI_MARA_ENTITY,
  MASAI_MARA_SCENE,
  MASAI_MARA_ANCHOR_CONTENTS,
} from "./masai-mara";
import {
  TOKYO_SKYTREE_ENTITY,
  TOKYO_SKYTREE_SCENE,
  TOKYO_SKYTREE_ANCHOR_CONTENTS,
} from "./tokyo-skytree";
import {
  DUKU_HIGHWAY_ENTITY,
  DUKU_HIGHWAY_SCENE,
  DUKU_HIGHWAY_ANCHOR_CONTENTS,
} from "./duku-highway";

export {
  MOUNT_FUJI_ENTITY,
  MOUNT_FUJI_SCENE,
  MOUNT_FUJI_ANCHOR_CONTENTS,
  LAKE_TOYA_ENTITY,
  LAKE_TOYA_SCENE,
  LAKE_TOYA_ANCHOR_CONTENTS,
  MALDIVES_CORAL_GARDEN_ENTITY,
  MALDIVES_CORAL_GARDEN_SCENE,
  MALDIVES_CORAL_GARDEN_ANCHOR_CONTENTS,
  MASAI_MARA_ENTITY,
  MASAI_MARA_SCENE,
  MASAI_MARA_ANCHOR_CONTENTS,
  TOKYO_SKYTREE_ENTITY,
  TOKYO_SKYTREE_SCENE,
  TOKYO_SKYTREE_ANCHOR_CONTENTS,
  DUKU_HIGHWAY_ENTITY,
  DUKU_HIGHWAY_SCENE,
  DUKU_HIGHWAY_ANCHOR_CONTENTS,
};

/** 冻结的黄金样例 sceneDefinitionId 列表 */
export const GOLDEN_SCENE_IDS: readonly string[] = [
  "scene-mount-fuji",
  "scene-lake-toya",
  "scene-maldives-coral-garden",
  "scene-masai-mara",
  "scene-tokyo-skytree",
  "scene-duku-highway",
] as const;

const SCENE_REGISTRY: Readonly<Record<string, ImmersiveSceneDefinition>> = {
  "scene-mount-fuji": MOUNT_FUJI_SCENE,
  "scene-lake-toya": LAKE_TOYA_SCENE,
  "scene-maldives-coral-garden": MALDIVES_CORAL_GARDEN_SCENE,
  "scene-masai-mara": MASAI_MARA_SCENE,
  "scene-tokyo-skytree": TOKYO_SKYTREE_SCENE,
  "scene-duku-highway": DUKU_HIGHWAY_SCENE,
};

/** 黄金样例 entity 注册表（策展覆盖表命中时直接产出） */
export const GOLDEN_ENTITIES: Readonly<Record<string, ExplorationEntity>> = {
  "mount-fuji": MOUNT_FUJI_ENTITY,
  "lake-toya": LAKE_TOYA_ENTITY,
  "maldives-coral-garden": MALDIVES_CORAL_GARDEN_ENTITY,
  "masai-mara": MASAI_MARA_ENTITY,
  "tokyo-skytree": TOKYO_SKYTREE_ENTITY,
  "duku-highway": DUKU_HIGHWAY_ENTITY,
};

/** 各场景锚点说明内容注册表（key 为 sceneDefinitionId） */
export const GOLDEN_ANCHOR_CONTENTS: Readonly<Record<string, readonly AnchorContent[]>> = {
  "scene-mount-fuji": MOUNT_FUJI_ANCHOR_CONTENTS,
  "scene-lake-toya": LAKE_TOYA_ANCHOR_CONTENTS,
  "scene-maldives-coral-garden": MALDIVES_CORAL_GARDEN_ANCHOR_CONTENTS,
  "scene-masai-mara": MASAI_MARA_ANCHOR_CONTENTS,
  "scene-tokyo-skytree": TOKYO_SKYTREE_ANCHOR_CONTENTS,
  "scene-duku-highway": DUKU_HIGHWAY_ANCHOR_CONTENTS,
};

export function getSceneDefinition(id: string): ImmersiveSceneDefinition | null {
  return SCENE_REGISTRY[id] ?? null;
}
