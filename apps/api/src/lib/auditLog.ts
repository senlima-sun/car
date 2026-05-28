export function auditLog(event: string, fields: Record<string, unknown>): void {
  console.log(JSON.stringify({ event, timestamp: new Date().toISOString(), ...fields }))
}
