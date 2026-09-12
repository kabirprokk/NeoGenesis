-- NeoGenesis schema: PostgreSQL + PostGIS. Never stores terrain vertices.
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS saves (
  player_id TEXT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  pos GEOGRAPHY(PointZ, 4326) NOT NULL,
  health REAL NOT NULL DEFAULT 100, hunger REAL NOT NULL DEFAULT 100,
  thirst REAL NOT NULL DEFAULT 100, stamina REAL NOT NULL DEFAULT 100,
  sleep REAL NOT NULL DEFAULT 100, body_temp_c REAL NOT NULL DEFAULT 37,
  inventory JSONB NOT NULL DEFAULT '{}',
  era_preset TEXT NOT NULL DEFAULT 'alternate-prehuman-earth',
  epoch_ms BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS discoveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  kind TEXT NOT NULL, name TEXT NOT NULL,
  pos GEOGRAPHY(Point, 4326) NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  found_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS discoveries_player_idx ON discoveries(player_id);
CREATE INDEX IF NOT EXISTS discoveries_pos_gix ON discoveries USING GIST (pos);

CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  title TEXT NOT NULL, body TEXT NOT NULL DEFAULT '',
  pos GEOGRAPHY(Point, 4326),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS journal_player_idx ON journal_entries(player_id);

CREATE TABLE IF NOT EXISTS species_sightings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  species_id TEXT NOT NULL,
  pos GEOGRAPHY(Point, 4326) NOT NULL,
  seen_at TIMESTAMPTZ DEFAULT now()
);

-- World-state blobs per region cell (REGIONAL/GLOBAL eco caches), NOT per-vertex.
CREATE TABLE IF NOT EXISTS region_state (
  cell_key TEXT PRIMARY KEY,
  cohorts JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT now()
);
