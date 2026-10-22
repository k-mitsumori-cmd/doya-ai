'use client'
import { useEffect, useLayoutEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { useSession } from 'next-auth/react'
import type { RunDto } from '@/lib/asklink/dto'
import { parseAskLinkCreationRunResponse } from '@/lib/asklink/creation-run-response'
import { readAskLinkCreationResponse } from '@/lib/asklink/creation-request'
import type { AskLinkCreationState } from '@/lib/asklink/creation-operation'
import { askLinkIntentKey, readAskLinkCreationIntent, claimAskLinkCreationIntent, releaseAskLinkCreationIntent, normalizeAskLinkClientInput, askLinkClientFingerprint, readAskLinkCreationDraft, writeAskLinkCreationDraft, parseAskLinkCreationState, type AskLinkCreationIntent, type AskLinkCreationDraft } from '@/lib/asklink/creation-intent-client'

type View = { key: string; ready: boolean; intent: AskLinkCreationIntent | null; operation: AskLinkCreationState | null; draft: AskLinkCreationDraft; busy: boolean; phase: 'create' | 'verify' | 'finish' | 'new' | null; error: string; errorStatus: number | null; authorityRejected: boolean }
type Task = { version: number; controller: AbortController }
const emptyDraft: AskLinkCreationDraft = { url: '', manualText: '', needManual: false }
const empty: View = { key: '', ready: false, intent: null, operation: null, draft: emptyDraft, busy: false, phase: null, error: '', errorStatus: null, authorityRejected: false }
const message = '作成結果を確認できません。自動で再生成せず、保存結果を確認してください。'

function resultFrom(data: unknown, operation: AskLinkCreationState): RunDto {
  if (operation.state !== 'completed' || typeof operation.runId !== 'string') throw Error(message)
  try { return parseAskLinkCreationRunResponse(data, operation.runId) }
  catch { throw Error(message) }
}

export function useAskLinkCreation(setRun: Dispatch<SetStateAction<RunDto | null>>, onFresh: Dispatch<SetStateAction<string | null>>) {
  const { data: session, status } = useSession()
  const actor = typeof (session?.user as { id?: unknown } | undefined)?.id === 'string' ? (session!.user as { id: string }).id : ''
  const scope = JSON.stringify([status, actor]), epoch = useRef({ scope, version: 0 })
  if (epoch.current.scope !== scope) epoch.current = { scope, version: epoch.current.version + 1 }
  const key = JSON.stringify([scope, epoch.current.version]), life = useRef({ version: 0, active: false }), task = useRef<Task | null>(null)
  const intentIdentity = useRef<{ key: string; operationId: string | null }>({ key, operationId: null })
  if (intentIdentity.current.key !== key) intentIdentity.current = { key, operationId: null }
  const [stored, setStored] = useState<View>(empty)
  const view = stored.key === key ? stored : { ...empty, key }
  const alive = (version: number) => status === 'authenticated' && Boolean(actor) && life.current.active && life.current.version === version && JSON.stringify([epoch.current.scope, epoch.current.version]) === key
  const patch = (version: number, values: Partial<View>) => { if (alive(version)) setStored(old => ({ ...(old.key === key ? old : empty), key, ...values })) }
  useLayoutEffect(() => {
    life.current = { active: true, version: life.current.version + 1 }
    return () => { life.current.active = false; task.current?.controller.abort() }
  }, [key])

  const request = async (t: Task, path: string, method: 'POST' | 'GET' | 'DELETE', body?: unknown) => {
    let timer: ReturnType<typeof setTimeout> | undefined, stop = () => {}
    const stopped = new Promise<never>((_, reject) => {
      stop = () => reject(Error(message))
      t.controller.signal.addEventListener('abort', stop, { once: true })
      timer = setTimeout(() => t.controller.abort(), method === 'POST' ? 330_000 : 70_000)
    })
    try {
      return await Promise.race([stopped, (async () => {
        if (!alive(t.version) || t.controller.signal.aborted) throw Error(message)
        const response = await fetch(path, { method, signal: t.controller.signal, cache: 'no-store', credentials: 'same-origin', redirect: 'error', headers: { 'Content-Type': 'application/json', 'X-Asklink-Actor-Id': actor }, ...(body ? { body: JSON.stringify(body) } : {}) })
        if (!alive(t.version) || t.controller.signal.aborted) { void response.body?.cancel().catch(() => {}); throw Error(message) }
        if (response.status === 401 || response.status === 403) { patch(t.version, { authorityRejected: true, errorStatus: response.status }); void response.body?.cancel().catch(() => {}); throw Error('アクセス権を確認できません。ログイン状態を確認してください。') }
        if (!response.ok) patch(t.version, { errorStatus: response.status })
        const data = await readAskLinkCreationResponse(response, t.controller.signal)
        if (data.actor !== actor) throw Error(message)
        if (!alive(t.version) || t.controller.signal.aborted) throw Error(message)
        return { response, data }
      })()])
    } finally { clearTimeout(timer); t.controller.signal.removeEventListener('abort', stop) }
  }

  const execute = async (mode: 'create' | 'verify' | 'finish' | 'new') => {
    const version = life.current.version
    if (!alive(version) || task.current?.version === version || view.authorityRejected) return
    const t: Task = { version, controller: new AbortController() }; task.current = t
    patch(version, { busy: true, phase: mode, error: '', errorStatus: null })
    try {
      let intent = readAskLinkCreationIntent(actor)
      if (mode === 'new') {
        if (!intent || intent.operationId !== view.operation?.operationId || !['completed', 'failed', 'canceled', 'deleted', 'superseded', 'expired'].includes(view.operation.state)) throw Error('前の作成結果を確認してから、新しく作成してください。')
        await releaseAskLinkCreationIntent(actor, intent, t.controller.signal)
        if (!alive(version)) return
        intentIdentity.current = { key, operationId: null }
        setRun(null); onFresh(null)
        patch(version, { intent: null, operation: null })
        return
      }
      let path: string, method: 'POST' | 'GET' | 'DELETE', body: unknown
      if (mode === 'create') {
        if (!view.ready) throw Error(message)
        let input: ReturnType<typeof normalizeAskLinkClientInput>
        try { input = normalizeAskLinkClientInput(view.draft.url, view.draft.needManual ? view.draft.manualText : '') }
        catch (error) { patch(version, { errorStatus: 400 }); throw error }
        const fingerprint = await askLinkClientFingerprint(input)
        if (!alive(version)) return
        const claimed = await claimAskLinkCreationIntent(actor, fingerprint, t.controller.signal)
        intent = claimed.intent
        if (!alive(version)) return
        intentIdentity.current = { key, operationId: intent.operationId }
        patch(version, { intent, operation: null })
        // A previous tab/attempt always takes GET recovery, never another generation POST.
        method = claimed.created ? 'POST' : 'GET'
        if (!claimed.created) patch(version, { phase: 'verify' })
        path = claimed.created ? '/api/asklink/runs' : '/api/asklink/creation-operations/' + intent.operationId
        if (claimed.created) body = { url: input.sourceUrl, manualText: input.manualText, operationId: intent.operationId }
      } else {
        if (!intent) throw Error('保存された操作情報がありません。履歴を確認してください。')
        if (view.intent && view.intent.operationId !== intent.operationId) throw Error('別のタブで操作が変わりました。保存結果を再確認してください。')
        method = mode === 'finish' ? 'DELETE' : 'GET'
        path = '/api/asklink/creation-operations/' + intent.operationId
      }
      const { response, data } = await request(t, path, method, body)
      if (!alive(version) || readAskLinkCreationIntent(actor)?.operationId !== intent.operationId) return
      const operation = parseAskLinkCreationState(data, intent)
      patch(version, { intent, operation })
      if (operation.state === 'completed') {
        if (!response.ok) throw Error('結果は保存されています。新しく作成せず、保存結果を再取得してください。')
        const result = resultFrom(data, operation)
        setRun(result)
        if (method === 'POST' && (data as { autoGenerateBanners?: unknown }).autoGenerateBanners === true) onFresh(result.id)
        window.dispatchEvent(new Event('asklink:generated'))
      } else if (operation.failure === 'WEBSITE_UNREADABLE') {
        const draft = { ...readAskLinkCreationDraft(actor), needManual: true }
        writeAskLinkCreationDraft(actor, draft)
        patch(version, { draft, error: 'サイトを読み取れませんでした。「新しい作成へ進む」を押し、サービスの説明を手入力してください。' })
      } else if (operation.failure === 'GENERATION_FAILED' || operation.failure === 'OPERATION_EXPIRED') {
        patch(version, { error: '作成は完了しませんでした。今回の利用枠は戻っています。新しい作成としてやり直せます。' })
      } else if (operation.state === 'superseded') {
        patch(version, { error: '作成中に保存内容が変更されたため、今回の処理を止めました。残っている結果と利用枠を履歴で確認してください。' })
      } else if (!response.ok && operation.failure !== 'QUOTA_REACHED') throw Error(message)
    } catch (error) {
      patch(version, { error: error instanceof Error ? error.message : message })
      try { patch(version, { intent: readAskLinkCreationIntent(actor) }) } catch { patch(version, { ready: false }) }
    } finally {
      if (task.current === t) task.current = null
      patch(version, { busy: false, phase: null })
      t.controller.abort()
    }
  }

  useEffect(() => {
    const sync = (external = false) => {
      if (!alive(life.current.version)) return
      try {
        const intent = readAskLinkCreationIntent(actor), draft = readAskLinkCreationDraft(actor)
        const operationId = intent?.operationId ?? null
        const identityChanged = intentIdentity.current.operationId !== operationId
        if (external || identityChanged) life.current.version++
        if (identityChanged) intentIdentity.current = { key, operationId }
        const version = life.current.version
        setStored(old => {
          const sameIntent = old.key === key && (old.intent?.operationId ?? null) === operationId
          const keepAuthorityError = old.key === key && old.authorityRejected
          return {
            ...(old.key === key ? old : empty), key, ready: true, intent, draft,
            operation: sameIntent ? old.operation : null,
            ...(sameIntent || keepAuthorityError ? {} : { error: '', errorStatus: null }),
            ...(external || !sameIntent ? { busy: false, phase: null } : {}),
          }
        })
        if (!alive(version)) return
      } catch (error) { patch(life.current.version, { ready: false, error: error instanceof Error ? error.message : message }) }
    }
    sync()
    const changed = (event: StorageEvent) => { if (event.key === null || event.key === askLinkIntentKey(actor)) { task.current?.controller.abort(); onFresh(null); setRun(null); sync(true) } }
    window.addEventListener('storage', changed)
    return () => window.removeEventListener('storage', changed)
    // Scope changes must reset private client state; network recovery is an explicit action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const setDraft = (values: Partial<AskLinkCreationDraft>) => {
    const version = life.current.version
    if (!alive(version) || !view.ready || view.busy || view.intent) return
    try { const draft = { ...readAskLinkCreationDraft(actor), ...values }; writeAskLinkCreationDraft(actor, draft); patch(version, { draft }) }
    catch (error) { patch(version, { ready: false, error: error instanceof Error ? error.message : message }) }
  }
  const quota = view.operation?.failure === 'QUOTA_REACHED' ? view.operation.quota : null
  return { ...view, quota, setDraft, create: () => execute('create'), verify: () => execute('verify'), finish: () => execute('finish'), startNew: () => execute('new') }
}
