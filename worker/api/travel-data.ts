import type { Env } from "../index"
import { officialSourcesFor } from "../data-sources/hokkaido"
import { gcj02ToWgs84, wgs84ToGcj02 } from "../lib/coordinates"
import { canUseProvider, fetchJsonWithTimeout, providerFailure, safeProviderError, staleWhileRevalidate, type ProviderResult, type SourceMeta } from "../lib/gateway"

type TravelMode = "driving" | "walking" | "cycling" | "transit"
interface Point { lat: number; lng: number }
interface RouteRequest { countryCode: string; origin: Point; destination: Point; mode: TravelMode; departAt?: string }

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } })
}

function isPoint(value: unknown): value is Point {
  if (!value || typeof value !== "object") return false
  const point = value as Record<string, unknown>
  return typeof point.lat === "number" && point.lat >= -90 && point.lat <= 90 && typeof point.lng === "number" && point.lng >= -180 && point.lng <= 180
}

function source(provider: string, sourceName: string, sourceUrl: string, fromCache: boolean, stale: boolean): SourceMeta {
  return { provider, sourceName, sourceUrl, confidence: "map_provider", fetchedAt: new Date().toISOString(), fromCache, stale }
}

function timeoutMs(env: Env) { return Math.max(1000, Number(env.UPSTREAM_TIMEOUT_MS || 8000)) }

function routeCacheKey(input: RouteRequest) {
  const p = (point: Point) => `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`
  return `route:v1:${input.countryCode}:${input.mode}:${p(input.origin)}:${p(input.destination)}:${input.departAt?.slice(0, 13) || "none"}`
}

function escapeOverpassText(value: string) {
  return value.replace(/[\\"\n\r]/g, " ").slice(0, 80)
}

function osmPlaceId(element: { type: string; id: number }) {
  return `osm:${element.type}:${element.id}`
}

function normalizeTomTom(payload: any) {
  const route = payload?.routes?.[0]
  const summary = route?.summary
  if (!summary || !Number.isFinite(summary.lengthInMeters) || !Number.isFinite(summary.travelTimeInSeconds)) throw new Error("TomTom route payload invalid")
  return { distanceMeters: summary.lengthInMeters, durationSeconds: summary.travelTimeInSeconds, trafficDelaySeconds: Number.isFinite(summary.trafficDelayInSeconds) ? summary.trafficDelayInSeconds : undefined, geometry: route?.legs?.[0]?.points?.map((point: { latitude: number; longitude: number }) => `${point.longitude},${point.latitude}`).join(";") || undefined, provider: "tomtom" as const }
}

function normalizeAmap(payload: any) {
  const path = payload?.route?.paths?.[0]
  if (payload?.status !== "1" || !path) throw new Error("AMap route payload invalid")
  const distanceMeters = Number(path.distance)
  const durationSeconds = Number(path.duration ?? path.cost?.duration)
  if (!Number.isFinite(distanceMeters)) throw new Error("AMap route payload missing distance")
  let geometry: string | undefined
  try {
    const rawGeometry = Array.isArray(path.steps) ? path.steps.map((step: { polyline?: string }) => step.polyline).filter(Boolean).join(";") : ""
    const normalizedPairs = rawGeometry.split(";").flatMap((pair: string) => {
      const [lng, lat] = pair.split(",").map(Number)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return []
      const [wgsLat, wgsLng] = gcj02ToWgs84(lat, lng)
      return Number.isFinite(wgsLat) && Number.isFinite(wgsLng) ? [`${wgsLng},${wgsLat}`] : []
    })
    geometry = normalizedPairs.length ? normalizedPairs.join(";") : undefined
  } catch { /* geometry is optional; distance and duration remain usable */ }
  return { distanceMeters, ...(Number.isFinite(durationSeconds) ? { durationSeconds } : {}), geometry, provider: "amap" as const }
}

async function amapRoute(input: RouteRequest, env: Env): Promise<ProviderResult<ReturnType<typeof normalizeAmap>>> {
  if (!env.AMAP_WEB_SERVICE_KEY) return providerFailure("amap", "MISSING_SECRET", "中国路线服务暂未配置", false)
  if (!canUseProvider("amap", env.AMAP_DAILY_SOFT_LIMIT)) return providerFailure("amap", "RATE_LIMITED", "高德调用已达到当前软阈值，正在使用缓存或等待恢复", true)
  if (input.mode !== "driving") return providerFailure("amap", "UNSUPPORTED_REGION", "高德首期仅启用驾车路线", false)
  const [originLat, originLng] = wgs84ToGcj02(input.origin.lat, input.origin.lng)
  const [destinationLat, destinationLng] = wgs84ToGcj02(input.destination.lat, input.destination.lng)
  try {
    const cached = await staleWhileRevalidate(routeCacheKey(input), 24 * 60 * 60_000, () => {
      const params = new URLSearchParams({ key: env.AMAP_WEB_SERVICE_KEY!, origin: `${originLng.toFixed(6)},${originLat.toFixed(6)}`, destination: `${destinationLng.toFixed(6)},${destinationLat.toFixed(6)}`, extensions: "all", show_fields: "cost,polyline", strategy: "10" })
      return fetchJsonWithTimeout(`https://restapi.amap.com/v5/direction/driving?${params}`, {}, timeoutMs(env))
    })
    const data = normalizeAmap(cached.value)
    const warnings = [
      ...(cached.stale ? ["上游暂不可用，正在显示最后成功路线"] : []),
      ...(data.durationSeconds === undefined ? ["高德当前响应未提供预计时长"] : []),
    ]
    return { ok: true, data, source: source("amap", "高德 Web 服务 · 路线规划", "https://lbs.amap.com/api/webservice/guide/api/newroute", cached.fromCache, cached.stale), warnings: warnings.length ? warnings : undefined }
  } catch (error) {
    const safe = safeProviderError(error)
    return providerFailure("amap", safe.code, safe.message, true)
  }
}

async function tomTomRoute(input: RouteRequest, env: Env): Promise<ProviderResult<ReturnType<typeof normalizeTomTom>>> {
  if (!env.TOMTOM_API_KEY) return providerFailure("tomtom", "MISSING_SECRET", "境外路线服务暂未配置", false)
  if (!canUseProvider("tomtom", env.TOMTOM_DAILY_SOFT_LIMIT)) return providerFailure("tomtom", "RATE_LIMITED", "TomTom 调用已达到当前软阈值，正在使用缓存或等待恢复", true)
  const travelMode = input.mode === "cycling" ? "bicycle" : input.mode === "walking" ? "pedestrian" : "car"
  try {
    const cached = await staleWhileRevalidate(routeCacheKey(input), 24 * 60 * 60_000, () => {
      const path = `${input.origin.lat},${input.origin.lng}:${input.destination.lat},${input.destination.lng}`
      const params = new URLSearchParams({ key: env.TOMTOM_API_KEY!, traffic: "true", travelMode })
      return fetchJsonWithTimeout(`https://api.tomtom.com/routing/1/calculateRoute/${path}/json?${params}`, {}, timeoutMs(env))
    })
    return { ok: true, data: normalizeTomTom(cached.value), source: source("tomtom", "TomTom Routing API", "https://developer.tomtom.com/routing-api/documentation/tomtom-orbis-maps/v3/calculate-route", cached.fromCache, cached.stale), warnings: cached.stale ? ["上游暂不可用，正在显示最后成功路线"] : undefined }
  } catch (error) {
    const safe = safeProviderError(error)
    return providerFailure("tomtom", safe.code, safe.message, true)
  }
}

export async function handleRoute(request: Request, env: Env) {
  let input: RouteRequest
  try { input = await request.json<RouteRequest>() } catch { return json({ error: "请求体必须是 RouteRequest JSON" }, 400) }
  if (!input || typeof input.countryCode !== "string" || !isPoint(input.origin) || !isPoint(input.destination) || !["driving", "walking", "cycling", "transit"].includes(input.mode)) return json({ error: "RouteRequest 参数无效" }, 400)
  const result = input.countryCode.toUpperCase() === "CN" ? await amapRoute(input, env) : await tomTomRoute(input, env)
  return json(result, result.ok ? 200 : result.code === "MISSING_SECRET" ? 503 : 502)
}

export async function handlePlaceSearch(request: Request, env: Env) {
  const url = new URL(request.url)
  const countryCode = (url.searchParams.get("countryCode") || "").toUpperCase()
  const query = (url.searchParams.get("q") || "").trim()
  if (!countryCode || !query) return json({ error: "countryCode 和 q 为必填项" }, 400)
  if (countryCode !== "CN") return handleOsmPlaceSearch(url, countryCode, query, env)
  if (!env.AMAP_WEB_SERVICE_KEY) return json(providerFailure("amap", "MISSING_SECRET", "中国 POI 服务暂未配置", false), 503)
  if (!canUseProvider("amap", env.AMAP_DAILY_SOFT_LIMIT)) return json(providerFailure("amap", "RATE_LIMITED", "高德调用已达到当前软阈值", true), 429)
  try {
    const cacheKey = `amap-place:v1:${query}:${url.searchParams.get("lat") || ""}:${url.searchParams.get("lng") || ""}`
    const cached = await staleWhileRevalidate(cacheKey, 24 * 60 * 60_000, () => {
      const params = new URLSearchParams({ key: env.AMAP_WEB_SERVICE_KEY!, keywords: query, show_fields: "business,photos,children" })
      const lat = Number(url.searchParams.get("lat")); const lng = Number(url.searchParams.get("lng"))
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        const [gcjLat, gcjLng] = wgs84ToGcj02(lat, lng)
        params.set("location", `${gcjLng.toFixed(6)},${gcjLat.toFixed(6)}`)
      }
      return fetchJsonWithTimeout(`https://restapi.amap.com/v5/place/text?${params}`, {}, timeoutMs(env))
    })
    const payload: any = cached.value
    const pois = Array.isArray(payload?.pois) ? payload.pois.map((poi: any) => {
      const [lng, lat] = String(poi.location || ",").split(",").map(Number)
      return { id: `amap:${poi.id}`, name: poi.name, countryCode: "CN", latitude: lat, longitude: lng, address: poi.address || undefined, categories: String(poi.type || "").split(";").filter(Boolean), phone: poi.tel || undefined, website: poi.website || undefined, openingHoursReference: poi.business?.opentime || undefined }
    }).filter((poi: { latitude: number; longitude: number }) => Number.isFinite(poi.latitude) && Number.isFinite(poi.longitude)) : []
    return json({ ok: true, data: pois, source: source("amap", "高德 Web 服务 · POI 搜索", "https://lbs.amap.com/api/webservice/summary", cached.fromCache, cached.stale), warnings: cached.stale ? ["上游暂不可用，正在显示缓存 POI"] : undefined })
  } catch (error) {
    const safe = safeProviderError(error)
    return json(providerFailure("amap", safe.code, safe.message, true), 502)
  }
}

/**
 * Public Overpass is intentionally limited to explicit searches near a point.
 * Results are cached for a day; it is never used as keystroke autocomplete.
 */
async function handleOsmPlaceSearch(url: URL, countryCode: string, query: string, env: Env) {
  const lat = Number(url.searchParams.get("lat"))
  const lng = Number(url.searchParams.get("lng"))
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return json({ error: "境外 OSM 搜索需要 WGS-84 lat 和 lng" }, 400)
  if (!canUseProvider("osm-overpass", env.OVERPASS_DAILY_SOFT_LIMIT)) return json(providerFailure("osm-overpass", "RATE_LIMITED", "Overpass 调用已达到当前软阈值，正在使用缓存或等待恢复", true), 429)
  try {
    const cacheKey = `osm-place:v1:${countryCode}:${escapeOverpassText(query)}:${lat.toFixed(3)}:${lng.toFixed(3)}`
    const cached = await staleWhileRevalidate(cacheKey, 24 * 60 * 60_000, async () => {
      const safeQuery = escapeOverpassText(query)
      const overpass = `[out:json][timeout:15];(nwr["name"~"${safeQuery}",i](around:5000,${lat},${lng}););out center tags 20;`
      const init = { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "Family-Atlas/1.0 (destination POI lookup)" }, body: new URLSearchParams({ data: overpass }) }
      const endpoints = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]
      let lastError: unknown
      for (const endpoint of endpoints) {
        try { return await fetchJsonWithTimeout(endpoint, init, Math.max(timeoutMs(env), 15_000)) }
        catch (error) { lastError = error }
      }
      throw lastError
    })
    const payload = cached.value as { elements?: Array<{ type: string; id: number; lat?: number; lon?: number; center?: { lat?: number; lon?: number }; tags?: Record<string, string> }> }
    const pois = (payload.elements || []).flatMap(element => {
      const latitude = element.lat ?? element.center?.lat
      const longitude = element.lon ?? element.center?.lon
      const tags = element.tags || {}
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !tags.name) return []
      return [{ id: osmPlaceId(element), name: tags.name, countryCode, latitude, longitude, address: [tags["addr:full"], tags["addr:street"], tags["addr:city"]].filter(Boolean).join(", ") || undefined, categories: [tags.tourism, tags.amenity, tags.leisure, tags.shop].filter(Boolean), phone: tags.phone || tags["contact:phone"] || undefined, website: tags.website || tags["contact:website"] || undefined, openingHoursReference: tags.opening_hours || undefined, openingHoursNotice: tags.opening_hours ? "参考营业时间 · 来源 OpenStreetMap · 建议出发前查看官方公告" : undefined }]
    })
    return json({ ok: true, data: pois, source: { provider: "osm-overpass", sourceName: "OpenStreetMap / Overpass", sourceUrl: "https://www.openstreetmap.org/copyright", confidence: "map_provider", fetchedAt: new Date().toISOString(), fromCache: cached.fromCache, stale: cached.stale }, attribution: "© OpenStreetMap contributors", attributionUrl: "https://www.openstreetmap.org/copyright", warnings: cached.stale ? ["Overpass 暂不可用，正在显示缓存 POI"] : [] })
  } catch (error) {
    const safe = safeProviderError(error)
    return json(providerFailure("osm-overpass", safe.code, safe.message, true), 502)
  }
}

export async function handleAdvisories(request: Request) {
  const destinationCode = new URL(request.url).searchParams.get("destinationCode") || ""
  if (!destinationCode) return json({ error: "destinationCode 为必填项" }, 400)
  const sources = officialSourcesFor(destinationCode)
  return json({ destinationCode, audience: "chinese_traveler", advisories: [], sourceRecords: sources, note: "首批官方来源已配置；各站点完成 robots/条款审查后才启用单站 Adapter。英国政府来源仅作为第二参考，不会标记为中国官方建议。" })
}
