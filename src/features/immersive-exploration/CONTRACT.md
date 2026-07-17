# 沉浸式景点探索 · 跨 Worker 施工契约（CONTRACT）

> 主 Agent 冻结。4 个并行 Worker（CORE / DATA / SCENES / UI）共用。
> 任何人不得修改「已冻结文件」：`domain/types.ts`、`state/immersive-machine.ts`、`analytics/immersive-events.ts`、`config.ts`、本文件。
> 零新增依赖（package.json 不动）；不运行 git 命令；不运行 npm install；测试与源码同目录 `*.test.ts(x)`。

## 目录所有权

```
src/features/immersive-exploration/
├── domain/            CORE 拥有（types.ts 除外，已冻结）
├── state/             CORE 拥有（immersive-machine.ts 除外，已冻结）
├── runtime/           CORE 拥有
├── scenes/            SCENES 拥有
├── data/              DATA 拥有
├── ui/                UI 拥有
├── analytics/         已冻结（主 Agent）
├── config.ts          已冻结（主 Agent）
├── index.ts           主 Agent 最后写（Worker 不要建）
└── immersive-exploration.css   UI 拥有
```

## 已冻结公共 API

### 状态机（state/immersive-machine.ts）
`transition(state, event)`、`INITIAL_STATE`、`isImmersiveActive(status)`、
`resolveDefaultPreviewId(scene, plannedMonth?, userMonth?, currentMonth?)`、
类型 `ImmersiveState/ImmersiveEvent/ImmersiveStatus/ImmersiveContext/RiskPlayback`。

### 埋点（analytics/immersive-events.ts）
`trackImmersiveEvent(name, { entityId, ...params })`、`readImmersiveEvents(filter?)`、
`clearImmersiveEvents()`、`setImmersiveEventSink(sink|null)`。事件名见 §11.4 表。

### Feature Flag（config.ts）
`isImmersiveExplorationEnabled(): boolean`。

## Worker 必须提供的 API

### CORE：`domain/selectors.ts`
```ts
export const ANCHOR_CAP_DEFAULT = 3;   // 默认态标签上限（§6.4）
export const ANCHOR_CAP_THEME = 5;     // 主题激活态上限
/** 按 activeTheme 过滤 + priority 升序截断；选中锚点始终保留 */
export function selectVisibleAnchors(
  scene: ImmersiveSceneDefinition,
  activeTheme: ImmersiveTheme | null,
  selectedAnchorId: string | null,
): SceneAnchorDefinition[];
/** 非相关标签降低强调：返回应降强调（dimmed）的锚点 id 集合 */
export function selectDimmedAnchorIds(visible: SceneAnchorDefinition[], selectedAnchorId: string | null): Set<string>;
```

### CORE：`domain/decision-engine.ts`
```ts
/** 动态适配结论（§11）：无固定星级；含无选择默认规则（§4.7） */
export function buildTravelDecisionSummary(input: DecisionInput): TravelDecisionSummary;
```
规则：plannedMonth 与 preview 月份冲突、audience 与 activity 不匹配（allowedActivityIds 不含）、limitations 触发 audience.warnings → 降级结论并给原因；dataCompleteness < 0.5 → `insufficient_information`，不得编造。

### CORE：`domain/schemas.ts`
```ts
/** 运行期校验（手写，不用 zod）。返回错误信息数组，空 = 通过 */
export function validateSceneDefinition(scene: unknown, knownNodeNames?: readonly string[]): string[];
export function validateExplorationEntity(entity: unknown): string[];
```
校验锚点 positionRef 格式 `node:<name>` | `xyz:<x>,<y>,<z>`；给出 knownNodeNames 时校验 `node:` 可解析。

### CORE：`state/immersive-store.ts`
```ts
export function useImmersiveStore(): { state: ImmersiveState; dispatch: (e: ImmersiveEvent) => void };
export function ImmersiveStoreProvider(props: { children: React.ReactNode }): JSX.Element;
```
Provider 内部 useReducer(transition, INITIAL_STATE)，并在 dispatch 包装里按事件映射触发埋点（enter_start/enter_complete/enter_cancel/arrival_complete/theme_activate/scene_anchor_activate/preview_switch/activity_select/audience_select/risk_start/risk_pause/risk_replay/risk_restore/summary_generate/summary_action/fallback_enter/exit_method）。

### CORE：`runtime/`（UI Worker 消费）
```ts
// scene-controller.ts —— 持有 SceneHandle 生命周期，把机器状态同步到场景
export class SceneController {
  mount(canvas: HTMLCanvasElement, scene: ImmersiveSceneDefinition): boolean; // false=无工厂→调用方走 FALLBACK
  syncState(state: ImmersiveState): void;
  setQuality(q: "high" | "standard" | "low"): void;
  setReducedMotion(reduced: boolean): void;
  projectAnchor(positionRef: string): { x: number; y: number } | null;
  onFrame(cb: () => void): () => void;
  dispose(): void;
}

// transition-controller.ts —— 进入/抵达时序，可取消（enterToken 失效即停）
export function runEnterSequence(opts: {
  scene: ImmersiveSceneDefinition; token: number; isCurrent: (token: number) => boolean;
  reducedMotion: boolean;
  onBeat?: (beat: string, index: number) => void;
  onDone: () => void;   // → arrivalComplete
}): () => void;          // 返回取消函数
export function runArrivalObserve(scene: ImmersiveSceneDefinition, reducedMotion: boolean, onDone: () => void): () => void;

// anchor-controller.ts —— 纯函数 + 订阅
export { } // 逻辑直接在 selectors；此文件提供：
export function useAnchorPositions(controller: SceneController | null, anchors: SceneAnchorDefinition[]): Record<string, { x: number; y: number }>;

// theme-controller.ts —— InfoPanel 内容解析（纯函数）
export interface ThemePanelModel { kind: "presets" | "activities" | "audiences" | "risks" | "deep"; title: string; }
export function resolveThemePanel(scene: ImmersiveSceneDefinition, theme: ImmersiveTheme | null): ThemePanelModel;

// risk-controller.ts —— 播放中时序推进
export function runRiskPlayback(opts: {
  risk: RiskScenarioDefinition; stepIndex: number; playing: boolean;
  stepMs?: number; onStep: (nextIndex: number) => void;
}): () => void; // 播完最后一步停住（不自动消失，§1）
```

### SCENES：`scenes/scene-registry.ts`
```ts
export type SceneFactory = (canvas: HTMLCanvasElement, scene: ImmersiveSceneDefinition) => SceneHandle;
export function getSceneFactory(family: SceneFamily): SceneFactory | null; // 未启用家族 → null
export interface SceneHandle {
  applyTheme(theme: ImmersiveTheme | null): void;
  applyPreset(preset: ScenePreset | null): void;
  applyActivity(activity: ActivityDefinition | null): void;
  applyAudience(audience: AudienceDefinition | null): void;
  applyRiskStep(risk: RiskScenarioDefinition, stepIndex: number): void;
  restoreCalm(): void;
  setAnchorEmphasis(selectedAnchorId: string | null, dimmedIds: ReadonlySet<string>): void;
  projectToScreen(positionRef: string): { x: number; y: number } | null;
  onFrame(cb: () => void): () => void;
  setQuality(q: "high" | "standard" | "low"): void;
  setReducedMotion(reduced: boolean): void;
  dispose(): void;
}
```
实现要点：raw three.js（同 cobe-globe-weather 模式，不引 R3F）；程序化资产零外链；
低性能档关粒子/后处理；reducedMotion 停动画循环（渲染单帧静态）；dispose 释放 geometry/material/renderer/listener。

**语义节点名握手（每个场景必须以 Object3D.name 创建，供 `node:` positionRef 解析）**：
- mountain：`peak` `crater` `trail_main` `trail_family` `viewpoint_a` `viewpoint_b` `station_5th` `snow_line` `vegetation_alpine` `risk_slope`
- waterside：`shore_walk` `pier` `boat_zone` `paddle_zone` `viewpoint_a` `viewpoint_b` `wetland` `lakeside_trail` `risk_open_water`
- underwater：`entry_point` `reef_flat` `coral_garden` `seagrass` `cave` `drop_off` `fish_school` `turtle_zone` `boat_channel` `risk_current`

`projectToScreen`：`node:` → 按名找对象取世界坐标投影；`xyz:` → 直接投影。被遮挡/出屏返回 null。

### DATA：`data/adapters/attraction-adapter.ts`
```ts
import type { Attraction } from "../../../features/attraction-explorer/types";
/** 推断失败返回 null（调用方走标准图文降级页，§4.1） */
export function toExplorationEntity(attraction: Attraction): ExplorationEntity | null;
export function isImmersiveEligible(attraction: Attraction): boolean;
```
推断规则（策展覆盖优先）：sceneDefinitionId 命中已注册场景配置 → 直接用其 family/shape；
否则按 category_l1/category_l2/tags 关键词映射（山/岳/火山/峰→mountain；湖/海岸/温泉/滨→waterside；潜水/浮潜/珊瑚→underwater）；
未启用家族（wilderness/human_city/engineering_route）→ 保留枚举但 isImmersiveEligible=false；
time_event（花期/祭典类）→ shape=time_event + hostEntityId 可推断时挂靠，否则非沉浸。

### DATA：`data/scene-configs/` 黄金样例三件套（冻结 id）
| 场景 | sceneDefinitionId | entityId | family |
|---|---|---|---|
| 富士山 | `scene-mount-fuji` | `mount-fuji` | mountain |
| 洞爷湖 | `scene-lake-toya` | `lake-toya` | waterside |
| 马尔代夫珊瑚花园 | `scene-maldives-coral-garden` | `maldives-coral-garden` | underwater |

```ts
// data/scene-configs/index.ts
export function getSceneDefinition(id: string): ImmersiveSceneDefinition | null;
export const GOLDEN_SCENE_IDS: readonly string[];
// data/resolve-immersive-target.ts（main.jsx 入口用）
export interface ImmersiveTarget { entity: ExplorationEntity; scene: ImmersiveSceneDefinition }
export function resolveImmersiveTarget(attraction: Attraction): ImmersiveTarget | null;
```
内容量下限（每场景）：anchors 6–8（仅用契约节点名，priority 各异，themes 覆盖五主题）；anchorContents 与 contentId 一一对应（放在各自配置文件里导出，类型 AnchorContent[]）；previewPresets ≥3（含 representative=true、months 覆盖秋冬，文案含哪里看/什么时间/为什么/典型预览口径）；activities ≥4（难度/时长/设施/限制各异）；audiences ≥4；risks ≥2 且 applicable，sequence ≥3 步，cause/warningSignals/actions/impactTexts 完整；水下场景 arrival.transitionBeats 必须含「接近水面→穿过水面→光线和空间状态变化→水下场景稳定→生态对象进入→主题入口出现」六拍；fallback.sections 覆盖全部五主题；assets.proceduralNodes 列出所用契约节点名，estimatedBytes 估 0。
生物文案统一「通常有机会观察到」，禁止固定概率与必然性（校验器 + 文案测试强制）。

### DATA：`data/validators/`
```ts
// scene-config-validator.ts
export function validateGoldenSamples(): string[]; // 跑三件套 + 契约节点名集合
export const CONTRACT_NODE_NAMES: Record<"mountain" | "waterside" | "underwater", readonly string[]>;
// copy-validator.ts
export function findForbiddenCopy(text: string): string[]; // 命中「必然/一定能看到/100%/概率xx%」等
```

### UI：组件（props 自定义，顶层契约如下）
```tsx
// ui/ImmersiveExperience.tsx —— main.jsx 唯一集成点
export interface ImmersiveExperienceProps {
  entity: ExplorationEntity;
  scene: ImmersiveSceneDefinition;
  plannedMonth?: number | null;          // Journey 计划月份
  liveSnapshot?: DestinationLiveSnapshot | null; // 来自 src/features/live-data/destination-live.ts
  quality?: "high" | "standard" | "low";
  reducedMotion?: boolean;
  onAddWishlist?: (entity: ExplorationEntity) => void;
  onViewPreparation?: (entity: ExplorationEntity) => void;
  onAddJourney?: (entity: ExplorationEntity) => void;
  onContinuePlanning?: (entity: ExplorationEntity) => void;
  onExit: (outcome: "return_map" | "continue_planning" | "cancel" | "fallback_info") => void;
}
```
组成：ImmersiveOverlay（全屏，含 SceneCanvas 渲染 SceneController）、ArrivalIntro、ThemeMenu（底部五主题 tab）、SceneAnchors（HTML 空间标签层，跟随 projectToScreen，含 ≤44pt 触控）、InfoPanel（桌面右侧/移动底部抽屉）、RiskControls（暂停/重播/恢复平静/上一步/下一步 + 五段说明）、DecisionSummary（四卡 + 五动作按钮 + 三态标识）、FallbackInfoView（等价图文页，含重试/返回）。
必须：三态标识（当前实况=来源+时间 / 典型景色预览 / 风险情境演示·非当前实况）出现在场景角标、InfoPanel、总结页；风险触发入口只在 cautions 主题；键盘可达（tab 顺序 + Esc 返回）；`aria-live` 关键状态；无音频。

## 主题中文标签（UI 统一）
highlights 景色 · experience 怎么玩 · audience 适合谁 · cautions 注意什么 · nature_geology 自然观察 · water_ecology 水域生态 · underwater_ecology 水下生态

## 视觉基准
参考图：`doc/景点探索详细场景/施工清单/参考UI/`（暗色 atlas 主题、右侧信息面板、底部主题 tab、空间标签带引线、总结页卡片 + CTA）。CSS 前缀 `ix-`，桌面断点 760px（与 MobileAtlasShell 一致），移动底部抽屉。

## 测试要求（各 Worker 随代码交付）
- CORE：状态机已冻结无需测；selectors（上限/截断/降强调）、decision-engine（含无选择默认、insufficient_information）、schemas、theme-controller、store 埋点映射。
- DATA：适配器映射（含未启用家族/time_event 降级）、三件套 schema 校验通过、positionRef 可解析、文案禁用词校验。
- SCENES：注册表命中/未启用家族 null；节点名解析逻辑（纯逻辑部分抽离可测，three.js 渲染不测）。
- UI（RTL/jsdom，SceneController 可 stub）：单主题激活、切换清理、风险仅 cautions 可触发、暂停/重播/恢复、标签上限渲染、总结默认生成、FallbackInfoView 内容完整、Esc/键盘。

验证命令：`npx vitest run src/features/immersive-exploration/<你的目录>`。
全量 typecheck/build 由主 Agent 集成时执行（并行期间其他目录尚未就绪，勿因他处报错停工）。
