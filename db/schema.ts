/**
 * Drizzle ORM schema for Cloudflare D1 (SQLite).
 *
 * M0 阶段：仅建迁移元表 + kv 测试表，验证 D1 连通。
 * M1 起逐步加入业务表：Journey / Member / Track / Media / MemoryNode / ShareCopy 等。
 *
 * Drizzle Kit 配置见 drizzle.config.ts；生成迁移用 `npm run db:generate`。
 */
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core"

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

/** M1：单用户 Journey 记录；后续多成员版本再引入 owner/member 关系。 */
export const journeys = sqliteTable("journeys", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  status: text("status", { enum: ["draft", "planning", "preparing", "ready", "ongoing", "completed", "archived"] }).notNull(),
  departureAt: text("departure_at"),
  destinationLabel: text("destination_label"),
  preparedness: integer("preparedness").notNull().default(0),
  pendingItemCount: integer("pending_item_count").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
})

/** User-defined route order for a Journey; this is the only map sequence source. */
export const journeyStops = sqliteTable("journey_stops", {
  id: text("id").primaryKey(),
  journeyId: text("journey_id").notNull(),
  attractionId: text("attraction_id"),
  label: text("label").notNull(),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  stopOrder: integer("stop_order").notNull(),
  createdAt: text("created_at").notNull(),
})

/** There is one local profile today; this table becomes user-scoped in M6. */
export const homePreferences = sqliteTable("home_preferences", {
  id: text("id").primaryKey(),
  isFirstVisit: integer("is_first_visit", { mode: "boolean" }).notNull().default(true),
  departureThresholdHours: integer("departure_threshold_hours").notNull().default(72),
  updatedAt: text("updated_at").notNull(),
})
