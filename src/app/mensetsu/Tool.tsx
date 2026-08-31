'use client'

// ============================================
// ドヤ面接官 ダッシュボード（採用担当者向け）
// ============================================
// 組織作成 → 企業URL調査 → 質問セット生成 → 面接URL発行 までを1画面で完了させる。

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import MensetsuLp from './Lp'
import { notifyError } from '@/lib/ui/notify'
import LoadingProgress from '@/components/LoadingProgress'

interface Org {
  id: string
  name: string
  slug: string
  role: string
  retentionDays: number
  recordAudio: boolean
  discloseToCandidate: boolean
}
interface Profile {
  id: string
  companyName: string | null
  business: string | null
  valueProp: string | null
  culture: string | null
  idealProfile: string | null
  sourceUrl: string
}
interface Template {
  id: string
  name: string
  jobTitle: string
  level: string
  durationMin: number
  status: string
  _count?: { questions: number; criteria: number; sessions: number }
  /** 一覧で中身を見せるための質問と評価軸（編集を開かなくても確かめられるように） */
  questions?: Array<{ id: string; ord: number; text: string; targetMin: number }>
  criteria?: Array<{ id: string; name: string }>
}
interface SessionRow {
  id: string
  token: string
  candidateName: string | null
  status: string
  verdict: string | null
  expiresAt: string
  template: { name: string; jobTitle: string }
}

const STATUS_LABEL: Record<string, string> = {
  pending: '未実施',
  consented: '準備完了',
  live: '実施中',
  completed: '評価待ち',
  evaluated: '評価済み',
  expired: '期限切れ',
  aborted: '中断',
}

const VERDICT_LABEL: Record<string, string> = {
  recommend: '推奨',
  conditional: '条件付き推奨',
  hold: '保留',
  reject: '見送り',
}

export default function MensetsuTool() {
  const [org, setOrg] = useState<Org | null>(null)
  const [loading, setLoading] = useState(true)
  const [orgName, setOrgName] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [url, setUrl] = useState('')
  const [profile, setProfile] = useState<Profile | null>(null)

  const [jobTitle, setJobTitle] = useState('')
  const [level, setLevel] = useState('mid')
  const [durationMin, setDurationMin] = useState(20)
  const [focus, setFocus] = useState('')
  const [templates, setTemplates] = useState<Template[]>([])
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [issuedUrl, setIssuedUrl] = useState<string | null>(null)
  /** 発行直後のコピーボタンを押したことが分かるようにする */
  const [issuedCopied, setIssuedCopied] = useState(false)
  const [candidateName, setCandidateName] = useState('')
  /** 一覧から「URLをコピー」した面接。押したことが分かるように印を出す */
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState('')
  /** 未ログイン。⚠️ 組織が無いのか、そもそもログインしていないのかを区別する。
   *  区別しないと、未ログインの人に「組織を作成」フォームを見せてしまい、
   *  押しても401で何も起きない（何が悪いのか分からない画面になる）。 */
  const [needsLogin, setNeedsLogin] = useState(false)

  // ⚠️ useSession の status で fetch をゲートしない（Cookie認証なので未確定でもAPIは応答する）
  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/mensetsu/organizations')
      const data = await res.json()
      if (res.status === 401) {
        setOrg(null)
        setNeedsLogin(true)
        return
      }
      setNeedsLogin(false)
      setOrg(data?.current || null)
      if (data?.current) {
        // ⚠️ メンバーはこの画面では使わない（/mensetsu/settings が自分で取得する）
        const [t, s] = await Promise.all([
          fetch('/api/mensetsu/templates').then((r) => r.json()),
          fetch('/api/mensetsu/sessions').then((r) => r.json()),
        ])
        setTemplates(t?.templates || [])
        setSessions(s?.sessions || [])
        if (t?.templates?.[0]) setSelectedTemplate(t.templates[0].id)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const createOrg = async () => {
    if (!orgName.trim()) return
    setBusy('org')
    setError(null)
    try {
      const res = await fetch('/api/mensetsu/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: orgName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        notifyError(setError, data?.error || '組織の作成に失敗しました')
        return
      }
      await load()
    } finally {
      setBusy(null)
    }
  }

  const analyze = async () => {
    if (!url.trim()) return
    setBusy('analyze')
    setError(null)
    try {
      const res = await fetch('/api/mensetsu/company/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        notifyError(setError, data?.error || '解析に失敗しました')
        return
      }
      setProfile(data.profile)
      setNotice(`${data.pageCount}ページを読み取りました`)
    } finally {
      setBusy(null)
    }
  }

  const generate = async () => {
    if (!jobTitle.trim()) return
    setBusy('generate')
    setError(null)
    setNotice(null)
    try {
      const res = await fetch('/api/mensetsu/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: profile?.id,
          jobTitle: jobTitle.trim(),
          level,
          durationMin,
          focus: focus.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        notifyError(setError, data?.error || '生成に失敗しました')
        return
      }
      const removed = data?.removedByGuardrail || []
      setNotice(
        removed.length > 0
          ? `質問${data.template.questions.length}問・評価軸${data.template.criteria.length}個を作成しました。就職差別につながる質問を${removed.length}件除外しています。`
          : `質問${data.template.questions.length}問・評価軸${data.template.criteria.length}個を作成しました。`
      )
      await load()
    } finally {
      setBusy(null)
    }
  }

  /** 面接URLを組み立てる。メールを使わず手でお渡しする運用のため */
  const liveUrl = (token: string) => `${window.location.origin}/mensetsu/live/${token}`

  const copyUrl = async (s: SessionRow) => {
    try {
      await navigator.clipboard.writeText(liveUrl(s.token))
      setCopiedId(s.id)
      setTimeout(() => setCopiedId((c) => (c === s.id ? null : c)), 2500)
    } catch {
      // ⚠️ 「詳細画面をご覧ください」と案内しないこと。詳細画面はURLを表示しない。
      //    コピーできない環境（http・古いブラウザ）でも渡せるよう、URLそのものを出す。
      notifyError(setError, `コピーできませんでした。次のURLをお使いください: ${liveUrl(s.token)}`)
    }
  }

  const issue = async () => {
    if (!selectedTemplate) return
    setBusy('issue')
    setError(null)
    try {
      const res = await fetch('/api/mensetsu/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: selectedTemplate,
          candidateName: candidateName.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        notifyError(setError, data?.error || '発行に失敗しました')
        return
      }
      setIssuedUrl(data.url)
      setCandidateName('')
      await load()
    } finally {
      setBusy(null)
    }
  }

  /**
   * 組織設定の保存。
   * ⚠️ recordAudio / retentionDays は応募者に見せる同意文面に直結する。
   *    ここを変えると次の面接から同意画面の記載も変わる。
   */

  /**
   * 実施中のまま残った面接を担当者が閉じる。
   * 応募者のブラウザがクラッシュすると /end に到達せず live で固着し、
   * 1件でもあるとテンプレートの質問編集が 409 でブロックされるため、
   * 手動の出口を用意している。
   */
  const closeSession = async (id: string) => {
    setBusy(`close-${id}`)
    setError(null)
    try {
      const res = await fetch(`/api/mensetsu/sessions/${id}/close`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        notifyError(setError, data?.error || '終了処理に失敗しました')
        return
      }
      setNotice(data.status === 'completed' ? '面接を終了しました（評価できます）' : '面接を終了しました')
      await load()
    } finally {
      setBusy(null)
    }
  }

  /** 誤って終了扱いになった面接を、受験可能な状態に戻す */
  const reopenSession = async (id: string) => {
    setBusy(`reopen-${id}`)
    setError(null)
    try {
      const res = await fetch(`/api/mensetsu/sessions/${id}/close`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        notifyError(setError, data?.error || '戻せませんでした')
        return
      }
      setNotice('受験可能に戻しました。同じURLで受けられます。')
      await load()
    } finally {
      setBusy(null)
    }
  }



  const evaluate = async (id: string) => {
    setBusy(`eval-${id}`)
    setError(null)
    try {
      const res = await fetch(`/api/mensetsu/sessions/${id}/evaluate`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        notifyError(setError, data?.error || '評価に失敗しました')
        return
      }
      await load()
    } finally {
      setBusy(null)
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f2f6ff]">
        <p className="text-sm font-bold text-[#425071]">読み込んでいます…</p>
      </main>
    )
  }

  // ⚠️ 未ログインの方にはLPを見せる。以前は組織作成フォームを出しており、
  //    押しても401で何も起きない画面になっていた。
  if (needsLogin) {
    return <MensetsuLp />
  }

  return (
    <main className="min-h-screen bg-[#f2f6ff] px-5 py-10 lg:px-8">
      {/* ⚠️ AI処理中は全画面で「何をしているか」を出す。無言で待たせない */}
      <LoadingProgress
        isLoading={busy === 'analyze'}
        operationKey="mensetsu-analyze"
        title="企業ページを読み取っています"
        subtitle="事業内容と求める人物像を抽出しています。"
        tips={['Tip: 採用ページのURLを入れると人物像の精度が上がります', 'Tip: 読み取った内容は後から編集できます']}
      />
      <LoadingProgress
        isLoading={busy === 'generate'}
        operationKey="mensetsu-generate"
        title="質問セットを作っています"
        subtitle="職種とレベルに合わせて、質問と評価軸・ルーブリックを組み立てています。"
        tips={['Tip: 就職差別につながる質問は生成の時点で除外されます', 'Tip: 全応募者に同じ主質問を当てる構造化面接の方式です', 'Tip: 生成後に質問は自由に編集できます']}
      />
      <div className="mx-auto max-w-[1100px]">
        <p className="text-sm font-black text-[#0066ff]">ドヤ面接官</p>
        <h1 className="mt-2 text-3xl font-black leading-tight text-[#0a0f3c]">
          AIが一次面接を実施し、評価まで残す
        </h1>
        <p className="mt-3 max-w-[62ch] text-sm font-semibold leading-relaxed text-[#425071]">
          企業URLから質問セットと評価基準を自動生成し、応募者はURLを開くだけで面接を受けられます。
          判定は「推薦度」であり、<strong className="font-black text-[#0a0f3c]">最終的な選考の判断は必ず人が行います。</strong>
        </p>

        {error && (
          <div className="mt-5 rounded-lg border border-[#ffd0de] bg-[#fff2f6] p-4 text-sm font-bold text-[#c2185b]">
            {error}
          </div>
        )}
        {notice && (
          <div className="mt-5 rounded-lg border border-[#cfe3ff] bg-white p-4 text-sm font-bold text-[#0a0f3c]">
            {notice}
          </div>
        )}

        {/* --- 組織が無い: オンボーディング --- */}
        {!org ? (
          <section className="mt-8 rounded-lg bg-white p-6 shadow-sm">
            <h2 className="text-base font-black text-[#0a0f3c]">はじめに組織を作成します</h2>
            <p className="mt-2 text-sm font-semibold text-[#425071]">
              面接テンプレートや応募者の記録は、この組織単位で管理されます。
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="株式会社スリスタ"
                className="flex-1 rounded-xl border-2 border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-[#0066ff]"
              />
              <button
                onClick={createOrg}
                disabled={busy === 'org' || !orgName.trim()}
                className="rounded-lg bg-[#0066ff] px-6 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:translate-y-0 disabled:hover:bg-slate-200 disabled:hover:translate-y-0"
              >
                {busy === 'org' ? '作成中…' : '組織を作成'}
              </button>
            </div>
            <p className="mt-3 text-xs font-semibold text-[#8a94ad]">
              ログインしていない場合は、先にログインが必要です。
            </p>
          </section>
        ) : (
          <>
            {/* --- 1. 企業URL調査 --- */}
            <section className="mt-8 rounded-lg bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0066ff] text-xs font-black text-white">1</span>
                <h2 className="text-base font-black text-[#0a0f3c]">企業URLを読み取る</h2>
              </div>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.co.jp"
                  className="flex-1 rounded-xl border-2 border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-[#0066ff]"
                />
                <button
                  onClick={analyze}
                  disabled={busy === 'analyze' || !url.trim()}
                  className="rounded-lg bg-[#0066ff] hover:bg-[#0052cc] shadow-lg shadow-[#0066ff]/25 transition-all hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.98] px-6 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:translate-y-0 disabled:hover:bg-slate-200 disabled:hover:translate-y-0"
                >
                  {busy === 'analyze' ? '読み取り中…' : '読み取る'}
                </button>
              </div>

              {profile && (
                <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                  {[
                    ['会社名', profile.companyName],
                    ['事業内容', profile.business],
                    ['提供価値', profile.valueProp],
                    ['カルチャー', profile.culture],
                    ['求める人物像', profile.idealProfile],
                  ].map(([label, value]) => (
                    <div key={label as string} className="rounded-lg bg-[#f7faff] p-4">
                      <dt className="text-xs font-black text-[#0066ff]">{label}</dt>
                      <dd className="mt-1 text-sm font-semibold leading-relaxed text-[#0a0f3c]">
                        {value || <span className="text-[#8a94ad]">（サイトから読み取れませんでした）</span>}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>

            {/* --- 2. 質問セット生成 --- */}
            <section className="mt-6 rounded-lg bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0066ff] text-xs font-black text-white">2</span>
                <h2 className="text-base font-black text-[#0a0f3c]">質問セットと評価基準を作る</h2>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <input
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="職種（例: フィールドセールス）"
                  className="rounded-xl border-2 border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-[#0066ff]"
                />
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  className="rounded-xl border-2 border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-[#0066ff]"
                >
                  <option value="newgrad">新卒</option>
                  <option value="mid">中途</option>
                  <option value="manager">マネージャー</option>
                </select>
                <select
                  value={durationMin}
                  onChange={(e) => setDurationMin(Number(e.target.value))}
                  className="rounded-xl border-2 border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-[#0066ff]"
                >
                  <option value={10}>10分</option>
                  <option value={20}>20分</option>
                  <option value={30}>30分</option>
                </select>
                <input
                  value={focus}
                  onChange={(e) => setFocus(e.target.value)}
                  placeholder="特に見たい点（任意）"
                  className="rounded-xl border-2 border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-[#0066ff]"
                />
              </div>
              <button
                onClick={generate}
                disabled={busy === 'generate' || !jobTitle.trim()}
                className="mt-4 rounded-lg bg-[#0066ff] hover:bg-[#0052cc] shadow-lg shadow-[#0066ff]/25 transition-all hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.98] px-6 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:translate-y-0 disabled:hover:bg-slate-200 disabled:hover:translate-y-0"
              >
                {busy === 'generate' ? '生成中…（30秒ほどかかります）' : '質問セットを生成'}
              </button>

              {templates.length > 0 && (
                <ul className="mt-5 space-y-3">
                  {templates.map((t) => (
                    <li key={t.id} className="rounded-xl bg-[#f7faff] p-4 ring-1 ring-[#e3edff]">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-black text-[#0a0f3c]">{t.name}</p>
                          <p className="text-xs font-semibold text-[#425071]">
                            {t.durationMin}分 / 質問{t._count?.questions ?? 0}問 / 評価軸{t._count?.criteria ?? 0}個 / 面接{t._count?.sessions ?? 0}件
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* ⚠️ これは状態の表示であって押せるものではない。隣の「編集」と
                               同じ角丸の枠にすると、押せるボタンに見えてしまう。 */}
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${
                              t.status === 'draft'
                                ? 'bg-amber-50 text-amber-800 ring-amber-200'
                                : t.status === 'active'
                                  ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
                                  : 'bg-slate-100 text-slate-500 ring-slate-200'
                            }`}
                          >
                            {t.status === 'draft' ? '下書き' : t.status === 'active' ? '運用中' : '保管'}
                          </span>
                          <Link
                            href={`/mensetsu/templates/${t.id}`}
                            className="rounded-lg border border-[#d8e7ff] bg-white px-4 py-2 text-xs font-black text-[#0066ff]"
                          >
                            編集
                          </Link>
                        </div>
                      </div>

                      {/* ⚠️ 質問の中身は「編集」を開かないと見えなかった。
                           送る前に何を聞く面接なのか確かめられないのは危ないので、
                           ここに全問そのまま出す（折りたたまない）。 */}
                      {t.questions && t.questions.length > 0 && (
                        <ol className="mt-4 space-y-2 border-t border-[#e3edff] pt-4">
                          {t.questions.map((q, qi) => (
                            <li key={q.id} className="flex gap-2.5">
                              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0066ff] text-[11px] font-black text-white">
                                {qi + 1}
                              </span>
                              <p className="text-sm font-semibold leading-relaxed text-[#0a0f3c]">
                                {q.text}
                                <span className="ml-2 text-xs font-bold text-[#8a94ad]">約{q.targetMin}分</span>
                              </p>
                            </li>
                          ))}
                        </ol>
                      )}

                      {t.criteria && t.criteria.length > 0 && (
                        <div className="mt-4 border-t border-[#e3edff] pt-3">
                          <p className="text-xs font-black text-[#425071]">評価軸</p>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {t.criteria.map((c) => (
                              <span
                                key={c.id}
                                className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-[#425071] ring-1 ring-[#d8e7ff]"
                              >
                                {c.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* --- 3. 面接URL発行 ---
                 ⚠️ ここまで来れば担当者の作業は完了。手順の終点だと分かるよう、
                    他のセクションより大きく・強く見せる（枠・余白・文字とも） */}
            <section className="mt-8 rounded-2xl bg-white p-6 shadow-md ring-2 ring-[#0066ff] sm:p-9">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0066ff] text-base font-black text-white">3</span>
                <div>
                  <h2 className="text-xl font-black text-[#0a0f3c] sm:text-2xl">応募者に面接URLを送る</h2>
                  <p className="mt-0.5 text-sm font-bold text-[#0066ff]">URLを送れたら、ここで完了です</p>
                </div>
              </div>
              {templates.length === 0 ? (
                <p className="mt-3 text-sm font-semibold text-[#425071]">先に質問セットを作成してください。</p>
              ) : (
                <>
                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-black text-[#425071]">質問セット</span>
                      <select
                        value={selectedTemplate}
                        onChange={(e) => setSelectedTemplate(e.target.value)}
                        className="w-full rounded-xl border-2 border-slate-200 px-4 py-3.5 text-base font-semibold outline-none focus:border-[#0066ff]"
                      >
                        {templates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                            {t.status === 'draft' ? '（下書き）' : t.status === 'archived' ? '（保管）' : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-black text-[#425071]">応募者名（必須）</span>
                      <input
                        value={candidateName}
                        onChange={(e) => setCandidateName(e.target.value)}
                        placeholder="山田 太郎"
                        className="w-full rounded-xl border-2 border-slate-200 px-4 py-3.5 text-base font-semibold outline-none focus:border-[#0066ff]"
                      />
                    </label>
                  </div>
                  {/* ⚠️ 横一列の大きなボタン。ここが手順の終点なので、
                       他の操作と同じ大きさにしないこと */}
                  <button
                    onClick={issue}
                    // ⚠️ 応募者名は必須。空のまま発行すると「誰の面接か分からないURL」ができ、
                    //    あとで候補者を比較できなくなる。
                    disabled={busy === 'issue' || !candidateName.trim()}
                    className="mt-5 w-full rounded-xl bg-[#0066ff] px-6 py-5 text-lg font-black text-white shadow-lg transition hover:bg-[#0052cc] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:hover:bg-slate-200 sm:text-xl"
                  >
                    {busy === 'issue' ? '発行中…' : '面接URLを発行する'}
                  </button>
                  {templates.find((t) => t.id === selectedTemplate)?.status === 'draft' && (
                    <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 ring-1 ring-amber-200">
                      下書きの質問セットを選んでいます。このまま発行すると、応募者は未完成の質問で面接を受けます。
                    </p>
                  )}
                  {issuedUrl && (
                    <div className="mt-6 rounded-2xl bg-[#eaf3ff] p-6 ring-2 ring-[#0066ff] sm:p-7">
                      <p className="text-lg font-black text-[#0a0f3c] sm:text-xl">
                        面接URLを発行しました
                      </p>
                      <p className="mt-1 text-base font-black text-[#0066ff] sm:text-lg">
                        下のURLをコピーして、応募者にお送りください
                      </p>
                      <p className="mt-4 break-all rounded-xl bg-white px-4 py-4 text-base font-bold text-[#0a0f3c] ring-1 ring-[#d8e7ff]">
                        {issuedUrl}
                      </p>
                      {/* ⚠️ ここが最後の操作。小さいボタンにすると見落とされる */}
                      <button
                        onClick={() => {
                          navigator.clipboard?.writeText(issuedUrl)
                          setIssuedCopied(true)
                          window.setTimeout(() => setIssuedCopied(false), 2000)
                        }}
                        className="mt-4 w-full rounded-xl bg-[#0066ff] px-6 py-4 text-base font-black text-white shadow-lg transition hover:bg-[#0052cc] sm:text-lg"
                      >
                        {issuedCopied ? 'コピーしました' : 'URLをコピーする'}
                      </button>
                      <p className="mt-4 text-sm font-semibold leading-relaxed text-[#425071]">
                        応募者はこのURLを開くだけで面接を受けられます。ログインは不要です。
                        URLは下の面接一覧からいつでもコピーし直せます。
                      </p>
                    </div>
                  )}
                </>
              )}
            </section>

            {/* --- 4. 面接一覧 --- */}
            <section className="mt-6 rounded-lg bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-black text-[#0a0f3c]">面接一覧</h2>
                {sessions.some((s) => s.status === 'evaluated') && (
                  <Link
                    href="/mensetsu/compare"
                    className="flex items-center gap-1.5 rounded-lg border border-[#d8e7ff] px-4 py-2 text-xs font-black text-[#0066ff]"
                  >
                    <span className="material-symbols-outlined text-[16px]">table_chart</span>
                    候補者を比較
                  </Link>
                )}
              </div>
              {sessions.length === 0 ? (
                <p className="mt-3 text-sm font-semibold text-[#425071]">まだ面接はありません。</p>
              ) : (
                <ul className="mt-4 divide-y divide-[#eef3ff]">
                  {sessions.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div>
                        <p className="text-sm font-black text-[#0a0f3c]">
                          {s.candidateName || '（名前未入力）'}
                          <span className="ml-2 text-xs font-bold text-[#425071]">{s.template.jobTitle}</span>
                        </p>
                        <p className="text-xs font-semibold text-[#425071]">
                          {STATUS_LABEL[s.status] || s.status}
                          {s.verdict && ` / ${VERDICT_LABEL[s.verdict] || s.verdict}`}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {/* 面接のお渡し方はURLの手渡しのみ。
                            ⚠️ 発行直後にしかURLが取れないと、画面を離れた時点で
                               面接を発行し直すしかなくなる */}
                        {['pending', 'consented'].includes(s.status) && (
                          <>
                            <button
                              onClick={() => void copyUrl(s)}
                              className="rounded-lg border border-[#d8e7ff] px-4 py-2 text-xs font-black text-[#0066ff]"
                              title="面接URLをコピーして、応募者にお渡しできます"
                            >
                              {copiedId === s.id ? 'コピーしました' : 'URLをコピー'}
                            </button>
                          </>
                        )}
                        {s.status === 'aborted' && (
                          <button
                            onClick={() => reopenSession(s.id)}
                            disabled={busy === `reopen-${s.id}`}
                            className="rounded-lg border border-[#d8e7ff] px-4 py-2 text-xs font-black text-[#0066ff] disabled:opacity-50"
                            title="受験前に誤って終了扱いになった面接を、同じURLで受けられる状態に戻します"
                          >
                            {busy === `reopen-${s.id}` ? '処理中…' : '受験可能に戻す'}
                          </button>
                        )}
                        {['pending', 'consented', 'live'].includes(s.status) && (
                          <button
                            onClick={() => closeSession(s.id)}
                            disabled={busy === `close-${s.id}`}
                            className="rounded-lg border border-[#d8e7ff] px-4 py-2 text-xs font-black text-[#425071] disabled:opacity-50"
                            title="応募者が離脱したまま実施中で止まっている場合に使います"
                          >
                            {busy === `close-${s.id}` ? '処理中…' : '終了にする'}
                          </button>
                        )}
                        {s.status === 'completed' && (
                          <button
                            onClick={() => evaluate(s.id)}
                            disabled={busy === `eval-${s.id}`}
                            className="rounded-lg bg-[#0066ff] px-4 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:translate-y-0 disabled:hover:bg-slate-200 disabled:hover:translate-y-0"
                          >
                            {busy === `eval-${s.id}` ? '評価中…' : '評価する'}
                          </button>
                        )}
                        <Link
                          href={`/mensetsu/sessions/${s.id}`}
                          className="rounded-lg border border-[#d8e7ff] px-4 py-2 text-xs font-black text-[#0066ff]"
                        >
                          詳細
                        </Link>
                      </div>

                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* ⚠️ メンバーと記録の設定は /mensetsu/settings に移した。
                 面接の作成・発行・一覧の下に毎回並ぶと、日常の作業のたびに
                 スクロールで通過させられるため、ここには戻さないこと。 */}
            <p className="mt-6 text-xs font-semibold text-[#8a94ad]">
              メンバーの招待、録音や保持日数の設定は{' '}
              <Link href="/mensetsu/settings" className="font-black text-[#0066ff] underline">
                設定
              </Link>
              　から行えます。
            </p>
          </>
        )}
      </div>
    </main>
  )
}
