export function encodeBannerHistoryCursor(row: { id: string; createdAt: Date }, userId: string): string {
  return Buffer.from(JSON.stringify({ v: 1, userId, id: row.id, at: row.createdAt.toISOString() })).toString('base64url')
}

export function decodeBannerHistoryCursor(value: string, userId: string): { id: string; createdAt: Date } {
  if (!value || value.length > 512 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid cursor')
  const data = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
  if (!data || data.v !== 1 || data.userId !== userId || typeof data.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(data.id) || typeof data.at !== 'string') throw new Error('Invalid cursor')
  const createdAt = new Date(data.at)
  if (!Number.isFinite(createdAt.getTime()) || createdAt.toISOString() !== data.at) throw new Error('Invalid cursor')
  return { id: data.id, createdAt }
}
