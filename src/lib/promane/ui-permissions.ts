/** Display permissions only; server-side membership checks remain authoritative.
 * Pass the role returned by getWorkspaceBySlug, after the company-role ceiling.
 */
export function canWritePromaneWorkspace(role: unknown): boolean {
  return typeof role === 'string' && ['owner', 'admin', 'member'].includes(role)
}
