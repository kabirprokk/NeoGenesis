const BASE = "";
export async function loadSave(playerId: string) {
  try {
    const r = await fetch(`${BASE}/api/saves/${playerId}`);
    if (!r.ok) return null;
    return await r.json();
  } catch { return JSON.parse(localStorage.getItem(`neo-save-${playerId}`) ?? "null"); }
}
export async function storeSave(save: Record<string, unknown>) {
  try {
    const r = await fetch(`${BASE}/api/saves`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(save) });
    if (!r.ok) throw new Error("api");
  } catch {
    localStorage.setItem(`neo-save-${(save as { playerId: string }).playerId}`, JSON.stringify(save));
  }
}
export async function addJournal(entry: Record<string, unknown>) {
  try {
    await fetch(`${BASE}/api/journal`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entry) });
  } catch { /* offline — kept in-memory */ }
}
