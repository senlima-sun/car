import * as THREE from 'three'

export const grassVertexShader = /* glsl */ `
attribute float aEdgeDist;

varying vec3 vWorldPos;
varying float vEdgeDist;
varying vec3 vNormal;

void main() {
  vEdgeDist = aEdgeDist;
  vNormal = normalize(normalMatrix * normal);

  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;

  gl_Position = projectionMatrix * viewMatrix * wp;
}
`

export const grassFragmentShader = /* glsl */ `
uniform float uTime;
uniform float uOpacity;

varying vec3 vWorldPos;
varying float vEdgeDist;
varying vec3 vNormal;

vec3 mod289v3(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289v2(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289v3(((x * 34.0) + 10.0) * x); }

float snoise(vec2 v) {
  const vec4 C = vec4(
    0.211324865405187,
    0.366025403784439,
    -0.577350269189626,
    0.024390243902439
  );

  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);

  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;

  i = mod289v2(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));

  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;

  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;

  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);

  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;

  return 130.0 * dot(m, g);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);

  float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5453);
  float b = fract(sin(dot(i + vec2(1.0, 0.0), vec2(127.1, 311.7))) * 43758.5453);
  float c = fract(sin(dot(i + vec2(0.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
  float d = fract(sin(dot(i + vec2(1.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);

  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float grassBladePattern(vec2 p, float direction) {
  float angle = direction * 3.14159;
  float ca = cos(angle);
  float sa = sin(angle);
  vec2 rotated = vec2(p.x * ca - p.y * sa, p.x * sa + p.y * ca);

  float blades = snoise(vec2(rotated.x * 40.0, rotated.y * 6.0));
  float fineBlade = snoise(vec2(rotated.x * 80.0, rotated.y * 12.0));

  return blades * 0.6 + fineBlade * 0.4;
}

void main() {
  vec2 worldXZ = vWorldPos.xz;

  vec3 darkGreen = vec3(0.227, 0.420, 0.271);
  vec3 medGreen = vec3(0.353, 0.612, 0.310);
  vec3 lightGreen = vec3(0.482, 0.769, 0.416);

  float largeNoise = snoise(worldXZ * 0.3 + uTime * 0.01) * 0.5 + 0.5;
  float medNoise = snoise(worldXZ * 1.2 + vec2(50.0, 80.0)) * 0.5 + 0.5;

  float baseBlend = largeNoise;
  vec3 baseColor = mix(darkGreen, medGreen, baseBlend);
  baseColor = mix(baseColor, lightGreen, medNoise * 0.4);

  float windDirection = snoise(worldXZ * 0.1 + uTime * 0.05) * 0.5 + 0.5;
  float bladePattern = grassBladePattern(worldXZ, windDirection);
  baseColor += vec3(0.02, 0.04, 0.01) * bladePattern;

  vec3 lightDir = normalize(vec3(0.5, 1.0, 0.3));
  float ndotl = max(dot(vNormal, lightDir), 0.0);
  float ambient = 0.35;
  float diffuse = 0.65 * ndotl;
  vec3 litColor = baseColor * (ambient + diffuse);

  float edgeAlpha = smoothstep(0.0, 0.15, vEdgeDist);
  float finalAlpha = uOpacity * edgeAlpha;

  gl_FragColor = vec4(litColor, finalAlpha);
}
`

export function createGrassUniforms(): Record<string, THREE.IUniform> {
  return {
    uTime: { value: 0.0 },
    uOpacity: { value: 1.0 },
  }
}
