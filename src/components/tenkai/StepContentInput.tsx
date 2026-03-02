'use client'

import { useState, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'

// ============================================
// Props
// ============================================
interface StepContentInputProps {
  inputMethod: 'url' | 'text' | 'youtube' | 'video'
  onSubmit: (projectId: string) => void
}

// ============================================
// StepContentInput コンポーネント
// ============================================
export default function StepContentInput({ inputMethod, onSubmit }: StepContentInputProps) {
  // 共通ステート
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // URL入力
  const [url, setUrl] = useState('')

  // テキスト入力
  const [title, setTitle] = useState('')
  const [textContent, setTextContent] = useState('')
  const MAX_TEXT_LENGTH = 50000

  // YouTube
  const [youtubeUrl, setYoutubeUrl] = useState('')

  // 動画ファイル
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ============================================
  // API呼び出し
  // ============================================
  const handleSubmit = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      let endpoint = ''
      let body: FormData | string = ''
      let headers: Record<string, string> = {}

      switch (inputMethod) {
        case 'url':
          if (!url.trim()) throw new Error('URLを入力してください')
          endpoint = '/api/tenkai/content/ingest/url'
          body = JSON.stringify({ url: url.trim() })
          headers = { 'Content-Type': 'application/json' }
          break

        case 'text':
          if (!title.trim()) throw new Error('タイトルを入力してください')
          if (!textContent.trim()) throw new Error('コンテンツを入力してください')
          endpoint = '/api/tenkai/content/ingest/text'
          body = JSON.stringify({ title: title.trim(), content: textContent.trim() })
          headers = { 'Content-Type': 'application/json' }
          break

        case 'youtube':
          if (!youtubeUrl.trim()) throw new Error('YouTube URLを入力してください')
          endpoint = '/api/tenkai/content/ingest/youtube'
          body = JSON.stringify({ url: youtubeUrl.trim() })
          headers = { 'Content-Type': 'application/json' }
          break

        case 'video':
          if (!videoFile) throw new Error('動画ファイルを選択してください')
          endpoint = '/api/tenkai/content/ingest/video'
          const formData = new FormData()
          formData.append('file', videoFile)
          body = formData
          break
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body,
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => null)
        throw new Error(errData?.error || `エラーが発生しました (${res.status})`)
      }

      const data = await res.json()
      if (!data.projectId) throw new Error('プロジェクトIDが取得できませんでした')

      onSubmit(data.projectId)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setIsLoading(false)
    }
  }, [inputMethod, url, title, textContent, youtubeUrl, videoFile, onSubmit])

  // ============================================
  // ファイルドロップ
  // ============================================
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('video/')) {
      setVideoFile(file)
    } else {
      setError('動画ファイルのみアップロードできます')
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false)
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setVideoFile(file)
      setError(null)
    }
  }, [])

  // ============================================
  // Render helpers
  // ============================================
  const renderUrlInput = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          WebページのURL
        </label>
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              link
            </span>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/article"
              className="w-full pl-12 pr-4 py-3.5 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
            />
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          記事やブログ記事のURLを入力すると、自動的にコンテンツを取得します
        </p>
      </div>
    </div>
  )

  const renderTextInput = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          タイトル
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="コンテンツのタイトルを入力"
          className="w-full px-4 py-3.5 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          コンテンツ
        </label>
        <textarea
          value={textContent}
          onChange={(e) => {
            if (e.target.value.length <= MAX_TEXT_LENGTH) {
              setTextContent(e.target.value)
            }
          }}
          placeholder="コンテンツの本文を入力してください..."
          rows={12}
          className="w-full px-4 py-3.5 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors resize-none"
        />
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-slate-400">
            マークダウン記法に対応しています
          </p>
          <p
            className={`text-xs font-medium ${
              textContent.length > MAX_TEXT_LENGTH * 0.9 ? 'text-amber-500' : 'text-slate-400'
            }`}
          >
            {textContent.length.toLocaleString()} / {MAX_TEXT_LENGTH.toLocaleString()}文字
          </p>
        </div>
      </div>
    </div>
  )

  const renderYoutubeInput = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          YouTube動画URL
        </label>
        <div className="relative">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-red-400">
            play_circle
          </span>
          <input
            type="url"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="w-full pl-12 pr-4 py-3.5 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
          />
        </div>
        <p className="text-xs text-slate-400 mt-2">
          YouTube動画のURLを入力すると、字幕/トランスクリプトを自動抽出します
        </p>
      </div>

      {/* YouTube プレビュー */}
      {youtubeUrl && /youtube\.com|youtu\.be/.test(youtubeUrl) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-slate-50 rounded-xl border border-slate-100"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
              <span className="material-symbols-outlined text-red-500">smart_display</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">動画を検出しました</p>
              <p className="text-xs text-slate-400">送信ボタンを押してトランスクリプトを取得</p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )

  const renderVideoUpload = () => (
    <div className="space-y-4">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
          isDragOver
            ? 'border-blue-500 bg-blue-50'
            : videoFile
            ? 'border-emerald-300 bg-emerald-50'
            : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {videoFile ? (
          <div className="space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-3xl text-emerald-500">
                check_circle
              </span>
            </div>
            <p className="text-sm font-bold text-slate-900">{videoFile.name}</p>
            <p className="text-xs text-slate-400">
              {(videoFile.size / 1024 / 1024).toFixed(1)} MB
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setVideoFile(null)
              }}
              className="text-xs text-red-500 hover:text-red-700 font-medium"
            >
              ファイルを変更
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-3xl text-slate-400">
                cloud_upload
              </span>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-700">
                動画ファイルをドラッグ&ドロップ
              </p>
              <p className="text-xs text-slate-400 mt-1">
                またはクリックしてファイルを選択 (MP4, MOV, AVI対応 / 最大500MB)
              </p>
            </div>
          </div>
        )}

        {/* アップロード進捗 */}
        {isLoading && uploadProgress > 0 && (
          <div className="mt-4">
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${uploadProgress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <p className="text-xs text-slate-400 mt-2">{uploadProgress}% アップロード中...</p>
          </div>
        )}
      </div>
    </div>
  )

  // ============================================
  // メインレンダー
  // ============================================
  const methodTitles: Record<string, string> = {
    url: 'URLからコンテンツを取得',
    text: 'テキストを入力',
    youtube: 'YouTube動画を入力',
    video: '動画ファイルをアップロード',
  }

  return (
    <div>
      {/* ヘッダー */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-black text-slate-900 mb-2">
          {methodTitles[inputMethod]}
        </h2>
        <p className="text-slate-500">
          AIが分析するコンテンツを入力してください
        </p>
      </div>

      {/* コンテンツエリア */}
      <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        {inputMethod === 'url' && renderUrlInput()}
        {inputMethod === 'text' && renderTextInput()}
        {inputMethod === 'youtube' && renderYoutubeInput()}
        {inputMethod === 'video' && renderVideoUpload()}

        {/* エラー表示 */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-red-500 text-lg">error</span>
            <p className="text-sm text-red-600">{error}</p>
          </motion.div>
        )}

        {/* 送信ボタン */}
        <div className="mt-6">
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold transition-all ${
              isLoading
                ? 'bg-slate-100 text-slate-400 cursor-wait'
                : 'bg-gradient-to-r from-blue-500 to-blue-700 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40'
            }`}
          >
            {isLoading ? (
              <>
                <motion.span
                  className="material-symbols-outlined text-lg"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                  progress_activity
                </motion.span>
                処理中...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-lg">send</span>
                コンテンツを送信
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
