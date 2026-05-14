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
uniform sampler2D uGrassDryMap;
uniform sampler2D uGrassWornMap;
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
  vec3 texBase = diffuseColor.rgb;
  vec3 texDry = texture2D(uGrassDryMap, vMapUv).rgb;
  vec3 texWorn = texture2D(uGrassWornMap, vMapUv).rgb;

  vec3 forestGreen = vec3(0.17, 0.31, 0.14);
  vec3 deepGreen = vec3(0.23, 0.40, 0.18);
  vec3 healthyGreen = vec3(0.33, 0.54, 0.24);
  vec3 brightGreen = vec3(0.47, 0.69, 0.34);
  vec3 dryGreen = vec3(0.46, 0.48, 0.22);
  vec3 soilBrown = vec3(0.33, 0.27, 0.18);

  float macro = _snoise(wXZ * 0.04 + vec2(18.0, -27.0)) * 0.5 + 0.5;
  float meadow = _snoise(wXZ * 0.11 + vec2(70.0, 95.0)) * 0.5 + 0.5;
  float tonal = _snoise(wXZ * 0.45 + vec2(120.0, 200.0)) * 0.5 + 0.5;
  float micro = _grassValNoise(wXZ * 10.0);
  float dryField = _snoise(wXZ * 0.03 + vec2(-140.0, 50.0)) * 0.5 + 0.5;
  float bareSoil = smoothstep(0.68, 0.96, _grassValNoise(wXZ * 1.8 + vec2(33.0, 61.0)));
  float bladeBands =
    _snoise(vec2(wXZ.x * 1.5 + meadow * 4.0, wXZ.y * 9.0 + macro * 7.0)) * 0.5 + 0.5;
  float lowBands =
    _snoise(vec2(wXZ.x * 0.22 - meadow * 1.7, wXZ.y * 1.4 + macro * 2.5)) * 0.5 + 0.5;
  float dryMask = smoothstep(0.58, 0.84, dryField);
  float wornField = _snoise(wXZ * 0.055 + vec2(240.0, -95.0)) * 0.5 + 0.5;
  float wornMask = smoothstep(0.66, 0.9, wornField) * (0.45 + lowBands * 0.3);

  vec3 col = mix(forestGreen, deepGreen, macro);
  col = mix(col, healthyGreen, meadow * 0.65);
  col = mix(col, brightGreen, tonal * 0.35);
  col = mix(col, dryGreen, dryMask * (0.22 + bareSoil * 0.33));
  col = mix(col, soilBrown, bareSoil * dryMask * 0.52);
  col *= 0.82 + micro * 0.24;
  col *= 0.88 + lowBands * 0.18;
  col += vec3(0.015, 0.028, 0.010) * pow(bladeBands, 2.0);

  vec3 texColor = mix(texBase, texDry, dryMask * 0.58);
  texColor = mix(texColor, texWorn, wornMask * 0.52);
  texColor *= mix(vec3(0.84, 0.88, 0.82), col * 1.42, 0.42);
  texColor = mix(texColor, soilBrown * 1.05, bareSoil * dryMask * 0.16);

  diffuseColor.rgb = texColor;
}
`

export const GRASS_ROUGHNESS_INJECT = /* glsl */ `
{
  vec2 wXZ = vGrassWorldPos.xz;
  float rn = _snoise(wXZ * 1.6 + vec2(300.0, 400.0)) * 0.5 + 0.5;
  float dryField = _snoise(wXZ * 0.03 + vec2(-140.0, 50.0)) * 0.5 + 0.5;
  float bladeGloss =
    _snoise(vec2(wXZ.x * 1.2 + 2.0, wXZ.y * 8.5 + 4.0)) * 0.5 + 0.5;
  roughnessFactor *= 0.9 + rn * 0.16;
  roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.84, bladeGloss * 0.16);
  roughnessFactor = mix(
    roughnessFactor,
    min(1.0, roughnessFactor * 1.1),
    smoothstep(0.58, 0.84, dryField) * 0.28
  );
  roughnessFactor = clamp(roughnessFactor, 0.46, 1.0);
}
`
