// Real planetary time: solar position (NOAA approx), sunrise/sunset, moon phase/geometry.
export interface SunState { altitudeDeg: number; azimuthDeg: number; sunriseUtc: Date | null; sunsetUtc: Date | null; isDay: boolean }
export interface MoonState { phase: number; phaseName: string; altitudeDeg: number; azimuthDeg: number; illumination: number }

const RAD = Math.PI / 180, DAY_MS = 86400000;

function julian(date: Date): number { return date.getTime() / DAY_MS + 2440587.5; }

export function sunPosition(dateUtc: Date, lat: number, lon: number): SunState {
  const T = (julian(dateUtc) - 2451545.0) / 36525;
  let L0 = (280.46646 + 36000.76983 * T) % 360;
  const M = (357.52911 + 35999.05029 * T) % 360 * RAD;
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C = (1.914602 - T * (0.004817 + 0.000014 * T)) * Math.sin(M)
    + 0.019993 * Math.sin(2 * M) + 0.000289 * Math.sin(3 * M);
  const trueLong = (L0 + C) * RAD;
  const omega = 125.04 - 1934.136 * T;
  const lambda = trueLong - 0.00569 * RAD - 0.00478 * RAD * Math.sin(omega * RAD);
  const eps0 = 23.439291 - T * (0.0130042 + 0.00000016 * T);
  const eps = (eps0 + 0.00256 * Math.cos(omega * RAD)) * RAD;
  const dec = Math.asin(Math.sin(eps) * Math.sin(lambda));
  const y = Math.cos(eps) * Math.sin(lambda), x = Math.cos(lambda);
  let ra = Math.atan2(y, x) / RAD / 15; // hours
  const gmst = (18.697374558 + 24.06570982441908 * (julian(dateUtc) - 2451545.0)) % 24;
  let ha = ((gmst + lon / 15 - ra) % 24 + 24) % 24; if (ha > 12) ha -= 24;
  const haRad = ha * 15 * RAD, latRad = lat * RAD;
  const alt = Math.asin(Math.sin(latRad) * Math.sin(dec) + Math.cos(latRad) * Math.cos(dec) * Math.cos(haRad));
  let az = Math.atan2(Math.sin(haRad), Math.cos(haRad) * Math.sin(latRad) - Math.tan(dec) * Math.cos(latRad));
  az = (az / RAD + 180 + 360) % 360;
  // Sunrise/sunset via hour-angle
  const cosH = (Math.sin(-0.833 * RAD) - Math.sin(latRad) * Math.sin(dec)) / (Math.cos(latRad) * Math.cos(dec));
  let sunriseUtc: Date | null = null, sunsetUtc: Date | null = null;
  if (Math.abs(cosH) <= 1) {
    const H = Math.acos(cosH) / RAD / 15; // hours
    const transitMin = ((12 - lon / 15 - (ra - gmst) + 24) % 24) * 60;
    const dayStart = Date.UTC(dateUtc.getUTCFullYear(), dateUtc.getUTCMonth(), dateUtc.getUTCDate());
    sunriseUtc = new Date(dayStart + (transitMin - H * 60) * 60000);
    sunsetUtc = new Date(dayStart + (transitMin + H * 60) * 60000);
  }
  return { altitudeDeg: alt / RAD, azimuthDeg: az, sunriseUtc, sunsetUtc, isDay: alt > -0.833 * RAD };
}

// Low-precision lunar position (Paul Schlyter усечённый ряд, ±arcmin — documented simplification).
export function moonState(dateUtc: Date, lat: number, lon: number): MoonState {
  const d = julian(dateUtc) - 2451543.5;
  const N = (125.1228 - 0.0529538083 * d) * RAD;
  const i = 5.1454 * RAD;
  const w = (318.0634 + 0.1643573223 * d) * RAD;
  const a = 60.2666; // Earth radii
  const e = 0.054900;
  const M = ((115.3654 + 13.0649929509 * d) % 360) * RAD;
  // Solve Kepler E
  let E = M + e * Math.sin(M) * (1 + e * Math.cos(M));
  for (let k = 0; k < 4; k++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const xv = a * (Math.cos(E) - e), yv = a * Math.sqrt(1 - e*e) * Math.sin(E);
  const v = Math.atan2(yv, xv), r = Math.hypot(xv, yv);
  const xh = r * (Math.cos(N) * Math.cos(v + w) - Math.sin(N) * Math.sin(v + w) * Math.cos(i));
  const yh = r * (Math.sin(N) * Math.cos(v + w) + Math.cos(N) * Math.sin(v + w) * Math.cos(i));
  const zh = r * Math.sin(v + w) * Math.sin(i);
  const lonecl = Math.atan2(yh, xh), latecl = Math.atan2(zh, Math.hypot(xh, yh));
  // Sun ecliptic longitude for phase
  const T = (julian(dateUtc) - 2451545.0) / 36525;
  const sunLon = ((280.46646 + 36000.76983 * T) % 360) * RAD;
  let phaseAngle = (lonecl - sunLon + 2 * Math.PI) % (2 * Math.PI);
  const phase = phaseAngle / (2 * Math.PI);
  const illumination = (1 - Math.cos(phaseAngle)) / 2;
  // Ecliptic → equatorial → horizontal (mean obliquity)
  const eps = 23.4393 * RAD;
  const xe = Math.cos(lonecl) * Math.cos(latecl);
  const ye = Math.sin(lonecl) * Math.cos(latecl) * Math.cos(eps) - Math.sin(latecl) * Math.sin(eps);
  const ze = Math.sin(lonecl) * Math.cos(latecl) * Math.sin(eps) + Math.sin(latecl) * Math.cos(eps);
  const ra = Math.atan2(ye, xe), dec = Math.atan2(ze, Math.hypot(xe, ye));
  const gmst = ((18.697374558 + 24.06570982441908 * (julian(dateUtc) - 2451545.0)) % 24) * 15 * RAD;
  const ha = gmst + lon * RAD - ra, latR = lat * RAD;
  const alt = Math.asin(Math.sin(latR) * Math.sin(dec) + Math.cos(latR) * Math.cos(dec) * Math.cos(ha));
  let az = Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(latR) - Math.tan(dec) * Math.cos(latR));
  az = (az / RAD + 180 + 360) % 360;
  const names = ["New Moon","Waxing Crescent","First Quarter","Waxing Gibbous","Full Moon","Waning Gibbous","Last Quarter","Waning Crescent"];
  return { phase, phaseName: names[Math.floor(((phase + 1/16) % 1) * 8)], altitudeDeg: alt / RAD, azimuthDeg: az, illumination };
}

// Deterministic star field seed helper (kept for visual-only jitter; the real
// sky now uses BRIGHT_STARS equatorial places in frontend/src/three/brightStars.ts).
// Integer hash with unsigned wrap: always in [0, 1). (The old float version
// went negative past 2^53, placed stars off-shell and poisoned positions
// with NaN via sqrt of a negative — caught live in the browser.)
export function starSeed(index: number): number {
  let h = (index * 2654435761) % 4294967296;
  h ^= h >>> 15; h = Math.imul(h, 2246822519); h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

// ---- Real equatorial → horizontal (measured math, same GMST as sunPosition) ----
export function equatorialToHorizontal(raHours: number, decDeg: number, dateUtc: Date, lat: number, lon: number): { altitudeDeg: number; azimuthDeg: number } {
  const d = julian(dateUtc) - 2451545.0;
  const gmst = ((18.697374558 + 24.06570982441908 * d) % 24 + 24) % 24;
  let haH = (((gmst + lon / 15 - raHours) % 24) + 24) % 24;
  if (haH > 12) haH -= 24;
  const ha = haH * 15 * RAD, dec = decDeg * RAD, latR = lat * RAD;
  const alt = Math.asin(Math.sin(latR) * Math.sin(dec) + Math.cos(latR) * Math.cos(dec) * Math.cos(ha));
  let az = Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(latR) - Math.tan(dec) * Math.cos(latR));
  az = (az / RAD + 180 + 360) % 360;
  return { altitudeDeg: alt / RAD, azimuthDeg: az };
}

// ---- Real naked-eye planets (JPL approximate Keplerian elements, Standish,
// valid 1800–2050, low-precision approx ±arcmin–arcdeg — labeled approx).
// Source: JPL "Keplerian Elements for Approximate Positions of the Major
// Planets". Magnitudes: V(1,0) + 5log(rR) approx (Hilton/Mallama), no phase
// curve except Venus — quoted approx, variable planets flagged.
interface PlanetElem { a: number; e: number; I: number; L: number; peri: number; node: number;
  da: number; de: number; dI: number; dL: number; dperi: number; dnode: number; v10: number; name: string }
const PLANET_ELEMS: PlanetElem[] = [
  { name: "Mercury", a: 0.38709927, e: 0.20563593, I: 7.00497902, L: 252.25032350, peri: 77.45779628, node: 48.33076593, da: 0.00000037, de: 0.00001906, dI: -0.00594749, dL: 149472.67411175, dperi: 0.16047689, dnode: -0.12534081, v10: -0.36 },
  { name: "Venus", a: 0.72333566, e: 0.00677672, I: 3.39467605, L: 181.97909950, peri: 131.60246718, node: 76.67984255, da: 0.00000390, de: -0.00004107, dI: -0.00078890, dL: 58517.81538729, dperi: 0.00268329, dnode: -0.27769418, v10: -4.47 },
  { name: "Earth", a: 1.00000261, e: 0.01671123, I: -0.00001531, L: 100.46457166, peri: 102.93768193, node: 0, da: 0.00000562, de: -0.00004392, dI: -0.01294668, dL: 35999.37244981, dperi: 0.32327364, dnode: 0, v10: -3.86 },
  { name: "Mars", a: 1.52371034, e: 0.09339410, I: 1.84969142, L: -4.55343205, peri: -23.94362959, node: 49.55953891, da: 0.00001847, de: 0.00007882, dI: -0.00813131, dL: 19140.30268499, dperi: 0.44441088, dnode: -0.29257343, v10: -1.52 },
  { name: "Jupiter", a: 5.20288700, e: 0.04838624, I: 1.30439695, L: 34.39644051, peri: 14.72847983, node: 100.47390909, da: -0.00011607, de: -0.00013253, dI: -0.00183714, dL: 3034.74612775, dperi: 0.21252668, dnode: 0.20469106, v10: -9.40 },
  { name: "Saturn", a: 9.53667594, e: 0.05386179, I: 2.48599187, L: 49.95424423, peri: 92.59887831, node: 113.66242448, da: -0.00125060, de: -0.00050991, dI: 0.00193609, dL: 1222.49362201, dperi: -0.41897216, dnode: -0.28867794, v10: -8.88 },
  { name: "Uranus", a: 19.18916464, e: 0.04725744, I: 0.77263783, L: 313.23810451, peri: 170.96427630, node: 74.01692503, da: -0.00196176, de: -0.00004397, dI: -0.00242939, dL: 428.48202785, dperi: 0.40805281, dnode: 0.04240589, v10: -7.19 },
  { name: "Neptune", a: 30.06992276, e: 0.00859048, I: 1.77004347, L: -55.12002969, peri: 44.96476227, node: 131.78422574, da: 0.00026291, de: 0.00005105, dI: 0.00035372, dL: 218.45945325, dperi: -0.32241464, dnode: -0.00508664, v10: -6.87 },
];
export interface PlanetSky { name: string; altitudeDeg: number; azimuthDeg: number; magV: number; distAU: number }
export function planetStates(dateUtc: Date, lat: number, lon: number): PlanetSky[] {
  const T = (julian(dateUtc) - 2451545.0) / 36525;
  const helio: { x: number; y: number; z: number }[] = PLANET_ELEMS.map((p) => {
    const a = p.a + p.da * T, e = p.e + p.de * T, I = (p.I + p.dI * T) * RAD;
    const L = (p.L + p.dL * T) * RAD, peri = (p.peri + p.dperi * T) * RAD, node = (p.node + p.dnode * T) * RAD;
    const M = (L - peri + 2 * Math.PI) % (2 * Math.PI);
    const w = peri - node;
    let E = M + e * Math.sin(M);
    for (let k = 0; k < 6; k++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
    const x = (Math.cos(w) * Math.cos(node) - Math.sin(w) * Math.sin(node) * Math.cos(I)) * xp
      + (-Math.sin(w) * Math.cos(node) - Math.cos(w) * Math.sin(node) * Math.cos(I)) * yp;
    const y = (Math.cos(w) * Math.sin(node) + Math.sin(w) * Math.cos(node) * Math.cos(I)) * xp
      + (-Math.sin(w) * Math.sin(node) + Math.cos(w) * Math.cos(node) * Math.cos(I)) * yp;
    const z = (Math.sin(w) * Math.sin(I)) * xp + (Math.cos(w) * Math.sin(I)) * yp;
    return { x, y, z };
  });
  const earth = helio[2];
  const eps = 23.4393 * RAD;
  return PLANET_ELEMS.map((p, i) => {
    if (i === 2) return null;
    const gx = helio[i].x - earth.x, gy = helio[i].y - earth.y, gz = helio[i].z - earth.z;
    const distAU = Math.hypot(gx, gy, gz);
    const rAU = Math.hypot(helio[i].x, helio[i].y, helio[i].z);
    // Ecliptic → equatorial
    const xe = gx, ye = gy * Math.cos(eps) - gz * Math.sin(eps), ze = gy * Math.sin(eps) + gz * Math.cos(eps);
    let raH = Math.atan2(ye, xe) / RAD / 15; if (raH < 0) raH += 24;
    const dec = Math.atan2(ze, Math.hypot(xe, ye)) / RAD;
    const hz = equatorialToHorizontal(raH, dec, dateUtc, lat, lon);
    const magV = p.v10 + 5 * Math.log10(Math.max(0.05, rAU * distAU));
    return { name: p.name, altitudeDeg: hz.altitudeDeg, azimuthDeg: hz.azimuthDeg, magV, distAU };
  }).filter((x): x is PlanetSky => x !== null);
}
