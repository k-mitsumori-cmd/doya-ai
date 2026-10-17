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
            {showSection && <p className="mb-2 mt-6 text-xs font-black tracking-wide text-[var(--blue-deep)] first:mt-0">{q.section}</p>}
            <div className="rounded-[var(--r)] border border-[var(--line)] bg-[var(--paper)] p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-black leading-relaxed text-[var(--ink)]">
                  Q{i + 1}. {q.question}
                  {!q.required && <span className="ml-2 text-[11px] font-bold text-[var(--muted)]">任意</span>}
                </p>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-black tabular-nums ${enough ? 'bg-[var(--ok-bg)] text-[var(--ok-ink)]' : 'bg-[var(--note-bg)] text-[var(--note-ink)]'}`}>
                  {have} / {q.minChars}字
                </span>
              </div>
              <p className="mt-1 text-xs font-bold text-[var(--muted)]">書くと良いこと: {q.hint}</p>
              <textarea
                className={`${inputCls} mt-2 min-h-[110px] leading-relaxed`}
                value={a.answer}
                disabled={disabled}
                maxLength={3000}
                onChange={(e) => update({ answer: e.target.value })}
                placeholder="具体的な場面や出来事を書いてください"
              />
              {a.followupQuestion && (
                <div className="mt-3 rounded-[var(--r-sm)] border border-[var(--blue-line)] bg-[var(--blue-soft)] p-3">
                  <p className="text-xs font-black text-[var(--blue-deep)]">追加の質問: {a.followupQuestion}</p>
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
