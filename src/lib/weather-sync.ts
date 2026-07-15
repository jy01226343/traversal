import {
  CLIMATE_STATIONS,
  WEATHER_META,
  type ActiveWeatherCell,
  type WeatherKind,
  resolveClimateWeather,
  getCurrentMonth,
} from "@/data/climate"

/** WMO weather interpretation codes → primary kind + intensity. */
function kindFromWmo(code: number, tempC: number): { kind: WeatherKind; intensity: number } | null {
  // Thunderstorm
  if (code >= 95 && code <= 99) return { kind: "storm", intensity: 0.95 }
  if (code === 29) return { kind: "storm", intensity: 0.7 }

  // Snow / ice
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86) || code === 22)
    return { kind: "snow", intensity: code >= 75 ? 0.95 : 0.7 }

  // Rain / drizzle / showers
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code === 61 || code === 63 || code === 65) {
    const heavy = code === 65 || code === 82 || code === 67
    // Heavy rain + heat can still be storm-adjacent rain
    if (heavy && tempC > 22) return { kind: "storm", intensity: 0.75 }
    return { kind: "rain", intensity: heavy ? 0.9 : 0.65 }
  }

  // Fog / mist / deposit
  if (code === 45 || code === 48 || code === 10 || code === 11 || code === 12)
    return { kind: "fog", intensity: 0.85 }

  // Clear / clouds with extreme heat
  if (tempC >= 36) return { kind: "heat", intensity: Math.min(1, (tempC - 32) / 12) }
  if (tempC >= 33 && (code <= 3 || code === 0 || code === 1 || code === 2))
    return { kind: "heat", intensity: 0.7 }

  // Overcast mild → light fog chance
  if ((code === 3 || code === 45) && tempC < 12) return { kind: "fog", intensity: 0.45 }

  return null
}

interface OpenMeteoCurrent {
  temperature_2m: number
  weather_code: number
  precipitation?: number
  relative_humidity_2m?: number
  wind_speed_10m?: number
}

interface OpenMeteoResponse {
  current?: OpenMeteoCurrent
  latitude: number
  longitude: number
}

export interface SyncResult {
  ok: boolean
  cells: ActiveWeatherCell[]
  syncedAt: string
  source: "live" | "climate-fallback"
  message: string
  stationCount: number
  liveCount: number
}

/**
 * Live sync via Open-Meteo (free, no key).
 * Aggregates global meteorological-model output for each climate station.
 * Falls back to monthly climatology on network / API failure.
 */
export async function syncLiveWeather(signal?: AbortSignal): Promise<SyncResult> {
  const month = getCurrentMonth()
  const climateFallback = resolveClimateWeather(month)

  try {
    // Batch in chunks of 8 to keep URL length reasonable
    const stations = CLIMATE_STATIONS
    const chunkSize = 8
    const liveCells: ActiveWeatherCell[] = []
    let liveHits = 0

    for (let i = 0; i < stations.length; i += chunkSize) {
      const chunk = stations.slice(i, i + chunkSize)
      const lats = chunk.map(s => s.location[0]).join(",")
      const lons = chunk.map(s => s.location[1]).join(",")
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}` +
        `&current=temperature_2m,weather_code,precipitation,relative_humidity_2m,wind_speed_10m` +
        `&timezone=auto`

      const response = await fetch(url, { signal })
      if (!response.ok) throw new Error(`Open-Meteo HTTP ${response.status}`)
      const payload = await response.json()

      // Single station returns object; multi returns array
      const list: OpenMeteoResponse[] = Array.isArray(payload) ? payload : [payload]

      list.forEach((item, index) => {
        const station = chunk[index]
        if (!station || !item?.current) return
        const temp = item.current.temperature_2m
        const code = item.current.weather_code
        const mapped = kindFromWmo(code, temp)
        if (!mapped) return
        liveHits += 1
        const meta = WEATHER_META[mapped.kind]
        liveCells.push({
          id: `${station.id}-${mapped.kind}-live`,
          stationId: station.id,
          kind: mapped.kind,
          location: station.location,
          label: `${station.name} · ${meta.label}`,
          count: Math.round(station.count * (0.55 + mapped.intensity * 0.55)),
          radius: station.radius * (0.9 + mapped.intensity * 0.2),
          height: station.height,
          intensity: mapped.intensity,
          source: "live",
          tempC: temp,
          code,
        })

        // Secondary: high humidity clear → coastal fog
        const rh = item.current.relative_humidity_2m ?? 0
        if (rh >= 92 && temp < 18 && mapped.kind !== "fog" && mapped.kind !== "rain" && mapped.kind !== "snow") {
          liveCells.push({
            id: `${station.id}-fog-live`,
            stationId: station.id,
            kind: "fog",
            location: station.location,
            label: `${station.name} · 浓雾`,
            count: Math.round(station.count * 0.55),
            radius: station.radius * 1.05,
            height: station.height * 0.75,
            intensity: 0.55,
            source: "live",
            tempC: temp,
            code,
          })
        }
      })
    }

    if (liveCells.length === 0) {
      return {
        ok: true,
        cells: climateFallback,
        syncedAt: new Date().toISOString(),
        source: "climate-fallback",
        message: "实时无显著天气，已回退月度气候模型",
        stationCount: stations.length,
        liveCount: 0,
      }
    }

    return {
      ok: true,
      cells: liveCells,
      syncedAt: new Date().toISOString(),
      source: "live",
      message: `已同步 ${liveHits} 站气象模型数据（Open-Meteo）`,
      stationCount: stations.length,
      liveCount: liveHits,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "网络错误"
    return {
      ok: false,
      cells: climateFallback,
      syncedAt: new Date().toISOString(),
      source: "climate-fallback",
      message: `同步失败，使用 ${month} 月气候档案 · ${message}`,
      stationCount: CLIMATE_STATIONS.length,
      liveCount: 0,
    }
  }
}
