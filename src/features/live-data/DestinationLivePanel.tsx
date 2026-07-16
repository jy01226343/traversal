import { useCallback, useEffect, useState } from "react"
import { RefreshCw } from "lucide-react"
import { freshnessFromUpdatedAt, getFreshnessLabel } from "../explore/freshness"
import { fetchDestinationLiveData, getDestinationSyncState, type DestinationLiveSnapshot } from "./destination-live"

interface DestinationLivePanelProps {
  destination: { id: string; name: string; lat_wgs84: number; lng_wgs84: number }
  onAddToJourney?: () => void
  canAddToJourney?: boolean
}

export function DestinationLivePanel({ destination, onAddToJourney, canAddToJourney = false }: DestinationLivePanelProps) {
  const [snapshot, setSnapshot] = useState<DestinationLiveSnapshot | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sync = useCallback(async (signal?: AbortSignal) => {
    setSyncing(true)
    setError(null)
    try {
      const next = await fetchDestinationLiveData({ name: destination.name, lat: destination.lat_wgs84, lng: destination.lng_wgs84 }, signal)
      setSnapshot(next)
    } catch (reason) {
      if (!signal?.aborted) setError(reason instanceof Error ? reason.message : "同步失败")
    } finally {
      if (!signal?.aborted) setSyncing(false)
    }
  }, [destination.id, destination.name, destination.lat_wgs84, destination.lng_wgs84])
  useEffect(() => {
    const controller = new AbortController()
    void sync(controller.signal)
    return () => controller.abort()
  }, [sync])

  const syncState = getDestinationSyncState(snapshot, syncing)
  return <section className="destination-live tool-card" aria-live="polite">
    <header><div><span>DESTINATION LIVE</span><b>目的地实时信息</b></div><button type="button" onClick={() => void sync()} disabled={syncing}><RefreshCw size={13} className={syncing ? "is-syncing" : ""}/>{syncing ? "同步中" : "同步最新信息"}</button></header>
    {onAddToJourney && <button type="button" className="destination-live-journey" onClick={onAddToJourney}>{canAddToJourney ? "加入当前 Journey" : "新建 Journey 后加入"}</button>}
    <p className={`destination-live-state state-${syncState}`}>{syncState === "partial" ? "部分成功 · 已保留可用数据" : syncState === "success" ? "已完成同步" : syncState === "unavailable" ? "数据暂不可用" : syncState === "syncing" ? "正在同步" : "等待同步"}</p>
    <ul>{snapshot?.layers.map(layer => {
      const freshness = freshnessFromUpdatedAt(layer.updatedAt, 30 * 60_000)
      return <li key={layer.id}><div><b>{layer.label}</b><small>{layer.message}</small><em>{layer.sourceLabel}</em></div><span className={`freshness freshness-${freshness}`}>{getFreshnessLabel(freshness)}</span></li>
    }) || <li><div><b>同步范围</b><small>天气、开放状态、交通、当地事件、风险提醒</small></div></li>}</ul>
    {error && <p className="destination-live-error">{error}；已保留上一次成功数据。</p>}
  </section>
}
