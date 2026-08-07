'use client'

// ============================================
// ドヤ面接官 ダッシュボード（採用担当者向け）
// ============================================
// 組織作成 → 企業URL調査 → 質問セット生成 → 面接URL発行 までを1画面で完了させる。

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

interface Org {
  id: string
  name: string
  slug: string
  role: string
  retentionDays: number
  recordVideo: boolean
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

export default function MensetsuDashboard() {
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
  const [candidateName, setCandidateName] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState('')

  // ⚠️ useSession の status で fetch をゲートしない（Cookie認証なので未確定でもAPIは応答する）
  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/mensetsu/organizations')
      const data = await res.json()
      if (res.status === 401) {
        setOrg(null)
        return
      }
      setOrg(data?.current || null)
      if (data?.current) {
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
        setError(data?.error || '組織の作成に失敗しました')
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
        setError(data?.error || '解析に失敗しました')
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
        setError(data?.error || '生成に失敗しました')
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

  const issue = async () => {
    if (!selectedTemplate) return
    setBusy('issue')
    setError(null)
    try {
      const res = await fetch('/api/mensetsu/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: selectedTemplate, candidateName: candidateName.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error || '発行に失敗しました')
        return
      }
      setIssuedUrl(data.url)
      setCandidateName('')
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
        setError(data?.error || '評価に失敗しました')
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

  return (
    <main className="min-h-screen bg-[#f2f6ff] px-5 py-10 lg:px-8">
      <div className="mx-auto max-w-[1100px]">
        <p className="text-sm font-black text-[#0066ff]">ドヤ面接官</p>
        <h1 className="mt-2 text-3xl font-black leading-tight text-[#0a0f3c]">
          AIが一次面接を実施し、評価まで残す
        </h1>
        <p className="mt-3 max-w-[62ch] text-sm font-medium leading-relaxed text-[#425071]">
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
            <p className="mt-2 text-sm font-medium text-[#425071]">
              面接テンプレートや応募者の記録は、この組織単位で管理されます。
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="株式会社スリスタ"
                className="flex-1 rounded-lg border border-[#d8e7ff] px-4 py-3 text-sm font-medium outline-none focus:border-[#0066ff]"
              />
              <button
                onClick={createOrg}
                disabled={busy === 'org' || !orgName.trim()}
                className="rounded-lg bg-[#0066ff] px-6 py-3 text-sm font-black text-white disabled:bg-[#b9cdf5]"
              >
                {busy === 'org' ? '作成中…' : '組織を作成'}
              </button>
            </div>
            <p className="mt-3 text-xs font-medium text-[#8a94ad]">
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
                  className="flex-1 rounded-lg border border-[#d8e7ff] px-4 py-3 text-sm font-medium outline-none focus:border-[#0066ff]"
                />
                <button
                  onClick={analyze}
                  disabled={busy === 'analyze' || !url.trim()}
                  className="rounded-lg bg-[#0066ff] px-6 py-3 text-sm font-black text-white disabled:bg-[#b9cdf5]"
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
                      <dd className="mt-1 text-sm font-medium leading-relaxed text-[#0a0f3c]">
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
                  className="rounded-lg border border-[#d8e7ff] px-4 py-3 text-sm font-medium outline-none focus:border-[#0066ff]"
                />
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  className="rounded-lg border border-[#d8e7ff] px-4 py-3 text-sm font-medium outline-none focus:border-[#0066ff]"
                >
                  <option value="newgrad">新卒</option>
                  <option value="mid">中途</option>
                  <option value="manager">マネージャー</option>
                </select>
                <select
                  value={durationMin}
                  onChange={(e) => setDurationMin(Number(e.target.value))}
                  className="rounded-lg border border-[#d8e7ff] px-4 py-3 text-sm font-medium outline-none focus:border-[#0066ff]"
                >
                  <option value={10}>10分</option>
                  <option value={20}>20分</option>
                  <option value={30}>30分</option>
                </select>
                <input
                  value={focus}
                  onChange={(e) => setFocus(e.target.value)}
                  placeholder="特に見たい点（任意）"
                  className="rounded-lg border border-[#d8e7ff] px-4 py-3 text-sm font-medium outline-none focus:border-[#0066ff]"
                />
              </div>
              <button
                onClick={generate}
                disabled={busy === 'generate' || !jobTitle.trim()}
                className="mt-4 rounded-lg bg-[#0066ff] px-6 py-3 text-sm font-black text-white disabled:bg-[#b9cdf5]"
              >
                {busy === 'generate' ? '生成中…（30秒ほどかかります）' : '質問セットを生成'}
              </button>

              {templates.length > 0 && (
                <ul className="mt-5 divide-y divide-[#eef3ff]">
                  {templates.map((t) => (
                    <li key={t.id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-sm font-black text-[#0a0f3c]">{t.name}</p>
                        <p className="text-xs font-medium text-[#425071]">
                          質問{t._count?.questions ?? 0}問 / 評価軸{t._count?.criteria ?? 0}個 / 面接{t._count?.sessions ?? 0}件
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-lg bg-[#f7faff] px-3 py-1.5 text-xs font-black text-[#425071]">
                          {t.status === 'draft' ? '下書き' : t.status === 'active' ? '運用中' : '保管'}
                        </span>
                        <Link
                          href={`/mensetsu/templates/${t.id}`}
                          className="rounded-lg border border-[#d8e7ff] px-4 py-2 text-xs font-black text-[#0066ff]"
                        >
                          編集
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* --- 3. 面接URL発行 --- */}
            <section className="mt-6 rounded-lg bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0066ff] text-xs font-black text-white">3</span>
                <h2 className="text-base font-black text-[#0a0f3c]">応募者に面接URLを送る</h2>
              </div>
              {templates.length === 0 ? (
                <p className="mt-3 text-sm font-medium text-[#425071]">先に質問セットを作成してください。</p>
              ) : (
                <>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <select
                      value={selectedTemplate}
                      onChange={(e) => setSelectedTemplate(e.target.value)}
                      className="flex-1 rounded-lg border border-[#d8e7ff] px-4 py-3 text-sm font-medium outline-none focus:border-[#0066ff]"
                    >
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                    <input
                      value={candidateName}
                      onChange={(e) => setCandidateName(e.target.value)}
                      placeholder="応募者名（任意）"
                      className="rounded-lg border border-[#d8e7ff] px-4 py-3 text-sm font-medium outline-none focus:border-[#0066ff]"
                    />
                    <button
                      onClick={issue}
                      disabled={busy === 'issue'}
                      className="rounded-lg bg-[#0066ff] px-6 py-3 text-sm font-black text-white disabled:bg-[#b9cdf5]"
                    >
                      {busy === 'issue' ? '発行中…' : 'URLを発行'}
                    </button>
                  </div>
                  {issuedUrl && (
                    <div className="mt-4 rounded-lg bg-[#f7faff] p-4">
                      <p className="text-xs font-black text-[#0066ff]">発行された面接URL</p>
                      <p className="mt-1 break-all text-sm font-bold text-[#0a0f3c]">{issuedUrl}</p>
                      <button
                        onClick={() => navigator.clipboard?.writeText(issuedUrl)}
                        className="mt-3 rounded-lg border border-[#d8e7ff] px-4 py-2 text-xs font-black text-[#0066ff]"
                      >
                        コピー
                      </button>
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
                <p className="mt-3 text-sm font-medium text-[#425071]">まだ面接はありません。</p>
              ) : (
                <ul className="mt-4 divide-y divide-[#eef3ff]">
                  {sessions.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div>
                        <p className="text-sm font-black text-[#0a0f3c]">
                          {s.candidateName || '（名前未入力）'}
                          <span className="ml-2 text-xs font-bold text-[#425071]">{s.template.jobTitle}</span>
                        </p>
                        <p className="text-xs font-medium text-[#425071]">
                          {STATUS_LABEL[s.status] || s.status}
                          {s.verdict && ` / ${VERDICT_LABEL[s.verdict] || s.verdict}`}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {s.status === 'completed' && (
                          <button
                            onClick={() => evaluate(s.id)}
                            disabled={busy === `eval-${s.id}`}
                            className="rounded-lg bg-[#0066ff] px-4 py-2 text-xs font-black text-white disabled:bg-[#b9cdf5]"
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
          </>
        )}
      </div>
    </main>
  )
}
