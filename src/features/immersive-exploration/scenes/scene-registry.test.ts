/**
 * SCENES 测试（jsdom 无 WebGL）：
 * - 注册表命中 / 未启用家族返回 null
 * - 契约语义节点名握手（防止工厂内节点名打错）
 * - shared 纯函数：positionRef 解析、锚点节点名映射、visual 参数读取、pixelRatio 档位
 *
 * 注意：import 场景模块本身不会创建 WebGL 上下文（工厂内才 new WebGLRenderer），
 * 因此本文件可以安全 import scene-registry 与三个场景模块，但不得调用工厂函数。
 */
import { describe, expect, it } from "vitest"
import { getSceneFactory } from "./scene-registry"
import {
  anchorNodeName,
  clamp01,
  collectActivityNodeNames,
  collectAnchorNodeNames,
  collectNodeNamesFromRefs,
  easeInOutCubic,
  lerp,
  matchesAnyKeyword,
  nodeNamesFromRef,
  normalizeUnitInterval,
  parsePositionRef,
  pixelRatioForQuality,
  resolveActionTargetNodeNames,
  smoothstep,
  visualColor,
  visualFlag,
  visualNumber,
  visualText,
} from "./shared"
import { MOUNTAIN_NODE_NAMES } from "./mountain/MountainScene"
import { WATERSIDE_NODE_NAMES } from "./waterside/WatersideScene"
import { UNDERWATER_NODE_NAMES } from "./underwater/UnderwaterScene"
import type { ActivityDefinition, SceneAnchorDefinition } from "../domain/types"

// ---------------------------------------------------------------- 注册表

describe("getSceneFactory", () => {
  it("mountain / waterside / underwater 返回工厂函数", () => {
    expect(typeof getSceneFactory("mountain")).toBe("function")
    expect(typeof getSceneFactory("waterside")).toBe("function")
    expect(typeof getSceneFactory("underwater")).toBe("function")
  })

  it("三个家族返回各自不同的工厂", () => {
    const mountain = getSceneFactory("mountain")
    const waterside = getSceneFactory("waterside")
    const underwater = getSceneFactory("underwater")
    expect(mountain).not.toBe(waterside)
    expect(waterside).not.toBe(underwater)
    expect(mountain).not.toBe(underwater)
  })

  it("未启用家族 wilderness / human_city / engineering_route 返回 null", () => {
    expect(getSceneFactory("wilderness")).toBeNull()
    expect(getSceneFactory("human_city")).toBeNull()
    expect(getSceneFactory("engineering_route")).toBeNull()
  })
})

// ---------------------------------------------------------------- 契约节点名握手

describe("语义节点名握手（CONTRACT.md §SCENES）", () => {
  it("mountain 节点名与契约一致", () => {
    expect([...MOUNTAIN_NODE_NAMES].sort()).toEqual(
      ["peak", "crater", "trail_main", "trail_family", "viewpoint_a", "viewpoint_b", "station_5th", "snow_line", "vegetation_alpine", "risk_slope"].sort(),
    )
  })

  it("waterside 节点名与契约一致", () => {
    expect([...WATERSIDE_NODE_NAMES].sort()).toEqual(
      ["shore_walk", "pier", "boat_zone", "paddle_zone", "viewpoint_a", "viewpoint_b", "wetland", "lakeside_trail", "risk_open_water"].sort(),
    )
  })

  it("underwater 节点名与契约一致", () => {
    expect([...UNDERWATER_NODE_NAMES].sort()).toEqual(
      ["entry_point", "reef_flat", "coral_garden", "seagrass", "cave", "drop_off", "fish_school", "turtle_zone", "boat_channel", "risk_current"].sort(),
    )
  })
})

// ---------------------------------------------------------------- parsePositionRef

describe("parsePositionRef", () => {
  it("解析 node:<name>", () => {
    expect(parsePositionRef("node:peak")).toEqual({ kind: "node", name: "peak" })
    expect(parsePositionRef("node:trail_main")).toEqual({ kind: "node", name: "trail_main" })
    expect(parsePositionRef("  node:coral_garden  ")).toEqual({ kind: "node", name: "coral_garden" })
  })

  it("解析 xyz:<x>,<y>,<z>（含负数/小数/空格）", () => {
    expect(parsePositionRef("xyz:1,2.5,-3")).toEqual({ kind: "xyz", position: [1, 2.5, -3] })
    expect(parsePositionRef("xyz: 0 , -1.5 , 4.25")).toEqual({ kind: "xyz", position: [0, -1.5, 4.25] })
  })

  it("非法输入返回 null（不 throw）", () => {
    expect(parsePositionRef("")).toBeNull()
    expect(parsePositionRef("node:")).toBeNull()
    expect(parsePositionRef("xyz:1,2")).toBeNull()
    expect(parsePositionRef("xyz:1,2,3,4")).toBeNull()
    expect(parsePositionRef("xyz:a,b,c")).toBeNull()
    expect(parsePositionRef("peak")).toBeNull()
    expect(parsePositionRef("url:http://x")).toBeNull()
    // @ts-expect-error 运行期容错：非字符串
    expect(parsePositionRef(undefined)).toBeNull()
  })
})

// ---------------------------------------------------------------- 锚点节点名映射

describe("anchorNodeName / collectAnchorNodeNames", () => {
  const anchors = [
    { id: "a-peak", positionRef: "node:peak" },
    { id: "a-trail", positionRef: "node:trail_main" },
    { id: "a-custom", positionRef: "xyz:1,2,3" },
  ] as SceneAnchorDefinition[]

  it("node 锚点返回节点名，xyz 锚点返回 null", () => {
    expect(anchorNodeName(anchors[0])).toBe("peak")
    expect(anchorNodeName(anchors[2])).toBeNull()
  })

  it("collectAnchorNodeNames 把锚点 id 集合翻译成节点名集合", () => {
    expect([...collectAnchorNodeNames(anchors, ["a-peak", "a-trail"])].sort()).toEqual(["peak", "trail_main"])
    // xyz 锚点被跳过；未知 id 被跳过
    expect([...collectAnchorNodeNames(anchors, ["a-custom", "missing"])]).toEqual([])
    expect(collectAnchorNodeNames(anchors, []).size).toBe(0)
  })
})

// ---------------------------------------------------------------- nodeNamesFromRef

describe("nodeNamesFromRef / collectNodeNamesFromRefs", () => {
  it("兼容 positionRef 与裸节点名", () => {
    expect(nodeNamesFromRef("node:trail_main")).toEqual(["trail_main"])
    expect(nodeNamesFromRef("trail_family")).toEqual(["trail_family"])
    expect(nodeNamesFromRef("xyz:1,2,3")).toEqual([]) // xyz 无节点
    expect(nodeNamesFromRef("")).toEqual([])
    expect(nodeNamesFromRef(undefined)).toEqual([])
    expect(nodeNamesFromRef("登顶主峰（约 6 小时）")).toEqual([]) // 含非节点字符的自由文本
  })

  it("collectNodeNamesFromRefs 汇总去重", () => {
    expect([...collectNodeNamesFromRefs(["node:boat_zone", "paddle_zone", undefined, "node:boat_zone"])].sort()).toEqual(
      ["boat_zone", "paddle_zone"],
    )
  })
})

// ---------------------------------------------------------------- SceneAction target / activity 节点收集

describe("resolveActionTargetNodeNames / collectActivityNodeNames", () => {
  const anchors = [
    { id: "anchor-peak", positionRef: "node:peak" },
    { id: "anchor-risk-slope", positionRef: "node:risk_slope" },
    { id: "anchor-fish-school", positionRef: "node:fish_school" },
  ] as SceneAnchorDefinition[]

  it("anchor id → 节点名；node: / 裸名直通；未知 target → 空", () => {
    expect(resolveActionTargetNodeNames("anchor-peak", anchors)).toEqual(["peak"])
    expect(resolveActionTargetNodeNames("anchor-risk-slope", anchors)).toEqual(["risk_slope"])
    expect(resolveActionTargetNodeNames("node:trail_main", anchors)).toEqual(["trail_main"])
    expect(resolveActionTargetNodeNames("paddle_zone", anchors)).toEqual(["paddle_zone"])
    expect(resolveActionTargetNodeNames("anchor-unknown", anchors)).toEqual([])
    expect(resolveActionTargetNodeNames(undefined, anchors)).toEqual([])
  })

  it("collectActivityNodeNames：routeRef / zoneRefs / sceneActions 三路汇总", () => {
    const activity = {
      routeRef: "node:trail_main",
      zoneRefs: ["viewpoint_a"],
      sceneActions: [
        { kind: "show_route", target: "node:trail_family" },
        { kind: "highlight_anchor", target: "anchor-peak" },
        { kind: "set_water", params: { zone: "boat_zone" } },
      ],
    } as ActivityDefinition
    expect([...collectActivityNodeNames(activity, anchors)].sort()).toEqual(
      ["boat_zone", "peak", "trail_family", "trail_main", "viewpoint_a"].sort(),
    )
  })

  it("collectActivityNodeNames：空 activity 输入返回空集", () => {
    expect(collectActivityNodeNames({ sceneActions: [] } as unknown as ActivityDefinition, anchors).size).toBe(0)
  })
})

// ---------------------------------------------------------------- 双模量纲归一

describe("normalizeUnitInterval（0..1 比例 / 绝对量纲双模）", () => {
  it("≤1 视为比例直取", () => {
    expect(normalizeUnitInterval(0.7, 3800)).toBe(0.7)
    expect(normalizeUnitInterval(0, 25)).toBe(0)
    expect(normalizeUnitInterval(1, 25)).toBe(1)
  })

  it(">1 按 [min, max] 线性映射（雪线海拔 / 能见度米数）", () => {
    expect(normalizeUnitInterval(1900, 3800)).toBeCloseTo(0.5)
    expect(normalizeUnitInterval(1200, 3800)).toBeCloseTo(1200 / 3800)
    expect(normalizeUnitInterval(25, 25, 3)).toBe(1)
    expect(normalizeUnitInterval(14, 25, 3)).toBeCloseTo(0.5)
    expect(normalizeUnitInterval(99999, 3800)).toBe(1) // 超界截断
    expect(normalizeUnitInterval(Number.NaN, 3800)).toBe(0)
  })
})

// ---------------------------------------------------------------- visual 参数读取

describe("preset.visual 参数读取", () => {
  const visual = {
    snowLine: 0.7,
    mist: "0.4",
    evening: true,
    duskFlag: "true",
    light: "黄昏",
    leafColor: "#c2402a",
    rockColor: 0x6a6058,
    bad: "abc",
  }

  it("visualNumber：number 直取，string/boolean 兼容，缺省回退", () => {
    expect(visualNumber(visual, "snowLine", 0.5)).toBe(0.7)
    expect(visualNumber(visual, "mist", 0.5)).toBe(0.4)
    expect(visualNumber(visual, "evening", 0)).toBe(1)
    expect(visualNumber(visual, "missing", 0.33)).toBe(0.33)
    expect(visualNumber(visual, "bad", 0.5)).toBe(0.5)
    expect(visualNumber(undefined, "snowLine", 0.5)).toBe(0.5)
  })

  it("visualFlag：boolean/number/string 兼容", () => {
    expect(visualFlag(visual, "evening")).toBe(true)
    expect(visualFlag(visual, "duskFlag")).toBe(true)
    expect(visualFlag(visual, "snowLine")).toBe(true) // 0.7 ≠ 0
    expect(visualFlag(visual, "missing")).toBe(false)
    expect(visualFlag(visual, "missing", true)).toBe(true)
  })

  it("visualText：仅字符串，空串回退 null", () => {
    expect(visualText(visual, "light")).toBe("黄昏")
    expect(visualText(visual, "snowLine")).toBeNull()
    expect(visualText(undefined, "light")).toBeNull()
  })

  it("visualColor：hex 字符串与数字", () => {
    expect(visualColor(visual, "leafColor")?.getHexString()).toBe("c2402a")
    expect(visualColor(visual, "rockColor")?.getHexString()).toBe("6a6058")
    expect(visualColor(visual, "missing")).toBeNull()
  })
})

// ---------------------------------------------------------------- 数值工具

describe("数值工具", () => {
  it("clamp01 / lerp / smoothstep / easeInOutCubic", () => {
    expect(clamp01(1.5)).toBe(1)
    expect(clamp01(-0.2)).toBe(0)
    expect(lerp(0, 10, 0.3)).toBeCloseTo(3)
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5)
    expect(smoothstep(0, 1, 2)).toBe(1)
    expect(easeInOutCubic(0)).toBe(0)
    expect(easeInOutCubic(1)).toBe(1)
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5)
  })

  it("matchesAnyKeyword：大小写不敏感 + 中文", () => {
    expect(matchesAnyKeyword("Summit Hike 登顶", ["summit"])).toBe(true)
    expect(matchesAnyKeyword("雷暴注意", ["雷", "storm"])).toBe(true)
    expect(matchesAnyKeyword("湖边散步", ["boat"])).toBe(false)
  })
})

// ---------------------------------------------------------------- pixelRatio 档位

describe("pixelRatioForQuality", () => {
  it("low=1 / standard≤1.35 / high≤2", () => {
    expect(pixelRatioForQuality("low", 3)).toBe(1)
    expect(pixelRatioForQuality("standard", 3)).toBe(1.35)
    expect(pixelRatioForQuality("high", 3)).toBe(2)
    // 低 dpr 设备不受上限影响
    expect(pixelRatioForQuality("standard", 1)).toBe(1)
    expect(pixelRatioForQuality("high", 1.2)).toBeCloseTo(1.2)
  })
})
