import { computeCacheKey, readCache, writeCache } from './cache'
import type { ElevationGrid, ElevationProvider, ProviderName } from './provider'
import { ProviderError } from './provider'

const MAX_RETRIES = 3
const BACKOFF_BASE_MS = 500

export interface FetchOptions {
  south: number
  north: number
  west: number
  east: number
  targetCols: number
  targetRows: number
  primary: ElevationProvider
  fallback?: ElevationProvider
  allowNetwork: boolean
  log?: (line: string) => void
}

export async function fetchWithCacheAndFallback(opts: FetchOptions): Promise<ElevationGrid> {
  const log = opts.log ?? (() => {})
  const providers: Array<{ tag: string; provider: ElevationProvider }> = [
    { tag: 'primary', provider: opts.primary },
  ]
  if (opts.fallback) providers.push({ tag: 'fallback', provider: opts.fallback })

  for (const { tag, provider } of providers) {
    const cached = await readCache({
      provider: provider.name,
      south: opts.south,
      north: opts.north,
      west: opts.west,
      east: opts.east,
      targetCols: opts.targetCols,
      targetRows: opts.targetRows,
    })
    if (cached) {
      log(`cache hit: ${provider.name} (${tag})`)
      return cached
    }
  }

  if (!opts.allowNetwork) {
    throw new ProviderError(
      'no cache available and network access is disabled (set ELEVATION_ALLOW_NETWORK=1 to enable)',
      { retryable: false }
    )
  }

  let lastError: Error | null = null
  for (const { tag, provider } of providers) {
    try {
      const grid = await fetchWithRetry(provider, opts, log, tag)
      await writeCache(
        {
          provider: provider.name,
          south: opts.south,
          north: opts.north,
          west: opts.west,
          east: opts.east,
          targetCols: opts.targetCols,
          targetRows: opts.targetRows,
        },
        grid
      )
      log(`fetched fresh: ${provider.name} (${tag})`)
      return grid
    } catch (err) {
      lastError = err as Error
      log(`${tag} provider ${provider.name} failed: ${(err as Error).message}`)
    }
  }
  throw lastError ?? new Error('all providers failed without an error')
}

async function fetchWithRetry(
  provider: ElevationProvider,
  opts: Pick<FetchOptions, 'south' | 'north' | 'west' | 'east' | 'targetCols' | 'targetRows'>,
  log: (line: string) => void,
  tag: string
): Promise<ElevationGrid> {
  let attempt = 0
  while (true) {
    try {
      return await provider.fetch(opts)
    } catch (err) {
      if (!(err instanceof ProviderError) || !err.retryable || attempt >= MAX_RETRIES) throw err
      const delay = BACKOFF_BASE_MS * 2 ** attempt
      log(`${tag} retry ${attempt + 1}/${MAX_RETRIES} after ${delay}ms: ${err.message}`)
      await new Promise((r) => setTimeout(r, delay))
      attempt++
    }
  }
}

export function pickProviderFromEnv(env: NodeJS.ProcessEnv): {
  primary: ElevationProvider
  fallback?: ElevationProvider
  allowNetwork: boolean
} {
  // Lazy imports to keep type-only entry surface clean.
  const allowNetwork = env.ELEVATION_ALLOW_NETWORK === '1'
  const apiKey = env.OPENTOPO_API_KEY ?? ''

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const OpenTopo = require('./providers/opentopography').OpenTopographyProvider as {
    new (k: string): ElevationProvider
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const OpenElev = require('./providers/open-elevation').OpenElevationProvider as {
    new (): ElevationProvider
  }
  if (apiKey) {
    return { primary: new OpenTopo(apiKey), fallback: new OpenElev(), allowNetwork }
  }
  return { primary: new OpenElev(), allowNetwork }
}

export type { ProviderName }
