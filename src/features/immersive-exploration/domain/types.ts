/**
 * 沉浸式景点探索 · 领域类型契约（施工方案 V1.1 §4）
 *
 * 本文件是跨 Worker 的冻结契约：CORE / DATA / SCENES / UI 四组均依赖。
 * 修改需主 Agent 批准。类型字段与施工方案 §4.1–§4.7 一一对应。
 */

// ---------------------------------------------------------------- §4.1 探索对象

export type ExplorationEntityShape =
  | "point"
  | "area"
  | "route"
  | "activity_site"
  | "time_event";

export type SceneFamily =
  | "mountain"
  | "waterside"
  | "underwater"
  | "wilderness"
  | "human_city"
  | "engineering_route";

/** 首期启用的场景家族（§1 冻结规则）；V2 起六大家族全部启用 */
export const ENABLED_SCENE_FAMILIES: readonly SceneFamily[] = [
  "mountain",
  "waterside",
  "underwater",
  "wilderness",
  "human_city",
  "engineering_route",
] as const;

export type ExplorationChannel =
  | "nature"
  | "outdoor"
  | "history"
  | "wonder"
  | "leisure"
  | "engineering";

export interface ExplorationEntity {
  id: string;
  name: string;
  countryCode: string;
  shape: ExplorationEntityShape;
  sceneFamily: SceneFamily;
  channels: ExplorationChannel[];
  coordinates?: { lat: number; lng: number };
  bounds?: [[number, number], [number, number]];
  routeGeometry?: Array<{ lat: number; lng: number }>;
  activityTags: string[];
  attributeTags: string[];
  sceneDefinitionId: string;
  fallbackContentId: string;
  /** time_event 首期降级：挂靠的宿主对象 id（§4.1） */
  hostEntityId?: string;
}

// ---------------------------------------------------------------- §4.2 状态口径

export type PresentationMode = "live" | "typical_preview" | "risk_simulation";

export interface SourceMeta {
  sourceName?: string;
  sourceUrl?: string;
  updatedAt?: string;
  mode: PresentationMode;
}

// ---------------------------------------------------------------- §4.3 场景定义

export type CommonTheme = "highlights" | "experience" | "audience" | "cautions";

export type DeepTheme =
  | "nature_geology"
  | "water_ecology"
  | "underwater_ecology"
  | "story_past"
  | "engineering_operation";

export type ImmersiveTheme = CommonTheme | DeepTheme;

export interface CameraPreset {
  /** 相机位置（场景本地坐标） */
  position: [number, number, number];
  /** 注视点 */
  lookAt: [number, number, number];
  fov?: number;
}

export interface ArrivalDefinition {
  /** 抵达文案：名称副标题/核心自然属性 */
  subtitle: string;
  /** 当前最值得看的景观 */
  headlineSight: string;
  /** 当前主要玩法 */
  headlineActivity: string;
  /** 纯场景观察时长（ms），结束后才出现主题入口 */
  observeMs: number;
  /** 进入转场（含水下穿水叙事）的关键节拍 */
  transitionBeats: string[];
}

export interface ThemeDefinition {
  id: ImmersiveTheme;
  label: string;
  /** 主题激活后默认选中的内容 id（如 preset/activity/audience/risk） */
  defaultSelectionId?: string;
}

export interface ScenePreset {
  id: string;
  label: string;
  /** 适用月份（1-12），空 = 全年 */
  months: number[];
  /** 是否为地点代表性时段 */
  representative: boolean;
  mode: "typical_preview";
  sourceMeta: SourceMeta;
  /** 场景渲染参数（由场景实现解释，如雪线高度/光照/雾密度） */
  visual: Record<string, number | string | boolean>;
  /** 说明面板文案 */
  whereText: string;
  whenText: string;
  whyText: string;
}

export interface ImmersiveSceneDefinition {
  id: string;
  family: SceneFamily;
  entityName: string;
  regionLabel: string;
  defaultCamera: CameraPreset;
  arrival: ArrivalDefinition;
  themes: ThemeDefinition[];
  anchors: SceneAnchorDefinition[];
  previewPresets: ScenePreset[];
  activities: ActivityDefinition[];
  audiences: AudienceDefinition[];
  risks: RiskScenarioDefinition[];
  summaryRules: SummaryRule[];
  assets: SceneAssetManifest;
  fallback: FallbackDefinition;
}

// ---------------------------------------------------------------- §4.4 空间标签

export type AnchorType =
  | "peak"
  | "viewpoint"
  | "route"
  | "facility"
  | "activity_zone"
  | "ecology"
  | "risk_zone";

export interface SceneAnchorDefinition {
  id: string;
  label: string;
  anchorType: AnchorType;
  /**
   * 场景资产节点路径或语义坐标；加载时由场景实现解析为三维坐标。
   * 格式：`node:<节点名>` 或 `xyz:<x>,<y>,<z>`。
   * 校验器必须验证其可被对应场景解析。
   */
  positionRef: string;
  themes: ImmersiveTheme[];
  /** 说明面板内容 id，指向 anchorsContent */
  contentId: string;
  /** 展示优先级（数字小者优先保留，用于数量上限截断） */
  priority: number;
  onActivate?: SceneAction[];
}

/** 锚点说明内容（按 id 查表） */
export interface AnchorContent {
  id: string;
  title: string;
  body: string;
  sourceMeta?: SourceMeta;
}

/** 场景可执行动作（由场景实现解释；首期保持声明式） */
export interface SceneAction {
  kind:
    | "highlight_anchor"
    | "focus_camera"
    | "spawn_group"
    | "set_weather"
    | "set_water"
    | "set_light"
    | "show_route"
    | "dim_anchors";
  target?: string;
  params?: Record<string, number | string | boolean>;
}

// ---------------------------------------------------------------- §4.5 玩法与人群

export interface ActivityDefinition {
  id: string;
  label: string;
  applicable: boolean;
  routeRef?: string;
  zoneRefs?: string[];
  durationMinutes?: number;
  difficulty?: "easy" | "moderate" | "hard" | "expert";
  requirements?: string[];
  facilities?: string[];
  limitations?: string[];
  /** 说明面板正文 */
  description: string;
  sceneActions: SceneAction[];
}

export type AudienceId =
  | "toddler_family"
  | "school_age_family"
  | "senior"
  | "relaxed"
  | "photographer"
  | "hiker"
  | "adventure"
  | "beginner"
  | "experienced";

export interface AudienceDefinition {
  id: AudienceId;
  label: string;
  allowedActivityIds: string[];
  preferredRouteIds?: string[];
  hiddenRouteIds?: string[];
  facilityPriority?: string[];
  warnings?: string[];
}

// ---------------------------------------------------------------- §4.6 风险场景

export interface RiskScenarioDefinition {
  id: string;
  label: string;
  applicable: boolean;
  mode: "risk_simulation";
  /** 形成原因 */
  cause: string[];
  /** 发展过程（逐步演示） */
  sequence: RiskStep[];
  affectedAnchorIds: string[];
  /** 判断信号 */
  warningSignals: string[];
  /** 行动建议 */
  actions: string[];
  /** 对路线/玩法的影响说明（水域需分别说明岸边/亲子/水上） */
  impactTexts: { shoreText?: string; familyText?: string; waterText?: string; routeText?: string };
  officialAdvisoryBinding?: string;
}

export interface RiskStep {
  id: string;
  title: string;
  description: string;
  sceneActions: SceneAction[];
}

// ---------------------------------------------------------------- §4.7 旅行判断总结

export interface SummaryRule {
  /** 代表性玩法（无选择时默认） */
  representativeActivityId: string;
  /** 代表性玩法说明 */
  representativeReason: string;
  /** 最佳时间文案 */
  bestTimeText: string;
  /** 最佳体验文案 */
  bestExperienceText: string;
  /** 通用准备事项 */
  preparationItems: string[];
}

export type Suitability =
  | "very_suitable"
  | "suitable_with_conditions"
  | "not_recommended_now"
  | "insufficient_information";

export interface TravelDecisionSummary {
  entityId: string;
  selectedPreview?: string;
  selectedActivity?: string;
  selectedAudience?: string;
  bestTimeText: string;
  bestExperienceText: string;
  suitability: Suitability;
  suitabilityReasons: string[];
  mainCautions: string[];
  preparationItems: string[];
  actions: Array<
    "add_wishlist" | "view_preparation" | "add_journey" | "continue_planning" | "return_map"
  >;
  /** 各内容块的口径标识，总结页不得抹平（§4.2） */
  modeBadges: { preview: PresentationMode; cautions: PresentationMode; live?: PresentationMode };
}

// ---------------------------------------------------------------- 资产与降级

export interface SceneAssetManifest {
  /** 程序化资产：无外部 url；键为资产节点名，供 positionRef `node:` 解析 */
  proceduralNodes: string[];
  /** 估算资源体积（字节），性能预算核验用 */
  estimatedBytes: number;
}

export interface FallbackDefinition {
  /** 等价图文页内容（§12.1） */
  summary: string;
  sections: Array<{ theme: ImmersiveTheme; title: string; body: string }>;
}

// ---------------------------------------------------------------- 适配引擎输入

export interface DecisionInput {
  scene: ImmersiveSceneDefinition;
  previewId?: string;
  activityId?: string;
  audienceId?: string;
  /** Journey 计划月份（1-12）或用户选择月份 */
  plannedMonth?: number;
  /** 数据完整度 0-1（来源缺失程度） */
  dataCompleteness: number;
}
