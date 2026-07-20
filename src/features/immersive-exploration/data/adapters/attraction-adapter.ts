/**
 * Attraction → ExplorationEntity 适配器（CONTRACT DATA 节）
 *
 * 推断顺序：
 *   1. 策展覆盖表：attraction id / name 命中富士山、洞爷湖、马尔代夫珊瑚花园、
 *      马赛马拉、东京晴空塔、独库公路 → 直接产出对应黄金样例 entity（配置化 sceneDefinitionId）。
 *   2. 关键词推断：category_l1 / category_l2 / tags / name → sceneFamily / shape。
 *      sceneDefinitionId 为 `scene-<family>-generic`，fallbackContentId 为 `fallback-<id>`。
 *   3. 推断失败返回 null（调用方走标准图文降级页，施工方案 §4.1）。
 *
 * 六大家族均已启用（ENABLED_SCENE_FAMILIES）；time_event（花期 / 祭典 / 季节现象）尝试
 * hostEntityId 挂靠同区域母对象，且一律非沉浸（降级）。
 *
 * 备注：CONTRACT 中示例 import 路径 `../../../features/attraction-explorer/types`
 * 相对本文件实际多出一级，此处使用真实相对路径 `../../../attraction-explorer/types`。
 */

import type { Attraction } from "../../../attraction-explorer/types";
import type {
  ExplorationChannel,
  ExplorationEntity,
  ExplorationEntityShape,
  SceneFamily,
} from "../../domain/types";
import { ENABLED_SCENE_FAMILIES } from "../../domain/types";
import { GOLDEN_ENTITIES, getSceneDefinition } from "../scene-configs";

// ---------------------------------------------------------------- 策展覆盖表

/** 花期 / 祭典 / 季节现象词：命中则不走策展覆盖（避免把「富士山红叶季」当成富士山本体） */
const EVENT_WORDS = /(红叶|枫叶|樱花|花火|花期|祭典|祭|冰雪节|灯光节|冰瀑)/;

function isEventLike(a: Attraction): boolean {
  return EVENT_WORDS.test(`${a.name} ${a.category_l2} ${a.tags.join(" ")}`);
}

interface CuratedRule {
  entityId: keyof typeof GOLDEN_ENTITIES;
  test: (a: Attraction) => boolean;
}

const CURATED_RULES: readonly CuratedRule[] = [
  {
    entityId: "mount-fuji",
    test: (a) =>
      a.id === "mount-fuji" ||
      a.name === "富士山" ||
      /(mt\.?\s*fuji|mount\s*fuji|fujisan)/i.test(a.name_en) ||
      (a.name.includes("富士山") && !isEventLike(a)),
  },
  {
    entityId: "lake-toya",
    test: (a) =>
      a.id === "lake-toya" ||
      a.name === "洞爷湖" ||
      /(lake\s*toya|toyako)/i.test(a.name_en) ||
      (a.name.includes("洞爷湖") && !isEventLike(a)),
  },
  {
    entityId: "maldives-coral-garden",
    test: (a) =>
      a.id === "maldives-coral-garden" ||
      a.name.includes("珊瑚花园") ||
      /(coral\s*garden)/i.test(a.name_en) ||
      (a.country_code === "MDV" && /(珊瑚|coral)/i.test(`${a.name} ${a.name_en}`) && !isEventLike(a)),
  },
  {
    entityId: "masai-mara",
    test: (a) =>
      a.id === "ke-mara" ||
      a.id === "tz-serengeti" ||
      a.name.includes("马赛马拉") ||
      a.name.includes("塞伦盖蒂") ||
      /(masai\s*mara|serengeti)/i.test(a.name_en),
  },
  {
    entityId: "tokyo-skytree",
    test: (a) =>
      a.id === "jp-kt-tokyo-skytree" ||
      a.name.includes("晴空塔") ||
      /(tokyo\s*skytree)/i.test(a.name_en),
  },
  {
    entityId: "duku-highway",
    test: (a) =>
      a.id === "cn-xj-duku" ||
      a.name.includes("独库公路") ||
      /duku\s*highway/i.test(a.name_en),
  },
];

// ---------------------------------------------------------------- 关键词推断表

const FAMILY_KEYWORDS: ReadonlyArray<{ family: SceneFamily; pattern: RegExp }> = [
  { family: "underwater", pattern: /(潜水|浮潜|珊瑚|海底|潜点)/ },
  { family: "mountain", pattern: /(雪山|火山|登山|山岳|山峰|高山|峡谷|山|岳|峰)/ },
  { family: "waterside", pattern: /(湖泊|湖畔|湖|海岸|海滨|滨海|温泉|滨水|河岸|河畔|海滩|水库)/ },
  { family: "wilderness", pattern: /(荒野|草原|沙漠|戈壁|无人区|草甸)/ },
  { family: "human_city", pattern: /(城市|街区|博物馆|古街|古镇|古城|市集|建筑)/ },
  { family: "engineering_route", pattern: /(超级工程|工程|桥梁|大桥|铁路|隧道|大坝|运河)/ },
];

/** category_l1 兜底（仅在关键词无命中时使用；过泛的类别不兜底） */
const L1_FALLBACK: Partial<Record<Attraction["category_l1"], SceneFamily>> = {
  超级工程: "engineering_route",
  人文历史: "human_city",
};

function inferFamily(a: Attraction): SceneFamily | null {
  const haystack = `${a.category_l2} ${a.tags.join(" ")} ${a.name}`;
  for (const { family, pattern } of FAMILY_KEYWORDS) {
    if (pattern.test(haystack)) return family;
  }
  return L1_FALLBACK[a.category_l1] ?? null;
}

function inferShape(a: Attraction): ExplorationEntityShape {
  const haystack = `${a.name} ${a.category_l2} ${a.tags.join(" ")}`;
  // 花期 / 祭典 / 季节现象 → time_event（首期降级，见 isImmersiveEligible）
  if (isEventLike(a)) return "time_event";
  // 滑雪场 / 潜点等活动场所
  if (/(滑雪场|潜点|潜水点|大本营|营地|基地)/.test(haystack)) return "activity_site";
  // 线路类
  if (/(线路|路线|步道|古道|栈道|铁路|公路|巡游|环线|trail)/i.test(haystack)) return "route";
  // 大范围区域
  if (/(国家公园|保护区|风景区|旅游区|区域|地区|湖区|草原|沙漠|环礁|群岛|湿地)/.test(haystack)) return "area";
  // 默认：具体 POI
  return "point";
}

/** time_event 尝试挂靠同区域母对象（三件套宿主名可识别时） */
function inferHostEntityId(a: Attraction): string | undefined {
  const haystack = `${a.name} ${a.name_en} ${a.tags.join(" ")}`;
  if (haystack.includes("富士山") || /fuji/i.test(haystack)) return "mount-fuji";
  if (haystack.includes("洞爷湖") || /toya/i.test(haystack)) return "lake-toya";
  if (haystack.includes("马尔代夫") || haystack.includes("珊瑚花园")) return "maldives-coral-garden";
  return undefined;
}

const CHANNEL_KEYWORDS: ReadonlyArray<{ channel: ExplorationChannel; pattern: RegExp }> = [
  { channel: "engineering", pattern: /(工程|桥梁|大桥|铁路|隧道|大坝|运河)/ },
  { channel: "history", pattern: /(历史|博物馆|古迹|遗址|古城|古镇|文化|祭典)/ },
  { channel: "outdoor", pattern: /(登山|徒步|潜水|浮潜|滑雪|骑行|露营|攀岩|游船|独木舟|桨板|户外)/ },
  { channel: "wonder", pattern: /(火山|珊瑚|奇观|地质|冰川|间歇泉|钙化)/ },
  { channel: "leisure", pattern: /(温泉|休闲|度假|海滨|公园|花海|露营)/ },
  { channel: "nature", pattern: /(自然|山|湖|海|森林|草原|生态|湿地|沙漠|雪)/ },
];

const FAMILY_DEFAULT_CHANNELS: Record<SceneFamily, ExplorationChannel[]> = {
  mountain: ["nature", "outdoor"],
  waterside: ["nature", "leisure"],
  underwater: ["nature", "outdoor", "wonder"],
  wilderness: ["nature"],
  human_city: ["history"],
  engineering_route: ["engineering"],
};

function inferChannels(a: Attraction, family: SceneFamily): ExplorationChannel[] {
  const haystack = `${a.category_l1} ${a.category_l2} ${a.tags.join(" ")} ${a.name}`;
  const channels = new Set<ExplorationChannel>();
  for (const { channel, pattern } of CHANNEL_KEYWORDS) {
    if (pattern.test(haystack)) channels.add(channel);
  }
  if (channels.size === 0) {
    for (const c of FAMILY_DEFAULT_CHANNELS[family]) channels.add(c);
  }
  return [...channels];
}

const ACTIVITY_WORDS = [
  "登山",
  "徒步",
  "潜水",
  "浮潜",
  "滑雪",
  "摄影",
  "观景",
  "骑行",
  "游船",
  "独木舟",
  "桨板",
  "SUP",
  "露营",
  "攀岩",
  "观鸟",
  "漂流",
] as const;

function inferActivityTags(a: Attraction): string[] {
  const haystack = `${a.category_l2} ${a.tags.join(" ")}`;
  return ACTIVITY_WORDS.filter((w) => haystack.includes(w));
}

// ---------------------------------------------------------------- 公共 API

/**
 * Attraction → ExplorationEntity。
 * 推断失败（无家族关键词命中且 category_l1 无兜底）返回 null。
 */
export function toExplorationEntity(attraction: Attraction): ExplorationEntity | null {
  // 1. 策展覆盖表：命中三件套 → 直接产出对应 entity
  for (const rule of CURATED_RULES) {
    if (rule.test(attraction)) {
      return { ...GOLDEN_ENTITIES[rule.entityId] };
    }
  }

  // 2. 关键词推断
  const family = inferFamily(attraction);
  if (!family) return null;

  const shape = inferShape(attraction);
  const activityTags = inferActivityTags(attraction);
  const activityTagSet = new Set(activityTags);
  const attributeTags = attraction.tags.filter((t) => !activityTagSet.has(t));
  if (attraction.best_season) {
    attributeTags.push(`最佳季节：${attraction.best_season}`);
  }

  const entity: ExplorationEntity = {
    id: attraction.id,
    name: attraction.name,
    countryCode: attraction.country_code,
    shape,
    sceneFamily: family,
    channels: inferChannels(attraction, family),
    coordinates: { lat: attraction.lat_wgs84, lng: attraction.lng_wgs84 },
    activityTags,
    attributeTags,
    sceneDefinitionId: `scene-${family}-generic`,
    fallbackContentId: `fallback-${attraction.id}`,
  };

  // time_event：尝试挂靠同区域母对象（挂靠不上仍保留 time_event 输出，由上层降级）
  if (shape === "time_event") {
    const hostEntityId = inferHostEntityId(attraction);
    if (hostEntityId) entity.hostEntityId = hostEntityId;
  }

  return entity;
}

/**
 * 是否具备沉浸体验资格：
 * 已启用家族（六大家族，见 ENABLED_SCENE_FAMILIES）且非 time_event。
 * time_event 保留实体输出但返回 false（走标准图文降级）。
 */
export function isImmersiveEligible(attraction: Attraction): boolean {
  const entity = toExplorationEntity(attraction);
  if (!entity) return false;
  if (entity.shape === "time_event") return false;
  return ENABLED_SCENE_FAMILIES.includes(entity.sceneFamily);
}

/**
 * 是否拥有可进入的 3D 实景沉浸场景：
 * 判定与 resolveImmersiveTarget 等价 —— 适配出的 entity 命中黄金样例
 * 场景注册表（getSceneDefinition 非 null）。generic 家族推断、time_event
 * 一律返回 false。地图锚点 / 景点列表的「3D」徽标统一走此判定。
 */
export function hasImmersiveScene(attraction: Attraction): boolean {
  const entity = toExplorationEntity(attraction);
  if (!entity) return false;
  return getSceneDefinition(entity.sceneDefinitionId) !== null;
}
