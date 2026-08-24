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
}
interface Member {
  id: string
  role: string
  status: string
  name: string | null
  inviteEmail: string | null
  userId: string | null
}
interface SessionRow {
  id: string
  token: string
  candidateName: string | null
  candidateEmail: string | null
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
const ROLE_LABEL: Record<string, string> = {
  owner: 'オーナー',
  admin: '管理者',
  manager: 'マネージャー',
  member: 'メンバー',
}
const ROLE_RANK: Record<string, number> = { owner: 4, admin: 3, manager: 2, member: 1 }

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
  const [candidateName, setCandidateName] = useState('')
  const [candidateEmail, setCandidateEmail] = useState('')
  /** 一覧から「URLをコピー」した面接。押したことが分かるように印を出す */
  const [copiedId, setCopiedId] = useState<string | null>(null)
  /** ご本人確認用メールの修正パネルを開いている面接 */
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingEmail, setEditingEmail] = useState('')
  const [editResult, setEditResult] = useState<{ id: string; ok: boolean; message: string } | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [members, setMembers] = useState<Member[]>([])
  const [myRole, setMyRole] = useState<string>('member')
  const [myUserId, setMyUserId] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
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
        const [t, s, m] = await Promise.all([
          fetch('/api/mensetsu/templates').then((r) => r.json()),
          fetch('/api/mensetsu/sessions').then((r) => r.json()),
          fetch('/api/mensetsu/members').then((r) => r.json()),
        ])
        setTemplates(t?.templates || [])
        setSessions(s?.sessions || [])
        setMembers(m?.members || [])
        setMyRole(m?.myRole || 'member')
        setMyUserId(m?.myUserId || null)
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

  /** ご本人確認用メールの修正。打ち間違いのままだと応募者が先へ進めなくなる */
  const updateCandidateEmail = async (s: SessionRow) => {
    setBusy(`email-${s.id}`)
    setEditResult(null)
    try {
      const res = await fetch(`/api/mensetsu/sessions/${s.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateEmail: editingEmail.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setEditResult({ id: s.id, ok: false, message: data?.error || '変更できませんでした' })
        return
      }
      const base = data.session.candidateEmail
        ? `ご本人確認を ${data.session.candidateEmail} に変更しました。`
        : 'ご本人確認を行わない設定にしました。'
      // 同意済みの面接は同意からやり直しになる。担当者が知らないと
      // 「応募者がもう一度同意画面から始めている」ことに驚く
      setEditResult({
        id: s.id,
        ok: true,
        message: data.reconsentRequired
          ? `${base} 同意済みでしたので、応募者にはもう一度同意画面からお進みいただきます。`
          : base,
      })
      // ⚠️ ここで setEditingId(null) しないこと。成功メッセージはこのパネルの
      //    中に描画しているため、閉じると一瞬も表示されず、
      //    打ち間違いを直せたのかどうか担当者に分からない（失敗時だけ見える状態だった）。
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
        body: JSON.stringify({
          templateId: selectedTemplate,
          candidateName: candidateName.trim() || undefined,
          candidateEmail: candidateEmail.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        notifyError(setError, data?.error || '発行に失敗しました')
        return
      }
      setIssuedUrl(data.url)
      setCandidateName('')
      setCandidateEmail('')
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
  const saveSettings = async (patch: Record<string, unknown>) => {
    setBusy('settings')
    setError(null)
    setNotice(null)
    try {
      const res = await fetch('/api/mensetsu/organizations/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const data = await res.json()
      if (!res.ok) {
        notifyError(setError, data?.error || '設定の保存に失敗しました')
        return
      }
      setNotice('設定を保存しました')
      await load()
    } finally {
      setBusy(null)
    }
  }

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

  const invite = async () => {
    if (!inviteEmail.trim()) return
    setBusy('invite')
    setError(null)
    setInviteUrl(null)
    try {
      const res = await fetch('/api/mensetsu/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      })
      const data = await res.json()
      if (!res.ok) {
        notifyError(setError, data?.error || '招待に失敗しました')
        return
      }
      setInviteEmail('')
      // メール送信に失敗しても招待自体は成立する。URLを手で渡せるように出す。
      setNotice(data.emailSent ? '招待メールを送りました' : 'メールを送れませんでした。下のURLを直接お渡しください。')
      if (!data.emailSent) setInviteUrl(data.url)
      await load()
    } finally {
      setBusy(null)
    }
  }

  const removeMember = async (id: string) => {
    setBusy(`member-${id}`)
    setError(null)
    try {
      const res = await fetch(`/api/mensetsu/members/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        notifyError(setError, data?.error || '外せませんでした')
        return
      }
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
                <ul className="mt-5 divide-y divide-[#eef3ff]">
                  {templates.map((t) => (
                    <li key={t.id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-sm font-black text-[#0a0f3c]">{t.name}</p>
                        <p className="text-xs font-semibold text-[#425071]">
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
                <p className="mt-3 text-sm font-semibold text-[#425071]">先に質問セットを作成してください。</p>
              ) : (
                <>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <select
                      value={selectedTemplate}
                      onChange={(e) => setSelectedTemplate(e.target.value)}
                      className="flex-1 rounded-xl border-2 border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-[#0066ff]"
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
                      className="rounded-xl border-2 border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-[#0066ff]"
                    />
                    <input
                      type="email"
                      value={candidateEmail}
                      onChange={(e) => setCandidateEmail(e.target.value)}
                      placeholder="ご本人確認用メール（任意・送信しません）"
                      className="rounded-xl border-2 border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-[#0066ff]"
                    />
                    <button
                      onClick={issue}
                      disabled={busy === 'issue'}
                      className="rounded-lg bg-[#0066ff] px-6 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:translate-y-0 disabled:hover:bg-slate-200 disabled:hover:translate-y-0"
                    >
                      {busy === 'issue' ? '発行中…' : 'URLを発行'}
                    </button>
                  </div>
                  {/* ⚠️ メールアドレスは送信に使わない。開始前のご本人確認にだけ使う。
                       入れておくと、URLが転送されてもご本人以外は先へ進めない。
                       空欄なら確認を行わず、URLを開いた方がそのまま受験できる。 */}
                  <p className="mt-3 text-xs font-semibold leading-relaxed text-[#8a94ad]">
                    {candidateEmail.trim()
                      ? 'このメールアドレスに送信は行いません。面接の開始前に、ご本人確認として同じアドレスの入力をお願いする照合先になります。'
                      : 'メールアドレスを入れておくと、面接の開始前にご本人確認が有効になります。空欄のままでも面接は受けられます。'}
                  </p>
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
                      <p className="mt-3 text-xs font-semibold leading-relaxed text-[#8a94ad]">
                        このURLを応募者にお渡しください。面接一覧からいつでもコピーできます。
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
                            <button
                              onClick={() => {
                                setEditingId(editingId === s.id ? null : s.id)
                                setEditingEmail(s.candidateEmail || '')
                                setEditResult(null)
                              }}
                              className="rounded-lg border border-[#d8e7ff] px-4 py-2 text-xs font-black text-[#425071]"
                              title="開始前のご本人確認に使うメールアドレスを設定・修正します"
                            >
                              ご本人確認
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

                      {editingId === s.id && (
                        <div className="w-full rounded-lg bg-[#f7faff] p-4">
                          <label className="block text-xs font-black text-[#0a0f3c]">
                            ご本人確認に使うメールアドレス
                          </label>
                          <p className="mt-1 text-xs font-semibold leading-relaxed text-[#8a94ad]">
                            このアドレスに送信は行いません。面接の開始前に応募者へ入力をお願いし、
                            一致した場合のみ先へ進めます。空にすると確認を行いません。
                          </p>
                          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                            <input
                              type="email"
                              value={editingEmail}
                              onChange={(e) => setEditingEmail(e.target.value)}
                              placeholder="candidate@example.com"
                              className="flex-1 rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm font-semibold outline-none focus:border-[#0066ff]"
                            />
                            <button
                              onClick={() => void updateCandidateEmail(s)}
                              disabled={busy === `email-${s.id}`}
                              className="rounded-lg bg-[#0066ff] px-6 py-2.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:translate-y-0 disabled:hover:bg-slate-200 disabled:hover:translate-y-0"
                            >
                              {busy === `email-${s.id}` ? '保存中…' : '保存'}
                            </button>
                          </div>
                          {editResult?.id === s.id && (
                            <p
                              className={`mt-2 text-xs font-bold ${
                                editResult.ok ? 'text-[#137333]' : 'text-[#a06800]'
                              }`}
                            >
                              {editResult.message}
                            </p>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* --- 5. メンバー --- */}
            <section className="mt-6 rounded-lg bg-white p-6 shadow-sm">
              <h2 className="text-base font-black text-[#0a0f3c]">メンバー</h2>
              <p className="mt-1 text-xs font-semibold text-[#8a94ad]">
                招待した方は、この組織の面接テンプレートと応募者の記録を扱えるようになります。
              </p>

              <ul className="mt-4 divide-y divide-[#eef3ff]">
                {members.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-[#0a0f3c]">
                        {m.name || m.inviteEmail || '（名前未設定）'}
                        {m.userId && m.userId === myUserId && (
                          <span className="ml-2 text-[11px] font-bold text-[#8a94ad]">あなた</span>
                        )}
                      </p>
                      <p className="text-[11px] font-semibold text-[#425071]">
                        {ROLE_LABEL[m.role] || m.role}
                        {m.status === 'PENDING' && ' / 招待中'}
                      </p>
                    </div>
                    {m.role !== 'owner' && m.userId !== myUserId && ROLE_RANK[myRole] >= ROLE_RANK.admin && (
                      <button
                        onClick={() => removeMember(m.id)}
                        disabled={busy === `member-${m.id}`}
                        className="rounded-lg border border-[#ffd0de] px-3 py-1.5 text-xs font-black text-[#c2185b] disabled:opacity-50"
                      >
                        {m.status === 'PENDING' ? '招待を取り消す' : '外す'}
                      </button>
                    )}
                  </li>
                ))}
              </ul>

              {ROLE_RANK[myRole] >= ROLE_RANK.admin ? (
                <>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="招待する方のメールアドレス"
                      className="flex-1 rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm font-semibold outline-none focus:border-[#0066ff]"
                    />
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="rounded-xl border-2 border-slate-200 px-3 py-2.5 text-sm font-semibold outline-none focus:border-[#0066ff]"
                    >
                      <option value="member">メンバー</option>
                      <option value="manager">マネージャー</option>
                      <option value="admin">管理者</option>
                    </select>
                    <button
                      onClick={invite}
                      disabled={busy === 'invite' || !inviteEmail.trim()}
                      className="rounded-lg bg-[#0066ff] px-6 py-2.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:translate-y-0 disabled:hover:bg-slate-200 disabled:hover:translate-y-0"
                    >
                      {busy === 'invite' ? '送信中…' : '招待する'}
                    </button>
                  </div>
                  {inviteUrl && (
                    <p className="mt-3 break-all rounded-lg bg-[#f7faff] p-3 text-xs font-bold text-[#0a0f3c]">
                      {inviteUrl}
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-4 text-xs font-semibold text-[#8a94ad]">
                  メンバーの招待は管理者以上が行えます。
                </p>
              )}
            </section>

            {/* --- 6. 組織設定 --- */}
            <section className="mt-6 rounded-lg bg-white p-6 shadow-sm">
              <h2 className="text-base font-black text-[#0a0f3c]">記録の設定</h2>
              <p className="mt-1 text-xs font-semibold text-[#8a94ad]">
                ここで決めた内容は、応募者の同意画面にそのまま表示されます。
              </p>

              <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg bg-[#f7faff] p-4">
                <input
                  type="checkbox"
                  checked={!!org.recordAudio}
                  disabled={busy === 'settings'}
                  onChange={(e) => void saveSettings({ recordAudio: e.target.checked })}
                  className="mt-0.5 h-4 w-4 accent-[#0066ff]"
                />
                <span>
                  <span className="block text-sm font-black text-[#0a0f3c]">音声を録音して保存する</span>
                  <span className="mt-0.5 block text-xs font-semibold leading-relaxed text-[#425071]">
                    既定はオフです。オフでも会話は文字に起こして記録され、評価は行えます。
                    オンにすると応募者の同意画面に「音声そのものを録音して保存します」が追加されます。
                  </span>
                </span>
              </label>


              <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-lg bg-[#f7faff] p-4">
                <input
                  type="checkbox"
                  checked={!!org.discloseToCandidate}
                  disabled={busy === 'settings'}
                  onChange={(e) => void saveSettings({ discloseToCandidate: e.target.checked })}
                  className="mt-0.5 h-4 w-4 accent-[#0066ff]"
                />
                <span>
                  <span className="block text-sm font-black text-[#0a0f3c]">
                    応募者ご本人にフィードバックを見せる
                  </span>
                  <span className="mt-0.5 block text-xs font-semibold leading-relaxed text-[#425071]">
                    既定はオフです。オンにすると、評価が終わったあとに応募者が面接のURLを
                    開き直すと、強みと改善のご提案をご覧いただけます。
                  </span>
                  {/* ⚠️ 開示するのは応募者向けの文面のみ。点数・推薦度・担当者向け
                       レポートは開示設定に関わらず応募者には出さない */}
                  <span className="mt-1 block text-xs font-bold leading-relaxed text-[#425071]">
                    点数と推薦度、採用ご担当者向けのレポートは開示されません。
                    お伝えするのは強みと改善のご提案の文面だけです。
                  </span>
                </span>
              </label>

              <label className="mt-3 block rounded-lg bg-[#f7faff] p-4">
                <span className="block text-sm font-black text-[#0a0f3c]">記録の保持日数</span>
                <span className="mt-0.5 block text-xs font-semibold leading-relaxed text-[#425071]">
                  面接を実施した日から数えます。期限を過ぎた記録は毎日の処理で自動的に削除されます。
                </span>
                <span className="mt-3 flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={1095}
                    defaultValue={org.retentionDays}
                    disabled={busy === 'settings'}
                    onBlur={(e) => {
                      const v = Number(e.target.value)
                      if (Number.isFinite(v) && v !== org.retentionDays) void saveSettings({ retentionDays: v })
                    }}
                    className="w-28 rounded-xl border-2 border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-[#0066ff]"
                  />
                  <span className="text-sm font-bold text-[#425071]">日</span>
                </span>
              </label>
            </section>
          </>
        )}
      </div>
    </main>
  )
}
