function detectDev(): boolean {
  try {
    const metaEnv = (import.meta as unknown as { env?: { DEV?: boolean } }).env
    if (metaEnv?.DEV !== undefined) return metaEnv.DEV
  } catch {
    /* import.meta.env may not exist in non-Vite runtimes */
  }
  if (typeof process !== 'undefined' && process.env?.NODE_ENV !== undefined) {
    return process.env.NODE_ENV !== 'production'
  }
  return false
}

export const IS_DEV = detectDev()
