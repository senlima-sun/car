import { RefObject } from 'react'
import { Group } from 'three'

export interface CameraTargetProps {
  target: RefObject<Group | null>
}
