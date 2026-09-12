// Survival model: hunger/thirst/temp/stamina/health/sleep — grounded, exploratory rates.
export interface Vitals { health: number; hunger: number; thirst: number; stamina: number; sleep: number; bodyTempC: number }
export const freshVitals = (): Vitals => ({ health: 100, hunger: 100, thirst: 100, stamina: 100, sleep: 100, bodyTempC: 37 });

export function tickVitals(v: Vitals, dtH: number, env: { tempC: number; inWater: boolean; running: boolean; night: boolean }): Vitals {
  const n = { ...v };
  n.hunger = Math.max(0, n.hunger - dtH * 2.2);
  n.thirst = Math.max(0, n.thirst - dtH * 3.5);
  n.sleep = Math.max(0, n.sleep - dtH * (env.night ? 1.2 : 2.0));
  n.stamina = Math.min(100, Math.max(0, n.stamina + dtH * (env.running ? -25 : 12)));
  const cold = env.tempC < 5 ? (5 - env.tempC) * 0.4 : 0;
  const heat = env.tempC > 35 ? (env.tempC - 35) * 0.5 : 0;
  n.bodyTempC += (env.tempC - n.bodyTempC) * 0.02 * dtH * 60 - cold * 0.02 + heat * 0.02;
  if (n.hunger <= 0 || n.thirst <= 0) n.health = Math.max(0, n.health - dtH * 4);
  if (cold > 8 || heat > 6) n.health = Math.max(0, n.health - dtH * 3);
  if (env.inWater && env.tempC < 10) n.health = Math.max(0, n.health - dtH * 2);
  return n;
}
