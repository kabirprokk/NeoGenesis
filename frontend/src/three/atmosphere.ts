// Physically-inspired atmosphere shaders (Rayleigh + Mie, artistic coefficients).
export const ATMOS_VERT = /* glsl */ `
varying vec3 vWorldPos;
varying vec3 vNormal;
void main() {
  vNormal = normalize(normalMatrix * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

export const ATMOS_FRAG = /* glsl */ `
varying vec3 vWorldPos;
varying vec3 vNormal;
uniform vec3 sunDir;
uniform vec3 rayleigh;   // per-channel scattering strength
uniform float mieStrength;
uniform float mieG;
uniform vec3 dayZenith;
uniform vec3 sunsetTint;
uniform vec3 nightZenith;
uniform float nightFactor; // 0 day → 1 night
float miePhase(float cosT, float g) {
  float g2 = g * g;
  return 1.5 * ((1.0 - g2) / (2.0 + g2)) * (1.0 + cosT * cosT) / pow(1.0 + g2 - 2.0 * g * cosT, 1.5);
}
void main() {
  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  vec3 n = normalize(vNormal);
  float sunH = clamp(dot(n, sunDir) * 0.5 + 0.5, 0.0, 1.0);
  float cosT = dot(viewDir, sunDir);
  float ray = pow(clamp(1.0 - abs(dot(viewDir, n)), 0.0, 1.0), 2.0);
  vec3 scatter = rayleigh * ray * (0.35 + 0.65 * sunH) * 90000.0;
  float mie = miePhase(cosT, mieG) * mieStrength;
  vec3 dayCol = dayZenith + scatter + sunsetTint * pow(clamp(1.0 - abs(sunDir.y), 0.0, 1.0), 3.0) * 0.9 + vec3(1.0,0.95,0.9) * mie * 0.35;
  vec3 col = mix(dayCol, nightZenith + vec3(0.02,0.03,0.06) * mie, nightFactor);
  // Horizon haze
  float haze = pow(1.0 - abs(dot(viewDir, n)), 4.0);
  col += vec3(0.55, 0.6, 0.65) * haze * (1.0 - nightFactor) * 0.25;
  gl_FragColor = vec4(col, 1.0);
}`;
