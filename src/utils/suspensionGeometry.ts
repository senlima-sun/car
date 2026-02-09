import { SUSPENSION, TRACK_GAUGE, WHEELBASE } from '@/constants/dimensions'
import type { SuspensionCornerOutput, LinkageTransform } from '@/types/suspension'

const S = SUSPENSION
const HALF_TRACK = TRACK_GAUGE / 2
const HALF_WHEELBASE = WHEELBASE / 2

function clamp(v: number, min: number, max: number) {
  return v < min ? min : v > max ? max : v
}

function cylinderBetween(
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
): LinkageTransform {
  const dx = bx - ax
  const dy = by - ay
  const dz = bz - az
  const length = Math.sqrt(dx * dx + dy * dy + dz * dz)
  const mx = (ax + bx) / 2
  const my = (ay + by) / 2
  const mz = (az + bz) / 2

  const rotX = Math.atan2(dz, dy)
  const rotZ = -Math.asin(clamp(dx / (length || 1), -1, 1))

  return {
    position: [mx, my, mz],
    rotation: [rotX, 0, rotZ],
    scale: [1, length, 1],
  }
}

export function computeSuspensionLinkage(
  deflection: number,
  steerAngle: number,
  isLeft: boolean,
  isFront: boolean,
): SuspensionCornerOutput {
  const side = isLeft ? -1 : 1
  const zSign = isFront ? 1 : -1
  const baseZ = zSign * HALF_WHEELBASE
  const uprightX = side * HALF_TRACK

  const cDeflection = clamp(deflection, -0.05, 0.25)

  const upperChassisX = side * S.UPPER_CHASSIS_INBOARD_X
  const lowerChassisX = side * S.LOWER_CHASSIS_INBOARD_X
  const upperChassisY = S.UPPER_CHASSIS_Y
  const lowerChassisY = S.LOWER_CHASSIS_Y

  const uprightTopY = S.UPPER_UPRIGHT_Y + cDeflection
  const uprightBotY = S.LOWER_UPRIGHT_Y + cDeflection
  const uprightMidY = (uprightTopY + uprightBotY) / 2

  const steerOffset = isFront ? Math.sin(steerAngle) * 0.05 : 0
  const uprightZ = baseZ + steerOffset

  const upperArmSpreadA = baseZ + S.WISHBONE_SPREAD * zSign
  const upperArmSpreadB = baseZ - S.WISHBONE_SPREAD * zSign
  const lowerArmSpreadA = baseZ + S.WISHBONE_SPREAD * 1.2 * zSign
  const lowerArmSpreadB = baseZ - S.WISHBONE_SPREAD * 1.2 * zSign

  const upperWishbone: SuspensionCornerOutput['upperWishbone'] = {
    armA: cylinderBetween(
      upperChassisX, upperChassisY, upperArmSpreadA,
      uprightX, uprightTopY, uprightZ,
    ),
    armB: cylinderBetween(
      upperChassisX, upperChassisY, upperArmSpreadB,
      uprightX, uprightTopY, uprightZ,
    ),
  }

  const lowerWishbone: SuspensionCornerOutput['lowerWishbone'] = {
    armA: cylinderBetween(
      lowerChassisX, lowerChassisY, lowerArmSpreadA,
      uprightX, uprightBotY, uprightZ,
    ),
    armB: cylinderBetween(
      lowerChassisX, lowerChassisY, lowerArmSpreadB,
      uprightX, uprightBotY, uprightZ,
    ),
  }

  const uprightHeight = uprightTopY - uprightBotY
  const upright: LinkageTransform = {
    position: [uprightX, uprightMidY, uprightZ],
    rotation: [0, isFront ? steerAngle : 0, 0],
    scale: [1, uprightHeight / (S.UPPER_UPRIGHT_Y - S.LOWER_UPRIGHT_Y), 1],
  }

  const pushrodLowerX = (uprightX + lowerChassisX) / 2
  const pushrodLowerY = lowerChassisY + S.PUSHROD_LOWER_Y_OFFSET + cDeflection * 0.6
  const pushrodLowerZ = baseZ

  const pushrodUpperX = side * S.PUSHROD_UPPER_INBOARD_X
  const pushrodUpperY = S.PUSHROD_UPPER_Y
  const pushrodUpperZ = baseZ

  const pushrod = cylinderBetween(
    pushrodLowerX, pushrodLowerY, pushrodLowerZ,
    pushrodUpperX, pushrodUpperY, pushrodUpperZ,
  )

  const rockerPivotX = pushrodUpperX
  const rockerPivotY = pushrodUpperY
  const rockerPivotZ = pushrodUpperZ
  const rockerAngle = cDeflection * 2.5
  const rockerEndX = rockerPivotX - side * S.ROCKER_LENGTH * Math.cos(rockerAngle)
  const rockerEndY = rockerPivotY + S.ROCKER_LENGTH * Math.sin(rockerAngle)

  const rocker = cylinderBetween(
    rockerPivotX, rockerPivotY, rockerPivotZ,
    rockerEndX, rockerEndY, rockerPivotZ,
  )

  const springTopX = rockerEndX
  const springTopY = rockerEndY
  const springTopZ = rockerPivotZ
  const springBotX = rockerEndX - side * 0.02
  const springBotY = S.PUSHROD_UPPER_Y + 0.02
  const springBotZ = rockerPivotZ

  const compressionRatio = clamp(1 - cDeflection / S.SPRING_REST_LENGTH, 0.5, 1.0)

  const springDamper: SuspensionCornerOutput['springDamper'] = {
    spring: {
      ...cylinderBetween(springBotX, springBotY, springBotZ, springTopX, springTopY, springTopZ),
      compressionRatio,
    },
    damperBody: {
      position: [(springBotX + springTopX) / 2, (springBotY + springTopY) / 2 - 0.01, springBotZ],
      rotation: [0, 0, 0],
    },
    damperShaft: {
      position: [(springBotX + springTopX) / 2, (springBotY + springTopY) / 2 + 0.01, springBotZ],
      rotation: [0, 0, 0],
    },
  }

  return {
    upperWishbone,
    lowerWishbone,
    upright,
    pushrod,
    rocker,
    springDamper,
  }
}
