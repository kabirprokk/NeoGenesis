// BrainPanel — the 1:1 brain visualizer square. A live window into Neo's real
// internals, not a mockup: every number is read from the same live senses,
// body, memory and sampler the game itself runs on.
//
//  Subconscious — heart rate, temperature, arousal/valence/dominance meters.
//  Synaptic core — VAD point readout, mood + undertone, learned fears/loves.
//  Stream of consciousness — the raw pre-speech thought ring (think traces +
//    dreams), unedited.
//  Language artifacts — the phrasing distribution actually sampled, the token
//    currently streaming, letters assembling, tokens/sec.
//  Scientist controls — biometric injector sliders (synthetic, labeled) and
//    hot-swappable mind profiles. The world itself is never faked.
import React, { useEffect, useState } from "react";
import type { GameCtx } from "./terminalCore.js";
import { streamBus } from "./streamBus.js";
import { MIND_PROFILES } from "./neoMind.js";
import type { InjectorState } from "./neoBody.js";

function Bar({ label, frac, text, color }: { label: string; frac: number; text: string; color: string }) {
  const f = Math.min(1, Math.max(0, frac));
  return (
    <div style={{ margin: "3px 0", fontSize: 11 }}>
      <div style={{ display: "flex", justifyContent: "space-between", opacity: 0.85 }}>
        <span>{label}</span><span>{text}</span>
      </div>
      <div style={{ height: 6, background: "#141a14", borderRadius: 3 }}>
        <div style={{ width: `${Math.round(f * 100)}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.3s" }} />
      </div>
    </div>
  );
}

export function BrainPanel({ open, onClose, getCtx }: { open: boolean; onClose: () => void; getCtx: () => GameCtx | null }) {
  const [tick, setTick] = useState(0);
  const [inj, setInj] = useState<InjectorState | null>(null);
  useEffect(() => {
    if (!open) return;
    const t = window.setInterval(() => setTick((x) => x + 1), 300);
    return () => window.clearInterval(t);
  }, [open ]);
  useEffect(() => {
    if (open) {
      try {
        const c = getCtx();
        if (c) setInj(c.injector());
      } catch { /* world not ready */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  if (!open) return null;
  void tick;
  const ctx = getCtx();
  if (!ctx) return null;
  let s = null as null | ReturnType<GameCtx["sense"]>;
  let inner = "", profile = "", injected: InjectorState | null = null;
  let thoughts: string[] = [], cands: { text: string; p: number }[] = [];
  try {
    s = ctx.sense(); inner = ctx.innerState(); thoughts = ctx.thoughtLog();
    cands = ctx.candidates(); profile = ctx.mindProfile(); injected = ctx.injector();
  } catch { return null; }
  if (!s) return null;

  const set = (patch: Partial<InjectorState>): void => {
    try {
      const next = ctx.setInjector(patch) as InjectorState;
      setInj(next);
    } catch { /* ignore */ }
  };
  const shown = inj ?? injected;
  const synthetic = shown && (shown.hrBpm !== null || shown.tempDeltaC !== 0 || shown.arousalDelta !== 0 || shown.valenceDelta !== 0 || shown.dominanceDelta !== 0);

  return (
    <div className="panel" style={{ left: "auto", right: 12, transform: "none", width: 304, top: 64, maxHeight: "86vh", fontFamily: "ui-monospace, Consolas, monospace" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <b style={{ fontSize: 12, letterSpacing: "0.08em" }}>NEO · BRAIN CORE 1:1</b>
        <button onClick={onClose} style={{ fontSize: 11 }}>Close (B)</button>
      </div>
      {synthetic && <div style={{ fontSize: 10.5, color: "#e8cf7a", marginTop: 4 }}>⚠ synthetic injector active — felt state, not the world</div>}

      <div style={{ fontSize: 11, marginTop: 8, opacity: 0.7 }}>VIRTUAL BIOMETRICS</div>
      <div style={{ fontSize: 12 }}>Heart {"▮".repeat(Math.max(1, Math.min(14, Math.round(s.heartBpm / 12))))} {Math.round(s.heartBpm)} BPM</div>
      <Bar label="Temp" frac={(s.tempC + 10) / 55} text={`${s.tempC.toFixed(1)}°C · feels ${s.feelsLikeC.toFixed(1)}`} color="#e8935a" />
      <Bar label="Arousal" frac={s.arousal01} text={s.arousal01.toFixed(2)} color="#e8cf7a" />
      <Bar label="Valence" frac={(s.valence + 1) / 2} text={`${s.valence >= 0 ? "+" : ""}${s.valence.toFixed(2)}`} color={s.valence >= 0 ? "#8fe39a" : "#ff9a8a"} />
      <Bar label="Dominance" frac={s.dominance01} text={s.dominance01.toFixed(2)} color="#7aa3e8" />
      <div style={{ fontSize: 12, marginTop: 2 }}>mood <b style={{ color: "#8fe39a" }}>{s.mood}</b>{s.undertone ? <span style={{ opacity: 0.7 }}> + {s.undertone}</span> : null}</div>

      <div style={{ fontSize: 11, marginTop: 8, opacity: 0.7 }}>LANGUAGE ARTIFACTS {streamBus.active ? `· ${streamBus.tps.toFixed(0)} t/s` : ""}</div>
      {cands.length > 0 && (
        <div style={{ fontSize: 11 }}>
          {cands.map((c) => (
            <div key={c.text} style={{ display: "flex", gap: 6 }}>
              <span style={{ flex: 1, color: c.text === streamBus.token ? "#8fe39a" : undefined }}>{c.text}</span>
              <span style={{ opacity: 0.75 }}>{c.p}%</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ fontSize: 11, marginTop: 4, minHeight: 32, background: "#0c100c", borderRadius: 6, padding: 6, wordBreak: "break-word" }}>
        <div style={{ opacity: 0.6 }}>token: [{streamBus.token || "—"}] letters: {streamBus.letters || "—"}</div>
        <div>“{streamBus.assembled.slice(-110) || "— idle —"}”</div>
      </div>

      <div style={{ fontSize: 11, marginTop: 8, opacity: 0.7 }}>STREAM OF CONSCIOUSNESS</div>
      <div style={{ fontSize: 10.5, background: "#0c100c", borderRadius: 6, padding: 6, maxHeight: 130, overflowY: "auto" }}>
        {thoughts.slice(-7).map((t, i) => <div key={i} style={{ opacity: 0.9, marginBottom: 3 }}>{t}</div>)}
      </div>

      <div style={{ fontSize: 11, marginTop: 8, opacity: 0.7 }}>MIND PROFILE · {profile}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {MIND_PROFILES.map((p) => (
          <button key={p.name} onClick={() => { try { ctx.setMindProfile(p.name); } catch { /* ignore */ } }}
            title={p.blurb}
            style={{ fontSize: 10.5, background: p.name === profile ? "#1d3a24" : undefined, color: p.name === profile ? "#8fe39a" : undefined }}>
            {p.name}
          </button>
        ))}
      </div>

      <div style={{ fontSize: 11, marginTop: 8, opacity: 0.7 }}>BIOMETRIC INJECTOR {synthetic ? "(ACTIVE)" : "(natural)"}</div>
      <div style={{ fontSize: 10.5 }}>
        <label>HR override {shown?.hrBpm ?? "auto"}
          <input type="range" min={35} max={200} step={1} value={shown?.hrBpm ?? 70}
            onChange={(e) => set({ hrBpm: parseInt(e.target.value, 10) })} style={{ width: "100%" }} />
        </label>
        <div style={{ display: "flex", gap: 4, margin: "2px 0" }}>
          <button style={{ fontSize: 10 }} onClick={() => set({ hrBpm: null })}>HR auto</button>
          <button style={{ fontSize: 10 }} onClick={() => set({ hrBpm: null, tempDeltaC: 0, arousalDelta: 0, valenceDelta: 0, dominanceDelta: 0 })}>reset all</button>
        </div>
        {(["tempDeltaC", "arousalDelta", "valenceDelta", "dominanceDelta"] as const).map((k) => (
          <label key={k} style={{ display: "block" }}>{k.replace("Delta", " Δ")} {(shown?.[k] ?? 0).toFixed(2)}
            <input type="range" min={k === "tempDeltaC" ? -10 : -0.6} max={k === "tempDeltaC" ? 15 : 0.6}
              step={k === "tempDeltaC" ? 0.5 : 0.05} value={shown?.[k] ?? 0}
              onChange={(e) => set({ [k]: parseFloat(e.target.value) } as Partial<InjectorState>)} style={{ width: "100%" }} />
          </label>
        ))}
      </div>
      <div style={{ fontSize: 10, opacity: 0.55, marginTop: 6 }}>{inner}</div>
    </div>
  );
}
