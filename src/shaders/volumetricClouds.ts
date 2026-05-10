export const cloudRaymarchVertex = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`

export const cloudRaymarchFragment = /* glsl */ `
#define MAX_WEATHER_SOURCES 8

uniform vec3 uCameraPosition;
uniform mat4 uInvViewProjection;
uniform vec3 uSunDirection;
uniform float uSunIntensity;
uniform vec2 uWindVector;
uniform float uTime;
uniform float uCoverage;
uniform float uCloudBottom;
uniform float uCloudTop;
uniform vec4 uWeatherSources[MAX_WEATHER_SOURCES];
uniform int uWeatherSourceCount;
uniform vec2 uJitter;

varying vec2 vUv;

const int MAX_STEPS = 32;
const int LIGHT_STEPS = 4;

float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

float valueNoise3D(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);

  float a = hash13(i + vec3(0.0, 0.0, 0.0));
  float b = hash13(i + vec3(1.0, 0.0, 0.0));
  float c = hash13(i + vec3(0.0, 1.0, 0.0));
  float d = hash13(i + vec3(1.0, 1.0, 0.0));
  float e = hash13(i + vec3(0.0, 0.0, 1.0));
  float fv = hash13(i + vec3(1.0, 0.0, 1.0));
  float g = hash13(i + vec3(0.0, 1.0, 1.0));
  float h = hash13(i + vec3(1.0, 1.0, 1.0));

  float x00 = mix(a, b, f.x);
  float x10 = mix(c, d, f.x);
  float x01 = mix(e, fv, f.x);
  float x11 = mix(g, h, f.x);
  float y0 = mix(x00, x10, f.y);
  float y1 = mix(x01, x11, f.y);
  return mix(y0, y1, f.z);
}

float fbm3(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * valueNoise3D(p);
    p *= 2.1;
    a *= 0.5;
  }
  return v;
}

float worleyApprox(vec3 p) {
  float n1 = valueNoise3D(p * 1.0);
  float n2 = valueNoise3D(p * 2.7);
  return 1.0 - abs(n1 - n2) * 1.5;
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

float cloudDensity(vec3 p) {
  float h = (p.y - uCloudBottom) / max(uCloudTop - uCloudBottom, 0.0001);
  if (h < 0.0 || h > 1.0) return 0.0;

  float heightFactor = smoothstep(0.0, 0.2, h) * smoothstep(1.0, 0.6, h);

  vec3 advected = p;
  advected.xz += uWindVector * uTime * 0.5;
  advected /= 800.0;

  float baseShape = fbm3(advected);
  float detailShape = worleyApprox(advected * 3.5);
  float shape = baseShape - detailShape * 0.15;

  float sourceMod = sampleSourceField(p.xz);
  float coverage = mix(uCoverage, 0.85, sourceMod);

  float density = smoothstep(coverage - 0.05, coverage + 0.05, shape);
  return density * heightFactor;
}

float lightMarch(vec3 p) {
  float transmittance = 1.0;
  vec3 step = uSunDirection * 60.0;
  for (int i = 0; i < LIGHT_STEPS; i++) {
    p += step;
    float density = cloudDensity(p);
    transmittance *= exp(-density * 60.0 * 0.04);
    if (transmittance < 0.05) break;
  }
  return transmittance;
}

float henyeyGreenstein(float cosTheta, float g) {
  float gg = g * g;
  return (1.0 - gg) / pow(1.0 + gg - 2.0 * g * cosTheta, 1.5);
}

void main() {
  vec2 ndc = vUv * 2.0 - 1.0;
  ndc += uJitter;
  vec4 clip = vec4(ndc, 1.0, 1.0);
  vec4 worldPos = uInvViewProjection * clip;
  if (abs(worldPos.w) < 0.0001) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
    return;
  }
  worldPos /= worldPos.w;
  vec3 rayDir = worldPos.xyz - uCameraPosition;
  float rayLen = length(rayDir);
  if (rayLen < 0.0001) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
    return;
  }
  rayDir /= rayLen;

  if (rayDir.y < 0.01) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
    return;
  }

  float tBottom = (uCloudBottom - uCameraPosition.y) / rayDir.y;
  float tTop = (uCloudTop - uCameraPosition.y) / rayDir.y;
  float tStart = max(min(tBottom, tTop), 0.0);
  float tEnd = max(tBottom, tTop);

  if (tEnd <= tStart || tEnd > 50000.0) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
    return;
  }

  tEnd = min(tEnd, tStart + 8000.0);
  float stepSize = (tEnd - tStart) / float(MAX_STEPS);

  float jitter = hash13(vec3(gl_FragCoord.xy, uTime * 60.0));
  float t = tStart + stepSize * jitter;

  vec3 sunColor = mix(vec3(1.6, 1.0, 0.5), vec3(2.0, 1.9, 1.6), smoothstep(0.05, 0.4, uSunDirection.y));
  vec3 ambientColor = vec3(0.55, 0.65, 0.78);

  float cosThetaSun = dot(rayDir, normalize(uSunDirection));
  float forwardScatter = henyeyGreenstein(cosThetaSun, 0.6);
  float backScatter = henyeyGreenstein(cosThetaSun, -0.2);
  float phase = forwardScatter * 0.7 + backScatter * 0.3;

  float transmittance = 1.0;
  vec3 scattered = vec3(0.0);

  for (int i = 0; i < MAX_STEPS; i++) {
    if (t > tEnd || transmittance < 0.02) break;
    vec3 samplePos = uCameraPosition + rayDir * t;
    float density = cloudDensity(samplePos);

    if (density > 0.01) {
      float lightT = lightMarch(samplePos);
      vec3 inscatter = (sunColor * lightT * phase + ambientColor * 0.5) * density;
      float deltaT = exp(-density * stepSize * 0.04);
      scattered += inscatter * transmittance * (1.0 - deltaT) * stepSize * 0.04;
      transmittance *= deltaT;
    }
    t += stepSize;
  }

  float alpha = clamp(1.0 - transmittance, 0.0, 1.0);
  vec3 color = scattered * uSunIntensity;
  bool safe = color.r == color.r && color.g == color.g && color.b == color.b && alpha == alpha;
  if (!safe) {
    color = vec3(0.0);
    alpha = 0.0;
  }
  color = clamp(color, vec3(0.0), vec3(8.0));
  gl_FragColor = vec4(color, alpha);
}
`
