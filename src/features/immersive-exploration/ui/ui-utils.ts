/**
 * 沉浸式探索 UI 层共享工具（施工方案 V1.1 §4.2 / §6 / §10）
 * 仅包含纯函数与常量：主题/类型文案、时间与月份格式化、实况标识提取、锚点内容容错解析。
 */

import type {
  AnchorContent,
  ActivityDefinition,
  AudienceDefinition,
  ImmersiveSceneDefinition,
  ImmersiveTheme,
  SceneFamily,
  ExplorationEntityShape,
  SceneAnchorDefinition,
} from "../domain/types"
import type { DestinationLiveSnapshot } from "../../live-data/destination-live"
import { GOLDEN_ANCHOR_CONTENTS } from "../data/scene-configs"

/** 主题中文标签（CONTRACT 冻结口径；scene.themes[].label 优先） */
export const THEME_LABELS: Record<ImmersiveTheme, string> = {
  highlights: "景色",
  experience: "怎么玩",
  audience: "适合谁",
  cautions: "注意什么",
  nature_geology: "自然观察",
  water_ecology: "水域生态",
  underwater_ecology: "水下生态",
  story_past: "往昔故事",
  engineering_operation: "工程运作",
}

export const FAMILY_LABELS: Record<SceneFamily, string> = {
  mountain: "山地",
  waterside: "水域",
  underwater: "水下",
  wilderness: "荒野",
  human_city: "人文城市",
  engineering_route: "工程路线",
}

export const SHAPE_LABELS: Record<ExplorationEntityShape, string> = {
  point: "地点",
  area: "区域",
  route: "路线",
  activity_site: "活动场所",
  time_event: "时令事件",
}

export const DIFFICULTY_LABELS: Record<NonNullable<ActivityDefinition["difficulty"]>, string> = {
  easy: "轻松",
  moderate: "中等",
  hard: "较难",
  expert: "专家",
}

export function themeLabel(scene: ImmersiveSceneDefinition | null, theme: ImmersiveTheme): string {
  const fromScene = scene?.themes.find((t) => t.id === theme)?.label
  return fromScene || THEME_LABELS[theme] || theme
}

/** 月份列表 → 「10 月 · 11 月」；空数组 = 全年 */
export function formatMonths(months: readonly number[]): string {
  if (!months || months.length === 0) return "全年"
  return [...months].sort((a, b) => a - b).map((m) => `${m} 月`).join(" · ")
}

/** 分钟 → 「约 45 分钟」/「约 2.5 小时」 */
export function formatDuration(minutes?: number): string | null {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return null
  if (minutes < 60) return `约 ${minutes} 分钟`
  const hours = minutes / 60
  return `约 ${Number.isInteger(hours) ? hours : hours.toFixed(1)} 小时`
}

/** 「当前实况」标识信息：仅当快照中存在 fresh 状态的数据层时返回（§10.2：必须有来源和更新时间） */
export interface LiveBadgeInfo {
  sourceName: string
  updatedAt: string | null
}

export function getLiveBadgeInfo(snapshot?: DestinationLiveSnapshot | null): LiveBadgeInfo | null {
  if (!snapshot || !Array.isArray(snapshot.layers)) return null
  const fresh = snapshot.layers.filter((layer) => layer.status === "fresh")
  if (fresh.length === 0) return null
  const layer = fresh.find((l) => l.id === "weather") ?? fresh[0]
  if (!layer.sourceLabel) return null
  return { sourceName: layer.sourceLabel, updatedAt: layer.updatedAt ?? snapshot.syncedAt ?? null }
}

/** ISO 时间 → 本地化短格式；解析失败返回 null（不伪造时间） */
export function formatLocalTime(iso?: string | null): string | null {
  if (!iso) return null
  const value = Date.parse(iso)
  if (!Number.isFinite(value)) return null
  try {
    return new Date(value).toLocaleString("zh-CN", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return new Date(value).toLocaleString()
  }
}

/**
 * 锚点说明内容容错读取（分层）：
 * 1. 场景对象上可选附带的 `anchorsContent`（冻结类型未含此字段，做可选读取）；
 * 2. DATA 黄金样例注册表 GOLDEN_ANCHOR_CONTENTS[scene.id]；
 * 3. 空表（UI 显示占位文案，不编造内容）。
 */
export function resolveAnchorsContent(scene: ImmersiveSceneDefinition): AnchorContent[] {
  const withContent = scene as ImmersiveSceneDefinition & { anchorsContent?: unknown }
  if (Array.isArray(withContent.anchorsContent)) {
    return withContent.anchorsContent as AnchorContent[]
  }
  const golden = GOLDEN_ANCHOR_CONTENTS[scene.id]
  return golden ? [...golden] : []
}

export function findAnchorContent(scene: ImmersiveSceneDefinition, contentId: string): AnchorContent | null {
  return resolveAnchorsContent(scene).find((c) => c.id === contentId) ?? null
}

export function findActivity(scene: ImmersiveSceneDefinition, id: string | null | undefined): ActivityDefinition | null {
  return id ? scene.activities.find((a) => a.id === id) ?? null : null
}

export function findAudience(scene: ImmersiveSceneDefinition, id: string | null | undefined): AudienceDefinition | null {
  return id ? scene.audiences.find((a) => a.id === id) ?? null : null
}

export function findAnchor(scene: ImmersiveSceneDefinition, id: string | null | undefined): SceneAnchorDefinition | null {
  return id ? scene.anchors.find((a) => a.id === id) ?? null : null
}

/** 影响说明条目的中文小标题（§4.6：水域需分别说明岸边/亲子/水上） */
export const IMPACT_LABELS: Record<string, string> = {
  shoreText: "岸边",
  familyText: "亲子",
  waterText: "水上",
  routeText: "路线",
}
