/**
 * 黄金样例配置校验器（CONTRACT DATA 节）
 *
 * CONTRACT_NODE_NAMES 与 CONTRACT「语义节点名握手」完全一致（冻结）。
 * validateGoldenSamples() 对三件套跑内容量校验 + 禁用文案扫描，返回错误数组（空 = 通过）。
 *
 * 备注：CORE Worker 的 domain/schemas.ts（validateSceneDefinition(scene, knownNodeNames)）
 * 就绪后，本文件可切换为复用该校验器做 schema 层校验；当前为 DATA 侧手写最小校验，
 * 聚焦契约内容量下限（anchors 6–8、五主题覆盖、presets/activities/audiences/risks 数量、
 * positionRef 可解析、水下六拍、fallback 五主题、禁用文案零命中）。
 */

import type {
  AnchorContent,
  ImmersiveSceneDefinition,
  SceneFamily,
} from "../../domain/types";
import { findForbiddenCopy } from "./copy-validator";
import {
  GOLDEN_ANCHOR_CONTENTS,
  GOLDEN_SCENE_IDS,
  getSceneDefinition,
} from "../scene-configs";

// ---------------------------------------------------------------- 契约节点名（冻结，与 CONTRACT §SCENES 一致）

export const CONTRACT_NODE_NAMES: Record<"mountain" | "waterside" | "underwater", readonly string[]> = {
  mountain: [
    "peak",
    "crater",
    "trail_main",
    "trail_family",
    "viewpoint_a",
    "viewpoint_b",
    "station_5th",
    "snow_line",
    "vegetation_alpine",
    "risk_slope",
  ],
  waterside: [
    "shore_walk",
    "pier",
    "boat_zone",
    "paddle_zone",
    "viewpoint_a",
    "viewpoint_b",
    "wetland",
    "lakeside_trail",
    "risk_open_water",
  ],
  underwater: [
    "entry_point",
    "reef_flat",
    "coral_garden",
    "seagrass",
    "cave",
    "drop_off",
    "fish_school",
    "turtle_zone",
    "boat_channel",
    "risk_current",
  ],
} as const;

/** 水下进入叙事六拍（契约冻结，逐字匹配） */
const UNDERWATER_TRANSITION_BEATS = [
  "接近水面",
  "穿过水面",
  "光线和空间状态变化",
  "水下场景稳定",
  "生态对象进入",
  "主题入口出现",
] as const;

const POSITION_REF_PATTERN = /^(node:[A-Za-z0-9_]+|xyz:-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?)$/;

// ---------------------------------------------------------------- 单场景校验（导出供测试构造反例）

/**
 * 对单个场景定义跑契约内容量校验。
 * @param scene 场景定义
 * @param anchorContents 该场景的锚点说明内容（与 anchors.contentId 一一对应）
 * @returns 错误信息数组，空 = 通过
 */
export function validateSceneConfig(
  scene: ImmersiveSceneDefinition,
  anchorContents: readonly AnchorContent[],
): string[] {
  const errors: string[] = [];
  const prefix = `[${scene.id}]`;

  const nodeNames = CONTRACT_NODE_NAMES[scene.family as keyof typeof CONTRACT_NODE_NAMES];
  if (!nodeNames) {
    errors.push(`${prefix} family "${scene.family}" 无契约节点名集合（首期仅启用 mountain/waterside/underwater）`);
    return errors;
  }
  const nodeNameSet = new Set(nodeNames);

  // ---- anchors：6–8 个、positionRef 可解析、priority 各异、五主题全覆盖、contentId 一一对应
  if (scene.anchors.length < 6 || scene.anchors.length > 8) {
    errors.push(`${prefix} anchors 数量 ${scene.anchors.length}，契约要求 6–8`);
  }
  const priorities = new Set<number>();
  const coveredThemes = new Set<string>();
  const anchorIds = new Set<string>();
  for (const anchor of scene.anchors) {
    anchorIds.add(anchor.id);
    if (!POSITION_REF_PATTERN.test(anchor.positionRef)) {
      errors.push(`${prefix} anchor "${anchor.id}" positionRef "${anchor.positionRef}" 格式非法（需 node:<name> 或 xyz:<x>,<y>,<z>）`);
    } else if (anchor.positionRef.startsWith("node:")) {
      const name = anchor.positionRef.slice("node:".length);
      if (!nodeNameSet.has(name)) {
        errors.push(`${prefix} anchor "${anchor.id}" positionRef 引用未知节点 "${name}"`);
      }
    }
    if (priorities.has(anchor.priority)) {
      errors.push(`${prefix} anchor "${anchor.id}" priority ${anchor.priority} 与其他锚点重复`);
    }
    priorities.add(anchor.priority);
    for (const theme of anchor.themes) coveredThemes.add(theme);
  }
  for (const theme of scene.themes) {
    if (!coveredThemes.has(theme.id)) {
      errors.push(`${prefix} 主题 "${theme.id}" 未被任何 anchor.themes 覆盖`);
    }
  }
  const contentIds = new Set(anchorContents.map((c) => c.id));
  for (const anchor of scene.anchors) {
    if (!contentIds.has(anchor.contentId)) {
      errors.push(`${prefix} anchor "${anchor.id}" contentId "${anchor.contentId}" 无对应 AnchorContent`);
    }
  }
  const anchorContentIds = new Set(scene.anchors.map((a) => a.contentId));
  for (const content of anchorContents) {
    if (!anchorContentIds.has(content.id)) {
      errors.push(`${prefix} AnchorContent "${content.id}" 未被任何 anchor.contentId 引用`);
    }
  }

  // ---- previewPresets：≥3、至少一个 representative、months 合法
  if (scene.previewPresets.length < 3) {
    errors.push(`${prefix} previewPresets 数量 ${scene.previewPresets.length}，契约要求 ≥3`);
  }
  if (!scene.previewPresets.some((p) => p.representative)) {
    errors.push(`${prefix} previewPresets 缺少 representative=true 的代表性时段`);
  }
  for (const preset of scene.previewPresets) {
    if (preset.months.some((m) => !Number.isInteger(m) || m < 1 || m > 12)) {
      errors.push(`${prefix} preset "${preset.id}" months 含非法月份`);
    }
    if (preset.mode !== "typical_preview") {
      errors.push(`${prefix} preset "${preset.id}" mode 必须为 "typical_preview"`);
    }
    if (preset.sourceMeta.mode !== "typical_preview") {
      errors.push(`${prefix} preset "${preset.id}" sourceMeta.mode 必须为 "typical_preview"`);
    }
  }

  // ---- activities / audiences 数量下限
  if (scene.activities.length < 4) {
    errors.push(`${prefix} activities 数量 ${scene.activities.length}，契约要求 ≥4`);
  }
  if (scene.audiences.length < 4) {
    errors.push(`${prefix} audiences 数量 ${scene.audiences.length}，契约要求 ≥4`);
  }

  // ---- risks：≥2、applicable、sequence ≥3、cause/warningSignals/actions/impactTexts 完整
  if (scene.risks.length < 2) {
    errors.push(`${prefix} risks 数量 ${scene.risks.length}，契约要求 ≥2`);
  }
  for (const risk of scene.risks) {
    if (!risk.applicable) {
      errors.push(`${prefix} risk "${risk.id}" applicable 必须为 true`);
    }
    if (risk.mode !== "risk_simulation") {
      errors.push(`${prefix} risk "${risk.id}" mode 必须为 "risk_simulation"`);
    }
    if (risk.sequence.length < 3) {
      errors.push(`${prefix} risk "${risk.id}" sequence 仅 ${risk.sequence.length} 步，契约要求 ≥3`);
    }
    if (risk.cause.length === 0) {
      errors.push(`${prefix} risk "${risk.id}" cause（形成原因）为空`);
    }
    if (risk.warningSignals.length === 0) {
      errors.push(`${prefix} risk "${risk.id}" warningSignals（判断信号）为空`);
    }
    if (risk.actions.length === 0) {
      errors.push(`${prefix} risk "${risk.id}" actions（行动建议）为空`);
    }
    const impact = risk.impactTexts;
    if (!impact.shoreText && !impact.familyText && !impact.waterText && !impact.routeText) {
      errors.push(`${prefix} risk "${risk.id}" impactTexts 至少需一个影响说明（shore/family/water/route）`);
    }
    for (const affectedId of risk.affectedAnchorIds) {
      if (!anchorIds.has(affectedId)) {
        errors.push(`${prefix} risk "${risk.id}" affectedAnchorIds 引用不存在的锚点 "${affectedId}"`);
      }
    }
  }

  // ---- 水下：进入叙事六拍逐字匹配
  if (scene.family === "underwater") {
    const beats = scene.arrival.transitionBeats;
    if (
      beats.length !== UNDERWATER_TRANSITION_BEATS.length ||
      !UNDERWATER_TRANSITION_BEATS.every((beat, i) => beats[i] === beat)
    ) {
      errors.push(`${prefix} 水下场景 arrival.transitionBeats 必须为契约六拍：${UNDERWATER_TRANSITION_BEATS.join("→")}`);
    }
  }

  // ---- fallback：sections 覆盖全部主题
  const fallbackThemes = new Set(scene.fallback.sections.map((s) => s.theme));
  for (const theme of scene.themes) {
    if (!fallbackThemes.has(theme.id)) {
      errors.push(`${prefix} fallback.sections 缺少主题 "${theme.id}"`);
    }
  }

  // ---- assets：proceduralNodes ⊆ 契约节点名、estimatedBytes 为有限数值
  for (const node of scene.assets.proceduralNodes) {
    if (!nodeNameSet.has(node)) {
      errors.push(`${prefix} assets.proceduralNodes 含未知节点 "${node}"`);
    }
  }
  if (!Number.isFinite(scene.assets.estimatedBytes) || scene.assets.estimatedBytes < 0) {
    errors.push(`${prefix} assets.estimatedBytes 非法：${scene.assets.estimatedBytes}`);
  }

  // ---- 禁用文案扫描（scene + anchorContents 全量文本）
  const copyTargets: Array<[string, string]> = [
    ["scene", JSON.stringify(scene)],
    ["anchorContents", JSON.stringify(anchorContents)],
  ];
  for (const [label, text] of copyTargets) {
    for (const hit of findForbiddenCopy(text)) {
      errors.push(`${prefix} ${label} 命中禁用文案：${hit}`);
    }
  }

  return errors;
}

// ---------------------------------------------------------------- 三件套总校验

/**
 * 对黄金样例三件套跑全部校验。
 * @returns 错误信息数组，空数组 = 全部通过
 */
export function validateGoldenSamples(): string[] {
  const errors: string[] = [];
  for (const sceneId of GOLDEN_SCENE_IDS) {
    const scene = getSceneDefinition(sceneId);
    if (!scene) {
      errors.push(`场景 "${sceneId}" 未注册（getSceneDefinition 返回 null）`);
      continue;
    }
    const anchorContents = GOLDEN_ANCHOR_CONTENTS[sceneId] ?? [];
    errors.push(...validateSceneConfig(scene, anchorContents));
  }
  return errors;
}

// 供外部按 family 查询契约节点名（类型收敛到已启用家族）
export function getContractNodeNames(family: SceneFamily): readonly string[] {
  return CONTRACT_NODE_NAMES[family as keyof typeof CONTRACT_NODE_NAMES] ?? [];
}
