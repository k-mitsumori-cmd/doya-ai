'use client'

import { useEffect, useRef, useState } from 'react'
import { useOrgSettingsGuard } from '@/lib/use-org-settings-guard'
import { aioGet, aioSend, AioApiError } from './client'
import { readPrompt, readPromptPage, type AioPromptView } from './prompt-response'

type Pending = { kind: 'add'; operationId: string; text: string; draftRevision: number } | { kind: 'toggle' | 'archive'; prompt: AioPromptView }
type View = { key: string; prompts: AioPromptView[]; nextCursor: string | null; loaded: boolean; canEdit: boolean; error: string; notice: string; quota: AioApiError | null }
const empty = (key: string): View => ({ key, prompts: [], nextCursor: null, loaded: false, canEdit: false, error: '', notice: '', quota: null })

export function useAioPrompts(orgSlug: string) {
  const guard = useOrgSettingsGuard(orgSlug)
  const [view, setView] = useState<View>(() => empty(guard.key))
  const [draft, setDraft] = useState({ identity: guard.identity, text: '' })
  const [, redraw] = useState(0)
  const local = useRef({ identity: guard.identity, text: '', revision: 0, pending: null as Pending | null })
  if (local.current.identity !== guard.identity) local.current = { identity: guard.identity, text: '', revision: 0, pending: null }
  const busyRef = useRef<ReturnType<typeof guard.begin>>(null)
  const busy = !!busyRef.current?.current()
  const current = view.key === guard.key ? view : empty(guard.key)
  const live = useRef(current)
  live.current = current
  const renderedPending = local.current.pending
  const edit = (text: string) => {
    if (!guard.active()) return
    local.current.text = text
    local.current.revision++
    setDraft({ identity: guard.identity, text })
  }
  const start = () => {
    if (busyRef.current?.current()) return null
    const ticket = guard.begin('prompts')
    if (!ticket) return null
    busyRef.current = ticket
    redraw(n => n + 1)
    return ticket
  }
  const finish = (ticket: NonNullable<ReturnType<typeof guard.begin>>) => {
    const active = ticket.current()
    ticket.end()
    if (busyRef.current === ticket) busyRef.current = null
    if (active) redraw(n => n + 1)
  }
  const publish = (ticket: NonNullable<ReturnType<typeof guard.begin>>, change: Partial<View>) => {
    if (ticket.current()) setView(v => ({ ...(v.key === guard.key ? v : empty(guard.key)), ...change, key: guard.key }))
  }
  const failed = (ticket: NonNullable<ReturnType<typeof guard.begin>>, e: unknown, message: string) => {
    if (!ticket.current()) return
    if (e instanceof AioApiError && e.status === 401) {
      guard.rejectAuthentication()
      setView(empty(guard.key))
      return
    }
    publish(ticket, { error: e instanceof AioApiError ? e.message : message })
  }
  const load = async (more = false) => {
    if (more && (!current.loaded || !current.nextCursor || live.current.nextCursor !== current.nextCursor)) return
    const ticket = start()
    if (!ticket) return
    const prior = current, cursor = more ? current.nextCursor : null
    publish(ticket, { error: '' })
    try {
      const page = readPromptPage(await aioGet('/api/aio/prompts?paged=1' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''), orgSlug, { signal: ticket.signal }))
      if (more && (page.prompts.some(p => prior.prompts.some(old => old.id === p.id)) || page.nextCursor === cursor)) throw new Error('一覧が変更されました')
      publish(ticket, { prompts: more ? [...prior.prompts, ...page.prompts] : page.prompts, nextCursor: page.nextCursor, loaded: true, canEdit: page.canEdit, error: '' })
    } catch (e) {
      if (!more) publish(ticket, { prompts: [], nextCursor: null, loaded: false })
      failed(ticket, e, '一覧を確認できませんでした。先頭から再読み込みしてください')
    } finally { finish(ticket) }
  }
  useEffect(() => {
    if (guard.allowed) void load()
    // The guard aborts previous epoch tickets; pending writes survive same-actor
    // authentication refresh and remain explicitly recoverable.
  }, [guard.key]) // eslint-disable-line react-hooks/exhaustive-deps

  const perform = async (pending: Pending) => {
    const ticket = start()
    if (!ticket) return
    local.current.pending = pending
    publish(ticket, { error: '', notice: '', quota: null })
    try {
      if (pending.kind === 'add') {
        const d = await aioSend<{ prompt: unknown; operationId: string }>('/api/aio/prompts', orgSlug, 'POST', { text: pending.text, operationId: pending.operationId }, { signal: ticket.signal })
        const p = readPrompt(d.prompt)
        if (d.operationId !== pending.operationId || p.text !== pending.text || p.archivedAt !== null) throw new Error('追加結果を確認できませんでした')
        if (!ticket.current()) return
        if (local.current.revision === pending.draftRevision && local.current.text.trim() === pending.text) edit('')
        publish(ticket, { notice: '質問の追加を確認しました' })
      } else {
        const p = pending.prompt
        const d = await aioSend<{ prompt?: unknown }>(`/api/aio/prompts/${p.id}`, orgSlug, pending.kind === 'archive' ? 'DELETE' : 'PATCH', { expectedUpdatedAt: p.updatedAt, ...(pending.kind === 'toggle' ? { isActive: !p.isActive } : {}) }, { signal: ticket.signal })
        if (pending.kind === 'toggle') {
          const updated = readPrompt(d.prompt)
          if (updated.id !== p.id || updated.archivedAt !== null || updated.isActive === p.isActive || updated.updatedAt <= p.updatedAt) throw new Error('変更結果を確認できませんでした')
        }
        publish(ticket, { notice: pending.kind === 'archive' ? '質問の保管を確認しました。過去の測定履歴は残ります' : '質問の有効・無効の変更を確認しました' })
      }
      if (!ticket.current()) return
      local.current.pending = null
      try {
        const page = readPromptPage(await aioGet('/api/aio/prompts?paged=1', orgSlug, { signal: ticket.signal }))
        publish(ticket, { ...page, loaded: true })
      } catch (e) {
        publish(ticket, { prompts: [], nextCursor: null, loaded: false })
        failed(ticket, e, '変更は確認できましたが、一覧を更新できませんでした。再読み込みしてください')
      }
    } catch (e) {
      if (!ticket.current()) return
      const definitive = e instanceof AioApiError && e.status >= 400 && e.status < 500
      if (definitive) {
        local.current.pending = null
        if ([403, 404, 409].includes(e.status)) publish(ticket, { prompts: [], nextCursor: null, loaded: false, canEdit: false })
      }
      if (e instanceof AioApiError && e.code === 'LIMIT') publish(ticket, { quota: e, error: '' })
      else failed(ticket, e, '処理結果を確認できませんでした。「操作結果を確認」から確認してください')
    } finally { finish(ticket) }
  }
  const add = () => {
    if (local.current.pending || busyRef.current?.current() || !guard.active() || !live.current.canEdit) return
    const text = local.current.text.trim()
    if (!text || text.length > 500) { setView(v => ({ ...v, error: '質問は1〜500文字で入力してください' })); return }
    let operationId: string
    try { operationId = crypto.randomUUID() } catch { setView(v => ({ ...v, error: '操作情報を作成できません。ブラウザを更新してください' })); return }
    void perform({ kind: 'add', text, operationId, draftRevision: local.current.revision })
  }
  const change = (p: AioPromptView, kind: 'toggle' | 'archive') => {
    if (local.current.pending || busyRef.current?.current() || !guard.active() || !live.current.loaded || !live.current.canEdit || !live.current.prompts.some(row => row.id === p.id && row.updatedAt === p.updatedAt)) return
    if (kind === 'archive' && !confirm('この質問を保管しますか？過去の測定履歴は残り、監視対象から外れます。')) return
    void perform({ kind, prompt: p })
  }
  const recover = async () => {
    const pending = local.current.pending
    if (!pending || pending !== renderedPending) return
    const ticket = start()
    if (!ticket) return
    publish(ticket, { error: '', notice: '' })
    try {
      const query = pending.kind === 'add' ? 'operationId=' + encodeURIComponent(pending.operationId) : 'promptId=' + encodeURIComponent(pending.prompt.id)
      const d = await aioGet<{ prompt: unknown; operationId?: string }>('/api/aio/prompts?' + query, orgSlug, { signal: ticket.signal })
      if (pending.kind === 'add' && d.operationId !== pending.operationId) throw new Error('操作情報を確認できませんでした')
      const p = d.prompt === null ? null : readPrompt(d.prompt)
      if (!ticket.current()) return
      if (pending.kind === 'add' && !p || pending.kind !== 'add' && p && p.updatedAt === pending.prompt.updatedAt && p.archivedAt === null) {
        publish(ticket, { notice: '操作の反映はまだ確認できません。同じ操作を再確認・再送できます。新しい操作は結果を確認してから行ってください' })
      } else {
        if (pending.kind !== 'add' && p && p.id !== pending.prompt.id) throw new Error('対象を確認できませんでした')
        // Report the observed current state, not ownership of another actor's write.
        if (pending.kind === 'add' && p && p.text === pending.text && p.archivedAt === null && local.current.revision === pending.draftRevision) edit('')
        local.current.pending = null
        publish(ticket, { notice: p?.archivedAt ? '質問が保管済みであることを確認しました' : p ? '質問の現在の内容を確認しました。一覧をご確認ください' : '質問が現在の組織に存在しないことを確認しました' })
      }
      const page = readPromptPage(await aioGet('/api/aio/prompts?paged=1', orgSlug, { signal: ticket.signal }))
      publish(ticket, { ...page, loaded: true })
    } catch (e) { failed(ticket, e, '操作結果を確認できませんでした。時間を置いて再確認してください') }
    finally { finish(ticket) }
  }
  const retry = () => { const pending = local.current.pending; if (pending && pending === renderedPending && guard.active()) void perform(pending) }
  return { ...current, text: draft.identity === guard.identity ? draft.text : '', edit, add, toggle: (p: AioPromptView) => change(p, 'toggle'), archive: (p: AioPromptView) => change(p, 'archive'), load: () => load(), more: () => load(true), busy, pending: local.current.pending !== null, recover, retry, requiresLogin: guard.requiresLogin, allowed: guard.allowed }
}
