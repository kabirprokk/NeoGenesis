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

// Deterministic star field seed helper (actual rendering in frontend).
export function starSeed(index: number): number {
  let h = index * 2654435761 % 4294967296;
  h ^= h >>> 15; h = (h * 2246822519) % 4294967296; h ^= h >>> 13;
  return (h % 100000) / 100000;
}
