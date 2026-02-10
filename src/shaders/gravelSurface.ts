import * as THREE from 'three'

export const gravelVertexShader: string = /* glsl */ `
attribute float aEdgeDist;

varying vec3 vWorldPos;
varying vec3 vNormal;
varying float vEdgeDist;

void main() {
  vEdgeDist = aEdgeDist;
  vNormal = normalize(normalMatrix * normal);

  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;

  gl_Position = projectionMatrix * viewMatrix * wp;
}
`

export const gravelFragmentShader: string = /* glsl */ `
uniform float uTime;
uniform float uOpacity;

varying vec3 vWorldPos;
varying vec3 vNormal;
varying float vEdgeDist;

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}

float hash1(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

vec3 voronoi(vec2 x, float scale) {
  vec2 p = x * scale;
  vec2 n = floor(p);
  vec2 f = fract(p);

  float minDist = 8.0;
  float secondDist = 8.0;
  vec2 closestCell = vec2(0.0);

  for (int j = -2; j <= 2; j++) {
    for (int i = -2; i <= 2; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = hash2(n + g);
      vec2 r = g + o - f;
      float d = dot(r, r);

      if (d < minDist) {
        secondDist = minDist;
        minDist = d;
        closestCell = n + g;
      } else if (d < secondDist) {
        secondDist = d;
      }
    }
  }

  return vec3(sqrt(minDist), sqrt(secondDist), hash1(closestCell));
}

void main() {
  vec2 uv = vWorldPos.xz;

  vec3 largePebbles = voronoi(uv, 3.0);
  vec3 mediumPebbles = voronoi(uv + vec2(17.3, 31.7), 6.0);
  vec3 smallPebbles = voronoi(uv + vec2(53.1, 89.4), 12.0);

  float largeCellId = largePebbles.z;
  float mediumCellId = mediumPebbles.z;
  float smallCellId = smallPebbles.z;

  float largeEdge = smoothstep(0.03, 0.08, largePebbles.y - largePebbles.x);
  float mediumEdge = smoothstep(0.02, 0.06, mediumPebbles.y - mediumPebbles.x);
  float smallEdge = smoothstep(0.01, 0.05, smallPebbles.y - smallPebbles.x);

  float combinedEdge = largeEdge * 0.5 + mediumEdge * 0.3 + smallEdge * 0.2;

  vec3 sandyTan = vec3(0.722, 0.659, 0.541);
  vec3 stoneGrey = vec3(0.541, 0.522, 0.502);
  vec3 warmBrown = vec3(0.478, 0.420, 0.365);
  vec3 lightTan = vec3(0.780, 0.730, 0.620);
  vec3 darkGrey = vec3(0.420, 0.400, 0.380);

  vec3 largeColor = mix(sandyTan, stoneGrey, step(0.33, largeCellId));
  largeColor = mix(largeColor, warmBrown, step(0.66, largeCellId));
  float largeVariation = hash1(vec2(largeCellId * 127.1, largeCellId * 269.5));
  largeColor = mix(largeColor, lightTan, largeVariation * 0.3);
  largeColor *= 0.9 + largeVariation * 0.2;

  vec3 mediumColor = mix(stoneGrey, warmBrown, step(0.4, mediumCellId));
  mediumColor = mix(mediumColor, sandyTan, step(0.7, mediumCellId));
  float mediumVariation = hash1(vec2(mediumCellId * 311.7, mediumCellId * 183.3));
  mediumColor = mix(mediumColor, darkGrey, mediumVariation * 0.25);
  mediumColor *= 0.85 + mediumVariation * 0.3;

  vec3 smallColor = mix(warmBrown, sandyTan, step(0.5, smallCellId));
  float smallVariation = hash1(vec2(smallCellId * 419.2, smallCellId * 371.9));
  smallColor = mix(smallColor, stoneGrey, smallVariation * 0.4);
  smallColor *= 0.88 + smallVariation * 0.24;

  vec3 pebbleColor = largeColor * 0.45 + mediumColor * 0.35 + smallColor * 0.2;

  vec3 gapColor = vec3(0.18, 0.15, 0.12);
  vec3 surfaceColor = mix(gapColor, pebbleColor, combinedEdge);

  float roughnessBase = 0.85;
  float roughnessVariation = largeCellId * 0.1 + mediumCellId * 0.05;
  float roughness = roughnessBase + roughnessVariation * (1.0 - combinedEdge);

  surfaceColor *= mix(0.95, 1.05, roughness - roughnessBase);

  float subtleNoise = hash1(floor(uv * 50.0)) * 0.06;
  surfaceColor += vec3(subtleNoise) - vec3(0.03);

  vec3 lightDir = normalize(vec3(0.5, 1.0, 0.3));
  float NdotL = max(dot(vNormal, lightDir), 0.0);
  float ambient = 0.4;
  float diffuse = 0.6 * NdotL;
  float lighting = ambient + diffuse;

  surfaceColor *= lighting;

  float edgeAlpha = smoothstep(0.0, 0.15, vEdgeDist);
  float finalAlpha = edgeAlpha * uOpacity;

  gl_FragColor = vec4(surfaceColor, finalAlpha);
}
`

export function createGravelUniforms(): Record<string, THREE.IUniform> {
  return {
    uTime: { value: 0.0 },
    uOpacity: { value: 1.0 },
  }
}
