'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { 
  ArrowLeft, Sparkles, Loader2, Copy, Check, 
  RefreshCw, Wand2, LogIn 
} from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'
import { SAMPLE_TEMPLATES } from '@/lib/templates'

// ゲスト使用状況管理
const GUEST_DAILY_LIMIT = 3
const GUEST_STORAGE_KEY = 'kantan_guest_usage'

function getGuestUsage(): { count: number; date: string } {
  if (typeof window === 'undefined') return { count: 0, date: '' }
  const stored = localStorage.getItem(GUEST_STORAGE_KEY)
  if (!stored) return { count: 0, date: '' }
  try {
    return JSON.parse(stored)
  } catch {
    return { count: 0, date: '' }
  }
}

function setGuestUsage(count: number) {
  if (typeof window === 'undefined') return
  const today = new Date().toISOString().split('T')[0]
  localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify({ count, date: today }))
}

// サンプル入力データ
const SAMPLE_INPUTS: Record<string, Record<string, string>> = {
  'business-email': {
    emailType: '依頼・お願い',
    recipient: '取引先・クライアント',
    subject: '打ち合わせ日程の調整について',
    content: '来週中に1時間ほどお時間いただき、新サービスのご説明をさせていただきたく存じます。ご都合の良い日時をいくつかご教示いただけますと幸いです。',
    tone: '丁寧（無難に）',
  },
  'blog-article': {
    theme: 'リモートワークの生産性を上げる方法',
    target: '30代のビジネスパーソン',
    purpose: 'ハウツー',
    keywords: 'リモートワーク,在宅勤務,生産性,集中力',
    wordCount: '2000文字',
  },
  'catchcopy': {
    product: 'オンライン英会話サービス',
    target: '英語を学び直したい30代社会人',
    appeal: '1日15分から始められる、ネイティブ講師とのマンツーマンレッスン。通勤時間でも受講可能。',
    tone: 'インパクト重視',
  },
  'instagram-caption': {
    content: '新商品のオーガニックスキンケアセットを紹介。肌に優しい天然成分100%使用。',
    tone: 'ポップ',
    target: '20-30代の美容に関心のある女性',
  },
}

export default function TemplateDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session, status } = useSession()
  const templateId = params.templateId as string

  // テンプレート取得
  const template = SAMPLE_TEMPLATES.find(t => t.id === templateId)

  // フォーム状態
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [isGenerating, setIsGenerating] = useState(false)
  const [output, setOutput] = useState('')
  const [copied, setCopied] = useState(false)
  const [guestUsageCount, setGuestUsageCount] = useState(0)

  const isGuest = !session
  
  // ゲスト使用状況を読み込み
  useEffect(() => {
    if (isGuest && typeof window !== 'undefined') {
      const usage = getGuestUsage()
      const today = new Date().toISOString().split('T')[0]
      if (usage.date === today) {
        setGuestUsageCount(usage.count)
      } else {
        setGuestUsageCount(0)
      }
    }
  }, [isGuest])

  const guestRemainingCount = GUEST_DAILY_LIMIT - guestUsageCount
  const canGuestGenerate = guestRemainingCount > 0
  
  // 入力が全て揃っているかチェック
  const isFormValid = template?.inputFields.every(field => {
    if (!field.required) return true
    return inputs[field.name]?.trim()
  }) ?? false

  const canGenerate = isFormValid && (session || canGuestGenerate)

  // テンプレートが見つからない
  if (!template) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600 mb-4">テンプレートが見つかりません</p>
          <Link href="/kantan/dashboard" className="text-blue-600 hover:underline">
            ダッシュボードに戻る
          </Link>
        </div>
      </div>
    )
  }

  // サンプル入力
  const handleSampleInput = () => {
    const sample = SAMPLE_INPUTS[templateId]
    if (sample) {
      setInputs(sample)
      toast.success('サンプルを入力しました！', { icon: '✨' })
    } else {
      // 汎用的なサンプル
      const genericInputs: Record<string, string> = {}
      template.inputFields.forEach(field => {
        if (field.type === 'select' && field.options) {
          genericInputs[field.name] = field.options[0]
        } else if (field.placeholder) {
          genericInputs[field.name] = field.placeholder.replace('例：', '')
        } else {
          genericInputs[field.name] = `サンプル${field.label}`
        }
      })
      setInputs(genericInputs)
      toast.success('サンプルを入力しました！', { icon: '✨' })
    }
  }

  // 生成
  const handleGenerate = async () => {
    if (!canGenerate) return

    setIsGenerating(true)
    setOutput('')

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId,
          inputs,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '生成に失敗しました')
      }

      setOutput(data.output)
      toast.success('生成完了！', { icon: '🎉' })

      // ゲストの使用回数を更新
      if (isGuest) {
        const newCount = guestUsageCount + 1
        setGuestUsageCount(newCount)
        setGuestUsage(newCount)
      }
    } catch (error: any) {
      toast.error(error.message || '生成に失敗しました')
    } finally {
      setIsGenerating(false)
    }
  }

  // コピー
  const handleCopy = () => {
    navigator.clipboard.writeText(output)
    setCopied(true)
    toast.success('コピーしました！')
    setTimeout(() => setCopied(false), 2000)
  }

  // リセット
  const handleReset = () => {
    setOutput('')
    setInputs({})
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-center" />
      
      {/* ヘッダー */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/kantan/dashboard" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:inline">戻る</span>
          </Link>
          
          <h1 className="font-bold text-gray-800 truncate">{template.name}</h1>
          
          {session ? (
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-blue-600 text-sm font-bold">
                {session.user?.name?.[0] || 'U'}
              </span>
            </div>
          ) : (
            <Link href="/auth/signin" className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-full">
              <LogIn className="w-4 h-4" />
            </Link>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {/* ゲストバナー */}
        {isGuest && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <p className="text-sm text-blue-700">
                🆓 お試しモード：残り <strong>{guestRemainingCount}回</strong>
              </p>
              <Link href="/auth/signin">
                <button className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-full">
                  ログインで10回に！
                </button>
              </Link>
            </div>
          </div>
        )}

        {/* 出力結果がある場合 */}
        {output ? (
          <div className="animate-fade-in">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-900">📝 生成結果</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'コピー済み' : 'コピー'}
                  </button>
                </div>
              </div>
              <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-xl p-4">
                {output}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleReset}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-5 h-5" />
                新しく作成
              </button>
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !canGenerate}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Sparkles className="w-5 h-5" />
                もう一度生成
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* テンプレート説明 */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 mb-6">
              <p className="text-gray-600">{template.description}</p>
            </div>

            {/* サンプル入力ボタン */}
            <button
              onClick={handleSampleInput}
              className="w-full mb-6 py-3 px-4 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2"
            >
              <Wand2 className="w-5 h-5" />
              ワンボタンでサンプル入力
            </button>

            {/* 入力フォーム */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 mb-6">
              <h2 className="font-bold text-gray-900 mb-4">入力項目</h2>
              <div className="space-y-4">
                {template.inputFields.map((field) => (
                  <div key={field.name}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    
                    {field.type === 'select' ? (
                      <select
                        value={inputs[field.name] || ''}
                        onChange={(e) => setInputs({ ...inputs, [field.name]: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                      >
                        <option value="">選択してください</option>
                        {field.options?.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    ) : field.type === 'textarea' ? (
                      <textarea
                        value={inputs[field.name] || ''}
                        onChange={(e) => setInputs({ ...inputs, [field.name]: e.target.value })}
                        placeholder={field.placeholder}
                        rows={4}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all resize-none"
                      />
                    ) : (
                      <input
                        type="text"
                        value={inputs[field.name] || ''}
                        onChange={(e) => setInputs({ ...inputs, [field.name]: e.target.value })}
                        placeholder={field.placeholder}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 生成ボタン */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !canGenerate}
              className={`
                w-full py-4 rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-3
                ${canGenerate && !isGenerating
                  ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-xl shadow-blue-500/25 hover:shadow-2xl'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }
              `}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Sparkles className="w-6 h-6" />
                  生成する
                </>
              )}
            </button>

            {!canGenerate && isGuest && !canGuestGenerate && (
              <p className="text-center text-sm text-gray-500 mt-3">
                本日の無料お試しは上限に達しました。
                <Link href="/auth/signin" className="text-blue-600 hover:underline ml-1">
                  ログインで続ける
                </Link>
              </p>
            )}
          </>
        )}
      </main>
    </div>
  )
}

