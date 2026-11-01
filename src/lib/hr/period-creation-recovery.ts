import { readHrPeriodCreationRecoveryCandidates, parseHrPeriodCreationRecoveryResult, type PeriodCreationResult } from './use-evaluation-period-creation'

type Record = ReturnType<typeof readHrPeriodCreationRecoveryCandidates>[number]
export type HrPeriodRecoveryItem = { operationId: string; fingerprint: string; records: Record[] }
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
/** Never chooses one conflicting operation automatically or erases an unverified identity. */
export function readHrPeriodRecoveryItems(actor: string, organizationId: string): HrPeriodRecoveryItem[] {
  const rows = readHrPeriodCreationRecoveryCandidates(actor, organizationId), groups = new Map<string, HrPeriodRecoveryItem>()
  for (const row of rows) {
    const identity = JSON.stringify([row.intent.operationId, row.intent.fingerprint])
    const item = groups.get(identity) ?? { operationId: row.intent.operationId, fingerprint: row.intent.fingerprint, records: [] }
    item.records.push(row); groups.set(identity, item)
  }
  return [...groups.values()].sort((a, b) => a.operationId.localeCompare(b.operationId) || a.fingerprint.localeCompare(b.fingerprint))
}
async function readRecoveryResponse(url: string, init: RequestInit, parent: AbortSignal, transport: typeof fetch) {
  const controller = new AbortController()
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  const cancel = () => { controller.abort(); void reader?.cancel().catch(() => {}) }
  parent.addEventListener('abort', cancel, { once: true })
  if (parent.aborted) cancel()
  const timer = setTimeout(cancel, 35000)
  let rejectAbort: (() => void) | undefined
  try {
    const stopped = new Promise<never>((_, reject) => { rejectAbort = () => reject(Error('操作結果を確認できませんでした。記録は保持しています。')); controller.signal.addEventListener('abort', rejectAbort, { once: true }); if (controller.signal.aborted) rejectAbort() })
    return await Promise.race([stopped, (async () => {
      if (controller.signal.aborted) throw Error('操作が中断されました。')
      const response = await transport(url, { ...init, signal: controller.signal, cache: 'no-store' })
      if (controller.signal.aborted) { void response.body?.cancel().catch(() => {}); throw Error('操作が中断されました。') }
      if (response.status !== 200) { void response.body?.cancel().catch(() => {}); return { status: response.status, data: null } }
      if (!response.body || Number(response.headers.get('content-length')) > 65536) throw Error('応答を確認できませんでした。')
      reader = response.body.getReader(); const decoder = new TextDecoder('utf-8', { fatal: true }); let bytes = 0, text = ''
      while (true) { const chunk = await reader.read(); if (controller.signal.aborted) throw Error('操作が中断されました。'); if (chunk.done) break; bytes += chunk.value.byteLength; if (bytes > 65536) throw Error('応答を確認できませんでした。'); text += decoder.decode(chunk.value, { stream: true }) }
      text += decoder.decode(); return { status: response.status, data: JSON.parse(text) as unknown }
    })()])
  } finally { clearTimeout(timer); parent.removeEventListener('abort', cancel); if (rejectAbort) controller.signal.removeEventListener('abort', rejectAbort); void reader?.cancel().catch(() => {}) }
}
function currentItem(actor: string, organizationId: string, item: HrPeriodRecoveryItem) {
  return readHrPeriodRecoveryItems(actor, organizationId).find(row => row.operationId === item.operationId && row.fingerprint === item.fingerprint)
}
export function createHrPeriodRecoverySession(actor: string, organizationId: string, request: typeof fetch, isCurrent: () => boolean) {
  const lifetime = new AbortController()
  let accepted: { item: HrPeriodRecoveryItem; result: PeriodCreationResult } | null = null, busy = false
  const current = () => !lifetime.signal.aborted && isCurrent()
  const check = (item: HrPeriodRecoveryItem) => {
    if (!current() || !same(currentItem(actor, organizationId, item), item)) throw Error('操作記録または組織が変更されました。結果を確認し直してください。')
  }
  const inspect = async (item: HrPeriodRecoveryItem, cancel = false) => {
    if (busy) throw Error('操作結果を確認しています。')
    check(item)
    if (cancel && (!accepted || !same(accepted.item, item) || accepted.result.state !== 'not_received')) throw Error('受付状態を確認してから未受付の操作を終了してください。')
    busy = true; accepted = null
    try {
      const response = await readRecoveryResponse('/api/hr/evaluations/periods?format=creation-operation&operationId=' + encodeURIComponent(item.operationId) + '&organizationId=' + encodeURIComponent(organizationId),
        { method: cancel ? 'DELETE' : 'GET', headers: { 'X-HR-Organization-Id': organizationId } }, lifetime.signal, request)
      check(item)
      if (response.status !== 200) throw Error(response.status === 401 ? 'ログインし直してから確認してください。操作記録は保持しています。' : response.status === 403 ? '組織または権限を確認できません。操作記録は保持しています。' : '作成結果を確認できませんでした。操作記録は保持しています。')
      const result = parseHrPeriodCreationRecoveryResult(response.data, item.records[0].intent)
      accepted = { item, result }; return result
    } finally { busy = false }
  }
  const acknowledge = async (item: HrPeriodRecoveryItem) => {
    if (busy || !accepted || !same(accepted.item, item) || accepted.result.state === 'not_received') throw Error('この操作の結果を確認してから記録を整理してください。')
    check(item)
    if (!window.navigator.locks) throw Error('ブラウザの操作保護機能を確認してください。記録は保持しています。')
    busy = true
    try {
      return await window.navigator.locks.request('hr-period-create-intent:v1:' + JSON.stringify([actor, organizationId]), { signal: lifetime.signal }, () => {
        check(item)
        if (!accepted || !same(accepted.item, item) || accepted.result.state === 'not_received') throw Error('操作結果を確認し直してください。')
        for (const row of item.records) window.localStorage.removeItem(row.key)
        if (currentItem(actor, organizationId, item)) throw Error('操作記録を整理できませんでした。残った記録を確認してください。')
        accepted = null; return true
      })
    } finally { busy = false }
  }
  return { inspect, acknowledge, invalidate: () => { accepted = null }, dispose: () => { accepted = null; lifetime.abort() } }
}
