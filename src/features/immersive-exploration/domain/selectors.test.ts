/**
 * selectors 测试：可见锚点上限/截断/选中保留、降强调集合（CONTRACT CORE 节）
 */

import { describe, expect, it } from "vitest";

import {
  ANCHOR_CAP_DEFAULT,
  ANCHOR_CAP_THEME,
  selectDimmedAnchorIds,
  selectVisibleAnchors,
} from "./selectors";
import type {
  ImmersiveSceneDefinition,
  SceneAnchorDefinition,
} from "./types";

let seq = 0;
function makeAnchor(partial: Partial<SceneAnchorDefinition>): SceneAnchorDefinition {
  seq += 1;
  return {
    id: partial.id ?? `a${seq}`,
    label: partial.label ?? `锚点${seq}`,
    anchorType: partial.anchorType ?? "viewpoint",
    positionRef: partial.positionRef ?? `node:peak`,
    themes: partial.themes ?? ["highlights"],
    contentId: partial.contentId ?? `c${seq}`,
    priority: partial.priority ?? seq,
  };
}

function makeScene(anchors: SceneAnchorDefinition[]): ImmersiveSceneDefinition {
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
    anchors,
    previewPresets: [],
    activities: [],
    audiences: [],
    risks: [],
    summaryRules: [
      {
        representativeActivityId: "act-1",
        representativeReason: "代表性玩法",
        bestTimeText: "最佳时间",
        bestExperienceText: "最佳体验",
        preparationItems: [],
      },
    ],
    assets: { proceduralNodes: ["peak"], estimatedBytes: 0 },
    fallback: { summary: "降级", sections: [] },
  };
}

describe("selectVisibleAnchors", () => {
  it("默认态（无主题）按 priority 升序截断到 3 个", () => {
    const anchors = [
      makeAnchor({ id: "a", priority: 50 }),
      makeAnchor({ id: "b", priority: 10 }),
      makeAnchor({ id: "c", priority: 30 }),
      makeAnchor({ id: "d", priority: 20 }),
      makeAnchor({ id: "e", priority: 40 }),
    ];
    const visible = selectVisibleAnchors(makeScene(anchors), null, null);
    expect(visible.map((a) => a.id)).toEqual(["b", "d", "c"]);
    expect(visible).toHaveLength(ANCHOR_CAP_DEFAULT);
  });

  it("主题激活时只保留含该主题的锚点，上限 5", () => {
    const anchors = [
      ...Array.from({ length: 7 }, (_, i) =>
        makeAnchor({ id: `h${i}`, priority: i + 1, themes: ["highlights"] }),
      ),
      makeAnchor({ id: "x", priority: 0, themes: ["cautions"] }),
    ];
    const visible = selectVisibleAnchors(makeScene(anchors), "highlights", null);
    expect(visible).toHaveLength(ANCHOR_CAP_THEME);
    expect(visible.every((a) => a.themes.includes("highlights"))).toBe(true);
    expect(visible.map((a) => a.id)).toEqual(["h0", "h1", "h2", "h3", "h4"]);
  });

  it("候选不足上限时全部返回", () => {
    const anchors = [
      makeAnchor({ id: "a", priority: 2 }),
      makeAnchor({ id: "b", priority: 1 }),
    ];
    const visible = selectVisibleAnchors(makeScene(anchors), null, null);
    expect(visible.map((a) => a.id)).toEqual(["b", "a"]);
  });

  it("选中锚点超出上限仍被保留", () => {
    const anchors = [
      makeAnchor({ id: "a", priority: 1 }),
      makeAnchor({ id: "b", priority: 2 }),
      makeAnchor({ id: "c", priority: 3 }),
      makeAnchor({ id: "d", priority: 4 }),
    ];
    const visible = selectVisibleAnchors(makeScene(anchors), null, "d");
    expect(visible).toHaveLength(4);
    expect(visible.some((a) => a.id === "d")).toBe(true);
  });

  it("选中锚点不属于当前主题候选时仍被保留", () => {
    const anchors = [
      makeAnchor({ id: "h", priority: 1, themes: ["highlights"] }),
      makeAnchor({ id: "r", priority: 2, themes: ["cautions"] }),
    ];
    const visible = selectVisibleAnchors(makeScene(anchors), "highlights", "r");
    expect(visible.map((a) => a.id)).toContain("r");
    expect(visible.map((a) => a.id)).toContain("h");
  });
});

describe("selectDimmedAnchorIds", () => {
  it("无选中时为空集", () => {
    const visible = [makeAnchor({ id: "a" }), makeAnchor({ id: "b" })];
    expect(selectDimmedAnchorIds(visible, null).size).toBe(0);
  });

  it("与选中锚点主题无交集的其他锚点进入 dimmed 集合", () => {
    const visible = [
      makeAnchor({ id: "sel", themes: ["highlights", "nature_geology"] }),
      makeAnchor({ id: "related", themes: ["highlights"] }),
      makeAnchor({ id: "unrelated", themes: ["cautions"] }),
    ];
    const dimmed = selectDimmedAnchorIds(visible, "sel");
    expect(dimmed.has("unrelated")).toBe(true);
    expect(dimmed.has("related")).toBe(false);
    expect(dimmed.has("sel")).toBe(false);
  });

  it("选中锚点不在可见列表时返回空集", () => {
    const visible = [makeAnchor({ id: "a" })];
    expect(selectDimmedAnchorIds(visible, "ghost").size).toBe(0);
  });
});
