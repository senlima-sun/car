declare module '*.css' {
  const content: string
  export default content
}

interface Window {
  __DEV_LOGGER__?: import('./debug/ActionLogger').DevActionLogger
  __DEV_STORES__?: () => Record<string, Record<string, unknown>>
}
