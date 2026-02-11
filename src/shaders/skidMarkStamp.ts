export const STAMP_VERTEX_SHADER = /* glsl */ `
attribute vec2 aStampUV;
varying vec2 vStampUV;

void main() {
  vStampUV = aStampUV;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

export const STAMP_FRAGMENT_SHADER = /* glsl */ `
uniform float uIntensity;
uniform float uIsWet;
varying vec2 vStampUV;

void main() {
  // Gaussian edge falloff for tire width (U) and length (V)
  float edgeU = smoothstep(0.0, 0.2, vStampUV.x) * smoothstep(1.0, 0.8, vStampUV.x);
  float edgeV = smoothstep(0.0, 0.05, vStampUV.y) * smoothstep(1.0, 0.95, vStampUV.y);
  float fade = edgeU * edgeV;

  float rubber = uIntensity * fade;
  float wet = uIsWet * fade * uIntensity;

  gl_FragColor = vec4(rubber, wet, 0.0, 1.0);
}
`

export const DECAY_VERTEX_SHADER = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

export const DECAY_FRAGMENT_SHADER = /* glsl */ `
uniform sampler2D uPrevFrame;
uniform float uDecayFactor;
varying vec2 vUv;

void main() {
  vec4 prev = texture2D(uPrevFrame, vUv);
  gl_FragColor = prev * uDecayFactor;
}
`
