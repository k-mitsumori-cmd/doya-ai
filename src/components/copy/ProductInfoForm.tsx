'use client'

import { useState } from 'react'
import {
  Globe,
  Loader2,
  Sparkles,
} from 'lucide-react'

export interface ProductInfoData {
  productUrl: string
  productName: string
  productDesc: string
  productFeatures: string
  analyzedProductInfo: Record<string, unknown> | null
}

export interface PersonaData {
  name?: string
  age?: string
  gender?: string
  occupation?: string
  income?: string
  painPoints?: string[]
  desires?: string[]
  keywords?: string[]
  searchBehavior?: string
  purchaseTrigger?: string
  demographics?: Record<string, unknown>
  [key: string]: unknown
}

interface ProductInfoFormProps {
  /** Current product info values */
  data: ProductInfoData
  /** Called when any field changes */
  onChange: (data: Partial<ProductInfoData>) => void
  /** Theme color for focus/accent (default: 'amber') */
  theme?: 'amber' | 'orange' | 'yellow'
  /** Whether to show inline persona generation (search/sns pages) */
  showPersona?: boolean
  /** Current persona data (for inline persona display) */
  persona?: PersonaData | null
  /** Callback to generate persona */
  onGeneratePersona?: () => void
  /** Whether persona is being generated */
  isGeneratingPersona?: boolean
  /** Project name for auto-fill */
  projectName?: string
  /** Setter for project name */
  onProjectNameChange?: (name: string) => void
}

export default function ProductInfoForm({
  data,
  onChange,
  theme = 'amber',
  showPersona = false,
  persona = null,
  onGeneratePersona,
  isGeneratingPersona = false,
  projectName,
  onProjectNameChange,
}: ProductInfoFormProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState('')

  const themeColors = {
    amber: {
      focus: 'focus:border-amber-500',
      button: 'bg-amber-500 hover:bg-amber-400',
      personaButton: 'bg-amber-500 hover:bg-amber-400',
    },
    orange: {
      focus: 'focus:border-orange-500',
      button: 'bg-orange-500 hover:bg-orange-400',
      personaButton: 'bg-orange-500 hover:bg-orange-400',
    },
    yellow: {
      focus: 'focus:border-yellow-500',
      button: 'bg-yellow-500 hover:bg-yellow-400',
      personaButton: 'bg-yellow-500 hover:bg-yellow-400',
    },
  }
  const colors = themeColors[theme]

  const analyzeUrl = async () => {
    if (!data.productUrl) return
    setIsAnalyzing(true)
    setError('')
    try {
      const res = await fetch('/api/copy/analyze-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: data.productUrl }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'URL解析に失敗しました')
      const info = result.productInfo || {}
      const updates: Partial<ProductInfoData> = { analyzedProductInfo: info }
      if (info.productName) updates.productName = info.productName
      if (info.mainBenefit) updates.productDesc = info.mainBenefit
      if (info.features?.length) updates.productFeatures = info.features.join('\n')
      onChange(updates)
      if (info.productName && onProjectNameChange && !projectName) {
        onProjectNameChange(info.productName)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'URL解析に失敗しました')
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <div>
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-500 text-sm mb-6">
          {error}
        </div>
      )}

      {/* URL解析 */}
      <div className="mb-6">
        <label className="block text-sm font-bold text-gray-600 mb-2">商品・LP URL（任意）</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="url"
              value={data.productUrl}
              onChange={e => onChange({ productUrl: e.target.value })}
              placeholder="https://..."
              className={`w-full pl-9 pr-4 py-3 bg-gray-100 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none ${colors.focus}`}
            />
          </div>
          <button
            onClick={analyzeUrl}
            disabled={!data.productUrl || isAnalyzing}
            className={`px-4 py-3 ${colors.button} disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors whitespace-nowrap`}
          >
            {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : '自動解析'}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-bold text-gray-600 mb-2">商品・サービス名 <span className="text-red-400">*</span></label>
          <input
            type="text"
            value={data.productName}
            onChange={e => onChange({ productName: e.target.value })}
            placeholder="例：ドヤコピーAI"
            className={`w-full px-4 py-3 bg-gray-100 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none ${colors.focus}`}
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-600 mb-2">商品説明</label>
          <textarea
            value={data.productDesc}
            onChange={e => onChange({ productDesc: e.target.value })}
            placeholder="商品の概要・特徴・ターゲットなど"
            rows={3}
            className={`w-full px-4 py-3 bg-gray-100 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none ${colors.focus} resize-none`}
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-600 mb-2">特徴・ベネフィット</label>
          <textarea
            value={data.productFeatures}
            onChange={e => onChange({ productFeatures: e.target.value })}
            placeholder="例：月200回まで生成可能、5種類のライタータイプ、CSV出力対応"
            rows={3}
            className={`w-full px-4 py-3 bg-gray-100 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none ${colors.focus} resize-none`}
          />
        </div>
      </div>

      {/* インラインペルソナ生成 (search / sns で使用) */}
      {showPersona && onGeneratePersona && (
        <div className="mt-6 p-4 bg-white border border-gray-200 rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-600">ターゲットペルソナ（任意）</h3>
            <button
              onClick={onGeneratePersona}
              disabled={!data.productName || isGeneratingPersona}
              className={`flex items-center gap-1.5 px-3 py-1.5 ${colors.personaButton} disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors`}
            >
              {isGeneratingPersona ? (
                <><Loader2 className="w-3 h-3 animate-spin" />生成中...</>
              ) : (
                <><Sparkles className="w-3 h-3" />AIで自動生成</>
              )}
            </button>
          </div>
          {persona && (
            <div className="text-sm text-gray-600 space-y-1">
              {persona.name && (
                <p><span className="text-gray-400">名前：</span>{persona.name}{persona.age ? `（${persona.age}` : ''}{persona.gender ? `・${persona.gender}）` : persona.age ? '）' : ''}</p>
              )}
              {persona.painPoints && (persona.painPoints as string[]).length > 0 && (
                <p><span className="text-gray-400">悩み：</span>{(persona.painPoints as string[]).slice(0, 2).join('、')}</p>
              )}
              {persona.keywords && (persona.keywords as string[]).length > 0 && (
                <p><span className="text-gray-400">検索KW：</span>{(persona.keywords as string[]).join('、')}</p>
              )}
              {persona.demographics && (
                <p><span className="text-gray-400">デモグラ：</span>{String((persona.demographics as Record<string, unknown>)?.summary || '')}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
