import * as THREE from 'three'
import { HASH_GLSL, SIMPLEX_NOISE_GLSL, VALUE_NOISE_GLSL } from './noiseLib'

export const ASPHALT_VERTEX_INJECT = /* glsl */ `
varying vec3 vAsphaltWorldPos;
`

export const ASPHALT_VERTEX_WORLDPOS_INJECT = /* glsl */ `
vAsphaltWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
`

export const ASPHALT_FRAGMENT_INJECT = /* glsl */ `
varying vec3 vAsphaltWorldPos;
uniform float uWetness;
uniform sampler2D uSkidMarkMap;
uniform vec4 uSkidMarkBounds;

${HASH_GLSL}
${SIMPLEX_NOISE_GLSL}
${VALUE_NOISE_GLSL}
`

export const ASPHALT_COLOR_INJECT = /* glsl */ `
{
  vec2 wXZ = vAsphaltWorldPos.xz;

  // --- Layer 1: Aggregate base color ---
  float n1 = _valNoise(wXZ * 8.0) * 0.5 + 0.5;
  float n2 = _valNoise(wXZ * 20.0 + vec2(73.1, 91.7)) * 0.5 + 0.5;
  float n3 = _valNoise(wXZ * 50.0 + vec2(137.0, 211.0)) * 0.5 + 0.5;

  vec3 darkAsphalt = vec3(0.165, 0.165, 0.175);
  vec3 medAsphalt = vec3(0.200, 0.195, 0.205);
  vec3 lightAsphalt = vec3(0.230, 0.225, 0.230);

  vec3 asphaltCol = mix(darkAsphalt, medAsphalt, n1);
  asphaltCol = mix(asphaltCol, lightAsphalt, n2 * 0.4);

  // Brown/blue aggregate color shifts
  float brownShift = _valNoise(wXZ * 12.0 + vec2(200.0, 300.0));
  float blueShift = _valNoise(wXZ * 15.0 + vec2(400.0, 100.0));
  asphaltCol += vec3(0.015, 0.008, 0.0) * brownShift;
  asphaltCol += vec3(-0.005, -0.002, 0.01) * blueShift;

  // Fine aggregate grain
  asphaltCol *= 0.92 + n3 * 0.16;

  // --- Layer 2: Roller marks (anisotropic along road direction) ---
  float rollerNoise = _valNoise(vec2(wXZ.x * 3.0, wXZ.y * 40.0));
  float rollerFine = _valNoise(vec2(wXZ.x * 5.0, wXZ.y * 80.0));
  float roller = rollerNoise * 0.6 + rollerFine * 0.4;
  asphaltCol *= 0.97 + roller * 0.06;

  // --- Layer 3: Micro cracks ---
  float crack1 = _snoise(wXZ * 100.0);
  float crack2 = _snoise(wXZ * 70.0 + vec2(500.0, 700.0));
  float crackMask = smoothstep(0.65, 0.75, abs(crack1)) * smoothstep(0.7, 0.8, abs(crack2));
  asphaltCol = mix(asphaltCol, asphaltCol * 0.75, crackMask * 0.3);

  // --- Layer 4: Oil stains ---
  float oilNoise = _snoise(wXZ * 2.5 + vec2(1000.0, 2000.0));
  float oilMask = smoothstep(0.55, 0.7, oilNoise);
  vec3 oilColor = asphaltCol * 0.8;
  // Subtle iridescence on oil patches
  float iridescence = _snoise(wXZ * 30.0) * 0.5 + 0.5;
  oilColor += vec3(
    sin(iridescence * 6.28) * 0.015,
    sin(iridescence * 6.28 + 2.09) * 0.015,
    sin(iridescence * 6.28 + 4.19) * 0.015
  );
  asphaltCol = mix(asphaltCol, oilColor, oilMask * 0.5);

  // --- Layer 5: Edge wear (UV.u-based) ---
  float edgeU = gl_FragCoord.x; // fallback; real UV below
  #ifdef HAS_ROAD_UV
    float roadU = vRoadUV.x;
    float edgeWear = smoothstep(0.0, 0.15, roadU) * smoothstep(1.0, 0.85, roadU);
    edgeWear = 1.0 - edgeWear;
    asphaltCol = mix(asphaltCol, asphaltCol * 1.15 + vec3(0.02), edgeWear * 0.4);
  #endif

  // --- Wetness effect ---
  float wet = uWetness;
  asphaltCol *= mix(1.0, 0.7, wet);

  // --- Skid mark overlay ---
  if (uSkidMarkBounds.z > uSkidMarkBounds.x && uSkidMarkBounds.w > uSkidMarkBounds.y) {
    vec2 skidUV = (wXZ - uSkidMarkBounds.xy) / (uSkidMarkBounds.zw - uSkidMarkBounds.xy);
    if (skidUV.x >= 0.0 && skidUV.x <= 1.0 && skidUV.y >= 0.0 && skidUV.y <= 1.0) {
      vec4 skidSample = texture2D(uSkidMarkMap, skidUV);
      float rubberIntensity = skidSample.r;
      vec3 rubberColor = vec3(0.06, 0.06, 0.08);
      asphaltCol = mix(asphaltCol, rubberColor, rubberIntensity * 0.8);

      // Wet skid marks (G channel) - lighter gray with sheen
      float wetMark = skidSample.g;
      vec3 wetMarkColor = vec3(0.15, 0.16, 0.18);
      asphaltCol = mix(asphaltCol, wetMarkColor, wetMark * 0.5 * wet);
    }
  }

  diffuseColor.rgb = asphaltCol;
}
`

export const ASPHALT_PIT_COLOR_INJECT = ASPHALT_COLOR_INJECT.replace(
  'vec3 darkAsphalt = vec3(0.165, 0.165, 0.175);',
  'vec3 darkAsphalt = vec3(0.145, 0.145, 0.155);',
).replace(
  'vec3 medAsphalt = vec3(0.200, 0.195, 0.205);',
  'vec3 medAsphalt = vec3(0.180, 0.175, 0.185);',
).replace(
  'vec3 lightAsphalt = vec3(0.230, 0.225, 0.230);',
  'vec3 lightAsphalt = vec3(0.210, 0.205, 0.210);',
)

export function createAsphaltUniforms(): Record<string, THREE.IUniform> {
  return {
    uWetness: { value: 0.0 },
    uSkidMarkMap: { value: null },
    uSkidMarkBounds: { value: new THREE.Vector4(0, 0, 0, 0) },
  }
}
