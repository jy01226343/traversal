/**
 * copy-validator 测试：正例零命中、反例逐条命中、三件套全量文本零命中。
 */

import { describe, expect, it } from "vitest";
import {
  GOLDEN_ANCHOR_CONTENTS,
  GOLDEN_ENTITIES,
  GOLDEN_SCENE_IDS,
  getSceneDefinition,
} from "../scene-configs";
import { findForbiddenCopy } from "./copy-validator";

describe("findForbiddenCopy · 正例（合规文案零命中）", () => {
  const SAFE_TEXTS = [
    "海龟通常有机会在海草区与礁坪交界处观察到，常见深度 3–10m。",
    "旱季能见度常达 20–30m，雨季浮游生物增多。",
    "春秋季候鸟迁徙期通常有机会观察到鸭类与鹭类。",
    "多数情况下清晨湖面较平静，倒影更清晰。",
    "积雪深度受当年降雪影响，以现场为准。",
  ];

  it.each(SAFE_TEXTS)("合规文案：%s", (text) => {
    expect(findForbiddenCopy(text)).toEqual([]);
  });

  it("空字符串与空白输入零命中", () => {
    expect(findForbiddenCopy("")).toEqual([]);
  });
});

describe("findForbiddenCopy · 反例（违规文案逐条命中）", () => {
  const FORBIDDEN_CASES: Array<[string, string]> = [
    ["在这里必然能看到完整雪冠", "必然"],
    ["晴天时一定能看到羊蹄山倒影", "一定能看到"],
    ["潜水时一定能遇到海龟", "一定能遇到"],
    ["旱季看到鲸鲨的机会是100%", "100%"],
    ["百分之百可以观察到鱼群", "百分之百"],
    ["看到海龟的机会约百分之八十", "百分之"],
    ["观察到海豚的概率 80%", "概率"],
    ["目击率约60%的潜点", "目击率"],
    ["我们保证看到海龟", "保证看到"],
    ["跟我们去保证能看到鱼群", "保证能"],
    ["黄昏潜肯定会遇到大鱼", "肯定会遇到"],
    ["这个季节肯定会看到萤火虫", "肯定会看到"],
  ];

  it.each(FORBIDDEN_CASES)("违规文案命中：%s", (text, expectedLabel) => {
    const hits = findForbiddenCopy(text);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => h.includes(expectedLabel))).toBe(true);
  });
});

describe("findForbiddenCopy · 三件套全量文本零命中", () => {
  it("三份场景定义 + 锚点内容 + 实体 JSON.stringify 后扫描全部通过", () => {
    const allHits: string[] = [];
    for (const sceneId of GOLDEN_SCENE_IDS) {
      const scene = getSceneDefinition(sceneId)!;
      for (const hit of findForbiddenCopy(JSON.stringify(scene))) {
        allHits.push(`[${sceneId}] scene: ${hit}`);
      }
      for (const hit of findForbiddenCopy(JSON.stringify(GOLDEN_ANCHOR_CONTENTS[sceneId]))) {
        allHits.push(`[${sceneId}] anchorContents: ${hit}`);
      }
    }
    for (const [entityId, entity] of Object.entries(GOLDEN_ENTITIES)) {
      for (const hit of findForbiddenCopy(JSON.stringify(entity))) {
        allHits.push(`[${entityId}] entity: ${hit}`);
      }
    }
    expect(allHits).toEqual([]);
  });
});
