/**
 * Shared scrape proxy helpers for Vite middleware and Cloudflare Worker.
 * Only allowlisted tourism / open-data hosts may be fetched.
 */

export const SCRAPE_ALLOWLIST = [
  "www.visit-hokkaido.jp",
  "visit-hokkaido.jp",
  "www.japan.travel",
  "www.visitokinawa.jp",
  "www.visiticeland.com",
  "safetravel.is",
  "www.myswitzerland.com",
  "www.visitnorway.com",
  "www.visittuscany.com",
  "www.newzealand.com",
  "www.queensland.com",
  "www2.gbrmpa.gov.au",
  "www.indonesia.travel",
  "www.tourismthailand.org",
  "www.nps.gov",
  "www.visitcalifornia.com",
  "parks.canada.ca",
  "www.visitbrasil.com",
  "www.argentina.travel",
  "www.peru.travel",
  "chile.travel",
  "www.southafrica.net",
  "www.sanparks.org",
  "egypt.travel",
  "www.visitmorocco.com",
  "magicalkenya.com",
  "www.tanzaniatourism.go.tz",
  "www.tanzaniaparks.go.tz",
  "wlt.xinjiang.gov.cn",
  "en.wikipedia.org",
  "zh.wikipedia.org",
  "overpass-api.de",
  "overpass.kumi.systems",
]

export function isAllowlisted(urlString) {
  try {
    const host = new URL(urlString).hostname.toLowerCase()
    return SCRAPE_ALLOWLIST.some(allowed => host === allowed || host.endsWith(`.${allowed}`))
  } catch {
    return false
  }
}

export async function proxyFetch(urlString, requestInit = {}) {
  if (!isAllowlisted(urlString)) {
    return new Response(JSON.stringify({ error: "host_not_allowlisted", url: urlString }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    })
  }

  const method = (requestInit.method || "GET").toUpperCase()
  const headers = {
    "User-Agent": "FamilyAtlasBot/1.0 (+https://github.com/local/traversal; tourism data research)",
    Accept: requestInit.headers?.Accept || "*/*",
  }
  if (requestInit.headers?.["Content-Type"]) headers["Content-Type"] = requestInit.headers["Content-Type"]

  const upstream = await fetch(urlString, {
    method,
    headers,
    body: method === "GET" || method === "HEAD" ? undefined : requestInit.body,
    redirect: "follow",
  })

  const body = await upstream.arrayBuffer()
  const responseHeaders = new Headers()
  const contentType = upstream.headers.get("content-type")
  if (contentType) responseHeaders.set("Content-Type", contentType)
  responseHeaders.set("Access-Control-Allow-Origin", "*")
  responseHeaders.set("Cache-Control", "public, max-age=300")
  responseHeaders.set("X-Scrape-Proxy", "family-atlas")

  return new Response(body, { status: upstream.status, headers: responseHeaders })
}
