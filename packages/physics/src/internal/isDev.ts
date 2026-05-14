let isDev = false

export function setIsDev(value: boolean): void {
  isDev = value
}

export function isDevFlag(): boolean {
  return isDev
}
