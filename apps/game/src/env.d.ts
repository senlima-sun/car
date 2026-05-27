declare module '*.css' {
  const content: string
  export default content
}

interface ImportMetaEnv {
  readonly VITE_AUTH_BASE_URL?: string
  readonly VITE_ASSETS_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface Window {
  __DEV_LOGGER__?: import('./debug/ActionLogger').DevActionLogger
  __DEV_STORES__?: () => Record<string, Record<string, unknown>>
}
