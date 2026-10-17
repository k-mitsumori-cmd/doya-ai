'use client'

// ドヤ社内インタビュー アンケートの入力欄（担当者の画面と、社員が開く回答画面の両方で使う）
import { SURVEY_QUESTIONS } from '@/lib/shanai/survey'
import type { SurveyAnswers } from '@/lib/shanai/types'
import { charCount, inputCls } from './ui'

export default function SurveyForm({ answers, onChange, disabled }: { answers: SurveyAnswers; onChange: (next: SurveyAnswers) => void; disabled?: boolean }) {
  let lastSection = ''
  return (
    <div className="space-y-5">
      {SURVEY_QUESTIONS.map((q, i) => {
        const a = answers[q.id] || { answer: '' }
        const have = charCount(a.answer) + charCount(a.followupAnswer)
        const enough = have >= q.minChars
        const showSection = q.section !== lastSection
        lastSection = q.section
        const update = (patch: Partial<typeof a>) => onChange({ ...answers, [q.id]: { ...a, ...patch } })
        return (
          <div key={q.id}>
            {showSection && <p className="mb-2 mt-6 text-xs font-black tracking-wide text-fuchsia-700 first:mt-0">{q.section}</p>}
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-black leading-relaxed text-slate-900">
                  Q{i + 1}. {q.question}
                  {!q.required && <span className="ml-2 text-[11px] font-bold text-slate-400">任意</span>}
                </p>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-black tabular-nums ${enough ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                  {have} / {q.minChars}字
                </span>
              </div>
              <p className="mt-1 text-xs font-bold text-slate-400">書くと良いこと: {q.hint}</p>
              <textarea
                className={`${inputCls} mt-2 min-h-[110px] leading-relaxed`}
                value={a.answer}
                disabled={disabled}
                maxLength={3000}
                onChange={(e) => update({ answer: e.target.value })}
                placeholder="具体的な場面や出来事を書いてください"
              />
              {a.followupQuestion && (
                <div className="mt-3 rounded-xl border border-fuchsia-100 bg-fuchsia-50/60 p-3">
                  <p className="text-xs font-black text-fuchsia-700">追加の質問: {a.followupQuestion}</p>
                  <textarea
                    className={`${inputCls} mt-2 min-h-[80px] leading-relaxed`}
                    value={a.followupAnswer || ''}
                    disabled={disabled}
                    maxLength={2000}
                    onChange={(e) => update({ followupAnswer: e.target.value })}
                    placeholder="できるだけ具体的にお書きください"
                  />
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
