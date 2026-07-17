import React, { useLayoutEffect, useRef } from "react"
import gsap from "gsap"
import { getFreshnessLabel } from "./freshness"

const LAYERS = [
  ["daylight", "昼夜", "实时天文演算"],
  ["cloud", "云层", "气象模型"],
  ["precipitation", "降水", "气象模型"],
  ["wind", "风场", "气象模型"],
]

export function GlobalAtmosphereSyncPanel({ loading, updatedAt, source, onSync, reducedMotion = false }) {
  const panelRef = useRef(null)
  useLayoutEffect(() => {
    if (reducedMotion || !panelRef.current) return undefined
    const context = gsap.context(() => {
      gsap.fromTo(panelRef.current, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.42, ease: "power2.out", clearProps: "transform" })
    }, panelRef)
    return () => context.revert()
  }, [reducedMotion])
  const status = loading ? "syncing" : updatedAt ? "fresh" : "unavailable"
  return <aside ref={panelRef} className="atmosphere-sync tool-card" aria-live="polite">
    <div className="atmosphere-sync-head"><span>LIVE ATMOSPHERE</span><button type="button" onClick={onSync} disabled={loading}>{loading ? "同步中" : "同步最新信息"}</button></div>
    <b>全球旅行环境演算</b>
    <ul>{LAYERS.map(([id, label, layerSource]) => <li key={id}><span>{label}</span><em className={`freshness freshness-${status}`}>{getFreshnessLabel(status)}</em><small>{id === "daylight" ? layerSource : source || "等待同步"}</small></li>)}</ul>
    <p>{updatedAt ? `最后成功更新：${new Date(updatedAt).toLocaleString("zh-CN")}` : "尚无可用同步数据"}</p>
  </aside>
}
