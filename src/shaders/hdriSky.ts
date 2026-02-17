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
uniform sampler2D texA;
uniform sampler2D texB;
uniform float blend;
uniform float exposure;
uniform float uRotation;
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

void main() {
  vec3 dir = normalize(vWorldDirection);

  float cosR = cos(uRotation);
  float sinR = sin(uRotation);
  dir = vec3(dir.x * cosR - dir.z * sinR, dir.y, dir.x * sinR + dir.z * cosR);

  if (dir.y < 0.0) {
    dir.y = max(0.001, -dir.y * 0.1);
    dir = normalize(dir);
  }

  vec2 uv = equirectUv(dir);
  vec4 colorA = texture2D(texA, uv);
  vec4 colorB = texture2D(texB, uv);
  vec3 hdr = mix(colorA.rgb, colorB.rgb, blend);
  vec3 mapped = ACESFilmic(hdr * exposure);
  gl_FragColor = vec4(mapped, 1.0);
  #include <colorspace_fragment>
}
`
