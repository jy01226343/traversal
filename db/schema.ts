/**
 * Drizzle ORM schema for Cloudflare D1 (SQLite).
 *
 * M0 阶段：仅建迁移元表 + kv 测试表，验证 D1 连通。
 * M1 起逐步加入业务表：Journey / Member / Track / Media / MemoryNode / ShareCopy 等。
 *
 * Drizzle Kit 配置见 drizzle.config.ts；生成迁移用 `npm run db:generate`。
 */
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"

/**
 * 迁移元表：记录已执行的迁移，便于幂等性检查。
 */
export const migrations = sqliteTable("migrations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  appliedAt: text("applied_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
})

/**
 * KV 测试表：验证 D1 读写连通，M1 可删除。
 */
export const kv = sqliteTable("kv", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
})
