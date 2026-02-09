import type { BoxNode, BoxStyle, TextNode, SeparatorNode, CircleNode, UINode } from './types'

export function Box(opts: Partial<Omit<BoxNode, 'kind'>> = {}): BoxNode {
  return { kind: 'box', direction: opts.direction ?? 'column', ...opts }
}

export function Row(opts: Omit<Partial<BoxNode>, 'kind' | 'direction'> = {}): BoxNode {
  return Box({ ...opts, direction: 'row' })
}

export function Col(opts: Omit<Partial<BoxNode>, 'kind' | 'direction'> = {}): BoxNode {
  return Box({ ...opts, direction: 'column' })
}

export function Text(content: string, opts: Omit<TextNode, 'kind' | 'content'> = {}): TextNode {
  return { kind: 'text', content, ...opts }
}

export function Sep(opts: Omit<SeparatorNode, 'kind'> = {}): SeparatorNode {
  return { kind: 'separator', fixedSize: 4, ...opts }
}

export function Dot(opts: Omit<CircleNode, 'kind'> = {}): CircleNode {
  return { kind: 'circle', ...opts }
}
