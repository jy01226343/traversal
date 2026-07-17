/**
 * 主题说明面板（§6.4）：桌面右侧固定 ~360px，移动端底部抽屉（三档按钮切换高度）。
 * kind 由 CORE resolveThemePanel 解析：
 * - presets    → 景色卡片列表（月份/文案/「典型景色预览」标）
 * - activities → 玩法卡（时长/难度/设施/限制）
 * - audiences  → 人群卡（warnings 红字带 ▲）
 * - risks      → 风险卡（五段说明 + 「开始演示」，仅 cautions 主题可达）
 * - deep       → 第五主题锚点说明列表
 * 选中空间标签时面板顶部显示该锚点说明（AnchorContent 容错解析，拿不到显示占位文案）。
 */

import { useEffect, useRef, useState } from "react"
import { X } from "lucide-react"
import type {
  ImmersiveSceneDefinition,
  ImmersiveTheme,
  SceneAnchorDefinition,
} from "../domain/types"
import type { ImmersiveEvent, ImmersiveState } from "../state/immersive-machine"
import { resolveThemePanel } from "../runtime/theme-controller"
import { ModeBadge } from "./ModeBadge"
import {
  DIFFICULTY_LABELS,
  IMPACT_LABELS,
  findAnchor,
  findAnchorContent,
  formatDuration,
  formatMonths,
  themeLabel,
  type LiveBadgeInfo,
} from "./ui-utils"

type Detent = "peek" | "half" | "full"

const DETENT_LABELS: Record<Detent, string> = { peek: "收起", half: "半屏", full: "展开" }

export interface InfoPanelProps {
  scene: ImmersiveSceneDefinition
  state: ImmersiveState
  defaultPreviewId: string | null
  live: LiveBadgeInfo | null
  dispatch: (event: ImmersiveEvent) => void
}

export function InfoPanel({ scene, state, defaultPreviewId, live, dispatch }: InfoPanelProps) {
  const { activeTheme, selectedAnchorId, selectedPreviewId, selectedActivityId, selectedAudienceId } = state.context
  const [detent, setDetent] = useState<Detent>("half")
  const titleRef = useRef<HTMLHeadingElement>(null)

  const model = resolveThemePanel(scene, activeTheme)
  const anchor: SceneAnchorDefinition | null = findAnchor(scene, selectedAnchorId)
  const anchorContent = anchor ? findAnchorContent(scene, anchor.contentId) : null

  // 焦点迁移：主题切换后移到面板标题（§12.4）
  useEffect(() => {
    titleRef.current?.focus()
  }, [activeTheme, model.kind])

  const panelTitle = anchor && !activeTheme ? (anchorContent?.title ?? anchor.label) : model.title
  const close = () => {
    if (activeTheme) dispatch({ type: "clearTheme" })
    else dispatch({ type: "selectAnchor", anchorId: null })
  }

  return (
    <aside
      className={`ix-panel ix-panel--${detent}`}
      role="complementary"
      aria-label={panelTitle}
      data-testid="ix-info-panel"
      data-kind={model.kind}
    >
      <header className="ix-panel__header">
        <div className="ix-panel__handle" aria-hidden="true" />
        <div className="ix-panel__title-row">
          <h3 ref={titleRef} tabIndex={-1} className="ix-panel__title">{panelTitle}</h3>
          <div className="ix-panel__detents" role="group" aria-label="面板高度">
            {(Object.keys(DETENT_LABELS) as Detent[]).map((d) => (
              <button
                key={d}
                type="button"
                className={`ix-panel__detent${d === detent ? " ix-panel__detent--active" : ""}`}
                aria-pressed={d === detent}
                onClick={() => setDetent(d)}
              >
                {DETENT_LABELS[d]}
              </button>
            ))}
          </div>
          <button type="button" className="ix-panel__close" aria-label="关闭面板" onClick={close}>
            <X size={17} aria-hidden="true" />
          </button>
        </div>
        {live && <ModeBadge mode="live" live={live} size="sm" />}
      </header>

      <div className="ix-panel__body">
        {anchor && (
          <section className="ix-anchor-card" aria-label={`空间标签：${anchor.label}`}>
            <p className="ix-anchor-card__eyebrow">空间标签 · {anchor.label}</p>
            {activeTheme && <h4 className="ix-anchor-card__title">{anchorContent?.title ?? anchor.label}</h4>}
            <p className="ix-anchor-card__body">{anchorContent?.body ?? "该点位说明正在整理中。"}</p>
          </section>
        )}

        {model.kind === "presets" && (
          <ul className="ix-card-list" aria-label="景色预览列表">
            {scene.previewPresets.map((preset) => {
              const selected = (selectedPreviewId ?? defaultPreviewId) === preset.id
              return (
                <li key={preset.id}>
                  <button
                    type="button"
                    className={`ix-card${selected ? " ix-card--selected" : ""}`}
                    aria-pressed={selected}
                    onClick={() => dispatch({ type: "selectPreview", previewId: preset.id })}
                  >
                    <span className="ix-card__title">
                      {preset.label}
                      {preset.representative && <span className="ix-chip ix-chip--gold">代表</span>}
                    </span>
                    <span className="ix-card__meta">{formatMonths(preset.months)}</span>
                    <span className="ix-card__text">{preset.whereText}</span>
                    <span className="ix-card__text">{preset.whenText}</span>
                    <span className="ix-card__text">{preset.whyText}</span>
                    <ModeBadge mode="typical_preview" size="sm" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {model.kind === "activities" && (
          <ul className="ix-card-list" aria-label="玩法列表">
            {scene.activities.map((activity) => {
              const selected = selectedActivityId === activity.id
              const meta = [
                formatDuration(activity.durationMinutes),
                activity.difficulty ? `难度 ${DIFFICULTY_LABELS[activity.difficulty]}` : null,
              ].filter(Boolean).join(" · ")
              return (
                <li key={activity.id}>
                  <button
                    type="button"
                    className={`ix-card${selected ? " ix-card--selected" : ""}${activity.applicable ? "" : " ix-card--disabled"}`}
                    aria-pressed={selected}
                    disabled={!activity.applicable}
                    onClick={() => dispatch({ type: "selectActivity", activityId: selected ? null : activity.id })}
                  >
                    <span className="ix-card__title">
                      {activity.label}
                      {!activity.applicable && <span className="ix-chip">当前不适用</span>}
                    </span>
                    {meta && <span className="ix-card__meta">{meta}</span>}
                    <span className="ix-card__text">{activity.description}</span>
                    {activity.facilities && activity.facilities.length > 0 && (
                      <span className="ix-card__meta">设施：{activity.facilities.join("、")}</span>
                    )}
                    {activity.requirements && activity.requirements.length > 0 && (
                      <span className="ix-card__meta">要求：{activity.requirements.join("、")}</span>
                    )}
                    {activity.limitations?.map((item) => (
                      <span key={item} className="ix-warn">▲ {item}</span>
                    ))}
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {model.kind === "audiences" && (
          <ul className="ix-card-list" aria-label="人群列表">
            {scene.audiences.map((audience) => {
              const selected = selectedAudienceId === audience.id
              const allowed = audience.allowedActivityIds
                .map((id) => scene.activities.find((a) => a.id === id)?.label)
                .filter(Boolean)
                .join("、")
              return (
                <li key={audience.id}>
                  <button
                    type="button"
                    className={`ix-card${selected ? " ix-card--selected" : ""}`}
                    aria-pressed={selected}
                    onClick={() => dispatch({ type: "selectAudience", audienceId: selected ? null : audience.id })}
                  >
                    <span className="ix-card__title">{audience.label}</span>
                    {allowed && <span className="ix-card__meta">适合玩法：{allowed}</span>}
                    {audience.warnings?.map((w) => (
                      <span key={w} className="ix-warn">▲ {w}</span>
                    ))}
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {model.kind === "risks" && (
          <ul className="ix-card-list" aria-label="风险列表">
            {scene.risks.map((risk) => (
              <li key={risk.id} className={`ix-card ix-card--static ix-card--risk${risk.applicable ? "" : " ix-card--disabled"}`}>
                <span className="ix-card__title">
                  {risk.label}
                  {!risk.applicable && <span className="ix-chip">当前不适用</span>}
                </span>
                <ModeBadge mode="risk_simulation" size="sm" />
                <RiskSection title="形成原因" items={risk.cause} />
                <RiskSection title="判断信号" items={risk.warningSignals} />
                <RiskSection title="行动建议" items={risk.actions} />
                <ImpactTexts impact={risk.impactTexts} />
                {risk.officialAdvisoryBinding && (
                  <a
                    className="ix-link"
                    href={risk.officialAdvisoryBinding}
                    target="_blank"
                    rel="noreferrer"
                  >
                    官方提醒来源（另行查看，非模拟内容）
                  </a>
                )}
                <button
                  type="button"
                  className="ix-btn ix-btn--danger ix-card__cta"
                  disabled={!risk.applicable}
                  onClick={() => dispatch({ type: "startRisk", riskId: risk.id })}
                >
                  ▶ 开始演示
                </button>
              </li>
            ))}
          </ul>
        )}

        {model.kind === "deep" && activeTheme && (
          <DeepThemeList scene={scene} theme={activeTheme} />
        )}
      </div>
    </aside>
  )
}

function RiskSection({ title, items }: { title: string; items: string[] }) {
  if (!items || items.length === 0) return null
  return (
    <section className="ix-risk-section">
      <h5 className="ix-risk-section__title">{title}</h5>
      <ul className="ix-risk-section__list">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </section>
  )
}

function ImpactTexts({ impact }: { impact: Record<string, string | undefined> }) {
  const entries = Object.entries(impact).filter(([, v]) => Boolean(v))
  if (entries.length === 0) return null
  return (
    <section className="ix-risk-section">
      <h5 className="ix-risk-section__title">影响说明</h5>
      <ul className="ix-risk-section__list">
        {entries.map(([key, value]) => (
          <li key={key}><b>{IMPACT_LABELS[key] ?? key}：</b>{value}</li>
        ))}
      </ul>
    </section>
  )
}

/** 第五主题：该主题关联锚点的说明列表 */
function DeepThemeList({ scene, theme }: { scene: ImmersiveSceneDefinition; theme: ImmersiveTheme }) {
  const anchors = scene.anchors.filter((a) => a.themes.includes(theme))
  if (anchors.length === 0) {
    return <p className="ix-panel__empty">「{themeLabel(scene, theme)}」的点位说明正在整理中。</p>
  }
  return (
    <ul className="ix-card-list" aria-label={`${themeLabel(scene, theme)}点位说明`}>
      {anchors.map((anchor) => {
        const content = findAnchorContent(scene, anchor.contentId)
        return (
          <li key={anchor.id} className="ix-card ix-card--static">
            <span className="ix-card__title">{content?.title ?? anchor.label}</span>
            <span className="ix-card__text">{content?.body ?? "该点位说明正在整理中。"}</span>
          </li>
        )
      })}
    </ul>
  )
}
