import React from "react";

export function MapView({ open, onClose, lat, lon, discoveries }:
  { open: boolean; onClose: () => void; lat: number; lon: number; discoveries: { name: string; lat: number; lon: number }[] }) {
  if (!open) return null;
  // Planetary map: equirectangular projection, player + discoveries only. No quest icons.
  const X = (lo: number) => ((lo + 180) / 360) * 100;
  const Y = (la: number) => ((90 - la) / 180) * 100;
  return (
    <div className="panel">
      <h2>Planetary Map</h2>
      <div style={{ position: "relative", width: "100%", aspectRatio: "2/1", borderRadius: 8, overflow: "hidden" }}>
        <img src="/earth/earth-day.jpg" alt="real Earth surface (NASA Blue Marble)"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "fill" }} />
        {discoveries.map((d, i) => (
          <div key={i} title={d.name} style={{ position: "absolute", left: `${X(d.lon)}%`, top: `${Y(d.lat)}%`, width: 6, height: 6, background: "#c9b458", borderRadius: "50%" }} />
        ))}
        <div title="you — the only human" style={{ position: "absolute", left: `${X(lon)}%`, top: `${Y(lat)}%`, width: 8, height: 8, background: "#fff", borderRadius: "50%", boxShadow: "0 0 8px #fff" }} />
      </div>
      <p style={{ fontSize: 12, opacity: 0.7 }}>{lat.toFixed(3)}°, {lon.toFixed(3)}° · {discoveries.length} discoveries</p>
      <button onClick={onClose}>Close (M)</button>
    </div>
  );
}
