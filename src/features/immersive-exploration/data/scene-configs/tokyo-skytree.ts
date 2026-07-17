/**
 * 黄金样例 · 东京晴空塔（human_city）
 *
 * sceneDefinitionId: scene-tokyo-skytree / entityId: tokyo-skytree（V2 新增）
 * 内容口径：塔高 634m、展望台 350m / 450m、隅田川东岸街区、押上—向岛老街。
 * 文案约束：无固定概率与必然性表述（copy-validator 强制）。
 */

import type {
  AnchorContent,
  ExplorationEntity,
  ImmersiveSceneDefinition,
} from "../../domain/types";

// ---------------------------------------------------------------- 探索对象

export const TOKYO_SKYTREE_ENTITY: ExplorationEntity = {
  id: "tokyo-skytree",
  name: "东京晴空塔",
  countryCode: "JPN",
  shape: "point",
  sceneFamily: "human_city",
  channels: ["history", "leisure", "wonder"],
  coordinates: { lat: 35.7101, lng: 139.8107 },
  activityTags: ["观景", "摄影", "散步", "美食"],
  attributeTags: ["电波塔", "高634m", "展望台350m/450m", "最佳季节：全年 / 夜景日落后"],
  sceneDefinitionId: "scene-tokyo-skytree",
  fallbackContentId: "fallback-tokyo-skytree",
};

// ---------------------------------------------------------------- 锚点说明内容（与 anchors.contentId 一一对应）

export const TOKYO_SKYTREE_ANCHOR_CONTENTS: AnchorContent[] = [
  {
    id: "skytree-tower",
    title: "晴空塔本体 634m",
    body: "东京晴空塔高 634m，2012 年开业，是世界最高的自立式电波塔之一。塔身采用三角形基座渐变为圆形的独特截面，涂装色「晴空塔白」以蓝白为基调。",
  },
  {
    id: "skytree-skyline",
    title: "城市天际线",
    body: "塔周是浅草、两国与锦糸町方向的密集城区，晴天从展望台可远眺东京塔、新宿副都心与富士山方向。天际线在日落前后层次较丰富。",
  },
  {
    id: "skytree-river",
    title: "隅田川步道",
    body: "塔东侧的隅田川沿岸设有亲水步道与桥梁观景位，可仰拍塔身与河面倒影。春季樱花季步道人流较多，夏夜有屋形船航线经过。",
  },
  {
    id: "skytree-night-deck",
    title: "夜景展望层",
    body: "展望台分为 350m 的天望甲板与 450m 的天望回廊两层，夜间可俯瞰城市灯海与街道灯河。展望台开放时间与票价以运营方公告为准。",
  },
  {
    id: "skytree-market",
    title: "东京晴空街道",
    body: "塔下的东京晴空街道（Solamachi）聚集了 300 余家商铺与餐厅，涵盖伴手礼、甜品与特色市集。节假日傍晚至夜间较为拥挤。",
  },
  {
    id: "skytree-viewpoint-a",
    title: "吾妻桥机位",
    body: "吾妻桥与浅草一侧的河岸是拍摄晴空塔与街区同框的经典机位，清晨人流较少、光线柔和，适合架设三脚架。",
  },
  {
    id: "skytree-historic-block",
    title: "押上老街",
    body: "塔所在的押上—向岛一带保留着下町老街氛围，小巷中有传统小吃与老铺。从老街巷口回望塔身，是新城旧街叠加的标志性构图。",
  },
  {
    id: "skytree-risk-crowd",
    title: "拥挤预警区",
    body: "节假日、点灯时段与展望台入口在高峰时段人流密集，入口排队与电梯等候时间明显变长。带儿童出行请约定走散集合点。",
  },
];

// ---------------------------------------------------------------- 场景定义

export const TOKYO_SKYTREE_SCENE: ImmersiveSceneDefinition = {
  id: "scene-tokyo-skytree",
  family: "human_city",
  entityName: "东京晴空塔",
  regionLabel: "日本 · 东京都墨田区",
  defaultCamera: {
    position: [180, 220, 420],
    lookAt: [0, 180, 0],
    fov: 45,
  },
  arrival: {
    subtitle: "高 634m 的电波塔 · 下町街区之上的城市地标",
    headlineSight: "塔身全貌与入夜后的城市灯海",
    headlineActivity: "展望台观景与老街散步",
    observeMs: 6000,
    transitionBeats: [
      "从城市上空俯瞰街区网格",
      "环绕塔身一周，辨认展望层与周边街区",
      "相机定位于东南侧默认视角",
      "主题入口出现",
    ],
  },
  themes: [
    { id: "highlights", label: "景色", defaultSelectionId: "preset-night-view" },
    { id: "experience", label: "怎么玩", defaultSelectionId: "act-observatory" },
    { id: "audience", label: "适合谁", defaultSelectionId: "school_age_family" },
    { id: "cautions", label: "注意什么", defaultSelectionId: "risk-crowd" },
    { id: "story_past", label: "街区故事" },
  ],
  anchors: [
    {
      id: "anchor-tower",
      label: "晴空塔本体 634m",
      anchorType: "peak",
      positionRef: "node:landmark_tower",
      themes: ["highlights", "story_past"],
      contentId: "skytree-tower",
      priority: 1,
    },
    {
      id: "anchor-night-deck",
      label: "夜景展望层",
      anchorType: "viewpoint",
      positionRef: "node:night_view_deck",
      themes: ["highlights", "experience"],
      contentId: "skytree-night-deck",
      priority: 2,
    },
    {
      id: "anchor-market",
      label: "东京晴空街道",
      anchorType: "activity_zone",
      positionRef: "node:street_market",
      themes: ["experience", "audience"],
      contentId: "skytree-market",
      priority: 3,
    },
    {
      id: "anchor-river",
      label: "隅田川步道",
      anchorType: "route",
      positionRef: "node:river_promenade",
      themes: ["experience", "highlights"],
      contentId: "skytree-river",
      priority: 4,
    },
    {
      id: "anchor-skyline",
      label: "城市天际线",
      anchorType: "viewpoint",
      positionRef: "node:skyline_cluster",
      themes: ["highlights"],
      contentId: "skytree-skyline",
      priority: 5,
    },
    {
      id: "anchor-historic-block",
      label: "押上老街",
      anchorType: "ecology",
      positionRef: "node:historic_block",
      themes: ["story_past", "audience"],
      contentId: "skytree-historic-block",
      priority: 6,
    },
    {
      id: "anchor-viewpoint-a",
      label: "吾妻桥机位",
      anchorType: "viewpoint",
      positionRef: "node:viewpoint_a",
      themes: ["highlights"],
      contentId: "skytree-viewpoint-a",
      priority: 7,
    },
    {
      id: "anchor-risk-crowd",
      label: "拥挤预警区",
      anchorType: "risk_zone",
      positionRef: "node:risk_crowd_zone",
      themes: ["cautions"],
      contentId: "skytree-risk-crowd",
      priority: 8,
    },
  ],
  previewPresets: [
    {
      id: "preset-night-view",
      label: "夜间灯海",
      months: [],
      representative: true,
      mode: "typical_preview",
      sourceMeta: { mode: "typical_preview", sourceName: "本地策展配置（季节规律）" },
      visual: { night: 1.0, windowLight: 1.0, trafficFlow: 0.8, light: "night_clear", hazeDensity: 0.1 },
      whereText: "展望台 350m/450m 两层与吾妻桥河岸机位",
      whenText: "日落后至闭馆前，点灯样式随季节与活动更换",
      whyText: "入夜后街道灯河与建筑窗灯亮起，塔身点灯与城区灯海同框，是晴空塔较具代表性的画面",
    },
    {
      id: "preset-clear-day",
      label: "晴天远眺",
      months: [11, 12, 1, 2],
      representative: false,
      mode: "typical_preview",
      sourceMeta: { mode: "typical_preview", sourceName: "本地策展配置（季节规律）" },
      visual: { night: 0.0, windowLight: 0.2, trafficFlow: 0.5, light: "winter_clear", hazeDensity: 0.06 },
      whereText: "展望台西侧，可远眺新宿副都心与富士山方向",
      whenText: "秋冬季晴天上午，空气透明度较高",
      whyText: "秋冬空气干燥通透，远景可见度较好，适合观察城市尺度与天际线层次",
    },
    {
      id: "preset-sakura-riverside",
      label: "河畔花季",
      months: [3, 4],
      representative: false,
      mode: "typical_preview",
      sourceMeta: { mode: "typical_preview", sourceName: "本地策展配置（季节规律）" },
      visual: { night: 0.0, windowLight: 0.3, trafficFlow: 0.4, light: "spring_soft", hazeDensity: 0.2 },
      whereText: "隅田川步道与浅草一侧河岸",
      whenText: "约 3 月下旬至 4 月上旬，花期随当年气温变化",
      whyText: "河岸樱花与塔身同框是春季经典构图；花季步道人流较多，清晨相对宽松",
    },
  ],
  activities: [
    {
      id: "act-observatory",
      label: "展望台观景",
      applicable: true,
      zoneRefs: ["node:night_view_deck", "node:landmark_tower"],
      durationMinutes: 90,
      difficulty: "easy",
      facilities: ["电梯", "观景餐厅", "无障碍设施", "厕所"],
      limitations: ["高峰时段入场需排队", "票价与开放时间以运营方公告为准"],
      description: "乘电梯至 350m 天望甲板，可加购至 450m 天望回廊；日落前后一票可观昼夜两种城市景观。",
      sceneActions: [{ kind: "focus_camera", target: "node:night_view_deck" }],
    },
    {
      id: "act-riverside-walk",
      label: "河畔散步",
      applicable: true,
      routeRef: "node:river_promenade",
      durationMinutes: 60,
      difficulty: "easy",
      facilities: ["亲水步道", "长椅", "桥梁观景位"],
      limitations: ["花季与活动日人流较多"],
      description: "沿隅田川步道步行至吾妻桥方向，仰拍塔身与河面，途中可远眺浅草街区。",
      sceneActions: [{ kind: "show_route", target: "node:river_promenade" }],
    },
    {
      id: "act-market-food",
      label: "晴空街道逛吃",
      applicable: true,
      zoneRefs: ["node:street_market"],
      durationMinutes: 120,
      difficulty: "easy",
      facilities: ["餐饮", "伴手礼商铺", "休息区", "婴儿车友好"],
      limitations: ["节假日傍晚较为拥挤"],
      description: "在塔下商业街区品尝甜品与特色餐饮、挑选伴手礼，适合作为登塔前后的衔接安排。",
      sceneActions: [{ kind: "highlight_anchor", target: "anchor-market" }],
    },
    {
      id: "act-old-town-stroll",
      label: "老街漫游",
      applicable: true,
      routeRef: "node:historic_block",
      durationMinutes: 90,
      difficulty: "easy",
      facilities: ["老铺小吃", "巷口机位"],
      limitations: ["部分小巷为居民区，请保持安静"],
      description: "穿行押上—向岛老街小巷，从巷口回望塔身，感受下町街区与新地标的叠印。",
      sceneActions: [{ kind: "focus_camera", target: "node:historic_block" }],
    },
    {
      id: "act-night-photo",
      label: "夜景摄影",
      applicable: true,
      zoneRefs: ["node:viewpoint_a", "node:night_view_deck"],
      durationMinutes: 120,
      difficulty: "moderate",
      facilities: ["三脚架架设空间（河岸）"],
      limitations: ["展望台内部分区域禁止使用三脚架"],
      description: "吾妻桥河岸拍塔身点灯与河面倒影，或登高拍街道灯河；蓝调时刻（日落后约 20–40 分钟）层次较好。",
      sceneActions: [{ kind: "focus_camera", target: "node:viewpoint_a" }],
    },
  ],
  audiences: [
    {
      id: "toddler_family",
      label: "幼儿家庭",
      allowedActivityIds: ["act-market-food", "act-observatory"],
      preferredRouteIds: ["node:street_market"],
      facilityPriority: ["婴儿车友好", "厕所", "休息区", "餐饮"],
      warnings: ["高峰时段电梯等候较长，建议预约入场时段"],
    },
    {
      id: "school_age_family",
      label: "学龄家庭",
      allowedActivityIds: ["act-observatory", "act-market-food", "act-riverside-walk", "act-old-town-stroll"],
      preferredRouteIds: ["node:river_promenade"],
      facilityPriority: ["休息区", "厕所", "餐饮"],
      warnings: ["展望台高处风大时体感较冷，备一件外套"],
    },
    {
      id: "photographer",
      label: "摄影爱好者",
      allowedActivityIds: ["act-night-photo", "act-riverside-walk", "act-observatory"],
      preferredRouteIds: ["node:viewpoint_a"],
      facilityPriority: ["三脚架架设空间（河岸）"],
    },
    {
      id: "relaxed",
      label: "休闲度假者",
      allowedActivityIds: ["act-market-food", "act-observatory", "act-riverside-walk"],
      preferredRouteIds: ["node:street_market"],
      facilityPriority: ["餐饮", "观景餐厅"],
    },
    {
      id: "senior",
      label: "银发游客",
      allowedActivityIds: ["act-observatory", "act-market-food"],
      preferredRouteIds: ["node:night_view_deck"],
      facilityPriority: ["电梯", "无障碍设施", "休息区"],
      warnings: ["老街步行段路面有起伏，建议穿着防滑鞋"],
    },
  ],
  risks: [
    {
      id: "risk-crowd",
      label: "高峰拥挤",
      applicable: true,
      mode: "risk_simulation",
      cause: [
        "节假日与点灯时段客流集中到达",
        "展望台电梯运力有限，入口形成排队",
        "商业街区通道宽度有限，交汇口易拥堵",
      ],
      sequence: [
        {
          id: "risk-crowd-step-1",
          title: "客流上升",
          description: "入口与街区交汇口人流密度上升，行进速度变慢。",
          sceneActions: [
            { kind: "set_weather", params: { crowd: 0.5 } },
            { kind: "highlight_anchor", target: "anchor-risk-crowd" },
          ],
        },
        {
          id: "risk-crowd-step-2",
          title: "排队形成",
          description: "展望台入口与电梯厅出现明显排队，等候时间拉长。",
          sceneActions: [
            { kind: "set_weather", params: { crowd: 0.85 } },
            { kind: "highlight_anchor", target: "anchor-night-deck" },
          ],
        },
        {
          id: "risk-crowd-step-3",
          title: "错峰分流",
          description: "运营方按预约时段分批放行，客流回落后通行恢复顺畅。",
          sceneActions: [{ kind: "set_weather", params: { crowd: 0.4 } }],
        },
      ],
      affectedAnchorIds: ["anchor-risk-crowd", "anchor-market", "anchor-night-deck"],
      warningSignals: [
        "入口屏幕显示较长的预计等候时间",
        "街区交汇口出现行进停滞",
      ],
      actions: [
        "提前预约入场时段，错峰到访",
        "与同行者约定走散集合点",
        "看管好随身物品与儿童",
      ],
      impactTexts: {
        routeText: "高峰时段河畔步道与老街通行变慢，行程请留余量",
        familyText: "亲子出行建议使用婴儿车背带并约定集合点，避免在电梯口停留",
      },
      officialAdvisoryBinding: "东京晴空塔运营方客流公告",
    },
    {
      id: "risk-heavy-rain",
      label: "暴雨大风",
      applicable: true,
      mode: "risk_simulation",
      cause: [
        "台风或锋面过境带来强降水与大风",
        "高塔周边风场受建筑绕流影响局地增强",
        "展望台与户外步道受风雨直接影响",
      ],
      sequence: [
        {
          id: "risk-heavy-rain-step-1",
          title: "风雨渐强",
          description: "天空转阴，风速增大，河面出现明显波纹。",
          sceneActions: [{ kind: "set_weather", params: { rain: 0.4, wind: 0.5 } }],
        },
        {
          id: "risk-heavy-rain-step-2",
          title: "暴雨过境",
          description: "短时强降水降低能见度，户外步道通行受影响，塔身局部隐入雨幕。",
          sceneActions: [
            { kind: "set_weather", params: { rain: 0.9, wind: 0.8, fog: 0.4 } },
            { kind: "highlight_anchor", target: "anchor-tower" },
          ],
        },
        {
          id: "risk-heavy-rain-step-3",
          title: "风雨减弱",
          description: "降水减弱、云层散开，运营方确认安全后恢复户外区域通行。",
          sceneActions: [{ kind: "set_weather", params: { rain: 0.1, wind: 0.3, fog: 0.1 } }],
        },
      ],
      affectedAnchorIds: ["anchor-tower", "anchor-river", "anchor-viewpoint-a"],
      warningSignals: [
        "气象部门发布强风或暴雨注意报",
        "河面波浪明显、树叶剧烈摇动",
      ],
      actions: [
        "关注运营方关于展望台开放的公告",
        "远离河岸护栏与广告牌等迎风设施",
        "改以室内商业街区活动为主",
      ],
      impactTexts: {
        routeText: "暴雨时段河畔步道与户外机位不建议停留",
        familyText: "风雨天气请直接进入室内设施，避免在塔下广场逗留",
      },
      officialAdvisoryBinding: "日本气象厅大雨·强风注意报",
    },
  ],
  summaryRules: [
    {
      representativeActivityId: "act-observatory",
      representativeReason: "展望台是体验晴空塔的核心方式，一票覆盖昼夜两种城市景观",
      bestTimeText: "夜景以日落后为佳；远景观察以秋冬季晴天上午为佳",
      bestExperienceText: "日落前登塔，在展望台见证城市从白昼切换到灯海",
      preparationItems: [
        "提前预约入场时段以缩短排队",
        "确认当日点灯样式与开放公告",
        "高峰时段约定走散集合点",
        "风雨天气改以室内行程为主",
      ],
    },
  ],
  assets: {
    proceduralNodes: [
      "landmark_tower",
      "skyline_cluster",
      "river_promenade",
      "night_view_deck",
      "street_market",
      "viewpoint_a",
      "historic_block",
      "risk_crowd_zone",
    ],
    estimatedBytes: 0,
  },
  fallback: {
    summary: "东京晴空塔（高 634m）图文导览：观景、逛吃、人群适配与安全须知。",
    sections: [
      {
        theme: "highlights",
        title: "景色",
        body: "日落后展望台可俯瞰城市灯海与街道灯河，塔身点灯随季节更换；秋冬季晴天上午可远眺新宿方向天际线；春季河岸樱花与塔身同框。",
      },
      {
        theme: "experience",
        title: "怎么玩",
        body: "核心玩法是登展望台观景；塔下晴空街道适合逛吃购物；河畔步道与押上老街适合步行漫游；摄影推荐吾妻桥河岸机位与蓝调时刻。",
      },
      {
        theme: "audience",
        title: "适合谁",
        body: "幼儿家庭建议以商业街区与预约时段登塔为主；学龄家庭可加河畔散步；摄影爱好者推荐夜景双机位；银发游客建议电梯直达展望层、避开高峰。",
      },
      {
        theme: "cautions",
        title: "注意什么",
        body: "节假日与点灯时段客流密集，请预约错峰并约定集合点。台风或锋面过境时关注运营方开放公告，避免在河岸与广场迎风处停留。",
      },
      {
        theme: "story_past",
        title: "街区故事",
        body: "晴空塔 2012 年开业，塔高 634m 谐音「武藏」，承载着旧国名的记忆；塔周押上—向岛保留着下町老街与老铺，新城旧街在此叠印。",
      },
    ],
  },
};
