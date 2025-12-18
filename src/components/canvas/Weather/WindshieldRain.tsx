import { useRef, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../../../stores/useGameStore'
import { useEnvironmentStore } from '../../../stores/useEnvironmentStore'
import { useCarStore } from '../../../stores/useCarStore'

// Windshield rain shader - animated droplets and streaks
const windshieldRainShader = {
  uniforms: {
    uTime: { value: 0 },
    uRainIntensity: { value: 0.5 },
    uSpeed: { value: 0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform float uRainIntensity;
    uniform float uSpeed;
    varying vec2 vUv;

    // Hash function for pseudo-random
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    // Smooth noise
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);

      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));

      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    // Rain droplet function
    float droplet(vec2 uv, vec2 center, float size) {
      float d = length(uv - center);
      float drop = smoothstep(size, size * 0.3, d);
      // Add slight refraction effect - distort center
      float refract = smoothstep(size * 0.8, 0.0, d) * 0.3;
      return drop + refract;
    }

    // Streak function for fast-moving rain
    float streak(vec2 uv, vec2 start, float length, float width) {
      vec2 dir = vec2(0.1, -1.0); // Slight diagonal due to wind
      dir = normalize(dir);

      vec2 toPoint = uv - start;
      float along = dot(toPoint, dir);
      float across = abs(dot(toPoint, vec2(-dir.y, dir.x)));

      float inStreak = step(0.0, along) * step(along, length);
      float widthFade = smoothstep(width, width * 0.3, across);
      float lengthFade = smoothstep(0.0, length * 0.2, along) * smoothstep(length, length * 0.8, along);

      return inStreak * widthFade * lengthFade;
    }

    void main() {
      vec2 uv = vUv;

      // Speed affects rain behavior
      float speedFactor = clamp(uSpeed / 100.0, 0.0, 1.0);

      // Time with speed influence
      float time = uTime * (1.0 + speedFactor * 2.0);

      // Layer multiple rain elements
      float rain = 0.0;

      // Stationary droplets (when slow/stopped) - more droplets with higher rain
      if (speedFactor < 0.7) {
        float dropletStrength = (1.0 - speedFactor) * uRainIntensity;
        for (float i = 0.0; i < 25.0; i++) {
          vec2 dropPos = vec2(
            hash(vec2(i, 0.0)),
            hash(vec2(0.0, i))
          );

          // Droplets slowly grow and fall
          float dropTime = fract(time * 0.15 + hash(vec2(i, i)));
          float dropY = dropPos.y - dropTime * 0.4;

          // Reset when below screen
          if (dropY < 0.0) {
            dropY = 1.0 + dropY;
          }

          float size = 0.015 + hash(vec2(i * 2.0, i)) * 0.025;
          size *= (1.0 + dropTime * 0.5); // Droplets grow as they fall

          rain += droplet(uv, vec2(dropPos.x, dropY), size) * dropletStrength;
        }
      }

      // Fast-moving streaks (when driving fast) - more streaks with higher rain
      if (speedFactor > 0.2) {
        float streakStrength = speedFactor * uRainIntensity;
        for (float i = 0.0; i < 40.0; i++) {
          vec2 streakStart = vec2(
            hash(vec2(i * 3.0, 1.0)),
            1.2 - fract(time * (0.8 + hash(vec2(i, 2.0)) * 0.4) + hash(vec2(i * 2.0, 3.0)))
          );

          float len = 0.1 + hash(vec2(i, 4.0)) * 0.15 * speedFactor;
          float wid = 0.001 + hash(vec2(i, 5.0)) * 0.002;

          rain += streak(uv, streakStart, len, wid) * streakStrength * 0.6;
        }
      }

      // Clamp total rain effect
      rain = clamp(rain, 0.0, 1.0);

      // Final color - semi-transparent with blue tint
      vec3 dropColor = vec3(0.7, 0.8, 1.0);
      float alpha = rain * 0.5 * uRainIntensity;

      // Add slight overall wetness tint at edges
      float edgeWet = (1.0 - smoothstep(0.0, 0.3, uv.y)) * 0.1 * uRainIntensity;
      edgeWet += (1.0 - smoothstep(0.7, 1.0, uv.y)) * 0.05 * uRainIntensity;

      gl_FragColor = vec4(dropColor, alpha + edgeWet);
    }
  `,
}

export default function WindshieldRain() {
  const meshRef = useRef<THREE.Mesh>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const { camera } = useThree()

  const cameraMode = useGameStore(s => s.cameraMode)
  const rainIntensity = useEnvironmentStore(s => s.rainIntensity)
  const speed = useCarStore(s => s.speed)

  const isRaining = rainIntensity > 0.01
  const isVisible = cameraMode === 'first-person' && isRaining

  // Create shader material
  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uRainIntensity: { value: 0.8 },
        uSpeed: { value: 0 },
      },
      vertexShader: windshieldRainShader.vertexShader,
      fragmentShader: windshieldRainShader.fragmentShader,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  }, [])

  useFrame((_, delta) => {
    if (!meshRef.current || !materialRef.current || !isVisible) return

    // Update shader uniforms
    materialRef.current.uniforms.uTime.value += delta
    materialRef.current.uniforms.uSpeed.value = speed

    // Position the plane in front of the camera
    const forward = new THREE.Vector3(0, 0, -1)
    forward.applyQuaternion(camera.quaternion)

    meshRef.current.position.copy(camera.position)
    meshRef.current.position.add(forward.multiplyScalar(0.5))
    meshRef.current.quaternion.copy(camera.quaternion)
  })

  if (!isVisible) return null

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[2, 1.2]} />
      <primitive object={shaderMaterial} ref={materialRef} />
    </mesh>
  )
}
