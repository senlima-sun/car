import { useRef, useMemo, useEffect } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useEnvironmentStore } from '@/stores/useEnvironmentStore'
import { useWindStore } from '@/stores/useWindStore'
import { useWeatherSourcesStore } from '@/stores/useWeatherSourcesStore'
import { usePerformanceStore, type QualityTier } from '@/stores/usePerformanceStore'
import { cloudRaymarchVertex, cloudRaymarchFragment } from '@/shaders/volumetricClouds'
import { computeSunDirection, getSunIntensity } from './sunDirection'

const MAX_WEATHER_SOURCES = 8
const ENABLED_TIERS: QualityTier[] = ['ultra', 'high']

const CLOUD_BOTTOM = 800
const CLOUD_TOP = 1800

const blitVertex = /* glsl */ `
attribute vec3 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`

const blitFragment = /* glsl */ `
precision highp float;
uniform sampler2D uTexture;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(uTexture, vUv);
  gl_FragColor = vec4(c.rgb, clamp(c.a, 0.0, 1.0));
}
`

const compositeFragment = /* glsl */ `
precision highp float;
uniform sampler2D uCurrent;
uniform sampler2D uPrevious;
uniform float uBlend;
varying vec2 vUv;
void main() {
  vec4 cur = texture2D(uCurrent, vUv);
  vec4 prev = texture2D(uPrevious, vUv);
  gl_FragColor = mix(cur, prev, uBlend);
}
`

export default function VolumetricClouds() {
  const { gl, camera, size } = useThree()
  const tier = usePerformanceStore(s => s.tier)
  const enabled = ENABLED_TIERS.includes(tier)

  const halfWidth = Math.max(1, Math.floor(size.width / 2))
  const halfHeight = Math.max(1, Math.floor(size.height / 2))

  const rtA = useMemo(
    () =>
      new THREE.WebGLRenderTarget(halfWidth, halfHeight, {
        format: THREE.RGBAFormat,
        type: THREE.HalfFloatType,
        depthBuffer: false,
        stencilBuffer: false,
      }),
    [halfWidth, halfHeight],
  )
  const rtB = useMemo(
    () =>
      new THREE.WebGLRenderTarget(halfWidth, halfHeight, {
        format: THREE.RGBAFormat,
        type: THREE.HalfFloatType,
        depthBuffer: false,
        stencilBuffer: false,
      }),
    [halfWidth, halfHeight],
  )
  const composedRt = useMemo(
    () =>
      new THREE.WebGLRenderTarget(halfWidth, halfHeight, {
        format: THREE.RGBAFormat,
        type: THREE.HalfFloatType,
        depthBuffer: false,
        stencilBuffer: false,
      }),
    [halfWidth, halfHeight],
  )

  useEffect(() => {
    const prevTarget = gl.getRenderTarget()
    const prevClearColor = new THREE.Color()
    gl.getClearColor(prevClearColor)
    const prevClearAlpha = gl.getClearAlpha()
    gl.setClearColor(0x000000, 0)
    for (const rt of [rtA, rtB, composedRt]) {
      gl.setRenderTarget(rt)
      gl.clear()
    }
    gl.setRenderTarget(prevTarget)
    gl.setClearColor(prevClearColor, prevClearAlpha)
  }, [gl, rtA, rtB, composedRt])

  useEffect(() => {
    return () => {
      rtA.dispose()
      rtB.dispose()
      composedRt.dispose()
    }
  }, [rtA, rtB, composedRt])

  const writeRef = useRef(rtA)
  const readRef = useRef(rtB)
  const initialisedRef = useRef(false)

  const raymarchUniforms = useMemo(
    () => ({
      uCameraPosition: { value: new THREE.Vector3() },
      uInvViewProjection: { value: new THREE.Matrix4() },
      uSunDirection: { value: new THREE.Vector3(0, 1, 0) },
      uSunIntensity: { value: 1.0 },
      uWindVector: { value: new THREE.Vector2(0, 0) },
      uTime: { value: 0 },
      uCoverage: { value: 0.55 },
      uCloudBottom: { value: CLOUD_BOTTOM },
      uCloudTop: { value: CLOUD_TOP },
      uWeatherSources: {
        value: Array.from({ length: MAX_WEATHER_SOURCES }, () => new THREE.Vector4(0, 0, 0, 0)),
      },
      uWeatherSourceCount: { value: 0 },
      uJitter: { value: new THREE.Vector2(0, 0) },
    }),
    [],
  )

  const raymarchScene = useMemo(() => {
    const scene = new THREE.Scene()
    const geom = new THREE.PlaneGeometry(2, 2)
    const mat = new THREE.ShaderMaterial({
      vertexShader: cloudRaymarchVertex,
      fragmentShader: cloudRaymarchFragment,
      uniforms: raymarchUniforms,
      depthTest: false,
      depthWrite: false,
    })
    scene.add(new THREE.Mesh(geom, mat))
    return { scene, geom, mat }
  }, [raymarchUniforms])

  const compositeUniforms = useMemo(
    () => ({
      uCurrent: { value: null as THREE.Texture | null },
      uPrevious: { value: null as THREE.Texture | null },
      uBlend: { value: 0.85 },
    }),
    [],
  )

  const compositeScene = useMemo(() => {
    const scene = new THREE.Scene()
    const geom = new THREE.PlaneGeometry(2, 2)
    const mat = new THREE.RawShaderMaterial({
      vertexShader: blitVertex,
      fragmentShader: compositeFragment,
      uniforms: compositeUniforms,
      depthTest: false,
      depthWrite: false,
    })
    scene.add(new THREE.Mesh(geom, mat))
    return { scene, geom, mat }
  }, [compositeUniforms])

  const blitUniforms = useMemo(
    () => ({
      uTexture: { value: null as THREE.Texture | null },
    }),
    [],
  )

  const blitMaterial = useMemo(
    () =>
      new THREE.RawShaderMaterial({
        vertexShader: blitVertex,
        fragmentShader: blitFragment,
        uniforms: blitUniforms,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        blending: THREE.NormalBlending,
        blendSrc: THREE.SrcAlphaFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
      }),
    [blitUniforms],
  )
  const blitGeometry = useMemo(() => new THREE.PlaneGeometry(2, 2), [])

  useEffect(() => {
    return () => {
      raymarchScene.geom.dispose()
      raymarchScene.mat.dispose()
      compositeScene.geom.dispose()
      compositeScene.mat.dispose()
      blitMaterial.dispose()
      blitGeometry.dispose()
    }
  }, [raymarchScene, compositeScene, blitMaterial, blitGeometry])

  const orthoCamera = useMemo(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), [])
  const frameCounter = useRef(0)
  const tmpInvVp = useMemo(() => new THREE.Matrix4(), [])

  useFrame((_state, delta) => {
    if (!enabled) return
    if (!camera.matrixWorld || !camera.projectionMatrix) return

    const projDet = camera.projectionMatrix.determinant()
    const viewDet = camera.matrixWorld.determinant()
    if (!Number.isFinite(projDet) || projDet === 0 || !Number.isFinite(viewDet)) return

    const { timeOfDay, rainIntensity, cloudCover } = useEnvironmentStore.getState()
    const wind = useWindStore.getState()
    const sources = useWeatherSourcesStore.getState().sources
    const sun = computeSunDirection(timeOfDay)

    const u = raymarchUniforms
    ;(u.uSunDirection.value as THREE.Vector3).set(sun.x, sun.y, sun.z)
    u.uSunIntensity.value = getSunIntensity(timeOfDay)
    u.uTime.value += Math.min(delta, 0.1)

    const windX = Math.cos(wind.direction) * wind.speed
    const windZ = Math.sin(wind.direction) * wind.speed
    ;(u.uWindVector.value as THREE.Vector2).set(windX, windZ)

    const baseCoverage = 0.75 - cloudCover * 0.1 + rainIntensity * 0.1
    u.uCoverage.value = Math.max(0.55, Math.min(0.92, baseCoverage))

    ;(u.uCameraPosition.value as THREE.Vector3).copy(camera.position)
    tmpInvVp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).invert()
    ;(u.uInvViewProjection.value as THREE.Matrix4).copy(tmpInvVp)

    const slots = u.uWeatherSources.value as THREE.Vector4[]
    const limit = Math.min(sources.length, MAX_WEATHER_SOURCES)
    for (let i = 0; i < limit; i++) {
      const s = sources[i]
      slots[i].set(s.x, s.z, s.radius, s.intensity)
    }
    for (let i = limit; i < MAX_WEATHER_SOURCES; i++) slots[i].set(0, 0, 0, 0)
    u.uWeatherSourceCount.value = limit

    const jitterX = (((frameCounter.current & 1) === 0 ? 0.25 : -0.25) / halfWidth) * 2
    const jitterY = (((frameCounter.current & 2) === 0 ? 0.25 : -0.25) / halfHeight) * 2
    ;(u.uJitter.value as THREE.Vector2).set(jitterX, jitterY)
    frameCounter.current++

    const prevAutoClear = gl.autoClear
    const prevClearColor = new THREE.Color()
    gl.getClearColor(prevClearColor)
    const prevClearAlpha = gl.getClearAlpha()

    gl.setClearColor(0x000000, 0)
    gl.autoClear = true

    gl.setRenderTarget(writeRef.current)
    gl.clear()
    gl.render(raymarchScene.scene, orthoCamera)

    if (!initialisedRef.current) {
      compositeUniforms.uPrevious.value = writeRef.current.texture
      initialisedRef.current = true
    } else {
      compositeUniforms.uPrevious.value = readRef.current.texture
    }
    compositeUniforms.uCurrent.value = writeRef.current.texture
    gl.setRenderTarget(composedRt)
    gl.clear()
    gl.render(compositeScene.scene, orthoCamera)

    blitUniforms.uTexture.value = composedRt.texture
    gl.setRenderTarget(null)

    const tmp = writeRef.current
    writeRef.current = readRef.current
    readRef.current = tmp

    gl.autoClear = prevAutoClear
    gl.setClearColor(prevClearColor, prevClearAlpha)
  })

  if (!enabled) return null

  return (
    <mesh renderOrder={9999} frustumCulled={false}>
      <primitive object={blitGeometry} attach='geometry' />
      <primitive object={blitMaterial} attach='material' />
    </mesh>
  )
}
