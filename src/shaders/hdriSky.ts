export const hdriSkyVertex = /* glsl */ `
varying vec3 vWorldDirection;

void main() {
  vWorldDirection = normalize(position);
  mat4 rotView = mat4(mat3(modelViewMatrix));
  vec4 clipPos = projectionMatrix * rotView * vec4(position, 1.0);
  gl_Position = clipPos.xyww;
}
`

export const hdriSkyFragment = /* glsl */ `
#define MAX_WEATHER_SOURCES 8

uniform sampler2D tex0;
uniform sampler2D tex3;
uniform float exposure;
uniform float uRotation;
uniform float uTime;
uniform vec4 uWeatherSources[MAX_WEATHER_SOURCES];
uniform int uWeatherSourceCount;
uniform vec2 uCameraXZ;
uniform float uSourceBiasStrength;

varying vec3 vWorldDirection;

#define RECIPROCAL_PI2 0.15915494309
#define RECIPROCAL_PI  0.31830988618

vec2 equirectUv(vec3 dir) {
  vec2 uv;
  uv.x = atan(dir.z, dir.x) * RECIPROCAL_PI2 + 0.5;
  uv.y = asin(clamp(dir.y, -1.0, 1.0)) * RECIPROCAL_PI + 0.5;
  return uv;
}

vec3 ACESFilmic(vec3 x) {
  float a = 2.51;
  float b = 0.03;
  float c = 2.43;
  float d = 0.59;
  float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

float sampleSourceField(vec2 worldXZ) {
  float total = 0.0;
  for (int i = 0; i < MAX_WEATHER_SOURCES; i++) {
    if (i >= uWeatherSourceCount) break;
    vec4 src = uWeatherSources[i];
    vec2 d = worldXZ - src.xy;
    float dist = length(d);
    float r = max(src.z, 0.0001);
    if (dist >= r) continue;
    float inner = r * 0.7;
    float t;
    if (dist <= inner) {
      t = 1.0;
    } else {
      float span = max(r - inner, 0.0001);
      float local = (r - dist) / span;
      t = local * local * (3.0 - 2.0 * local);
    }
    total += src.w * t;
  }
  return clamp(total, 0.0, 1.0);
}

void main() {
  vec3 dir = normalize(vWorldDirection);

  float cosR = cos(uRotation);
  float sinR = sin(uRotation);
  vec3 rotated = vec3(dir.x * cosR - dir.z * sinR, dir.y, dir.x * sinR + dir.z * cosR);

  vec3 sampleDir = rotated;
  if (sampleDir.y < 0.0) {
    sampleDir.y = max(0.001, -sampleDir.y * 0.1);
    sampleDir = normalize(sampleDir);
  }

  vec2 uv = equirectUv(sampleDir);
  vec3 cBase = texture2D(tex0, uv).rgb;
  vec3 cRain = texture2D(tex3, uv).rgb;

  float bias = 0.0;
  if (uWeatherSourceCount > 0 && uSourceBiasStrength > 0.0) {
    float carBias = sampleSourceField(uCameraXZ);
    vec3 horizDir = vec3(rotated.x, 0.0, rotated.z);
    float horizLen = length(horizDir);
    float horizBias = 0.0;
    if (horizLen > 0.001) {
      vec2 fwd = horizDir.xz / horizLen;
      float h0 = sampleSourceField(uCameraXZ + fwd * 300.0);
      float h1 = sampleSourceField(uCameraXZ + fwd * 600.0);
      float h2 = sampleSourceField(uCameraXZ + fwd * 1000.0);
      horizBias = (h0 + h1 + h2) / 3.0;
    }
    float dirBias = max(carBias, horizBias);
    float horizonFade = smoothstep(0.6, -0.1, rotated.y);
    bias = clamp(dirBias * uSourceBiasStrength * horizonFade, 0.0, 1.0);
  }

  vec3 darkenedSky = cBase * mix(vec3(1.0), vec3(0.45, 0.5, 0.55), 1.0);
  vec3 cloudInfluence = mix(cBase, cRain * 0.7, 0.6);
  vec3 weatherSky = mix(darkenedSky, cloudInfluence, 0.7);

  vec3 hdr = mix(cBase, weatherSky, bias);
  hdr = min(hdr, vec3(1.6));
  vec3 mapped = ACESFilmic(hdr * exposure);
  gl_FragColor = vec4(mapped, 1.0);
  #include <colorspace_fragment>
}
`
