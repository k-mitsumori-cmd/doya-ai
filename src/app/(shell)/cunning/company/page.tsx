'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { readCunningListResponse, readCunningMutationResponse } from '@/lib/cunning/list-response-client'
import { appendCunningProfilePage, parseCunningProfilePage } from '@/lib/cunning/profile-pages'

interface Company {
  id: string
  url: string
  companyName: string | null
  businessSummary: string | null
}
interface Applicant {
  id: string
  name: string
  resume: string | null
  motivation: string | null
}

export default function CunningCompanyPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [applicants, setApplicants] = useState<Applicant[]>([])
  const [companyCursor, setCompanyCursor] = useState<string | null>(null)
  const [applicantCursor, setApplicantCursor] = useState<string | null>(null)
  const [companyTotal, setCompanyTotal] = useState(0)
  const [applicantTotal, setApplicantTotal] = useState(0)
  const [loadingMore, setLoadingMore] = useState<'company' | 'profiles' | null>(null)
  const [loadError, setLoadError] = useState('')
  const { data: session, status } = useSession()
  const actor = status === 'unauthenticated' ? '' : session?.user?.id || ''
  const allowed = status === 'authenticated' && Boolean(actor)
  const scope = JSON.stringify([actor, status])
  const epoch = useRef({ scope, version: 0 })
  if (epoch.current.scope !== scope) epoch.current = { scope, version: epoch.current.version + 1 }
  const key = JSON.stringify([scope, epoch.current.version])
  const context = useRef(key)
  context.current = key
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const listAbort = useRef<AbortController | null>(null)
  const mutationAbort = useRef<{ analyze: AbortController | null; save: AbortController | null }>({ analyze: null, save: null })
  const unknown = useRef({ analyze: false, save: false })
  const [notice, setNotice] = useState<{ analyze: string | null; save: string | null }>({ analyze: null, save: null })
  const [uncertain, setUncertain] = useState({ analyze: false, save: false })
  const [loading, setLoading] = useState(false)
  const [reauthRequired, setReauthRequired] = useState(false)
  const reauthBlocked = useRef(false)
  const lists = useRef({ companies, applicants, companyCursor, applicantCursor, companyTotal, applicantTotal })
  lists.current = { companies, applicants, companyCursor, applicantCursor, companyTotal, applicantTotal }
  const [url, setUrl] = useState('')
  const [analyzing, setAnalyzing] = useState(false)

  const [name, setName] = useState('マイプロフィール')
  const [resume, setResume] = useState('')
  const [motivation, setMotivation] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  const draft = useRef({ url, name, resume, motivation })
  draft.current = { url, name, resume, motivation }
  const validCompanies = (rows: Company[]) => rows.every(row => typeof row.url === 'string' &&
    (row.companyName === null || typeof row.companyName === 'string') && (row.businessSummary === null || typeof row.businessSummary === 'string'))
  const validApplicants = (rows: Applicant[]) => rows.every(row => typeof row.name === 'string' &&
    (row.resume === null || typeof row.resume === 'string') && (row.motivation === null || typeof row.motivation === 'string'))
  const load = useCallback(async () => {
    if (!allowed || context.current !== key || !mounted.current || listAbort.current) return
    const controller = new AbortController()
    listAbort.current = controller
    const current = () => mounted.current && !controller.signal.aborted && context.current === key
    setLoadError('')
    setLoading(true)
    try {
      const responses = await Promise.all([
        readCunningListResponse('/api/cunning/company', { method: 'GET' }, controller.signal),
        readCunningListResponse('/api/cunning/profiles', { method: 'GET' }, controller.signal),
      ])
      if (!current()) return
      if (responses.some(response => !response.ok || response.data.error !== undefined || response.data.code !== undefined)) throw new Error('Invalid list')
      const companyPage = parseCunningProfilePage<Company>(responses[0].data)
      const applicantPage = parseCunningProfilePage<Applicant>(responses[1].data)
      if (!validCompanies(companyPage.profiles) || !validApplicants(applicantPage.profiles)) throw new Error('Invalid fields')
      lists.current = { companies: companyPage.profiles, applicants: applicantPage.profiles, companyCursor: companyPage.nextCursor, applicantCursor: applicantPage.nextCursor, companyTotal: companyPage.total, applicantTotal: applicantPage.total }
      setCompanies(companyPage.profiles)
      setCompanyCursor(companyPage.nextCursor)
      setCompanyTotal(companyPage.total)
      setApplicants(applicantPage.profiles)
      setApplicantCursor(applicantPage.nextCursor)
      setApplicantTotal(applicantPage.total)
    } catch {
      if (current()) setLoadError('企業・プロフィールを取得できませんでした。時間をおいて再読み込みしてください。')
    } finally {
      if (listAbort.current === controller) { listAbort.current = null; if (current()) setLoading(false) }
      controller.abort()
    }
  }, [allowed, key])
  useEffect(() => {
    setLoadingMore(null)
    setLoading(false)
    reauthBlocked.current = false
    setReauthRequired(false)
    for (const kind of ['analyze', 'save'] as const) {
      if (unknown.current[kind]) {
        setUncertain(previous => ({ ...previous, [kind]: true }))
        setNotice(previous => ({ ...previous, [kind]: '処理結果を確認できませんでした。一覧を再読み込みして、登録済みか確認してください。' }))
      }
    }
    setAnalyzing(false)
    setSavingProfile(false)
    void load()
    const operations = mutationAbort.current
    const listRef = listAbort
    return () => {
      listRef.current?.abort(); listRef.current = null
      for (const kind of ['analyze', 'save'] as const) { operations[kind]?.abort(); operations[kind] = null }
    }
  }, [load])

  async function loadMore(kind: 'company' | 'profiles') {
    if (!allowed || context.current !== key || !mounted.current || listAbort.current) return
    const before = lists.current
    const cursor = kind === 'company' ? before.companyCursor : before.applicantCursor
    if (!cursor) return
    const controller = new AbortController()
    listAbort.current = controller
    const current = () => mounted.current && !controller.signal.aborted && context.current === key
    setLoadingMore(kind)
    setLoadError('')
    try {
      const response = await readCunningListResponse(`/api/cunning/${kind}?cursor=${encodeURIComponent(cursor)}`, { method: 'GET' }, controller.signal)
      if (!current()) return
      if (!response.ok || response.data.error !== undefined || response.data.code !== undefined) throw new Error('Invalid continuation')
      if (kind === 'company') {
        const page = parseCunningProfilePage<Company>(response.data)
        if (!validCompanies(page.profiles)) throw new Error('Invalid companies')
        const merged = appendCunningProfilePage(before.companies, page, before.companyTotal)
        lists.current = { ...before, companies: merged, companyCursor: page.nextCursor }
        setCompanies(merged)
        setCompanyCursor(page.nextCursor)
      } else {
        const page = parseCunningProfilePage<Applicant>(response.data)
        if (!validApplicants(page.profiles)) throw new Error('Invalid applicants')
        const merged = appendCunningProfilePage(before.applicants, page, before.applicantTotal)
        lists.current = { ...before, applicants: merged, applicantCursor: page.nextCursor }
        setApplicants(merged)
        setApplicantCursor(page.nextCursor)
      }
    } catch {
      if (current()) setLoadError('続きを取得できませんでした。一覧が更新された可能性があります。再読み込みしてください。')
    } finally {
      if (listAbort.current === controller) { listAbort.current = null; if (current()) setLoadingMore(null) }
      controller.abort()
    }
  }

  async function submit(kind: 'analyze' | 'save') {
    if (!allowed || context.current !== key || !mounted.current || reauthBlocked.current || mutationAbort.current[kind] || unknown.current[kind]) return
    const submitted = draft.current
    const value = submitted.url.trim()
    if (kind === 'analyze') {
      try { const parsed = new URL(value); if (value.length > 2048 || !['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error() }
      catch { setNotice(previous => ({ ...previous, analyze: 'httpまたはhttpsの採用ページURLを入力してください。' })); return }
    } else if (submitted.name.length > 120 || submitted.resume.length > 8000 || submitted.motivation.length > 4000) {
      setNotice(previous => ({ ...previous, save: 'プロフィール名は120文字、経歴は8,000文字、志望動機は4,000文字以内で入力してください。' })); return
    }
    const controller = new AbortController()
    mutationAbort.current[kind] = controller
    unknown.current[kind] = true
    setNotice(previous => ({ ...previous, [kind]: null }))
    if (kind === 'analyze') setAnalyzing(true); else setSavingProfile(true)
    const current = () => mounted.current && !controller.signal.aborted && context.current === key
    try {
      const response = await readCunningMutationResponse(kind === 'analyze' ? '/api/cunning/company/analyze' : '/api/cunning/profiles', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(kind === 'analyze' ? { url: value } : { name: submitted.name, resume: submitted.resume, motivation: submitted.motivation }),
      }, controller.signal)
      if (!current()) return
      if (!response.ok) {
        if ([400, 401, 403, 404, 413, 422, 429].includes(response.status)) {
          unknown.current[kind] = false
          if (response.status === 401) { reauthBlocked.current = true; setReauthRequired(true) }
          const message = response.status === 401 ? 'ログイン情報を確認できません。再度ログインしてください。' :
            response.status === 429 && response.data.code === 'CUNNING_COMPANY_DAILY_LIMIT' ? '本日の企業URL解析の運用上限に達しました。明日お試しください。' :
            response.status === 429 ? '現在、操作が混み合っています。時間をおいてお試しください。' :
            response.status === 413 ? 'ページが大きすぎます。別の採用ページのURLをお試しください。' : '登録できませんでした。入力内容をご確認ください。'
          setNotice(previous => ({ ...previous, [kind]: message }))
          return
        }
        throw new Error('Unconfirmed write')
      }
      const profile = response.data.profile as { id?: unknown; url?: unknown; name?: unknown; userId?: unknown; resume?: unknown; motivation?: unknown; companyName?: unknown; businessSummary?: unknown } | undefined
      if (response.data.error !== undefined || response.data.code !== undefined || !profile || typeof profile.id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(profile.id) ||
        (kind === 'analyze' ? profile.url !== value || (profile.companyName !== null && typeof profile.companyName !== 'string') ||
          (profile.businessSummary !== null && typeof profile.businessSummary !== 'string') : profile.userId !== actor || profile.name !== (submitted.name.trim() || 'マイプロフィール') ||
          profile.resume !== (submitted.resume || null) || profile.motivation !== (submitted.motivation || null))) throw new Error('Unconfirmed write')
      unknown.current[kind] = false
      setUncertain(previous => ({ ...previous, [kind]: false }))
      setNotice(previous => ({ ...previous, [kind]: kind === 'analyze' ? '企業情報を登録しました。' : 'プロフィールを保存しました。' }))
      if (kind === 'analyze') setUrl(previous => previous === submitted.url ? '' : previous)
      else { setResume(previous => previous === submitted.resume ? '' : previous); setMotivation(previous => previous === submitted.motivation ? '' : previous) }
      listAbort.current?.abort(); listAbort.current = null; setLoadingMore(null)
      void load()
    } catch {
      if (current()) {
        setUncertain(previous => ({ ...previous, [kind]: true }))
        setNotice(previous => ({ ...previous, [kind]: '処理結果を確認できませんでした。一覧を再読み込みして、登録済みか確認してください。' }))
      }
    } finally {
      if (mutationAbort.current[kind] === controller) {
        mutationAbort.current[kind] = null
        if (current()) { if (kind === 'analyze') setAnalyzing(false); else setSavingProfile(false) }
      }
      controller.abort()
    }
  }
  const analyze = () => submit('analyze')
  const saveProfile = () => submit('save')
  const operationNotice = (kind: 'analyze' | 'save') => notice[kind] && (
    <div role="alert" className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
      <p>{notice[kind]}</p>
      <div className="mt-2 flex flex-wrap gap-3 font-bold">
        <button type="button" onClick={() => void load()} disabled={!allowed || loading} className="underline">一覧を再読み込み</button>
        {reauthRequired && <Link href="/auth/signin?callbackUrl=%2Fcunning%2Fcompany" className="underline">再度ログインする</Link>}
        {uncertain[kind] && <button type="button" disabled={!allowed || analyzing || savingProfile} className="underline" onClick={() => {
          if (!allowed || context.current !== key || mutationAbort.current[kind]) return
          unknown.current[kind] = false
          setUncertain(previous => ({ ...previous, [kind]: false }))
          setNotice(previous => ({ ...previous, [kind]: null }))
        }}>一覧を確認してから再操作する</button>}
      </div>
    </div>
  )

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto">
      {loadError && <div role="alert" className="mb-4 rounded-xl bg-rose-50 p-4 text-sm font-bold text-rose-700">{loadError}<button type="button" onClick={() => void load()} className="ml-3 underline">再読み込み</button></div>}
      <div className="flex items-center gap-3 mb-1">
        <img src="/character/focus.png" alt="" className="w-12 h-12 object-contain" />
        <h1 className="text-2xl font-black text-slate-900">企業・プロフィール（面接モード）</h1>
      </div>
      <p className="text-slate-500 font-bold text-sm mb-6">
        応募先の採用ページを解析し、あなたの経歴と掛け合わせて回答を最適化します
      </p>

      <button type="button" onClick={() => void load()} disabled={!allowed || loading || loadingMore !== null} className="mb-4 text-sm font-bold text-blue-700 underline disabled:opacity-50">{loading ? '一覧を読み込み中…' : '一覧を再読み込み'}</button>
      {/* 企業URL解析 */}
      <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
        <p className="font-black text-slate-700 mb-3">応募先企業の採用URLを解析</p>
        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/recruit"
            maxLength={2048}
            aria-label="応募先企業の採用URL"
            className="flex-1 rounded-xl border border-slate-200 px-4 py-3 font-bold"
          />
          <button
            onClick={analyze}
            disabled={analyzing || uncertain.analyze || reauthRequired || !allowed}
            className="px-5 py-3 rounded-xl bg-[#0B5CFF] text-white font-black disabled:opacity-50"
          >
            {analyzing ? '解析中…' : '解析'}
          </button>
        </div>
        {operationNotice('analyze')}
        <div className="mt-3 space-y-2">
          {companies.map((c) => (
            <div key={c.id} className="bg-slate-50 rounded-xl px-4 py-3">
              <p className="font-black text-slate-800">{c.companyName || c.url}</p>
              {c.businessSummary && (
                <p className="text-xs text-slate-500 font-medium mt-1 line-clamp-2">{c.businessSummary}</p>
              )}
            </div>
          ))}
        </div>
        {companyCursor && <button type="button" onClick={() => void loadMore('company')} disabled={loadingMore !== null} className="mt-3 rounded-lg border border-blue-300 px-3 py-2 text-sm font-bold text-blue-700 disabled:opacity-50">{loadingMore === 'company' ? '読み込み中…' : `企業をさらに表示（${companies.length}/${companyTotal}件）`}</button>}
      </div>

      {/* 応募者プロフィール */}
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <p className="font-black text-slate-700 mb-3">応募者プロフィール（任意）</p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="プロフィール名"
          maxLength={120}
          className="w-full rounded-xl border border-slate-200 px-4 py-3 font-bold mb-2"
        />
        <textarea
          value={resume}
          onChange={(e) => setResume(e.target.value)}
          rows={4}
          placeholder="経歴・スキル・実績"
          maxLength={8000}
          className="w-full rounded-xl border border-slate-200 px-4 py-3 font-medium mb-2"
        />
        <textarea
          value={motivation}
          onChange={(e) => setMotivation(e.target.value)}
          rows={3}
          placeholder="志望動機メモ"
          maxLength={4000}
          className="w-full rounded-xl border border-slate-200 px-4 py-3 font-medium"
        />
        <button
          onClick={saveProfile}
          disabled={savingProfile || uncertain.save || reauthRequired || !allowed}
          className="mt-3 px-5 py-3 rounded-xl bg-[#0B5CFF] text-white font-black disabled:opacity-50"
        >
          {savingProfile ? '保存中…' : '保存'}
        </button>

        {operationNotice('save')}
        {applicants.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {applicants.map((a) => (
              <span key={a.id} className="text-xs font-bold text-[#0B5CFF] bg-blue-50 rounded-full px-3 py-1.5">
                {a.name}
              </span>
            ))}
          </div>
        )}
        {applicantCursor && <button type="button" onClick={() => void loadMore('profiles')} disabled={loadingMore !== null} className="mt-3 rounded-lg border border-blue-300 px-3 py-2 text-sm font-bold text-blue-700 disabled:opacity-50">{loadingMore === 'profiles' ? '読み込み中…' : `プロフィールをさらに表示（${applicants.length}/${applicantTotal}件）`}</button>}
      </div>
    </div>
  )
}
