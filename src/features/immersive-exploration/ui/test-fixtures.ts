/**
 * UI 测试夹具：手写最小 ImmersiveSceneDefinition（2 presets / 2 activities / 1 audience /
 * 1 risk（2 步）/ 4 anchors（比默认上限 3 多 1，验证截断））+ 锚点内容 + 实况快照。
 */

import type {
  AnchorContent,
  ExplorationEntity,
  ImmersiveSceneDefinition,
} from "../domain/types"
import type { DestinationLiveSnapshot } from "../../live-data/destination-live"

export function makeTestEntity(): ExplorationEntity {
  return {
    id: "test-entity",
    name: "测试山",
    countryCode: "JP",
    shape: "point",
    sceneFamily: "mountain",
    channels: ["nature", "outdoor"],
    coordinates: { lat: 35.36, lng: 138.73 },
    activityTags: ["hiking"],
    attributeTags: ["火山"],
    sceneDefinitionId: "scene-test-mountain",
    fallbackContentId: "fb-test-mountain",
  }
}

export const TEST_ANCHOR_CONTENTS: AnchorContent[] = [
  { id: "c1", title: "山顶（3,776m）", body: "主峰顶点，天气晴朗时可远眺测试湖。" },
  { id: "c2", title: "五合目", body: "登山口与补给点，亲子路线的终点。" },
  { id: "c3", title: "观景台", body: "眺望山脊线的最佳位置。" },
  { id: "c4", title: "碎石坡", body: "松动碎石区域，雨后需绕行。" },
]

export function makeTestScene(): ImmersiveSceneDefinition {
  const scene: ImmersiveSceneDefinition = {
    id: "scene-test-mountain",
    family: "mountain",
    entityName: "测试山",
    regionLabel: "日本 · 测试县",
    defaultCamera: { position: [0, 2, 10], lookAt: [0, 0, 0] },
    arrival: {
      subtitle: "火山 · 山地高原",
      headlineSight: "山顶雪冠",
      headlineActivity: "轻松徒步",
      observeMs: 600,
      transitionBeats: ["接近山体", "穿过云层", "抵达视点"],
    },
    themes: [
      { id: "highlights", label: "景色", defaultSelectionId: "p1" },
      { id: "experience", label: "怎么玩", defaultSelectionId: "act1" },
      { id: "audience", label: "适合谁", defaultSelectionId: "au1" },
      { id: "cautions", label: "注意什么", defaultSelectionId: "r1" },
      { id: "nature_geology", label: "自然观察" },
    ],
    anchors: [
      { id: "a1", label: "山顶", anchorType: "peak", positionRef: "node:peak", themes: ["highlights", "nature_geology"], contentId: "c1", priority: 1 },
      { id: "a2", label: "五合目", anchorType: "facility", positionRef: "node:station_5th", themes: ["experience"], contentId: "c2", priority: 2 },
      { id: "a3", label: "观景台", anchorType: "viewpoint", positionRef: "node:viewpoint_a", themes: ["highlights"], contentId: "c3", priority: 3 },
      { id: "a4", label: "碎石坡", anchorType: "risk_zone", positionRef: "node:risk_slope", themes: ["cautions"], contentId: "c4", priority: 4 },
    ],
    previewPresets: [
      {
        id: "p1",
        label: "秋季晴景",
        months: [10, 11],
        representative: true,
        mode: "typical_preview",
        sourceMeta: { mode: "typical_preview", sourceName: "策展资料" },
        visual: {},
        whereText: "山顶与北坡",
        whenText: "10 月下旬至 11 月中旬，晴天率高",
        whyText: "空气通透，山体轮廓清晰",
      },
      {
        id: "p2",
        label: "夏季云海",
        months: [7, 8],
        representative: false,
        mode: "typical_preview",
        sourceMeta: { mode: "typical_preview", sourceName: "策展资料" },
        visual: {},
        whereText: "五合目以上",
        whenText: "7–8 月清晨",
        whyText: "云海出现频率较高",
      },
    ],
    activities: [
      {
        id: "act1",
        label: "经典徒步",
        applicable: true,
        durationMinutes: 300,
        difficulty: "moderate",
        requirements: ["登山鞋"],
        facilities: ["登山道", "休息站"],
        limitations: ["雷雨时关闭"],
        description: "五合目至山顶往返的经典路线。",
        sceneActions: [],
      },
      {
        id: "act2",
        label: "亲子短线",
        applicable: true,
        durationMinutes: 60,
        difficulty: "easy",
        requirements: [],
        facilities: ["观景台"],
        limitations: [],
        description: "五合目周边缓坡短线。",
        sceneActions: [],
      },
    ],
    audiences: [
      {
        id: "school_age_family",
        label: "学龄儿童家庭",
        allowedActivityIds: ["act2"],
        warnings: ["山顶风大，注意防风保暖"],
      },
    ],
    risks: [
      {
        id: "r1",
        label: "午后雷暴",
        applicable: true,
        mode: "risk_simulation",
        cause: ["暖湿气流沿山体抬升"],
        sequence: [
          { id: "s1", title: "云团聚集", description: "午后对流云在山脊快速聚集。", sceneActions: [] },
          { id: "s2", title: "雷电发生", description: "山脊线出现雷电，需立即下撤。", sceneActions: [] },
        ],
        affectedAnchorIds: ["a1"],
        warningSignals: ["云层快速增厚", "远处雷声"],
        actions: ["立即下撤至五合目"],
        impactTexts: { routeText: "登顶路线临时关闭" },
      },
    ],
    summaryRules: [
      {
        representativeActivityId: "act1",
        representativeReason: "最具代表性的体验",
        bestTimeText: "秋季（10–11 月）",
        bestExperienceText: "经典徒步",
        preparationItems: ["保暖衣物", "登山鞋"],
      },
    ],
    assets: { proceduralNodes: ["peak", "station_5th", "viewpoint_a", "risk_slope"], estimatedBytes: 0 },
    fallback: {
      summary: "测试山是一座成层火山，适合观景与轻徒步。",
      sections: [
        { theme: "highlights", title: "看什么", body: "山顶雪冠与秋季红叶。" },
        { theme: "experience", title: "怎么体验", body: "经典徒步与亲子短线。" },
        { theme: "audience", title: "适合谁", body: "学龄儿童家庭可走短线。" },
        { theme: "cautions", title: "注意什么", body: "午后雷暴与山顶大风。" },
        { theme: "nature_geology", title: "自然观察", body: "火山地貌与高山植被。" },
      ],
    },
  }
  // DATA 场景配置以可选字段随场景导出 anchorsContent（冻结类型未含，UI 做容错读取）
  ;(scene as unknown as { anchorsContent: AnchorContent[] }).anchorsContent = TEST_ANCHOR_CONTENTS
  return scene
}

export function makeLiveSnapshot(): DestinationLiveSnapshot {
  return {
    destination: "测试山",
    syncedAt: "2026-07-17T07:00:00.000Z",
    layers: [
      {
        id: "weather",
        label: "天气",
        status: "fresh",
        sourceLabel: "测试气象源",
        updatedAt: "2026-07-17T07:00:00.000Z",
        message: "晴，山顶微风",
      },
    ],
  }
}
