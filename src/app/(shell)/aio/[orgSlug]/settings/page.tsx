'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { aioGet, aioSend, AioApiError } from '@/lib/aio/client'
import { useOrgSettingsGuard } from '@/lib/use-org-settings-guard'
import { readOrgProfile } from '@/lib/org-profile-view'
import { PageHeader, sym } from '@/components/aio/ui'
import toast from 'react-hot-toast'
import { AIO_BRAND_TEXT_LIMITS, parseAioBrandProfileInput } from '@/lib/aio/brand-profile-input'

export default function AioSettingsPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>()
  const guard = useOrgSettingsGuard(orgSlug)
  const ready = useRef('')
  const version = useRef<string | null>(null)
  const pendingWrite = useRef(false)
  const lists = useRef({ aliases: { text: '', values: [] as string[] }, competitors: { text: '', values: [] as string[] } })
  const [uncertain, setUncertain] = useState(false)
  const [confirmed, setConfirmed] = useState<{ profile: Record<string, unknown> | null } | null>(null)
  const [notice, setNotice] = useState('')
  const [checking, setChecking] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({ brandName: '', brandUrl: '', aliases: '', competitors: '', category: '', market: '日本' })

  const draft = useRef(form)
  draft.current = form
  const revision = useRef(0)
  const flags = useRef({ loading, loadError, uncertain, checking })
  flags.current = { loading, loadError, uncertain, checking }
  const identity = useRef(guard.identity)
  if (identity.current !== guard.identity) {
    identity.current = guard.identity
    ready.current = ''
    pendingWrite.current = false
  }
  useEffect(() => {
    setSaving(false)
    setChecking(false)
    if (pendingWrite.current) { setUncertain(true); setSaved(false) }
  }, [guard.key])
  useEffect(() => {
    if (!guard.allowed || ready.current === guard.identity) return
    const ticket = guard.begin('load')
    if (!ticket) return
    setLoading(true)
    setLoadError(null)
    setSaved(false)
    setError(null)
    setNotice('')
    setConfirmed(null)
    setUncertain(false)
    aioGet('/api/aio/brand-profile', orgSlug, { signal: ticket.signal })
      .then((d) => {
        if (!ticket.current()) return
        const { profile: p, version: stamp } = readOrgProfile('aio', d)
        setForm({
          brandName: (p?.brandName as string) || '', brandUrl: (p?.brandUrl as string) || '',
          aliases: Array.isArray(p?.aliases) ? p.aliases.join(', ') : '',
          competitors: Array.isArray(p?.competitors) ? p.competitors.join(', ') : '',
          category: (p?.category as string) || '', market: (p?.market as string) ?? '日本',
        })
        for (const key of ['aliases', 'competitors'] as const) { const values = Array.isArray(p?.[key]) ? p[key] as string[] : []; lists.current[key] = { text: values.join(', '), values } }
        version.current = stamp
        ready.current = guard.identity
      })
      .catch((e) => { if (ticket.current()) { setLoadError(e instanceof Error ? e.message : 'ブランド設定を読み込めませんでした'); if (e instanceof AioApiError && e.status === 401) guard.rejectAuthentication() } })
      .finally(() => { if (ticket.current()) setLoading(false); ticket.end() })
    return () => ticket.end()
  }, [guard.key, retryCount]) // eslint-disable-line react-hooks/exhaustive-deps

  const confirmSaved = async () => {
    if (!flags.current.uncertain) return
    const ticket = guard.begin('mutation')
    if (!ticket) return
    setChecking(true)
    try {
      const result = readOrgProfile('aio', await aioGet('/api/aio/brand-profile', orgSlug, { signal: ticket.signal }))
      if (!ticket.current()) return
      version.current = result.version
      setConfirmed({ profile: result.profile })
      pendingWrite.current = false
      setUncertain(false)
      setError(null)
      setSaved(false)
      setNotice('保存済みの設定を再確認しました。入力中の内容は保持しています。確認してから保存してください。')
    } catch (e) { if (ticket.current()) { setError(e instanceof Error ? e.message : '設定を確認できませんでした'); if (e instanceof AioApiError && e.status === 401) guard.rejectAuthentication() } }
    finally { if (ticket.current()) setChecking(false); ticket.end() }
  }

  const save = async () => {
    if (flags.current.loading || flags.current.loadError || ready.current !== guard.identity || flags.current.uncertain || pendingWrite.current || flags.current.checking) return
    const ticket = guard.begin('mutation')
    if (!ticket) return
    const submittedRevision = revision.current
    const submitted = draft.current
    if (!submitted.brandName.trim()) { setError('ブランド名は必須です'); toast.error('ブランド名は必須です'); ticket.end(); return }
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const split = (key: 'aliases' | 'competitors') => submitted[key] === lists.current[key].text ? lists.current[key].values : submitted[key].split(/[,、\n]/).map(x => x.trim()).filter(Boolean)
      const data = parseAioBrandProfileInput({
        brandName: submitted.brandName,
        brandUrl: submitted.brandUrl,
        aliases: split('aliases'),
        competitors: split('competitors'),
        category: submitted.category,
        market: submitted.market,
      })
      pendingWrite.current = true
      const result = await aioSend<{ profile: Record<string, unknown> }>('/api/aio/brand-profile', orgSlug, 'PUT', { ...data, expectedUpdatedAt: version.current }, { signal: ticket.signal })
      if (!ticket.current()) return
      version.current = readOrgProfile('aio', result).version
      pendingWrite.current = false
      for (const key of ['aliases', 'competitors'] as const) lists.current[key] = { text: submitted[key], values: data[key] || [] }
      setNotice('')
      setConfirmed(null)
      if (submittedRevision === revision.current) { toast.success('保存しました'); setSaved(true) }
      else { setSaved(false); setNotice('送信時の内容を保存しました。その後の変更は未保存です。') }
    } catch (e: any) {
      if (!ticket.current()) return
      if (pendingWrite.current) {
        const rejected = e instanceof AioApiError && [400, 401, 403, 404, 409, 413, 422, 429].includes(e.status)
        pendingWrite.current = !rejected
        setUncertain(!rejected || e.status === 409)
      }
      const msg = e?.message || '保存に失敗しました'
      toast.error(msg)
      setError(msg)
      if (e instanceof AioApiError && e.status === 401) guard.rejectAuthentication()
    } finally {
      if (ticket.current()) setSaving(false)
      ticket.end()
    }
  }

  if (guard.requiresLogin) return <div role="alert" className="p-6"><p>ログイン情報を確認できません。再度ログインしてください。</p><a className="mt-3 inline-block font-bold underline" href={`/auth/signin?callbackUrl=${encodeURIComponent(`/aio/${orgSlug}/settings`)}`}>ログイン情報を再確認する</a></div>
  if (!guard.allowed || loading || !loadError && ready.current !== guard.identity) return <div className="p-6 text-slate-400 font-bold">読み込み中…</div>
  if (loadError) return (
    <div className="max-w-2xl mx-auto p-6">
      <PageHeader icon="manage_search" title="ブランド設定" subtitle="追跡する自社ブランドと競合を登録します" />
      <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
        <p className="font-bold">ブランド設定を読み込めませんでした。既存の設定を保護するため、確認できるまで編集できません。</p>
        <p className="mt-2 text-sm">{loadError}</p>
        <button type="button" onClick={() => setRetryCount((count) => count + 1)} className="mt-4 rounded-lg bg-white px-4 py-2 text-sm font-bold text-rose-800 border border-rose-300 hover:bg-rose-100">再試行</button>
      </div>
    </div>
  )

  const field = (label: string, key: keyof typeof form, placeholder: string, hint?: string) => (
    <div>
      <label htmlFor={`aio-setting-${key}`} className="block text-sm font-black text-slate-700 mb-1">{label}</label>
      {hint && <p className="text-xs text-slate-400 font-bold mb-1">{hint}</p>}
      <input id={`aio-setting-${key}`} value={form[key]} maxLength={key === 'aliases' || key === 'competitors' ? undefined : AIO_BRAND_TEXT_LIMITS[key]} onChange={(e) => { if (!guard.active() || ready.current !== guard.identity) return; revision.current++; const next = { ...draft.current, [key]: e.target.value }; draft.current = next; setForm(next); setSaved(false); setError(null); setNotice('') }} placeholder={placeholder}
        className="w-full rounded-xl border-2 border-slate-200 focus:border-purple-400 outline-none px-4 py-2.5 font-bold transition-colors" />
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto p-6">
      <PageHeader icon="manage_search" title="ブランド設定" subtitle="追跡する自社ブランドと競合を登録します" />
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        {field('追跡ブランド名 *', 'brandName', '例: ドヤマーケ')}
        {field('自社サイトURL', 'brandUrl', '例: https://doya-ai.surisuta.jp', '自社ドメイン引用率の判定に使います')}
        {field('別名・表記ゆれ', 'aliases', '例: ドヤAI, DoyaMarke', 'カンマ区切り、最大30件')}
        {field('競合ブランド', 'competitors', '例: 競合サービスA, 競合サービスB', 'カンマ区切り、最大30件。Share of Voiceの比較対象')}
        {field('カテゴリ', 'category', '例: マーケティングAI SaaS')}
        {field('市場・地域', 'market', '例: 日本')}

        {confirmed && <div className="rounded-xl border border-slate-200 p-4 text-sm"><p className="font-bold">現在保存されている内容</p><p className="mt-1">入力中の内容を保存する前に、最新の設定と照合してください。</p>{confirmed.profile ? <dl className="mt-3 space-y-2">{[['brandName', '追跡ブランド名'], ['brandUrl', '自社サイトURL'], ['aliases', '別名・表記ゆれ'], ['competitors', '競合ブランド'], ['category', 'カテゴリ'], ['market', '市場・地域']].map(([key, label]) => <div key={key}><dt className="font-bold">{label}</dt><dd className="whitespace-pre-wrap break-words">{Array.isArray(confirmed.profile?.[key]) ? (confirmed.profile[key] as string[]).join('\n') : String(confirmed.profile?.[key] || '未設定')}</dd></div>)}</dl> : <p className="mt-2">まだ保存されていません。</p>}</div>}
        {notice && <p role="status" className="text-sm font-bold text-slate-700">{notice}</p>}
        {uncertain && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p>保存結果または最新の設定を確認するまで、続けて保存できません。入力内容は保持しています。</p>
          <button type="button" disabled={checking} onClick={confirmSaved} className="mt-2 font-bold underline">{checking ? '確認中…' : '保存済みの設定を確認する'}</button>
        </div>}
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
            <span className="text-rose-500">{sym('error', 18)}</span>
            <p className="text-sm font-bold text-rose-700 break-words">{error}</p>
          </div>
        )}
        {saved && !error && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <span className="text-emerald-500">{sym('check_circle', 18)}</span>
            <p className="text-sm font-bold text-emerald-700">保存しました。スキャンに反映されます。</p>
          </div>
        )}

        <button onClick={save} disabled={saving || uncertain || checking}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white font-black shadow-lg shadow-purple-500/25 hover:-translate-y-0.5 transition-all disabled:opacity-50">
          {saving ? '保存中…' : '保存する'}
        </button>
      </div>
    </div>
  )
}
