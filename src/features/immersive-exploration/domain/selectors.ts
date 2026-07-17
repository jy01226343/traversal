/**
 * 沉浸探索 · 空间标签选择器（施工方案 V1.1 §6.4 / CONTRACT CORE 节）
 *
 * 纯函数：从场景定义推导「可见空间标签」与「降强调标签集合」。
 * - 默认态标签上限 3，主题激活态上限 5；
 * - 主题激活时只保留 themes 含该主题的锚点；
 * - 选中锚点始终保留（即使超出上限）；
 * - 选中后，与选中锚点不相关的其他标签进入降强调集合。
 */

import type {
  ImmersiveSceneDefinition,
  ImmersiveTheme,
  SceneAnchorDefinition,
} from "./types";

/** 默认态标签上限（§6.4） */
export const ANCHOR_CAP_DEFAULT = 3;
/** 主题激活态标签上限 */
export const ANCHOR_CAP_THEME = 5;

/**
 * 可见锚点：activeTheme 非 null 时只保留 themes 含该主题的锚点（null 时全部候选），
 * 按 priority 升序（数字小者优先）截断到上限；selectedAnchorId 始终保留（即使超上限）。
 */
export function selectVisibleAnchors(
  scene: ImmersiveSceneDefinition,
  activeTheme: ImmersiveTheme | null,
  selectedAnchorId: string | null,
): SceneAnchorDefinition[] {
  const candidates = activeTheme
    ? scene.anchors.filter((a) => a.themes.includes(activeTheme))
    : scene.anchors.slice();

  // priority 升序；同优先级保持声明顺序（索引兜底，保证稳定）
  const sorted = candidates
    .map((anchor, index) => ({ anchor, index }))
    .sort((a, b) => a.anchor.priority - b.anchor.priority || a.index - b.index)
    .map((entry) => entry.anchor);

  const cap = activeTheme ? ANCHOR_CAP_THEME : ANCHOR_CAP_DEFAULT;
  const visible = sorted.slice(0, cap);

  // 选中锚点始终保留：不在截断结果内时追加（即使该锚点不属于当前主题候选）
  if (selectedAnchorId && !visible.some((a) => a.id === selectedAnchorId)) {
    const selected = scene.anchors.find((a) => a.id === selectedAnchorId);
    if (selected) visible.push(selected);
  }

  return visible;
}

/**
 * 降强调集合：有选中时，与选中锚点不相关（主题集合无交集）的其他锚点进入 dimmed 集合；
 * 与选中锚点主题集合有交集的锚点保持正常强调；无选中时为空集。
 */
export function selectDimmedAnchorIds(
  visible: SceneAnchorDefinition[],
  selectedAnchorId: string | null,
): Set<string> {
  const dimmed = new Set<string>();
  if (!selectedAnchorId) return dimmed;

  const selected = visible.find((a) => a.id === selectedAnchorId);
  if (!selected) return dimmed;

  const selectedThemes = new Set<ImmersiveTheme>(selected.themes);
  for (const anchor of visible) {
    if (anchor.id === selectedAnchorId) continue;
    const related = anchor.themes.some((theme) => selectedThemes.has(theme));
    if (!related) dimmed.add(anchor.id);
  }
  return dimmed;
}
