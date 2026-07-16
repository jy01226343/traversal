/**
 * Worker 入口：Workers 模式下托管静态资源 + 路由 API。
 *
 * 部署在 *.workers.dev（Workers Static Assets 模式）。
 * - 静态资源：由 [assets] binding 托管，SPA fallback 处理前端路由
 * - API：本 Worker 的 fetch handler 处理 /api/* 路径
 *
 * 等价于 Pages Functions 的 functions/api/ 目录，但用显式 Worker 入口。
 */
import { handleHealth } from "./api/health"
import { handleDestinationLive } from "./api/destination-live"
import { handleCreateJourney, handleHomeContext, handleHomePreference, handleJourneyStops, handleUpdateJourney } from "./api/home"
import { handleScrapeProxy } from "./api/scrape-proxy"

export interface Env {
  DB?: D1Database
  MEDIA?: R2Bucket
  ASSETS: Fetcher
  ENV?: string
  APP_VERSION?: string
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    // API 路由
    if (path.startsWith("/api/")) {
      try {
        if (path === "/api/v1/health") {
          return await handleHealth(request, env)
        }
        if (path === "/api/v1/home/context" && request.method === "GET") {
          return await handleHomeContext(request, env)
        }
        if (path === "/api/v1/home/preference" && request.method === "PUT") {
          return await handleHomePreference(request, env)
        }
        if (path === "/api/v1/destinations/live" && request.method === "GET") {
          return await handleDestinationLive(request, env)
        }
        if (path === "/api/v1/journeys" && request.method === "POST") {
          return await handleCreateJourney(request, env)
        }
        const journeyMatch = path.match(/^\/api\/v1\/journeys\/([^/]+)$/)
        if (journeyMatch && request.method === "PATCH") {
          return await handleUpdateJourney(request, env, decodeURIComponent(journeyMatch[1]))
        }
        const journeyStopsMatch = path.match(/^\/api\/v1\/journeys\/([^/]+)\/stops$/)
        if (journeyStopsMatch && (request.method === "GET" || request.method === "POST")) {
          return await handleJourneyStops(request, env, decodeURIComponent(journeyStopsMatch[1]))
        }
        if (path === "/api/scrape-proxy") {
          return await handleScrapeProxy(request, url)
        }
        return new Response(JSON.stringify({ error: "not found" }), {
          status: 404,
          headers: { "content-type": "application/json" },
        })
      } catch (e) {
        return new Response(
          JSON.stringify({ error: e instanceof Error ? e.message : "internal error" }),
          { status: 500, headers: { "content-type": "application/json" } },
        )
      }
    }

    // 非 API 路径交给 assets binding（由 [assets] 配置自动处理）
    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
