export function encodeAioScanCursor(row: { id: string; createdAt: Date }, organizationId: string): string {
  return Buffer.from(JSON.stringify({ v: 1, org: organizationId, id: row.id, at: row.createdAt.toISOString() })).toString('base64url')
}

export function decodeAioScanCursor(value: string, organizationId: string): { id: string; createdAt: Date } {
  if (!value || value.length > 512 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid scan cursor')
  const data = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
  if (!data || data.v !== 1 || data.org !== organizationId || typeof data.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(data.id) || typeof data.at !== 'string') throw new Error('Invalid scan cursor')
  const createdAt = new Date(data.at)
  if (!Number.isFinite(createdAt.getTime()) || createdAt.toISOString() !== data.at) throw new Error('Invalid scan cursor')
  return { id: data.id, createdAt }
}
