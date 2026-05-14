export const rainVertexShader = `
uniform float uTime;
uniform vec3 uCameraPosition;
uniform float uAreaSize;

attribute float velocity;
attribute vec3 basePosition;
attribute float phase;

varying float vIntensity;

void main() {
  vec3 pos = basePosition;

  float localTime = uTime + phase;

  float fallDistance = velocity * localTime;
  pos.y -= fallDistance;

  float windX = 0.2 * velocity * localTime;
  float windZ = 0.1 * velocity * localTime;
  pos.x += windX;
  pos.z += windZ;

  float cycleHeight = 90.0;
  pos.y = mod(pos.y + 2.0, cycleHeight) - 2.0;

  pos.x = uCameraPosition.x + mod(pos.x - uCameraPosition.x + uAreaSize * 0.5, uAreaSize) - uAreaSize * 0.5;
  pos.z = uCameraPosition.z + mod(pos.z - uCameraPosition.z + uAreaSize * 0.5, uAreaSize) - uAreaSize * 0.5;

  vIntensity = smoothstep(-2.0, 20.0, pos.y) * smoothstep(90.0, 60.0, pos.y);

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  float distanceFactor = smoothstep(100.0, 20.0, length(mvPosition.xyz));
  gl_PointSize = 2.0 * distanceFactor;
}
`

export const rainFragmentShader = `
uniform float uOpacity;

varying float vIntensity;

void main() {
  vec2 center = gl_PointCoord - vec2(0.5);
  float dist = length(center);

  if (dist > 0.5) discard;

  float alpha = (1.0 - dist * 2.0) * vIntensity * uOpacity;

  gl_FragColor = vec4(0.67, 0.8, 1.0, alpha);
}
`
