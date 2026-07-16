-- M1 Journey + homepage state. All timestamps are ISO-8601 UTC strings.

CREATE TABLE IF NOT EXISTS journeys (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'planning', 'preparing', 'ready', 'ongoing', 'completed', 'archived')),
  departure_at TEXT,
  destination_label TEXT,
  preparedness INTEGER NOT NULL DEFAULT 0 CHECK (preparedness >= 0 AND preparedness <= 100),
  pending_item_count INTEGER NOT NULL DEFAULT 0 CHECK (pending_item_count >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS journeys_active_departure_idx
  ON journeys(status, departure_at);

CREATE TABLE IF NOT EXISTS home_preferences (
  id TEXT PRIMARY KEY,
  is_first_visit INTEGER NOT NULL DEFAULT 1 CHECK (is_first_visit IN (0, 1)),
  departure_threshold_hours INTEGER NOT NULL DEFAULT 72 CHECK (departure_threshold_hours > 0),
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO home_preferences (id, is_first_visit, departure_threshold_hours, updated_at)
VALUES ('default', 1, 72, '2026-07-16T00:00:00Z');
