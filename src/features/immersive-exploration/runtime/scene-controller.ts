/**
 * 沉浸探索 · 场景控制器（CONTRACT CORE 节）
 *
 * 持有 SceneHandle 生命周期，把状态机状态同步到场景：
 * - mount：按 scene.family 取工厂，无工厂返回 false（调用方走 FALLBACK）；
 * - syncState：
 *   - RISK_ACTIVE → applyRiskStep(riskDef, stepIndex)（riskDef 从 scene.risks 找）；
 *   - THEME_ACTIVE / EXPLORE_IDLE → applyTheme + applyPreset（selectedPreviewId ?? defaultPreviewId）
 *     + applyActivity + applyAudience + setAnchorEmphasis；
 *   - 离开 RISK_ACTIVE 时 restoreCalm 调用一次；
 * - 幂等：相同输入不重复触发重活。
 */

import { selectDimmedAnchorIds, selectVisibleAnchors } from "../domain/selectors";
import type {
  ActivityDefinition,
  AudienceDefinition,
  ImmersiveSceneDefinition,
  ImmersiveTheme,
  RiskScenarioDefinition,
  ScenePreset,
} from "../domain/types";
import type { ImmersiveState } from "../state/immersive-machine";
import { getSceneFactory, type SceneHandle } from "../scenes/scene-registry";

type Quality = "high" | "standard" | "low";

interface AppliedSignature {
  theme: ImmersiveTheme | null;
  presetId: string | null;
  activityId: string | null;
  audienceId: string | null;
  anchorEmphasisKey: string;
  riskKey: string | null;
}

const EMPTY_SIGNATURE: AppliedSignature = {
  theme: null,
  presetId: null,
  activityId: null,
  audienceId: null,
  anchorEmphasisKey: "",
  riskKey: null,
};

export class SceneController {
  private handle: SceneHandle | null = null;
  private scene: ImmersiveSceneDefinition | null = null;
  private unsubscribeFrame: (() => void) | null = null;
  private frameCallbacks = new Set<() => void>();
  private applied: AppliedSignature = { ...EMPTY_SIGNATURE };
  private wasRiskActive = false;
  private lastQuality: Quality | null = null;
  private lastReducedMotion: boolean | null = null;

  /** 挂载场景；无工厂返回 false（调用方走 FALLBACK 降级） */
  mount(canvas: HTMLCanvasElement, scene: ImmersiveSceneDefinition): boolean {
    const factory = getSceneFactory(scene.family);
    if (!factory) return false;

    this.disposeHandle();
    this.scene = scene;
    this.handle = factory(canvas, scene);
    this.applied = { ...EMPTY_SIGNATURE };
    this.wasRiskActive = false;
    this.unsubscribeFrame = this.handle.onFrame(() => {
      for (const cb of this.frameCallbacks) cb();
    });
    // 挂载后同步已设置的画质/动效偏好
    if (this.lastQuality) this.handle.setQuality(this.lastQuality);
    if (this.lastReducedMotion != null) this.handle.setReducedMotion(this.lastReducedMotion);
    return true;
  }

  /** 把机器状态映射到 SceneHandle（幂等：相同输入不重复触发） */
  syncState(state: ImmersiveState): void {
    const handle = this.handle;
    if (!handle) return;
    const scene = state.context.scene ?? this.scene;
    if (!scene) return;

    const { status, context: ctx } = state;

    if (status === "RISK_ACTIVE") {
      const playback = ctx.risk;
      if (!playback) return;
      const riskDef = scene.risks.find((risk) => risk.id === playback.riskId);
      if (!riskDef) return;
      const riskKey = `${playback.riskId}#${playback.stepIndex}`;
      if (this.applied.riskKey !== riskKey) {
        handle.applyRiskStep(riskDef, playback.stepIndex);
        this.applied.riskKey = riskKey;
      }
      this.wasRiskActive = true;
      return;
    }

    if (status !== "THEME_ACTIVE" && status !== "EXPLORE_IDLE") return;

    // 离开 RISK_ACTIVE：恢复平静一次（机器已原子清理 risk 状态）
    if (this.wasRiskActive) {
      handle.restoreCalm();
      this.wasRiskActive = false;
      this.applied.riskKey = null;
    }

    // applyTheme
    if (this.applied.theme !== ctx.activeTheme) {
      handle.applyTheme(ctx.activeTheme);
      this.applied.theme = ctx.activeTheme;
    }

    // applyPreset：selectedPreviewId ?? defaultPreviewId 对应的 ScenePreset
    const presetId = ctx.selectedPreviewId ?? ctx.defaultPreviewId;
    if (this.applied.presetId !== presetId) {
      const preset: ScenePreset | null = presetId
        ? scene.previewPresets.find((p) => p.id === presetId) ?? null
        : null;
      handle.applyPreset(preset);
      this.applied.presetId = presetId;
    }

    // applyActivity
    if (this.applied.activityId !== ctx.selectedActivityId) {
      const activity: ActivityDefinition | null = ctx.selectedActivityId
        ? scene.activities.find((a) => a.id === ctx.selectedActivityId) ?? null
        : null;
      handle.applyActivity(activity);
      this.applied.activityId = ctx.selectedActivityId;
    }

    // applyAudience
    if (this.applied.audienceId !== ctx.selectedAudienceId) {
      const audience: AudienceDefinition | null = ctx.selectedAudienceId
        ? scene.audiences.find((a) => a.id === ctx.selectedAudienceId) ?? null
        : null;
      handle.applyAudience(audience);
      this.applied.audienceId = ctx.selectedAudienceId;
    }

    // setAnchorEmphasis：选中 + 降强调集合
    const visible = selectVisibleAnchors(scene, ctx.activeTheme, ctx.selectedAnchorId);
    const dimmed = selectDimmedAnchorIds(visible, ctx.selectedAnchorId);
    const emphasisKey = `${ctx.selectedAnchorId ?? ""}|${Array.from(dimmed).sort().join(",")}`;
    if (this.applied.anchorEmphasisKey !== emphasisKey) {
      handle.setAnchorEmphasis(ctx.selectedAnchorId, dimmed);
      this.applied.anchorEmphasisKey = emphasisKey;
    }
  }

  setQuality(quality: Quality): void {
    if (this.lastQuality === quality) return;
    this.lastQuality = quality;
    this.handle?.setQuality(quality);
  }

  setReducedMotion(reduced: boolean): void {
    if (this.lastReducedMotion === reduced) return;
    this.lastReducedMotion = reduced;
    this.handle?.setReducedMotion(reduced);
  }

  /** V1.2 视角控制透传：factor<1 放大 / >1 缩小（无句柄时静默忽略） */
  zoomBy(factor: number): void {
    this.handle?.zoomBy(factor);
  }

  /** V1.2 视角控制透传：回默认机位 */
  resetCamera(): void {
    this.handle?.resetCamera();
  }

  /** V1.2 视角控制透传：自动环绕开关 */
  setAutoRotate(on: boolean): void {
    this.handle?.setAutoRotate(on);
  }

  /** 锚点投影：无句柄或不可投影返回 null */
  projectAnchor(positionRef: string): { x: number; y: number } | null {
    return this.handle?.projectToScreen(positionRef) ?? null;
  }

  /** 订阅渲染帧回调；返回退订函数 */
  onFrame(cb: () => void): () => void {
    this.frameCallbacks.add(cb);
    return () => {
      this.frameCallbacks.delete(cb);
    };
  }

  dispose(): void {
    this.disposeHandle();
    this.scene = null;
    this.frameCallbacks.clear();
  }

  private disposeHandle(): void {
    this.unsubscribeFrame?.();
    this.unsubscribeFrame = null;
    this.handle?.dispose();
    this.handle = null;
  }
}
