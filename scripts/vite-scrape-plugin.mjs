import { isAllowlisted, proxyFetch } from "./attraction-scrape-proxy.mjs"

/**
 * Vite middleware:
 *   GET|POST /api/scrape-proxy?url=<encoded absolute url>
 * Proxies only allowlisted tourism/open-data hosts so the browser crawler can run.
 */
export function attractionScrapePlugin() {
  return {
    name: "attraction-scrape-proxy",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          const url = new URL(req.url || "/", "http://localhost")
          if (url.pathname !== "/api/scrape-proxy") return next()

          if (req.method === "OPTIONS") {
            res.statusCode = 204
            res.setHeader("Access-Control-Allow-Origin", "*")
            res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
            res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept")
            res.end()
            return
          }

          const target = url.searchParams.get("url")
          if (!target) {
            res.statusCode = 400
            res.setHeader("Content-Type", "application/json")
            res.end(JSON.stringify({ error: "missing_url" }))
            return
          }
          if (!isAllowlisted(target)) {
            res.statusCode = 403
            res.setHeader("Content-Type", "application/json")
            res.end(JSON.stringify({ error: "host_not_allowlisted", host: new URL(target).hostname }))
            return
          }

          let body
          if (req.method === "POST") {
            body = await new Promise((resolve, reject) => {
              const chunks = []
              req.on("data", chunk => chunks.push(chunk))
              req.on("end", () => resolve(Buffer.concat(chunks)))
              req.on("error", reject)
            })
          }

          const contentType = req.headers["content-type"]
          const proxied = await proxyFetch(target, {
            method: req.method,
            headers: {
              Accept: req.headers.accept || "*/*",
              ...(contentType ? { "Content-Type": contentType } : {}),
            },
            body,
          })

          res.statusCode = proxied.status
          proxied.headers.forEach((value, key) => {
            if (key.toLowerCase() === "transfer-encoding") return
            res.setHeader(key, value)
          })
          const buffer = Buffer.from(await proxied.arrayBuffer())
          res.end(buffer)
        } catch (error) {
          res.statusCode = 502
          res.setHeader("Content-Type", "application/json")
          res.end(JSON.stringify({ error: "proxy_failed", message: String(error?.message || error) }))
        }
      })
    },
  }
}
