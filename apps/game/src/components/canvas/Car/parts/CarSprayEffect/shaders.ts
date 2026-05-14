export const sprayVertexShader = /* glsl */ `
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
    gl_PointSize = clamp(gl_PointSize, 1.0, 64.0);
  }
`

export const sprayFragmentShader = /* glsl */ `
  varying float vOpacity;
  varying float vLifetime;

  void main() {
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);

    float alpha = 1.0 - smoothstep(0.0, 0.5, dist);

    alpha *= vOpacity * vLifetime;

    if (alpha < 0.01) discard;

    vec3 coreColor = vec3(0.95, 0.97, 1.0);
    vec3 edgeColor = vec3(0.7, 0.85, 0.95);
    vec3 color = mix(coreColor, edgeColor, dist * 2.0);

    gl_FragColor = vec4(color, alpha);
  }
`
