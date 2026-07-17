/**
 * 黄金样例 · 洞爷湖（waterside）
 *
 * sceneDefinitionId: scene-lake-toya / entityId: lake-toya（CONTRACT 冻结）
 * 数据口径：来源引用 docs/first-official-data-sources.md 登记的官方入口——
 *   北海道官方旅游网站（景区基础信息、活动入口）
 *   洞爷湖町官网（临时关闭、公共活动、灾害公告）
 * 事实基础：破火山口湖，直径约 10km、周长约 43km、最深约 180m；湖心为中岛；
 *   洞爷湖长跑花火每年 4 月下旬–10 月每晚在湖上燃放；冬季不封冻。
 * 文案约束：生物与景观统一「通常有机会观察到」，无固定概率与必然性表述。
 */

import type {
  AnchorContent,
  ExplorationEntity,
  ImmersiveSceneDefinition,
} from "../../domain/types";

const HOKKAIDO_TOURISM = {
  sourceName: "北海道官方旅游网站",
  sourceUrl: "https://www.visit-hokkaido.jp/cn/spot/detail_10616.html",
} as const;

const TOYAKO_TOWN = {
  sourceName: "洞爷湖町官网",
  sourceUrl: "https://www.town.toyako.hokkaido.jp/",
} as const;

// ---------------------------------------------------------------- 探索对象

export const LAKE_TOYA_ENTITY: ExplorationEntity = {
  id: "lake-toya",
  name: "洞爷湖",
  countryCode: "JP",
  shape: "area",
  sceneFamily: "waterside",
  channels: ["nature", "leisure", "outdoor"],
  coordinates: { lat: 42.6047, lng: 140.8372 },
  bounds: [
    [42.55, 140.75],
    [42.66, 140.92],
  ],
  activityTags: ["湖边漫步", "游船", "独木舟", "SUP", "骑行", "摄影"],
  attributeTags: ["破火山口湖", "温泉", "花火季 4–10月", "最佳季节：全年 / 花火季4–10月"],
  sceneDefinitionId: "scene-lake-toya",
  fallbackContentId: "fallback-lake-toya",
};

// ---------------------------------------------------------------- 锚点说明内容（与 anchors.contentId 一一对应）

export const LAKE_TOYA_ANCHOR_CONTENTS: AnchorContent[] = [
  {
    id: "toya-shore-walk",
    title: "湖畔步道",
    body: "洞爷湖温泉街前的湖畔步道沿东岸延伸约 1.5km，全程平坦，设有长椅与足汤。傍晚可边散步边等待湖上花火。",
    sourceMeta: { ...HOKKAIDO_TOURISM, mode: "typical_preview" },
  },
  {
    id: "toya-pier",
    title: "游船码头",
    body: "温泉街旁码头有环湖游览船，航程约 50 分钟，可登中岛。班次约每 30–60 分钟一班，冬季可能减班，以运营方当日公告为准。",
    sourceMeta: { ...HOKKAIDO_TOURISM, mode: "typical_preview" },
  },
  {
    id: "toya-boat-zone",
    title: "游船航区",
    body: "游船航区覆盖湖心与中岛周边水域。中岛为湖中央小岛群，岛上森林是虾夷鹿栖息地，登岛步道上通常有机会观察到鹿的活动痕迹。",
  },
  {
    id: "toya-viewpoint-a",
    title: "西岸展望（筒仓展望台）",
    body: "筒仓展望台位于湖西岸高台，可俯瞰湖面全景、中岛与远处羊蹄山。晴天上午光线顺，适合拍摄湖面倒影。",
  },
  {
    id: "toya-paddle-zone",
    title: "独木舟 · SUP 活动区",
    body: "东岸近温泉街水域为独木舟与 SUP 活动区，近岸水浅浪小，通常 5–10 月营业，由当地业者提供装备与指导；幼童需成人同乘。",
  },
  {
    id: "toya-wetland",
    title: "湿地观察区",
    body: "入湖河口分布小型湿地与芦苇带，春秋季候鸟迁徙期通常有机会观察到鸭类、鹭类等水鸟停歇觅食。",
  },
  {
    id: "toya-viewpoint-b",
    title: "东岸温泉街展望",
    body: "温泉街高处可眺望湖心与中岛日落。花火季（4 月下旬–10 月）花火通常于每晚 20:45 前后在湖上燃放约 20 分钟，以当年公告为准。",
    sourceMeta: { ...TOYAKO_TOWN, mode: "typical_preview" },
  },
  {
    id: "toya-risk-open-water",
    title: "开阔水面",
    body: "湖心开阔水面受风影响明显，午后南风常使浪高增大。小型船只、独木舟与桨板请勿远离近岸活动区，并留意游船航道。",
  },
];

// ---------------------------------------------------------------- 场景定义

export const LAKE_TOYA_SCENE: ImmersiveSceneDefinition = {
  id: "scene-lake-toya",
  family: "waterside",
  entityName: "洞爷湖",
  regionLabel: "日本 · 北海道 洞爷湖町",
  defaultCamera: {
    position: [0, 260, 1500],
    lookAt: [0, 0, 0],
    fov: 48,
  },
  arrival: {
    subtitle: "北海道破火山口湖 · 周长约 43km、最深约 180m",
    headlineSight: "湖心中岛与湖面倒影",
    headlineActivity: "湖畔步道漫步与环湖游船",
    observeMs: 6000,
    transitionBeats: [
      "接近湖面，视野越过岸线",
      "掠过水面朝向湖心中岛",
      "相机定位于东岸温泉街上空",
      "主题入口出现",
    ],
  },
  themes: [
    { id: "highlights", label: "景色", defaultSelectionId: "preset-fireworks" },
    { id: "experience", label: "怎么玩", defaultSelectionId: "act-lakeside-stroll" },
    { id: "audience", label: "适合谁", defaultSelectionId: "school_age_family" },
    { id: "cautions", label: "注意什么", defaultSelectionId: "risk-wind-wave" },
    { id: "water_ecology", label: "水域生态" },
  ],
  anchors: [
    {
      id: "anchor-shore-walk",
      label: "湖畔步道",
      anchorType: "facility",
      positionRef: "node:shore_walk",
      themes: ["experience", "audience"],
      contentId: "toya-shore-walk",
      priority: 1,
    },
    {
      id: "anchor-pier",
      label: "游船码头",
      anchorType: "facility",
      positionRef: "node:pier",
      themes: ["experience", "audience"],
      contentId: "toya-pier",
      priority: 2,
    },
    {
      id: "anchor-boat-zone",
      label: "游船航区",
      anchorType: "activity_zone",
      positionRef: "node:boat_zone",
      themes: ["experience"],
      contentId: "toya-boat-zone",
      priority: 3,
    },
    {
      id: "anchor-viewpoint-a",
      label: "西岸展望（筒仓展望台）",
      anchorType: "viewpoint",
      positionRef: "node:viewpoint_a",
      themes: ["highlights"],
      contentId: "toya-viewpoint-a",
      priority: 4,
    },
    {
      id: "anchor-paddle-zone",
      label: "独木舟 · SUP 活动区",
      anchorType: "activity_zone",
      positionRef: "node:paddle_zone",
      themes: ["experience"],
      contentId: "toya-paddle-zone",
      priority: 5,
    },
    {
      id: "anchor-wetland",
      label: "湿地观察区",
      anchorType: "ecology",
      positionRef: "node:wetland",
      themes: ["water_ecology", "audience"],
      contentId: "toya-wetland",
      priority: 6,
    },
    {
      id: "anchor-viewpoint-b",
      label: "东岸温泉街展望",
      anchorType: "viewpoint",
      positionRef: "node:viewpoint_b",
      themes: ["highlights", "water_ecology"],
      contentId: "toya-viewpoint-b",
      priority: 7,
    },
    {
      id: "anchor-risk-open-water",
      label: "开阔水面",
      anchorType: "risk_zone",
      positionRef: "node:risk_open_water",
      themes: ["cautions"],
      contentId: "toya-risk-open-water",
      priority: 8,
    },
  ],
  previewPresets: [
    {
      id: "preset-fireworks",
      label: "傍晚花火季",
      months: [4, 5, 6, 7, 8, 9, 10],
      representative: true,
      mode: "typical_preview",
      sourceMeta: { ...TOYAKO_TOWN, mode: "typical_preview" },
      visual: { waveHeight: 0.2, mist: 0.05, reflection: 0.8, light: "dusk_warm", fireworks: true },
      whereText: "东岸温泉街湖畔与高层客房，花火在湖上船载移动燃放",
      whenText: "4 月下旬至 10 月，通常每晚 20:45 前后约 20 分钟（以当年公告为准）",
      whyText: "长跑花火映在湖面，与温泉街灯火同框，是湖区较具代表性的夜间体验",
    },
    {
      id: "preset-morning-mist",
      label: "清晨薄雾",
      months: [5, 6, 7, 8, 9],
      representative: false,
      mode: "typical_preview",
      sourceMeta: { ...HOKKAIDO_TOURISM, mode: "typical_preview" },
      visual: { waveHeight: 0.05, mist: 0.6, reflection: 0.4, light: "dawn_cool", fireworks: false },
      whereText: "西岸与湖心方向，中岛在薄雾中若隐若现",
      whenText: "5 月至 9 月，日出前后约 1 小时",
      whyText: "夜间湖面散热形成辐射雾，晨光穿过薄雾时湖景层次柔和",
    },
    {
      id: "preset-mirror-reflection",
      label: "晴天倒影",
      months: [],
      representative: false,
      mode: "typical_preview",
      sourceMeta: { ...HOKKAIDO_TOURISM, mode: "typical_preview" },
      visual: { waveHeight: 0.02, mist: 0, reflection: 1.0, light: "clear_day", fireworks: false },
      whereText: "筒仓展望台与北岸开阔湖段",
      whenText: "全年晴朗且风小的上午",
      whyText: "无风时湖面如镜，羊蹄山（虾夷富士）与中岛倒影清晰可见",
    },
    {
      id: "preset-winter-calm",
      label: "冬季雪景",
      months: [12, 1, 2],
      representative: false,
      mode: "typical_preview",
      sourceMeta: { ...HOKKAIDO_TOURISM, mode: "typical_preview" },
      visual: { waveHeight: 0.1, mist: 0.1, reflection: 0.6, light: "winter_soft", snow: true, fireworks: false },
      whereText: "东岸温泉街湖畔步道",
      whenText: "12 月至 2 月，雪后晴天",
      whyText: "洞爷湖冬季通常不封冻，雪岸与蓝色湖水对比鲜明，温泉蒸汽升腾",
    },
  ],
  activities: [
    {
      id: "act-lakeside-stroll",
      label: "湖边漫步",
      applicable: true,
      routeRef: "node:shore_walk",
      durationMinutes: 60,
      difficulty: "easy",
      facilities: ["长椅", "足汤", "餐饮", "厕所"],
      limitations: ["冬季步道可能有积雪薄冰，注意防滑"],
      description: "沿东岸温泉街湖畔步道步行约 1.5km，途中可泡足汤、看中岛与花火。",
      sceneActions: [{ kind: "show_route", target: "node:shore_walk" }],
    },
    {
      id: "act-cruise",
      label: "环湖游船",
      applicable: true,
      zoneRefs: ["node:boat_zone", "node:pier"],
      durationMinutes: 50,
      difficulty: "easy",
      requirements: ["码头现场购票"],
      facilities: ["码头候船区", "船上室内座席"],
      limitations: ["大风天气可能临时停航，以运营方公告为准"],
      description: "从温泉街码头出发环湖约 50 分钟，可登中岛步道短停。",
      sceneActions: [{ kind: "focus_camera", target: "node:boat_zone" }],
    },
    {
      id: "act-canoe",
      label: "独木舟",
      applicable: true,
      zoneRefs: ["node:paddle_zone"],
      durationMinutes: 120,
      difficulty: "moderate",
      requirements: ["业者指导课程", "全程穿救生衣"],
      facilities: ["更衣处", "装备租赁"],
      limitations: ["通常 5–10 月营业", "风浪增大时暂停出船"],
      description: "在近岸活动区划行，从水面视角看中岛与湖岸森林，适合初次体验者。",
      sceneActions: [{ kind: "set_water", params: { zone: "paddle_zone" } }],
    },
    {
      id: "act-sup",
      label: "SUP 站立桨板",
      applicable: true,
      zoneRefs: ["node:paddle_zone"],
      durationMinutes: 90,
      difficulty: "moderate",
      requirements: ["业者指导课程", "全程穿救生衣", "建议会游泳"],
      facilities: ["更衣处", "装备租赁"],
      limitations: ["通常 5–10 月营业", "12 岁以下需成人陪同"],
      description: "在平静近岸水域体验站立桨板，清晨浪小时水面更稳。",
      sceneActions: [{ kind: "set_water", params: { zone: "paddle_zone" } }],
    },
    {
      id: "act-cycling",
      label: "环湖骑行",
      applicable: true,
      routeRef: "node:lakeside_trail",
      durationMinutes: 240,
      difficulty: "moderate",
      requirements: ["租赁自行车或电助力车"],
      facilities: ["沿途休息点", "租赁店"],
      limitations: ["环湖约 43km，部分路段与机动车共道", "冬季路面结冰不建议骑行"],
      description: "环湖一周约 43km，沿途经过展望台、牧场与湖畔小镇，建议顺时针骑行。",
      sceneActions: [{ kind: "show_route", target: "node:lakeside_trail" }],
    },
    {
      id: "act-photography",
      label: "摄影",
      applicable: true,
      zoneRefs: ["node:viewpoint_a", "node:viewpoint_b"],
      durationMinutes: 90,
      difficulty: "easy",
      facilities: ["驻车观景位", "三脚架架设空间"],
      limitations: ["花火季夜间机位紧张，建议提前占位"],
      description: "筒仓展望台拍全景与倒影，温泉街湖畔拍花火与夜景。",
      sceneActions: [{ kind: "focus_camera", target: "node:viewpoint_a" }],
    },
  ],
  audiences: [
    {
      id: "toddler_family",
      label: "幼儿家庭",
      allowedActivityIds: ["act-lakeside-stroll", "act-cruise"],
      preferredRouteIds: ["node:shore_walk"],
      facilityPriority: ["厕所", "长椅", "足汤", "餐饮"],
      warnings: ["码头与湖岸边缘请看护好幼童", "独木舟与 SUP 不适合婴幼儿"],
    },
    {
      id: "school_age_family",
      label: "学龄家庭",
      allowedActivityIds: ["act-lakeside-stroll", "act-cruise", "act-canoe", "act-photography"],
      preferredRouteIds: ["node:shore_walk", "node:paddle_zone"],
      facilityPriority: ["长椅", "厕所", "更衣处"],
      warnings: ["水上活动需成人陪同并全程穿救生衣"],
    },
    {
      id: "senior",
      label: "银发族",
      allowedActivityIds: ["act-lakeside-stroll", "act-cruise"],
      preferredRouteIds: ["node:shore_walk"],
      facilityPriority: ["长椅", "足汤", "厕所", "交通入口"],
    },
    {
      id: "relaxed",
      label: "休闲度假者",
      allowedActivityIds: ["act-lakeside-stroll", "act-cruise", "act-photography", "act-sup"],
      preferredRouteIds: ["node:shore_walk"],
      facilityPriority: ["温泉旅馆", "餐饮", "足汤"],
    },
    {
      id: "photographer",
      label: "摄影爱好者",
      allowedActivityIds: ["act-photography", "act-lakeside-stroll", "act-cycling"],
      preferredRouteIds: ["node:viewpoint_a", "node:viewpoint_b"],
      facilityPriority: ["驻车观景位"],
    },
  ],
  risks: [
    {
      id: "risk-wind-wave",
      label: "风浪",
      applicable: true,
      mode: "risk_simulation",
      cause: [
        "午后湖面南风增强，开阔水面浪高随之增大",
        "破火山口湖盆地形使风在湖面加速汇聚",
        "小型船只与桨板受风浪影响明显",
      ],
      sequence: [
        {
          id: "risk-wind-wave-step-1",
          title: "风力增强",
          description: "午后南风增强，湖面波纹变密，远端出现白色浪头。",
          sceneActions: [{ kind: "set_water", params: { waveHeight: 0.4, wind: 0.6 } }],
        },
        {
          id: "risk-wind-wave-step-2",
          title: "浪高增大",
          description: "开阔水面浪高增大，小型船只摇晃加剧，返航难度上升。",
          sceneActions: [
            { kind: "set_water", params: { waveHeight: 0.8, wind: 0.85 } },
            { kind: "highlight_anchor", target: "anchor-risk-open-water" },
          ],
        },
        {
          id: "risk-wind-wave-step-3",
          title: "近岸碎浪增强",
          description: "碎浪拍打码头与亲水平台，岸边缘湿滑危险。",
          sceneActions: [
            { kind: "set_water", params: { waveHeight: 0.6, splash: 0.7 } },
            { kind: "highlight_anchor", target: "anchor-pier" },
          ],
        },
      ],
      affectedAnchorIds: ["anchor-boat-zone", "anchor-paddle-zone", "anchor-risk-open-water", "anchor-pier"],
      warningSignals: [
        "湖面远端出现成排白色浪头",
        "码头船只明显摇晃、缆绳绷紧",
        "运营方发出减班或停航通知",
      ],
      actions: [
        "独木舟与 SUP 立即返回近岸活动区并上岸",
        "关注游船运营方停航信息，不要强行出船",
        "远离码头与亲水平台边缘",
      ],
      impactTexts: {
        shoreText: "对岸边漫步影响较小，注意步道湿滑与飞溅水花，远离护栏缺口",
        familyText: "亲子活动请留在温泉街步道与足汤区，避免靠近码头边缘与亲水平台",
        waterText: "水上活动暂停并立即返航；游船可能临时停航，以运营方公告为准",
      },
      officialAdvisoryBinding: "洞爷湖町官网公告与游船运营方通知（https://www.town.toyako.hokkaido.jp/）",
    },
    {
      id: "risk-cold-water",
      label: "低水温",
      applicable: true,
      mode: "risk_simulation",
      cause: [
        "湖泊最深约 180m，深层低温水体使表层升温慢",
        "春季融雪入湖，表层水温仍明显偏低",
        "落水后体温流失速度快于一般预期",
      ],
      sequence: [
        {
          id: "risk-cold-water-step-1",
          title: "落水初期冷刺激",
          description: "低温水刺激引起呼吸急促与心跳加快（冷休克反应）。",
          sceneActions: [{ kind: "set_water", params: { temperatureCue: 0.7 } }],
        },
        {
          id: "risk-cold-water-step-2",
          title: "肢体力量下降",
          description: "手脚逐渐麻木，游泳与抓握能力快速下降。",
          sceneActions: [{ kind: "set_water", params: { temperatureCue: 0.9 } }],
        },
        {
          id: "risk-cold-water-step-3",
          title: "体温持续降低",
          description: "长时间浸泡导致核心体温下降，判断力受影响。",
          sceneActions: [{ kind: "set_water", params: { temperatureCue: 1.0 } }],
        },
      ],
      affectedAnchorIds: ["anchor-paddle-zone", "anchor-boat-zone"],
      warningSignals: [
        "春季表层水温仍低（通常仅约 5–10°C）",
        "落水后手脚麻木、动作不协调",
        "同行者呼喊反应变慢",
      ],
      actions: [
        "水上活动全程穿救生衣",
        "春季与早晚时段建议穿着保温服",
        "落水后保持抱团保温姿势，优先抓附漂浮物等待救援",
        "被救起后尽快更换干衣并就医评估",
      ],
      impactTexts: {
        shoreText: "岸边活动不受影响，注意不要让儿童单独靠近水边",
        familyText: "亲子戏水仅限岸边浅水区，且需在成人手臂可及范围内",
        waterText: "落水后尽快回到船上；低水温下自行长距离游泳回岸的能力会快速下降",
      },
    },
  ],
  summaryRules: [
    {
      representativeActivityId: "act-cruise",
      representativeReason: "环湖游船覆盖湖心与中岛，体力门槛低，是多数人认识洞爷湖的方式",
      bestTimeText: "花火季为 4 月下旬至 10 月；5–9 月清晨常见薄雾，冬季雪景通透",
      bestExperienceText: "傍晚沿湖畔步道看湖上花火，或乘游船登中岛远眺羊蹄山",
      preparationItems: [
        "确认花火燃放时间与游船班次（以当年公告为准）",
        "水上活动备防风外套并全程穿救生衣",
        "冬季备防滑鞋，关注洞爷湖町官网临时关闭公告",
      ],
    },
  ],
  assets: {
    proceduralNodes: [
      "shore_walk",
      "pier",
      "boat_zone",
      "paddle_zone",
      "viewpoint_a",
      "viewpoint_b",
      "wetland",
      "lakeside_trail",
      "risk_open_water",
    ],
    estimatedBytes: 0,
  },
  fallback: {
    summary: "洞爷湖（北海道破火山口湖）图文导览：观景、玩法、人群适配与安全须知。",
    sections: [
      {
        theme: "highlights",
        title: "景色",
        body: "4 月下旬–10 月每晚湖上花火是代表性画面；5–9 月清晨常见薄雾；无风晴天可拍羊蹄山倒影；冬季雪岸与蓝色湖水对比鲜明。",
      },
      {
        theme: "experience",
        title: "怎么玩",
        body: "湖畔步道漫步约 1.5km；环湖游船约 50 分钟可登中岛；5–10 月有独木舟与 SUP；环湖骑行约 43km；双展望台适合摄影。",
      },
      {
        theme: "audience",
        title: "适合谁",
        body: "幼儿家庭与银发族以步道和游船为主；学龄家庭可加独木舟（成人陪同）；度假者可安排温泉与花火；摄影爱好者推荐筒仓展望台与温泉街夜景。",
      },
      {
        theme: "cautions",
        title: "注意什么",
        body: "午后南风使浪高增大时，小型船只立即返航、关注游船停航信息；春季水温低，水上活动全程穿救生衣；冬季步道注意积雪薄冰。",
      },
      {
        theme: "water_ecology",
        title: "水域生态",
        body: "入湖河口湿地春秋季通常有机会观察到迁徙水鸟；中岛森林是虾夷鹿栖息地；湖色随光线在蓝绿间变化，湖岸芦苇带是鱼类产卵与幼鱼隐蔽场所。",
      },
    ],
  },
};
