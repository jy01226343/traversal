/**
 * 风险演示控制面板（RISK_ACTIVE 子状态，§1 / §4.6 / §10.2）：
 * 播放/暂停（pauseRisk）、重播（replayRisk）、上一步/下一步（riskStep）、恢复平静（restoreCalm）；
 * 步骤进度（第 x / 共 n 步 + title/description）；五段文字等价说明；醒目「风险情境演示 · 非当前实况」标。
 */

import { useEffect, useRef } from "react"
import { Pause, Play, RotateCcw, SkipBack, SkipForward, Waves } from "lucide-react"
import type { RiskScenarioDefinition } from "../domain/types"
import type { ImmersiveEvent, RiskPlayback } from "../state/immersive-machine"
import { ModeBadge } from "./ModeBadge"
import { IMPACT_LABELS } from "./ui-utils"

export interface RiskControlsProps {
  risk: RiskScenarioDefinition
  playback: RiskPlayback
  dispatch: (event: ImmersiveEvent) => void
}

export function RiskControls({ risk, playback, dispatch }: RiskControlsProps) {
  const { stepIndex, playing } = playback
  const steps = risk.sequence
  const total = steps.length
  const current = steps[Math.min(stepIndex, total - 1)]
  const titleRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  return (
    <aside className="ix-panel ix-panel--full ix-risk" role="complementary" aria-label={`风险演示：${risk.label}`} data-testid="ix-risk-controls">
      <header className="ix-panel__header">
        <div className="ix-panel__title-row">
          <h3 ref={titleRef} tabIndex={-1} className="ix-panel__title">▲ {risk.label}</h3>
        </div>
        <ModeBadge mode="risk_simulation" />
      </header>

      <div className="ix-panel__body">
        <p className="ix-risk__progress" aria-live="polite">
          第 {Math.min(stepIndex + 1, total)} / 共 {total} 步
        </p>
        <div className="ix-risk__dots" aria-hidden="true">
          {steps.map((s, i) => (
            <span key={s.id} className={`ix-risk__dot${i <= stepIndex ? " ix-risk__dot--done" : ""}`} />
          ))}
        </div>

        {current && (
          <section className="ix-risk__step">
            <h4 className="ix-risk__step-title">{current.title}</h4>
            <p className="ix-risk__step-desc">{current.description}</p>
          </section>
        )}

        <div className="ix-risk__controls" role="group" aria-label="演示控制">
          <button
            type="button"
            className="ix-btn ix-btn--sm"
            disabled={stepIndex <= 0}
            onClick={() => dispatch({ type: "riskStep", stepIndex: Math.max(0, stepIndex - 1) })}
          >
            <SkipBack size={16} aria-hidden="true" /> 上一步
          </button>
          <button
            type="button"
            className="ix-btn ix-btn--sm"
            aria-pressed={!playing}
            onClick={() => dispatch({ type: "pauseRisk" })}
          >
            {playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
            {playing ? " 暂停" : " 继续"}
          </button>
          <button
            type="button"
            className="ix-btn ix-btn--sm"
            disabled={stepIndex >= total - 1}
            onClick={() => dispatch({ type: "riskStep", stepIndex: Math.min(total - 1, stepIndex + 1) })}
          >
            <SkipForward size={16} aria-hidden="true" /> 下一步
          </button>
          <button
            type="button"
            className="ix-btn ix-btn--sm"
            onClick={() => dispatch({ type: "replayRisk" })}
          >
            <RotateCcw size={16} aria-hidden="true" /> 重播
          </button>
          <button
            type="button"
            className="ix-btn ix-btn--sm ix-btn--calm"
            onClick={() => dispatch({ type: "restoreCalm" })}
          >
            <Waves size={16} aria-hidden="true" /> 恢复平静
          </button>
        </div>

        <section className="ix-risk-section">
          <h5 className="ix-risk-section__title">形成原因</h5>
          <ul className="ix-risk-section__list">{risk.cause.map((c) => <li key={c}>{c}</li>)}</ul>
        </section>
        <section className="ix-risk-section">
          <h5 className="ix-risk-section__title">发展过程</h5>
          <ol className="ix-risk-section__list">
            {steps.map((s, i) => (
              <li key={s.id} className={i === stepIndex ? "ix-risk-section__current" : undefined}>{s.title}</li>
            ))}
          </ol>
        </section>
        <section className="ix-risk-section">
          <h5 className="ix-risk-section__title">判断信号</h5>
          <ul className="ix-risk-section__list">{risk.warningSignals.map((w) => <li key={w}>{w}</li>)}</ul>
        </section>
        <section className="ix-risk-section">
          <h5 className="ix-risk-section__title">行动建议</h5>
          <ul className="ix-risk-section__list">{risk.actions.map((a) => <li key={a}>{a}</li>)}</ul>
        </section>
        {Object.entries(risk.impactTexts).some(([, v]) => Boolean(v)) && (
          <section className="ix-risk-section">
            <h5 className="ix-risk-section__title">影响说明</h5>
            <ul className="ix-risk-section__list">
              {Object.entries(risk.impactTexts).filter(([, v]) => Boolean(v)).map(([k, v]) => (
                <li key={k}><b>{IMPACT_LABELS[k] ?? k}：</b>{v}</li>
              ))}
            </ul>
          </section>
        )}
        {risk.officialAdvisoryBinding && (
          <a className="ix-link" href={risk.officialAdvisoryBinding} target="_blank" rel="noreferrer">
            官方提醒来源（另行查看，非模拟内容）
          </a>
        )}
      </div>
    </aside>
  )
}
