import * as THREE from 'three'
import { SIMPLEX_NOISE_GLSL, VORONOI_NOISE_GLSL } from './noiseLib'

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
varying vec2 vRoadUV;
`

export const ASPHALT_VERTEX_WORLDPOS_INJECT = /* glsl */ `
vAsphaltWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
vRoadUV = uv;
`

export const ASPHALT_FRAGMENT_INJECT = /* glsl */ `
varying vec3 vAsphaltWorldPos;
varying vec2 vRoadUV;
uniform float uRainIntensity;
uniform float uTemperature;
uniform float uPitDarken;
uniform float uRoadWearStrength;
uniform sampler2D uAsphaltWornMap;
uniform sampler2D uSkidMarkMap;
uniform vec4 uSkidMarkBounds;
${SIMPLEX_NOISE_GLSL}
${VORONOI_NOISE_GLSL}

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

struct AggregateResult {
  float grainMix;
  float crevice;
  float cellId;
  float grainRoughness;
};

AggregateResult _aggCache;
bool _aggCacheValid = false;

AggregateResult _asphaltAggregate(vec2 worldXZ, float lodFade) {
  AggregateResult r;
  if (lodFade >= 1.0) {
    r.grainMix = 0.0;
    r.crevice = 0.0;
    r.cellId = 0.5;
    r.grainRoughness = 0.85;
    return r;
  }

  float scale = 100.0;
  vec2 sc = worldXZ * scale;
  vec3 vor = _voronoi3x3(sc);
  float F1 = vor.x;
  float F2 = vor.y;
  r.cellId = vor.z;

  r.crevice = 1.0 - smoothstep(0.02, 0.12, F2 - F1);
  r.grainMix = 1.0 - lodFade;

  r.grainRoughness = 0.75 + r.cellId * 0.20;

  return r;
}
`

export const ASPHALT_COLOR_INJECT = /* glsl */ `
{
  vec2 wXZ = vAsphaltWorldPos.xz;
  float roadU = clamp(vRoadUV.x, 0.0, 1.0);
  float roadV = vRoadUV.y;
  vec3 texBase = diffuseColor.rgb;
  vec3 texWorn = texture2D(uAsphaltWornMap, vMapUv).rgb;

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

  float _aggLodFade = smoothstep(5.0, 8.0, distance(vAsphaltWorldPos, cameraPosition));
  _aggCache = _asphaltAggregate(wXZ, _aggLodFade);
  _aggCacheValid = true;

  float grainTint = (_aggCache.cellId - 0.5) * 0.05;
  col += vec3(grainTint) * _aggCache.grainMix;
  col = mix(col, col * 0.55, _aggCache.crevice * _aggCache.grainMix);

  float edgeDust = max(1.0 - smoothstep(0.0, 0.18, roadU), smoothstep(0.82, 1.0, roadU));
  float centerBand = 1.0 - smoothstep(0.06, 0.34, abs(roadU - 0.5));
  float wheelGroove =
    smoothstep(0.18, 0.0, abs(roadU - 0.34)) +
    smoothstep(0.18, 0.0, abs(roadU - 0.66));
  wheelGroove = clamp(wheelGroove, 0.0, 1.0);
  float patchiness = _snoise(vec2(roadV * 0.35, roadU * 5.0) + vec2(31.0, 12.0)) * 0.5 + 0.5;
  float seam = smoothstep(
    0.48,
    0.5,
    abs(fract(roadV * 0.085 + _asphaltValNoise(wXZ * 0.35) * 0.1) - 0.5)
  );
  float wearMask = clamp(
    uRoadWearStrength * (wheelGroove * (0.34 + patchiness * 0.24) + centerBand * 0.08),
    0.0,
    0.82
  );

  vec3 texColor = mix(texBase, texWorn, wearMask);
  vec3 proceduralTint = mix(vec3(0.84, 0.84, 0.84), col * 1.12, 0.34);
  col = texColor * proceduralTint;

  col = mix(col, col * 1.14 + vec3(0.026, 0.022, 0.016), edgeDust * (0.18 + n2 * 0.12));
  col = mix(col, col * 0.8 + vec3(0.008, 0.008, 0.012), wheelGroove * (0.2 + patchiness * 0.26));
  col = mix(col, col * 0.9 + vec3(0.014), centerBand * 0.15);
  col = mix(col, col * 0.78, seam * 0.1);

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
  float roadU = clamp(vRoadUV.x, 0.0, 1.0);
  float rn = _asphaltValNoise(wXZ * 6.0 + vec2(500.0, 600.0));
  float baseRough = 0.78 + rn * 0.14;
  float edgeDust = max(1.0 - smoothstep(0.0, 0.18, roadU), smoothstep(0.82, 1.0, roadU));
  float wheelGroove =
    smoothstep(0.18, 0.0, abs(roadU - 0.34)) +
    smoothstep(0.18, 0.0, abs(roadU - 0.66));
  wheelGroove = clamp(wheelGroove, 0.0, 1.0);
  float puddleMask = smoothstep(0.55, 1.0, wet) * (_asphaltValNoise(wXZ * 1.1 + vec2(13.0, 4.0)));
  if (_aggCacheValid) {
    float grainRough = _aggCache.grainRoughness;
    float creviceRough = mix(grainRough, 0.98, _aggCache.crevice);
    roughnessFactor = mix(baseRough, creviceRough, _aggCache.grainMix);
  } else {
    roughnessFactor = baseRough;
  }
  roughnessFactor = mix(roughnessFactor, roughnessFactor + 0.1, edgeDust * 0.35);
  roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.7, wheelGroove * 0.4);
  roughnessFactor = mix(roughnessFactor, 0.16, puddleMask * 0.35);
  roughnessFactor *= mix(1.0, 0.34, wet);
  roughnessFactor *= mix(1.0, 1.15, frost);
}
`

export const ASPHALT_METALNESS_INJECT = /* glsl */ `
{
  float wet = clamp(uRainIntensity, 0.0, 1.0);
  float frost = clamp(smoothstep(5.0, -5.0, uTemperature), 0.0, 1.0);
  metalnessFactor = mix(metalnessFactor, 0.12, wet * 0.65);
  metalnessFactor = mix(metalnessFactor, 0.06, frost * 0.35);
}
`

export const ASPHALT_NORMAL_INJECT = /* glsl */ `
{
}
`

export function createAsphaltUniforms(): Record<string, THREE.IUniform> {
  return {
    uRainIntensity: { value: 0.0 },
    uTemperature: { value: 25.0 },
    uPitDarken: { value: 1.0 },
    uRoadWearStrength: { value: 1.0 },
    uAsphaltWornMap: { value: null },
    uSkidMarkMap: { value: null },
    uSkidMarkBounds: { value: new THREE.Vector4(0, 0, 0, 0) },
  }
}
