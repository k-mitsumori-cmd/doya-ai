'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { aioGet, aioSend } from '@/lib/aio/client'
import { PageHeader } from '@/components/aio/ui'
import toast from 'react-hot-toast'

interface Prompt { id: string; text: string; category: string | null; isActive: boolean }

// どの業種でも使える汎用テンプレート（〔  〕を自社カテゴリ・課題に置き換えて使う想定の編集可能な例）
const SUGGESTIONS = [
  '〔カテゴリ〕でおすすめのサービスは？',
  '〔カテゴリ〕を比較したい。主な選択肢を教えて',
  '初心者・中小企業向けの〔カテゴリ〕は？',
  '〔課題〕を解決できるツール・サービスは？',
  '〔カテゴリ〕の人気・定番どころを教えて',
]

export default function AioPromptsPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>()
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)

  const load = () => aioGet<{ prompts: Prompt[] }>('/api/aio/prompts', orgSlug).then((d) => setPrompts(d.prompts || [])).catch(() => {}).finally(() => setLoading(false))
  useEffect(() => { load() }, [orgSlug]) // eslint-disable-line react-hooks/exhaustive-deps

  const add = async (t?: string) => {
    const value = (t ?? text).trim()
    if (!value) return
    setAdding(true)
    try {
      await aioSend('/api/aio/prompts', orgSlug, 'POST', { text: value })
      setText('')
      toast.success('追加しました')
      load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setAdding(false)
    }
  }

  const toggle = async (p: Prompt) => {
    try { await aioSend(`/api/aio/prompts/${p.id}`, orgSlug, 'PATCH', { isActive: !p.isActive }); load() } catch (e: any) { toast.error(e.message) }
  }
  const remove = async (p: Prompt) => {
    if (!confirm('削除しますか？')) return
    try { await aioSend(`/api/aio/prompts/${p.id}`, orgSlug, 'DELETE'); load() } catch (e: any) { toast.error(e.message) }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <PageHeader icon="quiz" title="監視プロンプト" subtitle="AIに投げて言及をチェックする質問を登録します" />

      <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-5">
        <div className="flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="例: 〔自社のカテゴリ〕でおすすめのサービスは？"
            className="flex-1 rounded-xl border-2 border-slate-200 focus:border-purple-600 outline-none px-4 py-2.5 font-bold transition-colors" />
          <button onClick={() => add()} disabled={adding}
            className="px-5 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white font-black shadow disabled:opacity-50">追加</button>
        </div>
        <p className="text-xs text-slate-400 font-bold mt-3">編集可能な例文です。〔  〕を自社のカテゴリや課題に置き換えて登録してください。</p>
        <div className="flex flex-wrap gap-2 mt-2">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => setText(s)} className="text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-full px-3 py-1.5 transition-colors">＋ {s}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-slate-400 font-bold">読み込み中…</p>
      ) : prompts.length === 0 ? (
        <p className="text-slate-400 font-bold text-center py-8">まだプロンプトがありません。上から追加してください。</p>
      ) : (
        <div className="space-y-2">
          {prompts.map((p) => (
            <div key={p.id} className={`flex items-center gap-3 bg-white rounded-xl border p-3 ${p.isActive ? 'border-slate-200' : 'border-slate-100 opacity-60'}`}>
              <button onClick={() => toggle(p)} title={p.isActive ? '有効' : '無効'}
                className={`w-9 h-5 rounded-full relative shrink-0 transition-colors ${p.isActive ? 'bg-purple-500' : 'bg-slate-300'}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${p.isActive ? 'left-4' : 'left-0.5'}`} />
              </button>
              <p className="flex-1 text-sm font-bold text-slate-800">{p.text}</p>
              <button onClick={() => remove(p)} className="text-slate-300 hover:text-red-500 transition-colors">
                <span className="material-symbols-outlined text-[20px]">delete</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
