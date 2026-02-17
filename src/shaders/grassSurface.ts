import { SIMPLEX_NOISE_GLSL } from './noiseLib'

export const GRASS_VERTEX_PREAMBLE = /* glsl */ `
${SIMPLEX_NOISE_GLSL}
float grassFBM(vec2 p) {
  float v = 0.0;
  v += _snoise(p * 0.3) * 0.5;
  v += _snoise(p * 0.7) * 0.25;
  v += _snoise(p * 1.5) * 0.125;
  v += _snoise(p * 3.0) * 0.0625;
  return v;
}
`

export const GRASS_VERTEX_DISPLACEMENT = /* glsl */ `
{
  vec4 grassWorldPos = modelMatrix * vec4(transformed, 1.0);
  float disp = grassFBM(grassWorldPos.xz) * 0.04;
  transformed.z += disp;
}
`

export const GRASS_VERTEX_WORLDPOS_INJECT = /* glsl */ `
varying vec3 vGrassWorldPos;
`

export const GRASS_FRAGMENT_PREAMBLE = /* glsl */ `
varying vec3 vGrassWorldPos;
${SIMPLEX_NOISE_GLSL}

float _grassValNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5453);
  float b = fract(sin(dot(i + vec2(1.0, 0.0), vec2(127.1, 311.7))) * 43758.5453);
  float c = fract(sin(dot(i + vec2(0.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
  float d = fract(sin(dot(i + vec2(1.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
`

export const GRASS_COLOR_INJECT = /* glsl */ `
{
  vec2 wXZ = vGrassWorldPos.xz;

  vec3 darkGreen = vec3(0.20, 0.38, 0.18);
  vec3 midGreen = vec3(0.32, 0.55, 0.26);
  vec3 lightGreen = vec3(0.45, 0.70, 0.35);

  float n1 = _snoise(wXZ * 0.08) * 0.5 + 0.5;
  float n2 = _snoise(wXZ * 0.3 + vec2(50.0, 80.0)) * 0.5 + 0.5;
  float n3 = _snoise(wXZ * 1.2 + vec2(120.0, 200.0)) * 0.5 + 0.5;
  float micro = _grassValNoise(wXZ * 8.0);

  vec3 col = mix(darkGreen, midGreen, n1);
  col = mix(col, lightGreen, n2 * 0.4);
  col = mix(col, darkGreen, n3 * 0.25);
  col *= 0.85 + micro * 0.3;

  diffuseColor.rgb = col;
}
`

export const GRASS_ROUGHNESS_INJECT = /* glsl */ `
{
  vec2 wXZ = vGrassWorldPos.xz;
  float rn = _snoise(wXZ * 2.0 + vec2(300.0, 400.0)) * 0.5 + 0.5;
  roughnessFactor = 0.85 + rn * 0.1;
}
`
