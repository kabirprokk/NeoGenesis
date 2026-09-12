// Fetches redistributable real-world datasets + CC0-style 3D models into frontend/public/.
// Re-run: `npm run fetch-assets` (needs internet). The game boots with procedural
// fallbacks if files are missing, so this is optional for first run.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
const FILES = [
  { url: "https://unpkg.com/three-globe@2.31.0/example/img/earth-day.jpg", out: "earth/earth-day.jpg",
    license: "NASA Blue Marble imagery via three-globe example assets (MIT, Vasco Asturiano). Production: source direct from NASA Visible Earth." },
  { url: "https://unpkg.com/three-globe@2.31.0/example/img/earth-topology.png", out: "earth/earth-topology.png",
    license: "Derived relief/bathymetry texture via three-globe example assets (MIT). Used as relief proxy, not survey DEM." },
  { url: "https://unpkg.com/three-globe@2.31.0/example/img/earth-water.png", out: "earth/earth-water.png",
    license: "Ocean mask via three-globe example assets (MIT). Defines real coastlines in-game." },
  { url: "https://threejs.org/examples/models/gltf/Horse.glb", out: "models/horse.glb",
    license: "three.js example asset. Enabled only in ice-age-inspired preset (Pleistocene equids)." },
];

const manifest = { fetchedAt: new Date().toISOString(), files: [] };
for (const f of FILES) {
  const res = await fetch(f.url);
  if (!res.ok) { console.error(`FAIL ${res.status} ${f.url}`); continue; }
  const buf = Buffer.from(await res.arrayBuffer());
  const dest = join(root, f.out);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, buf);
  manifest.files.push({ ...f, bytes: buf.length });
  console.log(`ok ${(buf.length / 1024).toFixed(0)} KB -> public/${f.out}`);
}
writeFileSync(join(root, "asset-manifest.json"), JSON.stringify(manifest, null, 2));
console.log("manifest written.");
