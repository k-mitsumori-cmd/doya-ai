'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/promane/ui/button'
import { MessageSquare, X, Send, Bug, Lightbulb, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'
import Image from 'next/image'

type FeedbackType = 'bug' | 'feature' | 'other'

const TYPE_OPTIONS: { value: FeedbackType; label: string; icon: any; color: string }[] = [
  { value: 'bug', label: '🐛 バグ報告', icon: Bug, color: 'bg-rose-100 text-rose-700 hover:bg-rose-200' },
  { value: 'feature', label: '💡 機能要望', icon: Lightbulb, color: 'bg-amber-100 text-amber-700 hover:bg-amber-200' },
  { value: 'other', label: '💬 その他', icon: MessageCircle, color: 'bg-blue-100 text-blue-700 hover:bg-blue-200' },
]

/**
 * フィードバック送信ボタン（モーダル付き）
 * Slack通知 (POST /api/promane/feedback) を行う共通コンポーネント
 *
 * variant:
 *  - "floating" : 画面右下に常駐するフローティングボタン
 *  - "inline"   : インライン配置 (children を表示)
 *  - "link"     : テキストリンク風
 */
export function FeedbackButton({
  variant = 'inline',
  className,
  children,
}: {
  variant?: 'floating' | 'inline' | 'link'
  className?: string
  children?: React.ReactNode
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<FeedbackType>('other')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error('内容を入力してください')
      return
    }
    setSending(true)
    try {
      const res = await fetch('/api/promane/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, message: message.trim(), page: pathname }),
      })
      if (!res.ok) {
        const d = await res.json()
        toast.error(d?.error || '送信に失敗しました', {
          icon: <Image src="/character/error.png" alt="" width={28} height={28} unoptimized />,
        })
        return
      }
      toast.success('送信しました！対応します 🙏', {
        icon: <Image src="/character/love.png" alt="" width={28} height={28} unoptimized />,
        duration: 5000,
      })
      setMessage('')
      setOpen(false)
    } catch (e: any) {
      toast.error(e?.message || 'エラーが発生しました')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      {/* トリガー */}
      {variant === 'floating' && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-5 py-3 rounded-full bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-600 hover:to-violet-700 text-white font-black text-[13px] shadow-xl shadow-violet-500/30 transition-all hover:scale-105 active:scale-95"
          title="フィードバック・不具合報告"
        >
          <MessageSquare className="h-4 w-4" />
          フィードバック
        </button>
      )}

      {variant === 'inline' && (
        <Button
          onClick={() => setOpen(true)}
          className={className || 'rounded-full font-black bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-600 hover:to-violet-700 text-white shadow-md'}
        >
          <MessageSquare className="h-4 w-4 mr-2" />
          {children || 'フィードバック・不具合報告'}
        </Button>
      )}

      {variant === 'link' && (
        <button
          onClick={() => setOpen(true)}
          className={className || 'text-blue-600 hover:underline font-bold'}
        >
          {children || 'フィードバック・不具合を報告'}
        </button>
      )}

      {/* モーダル */}
      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div
            className="bg-white rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-violet-50">
              <div className="flex items-center gap-3">
                <Image src="/character/love.png" alt="" width={44} height={44} unoptimized />
                <div>
                  <h2 className="text-[18px] font-black text-gray-900">フィードバック・不具合報告</h2>
                  <p className="text-[11px] text-gray-500 font-bold">担当者にSlackで届きます</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-700 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              {/* 種別 */}
              <div>
                <label className="block text-[12px] font-black text-gray-700 mb-2">種別</label>
                <div className="grid grid-cols-3 gap-2">
                  {TYPE_OPTIONS.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setType(t.value)}
                      className={`py-2.5 rounded-xl text-[12px] font-black transition-all ${
                        type === t.value
                          ? `${t.color} ring-2 ring-offset-1 ring-blue-400`
                          : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 内容 */}
              <div>
                <label className="block text-[12px] font-black text-gray-700 mb-2">
                  内容 <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[13px] font-bold focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                  placeholder={
                    type === 'bug'
                      ? '例: ◯◯ページで△△ボタンを押したらエラーが出る'
                      : type === 'feature'
                        ? '例: ◯◯機能があると便利'
                        : '例: 使い方が分かりにくい・全般的な感想'
                  }
                />
                <p className="text-[10px] text-gray-400 font-bold mt-1">
                  {message.length}/2000文字
                </p>
              </div>

              {/* 現在のページ情報 */}
              <div className="bg-gray-50 rounded-xl px-3 py-2 text-[11px] text-gray-600 font-bold">
                📍 現在のページ: <code className="bg-white px-1.5 py-0.5 rounded text-blue-600">{pathname}</code>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
              <p className="text-[10px] text-gray-500 font-bold">
                匿名でも送れます。返信は不要な場合は記載なしでOK
              </p>
              <div className="flex gap-2">
                <Button onClick={() => setOpen(false)} variant="outline" className="rounded-full font-black">
                  キャンセル
                </Button>
                <Button
                  onClick={handleSend}
                  disabled={sending || !message.trim()}
                  className="rounded-full font-black bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-600 hover:to-violet-700 shadow-md"
                >
                  <Send className="h-4 w-4 mr-1.5" />
                  {sending ? '送信中...' : '送信'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
