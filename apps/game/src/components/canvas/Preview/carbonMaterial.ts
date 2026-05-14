import * as THREE from 'three'

const CARBON_WEAVE_GLSL = /* glsl */ `
  vec2 weaveUv = vWorldPosition.xz * 220.0;
  vec2 cell = floor(weaveUv);
  vec2 f = fract(weaveUv);
  float diag = mod(cell.x + cell.y, 2.0);
  float strandY = smoothstep(0.0, 0.5, f.y) - smoothstep(0.5, 1.0, f.y);
  float strandX = smoothstep(0.0, 0.5, f.x) - smoothstep(0.5, 1.0, f.x);
  float strand = mix(strandX, strandY, diag);
  float highlight = pow(strand, 2.0);
  float darkLines = smoothstep(0.48, 0.5, abs(f.x - 0.5)) * 0.25
                  + smoothstep(0.48, 0.5, abs(f.y - 0.5)) * 0.25;
  float tint = highlight * 0.12 - darkLines;
  diffuseColor.rgb += vec3(tint);
  diffuseColor.rgb = max(diffuseColor.rgb, vec3(0.0));
`

export function createRubberMaterial(): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: '#0c0c0d',
    roughness: 0.92,
    metalness: 0.02,
    envMapIntensity: 0.35,
  })

  mat.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
       varying vec3 vRubberWorldPos;`,
    )
    shader.vertexShader = shader.vertexShader.replace(
      '#include <worldpos_vertex>',
      `#include <worldpos_vertex>
       vRubberWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
    )

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
       varying vec3 vRubberWorldPos;`,
    )
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
       float tread = sin(vRubberWorldPos.y * 90.0) * 0.5 + 0.5;
       tread = smoothstep(0.35, 0.65, tread);
       float micro = fract(sin(dot(vRubberWorldPos.xz, vec2(21.98, 78.23))) * 43758.5453);
       diffuseColor.rgb *= 0.9 + tread * 0.05;
       diffuseColor.rgb += vec3(micro * 0.008 - 0.004);`,
    )

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      `#include <roughnessmap_fragment>
       float treadR = sin(vRubberWorldPos.y * 90.0) * 0.5 + 0.5;
       roughnessFactor = clamp(roughnessFactor + (treadR - 0.5) * 0.1, 0.75, 1.0);`,
    )
  }

  mat.customProgramCacheKey = () => 'preview-rubber-v1'
  return mat
}

export function createCarbonFiberMaterial(): THREE.MeshPhysicalMaterial {
  const mat = new THREE.MeshPhysicalMaterial({
    color: '#060608',
    roughness: 0.32,
    metalness: 0.82,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    envMapIntensity: 1.4,
    reflectivity: 0.6,
  })

  mat.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
       varying vec3 vWorldPosition;`,
    )
    shader.vertexShader = shader.vertexShader.replace(
      '#include <worldpos_vertex>',
      `#include <worldpos_vertex>
       vWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
    )

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
       varying vec3 vWorldPosition;`,
    )
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
       ${CARBON_WEAVE_GLSL}`,
    )
  }

  mat.customProgramCacheKey = () => 'preview-carbon-fiber-v1'
  return mat
}
