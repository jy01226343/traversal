/**
 * 沉浸探索 · 主题面板解析（CONTRACT CORE 节 / 契约「主题中文标签」）
 *
 * 纯函数：把激活主题解析为 InfoPanel 内容模型。
 * - highlights → presets（景色）
 * - experience → activities（怎么玩）
 * - audience → audiences（适合谁）
 * - cautions → risks（注意什么）
 * - 第五主题（nature_geology / water_ecology / underwater_ecology 等）→ deep
 */

import type { ImmersiveSceneDefinition, ImmersiveTheme } from "../domain/types";

export interface ThemePanelModel {
  kind: "presets" | "activities" | "audiences" | "risks" | "deep";
  title: string;
}

const THEME_LABELS: Record<string, string> = {
  highlights: "景色",
  experience: "怎么玩",
  audience: "适合谁",
  cautions: "注意什么",
  nature_geology: "自然观察",
  water_ecology: "水域生态",
  underwater_ecology: "水下生态",
};

const THEME_KINDS: Record<string, ThemePanelModel["kind"]> = {
  highlights: "presets",
  experience: "activities",
  audience: "audiences",
  cautions: "risks",
};

export function resolveThemePanel(
  scene: ImmersiveSceneDefinition,
  theme: ImmersiveTheme | null,
): ThemePanelModel {
  // 未激活主题：默认展示景色面板
  if (theme == null) {
    return { kind: "presets", title: THEME_LABELS.highlights };
  }

  const kind = THEME_KINDS[theme] ?? "deep";
  // 标题优先用契约中文标签；未收录的深度主题回退到场景自定义 label
  const title =
    THEME_LABELS[theme] ??
    scene.themes.find((t) => t.id === theme)?.label ??
    "深入观察";
  return { kind, title };
}
