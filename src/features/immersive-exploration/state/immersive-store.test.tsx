/**
 * immersive-store 测试：Provider 状态流转 + dispatch 包装层埋点映射（CONTRACT CORE 节 / §11.4）
 */

import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import {
  clearImmersiveEvents,
  readImmersiveEvents,
} from "../analytics/immersive-events";
import type {
  ExplorationEntity,
  ImmersiveSceneDefinition,
} from "../domain/types";
import type { ImmersiveEvent } from "./immersive-machine";
import { ImmersiveStoreProvider, useImmersiveStore, type ImmersiveStoreValue } from "./immersive-store";

const entity: ExplorationEntity = {
  id: "mount-fuji",
  name: "富士山",
  countryCode: "JP",
  shape: "point",
  sceneFamily: "mountain",
  channels: ["nature", "outdoor"],
  activityTags: [],
  attributeTags: [],
  sceneDefinitionId: "scene-mount-fuji",
  fallbackContentId: "fb-mount-fuji",
};

const scene: ImmersiveSceneDefinition = {
  id: "scene-mount-fuji",
  family: "mountain",
  entityName: "富士山",
  regionLabel: "日本 · 山梨",
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
  previewPresets: [],
  activities: [],
  audiences: [],
  risks: [],
  summaryRules: [
    {
      representativeActivityId: "act-1",
      representativeReason: "代表",
      bestTimeText: "最佳时间",
      bestExperienceText: "最佳体验",
      preparationItems: [],
    },
  ],
  assets: { proceduralNodes: [], estimatedBytes: 0 },
  fallback: { summary: "降级", sections: [] },
};

let storeRef: ImmersiveStoreValue | null = null;

function StoreProbe() {
  storeRef = useImmersiveStore();
  return null;
}

function setup() {
  storeRef = null;
  render(
    <ImmersiveStoreProvider>
      <StoreProbe />
    </ImmersiveStoreProvider>,
  );
  return {
    dispatch(event: ImmersiveEvent) {
      act(() => {
        storeRef!.dispatch(event);
      });
    },
    get state() {
      return storeRef!.state;
    },
  };
}

/** 走完进入流程到达 EXPLORE_IDLE */
function enterExploreIdle(store: ReturnType<typeof setup>) {
  store.dispatch({ type: "selectEntity", entity, scene });
  store.dispatch({ type: "enter" });
  store.dispatch({ type: "arrivalComplete" });
  store.dispatch({ type: "introComplete" });
}

beforeEach(() => {
  clearImmersiveEvents();
});

describe("ImmersiveStoreProvider · 状态流转", () => {
  it("初始为 MAP_IDLE，useReducer(transition, INITIAL_STATE)", () => {
    const store = setup();
    expect(store.state.status).toBe("MAP_IDLE");
  });

  it("完整进入流程到达 EXPLORE_IDLE，主题激活后 startRisk 进入 RISK_ACTIVE", () => {
    const store = setup();
    enterExploreIdle(store);
    expect(store.state.status).toBe("EXPLORE_IDLE");
    store.dispatch({ type: "activateTheme", theme: "cautions" });
    expect(store.state.status).toBe("THEME_ACTIVE");
    store.dispatch({ type: "startRisk", riskId: "risk-1" });
    expect(store.state.status).toBe("RISK_ACTIVE");
    store.dispatch({ type: "restoreCalm" });
    expect(store.state.status).toBe("THEME_ACTIVE");
  });
});

describe("ImmersiveStoreProvider · 埋点映射", () => {
  it("selectEntity → anchor_click（带 sceneFamily/channels）", () => {
    const store = setup();
    store.dispatch({ type: "selectEntity", entity, scene });
    const events = readImmersiveEvents({ name: "anchor_click" });
    expect(events).toHaveLength(1);
    expect(events[0].entityId).toBe("mount-fuji");
    expect(events[0].params?.sceneFamily).toBe("mountain");
    expect(events[0].params?.channels).toBe("nature,outdoor");
  });

  it("enter/arrivalComplete/introComplete → enter_start/enter_complete/arrival_complete", () => {
    const store = setup();
    enterExploreIdle(store);
    expect(readImmersiveEvents({ name: "enter_start" })).toHaveLength(1);
    expect(readImmersiveEvents({ name: "enter_complete" })).toHaveLength(1);
    expect(readImmersiveEvents({ name: "arrival_complete" })).toHaveLength(1);
  });

  it("cancelEnter → enter_cancel", () => {
    const store = setup();
    store.dispatch({ type: "selectEntity", entity, scene });
    store.dispatch({ type: "enter" });
    store.dispatch({ type: "cancelEnter" });
    expect(readImmersiveEvents({ name: "enter_cancel" })).toHaveLength(1);
  });

  it("activateTheme → theme_activate { theme }；selectAnchor → scene_anchor_activate { anchorId, theme }", () => {
    const store = setup();
    enterExploreIdle(store);
    store.dispatch({ type: "activateTheme", theme: "highlights" });
    store.dispatch({ type: "selectAnchor", anchorId: "a-1" });
    const themeEvents = readImmersiveEvents({ name: "theme_activate" });
    expect(themeEvents[0].params?.theme).toBe("highlights");
    const anchorEvents = readImmersiveEvents({ name: "scene_anchor_activate" });
    expect(anchorEvents).toHaveLength(1);
    expect(anchorEvents[0].params?.anchorId).toBe("a-1");
    expect(anchorEvents[0].params?.theme).toBe("highlights");
  });

  it("selectPreview/selectActivity/selectAudience → preview_switch/activity_select/audience_select", () => {
    const store = setup();
    enterExploreIdle(store);
    store.dispatch({ type: "activateTheme", theme: "experience" });
    store.dispatch({ type: "selectPreview", previewId: "p-1" });
    store.dispatch({ type: "selectActivity", activityId: "act-1" });
    store.dispatch({ type: "selectAudience", audienceId: "hiker" });
    expect(readImmersiveEvents({ name: "preview_switch" })[0].params?.presetId).toBe("p-1");
    expect(readImmersiveEvents({ name: "activity_select" })[0].params?.activityId).toBe("act-1");
    expect(readImmersiveEvents({ name: "audience_select" })[0].params?.audienceId).toBe("hiker");
  });

  it("startRisk/pauseRisk/replayRisk/restoreCalm → risk_* { riskId }", () => {
    const store = setup();
    enterExploreIdle(store);
    store.dispatch({ type: "activateTheme", theme: "cautions" });
    store.dispatch({ type: "startRisk", riskId: "risk-9" });
    store.dispatch({ type: "pauseRisk" });
    store.dispatch({ type: "replayRisk" });
    store.dispatch({ type: "restoreCalm" });
    expect(readImmersiveEvents({ name: "risk_start" })[0].params?.riskId).toBe("risk-9");
    expect(readImmersiveEvents({ name: "risk_pause" })[0].params?.riskId).toBe("risk-9");
    expect(readImmersiveEvents({ name: "risk_replay" })[0].params?.riskId).toBe("risk-9");
    expect(readImmersiveEvents({ name: "risk_restore" })[0].params?.riskId).toBe("risk-9");
  });

  it("finishExplore → summary_generate（带选择上下文）", () => {
    const store = setup();
    enterExploreIdle(store);
    store.dispatch({ type: "selectPreview", previewId: "p-2" });
    store.dispatch({ type: "finishExplore" });
    const events = readImmersiveEvents({ name: "summary_generate" });
    expect(events).toHaveLength(1);
    expect(events[0].params?.previewId).toBe("p-2");
  });

  it("summaryAction → summary_action { action }；continuePlanning → exit_method { method: summary }", () => {
    const store = setup();
    enterExploreIdle(store);
    store.dispatch({ type: "finishExplore" });
    store.dispatch({ type: "summaryAction", action: "add_wishlist" });
    store.dispatch({ type: "continuePlanning" });
    expect(readImmersiveEvents({ name: "summary_action" })[0].params?.action).toBe("add_wishlist");
    const exitEvents = readImmersiveEvents({ name: "exit_method" });
    expect(exitEvents[0].params?.method).toBe("summary");
  });

  it("fatalError → fallback_enter { reason }；FALLBACK 下 returnMap → exit_method { method: fallback }", () => {
    const store = setup();
    store.dispatch({ type: "selectEntity", entity, scene });
    store.dispatch({ type: "fatalError", reason: "webgl_unavailable" });
    store.dispatch({ type: "returnMap" });
    expect(readImmersiveEvents({ name: "fallback_enter" })[0].params?.reason).toBe("webgl_unavailable");
    const exitEvents = readImmersiveEvents({ name: "exit_method" });
    expect(exitEvents[0].params?.method).toBe("fallback");
  });

  it("探索态直接 returnMap → exit_method { method: direct }", () => {
    const store = setup();
    enterExploreIdle(store);
    store.dispatch({ type: "returnMap" });
    const exitEvents = readImmersiveEvents({ name: "exit_method" });
    expect(exitEvents[0].params?.method).toBe("direct");
  });
});
