'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { ShodanApiError, shodanGet, shodanSend } from '@/lib/shodan/client'
import { useOrgSettingsGuard } from '@/lib/use-org-settings-guard'
import { readOrgProfile } from '@/lib/org-profile-view'
import { requestOrgJson, OrgResponseError, orgErrorMessage } from '@/lib/org-client-response'
import { DoyaKun, PageHeader, sym, type Mood } from '@/components/shodan/ui'
import toast from 'react-hot-toast'

type Profile = {
  companyName: string; url: string; description: string; valueProp: string
  products: string; targetCustomer: string; pricingNote: string; caseStudies: string
}
const EMPTY: Profile = { companyName: '', url: '', description: '', valueProp: '', products: '', targetCustomer: '', pricingNote: '', caseStudies: '' }

// 充足度・提案精度に効く必須級フィールド（スコア計算対象）
const CORE_FIELDS: (keyof Profile)[] = ['companyName', 'description', 'valueProp', 'products', 'targetCustomer']

const FIELDS: { key: keyof Profile; label: string; placeholder: string; textarea?: boolean; hint?: string }[] = [
  { key: 'companyName', label: '自社名', placeholder: '例: 株式会社スリスタ' },
  { key: 'url', label: '自社URL', placeholder: '例: https://surisuta.jp' },
  { key: 'description', label: '事業内容', placeholder: '何をしている会社か', textarea: true },
  { key: 'valueProp', label: '提供価値・強み（USP）', placeholder: '競合と比べた強み・独自性', textarea: true, hint: '提案の説得力に直結。具体的に。' },
  { key: 'products', label: '主な商材・サービス', placeholder: '提供しているプロダクト/サービス', textarea: true },
  { key: 'targetCustomer', label: 'ターゲット顧客', placeholder: 'どんな企業・部門・役職が顧客か', textarea: true },
  { key: 'pricingNote', label: '価格帯・導入条件', placeholder: '料金イメージや導入の前提（任意）', textarea: true },
  { key: 'caseStudies', label: '導入事例・実績', placeholder: '代表的な事例・実績（任意）', textarea: true },
]

type Status = 'empty' | 'weak' | 'ok'
function fieldStatus(value: string, key: string, gaps: Set<string>): Status {
  const v = (value || '').trim()
  if (!v) return 'empty'
  if (gaps.has(key) || v.length < 8) return 'weak'
  return 'ok'
}
const STATUS_BADGE: Record<Status, { label: string; cls: string }> = {
  empty: { label: '未入力', cls: 'bg-rose-100 text-rose-600' },
  weak: { label: '加筆推奨', cls: 'bg-amber-100 text-amber-700' },
  ok: { label: 'OK', cls: 'bg-emerald-100 text-emerald-700' },
}

// 自社情報の抽出中に順番に見せる“ド派手”ステップ（飽きさせない演出）
const EXTRACT_STEPS: { icon: string; mood: Mood; title: string; sub: string }[] = [
  { icon: 'travel_explore', mood: 'focus', title: 'サイトに潜入中…', sub: 'トップページを丸ごと読み込んでいます' },
  { icon: 'menu_book', mood: 'thinking', title: '会社概要をスキャン', sub: '事業内容・沿革・実績を抜き出し中' },
  { icon: 'rocket_launch', mood: 'point', title: '強み・USPを発掘', sub: '競合と差がつく“ドヤれる”ポイントを探索' },
  { icon: 'inventory_2', mood: 'working', title: '商材ラインナップを整理', sub: 'サービス・プロダクトを一覧化しています' },
  { icon: 'groups', mood: 'thumbsup', title: 'ターゲット顧客を推定', sub: '誰に刺さるかをAIが言語化中' },
  { icon: 'palette', mood: 'love', title: 'ブランドの空気を読み取り', sub: 'カラー・トーンを推定しています' },
  { icon: 'auto_awesome', mood: 'success', title: '下書きを清書中…', sub: 'もうすぐ自動入力が完成します！' },
]

export default function ShodanSettingsPage() {
  const params = useParams<{ orgSlug: string }>()
  const orgSlug = String(params.orgSlug)
  const guard = useOrgSettingsGuard(orgSlug)
  const ready = useRef('')
  const version = useRef<string | null>(null)
  const pendingWrite = useRef(false)
  const revision = useRef(0)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const [uncertain, setUncertain] = useState(false)
  const [checking, setChecking] = useState(false)
  const [confirmed, setConfirmed] = useState<{ profile: Record<string, unknown> | null } | null>(null)
  const [notice, setNotice] = useState('')
  const [operationError, setOperationError] = useState('')
  const [extractionPreview, setExtractionPreview] = useState<{ suggested: Partial<Profile>; gaps: string[] } | null>(null)
  const [profile, setProfile] = useState<Profile>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [extractUrl, setExtractUrl] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [extractLimitMessage, setExtractLimitMessage] = useState<string | null>(null)
  const [gaps, setGaps] = useState<Set<string>>(new Set())
  // ブランド（資料に反映）
  const [brandColors, setBrandColors] = useState<string[]>(['#7f19e6', '#f59e0b'])
  const [logoPath, setLogoPath] = useState<string | null>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [stepIdx, setStepIdx] = useState(0)

  // 抽出中はステップ演出を自動で進める（最後の1歩は完了まで手前で待機＝飽き＆“もうすぐ”感）
  useEffect(() => {
    if (!extracting) { setStepIdx(0); return }
    setStepIdx(0)
    const t = setInterval(() => {
      setStepIdx((i) => (i < EXTRACT_STEPS.length - 1 ? i + 1 : i))
    }, 1300)
    return () => clearInterval(t)
  }, [extracting])

  const draft = useRef({ profile, brandColors, logoPath, extractUrl })
  draft.current = { profile, brandColors, logoPath, extractUrl }
  const flags = useRef({ loading, loadError, uncertain, checking })
  flags.current = { loading, loadError, uncertain, checking }
  const identity = useRef(guard.identity)
  if (identity.current !== guard.identity) { identity.current = guard.identity; ready.current = ''; pendingWrite.current = false }
  useEffect(() => {
    setSaving(false); setExtracting(false); setUploadingLogo(false); setChecking(false)
    if (pendingWrite.current) setUncertain(true)
  }, [guard.key])
  useEffect(() => {
    if (!guard.allowed || ready.current === guard.identity) return
    const ticket = guard.begin('load')
    if (!ticket) return
    setLoading(true); setLoadError(null); setOperationError(''); setNotice(''); setConfirmed(null); setUncertain(false); setExtractionPreview(null)
    shodanGet('/api/shodan/company-profile', orgSlug, { signal: ticket.signal })
      .then((d) => {
        if (!ticket.current()) return
        const { profile: p, version: stamp } = readOrgProfile('shodan', d)
        const fields = { ...EMPTY, ...Object.fromEntries(FIELDS.map(f => [f.key, p?.[f.key] ?? ''])) } as Profile
        setProfile(fields); setExtractUrl(fields.url)
        setBrandColors(Array.isArray(p?.brandColors) && p.brandColors.length ? p.brandColors as string[] : ['#7f19e6', '#f59e0b'])
        setLogoPath((p?.logoPath as string) || null); setLogoUrl((p?.logoUrl as string) || null)
        version.current = stamp; ready.current = guard.identity
      })
      .catch(e => { if (ticket.current()) { setLoadError(e instanceof Error ? e.message : '自社情報を読み込めませんでした'); if (e instanceof ShodanApiError && e.status === 401) guard.rejectAuthentication() } })
      .finally(() => { if (ticket.current()) setLoading(false); ticket.end() })
    return () => ticket.end()
  }, [guard.key, retry]) // eslint-disable-line react-hooks/exhaustive-deps

  const confirmSaved = async () => {
    if (!flags.current.uncertain) return
    const ticket = guard.begin('mutation')
    if (!ticket) return
    setChecking(true)
    try {
      const result = readOrgProfile('shodan', await shodanGet('/api/shodan/company-profile', orgSlug, { signal: ticket.signal }))
      if (!ticket.current()) return
      version.current = result.version; setConfirmed({ profile: result.profile }); pendingWrite.current = false; setUncertain(false); setOperationError('')
      setNotice('保存済みの設定を再確認しました。入力中の内容は保持しています。確認してから保存してください。')
    } catch (e) { if (ticket.current()) { setOperationError(e instanceof Error ? e.message : '設定を確認できませんでした'); if (e instanceof ShodanApiError && e.status === 401) guard.rejectAuthentication() } }
    finally { if (ticket.current()) setChecking(false); ticket.end() }
  }
  const canEdit = () => guard.active() && ready.current === guard.identity && !flags.current.loading && !flags.current.loadError && !flags.current.uncertain && !pendingWrite.current && !flags.current.checking

  const onLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canEdit()) return
    const file = e.target.files?.[0]
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { setOperationError('PNG / JPG / WebP、5MB以下のファイルを選択してください。'); return }
    const ticket = guard.begin('mutation')
    if (!ticket) return
    setUploadingLogo(true); setOperationError('')
    try {
      const fd = new FormData(); fd.append('file', file)
      const { res, data: d } = await requestOrgJson('shodan', '/api/shodan/company-profile/logo', orgSlug, { method: 'POST', body: fd, signal: ticket.signal })
      if (!ticket.current()) return
      if (!res.ok) throw new ShodanApiError(orgErrorMessage(d, res.status, true), res.status)
      if (d.ok !== true || typeof d.path !== 'string' || !/^shodan\/logos\/[a-z0-9-]+\/[0-9a-fA-F-]{36}\.(png|jpg|webp)$/.test(d.path) || typeof d.url !== 'string' || !d.url.startsWith('https://')) throw new OrgResponseError(true, res.status)
      revision.current++; draft.current = { ...draft.current, logoPath: d.path }; setLogoPath(d.path); setLogoUrl(d.url)
      setNotice('ロゴを読み込みました。設定を保存すると反映されます。')
    } catch (err) { if (ticket.current()) { setOperationError(err instanceof Error ? err.message : 'アップロード結果を確認できませんでした'); if (err instanceof ShodanApiError && err.status === 401) guard.rejectAuthentication() } }
    finally { if (ticket.current()) setUploadingLogo(false); ticket.end() }
  }

  const set = (k: keyof Profile, v: string) => { if (!guard.active() || ready.current !== guard.identity) return; revision.current++; const next = { ...draft.current.profile, [k]: v }; draft.current = { ...draft.current, profile: next }; setProfile(next); setNotice('') }
  const applyExtraction = (d: { suggested: Partial<Profile>; gaps: string[] }) => {
    if (!canEdit()) return
    revision.current++
    const next = { ...draft.current.profile }
    for (const f of FIELDS) { const v = d.suggested[f.key]; if (typeof v === 'string' && v.trim()) next[f.key] = v }
    draft.current = { ...draft.current, profile: next }
    setProfile(next)
    setGaps(new Set(d.gaps)); setExtractionPreview(null)
    setNotice('抽出結果を入力しました。内容を確認して保存してください。')
  }
  const extract = async () => {
    if (!canEdit()) return
    if (!draft.current.extractUrl.trim()) { toast.error('自社URLを入力してください'); return }
    const ticket = guard.begin('mutation')
    if (!ticket) return
    const submittedRevision = revision.current
    setExtracting(true); setOperationError(''); setExtractionPreview(null)
    try {
      const d = await shodanSend<{ suggested: Partial<Profile>; gaps: string[] }>('/api/shodan/company-profile/extract', orgSlug, 'POST', { url: draft.current.extractUrl }, { signal: ticket.signal })
      if (!ticket.current()) return
      if (submittedRevision === revision.current) applyExtraction(d)
      else { setExtractionPreview(d); setNotice('抽出中の変更を保持しました。抽出結果を確認してから反映できます。') }
      setExtractLimitMessage(null)
    } catch (e) {
      if (!ticket.current()) return
      if (e instanceof ShodanApiError && e.code === 'SHODAN_PROFILE_DAILY_LIMIT') setExtractLimitMessage(e.message)
      else setOperationError(e instanceof Error ? e.message : '自社情報の抽出に失敗しました')
      if (e instanceof ShodanApiError && e.status === 401) guard.rejectAuthentication()
    } finally { if (ticket.current()) setExtracting(false); ticket.end() }
  }

  const save = async () => {
    if (!canEdit()) return
    const submitted = draft.current
    if (FIELDS.some(f => submitted.profile[f.key].trim().length > 4000)) { setOperationError('各項目は4000文字以内で入力してください。内容は切り詰めずに保持しています。'); return }
    const ticket = guard.begin('mutation')
    if (!ticket) return
    const submittedRevision = revision.current
    setSaving(true); setOperationError('')
    pendingWrite.current = true
    try {
      const result = await shodanSend<{ profile: Record<string, unknown> }>('/api/shodan/company-profile', orgSlug, 'PUT', { ...submitted.profile, brandColors: submitted.brandColors, logoPath: submitted.logoPath, expectedUpdatedAt: version.current }, { signal: ticket.signal })
      if (!ticket.current()) return
      version.current = readOrgProfile('shodan', result).version; pendingWrite.current = false; setConfirmed(null)
      if (submittedRevision === revision.current) { toast.success('自社情報を保存しました'); setNotice('自社情報を保存しました') }
      else setNotice('送信時の内容を保存しました。その後の変更は未保存です。')
    } catch (e) {
      if (!ticket.current()) return
      const rejected = e instanceof ShodanApiError && [400, 401, 403, 404, 409, 413, 422, 429].includes(e.status)
      pendingWrite.current = !rejected; setUncertain(!rejected || e instanceof ShodanApiError && e.status === 409)
      setOperationError(e instanceof Error ? e.message : '保存結果を確認できませんでした')
      if (e instanceof ShodanApiError && e.status === 401) guard.rejectAuthentication()
    } finally { if (ticket.current()) setSaving(false); ticket.end() }
  }

  // 充足度スコア（CORE基準）
  const { score, doneCount, mood, advice } = useMemo(() => {
    const statuses = CORE_FIELDS.map((k) => fieldStatus(profile[k], k, gaps))
    const done = statuses.filter((s) => s === 'ok').length
    const sc = Math.round((done / CORE_FIELDS.length) * 100)
    let m: Mood = 'thinking'; let a = 'まずは自社URLから自動入力してみましょう。'
    if (sc >= 100) { m = 'love'; a = 'バッチリです！この内容で提案が最適化されます。' }
    else if (sc >= 60) { m = 'thumbsup'; a = 'いい感じ！加筆推奨の項目を埋めると更に精度が上がります。' }
    else if (sc > 0) { m = 'point'; a = '加筆推奨（黄色）の項目を埋めていきましょう。' }
    return { score: sc, doneCount: done, mood: m, advice: a }
  }, [profile, gaps])

  if (guard.requiresLogin) return <div role="alert" className="p-6"><p>ログイン情報を確認できません。再度ログインしてください。</p><a className="mt-3 inline-block font-bold underline" href={`/auth/signin?callbackUrl=${encodeURIComponent(`/shodan/${orgSlug}/settings`)}`}>ログイン情報を再確認する</a></div>
  if (!guard.allowed || loading || !loadError && ready.current !== guard.identity) return <div className="p-10 text-center"><DoyaKun mood="thinking" size={72} /><p className="mt-2 text-slate-400 font-bold">読み込み中…</p></div>

  if (loadError) return <div className="max-w-2xl mx-auto p-6"><PageHeader icon="settings" title="自社情報" />
    <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
      <p className="font-bold">自社情報を読み込めませんでした。既存の設定を保護するため、確認できるまで編集できません。</p>
      <p className="mt-2 text-sm">{loadError}</p>
      <button type="button" onClick={() => setRetry(c => c + 1)} className="mt-4 font-bold underline">再試行</button>
    </div></div>

  const step = EXTRACT_STEPS[stepIdx]
  const extractPct = Math.round(((stepIdx + 1) / EXTRACT_STEPS.length) * 92)

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto">
      {operationError && <p role="alert" className="mb-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{operationError}</p>}
      {confirmed && <div className="mb-4 rounded-xl border border-slate-200 p-4 text-sm"><p className="font-bold">現在保存されている内容</p><p className="mt-1">入力中の内容を保存する前に、最新の設定と照合してください。</p>{confirmed.profile ? <dl className="mt-3 space-y-2">{FIELDS.map(f => <div key={f.key}><dt className="font-bold">{f.label}</dt><dd className="whitespace-pre-wrap break-words">{String(confirmed.profile?.[f.key] || '未設定')}</dd></div>)}<div><dt className="font-bold">ブランドカラー</dt><dd>{Array.isArray(confirmed.profile.brandColors) ? confirmed.profile.brandColors.join(', ') : '未設定'}</dd></div><div><dt className="font-bold">ロゴ</dt><dd>{confirmed.profile.logoPath ? '設定済み' : '未設定'}</dd></div></dl> : <p className="mt-2">まだ保存されていません。</p>}</div>}
      {notice && <p role="status" className="mb-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-800">{notice}</p>}
      {uncertain && <div role="alert" className="mb-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-950"><p>保存結果または最新の設定を確認するまで、続けて操作できません。入力内容は保持しています。</p><button type="button" disabled={checking} onClick={confirmSaved} className="mt-2 font-bold underline">{checking ? '確認中…' : '保存済みの設定を確認する'}</button></div>}
      {extractionPreview && <div className="mb-4 rounded-xl border p-4"><details><summary>抽出結果を確認する</summary>{FIELDS.map(f => <p key={f.key} className="mt-2 whitespace-pre-wrap break-words text-sm"><strong>{f.label}</strong><br />{extractionPreview.suggested[f.key]}</p>)}</details><button type="button" onClick={() => applyExtraction(extractionPreview)} className="mt-3 font-bold underline">抽出結果を反映する</button></div>}
      {/* ▼ 自社情報 抽出中 ド派手オーバーレイ ▼ */}
      {extracting && (
        <div className="fixed inset-0 z-[80] overflow-hidden flex items-center justify-center p-4
          bg-gradient-to-br from-purple-700 via-fuchsia-600 to-indigo-700">
          {/* 背景のキラキラ */}
          {['top-10 left-8','top-24 right-12','bottom-16 left-16','bottom-28 right-24','top-1/2 left-6','top-1/3 right-1/4'].map((pos, i) => (
            <span key={i} className={`material-symbols-outlined absolute ${pos} text-white/30 animate-ping`}
              style={{ fontSize: 18 + (i % 3) * 12, animationDuration: `${1.4 + i * 0.3}s` }}>
              {i % 2 ? 'star' : 'auto_awesome'}
            </span>
          ))}
          {/* 回転する光のリング */}
          <div className="absolute w-[520px] h-[520px] rounded-full border-2 border-white/10 border-t-white/40 animate-spin" style={{ animationDuration: '6s' }} />
          <div className="absolute w-[360px] h-[360px] rounded-full border-2 border-white/10 border-b-white/30 animate-spin" style={{ animationDuration: '4s', animationDirection: 'reverse' }} />

          <div className="relative z-10 w-full max-w-md text-center text-white">
            {/* ドヤくん（ステップごとに表情チェンジ＋ぴょこぴょこ） */}
            <div className="relative inline-block animate-bounce" style={{ animationDuration: '1.4s' }}>
              <div className="absolute inset-0 -z-10 blur-2xl bg-white/40 rounded-full scale-90" />
              <DoyaKun mood={step.mood} size={150} float={false} />
            </div>

            {/* いま何をしているか（特大） */}
            <div className="mt-3 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/15 backdrop-blur text-sm font-black">
              <span className="material-symbols-outlined animate-pulse" style={{ fontSize: 20 }}>{step.icon}</span>
              自社情報をAIが抽出中
            </div>
            <h2 className="mt-4 text-3xl font-black drop-shadow-sm leading-tight">{step.title}</h2>
            <p className="mt-2 text-white/90 font-bold">{step.sub}</p>
            <p className="mt-1 text-xs font-bold text-white/60 truncate px-6">{extractUrl}</p>

            {/* 進捗バー（シマー） */}
            <div className="mt-6 mx-auto max-w-xs">
              <div className="h-3 rounded-full bg-white/20 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-amber-300 via-white to-amber-300 bg-[length:200%_100%] animate-pulse transition-all duration-700 ease-out"
                  style={{ width: `${extractPct}%` }} />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs font-black text-white/80">
                <span>解析中…</span><span>{extractPct}%</span>
              </div>
            </div>

            {/* ステップ・ドット */}
            <div className="mt-5 flex items-center justify-center gap-1.5 flex-wrap px-4">
              {EXTRACT_STEPS.map((s, i) => (
                <span key={i} className={`material-symbols-outlined rounded-full p-1 transition-all ${
                  i < stepIdx ? 'text-emerald-300' : i === stepIdx ? 'text-white scale-125 bg-white/15' : 'text-white/30'}`}
                  style={{ fontSize: 18 }}>
                  {i < stepIdx ? 'check_circle' : s.icon}
                </span>
              ))}
            </div>
            <p className="mt-4 text-xs font-bold text-white/60">画面はそのままでOK。完了したら自動で反映されます ✨</p>
          </div>
        </div>
      )}
      {/* ▲ 抽出中オーバーレイ ▲ */}

      <PageHeader icon="business_center" title="自社情報" subtitle="ここに登録した情報をもとに、提案資料が「自社の商材・強み」に最適化されます。" />

      {/* 自動入力カード */}
      <div className="relative rounded-3xl bg-gradient-to-br from-purple-600 to-fuchsia-600 text-white p-6 pr-28 shadow-lg shadow-purple-500/20 mb-5 overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-1.5 font-black"><span className="material-symbols-outlined">auto_awesome</span>自社URLから自動入力</div>
          <p className="text-xs font-bold text-white/80 mt-1 mb-3">URLを入れるだけで、AIが自社情報を抽出して下書きします。</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input value={extractUrl} onChange={(e) => { if (!guard.active() || ready.current !== guard.identity) return; revision.current++; draft.current = { ...draft.current, extractUrl: e.target.value }; setExtractUrl(e.target.value); setNotice('') }} onKeyDown={(e) => e.key === 'Enter' && !extracting && extract()}
              aria-label="自社情報を抽出するURL" placeholder="https://自社サイト.co.jp" disabled={extracting || saving || uploadingLogo || uncertain || checking}
              className="flex-1 rounded-xl px-4 py-2.5 font-bold text-slate-800 outline-none disabled:opacity-60" />
            <button onClick={extract} disabled={extracting || saving || uploadingLogo || uncertain || checking}
              className="px-5 py-2.5 rounded-xl bg-white text-purple-700 font-black text-sm shadow hover:-translate-y-0.5 transition-all disabled:opacity-60 whitespace-nowrap">
              {extracting ? '抽出中…' : 'AIで自動入力'}
            </button>
          </div>
          {extractLimitMessage && <p role="alert" className="mt-3 rounded-lg bg-white px-3 py-2 text-xs font-bold text-purple-950">{extractLimitMessage}</p>}
        </div>
        <DoyaKun mood={extracting ? 'focus' : 'present'} size={110} className="!absolute -bottom-2 right-2" />
      </div>

      {/* 充足度メーター */}
      <div className="flex items-center gap-4 rounded-2xl bg-white border border-slate-200 p-4 mb-5">
        <DoyaKun mood={mood} size={64} float={false} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-black text-slate-700">情報の充実度</span>
            <span className="text-sm font-black text-purple-700">{score}%（{doneCount}/{CORE_FIELDS.length}）</span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-fuchsia-500 transition-all" style={{ width: `${score}%` }} />
          </div>
          <p className="text-xs font-bold text-slate-500 mt-1.5">{advice}</p>
        </div>
      </div>

      {/* ブランド設定（資料に反映） */}
      <div className="rounded-3xl bg-white border border-slate-200 p-6 shadow-sm mb-5">
        <div className="flex items-center gap-1.5 font-black text-slate-800 mb-1">{sym('palette', 20)}ブランド設定</div>
        <p className="text-xs font-bold text-slate-400 mb-4">ロゴとカラーは、提案スライドの<strong>基調色とロゴ合成</strong>に自動反映され、その会社に合った資料になります。</p>
        <div className="flex flex-wrap items-start gap-6">
          <div>
            <label className="block text-xs font-black text-slate-600 mb-1.5">ロゴ</label>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border-2 border-dashed border-slate-300 text-slate-600 font-black text-sm cursor-pointer hover:border-purple-400 transition-colors">
                {sym(uploadingLogo ? 'progress_activity' : 'upload', 18)}{uploadingLogo ? '送信中…' : logoUrl ? 'ロゴを変更' : 'ロゴをアップロード'}
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onLogo} disabled={uploadingLogo || extracting || saving || uncertain || checking} />
              </label>
              {logoUrl && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logoUrl} alt="logo" className="h-10 w-auto max-w-[120px] object-contain rounded border border-slate-200 bg-white p-1" />
                  <button type="button" disabled={uploadingLogo || extracting || saving || uncertain || checking} onClick={() => { if (canEdit()) { revision.current++; draft.current = { ...draft.current, logoPath: null }; setLogoPath(null); setLogoUrl(null); setNotice('ロゴを外しました。設定を保存すると反映されます。') } }} className="text-slate-400 hover:text-rose-500" title="ロゴを外す">{sym('close', 18)}</button>
                </>
              )}
            </div>
            <p className="text-[11px] font-bold text-slate-400 mt-1.5">PNG / JPG / WebP（5MBまで）</p>
          </div>
          <div>
            <label className="block text-xs font-black text-slate-600 mb-1.5">ブランドカラー</label>
            <div className="flex items-center gap-3">
              {Array.from({ length: Math.max(2, brandColors.length) }, (_, i) => i).map((i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <input type="color" aria-label={`ブランドカラー${i + 1}`} value={brandColors[i] || '#7f19e6'} onChange={(e) => { if (!guard.active() || ready.current !== guard.identity) return; revision.current++; const next = [...draft.current.brandColors]; next[i] = e.target.value; draft.current = { ...draft.current, brandColors: next }; setBrandColors(next); setNotice('') }} className="w-12 h-12 rounded-lg border border-slate-200 cursor-pointer" />
                  <span className="text-[10px] font-bold text-slate-400">{i === 0 ? 'メイン' : i === 1 ? 'アクセント' : `追加色${i + 1}`}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* フォーム */}
      <div className="rounded-3xl bg-white border border-slate-200 p-6 shadow-sm space-y-4">
        {FIELDS.map((f) => {
          const showStatus = f.key !== 'url'
          const st = fieldStatus(profile[f.key], f.key, gaps)
          const badge = STATUS_BADGE[st]
          return (
            <div key={f.key}>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor={`shodan-setting-${f.key}`} className="text-sm font-black text-slate-700">{f.label}</label>
                {showStatus && <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>}
              </div>
              {f.textarea ? (
                <textarea id={`shodan-setting-${f.key}`} value={profile[f.key]} maxLength={4000} onChange={(e) => set(f.key, e.target.value)} placeholder={f.placeholder} rows={3}
                  className={`w-full rounded-xl border-2 px-4 py-2.5 font-bold text-sm resize-y outline-none transition-colors ${st === 'weak' ? 'border-amber-300 focus:border-amber-400 bg-amber-50/30' : 'border-slate-200 focus:border-purple-400'}`} />
              ) : (
                <input id={`shodan-setting-${f.key}`} value={profile[f.key]} maxLength={4000} onChange={(e) => set(f.key, e.target.value)} placeholder={f.placeholder}
                  className="w-full rounded-xl border-2 border-slate-200 focus:border-purple-400 outline-none px-4 py-2.5 font-bold text-sm transition-colors" />
              )}
              {f.hint && st !== 'ok' && <p className="text-[11px] font-bold text-amber-600 mt-1 flex items-center gap-1">{sym('tips_and_updates', 14)}{f.hint}</p>}
            </div>
          )
        })}
        <button onClick={save} disabled={saving || extracting || uploadingLogo || uncertain || checking}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white font-black shadow-lg shadow-purple-500/25 hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
          {sym('save', 20)}{saving ? '保存中…' : '保存する'}
        </button>
      </div>
    </div>
  )
}
