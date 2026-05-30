'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import {
  X,
  Lightbulb,
  Sparkles,
  Wand2,
  Bug,
  MessageSquarePlus,
  Loader2,
  CheckCircle2,
} from 'lucide-react'

interface SidebarHelpContactProps {
  showLabel: boolean
  isCollapsed: boolean
  isMobile?: boolean
}

type Category = 'improvement' | 'feature' | 'bug' | 'other'

const CATEGORIES: { id: Category; label: string; icon: typeof Lightbulb; color: string }[] = [
  { id: 'improvement', label: '改善したほうがいいこと', icon: Wand2, color: 'text-sky-600' },
  { id: 'feature', label: '追加の機能要望', icon: Lightbulb, color: 'text-amber-600' },
  { id: 'bug', label: 'エラー報告', icon: Bug, color: 'text-rose-600' },
  { id: 'other', label: 'その他', icon: Sparkles, color: 'text-purple-600' },
]

export function SidebarHelpContact({ showLabel, isCollapsed }: SidebarHelpContactProps) {
  const pathname = usePathname()
  const [showModal, setShowModal] = useState(false)
  const [category, setCategory] = useState<Category>('feature')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const close = () => {
    if (status === 'sending') return
    setShowModal(false)
    // 閉じたら少し後にリセット（アニメ中の表示崩れ回避）
    setTimeout(() => {
      setStatus('idle')
      setMessage('')
      setCategory('feature')
      setErrorMsg('')
    }, 200)
  }

  const submit = async () => {
    if (!message.trim() || status === 'sending') return
    setStatus('sending')
    setErrorMsg('')
    try {
      // pathname 先頭セグメントをサービス名として送る（例: /seo/... → seo）
      const service = pathname?.split('/').filter(Boolean)[0] || '不明'
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, message: message.trim(), page: pathname, service }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || '送信に失敗しました')
      }
      setStatus('done')
    } catch (e) {
      setStatus('error')
      setErrorMsg(e instanceof Error ? e.message : '送信に失敗しました')
    }
  }

  return (
    <>
      {/* お問い合わせ・改善依頼ボタン */}
      <div className={`${isCollapsed ? 'px-2' : 'px-3'} pb-2`}>
        <button
          onClick={() => setShowModal(true)}
          className={`w-full flex items-center gap-2 rounded-xl text-gray-600 hover:bg-purple-50 hover:text-[#7f19e6] transition-colors ${
            isCollapsed ? 'justify-center p-2' : 'px-3 py-2'
          }`}
          title={isCollapsed ? 'お問い合わせ・改善依頼' : undefined}
          type="button"
        >
          <MessageSquarePlus className="w-5 h-5 flex-shrink-0" />
          {!isCollapsed && showLabel && (
            <span className="flex flex-col items-start leading-tight">
              <span className="text-sm font-bold">お問い合わせ・改善依頼</span>
              <span className="text-[10px] font-bold text-[#7f19e6]">追加機能要望募集中 🙌</span>
            </span>
          )}
        </button>
      </div>

      {/* モーダル */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={close} />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6 max-h-[90dvh] overflow-y-auto">
            <button
              onClick={close}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              type="button"
              aria-label="閉じる"
            >
              <X className="w-5 h-5" />
            </button>

            {status === 'done' ? (
              <div className="py-8 text-center">
                <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                </div>
                <h3 className="text-lg font-black text-gray-900 mb-1">送信しました！</h3>
                <p className="text-sm text-gray-500">
                  貴重なご意見ありがとうございます。<br />
                  いただいた内容は今後の改善に活用させていただきます。
                </p>
                <button
                  onClick={close}
                  className="mt-6 px-6 py-2.5 rounded-full bg-[#7f19e6] text-white text-sm font-bold hover:bg-[#6b14c4] transition-colors"
                  type="button"
                >
                  閉じる
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                    <MessageSquarePlus className="w-6 h-6 text-[#7f19e6]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-gray-900">お問い合わせ・改善依頼</h3>
                    <p className="text-xs font-bold text-[#7f19e6]">追加機能要望募集中 🙌</p>
                  </div>
                </div>
                <p className="text-sm text-gray-500 mb-4">
                  「こんな機能があったら」「ここを直してほしい」など、お気軽にお寄せください。
                </p>

                {/* 種別選択 */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {CATEGORIES.map((c) => {
                    const Icon = c.icon
                    const selected = category === c.id
                    return (
                      <button
                        key={c.id}
                        onClick={() => setCategory(c.id)}
                        type="button"
                        className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-colors ${
                          selected
                            ? 'border-[#7f19e6] bg-purple-50 ring-1 ring-[#7f19e6]'
                            : 'border-gray-200 hover:border-purple-200 hover:bg-purple-50/50'
                        }`}
                      >
                        <Icon className={`w-4 h-4 flex-shrink-0 ${c.color}`} />
                        <span className="text-xs font-bold text-gray-700">{c.label}</span>
                      </button>
                    )
                  })}
                </div>

                {/* 入力 */}
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  maxLength={5000}
                  placeholder="内容をご記入ください。例：◯◯の画面に△△ボタンがあると便利です／□□でエラーが出ました 等"
                  className="w-full rounded-xl border border-gray-200 p-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#7f19e6] focus:outline-none focus:ring-1 focus:ring-[#7f19e6] resize-none"
                />

                {status === 'error' && (
                  <p className="mt-2 text-xs font-bold text-rose-600">{errorMsg}</p>
                )}

                <button
                  onClick={submit}
                  disabled={!message.trim() || status === 'sending'}
                  type="button"
                  className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-full bg-[#7f19e6] text-white text-sm font-black shadow-lg shadow-purple-500/25 hover:bg-[#6b14c4] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {status === 'sending' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      送信中…
                    </>
                  ) : (
                    '送信する'
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
