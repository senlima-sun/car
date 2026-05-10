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

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * valueNoise(p);
    p *= 2.1;
    a *= 0.5;
  }
  return v;
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

  float bias = 0.0;
  if (uWeatherSourceCount > 0 && uSourceBiasStrength > 0.0) {
    vec3 horizDir = vec3(rotated.x, 0.0, rotated.z);
    float horizLen = length(horizDir);
    if (horizLen > 0.001) {
      vec2 fwd = horizDir.xz / horizLen;
      float h0 = sampleSourceField(uCameraXZ + fwd * 300.0);
      float h1 = sampleSourceField(uCameraXZ + fwd * 600.0);
      float h2 = sampleSourceField(uCameraXZ + fwd * 1000.0);
      bias = (h0 + h1 + h2) / 3.0;
    }
    bias = clamp(bias * uSourceBiasStrength, 0.0, 1.0);
  }

  float skyMask = smoothstep(0.0, 0.4, rotated.y);
  vec3 hdr = min(cBase, vec3(1.05));

  if (bias > 0.001 && skyMask > 0.001) {
    vec2 cloudUv = vec2(
      atan(rotated.z, rotated.x) * RECIPROCAL_PI2 * 4.0 + uTime * 0.01,
      acos(clamp(rotated.y, 0.0, 1.0)) * RECIPROCAL_PI * 4.0
    );
    float clouds = fbm(cloudUv * 2.0);
    float coverage = mix(0.7, 0.25, bias);
    float cloudDensity = smoothstep(coverage, coverage + 0.15, clouds);
    cloudDensity *= skyMask * bias;

    vec3 cloudColor = mix(vec3(0.85, 0.85, 0.88), vec3(0.45, 0.48, 0.55), bias);
    hdr = mix(hdr, cloudColor, cloudDensity);
  }

  vec3 mapped = ACESFilmic(hdr * exposure);
  gl_FragColor = vec4(mapped, 1.0);
  #include <colorspace_fragment>
}
`
