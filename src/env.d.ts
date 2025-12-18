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
  [key: string]: string | undefined
}
