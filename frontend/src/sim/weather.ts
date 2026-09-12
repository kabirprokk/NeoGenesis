// Spatially-coherent weather: a moving storm region + ambient field (not per-pixel noise).
export interface WeatherState { tempC: number; humidity01: number; windMs: number; windDir: number; rainMmH: number; storm: boolean; fog01: number; cloud01: number }
export class WeatherSystem {
  stormLon = 20; stormLat = 10; stormRadiusDeg = 12;
  tick(tH: number) { this.stormLon += tH * 1.5; if (this.stormLon > 180) this.stormLon = -180; }
  sample(lat: number, lon: number, baseTemp: number): WeatherState {
    const d = Math.hypot(lat - this.stormLat, lon - this.stormLon);
    const inStorm = d < this.stormRadiusDeg ? 1 - d / this.stormRadiusDeg : 0;
    const rain = inStorm > 0.15 ? inStorm * 12 : 0;
    return {
      tempC: baseTemp - inStorm * 4, humidity01: Math.min(1, 0.45 + inStorm * 0.5),
      windMs: 3 + inStorm * 18, windDir: (250 + 40 * Math.sin(lon)) % 360,
      rainMmH: rain, storm: inStorm > 0.6, fog01: inStorm * 0.5, cloud01: 0.25 + inStorm * 0.7,
    };
  }
}
