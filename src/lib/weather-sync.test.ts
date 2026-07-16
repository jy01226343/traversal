import { describe, it, expect, vi, afterEach } from "vitest"
import { syncLiveWeather } from "./weather-sync"

// Open-Meteo 单站返回结构
function makeOpenMeteoResponse(tempC: number, code: number) {
  return {
    latitude: 43.06,
    longitude: 141.35,
    current: {
      temperature_2m: tempC,
      weather_code: code,
      precipitation: 0,
      relative_humidity_2m: 60,
      wind_speed_10m: 5,
    },
  }
}

describe("syncLiveWeather", () => {
  const realFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = realFetch
    vi.restoreAllMocks()
  })

  it("成功同步时 source = 'live'（雨 code=61 会映射到 rain）", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeOpenMeteoResponse(18, 61), // 中雨 18°C -> rain
    }) as unknown as typeof fetch

    const result = await syncLiveWeather()
    expect(result.ok).toBe(true)
    expect(result.source).toBe("live")
    expect(result.liveCount).toBeGreaterThan(0)
    expect(result.cells.length).toBeGreaterThan(0)
    expect(result.cells.every(c => c.source === "live")).toBe(true)
  })

  it("fetch 失败时回退气候档案 source = 'climate-fallback'", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    }) as unknown as typeof fetch

    const result = await syncLiveWeather()
    expect(result.ok).toBe(false)
    expect(result.source).toBe("climate-fallback")
    expect(result.cells.length).toBeGreaterThan(0)
    expect(result.message).toContain("失败")
  })

  it("网络异常（throw）时回退气候档案", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch

    const result = await syncLiveWeather()
    expect(result.ok).toBe(false)
    expect(result.source).toBe("climate-fallback")
    expect(result.message).toContain("network down")
  })

  it("实时无显著天气（晴朗温和 code=2, 15°C）时回退 climate-fallback", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeOpenMeteoResponse(15, 2), // 多云 15°C -> kindFromWmo 返回 null
    }) as unknown as typeof fetch

    const result = await syncLiveWeather()
    expect(result.liveCount).toBe(0)
    expect(result.source).toBe("climate-fallback")
    expect(result.message).toContain("气候模型")
  })

  it("AbortSignal 中止后回退气候档案，不抛异常", async () => {
    const ac = new AbortController()
    globalThis.fetch = vi.fn().mockImplementation((_, opts) => {
      return new Promise((_, reject) => {
        if (opts?.signal?.aborted) reject(new DOMException("aborted", "AbortError"))
        ac.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))
      })
    }) as unknown as typeof fetch

    const promise = syncLiveWeather(ac.signal)
    ac.abort()
    const result = await promise
    expect(result.source).toBe("climate-fallback")
  })
})
