import { useMemo, useCallback, useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { RigidBody, TrimeshCollider } from '@react-three/rapier'
import { useSurfaceStore, type SurfaceType } from '../../../stores/useSurfaceStore'

interface SurfacePatchProps {
  polygonPoints?: Array<[number, number, number]>
  surfaceType: 'grass_patch' | 'gravel_patch'
  isGhost?: boolean
}

const SURFACE_COLORS = {
  grass_patch: '#4a7c59',
  gravel_patch: '#8a7f6d',
} as const

const SURFACE_Y = {
  grass_patch: 0.15,
  gravel_patch: 0.16,
} as const

const COLLIDER_THICKNESS = 1.0

function buildColliderMesh(points: Array<[number, number, number]>, y: number) {
  const n = points.length
  const topY = y + COLLIDER_THICKNESS
  const botY = y - 0.1

  const vertices = new Float32Array(n * 2 * 3)
  for (let i = 0; i < n; i++) {
    vertices[i * 3] = points[i][0]
    vertices[i * 3 + 1] = topY
    vertices[i * 3 + 2] = points[i][2]

    vertices[(n + i) * 3] = points[i][0]
    vertices[(n + i) * 3 + 1] = botY
    vertices[(n + i) * 3 + 2] = points[i][2]
  }

  const shape = new THREE.Shape()
  shape.moveTo(points[0][0], -points[0][2])
  for (let i = 1; i < n; i++) {
    shape.lineTo(points[i][0], -points[i][2])
  }
  shape.closePath()
  const capGeo = new THREE.ShapeGeometry(shape)
  const capIndex = capGeo.getIndex()!
  const capIndices: number[] = []
  for (let i = 0; i < capIndex.count; i++) {
    capIndices.push(capIndex.getX(i))
  }
  capGeo.dispose()

  const indexList: number[] = []
  for (let i = 0; i < capIndices.length; i += 3) {
    indexList.push(capIndices[i], capIndices[i + 1], capIndices[i + 2])
  }
  for (let i = 0; i < capIndices.length; i += 3) {
    indexList.push(capIndices[i] + n, capIndices[i + 2] + n, capIndices[i + 1] + n)
  }
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n
    indexList.push(i, next, i + n)
    indexList.push(next, next + n, i + n)
  }

  return { vertices, indices: new Uint32Array(indexList) }
}

const GRASS_NOISE = /* glsl */ `
vec3 _mod289v3(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec2 _mod289v2(vec2 x){return x-floor(x*(1.0/289.0))*289.0;}
vec3 _permute(vec3 x){return _mod289v3(((x*34.0)+10.0)*x);}
float _snoise(vec2 v){
  const vec4 C=vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);
  vec2 i=floor(v+dot(v,C.yy));vec2 x0=v-i+dot(i,C.xx);
  vec2 i1=(x0.x>x0.y)?vec2(1,0):vec2(0,1);
  vec4 x12=x0.xyxy+C.xxzz;x12.xy-=i1;i=_mod289v2(i);
  vec3 p=_permute(_permute(i.y+vec3(0,i1.y,1))+i.x+vec3(0,i1.x,1));
  vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.0);
  m=m*m;m=m*m;
  vec3 x=2.0*fract(p*C.www)-1.0;vec3 h=abs(x)-0.5;
  vec3 ox=floor(x+0.5);vec3 a0=x-ox;
  m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);
  vec3 g;g.x=a0.x*x0.x+h.x*x0.y;g.yz=a0.yz*x12.xz+h.yz*x12.yw;
  return 130.0*dot(m,g);
}
float _valNoise(vec2 p){
  vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.0-2.0*f);
  float a=fract(sin(dot(i,vec2(127.1,311.7)))*43758.5453);
  float b=fract(sin(dot(i+vec2(1,0),vec2(127.1,311.7)))*43758.5453);
  float c=fract(sin(dot(i+vec2(0,1),vec2(127.1,311.7)))*43758.5453);
  float d=fract(sin(dot(i+vec2(1,1),vec2(127.1,311.7)))*43758.5453);
  return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
}
`

const GRAVEL_NOISE = /* glsl */ `
vec2 _hash2(vec2 p){p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3)));return fract(sin(p)*43758.5453);}
float _hash1(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
vec3 _voronoi(vec2 x,float scale){
  vec2 p=x*scale;vec2 n=floor(p);vec2 f=fract(p);
  float md=8.0;float sd=8.0;vec2 cc=vec2(0);
  for(int j=-2;j<=2;j++)for(int i=-2;i<=2;i++){
    vec2 g=vec2(float(i),float(j));vec2 o=_hash2(n+g);vec2 r=g+o-f;float d=dot(r,r);
    if(d<md){sd=md;md=d;cc=n+g;}else if(d<sd){sd=d;}
  }
  return vec3(sqrt(md),sqrt(sd),_hash1(cc));
}
`

function SurfaceMaterial({
  surfaceType,
  timeRef,
}: {
  surfaceType: 'grass_patch' | 'gravel_patch'
  timeRef: React.MutableRefObject<{ value: number }>
}) {
  const isGrass = surfaceType === 'grass_patch'
  const matRef = useRef<THREE.MeshStandardMaterial>(null)

  const onBeforeCompile = useCallback(
    (shader: THREE.WebGLProgramParametersWithUniforms) => {
      shader.uniforms.uSurfaceTime = timeRef.current

      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>
varying vec3 vSurfaceWorldPos;`,
      )
      shader.vertexShader = shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
vSurfaceWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
      )

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>
varying vec3 vSurfaceWorldPos;
uniform float uSurfaceTime;
${isGrass ? GRASS_NOISE : GRAVEL_NOISE}
`,
      )

      if (isGrass) {
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <color_fragment>',
          `#include <color_fragment>
{
  vec2 wXZ = vSurfaceWorldPos.xz;
  vec3 dk=vec3(0.227,0.420,0.271);vec3 md=vec3(0.353,0.612,0.310);vec3 lt=vec3(0.482,0.769,0.416);
  float n1=_snoise(wXZ*0.3+uSurfaceTime*0.01)*0.5+0.5;
  float n2=_snoise(wXZ*1.2+vec2(50,80))*0.5+0.5;
  float n3=_snoise(wXZ*4.0+vec2(120,200))*0.5+0.5;
  float mn=_valNoise(wXZ*15.0);
  vec3 col=mix(dk,md,n1);col=mix(col,lt,n2*0.4);col=mix(col,dk,n3*0.25);
  float wd=_snoise(wXZ*0.1+uSurfaceTime*0.05)*0.5+0.5;
  float ang=wd*3.14159;float ca=cos(ang);float sa=sin(ang);
  vec2 rot=vec2(wXZ.x*ca-wXZ.y*sa,wXZ.x*sa+wXZ.y*ca);
  float blade=_snoise(vec2(rot.x*40.0,rot.y*6.0))*0.6+_snoise(vec2(rot.x*80.0,rot.y*12.0))*0.4;
  col+=vec3(0.02,0.04,0.01)*blade;
  col*=0.85+mn*0.3;
  diffuseColor.rgb=col;
}
`,
        )
      } else {
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <color_fragment>',
          `#include <color_fragment>
{
  vec2 uv=vSurfaceWorldPos.xz;
  vec3 lp=_voronoi(uv,3.0);vec3 mp=_voronoi(uv+vec2(17.3,31.7),6.0);vec3 sp=_voronoi(uv+vec2(53.1,89.4),12.0);
  float ce=smoothstep(0.03,0.08,lp.y-lp.x)*0.5+smoothstep(0.02,0.06,mp.y-mp.x)*0.3+smoothstep(0.01,0.05,sp.y-sp.x)*0.2;
  vec3 sandyTan=vec3(0.722,0.659,0.541);vec3 stoneGrey=vec3(0.541,0.522,0.502);
  vec3 warmBrown=vec3(0.478,0.420,0.365);vec3 lightTan=vec3(0.780,0.730,0.620);vec3 darkGrey=vec3(0.420,0.400,0.380);
  float lv=_hash1(vec2(lp.z*127.1,lp.z*269.5));
  vec3 lc=mix(sandyTan,stoneGrey,step(0.33,lp.z));lc=mix(lc,warmBrown,step(0.66,lp.z));lc=mix(lc,lightTan,lv*0.3);lc*=0.9+lv*0.2;
  float mv=_hash1(vec2(mp.z*311.7,mp.z*183.3));
  vec3 mc=mix(stoneGrey,warmBrown,step(0.4,mp.z));mc=mix(mc,sandyTan,step(0.7,mp.z));mc=mix(mc,darkGrey,mv*0.25);mc*=0.85+mv*0.3;
  float sv=_hash1(vec2(sp.z*419.2,sp.z*371.9));
  vec3 sc=mix(warmBrown,sandyTan,step(0.5,sp.z));sc=mix(sc,stoneGrey,sv*0.4);sc*=0.88+sv*0.24;
  vec3 pebble=lc*0.45+mc*0.35+sc*0.2;
  vec3 col=mix(vec3(0.18,0.15,0.12),pebble,ce);
  col+=vec3(_hash1(floor(uv*50.0))*0.06)-vec3(0.03);
  diffuseColor.rgb=col;
}
`,
        )
      }
    },
    [isGrass, timeRef],
  )

  return (
    <meshStandardMaterial
      ref={matRef}
      color={isGrass ? '#4a7c59' : '#8a7f6d'}
      side={THREE.DoubleSide}
      roughness={isGrass ? 0.9 : 0.85}
      polygonOffset
      polygonOffsetFactor={-4}
      polygonOffsetUnits={-4}
      onBeforeCompile={onBeforeCompile}
    />
  )
}

export default function SurfacePatch({
  polygonPoints,
  surfaceType,
  isGhost = false,
}: SurfacePatchProps) {
  if (!polygonPoints || polygonPoints.length < 3) return null

  const y = SURFACE_Y[surfaceType]
  const timeRef = useRef({ value: 0.0 })

  const { geometry, colliderData } = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(polygonPoints[0][0], polygonPoints[0][2])
    for (let i = 1; i < polygonPoints.length; i++) {
      shape.lineTo(polygonPoints[i][0], polygonPoints[i][2])
    }
    shape.closePath()
    const geometry = new THREE.ShapeGeometry(shape)

    const colliderData = buildColliderMesh(polygonPoints, y)

    return { geometry, colliderData }
  }, [polygonPoints, y])

  useEffect(() => {
    return () => {
      geometry.dispose()
    }
  }, [geometry])

  useFrame((_state, delta) => {
    timeRef.current.value += delta
  })

  const color = SURFACE_COLORS[surfaceType]

  const enterSurface = useSurfaceStore(s => s.enterSurface)
  const exitSurface = useSurfaceStore(s => s.exitSurface)

  const physicsSurfaceType: SurfaceType = surfaceType === 'gravel_patch' ? 'gravel' : 'grass'

  const handleEnter = useCallback(() => {
    if (isGhost) return
    enterSurface(physicsSurfaceType)
  }, [isGhost, enterSurface, physicsSurfaceType])

  const handleExit = useCallback(() => {
    if (isGhost) return
    exitSurface(physicsSurfaceType)
  }, [isGhost, exitSurface, physicsSurfaceType])

  if (isGhost) {
    return (
      <mesh geometry={geometry} rotation={[Math.PI / 2, 0, 0]} position={[0, y, 0]}>
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.5}
          side={THREE.DoubleSide}
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-4}
          polygonOffsetUnits={-4}
        />
      </mesh>
    )
  }

  return (
    <RigidBody type='fixed' colliders={false}>
      <mesh geometry={geometry} rotation={[Math.PI / 2, 0, 0]} position={[0, y, 0]} receiveShadow>
        <SurfaceMaterial surfaceType={surfaceType} timeRef={timeRef} />
      </mesh>
      <TrimeshCollider
        args={[colliderData.vertices, colliderData.indices]}
        sensor
        onIntersectionEnter={handleEnter}
        onIntersectionExit={handleExit}
      />
    </RigidBody>
  )
}
