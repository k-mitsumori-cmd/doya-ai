'use client'

import { showServiceLimit } from '@/lib/service-limit-ui'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { readBillingResponse } from '@/lib/billing-response-client'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { MODES, MODE_IDS, getMode } from '@/lib/cunning/modes'
import type { CunningMode } from '@/lib/cunning/types'
import { recordingAllowance } from '@/lib/cunning/allowance-client'
import { appendCunningProfilePage, parseCunningProfilePage } from '@/lib/cunning/profile-pages'
import { SUPPORT_CONTACT_URL } from '@/lib/pricing'

interface KB { id: string; name: string; _count: { chunks: number } }
interface Company { id: string; companyName: string | null; url: string }
interface Applicant { id: string; name: string }
interface SessionRow {
  id: string
  mode: string
  title: string
  status: string
  durationSec: number
  createdAt: string
  _count: { answers: number }
}

export default function CunningTool() {
  const router = useRouter()
  const { data: session, status: authStatus } = useSession()
  const actor = authStatus === 'unauthenticated' ? '' : session?.user?.id || ''
  const allowed = authStatus === 'authenticated' && Boolean(actor)
  const scope = JSON.stringify([actor, authStatus, (session?.user as { plan?: string } | undefined)?.plan])
  const epoch = useRef({ scope, version: 0 })
  if (epoch.current.scope !== scope) epoch.current = { scope, version: epoch.current.version + 1 }
  const contextKey = JSON.stringify([scope, epoch.current.version])
  const contextRef = useRef(contextKey)
  contextRef.current = contextKey
  const mounted = useRef(true)
  const startBusy = useRef(false)
  const startUnknownRef = useRef(false)
  const startAbort = useRef<AbortController | null>(null)
  const confirmedStart = useRef<string | null>(null)
  const [startUnknown, setStartUnknown] = useState(false)
  const [startNotice, setStartNotice] = useState<string | null>(null)
  const [confirmedSessionId, setConfirmedSessionId] = useState<string | null>(null)
  const [loginRequired, setLoginRequired] = useState(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; startAbort.current?.abort() } }, [])
  const [mode, setMode] = useState<CunningMode>('sales')
  const [kbs, setKbs] = useState<KB[]>([])
  const [kbError, setKbError] = useState(false)
  const [companies, setCompanies] = useState<Company[]>([])
  const [applicants, setApplicants] = useState<Applicant[]>([])
  const [companyCursor, setCompanyCursor] = useState<string | null>(null)
  const [applicantCursor, setApplicantCursor] = useState<string | null>(null)
  const [companyTotal, setCompanyTotal] = useState(0)
  const [applicantTotal, setApplicantTotal] = useState(0)
  const [loadingMoreProfiles, setLoadingMoreProfiles] = useState<'company' | 'profiles' | null>(null)
  const [profileError, setProfileError] = useState('')
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [sessionsError, setSessionsError] = useState(false)
  const [storedUsage, setUsage] = useState<any>(null)
  const [loadedUsageKey, setLoadedUsageKey] = useState('')
  const usage = allowed && loadedUsageKey === contextKey ? storedUsage : null
  const latestUsage = useRef(usage)
  latestUsage.current = usage
  const [usageError, setUsageError] = useState(false)
  const usageRequest = useRef(0)
  const knowledgeRequest = useRef(0)
  const sessionsRequest = useRef(0)
  const usageAbort = useRef<AbortController | null>(null)
  const [kbId, setKbId] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [applicantId, setApplicantId] = useState('')
  const [personaNote, setPersonaNote] = useState('')
  const [starting, setStarting] = useState(false)

  const startDraft = useRef({ mode, kbId, companyId, applicantId, personaNote })
  startDraft.current = { mode, kbId, companyId, applicantId, personaNote }

  const def = getMode(mode)

  const loadKnowledge = (request = usageRequest.current) => {
    const listRequest = ++knowledgeRequest.current
    setKbError(false)
    void fetch('/api/cunning/knowledge', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('ナレッジを取得できませんでした')
        const data = await response.json()
        if (!Array.isArray(data.bases)) throw new Error('ナレッジの応答が不正です')
        if (request === usageRequest.current && listRequest === knowledgeRequest.current) setKbs(data.bases)
      })
      .catch(() => { if (request === usageRequest.current && listRequest === knowledgeRequest.current) setKbError(true) })
  }

  const loadSessions = (request = usageRequest.current) => {
    const listRequest = ++sessionsRequest.current
    setSessionsError(false)
    void fetch('/api/cunning/sessions', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('履歴を取得できませんでした')
        const data = await response.json()
        if (!Array.isArray(data.sessions)) throw new Error('履歴の応答が不正です')
        if (request === usageRequest.current && listRequest === sessionsRequest.current) setSessions(data.sessions)
      })
      .catch(() => { if (request === usageRequest.current && listRequest === sessionsRequest.current) setSessionsError(true) })
  }

  const refreshUsage = (request = usageRequest.current) => {
    if (!allowed || contextRef.current !== contextKey || usageAbort.current) return
    latestUsage.current = null
    setUsage(null)
    setUsageError(false)
    const controller = new AbortController()
    usageAbort.current = controller
    const current = () => mounted.current && !controller.signal.aborted && request === usageRequest.current && contextRef.current === contextKey
    void readBillingResponse('/api/cunning/usage', { method: 'GET' }, controller.signal).then(response => {
      if (!current()) return
      const data = response.data
      if (response.status === 401 || data.plan === 'GUEST') setLoginRequired(true)
      if (!response.ok || data.error !== undefined || data.code !== undefined || typeof data.plan !== 'string' ||
        !['FREE', 'LIGHT', 'PRO', 'ENTERPRISE'].includes(data.plan) || (data.tier !== undefined && data.tier !== data.plan) ||
        typeof data.usedMinutes !== 'number' || !Number.isSafeInteger(data.usedMinutes) || data.usedMinutes < 0 ||
        typeof data.reservedSeconds !== 'number' || !Number.isSafeInteger(data.reservedSeconds) || data.reservedSeconds < 0) throw new Error('usage unavailable')
      recordingAllowance(data)
      if (loginRequired) setStartNotice(null)
      setLoginRequired(false)
      latestUsage.current = data
      setUsage(data)
      setLoadedUsageKey(contextKey)
    }).catch(() => { if (current()) setUsageError(true) }).finally(() => {
      if (usageAbort.current === controller) usageAbort.current = null
      controller.abort()
    })
  }
  const refreshUsageRef = useRef(refreshUsage)
  refreshUsageRef.current = refreshUsage
  useEffect(() => {
    if (allowed) refreshUsageRef.current()
    const focus = () => refreshUsageRef.current()
    if (allowed) window.addEventListener('focus', focus)
    return () => {
      usageAbort.current?.abort()
      usageAbort.current = null
      startAbort.current?.abort()
      window.removeEventListener('focus', focus)
    }
  }, [allowed, contextKey])

  const load = () => {
    if (!allowed || contextRef.current !== contextKey) return
    const request = ++usageRequest.current
    usageAbort.current?.abort()
    usageAbort.current = null
    setCompanies([])
    setApplicants([])
    setCompanyId('')
    setApplicantId('')
    setCompanyCursor(null)
    setApplicantCursor(null)
    setLoadingMoreProfiles(null)
    loadKnowledge(request)
    setProfileError('')
    void Promise.all([
      fetch('/api/cunning/company', { cache: 'no-store' }),
      fetch('/api/cunning/profiles', { cache: 'no-store' }),
    ]).then(async (responses) => {
      if (responses.some((response) => !response.ok)) throw new Error('企業・プロフィールを取得できませんでした')
      const [companiesData, applicantsData] = await Promise.all(responses.map((response) => response.json()))
      const companyPage = parseCunningProfilePage<Company>(companiesData)
      const applicantPage = parseCunningProfilePage<Applicant>(applicantsData)
      if (request !== usageRequest.current) return
      setCompanies(companyPage.profiles)
      setCompanyCursor(companyPage.nextCursor)
      setCompanyTotal(companyPage.total)
      setApplicants(applicantPage.profiles)
      setApplicantCursor(applicantPage.nextCursor)
      setApplicantTotal(applicantPage.total)
    }).catch((error) => { if (request === usageRequest.current) setProfileError(error instanceof Error ? error.message : '一覧を取得できませんでした') })
    loadSessions(request)
    refreshUsage(request)
  }

  async function loadMoreProfiles(kind: 'company' | 'profiles') {
    const cursor = kind === 'company' ? companyCursor : applicantCursor
    if (!cursor || loadingMoreProfiles) return
    const request = usageRequest.current
    setLoadingMoreProfiles(kind)
    setProfileError('')
    try {
      const response = await fetch(`/api/cunning/${kind}?cursor=${encodeURIComponent(cursor)}`, { cache: 'no-store' })
      if (!response.ok) throw new Error('続きを取得できませんでした')
      const data = await response.json()
      if (request !== usageRequest.current) return
      if (kind === 'company') {
        const page = parseCunningProfilePage<Company>(data)
        setCompanies(appendCunningProfilePage(companies, page, companyTotal))
        setCompanyCursor(page.nextCursor)
      } else {
        const page = parseCunningProfilePage<Applicant>(data)
        setApplicants(appendCunningProfilePage(applicants, page, applicantTotal))
        setApplicantCursor(page.nextCursor)
      }
    } catch (error) {
      if (request === usageRequest.current) setProfileError(error instanceof Error ? error.message : '続きを取得できませんでした')
    } finally {
      if (request === usageRequest.current) setLoadingMoreProfiles(null)
    }
  }
  const loadRef = useRef(load)
  loadRef.current = load
  useEffect(() => {
    const requestCounter = usageRequest
    const knowledgeCounter = knowledgeRequest
    const sessionsCounter = sessionsRequest
    const controllerRef = usageAbort
    loadRef.current()
    return () => { requestCounter.current++; knowledgeCounter.current++; sessionsCounter.current++; controllerRef.current?.abort() }
  }, [])

  const start = async () => {
    if (!allowed || contextRef.current !== contextKey || !mounted.current || startBusy.current || startUnknownRef.current || confirmedStart.current || usageAbort.current) return
    try { if (!latestUsage.current || recordingAllowance(latestUsage.current) === 0) return } catch { return }
    const draft = startDraft.current
    const selectedMode = getMode(draft.mode)
    if (draft.personaNote.length > 1000) { setStartNotice('設定は1,000文字以内で入力してください。'); return }
    const controller = new AbortController()
    startAbort.current = controller
    startBusy.current = true
    startUnknownRef.current = true
    setStarting(true)
    setStartNotice(null)
    const current = () => mounted.current && !controller.signal.aborted && contextRef.current === contextKey
    try {
      const response = await readBillingResponse('/api/cunning/sessions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: draft.mode,
          knowledgeBaseId: selectedMode.context === 'knowledge' ? draft.kbId || null : null,
          companyProfileId: selectedMode.context === 'company' ? draft.companyId || null : null,
          applicantProfileId: selectedMode.context === 'company' ? draft.applicantId || null : null,
          personaNote: draft.personaNote.trim() || null,
        }),
      }, controller.signal)
      if (!current()) return
      const data = response.data
      if (!response.ok) {
        if ([400, 401, 403, 404, 422, 429].includes(response.status)) {
          startUnknownRef.current = false
          if (response.status === 401) { setLoginRequired(true); setStartNotice('ログイン情報を確認できません。再度ログインしてください。'); return }
          if (response.status === 403 && data.code === 'LIMIT') {
            showServiceLimit('/api/cunning/sessions', response.status, {
              code: 'LIMIT', error: '今月の利用上限に達しました。',
              ...(data.upgradeUrl === '/cunning/pricing' ? { upgradeUrl: '/cunning/pricing' } : { contactUrl: SUPPORT_CONTACT_URL }),
            })
            refreshUsageRef.current()
            setStartNotice('今月の利用上限に達しました。プラン・利用条件をご確認ください。')
            return
          }
          if (response.status === 403 && data.code === 'RECORDING_RESERVED') {
            refreshUsageRef.current()
            setStartNotice('別の録音で利用時間を確保しています。録音の停止後に利用状況を再確認してください。')
            return
          }
          setStartNotice('セッションを開始できませんでした。入力内容と選択した資料をご確認ください。')
          return
        }
        throw new Error('Unknown creation result')
      }
      const created = data.session as { id?: unknown; userId?: unknown; mode?: unknown } | undefined
      if (data.error !== undefined || data.code !== undefined || !created || typeof created.id !== 'string' ||
        !/^[a-zA-Z0-9_-]{1,128}$/.test(created.id) || created.userId !== actor || created.mode !== draft.mode) throw new Error('Unknown creation result')
      confirmedStart.current = created.id
      setConfirmedSessionId(created.id)
      startUnknownRef.current = false
      setStartNotice('セッションを作成しました。画面が開かない場合は、作成済みセッションを開いてください。')
      try { router.push(`/cunning/live/${created.id}`) }
      catch { setStartNotice('セッションは作成済みです。作成済みセッションを開いてください。') }
    } catch {
      // A transport/body failure cannot establish whether the server already created the session.
    } finally {
      if (startAbort.current === controller) {
        startAbort.current = null
        startBusy.current = false
        if (mounted.current) {
          setStarting(false)
          if (startUnknownRef.current) {
            setStartUnknown(true)
            setStartNotice('作成結果を確認できませんでした。作成済みセッションがある可能性があります。履歴を確認してから、新しいセッションを作成してください。')
          }
        }
      }
      controller.abort()
    }
  }

  const remaining = usage?.remainingSeconds
  const overLimit = typeof remaining === 'number' && remaining !== -1 && remaining <= 0

  return (
    <div className="min-h-full bg-gradient-to-b from-[#EAF2FF] to-slate-50">
      <div className="p-6 lg:p-10 max-w-5xl mx-auto">
        {/* ヘッダー（Zoom風の青） */}
        <div className="mb-1">
          <img src="/cunning/logo.png" alt="ドヤカンニング" className="h-16 sm:h-20 w-auto object-contain" />
          <p className="text-slate-500 font-bold text-sm mt-1">
            相手の声をAIが即解析！最高の“カンペ”をリアルタイムでお届け。もう会話で困らない！
          </p>
        </div>

        {usage?.limits && (
          <div className="mb-6 mt-3 inline-flex items-center gap-3 text-xs font-bold text-slate-500 bg-white rounded-full px-4 py-2 shadow-sm">
            <span>プラン: {usage.plan}</span>
            <span className="text-slate-300">|</span>
            <span>
              今月の利用 {usage.usedMinutes ?? 0}分
              {usage.limits.maxMinutesPerMonth === -1 ? '' : ` / ${usage.limits.maxMinutesPerMonth}分`}
              {usage.reservedSeconds > 0 ? `（録音中に確保 ${usage.reservedSeconds}秒）` : ''}
            </span>
          </div>
        )}

        {/* モード選択 */}
        <div className="space-y-5 mb-6">
          {/* メイン：商談・面接（大きく2カラム） */}
          <div>
            <p className="text-xs font-black text-slate-400 mb-2 ml-1">メイン</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(['sales', 'interview'] as const).map((id) => {
                const m = MODES[id]
                return (
                  <button
                    key={m.id}
                    onClick={() => setMode(m.id)}
                    className={`text-left p-6 rounded-3xl border-2 transition-all bg-white flex items-center gap-4 ${
                      mode === m.id
                        ? 'border-[#0B5CFF] ring-2 ring-blue-200 shadow-lg'
                        : 'border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    <img src={`/character/${m.character}.png`} alt="" className="w-20 h-20 object-contain flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-black text-slate-900 text-lg">
                        {m.icon} {m.label}
                      </p>
                      <p className="text-xs text-slate-500 font-bold mt-1 leading-snug">{m.desc}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* その他（同サイズで下に並べる） */}
          <div>
            <p className="text-xs font-black text-slate-400 mb-2 ml-1">その他のモード</p>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {MODE_IDS.filter((id) => id !== 'sales' && id !== 'interview').map((id) => {
                const m = MODES[id]
                return (
                  <button
                    key={m.id}
                    onClick={() => setMode(m.id)}
                    className={`text-left p-4 rounded-2xl border-2 transition-all bg-white ${
                      mode === m.id
                        ? 'border-[#0B5CFF] ring-2 ring-blue-200 shadow-md'
                        : 'border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    <img src={`/character/${m.character}.png`} alt="" className="w-12 h-12 object-contain mb-1" />
                    <p className="font-black text-slate-800 text-sm">
                      {m.icon} {m.label}
                    </p>
                    <p className="text-[11px] text-slate-500 font-bold mt-0.5 leading-snug">{m.desc}</p>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* コンテキスト選択（モードに応じて） */}
        {def.context === 'knowledge' && (
          <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
            {kbError && <div role="alert" className="mb-3 rounded-lg bg-rose-50 p-3 text-sm font-bold text-rose-700">ナレッジを取得できませんでした。<button type="button" onClick={() => loadKnowledge()} className="ml-2 underline">再読み込み</button></div>}
            <label className="block text-sm font-black text-slate-700 mb-2">参照ナレッジ（任意）</label>
            <select
              value={kbId}
              onChange={(e) => setKbId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 font-bold text-slate-700"
            >
              <option value="">未選択（一般的な回答）</option>
              {kbs.map((k) => (
                <option key={k.id} value={k.id}>{k.name}（{k._count.chunks}件）</option>
              ))}
            </select>
            <Link href="/cunning/knowledge" className="inline-block mt-2 text-xs font-bold text-[#0B5CFF] hover:underline">
              ＋ ナレッジを追加・編集
            </Link>
          </div>
        )}
        {def.context === 'company' && (
          <div className="bg-white rounded-2xl shadow-sm p-5 mb-6 space-y-4">
            {profileError && <div role="alert" className="rounded-lg bg-rose-50 p-3 text-sm font-bold text-rose-700">{profileError}<button type="button" onClick={load} className="ml-2 underline">再読み込み</button></div>}
            <div>
              <label className="block text-sm font-black text-slate-700 mb-2">応募先企業（任意）</label>
              <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3 font-bold text-slate-700">
                <option value="">未選択</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.companyName || c.url}</option>)}
              </select>
              {companyCursor && <button type="button" onClick={() => void loadMoreProfiles('company')} disabled={loadingMoreProfiles !== null} className="mt-2 text-xs font-bold text-blue-700 underline disabled:opacity-50">{loadingMoreProfiles === 'company' ? '読み込み中…' : `企業をさらに表示（${companies.length}/${companyTotal}件）`}</button>}
            </div>
            <div>
              <label className="block text-sm font-black text-slate-700 mb-2">応募者プロフィール（任意）</label>
              <select value={applicantId} onChange={(e) => setApplicantId(e.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3 font-bold text-slate-700">
                <option value="">未選択</option>
                {applicants.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              {applicantCursor && <button type="button" onClick={() => void loadMoreProfiles('profiles')} disabled={loadingMoreProfiles !== null} className="mt-2 text-xs font-bold text-blue-700 underline disabled:opacity-50">{loadingMoreProfiles === 'profiles' ? '読み込み中…' : `プロフィールをさらに表示（${applicants.length}/${applicantTotal}件）`}</button>}
            </div>
            <Link href="/cunning/company" className="inline-block text-xs font-bold text-[#0B5CFF] hover:underline">
              ＋ 企業URLを解析・プロフィールを登録
            </Link>
          </div>
        )}
        {def.context === 'none' && (
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-6 text-sm font-bold text-blue-700">
            {def.icon} {def.label}：設定不要。開始して相手のコメント・発話に{def.trigger === 'any' ? '即レス' : '回答'}します。
          </div>
        )}

        {/* キャラ設定 / 補足メモ（任意・全モード共通） */}
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
          <label className="block text-sm font-black text-slate-700 mb-2">
            {def.category === 'entertainment' ? 'キャラ設定（任意）' : '補足メモ（任意）'}
          </label>
          <textarea
            value={personaNote}
            maxLength={1000}
            onChange={(e) => setPersonaNote(e.target.value)}
            rows={2}
            placeholder={
              def.category === 'entertainment'
                ? '名前・口調・世界観など（例: 名前は「ドヤにゃん」。語尾は「〜にゃ」。元気で明るいキャラ）'
                : '回答のトーンや前提（例: 丁寧でフォーマルに。専門用語は避ける）'
            }
            className="w-full rounded-xl border border-slate-200 px-4 py-3 font-medium text-sm"
          />
          <p className="text-[11px] text-slate-400 font-bold mt-1">回答・想定問答にこの設定を反映します（{personaNote.length} / 1,000文字）</p>
        </div>

        {/* キャラの吹き出し（ポップな後押し） */}
        <div className="flex items-end gap-2 mb-3">
          <img src={`/character/${def.character}.png`} alt="" className="w-16 h-16 object-contain flex-shrink-0 animate-bounce" />
          <div className="relative bg-white rounded-2xl rounded-bl-none shadow-sm px-4 py-2.5 font-black text-slate-700 text-sm">
            {def.icon} 「{def.label}」で行くよ〜！準備できたらスタート！いっちょやったろ！
          </div>
        </div>

        {startNotice && <div role="alert" className="mb-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          <p>{startNotice}</p>
          <div className="mt-2 flex flex-wrap gap-3 font-bold">
            <Link href="/cunning/history" className="underline">セッション履歴を確認する</Link>
            {confirmedSessionId && <Link href={`/cunning/live/${confirmedSessionId}`} className="underline">作成済みセッションを開く</Link>}
            {loginRequired && <Link href="/auth/signin?callbackUrl=%2Fcunning" className="underline">再度ログインする</Link>}
            <Link href={SUPPORT_CONTACT_URL} className="underline">お問い合わせ</Link>
            {startUnknown && <button type="button" disabled={starting} onClick={() => { startUnknownRef.current = false; setStartUnknown(false); setStartNotice(null) }} className="underline">履歴を確認してから新しいセッションを作成</button>}
          </div>
        </div>}
        <button
          onClick={start}
          disabled={starting || overLimit || !usage || !allowed || loginRequired || startUnknown || Boolean(confirmedSessionId)}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#2D8CFF] to-[#0B5CFF] text-white font-black text-lg shadow-lg shadow-blue-500/30 hover:shadow-xl transition-all disabled:opacity-50"
        >
          {!usage ? (
            usageError ? '利用状況を確認できませんでした' : '利用状況を確認中…'
          ) : overLimit ? (
            usage.reservedSeconds > 0 ? '別の録音で利用時間を確保しています' : '今月の利用上限に達しました'
          ) : starting ? (
            '開始中…'
          ) : (
            <span className="inline-flex items-center gap-2">
              <span className="material-symbols-outlined">mic</span>
              ライブ開始！いくぞ〜
            </span>
          )}
        </button>
        {usageError && loginRequired && <Link href="/auth/signin?callbackUrl=%2Fcunning" className="mt-3 block underline">再度ログインする</Link>}
        {(usageError || (overLimit && usage?.reservedSeconds > 0)) && <button type="button" onClick={() => refreshUsage()} className="mt-3 w-full rounded-xl border border-slate-300 p-3 font-bold text-slate-700">利用状況を再確認する</button>}
        {overLimit && !usage?.reservedSeconds && <a href={usage?.plan === 'FREE' ? '/cunning/pricing' : SUPPORT_CONTACT_URL} className="mt-3 block w-full rounded-xl bg-violet-700 p-3 text-center font-bold text-white">{usage?.plan === 'FREE' ? 'プラン・利用条件を確認する' : '追加の利用枠を相談する'}</a>}
        <p className="text-center text-xs text-slate-400 font-bold mt-2">
          開始後、会議/配信タブの音声共有を許可してください（Chrome/Edge推奨）
        </p>

        {/* 最近のセッション */}
        {sessionsError && <div role="alert" className="mt-10 rounded-lg bg-rose-50 p-3 text-sm font-bold text-rose-700">最近のセッションを取得できませんでした。<button type="button" onClick={() => loadSessions()} className="ml-2 underline">再読み込み</button></div>}
        {sessions.length > 0 && (
          <div className="mt-10">
            <h2 className="font-black text-slate-700 mb-3">最近のセッション</h2>
            <div className="space-y-2">
              {sessions.slice(0, 5).map((s) => (
                <Link
                  key={s.id}
                  href={`/cunning/history/${s.id}`}
                  className="flex items-center justify-between bg-white rounded-xl px-4 py-3 shadow-sm hover:shadow-md transition-all"
        >
                  <div className="flex items-center gap-3 min-w-0">
                    <span>{getMode(s.mode).icon}</span>
                    <span className="font-bold text-slate-700 truncate">{s.title}</span>
                  </div>
                  <span className="text-xs font-bold text-slate-400 flex-shrink-0">
                    {s._count.answers}回答 · {Math.floor(s.durationSec / 60)}分
                  </span>
                </Link>
              ))}
            </div>
            <Link href="/cunning/history" className="inline-block mt-3 text-xs font-bold text-[#0B5CFF] hover:underline">
              すべての履歴を見る →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
