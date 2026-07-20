/**
 * 黄金样例 · 独库公路（engineering_route）
 *
 * sceneDefinitionId: scene-duku-highway / entityId: duku-highway（V2 新增）
 * 内容口径：G217 独山子—库车段约 561km，穿越天山，季节性通车（通常 6–9 月）。
 * 地貌口径（还原目标）：北段独山子大峡谷灰褐色深切峡谷与陡峭岩壁 →
 * 哈希勒根达坂（海拔约 3400m）雪山垭口与防雪长廊 → 中段那拉提/巴音布鲁克
 * 绿色高山草甸 → 南段库车红层（天山神秘大峡谷红色砂岩），盘山展线多发夹弯。
 *
 * 渲染说明：3D 场景由共享的 EngineeringRouteScene 程序化生成，本文件通过
 * previewPresets[].visual 的渲染参数键（light / season / snowLine / traffic /
 * night）驱动季节与光照状态，通过 defaultCamera 给出「近景峡谷＋盘山公路、
 * 中景草甸、远景雪山垭口」的纵深构图。
 *
 * 文案约束：无固定概率与必然性表述（copy-validator 强制）。
 */

import type {
  AnchorContent,
  ExplorationEntity,
  ImmersiveSceneDefinition,
} from "../../domain/types";

// ---------------------------------------------------------------- 探索对象

export const DUKU_HIGHWAY_ENTITY: ExplorationEntity = {
  id: "duku-highway",
  name: "独库公路",
  countryCode: "CHN",
  shape: "route",
  sceneFamily: "engineering_route",
  channels: ["engineering", "nature", "outdoor"],
  coordinates: { lat: 43.0, lng: 84.5 },
  activityTags: ["自驾", "摄影", "观景", "骑行"],
  attributeTags: ["穿越天山", "季节性通车", "约561km", "最佳季节：6–9月"],
  sceneDefinitionId: "scene-duku-highway",
  fallbackContentId: "fallback-duku-highway",
};

// ---------------------------------------------------------------- 锚点说明内容（与 anchors.contentId 一一对应）

export const DUKU_HIGHWAY_ANCHOR_CONTENTS: AnchorContent[] = [
  {
    id: "duku-route-main",
    title: "天山主线",
    body: "独库公路（G217）北起独山子、南至库车，纵贯天山南北，全程约 561km。北段穿行独山子大峡谷的灰褐色深切峡谷，中段进入那拉提、巴音布鲁克的绿色高山草甸，南段掠过库车红层的红色砂岩峡谷，海拔起伏让一条路呈现「一日四季」的地貌纵深。全线为山区双向两车道，盘山展线弯多坡陡，需按限速行驶。",
  },
  {
    id: "duku-bridge",
    title: "峡谷高架桥",
    body: "北段多处深切河谷以高架桥跨越，桥塔立于灰褐色陡峭岩壁之间，桥下可见季节性洪流冲刷的河谷。桥梁段横风明显，经过时请握紧方向盘、避免在桥面停车观望。",
  },
  {
    id: "duku-tunnel",
    title: "达坂隧道与防雪长廊",
    body: "高海拔达坂以隧道穿越分水岭，缩短翻山里程并避开部分积雪路段；哈希勒根段建有紧贴山壁的防雪长廊，用于抵御雪崩与风吹雪对路面的掩埋。隧道与长廊内光线变化大，请提前开启车灯、保持车距。",
  },
  {
    id: "duku-pass",
    title: "哈希勒根达坂",
    body: "海拔约 3400m，是全线海拔较高的达坂之一。夏季垭口两侧仍可见残雪与冰川侵蚀地貌，盘山发夹弯沿坡面展线攀升。垭口天气转换快，短时云雾与降温常见。",
  },
  {
    id: "duku-viewpoint-a",
    title: "乔尔玛观景带",
    body: "乔尔玛一带河谷开阔、草甸连绵，设有停车观景位，可回望盘山发夹弯路段与远处雪山背景。此处也是分段休息与补给的常用节点。",
  },
  {
    id: "duku-service",
    title: "那拉提服务区",
    body: "那拉提一带为中段高山草甸的核心段落，沿线服务区提供加油、餐饮与简易维修，旺季车位紧张。山区路段补给点间距较长，建议在服务区补足燃油与饮水。",
  },
  {
    id: "duku-scenic-spur",
    title: "巴音布鲁克支线",
    body: "那拉提以南可接巴音布鲁克草原方向，天鹅湖与九曲十八弯日落是摄影热点，开都河在开阔草甸上蜿蜒成多重河曲。支线为草原公路，注意避让牲畜横穿。",
  },
  {
    id: "duku-risk-rockfall",
    title: "落石易发段",
    body: "峡谷灰褐色岩壁与库车红层砂岩路段在融冻、降雨后落石活动增多，路面可见碎石堆积。经过时请观察上方坡面、快速通过，不在陡壁下停车。",
  },
];

// ---------------------------------------------------------------- 场景定义

export const DUKU_HIGHWAY_SCENE: ImmersiveSceneDefinition = {
  id: "scene-duku-highway",
  family: "engineering_route",
  entityName: "独库公路",
  regionLabel: "中国 · 新疆（独山子—库车）",
  // 纵深构图：近景峡谷岩壁与盘山公路、中景草甸过渡、远景雪山垭口（路东端抬升处）
  defaultCamera: {
    position: [-36, 12, 30],
    lookAt: [14, 3, -2],
    fov: 47,
  },
  arrival: {
    subtitle: "纵贯天山的季节性公路 · 约 561km 的工程走廊",
    headlineSight: "峡谷、草甸、雪山达坂与红层串成的盘山走廊",
    headlineActivity: "自驾穿越与高点观景",
    observeMs: 6000,
    transitionBeats: [
      "从独山子大峡谷上空进入，俯瞰灰褐色深切峡谷",
      "沿盘山公路低空飞行，辨认发夹弯、高架桥与防雪长廊",
      "掠过绿色高山草甸，远眺哈希勒根达坂雪山垭口",
      "相机定位于峡谷上方的默认视角",
      "主题入口出现",
    ],
  },
  themes: [
    { id: "highlights", label: "景色", defaultSelectionId: "preset-summer-open" },
    { id: "experience", label: "怎么玩", defaultSelectionId: "act-self-drive" },
    { id: "audience", label: "适合谁", defaultSelectionId: "experienced" },
    { id: "cautions", label: "注意什么", defaultSelectionId: "risk-rockfall" },
    { id: "engineering_operation", label: "工程解读" },
  ],
  anchors: [
    {
      id: "anchor-route-main",
      label: "天山主线",
      anchorType: "route",
      positionRef: "node:route_main",
      themes: ["highlights", "engineering_operation"],
      contentId: "duku-route-main",
      priority: 1,
    },
    {
      id: "anchor-bridge",
      label: "峡谷高架桥",
      anchorType: "facility",
      positionRef: "node:bridge_node",
      themes: ["engineering_operation", "highlights"],
      contentId: "duku-bridge",
      priority: 2,
    },
    {
      id: "anchor-tunnel",
      label: "达坂隧道",
      anchorType: "facility",
      positionRef: "node:tunnel_node",
      themes: ["engineering_operation"],
      contentId: "duku-tunnel",
      priority: 3,
    },
    {
      id: "anchor-pass",
      label: "哈希勒根达坂",
      anchorType: "peak",
      positionRef: "node:pass_summit",
      themes: ["highlights", "cautions"],
      contentId: "duku-pass",
      priority: 4,
    },
    {
      id: "anchor-viewpoint-a",
      label: "乔尔玛观景带",
      anchorType: "viewpoint",
      positionRef: "node:viewpoint_a",
      themes: ["highlights", "audience"],
      contentId: "duku-viewpoint-a",
      priority: 5,
    },
    {
      id: "anchor-service",
      label: "那拉提服务区",
      anchorType: "facility",
      positionRef: "node:service_stop",
      themes: ["audience", "experience"],
      contentId: "duku-service",
      priority: 6,
    },
    {
      id: "anchor-scenic-spur",
      label: "巴音布鲁克支线",
      anchorType: "route",
      positionRef: "node:scenic_spur",
      themes: ["experience", "highlights"],
      contentId: "duku-scenic-spur",
      priority: 7,
    },
    {
      id: "anchor-risk-rockfall",
      label: "落石易发段",
      anchorType: "risk_zone",
      positionRef: "node:risk_rockfall_zone",
      themes: ["cautions"],
      contentId: "duku-risk-rockfall",
      priority: 8,
    },
  ],
  previewPresets: [
    {
      id: "preset-summer-open",
      label: "夏季通车期",
      months: [6, 7, 8],
      representative: true,
      mode: "typical_preview",
      sourceMeta: { mode: "typical_preview", sourceName: "本地策展配置（季节规律）" },
      // 渲染参数键与 EngineeringRouteScene 对齐：正午光照、雪线抬到达坂高度、车流较密
      visual: { light: "noon", season: "summer", snowLine: 9.2, traffic: 0.85 },
      whereText: "全线通车，北段峡谷、中段草甸与达坂残雪景观对比鲜明",
      whenText: "通常 6 月至 9 月，具体开闭时间以交管部门公告为准",
      whyText: "夏季积雪退到达坂以上、草甸返青，是一年中通行条件较好的时段；旺季车流明显增多",
    },
    {
      id: "preset-early-autumn",
      label: "初秋金色草甸",
      months: [9, 10],
      representative: false,
      mode: "typical_preview",
      sourceMeta: { mode: "typical_preview", sourceName: "本地策展配置（季节规律）" },
      // 午后斜照、雪线开始下移、车流回落
      visual: { light: "afternoon", season: "autumn", snowLine: 7.5, traffic: 0.5 },
      whereText: "那拉提与巴音布鲁克方向草甸转金",
      whenText: "9 月至 10 月初，视当年降温与降雪节奏",
      whyText: "初秋草甸金黄、空气通透，达坂可能迎来初雪，通行窗口随时可能收窄",
    },
    {
      id: "preset-winter-closed",
      label: "冬春季封闭",
      months: [11, 12, 1, 2, 3, 4, 5],
      representative: false,
      mode: "typical_preview",
      sourceMeta: { mode: "typical_preview", sourceName: "本地策展配置（季节规律）" },
      // 冬季清冷晨光、雪线压到谷地、车流归零（封路）
      visual: { light: "morning", season: "winter", snowLine: 2.8, traffic: 0.0 },
      whereText: "高海拔路段积雪深厚，全线或大部分路段封闭",
      whenText: "通常 11 月至次年 5 月",
      whyText: "冬春季达坂积雪与雪崩风险使公路封闭养护，可借此了解除雪与养护作业",
    },
  ],
  activities: [
    {
      id: "act-self-drive",
      label: "自驾穿越",
      applicable: true,
      routeRef: "node:route_main",
      durationMinutes: 600,
      difficulty: "moderate",
      requirements: ["确认通车公告", "山区驾驶经验", "车辆状况检查"],
      facilities: ["服务区", "停车观景位"],
      limitations: ["仅限通车期", "部分时段有交通管制", "弯多坡陡需按限速行驶"],
      description: "分 1–2 天纵贯天山，依次经过灰褐色峡谷、绿色高山草甸、雪山达坂与库车红层等地貌段落，服务区与观景带分段休息。",
      sceneActions: [{ kind: "show_route", target: "node:route_main" }],
    },
    {
      id: "act-pass-stop",
      label: "达坂观景",
      applicable: true,
      zoneRefs: ["node:pass_summit"],
      durationMinutes: 45,
      difficulty: "easy",
      facilities: ["垭口停车区"],
      limitations: ["海拔较高注意保暖与缓行", "天气变化快，勿久留"],
      description: "在哈希勒根达坂停车区观察残雪、冰川侵蚀地貌与防雪长廊，俯瞰盘山发夹弯路段全貌。",
      sceneActions: [{ kind: "focus_camera", target: "node:pass_summit" }],
    },
    {
      id: "act-bridge-tunnel-read",
      label: "桥隧工程观察",
      applicable: true,
      zoneRefs: ["node:bridge_node", "node:tunnel_node"],
      durationMinutes: 60,
      difficulty: "easy",
      facilities: ["桥头观景点（路侧）"],
      limitations: ["桥面与隧道内禁止停车", "请在指定路侧区域观察"],
      description: "观察峡谷高架桥的桥塔与拉索布置、达坂隧道的洞口工程与防雪长廊结构，理解路线如何跨越地形障碍。",
      sceneActions: [{ kind: "highlight_anchor", target: "anchor-bridge" }],
    },
    {
      id: "act-grassland-spur",
      label: "草原支线延伸",
      applicable: true,
      routeRef: "node:scenic_spur",
      durationMinutes: 240,
      difficulty: "easy",
      facilities: ["景区停车场", "餐饮"],
      limitations: ["注意避让牲畜横穿", "日落时段回程注意视线"],
      description: "从那拉提接巴音布鲁克方向，草原公路延伸至天鹅湖与九曲十八弯，日落前后草甸与河曲的光影层次丰富。",
      sceneActions: [{ kind: "show_route", target: "node:scenic_spur" }],
    },
    {
      id: "act-photo-drive",
      label: "公路摄影",
      applicable: true,
      zoneRefs: ["node:viewpoint_a", "node:pass_summit"],
      durationMinutes: 90,
      difficulty: "easy",
      facilities: ["停车观景位"],
      limitations: ["仅在停车观景位拍摄，弯道处勿停车"],
      description: "乔尔玛观景带回望盘山发夹弯与雪山背景，达坂拍残雪与车队光轨；清晨与傍晚侧光更有层次。",
      sceneActions: [{ kind: "focus_camera", target: "node:viewpoint_a" }],
    },
  ],
  audiences: [
    {
      id: "school_age_family",
      label: "学龄家庭",
      allowedActivityIds: ["act-pass-stop", "act-grassland-spur", "act-photo-drive"],
      preferredRouteIds: ["node:route_main"],
      facilityPriority: ["服务区", "厕所", "餐饮"],
      warnings: ["山区车程长，备晕车药与零食", "垭口海拔较高，儿童活动以缓步为主"],
    },
    {
      id: "experienced",
      label: "自驾老手",
      allowedActivityIds: ["act-self-drive", "act-bridge-tunnel-read", "act-photo-drive"],
      preferredRouteIds: ["node:route_main"],
      facilityPriority: ["服务区", "简易维修"],
    },
    {
      id: "beginner",
      label: "自驾新手",
      allowedActivityIds: ["act-grassland-spur", "act-photo-drive", "act-pass-stop"],
      preferredRouteIds: ["node:scenic_spur"],
      facilityPriority: ["服务区", "停车观景位"],
      warnings: ["建议分段驾驶、避免夜间走山路", "跟随车流，勿在弯道超车"],
    },
    {
      id: "photographer",
      label: "摄影爱好者",
      allowedActivityIds: ["act-photo-drive", "act-pass-stop", "act-grassland-spur"],
      preferredRouteIds: ["node:viewpoint_a"],
      facilityPriority: ["停车观景位"],
    },
    {
      id: "adventure",
      label: "深度玩家",
      allowedActivityIds: ["act-self-drive", "act-bridge-tunnel-read", "act-grassland-spur"],
      preferredRouteIds: ["node:route_main"],
      warnings: ["请评估天气与车况，避免单人单车深入非铺装支线"],
    },
  ],
  risks: [
    {
      id: "risk-rockfall",
      label: "落石",
      applicable: true,
      mode: "risk_simulation",
      cause: [
        "峡谷灰褐色岩壁与库车红层砂岩风化破碎",
        "融冻与降雨使坡面岩块松动",
        "车辆震动可能触发临界岩块崩落",
      ],
      sequence: [
        {
          id: "risk-rockfall-step-1",
          title: "坡面岩块松动",
          description: "降雨或融冻后，陡壁上岩块处于临界状态，坡脚可见新鲜碎石。",
          sceneActions: [{ kind: "highlight_anchor", target: "anchor-risk-rockfall" }],
        },
        {
          id: "risk-rockfall-step-2",
          title: "落石发生",
          description: "石块崩落滚向路面，扬起尘土并发出碰撞声。",
          sceneActions: [
            { kind: "set_weather", params: { dust: 0.6 } },
            { kind: "highlight_anchor", target: "anchor-route-main" },
          ],
        },
        {
          id: "risk-rockfall-step-3",
          title: "临时管制",
          description: "养护部门封闭路段清理落石，车辆排队等待或按指示绕行。",
          sceneActions: [{ kind: "set_weather", params: { dust: 0.3, trafficFlow: 0.1 } }],
        },
      ],
      affectedAnchorIds: ["anchor-risk-rockfall", "anchor-route-main"],
      warningSignals: [
        "路面出现新鲜碎石堆积",
        "坡面有石块滚落痕迹或异响",
        "降雨后或午后融冻时段",
      ],
      actions: [
        "通过陡壁路段时观察上方、快速通过不停留",
        "与前车保持间距，避免并排行驶",
        "遇到管制请耐心等待，勿强行穿越",
      ],
      impactTexts: {
        routeText: "落石易发段可能临时管制，行程请预留机动时间",
        familyText: "车内乘客在落石段请系好安全带，勿开窗探头",
      },
      officialAdvisoryBinding: "新疆交管部门路况通告",
    },
    {
      id: "risk-snowstorm",
      label: "达坂暴雪",
      applicable: true,
      mode: "risk_simulation",
      cause: [
        "高海拔达坂气温低，冷涡过境易降雪",
        "风吹雪使路面积雪快速堆积",
        "能见度骤降使车队通行困难",
      ],
      sequence: [
        {
          id: "risk-snowstorm-step-1",
          title: "气温骤降云压垭口",
          description: "垭口上空云层压低，气温快速下降，残雪带开始扩展。",
          sceneActions: [
            { kind: "set_weather", params: { cloudCover: 0.7, wind: 0.5 } },
            { kind: "highlight_anchor", target: "anchor-pass" },
          ],
        },
        {
          id: "risk-snowstorm-step-2",
          title: "风雪封路",
          description: "降雪与风吹雪使能见度骤降，路面积雪，车辆缓行或停驶。",
          sceneActions: [
            { kind: "set_weather", params: { snowstorm: true, fog: 0.7, wind: 0.8, trafficFlow: 0.05 } },
            { kind: "highlight_anchor", target: "anchor-tunnel" },
          ],
        },
        {
          id: "risk-snowstorm-step-3",
          title: "除雪恢复",
          description: "养护单位除雪作业后分段放行，车队按引导低速通过。",
          sceneActions: [{ kind: "set_weather", params: { snowstorm: false, cloudCover: 0.4, trafficFlow: 0.4 } }],
        },
      ],
      affectedAnchorIds: ["anchor-pass", "anchor-tunnel", "anchor-route-main"],
      warningSignals: [
        "垭口气温骤降至冰点以下",
        "能见度快速下降、路面发白",
        "交管部门发布管制通告",
      ],
      actions: [
        "关注通车公告，避免在降雪窗口翻越达坂",
        "随车备防滑链、保暖衣物与饮水",
        "被困时留在车内等待救援，保持通讯",
      ],
      impactTexts: {
        routeText: "暴雪时段达坂与隧道口会实施交通管制，请按通告调整行程",
        familyText: "家庭出行请避开早晚低温时段翻越达坂，备足车内保暖物资",
      },
      officialAdvisoryBinding: "新疆交管部门路况通告",
    },
  ],
  summaryRules: [
    {
      representativeActivityId: "act-self-drive",
      representativeReason: "自驾穿越是体验独库公路的核心方式，一条路串联峡谷、草甸、雪山与红层多种地貌与工程节点",
      bestTimeText: "通常 6–9 月通车期；9–10 月初秋草甸金黄但窗口收窄，以交管公告为准",
      bestExperienceText: "清晨从独山子出发穿峡谷，午后翻越哈希勒根达坂，傍晚在乔尔玛观景带回望盘山发夹弯",
      preparationItems: [
        "出发前确认通车与管制公告",
        "检查车况并备防滑链与保暖物资",
        "了解落石与暴雪的判断信号",
        "补给点间距长，在服务区补足燃油与饮水",
      ],
    },
  ],
  assets: {
    proceduralNodes: [
      "route_main",
      "bridge_node",
      "tunnel_node",
      "pass_summit",
      "viewpoint_a",
      "service_stop",
      "risk_rockfall_zone",
      "scenic_spur",
    ],
    estimatedBytes: 0,
  },
  fallback: {
    summary: "独库公路（约 561km）图文导览：自驾、观景、人群适配与安全须知。",
    sections: [
      {
        theme: "highlights",
        title: "景色",
        body: "一条路穿越四季地貌：北段独山子大峡谷灰褐色深切峡谷与陡壁，中段那拉提、巴音布鲁克绿色高山草甸，哈希勒根达坂雪山垭口残雪，南段库车红层红色砂岩；初秋草甸金黄，冬春封闭期可了解除雪养护。",
      },
      {
        theme: "experience",
        title: "怎么玩",
        body: "核心是自驾纵贯天山，分 1–2 天完成；达坂与观景带停车观景；桥隧节点适合工程观察；那拉提以南可接巴音布鲁克草原支线。",
      },
      {
        theme: "audience",
        title: "适合谁",
        body: "自驾老手可走全程；新手建议分段并避开夜间山路；家庭以草原支线与观景带为主；摄影爱好者推荐清晨傍晚的观景位。",
      },
      {
        theme: "cautions",
        title: "注意什么",
        body: "峡谷陡壁段警惕落石：见新鲜碎石或异响请快速通过不停留。达坂天气转换快，暴雪时段按管制通告调整行程，随车备防滑链与保暖物资。",
      },
      {
        theme: "engineering_operation",
        title: "工程解读",
        body: "路线以高架桥跨越深切峡谷、以隧道穿越达坂分水岭、以盘山展线与发夹弯克服高差，哈希勒根段防雪长廊抵御雪崩与风吹雪；冬春封闭期进行除雪与养护，是理解山区公路选线的样本。",
      },
    ],
  },
};
