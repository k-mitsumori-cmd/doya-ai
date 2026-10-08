export type DepartmentInput = {
  name?: string
  code?: string | null
  parentId?: string | null
  managerId?: string | null
  sortOrder?: number
  isActive?: boolean
}

/** Validate fields before Prisma sees them; retain valid strings and nullable links. */
export async function readDepartmentInput(request: Request, requireName: boolean): Promise<DepartmentInput | null> {
  let body: unknown
  try { body = await request.json() } catch { return null }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const value = body as Record<string, unknown>
  if ((requireName || value.name !== undefined) && (typeof value.name !== 'string' || !value.name.trim())) return null
  for (const key of ['code', 'parentId', 'managerId']) {
    if (value[key] !== undefined && value[key] !== null && typeof value[key] !== 'string') return null
  }
  if (value.sortOrder !== undefined && (typeof value.sortOrder !== 'number' || !Number.isInteger(value.sortOrder) || value.sortOrder < -2147483648 || value.sortOrder > 2147483647)) return null
  if (value.isActive !== undefined && typeof value.isActive !== 'boolean') return null
  return value as DepartmentInput
}
