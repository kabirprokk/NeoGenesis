// NeoGenesis web storage — fully browser-local. No server, no Docker.
// Saves + journal live in localStorage, keyed by playerId.
const saveKey = (playerId: string) => `neo-save-${playerId}`;
const journalKey = (playerId: string) => `neo-journal-${playerId}`;

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or unavailable (private mode) — game keeps running in-memory
  }
}

export async function loadSave(playerId: string): Promise<Record<string, any> | null> {
  return readJson<Record<string, any>>(saveKey(playerId));
}

export async function storeSave(save: Record<string, unknown>) {
  writeJson(saveKey(String((save as { playerId: string }).playerId)), save);
}

export async function loadJournal(playerId: string) {
  return readJson<Record<string, unknown>[]>(journalKey(playerId)) ?? [];
}

export async function addJournal(entry: Record<string, unknown>) {
  const pid = String((entry as { playerId: string }).playerId ?? "last-human");
  const list = readJson<Record<string, unknown>[]>(journalKey(pid)) ?? [];
  list.push({ ...entry, createdAt: new Date().toISOString() });
  writeJson(journalKey(pid), list.slice(-100));
}
