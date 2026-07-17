/**
 * resolve-immersive-target 测试：
 * 六件套命中可沉浸（返回 { entity, scene }），其余一律 null（标准图文降级）。
 */

import { describe, expect, it } from "vitest";
import type { Attraction } from "../../attraction-explorer/types";
import { resolveImmersiveTarget } from "./resolve-immersive-target";

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

describe("resolveImmersiveTarget · 三件套命中", () => {
  it("富士山 → { entity: mount-fuji, scene: scene-mount-fuji }", () => {
    const target = resolveImmersiveTarget(
      makeAttraction({ id: "mount-fuji", name: "富士山", category_l2: "火山", tags: ["登山"] }),
    );
    expect(target).not.toBeNull();
    expect(target!.entity.id).toBe("mount-fuji");
    expect(target!.scene.id).toBe("scene-mount-fuji");
    expect(target!.scene.family).toBe("mountain");
  });

  it("洞爷湖 → scene-lake-toya", () => {
    const target = resolveImmersiveTarget(
      makeAttraction({ id: "x1", name: "洞爷湖", name_en: "Lake Toya", category_l2: "湖泊", tags: ["温泉"] }),
    );
    expect(target).not.toBeNull();
    expect(target!.scene.id).toBe("scene-lake-toya");
    expect(target!.scene.family).toBe("waterside");
  });

  it("马尔代夫珊瑚花园 → scene-maldives-coral-garden", () => {
    const target = resolveImmersiveTarget(
      makeAttraction({
        id: "mv-1",
        country_code: "MV",
        name: "马尔代夫珊瑚花园",
        category_l2: "潜水",
        tags: ["浮潜", "珊瑚"],
      }),
    );
    expect(target).not.toBeNull();
    expect(target!.scene.id).toBe("scene-maldives-coral-garden");
    expect(target!.scene.family).toBe("underwater");
  });
});

describe("resolveImmersiveTarget · V2 新增三件套命中", () => {
  it("马赛马拉（ke-mara）→ scene-masai-mara", () => {
    const target = resolveImmersiveTarget(
      makeAttraction({
        id: "ke-mara",
        country_code: "KEN",
        name: "马赛马拉国家保护区",
        name_en: "Masai Mara",
        category_l2: "野生动物",
        tags: ["大迁徙", "摄影", "草原"],
      }),
    );
    expect(target).not.toBeNull();
    expect(target!.entity.id).toBe("masai-mara");
    expect(target!.scene.id).toBe("scene-masai-mara");
    expect(target!.scene.family).toBe("wilderness");
  });

  it("塞伦盖蒂（tz-serengeti）→ scene-masai-mara", () => {
    const target = resolveImmersiveTarget(
      makeAttraction({
        id: "tz-serengeti",
        country_code: "TZA",
        name: "塞伦盖蒂国家公园",
        name_en: "Serengeti National Park",
        category_l2: "野生动物",
        tags: ["迁徙", "摄影"],
      }),
    );
    expect(target).not.toBeNull();
    expect(target!.scene.id).toBe("scene-masai-mara");
    expect(target!.scene.family).toBe("wilderness");
  });

  it("东京晴空塔 → scene-tokyo-skytree", () => {
    const target = resolveImmersiveTarget(
      makeAttraction({
        id: "jp-kt-tokyo-skytree",
        country_code: "JPN",
        name: "东京晴空塔",
        name_en: "Tokyo Skytree",
        category_l1: "人文历史",
        category_l2: "地标",
        tags: ["夜景", "观景"],
      }),
    );
    expect(target).not.toBeNull();
    expect(target!.entity.id).toBe("tokyo-skytree");
    expect(target!.scene.id).toBe("scene-tokyo-skytree");
    expect(target!.scene.family).toBe("human_city");
  });

  it("独库公路 → scene-duku-highway", () => {
    const target = resolveImmersiveTarget(
      makeAttraction({
        id: "cn-xj-duku",
        country_code: "CHN",
        name: "独库公路",
        name_en: "Duku Highway",
        category_l1: "户外极限",
        category_l2: "自驾",
        tags: ["史诗公路", "峡谷"],
      }),
    );
    expect(target).not.toBeNull();
    expect(target!.entity.id).toBe("duku-highway");
    expect(target!.scene.id).toBe("scene-duku-highway");
    expect(target!.scene.family).toBe("engineering_route");
  });
});

describe("resolveImmersiveTarget · 降级为 null", () => {
  it("通用山地（generic 场景无配置）→ null", () => {
    const target = resolveImmersiveTarget(
      makeAttraction({ id: "yulong", name: "玉龙雪山", category_l2: "雪山", tags: ["登山"] }),
    );
    expect(target).toBeNull();
  });

  it("城市博物馆（generic 场景无配置）→ null", () => {
    const target = resolveImmersiveTarget(
      makeAttraction({
        id: "museum",
        name: "市立博物馆",
        category_l1: "人文历史",
        category_l2: "博物馆",
        tags: ["城市", "历史"],
      }),
    );
    expect(target).toBeNull();
  });

  it("time_event（富士山红叶季）→ null", () => {
    const target = resolveImmersiveTarget(
      makeAttraction({ id: "fuji-momiji", name: "富士山红叶季", category_l2: "红叶", tags: ["红叶"] }),
    );
    expect(target).toBeNull();
  });

  it("推断失败（网红打卡墙）→ null", () => {
    const target = resolveImmersiveTarget(
      makeAttraction({
        id: "viral-wall",
        name: "网红打卡墙",
        category_l1: "网红奇观",
        category_l2: "打卡点",
        tags: ["拍照"],
      }),
    );
    expect(target).toBeNull();
  });
});
