/**
 * scene-config-validator 测试：
 * 契约节点名集合、三件套全量校验通过、关键下限断言、反例检出。
 */

import { describe, expect, it } from "vitest";
import type { ImmersiveSceneDefinition } from "../../domain/types";
import {
  GOLDEN_ANCHOR_CONTENTS,
  GOLDEN_SCENE_IDS,
  getSceneDefinition,
} from "../scene-configs";
import {
  CONTRACT_NODE_NAMES,
  validateGoldenSamples,
  validateSceneConfig,
} from "./scene-config-validator";

describe("CONTRACT_NODE_NAMES · 与契约完全一致", () => {
  it("mountain / waterside / underwater 三组节点名精确匹配契约", () => {
    expect(CONTRACT_NODE_NAMES.mountain).toEqual([
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
    ]);
    expect(CONTRACT_NODE_NAMES.waterside).toEqual([
      "shore_walk",
      "pier",
      "boat_zone",
      "paddle_zone",
      "viewpoint_a",
      "viewpoint_b",
      "wetland",
      "lakeside_trail",
      "risk_open_water",
    ]);
    expect(CONTRACT_NODE_NAMES.underwater).toEqual([
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
    ]);
  });
});

describe("validateGoldenSamples · 三件套全部通过", () => {
  it("返回空数组", () => {
    expect(validateGoldenSamples()).toEqual([]);
  });

  it("每个场景 anchors 6–8 且 positionRef 全部在契约节点名集合内", () => {
    for (const sceneId of GOLDEN_SCENE_IDS) {
      const scene = getSceneDefinition(sceneId)!;
      expect(scene.anchors.length).toBeGreaterThanOrEqual(6);
      expect(scene.anchors.length).toBeLessThanOrEqual(8);
      const nodeNames = new Set(CONTRACT_NODE_NAMES[scene.family as "mountain" | "waterside" | "underwater"]);
      for (const anchor of scene.anchors) {
        expect(anchor.positionRef.startsWith("node:")).toBe(true);
        expect(nodeNames.has(anchor.positionRef.slice(5))).toBe(true);
      }
    }
  });

  it("每个场景至少一个 representative=true 的 preset", () => {
    for (const sceneId of GOLDEN_SCENE_IDS) {
      const scene = getSceneDefinition(sceneId)!;
      expect(scene.previewPresets.some((p) => p.representative)).toBe(true);
    }
  });

  it("每个场景 risks ≥2 且 sequence ≥3 步、applicable=true", () => {
    for (const sceneId of GOLDEN_SCENE_IDS) {
      const scene = getSceneDefinition(sceneId)!;
      expect(scene.risks.length).toBeGreaterThanOrEqual(2);
      for (const risk of scene.risks) {
        expect(risk.applicable).toBe(true);
        expect(risk.sequence.length).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("水下场景 arrival.transitionBeats 为契约六拍", () => {
    const scene = getSceneDefinition("scene-maldives-coral-garden")!;
    expect(scene.arrival.transitionBeats).toEqual([
      "接近水面",
      "穿过水面",
      "光线和空间状态变化",
      "水下场景稳定",
      "生态对象进入",
      "主题入口出现",
    ]);
  });

  it("anchorContents 与 anchors.contentId 一一对应", () => {
    for (const sceneId of GOLDEN_SCENE_IDS) {
      const scene = getSceneDefinition(sceneId)!;
      const contents = GOLDEN_ANCHOR_CONTENTS[sceneId];
      expect(new Set(contents.map((c) => c.id))).toEqual(new Set(scene.anchors.map((a) => a.contentId)));
    }
  });
});

describe("validateSceneConfig · 反例检出", () => {
  const baseScene = (): ImmersiveSceneDefinition => structuredClone(getSceneDefinition("scene-mount-fuji")!);
  const baseContents = () => structuredClone([...GOLDEN_ANCHOR_CONTENTS["scene-mount-fuji"]]);

  it("anchor 引用未知节点名 → 报错", () => {
    const scene = baseScene();
    scene.anchors[0].positionRef = "node:not_a_node";
    const errors = validateSceneConfig(scene, baseContents());
    expect(errors.some((e) => e.includes("未知节点"))).toBe(true);
  });

  it("anchors 数量超出 6–8 → 报错", () => {
    const scene = baseScene();
    scene.anchors = scene.anchors.slice(0, 5);
    const errors = validateSceneConfig(scene, baseContents());
    expect(errors.some((e) => e.includes("6–8"))).toBe(true);
  });

  it("priority 重复 → 报错", () => {
    const scene = baseScene();
    scene.anchors[1].priority = scene.anchors[0].priority;
    const errors = validateSceneConfig(scene, baseContents());
    expect(errors.some((e) => e.includes("priority"))).toBe(true);
  });

  it("缺少 representative preset → 报错", () => {
    const scene = baseScene();
    scene.previewPresets = scene.previewPresets.map((p) => ({ ...p, representative: false }));
    const errors = validateSceneConfig(scene, baseContents());
    expect(errors.some((e) => e.includes("representative"))).toBe(true);
  });

  it("risk sequence 仅 2 步 → 报错", () => {
    const scene = baseScene();
    scene.risks[0].sequence = scene.risks[0].sequence.slice(0, 2);
    const errors = validateSceneConfig(scene, baseContents());
    expect(errors.some((e) => e.includes("≥3"))).toBe(true);
  });

  it("fallback.sections 缺主题 → 报错", () => {
    const scene = baseScene();
    scene.fallback.sections = scene.fallback.sections.filter((s) => s.theme !== "cautions");
    const errors = validateSceneConfig(scene, baseContents());
    expect(errors.some((e) => e.includes("cautions"))).toBe(true);
  });

  it("contentId 无对应 AnchorContent → 报错", () => {
    const scene = baseScene();
    const contents = baseContents().slice(1);
    const errors = validateSceneConfig(scene, contents);
    expect(errors.some((e) => e.includes("无对应 AnchorContent"))).toBe(true);
  });

  it("水下六拍被篡改 → 报错", () => {
    const scene = structuredClone(getSceneDefinition("scene-maldives-coral-garden")!);
    scene.arrival.transitionBeats = ["接近水面", "穿过水面"];
    const contents = structuredClone([...GOLDEN_ANCHOR_CONTENTS["scene-maldives-coral-garden"]]);
    const errors = validateSceneConfig(scene, contents);
    expect(errors.some((e) => e.includes("六拍"))).toBe(true);
  });

  it("文案含必然性表述 → 报错", () => {
    const scene = baseScene();
    scene.previewPresets[0].whyText = "在这里必然能看到完整雪冠";
    const errors = validateSceneConfig(scene, baseContents());
    expect(errors.some((e) => e.includes("禁用文案"))).toBe(true);
  });
});
