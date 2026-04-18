import * as THREE from 'three'
import { HASH_GLSL } from './noiseLib'

export const CAR_PAINT_VERTEX_INJECT = /* glsl */ `
varying vec3 vCarPaintWorldPos;
varying vec3 vCarPaintNormal;
varying vec3 vCarPaintObjPos;
`

export const CAR_PAINT_VERTEX_WORLDPOS_INJECT = /* glsl */ `
vCarPaintWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
vCarPaintNormal = normalize((modelMatrix * vec4(objectNormal, 0.0)).xyz);
vCarPaintObjPos = transformed;
`

export const CAR_PAINT_FRAGMENT_INJECT = /* glsl */ `
varying vec3 vCarPaintWorldPos;
varying vec3 vCarPaintNormal;
varying vec3 vCarPaintObjPos;
uniform float uRainIntensity;
uniform float uFlakeScale;
uniform float uFlakeIntensity;
uniform float uClearcoatStrength;
uniform float uColorDepthFactor;
uniform float uCameraDistance;

${HASH_GLSL}

vec3 _flakeNormal(vec2 cell) {
  float a = _hash1(cell) * 6.2831853;
  float z = _hash1(cell + vec2(71.0, 33.0)) * 0.5 + 0.5;
  float r = sqrt(1.0 - z * z);
  return vec3(cos(a) * r, sin(a) * r, z);
}

float _carPaintFlake(vec3 objPos, vec3 viewDir, vec3 N, float scale) {
  vec3 blendW = abs(N);
  blendW = pow(blendW, vec3(4.0));
  blendW /= dot(blendW, vec3(1.0));

  float sparkle = 0.0;

  vec2 uvXY = objPos.xy * scale;
  vec2 uvXZ = objPos.xz * scale;
  vec2 uvYZ = objPos.yz * scale;

  for (int proj = 0; proj < 3; proj++) {
    vec2 uv = proj == 0 ? uvYZ : (proj == 1 ? uvXZ : uvXY);
    float w = proj == 0 ? blendW.x : (proj == 1 ? blendW.y : blendW.z);
    if (w < 0.01) continue;

    vec2 cell = floor(uv);
    vec2 f = fract(uv);
    float projSparkle = 0.0;

    for (int dy = -1; dy <= 1; dy++) {
      for (int dx = -1; dx <= 1; dx++) {
        vec2 neighbor = vec2(float(dx), float(dy));
        vec2 cellCoord = cell + neighbor;
        vec2 offset = _hash2(cellCoord);
        vec2 diff = neighbor + offset - f;
        float dist2 = dot(diff, diff);
        if (dist2 > 1.0) continue;

        vec3 flakeN = _flakeNormal(cellCoord);
        vec3 perturbedN = normalize(N + flakeN * 0.25);
        vec3 R = reflect(-viewDir, perturbedN);
        float spec = max(dot(R, viewDir), 0.0);
        spec = pow(spec, 128.0);
        float falloff = 1.0 - dist2;
        projSparkle += spec * falloff * falloff;
      }
    }
    sparkle += projSparkle * w;
  }
  return sparkle;
}

float _carPaintFresnel(float NdotV) {
  return 0.04 + 0.96 * pow(clamp(1.0 - NdotV, 0.0, 1.0), 5.0);
}
`

export const CAR_PAINT_COLOR_INJECT = /* glsl */ `
{
  vec3 cpViewDir = normalize(cameraPosition - vCarPaintWorldPos);
  vec3 cpNormal = normalize(vCarPaintNormal);
  float cpNdotV = max(dot(cpNormal, cpViewDir), 0.001);

  float texLum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
  float paintMask = smoothstep(0.04, 0.12, texLum);

  float depthDarken = pow(1.0 - cpNdotV, 3.0);
  diffuseColor.rgb *= 1.0 - uColorDepthFactor * depthDarken * paintMask;

  float flakeLod = smoothstep(12.0, 20.0, uCameraDistance);
  if (flakeLod < 1.0 && uFlakeIntensity > 0.01) {
    float flake = _carPaintFlake(vCarPaintObjPos, cpViewDir, cpNormal, uFlakeScale);
    flake *= uFlakeIntensity * (1.0 - flakeLod) * paintMask;
    flake *= 1.0 - uRainIntensity * 0.7;
    diffuseColor.rgb += diffuseColor.rgb * flake * 2.0 + vec3(flake * 0.15);
  }
}
`

export const CAR_PAINT_ROUGHNESS_INJECT = /* glsl */ `
{
  float cpTexLum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
  float cpPaintMask = smoothstep(0.04, 0.12, cpTexLum);

  float carbonRough = 0.55;
  float baseRough = mix(carbonRough, roughnessFactor, cpPaintMask);

  vec3 cpViewDir2 = normalize(cameraPosition - vCarPaintWorldPos);
  vec3 cpNormal2 = normalize(vCarPaintNormal);
  float cpNdotV2 = max(dot(cpNormal2, cpViewDir2), 0.001);
  float cpFresnel = _carPaintFresnel(cpNdotV2);

  float clearcoatSmooth = cpFresnel * uClearcoatStrength * cpPaintMask;
  baseRough *= 1.0 - clearcoatSmooth * 0.5;
  baseRough *= mix(1.0, 0.35, uRainIntensity);
  roughnessFactor = clamp(baseRough, 0.04, 1.0);
}
`

export const CAR_PAINT_METALNESS_INJECT = /* glsl */ `
{
  float cpTexLum2 = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
  float cpPaintMask2 = smoothstep(0.04, 0.12, cpTexLum2);

  float carbonMetal = 0.08;
  metalnessFactor = mix(carbonMetal, metalnessFactor, cpPaintMask2);
  metalnessFactor = mix(metalnessFactor, 0.45, uRainIntensity * 0.4 * cpPaintMask2);
}
`

export function createCarPaintUniforms(): Record<string, THREE.IUniform> {
  return {
    uRainIntensity: { value: 0.0 },
    uFlakeScale: { value: 800.0 },
    uFlakeIntensity: { value: 0.4 },
    uClearcoatStrength: { value: 0.8 },
    uColorDepthFactor: { value: 0.3 },
    uCameraDistance: { value: 10.0 },
  }
}
