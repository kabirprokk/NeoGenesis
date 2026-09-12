import React, { useEffect, useRef, useState } from "react";
import { execCommand, watchBus, type GameCtx } from "./terminalCore.js";

export function Terminal({ open, getCtx }: { open: boolean; getCtx: () => GameCtx | null }) {
  const [lines, setLines] = useState<string[]>([
    "NEOGENESIS terminal — type `help`. Ask me with `ai <question>`.",
  ]);
  const [value, setValue] = useState("");
  const [hist, setHist] = useState<string[]>([]);
  const [hi, setHi] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open ]);
  useEffect(() => { bodyRef.current?.scrollTo(0, 999999); }, [lines, open]);
  // Live engine events stream here while `watch` is armed.
  useEffect(() => {
    watchBus.fn = (ls) => setLines((l) => [...l.slice(-200), ...ls]);
    return () => { watchBus.fn = null; };
  }, []);
  if (!open) return null;

  const run = (cmd: string) => {
    const ctx = getCtx();
    if (!ctx) { setLines((l) => [...l, "> " + cmd, "world not ready yet"]); return; }
    let out: string[];
    try { out = execCommand(cmd, ctx); } catch (e) { out = [`error: ${(e as Error).message}`]; }
    if (out.includes("__clear__")) { setLines([]); return; }
    setLines((l) => [...l.slice(-200), "> " + cmd, ...out]);
  };

  return (
    <div style={{ position: "fixed", left: 12, right: 12, bottom: 12, height: "38vh", zIndex: 30,
      background: "rgba(4,8,6,0.94)", border: "1px solid #2c3a2c", borderRadius: 10,
      display: "flex", flexDirection: "column", fontFamily: "ui-monospace, Consolas, monospace" }}>
      <div ref={bodyRef} style={{ flex: 1, overflowY: "auto", padding: "10px 12px", fontSize: 12.5, color: "#cfe3c8" }}>
        {lines.map((l, i) => (
          <div key={i} style={{ color: l.startsWith(">") ? "#8fe39a" : l.startsWith("NOT REAL") ? "#ff9a8a" : l.startsWith("MIXED") ? "#e8cf7a" : undefined, whiteSpace: "pre-wrap" }}>{l}</div>
        ))}
      </div>
      <div style={{ display: "flex", borderTop: "1px solid #2c3a2c" }}>
        <span style={{ padding: "8px 0 8px 12px", color: "#8fe39a" }}>&gt;</span>
        <input ref={inputRef} value={value} onChange={(e) => { setValue(e.target.value); setHi(-1); }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && value.trim()) {
              run(value.trim()); setHist((h) => [value.trim(), ...h].slice(0, 50)); setValue("");
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              const n = Math.min(hist.length - 1, hi + 1);
              if (hist[n]) { setHi(n); setValue(hist[n]); }
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              const n = hi - 1;
              setHi(n); setValue(n >= 0 ? hist[n] : "");
            }
          }}
          style={{ flex: 1, background: "transparent", border: "none", outline: "none",
            color: "#e8f2e4", padding: 8, fontFamily: "inherit", fontSize: 13 }}
          placeholder="verdict drop a glass box from 50m · ai can a human lift 300kg · help" />
      </div>
    </div>
  );
}
