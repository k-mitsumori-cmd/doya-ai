'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import toast, { Toaster } from 'react-hot-toast'

interface Company {
  id?: string
  name: string
  website?: string | null
  industry?: string | null
  region?: string | null
  size?: string | null
  description?: string | null
  score?: number | null
}

const INDUSTRIES = ['IT・ソフトウェア', '製造業', '小売・EC', '医療・介護', '教育', '金融・保険', '不動産', '飲食', '物流', '建設', 'コンサル', '広告・マーケ', '人材', 'その他']
const REGIONS = ['全国', '東京都', '神奈川県', '埼玉県', '千葉県', '大阪府', '愛知県', '京都府', '兵庫県', '福岡県', '北海道', 'その他']
const SIZES = ['指定なし', 'スタートアップ（〜20名）', '中小企業（20〜300名）', '中堅企業（300〜1000名）', '大企業（1000名〜）']
const COUNTS = [5, 10, 15, 20]

export default function DoyalistHomePage() {
  const { data: session, status } = useSession()
  const [industry, setIndustry] = useState('IT・ソフトウェア')
  const [region, setRegion] = useState('全国')
  const [size, setSize] = useState('指定なし')
  const [keywords, setKeywords] = useState('')
  const [count, setCount] = useState(10)
  const [generating, setGenerating] = useState(false)
  const [companies, setCompanies] = useState<Company[]>([])
  const [savedListId, setSavedListId] = useState<string | null>(null)

  const ensureDefaultProject = async (overrides?: { industry?: string; region?: string; size?: string; keywords?: string }): Promise<string | null> => {
    try {
      const r = await fetch('/api/doyalist/projects')
      const data = await r.json()
      const list = Array.isArray(data) ? data : (data?.projects || [])
      const existing = list.find((p: any) => p.name === 'マイリスト')
      if (existing) {
        await fetch(`/api/doyalist/projects/${existing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            industry: overrides?.industry || industry,
            region: overrides?.region || region,
            targetSize: overrides?.size || size,
            keywords: overrides?.keywords ?? keywords,
          }),
        })
        return existing.id
      }
      const create = await fetch('/api/doyalist/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'マイリスト',
          industry: overrides?.industry || industry,
          region: overrides?.region || region,
          targetSize: overrides?.size || size,
          keywords: overrides?.keywords ?? keywords,
        }),
      })
      const createdData = await create.json()
      return createdData?.project?.id || createdData?.id || null
    } catch (e) {
      console.error('[doyalist] ensureDefaultProject', e)
      return null
    }
  }

  const handleGenerate = async () => {
    if (!session?.user) {
      toast.error('ログインしてください')
      return
    }
    setGenerating(true)
    setCompanies([])
    const tid = toast.loading('🐻 AIがリストを生成中...')
    try {
      const pid = await ensureDefaultProject({ industry, region, size, keywords })
      if (!pid) {
        toast.error('準備に失敗しました', { id: tid })
        return
      }

      const res = await fetch('/api/doyalist/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: pid, count }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data?.error || 'リスト生成に失敗しました', { id: tid })
        return
      }

      const list = Array.isArray(data?.companies) ? data.companies : []
      setCompanies(list)
      setSavedListId(pid)
      toast.success(`🎉 ${list.length}社のリストができました！`, { id: tid })
      if (data?.warning) toast(data.warning, { icon: 'ℹ️', duration: 5000 })
    } catch (e: any) {
      toast.error(e?.message || '通信エラーが発生しました', { id: tid })
    } finally {
      setGenerating(false)
    }
  }

  const downloadCSV = () => {
    if (!savedListId) return
    window.location.href = `/api/doyalist/export?projectId=${savedListId}&format=csv`
  }
  const downloadExcel = () => {
    if (!savedListId) return
    window.location.href = `/api/doyalist/export?projectId=${savedListId}&format=excel`
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a1530]">
        <div className="flex flex-col items-center gap-4">
          <img src="/doyalist/logo.png" alt="ドヤリスト" className="w-48 animate-pulse" />
          <p className="text-sm font-bold text-cyan-300">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (!session?.user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a1530] via-[#13234d] to-[#0a1530] p-6">
        <div className="bg-[#13234d]/80 backdrop-blur border-2 border-cyan-400/30 rounded-3xl shadow-2xl shadow-cyan-500/20 p-10 max-w-md w-full text-center space-y-5">
          <img src="/doyalist/logo.png" alt="ドヤリスト" className="w-64 mx-auto" />
          <p className="text-sm font-bold text-cyan-200">AIが営業先リストを自動で作ります 🚀</p>
          <a
            href={`/auth/signin?callbackUrl=${encodeURIComponent('/doyalist')}`}
            className="block w-full py-3.5 bg-gradient-to-r from-cyan-400 to-lime-300 text-[#0a1530] font-black rounded-2xl shadow-lg hover:shadow-cyan-400/50 hover:shadow-2xl transition-all"
          >
            Googleでログイン
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1530] via-[#13234d] to-[#0a1530] p-4 lg:p-8 text-white">
      <Toaster
        position="top-center"
        toastOptions={{
          style: { background: '#13234d', color: '#fff', border: '1px solid rgba(56, 189, 248, 0.3)' },
        }}
      />

      <div className="max-w-4xl mx-auto space-y-6 pb-20">
        {/* ===== Logo Hero ===== */}
        <div className="text-center pt-4 pb-2">
          <img src="/doyalist/logo.png" alt="ドヤリスト" className="w-72 lg:w-96 mx-auto drop-shadow-2xl" />
          <p className="text-sm font-bold text-cyan-300 mt-3">⚡ 条件を選ぶだけ。AIが営業リストを爆速生成 ⚡</p>
        </div>

        {/* ===== Form Card ===== */}
        <div className="bg-[#13234d]/80 backdrop-blur rounded-3xl shadow-2xl shadow-cyan-500/10 border-2 border-cyan-400/30 p-6 lg:p-8 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-cyan-400/20">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400 to-lime-300 flex items-center justify-center text-2xl shadow-lg">
              ⚙️
            </div>
            <div>
              <h2 className="text-lg font-black text-white">どんな企業を探しますか？</h2>
              <p className="text-xs font-bold text-cyan-300/80">業界・地域・規模を選んでください</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="🏢 業界" value={industry} onChange={setIndustry} options={INDUSTRIES} />
            <Field label="📍 地域" value={region} onChange={setRegion} options={REGIONS} />
            <div className="sm:col-span-2">
              <Field label="👥 企業規模" value={size} onChange={setSize} options={SIZES} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-black text-cyan-200 mb-2">🔍 キーワード（任意）</label>
              <input
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="例: SaaS, AI, 業務効率化"
                className="w-full px-4 py-3 border-2 border-cyan-400/30 rounded-2xl text-sm font-bold text-white bg-[#0a1530]/60 placeholder:text-cyan-300/40 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-black text-cyan-200 mb-2">📊 生成する件数</label>
              <div className="grid grid-cols-4 gap-2">
                {COUNTS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCount(c)}
                    className={`py-3 rounded-2xl text-sm font-black transition-all ${
                      count === c
                        ? 'bg-gradient-to-r from-cyan-400 to-lime-300 text-[#0a1530] shadow-lg shadow-cyan-400/50 scale-105'
                        : 'bg-[#0a1530]/60 text-cyan-200 hover:bg-[#0a1530] border border-cyan-400/20'
                    }`}
                  >
                    {c}社
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full py-4 bg-gradient-to-r from-cyan-400 via-sky-400 to-lime-300 text-[#0a1530] font-black text-lg rounded-2xl shadow-xl shadow-cyan-400/40 hover:shadow-2xl hover:shadow-cyan-400/60 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          >
            {generating ? (
              <>
                <span className="inline-block animate-spin">⚡</span>
                AIが頑張ってます...
              </>
            ) : (
              <>
                ⚡ リストを生成する 🚀
              </>
            )}
          </button>
        </div>

        {/* ===== Loading ===== */}
        {generating && companies.length === 0 && (
          <div className="bg-[#13234d]/80 backdrop-blur rounded-3xl shadow-xl border-2 border-cyan-400/30 p-10 text-center space-y-4">
            <div className="text-6xl animate-bounce">🐻</div>
            <p className="text-lg font-black text-cyan-200">クマが企業を探しています...</p>
            <p className="text-xs font-bold text-cyan-300/60">⏰ 通常10〜30秒ほどかかります</p>
          </div>
        )}

        {/* ===== Results ===== */}
        {companies.length > 0 && (
          <div className="bg-[#13234d]/80 backdrop-blur rounded-3xl shadow-2xl shadow-cyan-500/10 border-2 border-cyan-400/30 overflow-hidden">
            <div className="p-6 bg-gradient-to-r from-cyan-400/20 via-sky-400/20 to-lime-300/20 border-b-2 border-cyan-400/30 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="text-3xl">🎉</div>
                <div>
                  <h2 className="text-lg font-black text-white">{companies.length}社できました！</h2>
                  <p className="text-xs font-bold text-cyan-300">⬇️ ダウンロードで保存できます</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={downloadCSV} className="px-4 py-2.5 bg-lime-400 text-[#0a1530] font-black text-sm rounded-2xl shadow-lg hover:bg-lime-300 active:scale-95 transition-all">
                  📥 CSV
                </button>
                <button onClick={downloadExcel} className="px-4 py-2.5 bg-cyan-400 text-[#0a1530] font-black text-sm rounded-2xl shadow-lg hover:bg-cyan-300 active:scale-95 transition-all">
                  📊 Excel
                </button>
              </div>
            </div>

            <div className="divide-y divide-cyan-400/10">
              {companies.map((c, i) => (
                <div key={c.id || i} className="p-5 hover:bg-cyan-400/5 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400 to-lime-300 flex items-center justify-center text-[#0a1530] font-black shadow-md">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="text-base font-black text-white">{c.name}</h3>
                        {typeof c.score === 'number' && (
                          <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
                            c.score >= 80 ? 'bg-lime-400/20 text-lime-300 border border-lime-400/30' :
                            c.score >= 60 ? 'bg-cyan-400/20 text-cyan-300 border border-cyan-400/30' :
                            'bg-slate-500/20 text-slate-300 border border-slate-500/30'
                          }`}>
                            スコア {c.score}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs font-bold text-cyan-300/80 mb-2 flex-wrap">
                        {c.industry && <span>🏢 {c.industry}</span>}
                        {c.region && <span>📍 {c.region}</span>}
                        {c.size && <span>👥 {c.size}</span>}
                      </div>
                      {c.description && (
                        <p className="text-sm text-cyan-100/80 leading-relaxed line-clamp-2">{c.description}</p>
                      )}
                      {c.website && (
                        <a
                          href={c.website.startsWith('http') ? c.website : `https://${c.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block mt-2 text-xs font-bold text-lime-300 hover:underline"
                        >
                          🔗 {c.website}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-5 bg-gradient-to-r from-cyan-400/10 to-lime-300/10 border-t-2 border-cyan-400/30 flex items-center justify-center gap-2">
              <span className="text-2xl">🐻</span>
              <p className="text-sm font-bold text-cyan-200">いいリストができましたね！</p>
            </div>
          </div>
        )}

        {/* ===== Empty hint ===== */}
        {companies.length === 0 && !generating && (
          <div className="bg-[#13234d]/40 backdrop-blur rounded-3xl border-2 border-dashed border-cyan-400/30 p-8 text-center space-y-3">
            <div className="text-5xl">💤</div>
            <p className="text-base font-black text-cyan-200">条件を選んで「リストを生成する」を押してください 👆</p>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div>
      <label className="block text-sm font-black text-cyan-200 mb-2">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 border-2 border-cyan-400/30 rounded-2xl text-sm font-bold text-white bg-[#0a1530]/60 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30 cursor-pointer"
      >
        {options.map((o) => <option key={o} value={o} className="bg-[#0a1530]">{o}</option>)}
      </select>
    </div>
  )
}
