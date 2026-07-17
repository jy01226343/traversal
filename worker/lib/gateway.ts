export type ProviderCode = "MISSING_SECRET" | "TIMEOUT" | "RATE_LIMITED" | "UPSTREAM_ERROR" | "PARSE_ERROR" | "UNSUPPORTED_REGION" | "STALE_CACHE_ONLY"

export interface SourceMeta {
  provider: string
  sourceName: string
  sourceUrl?: string
  authorityCountry?: string
  audience?: "chinese_traveler" | "uk_traveler" | "destination_public" | "general"
  confidence: "official" | "map_provider" | "secondary" | "manual"
  fetchedAt: string
  publishedAt?: string
  expiresAt?: string
  fromCache: boolean
  stale: boolean
}

export type ProviderResult<T> = { ok: true; data: T; source: SourceMeta; warnings?: string[] } | { ok: false; provider: string; code: ProviderCode; message: string; retryable: boolean; staleDataAvailable: boolean }

interface CacheEnvelope<T> { expiresAt: number; value: T }
const usage = new Map<string, number>()

export function providerFailure(provider: string, code: ProviderCode, message: string, retryable = false, staleDataAvailable = false): ProviderResult<never> {
  return { ok: false, provider, code, message, retryable, staleDataAvailable }
}

export async function fetchJsonWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController()
  let timeout: ReturnType<typeof setTimeout> | undefined
  const timedOut = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      controller.abort()
      reject(new Error("UPSTREAM_TIMEOUT"))
    }, timeoutMs)
  })
  try {
    const request = fetch(url, { ...init, signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return response.json<unknown>()
    })
    // In some edge runtimes aborting a fetch does not immediately settle its
    // promise. Racing the request ensures the caller still gets a bounded,
    // retryable failure while the underlying connection is released.
    return await Promise.race([request, timedOut])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

/** Cache keys deliberately never contain upstream query strings or secrets. */
export async function staleWhileRevalidate<T>(cacheKey: string, ttlMs: number, load: () => Promise<T>) {
  const cache = caches.default
  const request = new Request(`https://family-atlas-cache.invalid/${encodeURIComponent(cacheKey)}`)
  const cached = await cache.match(request)
  let previous: CacheEnvelope<T> | null = null
  if (cached) previous = await cached.json<CacheEnvelope<T>>()
  if (previous && previous.expiresAt > Date.now()) return { value: previous.value, fromCache: true, stale: false }
  try {
    const value = await load()
    const envelope: CacheEnvelope<T> = { value, expiresAt: Date.now() + ttlMs }
    await cache.put(request, new Response(JSON.stringify(envelope), { headers: { "content-type": "application/json" } }))
    return { value, fromCache: false, stale: false }
  } catch (error) {
    if (previous) return { value: previous.value, fromCache: true, stale: true }
    throw error
  }
}

export function canUseProvider(provider: string, softLimit: string | undefined) {
  const limit = Number(softLimit)
  const count = (usage.get(provider) || 0) + 1
  usage.set(provider, count)
  return !Number.isFinite(limit) || limit <= 0 || count <= limit
}

export function safeProviderError(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") return { code: "TIMEOUT" as const, message: "上游请求超时" }
  return { code: "UPSTREAM_ERROR" as const, message: "上游服务暂不可用" }
}
