/**
 * attraction-adapter 测试：
 * 策展覆盖（六件套）、关键词推断、time_event 挂靠与降级、推断失败 null。
 */

import { describe, expect, it } from "vitest";
import type { Attraction } from "../../../attraction-explorer/types";
import { hasImmersiveScene, isImmersiveEligible, toExplorationEntity } from "./attraction-adapter";

function makeAttraction(overrides: Partial<Attraction>): Attraction {
  return {
    id: "test-1",
    country_code: "JP",
    region_id: "region-1",
    name: "测试景点",
    name_en: "Test Spot",
    lat_wgs84: 35.0,
    lng_wgs84: 139.0,
    category_l1: "自然风光",
    category_l2: "山地",
    popularity_score: 80,
    niche_score: 20,
    tags: [],
    best_season: "全年",
    address: "",
    rating: null,
    review_count: null,
    price: "",
    opening_hours: "",
    data_source: "test",
    source_url: "",
    image_url: "",
    score_basis: "",
    last_updated: "2025-01-01",
    ...overrides,
  };
}

describe("toExplorationEntity · 策展覆盖（三件套）", () => {
  it("富士山（id 命中）→ 配置化 entity", () => {
    const entity = toExplorationEntity(
      makeAttraction({ id: "mount-fuji", name: "富士山", category_l2: "火山", tags: ["登山"] }),
    );
    expect(entity).not.toBeNull();
    expect(entity!.id).toBe("mount-fuji");
    expect(entity!.sceneFamily).toBe("mountain");
    expect(entity!.shape).toBe("point");
    expect(entity!.sceneDefinitionId).toBe("scene-mount-fuji");
    expect(entity!.fallbackContentId).toBe("fallback-mount-fuji");
    expect(entity!.coordinates).toEqual({ lat: 35.3606, lng: 138.7274 });
  });

  it("洞爷湖（name 命中）→ 配置化 entity", () => {
    const entity = toExplorationEntity(
      makeAttraction({
        id: "jp-toya-001",
        name: "洞爷湖",
        name_en: "Lake Toya",
        category_l2: "湖泊",
        tags: ["温泉", "游船"],
      }),
    );
    expect(entity).not.toBeNull();
    expect(entity!.id).toBe("lake-toya");
    expect(entity!.sceneFamily).toBe("waterside");
    expect(entity!.shape).toBe("area");
    expect(entity!.sceneDefinitionId).toBe("scene-lake-toya");
  });

  it("马尔代夫珊瑚花园（国家 + 珊瑚关键词命中）→ 配置化 entity", () => {
    const entity = toExplorationEntity(
      makeAttraction({
        id: "mv-dive-001",
        country_code: "MV",
        name: "马尔代夫珊瑚花园潜点",
        name_en: "Maldives Coral Garden",
        category_l2: "潜水",
        tags: ["浮潜", "珊瑚"],
      }),
    );
    expect(entity).not.toBeNull();
    expect(entity!.id).toBe("maldives-coral-garden");
    expect(entity!.sceneFamily).toBe("underwater");
    expect(entity!.shape).toBe("activity_site");
    expect(entity!.sceneDefinitionId).toBe("scene-maldives-coral-garden");
  });
});

describe("toExplorationEntity · 策展覆盖（V2 新增三件套）", () => {
  it("马赛马拉（官方 id ke-mara 命中）→ 配置化 entity", () => {
    const entity = toExplorationEntity(
      makeAttraction({
        id: "ke-mara",
        country_code: "KEN",
        name: "马赛马拉国家保护区",
        name_en: "Masai Mara",
        category_l2: "野生动物",
        tags: ["大迁徙", "摄影", "草原"],
      }),
    );
    expect(entity).not.toBeNull();
    expect(entity!.id).toBe("masai-mara");
    expect(entity!.sceneFamily).toBe("wilderness");
    expect(entity!.shape).toBe("area");
    expect(entity!.sceneDefinitionId).toBe("scene-masai-mara");
    expect(entity!.fallbackContentId).toBe("fallback-masai-mara");
    expect(entity!.coordinates).toEqual({ lat: -1.4061, lng: 35.0117 });
  });

  it("塞伦盖蒂（官方 id tz-serengeti 命中）→ 同一 wilderness 配置化 entity", () => {
    const entity = toExplorationEntity(
      makeAttraction({
        id: "tz-serengeti",
        country_code: "TZA",
        name: "塞伦盖蒂国家公园",
        name_en: "Serengeti National Park",
        category_l2: "野生动物",
        tags: ["迁徙", "摄影"],
      }),
    );
    expect(entity).not.toBeNull();
    expect(entity!.id).toBe("masai-mara");
    expect(entity!.sceneDefinitionId).toBe("scene-masai-mara");
  });

  it("东京晴空塔（官方 id 命中）→ 配置化 entity", () => {
    const entity = toExplorationEntity(
      makeAttraction({
        id: "jp-kt-tokyo-skytree",
        country_code: "JPN",
        name: "东京晴空塔",
        name_en: "Tokyo Skytree",
        category_l1: "人文历史",
        category_l2: "地标",
        tags: ["夜景", "观景", "亲子", "城市"],
      }),
    );
    expect(entity).not.toBeNull();
    expect(entity!.id).toBe("tokyo-skytree");
    expect(entity!.sceneFamily).toBe("human_city");
    expect(entity!.shape).toBe("point");
    expect(entity!.sceneDefinitionId).toBe("scene-tokyo-skytree");
    expect(entity!.coordinates).toEqual({ lat: 35.7101, lng: 139.8107 });
  });

  it("独库公路（官方 id cn-xj-duku 命中）→ 配置化 entity", () => {
    const entity = toExplorationEntity(
      makeAttraction({
        id: "cn-xj-duku",
        country_code: "CHN",
        name: "独库公路",
        name_en: "Duku Highway",
        category_l1: "户外极限",
        category_l2: "自驾",
        tags: ["史诗公路", "峡谷", "季节性"],
      }),
    );
    expect(entity).not.toBeNull();
    expect(entity!.id).toBe("duku-highway");
    expect(entity!.sceneFamily).toBe("engineering_route");
    expect(entity!.shape).toBe("route");
    expect(entity!.sceneDefinitionId).toBe("scene-duku-highway");
    expect(entity!.coordinates).toEqual({ lat: 43.0, lng: 84.5 });
  });

  it("名称命中（无官方 id）→ 同样进入策展覆盖", () => {
    const skytree = toExplorationEntity(
      makeAttraction({ id: "poi-xyz", name: "晴空塔夜景", name_en: "Tokyo Skytree Night", category_l2: "地标", tags: ["夜景"] }),
    );
    expect(skytree!.sceneDefinitionId).toBe("scene-tokyo-skytree");
    const mara = toExplorationEntity(
      makeAttraction({ id: "poi-abc", name: "Masai Mara Reserve", name_en: "Masai Mara Reserve", category_l2: "野生动物", tags: [] }),
    );
    expect(mara!.sceneDefinitionId).toBe("scene-masai-mara");
  });
});

describe("toExplorationEntity · 关键词推断", () => {
  it("通用山地（玉龙雪山）→ mountain + generic 场景 id", () => {
    const a = makeAttraction({
      id: "yulong-snow-mountain",
      country_code: "CN",
      name: "玉龙雪山",
      name_en: "Yulong Snow Mountain",
      category_l2: "雪山",
      tags: ["登山", "雪景"],
    });
    const entity = toExplorationEntity(a);
    expect(entity).not.toBeNull();
    expect(entity!.id).toBe("yulong-snow-mountain");
    expect(entity!.sceneFamily).toBe("mountain");
    expect(entity!.shape).toBe("point");
    expect(entity!.sceneDefinitionId).toBe("scene-mountain-generic");
    expect(entity!.fallbackContentId).toBe("fallback-yulong-snow-mountain");
    expect(entity!.coordinates).toEqual({ lat: 35.0, lng: 139.0 });
    expect(entity!.activityTags).toContain("登山");
    expect(isImmersiveEligible(a)).toBe(true);
  });

  it("潜点 → underwater + activity_site", () => {
    const a = makeAttraction({
      id: "aonomori-dive",
      name: "青之洞窟潜点",
      name_en: "Blue Cave",
      category_l2: "潜水",
      tags: ["浮潜", "珊瑚"],
    });
    const entity = toExplorationEntity(a);
    expect(entity).not.toBeNull();
    expect(entity!.sceneFamily).toBe("underwater");
    expect(entity!.shape).toBe("activity_site");
    expect(entity!.sceneDefinitionId).toBe("scene-underwater-generic");
    expect(isImmersiveEligible(a)).toBe(true);
  });

  it("环湖步道 → waterside + route", () => {
    const a = makeAttraction({
      id: "lake-trail",
      name: "某环湖步道",
      category_l2: "步道",
      tags: ["骑行", "徒步"],
    });
    const entity = toExplorationEntity(a);
    expect(entity).not.toBeNull();
    expect(entity!.sceneFamily).toBe("waterside");
    expect(entity!.shape).toBe("route");
  });

  it("城市博物馆 → human_city 且可沉浸（家族已启用）", () => {
    const a = makeAttraction({
      id: "city-museum",
      name: "市立博物馆",
      category_l1: "人文历史",
      category_l2: "博物馆",
      tags: ["城市", "历史"],
    });
    const entity = toExplorationEntity(a);
    expect(entity).not.toBeNull();
    expect(entity!.sceneFamily).toBe("human_city");
    expect(entity!.sceneDefinitionId).toBe("scene-human_city-generic");
    expect(isImmersiveEligible(a)).toBe(true);
  });

  it("草原 → wilderness（area）且可沉浸（家族已启用）", () => {
    const a = makeAttraction({
      id: "hulunbuir",
      name: "呼伦贝尔草原",
      category_l2: "草原",
      tags: ["草原", "荒野"],
    });
    const entity = toExplorationEntity(a);
    expect(entity).not.toBeNull();
    expect(entity!.sceneFamily).toBe("wilderness");
    expect(entity!.shape).toBe("area");
    expect(isImmersiveEligible(a)).toBe(true);
  });

  it("超级工程（桥梁）→ engineering_route 且可沉浸（家族已启用）", () => {
    const a = makeAttraction({
      id: "sea-bridge",
      name: "某跨海大桥",
      category_l1: "超级工程",
      category_l2: "桥梁",
      tags: ["工程", "桥梁"],
    });
    const entity = toExplorationEntity(a);
    expect(entity).not.toBeNull();
    expect(entity!.sceneFamily).toBe("engineering_route");
    expect(isImmersiveEligible(a)).toBe(true);
  });

  it("无任何关键词命中 → null（走标准图文降级）", () => {
    const a = makeAttraction({
      id: "viral-wall",
      name: "网红打卡墙",
      category_l1: "网红奇观",
      category_l2: "打卡点",
      tags: ["拍照"],
    });
    expect(toExplorationEntity(a)).toBeNull();
    expect(isImmersiveEligible(a)).toBe(false);
  });
});

describe("toExplorationEntity · time_event 挂靠与降级", () => {
  it("富士山红叶季 → time_event + hostEntityId=mount-fuji，不可沉浸", () => {
    const a = makeAttraction({
      id: "fuji-momiji-season",
      name: "富士山红叶季",
      category_l2: "红叶",
      tags: ["红叶", "摄影"],
    });
    const entity = toExplorationEntity(a);
    expect(entity).not.toBeNull();
    expect(entity!.shape).toBe("time_event");
    expect(entity!.sceneFamily).toBe("mountain");
    expect(entity!.hostEntityId).toBe("mount-fuji");
    expect(entity!.id).toBe("fuji-momiji-season");
    expect(isImmersiveEligible(a)).toBe(false);
  });

  it("无宿主可识别的祭典 → time_event + hostEntityId 缺省，不可沉浸", () => {
    const a = makeAttraction({
      id: "nebuta-festival",
      name: "睡魔祭",
      category_l1: "人文历史",
      category_l2: "祭典",
      tags: ["祭典"],
    });
    const entity = toExplorationEntity(a);
    expect(entity).not.toBeNull();
    expect(entity!.shape).toBe("time_event");
    expect(entity!.hostEntityId).toBeUndefined();
    expect(isImmersiveEligible(a)).toBe(false);
  });
});

describe("hasImmersiveScene · 「3D」徽标判定（与 resolveImmersiveTarget 等价）", () => {
  it("黄金样例 POI（富士山 / 晴空塔 / 独库公路）→ true", () => {
    expect(hasImmersiveScene(makeAttraction({ id: "mount-fuji", name: "富士山", category_l2: "火山", tags: ["登山"] }))).toBe(true);
    expect(hasImmersiveScene(makeAttraction({ id: "jp-kt-tokyo-skytree", name: "东京晴空塔", category_l1: "人文历史", category_l2: "地标", tags: ["夜景"] }))).toBe(true);
    expect(hasImmersiveScene(makeAttraction({ id: "cn-xj-duku", name: "独库公路", category_l1: "户外极限", category_l2: "自驾", tags: ["峡谷"] }))).toBe(true);
  });

  it("generic 家族推断（玉龙雪山 → scene-mountain-generic）→ false", () => {
    const a = makeAttraction({ id: "yulong-snow-mountain", name: "玉龙雪山", category_l2: "雪山", tags: ["登山"] });
    expect(isImmersiveEligible(a)).toBe(true); // 家族可沉浸，但无 3D 实景场景
    expect(hasImmersiveScene(a)).toBe(false);
  });

  it("time_event（富士山红叶季）→ false；推断失败 → false", () => {
    expect(hasImmersiveScene(makeAttraction({ id: "fuji-momiji-season", name: "富士山红叶季", category_l2: "红叶", tags: ["红叶"] }))).toBe(false);
    expect(hasImmersiveScene(makeAttraction({ id: "viral-wall", name: "网红打卡墙", category_l1: "网红奇观", category_l2: "打卡点", tags: ["拍照"] }))).toBe(false);
  });
});
