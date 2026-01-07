'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { 
  Palette, ArrowLeft, Save, Upload, Trash2, Plus, X, 
  Loader2, CheckCircle, AlertCircle, Image as ImageIcon,
  Eye, Info, Sparkles
} from 'lucide-react'
import toast from 'react-hot-toast'
import { cn, isLightColor } from '@/lib/utils'

// フォント雰囲気オプション
const FONT_MOODS = [
  { value: 'modern', label: 'モダン', desc: 'すっきりとした現代的な雰囲気', icon: '🔲' },
  { value: 'traditional', label: '伝統的', desc: '格式高く信頼感のある雰囲気', icon: '🏛️' },
  { value: 'playful', label: '遊び心', desc: 'カジュアルで親しみやすい雰囲気', icon: '🎨' },
  { value: 'elegant', label: 'エレガント', desc: '洗練された高級感のある雰囲気', icon: '✨' },
]

// プリセットカラー
const PRESET_COLORS = [
  '#2563EB', // Blue
  '#7C3AED', // Purple
  '#EC4899', // Pink
  '#EF4444', // Red
  '#F59E0B', // Amber
  '#10B981', // Emerald
  '#14B8A6', // Teal
  '#0EA5E9', // Sky
  '#1F2937', // Gray
  '#000000', // Black
]

interface BrandKit {
  logoUrl: string | null
  primaryColor: string | null
  secondaryColor: string | null
  fontMood: string | null
  ngWords: string[]
}

export default function BrandPage() {
  const { data: session } = useSession()
  const plan = (session?.user as any)?.plan || 'FREE'
  const isPro = plan === 'PRO'

  const [brandKit, setBrandKit] = useState<BrandKit>({
    logoUrl: null,
    primaryColor: '#2563EB',
    secondaryColor: '#F59E0B',
    fontMood: 'modern',
    ngWords: [],
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [newNgWord, setNewNgWord] = useState('')
  const [hasChanges, setHasChanges] = useState(false)

  // ブランドキットを取得
  useEffect(() => {
    const fetchBrandKit = async () => {
      try {
        const response = await fetch('/api/brand')
        const data = await response.json()
        if (data.brandKit) {
          setBrandKit({
            logoUrl: data.brandKit.logoUrl || null,
            primaryColor: data.brandKit.primaryColor || '#2563EB',
            secondaryColor: data.brandKit.secondaryColor || '#F59E0B',
            fontMood: data.brandKit.fontMood || 'modern',
            ngWords: data.brandKit.ngWords || [],
          })
        }
      } catch (error) {
        console.error('Failed to fetch brand kit:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchBrandKit()
  }, [])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const response = await fetch('/api/brand', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(brandKit),
      })

      if (!response.ok) {
        throw new Error('保存に失敗しました')
      }

      toast.success('ブランドキットを保存しました', { icon: '✅' })
      setHasChanges(false)
    } catch (error) {
      toast.error('保存に失敗しました')
    } finally {
      setIsSaving(false)
    }
  }

  const updateBrandKit = (key: keyof BrandKit, value: any) => {
    setBrandKit(prev => ({ ...prev, [key]: value }))
    setHasChanges(true)
  }

  const addNgWord = () => {
    if (!newNgWord.trim()) return
    if (brandKit.ngWords.includes(newNgWord.trim())) {
      toast.error('すでに登録されています')
      return
    }
    updateBrandKit('ngWords', [...brandKit.ngWords, newNgWord.trim()])
    setNewNgWord('')
  }

  const removeNgWord = (word: string) => {
    updateBrandKit('ngWords', brandKit.ngWords.filter(w => w !== word))
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link 
              href="/app" 
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors font-medium mb-2"
            >
              <ArrowLeft className="w-5 h-5" />
              ダッシュボード
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Palette className="w-5 h-5 text-white" />
              </div>
              ブランドキット
            </h1>
            <p className="text-gray-600 mt-1">
              ブランドカラーやロゴを設定すると、生成されるバナーに反映されます
            </p>
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className={cn(
              "btn-primary",
              !hasChanges && "opacity-50 cursor-not-allowed"
            )}
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            保存
          </button>
        </div>

        {/* プロプラン誘導（無料ユーザー向け） */}
        {!isPro && (
          <div className="card mb-8 bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-purple-900 mb-1">プロプランでブランドキットを最大活用</h3>
                <p className="text-sm text-purple-700 mb-3">
                  プロプランなら、ブランドキットの設定がすべてのバナー生成に反映されます。
                  一貫したブランドイメージのバナーを無制限に生成できます。
                </p>
                <Link href="/app/billing" className="btn-primary text-sm py-2">
                  プロプランにアップグレード
                </Link>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-8">
          {/* カラー設定 */}
          <div className="card">
            <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500" />
              ブランドカラー
            </h2>

            <div className="grid sm:grid-cols-2 gap-8">
              {/* メインカラー */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  メインカラー
                </label>
                <div className="flex items-center gap-4 mb-4">
                  <div
                    className="w-16 h-16 rounded-xl border-2 border-gray-200 shadow-inner cursor-pointer relative overflow-hidden"
                    style={{ backgroundColor: brandKit.primaryColor || '#2563EB' }}
                  >
                    <input
                      type="color"
                      value={brandKit.primaryColor || '#2563EB'}
                      onChange={(e) => updateBrandKit('primaryColor', e.target.value)}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={brandKit.primaryColor || '#2563EB'}
                      onChange={(e) => updateBrandKit('primaryColor', e.target.value)}
                      className="input-field w-32 font-mono text-sm"
                      placeholder="#2563EB"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => updateBrandKit('primaryColor', color)}
                      className={cn(
                        "w-8 h-8 rounded-lg border-2 transition-all",
                        brandKit.primaryColor === color
                          ? "border-gray-900 ring-2 ring-offset-2 ring-blue-500"
                          : "border-gray-200 hover:border-gray-400"
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* サブカラー */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  サブカラー（アクセント）
                </label>
                <div className="flex items-center gap-4 mb-4">
                  <div
                    className="w-16 h-16 rounded-xl border-2 border-gray-200 shadow-inner cursor-pointer relative overflow-hidden"
                    style={{ backgroundColor: brandKit.secondaryColor || '#F59E0B' }}
                  >
                    <input
                      type="color"
                      value={brandKit.secondaryColor || '#F59E0B'}
                      onChange={(e) => updateBrandKit('secondaryColor', e.target.value)}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={brandKit.secondaryColor || '#F59E0B'}
                      onChange={(e) => updateBrandKit('secondaryColor', e.target.value)}
                      className="input-field w-32 font-mono text-sm"
                      placeholder="#F59E0B"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => updateBrandKit('secondaryColor', color)}
                      className={cn(
                        "w-8 h-8 rounded-lg border-2 transition-all",
                        brandKit.secondaryColor === color
                          ? "border-gray-900 ring-2 ring-offset-2 ring-blue-500"
                          : "border-gray-200 hover:border-gray-400"
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* カラープレビュー */}
            <div className="mt-8 p-6 rounded-xl bg-gray-50 border border-gray-100">
              <p className="text-xs text-gray-500 mb-3">プレビュー</p>
              <div 
                className="rounded-xl p-6 text-center"
                style={{ 
                  background: `linear-gradient(135deg, ${brandKit.primaryColor} 0%, ${brandKit.secondaryColor} 100%)` 
                }}
              >
                <p 
                  className="text-lg font-bold"
                  style={{ color: isLightColor(brandKit.primaryColor || '#2563EB') ? '#1F2937' : '#FFFFFF' }}
                >
                  サンプルバナーテキスト
                </p>
                <p 
                  className="text-sm mt-1"
                  style={{ color: isLightColor(brandKit.primaryColor || '#2563EB') ? '#4B5563' : 'rgba(255,255,255,0.8)' }}
                >
                  この色でバナーが生成されます
                </p>
              </div>
            </div>
          </div>

          {/* フォント雰囲気 */}
          <div className="card">
            <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
              <span className="text-2xl">🔤</span>
              フォント雰囲気
            </h2>

            <div className="grid sm:grid-cols-2 gap-4">
              {FONT_MOODS.map((mood) => (
                <button
                  key={mood.value}
                  onClick={() => updateBrandKit('fontMood', mood.value)}
                  className={cn(
                    "p-4 rounded-xl border-2 text-left transition-all",
                    brandKit.fontMood === mood.value
                      ? "border-blue-500 bg-blue-50 ring-2 ring-offset-2 ring-blue-500"
                      : "border-gray-200 hover:border-gray-300"
                  )}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{mood.icon}</span>
                    <span className="font-bold text-gray-900">{mood.label}</span>
                    {brandKit.fontMood === mood.value && (
                      <CheckCircle className="w-5 h-5 text-blue-600 ml-auto" />
                    )}
                  </div>
                  <p className="text-sm text-gray-500">{mood.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* NGワード */}
          <div className="card">
            <h2 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
              <span className="text-2xl">🚫</span>
              NGワード
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              バナー生成時に使用しない言葉を設定できます
            </p>

            {/* 入力フォーム */}
            <div className="flex gap-3 mb-4">
              <input
                type="text"
                value={newNgWord}
                onChange={(e) => setNewNgWord(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addNgWord()}
                placeholder="NGワードを入力"
                className="input-field flex-1"
              />
              <button
                onClick={addNgWord}
                disabled={!newNgWord.trim()}
                className="btn-secondary"
              >
                <Plus className="w-4 h-4" />
                追加
              </button>
            </div>

            {/* NGワード一覧 */}
            {brandKit.ngWords.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {brandKit.ngWords.map((word) => (
                  <span
                    key={word}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-sm"
                  >
                    {word}
                    <button
                      onClick={() => removeNgWord(word)}
                      className="hover:text-red-900 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                <p className="text-sm">NGワードが設定されていません</p>
              </div>
            )}
          </div>

          {/* ロゴアップロード（将来対応） */}
          <div className="card opacity-60">
            <h2 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
              <span className="text-2xl">🖼️</span>
              ロゴ
              <span className="badge bg-gray-100 text-gray-500 ml-2">Coming Soon</span>
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              ロゴをアップロードすると、バナーに自動配置されます（近日対応予定）
            </p>

            <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center">
              <ImageIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-400">ロゴアップロード機能は準備中です</p>
            </div>
          </div>
        </div>

        {/* フローティング保存ボタン（モバイル） */}
        {hasChanges && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 sm:hidden">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="btn-primary shadow-xl shadow-blue-500/30 px-8"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              変更を保存
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

