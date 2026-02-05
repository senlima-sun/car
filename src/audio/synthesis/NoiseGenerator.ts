const BUFFER_DURATION = 2
const cache = new WeakMap<AudioContext, { white: AudioBuffer; brown: AudioBuffer; pink: AudioBuffer }>()

function getOrCreate(ctx: AudioContext) {
  let buffers = cache.get(ctx)
  if (!buffers) {
    buffers = {
      white: createWhiteNoise(ctx),
      brown: createBrownNoise(ctx),
      pink: createPinkNoise(ctx),
    }
    cache.set(ctx, buffers)
  }
  return buffers
}

function createWhiteNoise(ctx: AudioContext): AudioBuffer {
  const length = ctx.sampleRate * BUFFER_DURATION
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1
  }
  return buffer
}

function createBrownNoise(ctx: AudioContext): AudioBuffer {
  const length = ctx.sampleRate * BUFFER_DURATION
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  let last = 0
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1
    last = (last + 0.02 * white) / 1.02
    data[i] = last * 3.5
  }
  return buffer
}

function createPinkNoise(ctx: AudioContext): AudioBuffer {
  const length = ctx.sampleRate * BUFFER_DURATION
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1
    b0 = 0.99886 * b0 + white * 0.0555179
    b1 = 0.99332 * b1 + white * 0.0750759
    b2 = 0.96900 * b2 + white * 0.1538520
    b3 = 0.86650 * b3 + white * 0.3104856
    b4 = 0.55000 * b4 + white * 0.5329522
    b5 = -0.7616 * b5 - white * 0.0168980
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11
    b6 = white * 0.115926
  }
  return buffer
}

export function whiteNoise(ctx: AudioContext): AudioBuffer {
  return getOrCreate(ctx).white
}

export function brownNoise(ctx: AudioContext): AudioBuffer {
  return getOrCreate(ctx).brown
}

export function pinkNoise(ctx: AudioContext): AudioBuffer {
  return getOrCreate(ctx).pink
}

export function createNoiseSource(ctx: AudioContext, buffer: AudioBuffer): AudioBufferSourceNode {
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.loop = true
  return source
}
