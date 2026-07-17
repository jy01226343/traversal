/**
 * schemas 测试：validateSceneDefinition / validateExplorationEntity 正反例（CONTRACT CORE 节）
 */

import { describe, expect, it } from "vitest";

import { validateExplorationEntity, validateSceneDefinition } from "./schemas";
import type { ImmersiveSceneDefinition } from "./types";

function makeValidScene(): ImmersiveSceneDefinition {
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
      { id: "nature_geology", label: "自然观察" },
    ],
    anchors: [
      {
        id: "a-peak",
        label: "峰顶",
        anchorType: "peak",
        positionRef: "node:peak",
        themes: ["highlights", "nature_geology"],
        contentId: "c-peak",
        priority: 1,
      },
      {
        id: "a-point",
        label: "坐标点",
        anchorType: "viewpoint",
        positionRef: "xyz:1.5,-2,3",
        themes: ["highlights"],
        contentId: "c-point",
        priority: 2,
      },
    ],
    previewPresets: [
      {
        id: "p1",
        label: "秋季",
        months: [10, 11],
        representative: true,
        mode: "typical_preview",
        sourceMeta: { mode: "typical_preview" },
        visual: {},
        whereText: "哪里看",
        whenText: "什么时间",
        whyText: "为什么",
      },
    ],
    activities: [
      { id: "act-1", label: "徒步", applicable: true, description: "说明", sceneActions: [] },
    ],
    audiences: [
      { id: "hiker", label: "徒步爱好者", allowedActivityIds: ["act-1"] },
    ],
    risks: [
      {
        id: "risk-1",
        label: "强风",
        applicable: true,
        mode: "risk_simulation",
        cause: ["成因"],
        sequence: [{ id: "s1", title: "步骤", description: "描述", sceneActions: [] }],
        affectedAnchorIds: [],
        warningSignals: ["信号"],
        actions: ["行动"],
        impactTexts: {},
      },
    ],
    summaryRules: [
      {
        representativeActivityId: "act-1",
        representativeReason: "代表",
        bestTimeText: "最佳时间",
        bestExperienceText: "最佳体验",
        preparationItems: ["准备"],
      },
    ],
    assets: { proceduralNodes: ["peak", "crater"], estimatedBytes: 0 },
    fallback: { summary: "降级摘要", sections: [] },
  };
}

describe("validateSceneDefinition · 正例", () => {
  it("合法场景通过（含 knownNodeNames 解析）", () => {
    expect(validateSceneDefinition(makeValidScene(), ["peak", "crater"])).toEqual([]);
  });

  it("不提供 knownNodeNames 时 node: 引用不做解析校验", () => {
    const scene = makeValidScene();
    scene.anchors[0].positionRef = "node:unknown_node";
    expect(validateSceneDefinition(scene)).toEqual([]);
  });
});

describe("validateSceneDefinition · 反例", () => {
  it("非对象直接报错", () => {
    expect(validateSceneDefinition(null).length).toBeGreaterThan(0);
    expect(validateSceneDefinition("x").length).toBeGreaterThan(0);
  });

  it("缺少公共主题时报错", () => {
    const scene = makeValidScene();
    scene.themes = scene.themes.filter((t) => t.id !== "cautions");
    const errors = validateSceneDefinition(scene);
    expect(errors.some((e) => e.includes("cautions"))).toBe(true);
  });

  it("positionRef 格式非法时报错", () => {
    const scene = makeValidScene();
    scene.anchors[0].positionRef = "peak";
    const errors = validateSceneDefinition(scene);
    expect(errors.some((e) => e.includes("positionRef") && e.includes("格式非法"))).toBe(true);
  });

  it("给出 knownNodeNames 时 node: 引用不可解析报错", () => {
    const scene = makeValidScene();
    scene.anchors[0].positionRef = "node:ghost";
    const errors = validateSceneDefinition(scene, ["peak", "crater"]);
    expect(errors.some((e) => e.includes("ghost") && e.includes("无法解析"))).toBe(true);
  });

  it("锚点 contentId 为空时报错", () => {
    const scene = makeValidScene();
    scene.anchors[0].contentId = "";
    const errors = validateSceneDefinition(scene);
    expect(errors.some((e) => e.includes("contentId"))).toBe(true);
  });

  it("risks.mode 不是 risk_simulation 时报错", () => {
    const scene = makeValidScene();
    (scene.risks[0] as { mode: string }).mode = "live";
    const errors = validateSceneDefinition(scene);
    expect(errors.some((e) => e.includes("risk_simulation"))).toBe(true);
  });

  it("previewPresets.mode 不是 typical_preview 时报错", () => {
    const scene = makeValidScene();
    (scene.previewPresets[0] as { mode: string }).mode = "live";
    const errors = validateSceneDefinition(scene);
    expect(errors.some((e) => e.includes("typical_preview"))).toBe(true);
  });

  it("必填字段缺失时报错", () => {
    const scene = makeValidScene() as unknown as Record<string, unknown>;
    delete scene.id;
    delete scene.arrival;
    const errors = validateSceneDefinition(scene);
    expect(errors.some((e) => e.includes("id"))).toBe(true);
    expect(errors.some((e) => e.includes("arrival"))).toBe(true);
  });
});

describe("validateExplorationEntity", () => {
  const valid = {
    id: "mount-fuji",
    name: "富士山",
    shape: "point",
    sceneFamily: "mountain",
    sceneDefinitionId: "scene-mount-fuji",
  };

  it("合法对象通过", () => {
    expect(validateExplorationEntity(valid)).toEqual([]);
  });

  it("非对象报错", () => {
    expect(validateExplorationEntity(42).length).toBeGreaterThan(0);
  });

  it("id/name/shape/sceneFamily/sceneDefinitionId 缺失或非法时报错", () => {
    const errors = validateExplorationEntity({
      id: "",
      name: "富士山",
      shape: "blob",
      sceneFamily: "space",
      sceneDefinitionId: "",
    });
    expect(errors.some((e) => e.includes("id"))).toBe(true);
    expect(errors.some((e) => e.includes("shape"))).toBe(true);
    expect(errors.some((e) => e.includes("sceneFamily"))).toBe(true);
    expect(errors.some((e) => e.includes("sceneDefinitionId"))).toBe(true);
  });
});
