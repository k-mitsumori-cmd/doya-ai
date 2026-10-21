/** Evidence inventory only. This module neither reads production state nor authorizes a cutover marker. */
export type CheckoutCutoverReadinessInput = {
  version: 1
  deploymentSourceDigest: string | null
  buildSourceDigest: string | null
  mode: 'test' | 'live' | null
  dbBindingDigest: string | null
  stoppedEntrypoints: { id: string; stoppedAt: string; evidenceDigest: string }[] | null
  stoppedWorkers: { id: string; stoppedAt: string; evidenceDigest: string }[] | null
  workerInventoryDigest: string | null
  inFlightReconciliation: { operationDigest: string; disposition: 'reconciled' | 'unresolved' | 'unknown'; evidenceDigest: string }[] | null
  inFlightReconciliationDigest: string | null
  unresolvedInFlight: number | null
  unresolvedLegacy: {
    absent_unproven_drain: number
    creating_needs_review: number
    ready_needs_exact_provider: number
    malformed_needs_review: number
  } | null
  legacyReconciliationDigest: string | null
  evidenceDigest: string | null
}

export type CheckoutCutoverExpectation = {
  sourceDigest: string | null
  mode: 'test' | 'live' | null
  dbBindingDigest: string | null
  requiredEntrypoints: readonly string[]
  requiredWorkers: readonly string[] | null
}

const digest = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
const instant = (value: unknown): value is string => typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) && Number.isFinite(Date.parse(value))
const classifications = ['absent_unproven_drain', 'creating_needs_review', 'ready_needs_exact_provider', 'malformed_needs_review'] as const

/** "reviewable" means fields are present; it does not claim operational drain or provider reconciliation occurred. */
export function inspectCheckoutCutoverReadiness(input: CheckoutCutoverReadinessInput | null,
  expected: CheckoutCutoverExpectation): { status: 'incomplete' | 'reviewable'; cutoverVerified: false; unknown: string[]; contradictions: string[] } {
  const unknown: string[] = [], contradictions: string[] = []
  if (!input || input.version !== 1) return { status: 'incomplete', cutoverVerified: false, unknown: ['readiness_input'], contradictions }
  if (!digest(expected.sourceDigest)) unknown.push('expected_source_digest')
  if (!digest(input.deploymentSourceDigest)) unknown.push('deployment_source_digest')
  if (!digest(input.buildSourceDigest)) unknown.push('build_source_digest')
  if (digest(expected.sourceDigest) && digest(input.deploymentSourceDigest) && expected.sourceDigest !== input.deploymentSourceDigest) contradictions.push('deployment_source_mismatch')
  if (digest(input.deploymentSourceDigest) && digest(input.buildSourceDigest) && input.deploymentSourceDigest !== input.buildSourceDigest) contradictions.push('build_source_mismatch')
  if (!expected.mode) unknown.push('expected_mode')
  if (!input.mode) unknown.push('mode')
  if (expected.mode && input.mode && expected.mode !== input.mode) contradictions.push('mode_mismatch')
  if (!digest(expected.dbBindingDigest)) unknown.push('expected_db_binding_digest')
  if (!digest(input.dbBindingDigest)) unknown.push('db_binding_digest')
  if (digest(expected.dbBindingDigest) && digest(input.dbBindingDigest) && expected.dbBindingDigest !== input.dbBindingDigest) contradictions.push('db_binding_mismatch')
  if (!['generic_v1', 'hr_v1'].every(id => expected.requiredEntrypoints.includes(id))) unknown.push('required_entrypoints')
  const inspectStops = (field: 'stoppedEntrypoints' | 'stoppedWorkers', required: readonly string[] | null) => {
    if (!required) { unknown.push('required_workers'); return }
    const rows = input[field]
    if (!Array.isArray(rows)) { unknown.push(field); return }
    const names = rows.map(row => row?.id)
    if (new Set(names).size !== names.length) contradictions.push(`${field}_duplicate`)
    for (const id of required) {
      const row = rows.find(item => item?.id === id)
      if (!row || !instant(row.stoppedAt) || !digest(row.evidenceDigest)) unknown.push(`${field}:${id}`)
    }
  }
  inspectStops('stoppedEntrypoints', expected.requiredEntrypoints)
  inspectStops('stoppedWorkers', expected.requiredWorkers)
  if (!digest(input.workerInventoryDigest)) unknown.push('worker_inventory_digest')
  if (!Array.isArray(input.inFlightReconciliation)) unknown.push('in_flight_reconciliation')
  else {
    const ids = input.inFlightReconciliation.map(row => row?.operationDigest)
    if (new Set(ids).size !== ids.length) contradictions.push('in_flight_duplicate')
    for (const row of input.inFlightReconciliation) {
      if (!digest(row?.operationDigest) || !digest(row?.evidenceDigest) || !['reconciled', 'unresolved', 'unknown'].includes(String(row?.disposition))) unknown.push('in_flight_entry')
      else if (row.disposition === 'unresolved') contradictions.push('in_flight_unresolved')
      else if (row.disposition === 'unknown') unknown.push('in_flight_unknown')
    }
    if (Number.isSafeInteger(input.unresolvedInFlight) && input.unresolvedInFlight !== input.inFlightReconciliation.filter(row => row?.disposition === 'unresolved').length) contradictions.push('in_flight_count_mismatch')
  }
  if (!digest(input.inFlightReconciliationDigest)) unknown.push('in_flight_reconciliation_digest')
  if (input.unresolvedInFlight === null || !Number.isSafeInteger(input.unresolvedInFlight) || input.unresolvedInFlight < 0) unknown.push('unresolved_in_flight')
  else if (input.unresolvedInFlight > 0) contradictions.push('in_flight_unresolved')
  if (!input.unresolvedLegacy) unknown.push('unresolved_legacy')
  else for (const classification of classifications) {
    const count = input.unresolvedLegacy[classification]
    if (!Number.isSafeInteger(count) || count < 0) unknown.push(`unresolved_legacy:${classification}`)
    else if (count > 0) contradictions.push(`unresolved_legacy:${classification}`)
  }
  if (!digest(input.legacyReconciliationDigest)) unknown.push('legacy_reconciliation_digest')
  if (!digest(input.evidenceDigest)) unknown.push('evidence_digest')
  return { status: unknown.length || contradictions.length ? 'incomplete' : 'reviewable', cutoverVerified: false, unknown, contradictions }
}
