'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  CheckCircle2,
  ExternalLink,
  FileUp,
  Palette,
  Presentation,
  AlertCircle,
} from 'lucide-react'
import type { SlideSpec } from '@/lib/slide/types'

const PURPOSE_OPTIONS = [
  { value: 'proposal', label: '提案資料', emoji: '📝' },
  { value: 'sales', label: '営業資料', emoji: '💼' },
  { value: 'meeting', label: 'ミーティング', emoji: '🗓️' },
  { value: 'recruit', label: '採用資料', emoji: '🧑‍💼' },
  { value: 'seminar', label: 'セミナー/ウェビナー', emoji: '🎤' },
  { value: 'other', label: 'その他', emoji: '📂' },
]

const COLOR_PRESETS = [
  { hex: '#1E40AF', name: 'ロイヤルブルー' },
  { hex: '#059669', name: 'エメラルド' },
  { hex: '#7C3AED', name: 'バイオレット' },
  { hex: '#DC2626', name: 'クリムゾン' },
  { hex: '#0891B2', name: 'シアン' },
  { hex: '#CA8A04', name: 'ゴールド' },
]

type Phase = 'input' | 'generating' | 'preview' | 'publishing' | 'done'

export default function ドヤスライドCreate() {
  const [phase, setPhase] = useState<Phase>('input')
  const [topic, setTopic] = useState('')
  const [purpose, setPurpose] = useState('proposal')
  const [slideCount, setSlideCount] = useState(8)
  const [themeColor, setThemeColor] = useState('#1E40AF')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [referenceText, setReferenceText] = useState('')

  const [slideSpec, setSlideSpec] = useState<SlideSpec[] | null>(null)
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // ファイルアップロード（txt/md）
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    setReferenceText((prev) => (prev ? prev + '\n\n' + text : text))
  }

  // Step1: Geminiでスライド構成JSON生成
  const handleGenerate = async () => {
    if (!topic.trim()) return
    setError(null)
    setPhase('generating')
    try {
      const res = await fetch('/api/slide/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          slidePurpose: purpose,
          slideCount,
          themeColor,
          referenceText: referenceText || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.slideSpec) {
        throw new Error(data.error || 'スライド生成に失敗しました')
      }
      setSlideSpec(data.slideSpec.slides ?? data.slideSpec)
      setPhase('preview')
    } catch (err: any) {
      console.error(err)
      setError(err.message)
      setPhase('input')
    }
  }

  // Step2: Google Slidesに書き出し
  const handlePublish = async () => {
    if (!slideSpec || !recipientEmail) return
    setError(null)
    setPhase('publishing')
    try {
      const res = await fetch('/api/slide/publish/google-slides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: topic,
          themeColor,
          recipientEmail,
          slides: slideSpec,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) {
        throw new Error(data.error || 'Google Slides 作成に失敗しました')
      }
      setPublishedUrl(data.url)
      setPhase('done')
    } catch (err: any) {
      console.error(err)
      setError(err.message)
      setPhase('preview')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur bg-slate-900/60 border-b border-white/5">
        <div className="max-w-4xl mx-auto flex items-center gap-4 px-6 py-4">
          <Link href="/slide" className="text-slate-400 hover:text-white transition">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-bold text-lg flex items-center gap-2">
            <Presentation className="w-5 h-5 text-indigo-400" />
            ドヤスライド
          </h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <AnimatePresence mode="wait">
          {/* ========== INPUT ========== */}
          {phase === 'input' && (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-8"
            >
              <h2 className="text-3xl font-bold text-center">スライドを作成</h2>

              {error && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <p>{error}</p>
                </div>
              )}

              {/* Topic */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  スライドのテーマ / 企画内容
                </label>
                <textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  rows={3}
                  placeholder="例: 中小企業向けSaaS導入のメリットと成功事例の紹介"
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 text-white placeholder-slate-500 px-4 py-3 resize-none"
                />
              </div>

              {/* Purpose */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">資料の種類</label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                  {PURPOSE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setPurpose(opt.value)}
                      className={`flex flex-col items-center gap-1 py-3 rounded-xl border text-sm transition ${
                        purpose === opt.value
                          ? 'border-indigo-500 bg-indigo-500/20 text-white'
                          : 'border-slate-700 bg-slate-800/60 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      <span className="text-xl">{opt.emoji}</span>
                      <span className="text-xs">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Slide count */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  スライド枚数: <span className="text-white font-bold">{slideCount}</span>
                </label>
                <input
                  type="range"
                  min={3}
                  max={20}
                  value={slideCount}
                  onChange={(e) => setSlideCount(Number(e.target.value))}
                  className="w-full accent-indigo-500"
                />
              </div>

              {/* Theme color */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
                  <Palette className="w-4 h-4" />
                  テーマカラー
                </label>
                <div className="flex flex-wrap gap-3">
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c.hex}
                      title={c.name}
                      onClick={() => setThemeColor(c.hex)}
                      className={`w-10 h-10 rounded-full border-2 transition ${
                        themeColor === c.hex ? 'border-white scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                  <input
                    type="color"
                    value={themeColor}
                    onChange={(e) => setThemeColor(e.target.value)}
                    className="w-10 h-10 p-0 border-0 rounded cursor-pointer"
                    title="カスタムカラー"
                  />
                </div>
              </div>

              {/* Reference file upload */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
                  <FileUp className="w-4 h-4" />
                  参考資料（テキスト/.md）
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,.markdown,text/plain"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-4 rounded-xl border-2 border-dashed border-slate-700 hover:border-slate-600 text-slate-400 hover:text-white transition flex items-center justify-center gap-2"
                >
                  <FileUp className="w-5 h-5" />
                  ファイルをアップロード
                </button>
                {referenceText && (
                  <p className="mt-2 text-xs text-slate-500">
                    {referenceText.length.toLocaleString()} 文字の参考資料が読み込まれています
                  </p>
                )}
              </div>

              {/* Generate button */}
              <div className="pt-4">
                <button
                  onClick={handleGenerate}
                  disabled={!topic.trim()}
                  className="w-full py-4 rounded-full font-bold text-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 hover:from-indigo-400 hover:to-fuchsia-400 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/30 transition flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-5 h-5" />
                  スライドを生成する
                </button>
              </div>
            </motion.div>
          )}

          {/* ========== GENERATING ========== */}
          {phase === 'generating' && (
            <motion.div
              key="generating"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-24 gap-6"
            >
              <Loader2 className="w-12 h-12 text-indigo-400 animate-spin" />
              <p className="text-lg text-slate-300">AIがスライド構成を生成中...</p>
            </motion.div>
          )}

          {/* ========== PREVIEW ========== */}
          {phase === 'preview' && slideSpec && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-8"
            >
              <h2 className="text-2xl font-bold text-center">プレビュー</h2>

              {error && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <p>{error}</p>
                </div>
              )}

              <div className="space-y-4">
                {slideSpec.map((slide, i) => (
                  <div
                    key={i}
                    className="p-5 rounded-xl bg-slate-800/80 border border-slate-700"
                    style={{ borderLeftColor: themeColor, borderLeftWidth: 4 }}
                  >
                    <p className="text-xs text-slate-500 mb-1">Slide {i + 1}</p>
                    <h3 className="font-bold text-lg mb-2" style={{ color: themeColor }}>
                      {slide.title}
                    </h3>
                    <ul className="space-y-1 text-sm text-slate-300">
                      {slide.elements.map((el, j) =>
                        el.type === 'text' ? (
                          <li key={j}>{el.content}</li>
                        ) : el.type === 'bullets' ? (
                          <li key={j} className="ml-4 list-disc">
                            {el.items?.join(' / ')}
                          </li>
                        ) : null
                      )}
                    </ul>
                  </div>
                ))}
              </div>

              {/* Email for share */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  共有するGoogleアカウント（メールアドレス）
                </label>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 text-white placeholder-slate-500 px-4 py-3"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => {
                    setPhase('input')
                    setSlideSpec(null)
                  }}
                  className="flex-1 py-4 rounded-full border border-slate-600 text-slate-300 hover:bg-slate-800 transition"
                >
                  戻って編集
                </button>
                <button
                  onClick={handlePublish}
                  disabled={!recipientEmail}
                  className="flex-1 py-4 rounded-full font-bold bg-gradient-to-r from-indigo-500 to-fuchsia-500 hover:from-indigo-400 hover:to-fuchsia-400 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/30 transition flex items-center justify-center gap-2"
                >
                  <Presentation className="w-5 h-5" />
                  Google Slidesに出力
                </button>
              </div>
            </motion.div>
          )}

          {/* ========== PUBLISHING ========== */}
          {phase === 'publishing' && (
            <motion.div
              key="publishing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-24 gap-6"
            >
              <Loader2 className="w-12 h-12 text-indigo-400 animate-spin" />
              <p className="text-lg text-slate-300">Google Slidesに書き出し中...</p>
            </motion.div>
          )}

          {/* ========== DONE ========== */}
          {phase === 'done' && publishedUrl && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-24 gap-6 text-center"
            >
              <CheckCircle2 className="w-16 h-16 text-emerald-400" />
              <h2 className="text-2xl font-bold">スライドが完成しました！</h2>
              <p className="text-slate-400 max-w-md">
                指定したGoogleアカウントに編集権限を付与しました。下のボタンからスライドを開いてください。
              </p>
              <a
                href={publishedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-bold text-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 hover:from-indigo-400 hover:to-fuchsia-400 shadow-lg shadow-indigo-500/30 transition"
              >
                <ExternalLink className="w-5 h-5" />
                Google Slidesで開く
              </a>
              <button
                onClick={() => {
                  setPhase('input')
                  setSlideSpec(null)
                  setPublishedUrl(null)
                  setTopic('')
                  setReferenceText('')
                }}
                className="text-sm text-slate-500 hover:text-slate-300 mt-6"
              >
                別の資料を作成する
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}

