/**
 * Cloudflare Pages Function: /api/v1/*
 *
 * 健康检查端点，验证 Workers + D1 + R2 绑定链路。
 * M0 骨架：仅返回状态；M1 起加入业务路由（home/destination/journey/memory/share/sync）。
 */
import type { D1Database, R2Bucket } from "@cloudflare/workers-types"

interface Env {
  DB?: D1Database
  MEDIA?: R2Bucket
  ENV?: string
  APP_VERSION?: string
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context
  const checks: Record<string, { ok: boolean; detail?: string }> = {}

  // D1 连通检查（binding 可能未激活）
  if (env.DB) {
    try {
      const result = await env.DB.prepare("SELECT value FROM kv WHERE key = ?")
        .bind("seed")
        .first<{ value: string }>()
      checks.d1 = { ok: Boolean(result), detail: result?.value }
    } catch (e) {
      checks.d1 = { ok: false, detail: e instanceof Error ? e.message : String(e) }
    }
  } else {
    checks.d1 = { ok: false, detail: "binding not activated (see wrangler.toml)" }
  }

  // R2 绑定检查
  checks.r2 = { ok: Boolean(env.MEDIA), detail: env.MEDIA ? "bound" : "not activated" }

  const allOk = Object.values(checks).every((c) => c.ok)

  return new Response(
    JSON.stringify({
      ok: allOk,
      service: "family-atlas",
      version: env.APP_VERSION || "0.1.0",
      env: env.ENV || "unknown",
      timestamp: new Date().toISOString(),
      checks,
    }),
    {
      status: allOk ? 200 : 503,
      headers: { "content-type": "application/json" },
    },
  )
}
