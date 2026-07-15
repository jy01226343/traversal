import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { fileURLToPath, URL } from "node:url"
import { attractionScrapePlugin } from "./scripts/vite-scrape-plugin.mjs"

export default defineConfig({
  plugins: [react(), tailwindcss(), attractionScrapePlugin()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
})
