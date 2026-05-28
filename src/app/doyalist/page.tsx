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

// エリア → 都道府県マッピング
const AREA_PREFECTURES: Record<string, string[]> = {
  '全国': [],
  '北海道・東北': ['北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県'],
  '関東': ['東京都', '神奈川県', '埼玉県', '千葉県', '茨城県', '栃木県', '群馬県'],
  '中部': ['新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県', '静岡県', '愛知県'],
  '近畿': ['三重県', '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県'],
  '中国': ['鳥取県', '島根県', '岡山県', '広島県', '山口県'],
  '四国': ['徳島県', '香川県', '愛媛県', '高知県'],
  '九州・沖縄': ['福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'],
}
const AREAS = Object.keys(AREA_PREFECTURES)

const SIZES = ['指定なし', 'スタートアップ（〜20名）', '中小企業（20〜300名）', '中堅企業（300〜1000名）', '大企業（1000名〜）']
const COUNTS = [5, 10, 15, 20]

export default function DoyalistHomePage() {
  const { data: session, status } = useSession()
  const [industry, setIndustry] = useState('IT・ソフトウェア')
  const [area, setArea] = useState('全国')
  const [prefecture, setPrefecture] = useState('') // 都道府県（任意）
  const [size, setSize] = useState('指定なし')
  const [keywords, setKeywords] = useState('')
  const [count, setCount] = useState(10)

  // エリア変更時に都道府県をリセット
  const handleAreaChange = (v: string) => {
    setArea(v)
    setPrefecture('')
  }

  // 検索に使う「地域」: 都道府県指定があればそれを優先、なければエリア
  const region = prefecture || area
  const prefectureOptions = AREA_PREFECTURES[area] || []
  const [generating, setGenerating] = useState(false)
  const [companies, setCompanies] = useState<Company[]>([])
  const [savedListId, setSavedListId] = useState<string | null>(null)

  const ensureDefaultProject = async (overrides?: { industry?: string; region?: string; size?: string; keywords?: string }): Promise<string | null> => {
    try {
      const r = await fetch('/api/doyalist/projects')
      const data = await r.json()
      const list = Array.isArray(data) ? data : (data?.projects || [])
      const existing = list.find((p: any) => p.name === 'マイリスト')
      const body = {
        name: 'マイリスト',
        industry: overrides?.industry || industry,
        region: overrides?.region ?? region,
        targetSize: overrides?.size || size,
        keywords: overrides?.keywords ?? keywords,
      }
      if (existing) {
        await fetch(`/api/doyalist/projects/${existing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        return existing.id
      }
      const create = await fetch('/api/doyalist/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
      const pid = await ensureDefaultProject({ industry, region: prefecture || area, size, keywords })
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
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <img src="/doyalist/logo.png" alt="ドヤリスト" className="w-48 animate-pulse" />
          <p className="text-sm font-bold text-slate-500">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (!session?.user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-cyan-50 to-white p-6">
        <div className="bg-white border-2 border-[#0a1530] rounded-3xl shadow-2xl shadow-[#0a1530]/10 p-10 max-w-md w-full text-center space-y-5">
          <img src="/doyalist/logo.png" alt="ドヤリスト" className="w-64 mx-auto" />
          <p className="text-sm font-bold text-slate-600">AIが営業先リストを自動で作ります 🚀</p>
          <a
            href={`/auth/signin?callbackUrl=${encodeURIComponent('/doyalist')}`}
            className="block w-full py-3.5 bg-[#0a1530] text-white font-black rounded-2xl shadow-lg hover:bg-[#13234d] hover:shadow-2xl transition-all"
          >
            Googleでログイン
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-cyan-50/30 to-white p-4 lg:p-8 text-slate-800">
      <Toaster
        position="top-center"
        toastOptions={{
          style: { background: '#0a1530', color: '#fff', border: '1px solid rgba(56, 189, 248, 0.3)' },
        }}
      />

      <div className="max-w-4xl mx-auto space-y-6 pb-20">
        {/* ===== Logo Hero ===== */}
        <div className="text-center pt-4 pb-2">
          <img src="/doyalist/logo.png" alt="ドヤリスト" className="w-72 lg:w-96 mx-auto" />
          <p className="text-sm font-bold text-[#0a1530] mt-3">⚡ 条件を選ぶだけ。AIが営業リストを爆速生成 ⚡</p>
        </div>

        {/* ===== Form Card ===== */}
        <div className="bg-white rounded-3xl shadow-xl shadow-[#0a1530]/10 border-2 border-[#0a1530]/20 p-6 lg:p-8 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-[#0a1530]/10">
            <div className="w-12 h-12 rounded-2xl bg-[#0a1530] flex items-center justify-center text-2xl shadow-lg">
              ⚙️
            </div>
            <div>
              <h2 className="text-lg font-black text-[#0a1530]">どんな企業を探しますか？</h2>
              <p className="text-xs font-bold text-slate-500">業界・地域・規模を選んでください</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="🏢 業界" value={industry} onChange={setIndustry} options={INDUSTRIES} />
            <Field label="🗾 エリア" value={area} onChange={handleAreaChange} options={AREAS} />
            {prefectureOptions.length > 0 && (
              <div className="sm:col-span-2">
                <label className="block text-sm font-black text-[#0a1530] mb-2">📍 都道府県（任意・絞り込み）</label>
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
                  <button
                    onClick={() => setPrefecture('')}
                    className={`py-2.5 rounded-2xl text-xs font-black transition-all ${
                      prefecture === ''
                        ? 'bg-[#0a1530] text-white shadow-lg scale-105'
                        : 'bg-cyan-50 text-[#0a1530] hover:bg-cyan-100 border border-[#0a1530]/10'
                    }`}
                  >
                    全て
                  </button>
                  {prefectureOptions.map((p) => (
                    <button
                      key={p}
                      onClick={() => setPrefecture(p)}
                      className={`py-2.5 rounded-2xl text-xs font-black transition-all ${
                        prefecture === p
                          ? 'bg-[#0a1530] text-white shadow-lg scale-105'
                          : 'bg-cyan-50 text-[#0a1530] hover:bg-cyan-100 border border-[#0a1530]/10'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="sm:col-span-2">
              <Field label="👥 企業規模" value={size} onChange={setSize} options={SIZES} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-black text-[#0a1530] mb-2">🔍 キーワード（任意）</label>
              <input
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="例: SaaS, AI, 業務効率化"
                className="w-full px-4 py-3 border-2 border-[#0a1530]/20 rounded-2xl text-sm font-bold text-[#0a1530] bg-white placeholder:text-slate-300 focus:outline-none focus:border-[#0a1530] focus:ring-2 focus:ring-cyan-400/30"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-black text-[#0a1530] mb-2">📊 生成する件数</label>
              <div className="grid grid-cols-4 gap-2">
                {COUNTS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCount(c)}
                    className={`py-3 rounded-2xl text-sm font-black transition-all ${
                      count === c
                        ? 'bg-[#0a1530] text-white shadow-lg shadow-[#0a1530]/30 scale-105'
                        : 'bg-cyan-50 text-[#0a1530] hover:bg-cyan-100 border border-[#0a1530]/10'
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
            className="w-full py-4 bg-[#0a1530] text-white font-black text-lg rounded-2xl shadow-xl shadow-[#0a1530]/30 hover:bg-[#13234d] hover:shadow-2xl active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          >
            {generating ? (
              <>
                <span className="inline-block animate-spin">⚡</span>
                AIが頑張ってます...
              </>
            ) : (
              <>⚡ リストを生成する 🚀</>
            )}
          </button>
        </div>

        {/* ===== Loading ===== */}
        {generating && companies.length === 0 && (
          <div className="bg-white rounded-3xl shadow-xl border-2 border-[#0a1530]/20 p-10 text-center space-y-4">
            <div className="text-6xl animate-bounce">🐻</div>
            <p className="text-lg font-black text-[#0a1530]">クマが企業を探しています...</p>
            <p className="text-xs font-bold text-slate-500">⏰ 通常10〜30秒ほどかかります</p>
          </div>
        )}

        {/* ===== Results ===== */}
        {companies.length > 0 && (
          <div className="bg-white rounded-3xl shadow-2xl shadow-[#0a1530]/10 border-2 border-[#0a1530]/20 overflow-hidden">
            <div className="p-6 bg-gradient-to-r from-cyan-50 via-lime-50 to-cyan-50 border-b-2 border-[#0a1530]/10 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="text-3xl">🎉</div>
                <div>
                  <h2 className="text-lg font-black text-[#0a1530]">{companies.length}社できました！</h2>
                  <p className="text-xs font-bold text-slate-500">⬇️ ダウンロードで保存できます</p>
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

            <div className="divide-y divide-[#0a1530]/10">
              {companies.map((c, i) => (
                <div key={c.id || i} className="p-5 hover:bg-cyan-50/50 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-[#0a1530] flex items-center justify-center text-white font-black shadow-md">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="text-base font-black text-[#0a1530]">{c.name}</h3>
                        {typeof c.score === 'number' && (
                          <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
                            c.score >= 80 ? 'bg-lime-100 text-lime-700 border border-lime-300' :
                            c.score >= 60 ? 'bg-cyan-100 text-cyan-700 border border-cyan-300' :
                            'bg-slate-100 text-slate-600 border border-slate-300'
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
                          className="inline-block mt-2 text-xs font-bold text-cyan-600 hover:underline"
                        >
                          🔗 {c.website}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-5 bg-gradient-to-r from-cyan-50 to-lime-50 border-t-2 border-[#0a1530]/10 flex items-center justify-center gap-2">
              <span className="text-2xl">🐻</span>
              <p className="text-sm font-bold text-[#0a1530]">いいリストができましたね！</p>
            </div>
          </div>
        )}

        {/* ===== Empty hint ===== */}
        {companies.length === 0 && !generating && (
          <div className="bg-white/60 backdrop-blur rounded-3xl border-2 border-dashed border-[#0a1530]/20 p-8 text-center space-y-3">
            <div className="text-5xl">💤</div>
            <p className="text-base font-black text-[#0a1530]">条件を選んで「リストを生成する」を押してください 👆</p>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div>
      <label className="block text-sm font-black text-[#0a1530] mb-2">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 border-2 border-[#0a1530]/20 rounded-2xl text-sm font-bold text-[#0a1530] bg-white focus:outline-none focus:border-[#0a1530] focus:ring-2 focus:ring-cyan-400/30 cursor-pointer"
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}
