import { create } from 'zustand'
import * as THREE from 'three'
import {
  STAMP_VERTEX_SHADER,
  STAMP_FRAGMENT_SHADER,
  DECAY_VERTEX_SHADER,
  DECAY_FRAGMENT_SHADER,
} from '../shaders/skidMarkStamp'

const RT_SIZE = 2048
const WORLD_HALF = 250
const DRY_DECAY_RATE = 0.02
const WET_DECAY_RATE = 0.15
const RAIN_WASH_RATE = 0.4
const COLD_DECAY_MULT = 0.5
const HOT_DECAY_MULT = 1.8

interface StampPoint {
  x: number
  z: number
  dirX: number
  dirZ: number
  intensity: number
  width: number
  isWet: boolean
}

interface SkidMarkStore {
  initialized: boolean
  rtA: THREE.WebGLRenderTarget | null
  rtB: THREE.WebGLRenderTarget | null
  current: 'a' | 'b'
  stampMaterial: THREE.ShaderMaterial | null
  decayMaterial: THREE.ShaderMaterial | null
  stampGeometry: THREE.BufferGeometry | null
  decayScene: THREE.Scene | null
  decayCamera: THREE.OrthographicCamera | null
  stampScene: THREE.Scene | null
  stampCamera: THREE.OrthographicCamera | null
  bounds: THREE.Vector4

  init: () => void
  stampMarks: (gl: THREE.WebGLRenderer, points: StampPoint[]) => void
  decay: (gl: THREE.WebGLRenderer, dt: number, rainIntensity: number, temperature: number) => void
  getTexture: () => THREE.Texture | null
  getBounds: () => THREE.Vector4
  dispose: () => void
}

export const useSkidMarkStore = create<SkidMarkStore>((set, get) => ({
  initialized: false,
  rtA: null,
  rtB: null,
  current: 'a',
  stampMaterial: null,
  decayMaterial: null,
  stampGeometry: null,
  decayScene: null,
  decayCamera: null,
  stampScene: null,
  stampCamera: null,
  bounds: new THREE.Vector4(-WORLD_HALF, -WORLD_HALF, WORLD_HALF, WORLD_HALF),

  init() {
    if (get().initialized) return

    const rtOptions: THREE.RenderTargetOptions = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
    }
    const rtA = new THREE.WebGLRenderTarget(RT_SIZE, RT_SIZE, rtOptions)
    const rtB = new THREE.WebGLRenderTarget(RT_SIZE, RT_SIZE, rtOptions)

    const stampMaterial = new THREE.ShaderMaterial({
      vertexShader: STAMP_VERTEX_SHADER,
      fragmentShader: STAMP_FRAGMENT_SHADER,
      uniforms: {
        uIntensity: { value: 0 },
        uIsWet: { value: 0 },
      },
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
    })

    const stampGeometry = new THREE.PlaneGeometry(1, 1)
    const uvAttr = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1])
    stampGeometry.setAttribute('aStampUV', new THREE.BufferAttribute(uvAttr, 2))

    const decayMaterial = new THREE.ShaderMaterial({
      vertexShader: DECAY_VERTEX_SHADER,
      fragmentShader: DECAY_FRAGMENT_SHADER,
      uniforms: {
        uPrevFrame: { value: null },
        uDecayFactor: { value: 1.0 },
      },
      depthTest: false,
      depthWrite: false,
    })

    const stampCamera = new THREE.OrthographicCamera(
      -WORLD_HALF, WORLD_HALF, WORLD_HALF, -WORLD_HALF, 0.1, 10,
    )
    stampCamera.position.set(0, 5, 0)
    stampCamera.lookAt(0, 0, 0)
    stampCamera.up.set(0, 0, -1)

    const stampScene = new THREE.Scene()

    const decayCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const decayScene = new THREE.Scene()
    const decayQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), decayMaterial)
    decayScene.add(decayQuad)

    set({
      initialized: true,
      rtA,
      rtB,
      stampMaterial,
      decayMaterial,
      stampGeometry,
      stampScene,
      stampCamera,
      decayScene,
      decayCamera,
    })
  },

  stampMarks(gl, points) {
    const s = get()
    if (!s.initialized || !s.stampMaterial || !s.stampGeometry || !s.stampScene || !s.stampCamera) return

    const currentRT = s.current === 'a' ? s.rtA! : s.rtB!

    s.stampScene.children.length = 0

    for (const pt of points) {
      const mesh = new THREE.Mesh(s.stampGeometry, s.stampMaterial.clone())

      const angle = Math.atan2(pt.dirX, pt.dirZ)
      mesh.rotation.set(-Math.PI / 2, 0, -angle)
      mesh.position.set(pt.x, 0, pt.z)

      const segLen = 0.8
      mesh.scale.set(pt.width, segLen, 1)

      const mat = mesh.material as THREE.ShaderMaterial
      mat.uniforms.uIntensity.value = pt.intensity
      mat.uniforms.uIsWet.value = pt.isWet ? 1 : 0

      s.stampScene.add(mesh)
    }

    if (s.stampScene.children.length === 0) return

    const prevRT = gl.getRenderTarget()
    const prevAutoClear = gl.autoClear
    gl.autoClear = false
    gl.setRenderTarget(currentRT)
    gl.render(s.stampScene, s.stampCamera)
    gl.setRenderTarget(prevRT)
    gl.autoClear = prevAutoClear

    for (const child of s.stampScene.children) {
      const mesh = child as THREE.Mesh
      if (mesh.material !== s.stampMaterial) {
        (mesh.material as THREE.ShaderMaterial).dispose()
      }
    }
    s.stampScene.children.length = 0
  },

  decay(gl, dt, rainIntensity, temperature) {
    const s = get()
    if (!s.initialized || !s.decayMaterial || !s.decayScene || !s.decayCamera) return

    let tempMult = 1.0
    if (temperature < 5) tempMult = COLD_DECAY_MULT
    else if (temperature > 35) tempMult = HOT_DECAY_MULT

    let totalDecay = DRY_DECAY_RATE * tempMult
    if (rainIntensity > 0.01) {
      totalDecay = WET_DECAY_RATE * tempMult + RAIN_WASH_RATE * rainIntensity
    }

    const decayFactor = Math.max(0, 1 - totalDecay * dt)

    const readRT = s.current === 'a' ? s.rtA! : s.rtB!
    const writeRT = s.current === 'a' ? s.rtB! : s.rtA!

    s.decayMaterial.uniforms.uPrevFrame.value = readRT.texture
    s.decayMaterial.uniforms.uDecayFactor.value = decayFactor

    const prevRT = gl.getRenderTarget()
    gl.setRenderTarget(writeRT)
    gl.clear()
    gl.render(s.decayScene, s.decayCamera)
    gl.setRenderTarget(prevRT)

    set({ current: s.current === 'a' ? 'b' : 'a' })
  },

  getTexture() {
    const s = get()
    if (!s.initialized) return null
    return s.current === 'a' ? s.rtA!.texture : s.rtB!.texture
  },

  getBounds() {
    return get().bounds
  },

  dispose() {
    const s = get()
    s.rtA?.dispose()
    s.rtB?.dispose()
    s.stampMaterial?.dispose()
    s.decayMaterial?.dispose()
    s.stampGeometry?.dispose()
    set({ initialized: false, rtA: null, rtB: null })
  },
}))
