/**
 * 沉浸探索 · React Store（CONTRACT CORE 节）
 *
 * Provider 内部 useReducer(transition, INITIAL_STATE)；
 * dispatch 包装层按契约事件映射触发埋点（analytics/immersive-events）。
 * entityId 取自 state.context.entity?.id；埋点只记录真实状态与选择。
 */

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useRef,
  type ReactElement,
  type ReactNode,
} from "react";

import { trackImmersiveEvent } from "../analytics/immersive-events";
import {
  INITIAL_STATE,
  transition,
  type ImmersiveEvent,
  type ImmersiveState,
} from "./immersive-machine";

export interface ImmersiveStoreValue {
  state: ImmersiveState;
  dispatch: (event: ImmersiveEvent) => void;
}

const ImmersiveStoreContext = createContext<ImmersiveStoreValue | null>(null);

/** 契约事件 → 埋点映射（§11.4）。在 dispatch 前基于当前 state 取上下文。 */
function trackForEvent(event: ImmersiveEvent, state: ImmersiveState): void {
  const entityId = state.context.entity?.id;
  switch (event.type) {
    case "selectEntity":
      trackImmersiveEvent("anchor_click", {
        entityId: event.entity.id,
        sceneFamily: event.entity.sceneFamily,
        channels: event.entity.channels.join(","),
      });
      break;
    case "enter":
      trackImmersiveEvent("enter_start", { entityId });
      break;
    case "arrivalComplete":
      trackImmersiveEvent("enter_complete", { entityId });
      break;
    case "cancelEnter":
      trackImmersiveEvent("enter_cancel", { entityId });
      break;
    case "introComplete":
      trackImmersiveEvent("arrival_complete", { entityId });
      break;
    case "activateTheme":
      trackImmersiveEvent("theme_activate", { entityId, theme: event.theme });
      break;
    case "selectAnchor":
      if (event.anchorId != null) {
        trackImmersiveEvent("scene_anchor_activate", {
          entityId,
          anchorId: event.anchorId,
          theme: state.context.activeTheme,
        });
      }
      break;
    case "selectPreview":
      trackImmersiveEvent("preview_switch", { entityId, presetId: event.previewId });
      break;
    case "selectActivity":
      trackImmersiveEvent("activity_select", { entityId, activityId: event.activityId });
      break;
    case "selectAudience":
      trackImmersiveEvent("audience_select", { entityId, audienceId: event.audienceId });
      break;
    case "startRisk":
      trackImmersiveEvent("risk_start", { entityId, riskId: event.riskId });
      break;
    case "pauseRisk":
      trackImmersiveEvent("risk_pause", { entityId, riskId: state.context.risk?.riskId });
      break;
    case "replayRisk":
      trackImmersiveEvent("risk_replay", { entityId, riskId: state.context.risk?.riskId });
      break;
    case "restoreCalm":
      trackImmersiveEvent("risk_restore", { entityId, riskId: state.context.risk?.riskId });
      break;
    case "finishExplore":
      trackImmersiveEvent("summary_generate", {
        entityId,
        previewId: state.context.selectedPreviewId,
        activityId: state.context.selectedActivityId,
        audienceId: state.context.selectedAudienceId,
      });
      break;
    case "summaryAction":
      trackImmersiveEvent("summary_action", { entityId, action: event.action });
      break;
    case "fatalError":
      trackImmersiveEvent("fallback_enter", { entityId, reason: event.reason });
      break;
    case "continuePlanning":
      trackImmersiveEvent("exit_method", { entityId, method: "summary" });
      break;
    case "returnMap":
      trackImmersiveEvent("exit_method", {
        entityId,
        method: state.status === "SUMMARY" ? "summary" : state.status === "FALLBACK" ? "fallback" : "direct",
      });
      break;
    default:
      // clearTheme / riskStep / mapRestored / retryEnter / setDefaultPreview：无契约埋点
      break;
  }
}

export function ImmersiveStoreProvider(props: { children: ReactNode }): ReactElement {
  const [state, baseDispatch] = useReducer(transition, INITIAL_STATE);
  const stateRef = useRef(state);
  stateRef.current = state;

  const dispatch = useCallback((event: ImmersiveEvent) => {
    try {
      trackForEvent(event, stateRef.current);
    } catch {
      // 埋点失败不影响状态流转
    }
    baseDispatch(event);
  }, []);

  const value = useMemo<ImmersiveStoreValue>(() => ({ state, dispatch }), [state, dispatch]);
  return createElement(ImmersiveStoreContext.Provider, { value }, props.children);
}

export function useImmersiveStore(): ImmersiveStoreValue {
  const value = useContext(ImmersiveStoreContext);
  if (!value) {
    throw new Error("useImmersiveStore 必须在 ImmersiveStoreProvider 内使用");
  }
  return value;
}
