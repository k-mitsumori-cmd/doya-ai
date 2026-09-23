type StorageAccess = Pick<Storage, 'getItem' | 'setItem'>
export type PersonaRecord = {
  id: string
  serverStored?: boolean
  data: unknown
  url: string
  timestamp: number
  portrait?: string
  sceneImages?: Record<string, string>
}
const LAST = 'doya_persona_last'
const HISTORY = 'doya_persona_history'

/** This marker chooses a fresh authenticated read; it never grants access. */
export function savedPersonaPath(record: { id?: unknown; serverStored?: unknown }): string | null {
  return record.serverStored === true && typeof record.id === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(record.id)
    ? `/persona/projects/${record.id}` : null
}

type RecordIdentity = { id?: string; data: unknown; url: string; timestamp: number }
function sameRecord(a: RecordIdentity | null, b: RecordIdentity) {
  if (!a) return false
  if (a.id || b.id) return Boolean(a.id && b.id && a.id === b.id)
  return a.timestamp === b.timestamp && a.url === b.url && JSON.stringify(a.data) === JSON.stringify(b.data)
}

export function deletePersonaRecord(storage: StorageAccess & Pick<Storage, 'removeItem'>, record: RecordIdentity) {
  const rows = readHistory(storage)
  const last = JSON.parse(storage.getItem(LAST) || 'null')
  // Remove the restored copy first so a failed second write cannot hide a retained last record.
  if (sameRecord(last, record)) storage.removeItem(LAST)
  storage.setItem(HISTORY, JSON.stringify(rows.filter(row => !sameRecord(row, record))))
}

export function clearPersonaRecords(storage: Pick<Storage, 'removeItem'>) {
  storage.removeItem(LAST)
  storage.removeItem(HISTORY)
}

export function selectPersonaRecord(storage: StorageAccess, record: RecordIdentity) {
  const current = readHistory(storage).find(row => sameRecord(row, record))
  if (!current) throw new Error('Persona history was deleted')
  storage.setItem(LAST, JSON.stringify(current))
}

function readHistory(storage: StorageAccess): PersonaRecord[] {
  const rows = JSON.parse(storage.getItem(HISTORY) || '[]')
  if (!Array.isArray(rows)) throw new Error('Invalid persona history')
  return rows
}

export function savePersonaRecord(storage: StorageAccess, record: PersonaRecord) {
  const rows = readHistory(storage)
  storage.setItem(HISTORY, JSON.stringify([record, ...rows.filter(row => row?.id !== record.id)].slice(0, 20)))
  storage.setItem(LAST, JSON.stringify(record))
}

/** Update only the exact saved revision. Never recreate a deleted history entry. */
export function savePersonaImage(storage: StorageAccess, id: string | null, data: unknown, patch: { portrait?: string; sceneImages?: Record<string, string> }) {
  if (!id) return false
  const matches = (row: PersonaRecord | null) => row?.id === id && JSON.stringify(row.data) === JSON.stringify(data)
  const merge = (row: PersonaRecord) => ({ ...row, ...patch, sceneImages: { ...row.sceneImages, ...patch.sceneImages } })
  const rows = readHistory(storage)
  let updated = false
  const next = rows.map(row => {
    if (!matches(row)) return row
    updated = true
    return merge(row)
  })
  if (updated) storage.setItem(HISTORY, JSON.stringify(next))
  const last = JSON.parse(storage.getItem(LAST) || 'null')
  if (matches(last)) {
    storage.setItem(LAST, JSON.stringify(merge(last)))
    updated = true
  }
  return updated
}
