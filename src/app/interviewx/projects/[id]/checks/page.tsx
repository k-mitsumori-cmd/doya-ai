'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, ShieldCheck, Loader2, CheckCircle, XCircle, Play
} from 'lucide-react'

const CHECK_TYPES = [
  { value: 'PROOFREAD', label: '校正', icon: '📝', description: '誤字脱字・文法チェック' },
  { value: 'FACT_CHECK', label: 'ファクトチェック', icon: '🔍', description: '事実関係の検証' },
  { value: 'READABILITY', label: '読みやすさ', icon: '📖', description: '文章の読みやすさ評価' },
  { value: 'BRAND_CONSISTENCY', label: 'ブランド整合性', icon: '🏢', description: 'ブランドイメージとの一致' },
  { value: 'SENSITIVITY', label: 'センシティビティ', icon: '🛡️', description: 'コンプライアンスチェック' },
]

const SEVERITY_COLORS: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-blue-100 text-blue-700',
}

export default function ChecksPage() {
  const params = useParams()
  const projectId = params.id as string

  const [draft, setDraft] = useState<any>(null)
  const [checks, setChecks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [runningCheck, setRunningCheck] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [projectId])

  const fetchData = async () => {
    try {
      const draftRes = await fetch(`/api/interviewx/projects/${projectId}/drafts`).then(r => r.json())
      if (draftRes.success && draftRes.drafts?.length > 0) {
        const latestDraft = draftRes.drafts[0]
        setDraft(latestDraft)

        const checksRes = await fetch(`/api/interviewx/projects/${projectId}/drafts/${latestDraft.id}/checks`).then(r => r.json())
        if (checksRes.success) setChecks(checksRes.checks || [])
      }
    } catch {}
    setLoading(false)
  }

  const runCheck = async (checkType: string) => {
    if (!draft) return
    setRunningCheck(checkType)
    try {
      const res = await fetch(`/api/interviewx/projects/${projectId}/drafts/${draft.id}/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkType }),
      })
      const data = await res.json()
      if (data.success && data.check) {
        setChecks(prev => {
          const filtered = prev.filter(c => c.checkType !== checkType)
          return [data.check, ...filtered]
        })
      }
    } catch (e) {
      console.error(e)
    } finally {
      setRunningCheck(null)
    }
  }

  const runAllChecks = async () => {
    for (const ct of CHECK_TYPES) {
      await runCheck(ct.value)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!draft) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-12 text-center">
        <ShieldCheck className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-900 mb-2">ドラフトがありません</h2>
        <p className="text-slate-500 mb-6">先に記事を生成してください。</p>
        <Link href={`/interviewx/projects/${projectId}/draft`} className="text-indigo-600 hover:underline font-medium">
          記事プレビューへ →
        </Link>
      </div>
    )
  }

  const overallScore = checks.length > 0
    ? Math.round(checks.reduce((sum, c) => sum + (c.score || 0), 0) / checks.length)
    : null

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <Link href={`/interviewx/projects/${projectId}`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6">
        <ArrowLeft className="w-4 h-4" />
        プロジェクトに戻る
      </Link>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">品質チェック</h1>
          <p className="text-slate-500 mt-1">ドラフト v{draft.version} のAI品質チェック</p>
        </div>
        <button
          onClick={runAllChecks}
          disabled={!!runningCheck}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-bold hover:from-indigo-600 hover:to-violet-600 transition-all disabled:opacity-50"
        >
          {runningCheck ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ShieldCheck className="w-4 h-4" />
          )}
          全チェック実行
        </button>
      </div>

      {/* 総合スコア */}
      {overallScore !== null && (
        <div className={`rounded-2xl p-6 mb-8 ${
          overallScore >= 80 ? 'bg-emerald-50 border border-emerald-200' :
          overallScore >= 60 ? 'bg-amber-50 border border-amber-200' :
          'bg-red-50 border border-red-200'
        }`}>
          <div className="flex items-center gap-4">
            <div className={`text-4xl font-black ${
              overallScore >= 80 ? 'text-emerald-600' :
              overallScore >= 60 ? 'text-amber-600' :
              'text-red-600'
            }`}>
              {overallScore}
            </div>
            <div>
              <p className="font-bold text-slate-900">総合スコア</p>
              <p className="text-sm text-slate-500">
                {checks.length}/{CHECK_TYPES.length}チェック完了 ・
                {checks.filter(c => c.passed).length}個合格
              </p>
            </div>
          </div>
        </div>
      )}

      {/* チェック項目 */}
      <div className="space-y-4">
        {CHECK_TYPES.map(ct => {
          const check = checks.find(c => c.checkType === ct.value)
          const isRunning = runningCheck === ct.value
          const suggestions = check?.suggestions as any[] || []

          return (
            <div key={ct.value} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between p-5">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{ct.icon}</span>
                  <div>
                    <p className="font-bold text-slate-900">{ct.label}</p>
                    <p className="text-xs text-slate-500">{ct.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {check && (
                    <div className="flex items-center gap-2">
                      <span className={`text-lg font-black ${
                        (check.score || 0) >= 80 ? 'text-emerald-600' :
                        (check.score || 0) >= 60 ? 'text-amber-600' :
                        'text-red-600'
                      }`}>
                        {check.score}
                      </span>
                      {check.passed ? (
                        <CheckCircle className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500" />
                      )}
                    </div>
                  )}
                  <button
                    onClick={() => runCheck(ct.value)}
                    disabled={!!runningCheck}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-medium hover:bg-slate-200 transition-colors disabled:opacity-50"
                  >
                    {isRunning ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                    {check ? '再実行' : '実行'}
                  </button>
                </div>
              </div>

              {/* チェック結果 */}
              {check && (
                <div className="border-t border-slate-100 p-5 bg-slate-50/50">
                  <p className="text-sm text-slate-700 mb-3">{check.report}</p>
                  {suggestions.length > 0 && (
                    <div className="space-y-2">
                      {suggestions.map((s: any, idx: number) => (
                        <div key={idx} className="bg-white rounded-lg p-3 border border-slate-200 text-sm">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${SEVERITY_COLORS[s.severity] || 'bg-slate-100 text-slate-600'}`}>
                              {s.severity === 'high' ? '重要' : s.severity === 'medium' ? '中' : '軽微'}
                            </span>
                            <span className="text-xs text-slate-400">{s.type}</span>
                          </div>
                          {s.original && (
                            <p className="text-slate-500 line-through text-xs mb-1">{s.original}</p>
                          )}
                          {s.suggested && (
                            <p className="text-indigo-700 font-medium text-xs mb-1">→ {s.suggested}</p>
                          )}
                          <p className="text-slate-600 text-xs">{s.reason}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
