'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import toast, { Toaster } from 'react-hot-toast'
import { INDUSTRIES } from '@/lib/doyalist/constants'
import { useApproachUsage } from './useApproachUsage'
import { DOYALIST_UNKNOWN_RESULT, readDoyalistToolResponse, validDoyalistToolResult } from '@/lib/doyalist/tool-response-client'

const CHARS = {
  point: '/kintai/characters/point_%E8%A7%A3%E8%AA%AC.png',
  working: '/kintai/characters/working_%E4%BD%9C%E6%A5%AD%E4%B8%AD.png',
  jump: '/kintai/characters/jump_%E5%A4%A7%E5%96%9C%E3%81%B3.png',
  thinking: '/kintai/characters/thinking_%E8%80%83%E3%81%88%E4%B8%AD.png',
  success: '/kintai/characters/success_%E6%88%90%E5%8A%9F.png',
}

interface Props {
  type: 'form' | 'email' | 'phone'
  title: string
  subtitle: string
  emoji: string
}

const TIPS_BY_TYPE: Record<string, string[]> = {
  form: [
    '冒頭で会社の課題に触れる',
    '自社サービスの具体的な価値を示す',
    'CTAは「15分の打ち合わせ」など軽め',
    '一方的な売り込みは避ける',
  ],
  email: [
    '件名は30字以内で開封率重視',
    '本文は導入→価値提案→次のアクション',
    '装飾記号や絵文字は避ける',
    'プレースホルダで宛先を明示',
  ],
  phone: [
    '受付突破フレーズを冒頭に',
    '想定問答と切り返しトーク付き',
    '「お忙しい所」など配慮の言葉',
    '3〜5回のやりとりを想定',
  ],
}

export default function ToolForm(props: Props) {
  const { data: session, status } = useSession()
  const actor = status === 'unauthenticated' ? '' : session?.user?.id || ''
  const identity = useRef({ actor, version: 0, hasActor: Boolean(actor) })
  if (identity.current.actor !== actor) identity.current = {
    actor, version: identity.current.version + (identity.current.hasActor ? 1 : 0),
    hasActor: identity.current.hasActor || Boolean(actor),
  }
  // Preserve a draft typed before the first identity resolves; subsequent account changes clear private state.
  return <ScopedToolForm key={identity.current.version} {...props} />
}

function ScopedToolForm({ type, title, subtitle, emoji }: Props) {
  const [serviceInput, setServiceInput] = useState('')
  const [targetIndustry, setTargetIndustry] = useState('IT・ソフトウェア')
  const [tone, setTone] = useState('formal')
  const [generating, setGenerating] = useState(false)
  const quota = useApproachUsage(type)
  const quotaRef = useRef(quota)
  quotaRef.current = quota
  const [storedResult, setResult] = useState<{ key: string; text: string } | null>(null)
  const [rejection, setRejection] = useState<{ key: string; action: 'pricing' | 'contact' | null } | null>(null)
  const loginRequired = quota.status === 'unauthenticated' || (quota.status === 'authenticated' && !quota.actor)
  const exhausted = quota.usage?.remaining === 0
  const limitMessage = rejection?.key === quota.key ? '今月の営業文生成上限に達しました。'
    : exhausted ? `今月の営業文生成上限（${quota.usage?.limit}回）に達しました。` : null
  const limitAction = rejection?.key === quota.key ? rejection.action
    : exhausted ? (quota.usage?.tier === 'FREE' || quota.usage?.tier === 'GUEST' ? 'pricing' : 'contact') : null
  const identity = useRef({ actor: quota.actor, type, version: 0 })
  if (identity.current.actor !== quota.actor || identity.current.type !== type) identity.current = { actor: quota.actor, type, version: identity.current.version + 1 }
  const operationKey = JSON.stringify([quota.actor, type, identity.current.version])
  const result = storedResult?.key === operationKey ? storedResult.text : ''
  const activeOperationKey = useRef(operationKey)
  activeOperationKey.current = operationKey
  const pendingOperation = useRef<{ key: string; controller: AbortController; tid: string } | null>(null)

  useEffect(() => {
    if (quota.usage) setRejection(null)
  }, [quota.usage])

  useEffect(() => {
    setGenerating(false)
    return () => {
      const pending = pendingOperation.current
      if (pending?.key === operationKey) {
        pending.controller.abort()
        toast.dismiss(pending.tid)
        pendingOperation.current = null
      }
    }
  }, [operationKey])

  const handleGenerate = async () => {
    if (pendingOperation.current || !quota.allowed || !quota.usage || quota.failed || limitMessage) return
    if (!serviceInput.trim()) { toast.error('サービス内容またはURLを入力してください'); return }
    const operation = { key: operationKey, controller: new AbortController(), tid: toast.loading('AIが文章を作成中...') }
    pendingOperation.current = operation
    setGenerating(true)
    const current = () => pendingOperation.current === operation && activeOperationKey.current === operation.key && !operation.controller.signal.aborted
    try {
      const { res, data } = await readDoyalistToolResponse({
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, serviceInput, targetIndustry, tone }),
      }, operation.controller.signal)
      if (!current()) return
      if (!res.ok) {
        const error = data as Record<string, unknown> | null
        if (res.status === 403 && error?.code === 'MONTHLY_LIMIT_REACHED') {
          setRejection({ key: quotaRef.current.key, action: error.upgradeUrl === '/doyalist/pricing' ? 'pricing' : error.contactUrl === 'https://doyamarke.surisuta.jp/contact' ? 'contact' : null })
          toast.error('今月の営業文生成上限に達しました。', { id: operation.tid })
        } else toast.error(res.status === 401 ? '再度ログインしてから文章を生成してください。' : res.status === 400 ? '入力内容を確認してから再度お試しください。' : DOYALIST_UNKNOWN_RESULT, { id: operation.tid })
        return
      }
      if (!validDoyalistToolResult(data)) throw new Error(DOYALIST_UNKNOWN_RESULT)
      setResult({ key: operation.key, text: data.text })
      toast.success(data.savedToHistory ? '完成し、履歴に保存しました。' : '文章は完成しましたが、履歴への保存を確認できませんでした。コピーして保管してください。', { id: operation.tid })
    } catch {
      if (current()) toast.error(DOYALIST_UNKNOWN_RESULT, { id: operation.tid })
    } finally {
      if (current()) {
        pendingOperation.current = null
        setGenerating(false)
        quotaRef.current.refresh()
      }
    }
  }

  const copyToClipboard = () => {
    if (!result) return
    const key = operationKey
    void navigator.clipboard.writeText(result).then(() => {
      if (activeOperationKey.current === key) toast.success('コピーしました')
    }).catch(() => {
      if (activeOperationKey.current === key) toast.error('コピーできませんでした。文章を選択してコピーしてください。')
    })
  }

  const isUrl = /^https?:\/\//.test(serviceInput.trim())
  const tips = TIPS_BY_TYPE[type] || []

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-8">
      <Toaster position="top-center" />

      <div className="max-w-7xl mx-auto pb-20">
        {/* Page Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-400 to-cyan-500 flex items-center justify-center shadow-md text-2xl">
            {emoji}
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-black text-[#0a1530]">{title}</h1>
            <p className="text-sm font-medium text-slate-500 mt-0.5">{subtitle}</p>
          </div>
        </div>

        {!quota.usage && <div role={quota.failed ? 'alert' : 'status'} className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">{loginRequired ? 'ログインして文章生成を始めてください。' : quota.failed ? '利用枠を確認できませんでした。入力内容は保持しています。' : '利用枠を確認しています。'}{loginRequired ? <Link href={`/auth/signin?callbackUrl=${encodeURIComponent(`/doyalist/tools/${type}`)}`} className="ml-2 underline">ログインする</Link> : quota.failed && <button type="button" onClick={quota.refresh} className="ml-2 underline">再取得する</button>}</div>}

        {limitMessage && (
          <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-bold text-amber-900">
            <span>{limitMessage}</span>
            {limitAction && <Link href={limitAction === 'pricing' ? '/doyalist/pricing' : 'https://doyamarke.surisuta.jp/contact'} className="shrink-0 rounded-full bg-blue-600 px-4 py-2 text-xs font-black text-white">
              {limitAction === 'pricing' ? 'プラン・料金を見る' : '追加枠を相談する'}
            </Link>}
          </div>
        )}

        {/* 2-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT: Form (2/3) */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-3xl shadow-lg shadow-slate-200/50 border border-slate-200 p-6 lg:p-8 space-y-5">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <img src={CHARS.point} alt="" className="w-10 h-10" />
                <div>
                  <h2 className="text-base font-bold text-[#0a1530]">入力は2ステップだけ</h2>
                  <p className="text-xs text-slate-500">企業名・担当者名はAIが仮で入れます</p>
                </div>
              </div>

              {/* 自社サービス */}
              <div>
                <label className="block text-sm font-bold text-[#0a1530] mb-2">
                  ✨ 自社サービスの内容 または URL <span className="text-rose-500 text-xs">*必須</span>
                </label>
                <textarea
                  value={serviceInput}
                  onChange={(e) => setServiceInput(e.target.value)}
                  placeholder={'例: AIで営業リストを自動生成するSaaSツール\nまたは https://doya-ai.surisuta.jp'}
                  rows={3}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm font-medium text-slate-800 bg-white placeholder:text-slate-300 focus:outline-none focus:border-[#0a1530] focus:ring-2 focus:ring-cyan-100 resize-none"
                />
                {isUrl && (<p className="text-xs font-bold text-cyan-600 mt-1">🔗 URLとして認識：AIがサイトの内容を推定します</p>)}
              </div>

              {/* 相手の業種 */}
              <div>
                <label className="block text-sm font-bold text-[#0a1530] mb-2">
                  🎯 相手の業種 <span className="text-rose-500 text-xs">*必須</span>
                </label>
                <select
                  value={targetIndustry}
                  onChange={(e) => setTargetIndustry(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm font-medium text-slate-800 bg-white focus:outline-none focus:border-[#0a1530] focus:ring-2 focus:ring-cyan-100 cursor-pointer"
                >
                  {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>

              {/* トーン */}
              <div>
                <label className="block text-sm font-bold text-[#0a1530] mb-2">💬 トーン</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { v: 'formal', l: '丁寧・フォーマル' },
                    { v: 'friendly', l: '親しみやすい' },
                    { v: 'casual', l: 'カジュアル' },
                  ].map((t) => (
                    <button
                      key={t.v}
                      onClick={() => setTone(t.v)}
                      className={`py-3 rounded-xl text-xs font-bold transition-all ${
                        tone === t.v ? 'bg-[#0a1530] text-white shadow-md' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      {t.l}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleGenerate}
                disabled={generating || Boolean(limitMessage) || !quota.usage || quota.failed || !quota.allowed}
                className="w-full py-4 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-bold text-base rounded-xl shadow-lg shadow-cyan-500/30 hover:shadow-xl active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {generating ? (
                  <><img src={CHARS.working} alt="" className="w-6 h-6 animate-spin" />作成中...</>
                ) : (
                  <><img src={CHARS.jump} alt="" className="w-6 h-6" />文章を作成する</>
                )}
              </button>
            </div>
          </div>

          {/* RIGHT: Preview (1/3) */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-3xl shadow-lg shadow-slate-200/50 border border-slate-200 p-6 lg:sticky lg:top-24">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <span className="text-xl">📝</span>
                <h3 className="text-sm font-bold text-[#0a1530]">生成プレビュー</h3>
              </div>

              {!result && !generating && (
                <div className="py-6 text-center">
                  <p className="text-xs font-bold text-slate-500 mb-3">この内容で作成されます</p>
                  <div className="space-y-2">
                    {tips.map((tip, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-slate-600 text-left">
                        <span className="text-emerald-500 flex-shrink-0 mt-0.5">✓</span>
                        <span>{tip}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {generating && (
                <div className="py-6 text-center space-y-3">
                  <img src={CHARS.thinking} alt="" className="w-20 h-20 mx-auto animate-bounce" />
                  <p className="text-sm font-bold text-[#0a1530]">クマが考え中...</p>
                </div>
              )}

              {result && (
                <div className="py-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500">生成結果</span>
                    <button
                      onClick={copyToClipboard}
                      className="px-3 py-1.5 bg-[#0a1530] text-white font-bold text-xs rounded-lg hover:bg-[#13234d] active:scale-95 transition-all"
                    >
                      📋 コピー
                    </button>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 max-h-[400px] overflow-y-auto">
                    <pre className="whitespace-pre-wrap text-xs text-slate-700 leading-relaxed font-sans">{result}</pre>
                  </div>
                  <p className="text-[10px] text-slate-400">企業名・担当者名は仮置きです（適宜カスタマイズしてご利用ください）</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
