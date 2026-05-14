export const tireSmokeVertexShader = /* glsl */ `
attribute float size;
attribute float opacity;
attribute float lifetime;

varying float vOpacity;
varying float vLifetime;

void main() {
  vOpacity = opacity;
  vLifetime = lifetime;

  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  gl_PointSize = size * (300.0 / -mvPosition.z);
  gl_PointSize = clamp(gl_PointSize, 1.0, 80.0);
}
`

export const tireSmokeFragmentShader = /* glsl */ `
uniform vec3 baseColor;

varying float vOpacity;
varying float vLifetime;

void main() {
  vec2 center = gl_PointCoord - vec2(0.5);
  float dist = length(center);

  float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
  alpha *= vOpacity * vLifetime;

  if (alpha < 0.01) discard;

  gl_FragColor = vec4(baseColor, alpha);
}
`
