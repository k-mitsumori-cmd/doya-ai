'use client'

import { useEffect, useMemo, useState } from 'react'
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
  contactPerson?: string | null
  source?: string | null
  enrichedData?: {
    corporateNumber?: string | null
    address?: string | null
    prefecture?: string | null
    representative?: string | null
    capital?: string | null
    employeeCount?: string | null
    foundedYear?: number | string | null
    businessSummary?: string | null
    industry?: string | null
  } | null
}

const CHARS = {
  hello: '/kintai/characters/hello_挨拶.png',
  thinking: '/kintai/characters/thinking_考え中.png',
  working: '/kintai/characters/working_作業中.png',
  jump: '/kintai/characters/jump_大喜び.png',
  success: '/kintai/characters/success_成功.png',
  point: '/kintai/characters/point_解説.png',
  thumbsup: '/kintai/characters/thumbsup_いいね.png',
  sleep: '/kintai/characters/sleep_居眠り.png',
}

const INDUSTRIES = ['IT・ソフトウェア', '製造業', '小売・EC', '医療・介護', '教育', '金融・保険', '不動産', '飲食', '物流', '建設', 'コンサル', '広告・マーケ', '人材', 'その他']

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
const COUNT_OPTIONS = [100, 500, 1000, 2000, 3000, 5000, 7000, 10000]
const PAGE_SIZE = 50
const SORT_OPTIONS = [
  { v: 'default', l: '抽出順' },
  { v: 'name', l: '企業名' },
  { v: 'founded_desc', l: '設立年（新しい順）' },
  { v: 'founded_asc', l: '設立年（古い順）' },
  { v: 'employees_desc', l: '従業員数（多い順）' },
]

const PREVIEW_FIELDS = [
  '法人名',
  '業種',
  '所在地・都道府県',
  '代表者名',
  '従業員数',
  '資本金',
  '設立年',
  '公式WebサイトURL',
  '事業概要',
]

export default function DoyalistHomePage() {
  const { data: session, status } = useSession()
  const [industry, setIndustry] = useState('IT・ソフトウェア')
  const [area, setArea] = useState('全国')
  const [prefecture, setPrefecture] = useState('')
  const [size, setSize] = useState('指定なし')
  const [keywords, setKeywords] = useState('')
  const [count, setCount] = useState(100)

  const handleAreaChange = (v: string) => { setArea(v); setPrefecture('') }
  const region = prefecture || area
  const prefectureOptions = AREA_PREFECTURES[area] || []

  const [generating, setGenerating] = useState(false)
  const [companies, setCompanies] = useState<Company[]>([])
  const [savedListId, setSavedListId] = useState<string | null>(null)

  const [filterText, setFilterText] = useState('')
  const [sortBy, setSortBy] = useState('default')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const createProject = async (): Promise<string | null> => {
    try {
      const dateStr = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      const projectName = `${industry}_${region}_${dateStr}`
      const create = await fetch('/api/doyalist/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: projectName, industry, region, targetSize: size, keywords }),
      })
      const createdData = await create.json()
      return createdData?.project?.id || createdData?.id || null
    } catch (e) {
      console.error('[doyalist] createProject', e)
      return null
    }
  }

  const handleGenerate = async () => {
    if (!session?.user) { toast.error('ログインしてください'); return }
    setGenerating(true); setCompanies([]); setVisibleCount(PAGE_SIZE)
    const tid = toast.loading('リストを抽出中...')
    try {
      const pid = await createProject()
      if (!pid) { toast.error('準備に失敗しました', { id: tid }); return }

      const res = await fetch('/api/doyalist/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: pid, count }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data?.error || 'リスト抽出に失敗しました', { id: tid }); return }

      const list = Array.isArray(data?.companies) ? data.companies : []
      setCompanies(list)
      setSavedListId(pid)
      toast.success(`${list.length}社のリストができました`, { id: tid })
      if (data?.warning) toast(data.warning, { icon: 'ℹ️', duration: 5000 })
    } catch (e: any) {
      toast.error(e?.message || '通信エラーが発生しました', { id: tid })
    } finally {
      setGenerating(false)
    }
  }

  const downloadCSV = () => savedListId && (window.location.href = `/api/doyalist/export?projectId=${savedListId}&format=csv`)
  const downloadExcel = () => savedListId && (window.location.href = `/api/doyalist/export?projectId=${savedListId}&format=excel`)

  const filteredCompanies = useMemo(() => {
    let list = companies
    if (filterText.trim()) {
      const q = filterText.toLowerCase()
      list = list.filter((c) => {
        const ed = c.enrichedData || {}
        return c.name?.toLowerCase().includes(q) || c.industry?.toLowerCase().includes(q) || ed.address?.toLowerCase().includes(q) || ed.representative?.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q)
      })
    }
    const parseYear = (v: any) => { const n = parseInt(String(v || ''), 10); return isNaN(n) ? 0 : n }
    const parseEmpCount = (v: any) => { const m = String(v || '').match(/\d+/g); return m ? Math.max(...m.map(Number)) : 0 }
    switch (sortBy) {
      case 'name': return [...list].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ja'))
      case 'founded_desc': return [...list].sort((a, b) => parseYear(b.enrichedData?.foundedYear) - parseYear(a.enrichedData?.foundedYear))
      case 'founded_asc': return [...list].sort((a, b) => parseYear(a.enrichedData?.foundedYear) - parseYear(b.enrichedData?.foundedYear))
      case 'employees_desc': return [...list].sort((a, b) => parseEmpCount(b.enrichedData?.employeeCount) - parseEmpCount(a.enrichedData?.employeeCount))
      default: return list
    }
  }, [companies, filterText, sortBy])

  const visibleCompanies = filteredCompanies.slice(0, visibleCount)
  const hasMore = filteredCompanies.length > visibleCount

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <img src="/doyalist/logo.png" alt="ドヤリスト" className="w-48 animate-pulse" />
          <p className="text-sm font-bold text-slate-500">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (!session?.user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-10 max-w-md w-full text-center space-y-5">
          <img src="/doyalist/logo.png" alt="ドヤリスト" className="w-64 mx-auto" />
          <p className="text-sm font-medium text-slate-600">AIが営業先リストを自動で作ります</p>
          <a
            href={`/auth/signin?callbackUrl=${encodeURIComponent('/doyalist')}`}
            className="block w-full py-3.5 bg-[#0a1530] text-white font-bold rounded-2xl hover:bg-[#13234d] hover:shadow-xl transition-all"
          >
            Googleでログイン
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-8 text-slate-800">
      <Toaster position="top-center" />

      <div className="max-w-7xl mx-auto pb-20">
        {/* ===== Page Header ===== */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-400 to-cyan-500 flex items-center justify-center shadow-md">
            <span className="text-white text-2xl">📊</span>
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-black text-[#0a1530]">営業リストをつくる</h1>
            <p className="text-sm font-medium text-slate-500 mt-0.5">条件を選ぶと、実企業データから営業リストをランダム抽出します</p>
          </div>
        </div>

        {/* ===== 2-Column Layout ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ===== LEFT: Form (2/3) ===== */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-3xl shadow-lg shadow-slate-200/50 border border-slate-200 p-6 lg:p-8 space-y-5">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <img src={CHARS.point} alt="" className="w-10 h-10" />
                <div>
                  <h2 className="text-base font-bold text-[#0a1530]">どんな企業を探しますか？</h2>
                  <p className="text-xs text-slate-500">業界・地域・規模を選んでください</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="🏢 業界" value={industry} onChange={setIndustry} options={INDUSTRIES} />
                <Field label="🗾 エリア" value={area} onChange={handleAreaChange} options={AREAS} />
                <Field label="👥 企業規模" value={size} onChange={setSize} options={SIZES} />
                <div>
                  <label className="block text-sm font-bold text-[#0a1530] mb-2">🔍 キーワード（任意）</label>
                  <input
                    type="text"
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                    placeholder="例: SaaS, AI, 業務効率化"
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm font-medium text-slate-800 bg-white placeholder:text-slate-300 focus:outline-none focus:border-[#0a1530] focus:ring-2 focus:ring-cyan-100"
                  />
                </div>
              </div>

              {prefectureOptions.length > 0 && (
                <div>
                  <label className="block text-sm font-bold text-[#0a1530] mb-2">📍 都道府県（任意・絞り込み）</label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
                    <button onClick={() => setPrefecture('')} className={`py-2.5 rounded-xl text-xs font-bold transition-all ${prefecture === '' ? 'bg-[#0a1530] text-white' : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'}`}>
                      全て
                    </button>
                    {prefectureOptions.map((p) => (
                      <button key={p} onClick={() => setPrefecture(p)} className={`py-2.5 rounded-xl text-xs font-bold transition-all ${prefecture === p ? 'bg-[#0a1530] text-white' : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'}`}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-[#0a1530] mb-2">
                  📊 抽出する件数 <span className="text-xs font-normal text-slate-400">（1回最大10,000社）</span>
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {COUNT_OPTIONS.map((c) => (
                    <button key={c} onClick={() => setCount(c)} className={`py-3 rounded-xl text-xs sm:text-sm font-bold transition-all ${count === c ? 'bg-[#0a1530] text-white shadow-md' : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'}`}>
                      {c.toLocaleString()}社
                    </button>
                  ))}
                </div>
                {count >= 1000 && (
                  <p className="text-xs font-medium text-cyan-700 mt-2">
                    ⏰ {count.toLocaleString()}社の抽出は約 {Math.ceil(count / 50)}〜{Math.ceil(count / 50) * 3}秒かかります
                  </p>
                )}
              </div>

              <button
                onClick={handleGenerate}
                disabled={generating}
                className="w-full py-4 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-bold text-base rounded-xl shadow-lg shadow-cyan-500/30 hover:shadow-xl active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {generating ? (
                  <><img src={CHARS.working} alt="" className="w-6 h-6 animate-spin" />抽出中...</>
                ) : (
                  <><img src={CHARS.jump} alt="" className="w-6 h-6" />リストを抽出する</>
                )}
              </button>
            </div>
          </div>

          {/* ===== RIGHT: Preview Panel (1/3) ===== */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-3xl shadow-lg shadow-slate-200/50 border border-slate-200 p-6 lg:sticky lg:top-24">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <span className="text-xl">🔍</span>
                <h3 className="text-sm font-bold text-[#0a1530]">抽出プレビュー</h3>
              </div>

              <div className="py-5 text-center border-b border-slate-100">
                <p className="text-xs font-bold text-slate-500 mb-1">想定取得件数</p>
                <p className="text-4xl font-black text-[#0a1530]">{count.toLocaleString()}<span className="text-base font-bold text-slate-500 ml-1">社</span></p>
              </div>

              <div className="py-4 space-y-2">
                <p className="text-xs font-bold text-slate-700 mb-2">📋 取得できる情報</p>
                {PREVIEW_FIELDS.map((f) => (
                  <div key={f} className="flex items-center gap-2 text-xs text-slate-600">
                    <span className="text-emerald-500">✓</span>
                    <span>{f}</span>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-slate-100 space-y-2">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>📡</span><span>gBizINFO（経済産業省）</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>📥</span><span>CSV/Excelダウンロード可</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ===== Loading ===== */}
        {generating && companies.length === 0 && (
          <div className="mt-6 bg-white rounded-3xl shadow-lg border border-slate-200 p-10 text-center space-y-4">
            <img src={CHARS.thinking} alt="" className="w-28 h-28 mx-auto animate-bounce" />
            <p className="text-lg font-bold text-[#0a1530]">クマが企業を探しています...</p>
            <p className="text-xs font-medium text-slate-500">通常10〜60秒ほどかかります</p>
          </div>
        )}

        {/* ===== Results ===== */}
        {companies.length > 0 && (
          <div className="mt-6 bg-white rounded-3xl shadow-lg shadow-slate-200/50 border border-slate-200 overflow-hidden">
            <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <img src={CHARS.success} alt="" className="w-12 h-12" />
                <div>
                  <h2 className="text-lg font-bold text-[#0a1530]">{companies.length.toLocaleString()}社できました</h2>
                  <p className="text-xs font-medium text-slate-500">
                    {companies.length < count ? `指定${count.toLocaleString()}社のうち${companies.length}社のみ該当（条件を緩めると増えます）` : `ダウンロードで保存できます`}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={downloadCSV} className="px-4 py-2.5 bg-[#0a1530] text-white font-bold text-sm rounded-xl shadow hover:bg-[#13234d] active:scale-95 transition-all">📥 CSV</button>
                <button onClick={downloadExcel} className="px-4 py-2.5 bg-cyan-500 text-white font-bold text-sm rounded-xl shadow hover:bg-cyan-600 active:scale-95 transition-all">📊 Excel</button>
              </div>
            </div>

            <div className="p-4 border-b border-slate-200 flex gap-2 flex-wrap items-center">
              <input
                type="text"
                value={filterText}
                onChange={(e) => { setFilterText(e.target.value); setVisibleCount(PAGE_SIZE) }}
                placeholder="🔍 名前・業種・住所で絞り込み"
                className="flex-1 min-w-[200px] px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:border-[#0a1530] focus:ring-2 focus:ring-cyan-100"
              />
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white cursor-pointer focus:outline-none focus:border-[#0a1530]">
                {SORT_OPTIONS.map((s) => <option key={s.v} value={s.v}>並び替え: {s.l}</option>)}
              </select>
              <span className="text-xs font-medium text-slate-500">{filteredCompanies.length}社表示中</span>
            </div>

            <div className="divide-y divide-slate-100">
              {visibleCompanies.map((c, i) => {
                const ed = c.enrichedData || {}
                const gbizUrl = ed.corporateNumber ? `https://info.gbiz.go.jp/hojin/ichiran?hojinBangou=${ed.corporateNumber}` : null
                return (
                  <div key={c.id || i} className="p-5 hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#0a1530] flex items-center justify-center text-white font-bold text-sm shadow">{i + 1}</div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <h3 className="text-base font-bold text-[#0a1530]">{c.name}</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                          {c.industry && <InfoRow icon="🏢" label="業種" value={c.industry} />}
                          {(ed.address || c.region) && <InfoRow icon="📍" label="所在地" value={ed.address || c.region!} />}
                          {ed.representative && <InfoRow icon="👤" label="代表者" value={ed.representative} />}
                          {(ed.employeeCount || c.size) && <InfoRow icon="👥" label="従業員数" value={ed.employeeCount || c.size!} />}
                          {ed.capital && <InfoRow icon="💰" label="資本金" value={ed.capital} />}
                          {ed.foundedYear && <InfoRow icon="📅" label="設立年" value={String(ed.foundedYear)} />}
                        </div>
                        {(ed.businessSummary || c.description) && (
                          <div className="bg-cyan-50/50 border-l-4 border-cyan-400 px-3 py-2 rounded-r-lg">
                            <p className="text-[11px] font-bold text-cyan-700 mb-0.5">📝 事業概要</p>
                            <p className="text-sm text-slate-700 leading-relaxed">{ed.businessSummary || c.description}</p>
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {c.website && (
                            <a href={c.website.startsWith('http') ? c.website : `https://${c.website}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-3 py-1.5 bg-cyan-100 text-cyan-700 text-xs font-bold rounded-lg hover:bg-cyan-200 transition-colors">
                              🌐 公式サイト
                            </a>
                          )}
                          {gbizUrl && (
                            <a href={gbizUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-200 transition-colors">
                              🔗 gBizINFO詳細
                            </a>
                          )}
                        </div>
                        <div className="pt-2 mt-1 border-t border-slate-100 flex items-center gap-2 text-[10px] text-slate-400">
                          <span>📡 情報ソース:</span>
                          <span>{c.source === 'gbizinfo' ? 'gBizINFO（経済産業省）' : c.source === 'corporate_number' ? '法人番号公表サイト（国税庁）' : c.source?.includes('+') ? 'gBizINFO + 法人番号公表サイト' : c.source || '不明'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {hasMore && (
              <div className="p-4 bg-slate-50 border-t border-slate-200 text-center">
                <button onClick={() => setVisibleCount(visibleCount + PAGE_SIZE)} className="px-6 py-2.5 bg-white text-[#0a1530] font-bold text-sm rounded-xl border-2 border-[#0a1530] hover:bg-[#0a1530] hover:text-white transition-all">
                  さらに{Math.min(PAGE_SIZE, filteredCompanies.length - visibleCount)}社を表示（残り{filteredCompanies.length - visibleCount}社）
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-start gap-1.5">
      <span className="flex-shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <span className="text-slate-400 mr-1">{label}:</span>
        <span className="text-[#0a1530] font-medium">{value}</span>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div>
      <label className="block text-sm font-bold text-[#0a1530] mb-2">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm font-medium text-slate-800 bg-white focus:outline-none focus:border-[#0a1530] focus:ring-2 focus:ring-cyan-100 cursor-pointer">
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}
