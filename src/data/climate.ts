/** Climate stations with monthly historical likelihood (0–1) for each weather kind. */

export type WeatherKind = "rain" | "snow" | "storm" | "fog" | "heat"

export type MonthlyWeights = Partial<Record<WeatherKind, number>>

export interface ClimateStation {
  id: string
  name: string
  location: [number, number]
  /** Approx. radius on unit-ish globe surface */
  radius: number
  height: number
  count: number
  /** Month 1–12 → weather weights from long-term climate norms */
  monthly: Record<number, MonthlyWeights>
}

/**
 * Historical climate envelopes (simplified climatology).
 * Used when offline / before live sync; live Open-Meteo overwrites active kinds.
 */
export const CLIMATE_STATIONS: ClimateStation[] = [
  {
    id: "hokkaido",
    name: "北海道",
    location: [43.2, 142.5],
    radius: 0.1,
    height: 0.12,
    count: 380,
    monthly: {
      1: { snow: 0.95, fog: 0.25 }, 2: { snow: 0.92, fog: 0.2 }, 3: { snow: 0.7, rain: 0.25 },
      4: { rain: 0.45, fog: 0.3 }, 5: { rain: 0.4, fog: 0.2 }, 6: { rain: 0.55, fog: 0.35 },
      7: { rain: 0.5, fog: 0.25, storm: 0.15 }, 8: { rain: 0.55, storm: 0.2 },
      9: { rain: 0.5 }, 10: { rain: 0.4, fog: 0.2 }, 11: { snow: 0.45, rain: 0.35 }, 12: { snow: 0.85 },
    },
  },
  {
    id: "himalaya",
    name: "喜马拉雅",
    location: [28.0, 86.9],
    radius: 0.12,
    height: 0.14,
    count: 340,
    monthly: {
      1: { snow: 0.9 }, 2: { snow: 0.88 }, 3: { snow: 0.7 }, 4: { snow: 0.45, rain: 0.2 },
      5: { rain: 0.35, snow: 0.3 }, 6: { rain: 0.55, storm: 0.35 }, 7: { rain: 0.7, storm: 0.45, fog: 0.3 },
      8: { rain: 0.75, storm: 0.5, fog: 0.25 }, 9: { rain: 0.55, fog: 0.2 }, 10: { snow: 0.35, rain: 0.25 },
      11: { snow: 0.7 }, 12: { snow: 0.9 },
    },
  },
  {
    id: "se-asia",
    name: "中南半岛",
    location: [14.5, 101.0],
    radius: 0.14,
    height: 0.13,
    count: 480,
    monthly: {
      1: { fog: 0.15 }, 2: { fog: 0.1 }, 3: { heat: 0.45 }, 4: { heat: 0.65, storm: 0.25 },
      5: { rain: 0.6, storm: 0.55, heat: 0.35 }, 6: { rain: 0.85, storm: 0.7 },
      7: { rain: 0.9, storm: 0.75 }, 8: { rain: 0.88, storm: 0.72 }, 9: { rain: 0.8, storm: 0.6 },
      10: { rain: 0.55, storm: 0.35 }, 11: { rain: 0.25 }, 12: { fog: 0.15 },
    },
  },
  {
    id: "south-china",
    name: "华南",
    location: [23.5, 113.2],
    radius: 0.09,
    height: 0.11,
    count: 360,
    monthly: {
      1: { fog: 0.35, rain: 0.2 }, 2: { fog: 0.4, rain: 0.25 }, 3: { rain: 0.45, fog: 0.3 },
      4: { rain: 0.55, storm: 0.3 }, 5: { rain: 0.7, storm: 0.55 }, 6: { rain: 0.8, storm: 0.65 },
      7: { rain: 0.7, storm: 0.7, heat: 0.55 }, 8: { rain: 0.75, storm: 0.7, heat: 0.5 },
      9: { rain: 0.55, storm: 0.45 }, 10: { rain: 0.3 }, 11: { fog: 0.25 }, 12: { fog: 0.3 },
    },
  },
  {
    id: "yangtze",
    name: "长江中下游",
    location: [30.5, 114.3],
    radius: 0.1,
    height: 0.11,
    count: 320,
    monthly: {
      1: { fog: 0.4 }, 2: { fog: 0.35, rain: 0.2 }, 3: { rain: 0.4, fog: 0.3 },
      4: { rain: 0.55 }, 5: { rain: 0.6, storm: 0.3 }, 6: { rain: 0.75, storm: 0.45 },
      7: { heat: 0.75, storm: 0.55, rain: 0.5 }, 8: { heat: 0.8, storm: 0.5, rain: 0.45 },
      9: { rain: 0.4 }, 10: { fog: 0.25 }, 11: { fog: 0.35 }, 12: { fog: 0.4 },
    },
  },
  {
    id: "nw-europe",
    name: "西北欧",
    location: [52.0, 5.0],
    radius: 0.1,
    height: 0.11,
    count: 360,
    monthly: {
      1: { rain: 0.55, fog: 0.5 }, 2: { rain: 0.5, fog: 0.45 }, 3: { rain: 0.5, fog: 0.35 },
      4: { rain: 0.45, fog: 0.25 }, 5: { rain: 0.4 }, 6: { rain: 0.4 },
      7: { rain: 0.45, storm: 0.25 }, 8: { rain: 0.45, storm: 0.2 },
      9: { rain: 0.5, fog: 0.3 }, 10: { rain: 0.6, fog: 0.45 }, 11: { rain: 0.65, fog: 0.55 }, 12: { rain: 0.6, fog: 0.55 },
    },
  },
  {
    id: "alps",
    name: "阿尔卑斯",
    location: [46.6, 9.8],
    radius: 0.08,
    height: 0.11,
    count: 300,
    monthly: {
      1: { snow: 0.9, fog: 0.3 }, 2: { snow: 0.88 }, 3: { snow: 0.65, fog: 0.25 },
      4: { rain: 0.4, snow: 0.35 }, 5: { rain: 0.5, fog: 0.25 }, 6: { rain: 0.55, storm: 0.35 },
      7: { storm: 0.55, rain: 0.5, fog: 0.2 }, 8: { storm: 0.5, rain: 0.45 },
      9: { rain: 0.45, fog: 0.25 }, 10: { rain: 0.4, fog: 0.3 }, 11: { snow: 0.55, fog: 0.35 }, 12: { snow: 0.85 },
    },
  },
  {
    id: "iceland",
    name: "冰岛",
    location: [64.9, -18.7],
    radius: 0.09,
    height: 0.12,
    count: 280,
    monthly: {
      1: { snow: 0.75, fog: 0.4 }, 2: { snow: 0.7, fog: 0.4 }, 3: { snow: 0.55, rain: 0.3, fog: 0.35 },
      4: { rain: 0.45, fog: 0.4 }, 5: { rain: 0.5, fog: 0.45 }, 6: { rain: 0.5, fog: 0.4 },
      7: { rain: 0.55, fog: 0.5 }, 8: { rain: 0.55, fog: 0.45 },
      9: { rain: 0.6, fog: 0.5 }, 10: { rain: 0.55, fog: 0.45 }, 11: { snow: 0.45, rain: 0.4, fog: 0.4 }, 12: { snow: 0.7, fog: 0.4 },
    },
  },
  {
    id: "amazon",
    name: "亚马逊",
    location: [-3.2, -60.0],
    radius: 0.16,
    height: 0.14,
    count: 520,
    monthly: {
      1: { rain: 0.85, storm: 0.6 }, 2: { rain: 0.9, storm: 0.65 }, 3: { rain: 0.9, storm: 0.7 },
      4: { rain: 0.8, storm: 0.55 }, 5: { rain: 0.55, storm: 0.35 }, 6: { rain: 0.35 },
      7: { rain: 0.3, storm: 0.2 }, 8: { rain: 0.3, storm: 0.2 },
      9: { rain: 0.4, storm: 0.25 }, 10: { rain: 0.55, storm: 0.4 }, 11: { rain: 0.7, storm: 0.5 }, 12: { rain: 0.8, storm: 0.55 },
    },
  },
  {
    id: "rockies",
    name: "落基山",
    location: [50.5, -115.0],
    radius: 0.11,
    height: 0.13,
    count: 320,
    monthly: {
      1: { snow: 0.9 }, 2: { snow: 0.88 }, 3: { snow: 0.7 }, 4: { snow: 0.45, rain: 0.25 },
      5: { rain: 0.4, storm: 0.2 }, 6: { storm: 0.45, rain: 0.4 }, 7: { storm: 0.55, rain: 0.35, heat: 0.3 },
      8: { storm: 0.5, heat: 0.35 }, 9: { rain: 0.35 }, 10: { snow: 0.3, rain: 0.3 },
      11: { snow: 0.65 }, 12: { snow: 0.9 },
    },
  },
  {
    id: "pacific-nw",
    name: "太平洋西北",
    location: [47.5, -123.0],
    radius: 0.09,
    height: 0.1,
    count: 300,
    monthly: {
      1: { rain: 0.75, fog: 0.55 }, 2: { rain: 0.7, fog: 0.5 }, 3: { rain: 0.65, fog: 0.4 },
      4: { rain: 0.5, fog: 0.3 }, 5: { rain: 0.35 }, 6: { rain: 0.25 },
      7: { fog: 0.35, heat: 0.2 }, 8: { fog: 0.3, heat: 0.25 },
      9: { rain: 0.3, fog: 0.25 }, 10: { rain: 0.55, fog: 0.4 }, 11: { rain: 0.75, fog: 0.55 }, 12: { rain: 0.8, fog: 0.55 },
    },
  },
  {
    id: "sf-bay",
    name: "旧金山湾区",
    location: [37.8, -122.4],
    radius: 0.07,
    height: 0.09,
    count: 240,
    monthly: {
      1: { rain: 0.45, fog: 0.4 }, 2: { rain: 0.45, fog: 0.35 }, 3: { rain: 0.35, fog: 0.4 },
      4: { fog: 0.5 }, 5: { fog: 0.65 }, 6: { fog: 0.75 },
      7: { fog: 0.8 }, 8: { fog: 0.75 }, 9: { fog: 0.55 },
      10: { fog: 0.35, rain: 0.2 }, 11: { rain: 0.4, fog: 0.3 }, 12: { rain: 0.5, fog: 0.35 },
    },
  },
  {
    id: "siberia",
    name: "西伯利亚",
    location: [62.0, 105.0],
    radius: 0.15,
    height: 0.13,
    count: 380,
    monthly: {
      1: { snow: 0.95 }, 2: { snow: 0.95 }, 3: { snow: 0.85 }, 4: { snow: 0.5, fog: 0.2 },
      5: { rain: 0.3 }, 6: { rain: 0.35, storm: 0.2 }, 7: { rain: 0.4, storm: 0.35, heat: 0.25 },
      8: { rain: 0.4, storm: 0.3 }, 9: { rain: 0.3 }, 10: { snow: 0.45 }, 11: { snow: 0.85 }, 12: { snow: 0.95 },
    },
  },
  {
    id: "india-monsoon",
    name: "印度季风带",
    location: [19.0, 73.0],
    radius: 0.12,
    height: 0.12,
    count: 400,
    monthly: {
      1: { fog: 0.2 }, 2: { heat: 0.35 }, 3: { heat: 0.7 }, 4: { heat: 0.9 },
      5: { heat: 0.85, storm: 0.35 }, 6: { rain: 0.85, storm: 0.75 }, 7: { rain: 0.95, storm: 0.85 },
      8: { rain: 0.9, storm: 0.8 }, 9: { rain: 0.75, storm: 0.55 }, 10: { rain: 0.35 },
      11: {}, 12: { fog: 0.15 },
    },
  },
  {
    id: "sahara",
    name: "撒哈拉",
    location: [23.5, 10.0],
    radius: 0.14,
    height: 0.1,
    count: 220,
    monthly: {
      1: { heat: 0.3 }, 2: { heat: 0.4 }, 3: { heat: 0.55 }, 4: { heat: 0.75 },
      5: { heat: 0.9 }, 6: { heat: 0.95 }, 7: { heat: 1 }, 8: { heat: 1 },
      9: { heat: 0.9 }, 10: { heat: 0.7 }, 11: { heat: 0.45 }, 12: { heat: 0.3 },
    },
  },
  {
    id: "arabian",
    name: "阿拉伯半岛",
    location: [24.5, 46.5],
    radius: 0.11,
    height: 0.1,
    count: 200,
    monthly: {
      1: { heat: 0.25 }, 2: { heat: 0.35 }, 3: { heat: 0.5 }, 4: { heat: 0.7 },
      5: { heat: 0.9 }, 6: { heat: 0.98 }, 7: { heat: 1 }, 8: { heat: 1 },
      9: { heat: 0.95 }, 10: { heat: 0.75 }, 11: { heat: 0.4 }, 12: { heat: 0.25 },
    },
  },
  {
    id: "australia-outback",
    name: "澳洲内陆",
    location: [-25.3, 133.0],
    radius: 0.13,
    height: 0.1,
    count: 240,
    monthly: {
      1: { heat: 0.95, storm: 0.35 }, 2: { heat: 0.9, storm: 0.3 }, 3: { heat: 0.75 },
      4: { heat: 0.5 }, 5: { fog: 0.1 }, 6: {}, 7: {}, 8: {},
      9: { heat: 0.35 }, 10: { heat: 0.55 }, 11: { heat: 0.75, storm: 0.25 }, 12: { heat: 0.9, storm: 0.35 },
    },
  },
  {
    id: "nz-west",
    name: "新西兰西岸",
    location: [-42.0, 171.5],
    radius: 0.08,
    height: 0.1,
    count: 260,
    monthly: {
      1: { rain: 0.55 }, 2: { rain: 0.5 }, 3: { rain: 0.55 }, 4: { rain: 0.6 },
      5: { rain: 0.65, fog: 0.3 }, 6: { rain: 0.7, fog: 0.35 }, 7: { rain: 0.7, fog: 0.35 },
      8: { rain: 0.7, fog: 0.3 }, 9: { rain: 0.65 }, 10: { rain: 0.6 }, 11: { rain: 0.55 }, 12: { rain: 0.55 },
    },
  },
  {
    id: "tokyo",
    name: "关东平原",
    location: [35.7, 139.7],
    radius: 0.08,
    height: 0.1,
    count: 300,
    monthly: {
      1: { fog: 0.2 }, 2: {}, 3: { rain: 0.3 }, 4: { rain: 0.4 },
      5: { rain: 0.45 }, 6: { rain: 0.7, fog: 0.35 }, 7: { rain: 0.55, storm: 0.45, heat: 0.65 },
      8: { rain: 0.5, storm: 0.5, heat: 0.7 }, 9: { rain: 0.55, storm: 0.4 },
      10: { rain: 0.4 }, 11: { fog: 0.2 }, 12: {},
    },
  },
  {
    id: "london-fog",
    name: "不列颠",
    location: [51.5, -0.1],
    radius: 0.08,
    height: 0.09,
    count: 260,
    monthly: {
      1: { fog: 0.55, rain: 0.5 }, 2: { fog: 0.5, rain: 0.45 }, 3: { fog: 0.35, rain: 0.4 },
      4: { rain: 0.4, fog: 0.25 }, 5: { rain: 0.35 }, 6: { rain: 0.3 },
      7: { rain: 0.35, storm: 0.15 }, 8: { rain: 0.35 }, 9: { rain: 0.4, fog: 0.25 },
      10: { rain: 0.55, fog: 0.45 }, 11: { rain: 0.6, fog: 0.55 }, 12: { rain: 0.55, fog: 0.6 },
    },
  },
]

export const WEATHER_META: Record<WeatherKind, { symbol: string; label: string; color: string }> = {
  rain: { symbol: "☂", label: "降雨", color: "#6eb8e0" },
  snow: { symbol: "❄", label: "降雪", color: "#e8f4ff" },
  storm: { symbol: "⚡", label: "雷暴", color: "#b8a0ff" },
  fog: { symbol: "☁", label: "浓雾", color: "#c5d0d4" },
  heat: { symbol: "☀", label: "热浪", color: "#ff9a5c" },
}

export interface ActiveWeatherCell {
  id: string
  stationId: string
  kind: WeatherKind
  location: [number, number]
  label: string
  count: number
  radius: number
  height: number
  intensity: number
  source: "climate" | "live"
  tempC?: number
  code?: number
}

const THRESHOLD = 0.32

export function getCurrentMonth(date = new Date()) {
  return date.getMonth() + 1
}

/** Resolve active weather cells from monthly climatology. */
export function resolveClimateWeather(month = getCurrentMonth()): ActiveWeatherCell[] {
  const cells: ActiveWeatherCell[] = []
  for (const station of CLIMATE_STATIONS) {
    const weights = station.monthly[month] || {}
    const entries = (Object.entries(weights) as [WeatherKind, number][])
      .filter(([, w]) => w >= THRESHOLD)
      .sort((a, b) => b[1] - a[1])

    // Keep top 2 kinds per station so globe stays readable
    for (const [kind, weight] of entries.slice(0, 2)) {
      const meta = WEATHER_META[kind]
      cells.push({
        id: `${station.id}-${kind}`,
        stationId: station.id,
        kind,
        location: station.location,
        label: `${station.name} · ${meta.label}`,
        count: Math.round(station.count * (0.55 + weight * 0.55)),
        radius: station.radius * (0.85 + weight * 0.25),
        height: station.height,
        intensity: weight,
        source: "climate",
      })
    }
  }
  return cells
}

export function monthLabel(month: number) {
  return `${month}月气候`
}
