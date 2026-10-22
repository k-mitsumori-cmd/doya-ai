'use client'

// 活用事例／ロゴ掲載キャンペーンの申込フォーム
// ⚠️ 未ログインでも申し込めるようにしてある。ここでログインを求めると、
//    これから使う会社を弾いてしまう。

import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { getPublicServices } from '@/lib/services'
import type { CaseStudySubmissionContext } from '@/lib/case-study/submission-context'

const SERVICES = getPublicServices()

export default function CaseStudyForm() {
  const { data: session, status } = useSession()
  const userId = (session?.user as { id?: string } | undefined)?.id
  // Never render another actor's draft while the session is unknown. A confirmed
  // actor/guest change remounts the fields before effects, including A -> B -> A.
  if (status === 'loading' || status === 'authenticated' && !userId) {
    return <p role="status" className="rounded-2xl bg-white p-6 text-sm text-slate-600">利用者を確認しています。確認が終わるまでお待ちください。</p>
  }
  const context: CaseStudySubmissionContext = status === 'authenticated' && userId ? { mode: 'user', userId } : { mode: 'guest' }
  return <CaseStudyFields key={context.mode === 'user' ? `user:${context.userId}` : 'guest'} context={context} />
}

function CaseStudyFields({ context }: { context: CaseStudySubmissionContext }) {
  const [companyName, setCompanyName] = useState('')
  const [contactName, setContactName] = useState('')
  const [email, setEmail] = useState('')
  const [serviceUrl, setServiceUrl] = useState('')
  const [usingService, setUsingService] = useState('')
  const [preferredAt, setPreferredAt] = useState('')
  const [note, setNote] = useState('')
  const [allowLogo, setAllowLogo] = useState(true)
  const [allowName, setAllowName] = useState(true)
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [unconfirmed, setUnconfirmed] = useState(false)
  const [error, setError] = useState('')
  const active = useRef(false)
  const pending = useRef<AbortController | null>(null)
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
      pending.current?.abort()
    }
  }, [])

  const submit = async () => {
    if (!active.current || pending.current || unconfirmed) return
    const request = new AbortController()
    pending.current = request
    let outcomeUnknown = false
    setSending(true)
    setError('')
    try {
      const res = await fetch('/api/campaign/case-study', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: request.signal,
        body: JSON.stringify({
          companyName, contactName, email, serviceUrl,
          usingService, preferredAt, note, allowLogo, allowName, submissionContext: context,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!active.current || pending.current !== request) return
      if (!res.ok) {
        if (res.status >= 500) {
          outcomeUnknown = true
          setUnconfirmed(true)
          setError('送信結果を確認できませんでした。入力内容を控え、再送する前に受付状況をお問い合わせください。')
          return
        }
        setError(typeof data?.error === 'string' ? data.error : '送信できませんでした。時間をおいてお試しください。')
        return
      }
      if (data?.ok !== true || typeof data.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(data.id)) {
        outcomeUnknown = true
        setUnconfirmed(true)
        setError('送信結果を確認できませんでした。入力内容を控え、再送する前に受付状況をお問い合わせください。')
        return
      }
      setDone(true)
    } catch {
      if (!active.current || pending.current !== request) return
      outcomeUnknown = true
      setUnconfirmed(true)
      setError('通信が途切れたため、送信結果を確認できませんでした。入力内容を控え、再送する前に受付状況をお問い合わせください。')
    } finally {
      if (active.current && pending.current === request) {
        if (!outcomeUnknown) pending.current = null
        setSending(false)
      }
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
        <h2 className="text-lg font-black text-slate-900">お申し込みを受け付けました</h2>
        <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-600">
          担当より2営業日以内にメールでご連絡し、取材の日程を調整させていただきます。
          <br />
          6ヶ月無料の反映は、取材の日程が確定したあとに行います。
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-full bg-[#0066ff] px-6 py-3 text-sm font-black text-white hover:bg-[#0052cc]"
        >
          トップへ戻る
        </Link>
      </div>
    )
  }

  const inputClass =
    'w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-[#0066ff]'
  const required = !companyName.trim() || !contactName.trim() || !email.trim()

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
      {error && (
        <p className="mb-5 rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{error}</p>
      )}
      {unconfirmed && <a href="https://doyamarke.surisuta.jp/contact" target="_blank" rel="noreferrer" className="mb-5 inline-block text-sm font-semibold text-blue-700 underline">受付状況を問い合わせる</a>}

      <div className="space-y-5">
        <label className="block">
          <span className="text-sm font-black text-slate-900">会社名・団体名（必須）</span>
          <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="株式会社スリスタ" className={`mt-2 ${inputClass}`} />
        </label>

        <label className="block">
          <span className="text-sm font-black text-slate-900">ご担当者名（必須）</span>
          <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="三森 捷暉" className={`mt-2 ${inputClass}`} />
        </label>

        <label className="block">
          <span className="text-sm font-black text-slate-900">メールアドレス（必須）</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.co.jp" className={`mt-2 ${inputClass}`} />
          <span className="mt-1.5 block text-xs font-semibold text-slate-500">日程調整のご連絡にのみ使用します。</span>
        </label>

        <label className="block">
          <span className="text-sm font-black text-slate-900">御社サイト・サービスのURL</span>
          <input value={serviceUrl} onChange={(e) => setServiceUrl(e.target.value)} placeholder="https://example.co.jp" className={`mt-2 ${inputClass}`} />
        </label>

        <label className="block">
          <span className="text-sm font-black text-slate-900">主にお使いのサービス</span>
          <select value={usingService} onChange={(e) => setUsingService(e.target.value)} className={`mt-2 ${inputClass}`}>
            <option value="">選択してください</option>
            {SERVICES.map((s) => (
              <option key={s.id} value={s.name}>{s.name}</option>
            ))}
            <option value="まだ利用していない">まだ利用していない</option>
          </select>
        </label>

        <fieldset>
          <legend className="text-sm font-black text-slate-900">掲載についてのご同意</legend>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            いずれか一方でも構いません。どちらもお断りの場合、この特典の対象外となります。
          </p>
          <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl bg-slate-50 p-4">
            <input type="checkbox" checked={allowLogo} onChange={(e) => setAllowLogo(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#0066ff]" />
            <span className="text-sm font-semibold text-slate-700">企業ロゴ・サービスロゴの掲載に同意します</span>
          </label>
          <label className="mt-2 flex cursor-pointer items-start gap-3 rounded-xl bg-slate-50 p-4">
            <input type="checkbox" checked={allowName} onChange={(e) => setAllowName(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#0066ff]" />
            <span className="text-sm font-semibold text-slate-700">活用事例での社名の掲載に同意します</span>
          </label>
        </fieldset>

        <label className="block">
          <span className="text-sm font-black text-slate-900">取材のご希望</span>
          <input value={preferredAt} onChange={(e) => setPreferredAt(e.target.value)} placeholder="平日の午後がありがたいです / 来週以降で調整希望 など" className={`mt-2 ${inputClass}`} />
          <span className="mt-1.5 block text-xs font-semibold text-slate-500">オンラインで30分ほどを予定しています。</span>
        </label>

        <label className="block">
          <span className="text-sm font-black text-slate-900">ご質問・ご要望</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} placeholder="掲載範囲のご相談など、気になる点があればお書きください。" className={`mt-2 resize-none ${inputClass}`} />
        </label>
      </div>

      <button
        onClick={submit}
        disabled={sending || required || unconfirmed}
        className="mt-7 w-full rounded-full bg-[#0066ff] px-6 py-4 text-base font-black text-white transition hover:bg-[#0052cc] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
      >
        {sending ? '送信中…' : 'この内容で申し込む'}
      </button>
      <p className="mt-3 text-center text-xs font-semibold text-slate-500">
        送信後、担当より2営業日以内にご連絡します。
      </p>
    </div>
  )
}
