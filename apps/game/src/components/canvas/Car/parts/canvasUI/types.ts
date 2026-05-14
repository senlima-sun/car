export interface Bounds {
  x: number
  y: number
  w: number
  h: number
}

export interface BoxStyle {
  background?: string
  border?: string
  borderWidth?: number
  borderRadius?: number
  padding?: number
  gap?: number
}

export interface BoxNode {
  kind: 'box'
  direction: 'row' | 'column'
  style?: BoxStyle
  children?: UINode[]
  flex?: number
}

export interface TextNode {
  kind: 'text'
  content: string
  color?: string
  font?: string
  fontSize?: number
  bold?: boolean
  align?: CanvasTextAlign
  flex?: number
  offsetX?: number
  offsetY?: number
}

export interface SeparatorNode {
  kind: 'separator'
  color?: string
  lineWidth?: number
  inset?: number
  fixedSize?: number
}

export interface CircleNode {
  kind: 'circle'
  color?: string
  radius?: number
  flex?: number
}

export type UINode = BoxNode | TextNode | SeparatorNode | CircleNode
