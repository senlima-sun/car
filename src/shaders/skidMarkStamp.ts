export const STAMP_VERTEX_SHADER = /* glsl */ `
attribute vec2 aStampUV;
attribute float instanceIntensity;
attribute float instanceWetness;

varying vec2 vStampUV;
varying float vIntensity;
varying float vWetness;

void main() {
  vStampUV = aStampUV;
  vIntensity = instanceIntensity;
  vWetness = instanceWetness;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}
`

export const STAMP_FRAGMENT_SHADER = /* glsl */ `
varying vec2 vStampUV;
varying float vIntensity;
varying float vWetness;

void main() {
  float edgeU = smoothstep(0.0, 0.2, vStampUV.x) * smoothstep(1.0, 0.8, vStampUV.x);
  float edgeV = smoothstep(0.0, 0.05, vStampUV.y) * smoothstep(1.0, 0.95, vStampUV.y);
  float fade = edgeU * edgeV;

  float rubber = vIntensity * fade;
  float wet = vWetness * fade * vIntensity;

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
