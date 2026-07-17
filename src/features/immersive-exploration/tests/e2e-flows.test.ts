/**
 * 沉浸探索 · 端到端流程集成测试（施工方案 §13.3，组件级替代 Playwright）
 *
 * 以真实黄金样例三件套 + 冻结状态机 + 决策引擎跑完整闭环。
 * 场景渲染层（WebGL）不在 jsdom 覆盖范围，由 SCENES 注册表测试与手动验证补齐。
 */

import { describe, expect, it } from "vitest";
import { INITIAL_STATE, transition, type ImmersiveState } from "../state/immersive-machine";
import { buildTravelDecisionSummary } from "../domain/decision-engine";
import { getSceneDefinition, GOLDEN_SCENE_IDS } from "../data/scene-configs";
import { resolveImmersiveTarget } from "../data/resolve-immersive-target";
import { validateSceneDefinition } from "../domain/schemas";
import { CONTRACT_NODE_NAMES } from "../data/validators/scene-config-validator";
import type { ExplorationEntity } from "../domain/types";

const FUJI = getSceneDefinition("scene-mount-fuji")!;
const TOYA = getSceneDefinition("scene-lake-toya")!;
const MALDIVES = getSceneDefinition("scene-maldives-coral-garden")!;

const fujiEntity: ExplorationEntity = {
  id: "mount-fuji",
  name: "富士山",
  countryCode: "JPN",
  shape: "point",
  sceneFamily: "mountain",
  channels: ["nature", "outdoor"],
  coordinates: { lat: 35.3606, lng: 138.7274 },
  activityTags: ["hiking"],
  attributeTags: ["volcano"],
  sceneDefinitionId: "scene-mount-fuji",
  fallbackContentId: "fallback-mount-fuji",
};

function enterScene(sceneId: string, entity: ExplorationEntity): ImmersiveState {
  const scene = getSceneDefinition(sceneId)!;
  let s = transition(INITIAL_STATE, { type: "selectEntity", entity, scene });
  s = transition(s, { type: "enter" });
  s = transition(s, { type: "arrivalComplete" });
  s = transition(s, { type: "introComplete" });
  return s;
}

describe("§13.3-1 山地完整闭环：进入→景色→亲子→雷暴→总结→返回", () => {
  it("全链路状态与内容正确", () => {
    let s = enterScene("scene-mount-fuji", fujiEntity);
    expect(s.status).toBe("EXPLORE_IDLE");

    // 看什么：切换秋季红叶 preset
    s = transition(s, { type: "activateTheme", theme: "highlights" });
    const autumn = FUJI.previewPresets.find((p) => p.months.includes(10))!;
    s = transition(s, { type: "selectPreview", previewId: autumn.id });
    expect(s.context.selectedPreviewId).toBe(autumn.id);

    // 怎么体验：亲子短途
    s = transition(s, { type: "activateTheme", theme: "experience" });
    const family = FUJI.activities.find((a) => a.difficulty === "easy")!;
    s = transition(s, { type: "selectActivity", activityId: family.id });

    // 适合谁：幼儿家庭
    s = transition(s, { type: "activateTheme", theme: "audience" });
    s = transition(s, { type: "selectAudience", audienceId: "toddler_family" });

    // 注意什么：雷暴风险演示（仅 cautions 可触发）
    s = transition(s, { type: "activateTheme", theme: "cautions" });
    const thunder = FUJI.risks.find((r) => r.applicable)!;
    s = transition(s, { type: "startRisk", riskId: thunder.id });
    expect(s.status).toBe("RISK_ACTIVE");
    expect(thunder.cause.length).toBeGreaterThan(0);
    expect(thunder.sequence.length).toBeGreaterThanOrEqual(3);
    expect(thunder.warningSignals.length).toBeGreaterThan(0);
    expect(thunder.actions.length).toBeGreaterThan(0);
    s = transition(s, { type: "riskStep", stepIndex: 1 });
    s = transition(s, { type: "pauseRisk" });
    expect(s.context.risk?.playing).toBe(false);
    s = transition(s, { type: "replayRisk" });
    expect(s.context.risk?.stepIndex).toBe(0);
    s = transition(s, { type: "restoreCalm" });
    expect(s.status).toBe("THEME_ACTIVE");
    expect(s.context.risk).toBeNull();

    // 总结：选择上下文驱动，结论非固定星级
    s = transition(s, { type: "finishExplore" });
    expect(s.status).toBe("SUMMARY");
    const summary = buildTravelDecisionSummary({
      scene: FUJI,
      previewId: s.context.selectedPreviewId ?? undefined,
      activityId: s.context.selectedActivityId ?? undefined,
      audienceId: s.context.selectedAudienceId ?? undefined,
      plannedMonth: 10,
      dataCompleteness: 0.9,
    });
    expect(summary.entityId).toBe(FUJI.id); // 引擎以场景 id 标识总结对象（DecisionInput 仅含 scene）
    expect(summary.suitabilityReasons.length).toBeGreaterThan(0);
    expect(summary.modeBadges).toEqual({ preview: "typical_preview", cautions: "risk_simulation" });
    expect(summary.actions).toEqual(["add_wishlist", "view_preparation", "add_journey", "continue_planning", "return_map"]);

    // 返回地图
    s = transition(s, { type: "returnMap" });
    expect(s.status).toBe("RETURNING");
    s = transition(s, { type: "mapRestored" });
    expect(s.status).toBe("MAP_IDLE");
    expect(s.context.entity).toBeNull();
  });
});

describe("§13.3-2 水域闭环：傍晚景色→游船→风浪→心愿（总结动作保持 SUMMARY）", () => {
  it("水域五主题与风险口径", () => {
    const entity: ExplorationEntity = { ...fujiEntity, id: "lake-toya", name: "洞爷湖", sceneFamily: "waterside", sceneDefinitionId: "scene-lake-toya" };
    let s = enterScene("scene-lake-toya", entity);
    expect(TOYA.family).toBe("waterside");

    const evening = TOYA.previewPresets.find((p) => p.representative)!;
    s = transition(s, { type: "activateTheme", theme: "highlights" });
    s = transition(s, { type: "selectPreview", previewId: evening.id });

    const boat = TOYA.activities.find((a) => a.applicable)!;
    s = transition(s, { type: "activateTheme", theme: "experience" });
    s = transition(s, { type: "selectActivity", activityId: boat.id });

    // 风浪风险：水域必须分别说明岸边/亲子/水上影响
    const wind = TOYA.risks.find((r) => r.id.includes("wind") || r.label.includes("风浪"))!;
    expect(wind.impactTexts.shoreText ?? wind.impactTexts.familyText ?? wind.impactTexts.waterText).toBeTruthy();
    s = transition(s, { type: "activateTheme", theme: "cautions" });
    s = transition(s, { type: "startRisk", riskId: wind.id });
    s = transition(s, { type: "restoreCalm" });

    // 加入心愿：业务动作后停留 SUMMARY，可继续返回
    s = transition(s, { type: "finishExplore" });
    const after = transition(s, { type: "summaryAction", action: "add_wishlist" });
    expect(after.status).toBe("SUMMARY");
    expect(transition(after, { type: "returnMap" }).status).toBe("RETURNING");
  });
});

describe("§13.3-3 水下闭环：穿水进入→体验潜水→海流风险→加入 Journey", () => {
  it("水下独立场景与六拍进入叙事", () => {
    expect(MALDIVES.family).toBe("underwater");
    // §9.2 完整穿水叙事六拍
    const beats = MALDIVES.arrival.transitionBeats.join("→");
    expect(beats).toContain("接近水面");
    expect(beats).toContain("穿过水面");
    expect(beats).toContain("水下场景稳定");
    expect(beats).toContain("生态对象进入");
    expect(beats).toContain("主题入口出现");
    expect(MALDIVES.arrival.transitionBeats.length).toBe(6);

    const entity: ExplorationEntity = { ...fujiEntity, id: "maldives-coral-garden", name: "马尔代夫珊瑚花园", sceneFamily: "underwater", sceneDefinitionId: "scene-maldives-coral-garden" };
    let s = enterScene("scene-maldives-coral-garden", entity);

    // 体验潜水 + 初学者
    const dive = MALDIVES.activities.find((a) => a.label.includes("体验潜水"))!;
    s = transition(s, { type: "activateTheme", theme: "experience" });
    s = transition(s, { type: "selectActivity", activityId: dive.id });
    s = transition(s, { type: "activateTheme", theme: "audience" });
    s = transition(s, { type: "selectAudience", audienceId: "beginner" });

    // 海流风险影响路线与活动建议（内容契约）
    const current = MALDIVES.risks.find((r) => r.label.includes("海流"))!;
    expect(current.impactTexts.routeText ?? current.impactTexts.waterText).toBeTruthy();
    s = transition(s, { type: "activateTheme", theme: "cautions" });
    s = transition(s, { type: "startRisk", riskId: current.id });
    s = transition(s, { type: "restoreCalm" });

    // 总结：持证潜水推荐给初学者时必须降档
    const pro = MALDIVES.activities.find((a) => a.difficulty === "expert" || a.label.includes("持证"));
    if (pro) {
      const summary = buildTravelDecisionSummary({
        scene: MALDIVES, activityId: pro.id, audienceId: "beginner", dataCompleteness: 0.9,
      });
      expect(["suitable_with_conditions", "not_recommended_now"]).toContain(summary.suitability);
    }
    s = transition(s, { type: "finishExplore" });
    expect(transition(s, { type: "summaryAction", action: "add_journey" }).status).toBe("SUMMARY");
  });
});

describe("§13.3-4/5 进入中切换目标与取消进入", () => {
  it("ENTERING 中选择新目标：旧目标被替换，enterToken 递增", () => {
    let s = transition(INITIAL_STATE, { type: "selectEntity", entity: fujiEntity, scene: FUJI });
    s = transition(s, { type: "enter" });
    expect(s.status).toBe("ENTERING");
    const token = s.context.enterToken;
    const toyEntity: ExplorationEntity = { ...fujiEntity, id: "lake-toya", sceneFamily: "waterside", sceneDefinitionId: "scene-lake-toya" };
    s = transition(s, { type: "selectEntity", entity: toyEntity, scene: TOYA });
    expect(s.status).toBe("TARGET_SELECTED");
    expect(s.context.entity?.id).toBe("lake-toya");
    expect(s.context.enterToken).toBeGreaterThan(token);
  });

  it("ENTERING → cancelEnter：回到 MAP_IDLE 且上下文无残留", () => {
    let s = transition(INITIAL_STATE, { type: "selectEntity", entity: fujiEntity, scene: FUJI });
    s = transition(s, { type: "enter" });
    s = transition(s, { type: "cancelEnter" });
    expect(s.status).toBe("MAP_IDLE");
    expect(s.context.entity).toBeNull();
    expect(s.context.scene).toBeNull();
    expect(s.context.activeTheme).toBeNull();
    expect(s.context.risk).toBeNull();
  });
});

describe("§13.3-6 资源失败降级：FALLBACK 保留等价信息并可重试", () => {
  it("fatalError → FALLBACK → retryEnter / returnMap", () => {
    let s = enterScene("scene-mount-fuji", fujiEntity);
    s = transition(s, { type: "fatalError", reason: "webgl_context_lost" });
    expect(s.status).toBe("FALLBACK");
    // 等价信息页数据保留
    expect(s.context.entity?.id).toBe("mount-fuji");
    expect(s.context.scene?.fallback.sections.length).toBe(5);
    expect(s.context.error?.reason).toBe("webgl_context_lost");
    // 重试
    const retried = transition(s, { type: "retryEnter" });
    expect(retried.status).toBe("ENTERING");
    expect(retried.context.error).toBeNull();
    // 返回
    expect(transition(s, { type: "returnMap" }).status).toBe("RETURNING");
  });
});

describe("§13.3-7 风险播放中切换主题与直接结束：无残留状态", () => {
  it("RISK_ACTIVE → activateTheme 自动 restore；finishExplore 自动 restore", () => {
    let s = enterScene("scene-mount-fuji", fujiEntity);
    s = transition(s, { type: "activateTheme", theme: "cautions" });
    s = transition(s, { type: "startRisk", riskId: FUJI.risks[0].id });
    s = transition(s, { type: "riskStep", stepIndex: 2 });
    // 播放中切换主题
    s = transition(s, { type: "activateTheme", theme: "highlights" });
    expect(s.status).toBe("THEME_ACTIVE");
    expect(s.context.activeTheme).toBe("highlights");
    expect(s.context.risk).toBeNull();
    // 再次进入风险并直接结束
    s = transition(s, { type: "activateTheme", theme: "cautions" });
    s = transition(s, { type: "startRisk", riskId: FUJI.risks[0].id });
    s = transition(s, { type: "finishExplore" });
    expect(s.status).toBe("SUMMARY");
    expect(s.context.risk).toBeNull();
  });
});

describe("§13.3-8 无选择直接生成总结：默认规则生效", () => {
  it("EXPLORE_IDLE 直达 SUMMARY；默认预览/代表玩法/人群缺省注明", () => {
    let s = enterScene("scene-mount-fuji", fujiEntity);
    s = transition(s, { type: "finishExplore" });
    expect(s.status).toBe("SUMMARY");
    const summary = buildTravelDecisionSummary({ scene: FUJI, dataCompleteness: 0.9 });
    const repActivity = FUJI.activities.find((a) => a.id === FUJI.summaryRules[0]?.representativeActivityId);
    expect(summary.selectedActivity).toBe(repActivity?.label); // 总结输出可读文案（引擎语义：label 而非 id）
    expect(summary.suitabilityReasons.join(" ")).toContain("未选择具体人群");
    expect(summary.bestTimeText).toBeTruthy();
  });

  it("数据不足时输出 insufficient_information，不编造结论", () => {
    const summary = buildTravelDecisionSummary({ scene: FUJI, dataCompleteness: 0.3 });
    expect(summary.suitability).toBe("insufficient_information");
  });
});

describe("黄金样例三件套：schema 全量校验（P1-06）", () => {
  it("三件套通过契约校验且覆盖五主题", () => {
    expect(GOLDEN_SCENE_IDS).toHaveLength(3);
    for (const id of GOLDEN_SCENE_IDS) {
      const scene = getSceneDefinition(id)!;
      const errors = validateSceneDefinition(scene, CONTRACT_NODE_NAMES[scene.family as "mountain" | "waterside" | "underwater"]);
      expect(errors, `${id} 校验错误: ${errors.join("; ")}`).toEqual([]);
      const themeIds = scene.themes.map((t) => t.id);
      for (const common of ["highlights", "experience", "audience", "cautions"]) {
        expect(themeIds).toContain(common);
      }
      expect(themeIds.length).toBe(5);
    }
  });
});

describe("沉浸入口解析（P2-01 / GATE-01 范围冻结）", () => {
  it("三件套景点可沉浸；未命中对象返回 null 走标准图文降级", () => {
    const fuji = resolveImmersiveTarget({ id: "fuji-1", name: "富士山", name_en: "Mount Fuji", country_code: "JPN", region_id: "yamanashi", lat_wgs84: 35.36, lng_wgs84: 138.72, category_l1: "自然风光", category_l2: "山岳", popularity_score: 99, niche_score: 10, tags: ["登山", "火山"], best_season: "7-9月", address: "", rating: null, review_count: null, price: "", opening_hours: "", data_source: "official", source_url: "", image_url: "", score_basis: "", last_updated: "" });
    expect(fuji?.scene.id).toBe("scene-mount-fuji");
    const museum = resolveImmersiveTarget({ id: "m-1", name: "某市博物馆", name_en: "", country_code: "JPN", region_id: "tokyo", lat_wgs84: 35.6, lng_wgs84: 139.7, category_l1: "人文历史", category_l2: "博物馆", popularity_score: 80, niche_score: 20, tags: ["博物馆"], best_season: "全年", address: "", rating: null, review_count: null, price: "", opening_hours: "", data_source: "official", source_url: "", image_url: "", score_basis: "", last_updated: "" });
    expect(museum).toBeNull();
  });
});
