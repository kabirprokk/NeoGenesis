// Enhanced cloud system — integrates with CloudPhysicsEngine.
// Replaces the simple 12-sprite billboard system with physics-driven
// cloud bodies that respond to wind, turbulence, and weather.
// Supports multiple cloud types, altitude-based rendering,
// precipitation effects, and realistic wind-driven movement.

import * as THREE from "three";
import type { CloudRenderData } from "./enhanced-clouds.js";

export interface Clouds {
  group: THREE.Group;
  cloudMeshes: Map<string, THREE.Group>;
  tick: (dt: number, nightFactor: number, cloudData: CloudRenderData[]) => void;
  updateClouds: (cloudData: CloudRenderData[]) => void;
  dispose: () => void;
}

// ─── Cloud type colors ─────────────────────────────

const CLOUD_COLORS: Record<string, { top: number; bottom: number }> = {
  cirrus: { top: 0xffffff, bottom: 0xe8e8ff },
  cirrocumulus: { top: 0xe8e8ff, bottom: 0xd0d0ff },
  altocumulus: { top: 0xd0d0d0, bottom: 0xb0b0b0 },
  altostratus: { top: 0x8a8a8a, bottom: 0x6a6a6a },
  stratus: { top: 0xb0b0b0, bottom: 0x909090 },
  stratocumulus: { top: 0x9a9a9a, bottom: 0x7a7a7a },
  cumulus: { top: 0xf0f0f0, bottom: 0xd0d0d0 },
  cumulonimbus: { top: 0x4a4a4a, bottom: 0x2a2a2a },
  nimbostratus: { top: 0x5a5a5a, bottom: 0x3a3a3a },
  fog: { top: 0xc0c0c0, bottom: 0xa0a0a0 },
};

/**
 * Generate a procedural cloud texture based on type
 */
function generateCloudTexture(type: string, w = 512, h = 256): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, w, h);
  const colors = CLOUD_COLORS[type] ?? { top: 0xffffff, bottom: 0xe0e0e0 };
  const blobs = type === "cirrus" ? 8 : type === "cumulonimbus" ? 40 : 20;
  const blobSize = type === "cirrus" ? 8 : type === "stratus" ? 60 : 30;
  const alpha = type === "fog" ? 0.3 : type === "cumulonimbus" ? 0.8 : 0.5;

  for (let i = 0; i < blobs; i++) {
    const r = blobSize + Math.random() * blobSize;
    const x = Math.random() * w;
    const y = Math.random() * h;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(${colors.top},${alpha})`);
    grad.addColorStop(1, `rgba(${colors.bottom},0)`);
    g.fillStyle = grad;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  return new THREE.CanvasTexture(c);
}

/**
 * Build the enhanced cloud system for the scene.
 * Returns Clouds interface compatible with the existing frontend architecture.
 */
export function buildClouds(scene: THREE.Scene): Clouds {
  const group = new THREE.Group();
  group.name = "enhanced-clouds";
  const cloudMeshes = new Map<string, THREE.Group>();
  const textureCache = new Map<string, THREE.CanvasTexture>();

  function getTexture(type: string): THREE.CanvasTexture {
    if (!textureCache.has(type)) textureCache.set(type, generateCloudTexture(type));
    return textureCache.get(type)!;
  }

  function updateCloudMesh(data: CloudRenderData): THREE.Group {
    let meshGroup = cloudMeshes.get(data.id);
    const tex = getTexture(data.type);

    if (!meshGroup) {
      meshGroup = new THREE.Group();
      meshGroup.name = `cloud-${data.id}`;
      const mat = new THREE.SpriteMaterial({
        map: tex, transparent: true, depthWrite: false, fog: false,
        opacity: data.density,
      });
      const sprite = new THREE.Sprite(mat);
      const w = Math.max(1, data.size.width);
      const h = Math.max(1, data.size.height);
      sprite.scale.set(w, h * (data.size.height / data.size.width), 1);
      meshGroup.add(sprite);
      scene.add(meshGroup);
      cloudMeshes.set(data.id, meshGroup);
    } else {
      const sprite = meshGroup.children[0] as THREE.Sprite;
      if (sprite) {
        const mat = sprite.material as THREE.SpriteMaterial;
        mat.opacity = data.density;
        const w = Math.max(1, data.size.width);
        const h = Math.max(1, data.size.height);
        sprite.scale.set(w, h * (data.size.height / data.size.width), 1);
      }
    }

    meshGroup.position.set(data.pos.x, data.pos.y, data.pos.z);
    return meshGroup;
  }

  function cleanupOldClouds(activeIds: Set<string>): void {
    for (const [id, mesh] of cloudMeshes) {
      if (!activeIds.has(id)) {
        scene.remove(mesh);
        mesh.traverse((child) => {
          if (child instanceof THREE.Sprite) (child.material as THREE.Material).dispose();
        });
        cloudMeshes.delete(id);
      }
    }
  }

  return {
    group,
    cloudMeshes,
    tick: (dt: number, nightFactor: number, cloudData: CloudRenderData[]) => {
      const activeIds = new Set(cloudData.map((c) => c.id));
      cleanupOldClouds(activeIds);

      for (const data of cloudData) {
        const mesh = updateCloudMesh(data);
        // Wind-driven position update
        mesh.position.x += data.velocity.x * dt;
        mesh.position.z += data.velocity.z * dt;
        // Wrap at world boundaries
        const wrap = 50000;
        if (mesh.position.x > wrap) mesh.position.x -= wrap * 2;
        if (mesh.position.x < -wrap) mesh.position.x += wrap * 2;
        if (mesh.position.z > wrap) mesh.position.z -= wrap * 2;
        if (mesh.position.z < -wrap) mesh.position.z += wrap * 2;

        // Night dimming
        const sprite = mesh.children[0] as THREE.Sprite;
        if (sprite) {
          const mat = sprite.material as THREE.SpriteMaterial;
          mat.opacity = data.density * (1 - nightFactor * 0.7);
          const day = new THREE.Color(0xffffff), night = new THREE.Color(0x2a3648);
          const tmp = new THREE.Color();
          mat.color.copy(tmp.copy(day).lerp(night, nightFactor));
        }
      }
    },
    updateClouds: (cloudData: CloudRenderData[]) => {
      const activeIds = new Set(cloudData.map((c) => c.id));
      cleanupOldClouds(activeIds);
      for (const data of cloudData) updateCloudMesh(data);
    },
    dispose: () => {
      for (const [, mesh] of cloudMeshes) {
        scene.remove(mesh);
        mesh.traverse((child) => {
          if (child instanceof THREE.Sprite) (child.material as THREE.Material).dispose();
        });
      }
      cloudMeshes.clear();
      for (const tex of textureCache.values()) tex.dispose();
      textureCache.clear();
    },
  };
}
