import type { UINode, Bounds, BoxNode, TextNode, SeparatorNode, CircleNode } from './types'

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const cr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + cr, y)
  ctx.lineTo(x + w - cr, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + cr)
  ctx.lineTo(x + w, y + h - cr)
  ctx.quadraticCurveTo(x + w, y + h, x + w - cr, y + h)
  ctx.lineTo(x + cr, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - cr)
  ctx.lineTo(x, y + cr)
  ctx.quadraticCurveTo(x, y, x + cr, y)
  ctx.closePath()
}

function getFlex(node: UINode): number {
  switch (node.kind) {
    case 'box':
      return node.flex ?? 1
    case 'text':
      return node.flex ?? 1
    case 'circle':
      return node.flex ?? 1
    case 'separator':
      return 0
  }
}

function getFixedSize(node: UINode): number | undefined {
  if (node.kind === 'separator') return node.fixedSize
  return undefined
}

export function renderNode(ctx: CanvasRenderingContext2D, node: UINode, bounds: Bounds): void {
  switch (node.kind) {
    case 'box':
      return renderBox(ctx, node, bounds)
    case 'text':
      return renderText(ctx, node, bounds)
    case 'separator':
      return renderSep(ctx, node, bounds)
    case 'circle':
      return renderCircle(ctx, node, bounds)
  }
}

function renderBox(ctx: CanvasRenderingContext2D, node: BoxNode, bounds: Bounds): void {
  const s = node.style
  if (s) {
    const r = s.borderRadius ?? 0
    if (s.background) {
      roundedRect(ctx, bounds.x, bounds.y, bounds.w, bounds.h, r)
      ctx.fillStyle = s.background
      ctx.fill()
    }
    if (s.border) {
      roundedRect(ctx, bounds.x, bounds.y, bounds.w, bounds.h, r)
      ctx.strokeStyle = s.border
      ctx.lineWidth = s.borderWidth ?? 2
      ctx.stroke()
    }
  }

  const children = node.children
  if (!children || children.length === 0) return

  const pad = s?.padding ?? 0
  const gap = s?.gap ?? 0
  const inner: Bounds = {
    x: bounds.x + pad,
    y: bounds.y + pad,
    w: bounds.w - pad * 2,
    h: bounds.h - pad * 2,
  }

  const isRow = node.direction === 'row'
  const totalSize = isRow ? inner.w : inner.h
  const totalGaps = gap * (children.length - 1)

  let totalFixed = 0
  let totalFlex = 0
  for (const child of children) {
    const fixed = getFixedSize(child)
    if (fixed !== undefined) {
      totalFixed += fixed
    } else {
      totalFlex += getFlex(child)
    }
  }

  const flexSpace = Math.max(0, totalSize - totalFixed - totalGaps)
  let offset = 0

  for (const child of children) {
    const fixed = getFixedSize(child)
    let size: number
    if (fixed !== undefined) {
      size = fixed
    } else {
      size = totalFlex > 0 ? (getFlex(child) / totalFlex) * flexSpace : 0
    }

    const childBounds: Bounds = isRow
      ? { x: inner.x + offset, y: inner.y, w: size, h: inner.h }
      : { x: inner.x, y: inner.y + offset, w: inner.w, h: size }

    renderNode(ctx, child, childBounds)
    offset += size + gap
  }
}

function renderText(ctx: CanvasRenderingContext2D, node: TextNode, bounds: Bounds): void {
  const fontSize = Math.round((node.fontSize ?? 0.4) * bounds.h)
  if (fontSize <= 0) return

  const fontFamily = node.font ?? 'Arial, Helvetica, sans-serif'
  const bold = node.bold ? 'bold ' : ''

  ctx.textAlign = node.align ?? 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = node.color ?? '#ffffff'
  ctx.font = `${bold}${fontSize}px ${fontFamily}`

  let tx: number
  switch (node.align) {
    case 'left':
      tx = bounds.x + 4
      break
    case 'right':
      tx = bounds.x + bounds.w - 4
      break
    default:
      tx = bounds.x + bounds.w / 2
  }
  let ty = bounds.y + bounds.h / 2

  if (node.offsetX) tx += node.offsetX * bounds.w
  if (node.offsetY) ty += node.offsetY * bounds.h

  ctx.fillText(node.content, tx, ty)
}

function renderSep(ctx: CanvasRenderingContext2D, node: SeparatorNode, bounds: Bounds): void {
  const color = node.color ?? 'rgba(255,255,255,0.06)'
  const lw = node.lineWidth ?? 2
  const inset = node.inset ?? 0.15

  ctx.strokeStyle = color
  ctx.lineWidth = lw
  ctx.beginPath()

  if (bounds.h > bounds.w) {
    const x = bounds.x + bounds.w / 2
    ctx.moveTo(x, bounds.y + bounds.h * inset)
    ctx.lineTo(x, bounds.y + bounds.h * (1 - inset))
  } else {
    const y = bounds.y + bounds.h / 2
    ctx.moveTo(bounds.x + bounds.w * inset, y)
    ctx.lineTo(bounds.x + bounds.w * (1 - inset), y)
  }
  ctx.stroke()
}

function renderCircle(ctx: CanvasRenderingContext2D, node: CircleNode, bounds: Bounds): void {
  const r = (node.radius ?? 0.3) * Math.min(bounds.w, bounds.h)
  const cx = bounds.x + bounds.w / 2
  const cy = bounds.y + bounds.h / 2

  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = node.color ?? '#ffffff'
  ctx.fill()
}
