const BASE = (import.meta.env.VITE_ASSETS_BASE_URL ?? '').replace(/\/$/, '')

export function assetUrl(path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`
  return BASE ? `${BASE}${clean}` : clean
}
