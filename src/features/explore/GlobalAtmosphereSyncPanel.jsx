import React from "react"
import { getFreshnessLabel } from "./freshness"

const LAYERS = [
  ["daylight", "昼夜", "实时天文演算"],
  ["cloud", "云层", "气象模型"],
  ["precipitation", "降水", "气象模型"],
  ["wind", "风场", "气象模型"],
]

export function GlobalAtmosphereSyncPanel({ loading, updatedAt, source, onSync }) {
  const status = loading ? "syncing" : updatedAt ? "fresh" : "unavailable"
  return <aside className="atmosphere-sync tool-card" aria-live="polite">
    <div className="atmosphere-sync-head"><span>LIVE ATMOSPHERE</span><button type="button" onClick={onSync} disabled={loading}>{loading ? "同步中" : "同步最新信息"}</button></div>
    <b>全球旅行环境演算</b>
    <ul>{LAYERS.map(([id, label, layerSource]) => <li key={id}><span>{label}</span><em className={`freshness freshness-${status}`}>{getFreshnessLabel(status)}</em><small>{id === "daylight" ? layerSource : source || "等待同步"}</small></li>)}</ul>
    <p>{updatedAt ? `最后成功更新：${new Date(updatedAt).toLocaleString("zh-CN")}` : "尚无可用同步数据"}</p>
  </aside>
}
