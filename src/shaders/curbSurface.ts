import * as THREE from 'three'
import { SIMPLEX_NOISE_GLSL } from './noiseLib'

export const CURB_VERTEX_PREAMBLE = /* glsl */ `
${SIMPLEX_NOISE_GLSL}
varying vec3 vCurbWorldPos;
varying vec2 vCurbLocalUV;
`

export const CURB_VERTEX_MAIN = /* glsl */ `
{
  vCurbWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
  vCurbLocalUV = uv;
}
`

export const CURB_FRAGMENT_PREAMBLE = /* glsl */ `
${SIMPLEX_NOISE_GLSL}
varying vec3 vCurbWorldPos;
varying vec2 vCurbLocalUV;

uniform int uCurbType;
uniform float uRainIntensity;
uniform float uTemperature;
uniform float uStripeWidth;
uniform float uToothSpacing;
uniform vec3 uPrimaryColor;
uniform vec3 uSecondaryColor;

float curbFBM(vec2 p) {
  float v = 0.0;
  v += _snoise(p * 20.0) * 0.5;
  v += _snoise(p * 80.0) * 0.25;
  return v * 0.5 + 0.5;
}

vec3 curbConcreteNormal(vec2 p) {
  float eps = 0.002;
  float c  = _snoise(p * 40.0);
  float cx = _snoise((p + vec2(eps, 0.0)) * 40.0);
  float cy = _snoise((p + vec2(0.0, eps)) * 40.0);
  return normalize(vec3((c - cx) / eps * 0.15, 1.0, (c - cy) / eps * 0.15));
}
`

export const CURB_COLOR_INJECT = /* glsl */ `
{
  vec2 wXZ = vCurbWorldPos.xz;
  float wet = clamp(uRainIntensity, 0.0, 1.0);
  float frost = clamp(smoothstep(5.0, -5.0, uTemperature), 0.0, 1.0);

  float lengthPos = vCurbLocalUV.y;
  float stripePhase = lengthPos / uStripeWidth;
  float stripeFrac = fract(stripePhase);
  float stripeAA = fwidth(stripePhase);
  float stripeMask = smoothstep(0.5 - stripeAA, 0.5 + stripeAA, stripeFrac);

  vec3 stripeColor = mix(uPrimaryColor, uSecondaryColor, stripeMask);

  float concrete = curbFBM(wXZ);
  vec3 concreteColor = vec3(0.55, 0.53, 0.50) * (0.85 + concrete * 0.3);

  float widthPos = vCurbLocalUV.x;
  float edgeDist = min(stripeFrac, 1.0 - stripeFrac);
  float wearEdge = smoothstep(0.0, 0.06 + stripeAA, edgeDist);
  float wearNoise = _snoise(wXZ * 12.0) * 0.5 + 0.5;
  float wearMask = wearEdge * (0.7 + wearNoise * 0.3);
  vec3 paintedColor = mix(concreteColor, stripeColor, wearMask);

  float rubberZone = smoothstep(0.2, 0.4, widthPos) * smoothstep(0.8, 0.6, widthPos);
  float rubberNoise = _snoise(wXZ * 15.0) * 0.5 + 0.5;
  float rubberMask = rubberZone * rubberNoise * 0.15;
  paintedColor = mix(paintedColor, paintedColor * 0.7, rubberMask);

  paintedColor *= mix(1.0, 0.65, wet);
  paintedColor = mix(paintedColor, paintedColor * vec3(0.9, 0.95, 1.1), frost * 0.3);

  diffuseColor.rgb = paintedColor;
}
`

export const CURB_ROUGHNESS_INJECT = /* glsl */ `
{
  float wet = clamp(uRainIntensity, 0.0, 1.0);
  roughnessFactor = mix(0.75, 0.3, wet);
}
`

export const CURB_METALNESS_INJECT = /* glsl */ `
{
  float wet = clamp(uRainIntensity, 0.0, 1.0);
  metalnessFactor = mix(0.0, 0.4, wet * wet);
}
`

export const CURB_NORMAL_INJECT = /* glsl */ `
{
  vec3 cNorm = curbConcreteNormal(vCurbWorldPos.xz);
  normal = normalize(mix(normal, cNorm, 0.35));
}
`

export function createCurbUniforms(): Record<string, THREE.IUniform> {
  return {
    uCurbType: { value: 0 },
    uRainIntensity: { value: 0.0 },
    uTemperature: { value: 25.0 },
    uStripeWidth: { value: 0.45 },
    uToothSpacing: { value: 0.8 },
    uPrimaryColor: { value: new THREE.Color('#cc0000') },
    uSecondaryColor: { value: new THREE.Color('#ffffff') },
  }
}
