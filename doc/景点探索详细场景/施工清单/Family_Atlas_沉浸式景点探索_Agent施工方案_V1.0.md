# Family Atlas 沉浸式景点探索 — Agent 施工方案 V1.0

> 本文可直接交给编码 Agent 执行。  
> 目标：在现有 Family Atlas 项目中完成“地图进入沉浸场景—交互探索—旅行判断总结—返回地图”的首期闭环。  
> 首期场景严格限定为：**山地、水域、水下**。  
> 其他场景家族只保留类型和扩展接口，不实现页面与场景内容。

---

## 0. 执行方式

你是本项目的施工 Agent。请按以下顺序执行：

1. 先审计仓库，不要立即重构。
2. 输出审计结论、拟修改文件、技术复用方案和风险。
3. 在不改变已冻结产品规则的前提下实施。
4. 每个阶段完成后运行测试并汇报，再进入下一阶段。
5. 遇到非阻塞性缺失信息时采用可替换的本地配置或 Mock，不停止施工。
6. 只有以下情况才向用户提问：
   - 缺少必要仓库权限；
   - 无法确定应接入的真实现有业务入口；
   - 必须使用收费服务或新增外部平台；
   - 现有代码与冻结方案存在不可兼容冲突。
7. 不自行扩大到生态荒野、人文城市、工程线路。
8. 不把本项目做成一个独立 Demo；必须接入现有地图、POI、心愿和 Journey 流程。

---

## 1. 冻结产品规则

以下规则不得修改：

- 功能定位是“目的地沉浸预演与旅行判断”，不是三维模型展示器。
- 完整流程：
  `地图巡航 → 选择探索对象 → 俯冲进入 → 抵达观察 → 沉浸探索 → 旅行判断总结 → 返回地图`
- 探索对象形态：
  `point | area | route | activity_site | time_event`
- 场景家族：
  `mountain | waterside | underwater | wilderness | human_city | engineering_route`
- 首期只启用：
  `mountain | waterside | underwater`
- 四个公共主题：
  `highlights | experience | audience | cautions`
- 第五主题：
  - 山地：`nature_geology`
  - 水域：`water_ecology`
  - 水下：`underwater_ecology`
- 同一时间只能激活一个主主题。
- 点击标签必须同时改变：
  1. 场景表现；
  2. 空间标签；
  3. 说明内容。
- 当前实况、典型景色预览、风险演示必须严格分开。
- 风险演示必须包含：
  `形成原因 → 发展过程 → 影响区域 → 判断信号 → 行动建议`
- 风险由用户主动触发，支持暂停、重播、恢复平静。
- 不使用固定星级；输出动态、可解释的适配结论。
- 水下是独立完整场景，不是水域场景中的短暂特效。
- 探索结束必须生成旅行判断总结，并连接心愿、准备事项、Journey 和返回地图。
- 始终保留取消、返回和非沉浸式信息入口。

---

## 2. 开工前仓库审计

先输出《仓库审计报告》，至少包含：

### 2.1 工程现状

- 前端框架、语言、构建工具和路由方式。
- 当前地图组件、地图状态和选中 POI 的管理方式。
- 是否已有三维/WebGL/动画能力。
- 当前全局状态管理方式。
- POI 数据结构和来源。
- Journey、心愿、准备事项的现有入口。
- 当前天气、风险、开放状态等数据是否已有统一数据网关。
- 测试框架、部署方式和错误监控。

### 2.2 复用原则

按以下优先级做技术决策：

1. 复用现有地图和三维技术栈。
2. 复用现有状态管理、请求层、组件库和动画库。
3. 若项目已有 Three.js、React Three Fiber 或其他三维方案，继续使用。
4. 若没有三维能力：
   - React 项目优先采用 React Three Fiber；
   - 非 React 项目采用原生 Three.js；
   - 不更换现有地图框架。
5. 不为本功能新建第二套全局状态框架。
6. 不为视觉效果引入大型依赖，除非现有实现无法满足。
7. 所有新模块必须可按 Feature Flag 关闭。

### 2.3 审计输出格式

```text
现有技术栈
现有地图入口
现有 POI 数据
现有 Journey/心愿入口
可复用模块
需要新增模块
计划修改文件
计划新增文件
主要风险
回滚方式
```

审计完成后直接继续施工，除非发现阻塞项。

---

## 3. 目标模块结构

目录必须适配现有仓库；若没有类似结构，使用下面的逻辑分层：

```text
immersive-exploration/
├── domain/
│   ├── types.ts
│   ├── schemas.ts
│   ├── selectors.ts
│   └── decision-engine.ts
├── state/
│   ├── immersive-machine.ts
│   └── immersive-store.ts
├── scenes/
│   ├── scene-registry.ts
│   ├── mountain/
│   ├── waterside/
│   └── underwater/
├── runtime/
│   ├── scene-controller.ts
│   ├── transition-controller.ts
│   ├── anchor-controller.ts
│   ├── theme-controller.ts
│   └── risk-controller.ts
├── data/
│   ├── scene-configs/
│   ├── adapters/
│   └── validators/
├── ui/
│   ├── ImmersiveOverlay
│   ├── ArrivalIntro
│   ├── ThemeMenu
│   ├── SceneAnchor
│   ├── InfoPanel
│   ├── RiskControls
│   ├── DecisionSummary
│   └── FallbackInfoView
└── tests/
```

禁止将所有逻辑塞入一个地图页面组件。

---

## 4. 领域数据契约

### 4.1 探索对象

```ts
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

export interface ExplorationEntity {
  id: string;
  name: string;
  countryCode: string;
  shape: ExplorationEntityShape;
  sceneFamily: SceneFamily;
  channels: Array<
    | "nature"
    | "outdoor"
    | "history"
    | "wonder"
    | "leisure"
    | "engineering"
  >;
  coordinates?: { lat: number; lng: number };
  bounds?: [[number, number], [number, number]];
  routeGeometry?: Array<{ lat: number; lng: number }>;
  activityTags: string[];
  attributeTags: string[];
  sceneDefinitionId: string;
  fallbackContentId: string;
}
```

### 4.2 状态口径

```ts
export type PresentationMode =
  | "live"
  | "typical_preview"
  | "risk_simulation";

export interface SourceMeta {
  sourceName?: string;
  sourceUrl?: string;
  updatedAt?: string;
  mode: PresentationMode;
}
```

规则：

- `live` 必须有来源和更新时间；否则降级为 `typical_preview`。
- `typical_preview` 必须显示“典型景色预览”。
- `risk_simulation` 必须显示“风险情境演示 · 非当前实况”。

### 4.3 场景定义

```ts
export type CommonTheme =
  | "highlights"
  | "experience"
  | "audience"
  | "cautions";

export type DeepTheme =
  | "nature_geology"
  | "water_ecology"
  | "underwater_ecology"
  | "story_past"
  | "engineering_operation";

export interface ImmersiveSceneDefinition {
  id: string;
  family: SceneFamily;
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
```

### 4.4 空间标签

```ts
export interface SceneAnchorDefinition {
  id: string;
  label: string;
  anchorType:
    | "peak"
    | "viewpoint"
    | "route"
    | "facility"
    | "activity_zone"
    | "ecology"
    | "risk_zone";
  positionRef: string;
  themes: Array<CommonTheme | DeepTheme>;
  contentId: string;
  onActivate?: SceneAction[];
}
```

### 4.5 玩法与人群

```ts
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
  sceneActions: SceneAction[];
}

export interface AudienceDefinition {
  id:
    | "toddler_family"
    | "school_age_family"
    | "senior"
    | "relaxed"
    | "photographer"
    | "hiker"
    | "adventure"
    | "beginner"
    | "experienced";
  label: string;
  allowedActivityIds: string[];
  preferredRouteIds?: string[];
  hiddenRouteIds?: string[];
  facilityPriority?: string[];
  warnings?: string[];
}
```

### 4.6 风险场景

```ts
export interface RiskScenarioDefinition {
  id: string;
  label: string;
  applicable: boolean;
  mode: "risk_simulation";
  cause: string[];
  sequence: RiskStep[];
  affectedAnchorIds: string[];
  warningSignals: string[];
  actions: string[];
  officialAdvisoryBinding?: string;
}

export interface RiskStep {
  id: string;
  title: string;
  description: string;
  sceneActions: SceneAction[];
}
```

### 4.7 旅行判断总结

```ts
export interface TravelDecisionSummary {
  entityId: string;
  selectedPreview?: string;
  selectedActivity?: string;
  selectedAudience?: string;
  bestTimeText: string;
  bestExperienceText: string;
  suitability:
    | "very_suitable"
    | "suitable_with_conditions"
    | "not_recommended_now"
    | "insufficient_information";
  suitabilityReasons: string[];
  mainCautions: string[];
  preparationItems: string[];
  actions: Array<
    | "add_wishlist"
    | "view_preparation"
    | "add_journey"
    | "continue_planning"
    | "return_map"
  >;
}
```

---

## 5. 沉浸状态机

实现单一可测试状态机；状态名称可适配现有代码，但语义必须完整：

```text
MAP_IDLE
TARGET_SELECTED
ENTERING
ARRIVAL
EXPLORE_IDLE
THEME_ACTIVE
RISK_ACTIVE
SUMMARY
RETURNING
FALLBACK
```

### 5.1 核心转换

```text
MAP_IDLE
  → selectEntity
TARGET_SELECTED
  → enter
ENTERING
  → arrivalComplete
ARRIVAL
  → introComplete
EXPLORE_IDLE
  → activateTheme
THEME_ACTIVE
  → activateTheme / clearTheme / startRisk / finishExplore
RISK_ACTIVE
  → pause / replay / restore / finishExplore
SUMMARY
  → addWishlist / viewPreparation / addJourney / returnMap
RETURNING
  → mapRestored
MAP_IDLE
```

### 5.2 状态规则

- 新目标被选择时，取消旧进入任务和异步加载。
- 切换主题前必须执行 `clearActiveTheme()`。
- 离开场景必须停止动画、声音、观察器和事件监听。
- 返回地图时恢复进入前保存的地图快照。
- 资源错误进入 `FALLBACK`，而不是白屏或终止流程。
- 风险演示不改变 `live` 数据状态。

---

## 6. 页面与交互结构

### 6.1 地图探索态

保留现有地图页面和锚点列表，不重做整页。

点击可沉浸对象时：

1. 保存地图快照；
2. 保存当前选中对象和列表位置；
3. 加载场景定义；
4. 进入沉浸层；
5. 关闭或降低无关地图控件的视觉优先级。

### 6.2 进入过程

只显示：

- 地点名称；
- 地点类型；
- Journey 月份或当前预览条件；
- 取消/返回入口。

不要显示完整详情面板、全部标签或旅行总结。

### 6.3 首次抵达

只显示：

- 名称；
- 类型/核心自然属性；
- 当前最值得看的景观；
- 当前主要玩法。

纯场景观察结束后再显示主题入口。

### 6.4 探索态

公共主题：

- 看什么；
- 怎么体验；
- 适合谁；
- 注意什么；
- 类型专属第五主题。

要求：

- 同一时间只激活一个主题。
- 主题激活后最多显示必要空间标签。
- 选择一个空间标签时，其他非相关标签降低强调。
- 说明面板内容必须与场景状态一致。
- 提供退出探索、返回和非沉浸式信息入口。

---

## 7. 山地场景施工

### 7.1 默认抵达

必须呈现：

- 地形高差；
- 峰顶或主要高度带；
- 1–3 个核心观景点；
- 主要轻松观景或徒步入口；
- 当前月份对应的典型景观。

### 7.2 看什么

按地点适用性配置：

- 红叶；
- 积雪；
- 云海；
- 日出/日落；
- 雪线；
- 火山口或地质结构。

激活某一景色后：

1. 改变对应场景状态；
2. 高亮相关观景点；
3. 更新说明：
   - 哪里看；
   - 什么时间看；
   - 为什么值得看；
   - 是否为典型预览。

### 7.3 怎么体验

支持按地点启用：

- 轻松观景；
- 亲子短途；
- 徒步；
- 登山；
- 摄影。

每个玩法必须拥有不同的：

- 路线；
- 坡度或难度；
- 预计时长；
- 设施；
- 限制；
- 风险。

### 7.4 适合谁

选择人群后：

- 高亮推荐路线；
- 隐藏或降低不适用路线；
- 强调厕所、休息点、护栏、交通入口等设施；
- 更新适配结论与原因。

### 7.5 自然与地质观察

按地点适用性展示：

- 海拔植被带；
- 高山植物；
- 岩层；
- 火山地貌；
- 雪线；
- 典型鸟类或动物活动区。

不得为所有山地强制展示同一内容。

### 7.6 注意什么

按地点配置雷暴、落石、泥石流、雪崩等风险。

每个风险必须逐步展示：

1. 形成原因；
2. 前兆；
3. 发展过程；
4. 受影响区域；
5. 对路线/玩法的影响；
6. 判断信号；
7. 行动建议；
8. 非当前实况标识；
9. 暂停、重播、恢复平静。

---

## 8. 水域场景施工

### 8.1 默认抵达

必须呈现：

- 水面；
- 岸线；
- 核心观景点；
- 水上活动区；
- 岸边休闲路线；
- 当前月份或代表性时段景观。

### 8.2 看什么

按地点适用性配置：

- 清晨薄雾；
- 晴天倒影；
- 傍晚；
- 夜景；
- 季节性岸线；
- 花期或冰封等真实差异。

激活后同步更新观景点和说明。

### 8.3 怎么体验

支持按地点启用：

- 湖边漫步；
- 游船；
- 独木舟；
- SUP；
- 骑行；
- 摄影。

每种玩法显示：

- 路线或活动区；
- 预计时长；
- 设施；
- 预约或资质要求；
- 禁止区域；
- 风浪或水温限制。

### 8.4 适合谁

- 亲子和老人优先显示平坦、短距离、设施完善区域。
- 初学者不显示高风浪或专业水上玩法。
- 专业活动显示装备、经验和现场条件要求。
- 输出动态适配原因，不使用固定星级。

### 8.5 水域生态观察

按地点适用性展示：

- 候鸟；
- 水生植物；
- 湖色/水质现象；
- 岸线生态；
- 季节性鱼类活动；
- 湿地观察区。

统一使用概率性表达，不承诺必然观察到。

### 8.6 注意什么

按地点配置：

- 风浪；
- 低水温；
- 薄冰；
- 水位变化；
- 雷暴；
- 码头或活动关闭。

需要分别解释：

- 对岸边漫步的影响；
- 对亲子活动的影响；
- 对水上活动和返航的影响。

---

## 9. 水下场景施工

### 9.1 独立性

水下必须拥有独立：

- 场景定义；
- 主题状态；
- 生态内容；
- 玩法；
- 风险；
- 旅行总结。

不得只在水域场景中播放一段下潜动画后返回。

### 9.2 进入叙事

完整流程：

```text
接近水面
→ 穿过水面
→ 光线、声音和空间状态变化
→ 水下场景稳定
→ 生态对象进入
→ 主题入口出现
```

过程可取消，失败时进入等价信息页。

### 9.3 看什么

展示：

- 水深；
- 能见度；
- 光线；
- 水温；
- 岩礁/珊瑚/海草/洞穴等生态区。

鱼种规则：

- 有可靠来源：允许展示名称、常见深度、季节和观察注意事项。
- 无可靠来源：只展示“近岸鱼群、珊瑚生态、海草区”等类别。
- 统一使用“通常有机会观察到”。
- 禁止固定出现概率和必然性文案。

### 9.4 怎么体验

支持按地点启用：

- 浮潜；
- 体验潜水；
- 持证潜水；
- 水下摄影；
- 生态观察。

不同玩法显示：

- 深度范围；
- 入水/活动/返回区域；
- 资质或陪同要求；
- 经验等级；
- 限制条件；
- 适用生态观察区域。

### 9.5 适合谁

必须区分：

- 初学者；
- 有经验者；
- 学龄儿童可参与的替代活动；
- 不适合幼儿或无资质用户的活动。

不把专业潜水路线推荐给不匹配人群。

### 9.6 水下生态

- 鱼群或代表性生态对象可从场景外进入。
- 标签锚定到生物或生态区域。
- 点击后更新观察说明。
- 禁止投喂、触碰等注意事项可作为生态说明的一部分。

### 9.7 注意什么

支持：

- 海流；
- 下潜流；
- 能见度下降；
- 水面风浪；
- 雷暴影响；
- 船只航道等适用风险。

风险变化必须影响：

- 推荐路线；
- 可用活动；
- 适配结论；
- 总结中的主要注意事项。

---

## 10. 数据绑定与可信度

优先复用项目现有数据网关。

### 10.1 数据优先级

```text
已有可信实时数据
→ 项目已有结构化内容
→ 本地策展配置
→ 等价信息降级
```

### 10.2 三种模式

#### 当前实况

- 必须有来源和更新时间。
- 只影响当前状态说明，不自动触发夸张风险演示。

#### 典型景色预览

- 来源于可靠历史特征、策展内容或季节规则。
- 明确显示“典型景色预览”。

#### 风险情境演示

- 来源于地点适用风险配置。
- 明确显示“风险情境演示 · 非当前实况”。
- 当前有官方提醒时，另行显示来源入口，不与模拟合并。

### 10.3 禁止事项

- 不伪造实时数据。
- 不把多个国家或机构的建议合并成统一“官方结论”。
- 不编造鱼类、动物、花期或出现概率。
- 不将演示效果解释成当前现场画面。

---

## 11. 动态适配与旅行总结

### 11.1 适配输入

至少考虑：

- Journey 日期或用户选择日期；
- 人群；
- 玩法；
- 路线/区域可用性；
- 风险或限制；
- 设施；
- 数据完整度。

### 11.2 适配输出

不使用固定星级，输出：

- `very_suitable`
- `suitable_with_conditions`
- `not_recommended_now`
- `insufficient_information`

必须附带可解释原因。

### 11.3 总结页

包含：

- 当前选择的景色/时段；
- 最适合的玩法；
- 当前用户/家庭适配结论；
- 主要风险；
- 准备事项；
- 加入心愿；
- 查看准备事项；
- 加入 Journey 或继续规划；
- 返回地图。

按钮必须接入项目现有真实业务入口；若入口尚未存在，使用明确的 Feature Flag 和占位行为，不伪装成已完成。

---

## 12. 降级、无障碍与清理

### 12.1 非沉浸式入口

所有首期场景必须有等价图文页，包含：

- 地点摘要；
- 看什么；
- 怎么体验；
- 适合谁；
- 注意什么；
- 第五主题内容；
- 旅行判断总结。

### 12.2 资源异常

出现模型、纹理、数据或渲染错误时：

1. 停止进入任务；
2. 清理场景资源；
3. 显示等价信息；
4. 保留返回地图和业务行动；
5. 记录可定位错误，不显示内部堆栈。

### 12.3 清理要求

离开沉浸模式时必须清理：

- 动画循环；
- 定时器；
- 音频；
- DOM/Canvas 监听器；
- Resize/Intersection Observer；
- 请求；
- 场景对象；
- 临时标签；
- 风险状态；
- 地图遮罩。

### 12.4 可访问性

- 所有主题、标签、暂停、返回和总结按钮可键盘访问。
- 提供减少动态效果模式。
- 不仅依靠颜色表达风险和状态。
- 风险演示提供文字等价说明。
- 焦点在进入、主题切换、总结和返回后正确迁移。

---

## 13. 测试要求

### 13.1 单元测试

- 探索对象映射。
- 场景家族注册。
- 默认预览优先级。
- 单主题激活。
- 主题切换清理。
- 风险步骤控制。
- 状态口径校验。
- 适配结论生成。
- 总结生成。
- 文案概率性约束。

### 13.2 集成测试

- 地图进入与返回快照。
- 快速切换目标取消旧任务。
- 山地五主题完整流程。
- 水域五主题完整流程。
- 水下进入、主题、风险和退出。
- 实况/预览/模拟标识。
- Journey、心愿和准备入口。
- 资源失败降级。
- 低动态模式。

### 13.3 端到端测试

至少覆盖：

1. 从地图进入山地，切换景色，选择亲子短途，查看雷暴风险，生成总结并返回。
2. 从地图进入水域，切换傍晚景色，选择游船，查看风浪风险，加入心愿。
3. 从水面进入水下，选择体验潜水，查看鱼群和海流风险，加入 Journey。
4. 进入过程中切换到另一个 POI。
5. 资源加载失败后使用非沉浸式信息完成决策。
6. 键盘完成进入、主题切换、暂停风险、打开总结和返回。

---

## 14. 分阶段施工顺序

### Phase 0：审计与计划

交付：

- 仓库审计报告；
- 修改文件清单；
- 复用技术决策；
- 风险和回滚方案。

验收门：用户需求与仓库入口映射清楚。

### Phase 1：领域模型和公共状态

施工：

- 类型与 Schema；
- 场景注册表；
- 状态机；
- Feature Flag；
- 地图快照；
- 统一主题和风险控制器。

验收门：使用最小 Mock 可以完成进入、切换主题、总结和返回。

### Phase 2：地图与沉浸壳层

施工：

- 地图入口；
- 转场；
- 抵达层；
- 主题菜单；
- 信息面板；
- 非沉浸式入口；
- 返回恢复。

验收门：无具体场景内容也能走通公共流程。

### Phase 3：山地

施工：

- 山地配置；
- 景色；
- 玩法路线；
- 人群筛选；
- 自然与地质观察；
- 风险；
- 总结。

验收门：山地完整端到端测试通过。

### Phase 4：水域

施工：

- 水域配置；
- 景色；
- 水岸/水上玩法；
- 人群筛选；
- 水域生态；
- 风险；
- 总结。

验收门：水域完整端到端测试通过。

### Phase 5：水下

施工：

- 独立水下场景；
- 穿水进入；
- 生态对象；
- 潜水玩法；
- 水下生态；
- 风险；
- 总结。

验收门：水下完整端到端测试通过。

### Phase 6：真实业务接入

施工：

- 绑定已有天气、风险和 POI 数据；
- 接入 Journey、心愿和准备事项；
- 数据来源与更新时间；
- Feature Flag 与降级。

验收门：无伪造入口、无假实时数据。

### Phase 7：质量与交付

施工：

- 单元、集成、E2E；
- 可访问性；
- 清理与泄漏检查；
- 错误降级；
- 文档和截图/录屏；
- 回滚说明。

验收门：全部 Definition of Done 通过。

---

## 15. Definition of Done

只有同时满足以下条件才算完成：

- 首期只实现山地、水域、水下，没有范围扩散。
- 地图进入、沉浸探索、总结和返回形成完整闭环。
- 返回地图恢复原上下文。
- 三套场景均包含四个公共主题和一个专属主题。
- 同一时间只激活一个主题。
- 所有标签同时驱动场景、空间标签和说明。
- 水下是独立场景，并包含完整穿水进入。
- 风险包含原因、过程、影响区、信号和行动建议。
- 风险支持暂停、重播和恢复。
- 实况、典型预览和风险演示没有混淆。
- 动物和景色没有虚假确定性或伪造概率。
- 没有固定星级；总结结论动态且可解释。
- 总结接入心愿、准备、Journey 和返回地图。
- 非沉浸式入口可完成等价决策。
- 快速切换和退出后无残留状态、动画、声音或监听。
- 自动化测试通过。
- 没有引入不必要的第二套框架。
- 提供完整交付报告和回滚方式。

---

## 16. Agent 最终交付格式

完成后必须输出：

1. 仓库审计结论。
2. 技术复用与新增依赖说明。
3. 新增、修改、删除文件清单。
4. 数据结构与场景配置说明。
5. 山地、水域、水下完成情况。
6. 当前实况、预览、风险数据绑定说明。
7. Journey、心愿、准备事项接入说明。
8. 单元、集成和 E2E 测试结果。
9. 可访问性检查结果。
10. 性能与资源清理结果。
11. 降级和错误演示。
12. 未完成项及原因。
13. 本地运行、构建、测试和部署命令。
14. 回滚方案。
15. 关键页面截图或录屏位置。

不要只回复“已完成”。每个结论必须指向代码文件或测试证据。
