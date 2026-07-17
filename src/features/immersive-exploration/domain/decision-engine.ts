/**
 * 沉浸探索 · 旅行判断适配引擎（施工方案 V1.1 §11 / CONTRACT CORE 节）
 *
 * 不使用固定星级，输出动态、可解释的适配结论：
 * - 无选择时按 summaryRules 的代表性语义给出默认总结（§4.7）；
 * - plannedMonth 与 preview 月份冲突、audience 与 activity 不匹配、
 *   limitations 命中 audience.warnings / expert 难度遇敏感人群 → 降级并给原因；
 * - dataCompleteness < 0.5 → insufficient_information，不编造结论。
 * 全部输出中文文案。
 */

import type {
  ActivityDefinition,
  AudienceDefinition,
  DecisionInput,
  ImmersiveSceneDefinition,
  ScenePreset,
  Suitability,
  TravelDecisionSummary,
} from "./types";

const SUITABILITY_ORDER: Suitability[] = [
  "very_suitable",
  "suitable_with_conditions",
  "not_recommended_now",
];

/** 只降不升：target 比 current 更差时取 target */
function downgrade(current: Suitability, target: Suitability): Suitability {
  return SUITABILITY_ORDER.indexOf(target) > SUITABILITY_ORDER.indexOf(current)
    ? target
    : current;
}

/** expert 难度下不建议直接参与的人群 */
const EXPERT_SENSITIVE_AUDIENCES: ReadonlySet<string> = new Set([
  "toddler_family",
  "senior",
  "beginner",
]);

const ACTIONS: TravelDecisionSummary["actions"] = [
  "add_wishlist",
  "view_preparation",
  "add_journey",
  "continue_planning",
  "return_map",
];

function resolvePreview(scene: ImmersiveSceneDefinition, previewId?: string): ScenePreset | undefined {
  if (previewId) {
    const picked = scene.previewPresets.find((p) => p.id === previewId);
    if (picked) return picked;
  }
  // 默认预览语义：代表性时段优先，否则第一个
  return scene.previewPresets.find((p) => p.representative) ?? scene.previewPresets[0];
}

function resolveActivity(scene: ImmersiveSceneDefinition, activityId?: string): ActivityDefinition | undefined {
  if (activityId) {
    const picked = scene.activities.find((a) => a.id === activityId);
    if (picked) return picked;
  }
  const representativeId = scene.summaryRules[0]?.representativeActivityId;
  return scene.activities.find((a) => a.id === representativeId) ?? scene.activities[0];
}

function resolveAudience(scene: ImmersiveSceneDefinition, audienceId?: string): AudienceDefinition | undefined {
  if (!audienceId) return undefined;
  return scene.audiences.find((a) => a.id === audienceId);
}

/** limitations 与 warnings 的命中匹配（等值或互相包含） */
function matchLimitations(limitations: string[], warnings: string[]): string[] {
  return limitations.filter((limit) =>
    warnings.some((warning) => limit === warning || limit.includes(warning) || warning.includes(limit)),
  );
}

/**
 * 构建旅行判断总结。
 * 规则（CONTRACT CORE 节）：
 * ① preview 缺省 → summaryRules 代表预览语义（selectedPreview 留 undefined，bestTimeText 用 summaryRules）；
 * ② activity 缺省 → representativeActivityId；
 * ③ audience 缺省 → 原因注明「未选择具体人群」；
 * ④ audience.allowedActivityIds 不含所选 activity → 至多 suitable_with_conditions 并给原因；
 * ⑤ plannedMonth 不在所选（或默认）preview.months 内 → 降档并说明；
 * ⑥ limitations 命中 audience.warnings，或 difficulty=expert 而遇 toddler_family/senior/beginner
 *    → not_recommended_now 或条件适配 + 警告原因；
 * ⑦ dataCompleteness < 0.5 → insufficient_information，不编造结论；
 * ⑧ actions 固定五种；
 * ⑨ modeBadges 固定 preview/cautions 口径，有 live 数据时附 live: "live"。
 */
export function buildTravelDecisionSummary(input: DecisionInput): TravelDecisionSummary {
  const { scene, plannedMonth, dataCompleteness } = input;
  const rules = scene.summaryRules[0];

  const preview = resolvePreview(scene, input.previewId);
  const activity = resolveActivity(scene, input.activityId);
  const audience = resolveAudience(scene, input.audienceId);

  const modeBadges: TravelDecisionSummary["modeBadges"] = {
    preview: "typical_preview",
    cautions: "risk_simulation",
  };
  if (preview?.sourceMeta?.mode === "live") {
    modeBadges.live = "live";
  }

  const base: TravelDecisionSummary = {
    entityId: scene.id,
    selectedPreview: input.previewId && preview ? preview.label : undefined,
    selectedActivity: activity?.label,
    selectedAudience: audience?.label,
    bestTimeText: input.previewId && preview ? preview.whenText || rules.bestTimeText : rules.bestTimeText,
    bestExperienceText: rules.bestExperienceText,
    suitability: "very_suitable",
    suitabilityReasons: [],
    mainCautions: [],
    preparationItems: rules.preparationItems.slice(),
    actions: ACTIONS.slice(),
    modeBadges,
  };

  // ⑦ 数据完整度不足：不编造适配结论
  if (dataCompleteness < 0.5) {
    base.suitability = "insufficient_information";
    base.suitabilityReasons = [
      "当前可用信息不足（数据完整度较低），无法给出可靠的适配结论",
      "建议查看准备事项并参考官方最新信息后再做判断",
    ];
    return base;
  }

  let suitability: Suitability = "very_suitable";
  const reasons: string[] = [];
  const cautions: string[] = [];

  // ③ 人群缺省
  if (!audience) {
    reasons.push("未选择具体人群，以下结论按一般情况给出");
  }

  if (activity && !activity.applicable) {
    suitability = downgrade(suitability, "not_recommended_now");
    reasons.push(`玩法「${activity.label}」当前不可用，暂不建议选择`);
  }

  // ④ 人群与玩法不匹配
  if (audience && activity && audience.allowedActivityIds.length > 0
      && !audience.allowedActivityIds.includes(activity.id)) {
    suitability = downgrade(suitability, "suitable_with_conditions");
    reasons.push(`玩法「${activity.label}」不在「${audience.label}」的推荐玩法范围内，需要满足额外条件`);
  }

  // ⑤ 计划月份与景色/时段冲突
  if (plannedMonth != null && preview && preview.months.length > 0
      && !preview.months.includes(plannedMonth)) {
    suitability = downgrade(suitability, "suitable_with_conditions");
    reasons.push(
      `计划月份（${plannedMonth} 月）不在「${preview.label}」的典型月份（${preview.months.join("、")} 月）内，景色可能与预览有差异`,
    );
  }

  // ⑥ 玩法限制命中人群注意事项 / expert 难度遇敏感人群
  if (audience && activity) {
    const hits = matchLimitations(activity.limitations ?? [], audience.warnings ?? []);
    if (hits.length > 0) {
      suitability = downgrade(suitability, "suitable_with_conditions");
      reasons.push(`玩法「${activity.label}」的限制（${hits.join("；")}）与「${audience.label}」的注意事项冲突，需逐项确认后再参与`);
      cautions.push(...hits);
    }
    if (activity.difficulty === "expert" && EXPERT_SENSITIVE_AUDIENCES.has(audience.id)) {
      suitability = downgrade(suitability, "not_recommended_now");
      reasons.push(`玩法「${activity.label}」为专业级难度，暂不建议「${audience.label}」参与`);
    }
  }

  // 主要风险：适用风险场景的判断信号（去重，限量）
  const riskSignals = scene.risks
    .filter((risk) => risk.applicable)
    .flatMap((risk) => risk.warningSignals);
  const mainCautions = Array.from(new Set([...cautions, ...riskSignals])).slice(0, 6);

  if (reasons.length === 0) {
    reasons.push("所选景色、玩法与人群相互匹配，当前适合出行");
  }

  base.suitability = suitability;
  base.suitabilityReasons = reasons;
  base.mainCautions = mainCautions;
  return base;
}
