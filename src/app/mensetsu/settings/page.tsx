'use client'

// ============================================
// ドヤ面接官 設定
// ============================================
// メンバーと記録の設定。どちらも「年に数回しか触らないが、触ると影響が大きい」もの。
// ⚠️ トップ（Tool.tsx）に置かないこと。面接の作成・発行・一覧の下に毎回並ぶと、
//    日常の作業のたびにスクロールで通過させられる。

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { notifyError } from '@/lib/ui/notify'

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

  // ⚠️ useSession の status で fetch をゲートしない（Cookie認証なので未確定でもAPIは応答する）
  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/mensetsu/organizations')
      const data = await res.json()
      setOrg(data?.current || null)
      if (data?.current) {
        const m = await fetch('/api/mensetsu/members').then((r) => r.json())
        setMembers(m?.members || [])
        setMyRole(m?.myRole || 'member')
        setMyUserId(m?.myUserId || null)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

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
      setOrg((prev) => (prev ? { ...prev, ...patch } as Org : prev))
      setNotice('保存しました')
    } finally {
      setBusy(null)
    }
  }

  const invite = async () => {
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
      if (!res.ok) {
        notifyError(setError, data?.error || '招待に失敗しました')
        return
      }
      setInviteEmail('')
      if (data?.inviteUrl) setInviteUrl(data.inviteUrl)
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
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        notifyError(setError, data?.error || '削除に失敗しました')
        return
      }
      await load()
    } finally {
      setBusy(null)
    }
  }

  if (loading) {
    return <main className="mx-auto max-w-4xl px-4 py-10 text-sm font-semibold text-[#425071]">読み込み中…</main>
  }

  if (!org) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10">
        <p className="text-sm font-semibold text-[#425071]">
          先に<Link href="/mensetsu" className="text-[#0066ff] underline">面接の準備</Link>から組織を作成してください。
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-xl font-black text-[#0a0f3c]">設定</h1>
      <p className="mt-1 text-xs font-semibold text-[#8a94ad]">{org.name}</p>

      {error && <p className="mt-4 rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</p>}
      {notice && <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{notice}</p>}

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
                className="rounded-lg bg-[#0066ff] px-6 py-2.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
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
