// NeoGenesis backend — Fastify + WS. One human per playerId; no NPC endpoints by design.
import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import pg from "pg";
import Redis from "ioredis";
import { tickCohorts } from "../../../shared/src/ecology.js";

const PORT = Number(process.env.PORT ?? 3001);
const DATABASE_URL = process.env.DATABASE_URL ?? "postgres://neo:genesis@localhost:5432/neogenesis";
const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

const db = new pg.Pool({ connectionString: DATABASE_URL });
db.on("error", (e) => console.warn("[db] pool error (running offline?):", e.message));
let redis: Redis | null = null;
try {
  redis = new Redis(REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
  redis.connect().catch(() => { redis = null; });
} catch { redis = null; }

// In-memory fallback when Postgres is unreachable (frontend still works).
const mem = new Map<string, Record<string, unknown>>();
const journals: Record<string, unknown>[] = [];

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });
await app.register(websocket);

async function hasDb(): Promise<boolean> {
  try { await db.query("SELECT 1"); return true; } catch { return false; }
}

app.get("/api/health", async () => ({ ok: true, oneHuman: true, time: new Date().toISOString() }));

// --- Saves ---
app.get("/api/saves/:playerId", async (req) => {
  const { playerId } = req.params as { playerId: string };
  if (await hasDb()) {
    const r = await db.query(
      `SELECT player_id, ST_X(pos::geometry) lon, ST_Y(pos::geometry) lat,
              health, hunger, thirst, stamina, sleep, body_temp_c, inventory, era_preset, epoch_ms
       FROM saves WHERE player_id=$1`, [playerId]);
    if (r.rows.length) return r.rows[0];
  }
  return (mem.get(playerId) as never) ?? null;
});

app.post("/api/saves", async (req) => {
  const s = req.body as Record<string, unknown>;
  const pid = String(s.playerId ?? "last-human");
  if (await hasDb()) {
    await db.query(`INSERT INTO players(id) VALUES($1) ON CONFLICT DO NOTHING`, [pid]);
    await db.query(
      `INSERT INTO saves(player_id, pos, health, hunger, thirst, stamina, sleep, body_temp_c, inventory, era_preset, epoch_ms, updated_at)
       VALUES($1, ST_GeogFromText('SRID=4326;POINTZ(' || $2 || ' ' || $3 || ' ' || $4 || ')'),
              $5,$6,$7,$8,$9,$10,$11,$12,$13, now())
       ON CONFLICT (player_id) DO UPDATE SET pos=EXCLUDED.pos, health=EXCLUDED.health,
         hunger=EXCLUDED.hunger, thirst=EXCLUDED.thirst, stamina=EXCLUDED.stamina, sleep=EXCLUDED.sleep,
         body_temp_c=EXCLUDED.body_temp_c, inventory=EXCLUDED.inventory, era_preset=EXCLUDED.era_preset,
         epoch_ms=EXCLUDED.epoch_ms, updated_at=now()`,
      [pid, s.lon ?? 8, s.lat ?? 12.5, s.alt ?? 0, s.health ?? 100, s.hunger ?? 100, s.thirst ?? 100,
       s.stamina ?? 100, s.sleep ?? 100, s.bodyTempC ?? 37, JSON.stringify(s.inventory ?? {}),
       s.eraPreset ?? "alternate-prehuman-earth", s.epochMs ?? Date.now()]);
  } else mem.set(pid, s);
  if (redis) await redis.set(`save:${pid}`, JSON.stringify(s), "EX", 3600).catch(() => {});
  return { ok: true };
});

// --- Journal ---
app.post("/api/journal", async (req) => {
  const e = req.body as Record<string, unknown>;
  journals.push(e);
  if (await hasDb()) {
    await db.query(`INSERT INTO players(id) VALUES($1) ON CONFLICT DO NOTHING`, [String(e.playerId ?? "last-human")]);
    await db.query(
      `INSERT INTO journal_entries(player_id, title, body, pos) VALUES($1,$2,$3,
        CASE WHEN $4::float IS NOT NULL THEN ST_GeogFromText('SRID=4326;POINT(' || $5 || ' ' || $4 || ')') END)`,
      [String(e.playerId ?? "last-human"), String(e.title ?? ""), String(e.body ?? ""),
       e.lat ?? null, e.lon ?? null]);
  }
  return { ok: true };
});
app.get("/api/journal/:playerId", async (req) => {
  const { playerId } = req.params as { playerId: string };
  if (await hasDb()) {
    const r = await db.query(`SELECT title, body, ST_Y(pos::geometry) lat, ST_X(pos::geometry) lon, created_at at
      FROM journal_entries WHERE player_id=$1 ORDER BY created_at DESC LIMIT 100`, [playerId]);
    return r.rows;
  }
  return journals.filter((j) => (j as { playerId: string }).playerId === playerId);
});

// --- Discoveries ---
app.post("/api/discoveries", async (req) => {
  const d = req.body as Record<string, unknown>;
  if (await hasDb()) {
    const r = await db.query(
      `INSERT INTO discoveries(player_id, kind, name, pos, data) VALUES($1,$2,$3,
        ST_GeogFromText('SRID=4326;POINT(' || $4 || ' ' || $5 || ')'), $6) RETURNING id, found_at`,
      [String(d.playerId), String(d.kind), String(d.name), d.lon, d.lat, JSON.stringify(d.data ?? {})]);
    return r.rows[0];
  }
  return { id: `mem-${Date.now()}`, found_at: new Date().toISOString() };
});

// --- Species catalog (static defs; sightings recorded, never NPCs) ---
app.get("/api/species", async () => {
  const { SPECIES, FOOD_WEB } = await import("../../../shared/src/ecology.js");
  return { foodWeb: FOOD_WEB, species: SPECIES };
});

// --- Regional eco tick (REGIONAL/GLOBAL cohorts; LOCAL stays client-side) ---
app.post("/api/eco/tick", async (req) => {
  const b = req.body as { dtDays?: number; carryingCapacity?: number; cohorts?: { speciesId: string; cellKey: string; count: number; biomassKg: number; trend: number }[] };
  const out = tickCohorts({ dtDays: b.dtDays ?? 1, carryingCapacity: b.carryingCapacity ?? 100, cohorts: b.cohorts ?? [] });
  return { cohorts: out };
});

// --- WebSocket: per-player room (future multiplayer would add presence here; forbidden now) ---
app.get("/ws", { websocket: true }, (socket) => {
  socket.send(JSON.stringify({ type: "welcome", oneHuman: true }));
  socket.on("message", (raw) => {
    try {
      const msg = JSON.parse(String(raw));
      if (msg.type === "eco-delta" && redis) void redis.publish(`player:${msg.playerId}`, String(raw));
      socket.send(JSON.stringify({ type: "ack", t: Date.now() }));
    } catch { /* ignore */ }
  });
});

app.listen({ port: PORT, host: "0.0.0.0" }).then(() => console.log(`[neo] backend :${PORT}`));
