/** Selection is a request hint. A live membership lookup is always required. */
export type HrOrganizationSelection = { kind: 'default' } | { kind: 'selected'; organizationId: string } | { kind: 'invalid' }
export const HR_SELECTED_ORGANIZATION_HEADER = 'X-HR-Selected-Organization'
export const HR_SELECTED_ACTOR_HEADER = 'X-HR-Selected-Actor'
export function parseHrOrganizationSelection(headers: Pick<Headers, 'get'>, actor: string): HrOrganizationSelection {
  const organizationId = headers.get(HR_SELECTED_ORGANIZATION_HEADER)
  const selectedActor = headers.get(HR_SELECTED_ACTOR_HEADER)
  if (organizationId === null && selectedActor === null) return { kind: 'default' }
  const identity = (value: string | null): value is string => value !== null && value.length > 0 && value.length <= 512 && !/[\s\u0000-\u001f\u007f]/.test(value)
  if (!identity(organizationId) || !identity(selectedActor) || selectedActor !== actor) return { kind: 'invalid' }
  const expected = headers.get('X-HR-Organization-Id')
  if (expected !== null && expected !== organizationId) return { kind: 'invalid' }
  return { kind: 'selected', organizationId }
}
