-- Journey stops are user-authored route order, never recommendation ranking.

CREATE TABLE IF NOT EXISTS journey_stops (
  id TEXT PRIMARY KEY,
  journey_id TEXT NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  attraction_id TEXT,
  label TEXT NOT NULL,
  latitude REAL NOT NULL CHECK (latitude >= -90 AND latitude <= 90),
  longitude REAL NOT NULL CHECK (longitude >= -180 AND longitude <= 180),
  stop_order INTEGER NOT NULL CHECK (stop_order >= 1),
  created_at TEXT NOT NULL,
  UNIQUE(journey_id, attraction_id),
  UNIQUE(journey_id, stop_order)
);

CREATE INDEX IF NOT EXISTS journey_stops_journey_order_idx
  ON journey_stops(journey_id, stop_order);
