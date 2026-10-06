'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { getSelectedOrg, orgStorageKey } from '@/components/org/OrgSwitcher'
import { QuoteWorkspaceContext } from '@/lib/quote/workspace-context'
import { parseQuoteOrganizations } from '@/lib/quote/organization-response'
import { requestOrgJson, orgErrorMessage } from '@/lib/org-client-response'
import { QUOTE_ISSUER_FIELDS, normalizeQuoteIssuer, isQuoteIssuerAcknowledgement, type QuoteIssuerInput } from '@/lib/quote/issuer-input'

type Form = Record<string, string>
export function useQuoteIssuerSettings() {
  const { data: session, status } = useSession()
  const lastActor = useRef('')
  if (status === 'authenticated') lastActor.current = session?.user?.id || ''
  if (status === 'unauthenticated') lastActor.current = ''
  const actor = status === 'loading' ? lastActor.current : session?.user?.id || ''
  const selection = getSelectedOrg('quote')
  const contextRef = useRef<QuoteWorkspaceContext | null>(null)
  if (!contextRef.current) contextRef.current = new QuoteWorkspaceContext(() => getSelectedOrg('quote'))
  const context = contextRef.current
  const epoch = context.update({ actor, selection, status })
  const identity = JSON.stringify([actor, selection])
  const liveIdentity = useRef(identity)
  const draft = useRef<Form>({})
  const dirty = useRef(false)
  const draftOrganization = useRef<string | null>(null)
  const pending = useRef<QuoteIssuerInput | null>(null)
  if (liveIdentity.current !== identity) {
    liveIdentity.current = identity
    draft.current = {}; dirty.current = false; pending.current = null; draftOrganization.current = null
  }
  const [, redraw] = useState(0)
  const [ready, setReady] = useState<{ epoch: number; role: string; slug: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const changed = useCallback(() => { context.invalidate(); redraw(n => n + 1) }, [context])
  useEffect(() => {
    const storage = (e: StorageEvent) => { if (e.key === null || e.key === orgStorageKey('quote')) changed() }
    window.addEventListener('quote:organization-changed', changed)
    window.addEventListener('storage', storage)
    // StrictMode re-mount also needs a fresh epoch after cleanup invalidates requests.
    redraw(n => n + 1)
    return () => {
      window.removeEventListener('quote:organization-changed', changed)
      window.removeEventListener('storage', storage)
      context.invalidate()
    }
  }, [changed, context])

  const load = useCallback(async () => {
    const ticket = context.begin('issuer-read', true, epoch)
    if (!ticket) return
    setLoading(true); setReady(null); setError(''); setMessage(''); setSaving(false)
    try {
      const orgs = await requestOrgJson('quote', '/api/quote/organizations', selection, { signal: ticket.signal })
      if (!ticket.current()) return
      if (!orgs.res.ok) throw new Error(orgErrorMessage(orgs.data, orgs.res.status, false))
      const org = parseQuoteOrganizations(orgs.data).current
      if (!org || !context.verifyOrganization(epoch, org.slug)) throw new Error('組織の所属を確認できませんでした')
      if (draftOrganization.current !== null && draftOrganization.current !== org.slug) {
        draft.current = {}; dirty.current = false; pending.current = null
      }
      draftOrganization.current = org.slug
      const { res, data } = await requestOrgJson('quote', '/api/quote/issuer', org.slug, { signal: ticket.signal })
      if (!ticket.current()) return
      if (!res.ok) throw new Error(orgErrorMessage(data, res.status, false))
      if (data.error !== undefined || data.code !== undefined || !Object.prototype.hasOwnProperty.call(data, 'issuer')) throw new Error('発行者情報を確認できませんでした')
      const issuer = data.issuer
      const form: Form = {}
      if (issuer !== null && (!issuer || typeof issuer !== 'object' || Array.isArray(issuer) || typeof (issuer as Record<string, unknown>).companyName !== 'string')) throw new Error('発行者情報を確認できませんでした')
      for (const field of QUOTE_ISSUER_FIELDS) {
        const value = (issuer as Record<string, unknown> | null)?.[field]
        if (value != null && typeof value !== 'string') throw new Error('発行者情報を確認できませんでした')
        form[field] = typeof value === 'string' ? value : ''
      }
      if (pending.current && isQuoteIssuerAcknowledgement(issuer, pending.current)) {
        pending.current = null
        setMessage('保存済みの発行者情報を確認しました')
      }
      if (!dirty.current) draft.current = form
      setReady({ epoch, role: org.role, slug: org.slug })
    } catch (e) {
      if (ticket.current()) setError(e instanceof Error ? e.message : '読み込みに失敗しました')
    } finally {
      if (ticket.current()) setLoading(false)
      ticket.end()
    }
  }, [context, epoch, selection])
  useEffect(() => { void load() }, [load])

  const save = async () => {
    if (!ready || ready.epoch !== epoch || !['owner', 'admin'].includes(ready.role) || pending.current) return
    const ticket = context.begin('issuer-save', false, epoch)
    if (!ticket) return
    let sent: QuoteIssuerInput
    try { sent = normalizeQuoteIssuer(draft.current) }
    catch (e) { ticket.end(); setError(e instanceof Error ? e.message : '入力内容を確認してください'); return }
    pending.current = sent // Synchronous lock survives auth refresh and unknown responses.
    setSaving(true); setError(''); setMessage('')
    try {
      const { res, data } = await requestOrgJson('quote', '/api/quote/issuer', ticket.organization, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sent), signal: ticket.signal,
      })
      if (!ticket.current()) return
      if (!res.ok) {
        if (res.status < 500) pending.current = null
        throw new Error(orgErrorMessage(data, res.status, true))
      }
      if (data.error !== undefined || data.code !== undefined || !isQuoteIssuerAcknowledgement(data.issuer, sent)) throw new Error('保存結果を確認できませんでした。再読み込みして保存済みの情報を確認してください。')
      pending.current = null
      // A successful response never replaces newer user input.
      if (QUOTE_ISSUER_FIELDS.every(f => (draft.current[f] || '') === (sent[f] || ''))) dirty.current = false
      setMessage('保存しました')
    } catch (e) {
      if (ticket.current()) setError(e instanceof Error ? e.message : '保存結果を確認できませんでした')
    } finally {
      if (ticket.current()) setSaving(false)
      ticket.end()
    }
  }
  const loaded = ready?.epoch === epoch && context.isCurrent(epoch)
  return {
    form: draft.current, loading: status === 'loading' || status === 'authenticated' && loading && !loaded,
    loaded, saving, error: status === 'unauthenticated' ? 'ログインして設定をご確認ください。' : error, message, unknown: !!pending.current && !saving,
    canEdit: loaded && !!ready && ['owner', 'admin'].includes(ready.role),
    scopeKey: JSON.stringify([actor, ready?.slug, epoch]),
    update: (field: string, value: string) => {
      if (!loaded || !ready || !['owner', 'admin'].includes(ready.role) || !context.isCurrent(epoch)) return
      draft.current = { ...draft.current, [field]: value }; dirty.current = true; redraw(n => n + 1)
    }, load, save,
  }
}
