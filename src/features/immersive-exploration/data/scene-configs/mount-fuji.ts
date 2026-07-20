/**
 * 黄金样例 · 富士山（mountain）——全项目标杆场景，≥90% 地貌还原口径
 *
 * sceneDefinitionId: scene-mount-fuji / entityId: mount-fuji（CONTRACT 冻结）
 *
 * 地貌事实基础（真实量纲）：
 * - 海拔 3,776m 的对称成层火山锥，山麓投影半径约 20km，剖面呈抛物线：
 *   山顶附近坡度约 30°，向山麓递减至约 10°（见 MOUNT_FUJI_TERRAIN_MODEL.slopeProfile）
 * - 山顶火山口直径约 800m、深约 200m；口缘八峰合称「八神峰」，剑峰为最高峰
 * - 1707 年宝永喷发在东南山腹形成侧火山口（宝永山，约 2,693m）
 * - 西侧为大沢崩（大型崩蚀谷）；西北麓为青木原树海（贞观喷发熔岩流上的原生林）
 * - 北麓—西麓分布富士五湖：山中湖 / 河口湖 / 西湖 / 精进湖 / 本栖湖
 * - 植被垂直带：山麓照叶林 → 落叶阔叶林 → 针叶林（森林限界约 2,400–2,500m）
 *   → 高山灌丛草本 → 约 3,200m 以上为火山砾荒漠
 * - 雪线随季节大幅变化：冬季约 1,000–1,300m，7–9 月仅山顶残雪
 *
 * 渲染链路：本文件的地貌模型常量 → previewPresets.visual（snowLine / leafColor /
 * light / hazeDensity / cloudCover）→ 场景层真实 DEM 地形（public/terrain/fuji，
 * 1 单位 = 1km，山顶为原点，海拔/1000）按 preset 重算雪线海拔与森林色。
 * defaultCamera 使用场景本地坐标（河口湖上空低空斜视，非等距俯视），勿用米制量纲。
 *
 * 文案约束：无固定概率与必然性表述（copy-validator 强制）。
 */

import type {
  AnchorContent,
  ExplorationEntity,
  ImmersiveSceneDefinition,
} from "../../domain/types";

// ---------------------------------------------------------------- 地貌参考模型（真实量纲，单位：米）

/**
 * 富士山地貌数学模型：场景层程序化地形的对标基准。
 * 分段坡度剖面 + 火山口凹陷 + 山麓水系/森林带，供渲染参数派生与内容口径统一。
 */
export const MOUNT_FUJI_TERRAIN_MODEL = {
  /** 主峰剑峰海拔（通称 3,776m；2020 年改测 3,775.51m） */
  summitElevationM: 3776,
  /** 山体在山麓的投影半径约 20km——对称锥台的裾野延展 */
  baseRadiusM: 20000,
  /** 山顶火山口：直径约 800m、深约 200m 的碗状凹陷 */
  crater: { rimDiameterM: 800, depthM: 200 },
  /**
   * 分段坡度剖面（抛物线型成层火山锥）：
   * 海拔区间 → 平均坡度；山顶约 30°，向山麓递减至约 10°。
   * 场景层 Lathe 剖面按此曲率重采样，非简单圆锥。
   */
  slopeProfile: [
    { fromM: 3000, toM: 3776, slopeDeg: 30 },
    { fromM: 2000, toM: 3000, slopeDeg: 24 },
    { fromM: 1000, toM: 2000, slopeDeg: 17 },
    { fromM: 500, toM: 1000, slopeDeg: 12 },
    { fromM: 0, toM: 500, slopeDeg: 10 },
  ],
  /**
   * 八神峰：火山口缘八峰，「钵巡」路线依次绕行；
   * 剑峰为最高峰，白山岳次之。放射状山脊自口缘向山麓延伸，
   * 对应场景层的山脊/冲沟噪声方位分布。
   */
  craterRimPeaks: [
    { name: "剑峰", note: "最高峰 3,776m" },
    { name: "白山岳", note: "口缘第二高峰" },
    { name: "久须志岳", note: "东北缘，药师堂所在" },
    { name: "大日岳", note: "北缘" },
    { name: "伊豆岳", note: "东缘" },
    { name: "成就岳", note: "东南缘" },
    { name: "驹岳", note: "南缘" },
    { name: "三岛岳", note: "西南缘" },
  ],
  /** 侧火山口：1707 年宝永喷发形成，位于东南山腹 */
  flankVent: { name: "宝永山 / 宝永火口", elevationM: 2693, eruptionYear: 1707 },
  /** 西侧大型崩蚀谷：山体上最明显的侵蚀地貌 */
  collapseValley: { name: "大沢崩", aspect: "西侧" },
  /** 富士五湖（山麓堰塞湖群，方位相对山体） */
  lakes: [
    { name: "山中湖", aspect: "东麓", elevationM: 982 },
    { name: "河口湖", aspect: "北麓", elevationM: 830 },
    { name: "西湖", aspect: "西北麓", elevationM: 900 },
    { name: "精进湖", aspect: "西北麓", elevationM: 900 },
    { name: "本栖湖", aspect: "西麓", elevationM: 900 },
  ],
  /** 青木原树海：西北麓约 864 年贞观喷发熔岩流上发育的原生林 */
  forestSea: { name: "青木原树海", aspect: "西北麓", originEruptionYear: 864 },
  /**
   * 植被垂直带（海拔区间 → 带谱）：材质顶点色的分层依据——
   * 山麓森林带 → 高山灌草 → 火山砾荒漠，过渡带对应森林限界约 2,400–2,500m。
   */
  vegetationBelts: [
    { fromM: 0, toM: 700, belt: "照叶林（常绿阔叶）" },
    { fromM: 700, toM: 1600, belt: "落叶阔叶林" },
    { fromM: 1600, toM: 2450, belt: "针叶林（森林限界约 2,400–2,500m）" },
    { fromM: 2450, toM: 3200, belt: "高山灌丛与草本" },
    { fromM: 3200, toM: 3776, belt: "火山砾荒漠（几乎无植被）" },
  ],
  /** 逐月视觉雪线（约数，米）：冬季约 1,000–1,300m，盛夏仅山顶残雪 */
  snowLineByMonthM: [1100, 1000, 1300, 1800, 2300, 2900, 3450, 3650, 3500, 3000, 2600, 1800],
  /** preset 使用的季节代表雪线（由逐月雪线归纳） */
  snowLineSeasonalM: { spring: 2100, rainy: 2900, summer: 3600, autumn: 2900, winter: 1200 },
} as const;

/** 官方口径来源（富士登山官方信息） */
const FUJISAN_OFFICIAL = {
  sourceName: "富士登山官方网站",
  sourceUrl: "https://www.fujisan-climb.jp/",
} as const;

const SNOW = MOUNT_FUJI_TERRAIN_MODEL.snowLineSeasonalM;

// ---------------------------------------------------------------- 探索对象

export const MOUNT_FUJI_ENTITY: ExplorationEntity = {
  id: "mount-fuji",
  name: "富士山",
  countryCode: "JP",
  shape: "point",
  sceneFamily: "mountain",
  channels: ["nature", "outdoor", "wonder"],
  coordinates: { lat: 35.3606, lng: 138.7274 },
  activityTags: ["登山", "徒步", "观景", "摄影"],
  attributeTags: [
    "成层火山",
    "世界文化遗产",
    "海拔3776m",
    "山顶火山口约800m",
    "富士五湖与青木原树海",
    "最佳季节：7–9月登山 / 10–11月观景",
  ],
  sceneDefinitionId: "scene-mount-fuji",
  fallbackContentId: "fallback-mount-fuji",
};

// ---------------------------------------------------------------- 锚点说明内容（与 anchors.contentId 一一对应）

export const MOUNT_FUJI_ANCHOR_CONTENTS: AnchorContent[] = [
  {
    id: "fuji-peak",
    title: "剑峰 3,776m",
    body: "富士山主峰剑峰海拔 3,776m，是日本最高峰。火山口缘八峰合称「八神峰」，7–9 月无雪期可沿口缘绕行「钵巡」，一圈约 60–90 分钟；口缘区段碎石松动，需沿标识行走。",
  },
  {
    id: "fuji-station-5th",
    title: "吉田口五合目 2,305m",
    body: "吉田口五合目海拔 2,305m，已接近森林限界，周边为高山灌丛与火山砾坡。汽车与登山巴士可直达，设有山小屋、餐饮、观景台与急救站，多数登山者由此出发。",
    sourceMeta: { ...FUJISAN_OFFICIAL, mode: "typical_preview" },
  },
  {
    id: "fuji-trail-main",
    title: "吉田路线",
    body: "吉田路线是四条登山道中登山者较多的一条：五合目至山顶上行约 6.5km、约 5–6 小时，下行约 3–4 小时。七合目、八合目设有山小屋群；登山季（7 月上旬–9 月上旬）需预约通行。四条路线中距离最长的是御殿场线，单程约 10.5km。",
    sourceMeta: { ...FUJISAN_OFFICIAL, mode: "typical_preview" },
  },
  {
    id: "fuji-viewpoint-a",
    title: "河口湖展望",
    body: "河口湖位于富士山北麓，是富士五湖中观景设施较完善的一个。湖北岸可拍摄山体与湖面倒影；10–11 月红叶与初雪冠同框是经典构图，清晨湖面较平静时倒影更清晰。",
  },
  {
    id: "fuji-crater",
    title: "火山口 · 直径约800m",
    body: "山顶火山口直径约 800m、深约 200m，口壁可见熔岩与火山灰交替的成层结构——成层火山的直接样本。1707 年宝永喷发在东南山腹留下侧火山口（宝永山，约 2,693m），是富士山最近的一次喷发记录。",
  },
  {
    id: "fuji-trail-family",
    title: "亲子轻松线",
    body: "亲子轻松线以五合目周边平缓步道为主，单程约 1km、爬升不足 100m，适合 4 岁以上儿童在成人陪同下体验高山环境。沿途可观察火山砾、高山植物，天气晴朗时可俯瞰山麓森林带与河口湖方向。",
  },
  {
    id: "fuji-viewpoint-b",
    title: "精进湖展望",
    body: "精进湖位于富士山西北麓，湖面开阔、前景干净，冬季晴天常见山体完整倒映的「逆富士」。从湖畔可眺望山麓熔岩台地上的青木原树海，日出前后光线柔和，设有驻车观景位。",
  },
  {
    id: "fuji-risk-slope",
    title: "落石风险坡",
    body: "吉田路线七合目至八合目之间部分坡段坡度接近 30°，火山砾与风化岩块在冻融循环下松动，午后融冻与大风时段落石更活跃。经过时请佩戴头盔、快速通过不停留，并留意上方动静。",
  },
];

// ---------------------------------------------------------------- 场景定义

export const MOUNT_FUJI_SCENE: ImmersiveSceneDefinition = {
  id: "scene-mount-fuji",
  family: "mountain",
  entityName: "富士山",
  regionLabel: "日本 · 山梨县 / 静冈县",
  // 场景本地坐标（1 单位 = 1km，山顶为原点、海拔/1000，controls 限距 2.5–70）：
  // 河口湖北岸上空约 1.2 单位高低空斜视，前景湖面 + 中景山体 + 地平线可见，勿用米制量纲
  defaultCamera: {
    position: [3.0, 1.6, -16.5],
    lookAt: [0, 2.2, 0],
    fov: 46,
  },
  arrival: {
    subtitle: "日本最高峰 · 海拔 3,776m 的对称成层火山",
    headlineSight: "山顶雪冠、八神峰火山口缘与裾野全貌",
    headlineActivity: "吉田口五合目观景与吉田路线登山",
    observeMs: 6000,
    transitionBeats: [
      "接近山体，视野从河口湖湖面低空望向山麓森林带",
      "视线沿山体抬升，辨认五合目、登山道与火山口轮廓",
      "相机定位于河口湖上空低空斜视视角",
      "主题入口出现",
    ],
  },
  themes: [
    { id: "highlights", label: "景色", defaultSelectionId: "preset-autumn-foliage" },
    { id: "experience", label: "怎么玩", defaultSelectionId: "act-yoshida-hike" },
    { id: "audience", label: "适合谁", defaultSelectionId: "school_age_family" },
    { id: "cautions", label: "注意什么", defaultSelectionId: "risk-thunderstorm" },
    { id: "nature_geology", label: "自然观察" },
  ],
  anchors: [
    {
      id: "anchor-peak",
      label: "剑峰 3,776m",
      anchorType: "peak",
      positionRef: "node:peak",
      themes: ["highlights", "nature_geology"],
      contentId: "fuji-peak",
      priority: 1,
    },
    {
      id: "anchor-station-5th",
      label: "吉田口五合目 2,305m",
      anchorType: "facility",
      positionRef: "node:station_5th",
      themes: ["experience", "audience"],
      contentId: "fuji-station-5th",
      priority: 2,
    },
    {
      id: "anchor-trail-main",
      label: "吉田路线",
      anchorType: "route",
      positionRef: "node:trail_main",
      themes: ["experience"],
      contentId: "fuji-trail-main",
      priority: 3,
    },
    {
      id: "anchor-viewpoint-a",
      label: "河口湖展望",
      anchorType: "viewpoint",
      positionRef: "node:viewpoint_a",
      themes: ["highlights", "audience"],
      contentId: "fuji-viewpoint-a",
      priority: 4,
    },
    {
      id: "anchor-crater",
      label: "火山口 · 直径约800m",
      anchorType: "ecology",
      positionRef: "node:crater",
      themes: ["nature_geology", "highlights"],
      contentId: "fuji-crater",
      priority: 5,
    },
    {
      id: "anchor-trail-family",
      label: "亲子轻松线",
      anchorType: "route",
      positionRef: "node:trail_family",
      themes: ["audience", "experience"],
      contentId: "fuji-trail-family",
      priority: 6,
    },
    {
      id: "anchor-viewpoint-b",
      label: "精进湖展望",
      anchorType: "viewpoint",
      positionRef: "node:viewpoint_b",
      themes: ["highlights"],
      contentId: "fuji-viewpoint-b",
      priority: 7,
    },
    {
      id: "anchor-risk-slope",
      label: "落石风险坡",
      anchorType: "risk_zone",
      positionRef: "node:risk_slope",
      themes: ["cautions"],
      contentId: "fuji-risk-slope",
      priority: 8,
    },
  ],
  previewPresets: [
    {
      id: "preset-autumn-foliage",
      label: "秋季红叶",
      months: [10, 11],
      representative: true,
      mode: "typical_preview",
      sourceMeta: { mode: "typical_preview", sourceName: "本地策展配置（季节规律）" },
      visual: {
        snowLine: SNOW.autumn,
        season: "autumn",
        leafColor: "#c8452c",
        light: "clear_autumn",
        hazeDensity: 0.12,
        cloudCover: 0.2,
      },
      whereText: "河口湖北岸与精进湖展望位，可同框拍摄红叶、湖面与初雪冠山体",
      whenText: "10 月中旬至 11 月中旬，清晨至上午光线较佳",
      whyText: "初冠雪通常在 10 月上旬出现，雪线逐周下移；山麓红叶与雪冠同期出现，秋季空气透明度高，是富士山较具代表性的季节画面",
    },
    {
      id: "preset-summer-climb",
      label: "夏季登山季",
      months: [7, 8, 9],
      representative: false,
      mode: "typical_preview",
      sourceMeta: { mode: "typical_preview", sourceName: "本地策展配置（季节规律）" },
      visual: {
        snowLine: SNOW.summer,
        season: "summer",
        leafColor: "#3f7d44",
        light: "summer_bright",
        hazeDensity: 0.3,
        cloudCover: 0.4,
      },
      whereText: "吉田路线沿线与山顶，山小屋群全部开放",
      whenText: "7 月上旬至 9 月上旬，官方登山季",
      whyText: "无雪期山体呈红褐色火山砾肌理，仅山顶附近有残雪；可在山顶迎接日出，午后山区易有积雨云，建议早出发早下撤",
    },
    {
      id: "preset-rainy-season",
      label: "梅雨新绿",
      months: [6],
      representative: false,
      mode: "typical_preview",
      sourceMeta: { mode: "typical_preview", sourceName: "本地策展配置（季节规律）" },
      visual: {
        snowLine: SNOW.rainy,
        season: "summer",
        leafColor: "#4d8a4a",
        light: "morning",
        hazeDensity: 0.5,
        cloudCover: 0.75,
      },
      whereText: "山麓新绿带与富士五湖周边，山体常被云层遮蔽",
      whenText: "6 月梅雨季，云隙出现的清晨",
      whyText: "残雪退至山腰以上，山麓新绿最盛；云雾多在半山腰流动，云隙间可见雪溪沿冲沟下延的线条",
    },
    {
      id: "preset-spring-snow",
      label: "春雪残雪",
      months: [3, 4, 5],
      representative: false,
      mode: "typical_preview",
      sourceMeta: { mode: "typical_preview", sourceName: "本地策展配置（季节规律）" },
      visual: {
        snowLine: SNOW.spring,
        season: "spring",
        leafColor: "#7a9a5b",
        light: "spring_soft",
        hazeDensity: 0.25,
        cloudCover: 0.3,
      },
      whereText: "山腰残雪带与富士五湖展望点",
      whenText: "3 月至 5 月，残雪与新绿过渡",
      whyText: "残雪沿登山道与冲沟呈条带状分布，雪线随回暖逐周上移；山麓新绿与雪冠形成层次，登山道未开放，以远眺为主",
    },
    {
      id: "preset-winter-crown",
      label: "冬季雪冠",
      months: [12, 1, 2],
      representative: false,
      mode: "typical_preview",
      sourceMeta: { mode: "typical_preview", sourceName: "本地策展配置（季节规律）" },
      visual: {
        snowLine: SNOW.winter,
        season: "winter",
        leafColor: "#5b6b5b",
        light: "winter_clear",
        hazeDensity: 0.08,
        cloudCover: 0.15,
      },
      whereText: "精进湖与河口湖展望位，常见完整雪冠与倒影",
      whenText: "12 月至 2 月，晴天率较高的早晨",
      whyText: "冬季空气干燥通透，雪线下探至山麓上缘、雪冠覆盖大部分山体，对称锥形轮廓最清晰，是远距离观景与摄影的稳定时段",
    },
  ],
  activities: [
    {
      id: "act-easy-viewing",
      label: "轻松观景",
      applicable: true,
      zoneRefs: ["node:viewpoint_a", "node:station_5th"],
      durationMinutes: 45,
      difficulty: "easy",
      facilities: ["观景平台", "停车场", "餐饮", "厕所"],
      limitations: ["冬季部分观景道路积雪，需确认开放状态"],
      description: "乘车至河口湖展望位或吉田口五合目，原地观景与短距离散步，无需登山装备。",
      sceneActions: [{ kind: "focus_camera", target: "node:viewpoint_a" }],
    },
    {
      id: "act-family-walk",
      label: "亲子短途",
      applicable: true,
      routeRef: "node:trail_family",
      durationMinutes: 90,
      difficulty: "easy",
      facilities: ["休息长椅", "解说牌", "厕所"],
      limitations: ["4 岁以下儿童不建议前往 2,000m 以上区域", "需成人全程陪同"],
      description: "沿五合目周边平缓步道短距离徒步，单程约 1km，观察高山植物与火山砾地貌。",
      sceneActions: [{ kind: "show_route", target: "node:trail_family" }],
    },
    {
      id: "act-yoshida-hike",
      label: "经典徒步（吉田线）",
      applicable: true,
      routeRef: "node:trail_main",
      durationMinutes: 600,
      difficulty: "hard",
      requirements: ["登山季预约通行", "建议预订山小屋", "基础登山装备"],
      facilities: ["山小屋群", "急救站", "厕所（收费）"],
      limitations: ["仅 7 月上旬至 9 月上旬开放", "午后雷暴时段需中断行程"],
      description: "吉田口五合目至山顶上行约 6.5km、往返约 9–10 小时；多数登山者在山小屋住宿一晚后登顶看日出。",
      sceneActions: [{ kind: "show_route", target: "node:trail_main" }],
    },
    {
      id: "act-summit-climb",
      label: "登顶登山",
      applicable: true,
      routeRef: "node:trail_main",
      durationMinutes: 720,
      difficulty: "expert",
      requirements: ["高山徒步经验", "全套防寒防雨装备", "登山保险"],
      facilities: ["山小屋群", "山顶邮局（季节限定）"],
      limitations: ["不建议无住宿的「弹丸登山」", "3,000m 以上注意高原反应征兆"],
      description: "在吉田线基础上增加火山口缘「钵巡」（绕行八神峰一圈约 60–90 分钟）与剑峰登顶，对体力与装备要求更高。",
      sceneActions: [{ kind: "highlight_anchor", target: "anchor-peak" }],
    },
    {
      id: "act-photography",
      label: "摄影",
      applicable: true,
      zoneRefs: ["node:viewpoint_a", "node:viewpoint_b"],
      durationMinutes: 120,
      difficulty: "easy",
      facilities: ["驻车观景位", "三脚架架设空间"],
      limitations: ["日出前机位紧张，建议提前到达"],
      description: "河口湖与精进湖双机位拍摄雪冠、倒影与红叶，秋冬季通透度更佳。",
      sceneActions: [{ kind: "focus_camera", target: "node:viewpoint_b" }],
    },
  ],
  audiences: [
    {
      id: "toddler_family",
      label: "幼儿家庭",
      allowedActivityIds: ["act-easy-viewing"],
      preferredRouteIds: ["node:viewpoint_a"],
      facilityPriority: ["厕所", "餐饮", "休息点", "交通入口"],
      warnings: ["海拔 2,000m 以上区域婴幼儿可能出现不适，建议缩短停留时间", "山顶与登山道不适合婴儿车"],
    },
    {
      id: "school_age_family",
      label: "学龄家庭",
      allowedActivityIds: ["act-easy-viewing", "act-family-walk", "act-photography"],
      preferredRouteIds: ["node:trail_family"],
      facilityPriority: ["休息长椅", "厕所", "解说牌"],
      warnings: ["亲子徒步需成人全程陪同，注意防晒与补水"],
    },
    {
      id: "hiker",
      label: "徒步爱好者",
      allowedActivityIds: ["act-yoshida-hike", "act-photography", "act-easy-viewing"],
      preferredRouteIds: ["node:trail_main"],
      facilityPriority: ["山小屋", "急救站"],
    },
    {
      id: "photographer",
      label: "摄影爱好者",
      allowedActivityIds: ["act-photography", "act-easy-viewing"],
      preferredRouteIds: ["node:viewpoint_a", "node:viewpoint_b"],
      facilityPriority: ["驻车观景位"],
    },
    {
      id: "adventure",
      label: "探险玩家",
      allowedActivityIds: ["act-summit-climb", "act-yoshida-hike"],
      preferredRouteIds: ["node:trail_main"],
      warnings: ["请评估自身体能与天气窗口，避免单独行动"],
    },
  ],
  risks: [
    {
      id: "risk-thunderstorm",
      label: "雷暴",
      applicable: true,
      mode: "risk_simulation",
      cause: [
        "夏季午后地面受热，暖湿空气沿约 30° 的上部坡面快速抬升",
        "积雨云在山脊附近局地发展，移动速度快",
        "山顶与火山口缘地形裸露，登山者自身易成为高点",
      ],
      sequence: [
        {
          id: "risk-thunderstorm-step-1",
          title: "积雨云生成",
          description: "山麓上空出现快速向上发展的积雨云，云底开始变暗。",
          sceneActions: [{ kind: "set_weather", params: { cloudCover: 0.6, wind: 0.4 } }],
        },
        {
          id: "risk-thunderstorm-step-2",
          title: "云体逼近山顶",
          description: "云体加厚并沿山脊蔓延，能见度下降，远处可闻雷声。",
          sceneActions: [{ kind: "set_weather", params: { cloudCover: 0.9, fog: 0.6, wind: 0.7 } }],
        },
        {
          id: "risk-thunderstorm-step-3",
          title: "雷电与强风",
          description: "山顶与登山道暴露区出现雷电、强风与急雨，体感温度骤降。",
          sceneActions: [
            { kind: "set_weather", params: { thunderstorm: true, wind: 1.0, rain: 0.9 } },
            { kind: "highlight_anchor", target: "anchor-peak" },
            { kind: "highlight_anchor", target: "anchor-trail-main" },
          ],
        },
        {
          id: "risk-thunderstorm-step-4",
          title: "云体过境减弱",
          description: "积雨云越过山脊后减弱，仍需等待雷声停止一段时间再恢复行动。",
          sceneActions: [{ kind: "set_weather", params: { thunderstorm: false, cloudCover: 0.4, wind: 0.3 } }],
        },
      ],
      affectedAnchorIds: ["anchor-peak", "anchor-trail-main", "anchor-crater"],
      warningSignals: [
        "远处积雨云快速向上发展并呈砧状展开",
        "雷声间隔逐渐变短",
        "皮肤或头发有静电感",
      ],
      actions: [
        "立即离开山顶与山脊，进入山小屋或低洼处躲避",
        "远离孤立树木、金属栏杆与绳索",
        "雷电期间不要在开阔地使用登山杖支撑站立",
        "等待雷声停止约 30 分钟后再恢复行动",
      ],
      impactTexts: {
        routeText: "吉田路线七合目以上全程暴露，雷暴时段应立即中断上行并就近进入山小屋",
        familyText: "亲子与轻松观景集中在五合目，听到雷声请返回建筑物或车内",
      },
      officialAdvisoryBinding: "日本气象厅雷电注意报",
    },
    {
      id: "risk-rockfall",
      label: "落石",
      applicable: true,
      mode: "risk_simulation",
      cause: [
        "上部坡面接近 30°，火山砾与风化岩块附着在陡坡表面",
        "昼夜冻融循环使岩块逐渐松动",
        "上方登山者踩踏也可能带落石块",
      ],
      sequence: [
        {
          id: "risk-rockfall-step-1",
          title: "岩块松动",
          description: "融冻或大风使坡面岩块失去支撑，处于临界状态。",
          sceneActions: [{ kind: "highlight_anchor", target: "anchor-risk-slope" }],
        },
        {
          id: "risk-rockfall-step-2",
          title: "崩落发生",
          description: "石块脱离坡面开始滚落，发出碰撞声。",
          sceneActions: [
            { kind: "set_weather", params: { dust: 0.5 } },
            { kind: "highlight_anchor", target: "anchor-trail-main" },
          ],
        },
        {
          id: "risk-rockfall-step-3",
          title: "沿坡弹跳加速",
          description: "落石在陡坡弹跳加速，波及下方登山道范围。",
          sceneActions: [{ kind: "set_weather", params: { dust: 0.8 } }],
        },
      ],
      affectedAnchorIds: ["anchor-trail-main", "anchor-risk-slope"],
      warningSignals: [
        "上方传来石块碰撞声或「落石」喊声",
        "坡面可见新鲜落石痕迹与碎石堆积",
        "午后融冻或大风时段",
      ],
      actions: [
        "通过风险坡段时佩戴头盔",
        "快速通过不停留，与前方人员保持间距",
        "听到喊声立即向山体一侧躲避并护住头部",
      ],
      impactTexts: {
        routeText: "吉田路线七合目至八合目部分坡段为落石相对高发区，请按标识快速通过",
        familyText: "亲子轻松线不经过落石坡段，无需特别规避",
      },
    },
  ],
  summaryRules: [
    {
      representativeActivityId: "act-yoshida-hike",
      representativeReason: "吉田路线设施完善、登山者集中，是体验富士山的经典方式",
      bestTimeText: "登山季为 7 月上旬至 9 月上旬；远眺观景以 10–11 月红叶季与冬季晴天为佳",
      bestExperienceText: "在河口湖或精进湖远眺雪冠与红叶，或沿吉田路线登顶绕行八神峰迎接日出",
      preparationItems: [
        "确认登山季日期与预约通行规则",
        "准备防风防寒层（山顶气温较山麓低约 15–20°C）",
        "了解雷暴与落石的判断信号",
        "建议投保登山保险",
      ],
    },
  ],
  assets: {
    proceduralNodes: [
      "peak",
      "crater",
      "trail_main",
      "trail_family",
      "viewpoint_a",
      "viewpoint_b",
      "station_5th",
      "snow_line",
      "vegetation_alpine",
      "risk_slope",
    ],
    estimatedBytes: 0,
  },
  fallback: {
    summary: "富士山（海拔 3,776m 的对称成层火山）图文导览：观景、登山、人群适配与安全须知。",
    sections: [
      {
        theme: "highlights",
        title: "景色",
        body: "秋季（10–11 月）河口湖与精进湖可拍红叶与初雪冠同框；冬季晴天常见完整雪冠与「逆富士」倒影；夏季登山季山体呈红褐色火山砾肌理，可在山顶迎接日出。",
      },
      {
        theme: "experience",
        title: "怎么玩",
        body: "轻松观景可乘车至五合目或湖畔展望位；经典徒步走吉田线（上行约 6.5km、往返约 9–10 小时）；亲子家庭可走五合目平缓步道；登顶可加火山口缘「钵巡」。",
      },
      {
        theme: "audience",
        title: "适合谁",
        body: "幼儿家庭建议以低海拔观景为主；学龄家庭可体验亲子轻松线；徒步与探险人群可选择吉田线徒步或登顶；摄影爱好者推荐河口湖与精进湖双机位。",
      },
      {
        theme: "cautions",
        title: "注意什么",
        body: "夏季午后警惕雷暴：看到积雨云快速发展、听到雷声即离开山顶与山脊。吉田线部分坡段有落石风险，请佩戴头盔快速通过。",
      },
      {
        theme: "nature_geology",
        title: "自然观察",
        body: "富士山为对称成层火山：山顶火山口直径约 800m、深约 200m，口缘八峰合称八神峰；东南山腹有 1707 年宝永喷发的侧火山口，西侧为大沢崩崩蚀谷。植被从山麓照叶林经针叶林（森林限界约 2,400–2,500m）过渡到高山灌草与火山砾荒漠；西北麓青木原树海生长在古熔岩流上，北麓至西麓分布富士五湖；雪线随季节在约 1,000–3,700m 间变化。",
      },
    ],
  },
};
