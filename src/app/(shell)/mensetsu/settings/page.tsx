'use client'

// ============================================
// ドヤ面接官 設定
// ============================================
// メンバーと記録の設定。どちらも「年に数回しか触らないが、触ると影響が大きい」もの。
// ⚠️ トップ（Tool.tsx）に置かないこと。面接の作成・発行・一覧の下に毎回並ぶと、
//    日常の作業のたびにスクロールで通過させられる。

import { PageTitle, useToolUiNext } from '@/components/mensetsu/ui-next'
import { Button, EmptyState, ErrorNotice, Skeleton } from '@/components/ds'
import { LoadIssueNotice, NX_FOCUS, NX_TAP, friendlyText, loadIssueOf, type LoadIssue } from '@/components/mensetsu/states'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { notifyError } from '@/lib/ui/notify'
import { useMensetsuRequest } from '@/components/mensetsu/useMensetsuRequest'
import { useMensetsuWorkspace } from '@/components/mensetsu/MensetsuWorkspaceBoundary'
import { useMensetsuOperation } from '@/components/mensetsu/useMensetsuOperation'
import OwnerTransferPanel from '@/components/org/OwnerTransferPanel'

interface Org {
  id: string
  name: string
  slug: string
  role: string
  retentionDays: number
  recordAudio: boolean
  discloseToCandidate: boolean
}
interface Member {
  id: string
  name: string | null
  inviteEmail: string | null
  role: string
  status: string
  userId: string | null
}

const ROLE_LABEL: Record<string, string> = {
  owner: 'オーナー',
  admin: '管理者',
  manager: 'マネージャー',
  member: 'メンバー',
}
const ROLE_RANK: Record<string, number> = { owner: 4, admin: 3, manager: 2, member: 1 }

export default function MensetsuSettingsPage() {
  const { retry: retryWorkspace } = useMensetsuWorkspace()
  const { proof, request: fetch } = useMensetsuRequest()
  const operation = useMensetsuOperation(proof)
  const unknownWrite = operation.unknown
  const [org, setOrg] = useState<Org | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [myRole, setMyRole] = useState('member')
  const [myUserId, setMyUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviteUrl, setInviteUrl] = useState('')
  // ⚠️ 自分の行に名前が無いと「（名前未設定）」になる。ログイン中の名前で埋める。
  const { data: session } = useSession()
  // 新しい見た目（枠の中で useUiNext() が真）のときだけ、空・エラーの表示と押しやすさを直す
  const uiNext = useToolUiNext()
  const nx = (legacy: string, extra = `${NX_TAP} ${NX_FOCUS}`) => (uiNext ? `${legacy} ${extra}` : legacy)
  /** 読み込みに失敗した理由。⚠️ 失敗を「組織が無い」と取り違えて、作成の案内を出さないため（新しい見た目のとき） */
  const [loadIssue, setLoadIssue] = useState<LoadIssue | null>(null)
  const loadVersion = useRef(0)

  useEffect(() => { if (unknownWrite) { setBusy(null); setInviteUrl('') } }, [unknownWrite])

  // ⚠️ useSession の status で fetch をゲートしない（Cookie認証なので未確定でもAPIは応答する）
  const load = useCallback(async () => {
    if (!proof.current()) return
    const version = ++loadVersion.current
    const current = () => proof.current() && version === loadVersion.current
    setLoading(true)
    setError(null)
    setLoadIssue(null)
    try {
      const res = await fetch('/api/mensetsu/organizations')
      if (!current()) return
      if (!res.ok) setLoadIssue(loadIssueOf(res.status))
      const data = await res.json()
      if (!current()) return
      if (!res.ok || data?.current?.id !== proof.organization.id || data?.current?.slug !== proof.organization.slug) throw new Error('選択した組織を確認できませんでした')
      setOrg(data?.current || null)
      if (data?.current) {
        const membersResponse = await fetch('/api/mensetsu/members')
        const m = await membersResponse.json()
        if (!current()) return
        if (!membersResponse.ok || m?.myUserId !== proof.actorId || !Array.isArray(m?.members)) throw new Error('組織のメンバーを確認できませんでした')
        setMembers(m?.members || [])
        setMyRole(m?.myRole || 'member')
        setMyUserId(m?.myUserId || null)
      }
    } catch (cause) {
      if (current()) notifyError(setError, cause instanceof Error ? cause.message : '組織の設定を取得できませんでした')
      if (current()) setLoadIssue((prev) => prev ?? 'other')
    } finally {
      if (current()) setLoading(false)
    }
  }, [fetch, proof])

  useEffect(() => {
    void load()
  }, [load])

  const saveSettings = async (patch: Record<string, unknown>) => {
    if (!proof.current() || unknownWrite) return
    const ticket = operation.begin()
    if (!ticket) return
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
      if (!operation.current(ticket)) return
      if (!res.ok) {
        notifyError(setError, data?.error || '設定の保存に失敗しました')
        return
      }
      setOrg((prev) => (prev ? { ...prev, ...patch } as Org : prev))
      setNotice('保存しました')
    } catch (cause) {
      if (operation.current(ticket)) operation.uncertain(ticket)
      if (operation.current(ticket)) notifyError(setError, cause instanceof Error ? cause.message : '設定の保存結果を確認できませんでした。')
    } finally {
      if (operation.current(ticket)) setBusy(null)
      operation.finish(ticket)
    }
  }

  const invite = async () => {
    if (!proof.current() || unknownWrite) return
    const ticket = operation.begin()
    if (!ticket) return
    setBusy('invite')
    setError(null)
    setInviteUrl('')
    try {
      const res = await fetch('/api/mensetsu/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      })
      const data = await res.json()
      if (!operation.current(ticket)) return
      if (!res.ok) {
        notifyError(setError, data?.error || '招待に失敗しました')
        return
      }
      setInviteEmail('')
      if (data?.inviteUrl) setInviteUrl(data.inviteUrl)
      await load()
    } catch (cause) {
      if (operation.current(ticket)) operation.uncertain(ticket)
      if (operation.current(ticket)) notifyError(setError, cause instanceof Error ? cause.message : '招待結果を確認できませんでした。')
    } finally {
      if (operation.current(ticket)) setBusy(null)
      operation.finish(ticket)
    }
  }

  const removeMember = async (id: string) => {
    if (!proof.current() || unknownWrite) return
    const ticket = operation.begin()
    if (!ticket) return
    setBusy(`member-${id}`)
    setError(null)
    try {
      const res = await fetch(`/api/mensetsu/members/${id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => {
        if (res.ok) throw new Error('削除結果を確認できませんでした。')
        return {}
      })
      if (!operation.current(ticket)) return
      if (!res.ok) {
        notifyError(setError, data?.error || '削除に失敗しました')
        return
      }
      await load()
    } catch (cause) {
      if (operation.current(ticket)) operation.uncertain(ticket)
      if (operation.current(ticket)) notifyError(setError, cause instanceof Error ? cause.message : '削除結果を確認できませんでした。')
    } finally {
      if (operation.current(ticket)) setBusy(null)
      operation.finish(ticket)
    }
  }

  if (loading && uiNext) {
    return (
      <main className="mx-auto grid max-w-4xl gap-4 px-4 py-8" aria-busy="true" aria-label="読み込み中">
        <Skeleton lines={2} height={24} delayMs={0} />
        <Skeleton lines={5} height={16} delayMs={0} />
      </main>
    )
  }

  if (uiNext && loadIssue && !org) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <LoadIssueNotice issue={loadIssue} subject="設定" onRetry={() => { setLoading(true); void load() }} returnHref={proof.href('/mensetsu/settings')} />
      </main>
    )
  }

  if (!org && uiNext) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <EmptyState
          kind="not-generated"
          art="/mensetsu/empty-interviews.webp"
          title="まだ組織がありません"
          description="メンバーや記録の設定は、組織ごとに決めます。先に面接の準備の画面で組織を作成してください。"
          action={<Button href={proof.href('/mensetsu')} icon="UserCheck">組織を作成する</Button>}
        />
      </main>
    )
  }

  if (loading) {
    return <main className="mx-auto max-w-4xl px-4 py-10 text-sm font-semibold text-[#425071]">読み込み中…</main>
  }

  if (!org && error) {
    return <main className="mx-auto max-w-4xl px-4 py-10 text-sm font-semibold text-[#425071]">
      <p role="alert" className="text-rose-700">{error}</p>
      <button type="button" onClick={() => void load()} className="mt-3 text-[#0066ff] underline">再読み込み</button>
    </main>
  }

  if (!org) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10">
        <p className="text-sm font-semibold text-[#425071]">
          先に<Link href={proof.href('/mensetsu')} className="text-[#0066ff] underline">面接の準備</Link>から組織を作成してください。
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      {unknownWrite && <p role="alert" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-900">前の変更結果を確認できません。再送すると重複する可能性があります。最新の設定やメンバーを確認し、必要なら画面を開き直してください。</p>}
      <PageTitle className="text-xl font-black text-[#0a0f3c]">設定</PageTitle>
      <p className="mt-1 text-xs font-semibold text-[#8a94ad]">{org.name}</p>

      {error && uiNext ? (
        <div className="mt-4"><ErrorNotice what={friendlyText(error, '保存できませんでした。')} how="時間をおいてもう一度お試しください。権限が足りない場合は、組織の管理者に依頼してください。" /></div>
      ) : error && <p className="mt-4 rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</p>}
      {notice && <p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{notice}</p>}

      {/* --- メンバー --- */}
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
                  {m.name || (m.userId && m.userId === myUserId ? session?.user?.name : null) || m.inviteEmail || '（名前未設定）'}
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
                  className={nx('rounded-lg border border-[#ffd0de] px-3 py-1.5 text-xs font-black text-[#c2185b] disabled:opacity-50')}
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
                aria-label="招待する方のメールアドレス"
                autoComplete="email"
                className={nx('flex-1 rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm font-semibold outline-none focus:border-[#0066ff]', `min-h-11 min-w-0 ${NX_FOCUS}`)}
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                aria-label="招待する方の役割"
                className={nx('rounded-xl border-2 border-slate-200 px-3 py-2.5 text-sm font-semibold outline-none focus:border-[#0066ff]', `min-h-11 ${NX_FOCUS}`)}
              >
                <option value="member">メンバー</option>
                <option value="manager">マネージャー</option>
                <option value="admin">管理者</option>
              </select>
              <button
                onClick={invite}
                disabled={busy === 'invite' || !inviteEmail.trim()}
                className={nx('rounded-lg bg-[#0066ff] px-6 py-2.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400')}
              >
                {busy === 'invite' ? '送信中…' : '招待する'}
              </button>
            </div>
            {inviteUrl && (
              <p className="mt-3 break-all rounded-lg bg-[#f7faff] p-3 text-xs font-bold text-[#0a0f3c]">{inviteUrl}</p>
            )}
          </>
        ) : (
          <p className="mt-4 text-xs font-semibold text-[#8a94ad]">メンバーの招待は管理者以上が行えます。</p>
        )}
      </section>

      <div className="mt-6"><OwnerTransferPanel service="mensetsu" organizationSlug={proof.organization.slug}
        organizationId={proof.organization.id} role={myRole} proof={proof} onCommitted={retryWorkspace} /></div>

      {/* --- 記録の設定 --- */}
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
            <span className="block text-sm font-black text-[#0a0f3c]">応募者ご本人にフィードバックを見せる</span>
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
    </main>
  )
}
