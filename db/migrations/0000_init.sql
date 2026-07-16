-- Migration 0000_init: M0 脚手架表（迁移元表 + kv 测试表）
-- 业务表（Journey/Member/Track/Media/MemoryNode/ShareCopy）在 M1 加入。

CREATE TABLE IF NOT EXISTS migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS kv (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 写入一条种子数据验证连通
INSERT OR IGNORE INTO kv (key, value, updated_at) VALUES ('seed', 'family-atlas-m0', '2026-07-16T00:00:00Z');
