declare module '*.css' {
  const content: string
  export default content
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface ImportMetaEnv {
  readonly VITE_PUBLIC_POSTHOG_HOST: string
  readonly VITE_PUBLIC_POSTHOG_KEY: string
  readonly DEV: boolean
  [key: string]: string | boolean | undefined
}

interface Window {
  __DEV_LOGGER__?: import('./debug/ActionLogger').DevActionLogger
  __DEV_STORES__?: () => Record<string, Record<string, unknown>>
}
