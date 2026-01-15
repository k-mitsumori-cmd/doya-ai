'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { StrategyAppLayout } from '@/components/StrategyAppLayout'
import { motion } from 'framer-motion'
import { Sparkles, Loader2, ArrowRight } from 'lucide-react'

export default function StrategyCreatePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'input' | 'generating' | 'result'>('input')
  const [projectId, setProjectId] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    serviceUrl: '',
    businessModel: '',
    averagePrice: '',
    targetCustomer: '',
    budgetRange: '',
    salesType: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setStep('generating')

    try {
      // Step 1: Kernel生成
      const kernelResponse = await fetch('/api/strategy/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 'kernel',
          input: formData,
        }),
      })

      if (!kernelResponse.ok) {
        const error = await kernelResponse.json()
        throw new Error(error.error || '生成に失敗しました')
      }

      const kernelResult = await kernelResponse.json()
      const newProjectId = kernelResult.projectId

      if (!newProjectId) {
        throw new Error('プロジェクトIDが取得できませんでした')
      }

      setProjectId(newProjectId)

      // Step 2: Phase生成
      await fetch('/api/strategy/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 'phase',
          projectId: newProjectId,
          coreStrategy: kernelResult.result,
        }),
      })

      // Step 3: Visualization生成（非同期で実行）
      fetch('/api/strategy/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 'visualization',
          projectId: newProjectId,
          phases: kernelResult.result,
        }),
      }).catch(console.error)

      // Step 4: External Research生成（非同期で実行）
      fetch('/api/strategy/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 'external-research',
          projectId: newProjectId,
          productInfo: {
            serviceUrl: formData.serviceUrl,
            businessModel: formData.businessModel,
            targetCustomer: formData.targetCustomer,
          },
        }),
      }).catch(console.error)

      // 詳細ページにリダイレクト
      router.push(`/strategy/${newProjectId}`)
    } catch (error: any) {
      console.error('Strategy generation error:', error)
      alert(error.message || '生成に失敗しました')
      setStep('input')
      setLoading(false)
    }
  }

  if (step === 'generating') {
    return (
      <StrategyAppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="w-16 h-16 mx-auto mb-4"
            >
              <Sparkles className="w-16 h-16 text-indigo-600" />
            </motion.div>
            <h2 className="text-2xl font-black text-slate-900 mb-2">戦略を生成中...</h2>
            <p className="text-sm text-slate-600">最適なマーケティング戦略を構造化しています</p>
          </div>
        </div>
      </StrategyAppLayout>
    )
  }

  return (
    <StrategyAppLayout>
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-slate-900 mb-2">新規戦略作成</h1>
          <p className="text-sm text-slate-600">
            サービス情報を入力して、最適なマーケティング戦略を生成します
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                サービスURL <span className="text-slate-400">(任意)</span>
              </label>
              <input
                type="url"
                value={formData.serviceUrl}
                onChange={(e) => setFormData({ ...formData, serviceUrl: e.target.value })}
                placeholder="https://example.com"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                ビジネスモデル <span className="text-slate-400">(任意)</span>
              </label>
              <input
                type="text"
                value={formData.businessModel}
                onChange={(e) => setFormData({ ...formData, businessModel: e.target.value })}
                placeholder="例: BtoB SaaS、EC、サブスクリプション"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                平均単価 <span className="text-slate-400">(任意)</span>
              </label>
              <input
                type="text"
                value={formData.averagePrice}
                onChange={(e) => setFormData({ ...formData, averagePrice: e.target.value })}
                placeholder="例: 10,000円、50,000円/月"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                想定顧客 <span className="text-slate-400">(任意)</span>
              </label>
              <textarea
                value={formData.targetCustomer}
                onChange={(e) => setFormData({ ...formData, targetCustomer: e.target.value })}
                placeholder="例: 中小企業のマーケティング担当者、スタートアップの経営者"
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                予算レンジ <span className="text-slate-400">(任意)</span>
              </label>
              <input
                type="text"
                value={formData.budgetRange}
                onChange={(e) => setFormData({ ...formData, budgetRange: e.target.value })}
                placeholder="例: 月額10万円、年額100万円"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                営業体制 <span className="text-slate-400">(任意)</span>
              </label>
              <input
                type="text"
                value={formData.salesType}
                onChange={(e) => setFormData({ ...formData, salesType: e.target.value })}
                placeholder="例: セルフサービス、営業チームあり、代理店経由"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  戦略を生成する
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </StrategyAppLayout>
  )
}
