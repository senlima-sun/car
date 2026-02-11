export const tireTrailVertexShader = /* glsl */ `
attribute vec3 instanceColorAttr;

varying float vAlpha;
varying vec2 vUv;
varying float vIsWet;

void main() {
  vUv = uv;
  vAlpha = instanceColorAttr.x;
  vIsWet = instanceColorAttr.y;

  vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
}
`

export const tireTrailFragmentShader = /* glsl */ `
varying float vAlpha;
varying vec2 vUv;
varying float vIsWet;

void main() {
  float edgeFade = smoothstep(0.0, 0.15, vUv.x) * smoothstep(1.0, 0.85, vUv.x);
  float endFade = smoothstep(0.0, 0.05, vUv.y) * smoothstep(1.0, 0.95, vUv.y);
  float fade = edgeFade * endFade;

  vec3 dryColor = vec3(0.05, 0.05, 0.07);
  vec3 wetColor = vec3(0.12, 0.15, 0.18);
  vec3 color = mix(dryColor, wetColor, vIsWet);

  float alpha = vAlpha * fade * 0.4;
  if (alpha < 0.005) discard;

  gl_FragColor = vec4(color, alpha);
}
`
