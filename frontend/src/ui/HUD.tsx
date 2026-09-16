export function HUD({ pos, alt, tempC, timeStr, weather, faded }:
  { pos: string; alt: number; tempC: number; timeStr: string; weather: string; faded: boolean }) {
  return (
    <div className="hud">
      <div className={`hud-top${faded ? " faded" : ""}`}>
        <span>◈ {pos}</span>
        <span>▲ {alt.toFixed(1)} m</span>
        <span>◐ {tempC.toFixed(1)}°C</span>
        <span>☀ {timeStr}</span>
        <span>{weather}</span>
      </div>
      <div className="hud-help">WASD move · Shift run · C crouch · Space jump<br />J journal · X lab · ~ terminal · H HUD · click to look</div>
    </div>
  );
}
