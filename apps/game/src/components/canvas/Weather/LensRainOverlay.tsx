import { useMemo, useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useFBO } from '@react-three/drei'
import * as THREE from 'three'
import { useEnvironmentStore } from '../../../stores/useEnvironmentStore'
import { useCarStore } from '../../../stores/useCarStore'
import { useGameStore } from '../../../stores/useGameStore'

const MAX_DROPS = 48
const DATA_W = MAX_DROPS

const fullscreenVertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

const refractionFragmentShader = `
precision highp float;

uniform sampler2D uScene;
uniform sampler2D uDrops;
uniform vec2 uResolution;
uniform float uDropCount;
uniform float uSpeed;

varying vec2 vUv;

const float MAX_DROPS = ${MAX_DROPS}.0;

void main() {
  float aspect = uResolution.x / uResolution.y;
  vec2 p = vec2(vUv.x * aspect, vUv.y);

  vec3 base = texture2D(uScene, vUv).rgb;
  vec3 color = base;

  // pick the single nearest covering droplet (front-most), accumulate streak wetness
  float bestCover = 0.0;
  vec2 bestLocal = vec2(0.0);
  float bestRadius = 0.0;
  float bestStrength = 0.0;
  float streakWet = 0.0;

  for (float i = 0.0; i < MAX_DROPS; i += 1.0) {
    if (i >= uDropCount) break;

    vec4 d = texture2D(uDrops, vec2((i + 0.5) / MAX_DROPS, 0.5));
    vec2 center = vec2(d.x * aspect, d.y);
    float radius = d.z;
    float strength = d.w;
    if (strength <= 0.001 || radius <= 0.0001) continue;

    vec2 diff = p - center;
    float dist = length(diff);

    if (dist < radius) {
      float cover = (1.0 - smoothstep(radius * 0.82, radius, dist)) * strength;
      if (cover > bestCover) {
        bestCover = cover;
        bestLocal = diff / radius; // normalized -1..1 within bead
        bestRadius = radius;
        bestStrength = strength;
      }
    }

    // thin downward streak tail (separate, subtle darkening only)
    if (diff.y > 0.0) {
      float along = diff.y;
      float across = abs(diff.x);
      float tailLen = radius * (2.5 + uSpeed * 0.04);
      float tailWide = radius * 0.3;
      float tail = (1.0 - smoothstep(0.0, tailLen, along)) *
                   (1.0 - smoothstep(tailWide * 0.4, tailWide, across)) * strength;
      streakWet = max(streakWet, tail);
    }
  }

  if (bestCover > 0.002) {
    // true spherical lens: reconstruct sphere normal from position within bead.
    // z is the dome height; xy is the slope. center is flat, edges steep.
    float r2 = dot(bestLocal, bestLocal);
    float z = sqrt(max(0.0, 1.0 - r2));
    vec3 n = vec3(bestLocal, z);

    // refract the VIEW ray (0,0,-1) through the water surface (IOR ~1.33).
    // this magnifies + inverts the scene behind the bead, like a real droplet.
    vec3 viewDir = vec3(0.0, 0.0, -1.0);
    vec3 refr = refract(viewDir, n, 1.0 / 1.33);
    // project refracted ray onto the scene plane -> uv displacement (inverted)
    vec2 disp = refr.xy * bestRadius * 1.9;
    vec2 refrUv = clamp(vUv + disp, 0.002, 0.998);
    vec3 lensImg = texture2D(uScene, refrUv).rgb;

    // water darkens slightly + cool tint; NO edge glow.
    vec3 wet = lensImg * 0.82;
    wet = mix(wet, wet * vec3(0.9, 0.94, 1.0), 0.5);

    // single tiny specular pinpoint near upper-left of bead
    vec2 hp = bestLocal - vec2(-0.35, -0.4);
    float spec = smoothstep(0.22, 0.0, length(hp)) * bestStrength;

    vec3 dropColor = wet + vec3(1.0) * spec * 0.55;

    color = mix(base, dropColor, bestCover);
  }

  // streak just leaves a faint wet darkening trail, not a bright shape
  color = mix(color, color * vec3(0.8, 0.85, 0.95), streakWet * 0.35);

  gl_FragColor = vec4(color, 1.0);
}
`

interface Drop {
  x: number
  y: number
  radius: number
  age: number
  life: number
  drift: number
}

// spatial hotspots: edges/corners high, center low. weighted spawn picker.
function spawnPosition(speed: number): { x: number; y: number } {
  // base bias: distance from center raises probability via rejection-ish weighting
  // pick a few candidate zones; speed pushes weight toward edges + top
  const speedF = Math.min(speed / 80, 1)
  const r = Math.random()

  // zone weights (sum ~1): top band, left edge, right edge, scattered
  const wTop = 0.30 + speedF * 0.1
  const wLeft = 0.22 + speedF * 0.08
  const wRight = 0.22 + speedF * 0.08
  // remaining = scattered (center-ish), shrinks with speed (wiped clean)

  let x: number
  let y: number
  if (r < wTop) {
    x = Math.random()
    y = Math.random() * 0.28
  } else if (r < wTop + wLeft) {
    x = Math.random() * 0.22
    y = Math.random()
  } else if (r < wTop + wLeft + wRight) {
    x = 1 - Math.random() * 0.22
    y = Math.random()
  } else {
    // scattered, avoid dead-center: push outward
    x = Math.random()
    y = 0.25 + Math.random() * 0.6
    const cx = x - 0.5
    x = 0.5 + cx * (1.3 + speedF * 0.6)
    x = Math.min(0.98, Math.max(0.02, x))
  }
  return { x, y }
}

export default function LensRainOverlay() {
  const { gl, scene, camera, size } = useThree()

  const dropsRef = useRef<Drop[]>(
    Array.from({ length: MAX_DROPS }, () => ({
      x: 0,
      y: 0,
      radius: 0,
      age: 0,
      life: 0,
      drift: 0,
    })),
  )
  const spawnAccRef = useRef(0)

  const target = useFBO(size.width, size.height, {
    depthBuffer: true,
    stencilBuffer: false,
    samples: 0,
    colorSpace: THREE.SRGBColorSpace,
  })

  const { quadScene, quadCamera, material, dataTex, dataArr } = useMemo(() => {
    const dataArr = new Float32Array(DATA_W * 4)
    const dataTex = new THREE.DataTexture(dataArr, DATA_W, 1, THREE.RGBAFormat, THREE.FloatType)
    dataTex.minFilter = THREE.NearestFilter
    dataTex.magFilter = THREE.NearestFilter
    dataTex.needsUpdate = true

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uScene: { value: null },
        uDrops: { value: dataTex },
        uResolution: { value: new THREE.Vector2(size.width, size.height) },
        uDropCount: { value: 0 },
        uSpeed: { value: 0 },
      },
      vertexShader: fullscreenVertexShader,
      fragmentShader: refractionFragmentShader,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    })

    const quadScene = new THREE.Scene()
    const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
    quad.frustumCulled = false
    quadScene.add(quad)

    return { quadScene, quadCamera, material, dataTex, dataArr }
  }, [size.width, size.height])

  useEffect(() => {
    material.uniforms.uResolution.value.set(size.width, size.height)
  }, [material, size.width, size.height])

  useEffect(() => {
    return () => {
      material.dispose()
      dataTex.dispose()
      ;(quadScene.children[0] as THREE.Mesh).geometry.dispose()
    }
  }, [material, dataTex, quadScene])

  useFrame((state, rawDelta) => {
    const intensity = useEnvironmentStore.getState().rainIntensity
    const active = intensity > 0.01 && useGameStore.getState().cameraMode !== 'top-down'

    if (!active) {
      gl.render(scene, camera)
      return
    }

    const speed = useCarStore.getState().speed
    const delta = Math.min(rawDelta, 0.05)
    const t = state.clock.elapsedTime
    const drops = dropsRef.current

    // gusty spawn rate: slow noise * intensity
    const gust = 0.55 + 0.45 * Math.sin(t * 0.7) * Math.sin(t * 0.23 + 1.3)
    const spawnRate = (8 + intensity * 34) * Math.max(0.2, gust)
    spawnAccRef.current += spawnRate * delta
    let toSpawn = Math.floor(spawnAccRef.current)
    spawnAccRef.current -= toSpawn

    const speedFlow = 0.04 + Math.min(speed / 80, 1) * 0.22

    for (let i = 0; i < MAX_DROPS; i++) {
      const d = drops[i]

      if (d.life <= 0 || d.age >= d.life) {
        if (toSpawn > 0) {
          toSpawn--
          const pos = spawnPosition(speed)
          d.x = pos.x
          d.y = pos.y
          d.radius = 0.008 + Math.random() * 0.018
          d.age = 0
          d.life = 0.8 + Math.random() * 2.2
          d.drift = (Math.random() - 0.5) * 0.02
        } else {
          d.life = 0
          d.radius = 0
        }
      } else {
        d.age += delta
        // larger drops slide down faster once they've dwelled a bit
        const slide = (d.radius / 0.026) * speedFlow * delta
        if (d.age > d.life * 0.35) {
          d.y += slide
          d.x += d.drift * delta
        }
      }

      const o = i * 4
      if (d.life > 0 && d.age < d.life) {
        const t01 = d.age / d.life
        // impact pop: spring from 0 to full quickly, then hold, then fade
        const pop = Math.min(1, t01 / 0.08)
        const fade = 1 - Math.max(0, (t01 - 0.7) / 0.3)
        const overshoot = pop < 1 ? 1 + (1 - pop) * 0.35 : 1
        dataArr[o] = d.x
        dataArr[o + 1] = d.y
        dataArr[o + 2] = d.radius * pop * overshoot
        dataArr[o + 3] = Math.max(0, fade)
      } else {
        dataArr[o + 2] = 0
        dataArr[o + 3] = 0
      }
    }

    dataTex.needsUpdate = true

    gl.setRenderTarget(target)
    gl.clear()
    gl.render(scene, camera)
    gl.setRenderTarget(null)

    material.uniforms.uScene.value = target.texture
    material.uniforms.uDropCount.value = MAX_DROPS
    material.uniforms.uSpeed.value = speed

    gl.render(quadScene, quadCamera)
  }, 1)

  return null
}
