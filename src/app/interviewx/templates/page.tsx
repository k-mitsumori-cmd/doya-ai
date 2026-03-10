'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'

export default function TemplatesPage() {
  const router = useRouter()
  const [templates, setTemplates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/interviewx/templates')
      .then(r => r.json())
      .then(data => {
        if (data.success) setTemplates(data.templates || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const presets = templates.filter(t => t.isPreset)
  const custom = templates.filter(t => !t.isPreset)

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">テンプレート管理</h1>
          <p className="text-slate-500 mt-1">プリセットテンプレートとカスタムテンプレートを管理します。</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <>
          {/* プリセットテンプレート */}
          <div className="mb-10">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">
              プリセットテンプレート（{presets.length}種類）
            </h2>
            <div className="grid grid-cols-3 gap-4">
              {presets.map(tpl => (
                <div
                  key={tpl.id}
                  className="bg-white rounded-xl border border-slate-200 p-5 hover:border-indigo-300 hover:shadow-md transition-all"
                >
                  <div className="text-3xl mb-3">{tpl.icon || '📋'}</div>
                  <h3 className="font-bold text-slate-900 mb-1">{tpl.name}</h3>
                  <p className="text-xs text-slate-500 mb-3 line-clamp-2">{tpl.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">
                      {(tpl.defaultQuestions as any[])?.length || 0}個の質問
                    </span>
                    <span className="text-xs text-slate-400">
                      使用: {tpl.usageCount}回
                    </span>
                  </div>
                  <button
                    onClick={() => router.push('/interviewx/new')}
                    className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-bold hover:bg-indigo-100 transition-colors"
                  >
                    このテンプレートで作成
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* カスタムテンプレート */}
          <div>
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">
              カスタムテンプレート（{custom.length}件）
            </h2>
            {custom.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
                <p className="text-slate-400 mb-4">カスタムテンプレートはまだありません</p>
                <p className="text-xs text-slate-400">
                  プロジェクト作成時に独自の質問セットをテンプレートとして保存できます。
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {custom.map(tpl => (
                  <div
                    key={tpl.id}
                    className="bg-white rounded-xl border border-slate-200 p-5"
                  >
                    <div className="text-3xl mb-3">{tpl.icon || '📋'}</div>
                    <h3 className="font-bold text-slate-900 mb-1">{tpl.name}</h3>
                    <p className="text-xs text-slate-500 mb-3 line-clamp-2">{tpl.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">
                        {(tpl.defaultQuestions as any[])?.length || 0}個の質問
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
