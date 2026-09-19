// Enhanced cloud rendering — integrates with CloudPhysicsEngine.
// Supports multiple cloud types, wind-driven movement, altitude-based
// rendering, precipitation effects, and realistic cloud appearance.
// Replaces the simple 12-sprite billboard system with physics-driven
// cloud bodies that respond to wind, turbulence, and weather.

import * as THREE from "three";

export interface CloudRenderData {
  id: string;
  type: string;
  pos: { x: number; y: number; z: number };
  size: { width: number; height: number; depth: number };
  density: number;
  temperature: number;
  isPrecipitating: boolean;
  velocity: { x: number; y: number; z: number };
  // Realistic cloud rendering properties
  rotationY: number; // degrees rotation around vertical axis
  deformation: { stretchX: number; stretchZ: number; shear: number }; // Wind shear deformation
  cloudTopHeight: number; // m
  cloudBaseHeight: number; // m
  gustOffset: { x: number; z: number };
  isEvaporating: boolean;
}

export interface EnhancedClouds {
  group: THREE.Group;
  cloudMeshes: Map<string, THREE.Group>;
  tick: (dt: number, nightFactor: number, cloudData?: CloudRenderData[]) => void;
  updateClouds: (cloudData: CloudRenderData[]) => void;
  dispose: () => void;
}

// ─── Cloud type colors and properties ─────────────────

export const CLOUD_COLORS: Record<string, { top: number; bottom: number }> = {
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
 * Generate a procedural cloud texture for a given type
 */
function generateCloudTexture(
  type: string,
  width: number = 512,
  height: number = 256
): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, width, height);

  const colors = CLOUD_COLORS[type] ?? { top: 0xffffff, bottom: 0xe0e0e0 };
  const numBlobs = type === "cumulonimbus" ? 40 : type === "cirrus" ? 8 : 20;
  const blobSize = type === "cirrus" ? 8 : type === "stratus" ? 60 : 30;
  const alpha = type === "fog" ? 0.3 : type === "cumulonimbus" ? 0.8 : 0.5;

  for (let i = 0; i < numBlobs; i++) {
    const r = blobSize + Math.random() * blobSize;
    const x = Math.random() * width;
    const y = Math.random() * height;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(${colors.top},${alpha})`);
    grad.addColorStop(1, `rgba(${colors.bottom},0)`);
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }

  return new THREE.CanvasTexture(c);
}

/**
 * Build enhanced clouds from cloud physics data
 */
export function buildEnhancedClouds(scene: THREE.Scene): EnhancedClouds {
  const group = new THREE.Group();
  group.name = "enhanced-clouds";
  const cloudMeshes = new Map<string, THREE.Group>();

  // Create cloud texture cache
  const textureCache = new Map<string, THREE.CanvasTexture>();

  function getTexture(type: string): THREE.CanvasTexture {
    if (!textureCache.has(type)) {
      textureCache.set(type, generateCloudTexture(type));
    }
    return textureCache.get(type)!;
  }

  /**
   * Create or update a cloud mesh from render data
   */
  function updateCloudMesh(data: CloudRenderData): THREE.Group {
    let meshGroup = cloudMeshes.get(data.id);
    const tex = getTexture(data.type);

    if (!meshGroup) {
      // Create new cloud group
      meshGroup = new THREE.Group();
      meshGroup.name = `cloud-${data.id}`;

      const mat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        fog: false,
        opacity: data.density,
      });
      const sprite = new THREE.Sprite(mat);
      const w = Math.max(1, data.size.width);
      const h = Math.max(1, data.size.height);
      sprite.scale.set(w, h * (data.size.height / data.size.width), 1);
      meshGroup.add(sprite);

      // Add precipitation effect if raining
      if (data.isPrecipitating) {
        addRainEffect(meshGroup, h);
      }

      scene.add(meshGroup);
      cloudMeshes.set(data.id, meshGroup);
    } else {
      // Update existing cloud
      const sprite = meshGroup.children[0] as THREE.Sprite;
      if (sprite) {
        const mat = sprite.material as THREE.SpriteMaterial;
        mat.opacity = data.density;
        const w = Math.max(1, data.size.width);
        const h = Math.max(1, data.size.height);
        sprite.scale.set(w, h * (data.size.height / data.size.width), 1);
      }
    }

    // Position
    meshGroup.position.set(data.pos.x, data.pos.y, data.pos.z);

    return meshGroup;
  }

  /**
   * Add rain particle effect to a cloud
   */
  function addRainEffect(parent: THREE.Group, height: number): void {
    // Remove old rain particles
    const oldRain = parent.children.find((c) => c.name === "rain-effect");
    if (oldRain) parent.remove(oldRain);

    // Create rain particles
    const rainCount = 100;
    const rainGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(rainCount * 3);
    const velocities = new Float32Array(rainCount);

    for (let i = 0; i < rainCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * height;
      positions[i * 3 + 1] = Math.random() * height * 0.5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * height;
      velocities[i] = Math.random() * 2 + 1;
    }

    rainGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const rainMaterial = new THREE.PointsMaterial({
      color: 0xaabbcc,
      size: 0.5,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    });

    const rain = new THREE.Points(rainGeometry, rainMaterial);
    rain.name = "rain-effect";
    parent.add(rain);
  }

  /**
   * Remove old cloud meshes that are no longer in the data
   */
  function cleanupOldClouds(activeIds: Set<string>): void {
    for (const [id, mesh] of cloudMeshes) {
      if (!activeIds.has(id)) {
        scene.remove(mesh);
        // Dispose materials
        mesh.traverse((child) => {
          if (child instanceof THREE.Mesh || child instanceof THREE.Sprite) {
            (child.material as THREE.Material).dispose();
          }
        });
        cloudMeshes.delete(id);
      }
    }
  }

  return {
    group,
    cloudMeshes,
    tick: (dt: number, nightFactor: number, cloudData: CloudRenderData[] = []) => {
      const activeIds = new Set(cloudData.map((c) => c.id));
      cleanupOldClouds(activeIds);

      for (const data of cloudData) {
        const mesh = updateCloudMesh(data);

        // Apply wind-driven movement (smoothed)
        mesh.position.x += data.velocity.x * dt;
        mesh.position.z += data.velocity.z * dt;

        // Apply gust offset for realistic wind variability
        mesh.position.x += data.gustOffset.x * dt;
        mesh.position.z += data.gustOffset.z * dt;

        // Apply rotation based on wind shear
        if (data.rotationY !== 0) {
          mesh.rotation.y = (data.rotationY * Math.PI) / 180;
        }

        // Apply wind shear deformation to scale
        const stretchX = 1 + data.deformation.shear * 0.1;
        const stretchZ = 1 + data.deformation.shear * 0.05;
        const currentW = Math.max(1, data.size.width * stretchX);
        const currentD = Math.max(1, data.size.depth * stretchZ);

        // Wrap around at world boundaries
        const wrapRadius = 50000;
        if (mesh.position.x > wrapRadius) mesh.position.x -= wrapRadius * 2;
        if (mesh.position.x < -wrapRadius) mesh.position.x += wrapRadius * 2;
        if (mesh.position.z > wrapRadius) mesh.position.z -= wrapRadius * 2;
        if (mesh.position.z < -wrapRadius) mesh.position.z += wrapRadius * 2;

        // Night dimming
        const sprite = mesh.children[0] as THREE.Sprite;
        if (sprite) {
          const mat = sprite.material as THREE.SpriteMaterial;
          const nightOpacity = data.density * (1 - nightFactor * 0.7);
          mat.opacity = nightOpacity;
          const dayColor = new THREE.Color(0xffffff);
          const nightColor = new THREE.Color(0x2a3648);
          mat.color.copy(dayColor.lerp(nightColor, nightFactor));
        }

        // Precipitation animation
        const rainEffect = mesh.children.find((c) => c.name === "rain-effect");
        if (rainEffect) {
          const points = rainEffect as THREE.Points;
          const positions = points.geometry.attributes.position.array as Float32Array;
          for (let i = 0; i < positions.length / 3; i++) {
            positions[i * 3 + 1] -= 0.5 * dt;
            if (positions[i * 3 + 1] < 0) {
              positions[i * 3 + 1] = Math.random() * data.size.height * 0.5;
              positions[i * 3] = (Math.random() - 0.5) * data.size.width;
              positions[i * 3 + 2] = (Math.random() - 0.5) * data.size.depth;
            }
          }
          points.geometry.attributes.position.needsUpdate = true;
        }

        // Evaporation effect (density reduction)
        if (data.isEvaporating) {
          const sprite2 = mesh.children[0] as THREE.Sprite;
          if (sprite2) {
            const mat2 = sprite2.material as THREE.SpriteMaterial;
            mat2.opacity = Math.max(0, mat2.opacity * 0.98);
          }
        }
      }
    },
    updateClouds: (cloudData: CloudRenderData[]) => {
      const activeIds = new Set(cloudData.map((c) => c.id));
      cleanupOldClouds(activeIds);

      for (const data of cloudData) {
        updateCloudMesh(data);
      }
    },
    dispose: () => {
      for (const [, mesh] of cloudMeshes) {
        scene.remove(mesh);
        mesh.traverse((child) => {
          if (child instanceof THREE.Mesh || child instanceof THREE.Sprite) {
            (child.material as THREE.Material).dispose();
          }
        });
      }
      cloudMeshes.clear();
      for (const tex of textureCache.values()) {
        tex.dispose();
      }
      textureCache.clear();
    },
  };
}

/**
 * Legacy compatibility wrapper - wraps enhanced clouds for the old interface
 */
export function buildCloudsLegacy(scene: THREE.Scene): EnhancedClouds {
  return buildEnhancedClouds(scene);
}
