/**
 * 沉浸探索 · 运行期数据校验（手写校验器，不用 zod；CONTRACT CORE 节）
 *
 * - validateSceneDefinition：场景定义必填字段 / 四公共主题 / 锚点 positionRef 格式 /
 *   risks.mode 必须 "risk_simulation" / previewPresets.mode 必须 "typical_preview" /
 *   给出 knownNodeNames 时校验 `node:` 引用可解析。
 * - validateExplorationEntity：id / name / shape / sceneFamily / sceneDefinitionId。
 *
 * 返回错误信息数组，空数组 = 通过。
 */

import type {
  AnchorType,
  ExplorationEntityShape,
  ImmersiveTheme,
  SceneFamily,
} from "./types";

const VALID_FAMILIES: readonly SceneFamily[] = [
  "mountain",
  "waterside",
  "underwater",
  "wilderness",
  "human_city",
  "engineering_route",
];

const VALID_SHAPES: readonly ExplorationEntityShape[] = [
  "point",
  "area",
  "route",
  "activity_site",
  "time_event",
];

const VALID_ANCHOR_TYPES: readonly AnchorType[] = [
  "peak",
  "viewpoint",
  "route",
  "facility",
  "activity_zone",
  "ecology",
  "risk_zone",
];

/** 四个公共主题（§1 冻结规则），每个场景必须齐全 */
const COMMON_THEMES: readonly ImmersiveTheme[] = [
  "highlights",
  "experience",
  "audience",
  "cautions",
];

const VALID_THEMES: readonly ImmersiveTheme[] = [
  ...COMMON_THEMES,
  "nature_geology",
  "water_ecology",
  "underwater_ecology",
  "story_past",
  "engineering_operation",
];

/** positionRef：`node:<节点名>` 或 `xyz:<x>,<y>,<z>` */
const POSITION_REF_RE = /^(?:node:[A-Za-z0-9_-]+|xyz:-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?)$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isVec3(value: unknown): boolean {
  return Array.isArray(value) && value.length === 3 && value.every(isFiniteNumber);
}

function validateAnchor(anchor: unknown, index: number, knownNodeNames: readonly string[] | undefined, errors: string[]): void {
  const where = `anchors[${index}]`;
  if (!isRecord(anchor)) {
    errors.push(`${where} 必须是对象`);
    return;
  }
  if (!isNonEmptyString(anchor.id)) errors.push(`${where}.id 缺失或为空`);
  if (!isNonEmptyString(anchor.label)) errors.push(`${where}.label 缺失或为空`);
  if (!VALID_ANCHOR_TYPES.includes(anchor.anchorType as AnchorType)) {
    errors.push(`${where}.anchorType 非法：${String(anchor.anchorType)}`);
  }
  if (typeof anchor.positionRef !== "string" || !POSITION_REF_RE.test(anchor.positionRef)) {
    errors.push(`${where}.positionRef 格式非法（须为 node:<名> 或 xyz:<x>,<y>,<z>）：${String(anchor.positionRef)}`);
  } else if (knownNodeNames && anchor.positionRef.startsWith("node:")) {
    const nodeName = anchor.positionRef.slice("node:".length);
    if (!knownNodeNames.includes(nodeName)) {
      errors.push(`${where}.positionRef 引用的节点名无法解析：${nodeName}`);
    }
  }
  if (!isNonEmptyString(anchor.contentId)) errors.push(`${where}.contentId 缺失或为空`);
  if (!isFiniteNumber(anchor.priority)) errors.push(`${where}.priority 必须是数字`);
  if (!Array.isArray(anchor.themes) || !anchor.themes.every((t) => VALID_THEMES.includes(t as ImmersiveTheme))) {
    errors.push(`${where}.themes 含非法主题`);
  }
}

function validatePreset(preset: unknown, index: number, errors: string[]): void {
  const where = `previewPresets[${index}]`;
  if (!isRecord(preset)) {
    errors.push(`${where} 必须是对象`);
    return;
  }
  if (!isNonEmptyString(preset.id)) errors.push(`${where}.id 缺失或为空`);
  if (!isNonEmptyString(preset.label)) errors.push(`${where}.label 缺失或为空`);
  if (preset.mode !== "typical_preview") {
    errors.push(`${where}.mode 必须是 "typical_preview"：${String(preset.mode)}`);
  }
  if (!Array.isArray(preset.months) || !preset.months.every((m) => Number.isInteger(m) && (m as number) >= 1 && (m as number) <= 12)) {
    errors.push(`${where}.months 必须是 1-12 的整数数组`);
  }
}

function validateRisk(risk: unknown, index: number, errors: string[]): void {
  const where = `risks[${index}]`;
  if (!isRecord(risk)) {
    errors.push(`${where} 必须是对象`);
    return;
  }
  if (!isNonEmptyString(risk.id)) errors.push(`${where}.id 缺失或为空`);
  if (!isNonEmptyString(risk.label)) errors.push(`${where}.label 缺失或为空`);
  if (risk.mode !== "risk_simulation") {
    errors.push(`${where}.mode 必须是 "risk_simulation"：${String(risk.mode)}`);
  }
  if (!Array.isArray(risk.sequence) || risk.sequence.length === 0) {
    errors.push(`${where}.sequence 必须是非空数组`);
  }
}

/** 场景定义校验：返回错误信息数组，空 = 通过 */
export function validateSceneDefinition(scene: unknown, knownNodeNames?: readonly string[]): string[] {
  const errors: string[] = [];
  if (!isRecord(scene)) return ["场景定义必须是对象"];

  if (!isNonEmptyString(scene.id)) errors.push("id 缺失或为空");
  if (!VALID_FAMILIES.includes(scene.family as SceneFamily)) {
    errors.push(`family 非法：${String(scene.family)}`);
  }
  if (!isNonEmptyString(scene.entityName)) errors.push("entityName 缺失或为空");
  if (!isNonEmptyString(scene.regionLabel)) errors.push("regionLabel 缺失或为空");

  // defaultCamera
  if (!isRecord(scene.defaultCamera) || !isVec3(scene.defaultCamera.position) || !isVec3(scene.defaultCamera.lookAt)) {
    errors.push("defaultCamera.position / lookAt 必须是三元数字数组");
  }

  // arrival
  if (!isRecord(scene.arrival)) {
    errors.push("arrival 缺失");
  } else {
    if (!isNonEmptyString(scene.arrival.subtitle)) errors.push("arrival.subtitle 缺失或为空");
    if (!isNonEmptyString(scene.arrival.headlineSight)) errors.push("arrival.headlineSight 缺失或为空");
    if (!isNonEmptyString(scene.arrival.headlineActivity)) errors.push("arrival.headlineActivity 缺失或为空");
    if (!isFiniteNumber(scene.arrival.observeMs) || scene.arrival.observeMs < 0) {
      errors.push("arrival.observeMs 必须是非负数字");
    }
    if (!isStringArray(scene.arrival.transitionBeats) || scene.arrival.transitionBeats.length === 0) {
      errors.push("arrival.transitionBeats 必须是非空字符串数组");
    }
  }

  // themes：必须包含四个公共主题
  if (!Array.isArray(scene.themes)) {
    errors.push("themes 缺失或不是数组");
  } else {
    const ids = scene.themes.map((t) => (isRecord(t) ? t.id : undefined));
    for (const common of COMMON_THEMES) {
      if (!ids.includes(common)) errors.push(`themes 缺少公共主题：${common}`);
    }
    for (const id of ids) {
      if (id !== undefined && !VALID_THEMES.includes(id as ImmersiveTheme)) {
        errors.push(`themes 含非法主题：${String(id)}`);
      }
    }
  }

  // anchors
  if (!Array.isArray(scene.anchors)) {
    errors.push("anchors 缺失或不是数组");
  } else {
    scene.anchors.forEach((anchor, index) => validateAnchor(anchor, index, knownNodeNames, errors));
  }

  // previewPresets
  if (!Array.isArray(scene.previewPresets) || scene.previewPresets.length === 0) {
    errors.push("previewPresets 必须是非空数组");
  } else {
    scene.previewPresets.forEach((preset, index) => validatePreset(preset, index, errors));
  }

  // activities / audiences（必填字段轻校验）
  if (!Array.isArray(scene.activities)) {
    errors.push("activities 缺失或不是数组");
  } else {
    scene.activities.forEach((activity, index) => {
      if (!isRecord(activity) || !isNonEmptyString(activity.id) || !isNonEmptyString(activity.label)) {
        errors.push(`activities[${index}].id / label 缺失或为空`);
      }
    });
  }
  if (!Array.isArray(scene.audiences)) {
    errors.push("audiences 缺失或不是数组");
  } else {
    scene.audiences.forEach((audience, index) => {
      if (!isRecord(audience) || !isNonEmptyString(audience.id) || !isNonEmptyString(audience.label)
          || !isStringArray(audience.allowedActivityIds)) {
        errors.push(`audiences[${index}].id / label / allowedActivityIds 缺失或非法`);
      }
    });
  }

  // risks
  if (!Array.isArray(scene.risks)) {
    errors.push("risks 缺失或不是数组");
  } else {
    scene.risks.forEach((risk, index) => validateRisk(risk, index, errors));
  }

  // summaryRules
  if (!Array.isArray(scene.summaryRules) || scene.summaryRules.length === 0) {
    errors.push("summaryRules 必须是非空数组");
  } else {
    scene.summaryRules.forEach((rule, index) => {
      if (!isRecord(rule)) {
        errors.push(`summaryRules[${index}] 必须是对象`);
        return;
      }
      if (!isNonEmptyString(rule.representativeActivityId)) errors.push(`summaryRules[${index}].representativeActivityId 缺失或为空`);
      if (!isNonEmptyString(rule.bestTimeText)) errors.push(`summaryRules[${index}].bestTimeText 缺失或为空`);
      if (!isNonEmptyString(rule.bestExperienceText)) errors.push(`summaryRules[${index}].bestExperienceText 缺失或为空`);
      if (!isStringArray(rule.preparationItems)) errors.push(`summaryRules[${index}].preparationItems 必须是字符串数组`);
    });
  }

  // assets
  if (!isRecord(scene.assets) || !isStringArray(scene.assets.proceduralNodes) || !isFiniteNumber(scene.assets.estimatedBytes)) {
    errors.push("assets.proceduralNodes / estimatedBytes 缺失或非法");
  }

  // fallback
  if (!isRecord(scene.fallback) || !isNonEmptyString(scene.fallback.summary) || !Array.isArray(scene.fallback.sections)) {
    errors.push("fallback.summary / sections 缺失或非法");
  }

  return errors;
}

/** 探索对象校验：id / name / shape / sceneFamily / sceneDefinitionId */
export function validateExplorationEntity(entity: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(entity)) return ["探索对象必须是对象"];

  if (!isNonEmptyString(entity.id)) errors.push("id 缺失或为空");
  if (!isNonEmptyString(entity.name)) errors.push("name 缺失或为空");
  if (!VALID_SHAPES.includes(entity.shape as ExplorationEntityShape)) {
    errors.push(`shape 非法：${String(entity.shape)}`);
  }
  if (!VALID_FAMILIES.includes(entity.sceneFamily as SceneFamily)) {
    errors.push(`sceneFamily 非法：${String(entity.sceneFamily)}`);
  }
  if (!isNonEmptyString(entity.sceneDefinitionId)) errors.push("sceneDefinitionId 缺失或为空");

  return errors;
}
