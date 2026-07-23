'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { MODES, MODE_IDS, getMode } from '@/lib/cunning/modes'
import type { CunningMode } from '@/lib/cunning/types'

interface KB { id: string; name: string; _count: { chunks: number } }
interface Company { id: string; companyName: string | null; url: string }
interface Applicant { id: string; name: string }
interface SessionRow {
  id: string
  mode: string
  title: string
  status: string
  durationSec: number
  createdAt: string
  _count: { answers: number }
}

export default function CunningDashboard() {
  const router = useRouter()
  const [mode, setMode] = useState<CunningMode>('sales')
  const [kbs, setKbs] = useState<KB[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [applicants, setApplicants] = useState<Applicant[]>([])
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [usage, setUsage] = useState<any>(null)
  const [kbId, setKbId] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [applicantId, setApplicantId] = useState('')
  const [personaNote, setPersonaNote] = useState('')
  const [starting, setStarting] = useState(false)

  const def = getMode(mode)

  const load = () => {
    fetch('/api/cunning/knowledge', { cache: 'no-store' }).then((r) => r.json()).then((d) => setKbs(d.bases || [])).catch(() => {})
    fetch('/api/cunning/company', { cache: 'no-store' }).then((r) => r.json()).then((d) => setCompanies(d.profiles || [])).catch(() => {})
    fetch('/api/cunning/profiles', { cache: 'no-store' }).then((r) => r.json()).then((d) => setApplicants(d.profiles || [])).catch(() => {})
    fetch('/api/cunning/sessions', { cache: 'no-store' }).then((r) => r.json()).then((d) => setSessions(d.sessions || [])).catch(() => {})
    fetch('/api/cunning/usage', { cache: 'no-store' }).then((r) => r.json()).then(setUsage).catch(() => {})
  }
  useEffect(load, [])

  const start = async () => {
    setStarting(true)
    try {
      const res = await fetch('/api/cunning/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          knowledgeBaseId: def.context === 'knowledge' ? kbId || null : null,
          companyProfileId: def.context === 'company' ? companyId || null : null,
          applicantProfileId: def.context === 'company' ? applicantId || null : null,
          personaNote: personaNote.trim() || null,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'セッションを開始できませんでした')
      router.push(`/cunning/live/${d.session.id}`)
    } catch (e: any) {
      toast.error(e.message)
      setStarting(false)
    }
  }

  const remaining = usage?.remainingMinutes
  const overLimit = typeof remaining === 'number' && remaining !== -1 && remaining <= 0

  return (
    <div className="min-h-full bg-gradient-to-b from-[#EAF2FF] to-slate-50">
      <div className="p-6 lg:p-10 max-w-5xl mx-auto">
        {/* ヘッダー（Zoom風の青） */}
        <div className="mb-1">
          <img src="/cunning/logo.png" alt="ドヤカンニング" className="h-16 sm:h-20 w-auto object-contain" />
          <p className="text-slate-500 font-bold text-sm mt-1">
            相手の声をAIが即解析！最高の“カンペ”をリアルタイムでお届け。もう会話で困らない！
          </p>
        </div>

        {usage?.limits && (
          <div className="mb-6 mt-3 inline-flex items-center gap-3 text-xs font-bold text-slate-500 bg-white rounded-full px-4 py-2 shadow-sm">
            <span>プラン: {usage.plan}</span>
            <span className="text-slate-300">|</span>
            <span>
              今月の利用 {usage.usedMinutes ?? 0}分
              {usage.limits.maxMinutesPerMonth === -1 ? '' : ` / ${usage.limits.maxMinutesPerMonth}分`}
            </span>
          </div>
        )}

        {/* モード選択 */}
        <div className="space-y-5 mb-6">
          {/* メイン：商談・面接（大きく2カラム） */}
          <div>
            <p className="text-xs font-black text-slate-400 mb-2 ml-1">メイン</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(['sales', 'interview'] as const).map((id) => {
                const m = MODES[id]
                return (
                  <button
                    key={m.id}
                    onClick={() => setMode(m.id)}
                    className={`text-left p-6 rounded-3xl border-2 transition-all bg-white flex items-center gap-4 ${
                      mode === m.id
                        ? 'border-[#0B5CFF] ring-2 ring-blue-200 shadow-lg'
                        : 'border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    <img src={`/character/${m.character}.png`} alt="" className="w-20 h-20 object-contain flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-black text-slate-900 text-lg">
                        {m.icon} {m.label}
                      </p>
                      <p className="text-xs text-slate-500 font-bold mt-1 leading-snug">{m.desc}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* その他（同サイズで下に並べる） */}
          <div>
            <p className="text-xs font-black text-slate-400 mb-2 ml-1">その他のモード</p>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {MODE_IDS.filter((id) => id !== 'sales' && id !== 'interview').map((id) => {
                const m = MODES[id]
                return (
                  <button
                    key={m.id}
                    onClick={() => setMode(m.id)}
                    className={`text-left p-4 rounded-2xl border-2 transition-all bg-white ${
                      mode === m.id
                        ? 'border-[#0B5CFF] ring-2 ring-blue-200 shadow-md'
                        : 'border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    <img src={`/character/${m.character}.png`} alt="" className="w-12 h-12 object-contain mb-1" />
                    <p className="font-black text-slate-800 text-sm">
                      {m.icon} {m.label}
                    </p>
                    <p className="text-[11px] text-slate-500 font-bold mt-0.5 leading-snug">{m.desc}</p>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* コンテキスト選択（モードに応じて） */}
        {def.context === 'knowledge' && (
          <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
            <label className="block text-sm font-black text-slate-700 mb-2">参照ナレッジ（任意）</label>
            <select
              value={kbId}
              onChange={(e) => setKbId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 font-bold text-slate-700"
            >
              <option value="">未選択（一般的な回答）</option>
              {kbs.map((k) => (
                <option key={k.id} value={k.id}>{k.name}（{k._count.chunks}件）</option>
              ))}
            </select>
            <Link href="/cunning/knowledge" className="inline-block mt-2 text-xs font-bold text-[#0B5CFF] hover:underline">
              ＋ ナレッジを追加・編集
            </Link>
          </div>
        )}
        {def.context === 'company' && (
          <div className="bg-white rounded-2xl shadow-sm p-5 mb-6 space-y-4">
            <div>
              <label className="block text-sm font-black text-slate-700 mb-2">応募先企業（任意）</label>
              <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3 font-bold text-slate-700">
                <option value="">未選択</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.companyName || c.url}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-black text-slate-700 mb-2">応募者プロフィール（任意）</label>
              <select value={applicantId} onChange={(e) => setApplicantId(e.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3 font-bold text-slate-700">
                <option value="">未選択</option>
                {applicants.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <Link href="/cunning/company" className="inline-block text-xs font-bold text-[#0B5CFF] hover:underline">
              ＋ 企業URLを解析・プロフィールを登録
            </Link>
          </div>
        )}
        {def.context === 'none' && (
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-6 text-sm font-bold text-blue-700">
            {def.icon} {def.label}：設定不要。開始して相手のコメント・発話に{def.trigger === 'any' ? '即レス' : '回答'}します。
          </div>
        )}

        {/* キャラ設定 / 補足メモ（任意・全モード共通） */}
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
          <label className="block text-sm font-black text-slate-700 mb-2">
            {def.category === 'entertainment' ? 'キャラ設定（任意）' : '補足メモ（任意）'}
          </label>
          <textarea
            value={personaNote}
            onChange={(e) => setPersonaNote(e.target.value)}
            rows={2}
            placeholder={
              def.category === 'entertainment'
                ? '名前・口調・世界観など（例: 名前は「ドヤにゃん」。語尾は「〜にゃ」。元気で明るいキャラ）'
                : '回答のトーンや前提（例: 丁寧でフォーマルに。専門用語は避ける）'
            }
            className="w-full rounded-xl border border-slate-200 px-4 py-3 font-medium text-sm"
          />
          <p className="text-[11px] text-slate-400 font-bold mt-1">回答・想定問答にこの設定を反映します</p>
        </div>

        {/* キャラの吹き出し（ポップな後押し） */}
        <div className="flex items-end gap-2 mb-3">
          <img src={`/character/${def.character}.png`} alt="" className="w-16 h-16 object-contain flex-shrink-0 animate-bounce" />
          <div className="relative bg-white rounded-2xl rounded-bl-none shadow-sm px-4 py-2.5 font-black text-slate-700 text-sm">
            {def.icon} 「{def.label}」で行くよ〜！準備できたらスタート！いっちょやったろ！
          </div>
        </div>

        <button
          onClick={start}
          disabled={starting || overLimit}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#2D8CFF] to-[#0B5CFF] text-white font-black text-lg shadow-lg shadow-blue-500/30 hover:shadow-xl transition-all disabled:opacity-50"
        >
          {overLimit ? (
            '今月の利用上限に達しました'
          ) : starting ? (
            '開始中…'
          ) : (
            <span className="inline-flex items-center gap-2">
              <span className="material-symbols-outlined">mic</span>
              ライブ開始！いくぞ〜
            </span>
          )}
        </button>
        <p className="text-center text-xs text-slate-400 font-bold mt-2">
          開始後、会議/配信タブの音声共有を許可してください（Chrome/Edge推奨）
        </p>

        {/* 最近のセッション */}
        {sessions.length > 0 && (
          <div className="mt-10">
            <h2 className="font-black text-slate-700 mb-3">最近のセッション</h2>
            <div className="space-y-2">
              {sessions.slice(0, 5).map((s) => (
                <Link
                  key={s.id}
                  href={`/cunning/history/${s.id}`}
                  className="flex items-center justify-between bg-white rounded-xl px-4 py-3 shadow-sm hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span>{getMode(s.mode).icon}</span>
                    <span className="font-bold text-slate-700 truncate">{s.title}</span>
                  </div>
                  <span className="text-xs font-bold text-slate-400 flex-shrink-0">
                    {s._count.answers}回答 · {Math.floor(s.durationSec / 60)}分
                  </span>
                </Link>
              ))}
            </div>
            <Link href="/cunning/history" className="inline-block mt-3 text-xs font-bold text-[#0B5CFF] hover:underline">
              すべての履歴を見る →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
