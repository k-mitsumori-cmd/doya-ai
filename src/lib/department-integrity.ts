/** 親部署の所属を確認し、自分自身・子孫・既存の循環へ接続しない。 */
export async function validDepartmentParent(
  departmentId: string | undefined,
  parentId: string,
  findInOrganization: (id: string) => Promise<{ id: string; parentId: string | null } | null>,
): Promise<boolean> {
  const seen = new Set<string>(departmentId ? [departmentId] : [])
  let current: string | null = parentId
  while (current) {
    if (seen.has(current)) return false
    seen.add(current)
    const row = await findInOrganization(current)
    if (!row) return false
    current = row.parentId
  }
  return true
}
