'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardBody, CardHeader, CardTitle, CardDesc } from '@seo/components/ui/Card'
import { Button } from '@seo/components/ui/Button'
import { Toggle } from '@seo/components/ui/Toggle'
import { Badge } from '@seo/components/ui/Badge'
import {
  Sparkles,
  Wand2,
  Save,
  UploadCloud,
  Zap,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  FileText,
  Target,
  Settings2,
  BookOpen,
  Lightbulb,
  CheckCircle2,
  ImageIcon,
  X,
  MessageSquare,
} from 'lucide-react'

const TARGETS = [10000, 20000, 30000, 40000, 50000, 60000]
const TONES = ['丁寧', 'フランク', 'ビジネス', '専門的'] as const
const STORAGE_KEY = 'doya_seo_new_draft_v1'

// よく使うテンプレート
const TEMPLATES = [
  {
    id: 'note',
    name: 'note記事',
    icon: '📝',
    title: '○○してみて気づいたこと',
    targetChars: 5000,
    searchIntent: '体験談/気づき/学び/おすすめ/読者へのメッセージ',
    llmo: { tldr: false, conclusionFirst: false, faq: false, glossary: false, comparison: false, quotes: false, templates: false, objections: false },
    isNote: true,
  },
  {
    id: 'comparison',
    name: '比較・ランキング記事',
    icon: '📊',
    title: '○○おすすめ10選【2024年最新】徹底比較',
    targetChars: 30000,
    searchIntent: '比較表/選び方/料金相場/メリット・デメリット/FAQ',
    llmo: { tldr: true, conclusionFirst: true, faq: true, glossary: false, comparison: true, quotes: true, templates: true, objections: true },
  },
  {
    id: 'howto',
    name: 'ハウツー・解説記事',
    icon: '📖',
    title: '○○のやり方完全ガイド【初心者向け】',
    targetChars: 20000,
    searchIntent: '手順/注意点/よくある失敗/チェックリスト/FAQ',
    llmo: { tldr: true, conclusionFirst: true, faq: true, glossary: true, comparison: false, quotes: true, templates: true, objections: true },
  },
  {
    id: 'definition',
    name: '用語解説・定義記事',
    icon: '📚',
    title: '○○とは？初心者でもわかる完全解説',
    targetChars: 15000,
    searchIntent: '定義/仕組み/種類/メリット・デメリット/活用例/FAQ',
    llmo: { tldr: true, conclusionFirst: true, faq: true, glossary: true, comparison: false, quotes: true, templates: false, objections: false },
  },
  {
    id: 'thorough',
    name: '徹底解説・超長文記事',
    icon: '🎯',
    title: '【完全版】○○徹底解説｜50社比較・選び方・料金',
    targetChars: 50000,
    searchIntent: '定義/できること/比較表/選び方/料金相場/失敗例/チェックリスト/FAQ',
    llmo: { tldr: true, conclusionFirst: true, faq: true, glossary: true, comparison: true, quotes: true, templates: true, objections: true },
  },
]

import { DashboardLayout } from '@/components/DashboardLayout'
import { FeatureGuide } from '@/components/FeatureGuide'

const TARGETS = [10000, 20000, 30000, 40000, 50000, 60000]
// ...
  const [requestText, setRequestText] = useState('')
  const [referenceImages, setReferenceImages] = useState<{ name: string; dataUrl: string }[]>([])
  const [autoBundle, setAutoBundle] = useState(true) // セット生成フラグ

  const [loading, setLoading] = useState(false)
// ...
  return (
    <DashboardLayout>
      <main className="max-w-4xl mx-auto py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => router.push('/seo')}
              className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              一覧へ戻る
            </button>
            <FeatureGuide 
              featureId="seo-new-guide"
              title="記事のセット作成"
              description="タイトルとキーワードを入力するだけで、記事本文だけでなく、記事内の図解画像やサムネイル画像もAIが自動的に一括作成します。プロ級のコンテンツ制作がこれ一つで完結します。"
              steps={[
                "作りたい記事のタイトルと主要なキーワードを入力します。",
                "「AI推定」ボタンで、AIがターゲットや検索意図を自動で提案します。",
                "「セット作成（画像・サムネ込み）」がONになっていることを確認します。",
                "「記事を生成」をクリックすると、全工程が自動で始まります。",
                "完成後、記事本文と生成されたすべてのアセットを確認・保存できます。"
              ]}
            />
          </div>
          
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                新規記事作成
              </h1>
              <p className="text-gray-500 mt-2">
                最新のAIモデルが、高品質な記事とクリエイティブを同時に生成します。
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={(e) => { e.preventDefault(); fillSample() }}>
                <Sparkles className="w-4 h-4" />
                サンプル
              </Button>
              <Button variant="ghost" size="sm" onClick={(e) => { e.preventDefault(); saveDraft() }}>
                <Save className="w-4 h-4" />
                保存
              </Button>
            </div>
          </div>
        </div>

        {/* Notices */}
        {notice && (
          <div className="mb-6 p-4 rounded-2xl bg-blue-50 text-blue-700 text-sm font-bold flex items-center gap-3 border border-blue-100 shadow-sm animate-fade-in-up">
            <CheckCircle2 className="w-5 h-5" />
            {notice}
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-100 text-red-700 text-sm animate-fade-in-up">
            <p className="font-bold flex items-center gap-2">
              <X className="w-4 h-4" />
              エラーが発生しました
            </p>
            <p className="mt-1 ml-6 whitespace-pre-wrap">{error}</p>
          </div>
        )}

        {/* Template Picker */}
        <div className="mb-10">
          <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-400" />
            おすすめテンプレート
          </p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => applyTemplate(t)}
                className={`p-5 rounded-3xl border-2 transition-all text-left group relative overflow-hidden ${
                  t.id === 'note'
                    ? 'border-amber-100 bg-amber-50/50 hover:border-amber-300'
                    : 'border-gray-100 bg-white hover:border-[#2563EB]/30'
                }`}
              >
                <div className="relative z-10">
                  <span className="text-3xl mb-3 block">{t.icon}</span>
                  <p className="text-sm font-black text-gray-900 leading-tight">
                    {t.name}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1 font-bold">
                    APPROX. {t.targetChars.toLocaleString()} CHARS
                  </p>
                </div>
                {t.id === 'note' && (
                  <div className="absolute top-0 right-0 p-1">
                    <div className="bg-amber-400 text-white text-[8px] font-black px-2 py-0.5 rounded-bl-lg rounded-tr-lg uppercase tracking-tighter">
                      HOT
                    </div>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Main Form */}
        <div className="space-y-6">
          <div className="bg-white rounded-[32px] border border-gray-100 p-8 shadow-2xl shadow-blue-500/5">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 shadow-inner">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-black text-gray-900 tracking-tight">基本設定</h2>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Base Configuration</p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Title */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <label className="text-sm font-black text-gray-700 tracking-tight">
                    記事タイトル <span className="text-red-500">*</span>
                  </label>
                  <button
                    onClick={() => predictFromTitle()}
                    disabled={predicting || !title.trim()}
                    className="flex items-center gap-2 px-4 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-full text-xs font-black transition-all disabled:opacity-50"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    {predicting ? '推定中...' : 'AIで自動入力'}
                  </button>
                </div>
                <input
                  className="w-full px-6 py-4 rounded-2xl border-2 border-gray-50 bg-gray-50/50 text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-blue-500 focus:bg-white transition-all text-lg font-bold"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="例）LLMOとは？SEOとの違いと実務で勝つための設計"
                />
              </div>

              {/* Keywords */}
              <div>
                <label className="block text-sm font-black text-gray-700 mb-3 tracking-tight">
                  メインキーワード <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full px-6 py-4 rounded-2xl border-2 border-gray-50 bg-gray-50/50 text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-blue-500 focus:bg-white transition-all font-bold"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="例）LLMO, AI検索最適化, SEO（カンマ区切り）"
                />
                {keywordList.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {keywordList.slice(0, 12).map((k) => (
                      <span key={k} className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold border border-blue-100">
                        {k}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Target & Tone */}
              <div className="grid sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-black text-gray-700 mb-3 tracking-tight">目標文字数</label>
                  <select
                    className="w-full px-6 py-4 rounded-2xl border-2 border-gray-50 bg-gray-50/50 text-gray-900 focus:outline-none focus:border-blue-500 focus:bg-white transition-all font-bold appearance-none"
                    value={targetChars}
                    onChange={(e) => setTargetChars(Number(e.target.value))}
                  >
                    {TARGETS.map((n) => (
                      <option key={n} value={n}>
                        {n.toLocaleString('ja-JP')}字
                        {n >= 50000 ? ' (ULTRA LONG)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-black text-gray-700 mb-3 tracking-tight">文章トーン</label>
                  <select
                    className="w-full px-6 py-4 rounded-2xl border-2 border-gray-50 bg-gray-50/50 text-gray-900 focus:outline-none focus:border-blue-500 focus:bg-white transition-all font-bold appearance-none"
                    value={tone}
                    onChange={(e) => setTone(e.target.value as any)}
                  >
                    {TONES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* AI Bundle Option - ユーザーの要望: セット作成 */}
          <div className="bg-gradient-to-br from-[#2563EB] to-blue-700 rounded-[32px] p-8 text-white shadow-2xl shadow-blue-500/20">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-lg">
                  <Zap className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-black tracking-tight">セット作成（画像・サムネ込み）</h2>
                  <p className="text-blue-100 text-sm opacity-80">記事本文に加えて、図解とアイキャッチも全自動で作成します</p>
                </div>
              </div>
              <div className="flex-shrink-0 scale-125 mr-4">
                <Toggle 
                  checked={autoBundle} 
                  onChange={setAutoBundle} 
                  label=""
                />
              </div>
            </div>
          </div>

          {/* Persona & Intent */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-[32px] border border-gray-100 p-6 shadow-xl shadow-gray-200/20">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-4 h-4 text-violet-500" />
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">想定ターゲット</h3>
              </div>
              <textarea
                className="w-full px-4 py-3 rounded-2xl border-2 border-gray-50 bg-gray-50/50 text-gray-900 placeholder:text-gray-300 text-sm min-h-[120px] focus:outline-none focus:border-violet-500 focus:bg-white transition-all font-medium leading-relaxed"
                value={persona}
                onChange={(e) => setPersona(e.target.value)}
                placeholder="誰に向けて書く記事ですか？タイトル入力でAIが提案します。"
              />
            </div>
            <div className="bg-white rounded-[32px] border border-gray-100 p-6 shadow-xl shadow-gray-200/20">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-4 h-4 text-emerald-500" />
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">検索意図・ニーズ</h3>
              </div>
              <textarea
                className="w-full px-4 py-3 rounded-2xl border-2 border-gray-50 bg-gray-50/50 text-gray-900 placeholder:text-gray-300 text-sm min-h-[120px] focus:outline-none focus:border-emerald-500 focus:bg-white transition-all font-medium leading-relaxed"
                value={searchIntent}
                onChange={(e) => setSearchIntent(e.target.value)}
                placeholder="読者は何を知りたいですか？AIが自動で整理します。"
              />
            </div>
          </div>

          {/* Advanced Options Toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full p-6 rounded-[32px] border-2 border-dashed border-gray-200 text-gray-400 hover:border-[#2563EB]/30 hover:text-[#2563EB] flex items-center justify-center gap-3 transition-all font-black"
          >
            <Settings2 className="w-5 h-5" />
            {showAdvanced ? '詳細設定を閉じる' : '詳細設定（参考URL・禁止事項など）'}
          </button>

          {/* Advanced Options */}
          {showAdvanced && (
            <div className="space-y-6 animate-fade-in-up">
              <div className="bg-white rounded-[32px] border border-gray-100 p-8 shadow-xl">
                <div className="flex items-center gap-3 mb-6">
                  <BookOpen className="w-5 h-5 text-cyan-500" />
                  <h3 className="text-lg font-black text-gray-900">参考URL・制約</h3>
                </div>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-black text-gray-700 mb-3">参考URL（競合サイトなど）</label>
                    <textarea
                      className="w-full px-6 py-4 rounded-2xl border-2 border-gray-50 bg-gray-50/50 text-gray-900 placeholder:text-gray-300 min-h-[100px] focus:outline-none focus:border-blue-500 focus:bg-white transition-all font-medium"
                      value={referenceUrls}
                      onChange={(e) => setReferenceUrls(e.target.value)}
                      placeholder={`https://example.com/article\nhttps://example.com/another`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-black text-gray-700 mb-3">禁止事項・NGワード</label>
                    <textarea
                      className="w-full px-6 py-4 rounded-2xl border-2 border-gray-50 bg-gray-50/50 text-gray-900 placeholder:text-gray-300 min-h-[80px] focus:outline-none focus:border-blue-500 focus:bg-white transition-all font-medium"
                      value={forbidden}
                      onChange={(e) => setForbidden(e.target.value)}
                      placeholder="例）競合A社名を出さない, 誇大表現NG"
                    />
                  </div>
                </div>
              </div>

              {/* LLMO Toggles */}
              <div className="bg-white rounded-[32px] border border-gray-100 p-8 shadow-xl">
                <div className="flex items-center gap-3 mb-6">
                  <Zap className="w-5 h-5 text-amber-500" />
                  <h3 className="text-lg font-black text-gray-900">LLMO（AI最適化）要素</h3>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <Toggle checked={llmo.tldr} onChange={(v) => setLlmo({ ...llmo, tldr: v })} label="要約 (TL;DR)" description="冒頭に要点を箇条書きで出力" />
                  <Toggle checked={llmo.conclusionFirst} onChange={(v) => setLlmo({ ...llmo, conclusionFirst: v })} label="結論ファースト" description="結論→理由→補足の黄金構造" />
                  <Toggle checked={llmo.faq} onChange={(v) => setLlmo({ ...llmo, faq: v })} label="FAQ (Q&A)" description="構造化データを意識した回答" />
                  <Toggle checked={llmo.glossary} onChange={(v) => setLlmo({ ...llmo, glossary: v })} label="用語集" description="重要キーワードの正確な定義" />
                  <Toggle checked={llmo.comparison} onChange={(v) => setLlmo({ ...llmo, comparison: v })} label="比較表" description="一目でわかる比較データの挿入" />
                  <Toggle checked={llmo.quotes} onChange={(v) => setLlmo({ ...llmo, quotes: v })} label="引用・根拠" description="客観的データに基づく信頼性向上" />
                  <Toggle checked={llmo.templates} onChange={(v) => setLlmo({ ...llmo, templates: v })} label="実務テンプレート" description="読者がすぐ使える資料の提供" />
                  <Toggle checked={llmo.objections} onChange={(v) => setLlmo({ ...llmo, objections: v })} label="不安払拭 (反論)" description="読者の懸念点への先回り回答" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Submit Area */}
        <div className="sticky bottom-8 mt-12 p-8 rounded-[40px] border border-gray-100 bg-white/80 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] flex items-center justify-between gap-6 z-40">
          <div className="hidden md:block">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Status</p>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${canSubmit ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`} />
              <p className="text-sm font-bold text-gray-900">
                {canSubmit ? '生成準備が整いました' : '必須項目を入力してください'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 flex-1 md:flex-none">
            <Button 
              variant="ghost" 
              onClick={() => router.push('/seo')}
              className="px-8 h-14 rounded-2xl text-gray-500 font-bold"
            >
              キャンセル
            </Button>
            <Button
              variant="primary"
              onClick={submit}
              disabled={loading || !canSubmit}
              className="flex-1 md:flex-none px-12 h-14 rounded-2xl bg-[#2563EB] text-white font-black text-lg shadow-2xl shadow-blue-500/30 hover:bg-blue-700 hover:translate-y-[-2px] transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  生成中...
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5 mr-2" />
                  記事を生成
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Tips */}
        <div className="mt-12 grid md:grid-cols-3 gap-6">
          <div className="p-6 rounded-[32px] bg-gray-50 border border-gray-100">
            <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shadow-sm mb-4">
              <CheckCircle2 className="w-5 h-5 text-blue-500" />
            </div>
            <h4 className="font-bold text-gray-900 mb-2">全自動パイプライン</h4>
            <p className="text-xs text-gray-500 leading-relaxed font-medium">
              構成案作成から執筆、統合、アセット生成まで全工程をAIが自律的に進めます。
            </p>
          </div>
          <div className="p-6 rounded-[32px] bg-gray-50 border border-gray-100">
            <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shadow-sm mb-4">
              <ImageIcon className="w-5 h-5 text-orange-500" />
            </div>
            <h4 className="font-bold text-gray-900 mb-2">クリエイティブ統合</h4>
            <p className="text-xs text-gray-500 leading-relaxed font-medium">
              Nano Banana Pro（Gemini 3.0 Pro）により、記事の内容に即した高品質な画像を挿入。
            </p>
          </div>
          <div className="p-6 rounded-[32px] bg-gray-50 border border-gray-100">
            <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shadow-sm mb-4">
              <Sparkles className="w-5 h-5 text-violet-500" />
            </div>
            <h4 className="font-bold text-gray-900 mb-2">LLMO最適化</h4>
            <p className="text-xs text-gray-500 leading-relaxed font-medium">
              Google GeminiやOpenAIなどのAI検索エンジンに見つけてもらいやすい構造を自動生成。
            </p>
          </div>
        </div>
      </main>
    </DashboardLayout>
  )
}

