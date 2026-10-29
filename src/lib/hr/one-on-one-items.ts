type Row = Record<string, unknown>
type Kind = 'agenda' | 'actions'
export type OneOnOneAgendaItem = Row & { id: string; topic: string; category: string }
export type OneOnOneActionItem = Row & { id: string; content: string; assignee: string; dueDate: string; done: boolean }

/** Missing legacy fields and extension fields remain supported; malformed controls do not. */
export function validOneOnOneItems(value: unknown, kind: Kind): boolean {
  if (value == null) return true
  if (!Array.isArray(value)) return false
  return value.every(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false
    const row = item as Row
    if (row.id != null && typeof row.id !== 'string' && !(typeof row.id === 'number' && Number.isFinite(row.id))) return false
    const fields = kind === 'agenda' ? ['topic', 'category'] : ['content', 'assignee', 'dueDate']
    if (fields.some(key => Object.hasOwn(row, key) && typeof row[key] !== 'string')) return false
    return kind !== 'actions' || !Object.hasOwn(row, 'done') || typeof row.done === 'boolean'
  })
}

/** Read-only form DTO: preserve metadata and text, supply stable keys/defaults without DB writes. */
export function oneOnOneFormItems(agenda: unknown, actions: unknown, recordId: string) {
  if (!validOneOnOneItems(agenda, 'agenda') || !validOneOnOneItems(actions, 'actions')) return null
  const normalize = (value: unknown, kind: Kind) => {
    const seen = new Set<string>()
    return ((value ?? []) as Row[]).map((row, index) => {
      const provided = row.id == null ? '' : String(row.id)
      let id = provided || `${recordId}:${kind}:${index}`
      while (seen.has(id)) id += `:${index}`
      seen.add(id)
      return kind === 'agenda'
        ? { ...row, id, topic: row.topic ?? '', category: row.category ?? 'BUSINESS' }
        : { ...row, id, content: row.content ?? '', assignee: row.assignee ?? '', dueDate: row.dueDate ?? '', done: row.done ?? false }
    })
  }
  return {
    agenda: normalize(agenda, 'agenda') as OneOnOneAgendaItem[],
    actionItems: normalize(actions, 'actions') as OneOnOneActionItem[],
  }
}
