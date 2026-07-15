/**
 * Cloudflare Pages Function: /api/scrape-proxy?url=...
 * Mirrors the Vite dev scrape proxy for production deploys.
 */
const ALLOWLIST = [
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

function allowed(urlString: string) {
  try {
    const host = new URL(urlString).hostname.toLowerCase()
    return ALLOWLIST.some(item => host === item || host.endsWith(`.${item}`))
  } catch {
    return false
  }
}

export const onRequest: PagesFunction = async context => {
  const request = context.request
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Accept",
      },
    })
  }

  const target = new URL(request.url).searchParams.get("url")
  if (!target) {
    return new Response(JSON.stringify({ error: "missing_url" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }
  if (!allowed(target)) {
    return new Response(JSON.stringify({ error: "host_not_allowlisted" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    })
  }

  try {
    const init: RequestInit = {
      method: request.method,
      headers: {
        "User-Agent": "FamilyAtlasBot/1.0 (+tourism data research)",
        Accept: request.headers.get("Accept") || "*/*",
      },
      redirect: "follow",
    }
    if (request.method === "POST") {
      init.body = await request.arrayBuffer()
      const contentType = request.headers.get("Content-Type")
      if (contentType) (init.headers as Record<string, string>)["Content-Type"] = contentType
    }

    const upstream = await fetch(target, init)
    const headers = new Headers(upstream.headers)
    headers.set("Access-Control-Allow-Origin", "*")
    headers.set("Cache-Control", "public, max-age=300")
    headers.set("X-Scrape-Proxy", "family-atlas-pages")
    return new Response(upstream.body, { status: upstream.status, headers })
  } catch (error) {
    return new Response(JSON.stringify({ error: "proxy_failed", message: String(error) }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    })
  }
}
