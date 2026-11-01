/** CSV contains organization-wide records and is limited to administrators. */
export function canExportSfaCsv(role: unknown): boolean {
  return role === 'admin' || role === 'owner'
}
