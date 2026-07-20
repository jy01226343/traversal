/**
 * 黄金样例 · 马赛马拉（wilderness）V3 · ≥90% 地貌还原重构
 *
 * sceneDefinitionId: scene-masai-mara / entityId: masai-mara（V2 新增）
 * 同一配置同时服务马赛马拉（ke-mara）与塞伦盖蒂（tz-serengeti）两个 POI，
 * 二者同属塞伦盖蒂—马拉生态系统，地貌口径一致。
 *
 * 还原口径（真实东非稀树草原）：
 * - 地形：缓起伏红燕麦草草海（非夸张山地），fbm 微起伏 + 水塘盆地 + kopje 抬升
 * - 植被：伞刺金合欢（Vachellia tortilis）标志性伞形树冠点缀开阔草原
 * - 水文：马拉河蜿蜒穿行，旱季收缩为河湾与季节性水塘
 * - 地貌：远处 kopje 花岗岩残丘孤立于草海
 * - 动物：白须角马与斑马迁徙群、非洲水牛群、长颈鹿/大象取食金合欢
 * - 光照：赤道低角度金色阳光、长阴影、广角天空与雨季积雨云
 *
 * 渲染层（WildernessScene，共享组件）已实现：程序化伞形金合欢 InstancedMesh、
 * 实例化草叶风场摆动、fbm 缓起伏地形、kopje 岩群、迁徙兽群剪影、赤道日光
 * 色温曲线与火险/干旱天气合成。本文件负责把声明式参数校准到真实口径：
 * - defaultCamera 修正到场景实际尺度（广角草原 vista）
 * - preset.visual 全部改用渲染层真实解释的键：light（光照词）/ season（季节词）/
 *   dry（干旱度→地形草色）/ grassColor（草叶色）/ herdDensity（兽群密度）/ mist（雾霭）
 * 文案约束：无固定概率与必然性表述（copy-validator 强制）。
 */

import type {
  AnchorContent,
  ExplorationEntity,
  ImmersiveSceneDefinition,
} from "../../domain/types";

// ---------------------------------------------------------------- 探索对象

export const MASAI_MARA_ENTITY: ExplorationEntity = {
  id: "masai-mara",
  name: "马赛马拉国家保护区",
  countryCode: "KEN",
  shape: "area",
  sceneFamily: "wilderness",
  channels: ["nature", "wonder", "outdoor"],
  coordinates: { lat: -1.4061, lng: 35.0117 },
  activityTags: ["游猎", "摄影", "观景", "观鸟", "热气球"],
  attributeTags: ["稀树草原", "角马大迁徙", "塞伦盖蒂—马拉生态系统", "最佳季节：7–10月迁徙季 / 1–2月短干季"],
  sceneDefinitionId: "scene-masai-mara",
  fallbackContentId: "fallback-masai-mara",
};

// ---------------------------------------------------------------- 锚点说明内容（与 anchors.contentId 一一对应）

export const MASAI_MARA_ANCHOR_CONTENTS: AnchorContent[] = [
  {
    id: "mara-waterhole",
    title: "马拉河湾与季节性水塘",
    body: "马拉河蜿蜒穿过保护区西部，旱季（约 6–10 月）水位回落，河湾与内陆季节性水塘成为斑马、角马与瞪羚的饮水点，河马与尼罗鳄常年栖于主河道。雨季水面分散，动物分布随之散开。",
  },
  {
    id: "mara-acacia-grove",
    title: "伞形金合欢树丛",
    body: "伞刺金合欢是稀树草原的标志性树种，枝干斜升后在顶端展开扁平伞盖，是马赛马拉天际线中较常见的剪影。长颈鹿与大象常取食其枝叶，树丛边缘也是观察猎豹与狮群的经典位置。",
  },
  {
    id: "mara-grassland-sea",
    title: "红燕麦草草海",
    body: "保护区以连绵的红燕麦草草原为主，旱季草色金黄、雨季返青，草浪随风起伏可绵延数公里。开阔草海视线通透，是游猎巡游观察远距离兽群移动的主要空间。",
  },
  {
    id: "mara-herd-zone",
    title: "迁徙兽群通道",
    body: "每年约 7–10 月，上百万头白须角马与数十万匹斑马自塞伦盖蒂进入马赛马拉，渡河点与草原通道上常见大规模兽群移动。迁徙节奏随降雨分布变化，出现位置每周都可能不同。",
  },
  {
    id: "mara-safari-loop",
    title: "游猎环线",
    body: "保护区内的巡游土路构成多条游猎环线，串联水塘、金合欢树丛与马拉河渡河点。环线为非铺装路面，需乘四驱车由持证向导带领行驶，全程禁止下车区域有明确标识。",
  },
  {
    id: "mara-viewpoint-a",
    title: "观景台",
    body: "保护区内若干高点设有停车观景位，可俯瞰金色草海与蜿蜒的马拉河。日出前后赤道低角度阳光拉出长影，是摄影与远眺兽群的常用机位；清晨也常能看到热气球掠过草原。",
  },
  {
    id: "mara-kopje-rocks",
    title: "Kopje 花岗岩残丘",
    body: "花岗岩残丘（kopje）是草原上孤立的古老岩体露头，岩缝为蹄兔、蜥蜴与狮群提供庇护，岩面常可见地衣与凿状风化纹。残丘顶部视野开阔，向导常在此安排短暂下车观察。",
  },
  {
    id: "mara-risk-fire",
    title: "草原火险区",
    body: "旱季枯草期草原火险升高，雷击与人为火源都可能引发野火。火险时段部分环线会临时关闭，行程需听从向导与保护区管理方的现场安排。",
  },
];

// ---------------------------------------------------------------- 场景定义

export const MASAI_MARA_SCENE: ImmersiveSceneDefinition = {
  id: "scene-masai-mara",
  family: "wilderness",
  entityName: "马赛马拉国家保护区",
  regionLabel: "肯尼亚 · 纳罗克郡（塞伦盖蒂—马拉生态系统北缘）",
  defaultCamera: {
    // 广角草原 vista：低机位掠过草海，右侧收入金合欢树丛与 kopje 残丘，远处地平线层次完整
    position: [5, 7, 27],
    lookAt: [-2, 1.2, -8],
    fov: 48,
  },
  arrival: {
    subtitle: "东非稀树草原 · 塞伦盖蒂—马拉生态系统的北缘舞台",
    headlineSight: "金色草海、伞形金合欢与远处移动的迁徙兽群",
    headlineActivity: "四驱车游猎、高点观景与清晨热气球",
    observeMs: 6000,
    transitionBeats: [
      "从高空俯冲进入草原上空，积雨云下的草海渐次展开",
      "掠过伞形金合欢树丛与蜿蜒的马拉河湾",
      "扫过远处孤立的 kopje 花岗岩残丘与迁徙兽群",
      "相机定位于游猎环线上方的广角默认视角",
      "主题入口出现",
    ],
  },
  themes: [
    { id: "highlights", label: "景色", defaultSelectionId: "preset-migration-season" },
    { id: "experience", label: "怎么玩", defaultSelectionId: "act-game-drive" },
    { id: "audience", label: "适合谁", defaultSelectionId: "school_age_family" },
    { id: "cautions", label: "注意什么", defaultSelectionId: "risk-grass-fire" },
    { id: "nature_geology", label: "自然观察" },
  ],
  anchors: [
    {
      id: "anchor-waterhole",
      label: "马拉河湾与水塘",
      anchorType: "ecology",
      positionRef: "node:waterhole",
      themes: ["highlights", "nature_geology"],
      contentId: "mara-waterhole",
      priority: 1,
    },
    {
      id: "anchor-herd-zone",
      label: "迁徙兽群通道",
      anchorType: "activity_zone",
      positionRef: "node:herd_zone",
      themes: ["highlights", "experience"],
      contentId: "mara-herd-zone",
      priority: 2,
    },
    {
      id: "anchor-safari-loop",
      label: "游猎环线",
      anchorType: "route",
      positionRef: "node:safari_loop",
      themes: ["experience"],
      contentId: "mara-safari-loop",
      priority: 3,
    },
    {
      id: "anchor-acacia-grove",
      label: "伞形金合欢树丛",
      anchorType: "ecology",
      positionRef: "node:acacia_grove",
      themes: ["nature_geology", "audience"],
      contentId: "mara-acacia-grove",
      priority: 4,
    },
    {
      id: "anchor-grassland-sea",
      label: "红燕麦草草海",
      anchorType: "ecology",
      positionRef: "node:grassland_sea",
      themes: ["highlights", "nature_geology"],
      contentId: "mara-grassland-sea",
      priority: 5,
    },
    {
      id: "anchor-viewpoint-a",
      label: "观景台",
      anchorType: "viewpoint",
      positionRef: "node:viewpoint_a",
      themes: ["highlights", "audience"],
      contentId: "mara-viewpoint-a",
      priority: 6,
    },
    {
      id: "anchor-kopje-rocks",
      label: "Kopje 残丘",
      anchorType: "viewpoint",
      positionRef: "node:kopje_rocks",
      themes: ["nature_geology", "experience"],
      contentId: "mara-kopje-rocks",
      priority: 7,
    },
    {
      id: "anchor-risk-fire",
      label: "草原火险区",
      anchorType: "risk_zone",
      positionRef: "node:risk_fire_zone",
      themes: ["cautions"],
      contentId: "mara-risk-fire",
      priority: 8,
    },
  ],
  previewPresets: [
    {
      id: "preset-migration-season",
      label: "迁徙季",
      months: [7, 8, 9, 10],
      representative: true,
      mode: "typical_preview",
      sourceMeta: { mode: "typical_preview", sourceName: "本地策展配置（季节规律）" },
      // light=golden→赤道低角度金色阳光长阴影；season=旱季+dry→草海金黄；herdDensity→兽群规模
      visual: { light: "golden", season: "旱季", dry: 0.9, grassColor: "#c9a35a", herdDensity: 1.0, mist: 0.12 },
      whereText: "马拉河渡河点与草原通道沿线，兽群聚集程度较高",
      whenText: "约 7 月至 10 月旱季，清晨与傍晚动物活动较频繁",
      whyText: "角马与斑马集群北迁进入保护区，草海呈现旱季金黄，是观察大规模兽群移动的常用时段",
    },
    {
      id: "preset-green-season",
      label: "雨季返青",
      months: [3, 4, 5],
      representative: false,
      mode: "typical_preview",
      sourceMeta: { mode: "typical_preview", sourceName: "本地策展配置（季节规律）" },
      // 长雨季：草海返青、午后积雨云、雾霭偏重、兽群分散
      visual: { light: "morning", season: "雨季", dry: 0.1, grassColor: "#5e8a3c", herdDensity: 0.4, mist: 0.35 },
      whereText: "草海全域返青，动物分布较分散，天空常见积雨云",
      whenText: "约 3 月至 5 月长雨季，午后常有阵雨",
      whyText: "雨季草原返青、鸟类活跃，游客相对较少；部分土路泥泞，行程时长需留余量",
    },
    {
      id: "preset-short-dry",
      label: "短干季",
      months: [1, 2],
      representative: false,
      mode: "typical_preview",
      sourceMeta: { mode: "typical_preview", sourceName: "本地策展配置（季节规律）" },
      // 短干季：草木转矮、视线通透、晴天率高
      visual: { light: "bright", dry: 0.55, grassColor: "#b58a4a", herdDensity: 0.6, mist: 0.08 },
      whereText: "水塘与金合欢树丛周边，草食动物向水源集中",
      whenText: "约 1 月至 2 月短干季，晴天较多",
      whyText: "短干季草木低矮、视线通透，也是许多草食动物的产仔时段，适合摄影观察",
    },
    {
      id: "preset-dusk-golden",
      label: "金色黄昏",
      months: [6, 11, 12],
      representative: false,
      mode: "typical_preview",
      sourceMeta: { mode: "typical_preview", sourceName: "本地策展配置（季节规律）" },
      // 干湿过渡季黄昏：低角度夕阳拉长树影与兽群剪影
      visual: { light: "dusk", dry: 0.7, grassColor: "#c08442", herdDensity: 0.7, mist: 0.15 },
      whereText: "观景台与 kopje 残丘机位，草海地平线层次较完整",
      whenText: "约 6 月与 11–12 月干湿过渡期，日落前后",
      whyText: "过渡期游客相对少，黄昏低角度阳光把金合欢伞盖与兽群染成剪影，是摄影的常用时段",
    },
  ],
  activities: [
    {
      id: "act-game-drive",
      label: "四驱车游猎",
      applicable: true,
      routeRef: "node:safari_loop",
      durationMinutes: 240,
      difficulty: "easy",
      requirements: ["持证向导与保护区许可车辆"],
      facilities: ["营地与旅舍", "休息点"],
      limitations: ["全程按保护区规定路线行驶", "非指定区域禁止下车"],
      description: "清晨与傍晚各一轮巡游，沿游猎环线观察水塘、金合欢树丛与兽群通道，由向导无线电互通兽群位置。",
      sceneActions: [{ kind: "show_route", target: "node:safari_loop" }],
    },
    {
      id: "act-balloon-safari",
      label: "清晨热气球观光",
      applicable: true,
      zoneRefs: ["node:viewpoint_a", "node:grassland_sea"],
      durationMinutes: 180,
      difficulty: "easy",
      requirements: ["提前预订热气球运营商名额", "日出前抵达起飞场"],
      facilities: ["起飞场集合点", "落地后草原早餐（运营商安排）"],
      limitations: ["大风或雷雨时段可能取消", "对儿童身高与年龄有运营商限制"],
      description: "日出前后乘热气球低空掠过草海与马拉河湾，从空中俯瞰兽群移动与金合欢伞盖的长影，落地后通常衔接上午巡游。",
      sceneActions: [{ kind: "focus_camera", target: "node:viewpoint_a" }],
    },
    {
      id: "act-viewpoint-photo",
      label: "高点观景摄影",
      applicable: true,
      zoneRefs: ["node:viewpoint_a", "node:kopje_rocks"],
      durationMinutes: 90,
      difficulty: "easy",
      facilities: ["停车观景位"],
      limitations: ["日出前机位紧张，建议提前到达"],
      description: "在观景台与 kopje 残丘拍摄草海全景、马拉河蜿蜒与兽群移动，长焦镜头可压缩远处地平线层次。",
      sceneActions: [{ kind: "focus_camera", target: "node:viewpoint_a" }],
    },
    {
      id: "act-waterhole-watch",
      label: "河湾水塘观察",
      applicable: true,
      zoneRefs: ["node:waterhole"],
      durationMinutes: 120,
      difficulty: "easy",
      facilities: ["车辆观察位"],
      limitations: ["需保持车距与安静", "不投喂、不驱赶动物"],
      description: "旱季在马拉河湾与水塘边驻车观察前来饮水的斑马、角马与鸟类，主河道常能看到河马露头，有机会看到肉食动物在附近活动。",
      sceneActions: [{ kind: "highlight_anchor", target: "anchor-waterhole" }],
    },
    {
      id: "act-herd-tracking",
      label: "迁徙追踪",
      applicable: true,
      routeRef: "node:safari_loop",
      durationMinutes: 360,
      difficulty: "moderate",
      requirements: ["迁徙季出行", "全天游猎安排"],
      facilities: ["营地午餐（外带）"],
      limitations: ["渡河场景位置每周变化", "需接受较长车程"],
      description: "迁徙季全天巡游，追踪角马与斑马集群向马拉河渡河点方向移动，向导根据当日兽群位置动态调整路线。",
      sceneActions: [{ kind: "highlight_anchor", target: "anchor-herd-zone" }],
    },
    {
      id: "act-kopje-explore",
      label: "残丘生态观察",
      applicable: true,
      zoneRefs: ["node:kopje_rocks"],
      durationMinutes: 60,
      difficulty: "easy",
      facilities: ["指定下车点"],
      limitations: ["仅在向导判定安全时下车", "注意脚下岩缝"],
      description: "在向导带领下登上 kopje 花岗岩残丘，观察蹄兔、蜥蜴与岩面地衣，了解残丘作为草原古老基岩露头的地质成因。",
      sceneActions: [{ kind: "focus_camera", target: "node:kopje_rocks" }],
    },
  ],
  audiences: [
    {
      id: "toddler_family",
      label: "幼儿家庭",
      allowedActivityIds: ["act-waterhole-watch", "act-viewpoint-photo"],
      preferredRouteIds: ["node:waterhole"],
      facilityPriority: ["营地休息点", "厕所", "餐饮"],
      warnings: ["游猎车程较长，幼儿需准备遮阳与零食", "部分营地与热气球运营商有年龄限制，预订前请确认"],
    },
    {
      id: "school_age_family",
      label: "学龄家庭",
      allowedActivityIds: ["act-game-drive", "act-waterhole-watch", "act-viewpoint-photo", "act-kopje-explore"],
      preferredRouteIds: ["node:safari_loop"],
      facilityPriority: ["营地休息点", "解说服务"],
      warnings: ["车程中请为儿童准备望远镜与图鉴，减少晕车风险"],
    },
    {
      id: "photographer",
      label: "摄影爱好者",
      allowedActivityIds: ["act-viewpoint-photo", "act-herd-tracking", "act-balloon-safari", "act-game-drive"],
      preferredRouteIds: ["node:viewpoint_a", "node:herd_zone"],
      facilityPriority: ["停车观景位"],
    },
    {
      id: "adventure",
      label: "深度自然爱好者",
      allowedActivityIds: ["act-herd-tracking", "act-game-drive", "act-balloon-safari", "act-kopje-explore"],
      preferredRouteIds: ["node:safari_loop"],
      warnings: ["请尊重保护区规则，不诱导向导违规接近动物"],
    },
    {
      id: "relaxed",
      label: "休闲度假者",
      allowedActivityIds: ["act-viewpoint-photo", "act-waterhole-watch", "act-balloon-safari"],
      preferredRouteIds: ["node:viewpoint_a"],
      facilityPriority: ["营地休息点", "餐饮"],
    },
  ],
  risks: [
    {
      id: "risk-grass-fire",
      label: "草原野火",
      applicable: true,
      mode: "risk_simulation",
      cause: [
        "旱季枯草含水量低，可燃物载量高",
        "雷击或人为火源引燃草层",
        "旱季风速较大时火势沿风向快速蔓延",
      ],
      sequence: [
        {
          id: "risk-grass-fire-step-1",
          title: "火点出现",
          description: "远处草海边缘出现烟柱，风向将烟气吹向环线下风侧。",
          sceneActions: [
            { kind: "set_weather", params: { smoke: 0.4, wind: 0.5 } },
            { kind: "highlight_anchor", target: "anchor-risk-fire" },
          ],
        },
        {
          id: "risk-grass-fire-step-2",
          title: "火线蔓延",
          description: "火线沿枯草带扩展，附近环线能见度下降，动物开始远离火区。",
          sceneActions: [{ kind: "set_weather", params: { smoke: 0.7, wind: 0.7 } }],
        },
        {
          id: "risk-grass-fire-step-3",
          title: "环线临时关闭",
          description: "管理方关闭受影响环线，车辆按向导指示绕行至上风侧安全区。",
          sceneActions: [
            { kind: "set_weather", params: { smoke: 0.5, wind: 0.4 } },
            { kind: "highlight_anchor", target: "anchor-safari-loop" },
          ],
        },
      ],
      affectedAnchorIds: ["anchor-risk-fire", "anchor-safari-loop", "anchor-grassland-sea"],
      warningSignals: [
        "远处可见烟柱或闻到烟味",
        "动物群出现同向快速移动",
        "向导无线电通报火情",
      ],
      actions: [
        "听从向导与管理方指挥，不自行判断绕行",
        "关闭车窗，向上风侧转移",
        "不在草地上丢弃任何火源",
      ],
      impactTexts: {
        routeText: "火险时段部分游猎环线临时关闭，行程以向导现场安排为准",
        familyText: "家庭游客请留在车内并听从向导指挥，营地通常设有安全集合点",
      },
      officialAdvisoryBinding: "肯尼亚野生动物保护局（KWS）园区通告",
    },
    {
      id: "risk-drought",
      label: "旱季缺水",
      applicable: true,
      mode: "risk_simulation",
      cause: [
        "旱季持续数月无明显降水",
        "马拉河支流断流、季节性水塘逐步萎缩",
        "草料减少使动物向残余水源集中",
      ],
      sequence: [
        {
          id: "risk-drought-step-1",
          title: "水塘萎缩",
          description: "水塘水面缩小，岸边泥泞带扩大，前来饮水的动物密度上升。",
          sceneActions: [
            { kind: "set_weather", params: { dust: 0.5 } },
            { kind: "highlight_anchor", target: "anchor-waterhole" },
          ],
        },
        {
          id: "risk-drought-step-2",
          title: "动物聚集竞争",
          description: "不同物种在同一水源周边聚集，肉食动物活动频率上升。",
          sceneActions: [{ kind: "highlight_anchor", target: "anchor-herd-zone" }],
        },
        {
          id: "risk-drought-step-3",
          title: "观察秩序收紧",
          description: "向导控制车辆数量与停留时长，避免干扰动物饮水路径。",
          sceneActions: [{ kind: "dim_anchors", params: {} }],
        },
      ],
      affectedAnchorIds: ["anchor-waterhole", "anchor-herd-zone"],
      warningSignals: [
        "水塘面积明显小于雨季",
        "大量动物排队饮水、警戒行为增多",
      ],
      actions: [
        "保持车距与安静，不穿插到动物与水源之间",
        "行程中自备饮用水并注意防晒",
        "尊重向导对停留时长的控制",
      ],
      impactTexts: {
        routeText: "旱季部分土路扬尘明显，巡游时长与舒适度需留余量",
        familyText: "亲子游客注意补水与车内遮阳，观察时保持安静",
      },
    },
  ],
  summaryRules: [
    {
      representativeActivityId: "act-game-drive",
      representativeReason: "四驱车游猎是体验保护区最经典的方式，覆盖河湾水塘、金合欢树丛与兽群通道",
      bestTimeText: "约 7–10 月迁徙季观察大规模兽群；1–2 月短干季视线通透、游客较少",
      bestExperienceText: "清晨巡游在草海上追逐兽群移动，或乘热气球掠过马拉河湾；傍晚在观景台记录金色地平线",
      preparationItems: [
        "确认保护区入园许可与向导安排",
        "准备防晒、防尘与长焦镜头",
        "了解草原火险与动物行为的基本判断信号",
        "尊重保护区规则，全程听从向导指挥",
      ],
    },
  ],
  assets: {
    proceduralNodes: [
      "waterhole",
      "acacia_grove",
      "grassland_sea",
      "herd_zone",
      "safari_loop",
      "viewpoint_a",
      "kopje_rocks",
      "risk_fire_zone",
    ],
    estimatedBytes: 0,
  },
  fallback: {
    summary: "马赛马拉国家保护区图文导览：游猎、观景、人群适配与安全须知。",
    sections: [
      {
        theme: "highlights",
        title: "景色",
        body: "迁徙季（约 7–10 月）可在马拉河沿线观察角马与斑马集群；旱季河湾水塘边动物集中；观景台与 kopje 残丘可俯瞰金色草海、伞形金合欢与地平线层次。",
      },
      {
        theme: "experience",
        title: "怎么玩",
        body: "核心玩法是持证向导带领的四驱车游猎，清晨与傍晚各一轮；日出热气球从空中俯瞰草海与兽群；高点观景与残丘生态观察适合半日安排；迁徙季可安排全天追踪巡游。",
      },
      {
        theme: "audience",
        title: "适合谁",
        body: "幼儿家庭建议以短时水塘观察为主；学龄家庭可参加标准游猎；摄影爱好者推荐迁徙季、热气球与观景台机位；休闲度假者可在营地配合单次巡游或热气球。",
      },
      {
        theme: "cautions",
        title: "注意什么",
        body: "旱季枯草期警惕草原野火：看到烟柱、闻到烟味即听从向导指挥转移。旱季缺水期动物集中于河湾水塘，观察需保持车距与安静。",
      },
      {
        theme: "nature_geology",
        title: "自然观察",
        body: "保护区以红燕麦草草原为主，散布伞刺金合欢与花岗岩残丘（kopje），马拉河蜿蜒穿过西部；角马迁徙节律随降雨分布变化，旱雨季草色与兽群位置差异显著。",
      },
    ],
  },
};
