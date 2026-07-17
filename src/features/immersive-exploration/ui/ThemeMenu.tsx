/**
 * 底部主题菜单（§6.4）：按 scene.themes 顺序渲染五个主题 tab，单选；
 * 再次点击当前主题 → 清除主题（clearTheme）。触控区 ≥ 44pt。
 * 风险触发入口不在此（只在 cautions 面板内）。
 */

import type { ComponentType } from "react"
import {
  Cog,
  Fish,
  Landmark,
  Leaf,
  Mountain,
  Route,
  Sparkles,
  TriangleAlert,
  Users,
  Waves,
} from "lucide-react"
import type { ImmersiveTheme, ThemeDefinition } from "../domain/types"

const THEME_ICONS: Record<ImmersiveTheme, ComponentType<{ size?: number | string; "aria-hidden"?: boolean | "true" | "false" }>> = {
  highlights: Mountain,
  experience: Route,
  audience: Users,
  cautions: TriangleAlert,
  nature_geology: Leaf,
  water_ecology: Waves,
  underwater_ecology: Fish,
  story_past: Landmark,
  engineering_operation: Cog,
}

export interface ThemeMenuProps {
  themes: ThemeDefinition[]
  activeTheme: ImmersiveTheme | null
  /** 点击未激活主题 → activateTheme；点击当前主题 → clearTheme（由调用方分发） */
  onToggle: (theme: ImmersiveTheme) => void
}

export function ThemeMenu({ themes, activeTheme, onToggle }: ThemeMenuProps) {
  return (
    <nav className="ix-theme-menu" role="group" aria-label="探索主题" data-testid="ix-theme-menu">
      {themes.map((theme) => {
        const Icon = THEME_ICONS[theme.id] ?? Sparkles
        const active = theme.id === activeTheme
        return (
          <button
            key={theme.id}
            type="button"
            className={`ix-theme-tab${active ? " ix-theme-tab--active" : ""}`}
            aria-pressed={active}
            onClick={() => onToggle(theme.id)}
          >
            <Icon size={19} aria-hidden="true" />
            <span className="ix-theme-tab__label">{theme.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
