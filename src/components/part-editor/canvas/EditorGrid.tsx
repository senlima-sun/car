import { Grid } from '@react-three/drei'

export default function EditorGrid() {
  return (
    <Grid
      position={[0, -0.01, 0]}
      args={[20, 20]}
      cellSize={0.5}
      cellThickness={0.5}
      cellColor="#444444"
      sectionSize={2}
      sectionThickness={1}
      sectionColor="#666666"
      fadeDistance={30}
      fadeStrength={1}
      followCamera={false}
      infiniteGrid
    />
  )
}
