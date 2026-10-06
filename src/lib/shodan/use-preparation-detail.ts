'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useOrgSettingsGuard } from '@/lib/use-org-settings-guard'
import { ShodanApiError, shodanGet, shodanSend } from './client'
import { completeProposal, completeSlideImages, readPreparation, type Preparation } from './preparation-response'

type Kind = 'retry' | 'generate' | 'slides'
type Pending = { kind: Kind; before: string }
type Notice = { message: string; href?: string; label?: string }
const fresh = () => ({ prep: null as Preparation | null, ready: '', loading: '', busy: '' as Kind | '', busyKey: '', error: '', missing: false, notice: null as Notice | null, progress: null as { done: number; total: number } | null, autoAttempted: false })
export function usePreparationDetail(orgSlug: string, id: string) {
  const guard = useOrgSettingsGuard(orgSlug && id ? JSON.stringify([orgSlug, id]) : '')
  const latest = useRef(guard); latest.current = guard
  const identity = useRef(guard.identity), state = useRef(fresh()), pending = useRef<Pending | null>(null)
  if (identity.current !== guard.identity) { identity.current = guard.identity; state.current = fresh(); pending.current = null }
  const [, render] = useState(0), redraw = () => render(n => n + 1)
  const router = useRouter(), key = guard.key
  const current = () => latest.current.key === key && latest.current.active()
  const path = `/api/shodan/preparations/${encodeURIComponent(id)}`
  const load = useCallback(async () => {
    if (latest.current.key !== key || state.current.busyKey === key && state.current.busy) return
    const ticket = latest.current.begin('preparation-read'); if (!ticket) return
    state.current.loading = key; state.current.error = ''; state.current.missing = false; redraw()
    try {
      const data = await shodanGet<unknown>(path, orgSlug, { signal: ticket.signal })
      if (!ticket.current()) return
      const prep = readPreparation(data, id)
      state.current.prep = prep; state.current.ready = key
      const operation = pending.current
      if (operation && (operation.kind === 'generate' && prep.updatedAt !== operation.before && completeProposal(prep) || operation.kind === 'slides' && completeSlideImages(prep))) {
        pending.current = null
        state.current.notice = { message: '保存済みの成果物を確認しました。現在の内容をご確認ください。' }
      }
    } catch (error) {
      if (!ticket.current()) return
      state.current.ready = ''
      state.current.missing = error instanceof ShodanApiError && error.status === 404
      if (error instanceof ShodanApiError && error.status === 401) latest.current.rejectAuthentication()
      state.current.error = error instanceof Error ? error.message : '読み込みに失敗しました。再度読み込んでください。'
    } finally {
      if (ticket.current()) { state.current.loading = ''; redraw() }
      ticket.end()
    }
  }, [key, path, orgSlug, id])
  useEffect(() => { void load() }, [load])
  const loaded = state.current.ready === key && current()
  const prep = loaded ? state.current.prep : null
  const busy = state.current.busyKey === key && current() ? state.current.busy : ''
  useEffect(() => {
    if (!prep || prep.status !== 'processing' || state.current.error || pending.current) return
    const timer = setInterval(() => { void load() }, 5000)
    return () => clearInterval(timer)
  }, [prep, load])
  const mutate = async (kind: Kind) => {
    if (!current() || state.current.ready !== key || state.current.loading === key || !prep || state.current.prep !== prep || pending.current) return
    const snapshot = state.current.prep
    if (kind === 'retry' && snapshot.status !== 'failed' && !(snapshot.status === 'done' && !snapshot.research && !snapshot.analysis && !snapshot.proposalMarkdown)) return
    if (kind === 'generate' && (!snapshot.research || snapshot.status !== 'researched' || snapshot.proposalMarkdown)) return
    if (kind === 'slides' && (snapshot.status !== 'done' || !snapshot.slidesJson?.length)) return
    const ticket = latest.current.begin('preparation-write'); if (!ticket) return
    pending.current = { kind, before: snapshot.updatedAt }
    state.current.busy = kind; state.current.busyKey = key; state.current.error = ''; state.current.notice = null; state.current.progress = null; redraw()
    let acknowledged = false
    try {
      if (kind === 'retry') {
        const result = await shodanSend<{ id: string }>('/api/shodan/preparations', orgSlug, 'POST', { url: snapshot.targetUrl }, { signal: ticket.signal })
        if (!ticket.current()) return
        pending.current = null
        state.current.notice = { message: '再生成を開始しました。' }
        router.replace(`/shodan/${encodeURIComponent(orgSlug)}/p/${encodeURIComponent(result.id)}`)
      } else if (kind === 'generate') {
        await shodanSend(path + '/generate', orgSlug, 'POST', undefined, { signal: ticket.signal })
        acknowledged = true
        if (!ticket.current()) return
        // A successful acknowledgement is separate from a verified, complete saved document.
        const data = await shodanGet<unknown>(path, orgSlug, { signal: ticket.signal })
        if (!ticket.current()) return
        const saved = readPreparation(data, id)
        if (!completeProposal(saved) || saved.updatedAt === snapshot.updatedAt) throw new Error('生成後の保存内容を確認できませんでした。再送せず、保存済みの結果をご確認ください。')
        state.current.prep = saved; state.current.ready = key; pending.current = null
        state.current.notice = { message: '提案資料の保存を確認しました。' }
      } else {
        let previous = -1, stalls = 0, complete = false
        for (let batch = 0; batch < 14; batch++) {
          if (!ticket.current()) return
          const result = await shodanSend<{ count: number; total: number; remaining: number }>(path + '/slides/generate', orgSlug, 'POST', undefined, { signal: ticket.signal })
          if (!ticket.current()) return
          acknowledged = true
          state.current.progress = { done: result.count, total: result.total }; redraw()
          if (result.remaining === 0) { complete = true; break }
          stalls = result.count <= previous ? stalls + 1 : 0; previous = result.count
          if (stalls >= 2) break
        }
        if (!ticket.current()) return
        // Confirm the persisted images, rather than inferring completion from batch acknowledgements.
        const data = await shodanGet<unknown>(path, orgSlug, { signal: ticket.signal })
        if (!ticket.current()) return
        const saved = readPreparation(data, id)
        if (complete && !completeSlideImages(saved)) throw new Error('スライドの保存内容を確認できませんでした。再送せず、結果をご確認ください。')
        state.current.prep = saved; pending.current = null
        state.current.notice = { message: complete ? '保存済みのスライドを確認しました。' : '一部のスライドが未完成です。編集画面で内容をご確認ください。' }
        router.push(`/shodan/${encodeURIComponent(orgSlug)}/p/${encodeURIComponent(id)}/slides`)
      }
    } catch (error) {
      if (!ticket.current()) return
      if (!acknowledged && error instanceof ShodanApiError && error.status >= 400 && error.status < 500 && error.code !== 'GENERATION_PENDING') pending.current = null
      if (error instanceof ShodanApiError && error.status === 401) { state.current.ready = ''; latest.current.rejectAuthentication() }
      state.current.error = error instanceof Error ? error.message : '処理結果を確認できませんでした。'
      if (error instanceof ShodanApiError && (error.code === 'PLAN' || error.code === 'LIMIT')) state.current.notice = { message: error.message, href: error.actionUrl, label: error.actionLabel }
    } finally {
      if (ticket.current()) { state.current.busy = ''; state.current.busyKey = ''; redraw() }
      ticket.end()
    }
  }
  useEffect(() => {
    if (prep?.status !== 'researched' || prep.proposalMarkdown || state.current.autoAttempted || pending.current) return
    state.current.autoAttempted = true
    void mutate('generate')
    // Automatic generation is once per actor/org/document; the mutation synchronously captures the verified snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prep, key])
  const isCurrent = () => current() && !!prep && state.current.prep === prep && state.current.ready === key && state.current.loading !== key && !pending.current && !(state.current.busyKey === key && state.current.busy)
  return { prep, load, busy, unknown: !!pending.current && !busy, canAct: loaded && state.current.loading !== key && !busy && !pending.current, isCurrent,
    requiresLogin: guard.requiresLogin, loading: !guard.allowed || state.current.loading === key,
    error: current() ? state.current.error : '', missing: current() && state.current.missing,
    planNotice: current() ? state.current.notice : null, slidesProgress: current() ? state.current.progress : null,
    retry: () => mutate('retry'), generate: () => mutate('generate'), genSlideImages: () => mutate('slides') }
}
