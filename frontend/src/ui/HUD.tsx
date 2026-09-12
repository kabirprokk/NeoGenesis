import React from "react";
import type { Vitals } from "../sim/survival.js";

export function HUD({ pos, alt, tempC, timeStr, weather, vitals, faded, era }:
  { pos: string; alt: number; tempC: number; timeStr: string; weather: string; vitals: Vitals; faded: boolean; era: string }) {
  return (
    <div className="hud">
      <div className={`hud-top${faded ? " faded" : ""}`}>
        <span>◈ {pos}</span>
        <span>▲ {alt.toFixed(1)} m</span>
        <span>◐ {tempC.toFixed(1)}°C</span>
        <span>☀ {timeStr}</span>
        <span>{weather}</span>
      </div>
      <div className={`hud-bottom${faded ? " faded" : ""}`}>
        <div className="vitals">
          <div>HP <span className={vitals.health < 30 ? "low" : ""}>{Math.round(vitals.health)}</span> · Hunger {Math.round(vitals.hunger)} · Thirst <span className={vitals.thirst < 25 ? "low" : ""}>{Math.round(vitals.thirst)}</span></div>
          <div>Stamina {Math.round(vitals.stamina)} · Sleep {Math.round(vitals.sleep)} · Core {vitals.bodyTempC.toFixed(1)}°C</div>
          <div style={{ opacity: 0.6 }}>{era}</div>
        </div>
      </div>
      <div className="hud-help">WASD move · Shift run · C crouch · Space jump<br />J journal · X lab · ~ terminal · H HUD · click to look</div>
    </div>
  );
}
