import { defineConfig } from "drizzle-kit"

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "sqlite",
  // 生成迁移文件（.sql）供 wrangler d1 migrations apply 使用
})
