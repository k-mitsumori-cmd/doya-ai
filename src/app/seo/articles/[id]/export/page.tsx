'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Download,
  FileText,
  Code,
  FileType,
  Layout,
  CheckCircle2,
  Loader2,
  PartyPopper,
  Plus,
} from 'lucide-react'
import Link from 'next/link'

type ExportFormat = 'markdown' | 'html' | 'word' | 'wordpress'

const FORMATS: Array<{
  id: ExportFormat
  label: string
  desc: string
  icon: React.ElementType
  ext: string
}> = [
  { id: 'html', label: 'HTML', desc: 'ブログやCMSに貼り付け', icon: Code, ext: '.html' },
  { id: 'word', label: 'Word', desc: 'Wordドキュメント形式', icon: FileType, ext: '.docx' },
  { id: 'markdown', label: 'Markdown', desc: '汎用テキスト形式', icon: FileText, ext: '.md' },
  { id: 'wordpress', label: 'WordPress', desc: 'ブロックエディタ用HTML', icon: Layout, ext: '.html' },
]

export default function SeoExportPage() {
  const params = useParams<{ id: string }>()
  const articleId = params.id
  const router = useRouter()

  const [article, setArticle] = useState<{
    id: string
    title: string
    finalMarkdown?: string | null
    status: string
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [exported, setExported] = useState(false)
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('html')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/seo/articles/${articleId}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok || json?.success === false) {
        throw new Error(json?.error || `エラー: ${res.status}`)
      }
      setArticle(json.article)
    } catch (e: any) {
      setError(e?.message || '読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }, [articleId])

  useEffect(() => {
    load()
  }, [load])

  // ダウンロード
  const handleDownload = async () => {
    if (exporting || !article) return
    setExporting(true)
    setError(null)

    try {
      // エクスポートAPIを呼び出し
      const endpoint = selectedFormat === 'word'
        ? `/api/seo/articles/${articleId}/export/word`
        : selectedFormat === 'wordpress'
          ? `/api/seo/articles/${articleId}/export/wp`
          : selectedFormat === 'html'
            ? `/api/seo/articles/${articleId}/export/html`
            : `/api/seo/articles/${articleId}/export/md`

      const res = await fetch(endpoint)
      if (!res.ok) {
        throw new Error(`ダウンロードに失敗しました (${res.status})`)
      }

      // ファイル名を取得
      const contentDisposition = res.headers.get('content-disposition')
      let filename = `${article.title}${FORMATS.find((f) => f.id === selectedFormat)?.ext || '.txt'}`
      if (contentDisposition) {
        const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
        if (match?.[1]) {
          filename = match[1].replace(/['"]/g, '')
        }
      }

      // ダウンロード
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      // 状態を更新
      setExported(true)

      // 記事のステータスをEXPORTEDに更新
      await fetch(`/api/seo/articles/${articleId}/content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'EXPORTED' }),
      }).catch(() => {})
    } catch (e: any) {
      setError(e?.message || 'ダウンロードに失敗しました')
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-gray-400 font-bold text-sm">読み込み中...</p>
        </div>
      </main>
    )
  }

  if (!article) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-gray-100 shadow-xl p-8 text-center">
          <p className="text-red-600 font-bold mb-4">{error || '記事が見つかりません'}</p>
          <Link href="/seo">
            <button className="px-6 py-3 rounded-xl bg-gray-900 text-white font-bold">
              一覧へ戻る
            </button>
          </Link>
        </div>
      </main>
    )
  }

  // 完了画面
  if (exported) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-[#F8FAFC] to-white flex items-center justify-center p-4 sm:p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-lg text-center"
        >
          <div className="bg-white rounded-3xl sm:rounded-[48px] border border-gray-100 shadow-2xl shadow-emerald-500/10 p-8 sm:p-12">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-500/30">
              <PartyPopper className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 mb-3">
              記事が完成しました！ 🎉
            </h1>
            <p className="text-sm text-gray-500 font-bold mb-8">
              {article.title}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/seo/create">
                <button className="w-full sm:w-auto h-12 px-6 rounded-xl bg-blue-600 text-white text-sm font-black shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-colors inline-flex items-center justify-center gap-2">
                  <Plus className="w-5 h-5" />
                  別の記事を作る
                </button>
              </Link>
              <Link href="/seo">
                <button className="w-full sm:w-auto h-12 px-6 rounded-xl bg-gray-100 text-gray-600 text-sm font-black hover:bg-gray-200 transition-colors">
                  一覧へ戻る
                </button>
              </Link>
            </div>
          </div>
        </motion.div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#F8FAFC] to-white flex items-center justify-center p-4 sm:p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-xl"
      >
        {/* Back */}
        <div className="mb-6">
          <Link href={`/seo/articles/${articleId}`}>
            <button className="inline-flex items-center gap-2 text-gray-400 hover:text-gray-700 text-sm font-bold transition-colors">
              <ArrowLeft className="w-4 h-4" />
              記事詳細へ戻る
            </button>
          </Link>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl sm:rounded-[40px] border border-gray-100 shadow-2xl shadow-blue-500/5 overflow-hidden">
          {/* Header */}
          <div className="px-6 sm:px-10 pt-8 sm:pt-10 pb-6 text-center border-b border-gray-50">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center mx-auto mb-4 sm:mb-5 shadow-xl shadow-emerald-500/30">
              <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
              記事を出力する
            </h1>
            <p className="text-sm text-gray-400 font-bold mt-2 truncate max-w-sm mx-auto">
              {article.title}
            </p>
          </div>

          {/* Format Selection */}
          <div className="px-6 sm:px-10 py-6 sm:py-8">
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">
              出力形式を選択
            </p>
            <div className="grid grid-cols-2 gap-3">
              {FORMATS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setSelectedFormat(f.id)}
                  className={`p-4 rounded-2xl border-2 text-left transition-all ${
                    selectedFormat === f.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-100 bg-gray-50 hover:border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${
                    selectedFormat === f.id ? 'bg-blue-100' : 'bg-white'
                  }`}>
                    <f.icon className={`w-5 h-5 ${selectedFormat === f.id ? 'text-blue-600' : 'text-gray-400'}`} />
                  </div>
                  <p className={`text-sm font-black ${selectedFormat === f.id ? 'text-blue-600' : 'text-gray-700'}`}>
                    {f.label}
                  </p>
                  <p className="text-[10px] text-gray-400 font-bold mt-1">{f.desc}</p>
                </button>
              ))}
            </div>

            {/* Error */}
            {error && (
              <div className="mt-4 p-4 rounded-2xl bg-red-50 border border-red-100 text-red-700 text-sm font-bold">
                {error}
              </div>
            )}
          </div>

          {/* CTA */}
          <div className="px-6 sm:px-10 pb-8 sm:pb-10">
            <button
              onClick={handleDownload}
              disabled={exporting}
              className="w-full h-14 sm:h-16 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-base sm:text-lg shadow-xl shadow-blue-500/30 hover:shadow-2xl hover:shadow-blue-500/40 hover:translate-y-[-2px] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center justify-center gap-3"
            >
              {exporting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  ダウンロード中...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  ダウンロード
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </main>
  )
}

