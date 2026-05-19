import { computeCacheKey, readCache, writeCache } from './cache'
import type { ElevationGrid, ElevationProvider, ProviderName } from './provider'
import { ProviderError } from './provider'
import { OpenElevationProvider } from './providers/open-elevation'
import { OpenTopographyProvider } from './providers/opentopography'

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
  const cacheKeyFor = (provider: ElevationProvider) => ({
    provider: provider.name,
    south: opts.south,
    north: opts.north,
    west: opts.west,
    east: opts.east,
    targetCols: opts.targetCols,
    targetRows: opts.targetRows,
  })

  const primaryCached = await readCache(cacheKeyFor(opts.primary))
  if (primaryCached) {
    log(`cache hit: ${opts.primary.name} (primary)`)
    return primaryCached
  }

  if (!opts.allowNetwork) {
    throw new ProviderError(
      'no cache available and network access is disabled (set ELEVATION_ALLOW_NETWORK=1 to enable)',
      { retryable: false }
    )
  }

  let lastError: Error | null = null
  try {
    const grid = await fetchWithRetry(opts.primary, opts, log, 'primary')
    await writeCache(cacheKeyFor(opts.primary), grid)
    log(`fetched fresh: ${opts.primary.name} (primary)`)
    return grid
  } catch (err) {
    lastError = err as Error
    log(`primary provider ${opts.primary.name} failed: ${(err as Error).message}`)
  }

  if (opts.fallback) {
    const fallbackCached = await readCache(cacheKeyFor(opts.fallback))
    if (fallbackCached) {
      log(`cache hit: ${opts.fallback.name} (fallback after primary failure)`)
      return fallbackCached
    }
    try {
      const grid = await fetchWithRetry(opts.fallback, opts, log, 'fallback')
      await writeCache(cacheKeyFor(opts.fallback), grid)
      log(`fetched fresh: ${opts.fallback.name} (fallback)`)
      return grid
    } catch (err) {
      lastError = err as Error
      log(`fallback provider ${opts.fallback.name} failed: ${(err as Error).message}`)
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
  const allowNetwork = env.ELEVATION_ALLOW_NETWORK === '1'
  const apiKey = env.OPENTOPO_API_KEY ?? ''
  if (apiKey) {
    return {
      primary: new OpenTopographyProvider(apiKey),
      fallback: new OpenElevationProvider(),
      allowNetwork,
    }
  }
  return { primary: new OpenElevationProvider(), allowNetwork }
}

export type { ProviderName }
