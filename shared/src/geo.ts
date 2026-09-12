// WGS84 + ECEF + ENU + floating origin. Pure TS, no DOM.
export const WGS84 = { a: 6378137.0, f: 1 / 298.257223563 } as const;
export const E2 = WGS84.f * (2 - WGS84.f);
export const DEG = Math.PI / 180;

export interface LLA { lat: number; lon: number; alt: number }
export type Vec3 = [number, number, number];

export function llaToEcef({ lat, lon, alt }: LLA): Vec3 {
  const phi = lat * DEG, lam = lon * DEG;
  const sinPhi = Math.sin(phi), cosPhi = Math.cos(phi);
  const N = WGS84.a / Math.sqrt(1 - E2 * sinPhi * sinPhi);
  return [
    (N + alt) * cosPhi * Math.cos(lam),
    (N + alt) * cosPhi * Math.sin(lam),
    (N * (1 - E2) + alt) * sinPhi,
  ];
}

export function ecefToLla([x, y, z]: Vec3): LLA {
  // Bowring iterative
  const lon = Math.atan2(y, x);
  const p = Math.hypot(x, y);
  let lat = Math.atan2(z, p * (1 - E2));
  let N = 0, alt = 0;
  for (let i = 0; i < 5; i++) {
    const s = Math.sin(lat);
    N = WGS84.a / Math.sqrt(1 - E2 * s * s);
    alt = p / Math.cos(lat) - N;
    lat = Math.atan2(z + E2 * N * s, p);
  }
  return { lat: lat / DEG, lon: lon / DEG, alt };
}

function enuBasis(origin: LLA) {
  const phi = origin.lat * DEG, lam = origin.lon * DEG;
  return {
    east: [-Math.sin(lam), Math.cos(lam), 0] as Vec3,
    north: [-Math.sin(phi) * Math.cos(lam), -Math.sin(phi) * Math.sin(lam), Math.cos(phi)] as Vec3,
    up: [Math.cos(phi) * Math.cos(lam), Math.cos(phi) * Math.sin(lam), Math.sin(phi)] as Vec3,
  };
}

export function ecefToEnu(p: Vec3, origin: LLA, originEcef?: Vec3): Vec3 {
  const o = originEcef ?? llaToEcef(origin);
  const d: Vec3 = [p[0] - o[0], p[1] - o[1], p[2] - o[2]];
  const b = enuBasis(origin);
  const dot = (a: Vec3, c: Vec3) => a[0]*c[0]+a[1]*c[1]+a[2]*c[2];
  return [dot(d, b.east), dot(d, b.north), dot(d, b.up)];
}

export function enuToEcef(e: Vec3, origin: LLA, originEcef?: Vec3): Vec3 {
  const o = originEcef ?? llaToEcef(origin);
  const b = enuBasis(origin);
  return [
    o[0] + b.east[0]*e[0] + b.north[0]*e[1] + b.up[0]*e[2],
    o[1] + b.east[1]*e[0] + b.north[1]*e[1] + b.up[1]*e[2],
    o[2] + b.east[2]*e[0] + b.north[2]*e[1] + b.up[2]*e[2],
  ];
}

// Floating origin: rebase when camera drifts > threshold (default 5 km).
export class FloatingOrigin {
  origin: LLA; originEcef: Vec3; thresholdM: number;
  constructor(origin: LLA, thresholdM = 5000) {
    this.origin = origin; this.originEcef = llaToEcef(origin); this.thresholdM = thresholdM;
  }
  needsRebase(enu: Vec3): boolean {
    return Math.hypot(enu[0], enu[1], enu[2]) > this.thresholdM;
  }
  rebase(newOrigin: LLA) { this.origin = newOrigin; this.originEcef = llaToEcef(newOrigin); }
  toEnu(lla: LLA): Vec3 { return ecefToEnu(llaToEcef(lla), this.origin, this.originEcef); }
  toLla(enu: Vec3): LLA { return ecefToLla(enuToEcef(enu, this.origin, this.originEcef)); }
}

export function haversineM(a: LLA, b: LLA): number {
  const dLat = (b.lat - a.lat) * DEG, dLon = (b.lon - a.lon) * DEG;
  const s = Math.sin(dLat/2)**2 + Math.cos(a.lat*DEG)*Math.cos(b.lat*DEG)*Math.sin(dLon/2)**2;
  return 2 * 6371000 * Math.asin(Math.sqrt(s));
}
