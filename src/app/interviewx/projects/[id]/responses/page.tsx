'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, User, Clock, CheckCircle, MessageSquare, Shield, Eye, EyeOff } from 'lucide-react'

function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!local || !domain) return '***'
  const maskedLocal = local.slice(0, 2) + '***'
  const domainParts = domain.split('.')
  const maskedDomain = domainParts[0].slice(0, 1) + '***.' + domainParts.slice(1).join('.')
  return maskedLocal + '@' + maskedDomain
}

function maskName(name: string): string {
  if (name.length <= 1) return name[0] + '***'
  return name.slice(0, 1) + '***'
}

export default function ResponsesPage() {
  const params = useParams()
  const projectId = params.id as string

  const [project, setProject] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revealedRespondents, setRevealedRespondents] = useState<Record<string, boolean>>({})

  useEffect(() => {
    fetch(`/api/interviewx/projects/${projectId}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) setProject(data.project)
        else setError(data.error || 'データの取得に失敗しました')
      })
      .catch(() => setError('通信エラーが発生しました'))
      .finally(() => setLoading(false))
  }, [projectId])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-12 text-center">
        <p className="text-slate-500">{error || 'プロジェクトが見つかりませんでした。'}</p>
        <Link href="/interviewx" className="text-indigo-600 hover:underline mt-4 inline-block text-sm">ダッシュボードに戻る</Link>
      </div>
    )
  }

  const responses = project.responses || []
  const questions = project.questions || []

  const toggleReveal = (responseId: string) => {
    setRevealedRespondents(prev => ({ ...prev, [responseId]: !prev[responseId] }))
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <Link href={`/interviewx/projects/${projectId}`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6">
        <ArrowLeft className="w-4 h-4" />
        プロジェクトに戻る
      </Link>

      <h1 className="text-2xl font-bold text-slate-900 mb-2">回答確認</h1>
      <p className="text-slate-500 mb-4">
        {responses.length > 0
          ? `${responses.length}件の回答`
          : '回答者がヒヤリングに回答するとここに表示されます。'}
      </p>

      {responses.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-3 mb-8 rounded-xl bg-indigo-50 border border-indigo-100">
          <Shield className="w-4 h-4 text-indigo-500 flex-shrink-0" />
          <p className="text-xs text-indigo-700">回答者の個人情報は適切に管理してください。デフォルトでは個人情報がマスクされています。</p>
        </div>
      )}

      {responses.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <MessageSquare className="w-16 h-16 text-slate-200 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-slate-900 mb-2">まだ回答がありません</h2>
          <p className="text-slate-500 mb-6">ヒヤリングを共有して、回答を待ちましょう。</p>
          <Link
            href={`/interviewx/projects/${projectId}/share`}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-bold"
          >
            共有設定へ
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {responses.map((response: any) => (
            <div key={response.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              {/* 回答者情報ヘッダー */}
              <div className="flex items-center justify-between p-5 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                    <User className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">
                      {response.respondentName
                        ? (revealedRespondents[response.id] ? response.respondentName : maskName(response.respondentName))
                        : '匿名'}
                    </p>
                    {response.respondentRole && (
                      <p className="text-xs text-slate-500">
                        {revealedRespondents[response.id] ? response.respondentRole : response.respondentRole.slice(0, 1) + '***'}
                      </p>
                    )}
                    {response.respondentEmail && (
                      <p className="text-xs text-slate-400">
                        {revealedRespondents[response.id] ? response.respondentEmail : maskEmail(response.respondentEmail)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleReveal(response.id)}
                    className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                    title={revealedRespondents[response.id] ? '個人情報を隠す' : '個人情報を表示'}
                  >
                    {revealedRespondents[response.id] ? (
                      <><EyeOff className="w-3 h-3" />隠す</>
                    ) : (
                      <><Eye className="w-3 h-3" />表示</>
                    )}
                  </button>
                  {response.status === 'COMPLETED' ? (
                    <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-green-100 text-green-700 font-bold">
                      <CheckCircle className="w-3 h-3" />
                      回答完了
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 font-bold">
                      <Clock className="w-3 h-3" />
                      回答中
                    </span>
                  )}
                  {response.completedAt && (
                    <span className="text-xs text-slate-400">
                      {new Date(response.completedAt).toLocaleString('ja-JP')}
                    </span>
                  )}
                </div>
              </div>

              {/* Q&A */}
              <div className="p-5 space-y-5">
                {questions.map((question: any) => {
                  const answer = response.answers?.find((a: any) => a.questionId === question.id)
                  return (
                    <div key={question.id}>
                      <p className="text-sm font-bold text-slate-700 mb-1">
                        Q{question.order}. {question.text}
                        {question.required && <span className="text-red-500 ml-1">*</span>}
                      </p>
                      {answer ? (
                        <div className="bg-slate-50 rounded-lg p-3">
                          <p className="text-sm text-slate-700 whitespace-pre-wrap">
                            {answer.answerText || (answer.answerValue ? JSON.stringify(answer.answerValue) : '—')}
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-400 italic">未回答</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
