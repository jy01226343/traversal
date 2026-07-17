/**
 * 沉浸探索状态机（施工方案 V1.1 §5）
 *
 * 纯函数、可序列化、可单测。语义冻结：
 * - startRisk 仅可在 cautions 主题下触发（cautions 的子状态，非独立主题）。
 * - 切换主题必须清理上一主题全部状态；风险激活中切换主题/结束探索必须先 restore。
 * - 进入中可取消；新目标选择取消旧进入任务（enterToken 递增，由 runtime 控制器消费）。
 * - 资源错误进入 FALLBACK（保留实体与场景定义，供等价信息页），可重试/返回。
 */

import type {
  ExplorationEntity,
  ImmersiveSceneDefinition,
  ImmersiveTheme,
} from "../domain/types";

export type ImmersiveStatus =
  | "MAP_IDLE"
  | "TARGET_SELECTED"
  | "ENTERING"
  | "ARRIVAL"
  | "EXPLORE_IDLE"
  | "THEME_ACTIVE"
  | "RISK_ACTIVE"
  | "SUMMARY"
  | "RETURNING"
  | "FALLBACK";

export interface RiskPlayback {
  riskId: string;
  stepIndex: number;
  playing: boolean;
}

export interface ImmersiveContext {
  entity: ExplorationEntity | null;
  scene: ImmersiveSceneDefinition | null;
  activeTheme: ImmersiveTheme | null;
  selectedAnchorId: string | null;
  selectedPreviewId: string | null;
  selectedActivityId: string | null;
  selectedAudienceId: string | null;
  risk: RiskPlayback | null;
  /** 进入任务令牌：每次 enter/retryEnter 递增；runtime 据此取消过期异步任务 */
  enterToken: number;
  /** 默认预览的解析结果（store 在进入时按 §1 优先级链写入） */
  defaultPreviewId: string | null;
  /** Journey 计划月份（1-12），用于默认预览优先级 */
  plannedMonth: number | null;
  error: { reason: string; detail?: string } | null;
}

export interface ImmersiveState {
  status: ImmersiveStatus;
  context: ImmersiveContext;
  /** 最近一次被拒绝的转换（调试与测试用，不影响流程） */
  lastRejection: string | null;
}

export const INITIAL_STATE: ImmersiveState = {
  status: "MAP_IDLE",
  context: {
    entity: null,
    scene: null,
    activeTheme: null,
    selectedAnchorId: null,
    selectedPreviewId: null,
    selectedActivityId: null,
    selectedAudienceId: null,
    risk: null,
    enterToken: 0,
    defaultPreviewId: null,
    plannedMonth: null,
    error: null,
  },
  lastRejection: null,
};

export type ImmersiveEvent =
  | { type: "selectEntity"; entity: ExplorationEntity; scene: ImmersiveSceneDefinition }
  | { type: "enter" }
  | { type: "arrivalComplete" }
  | { type: "cancelEnter" }
  | { type: "introComplete" }
  | { type: "activateTheme"; theme: ImmersiveTheme }
  | { type: "clearTheme" }
  | { type: "selectAnchor"; anchorId: string | null }
  | { type: "selectPreview"; previewId: string }
  | { type: "selectActivity"; activityId: string | null }
  | { type: "selectAudience"; audienceId: string | null }
  | { type: "startRisk"; riskId: string }
  | { type: "riskStep"; stepIndex: number }
  | { type: "pauseRisk" }
  | { type: "replayRisk" }
  | { type: "restoreCalm" }
  | { type: "finishExplore" }
  | { type: "summaryAction"; action: "add_wishlist" | "view_preparation" | "add_journey" }
  | { type: "continuePlanning" }
  | { type: "returnMap" }
  | { type: "mapRestored" }
  | { type: "fatalError"; reason: string; detail?: string }
  | { type: "retryEnter" }
  | { type: "setDefaultPreview"; previewId: string | null; plannedMonth?: number | null };

function reject(state: ImmersiveState, event: string): ImmersiveState {
  return { ...state, lastRejection: `${state.status} ⇢ ${event}` };
}

function withContext(state: ImmersiveState, patch: Partial<ImmersiveContext>): ImmersiveState {
  return { ...state, context: { ...state.context, ...patch }, lastRejection: null };
}

/** 清理主题相关全部状态（§5.2 切换主题前必须执行） */
function clearThemeState(ctx: ImmersiveContext): ImmersiveContext {
  return {
    ...ctx,
    activeTheme: null,
    selectedAnchorId: null,
    risk: null,
  };
}

export function transition(state: ImmersiveState, event: ImmersiveEvent): ImmersiveState {
  const { status, context: ctx } = state;

  // 全局：任意状态（MAP_IDLE 除外）资源错误 → FALLBACK（保留实体/场景供等价信息）
  if (event.type === "fatalError") {
    if (status === "MAP_IDLE") return reject(state, event.type);
    return {
      status: "FALLBACK",
      context: { ...clearThemeState(ctx), error: { reason: event.reason, detail: event.detail } },
      lastRejection: null,
    };
  }

  switch (status) {
    case "MAP_IDLE": {
      if (event.type === "selectEntity") {
        // 新目标选择：enterToken 递增使旧进入任务失效（§5.2）
        return {
          status: "TARGET_SELECTED",
          context: {
            ...INITIAL_STATE.context,
            entity: event.entity,
            scene: event.scene,
            enterToken: ctx.enterToken + 1,
            plannedMonth: ctx.plannedMonth,
          },
          lastRejection: null,
        };
      }
      return reject(state, event.type);
    }

    case "TARGET_SELECTED": {
      if (event.type === "enter") {
        return { status: "ENTERING", context: ctx, lastRejection: null };
      }
      if (event.type === "cancelEnter" || event.type === "returnMap") {
        return { status: "MAP_IDLE", context: { ...INITIAL_STATE.context, enterToken: ctx.enterToken + 1, plannedMonth: ctx.plannedMonth }, lastRejection: null };
      }
      if (event.type === "selectEntity") {
        // 新目标：取消旧进入任务（token 单调递增，§5.2）
        return {
          status: "TARGET_SELECTED",
          context: { ...INITIAL_STATE.context, entity: event.entity, scene: event.scene, enterToken: ctx.enterToken + 1, plannedMonth: ctx.plannedMonth },
          lastRejection: null,
        };
      }
      return reject(state, event.type);
    }

    case "ENTERING": {
      if (event.type === "arrivalComplete") {
        return { status: "ARRIVAL", context: ctx, lastRejection: null };
      }
      if (event.type === "cancelEnter") {
        // 用户取消：enterToken 递增，runtime 清理任务与异步加载
        return { status: "MAP_IDLE", context: { ...INITIAL_STATE.context, enterToken: ctx.enterToken + 1, plannedMonth: ctx.plannedMonth }, lastRejection: null };
      }
      if (event.type === "selectEntity") {
        // 进入中切换目标：取消旧进入任务（token 单调递增，§5.2）
        return {
          status: "TARGET_SELECTED",
          context: { ...INITIAL_STATE.context, entity: event.entity, scene: event.scene, enterToken: ctx.enterToken + 1, plannedMonth: ctx.plannedMonth },
          lastRejection: null,
        };
      }
      return reject(state, event.type);
    }

    case "ARRIVAL": {
      if (event.type === "introComplete") {
        return { status: "EXPLORE_IDLE", context: ctx, lastRejection: null };
      }
      if (event.type === "cancelEnter" || event.type === "returnMap") {
        return { status: "RETURNING", context: clearThemeState(ctx), lastRejection: null };
      }
      return reject(state, event.type);
    }

    case "EXPLORE_IDLE": {
      if (event.type === "activateTheme") {
        return { status: "THEME_ACTIVE", context: { ...clearThemeState(ctx), activeTheme: event.theme }, lastRejection: null };
      }
      if (event.type === "finishExplore") {
        // 未做任何选择也可直接生成总结（§5.1）
        return { status: "SUMMARY", context: ctx, lastRejection: null };
      }
      if (event.type === "selectAnchor") {
        return withContext(state, { selectedAnchorId: event.anchorId });
      }
      if (event.type === "selectPreview") {
        return withContext(state, { selectedPreviewId: event.previewId });
      }
      if (event.type === "returnMap") {
        return { status: "RETURNING", context: ctx, lastRejection: null };
      }
      return reject(state, event.type);
    }

    case "THEME_ACTIVE": {
      if (event.type === "activateTheme") {
        if (event.theme === ctx.activeTheme) return state;
        // 切换主题前必须清理上一主题全部状态（§5.2）
        return { status: "THEME_ACTIVE", context: { ...clearThemeState(ctx), activeTheme: event.theme }, lastRejection: null };
      }
      if (event.type === "clearTheme") {
        return { status: "EXPLORE_IDLE", context: clearThemeState(ctx), lastRejection: null };
      }
      if (event.type === "startRisk") {
        // 仅 cautions 主题下可触发（§5.2）
        if (ctx.activeTheme !== "cautions") return reject(state, "startRisk(not-cautions)");
        return {
          status: "RISK_ACTIVE",
          context: { ...ctx, risk: { riskId: event.riskId, stepIndex: 0, playing: true }, selectedAnchorId: null },
          lastRejection: null,
        };
      }
      if (event.type === "selectAnchor") {
        return withContext(state, { selectedAnchorId: event.anchorId });
      }
      if (event.type === "selectPreview") {
        return withContext(state, { selectedPreviewId: event.previewId });
      }
      if (event.type === "selectActivity") {
        return withContext(state, { selectedActivityId: event.activityId });
      }
      if (event.type === "selectAudience") {
        return withContext(state, { selectedAudienceId: event.audienceId });
      }
      if (event.type === "finishExplore") {
        return { status: "SUMMARY", context: ctx, lastRejection: null };
      }
      if (event.type === "returnMap") {
        return { status: "RETURNING", context: clearThemeState(ctx), lastRejection: null };
      }
      return reject(state, event.type);
    }

    case "RISK_ACTIVE": {
      if (event.type === "riskStep") {
        if (!ctx.risk) return reject(state, event.type);
        return withContext(state, { risk: { ...ctx.risk, stepIndex: event.stepIndex } });
      }
      if (event.type === "pauseRisk") {
        if (!ctx.risk) return reject(state, event.type);
        return withContext(state, { risk: { ...ctx.risk, playing: !ctx.risk.playing } });
      }
      if (event.type === "replayRisk") {
        if (!ctx.risk) return reject(state, event.type);
        return withContext(state, { risk: { ...ctx.risk, stepIndex: 0, playing: true } });
      }
      if (event.type === "restoreCalm") {
        // 恢复平静 → 回到 cautions 主题态
        return { status: "THEME_ACTIVE", context: { ...ctx, risk: null, selectedAnchorId: null }, lastRejection: null };
      }
      if (event.type === "activateTheme") {
        // 风险中切换主题：先 restore（恢复平静）+ clearActiveTheme()（§5.1）
        if (event.theme === "cautions") return state;
        return { status: "THEME_ACTIVE", context: { ...clearThemeState(ctx), activeTheme: event.theme }, lastRejection: null };
      }
      if (event.type === "finishExplore") {
        // 风险中结束探索：必须先 restore（§5.1）——机器内原子完成
        return { status: "SUMMARY", context: { ...ctx, risk: null, selectedAnchorId: null }, lastRejection: null };
      }
      if (event.type === "returnMap") {
        return { status: "RETURNING", context: clearThemeState(ctx), lastRejection: null };
      }
      return reject(state, event.type);
    }

    case "SUMMARY": {
      if (event.type === "summaryAction") {
        // 业务动作由宿主副作用处理，状态保持 SUMMARY（可继续其他动作）
        return state;
      }
      if (event.type === "continuePlanning" || event.type === "returnMap") {
        return { status: "RETURNING", context: ctx, lastRejection: null };
      }
      return reject(state, event.type);
    }

    case "RETURNING": {
      if (event.type === "mapRestored") {
        return { status: "MAP_IDLE", context: { ...INITIAL_STATE.context, enterToken: ctx.enterToken, plannedMonth: ctx.plannedMonth }, lastRejection: null };
      }
      return reject(state, event.type);
    }

    case "FALLBACK": {
      if (event.type === "retryEnter") {
        return { status: "ENTERING", context: { ...ctx, error: null, enterToken: ctx.enterToken + 1 }, lastRejection: null };
      }
      if (event.type === "returnMap") {
        return { status: "RETURNING", context: ctx, lastRejection: null };
      }
      return reject(state, event.type);
    }

    default:
      return reject(state, (event as ImmersiveEvent).type);
  }
}

/** 便捷断言：是否处于沉浸层激活态（地图应降低控件优先级） */
export function isImmersiveActive(status: ImmersiveStatus): boolean {
  return status !== "MAP_IDLE" && status !== "RETURNING";
}

/** 默认预览优先级链（§1）：Journey 月份 → 用户月份 → 当前月份 → 代表性时段 */
export function resolveDefaultPreviewId(
  scene: ImmersiveSceneDefinition,
  plannedMonth?: number | null,
  userMonth?: number | null,
  currentMonth?: number | null,
): string | null {
  const presets = scene.previewPresets;
  if (presets.length === 0) return null;
  const byMonth = (month: number | null | undefined) =>
    month != null ? presets.find((p) => p.months.length === 0 || p.months.includes(month)) : undefined;
  const picked =
    byMonth(plannedMonth) ??
    byMonth(userMonth) ??
    byMonth(currentMonth) ??
    presets.find((p) => p.representative) ??
    presets[0];
  return picked?.id ?? null;
}
