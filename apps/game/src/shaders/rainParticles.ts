export const rainVertexShader = `
uniform float uTime;
uniform vec3 uCameraPosition;
uniform float uAreaSize;
uniform float uStreakLength;
uniform float uStreakWidth;

attribute vec3 basePosition;
attribute float velocity;
attribute float phase;

varying vec2 vQuadUv;
varying float vIntensity;

void main() {
  float localTime = uTime + phase;

  vec3 worldPos = basePosition;
  worldPos.y -= velocity * localTime;
  worldPos.x += 0.18 * velocity * localTime;
  worldPos.z += 0.09 * velocity * localTime;

  float cycleHeight = 90.0;
  worldPos.y = mod(worldPos.y + 2.0, cycleHeight) - 2.0;
  worldPos.x = uCameraPosition.x + mod(worldPos.x - uCameraPosition.x + uAreaSize * 0.5, uAreaSize) - uAreaSize * 0.5;
  worldPos.z = uCameraPosition.z + mod(worldPos.z - uCameraPosition.z + uAreaSize * 0.5, uAreaSize) - uAreaSize * 0.5;

  vec3 fallDir = normalize(vec3(0.18, -1.0, 0.09));

  vec4 centerView = viewMatrix * vec4(worldPos, 1.0);
  vec3 fallDirView = normalize((viewMatrix * vec4(fallDir, 0.0)).xyz);
  vec3 sideView = normalize(cross(fallDirView, vec3(0.0, 0.0, 1.0)));

  float speedScale = clamp(velocity / 40.0, 0.6, 1.4);
  vec2 corner = position.xy;
  vec3 offset = sideView * (corner.x * uStreakWidth) + fallDirView * (corner.y * uStreakLength * speedScale);

  vec4 viewPos = centerView + vec4(offset, 0.0);
  gl_Position = projectionMatrix * viewPos;

  vQuadUv = corner;
  float heightFade = smoothstep(-2.0, 15.0, worldPos.y) * smoothstep(90.0, 55.0, worldPos.y);
  float distanceFade = smoothstep(110.0, 20.0, length(centerView.xyz));
  vIntensity = heightFade * distanceFade;
}
`

export const rainFragmentShader = `
uniform float uOpacity;
uniform vec3 uColor;

varying vec2 vQuadUv;
varying float vIntensity;

void main() {
  float sideMask = 1.0 - smoothstep(0.4, 0.5, abs(vQuadUv.x));
  float endMask = smoothstep(0.5, 0.0, abs(vQuadUv.y));
  float core = sideMask * endMask;
  if (core < 0.01) discard;

  float alpha = core * vIntensity * uOpacity;
  gl_FragColor = vec4(uColor, alpha);
}
`
