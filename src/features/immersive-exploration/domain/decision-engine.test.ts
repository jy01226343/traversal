/**
 * decision-engine 测试（CONTRACT CORE 节）：
 * 无选择默认规则 / 人群不匹配降档 / 月份冲突降档 / expert 遇敏感人群 /
 * dataCompleteness < 0.5 → insufficient_information / 固定 actions 与 modeBadges。
 */

import { describe, expect, it } from "vitest";

import { buildTravelDecisionSummary } from "./decision-engine";
import type {
  ActivityDefinition,
  AudienceDefinition,
  ImmersiveSceneDefinition,
  ScenePreset,
} from "./types";

function makePreset(partial: Partial<ScenePreset> & { id: string }): ScenePreset {
  return {
    label: partial.label ?? `时段${partial.id}`,
    months: partial.months ?? [],
    representative: partial.representative ?? false,
    mode: "typical_preview",
    sourceMeta: partial.sourceMeta ?? { mode: "typical_preview" },
    visual: {},
    whereText: "哪里看",
    whenText: "什么时间",
    whyText: "为什么",
    ...partial,
  };
}

function makeActivity(partial: Partial<ActivityDefinition> & { id: string }): ActivityDefinition {
  return {
    label: partial.label ?? `玩法${partial.id}`,
    applicable: partial.applicable ?? true,
    description: "玩法说明",
    sceneActions: [],
    ...partial,
  };
}

function makeAudience(partial: Partial<AudienceDefinition> & { id: AudienceDefinition["id"] }): AudienceDefinition {
  return {
    label: partial.label ?? `人群${partial.id}`,
    allowedActivityIds: partial.allowedActivityIds ?? [],
    ...partial,
  };
}

function makeScene(overrides: Partial<ImmersiveSceneDefinition> = {}): ImmersiveSceneDefinition {
  return {
    id: "scene-test",
    family: "mountain",
    entityName: "测试山",
    regionLabel: "测试地区",
    defaultCamera: { position: [0, 0, 10], lookAt: [0, 0, 0] },
    arrival: {
      subtitle: "副标题",
      headlineSight: "景观",
      headlineActivity: "玩法",
      observeMs: 1200,
      transitionBeats: ["接近", "稳定"],
    },
    themes: [
      { id: "highlights", label: "景色" },
      { id: "experience", label: "怎么玩" },
      { id: "audience", label: "适合谁" },
      { id: "cautions", label: "注意什么" },
    ],
    anchors: [],
    previewPresets: [
      makePreset({ id: "p-auto", representative: true, months: [10, 11], label: "秋季红叶" }),
    ],
    activities: [
      makeActivity({ id: "act-hike", label: "登山徒步", difficulty: "moderate" }),
    ],
    audiences: [makeAudience({ id: "hiker", label: "徒步爱好者", allowedActivityIds: ["act-hike"] })],
    risks: [],
    summaryRules: [
      {
        representativeActivityId: "act-hike",
        representativeReason: "最具代表性的体验",
        bestTimeText: "最佳时间文案",
        bestExperienceText: "最佳体验文案",
        preparationItems: ["准备A", "准备B"],
      },
    ],
    assets: { proceduralNodes: ["peak"], estimatedBytes: 0 },
    fallback: { summary: "降级", sections: [] },
    ...overrides,
  };
}

describe("buildTravelDecisionSummary · 无选择默认规则", () => {
  it("preview/activity/audience 全缺省时按代表性语义输出", () => {
    const summary = buildTravelDecisionSummary({
      scene: makeScene(),
      dataCompleteness: 1,
    });
    // ① preview 缺省：selectedPreview 留 undefined，bestTimeText 用 summaryRules
    expect(summary.selectedPreview).toBeUndefined();
    expect(summary.bestTimeText).toBe("最佳时间文案");
    // ② activity 缺省：representativeActivityId
    expect(summary.selectedActivity).toBe("登山徒步");
    // ③ audience 缺省：原因注明
    expect(summary.suitabilityReasons.some((r) => r.includes("未选择具体人群"))).toBe(true);
    expect(summary.suitability).toBe("very_suitable");
    // ⑧ 固定五种 actions
    expect(summary.actions).toEqual([
      "add_wishlist",
      "view_preparation",
      "add_journey",
      "continue_planning",
      "return_map",
    ]);
    // ⑨ 口径标识
    expect(summary.modeBadges).toEqual({ preview: "typical_preview", cautions: "risk_simulation" });
    expect(summary.preparationItems).toEqual(["准备A", "准备B"]);
  });

  it("全部匹配时给出 very_suitable 且不降档", () => {
    const summary = buildTravelDecisionSummary({
      scene: makeScene(),
      previewId: "p-auto",
      activityId: "act-hike",
      audienceId: "hiker",
      plannedMonth: 10,
      dataCompleteness: 1,
    });
    expect(summary.suitability).toBe("very_suitable");
    expect(summary.selectedPreview).toBe("秋季红叶");
    expect(summary.selectedAudience).toBe("徒步爱好者");
  });
});

describe("buildTravelDecisionSummary · 降档规则", () => {
  it("④ audience.allowedActivityIds 不含所选 activity → 至多 suitable_with_conditions", () => {
    const scene = makeScene({
      activities: [
        makeActivity({ id: "act-hike", label: "登山徒步" }),
        makeActivity({ id: "act-climb", label: "技术攀登" }),
      ],
      audiences: [makeAudience({ id: "hiker", label: "徒步爱好者", allowedActivityIds: ["act-hike"] })],
    });
    const summary = buildTravelDecisionSummary({
      scene,
      activityId: "act-climb",
      audienceId: "hiker",
      dataCompleteness: 1,
    });
    expect(summary.suitability).toBe("suitable_with_conditions");
    expect(summary.suitabilityReasons.some((r) => r.includes("推荐玩法范围"))).toBe(true);
  });

  it("⑤ plannedMonth 不在所选 preview.months 内 → 降档并说明", () => {
    const summary = buildTravelDecisionSummary({
      scene: makeScene(),
      previewId: "p-auto",
      plannedMonth: 3,
      dataCompleteness: 1,
    });
    expect(summary.suitability).toBe("suitable_with_conditions");
    expect(summary.suitabilityReasons.some((r) => r.includes("3 月") && r.includes("典型月份"))).toBe(true);
  });

  it("⑤ plannedMonth 不在默认（代表性）preview.months 内同样降档", () => {
    const summary = buildTravelDecisionSummary({
      scene: makeScene(),
      plannedMonth: 6,
      dataCompleteness: 1,
    });
    expect(summary.suitability).toBe("suitable_with_conditions");
    expect(summary.suitabilityReasons.some((r) => r.includes("6 月"))).toBe(true);
  });

  it("⑥ activity.limitations 命中 audience.warnings → 条件适配 + 警告原因", () => {
    const scene = makeScene({
      activities: [
        makeActivity({ id: "act-hike", label: "登山徒步", limitations: ["需要良好体力"] }),
      ],
      audiences: [
        makeAudience({
          id: "senior",
          label: "银发族",
          allowedActivityIds: ["act-hike"],
          warnings: ["需要良好体力"],
        }),
      ],
    });
    const summary = buildTravelDecisionSummary({
      scene,
      activityId: "act-hike",
      audienceId: "senior",
      dataCompleteness: 1,
    });
    expect(summary.suitability).toBe("suitable_with_conditions");
    expect(summary.suitabilityReasons.some((r) => r.includes("需要良好体力"))).toBe(true);
    expect(summary.mainCautions).toContain("需要良好体力");
  });

  it("⑥ expert 难度遇 toddler_family → not_recommended_now", () => {
    const scene = makeScene({
      activities: [
        makeActivity({ id: "act-exp", label: "专业纵走", difficulty: "expert" }),
      ],
      audiences: [
        makeAudience({ id: "toddler_family", label: "幼儿家庭", allowedActivityIds: ["act-exp"] }),
      ],
    });
    const summary = buildTravelDecisionSummary({
      scene,
      activityId: "act-exp",
      audienceId: "toddler_family",
      dataCompleteness: 1,
    });
    expect(summary.suitability).toBe("not_recommended_now");
    expect(summary.suitabilityReasons.some((r) => r.includes("专业级难度"))).toBe(true);
  });

  it("玩法不可用 → not_recommended_now", () => {
    const scene = makeScene({
      activities: [makeActivity({ id: "act-hike", label: "登山徒步", applicable: false })],
    });
    const summary = buildTravelDecisionSummary({ scene, activityId: "act-hike", dataCompleteness: 1 });
    expect(summary.suitability).toBe("not_recommended_now");
  });
});

describe("buildTravelDecisionSummary · 数据完整度", () => {
  it("⑦ dataCompleteness < 0.5 → insufficient_information，不做适配推断", () => {
    const scene = makeScene({
      activities: [makeActivity({ id: "act-exp", label: "专业纵走", difficulty: "expert" })],
      audiences: [makeAudience({ id: "toddler_family", label: "幼儿家庭", allowedActivityIds: [] })],
    });
    const summary = buildTravelDecisionSummary({
      scene,
      activityId: "act-exp",
      audienceId: "toddler_family",
      plannedMonth: 3,
      dataCompleteness: 0.4,
    });
    expect(summary.suitability).toBe("insufficient_information");
    expect(summary.suitabilityReasons.some((r) => r.includes("信息不足"))).toBe(true);
    // 不编造：不输出专家级/月份等推断原因
    expect(summary.suitabilityReasons.some((r) => r.includes("专业级难度"))).toBe(false);
    expect(summary.suitabilityReasons.some((r) => r.includes("典型月份"))).toBe(false);
  });

  it("dataCompleteness = 0.5 时正常走适配规则", () => {
    const summary = buildTravelDecisionSummary({ scene: makeScene(), dataCompleteness: 0.5 });
    expect(summary.suitability).not.toBe("insufficient_information");
  });
});

describe("buildTravelDecisionSummary · 风险与口径", () => {
  it("mainCautions 汇总适用风险场景的判断信号（去重）", () => {
    const scene = makeScene({
      risks: [
        {
          id: "risk-1",
          label: "强风",
          applicable: true,
          mode: "risk_simulation",
          cause: ["成因"],
          sequence: [{ id: "s1", title: "t", description: "d", sceneActions: [] }],
          affectedAnchorIds: [],
          warningSignals: ["风力增强", "能见度下降"],
          actions: ["撤离"],
          impactTexts: {},
        },
        {
          id: "risk-2",
          label: "不适用风险",
          applicable: false,
          mode: "risk_simulation",
          cause: [],
          sequence: [{ id: "s1", title: "t", description: "d", sceneActions: [] }],
          affectedAnchorIds: [],
          warningSignals: ["不应出现"],
          actions: [],
          impactTexts: {},
        },
      ],
    });
    const summary = buildTravelDecisionSummary({ scene, dataCompleteness: 1 });
    expect(summary.mainCautions).toContain("风力增强");
    expect(summary.mainCautions).toContain("能见度下降");
    expect(summary.mainCautions).not.toContain("不应出现");
  });

  it("preview 带 live 来源时 modeBadges 附 live 标识", () => {
    const scene = makeScene({
      previewPresets: [
        makePreset({ id: "p-live", representative: true, sourceMeta: { mode: "live", sourceName: "实况" } }),
      ],
    });
    const summary = buildTravelDecisionSummary({ scene, previewId: "p-live", dataCompleteness: 1 });
    expect(summary.modeBadges.live).toBe("live");
  });
});
