'use client'

import { useState } from 'react'
import { Search, Loader2, Link2, Sparkles, RefreshCcw, CheckCircle2, AlertCircle } from 'lucide-react'
import { MarkdownPreview } from '@seo/components/MarkdownPreview'

interface CompetitorAnalysisTabProps {
  articleId: string
  article: any
  onUpdated: () => void
}

export function CompetitorAnalysisTab({ articleId, article, onUpdated }: CompetitorAnalysisTabProps) {
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const item = (article.knowledgeItems || []).find((k: any) => k.type === 'competitor_report')
  const report = String(item?.content || '').trim()
  const refs = Array.isArray(article.references) ? article.references : []
  const refUrls = Array.isArray(article.referenceUrls) ? article.referenceUrls : []
  const totalRefs = refs.length + refUrls.length

  const handleAnalyze = async () => {
    setAnalyzing(true)
    setError(null)
    setSuccess(false)

    try {
      const res = await fetch(`/api/seo/articles/${articleId}/competitor-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const json = await res.json().catch(() => ({}))

      if (!res.ok || json?.error) {
        throw new Error(json?.error || `分析に失敗しました (${res.status})`)
      }

      setSuccess(true)
      onUpdated()

      // 3秒後に成功メッセージを消す
      setTimeout(() => setSuccess(false), 3000)
    } catch (e: any) {
      setError(e.message || '分析中にエラーが発生しました')
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl sm:rounded-[40px] border border-gray-100 shadow-xl p-6 sm:p-8">
      <h2 className="text-lg sm:text-xl font-black text-gray-900 mb-2 flex items-center gap-3">
        <Search className="w-6 h-6 text-cyan-600" /> 競合記事の状況・差別化（SEOで勝つ）
      </h2>
      <p className="text-xs font-bold text-gray-500 mb-6">
        主キーワードで上位記事を調査し、「コピー禁止」で構成・不足点を分析して、本記事の勝ち筋を可視化します。
      </p>

      {/* 分析ボタン */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button
          onClick={handleAnalyze}
          disabled={analyzing || totalRefs === 0}
          className="inline-flex items-center gap-2 h-12 px-6 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-black text-sm shadow-lg shadow-cyan-500/20 hover:opacity-95 disabled:opacity-50 transition-all"
        >
          {analyzing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              AIが競合記事を分析中...
            </>
          ) : report ? (
            <>
              <RefreshCcw className="w-5 h-5" />
              再分析する
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              AIで競合記事を比較分析
            </>
          )}
        </button>

        {success && (
          <span className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-600">
            <CheckCircle2 className="w-4 h-4" />
            分析完了！
          </span>
        )}

        {totalRefs === 0 && (
          <span className="text-xs font-bold text-amber-600">
            ※ 参照URLがありません。記事生成時に参照URLを追加してください。
          </span>
        )}
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-black text-red-900">分析エラー</p>
            <p className="text-xs font-bold text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* 分析結果 */}
      {report ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50/40 p-5">
          <MarkdownPreview markdown={report} />
        </div>
      ) : (
        <div className="rounded-2xl border border-cyan-200 bg-gradient-to-br from-cyan-50 via-white to-sky-50 p-5">
          <p className="text-sm font-black text-cyan-900">
            「AIで競合記事を比較分析」ボタンを押すと、本記事と競合記事を比較分析します
          </p>
          <p className="mt-2 text-xs font-bold text-cyan-900/70 leading-relaxed">
            参照URLに登録された競合記事の内容をAIが読み取り、本記事との差別化ポイント・改善点を分析します。
          </p>
        </div>
      )}

      {/* 参照URL一覧 */}
      {totalRefs > 0 && (
        <div className="mt-6">
          <p className="text-[10px] font-black text-cyan-700 uppercase tracking-widest mb-3">
            参考に保存済みのURL（{totalRefs}件）
          </p>
          <div className="flex flex-wrap gap-2">
            {refs.slice(0, 10).map((r: any) => (
              <a
                key={r.id}
                href={r.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-cyan-200 text-[11px] font-black text-cyan-800 hover:bg-cyan-50"
                title={r.title || r.url}
              >
                <Link2 className="w-3.5 h-3.5" />
                {String(r.title || r.url).slice(0, 34)}
              </a>
            ))}
            {refUrls.slice(0, 10 - refs.length).map((url: string, i: number) => (
              <a
                key={`ref-${i}`}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-cyan-200 text-[11px] font-black text-cyan-800 hover:bg-cyan-50"
                title={url}
              >
                <Link2 className="w-3.5 h-3.5" />
                {url.slice(0, 34)}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
