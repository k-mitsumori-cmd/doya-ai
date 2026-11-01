export interface DepartmentHierarchyRow {
  id: string
  name: string
  code: string | null
  parentId: string | null
  managerId: string | null
  sortOrder: number
  isActive: boolean
  employeeCount: number
}
export interface DepartmentHierarchyNode extends DepartmentHierarchyRow {
  children: DepartmentHierarchyNode[]
}

/** Build every row exactly once, without depending on hierarchy depth or recursive calls. */
export function buildDepartmentHierarchy(rows: readonly DepartmentHierarchyRow[]) {
  const sorted = [...rows].sort((a, b) => a.sortOrder - b.sortOrder)
  const nodes = new Map<string, DepartmentHierarchyNode>()
  for (const row of sorted) {
    if (nodes.has(row.id)) throw Error('Duplicate department identifier')
    nodes.set(row.id, { ...row, children: [] })
  }
  const parents = new Map<string, string | null>()
  const orphanIds: string[] = [], cycleBreakIds: string[] = []
  for (const row of sorted) {
    parents.set(row.id, row.parentId !== null && nodes.has(row.parentId) ? row.parentId : null)
    if (row.parentId !== null && !nodes.has(row.parentId)) orphanIds.push(row.id)
  }
  const finished = new Set<string>()
  for (const row of sorted) {
    const path: string[] = [], positions = new Map<string, number>()
    let id: string | null = row.id
    while (id !== null && !finished.has(id)) {
      const position = positions.get(id)
      if (position !== undefined) {
        // Cut one presentation edge deterministically; original parentId stays in the row.
        let root = path[position]
        for (let index = position + 1; index < path.length; index++) if (path[index] < root) root = path[index]
        parents.set(root, null)
        cycleBreakIds.push(root)
        break
      }
      positions.set(id, path.length)
      path.push(id)
      id = parents.get(id) ?? null
    }
    for (const visited of path) finished.add(visited)
  }
  const departments: DepartmentHierarchyNode[] = []
  for (const row of sorted) {
    const node = nodes.get(row.id)!
    const parent = parents.get(row.id)
    if (parent === null) departments.push(node)
    else nodes.get(parent!)!.children.push(node)
  }
  return { departments, orphanIds, cycleBreakIds }
}

/** Serialize plain JSON data iteratively so a valid deep tree cannot overflow JSON.stringify. */
export function serializeDepartmentJson(value: unknown): string {
  type Work = { kind: 'value'; value: unknown } | { kind: 'text'; text: string } | { kind: 'exit'; value: object }
  const work: Work[] = [{ kind: 'value', value }], text: string[] = [], ancestors = new Set<object>()
  while (work.length) {
    const item = work.pop()!
    if (item.kind === 'text') { text.push(item.text); continue }
    if (item.kind === 'exit') { ancestors.delete(item.value); continue }
    const current = item.value
    if (current === null || typeof current !== 'object') {
      const encoded = JSON.stringify(current)
      if (encoded === undefined) throw Error('Unsupported JSON value')
      text.push(encoded)
      continue
    }
    if (ancestors.has(current)) throw Error('Circular JSON value')
    ancestors.add(current)
    work.push({ kind: 'exit', value: current })
    if (Array.isArray(current)) {
      text.push('[')
      work.push({ kind: 'text', text: ']' })
      for (let index = current.length - 1; index >= 0; index--) {
        work.push({ kind: 'value', value: current[index] === undefined ? null : current[index] })
        if (index > 0) work.push({ kind: 'text', text: ',' })
      }
    } else {
      const entries = Object.entries(current).filter(([, item]) => item !== undefined)
      text.push('{')
      work.push({ kind: 'text', text: '}' })
      for (let index = entries.length - 1; index >= 0; index--) {
        const [key, item] = entries[index]
        work.push({ kind: 'value', value: item })
        work.push({ kind: 'text', text: JSON.stringify(key) + ':' })
        if (index > 0) work.push({ kind: 'text', text: ',' })
      }
    }
  }
  return text.join('')
}
