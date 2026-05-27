export const skyDomeVertex = /* glsl */ `
varying vec3 vWorldDirection;

void main() {
  vWorldDirection = normalize(position);
  mat4 rotView = mat4(mat3(modelViewMatrix));
  vec4 clipPos = projectionMatrix * rotView * vec4(position, 1.0);
  gl_Position = clipPos.xyww;
}
`

export const skyDomeFragment = /* glsl */ `
uniform vec3 uSunDirection;
uniform float uSunIntensity;
uniform float uTurbidity;
uniform float uRayleighStrength;
uniform float uMieStrength;
uniform float uExposure;
uniform vec3 uGroundColor;
uniform float uOvercast;

varying vec3 vWorldDirection;

const float PI = 3.14159265358979;
const float ONE_OVER_FOUR_PI = 0.07957747154594767;
const vec3 RAYLEIGH_BETA = vec3(5.5e-6, 13.0e-6, 22.4e-6);
const vec3 MIE_BETA = vec3(21e-6);

const float MIE_G = 0.76;

float rayleighPhase(float cosTheta) {
  return (3.0 / (16.0 * PI)) * (1.0 + cosTheta * cosTheta);
}

float miePhase(float cosTheta, float g) {
  float gg = g * g;
  float num = 1.0 - gg;
  float denom = pow(1.0 + gg - 2.0 * g * cosTheta, 1.5);
  return ONE_OVER_FOUR_PI * num / denom;
}

vec3 ACESFilmic(vec3 x) {
  float a = 2.51;
  float b = 0.03;
  float c = 2.43;
  float d = 0.59;
  float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

void main() {
  vec3 viewDir = normalize(vWorldDirection);
  vec3 sunDir = normalize(uSunDirection);

  float cosTheta = clamp(dot(viewDir, sunDir), -1.0, 1.0);
  float zenithCos = max(viewDir.y, 0.0);
  float horizonFactor = 1.0 - zenithCos;
  float horizonFactor3 = horizonFactor * horizonFactor * horizonFactor;

  float sunZenithCos = max(sunDir.y, 0.0);
  float dayMask = smoothstep(-0.06, 0.06, sunDir.y);

  float rayleighThickness = mix(1.0, 4.0, horizonFactor3);
  float mieThickness = mix(1.0, 8.0, horizonFactor3);

  vec3 rayleighScatter = RAYLEIGH_BETA * 1e6 * rayleighThickness * uRayleighStrength;
  vec3 mieScatter = MIE_BETA * 1e6 * mieThickness * uMieStrength * uTurbidity;

  float rPhase = rayleighPhase(cosTheta);
  float mPhase = miePhase(cosTheta, MIE_G);

  vec3 zenithBlue = vec3(0.12, 0.28, 0.58);
  vec3 horizonHaze = vec3(0.70, 0.80, 0.92);

  float duskAmount = 1.0 - smoothstep(0.0, 0.35, sunZenithCos);
  vec3 horizonDuskTint = mix(horizonHaze, vec3(0.95, 0.55, 0.32), duskAmount);
  vec3 zenithDuskTint = mix(zenithBlue, vec3(0.18, 0.18, 0.40), duskAmount * 0.8);

  vec3 baseSky = mix(horizonDuskTint, zenithDuskTint, smoothstep(0.0, 0.4, viewDir.y));

  vec3 rayleighColor = rayleighScatter * rPhase * vec3(0.4, 0.6, 1.0) * 0.6;
  vec3 mieColor = mieScatter * mPhase * vec3(1.0, 0.95, 0.85) * 0.15;

  vec3 sky = baseSky + (rayleighColor + mieColor) * dayMask;

  float sunAngle = acos(cosTheta);
  float sunAngularRadius = 0.0095;
  float sunDisc = smoothstep(sunAngularRadius * 1.3, sunAngularRadius * 0.85, sunAngle);
  float sunHalo = smoothstep(0.06, 0.0, sunAngle) * 0.35;
  float sunGlow = pow(max(cosTheta, 0.0), 24.0) * 0.18;

  vec3 sunDayColor = vec3(2.6, 2.45, 2.1);
  vec3 sunDuskColor = vec3(2.4, 1.3, 0.55);
  vec3 sunColor = mix(sunDuskColor, sunDayColor, smoothstep(0.0, 0.3, sunDir.y));

  float sunSuppress = 1.0 - uOvercast;
  sky += sunDisc * sunColor * uSunIntensity * dayMask * sunSuppress;
  sky += sunHalo * sunColor * 0.6 * uSunIntensity * dayMask * sunSuppress;
  sky += sunGlow * sunColor * 0.8 * uSunIntensity * dayMask * sunSuppress;

  vec3 overcastZenith = vec3(0.20, 0.23, 0.27);
  vec3 overcastHorizon = vec3(0.34, 0.38, 0.42);
  vec3 overcastSky = mix(overcastHorizon, overcastZenith, smoothstep(0.0, 0.55, viewDir.y));
  float brightDir = pow(max(cosTheta, 0.0), 3.0) * 0.12;
  overcastSky += brightDir * dayMask;

  sky = mix(sky, overcastSky, uOvercast);

  float belowHorizon = smoothstep(-0.05, 0.0, viewDir.y);
  vec3 overcastGround = mix(uGroundColor, vec3(0.16, 0.18, 0.20), uOvercast);
  vec3 finalColor = mix(overcastGround, sky, belowHorizon);

  vec3 mapped = ACESFilmic(finalColor * uExposure);
  gl_FragColor = vec4(mapped, 1.0);
  #include <colorspace_fragment>
}
`
