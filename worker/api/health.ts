/**
 * 健康检查端点（Workers 模式）。
 * 验证 D1 + R2 binding 链路。binding 未激活时优雅降级。
 */
import type { Env } from "../index"

export async function handleHealth(request: Request, env: Env): Promise<Response> {
  const checks: Record<string, { ok: boolean; detail?: string }> = {}

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
