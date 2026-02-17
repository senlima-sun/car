import * as THREE from 'three'
import { SIMPLEX_NOISE_GLSL } from './noiseLib'

export const ASPHALT_VERTEX_NOISE_PREAMBLE = /* glsl */ `
${SIMPLEX_NOISE_GLSL}
float asphaltFBM(vec2 p) {
  float v = 0.0;
  v += _snoise(p * 2.0) * 0.5;
  v += _snoise(p * 5.0) * 0.25;
  v += _snoise(p * 12.0) * 0.125;
  return v;
}
`

export const ASPHALT_VERTEX_DISPLACEMENT = /* glsl */ `
{
  vec4 asphaltWP = modelMatrix * vec4(transformed, 1.0);
  float disp = asphaltFBM(asphaltWP.xz) * 0.008;
  transformed.y += disp;
}
`

export const ASPHALT_VERTEX_INJECT = /* glsl */ `
varying vec3 vAsphaltWorldPos;
`

export const ASPHALT_VERTEX_WORLDPOS_INJECT = /* glsl */ `
vAsphaltWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
`

export const ASPHALT_FRAGMENT_INJECT = /* glsl */ `
varying vec3 vAsphaltWorldPos;
uniform float uRainIntensity;
uniform float uTemperature;
uniform float uPitDarken;
uniform sampler2D uSkidMarkMap;
uniform vec4 uSkidMarkBounds;
${SIMPLEX_NOISE_GLSL}

float _asphaltValNoise(vec2 p) {
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

export const ASPHALT_COLOR_INJECT = /* glsl */ `
{
  vec2 wXZ = vAsphaltWorldPos.xz;

  float wet = clamp(uRainIntensity, 0.0, 1.0);
  float frost = clamp(smoothstep(5.0, -5.0, uTemperature), 0.0, 1.0);

  vec3 darkAsphalt = vec3(0.18, 0.18, 0.19);
  vec3 midAsphalt = vec3(0.26, 0.26, 0.27);
  vec3 lightAsphalt = vec3(0.33, 0.32, 0.31);

  float n1 = _snoise(wXZ * 0.5) * 0.5 + 0.5;
  float n2 = _snoise(wXZ * 2.0 + vec2(37.0, 91.0)) * 0.5 + 0.5;
  float n3 = _asphaltValNoise(wXZ * 8.0);
  float micro = _asphaltValNoise(wXZ * 30.0);

  vec3 col = mix(darkAsphalt, midAsphalt, n1);
  col = mix(col, lightAsphalt, n2 * 0.3);
  col *= 0.9 + n3 * 0.2;
  col += vec3(micro * 0.04 - 0.02);

  float ao = _asphaltValNoise(wXZ * 4.0 + vec2(200.0, 150.0));
  col *= mix(0.85, 1.0, ao);

  #ifdef HAS_ROAD_UV
    float roadU = vRoadUV.x;
    float edgeWear = smoothstep(0.0, 0.15, roadU) * smoothstep(1.0, 0.85, roadU);
    edgeWear = 1.0 - edgeWear;
    col = mix(col, col * 1.15 + vec3(0.02), edgeWear * 0.4);
  #endif

  col *= mix(1.0, 0.65, wet);

  col = mix(col, col * vec3(0.9, 0.95, 1.1), frost * 0.4);

  col *= uPitDarken;

  if (uSkidMarkBounds.z > uSkidMarkBounds.x && uSkidMarkBounds.w > uSkidMarkBounds.y) {
    vec2 skidUV = (wXZ - uSkidMarkBounds.xy) / (uSkidMarkBounds.zw - uSkidMarkBounds.xy);
    if (skidUV.x >= 0.0 && skidUV.x <= 1.0 && skidUV.y >= 0.0 && skidUV.y <= 1.0) {
      vec4 skidSample = texture2D(uSkidMarkMap, skidUV);
      float rubberIntensity = skidSample.r;
      vec3 rubberColor = vec3(0.06, 0.06, 0.08);
      col = mix(col, rubberColor, rubberIntensity * 0.8);

      float wetMark = skidSample.g;
      vec3 wetMarkColor = vec3(0.15, 0.16, 0.18);
      col = mix(col, wetMarkColor, wetMark * 0.5 * wet);
    }
  }

  diffuseColor.rgb = col;
}
`

export const ASPHALT_ROUGHNESS_INJECT = /* glsl */ `
{
  float wet = clamp(uRainIntensity, 0.0, 1.0);
  float frost = clamp(smoothstep(5.0, -5.0, uTemperature), 0.0, 1.0);
  vec2 wXZ = vAsphaltWorldPos.xz;
  float rn = _asphaltValNoise(wXZ * 6.0 + vec2(500.0, 600.0));
  roughnessFactor = 0.78 + rn * 0.14;
  roughnessFactor *= mix(1.0, 0.3, wet);
  roughnessFactor *= mix(1.0, 1.15, frost);
}
`

export const ASPHALT_METALNESS_INJECT = /* glsl */ `
{
  float wet = clamp(uRainIntensity, 0.0, 1.0);
  float frost = clamp(smoothstep(5.0, -5.0, uTemperature), 0.0, 1.0);
  metalnessFactor = mix(metalnessFactor, 0.6, wet * wet);
  metalnessFactor = mix(metalnessFactor, 0.4, frost * 0.5);
}
`

export function createAsphaltUniforms(): Record<string, THREE.IUniform> {
  return {
    uRainIntensity: { value: 0.0 },
    uTemperature: { value: 25.0 },
    uPitDarken: { value: 1.0 },
    uSkidMarkMap: { value: null },
    uSkidMarkBounds: { value: new THREE.Vector4(0, 0, 0, 0) },
  }
}
