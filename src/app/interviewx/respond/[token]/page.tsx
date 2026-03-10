'use client'

// ============================================
// 公開アンケート回答ページ
// ============================================
// shareToken でアクセスするパブリックページ（認証不要）
// ブランドカラー対応・モバイルファースト・レスポンシブ

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'

// ---- 型定義 ----
interface Question {
  id: string
  text: string
  description?: string
  type: 'TEXT' | 'TEXTAREA' | 'SELECT' | 'RATING' | 'YES_NO'
  options?: string[]
  required: boolean
  order: number
}

interface ProjectData {
  id: string
  title: string
  companyName?: string
  companyLogo?: string
  brandColor: string
  purpose?: string
  interviewMode?: string
  questions: Question[]
}

interface AnswerMap {
  [questionId: string]: {
    answerText?: string
    answerValue?: any
  }
}

// ---- スターレーティング ----
function StarRating({
  value,
  onChange,
  brandColor,
}: {
  value: number
  onChange: (v: number) => void
  brandColor: string
}) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(star)}
          className="text-3xl transition-transform hover:scale-110 focus:outline-none"
          style={{
            color: star <= (hover || value) ? brandColor : '#D1D5DB',
          }}
          aria-label={`${star}点`}
        >
          &#9733;
        </button>
      ))}
      {value > 0 && (
        <span className="ml-2 text-sm text-gray-500 self-center">{value}/5</span>
      )}
    </div>
  )
}

// ---- Yes/No ボタン ----
function YesNoButtons({
  value,
  onChange,
  brandColor,
}: {
  value: string | null
  onChange: (v: string) => void
  brandColor: string
}) {
  return (
    <div className="flex gap-3">
      {[
        { label: 'はい', val: 'yes' },
        { label: 'いいえ', val: 'no' },
      ].map(({ label, val }) => (
        <button
          key={val}
          type="button"
          onClick={() => onChange(val)}
          className="px-6 py-3 rounded-lg font-medium text-sm border-2 transition-all"
          style={{
            borderColor: value === val ? brandColor : '#E5E7EB',
            backgroundColor: value === val ? brandColor : '#FFFFFF',
            color: value === val ? '#FFFFFF' : '#374151',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

// ---- メインコンポーネント ----
export default function RespondPage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [project, setProject] = useState<ProjectData | null>(null)
  const [answers, setAnswers] = useState<AnswerMap>({})
  const [respondent, setRespondent] = useState({
    name: '',
    email: '',
    role: '',
    company: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  // データ取得
  useEffect(() => {
    async function fetchProject() {
      try {
        const res = await fetch(`/api/interviewx/public/${token}`)
        const data = await res.json()

        if (!data.success) {
          setError(data.error || 'データの取得に失敗しました')
          setErrorCode(data.code || null)
          return
        }

        // チャットモードの場合はチャットページへリダイレクト
        if (data.project.interviewMode === 'chat') {
          router.replace(`/interviewx/respond/${token}/chat`)
          return
        }

        setProject(data.project)
      } catch {
        setError('通信エラーが発生しました。ページを再読み込みしてください。')
      } finally {
        setLoading(false)
      }
    }
    fetchProject()
  }, [token])

  // 回答更新ヘルパー
  const updateAnswer = useCallback(
    (questionId: string, answerText?: string, answerValue?: any) => {
      setAnswers((prev) => ({
        ...prev,
        [questionId]: {
          ...(answerText !== undefined ? { answerText } : prev[questionId]?.answerText ? { answerText: prev[questionId].answerText } : {}),
          ...(answerValue !== undefined ? { answerValue } : prev[questionId]?.answerValue !== undefined ? { answerValue: prev[questionId].answerValue } : {}),
        },
      }))
    },
    []
  )

  // バリデーション
  const validate = useCallback(() => {
    if (!project) return false
    const errors: string[] = []

    if (!respondent.name.trim()) {
      errors.push('お名前は必須です')
    }

    for (const q of project.questions) {
      if (!q.required) continue
      const a = answers[q.id]

      if (['TEXT', 'TEXTAREA'].includes(q.type)) {
        if (!a?.answerText?.trim()) {
          errors.push(`「${q.text}」は必須です`)
        }
      }
      if (q.type === 'RATING') {
        if (!a?.answerValue || a.answerValue < 1) {
          errors.push(`「${q.text}」は必須です`)
        }
      }
      if (q.type === 'YES_NO') {
        if (!a?.answerValue) {
          errors.push(`「${q.text}」は必須です`)
        }
      }
      if (q.type === 'SELECT') {
        if (!a?.answerText?.trim() && !a?.answerValue) {
          errors.push(`「${q.text}」は必須です`)
        }
      }
    }

    setValidationErrors(errors)
    return errors.length === 0
  }, [project, answers, respondent])

  // 送信
  const handleSubmit = async () => {
    if (!validate()) return
    if (!project) return

    setSubmitting(true)
    setValidationErrors([])

    try {
      const answerList = project.questions
        .map((q) => ({
          questionId: q.id,
          answerText: answers[q.id]?.answerText || undefined,
          answerValue: answers[q.id]?.answerValue !== undefined ? answers[q.id].answerValue : undefined,
        }))
        .filter((a) => a.answerText || a.answerValue !== undefined)

      const res = await fetch(`/api/interviewx/public/${token}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          respondentName: respondent.name.trim(),
          respondentEmail: respondent.email.trim() || undefined,
          respondentRole: respondent.role.trim() || undefined,
          respondentCompany: respondent.company.trim() || undefined,
          answers: answerList,
        }),
      })

      const data = await res.json()

      if (!data.success) {
        setValidationErrors([data.error || '送信に失敗しました'])
        return
      }

      // 完了ページへ遷移
      router.push(`/interviewx/respond/${token}/complete`)
    } catch {
      setValidationErrors(['通信エラーが発生しました。もう一度お試しください。'])
    } finally {
      setSubmitting(false)
    }
  }

  const brandColor = project?.brandColor || '#3B82F6'

  // ---- ローディング ----
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
          <p className="mt-4 text-gray-500 text-sm">読み込み中...</p>
        </div>
      </div>
    )
  }

  // ---- エラー ----
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">
            {errorCode === 'ALREADY_ANSWERED' ? '✅' : '🔒'}
          </div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">
            {errorCode === 'ALREADY_ANSWERED' ? '回答済みです' : 'アクセスできません'}
          </h1>
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  if (!project) return null

  // ---- メインフォーム ----
  return (
    <div
      className="min-h-screen bg-gray-50"
      style={{ '--brand-color': brandColor } as React.CSSProperties}
    >
      {/* ヘッダー */}
      <div
        className="relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${brandColor}, ${brandColor}CC, ${brandColor}99)`,
        }}
      >
        <div className="absolute inset-0 opacity-10">
          <div
            className="absolute top-0 right-0 w-96 h-96 rounded-full -translate-y-1/2 translate-x-1/3"
            style={{ backgroundColor: '#FFFFFF' }}
          />
          <div
            className="absolute bottom-0 left-0 w-64 h-64 rounded-full translate-y-1/2 -translate-x-1/4"
            style={{ backgroundColor: '#FFFFFF' }}
          />
        </div>
        <div className="relative max-w-2xl mx-auto px-4 py-12 sm:py-16">
          {project.companyLogo && (
            <div className="mb-6">
              <img
                src={project.companyLogo}
                alt={project.companyName || ''}
                className="h-10 sm:h-12 object-contain"
                style={{ filter: 'brightness(0) invert(1)' }}
              />
            </div>
          )}
          {project.companyName && !project.companyLogo && (
            <p className="text-white/80 text-sm font-medium mb-3">
              {project.companyName}
            </p>
          )}
          <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
            {project.title}
          </h1>
          {project.purpose && (
            <p className="mt-3 text-white/70 text-sm leading-relaxed">
              {project.purpose}
            </p>
          )}
        </div>
      </div>

      {/* フォーム本体 */}
      <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
        {/* 回答者情報 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-1">ご回答者さまの情報</h2>
          <p className="text-sm text-gray-400 mb-6">お名前は必須です。その他は任意でご記入ください。</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                お名前 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={respondent.name}
                onChange={(e) => setRespondent((r) => ({ ...r, name: e.target.value }))}
                className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:border-transparent transition"
                style={{ '--tw-ring-color': brandColor } as React.CSSProperties}
                placeholder="山田 太郎"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                メールアドレス
              </label>
              <input
                type="email"
                value={respondent.email}
                onChange={(e) => setRespondent((r) => ({ ...r, email: e.target.value }))}
                className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:border-transparent transition"
                style={{ '--tw-ring-color': brandColor } as React.CSSProperties}
                placeholder="taro@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                役職
              </label>
              <input
                type="text"
                value={respondent.role}
                onChange={(e) => setRespondent((r) => ({ ...r, role: e.target.value }))}
                className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:border-transparent transition"
                style={{ '--tw-ring-color': brandColor } as React.CSSProperties}
                placeholder="営業部 部長"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                会社名
              </label>
              <input
                type="text"
                value={respondent.company}
                onChange={(e) => setRespondent((r) => ({ ...r, company: e.target.value }))}
                className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:border-transparent transition"
                style={{ '--tw-ring-color': brandColor } as React.CSSProperties}
                placeholder="株式会社サンプル"
              />
            </div>
          </div>
        </div>

        {/* 質問カード */}
        <div className="space-y-5">
          {project.questions.map((q, idx) => (
            <div
              key={q.id}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8"
            >
              {/* 質問番号 */}
              <div className="flex items-start gap-3 mb-4">
                <span
                  className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                  style={{ backgroundColor: brandColor }}
                >
                  {idx + 1}
                </span>
                <div className="flex-1">
                  <p className="text-base font-medium text-gray-800 leading-snug">
                    {q.text}
                    {q.required && <span className="text-red-500 ml-1">*</span>}
                  </p>
                  {q.description && (
                    <p className="text-sm text-gray-400 mt-1">{q.description}</p>
                  )}
                </div>
              </div>

              {/* 入力フィールド */}
              <div className="ml-11">
                {q.type === 'TEXT' && (
                  <input
                    type="text"
                    value={answers[q.id]?.answerText || ''}
                    onChange={(e) => updateAnswer(q.id, e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:border-transparent transition"
                    style={{ '--tw-ring-color': brandColor } as React.CSSProperties}
                    placeholder="ご回答を入力してください"
                  />
                )}

                {q.type === 'TEXTAREA' && (
                  <div>
                    <textarea
                      value={answers[q.id]?.answerText || ''}
                      onChange={(e) => updateAnswer(q.id, e.target.value)}
                      rows={4}
                      className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:border-transparent transition resize-y"
                      style={{ '--tw-ring-color': brandColor } as React.CSSProperties}
                      placeholder="ご回答を入力してください"
                    />
                    <p className="text-xs text-gray-400 mt-1 text-right">
                      {(answers[q.id]?.answerText || '').length} 文字
                    </p>
                  </div>
                )}

                {q.type === 'SELECT' && (
                  <div className="space-y-2">
                    {(q.options as string[] || []).map((opt) => (
                      <label
                        key={opt}
                        className="flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all"
                        style={{
                          borderColor: answers[q.id]?.answerText === opt ? brandColor : '#E5E7EB',
                          backgroundColor: answers[q.id]?.answerText === opt ? `${brandColor}08` : '#FFFFFF',
                        }}
                      >
                        <div
                          className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                          style={{
                            borderColor: answers[q.id]?.answerText === opt ? brandColor : '#D1D5DB',
                          }}
                        >
                          {answers[q.id]?.answerText === opt && (
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: brandColor }}
                            />
                          )}
                        </div>
                        <input
                          type="radio"
                          name={`q-${q.id}`}
                          value={opt}
                          checked={answers[q.id]?.answerText === opt}
                          onChange={() => updateAnswer(q.id, opt)}
                          className="sr-only"
                        />
                        <span className="text-sm text-gray-700">{opt}</span>
                      </label>
                    ))}
                  </div>
                )}

                {q.type === 'RATING' && (
                  <StarRating
                    value={answers[q.id]?.answerValue || 0}
                    onChange={(v) => updateAnswer(q.id, String(v), v)}
                    brandColor={brandColor}
                  />
                )}

                {q.type === 'YES_NO' && (
                  <YesNoButtons
                    value={answers[q.id]?.answerValue || null}
                    onChange={(v) => updateAnswer(q.id, v, v)}
                    brandColor={brandColor}
                  />
                )}
              </div>
            </div>
          ))}
        </div>

        {/* バリデーションエラー */}
        {validationErrors.length > 0 && (
          <div className="mt-6 bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-red-700 font-medium text-sm mb-2">
              以下の項目をご確認ください
            </p>
            <ul className="list-disc list-inside text-red-600 text-sm space-y-1">
              {validationErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* 送信ボタン */}
        <div className="mt-8 flex justify-center">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-10 py-4 rounded-xl font-bold text-white text-base shadow-lg transition-all hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: brandColor,
              boxShadow: `0 4px 14px ${brandColor}40`,
            }}
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                送信中...
              </span>
            ) : (
              '回答を送信する'
            )}
          </button>
        </div>

        {/* フッター */}
        <div className="mt-12 text-center">
          <p className="text-xs text-gray-400">
            Powered by ドヤインタビューAI-X
          </p>
        </div>
      </div>
    </div>
  )
}
