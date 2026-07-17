/**
 * 等价图文页（§12.1 / §12.2）：
 * - 场景渲染/资源异常（FALLBACK）时展示等价信息 + 重试（retryEnter）/返回地图；
 * - 同时作为非沉浸式入口（feature flag 关闭）的等价页与屏幕阅读器主路径；
 * - 覆盖全部五主题章节 + 地点摘要 + 空间标签等价文本列表；不显示内部堆栈。
 */

import { useEffect, useRef } from "react"
import { RotateCcw } from "lucide-react"
import type { ExplorationEntity, ImmersiveSceneDefinition } from "../domain/types"
import { FAMILY_LABELS, findAnchorContent, themeLabel } from "./ui-utils"

export interface FallbackInfoViewProps {
  entity?: ExplorationEntity | null
  scene: ImmersiveSceneDefinition
  /** 资源异常原因（仅展示通用说明，不显示堆栈） */
  errorReason?: string | null
  /** 提供时显示「重试」按钮（FALLBACK → retryEnter） */
  onRetry?: (() => void) | null
  onReturnMap: () => void
  /** 非沉浸入口模式（flag 关闭时直接渲染） */
  standalone?: boolean
}

export function FallbackInfoView({ entity, scene, errorReason, onRetry, onReturnMap, standalone }: FallbackInfoViewProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  const name = entity?.name ?? scene.entityName

  return (
    <div className="ix-fallback" data-testid="ix-fallback">
      <div className="ix-fallback__inner">
        <header className="ix-fallback__header">
          <p className="ix-eyebrow">{scene.regionLabel} · {FAMILY_LABELS[scene.family]}{standalone ? " · 图文模式" : ""}</p>
          <h2 ref={headingRef} tabIndex={-1} className="ix-summary__title">{name}</h2>
          {errorReason && (
            <p className="ix-fallback__notice" role="alert">
              ▲ 沉浸场景暂时不可用（{errorReason}）。以下图文信息与沉浸场景内容一致。
            </p>
          )}
          <p className="ix-fallback__summary">{scene.fallback.summary}</p>
        </header>

        {scene.fallback.sections.map((section) => (
          <section key={section.theme} className="ix-fallback__section" aria-label={section.title}>
            <h3 className="ix-fallback__section-title">
              {section.title}
              <small className="ix-fallback__section-theme">{themeLabel(scene, section.theme)}</small>
            </h3>
            <p className="ix-fallback__section-body">{section.body}</p>
          </section>
        ))}

        <section className="ix-fallback__section" aria-label="场景点位一览">
          <h3 className="ix-fallback__section-title">场景点位一览</h3>
          <ul className="ix-fallback__anchors">
            {scene.anchors.map((anchor) => {
              const content = findAnchorContent(scene, anchor.contentId)
              return (
                <li key={anchor.id}>
                  <b>{anchor.label}</b>
                  {content ? ` — ${content.body}` : ""}
                </li>
              )
            })}
          </ul>
        </section>

        <footer className="ix-fallback__actions">
          {onRetry && (
            <button type="button" className="ix-btn ix-btn--primary" onClick={onRetry}>
              <RotateCcw size={16} aria-hidden="true" /> 重试进入沉浸场景
            </button>
          )}
          <button type="button" className="ix-btn ix-btn--ghost" onClick={onReturnMap}>
            返回地图
          </button>
        </footer>
      </div>
    </div>
  )
}
