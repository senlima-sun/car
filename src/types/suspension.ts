export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface LinkageTransform {
  position: [number, number, number]
  rotation: [number, number, number]
  scale?: [number, number, number]
}

export interface WishboneOutput {
  armA: LinkageTransform
  armB: LinkageTransform
}

export interface SpringDamperOutput {
  spring: LinkageTransform & { compressionRatio: number }
  damperBody: LinkageTransform
  damperShaft: LinkageTransform
}

export interface SuspensionCornerOutput {
  upperWishbone: WishboneOutput
  lowerWishbone: WishboneOutput
  upright: LinkageTransform
  pushrod: LinkageTransform
  rocker: LinkageTransform
  springDamper: SpringDamperOutput
}
