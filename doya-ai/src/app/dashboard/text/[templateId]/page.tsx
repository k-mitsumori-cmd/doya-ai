'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { ArrowLeft, Sparkles, Copy, Loader2, CheckCircle, RotateCcw, AlertCircle, Wand2 } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { SAMPLE_TEMPLATES, CATEGORIES } from '@/lib/templates'
import { canUseGeneration, incrementUsage, UserTier } from '@/lib/usage'
import { SAMPLE_INPUTS } from '@/lib/sample-inputs'

interface InputField {
  name: string
  label: string
  type: string
  required: boolean
  placeholder?: string
  options?: string[]
}

export default function TemplatePage() {
  const params = useParams()
  const { data: session } = useSession()
  const templateId = params.templateId as string

  const template = SAMPLE_TEMPLATES.find((t) => t.id === templateId)
  const category = CATEGORIES.find((c) => c.id === template?.categoryId)

  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [output, setOutput] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  // ユーザーティアの判定
  const getUserTier = (): UserTier => {
    if (!session) return 'guest'
    const plan = (session.user as any)?.plan
    if (plan === 'ENTERPRISE') return 'enterprise'
    if (plan === 'BUSINESS') return 'business'
    if (plan === 'PREMIUM') return 'premium'
    return 'free'
  }

  const tier = getUserTier()

  if (!template) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-6xl mb-4">😅</div>
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            テンプレートが見つかりませんでした
          </h2>
          <Link 
            href="/dashboard/text" 
            className="text-blue-600 hover:underline text-lg"
          >
            ← テンプレート一覧に戻る
          </Link>
        </div>
      </div>
    )
  }

  const handleInputChange = (name: string, value: string) => {
    setInputs((prev) => ({ ...prev, [name]: value }))
    setError('')
  }

  const handleGenerate = async () => {
    setError('')

    // 使用回数チェック
    if (!canUseGeneration(tier)) {
      setError('本日の利用回数上限に達しました。明日またお試しください。')
      return
    }

    // 必須フィールドのチェック
    const missingFields = (template.inputFields as InputField[])
      .filter((field) => field.required && !inputs[field.name])
      .map((field) => field.label)

    if (missingFields.length > 0) {
      setError(`「${missingFields.join('」「')}」を入力してください`)
      return
    }

    setIsGenerating(true)
    setOutput('')

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId,
          inputs,
          tone: 'neutral',
          length: 'standard',
        }),
      })

      const data = await response.json()

      if (data.error) {
        setError(data.error)
        return
      }

      setOutput(data.output)
      incrementUsage()
      toast.success('文章ができました！')

      // 履歴に保存
      try {
        const history = JSON.parse(localStorage.getItem('doya_generation_history') || '[]')
        history.unshift({
          id: Date.now().toString(),
          templateId,
          templateName: template.name,
          input: inputs,
          output: data.output,
          createdAt: new Date().toISOString(),
        })
        localStorage.setItem('doya_generation_history', JSON.stringify(history.slice(0, 50)))
      } catch (e) {
        console.error('Failed to save history:', e)
      }
    } catch (err) {
      console.error('Generation error:', err)
      setError('エラーが発生しました。もう一度お試しください。')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(output)
    setCopied(true)
    toast.success('コピーしました！')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleClear = () => {
    setInputs({})
    setOutput('')
    setError('')
  }

  // サンプル入力を適用
  const handleSampleInput = () => {
    const sampleData = SAMPLE_INPUTS[templateId]
    if (sampleData) {
      setInputs(sampleData)
      setError('')
      toast.success('サンプルを入力しました！', { icon: '✨' })
    } else {
      toast.error('このテンプレートにはサンプルがありません')
    }
  }

  return (
    <div className="min-h-screen bg-white lg:bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6 lg:py-10">
        {/* 戻るボタン */}
        <Link 
          href="/dashboard" 
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 text-base mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          ホームに戻る
        </Link>

        {/* ヘッダー */}
        <div className="bg-white rounded-2xl p-5 border border-gray-200 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="text-3xl">{category?.icon}</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">
                {template.name}
              </h1>
              <p className="text-sm text-gray-600">{template.description}</p>
            </div>
          </div>
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* 入力フォーム */}
        <div className="bg-white rounded-2xl p-5 border border-gray-200 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
              <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
              情報を入力
            </h2>
            {SAMPLE_INPUTS[templateId] && (
              <button
                onClick={handleSampleInput}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white text-sm font-bold rounded-xl shadow-md hover:shadow-lg transition-all"
              >
                <Wand2 className="w-4 h-4" />
                サンプルで試す
              </button>
            )}
          </div>

          <div className="space-y-4">
            {(template.inputFields as InputField[]).map((field) => (
              <div key={field.name}>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                
                {field.type === 'textarea' ? (
                  <textarea
                    value={inputs[field.name] || ''}
                    onChange={(e) => handleInputChange(field.name, e.target.value)}
                    placeholder={field.placeholder || `${field.label}を入力`}
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-base resize-none"
                  />
                ) : field.type === 'select' && field.options ? (
                  <select
                    value={inputs[field.name] || ''}
                    onChange={(e) => handleInputChange(field.name, e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-base bg-white"
                  >
                    <option value="">選択してください</option>
                    {field.options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={inputs[field.name] || ''}
                    onChange={(e) => handleInputChange(field.name, e.target.value)}
                    placeholder={field.placeholder || `${field.label}を入力`}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-base"
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 生成ボタン */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-blue-400 text-white text-lg font-bold px-6 py-4 rounded-xl transition-all"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                作成中...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                文章を作成する
              </>
            )}
          </button>
          
          <button
            onClick={handleClear}
            className="flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-4 rounded-xl transition-all"
            title="クリア"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>

        {/* 生成中のローディング */}
        {isGenerating && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center mb-6">
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto mb-3" />
            <p className="text-blue-700 font-medium">
              AIが文章を作成しています...
            </p>
            <p className="text-blue-600 text-sm mt-1">
              10〜30秒ほどお待ちください
            </p>
          </div>
        )}

        {/* 生成結果 */}
        {output && !isGenerating && (
          <div className="bg-white rounded-2xl p-5 border-2 border-green-300 mb-6">
            <h2 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
              完成した文章
            </h2>

            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <p className="text-base text-gray-800 whitespace-pre-wrap leading-relaxed">
                {output}
              </p>
            </div>

            <button
              onClick={handleCopy}
              className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white text-lg font-bold px-6 py-4 rounded-xl transition-all"
            >
              {copied ? (
                <>
                  <CheckCircle className="w-5 h-5" />
                  コピーしました！
                </>
              ) : (
                <>
                  <Copy className="w-5 h-5" />
                  文章をコピーする
                </>
              )}
            </button>
          </div>
        )}

        {/* ヒント */}
        {!output && !isGenerating && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <p className="text-yellow-800 text-sm flex items-start gap-2">
              <span className="text-lg">💡</span>
              <span>
                入力欄をすべて埋めてから「文章を作成する」ボタンを押してください。
                より詳しく入力するほど、良い文章ができます。
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
