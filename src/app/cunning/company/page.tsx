'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

interface Company {
  id: string
  url: string
  companyName: string | null
  businessSummary: string | null
}
interface Applicant {
  id: string
  name: string
  resume: string | null
  motivation: string | null
}

export default function CunningCompanyPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [applicants, setApplicants] = useState<Applicant[]>([])
  const [url, setUrl] = useState('')
  const [analyzing, setAnalyzing] = useState(false)

  const [name, setName] = useState('マイプロフィール')
  const [resume, setResume] = useState('')
  const [motivation, setMotivation] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  const load = () => {
    fetch('/api/cunning/company', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setCompanies(d.profiles || []))
      .catch(() => {})
    fetch('/api/cunning/profiles', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setApplicants(d.profiles || []))
      .catch(() => {})
  }
  useEffect(load, [])

  const analyze = async () => {
    if (!url.trim()) return
    setAnalyzing(true)
    try {
      const res = await fetch('/api/cunning/company/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setUrl('')
      toast.success(`「${d.profile.companyName || '企業'}」を解析しました`)
      load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setAnalyzing(false)
    }
  }

  const saveProfile = async () => {
    setSavingProfile(true)
    try {
      const res = await fetch('/api/cunning/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, resume, motivation }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setResume('')
      setMotivation('')
      toast.success('プロフィールを保存しました')
      load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSavingProfile(false)
    }
  }

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto">
      <h1 className="text-2xl font-black text-slate-900 mb-1">企業・プロフィール（面接モード）</h1>
      <p className="text-slate-500 font-bold text-sm mb-6">
        応募先の採用ページを解析し、あなたの経歴と掛け合わせて回答を最適化します
      </p>

      {/* 企業URL解析 */}
      <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
        <p className="font-black text-slate-700 mb-3">応募先企業の採用URLを解析</p>
        <div className="flex gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/recruit"
            className="flex-1 rounded-xl border border-slate-200 px-4 py-3 font-bold"
          />
          <button
            onClick={analyze}
            disabled={analyzing}
            className="px-5 py-3 rounded-xl bg-[#0B5CFF] text-white font-black disabled:opacity-50"
          >
            {analyzing ? '解析中…' : '解析'}
          </button>
        </div>
        <div className="mt-3 space-y-2">
          {companies.map((c) => (
            <div key={c.id} className="bg-slate-50 rounded-xl px-4 py-3">
              <p className="font-black text-slate-800">{c.companyName || c.url}</p>
              {c.businessSummary && (
                <p className="text-xs text-slate-500 font-medium mt-1 line-clamp-2">{c.businessSummary}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 応募者プロフィール */}
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <p className="font-black text-slate-700 mb-3">応募者プロフィール（任意）</p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="プロフィール名"
          className="w-full rounded-xl border border-slate-200 px-4 py-3 font-bold mb-2"
        />
        <textarea
          value={resume}
          onChange={(e) => setResume(e.target.value)}
          rows={4}
          placeholder="経歴・スキル・実績"
          className="w-full rounded-xl border border-slate-200 px-4 py-3 font-medium mb-2"
        />
        <textarea
          value={motivation}
          onChange={(e) => setMotivation(e.target.value)}
          rows={3}
          placeholder="志望動機メモ"
          className="w-full rounded-xl border border-slate-200 px-4 py-3 font-medium"
        />
        <button
          onClick={saveProfile}
          disabled={savingProfile}
          className="mt-3 px-5 py-3 rounded-xl bg-[#0B5CFF] text-white font-black disabled:opacity-50"
        >
          {savingProfile ? '保存中…' : '保存'}
        </button>

        {applicants.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {applicants.map((a) => (
              <span key={a.id} className="text-xs font-bold text-[#0B5CFF] bg-blue-50 rounded-full px-3 py-1.5">
                {a.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
