'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

interface Recipe {
  id: string
  name: string
  description: string | null
  category: string | null
  editingGuidelines: string | null
  isTemplate: boolean
  usageCount: number
}

const CATEGORY_ICONS: Record<string, string> = {
  interview: 'mic',
  panel: 'groups',
  pr: 'campaign',
  news: 'newspaper',
  column: 'edit_note',
  case_study: 'description',
  event: 'event',
  profile: 'person',
  summary: 'summarize',
  custom: 'settings',
}

const CATEGORY_LABELS: Record<string, string> = {
  interview: 'インタビュー',
  panel: '対談・座談会',
  pr: 'プレスリリース',
  news: 'ニュース',
  column: 'コラム',
  case_study: 'ケーススタディ',
  event: 'イベント',
  profile: '人物紹介',
  summary: '要約',
  custom: 'カスタム',
}

export default function RecipeSelectionPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string

  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [customInstructions, setCustomInstructions] = useState('')
  const [displayFormat, setDisplayFormat] = useState('MONOLOGUE')
  const [filterCategory, setFilterCategory] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/interview/recipes')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setRecipes(data.recipes || [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const categories = [...new Set(recipes.map((r) => r.category).filter(Boolean))]
  const filtered = filterCategory
    ? recipes.filter((r) => r.category === filterCategory)
    : recipes

  const selectedRecipe = recipes.find((r) => r.id === selectedId)

  const handleGenerate = () => {
    if (!selectedId) return
    // クエリパラメータで渡す
    const params = new URLSearchParams({
      recipeId: selectedId,
      displayFormat,
      ...(customInstructions ? { instructions: customInstructions } : {}),
    })
    router.push(`/interview/projects/${projectId}/generate?${params}`)
  }

  return (
    <div className="space-y-8">
      {/* ヘッダー */}
      <div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900">スキル選択</h1>
        <p className="text-sm text-slate-500 mt-0.5 leading-relaxed">記事の構成テンプレートを選んでください</p>
      </div>

      {/* ステッパー */}
      <div className="flex items-center gap-2 text-xs">
        {['素材アップ', '文字起こし', 'スキル選択', 'AI生成', '編集'].map((step, i) => (
          <div key={step} className="flex items-center gap-2">
            <div className={`px-3 py-1 rounded-full tracking-tight ${
              i === 2 ? 'bg-[#7f19e6] text-white font-bold shadow-md shadow-[#7f19e6]/20' : i < 2 ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'
            }`}>
              {i < 2 ? '✓ ' : ''}{step}
            </div>
            {i < 4 && <span className="text-slate-300">→</span>}
          </div>
        ))}
      </div>

      {/* カテゴリフィルター */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterCategory(null)}
          className={`px-3 py-1.5 rounded-full text-xs transition-all ${
            !filterCategory ? 'bg-[#7f19e6] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          すべて
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCategory(filterCategory === cat ? null : cat!)}
            className={`px-3 py-1.5 rounded-full text-xs transition-all flex items-center gap-1 ${
              filterCategory === cat ? 'bg-[#7f19e6] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span className="material-symbols-outlined text-sm">{CATEGORY_ICONS[cat!] || 'edit_note'}</span>
            {CATEGORY_LABELS[cat!] || cat}
          </button>
        ))}
      </div>

      {/* Two-Column Layout */}
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Left: Recipe Grid */}
        <div className="flex-1 w-full">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm animate-pulse">
                  <div className="h-12 w-12 bg-slate-200 rounded-lg mb-3" />
                  <div className="h-5 bg-slate-200 rounded w-2/3 mb-3" />
                  <div className="h-3 bg-slate-100 rounded w-full mb-2" />
                  <div className="h-3 bg-slate-100 rounded w-3/4" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Custom Recipe Card */}
              <div className="group relative p-5 rounded-xl border-2 border-dashed border-slate-300 hover:border-[#7f19e6]/50 transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-3 bg-white/40">
                <span className="material-symbols-outlined text-slate-400 text-3xl">add_circle</span>
                <h3 className="font-bold text-lg text-slate-600">カスタムスキル</h3>
              </div>

              {/* Recipe Cards */}
              {filtered.map((recipe) => {
                const isSelected = selectedId === recipe.id
                return (
                  <button
                    key={recipe.id}
                    onClick={() => setSelectedId(isSelected ? null : recipe.id)}
                    className={`text-left p-5 rounded-xl transition-all relative ${
                      isSelected
                        ? 'border-2 border-[#7f19e6] shadow-lg shadow-[#7f19e6]/5 bg-[#7f19e6]/5'
                        : 'border border-slate-200 bg-white shadow-sm hover:border-[#7f19e6]/50'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center transition-all ${
                        isSelected
                          ? 'bg-[#7f19e6] text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        <span className="material-symbols-outlined text-2xl">
                          {CATEGORY_ICONS[recipe.category!] || 'edit_note'}
                        </span>
                      </div>
                      {isSelected && (
                        <span className="material-symbols-outlined text-[#7f19e6] text-2xl">
                          check_circle
                        </span>
                      )}
                      {!isSelected && recipe.isTemplate && (
                        <span className="text-[11px] font-medium px-2 py-0.5 bg-blue-100 text-blue-600 border border-blue-200 rounded-full">
                          プリセット
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-slate-900 leading-snug mb-2">{recipe.name}</h3>
                    <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 mb-3">{recipe.description}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded uppercase font-bold">
                        {CATEGORY_LABELS[recipe.category!] || recipe.category}
                      </span>
                      <span className="text-[10px] text-slate-400">使用: <span className="font-mono">{recipe.usageCount}</span>回</span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Right: Preview Panel - sticky sidebar */}
        <div className="w-full lg:w-[400px] shrink-0 sticky top-24">
          <div className="rounded-xl bg-white border border-slate-200 overflow-hidden shadow-xl">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h3 className="font-bold text-sm uppercase tracking-widest text-slate-500">構成プレビュー</h3>
              {selectedRecipe && (
                <span className="px-2 py-1 rounded-full bg-[#7f19e6]/10 text-[#7f19e6] text-[10px] font-bold">
                  {selectedRecipe.name}
                </span>
              )}
            </div>
            <div className="p-6 space-y-6">
              {selectedRecipe ? (
                <>
                  {/* Show editing guidelines if available */}
                  {selectedRecipe.editingGuidelines && (
                    <div className="pl-4 border-l-2 border-[#7f19e6]/30 space-y-3">
                      <pre className="text-xs text-slate-500 whitespace-pre-wrap">
                        {selectedRecipe.editingGuidelines.slice(0, 300)}
                        {selectedRecipe.editingGuidelines.length > 300 && '...'}
                      </pre>
                    </div>
                  )}

                  {/* Display format selection */}
                  <div>
                    <p className="text-sm font-medium text-slate-700 mb-2">表示形式</p>
                    <div className="flex gap-2">
                      {[
                        { value: 'MONOLOGUE', label: 'ストーリー形式', desc: '第三者の語りで構成' },
                        { value: 'QA', label: 'Q&A形式', desc: '質問と回答の対話形式' },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setDisplayFormat(opt.value)}
                          className={`flex-1 px-4 py-2.5 rounded-lg text-sm border transition-all ${
                            displayFormat === opt.value
                              ? 'border-[#7f19e6] bg-[#7f19e6]/5 text-[#7f19e6] shadow-md shadow-[#7f19e6]/10 font-semibold'
                              : 'border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <span className="font-medium">{opt.label}</span>
                          <br />
                          <span className="text-[10px] text-slate-400">{opt.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom instructions textarea */}
                  <div>
                    <p className="text-sm font-medium text-slate-700 mb-1">こだわり指示（任意）</p>
                    <textarea
                      value={customInstructions}
                      onChange={(e) => setCustomInstructions(e.target.value)}
                      placeholder="例: 「です・ます調で」「会社名は株式会社〇〇と正式名称で」「3000文字程度で」"
                      rows={3}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#7f19e6] resize-none"
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="h-6 w-3/4 bg-slate-100 rounded"></div>
                  <div className="h-4 w-full bg-slate-50 rounded"></div>
                  <div className="pl-4 border-l-2 border-[#7f19e6]/30 space-y-3">
                    <div className="h-3 w-1/2 bg-slate-100 rounded"></div>
                    <div className="h-2 w-full bg-slate-50 rounded"></div>
                  </div>
                  <p className="text-xs text-slate-400 text-center">スキルを選択するとプレビューが表示されます</p>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-slate-100 bg-slate-50/30">
              <button
                onClick={handleGenerate}
                disabled={!selectedId}
                className="w-full py-4 bg-[#7f19e6] text-white rounded-xl font-bold text-lg shadow-2xl hover:shadow-lg hover:shadow-[#7f19e6]/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined">rocket_launch</span>
                AI記事を生成する
              </button>
              <p className="text-center text-[11px] text-slate-500 mt-4 uppercase tracking-wider font-semibold">
                推定時間: 2-3分
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
