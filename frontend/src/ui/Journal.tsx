import React, { useState } from "react";
import { addJournal } from "../api/client.js";

export interface JEntry { title: string; body: string; lat: number; lon: number; at: string }
export function Journal({ open, onClose, entries, onAdd, lat, lon, playerId }:
  { open: boolean; onClose: () => void; entries: JEntry[]; onAdd: (e: JEntry) => void; lat: number; lon: number; playerId: string }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  if (!open) return null;
  return (
    <div className="panel">
      <h2>Field Journal</h2>
      <p style={{ opacity: 0.7, fontSize: 13 }}>Your record of the journey. No quest markers — only what you observe.</p>
      <input placeholder="Observation title…" value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea rows={3} placeholder="Materials, heat, impacts, measurements…" value={body} onChange={(e) => setBody(e.target.value)} />
      <button onClick={() => {
        if (!title.trim()) return;
        const e = { title, body, lat, lon, at: new Date().toISOString() };
        onAdd(e); void addJournal({ playerId, ...e }); setTitle(""); setBody("");
      }}>Record observation</button>
      <button onClick={onClose}>Close (J)</button>
      <hr />
      {entries.length === 0 && <p style={{ opacity: 0.6 }}>Nothing recorded yet. The world is waiting.</p>}
      {entries.map((e, i) => (
        <div key={i} style={{ marginBottom: 12 }}>
          <b>{e.title}</b> <span style={{ opacity: 0.6, fontSize: 12 }}>{e.at.slice(0, 16)} · {e.lat.toFixed(3)}°, {e.lon.toFixed(3)}°</span>
          <div style={{ fontSize: 14 }}>{e.body}</div>
        </div>
      ))}
    </div>
  );
}
