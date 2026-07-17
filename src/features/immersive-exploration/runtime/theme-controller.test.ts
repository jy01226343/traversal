/**
 * theme-controller 测试：主题 → InfoPanel 内容模型映射（CONTRACT CORE 节 / 主题中文标签）
 */

import { describe, expect, it } from "vitest";

import type { ImmersiveSceneDefinition } from "../domain/types";
import { resolveThemePanel } from "./theme-controller";

const scene: ImmersiveSceneDefinition = {
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
    { id: "story_past", label: "往事回响" },
  ],
  anchors: [],
  previewPresets: [],
  activities: [],
  audiences: [],
  risks: [],
  summaryRules: [],
  assets: { proceduralNodes: [], estimatedBytes: 0 },
  fallback: { summary: "", sections: [] },
};

describe("resolveThemePanel", () => {
  it("highlights → presets / 景色", () => {
    expect(resolveThemePanel(scene, "highlights")).toEqual({ kind: "presets", title: "景色" });
  });

  it("experience → activities / 怎么玩", () => {
    expect(resolveThemePanel(scene, "experience")).toEqual({ kind: "activities", title: "怎么玩" });
  });

  it("audience → audiences / 适合谁", () => {
    expect(resolveThemePanel(scene, "audience")).toEqual({ kind: "audiences", title: "适合谁" });
  });

  it("cautions → risks / 注意什么", () => {
    expect(resolveThemePanel(scene, "cautions")).toEqual({ kind: "risks", title: "注意什么" });
  });

  it("第五主题 → deep（契约中文标签）", () => {
    expect(resolveThemePanel(scene, "nature_geology")).toEqual({ kind: "deep", title: "自然观察" });
    expect(resolveThemePanel(scene, "water_ecology")).toEqual({ kind: "deep", title: "水域生态" });
    expect(resolveThemePanel(scene, "underwater_ecology")).toEqual({ kind: "deep", title: "水下生态" });
  });

  it("未收录标签的深度主题回退到场景自定义 label", () => {
    expect(resolveThemePanel(scene, "story_past")).toEqual({ kind: "deep", title: "往事回响" });
  });

  it("theme=null 时默认景色面板", () => {
    expect(resolveThemePanel(scene, null)).toEqual({ kind: "presets", title: "景色" });
  });
});
