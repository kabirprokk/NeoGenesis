// Drifting billboard clouds — twelve soft sprites on a far shell.
// Cheap, fog-exempt, dimmed at night by the frame loop.
import * as THREE from "three";

export interface Clouds {
  group: THREE.Group;
  tick: (dt: number, nightFactor: number) => void;
}

function cloudTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 128;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, 256, 128);
  for (let i = 0; i < 26; i++) {
    const x = 30 + Math.random() * 196, y = 45 + Math.random() * 40, r = 18 + Math.random() * 30;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, "rgba(255,255,255,0.55)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  return t;
}

export function buildClouds(scene: THREE.Scene): Clouds {
  const group = new THREE.Group();
  const tex = cloudTexture();
  const puffs: { s: THREE.Sprite; speed: number; base: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const mat = new THREE.SpriteMaterial({
      map: tex, transparent: true, depthWrite: false, fog: false,
      opacity: 0.3 + Math.random() * 0.3,
    });
    const s = new THREE.Sprite(mat);
    const ang = Math.random() * Math.PI * 2, rad = 1500 + Math.random() * 1500;
    s.position.set(Math.cos(ang) * rad, 420 + Math.random() * 320, Math.sin(ang) * rad);
    const w = 420 + Math.random() * 420;
    s.scale.set(w, w * 0.42, 1);
    group.add(s);
    puffs.push({ s, speed: 3 + Math.random() * 4, base: mat.opacity });
  }
  scene.add(group);
  const day = new THREE.Color(0xffffff), night = new THREE.Color(0x2a3648);
  const tmp = new THREE.Color();
  return {
    group,
    tick: (dt: number, nightFactor: number) => {
      for (const p of puffs) {
        p.s.position.x += p.speed * dt;
        if (p.s.position.x > 3200) p.s.position.x = -3200;
        (p.s.material as THREE.SpriteMaterial).opacity = p.base * (1 - nightFactor * 0.7);
        (p.s.material as THREE.SpriteMaterial).color.copy(tmp.copy(day).lerp(night, nightFactor));
      }
    },
  };
}
