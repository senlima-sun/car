import { usePartEditorStore } from '../store'

/**
 * Ghost preview of the car frame for positioning reference.
 * Shows wireframe of main car components so you know where to place parts.
 *
 * Car coordinate system:
 * - X: Left (-) / Right (+)
 * - Y: Down (-) / Up (+)
 * - Z: Back (-) / Front (+)
 *
 * Key positions:
 * - Front wheels: Z = 1.6
 * - Rear wheels: Z = -1.2
 * - Cockpit: Z = 0.2 to 0.6
 * - Ground (wheel bottom): Y ≈ -0.3
 */
export default function ReferenceCarPreview() {
  const showReferenceModel = usePartEditorStore((s) => s.showReferenceModel)

  if (!showReferenceModel) return null

  const ghostMaterial = {
    color: '#4488ff',
    transparent: true,
    opacity: 0.15,
    wireframe: false,
  }

  const wireMaterial = {
    color: '#4488ff',
    transparent: true,
    opacity: 0.4,
    wireframe: true,
  }

  const frontZ = 1.6
  const rearZ = -1.2
  const wheelRadius = 0.3
  const groundY = -wheelRadius // Where wheels touch ground

  return (
    <group name="reference-car">
      {/* Ground plane indicator */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, groundY - 0.01, 0.2]}>
        <planeGeometry args={[3, 4]} />
        <meshBasicMaterial color="#335588" transparent opacity={0.1} />
      </mesh>

      {/* === MAIN BODY === */}
      {/* Front nose */}
      <mesh position={[0, 0, frontZ + 0.1]}>
        <boxGeometry args={[0.5, 0.15, 0.6]} />
        <meshBasicMaterial {...wireMaterial} />
      </mesh>

      {/* Nose to cockpit */}
      <mesh position={[0, 0, 0.95]}>
        <boxGeometry args={[0.45, 0.12, 0.7]} />
        <meshBasicMaterial {...wireMaterial} />
      </mesh>

      {/* Cockpit area - this is where seat goes! */}
      <mesh position={[0, 0.05, 0.35]}>
        <boxGeometry args={[0.8, 0.35, 0.9]} />
        <meshBasicMaterial {...ghostMaterial} />
      </mesh>

      {/* Cockpit floor */}
      <mesh position={[0, -0.1, 0.35]}>
        <boxGeometry args={[0.9, 0.1, 1.0]} />
        <meshBasicMaterial {...wireMaterial} />
      </mesh>

      {/* Roll hoop */}
      <mesh position={[0, 0.45, -0.35]}>
        <boxGeometry args={[0.1, 0.45, 0.1]} />
        <meshBasicMaterial {...wireMaterial} />
      </mesh>

      {/* Engine bay */}
      <mesh position={[0, 0, -0.85]}>
        <boxGeometry args={[0.7, 0.25, 0.7]} />
        <meshBasicMaterial {...wireMaterial} />
      </mesh>

      {/* === WHEELS (circles) === */}
      {/* Front left */}
      <mesh position={[-0.95, 0, frontZ]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[wheelRadius, wheelRadius, 0.35, 16]} />
        <meshBasicMaterial {...wireMaterial} />
      </mesh>
      {/* Front right */}
      <mesh position={[0.95, 0, frontZ]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[wheelRadius, wheelRadius, 0.35, 16]} />
        <meshBasicMaterial {...wireMaterial} />
      </mesh>
      {/* Rear left */}
      <mesh position={[-0.95, 0, rearZ]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[wheelRadius, wheelRadius, 0.35, 16]} />
        <meshBasicMaterial {...wireMaterial} />
      </mesh>
      {/* Rear right */}
      <mesh position={[0.95, 0, rearZ]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[wheelRadius, wheelRadius, 0.35, 16]} />
        <meshBasicMaterial {...wireMaterial} />
      </mesh>

      {/* === AXIS HELPER LABELS === */}
      {/* Front arrow */}
      <mesh position={[0, 0.5, 2.2]}>
        <coneGeometry args={[0.08, 0.2, 8]} />
        <meshBasicMaterial color="#00ff00" />
      </mesh>
      <mesh position={[0, 0.5, 2.0]}>
        <boxGeometry args={[0.03, 0.03, 0.3]} />
        <meshBasicMaterial color="#00ff00" />
      </mesh>

      {/* Position markers */}
      {/* Cockpit center marker */}
      <mesh position={[0, 0.1, 0.35]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshBasicMaterial color="#ffff00" />
      </mesh>

      {/* Ground level line */}
      <mesh position={[0, groundY, 0.2]}>
        <boxGeometry args={[2.5, 0.01, 0.01]} />
        <meshBasicMaterial color="#ff4444" />
      </mesh>
    </group>
  )
}
