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

const INDUSTRIES = ['IT・ソフトウェア', '製造業', '小売・EC', '医療・介護', '教育', '金融・保険', '不動産', '飲食', '物流', '建設', 'その他']
const REGIONS = ['全国', '東京都', '神奈川県', '埼玉県', '千葉県', '大阪府', '愛知県', '京都府', '兵庫県', '福岡県', '北海道', 'その他']
const SIZES = ['指定なし', 'スタートアップ（〜20名）', '中小企業（20〜300名）', '中堅企業（300〜1000名）', '大企業（1000名〜）']
const COUNTS = [5, 10, 15, 20]

const CHARS = {
  hello: '/kintai/characters/hello_挨拶.png',
  thinking: '/kintai/characters/thinking_考え中.png',
  working: '/kintai/characters/working_作業中.png',
  jump: '/kintai/characters/jump_大喜び.png',
  success: '/kintai/characters/success_成功.png',
  present: '/kintai/characters/present_プレゼン.png',
  point: '/kintai/characters/point_解説.png',
  thumbsup: '/kintai/characters/thumbsup_いいね.png',
  love: '/kintai/characters/love_大好き.png',
  surprise: '/kintai/characters/surprise_驚き.png',
  error: '/kintai/characters/error_泣き.png',
  sleep: '/kintai/characters/sleep_居眠り.png',
}

export default function DoyalistHomePage() {
  const { data: session, status } = useSession()
  const [industry, setIndustry] = useState('IT・ソフトウェア')
  const [region, setRegion] = useState('全国')
  const [size, setSize] = useState('指定なし')
  const [keywords, setKeywords] = useState('')
  const [count, setCount] = useState(10)
  const [generating, setGenerating] = useState(false)
  const [companies, setCompanies] = useState<Company[]>([])
  const [projectId, setProjectId] = useState<string | null>(null)
  const [savedListId, setSavedListId] = useState<string | null>(null)

  // 既存の「デフォルトプロジェクト」を取得 or 作成（裏で勝手にやる）
  const ensureDefaultProject = async (overrides?: { industry?: string; region?: string; size?: string; keywords?: string }): Promise<string | null> => {
    try {
      // 既存プロジェクト一覧取得
      const r = await fetch('/api/doyalist/projects')
      const data = await r.json()
      const list = Array.isArray(data) ? data : (data?.projects || [])
      const existing = list.find((p: any) => p.name === 'マイリスト')
      if (existing) {
        // 設定を更新
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
      // 作成
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
      setProjectId(pid)

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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50">
        <div className="flex flex-col items-center gap-4">
          <img src={CHARS.thinking} alt="" className="w-32 h-32 animate-bounce" />
          <p className="text-sm font-bold text-slate-500">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (!session?.user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-pink-50 to-violet-50 p-6">
        <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full text-center space-y-5">
          <img src={CHARS.hello} alt="" className="w-32 h-32 mx-auto" />
          <div>
            <h1 className="text-2xl font-black text-slate-800 mb-2">ドヤリストへようこそ！</h1>
            <p className="text-sm font-bold text-slate-500">AIが営業先リストを自動で作ります 🚀</p>
          </div>
          <a
            href={`/auth/signin?callbackUrl=${encodeURIComponent('/doyalist')}`}
            className="block w-full py-3.5 bg-gradient-to-r from-[#7f19e6] to-pink-500 text-white font-black rounded-2xl shadow-lg hover:shadow-xl transition-shadow"
          >
            Googleでログイン
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-violet-50 p-4 lg:p-8">
      <Toaster position="top-center" />

      <div className="max-w-4xl mx-auto space-y-6 pb-20">
        {/* ===== Hero ===== */}
        <div className="text-center pt-4 pb-2">
          <div className="flex items-center justify-center gap-3 mb-3">
            <img src={CHARS.hello} alt="" className="w-20 h-20" />
            <img src={CHARS.present} alt="" className="w-24 h-24" />
            <img src={CHARS.thumbsup} alt="" className="w-20 h-20" />
          </div>
          <h1 className="text-3xl lg:text-4xl font-black bg-gradient-to-r from-[#7f19e6] via-pink-500 to-rose-500 bg-clip-text text-transparent">
            ドヤリスト
          </h1>
          <p className="text-sm font-bold text-slate-500 mt-2">条件を選ぶだけ✨ AIが営業リストを作ります</p>
        </div>

        {/* ===== Form Card ===== */}
        <div className="bg-white rounded-3xl shadow-xl shadow-purple-100/50 border-2 border-purple-100 p-6 lg:p-8 space-y-6">
          <div className="flex items-center gap-3 pb-3 border-b border-purple-100">
            <img src={CHARS.point} alt="" className="w-14 h-14" />
            <div>
              <h2 className="text-lg font-black text-slate-800">どんな企業を探しますか？</h2>
              <p className="text-xs font-bold text-slate-400">業界・地域・規模を選んでください</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 業界 */}
            <div>
              <label className="block text-sm font-black text-slate-700 mb-2 flex items-center gap-1">
                🏢 業界
              </label>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full px-4 py-3 border-2 border-purple-200 rounded-2xl text-sm font-bold text-slate-700 bg-white focus:outline-none focus:border-[#7f19e6] focus:ring-2 focus:ring-purple-100"
              >
                {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            {/* 地域 */}
            <div>
              <label className="block text-sm font-black text-slate-700 mb-2 flex items-center gap-1">
                📍 地域
              </label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full px-4 py-3 border-2 border-purple-200 rounded-2xl text-sm font-bold text-slate-700 bg-white focus:outline-none focus:border-[#7f19e6] focus:ring-2 focus:ring-purple-100"
              >
                {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            {/* 規模 */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-black text-slate-700 mb-2 flex items-center gap-1">
                👥 企業規模
              </label>
              <select
                value={size}
                onChange={(e) => setSize(e.target.value)}
                className="w-full px-4 py-3 border-2 border-purple-200 rounded-2xl text-sm font-bold text-slate-700 bg-white focus:outline-none focus:border-[#7f19e6] focus:ring-2 focus:ring-purple-100"
              >
                {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {/* キーワード */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-black text-slate-700 mb-2 flex items-center gap-1">
                🔍 キーワード（任意）
              </label>
              <input
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="例: SaaS, AI, 業務効率化"
                className="w-full px-4 py-3 border-2 border-purple-200 rounded-2xl text-sm font-bold text-slate-700 bg-white placeholder:text-slate-300 focus:outline-none focus:border-[#7f19e6] focus:ring-2 focus:ring-purple-100"
              />
            </div>
            {/* 件数 */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-black text-slate-700 mb-2 flex items-center gap-1">
                📊 生成する件数
              </label>
              <div className="grid grid-cols-4 gap-2">
                {COUNTS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCount(c)}
                    className={`py-3 rounded-2xl text-sm font-black transition-all ${
                      count === c
                        ? 'bg-gradient-to-r from-[#7f19e6] to-pink-500 text-white shadow-lg scale-105'
                        : 'bg-purple-50 text-slate-600 hover:bg-purple-100'
                    }`}
                  >
                    {c}社
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ===== Generate Button ===== */}
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full py-4 bg-gradient-to-r from-[#7f19e6] via-pink-500 to-rose-500 text-white font-black text-lg rounded-2xl shadow-xl shadow-purple-300/50 hover:shadow-2xl active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          >
            {generating ? (
              <>
                <img src={CHARS.working} alt="" className="w-8 h-8 animate-spin" />
                AIが頑張ってます...
              </>
            ) : (
              <>
                <img src={CHARS.jump} alt="" className="w-8 h-8" />
                リストを生成する 🚀
              </>
            )}
          </button>
        </div>

        {/* ===== Results ===== */}
        {generating && companies.length === 0 && (
          <div className="bg-white rounded-3xl shadow-xl border-2 border-purple-100 p-10 text-center space-y-4">
            <img src={CHARS.thinking} alt="" className="w-32 h-32 mx-auto animate-bounce" />
            <p className="text-lg font-black text-slate-700">クマが企業を探しています...</p>
            <p className="text-xs font-bold text-slate-400">⏰ 通常10〜30秒ほどかかります</p>
          </div>
        )}

        {companies.length > 0 && (
          <div className="bg-white rounded-3xl shadow-xl shadow-purple-100/50 border-2 border-purple-100 overflow-hidden">
            <div className="p-6 bg-gradient-to-r from-purple-100 via-pink-50 to-rose-50 border-b-2 border-purple-100 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <img src={CHARS.success} alt="" className="w-14 h-14" />
                <div>
                  <h2 className="text-lg font-black text-slate-800">{companies.length}社できました！</h2>
                  <p className="text-xs font-bold text-slate-500">⬇️ ダウンロードで保存できます</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={downloadCSV}
                  className="px-4 py-2.5 bg-emerald-500 text-white font-black text-sm rounded-2xl shadow-lg hover:bg-emerald-600 active:scale-95 transition-all flex items-center gap-1.5"
                >
                  📥 CSV
                </button>
                <button
                  onClick={downloadExcel}
                  className="px-4 py-2.5 bg-blue-500 text-white font-black text-sm rounded-2xl shadow-lg hover:bg-blue-600 active:scale-95 transition-all flex items-center gap-1.5"
                >
                  📊 Excel
                </button>
              </div>
            </div>

            <div className="divide-y divide-purple-50">
              {companies.map((c, i) => (
                <div key={c.id || i} className="p-5 hover:bg-purple-50/30 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-[#7f19e6] to-pink-500 flex items-center justify-center text-white font-black shadow-md">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="text-base font-black text-slate-800">{c.name}</h3>
                        {typeof c.score === 'number' && (
                          <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
                            c.score >= 80 ? 'bg-emerald-100 text-emerald-700' :
                            c.score >= 60 ? 'bg-amber-100 text-amber-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            スコア {c.score}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs font-bold text-slate-500 mb-2 flex-wrap">
                        {c.industry && <span>🏢 {c.industry}</span>}
                        {c.region && <span>📍 {c.region}</span>}
                        {c.size && <span>👥 {c.size}</span>}
                      </div>
                      {c.description && (
                        <p className="text-sm text-slate-600 leading-relaxed line-clamp-2">{c.description}</p>
                      )}
                      {c.website && (
                        <a
                          href={c.website.startsWith('http') ? c.website : `https://${c.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block mt-2 text-xs font-bold text-[#7f19e6] hover:underline"
                        >
                          🔗 {c.website}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-5 bg-gradient-to-r from-purple-50 to-pink-50 border-t-2 border-purple-100 flex items-center justify-center gap-2">
              <img src={CHARS.love} alt="" className="w-10 h-10" />
              <p className="text-sm font-bold text-slate-600">いいリストができましたね！</p>
            </div>
          </div>
        )}

        {/* ===== Empty hint ===== */}
        {companies.length === 0 && !generating && (
          <div className="bg-white/60 backdrop-blur rounded-3xl border-2 border-dashed border-purple-200 p-8 text-center space-y-3">
            <img src={CHARS.sleep} alt="" className="w-24 h-24 mx-auto opacity-80" style={{ animation: 'pulse 3s infinite' }} />
            <p className="text-base font-black text-slate-500">条件を選んで「リストを生成する」を押してください 👆</p>
          </div>
        )}
      </div>
    </div>
  )
}
