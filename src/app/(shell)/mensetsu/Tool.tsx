'use client'

// ============================================
// ドヤ面接官 ダッシュボード（採用担当者向け）
// ============================================
// 組織作成 → 企業URL調査 → 質問セット生成 → 面接URL発行 までを1画面で完了させる。

import { useOneButton } from '@/components/one-button/context'
import { OneButtonBar } from '@/components/one-button/OneButtonBar'
import { Button, EmptyState, ErrorNotice, Skeleton, ToolHero } from '@/components/ds'
import { LoadIssueNotice, NX_FOCUS, NX_TAP, friendlyText, loadIssueOf, type LoadIssue } from '@/components/mensetsu/states'
import { ShellIcon } from '@/components/shell/icons'
import { useCallback, useEffect, useRef, useState } from 'react'
import { TRIAL_LABEL, useTrialEligible } from '@/components/TrialCallout'
import Link from 'next/link'
import MensetsuLp from './Lp'
import { notifyError } from '@/lib/ui/notify'
import { fetchOrgJson } from '@/lib/org-fetch'
import { appendMensetsuSessionPage, fetchMensetsuSessionPage } from '@/lib/mensetsu/session-pages'
import LoadingProgress from '@/components/LoadingProgress'
import { ShellCostBadge } from '@/components/shell/power'
import { confirmDialog } from '@/components/ds/dialog'
import { useDoyaPrefill } from '@/components/agent-router/useDoyaPrefill'

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
  evaluating: '評価中',
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
  const oneButton = useOneButton()
  const [error, setError] = useState<string | null>(null)
  const [templateUpgrade, setTemplateUpgrade] = useState<{ message: string; url: string } | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  /** 読み込みに失敗した理由（新しい見た目で、理由ごとに次にやることを出し分ける） */
  const [loadIssue, setLoadIssue] = useState<LoadIssue>('other')
  // 新しい見た目（枠の中で useUiNext() が真）のときだけ、ToolHero・空状態・中身の領域だけの読み込みにする
  /** 小さなボタンを押しやすい高さにし、キーボードの輪を出す */
  const nx = (legacy: string, extra = `${NX_TAP} ${NX_FOCUS}`) => (`${legacy} ${extra}`)
  /** エラーを出す。新しい見た目では、日本語でない文（例外の英文など）は出さない */
  const report = (message: unknown, fallback = '処理を完了できませんでした。時間をおいてもう一度お試しください。') =>
    notifyError(setError, friendlyText(message, fallback))
  /** 発行の欄・職種の欄へ移る（空の表示のボタンから） */
  const jobTitleRef = useRef<HTMLInputElement>(null)
  const candidateRef = useRef<HTMLInputElement>(null)
  const goTo = (el: HTMLElement | null) => {
    if (!el) return
    el.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' })
    el.focus({ preventScroll: true })
  }
  const [moreError, setMoreError] = useState<string | null>(null)
  const [moreLoading, setMoreLoading] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)


  /** 会社情報。⚠️ 未登録だと質問セットが一般論になる */
  const [profile, setProfile] = useState<Profile | null>(null)
  const [companyUrl, setCompanyUrl] = useState('')
  /** 削除中の対象ID。⚠️ 連打で二重に消しにいかないよう、押した行だけ止める */
  const [deletingId, setDeletingId] = useState('')

  const [jobTitle, setJobTitle] = useState('')
  const [level, setLevel] = useState('mid')
  const [durationMin, setDurationMin] = useState(10)
  const [focus, setFocus] = useState('')
  const [templates, setTemplates] = useState<Template[]>([])
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [sessionTotal, setSessionTotal] = useState(0)
  const [sessionCursor, setSessionCursor] = useState<string | null>(null)
  const loadVersion = useRef(0)
  const invalidateLoad = useCallback(() => { loadVersion.current++ }, [])
  const sessionsRef = useRef(sessions)
  sessionsRef.current = sessions
  const [issuedUrl, setIssuedUrl] = useState<string | null>(null)
  const trialEligible = useTrialEligible()
  const proPlanLinkLabel = trialEligible ? `プロプランの料金と${TRIAL_LABEL}の対象条件を確認する` : 'プロプランの料金を確認する'
  const [issueLimit, setIssueLimit] = useState<{ message: string; url: string; label: string } | null>(null)
  /** 発行直後のコピーボタンを押したことが分かるようにする */
  const [issuedCopied, setIssuedCopied] = useState(false)
  const [candidateName, setCandidateName] = useState('')
  // ドヤAIの「頼む」から来たときは、読み取った値を入れた状態で開く（押すのは本人）
  useDoyaPrefill((read) => { const u = read('url', 'url'), j = read('job'), c = read('candidate'); if (u) setCompanyUrl(u); if (j) setJobTitle(j); if (c) setCandidateName(c) })
  /** 一覧から「URLをコピー」した面接。押したことが分かるように印を出す */
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState('')
  /** 未ログイン。⚠️ 組織が無いのか、そもそもログインしていないのかを区別する。
   *  区別しないと、未ログインの人に「組織を作成」フォームを見せてしまい、
   *  押しても401で何も起きない（何が悪いのか分からない画面になる）。 */
  const [needsLogin, setNeedsLogin] = useState(false)

  // ⚠️ useSession の status で fetch をゲートしない（Cookie認証なので未確定でもAPIは応答する）
  const load = useCallback(async () => {
    const version = ++loadVersion.current
    const desiredCount = Math.max(200, sessionsRef.current.length)
    setLoading(true)
    setLoadError(null)
    setLoadIssue('other')
    setMoreError(null)
    setMoreLoading(false)
    try {
      // ⚠️ 組織・テンプレート・面接一覧・会社情報の4本は互いの結果を使わない（どれも「いまの組織」をサーバーが決める）ので、同時に出す。
      //    以前は組織を待ってから残り3本を出しており、サーバーの往復が2段つながっていた。
      //    組織が無い・未ログインのときは残りの3本は使わずに捨てる（失敗は握りつぶし、使うときだけ await して従来と同じ例外にする）
      const bundle = Promise.all([
        fetchOrgJson('/api/mensetsu/templates'),
        fetchMensetsuSessionPage<SessionRow>(),
        fetchOrgJson('/api/mensetsu/company'),
      ])
      bundle.catch(() => undefined)
      const res = await fetch('/api/mensetsu/organizations')
      const data = await res.json().catch(() => null)
      if (loadVersion.current !== version) return
      if (res.status === 401) {
        setOrg(null)
        setNeedsLogin(true)
        setTemplates([])
        setSessions([])
        setSessionTotal(0)
        setSessionCursor(null)
        return
      }
      if (!res.ok || !data || typeof data !== 'object' || !Object.prototype.hasOwnProperty.call(data, 'current')) {
        if (!res.ok) setLoadIssue(loadIssueOf(res.status))
        throw new Error('組織情報を取得できませんでした')
      }
      setNeedsLogin(false)
      if (data.current) {
        // ⚠️ メンバーはこの画面では使わない（/mensetsu/settings が自分で取得する）
        const [t, first, c] = await bundle
        if (!Array.isArray(t?.templates) || !Object.prototype.hasOwnProperty.call(c, 'profile')) {
          throw new Error('組織のデータを確認できませんでした')
        }
        let loaded = appendMensetsuSessionPage([], first, first.total)
        let cursor = first.nextCursor
        while (cursor && loaded.length < desiredCount) {
          const page = await fetchMensetsuSessionPage<SessionRow>(cursor)
          loaded = appendMensetsuSessionPage(loaded, page, first.total)
          cursor = page.nextCursor
        }
        if (loadVersion.current !== version) return
        setOrg(data.current)
        setTemplates(t.templates)
        setSessions(loaded)
        setSessionTotal(first.total)
        setSessionCursor(cursor)
        setProfile(c.profile || null)
        // ⚠️ 入力欄には登録済みのURLを入れておく。空だと「未登録なのか
        //    登録済みなのに空なのか」が分からない
        setCompanyUrl(c.profile?.sourceUrl || '')
        setSelectedTemplate(t.templates.find((template: Template) => template.status !== 'archived')?.id || '')
      } else {
        setOrg(null)
        setTemplates([])
        setSessions([])
        setSessionTotal(0)
        setSessionCursor(null)
        setProfile(null)
      }
    } catch (e) {
      if (loadVersion.current === version) setLoadError(e instanceof Error && /[ぁ-んァ-ヶ一-龠]/.test(e.message) ? e.message : '読み込みに失敗しました')
    } finally {
      if (loadVersion.current === version) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    return invalidateLoad
  }, [load, invalidateLoad])

  const loadMoreSessions = async () => {
    if (!sessionCursor || moreLoading) return
    const version = loadVersion.current
    setMoreLoading(true)
    setMoreError(null)
    try {
      const page = await fetchMensetsuSessionPage<SessionRow>(sessionCursor)
      const loaded = appendMensetsuSessionPage(sessionsRef.current, page, sessionTotal)
      if (loadVersion.current !== version) return
      setSessions(loaded)
      setSessionCursor(page.nextCursor)
    } catch (e) {
      if (loadVersion.current === version) setMoreError(e instanceof Error && /[ぁ-んァ-ヶ一-龠]/.test(e.message) ? e.message : '続きを読み込めませんでした')
    } finally {
      if (loadVersion.current === version) setMoreLoading(false)
    }
  }

  /**
   * 会社サイトを読み取って会社情報を登録する。
   * ⚠️ ここが未登録だと、質問セットが自社の事業・カルチャーを踏まえない
   *    一般論になる。画面の一番上に置いて、最初にやることだと分かるようにする。
   */
  const analyzeCompany = async () => {
    if (!companyUrl.trim()) return
    setBusy('company')
    setError(null)
    setNotice(null)
    try {
      const res = await fetch('/api/mensetsu/company/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: companyUrl.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || '会社サイトを読み取れませんでした')
      setProfile(data.profile)
      setNotice(`会社情報を更新しました（${data.pageCount}ページを読み取り）`)
    } catch (e) {
      report(e instanceof Error && /[ぁ-んァ-ヶ一-龠]/.test(e.message) ? e.message : '会社サイトを読み取れませんでした')
    } finally {
      setBusy(null)
    }
  }

  /** 面接記録がある質問セットは保管し、履歴を残して利用枠を空ける。 */
  const deleteTemplate = async (t: Template) => {
    const n = t._count?.sessions ?? 0
    const ok = n > 0
      ? await confirmDialog({
          title: `質問セット「${t.name}」を保管しますか？`,
          message: `面接の記録${n}件は残り、新しい面接URLは発行できなくなります。\n保管したあとは直せません。発行ずみの面接URLはそのまま使えます。`,
          confirmLabel: '保管する',
        })
      : await confirmDialog({
          title: `質問セット「${t.name}」を削除しますか？`,
          message: `質問 ${t._count?.questions ?? 0}問・評価の軸 ${t._count?.criteria ?? 0}個も一緒に消えます。元に戻せません。`,
          confirmLabel: '削除する',
          tone: 'danger',
        })
    if (!ok) return

    setDeletingId(t.id)
    setError(null)
    try {
      const res = await fetch(`/api/mensetsu/templates/${t.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || '削除できませんでした')
      await load()
    } catch (e) {
      report(e instanceof Error && /[ぁ-んァ-ヶ一-龠]/.test(e.message) ? e.message : '削除できませんでした')
    } finally {
      setDeletingId('')
    }
  }

  const canDelete = org?.role === 'owner' || org?.role === 'admin'

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
        report(data?.error || '組織の作成に失敗しました')
        return
      }
      await load()
    } finally {
      setBusy(null)
    }
  }

  const generate = async () => {
    if (!jobTitle.trim()) return
    setBusy('generate')
    setError(null)
    setTemplateUpgrade(null)
    setNotice(null)
    try {
      const res = await fetch('/api/mensetsu/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobTitle: jobTitle.trim(),
          level,
          durationMin,
          focus: focus.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 402 && data?.code === 'LIMIT_REACHED' && data?.upgradeUrl === '/mensetsu/pricing') {
          setTemplateUpgrade({ message: data?.error || '生成に失敗しました', url: data.upgradeUrl })
        }
        report(data?.error || '生成に失敗しました')
        return
      }
      const removed = data?.removedByGuardrail || []
      setNotice(
        removed.length > 0
          ? `質問${data.template.questions.length}問・評価軸${data.template.criteria.length}個を作成しました。就職差別につながる質問を${removed.length}件除外しています。`
          : `質問${data.template.questions.length}問・評価軸${data.template.criteria.length}個を作成しました。`
      )
      await load()
    } catch {
      report('通信に失敗しました。時間をおいてもう一度お試しください。')
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
      report(`コピーできませんでした。次のURLをお使いください: ${liveUrl(s.token)}`)
    }
  }

  const issue = async () => {
    if (!selectedTemplate) return
    setBusy('issue')
    setError(null)
    setIssueLimit(null)
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
        if (res.status === 402 && data?.code === 'LIMIT_REACHED') {
          if (data?.upgradeUrl === '/mensetsu/pricing') {
            setIssueLimit({ message: data.error, url: data.upgradeUrl, label: '' })
          } else if (typeof data?.contactUrl === 'string' && data.contactUrl.startsWith('https://')) {
            setIssueLimit({ message: data.error, url: data.contactUrl, label: '追加枠を相談する' })
          }
        }
        report(data?.error || '発行に失敗しました')
        return
      }
      setIssuedUrl(data.url)
      setCandidateName('')
      await load()
    } catch (cause) {
      report(cause instanceof Error && /[ぁ-んァ-ヶ一-龠]/.test(cause.message) ? cause.message : '通信に失敗しました。時間をおいてもう一度お試しください。')
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
        report(data?.error || '終了処理に失敗しました')
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
        report(data?.error || '戻せませんでした')
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
        report(data?.error || '評価に失敗しました')
        return
      }
      await load()
    } finally {
      setBusy(null)
    }
  }

  if (loading) {
    return (
      <div className="grid gap-4 px-4 py-6 lg:px-8" aria-busy="true" aria-label="読み込み中">
        <Skeleton lines={2} height={28} delayMs={0} />
        <Skeleton lines={5} height={16} delayMs={0} />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="px-4 py-6 lg:px-8">
        <LoadIssueNotice issue={loadIssue} subject="面接の情報" onRetry={() => void load()} />
      </div>
    )
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f2f6ff]">
        <p className="text-sm font-bold text-[#425071]">読み込んでいます…</p>
      </main>
    )
  }

  if (loadError) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f2f6ff] px-5 text-center">
        <p role="alert" className="text-sm font-bold text-[#c2185b]">{loadError}</p>
        <button onClick={() => void load()} className="rounded-lg border border-[#d8e7ff] bg-white px-5 py-2.5 text-sm font-black text-[#0066ff]">再試行</button>
      </main>
    )
  }

  // ⚠️ 未ログインの方にはLPを見せる。以前は組織作成フォームを出しており、
  //    押しても401で何も起きない画面になっていた。
  if (needsLogin) {
    return <MensetsuLp />
  }

  return (
    <main className="px-4 py-6 lg:px-8">
      {/* ⚠️ AI処理中は全画面で「何をしているか」を出す。無言で待たせない */}
      <LoadingProgress
        isLoading={busy === 'generate'}
        operationKey="mensetsu-generate"
        title="質問セットを作っています"
        subtitle="職種とレベルに合わせて、質問と評価軸・ルーブリックを組み立てています。"
        tips={['就職差別につながる質問は、作る時点で外します', '全員に同じ主な質問をする「構造化面接」の方式です', '作ったあとで質問は自由に直せます']}
      />
      <div className="mx-auto max-w-[1100px]">
        {oneButton && org ? (
          <div className="mb-5">
            <OneButtonBar
              eyebrow="ドヤ面接官"
              cta={busy === 'generate' ? '質問セットを作っています。このまま待ってね' : '下の欄に職種を入れたら、押してね'}
              label="質問セットを生成"
              scope="職種に合わせて、質問と評価軸を作ります。30秒ほどかかります。面接URLの発行は、そのあとの操作です。"
              onRun={() => void generate()}
              disabled={busy === 'generate' || !jobTitle.trim()}
              disabledReason="下の欄に職種を入れると押せます。"
              running={busy === 'generate'}
            />
          </div>
        ) : null}
        <ToolHero
            art="/hr/characters/present_%E3%83%97%E3%83%AC%E3%82%BC%E3%83%B3.png"
            title={<>AIが一次面接をして、<wbr />評価まで残す</>}
            lead={<>企業URLから質問セットと評価基準を自動で作り、応募者はURLを開くだけで面接を受けられます。判定は「推薦度」で、<strong className="font-bold text-[var(--ink)]">最終的な選考の判断は、必ず人が行います。</strong></>}
          />

        {error ? (
          <div className="mt-5 grid gap-3">
            <ErrorNotice what={error} how={templateUpgrade?.message === error ? '今月の上限に達しました。料金プランで上限をご確認ください。' : undefined} />
            {templateUpgrade?.message === error && <div><Button href={templateUpgrade.url} variant="secondary" icon="CreditCard">料金プランを見る</Button></div>}
          </div>
        ) : error && (
          <div className="mt-5 rounded-lg border border-[#ffd0de] bg-[#fff2f6] p-4 text-sm font-bold text-[#c2185b]">
            {error}
            {templateUpgrade?.message === error && <p className="mt-2"><Link href={templateUpgrade.url} className="text-[#0066ff] underline">{proPlanLinkLabel}</Link></p>}
          </div>
        )}
        {notice && (
          <div role="status" className="mt-5 rounded-lg border border-[#cfe3ff] bg-white p-4 text-sm font-bold text-[#0a0f3c]">
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
                aria-label="組織名"
                className={nx('flex-1 rounded-xl border-2 border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-[#0066ff]', `min-w-0 ${NX_FOCUS}`)}
              />
              <button
                onClick={createOrg}
                disabled={busy === 'org' || !orgName.trim()}
                className={nx('rounded-lg bg-[#0066ff] px-6 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:translate-y-0 disabled:hover:bg-slate-200 disabled:hover:translate-y-0')}
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
            {/* --- 0. 会社情報 ---
                 ⚠️ ここが未登録だと質問セットが一般論になる。
                    以前は入力欄がどこにも無く、解析APIは呼ばれていなかった。 */}
            <section className="mt-8 rounded-lg bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0066ff] text-xs font-black text-white">0</span>
                <h2 className="text-base font-black text-[#0a0f3c]">会社のURLを登録する</h2>
              </div>
              <p className="mt-2 text-sm font-semibold text-[#425071]">
                自社サイトを読み取って、事業内容・提供価値・カルチャー・求める人物像をまとめます。
                ここを登録しておくと、下の質問セットが自社に合った内容になります。
              </p>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <input
                  value={companyUrl}
                  onChange={(e) => setCompanyUrl(e.target.value)}
                  placeholder="https://example.co.jp"
                  aria-label="会社のURL"
                  inputMode="url"
                  className={nx('flex-1 rounded-xl border-2 border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-[#0066ff]', `min-w-0 ${NX_FOCUS}`)}
                />
                <button
                  onClick={analyzeCompany}
                  disabled={busy === 'company' || !companyUrl.trim()}
                  className={nx('rounded-lg bg-[#0066ff] px-6 py-3 text-sm font-black text-white transition hover:bg-[#0052cc] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:hover:bg-slate-200')}
                >
                  {busy === 'company'
                    ? '読み取り中…'
                    : profile
                      ? '読み取り直す'
                      : '会社情報を読み取る'}
                </button>
              </div>

              {profile ? (
                <div className="mt-4 rounded-xl bg-[#f7faff] p-4 ring-1 ring-[#e3edff]">
                  <p className="text-sm font-black text-[#0a0f3c]">
                    {profile.companyName || '登録済み'}
                  </p>
                  <p className="mt-1 break-all text-xs font-semibold text-[#8a94ad]">
                    {profile.sourceUrl}
                  </p>
                  <dl className="mt-3 space-y-2">
                    {[
                      ['事業内容', profile.business],
                      ['提供価値', profile.valueProp],
                      ['カルチャー', profile.culture],
                      ['求める人物像', profile.idealProfile],
                    ]
                      .filter(([, v]) => v)
                      .map(([k, v]) => (
                        <div key={k as string}>
                          <dt className="text-xs font-black text-[#425071]">{k}</dt>
                          <dd className="text-sm font-semibold leading-relaxed text-[#0a0f3c]">{v}</dd>
                        </div>
                      ))}
                  </dl>
                </div>
              ) : (
                <p className="mt-3 rounded-lg bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-900 ring-1 ring-amber-200">
                  まだ会社情報が登録されていません。このままでも質問セットは作れますが、内容が一般的なものになります。
                </p>
              )}
            </section>

            {/* --- 1. 質問セット生成 --- */}
            <section className="mt-8 rounded-lg bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0066ff] text-xs font-black text-white">1</span>
                <h2 className="text-base font-black text-[#0a0f3c]">質問セットと評価基準を作る</h2>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <input
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  maxLength={200}
                  placeholder="職種（例: フィールドセールス）"
                  aria-label="職種"
                  ref={jobTitleRef}
                  className={nx('rounded-xl border-2 border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-[#0066ff]', `min-w-0 ${NX_FOCUS}`)}
                />
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  aria-label="採用の区分"
                  className={nx('rounded-xl border-2 border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-[#0066ff]', `min-w-0 ${NX_FOCUS}`)}
                >
                  <option value="newgrad">新卒</option>
                  <option value="mid">中途</option>
                  <option value="manager">マネージャー</option>
                </select>
                {/* ⚠️ 面接は10分に固定。20分・30分は受ける側が最後まで持たず、
                     選べること自体が迷いを生むため選択肢を外した（2026-08-31） */}
                <div className="flex items-center rounded-xl bg-[#f7faff] px-4 py-3 text-sm font-black text-[#425071] ring-1 ring-[#e3edff]">
                  10分の面接
                </div>
                <input
                  value={focus}
                  onChange={(e) => setFocus(e.target.value)}
                  maxLength={1000}
                  placeholder="特に見たい点（任意）"
                  aria-label="特に見たい点（任意）"
                  className={nx('rounded-xl border-2 border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-[#0066ff]', `min-w-0 ${NX_FOCUS}`)}
                />
              </div>
              <button
                onClick={generate}
                disabled={busy === 'generate' || !jobTitle.trim()}
                className={nx('mt-4 rounded-lg bg-[#0066ff] hover:bg-[#0052cc] shadow-lg shadow-[#0066ff]/25 transition-all hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.98] px-6 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:translate-y-0 disabled:hover:bg-slate-200 disabled:hover:translate-y-0', `min-h-11 max-w-full motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${NX_FOCUS}`)}
              >
                {busy === 'generate' ? '生成中…（30秒ほどかかります）' : '質問セットを生成'}
                <ShellCostBadge action="text.generate" />
              </button>

              {(templates.length === 0) && (
                <EmptyState
                  kind="not-generated"
                  art="/mensetsu/empty-interviews.webp"
                  title="まだ質問セットはありません"
                  description="職種を入れて「質問セットを生成」を押すと、質問と評価軸がここに並びます。"
                  action={<Button onClick={() => goTo(jobTitleRef.current)} icon="PenTool">職種を入力する</Button>}
                />
              )}
              {templates.length > 0 && (
                <ul className="mt-5 space-y-3">
                  {templates.map((t) => (
                    <li key={t.id} className="rounded-xl bg-[#f7faff] p-4 ring-1 ring-[#e3edff]">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 break-words">
                          <p className="text-base font-black text-[#0a0f3c]">{t.name}</p>
                          <p className="text-xs font-semibold text-[#425071]">
                            {t.durationMin}分 / 質問{t._count?.questions ?? 0}問 / 評価軸{t._count?.criteria ?? 0}個 / 面接{t._count?.sessions ?? 0}件
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
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
                            className={nx('rounded-lg border border-[#d8e7ff] bg-white px-4 py-2 text-xs font-black text-[#0066ff]')}
                          >
                            編集
                          </Link>
                          {/* ⚠️ 面接の記録まで消える操作。隣の「編集」と見た目を分ける（赤） */}
                          {canDelete && (t.status !== 'archived' || !t._count?.sessions) && (
                            <button
                              onClick={() => deleteTemplate(t)}
                              disabled={deletingId === t.id}
                              className={nx('rounded-lg border border-rose-300 bg-white px-4 py-2 text-xs font-black text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50')}
                            >
                              {deletingId === t.id ? (t._count?.sessions ? '保管中…' : '削除中…') : (t._count?.sessions ? '保管' : '削除')}
                            </button>
                          )}
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
            <section className="mt-8 rounded-2xl bg-white p-5 shadow-md ring-2 ring-[#0066ff] sm:p-9">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0066ff] text-base font-black text-white">3</span>
                <div className="min-w-0">
                  <h2 className="text-xl font-black text-[#0a0f3c] [text-wrap:balance] sm:text-2xl">応募者に面接URLを送る</h2>
                  <p className="mt-0.5 text-sm font-bold text-[#0066ff]">URLを送れたら、ここで完了です</p>
                </div>
              </div>
              {templates.every((t) => t.status === 'archived') ? (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <p className="text-sm font-semibold text-[#425071]">面接URLを発行するには、先に質問セットを作ります。</p>
                  <Button onClick={() => goTo(jobTitleRef.current)} variant="secondary" icon="PenTool">質問セットを作る</Button>
                </div>
              ) : templates.every((t) => t.status === 'archived') ? (
                <p className="mt-3 text-sm font-semibold text-[#425071]">先に質問セットを作成してください。</p>
              ) : (
                <>
                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-black text-[#425071]">質問セット</span>
                      <select
                        value={selectedTemplate}
                        onChange={(e) => setSelectedTemplate(e.target.value)}
                        className={nx('w-full rounded-xl border-2 border-slate-200 px-4 py-3.5 text-base font-semibold outline-none focus:border-[#0066ff]', `min-w-0 ${NX_FOCUS}`)}
                      >
                        {templates.filter((t) => t.status !== 'archived').map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                            {t.status === 'draft' ? '（下書き）' : ''}
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
                        ref={candidateRef}
                        required
                        aria-describedby={issueLimit && error === issueLimit.message ? 'mensetsu-issue-error' : undefined}
                        className={nx('w-full rounded-xl border-2 border-slate-200 px-4 py-3.5 text-base font-semibold outline-none focus:border-[#0066ff]', `min-w-0 ${NX_FOCUS}`)}
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
                    className={nx('mt-5 w-full rounded-xl bg-[#0066ff] px-6 py-5 text-lg font-black text-white shadow-lg transition hover:bg-[#0052cc] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:hover:bg-slate-200 sm:text-xl', NX_FOCUS)}
                  >
                    {busy === 'issue' ? '発行中…' : '面接URLを発行する'}
                    <ShellCostBadge action="voice.minute" per="分" />
                  </button>
                  {issueLimit && error === issueLimit.message ? (
                    <div id="mensetsu-issue-error" className="mt-3 grid gap-3">
                      <ErrorNotice what="今月の面接の上限に達しました。" how={issueLimit.message} />
                      <div><Button href={issueLimit.url} variant="secondary" icon="CreditCard">{issueLimit.url === '/mensetsu/pricing' ? '料金プランを見る' : '追加枠を相談する'}</Button></div>
                    </div>
                  ) : issueLimit && error === issueLimit.message && (
                    <div role="alert" className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-900">
                      <p>{issueLimit.message}</p>
                      <Link href={issueLimit.url} className="mt-2 inline-block text-blue-700 underline">{issueLimit.label || proPlanLinkLabel}</Link>
                    </div>
                  )}
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
                        className={nx('mt-4 w-full rounded-xl bg-[#0066ff] px-6 py-4 text-base font-black text-white shadow-lg transition hover:bg-[#0052cc] sm:text-lg', NX_FOCUS)}
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

            {/* --- 3. 面接一覧 ---
                 ⚠️ 終わった面接（評価済み）がいちばん見たい情報。
                    未実施の行と同じ大きさで並べると埋もれるので、
                    評価済みは大きなカードで先に出す。 */}
            <section className="mt-6 rounded-lg bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-black text-[#0a0f3c]">面接一覧</h2>
                {sessions.some((s) => s.status === 'evaluated') && (
                  <Link
                    href="/mensetsu/compare"
                    className={nx('flex items-center gap-1.5 rounded-lg border border-[#d8e7ff] px-4 py-2 text-xs font-black text-[#0066ff]', `min-h-11 whitespace-nowrap ${NX_FOCUS}`)}
                  >
                    <ShellIcon name="Users" size={16} />
                    候補者を比較
                  </Link>
                )}
              </div>
              {/* 終わった面接: 結果を大きく見せる */}
              {sessions.filter((s) => s.status === 'evaluated').length > 0 && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {sessions
                    .filter((s) => s.status === 'evaluated')
                    .map((s) => (
                      <Link
                        key={s.id}
                        href={`/mensetsu/sessions/${s.id}`}
                        className={nx('block rounded-2xl bg-[#f7faff] p-5 ring-2 ring-[#d8e7ff] transition hover:ring-[#0066ff]', 'min-w-0 focus-visible:outline-none focus-visible:ring-[var(--blue)] focus-visible:ring-4')}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-lg font-black text-[#0a0f3c]">
                              {s.candidateName || '（名前未入力）'}
                            </p>
                            <p className="truncate text-xs font-bold text-[#8a94ad]">{s.template.jobTitle}</p>
                          </div>
                          {s.verdict && (
                            <span className="shrink-0 rounded-full bg-[#0066ff] px-3 py-1.5 text-sm font-black text-white">
                              {VERDICT_LABEL[s.verdict] || s.verdict}
                            </span>
                          )}
                        </div>
                        <p className="mt-4 text-sm font-black text-[#0066ff]">評価が完了しています</p>
                        <p className="mt-1 text-xs font-bold text-[#8a94ad]">
                          押すと平均スコアと評価軸ごとの結果を見られます
                        </p>
                      </Link>
                    ))}
                </div>
              )}

              {sessions.length === 0 ? (
                <EmptyState
                  art="/mensetsu/empty-interviews.webp"
                  title="まだ面接はありません"
                  description="上の「面接URLを発行する」で応募者ごとのURLを作って送ると、面接の状況と結果がここに並びます。"
                  action={templates.every((t) => t.status === 'archived')
                    ? <Button onClick={() => goTo(jobTitleRef.current)} icon="PenTool">質問セットを作る</Button>
                    : <Button onClick={() => goTo(candidateRef.current)} icon="Link2">面接URLを発行する</Button>}
                />
              ) : sessions.length === 0 ? (
                <p className="mt-3 text-sm font-semibold text-[#425071]">まだ面接はありません。</p>
              ) : (
                <ul className="mt-4 divide-y divide-[#eef3ff]">
                  {sessions.filter((s) => s.status !== 'evaluated').map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div className="min-w-0 break-words">
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
                              className={nx('rounded-lg border border-[#d8e7ff] px-4 py-2 text-xs font-black text-[#0066ff]')}
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
                            className={nx('rounded-lg border border-[#d8e7ff] px-4 py-2 text-xs font-black text-[#0066ff] disabled:opacity-50')}
                            title="受験前に誤って終了扱いになった面接を、同じURLで受けられる状態に戻します"
                          >
                            {busy === `reopen-${s.id}` ? '処理中…' : '受験可能に戻す'}
                          </button>
                        )}
                        {['pending', 'consented', 'live'].includes(s.status) && (
                          <button
                            onClick={() => closeSession(s.id)}
                            disabled={busy === `close-${s.id}`}
                            className={nx('rounded-lg border border-[#d8e7ff] px-4 py-2 text-xs font-black text-[#425071] disabled:opacity-50')}
                            title="応募者が離脱したまま実施中で止まっている場合に使います"
                          >
                            {busy === `close-${s.id}` ? '処理中…' : '終了にする'}
                          </button>
                        )}
                        {s.status === 'completed' && (
                          <button
                            onClick={() => evaluate(s.id)}
                            disabled={busy === `eval-${s.id}`}
                            className={nx('rounded-lg bg-[#0066ff] px-4 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:translate-y-0 disabled:hover:bg-slate-200 disabled:hover:translate-y-0')}
                          >
                            {busy === `eval-${s.id}` ? '評価中…' : '評価する'}
                          </button>
                        )}
                        <Link
                          href={`/mensetsu/sessions/${s.id}`}
                          className={nx('rounded-lg border border-[#d8e7ff] px-4 py-2 text-xs font-black text-[#0066ff]')}
                        >
                          詳細
                        </Link>
                      </div>

                    </li>
                  ))}
                </ul>
              )}
              {sessionCursor && (
                <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-xs font-semibold text-[#425071]">
                  <span>{sessions.length} / {sessionTotal}件の面接を表示</span>
                  <button onClick={loadMoreSessions} disabled={moreLoading} className={nx('rounded-lg border border-[#d8e7ff] bg-white px-4 py-2 font-black text-[#0066ff] disabled:opacity-50')}>
                    {moreLoading ? '読み込み中…' : moreError ? '再試行' : 'さらに表示'}
                  </button>
                  {moreError && <button onClick={() => void load()} className={nx('font-black text-[#0066ff] underline')}>一覧を更新</button>}
                </div>
              )}
              {moreError ? (
                <div className="mt-3"><ErrorNotice what="面接一覧の続きを読み込めませんでした。" how="「再試行」を押すか、「一覧を更新」で最初から読み直してください。" /></div>
              ) : moreError && <p role="alert" className="mt-2 text-center text-xs font-bold text-[#c2185b]">{moreError}</p>}
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
