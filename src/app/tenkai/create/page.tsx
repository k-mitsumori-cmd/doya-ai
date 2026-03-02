'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'

// ============================================
// ステップ定義
// ============================================
const STEPS = [
  { id: 1, label: 'ソース入力', icon: 'upload' },
  { id: 2, label: 'プラットフォーム選択', icon: 'devices' },
  { id: 3, label: 'ブランドボイス', icon: 'record_voice_over' },
  { id: 4, label: '確認 & 生成', icon: 'auto_awesome' },
] as const

// ============================================
// プラットフォーム定義
// ============================================
const PLATFORMS = [
  { key: 'note', icon: 'edit_note', label: 'note', desc: '長文記事プラットフォーム' },
  { key: 'blog', icon: 'article', label: 'Blog', desc: 'SEO最適化ブログ記事' },
  { key: 'x', icon: 'tag', label: 'X (Twitter)', desc: '280文字ツイート・スレッド' },
  { key: 'instagram', icon: 'photo_camera', label: 'Instagram', desc: 'キャプション & ハッシュタグ' },
  { key: 'line', icon: 'chat', label: 'LINE', desc: 'リッチメッセージ形式' },
  { key: 'facebook', icon: 'thumb_up', label: 'Facebook', desc: 'エンゲージメント重視投稿' },
  { key: 'linkedin', icon: 'work', label: 'LinkedIn', desc: 'プロフェッショナル投稿' },
  { key: 'newsletter', icon: 'mail', label: 'メルマガ', desc: 'メールマガジン形式' },
  { key: 'press_release', icon: 'newspaper', label: 'プレスリリース', desc: '報道向けプレスリリース' },
] as const

type PlatformKey = (typeof PLATFORMS)[number]['key']

// ============================================
// 入力タイプ
// ============================================
const INPUT_TYPES = [
  { key: 'text', icon: 'description', label: 'テキスト入力', desc: '文章をそのまま貼り付け' },
  { key: 'url', icon: 'link', label: 'URL入力', desc: 'WebページのURLを指定' },
  { key: 'youtube', icon: 'play_circle', label: 'YouTube', desc: 'YouTube動画のURLを指定' },
  { key: 'video', icon: 'videocam', label: '動画アップロード', desc: '動画ファイルをアップロード' },
] as const

type InputType = (typeof INPUT_TYPES)[number]['key']

// ============================================
// Create Wizard Page
// ============================================
export default function CreatePage() {
  const [currentStep, setCurrentStep] = useState(1)
  const [inputType, setInputType] = useState<InputType>('text')
  const [sourceContent, setSourceContent] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [projectTitle, setProjectTitle] = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformKey[]>([
    'note', 'blog', 'x', 'instagram', 'line', 'facebook', 'linkedin', 'newsletter', 'press_release',
  ])
  const [selectedVoice, setSelectedVoice] = useState<string>('default')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // ============================================
  // プラットフォーム選択トグル
  // ============================================
  const togglePlatform = (key: PlatformKey) => {
    setSelectedPlatforms((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    )
  }

  const selectAllPlatforms = () => {
    setSelectedPlatforms(PLATFORMS.map((p) => p.key))
  }

  const deselectAllPlatforms = () => {
    setSelectedPlatforms([])
  }

  // ============================================
  // ステップ進行
  // ============================================
  const canProceed = () => {
    switch (currentStep) {
      case 1:
        if (inputType === 'text') return sourceContent.trim().length > 50
        if (inputType === 'url' || inputType === 'youtube') return sourceUrl.trim().length > 0
        if (inputType === 'video') return false // v2で対応予定
        return false
      case 2:
        return selectedPlatforms.length > 0
      case 3:
        return true
      default:
        return false
    }
  }

  const handleNext = () => {
    if (currentStep < 4 && canProceed()) {
      setCurrentStep((prev) => prev + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1)
    }
  }

  // ============================================
  // 送信
  // ============================================
  const handleSubmit = async () => {
    try {
      setIsSubmitting(true)

      // 1. プロジェクト作成
      const createRes = await fetch('/api/tenkai/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: projectTitle || '無題のプロジェクト',
          inputType,
          inputText: inputType === 'text' ? sourceContent : undefined,
          inputUrl: (inputType === 'url' || inputType === 'youtube') ? sourceUrl : undefined,
        }),
      })

      if (!createRes.ok) throw new Error('プロジェクトの作成に失敗しました')
      const createData = await createRes.json()
      const projectId = createData.project.id

      // 2. コンテンツ取り込み（URL/YouTube の場合）
      if (inputType === 'url') {
        const ingestRes = await fetch('/api/tenkai/content/ingest/url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: sourceUrl, projectId }),
        })
        if (!ingestRes.ok) {
          const errData = await ingestRes.json().catch(() => ({ error: '' }))
          throw new Error(errData.error || 'URLからのコンテンツ取得に失敗しました')
        }
      } else if (inputType === 'youtube') {
        const ingestRes = await fetch('/api/tenkai/content/ingest/youtube', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: sourceUrl, projectId }),
        })
        if (!ingestRes.ok) {
          const errData = await ingestRes.json().catch(() => ({ error: '' }))
          throw new Error(errData.error || 'YouTube動画の取り込みに失敗しました')
        }
      }

      // 3. コンテンツ分析を実行
      const analyzeRes = await fetch('/api/tenkai/content/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })
      if (!analyzeRes.ok) {
        const errData = await analyzeRes.json().catch(() => ({ error: '' }))
        throw new Error(errData.error || 'コンテンツ分析に失敗しました。もう一度お試しください。')
      }

      // 4. 選択プラットフォームで一括生成を開始（バックグラウンド）
      // 分析が完了しているため、生成APIは正常に動作するはず
      fetch('/api/tenkai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          platforms: selectedPlatforms,
          brandVoiceId: selectedVoice !== 'default' && selectedVoice !== 'casual' ? selectedVoice : undefined,
          customInstructions: selectedVoice === 'casual' ? 'カジュアルで親しみやすいトーンで生成してください' : undefined,
        }),
      }).catch((err) => {
        console.error('[tenkai] 生成開始エラー:', err)
      })

      // 5. プロジェクト詳細ページへ遷移
      window.location.href = `/tenkai/projects/${projectId}`
    } catch (err) {
      alert(err instanceof Error ? err.message : 'エラーが発生しました。もう一度お試しください。')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="min-h-screen"
    >
      {/* ======== Header with Progress ======== */}
      <div className="sticky top-0 z-20 backdrop-blur-xl bg-white/70 border-b border-slate-200/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {/* Back link */}
          <div className="flex items-center justify-between mb-4">
            <Link
              href="/tenkai/projects"
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 transition-colors"
            >
              <span className="material-symbols-outlined text-lg">arrow_back</span>
              プロジェクト一覧に戻る
            </Link>
            <p className="text-sm text-slate-400">
              ステップ {currentStep} / {STEPS.length}
            </p>
          </div>

          {/* Step Progress Bar */}
          <div className="flex items-center gap-2">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex items-center gap-2 flex-1">
                  <div
                    className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold transition-all ${
                      currentStep >= step.id
                        ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/20'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {currentStep > step.id ? (
                      <span className="material-symbols-outlined text-base">check</span>
                    ) : (
                      step.id
                    )}
                  </div>
                  <span
                    className={`text-xs font-semibold hidden sm:inline ${
                      currentStep >= step.id ? 'text-slate-900' : 'text-slate-400'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 rounded-full transition-colors ${
                      currentStep > step.id ? 'bg-blue-500' : 'bg-slate-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ======== Step Content ======== */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ============ Step 1: ソース入力 ============ */}
        {currentStep === 1 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-8"
          >
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">ソースコンテンツを入力</h2>
              <p className="text-sm text-slate-500">
                展開したいコンテンツの元となるソースを入力してください
              </p>
            </div>

            {/* プロジェクト名 */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                プロジェクト名（オプション）
              </label>
              <input
                type="text"
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                placeholder="例: 2024年マーケティング戦略記事"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 text-sm text-slate-700 placeholder-slate-400 transition-all outline-none"
              />
            </div>

            {/* 入力タイプ選択 */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                入力方法を選択
              </label>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {INPUT_TYPES.map((type) => (
                  <button
                    key={type.key}
                    onClick={() => setInputType(type.key)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                      inputType === type.key
                        ? 'border-blue-500 bg-blue-50/50 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className={`material-symbols-outlined text-2xl ${
                        inputType === type.key ? 'text-blue-500' : 'text-slate-400'
                      }`}
                    >
                      {type.icon}
                    </span>
                    <span
                      className={`text-sm font-semibold ${
                        inputType === type.key ? 'text-blue-700' : 'text-slate-600'
                      }`}
                    >
                      {type.label}
                    </span>
                    <span className="text-[10px] text-slate-400 text-center">{type.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* テキスト入力 */}
            {inputType === 'text' && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  コンテンツ
                </label>
                <textarea
                  value={sourceContent}
                  onChange={(e) => setSourceContent(e.target.value)}
                  placeholder="展開したいコンテンツの全文をここに貼り付けてください...（50文字以上）"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 text-sm text-slate-700 placeholder-slate-400 transition-all outline-none resize-none h-64"
                />
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-slate-400">
                    {sourceContent.length} 文字
                    {sourceContent.length < 50 && sourceContent.length > 0 && (
                      <span className="text-amber-500 ml-2">（最低50文字必要です）</span>
                    )}
                  </p>
                </div>
              </div>
            )}

            {/* URL入力 */}
            {(inputType === 'url' || inputType === 'youtube') && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  {inputType === 'youtube' ? 'YouTube URL' : 'ページ URL'}
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    {inputType === 'youtube' ? 'play_circle' : 'link'}
                  </span>
                  <input
                    type="url"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder={
                      inputType === 'youtube'
                        ? 'https://www.youtube.com/watch?v=...'
                        : 'https://example.com/article'
                    }
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 text-sm text-slate-700 placeholder-slate-400 transition-all outline-none"
                  />
                </div>
              </div>
            )}

            {/* 動画アップロード */}
            {inputType === 'video' && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  動画ファイル
                </label>
                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center hover:border-blue-300 hover:bg-blue-50/30 transition-all cursor-pointer">
                  <span className="material-symbols-outlined text-4xl text-slate-300 mb-3 block">
                    cloud_upload
                  </span>
                  <p className="text-sm font-semibold text-slate-600 mb-1">
                    動画ファイルをドラッグ&ドロップ
                  </p>
                  <p className="text-xs text-slate-400">
                    または<span className="text-blue-500 font-semibold"> ファイルを選択</span>
                  </p>
                  <p className="text-[10px] text-slate-400 mt-3">
                    対応形式: MP4, MOV, AVI (最大500MB)
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ============ Step 2: プラットフォーム選択 ============ */}
        {currentStep === 2 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-8"
          >
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                展開先プラットフォームを選択
              </h2>
              <p className="text-sm text-slate-500">
                コンテンツを展開するプラットフォームを選択してください
              </p>
            </div>

            {/* 全選択/解除 */}
            <div className="flex items-center gap-3">
              <button
                onClick={selectAllPlatforms}
                className="px-4 py-2 rounded-lg bg-blue-50 text-blue-600 text-sm font-semibold hover:bg-blue-100 transition-colors"
              >
                すべて選択
              </button>
              <button
                onClick={deselectAllPlatforms}
                className="px-4 py-2 rounded-lg bg-slate-100 text-slate-600 text-sm font-semibold hover:bg-slate-200 transition-colors"
              >
                すべて解除
              </button>
              <span className="text-sm text-slate-400">
                {selectedPlatforms.length} / {PLATFORMS.length} 選択中
              </span>
            </div>

            {/* プラットフォームグリッド */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {PLATFORMS.map((pf) => {
                const isSelected = selectedPlatforms.includes(pf.key)
                return (
                  <button
                    key={pf.key}
                    onClick={() => togglePlatform(pf.key)}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/50 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        isSelected
                          ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      <span className="material-symbols-outlined text-xl">{pf.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-bold ${
                          isSelected ? 'text-blue-700' : 'text-slate-700'
                        }`}
                      >
                        {pf.label}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">{pf.desc}</p>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        isSelected ? 'border-blue-500 bg-blue-500' : 'border-slate-300'
                      }`}
                    >
                      {isSelected && (
                        <span className="material-symbols-outlined text-white text-sm">check</span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}

        {/* ============ Step 3: ブランドボイス ============ */}
        {currentStep === 3 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-8"
          >
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">ブランドボイスを選択</h2>
              <p className="text-sm text-slate-500">
                生成するコンテンツのトーンと文体を決めるブランドボイスを選択してください
              </p>
            </div>

            <div className="space-y-3">
              {/* デフォルトボイス */}
              <button
                onClick={() => setSelectedVoice('default')}
                className={`w-full flex items-center gap-4 p-5 rounded-xl border-2 transition-all text-left ${
                  selectedVoice === 'default'
                    ? 'border-blue-500 bg-blue-50/50 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    selectedVoice === 'default'
                      ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  <span className="material-symbols-outlined text-2xl">record_voice_over</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-slate-900">デフォルト</p>
                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-600 text-[9px] font-bold rounded-md">
                      推奨
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    ニュートラルでプロフェッショナルなトーン
                  </p>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    selectedVoice === 'default' ? 'border-blue-500 bg-blue-500' : 'border-slate-300'
                  }`}
                >
                  {selectedVoice === 'default' && (
                    <span className="material-symbols-outlined text-white text-sm">check</span>
                  )}
                </div>
              </button>

              {/* カジュアルボイス */}
              <button
                onClick={() => setSelectedVoice('casual')}
                className={`w-full flex items-center gap-4 p-5 rounded-xl border-2 transition-all text-left ${
                  selectedVoice === 'casual'
                    ? 'border-blue-500 bg-blue-50/50 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    selectedVoice === 'casual'
                      ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  <span className="material-symbols-outlined text-2xl">mood</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-900">カジュアル</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    親しみやすくフレンドリーなトーン
                  </p>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    selectedVoice === 'casual' ? 'border-blue-500 bg-blue-500' : 'border-slate-300'
                  }`}
                >
                  {selectedVoice === 'casual' && (
                    <span className="material-symbols-outlined text-white text-sm">check</span>
                  )}
                </div>
              </button>

              {/* カスタム作成へのリンク */}
              <Link
                href="/tenkai/brand-voice"
                className="flex items-center gap-4 p-5 rounded-xl border-2 border-dashed border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 transition-all"
              >
                <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-2xl text-slate-300">add</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-600">カスタムボイスを作成</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    ブランドボイス設定ページで独自のボイスを作成
                  </p>
                </div>
              </Link>
            </div>
          </motion.div>
        )}

        {/* ============ Step 4: 確認 & 生成 ============ */}
        {currentStep === 4 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-8"
          >
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">内容を確認して生成</h2>
              <p className="text-sm text-slate-500">
                以下の設定でコンテンツを生成します。確認してから生成ボタンを押してください。
              </p>
            </div>

            {/* サマリーカード */}
            <div className="space-y-4">
              {/* プロジェクト名 */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-blue-500">folder</span>
                  <h3 className="text-sm font-bold text-slate-700">プロジェクト名</h3>
                </div>
                <p className="text-sm text-slate-900">
                  {projectTitle || '無題のプロジェクト'}
                </p>
              </div>

              {/* ソースタイプ */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-blue-500">
                    {INPUT_TYPES.find((t) => t.key === inputType)?.icon}
                  </span>
                  <h3 className="text-sm font-bold text-slate-700">ソース</h3>
                </div>
                <p className="text-sm text-slate-900">
                  {INPUT_TYPES.find((t) => t.key === inputType)?.label}
                </p>
                {inputType === 'text' && (
                  <p className="text-xs text-slate-400 mt-1">
                    {sourceContent.length} 文字のテキスト
                  </p>
                )}
                {inputType !== 'text' && sourceUrl && (
                  <p className="text-xs text-slate-400 mt-1 truncate">{sourceUrl}</p>
                )}
              </div>

              {/* プラットフォーム */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-blue-500">devices</span>
                  <h3 className="text-sm font-bold text-slate-700">
                    展開先プラットフォーム ({selectedPlatforms.length})
                  </h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedPlatforms.map((key) => {
                    const pf = PLATFORMS.find((p) => p.key === key)
                    if (!pf) return null
                    return (
                      <span
                        key={key}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold"
                      >
                        <span className="material-symbols-outlined text-sm">{pf.icon}</span>
                        {pf.label}
                      </span>
                    )
                  })}
                </div>
              </div>

              {/* ブランドボイス */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-blue-500">record_voice_over</span>
                  <h3 className="text-sm font-bold text-slate-700">ブランドボイス</h3>
                </div>
                <p className="text-sm text-slate-900">
                  {selectedVoice === 'default' ? 'デフォルト' : selectedVoice === 'casual' ? 'カジュアル' : selectedVoice}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* ======== Navigation Buttons ======== */}
        <div className="flex items-center justify-between mt-12 pt-6 border-t border-slate-200">
          <button
            onClick={handleBack}
            disabled={currentStep === 1}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            戻る
          </button>

          {currentStep < 4 ? (
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className="flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-semibold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              次へ
              <span className="material-symbols-outlined text-lg">arrow_forward</span>
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-semibold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50 transition-all"
            >
              {isSubmitting ? (
                <>
                  <span className="material-symbols-outlined text-lg animate-spin">
                    progress_activity
                  </span>
                  生成中...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">auto_awesome</span>
                  コンテンツを生成
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}
