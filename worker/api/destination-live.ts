import type { Env } from "../index"

type LiveLayerId = "weather" | "opening" | "traffic" | "events" | "risk"
type LiveLayerStatus = "fresh" | "unavailable"

interface OpenMeteoCurrent {
  temperature_2m?: number
  weather_code?: number
  wind_speed_10m?: number
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  })
}

function unavailableLayers(message: string) {
  const unavailable = (id: LiveLayerId, label: string, sourceLabel: string) => ({ id, label, status: "unavailable" as LiveLayerStatus, sourceLabel, message, updatedAt: null })
  return [
    unavailable("weather", "天气", "Open-Meteo"),
    unavailable("opening", "开放状态", "尚未接入官方公告 Provider"),
    unavailable("traffic", "交通", "尚未接入交通 Provider"),
    unavailable("events", "当地事件", "尚未接入活动 Provider"),
    unavailable("risk", "风险提醒", "尚未接入风险 Provider"),
  ]
}

function describeWmo(code: number | undefined) {
  if (code === undefined) return "天气现状暂不可用"
  if (code >= 95) return "雷暴"
  if (code >= 71 && code <= 77) return "降雪"
  if (code >= 51 && code <= 82) return "降水"
  if (code === 45 || code === 48) return "有雾"
  if (code >= 1 && code <= 3) return "多云"
  return "晴朗"
}

/**
 * Destination-scoped live data is intentionally separate from global atmosphere.
 * Only the Open-Meteo adapter is available today; unavailable modules are shown
 * explicitly rather than fabricated from destination fixtures.
 */
export async function handleDestinationLive(request: Request, _env: Env): Promise<Response> {
  const url = new URL(request.url)
  const latitude = Number(url.searchParams.get("lat"))
  const longitude = Number(url.searchParams.get("lng"))
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return json({ error: "lat and lng must be valid WGS-84 coordinates" }, 400)
  }

  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,wind_speed_10m&timezone=auto`,
    )
    if (!response.ok) throw new Error(`Open-Meteo HTTP ${response.status}`)
    const payload = await response.json<{ current?: OpenMeteoCurrent }>()
    if (!payload.current) throw new Error("Open-Meteo returned no current weather")
    const updatedAt = new Date().toISOString()
    const temperature = typeof payload.current.temperature_2m === "number" ? `${Math.round(payload.current.temperature_2m)}°C` : "温度暂不可用"
    const wind = typeof payload.current.wind_speed_10m === "number" ? `风速 ${Math.round(payload.current.wind_speed_10m)} km/h` : "风速暂不可用"
    const unavailable = unavailableLayers("等待对应数据 Provider 接入")
    return json({
      destination: url.searchParams.get("name") || null,
      syncedAt: updatedAt,
      layers: [
        { id: "weather", label: "天气", status: "fresh" as LiveLayerStatus, sourceLabel: "Open-Meteo 气象模型", updatedAt, message: `${describeWmo(payload.current.weather_code)} · ${temperature} · ${wind}` },
        ...unavailable.filter(layer => layer.id !== "weather"),
      ],
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "同步失败"
    return json({ destination: url.searchParams.get("name") || null, syncedAt: null, layers: unavailableLayers(`天气同步失败：${message}`) })
  }
}
