'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/promane/ui/button'
import { Input } from '@/components/promane/ui/input'
import { Badge } from '@/components/promane/ui/badge'
import { Mail, X, Copy, Send, Trash2, Clock, Check } from 'lucide-react'
import { toast } from 'sonner'
import Image from 'next/image'

interface SentInvitation {
  id: string
  token: string
  email: string
  role: string
  acceptedAt: string | null
  expiresAt: string
  createdAt: string
  isExpired: boolean
}

interface InviteModalProps {
  workspaceId: string
  open: boolean
  onClose: () => void
  canInvite: boolean
}

const ROLE_OPTIONS = [
  { value: 'admin', label: '管理者', desc: 'メンバー招待・プロジェクト全管理' },
  { value: 'member', label: 'メンバー', desc: 'プロジェクト編集・タスク作業' },
  { value: 'guest', label: 'ゲスト', desc: '閲覧のみ' },
]

const ROLE_LABELS: Record<string, string> = {
  owner: 'オーナー',
  admin: '管理者',
  member: 'メンバー',
  guest: 'ゲスト',
}

interface SentInvitationPage {
  invitations: SentInvitation[]
  total: number
  nextCursor: string | null
}

function parseSentInvitationPage(value: unknown): SentInvitationPage {
  const page = value as SentInvitationPage | null
  if (!page || !Array.isArray(page.invitations) || page.invitations.length > 50 ||
      !Number.isSafeInteger(page.total) || page.total < page.invitations.length ||
      page.invitations.some((invitation) => !invitation || typeof invitation.id !== 'string' || !invitation.id) ||
      (page.nextCursor !== null && (typeof page.nextCursor !== 'string' || page.invitations.length !== 50 ||
        page.nextCursor !== page.invitations[49].id))) {
    throw new Error('招待履歴の応答が正しくありません')
  }
  return page
}

export function InviteModal({ workspaceId, open, onClose, canInvite }: InviteModalProps) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('member')
  const [sending, setSending] = useState(false)
  const [sentInvitations, setSentInvitations] = useState<SentInvitation[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [historyTotal, setHistoryTotal] = useState(0)
  const requestVersion = useRef(0)

  const loadSent = useCallback(async () => {
    const version = ++requestVersion.current
    setHistoryError('')
    setLoading(true)
    setLoadingMore(false)
    setSentInvitations([])
    setNextCursor(null)
    setHistoryTotal(0)
    try {
      const params = new URLSearchParams({ type: 'sent', workspaceId })
      const response = await fetch(`/api/promane/invitations?${params}`, { cache: 'no-store' })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || '招待履歴を取得できませんでした')
      const page = parseSentInvitationPage(data)
      if (page.nextCursor === null && page.invitations.length !== page.total) throw new Error('招待履歴の応答が正しくありません')
      if (version !== requestVersion.current) return
      setSentInvitations(page.invitations)
      setNextCursor(page.nextCursor)
      setHistoryTotal(page.total)
    } catch (cause) {
      if (version === requestVersion.current) setHistoryError(cause instanceof Error ? cause.message : '招待履歴を取得できませんでした')
    } finally {
      if (version === requestVersion.current) setLoading(false)
    }
  }, [workspaceId])

  useEffect(() => {
    if (open && canInvite) void loadSent()
    const versionRef = requestVersion
    return () => { versionRef.current++ }
  }, [open, canInvite, loadSent])

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return
    const version = requestVersion.current
    setHistoryError('')
    setLoadingMore(true)
    try {
      const params = new URLSearchParams({ type: 'sent', workspaceId, cursor: nextCursor })
      const response = await fetch(`/api/promane/invitations?${params}`, { cache: 'no-store' })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || '招待履歴の続きを取得できませんでした')
      const page = parseSentInvitationPage(data)
      if (page.total !== historyTotal || sentInvitations.length + page.invitations.length > historyTotal ||
          page.invitations.some((invitation) => sentInvitations.some((current) => current.id === invitation.id)) ||
          (page.nextCursor === null && sentInvitations.length + page.invitations.length !== historyTotal)) {
        throw new Error('招待履歴が更新されました。最初から読み直してください')
      }
      if (version !== requestVersion.current) return
      setSentInvitations(sentInvitations.concat(page.invitations))
      setNextCursor(page.nextCursor)
    } catch (cause) {
      if (version === requestVersion.current) setHistoryError(cause instanceof Error ? cause.message : '招待履歴の続きを取得できませんでした')
    } finally {
      if (version === requestVersion.current) setLoadingMore(false)
    }
  }

  if (!open) return null

  const handleSend = async () => {
    if (!email.trim()) {
      toast.error('メールアドレスを入力してください')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('メールアドレスの形式が正しくありません')
      return
    }
    setSending(true)
    try {
      const res = await fetch('/api/promane/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, email: email.trim(), role }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data?.error || '招待に失敗しました', {
          icon: <Image src="/character/error.png" alt="" width={28} height={28} unoptimized />,
        })
        return
      }
      if (data.emailSent) {
        toast.success(`${email} に招待メールを送信しました`, {
          duration: 5000,
          icon: <Image src="/character/success.png" alt="" width={28} height={28} unoptimized />,
        })
      } else {
        toast.success(`招待リンクを発行しました（メール送信は失敗）`, {
          duration: 5000,
          icon: <Image src="/character/thinking.png" alt="" width={28} height={28} unoptimized />,
        })
      }
      setEmail('')
      await loadSent()
    } catch (e: any) {
      toast.error(e?.message || 'エラーが発生しました')
    } finally {
      setSending(false)
    }
  }

  const handleCopyLink = async (token: string) => {
    const url = `${window.location.origin}/promane/invite/${token}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success('招待リンクをコピーしました')
    } catch {
      toast.error('コピーに失敗しました')
    }
  }

  const handleRevoke = async (id: string) => {
    // モーダル内のモーダルは複雑なため、シンプルなネイティブ確認を維持
    if (!window.confirm('この招待を取り消しますか？')) return
    try {
      const res = await fetch(`/api/promane/invitations?id=${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json()
        toast.error(d?.error || '取消に失敗しました')
        return
      }
      toast.success('招待を取り消しました')
      await loadSent()
    } catch (e: any) {
      toast.error(e?.message || 'エラーが発生しました')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <Image src="/character/love.png" alt="" width={48} height={48} className="drop-shadow" unoptimized />
            <div>
              <h2 className="text-[20px] font-black text-gray-900">メンバーを招待</h2>
              <p className="text-[12px] text-gray-400 font-bold">メールで招待リンクを送信します</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {!canInvite ? (
          <div className="p-8 text-center">
            <Image src="/character/error.png" alt="" width={80} height={80} className="mx-auto mb-3" unoptimized />
            <p className="text-[15px] font-black text-gray-700">招待権限がありません</p>
            <p className="text-[12px] text-gray-400 font-bold mt-1">owner/admin のみメンバーを招待できます</p>
          </div>
        ) : (
          <>
            {/* Form */}
            <div className="p-6 border-b border-gray-100 space-y-4">
              <div>
                <label className="block text-[13px] font-black text-gray-700 mb-2">
                  メールアドレス <span className="text-rose-500">*</span>
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="invite@example.com"
                  className="h-12 text-[15px] rounded-xl"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSend() }}
                />
              </div>

              <div>
                <label className="block text-[13px] font-black text-gray-700 mb-2">
                  役割
                </label>
                <div className="space-y-2">
                  {ROLE_OPTIONS.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setRole(r.value)}
                      className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                        role === r.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/30'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[14px] font-black text-gray-900">{r.label}</p>
                          <p className="text-[11px] text-gray-500 font-bold mt-0.5">{r.desc}</p>
                        </div>
                        {role === r.value && (
                          <Check className="h-5 w-5 text-blue-600" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-[11px] text-amber-800 font-bold leading-relaxed">
                  招待は<strong>30日有効</strong>です。招待されたメールと同じGoogleアカウントでログインしないと承諾できません。
                </p>
              </div>

              <Button
                onClick={handleSend}
                disabled={sending || !email.trim()}
                className="w-full h-12 rounded-full text-[15px] font-black bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-600 hover:to-violet-700 shadow-lg"
              >
                <Send className="h-4 w-4 mr-2" />
                {sending ? '送信中...' : '招待メールを送信'}
              </Button>
            </div>

            {/* Sent invitations list */}
            <div className="p-6">
              <h3 className="text-[14px] font-black text-gray-700 mb-3 flex items-center gap-2">
                <Mail className="h-4 w-4" />
                招待履歴
              </h3>
              {historyError && <div role="alert" className="mb-3 text-[12px] font-semibold text-rose-700">{historyError}<button type="button" onClick={() => void loadSent()} className="ml-2 underline">最初から読み直す</button></div>}
              {loading ? (
                <p className="text-[12px] text-gray-400 text-center py-4">読み込み中...</p>
              ) : historyError && sentInvitations.length === 0 ? null : sentInvitations.length === 0 ? (
                <p className="text-[12px] text-gray-400 text-center py-4">まだ招待を送っていません</p>
              ) : (
                <div className="space-y-2 max-h-[240px] overflow-y-auto">
                  {sentInvitations.map((inv) => {
                    const isAccepted = !!inv.acceptedAt
                    const isExpired = inv.isExpired
                    return (
                      <div
                        key={inv.id}
                        className={`p-3 rounded-xl border ${
                          isAccepted ? 'bg-emerald-50 border-emerald-200'
                          : isExpired ? 'bg-gray-50 border-gray-200 opacity-60'
                          : 'bg-white border-gray-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-black text-gray-900 truncate">{inv.email}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <Badge variant="secondary" className="text-[10px] font-bold rounded-full">
                                {ROLE_LABELS[inv.role] || inv.role}
                              </Badge>
                              {isAccepted ? (
                                <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-0.5">
                                  <Check className="h-3 w-3" /> 承諾済み
                                </span>
                              ) : isExpired ? (
                                <span className="text-[10px] font-bold text-gray-500">期限切れ</span>
                              ) : (
                                <span className="text-[10px] font-bold text-blue-600 flex items-center gap-0.5">
                                  <Clock className="h-3 w-3" /> 待機中
                                </span>
                              )}
                            </div>
                          </div>
                          {!isAccepted && !isExpired && (
                            <div className="flex gap-1 flex-shrink-0">
                              <button
                                onClick={() => handleCopyLink(inv.token)}
                                className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600"
                                title="リンクコピー"
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleRevoke(inv.id)}
                                className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-500"
                                title="取消"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              {nextCursor && !loading && (
                <button type="button" onClick={() => void loadMore()} disabled={loadingMore} className="mt-3 w-full rounded-lg border border-blue-200 px-3 py-2 text-[12px] font-bold text-blue-700 disabled:opacity-50">
                  {loadingMore ? '読み込み中...' : `さらに表示（${sentInvitations.length}/${historyTotal}件）`}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
