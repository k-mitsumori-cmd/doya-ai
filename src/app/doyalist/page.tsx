'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSession } from 'next-auth/react'
import toast, { Toaster } from 'react-hot-toast'
import { INDUSTRIES, AREAS as AREA_LIST, SIZES } from '@/lib/doyalist/constants'
import { AREA_TO_PREFECTURES } from '@/lib/doyalist/collect/prefecture-codes'

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

// "全国" を含むエリア配列を構築
const AREA_PREFECTURES: Record<string, string[]> = {
  '全国': [],
  ...AREA_TO_PREFECTURES,
}
const AREAS = [...AREA_LIST]
const COUNT_OPTIONS = [100, 500, 1000, 2000, 3000, 5000, 7000, 10000]
// gBizINFO の詳細データ登録率が低い業界（実測ベース）
// 上場・公共調達・補助金受給企業が中心の傾向のため、小規模代理店・店舗系は欠落しがち
const SPARSE_INDUSTRIES = ['広告・マーケ', '小売・EC', 'コンサル', '飲食', '人材', 'その他']
const PAGE_SIZE = 50
const SORT_OPTIONS = [
  { v: 'default', l: '抽出順' },
  { v: 'name', l: '企業名' },
  { v: 'founded_desc', l: '設立年（新しい順）' },
  { v: 'founded_asc', l: '設立年（古い順）' },
  { v: 'employees_desc', l: '従業員数（多い順）' },
]

const PREVIEW_FIELDS: { label: string; always: boolean }[] = [
  { label: '法人名', always: true },
  { label: '法人番号', always: true },
  { label: '所在地（都道府県・住所）', always: true },
  { label: '業種', always: false },
  { label: '代表者名', always: false },
  { label: '従業員数', always: false },
  { label: '資本金', always: false },
  { label: '設立年', always: false },
  { label: '公式WebサイトURL', always: false },
  { label: '事業概要', always: false },
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
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [errorHint, setErrorHint] = useState<string | null>(null)

  // AI変換タグ
  const [expanding, setExpanding] = useState(false)
  const [aiTags, setAiTags] = useState<string[]>([])
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set())

  // 実数プレビュー
  const [estimateLoading, setEstimateLoading] = useState(false)
  const [estimatedCount, setEstimatedCount] = useState<number | null>(null)
  const [estimateIsApprox, setEstimateIsApprox] = useState(false)
  const [estimateNote, setEstimateNote] = useState<string | null>(null)

  // キーワード入力時にタグをリセット
  const handleKeywordChange = (v: string) => {
    setKeywords(v)
    setAiTags([])
    setActiveTags(new Set())
  }

  const handleExpandKeyword = async () => {
    if (!keywords.trim()) {
      toast.error('キーワードを入力してください')
      return
    }
    setExpanding(true)
    const tid = toast.loading('AIが検索ワードに変換中...')
    try {
      const res = await fetch('/api/doyalist/expand-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: keywords, industry }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data?.error || '変換に失敗しました', { id: tid })
        return
      }
      const tags: string[] = data.tags || []
      setAiTags(tags)
      setActiveTags(new Set(tags))
      toast.success(`${tags.length}個のタグに変換しました`, { id: tid })
    } catch (e: any) {
      toast.error(e?.message || '通信エラー', { id: tid })
    } finally {
      setExpanding(false)
    }
  }

  // フィルタ条件変更時に実数を推定
  useEffect(() => {
    if (!session?.user) return
    const ctrl = new AbortController()
    const timer = setTimeout(async () => {
      setEstimateLoading(true)
      try {
        const tagsList = Array.from(activeTags)
        const res = await fetch('/api/doyalist/estimate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ industry, region, keywords: tagsList.length > 0 ? tagsList : undefined }),
          signal: ctrl.signal,
        })
        const data = await res.json()
        if (data?.success) {
          setEstimatedCount(typeof data.estimated === 'number' ? data.estimated : null)
          setEstimateIsApprox(!!data.isApprox)
          setEstimateNote(data.note || null)
        }
      } catch {
        /* abort or error: keep last value */
      } finally {
        setEstimateLoading(false)
      }
    }, 400) // デバウンス
    return () => { clearTimeout(timer); ctrl.abort() }
  }, [session, industry, region, Array.from(activeTags).join(',')])

  const toggleTag = (tag: string) => {
    setActiveTags((prev) => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
  }

  const [filterText, setFilterText] = useState('')
  const [sortBy, setSortBy] = useState('default')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [filterHasUrl, setFilterHasUrl] = useState(false)
  const [filterHasRep, setFilterHasRep] = useState(false)
  const [filterHasEmployees, setFilterHasEmployees] = useState(false)

  // 検索に使うキーワード: AIタグ（選択中）優先 → ユーザー入力 → なし
  const searchKeywords = (): string => {
    const selectedTags = Array.from(activeTags)
    if (selectedTags.length > 0) return selectedTags.join(',')
    return keywords
  }

  const createProject = async (): Promise<string | null> => {
    try {
      const dateStr = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      const projectName = `${industry}_${region}_${dateStr}`
      const create = await fetch('/api/doyalist/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: projectName, industry, region, targetSize: size, keywords: searchKeywords() }),
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
    setErrorMsg(null); setErrorHint(null)
    const tid = toast.loading('リストを抽出中...')
    try {
      const pid = await createProject()
      if (!pid) {
        toast.error('準備に失敗しました', { id: tid })
        setErrorMsg('プロジェクトの準備に失敗しました。ログイン状態をご確認ください。')
        return
      }

      const res = await fetch('/api/doyalist/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: pid, count }),
      })
      let data: any = null
      try { data = await res.json() } catch { data = null }

      if (!res.ok) {
        const msg = data?.error || `リスト抽出に失敗しました（${res.status}）`
        toast.error(msg, { id: tid, duration: 6000 })
        setErrorMsg(msg)
        setErrorHint(data?.hint || (res.status === 422
          ? 'AI変換タグの一部を OFF にする / 業界・地域を変えると改善する可能性があります'
          : res.status === 502
            ? '少し時間をおいてから再試行してください（外部APIに一時的な障害の可能性）'
            : null))
        console.error('[doyalist/collect] error response', res.status, data)
        return
      }

      const list = Array.isArray(data?.companies) ? data.companies : []
      setCompanies(list)
      setSavedListId(pid)
      toast.success(`${list.length}社のリストができました`, { id: tid })
      if (data?.warning) toast(data.warning, { icon: 'ℹ️', duration: 5000 })
    } catch (e: any) {
      const msg = e?.message || '通信エラーが発生しました'
      toast.error(msg, { id: tid, duration: 6000 })
      setErrorMsg(msg)
      setErrorHint('ネットワーク接続を確認の上、再試行してください')
      console.error('[doyalist/collect] exception', e)
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
    // データ有無で絞り込み
    if (filterHasUrl) list = list.filter((c) => !!c.website)
    if (filterHasRep) list = list.filter((c) => !!c.enrichedData?.representative)
    if (filterHasEmployees) list = list.filter((c) => isValidEmployees(c.enrichedData?.employeeCount))
    // データなしは末尾固定（昇順時も末尾）にする比較関数
    const parseYear = (v: any): number | null => {
      const n = parseInt(String(v || ''), 10)
      return isNaN(n) || n <= 0 ? null : n
    }
    const parseEmpCount = (v: any): number | null => {
      const m = String(v || '').match(/\d+/g)
      if (!m) return null
      const max = Math.max(...m.map(Number))
      return max > 0 ? max : null
    }
    const sortWithNullsLast = <T,>(arr: T[], getValue: (x: T) => number | null, desc: boolean): T[] => {
      return [...arr].sort((a, b) => {
        const va = getValue(a)
        const vb = getValue(b)
        if (va === null && vb === null) return 0
        if (va === null) return 1   // null は末尾
        if (vb === null) return -1
        return desc ? vb - va : va - vb
      })
    }
    switch (sortBy) {
      case 'name':
        return [...list].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ja'))
      case 'founded_desc':
        return sortWithNullsLast(list, (c) => parseYear(c.enrichedData?.foundedYear), true)
      case 'founded_asc':
        return sortWithNullsLast(list, (c) => parseYear(c.enrichedData?.foundedYear), false)
      case 'employees_desc':
        return sortWithNullsLast(list, (c) => parseEmpCount(c.enrichedData?.employeeCount), true)
      default:
        return list
    }
  }, [companies, filterText, sortBy, filterHasUrl, filterHasRep, filterHasEmployees])

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
            <span className="material-symbols-outlined text-white text-3xl">bar_chart</span>
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
                <Field label={<><span className="material-symbols-outlined align-middle text-base mr-1">apartment</span>業界</>} value={industry} onChange={setIndustry} options={INDUSTRIES} />
                <Field label={<><span className="material-symbols-outlined align-middle text-base mr-1">map</span>エリア</>} value={area} onChange={handleAreaChange} options={AREAS} />
                <Field label={<><span className="material-symbols-outlined align-middle text-base mr-1">groups</span>企業規模</>} value={size} onChange={setSize} options={SIZES} />
              </div>

              {/* キーワード + AI変換 */}
              <div>
                <label className="block text-sm font-bold text-[#0a1530] mb-2">
                  <span className="material-symbols-outlined align-middle text-base mr-1">search</span>キーワード <span className="text-xs font-normal text-slate-400">（任意・AIで法人検索ワードに変換）</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={keywords}
                    onChange={(e) => handleKeywordChange(e.target.value)}
                    placeholder="例: SaaS, AI, 営業効率化, 美容、コンサル..."
                    className="flex-1 px-4 py-3 border border-slate-300 rounded-xl text-sm font-medium text-slate-800 bg-white placeholder:text-slate-300 focus:outline-none focus:border-[#0a1530] focus:ring-2 focus:ring-cyan-100"
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleExpandKeyword() } }}
                  />
                  <button
                    type="button"
                    onClick={handleExpandKeyword}
                    disabled={expanding || !keywords.trim()}
                    className="px-4 py-3 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white text-xs font-black rounded-xl shadow hover:shadow-lg active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {expanding ? '変換中...' : <><span className="material-symbols-outlined align-middle text-sm mr-0.5">smart_toy</span>AIで変換</>}
                  </button>
                </div>

                {/* AI生成タグ */}
                {aiTags.length > 0 && (
                  <div className="mt-3 p-3 bg-gradient-to-r from-violet-50 to-fuchsia-50 border border-violet-200 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-black text-violet-700 inline-flex items-center gap-0.5"><span className="material-symbols-outlined text-sm">smart_toy</span>AI変換タグ</span>
                      <span className="text-[10px] text-slate-500">クリックで使用ON/OFF（選択タグで検索）</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {aiTags.map((tag) => {
                        const active = activeTags.has(tag)
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => toggleTag(tag)}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                              active
                                ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow'
                                : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {active ? '✓ ' : ''}{tag}
                          </button>
                        )
                      })}
                    </div>
                    <p className="text-[10px] text-violet-600 mt-2">
                      {activeTags.size}個のタグを選択中
                      {activeTags.size > 0 && ' → これらの語を含む法人を検索します'}
                    </p>
                  </div>
                )}
              </div>

              {prefectureOptions.length > 0 && (
                <div>
                  <label className="block text-sm font-bold text-[#0a1530] mb-2"><span className="material-symbols-outlined align-middle text-base mr-1">location_on</span>都道府県（任意・絞り込み）</label>
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

              {/* gBizINFO登録率が低い業界の警告 */}
              {SPARSE_INDUSTRIES.includes(industry) && (
                <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-xs font-bold text-amber-700 leading-relaxed inline-flex items-start gap-1">
                    <span className="material-symbols-outlined text-base">warning</span><strong>「{industry}」業界はgBizINFO登録率が低い傾向です</strong>
                  </p>
                  <p className="text-[11px] text-amber-600 mt-1 leading-relaxed">
                    代表者名・従業員数・公式URL等の詳細情報が取得できない企業が多い場合があります。<br/>
                    法人名・住所・法人番号は確実に取得できます。
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-[#0a1530] mb-2">
                  <span className="material-symbols-outlined align-middle text-base mr-1">bar_chart</span>抽出する件数 <span className="text-xs font-normal text-slate-400">（1回最大10,000社）</span>
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {COUNT_OPTIONS.map((c) => (
                    <button key={c} onClick={() => setCount(c)} className={`py-3 rounded-xl text-xs sm:text-sm font-bold transition-all ${count === c ? 'bg-[#0a1530] text-white shadow-md' : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'}`}>
                      {c.toLocaleString()}社
                    </button>
                  ))}
                </div>
                {count >= 500 && (
                  <p className="text-xs font-medium text-cyan-700 mt-2 inline-flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">schedule</span>{count.toLocaleString()}社の抽出（詳細情報の取得込み）は約 {Math.max(20, Math.ceil(count / 60))}〜{Math.ceil(count / 30)}秒かかります
                  </p>
                )}
                {count >= 5000 && (
                  <p className="text-xs font-medium text-amber-700 mt-1 inline-flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">warning</span>大量抽出時はブラウザを閉じずにお待ちください
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

              {/* エラー表示（toastだけだと見落としやすいので持続表示） */}
              {errorMsg && (
                <div className="mt-3 p-4 bg-rose-50 border-2 border-rose-200 rounded-xl flex items-start gap-3">
                  <span className="material-symbols-outlined text-rose-500 text-xl flex-shrink-0">error</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-rose-700">{errorMsg}</p>
                    {errorHint && (
                      <p className="text-xs text-rose-600 mt-1 leading-relaxed inline-flex items-start gap-1"><span className="material-symbols-outlined text-sm">lightbulb</span>{errorHint}</p>
                    )}
                  </div>
                  <button
                    onClick={() => { setErrorMsg(null); setErrorHint(null) }}
                    className="text-rose-400 hover:text-rose-600 text-xl flex-shrink-0"
                    aria-label="閉じる"
                  >×</button>
                </div>
              )}
            </div>
          </div>

          {/* ===== RIGHT: Preview Panel (1/3) ===== */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-3xl shadow-lg shadow-slate-200/50 border border-slate-200 p-6 lg:sticky lg:top-24">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <span className="material-symbols-outlined text-xl text-slate-500">search</span>
                <h3 className="text-sm font-bold text-[#0a1530]">抽出プレビュー</h3>
              </div>

              <div className="py-5 text-center border-b border-slate-100">
                <p className="text-xs font-bold text-slate-500 mb-1">最大取得件数</p>
                <p className="text-4xl font-black text-[#0a1530]">{count.toLocaleString()}<span className="text-base font-bold text-slate-500 ml-1">社</span></p>

                {/* 実数推定 */}
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <p className="text-[10px] font-bold text-slate-500">この条件に該当する企業数（推定）</p>
                  {estimateLoading ? (
                    <p className="text-sm font-bold text-slate-400 mt-1">計測中...</p>
                  ) : estimatedCount !== null && estimatedCount > 0 ? (
                    <>
                      <p className={`text-2xl font-black mt-1 ${
                        (estimateIsApprox || estimatedCount >= count) ? 'text-emerald-600' : 'text-amber-600'
                      }`}>
                        {estimateIsApprox ? '約 ' : ''}
                        <CountUp value={estimatedCount} />
                        <span className="text-sm font-bold ml-0.5">社{estimateIsApprox ? '以上' : ''}</span>
                        {estimateIsApprox && <span className="material-symbols-outlined ml-1 animate-bounce inline-block text-xl align-middle">celebration</span>}
                      </p>
                      {!estimateIsApprox && estimatedCount < count && (
                        <p className="text-[10px] text-amber-700 mt-1 font-bold inline-flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">warning</span>該当数が少ないため、実際は{estimatedCount.toLocaleString()}社程度になります
                        </p>
                      )}
                      {estimateNote && (
                        <p className="text-[10px] text-slate-400 mt-1">{estimateNote}</p>
                      )}
                    </>
                  ) : (
                    <p className="text-[10px] text-slate-400 mt-1">推定不可</p>
                  )}
                </div>
              </div>

              <div className="py-4 space-y-2">
                <p className="text-xs font-bold text-slate-700 mb-2 inline-flex items-center gap-1"><span className="material-symbols-outlined text-sm">checklist</span>取得できる情報</p>
                {PREVIEW_FIELDS.map((f) => (
                  <div key={f.label} className="flex items-start gap-2 text-xs text-slate-600">
                    <span className={f.always ? 'text-emerald-500' : 'text-cyan-500'}>{f.always ? '✓' : '◯'}</span>
                    <span className="flex-1">{f.label}</span>
                    {!f.always && <span className="text-[9px] text-slate-400 whitespace-nowrap">登録時のみ</span>}
                  </div>
                ))}
                <p className="text-[10px] text-slate-400 pt-2 mt-2 border-t border-slate-100 leading-relaxed">
                  ※ <span className="font-bold">◯</span>の項目はgBizINFO登録状況によって取得できないことがあります（株式会社未上場の小規模法人など）
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 space-y-2">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="material-symbols-outlined text-base">cell_tower</span><span>gBizINFO（経済産業省）</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="material-symbols-outlined text-base">download</span><span>CSV/Excelダウンロード可</span>
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
                <img src={CHARS.success} alt="" className="w-12 h-12 animate-bounce" />
                <div>
                  <h2 className="text-lg font-bold text-[#0a1530]">
                    <CountUp value={companies.length} duration={1500} />社できました
                    <span className="material-symbols-outlined ml-2 inline-block animate-pulse text-xl align-middle">auto_awesome</span>
                  </h2>
                  <p className="text-xs font-medium text-slate-500">
                    {companies.length < count ? `指定${count.toLocaleString()}社のうち${companies.length}社のみ該当（条件を緩めると増えます）` : `ダウンロードで保存できます`}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={downloadCSV} className="inline-flex items-center gap-1 px-4 py-2.5 bg-[#0a1530] text-white font-bold text-sm rounded-xl shadow hover:bg-[#13234d] active:scale-95 transition-all"><span className="material-symbols-outlined text-base">download</span>CSV</button>
                <button onClick={downloadExcel} className="inline-flex items-center gap-1 px-4 py-2.5 bg-cyan-500 text-white font-bold text-sm rounded-xl shadow hover:bg-cyan-600 active:scale-95 transition-all"><span className="material-symbols-outlined text-base">bar_chart</span>Excel</button>
              </div>
            </div>

            <div className="p-4 border-b border-slate-200 space-y-3">
              <div className="flex gap-2 flex-wrap items-center">
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
              {/* データ有無フィルタ（チップ） */}
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-[11px] font-bold text-slate-500">絞り込み:</span>
                {[
                  { state: filterHasUrl, set: setFilterHasUrl, icon: 'language', label: '公式URLあり', count: companies.filter(c => !!c.website).length },
                  { state: filterHasRep, set: setFilterHasRep, icon: 'person', label: '代表者名あり', count: companies.filter(c => !!c.enrichedData?.representative).length },
                  { state: filterHasEmployees, set: setFilterHasEmployees, icon: 'groups', label: '従業員数あり', count: companies.filter(c => isValidEmployees(c.enrichedData?.employeeCount)).length },
                ].map((f, i) => (
                  <button
                    key={i}
                    onClick={() => { f.set(!f.state); setVisibleCount(PAGE_SIZE) }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                      f.state
                        ? 'bg-cyan-500 text-white border-cyan-500 shadow shadow-cyan-500/20'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-cyan-300 hover:bg-cyan-50'
                    }`}
                  >
                    <span className="inline-flex items-center gap-1"><span className="material-symbols-outlined text-sm">{f.icon}</span>{f.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${f.state ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>{f.count}</span>
                  </button>
                ))}
                {(filterHasUrl || filterHasRep || filterHasEmployees) && (
                  <button
                    onClick={() => { setFilterHasUrl(false); setFilterHasRep(false); setFilterHasEmployees(false); setVisibleCount(PAGE_SIZE) }}
                    className="text-[10px] text-slate-500 hover:text-rose-500 underline"
                  >
                    フィルタ解除
                  </button>
                )}
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {visibleCompanies.map((c, i) => {
                const ed = c.enrichedData || {}
                // gBizINFOの直リンクは仕様変更で機能しないため、Google検索で代替
                // 「{企業名} 法人番号 {番号}」で検索 → 公式サイト・gBizINFO・国税庁等が上位ヒット
                const gbizUrl = ed.corporateNumber
                  ? `https://www.google.com/search?q=${encodeURIComponent(c.name + ' 法人番号 ' + ed.corporateNumber)}`
                  : null
                return (
                  <div key={c.id || i} className="p-5 hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#0a1530] flex items-center justify-center text-white font-bold text-sm shadow">{i + 1}</div>
                      <div className="flex-1 min-w-0 space-y-2">
                        {/* 企業名 + URL登録バッジ */}
                        <div className="flex items-start gap-2 flex-wrap">
                          {gbizUrl ? (
                            <a
                              href={gbizUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group inline-flex items-center gap-1.5"
                              title="Google検索で企業情報を確認"
                            >
                              <h3 className="text-base font-bold text-[#0a1530] group-hover:text-cyan-600 group-hover:underline transition-colors">{c.name}</h3>
                              <span className="material-symbols-outlined text-base text-slate-300 group-hover:text-cyan-500 transition-colors">arrow_outward</span>
                            </a>
                          ) : (
                            <h3 className="text-base font-bold text-[#0a1530]">{c.name}</h3>
                          )}
                          {/* URL登録バッジ */}
                          {c.website ? (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-black rounded-md leading-tight" title="公式URL登録あり">
                              ✓ URL登録
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[9px] font-black rounded-md leading-tight" title="gBizINFOにURL登録なし">
                              URL未登録
                            </span>
                          )}
                          {/* 代表者情報バッジ */}
                          {ed.representative && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-violet-100 text-violet-700 text-[9px] font-black rounded-md leading-tight" title="代表者名登録あり">
                              ✓ 代表者
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                          {isValidIndustry(c.industry) && <InfoRow icon="apartment" label="業種" value={c.industry!} />}
                          {(ed.address || c.region) && <InfoRow icon="location_on" label="所在地" value={ed.address || c.region!} />}
                          {ed.representative && <InfoRow icon="person" label="代表者" value={ed.representative} />}
                          {isValidEmployees(ed.employeeCount) && <InfoRow icon="groups" label="従業員数" value={`${ed.employeeCount} 名`} />}
                          {ed.capital && <InfoRow icon="payments" label="資本金" value={formatCapital(ed.capital)} />}
                          {ed.foundedYear && <InfoRow icon="event" label="設立年" value={`${ed.foundedYear}年`} />}
                        </div>
                        {(ed.businessSummary || c.description) && (
                          <div className="bg-cyan-50/50 border-l-4 border-cyan-400 px-3 py-2 rounded-r-lg">
                            <p className="text-[11px] font-bold text-cyan-700 mb-0.5 inline-flex items-center gap-1"><span className="material-symbols-outlined text-sm">description</span>事業概要</p>
                            <p className="text-sm text-slate-700 leading-relaxed">{ed.businessSummary || c.description}</p>
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {c.website ? (
                            <a href={c.website.startsWith('http') ? c.website : `https://${c.website}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-3 py-1.5 bg-cyan-100 text-cyan-700 text-xs font-bold rounded-lg hover:bg-cyan-200 transition-colors group">
                              <span className="material-symbols-outlined text-sm">language</span>公式サイト
                              <span className="material-symbols-outlined text-sm group-hover:translate-x-0.5 transition-transform">arrow_outward</span>
                            </a>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-50 text-slate-400 text-xs font-bold rounded-lg border border-dashed border-slate-200" title="gBizINFOに公式URLが登録されていません">
                              <span className="material-symbols-outlined text-sm">language</span>登録URLなし
                            </span>
                          )}
                          {gbizUrl && (
                            <a href={gbizUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-200 transition-colors group" title="Google検索で企業情報を調べる">
                              <span className="material-symbols-outlined text-sm">search</span>企業情報を検索
                              <span className="material-symbols-outlined text-sm group-hover:translate-x-0.5 transition-transform">arrow_outward</span>
                            </a>
                          )}
                          {ed.corporateNumber && (
                            <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-50 text-slate-500 text-[11px] font-mono rounded-lg" title="法人番号">
                              #{ed.corporateNumber}
                            </span>
                          )}
                        </div>
                        <div className="pt-2 mt-1 border-t border-slate-100 flex items-center gap-2 text-[10px] text-slate-400">
                          <span className="inline-flex items-center gap-0.5"><span className="material-symbols-outlined text-xs">cell_tower</span>情報ソース:</span>
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

/**
 * 数値をスムーズにカウントアップ表示するコンポーネント
 * - easeOutCubic で最初速く・最後ゆっくりに
 * - 値が変わるたびに前の値からアニメーション
 */
function CountUp({ value, duration = 1200 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    const startValue = display
    const diff = value - startValue
    if (diff === 0) return
    const startTime = performance.now()
    let rafId: number

    const tick = (now: number) => {
      const elapsed = now - startTime
      const t = Math.min(1, elapsed / duration)
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3)
      const current = Math.round(startValue + diff * eased)
      setDisplay(current)
      if (t < 1) {
        rafId = requestAnimationFrame(tick)
      } else {
        setDisplay(value)
      }
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration])
  return <span className="tabular-nums">{display.toLocaleString()}</span>
}

// 業種が表示に適しているか（数値コードや「指定なし」等は除外）
function isValidIndustry(v: string | null | undefined): boolean {
  if (!v) return false
  const s = String(v).trim()
  if (!s || s === '指定なし' || /^\d+$/.test(s)) return false
  return true
}
// 従業員数が実在データかを判定
function isValidEmployees(v: string | number | null | undefined): boolean {
  if (v == null) return false
  const s = String(v).trim()
  if (!s || s === '指定なし') return false
  // 数字が1つでも含まれていればOK
  return /\d/.test(s)
}

// 資本金（円）を万円/百万円/億円表記に整形
function formatCapital(v: string | number): string {
  const n = typeof v === 'number' ? v : parseInt(String(v).replace(/[^\d]/g, ''), 10)
  if (!Number.isFinite(n) || n <= 0) return String(v)
  if (n >= 100000000) return `${(n / 100000000).toLocaleString(undefined, { maximumFractionDigits: 1 })}億円`
  if (n >= 10000) return `${(n / 10000).toLocaleString()}万円`
  return `${n.toLocaleString()}円`
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-start gap-1.5">
      <span className="material-symbols-outlined flex-shrink-0 text-slate-400 text-base">{icon}</span>
      <div className="min-w-0 flex-1">
        <span className="text-slate-400 mr-1">{label}:</span>
        <span className="text-[#0a1530] font-medium">{value}</span>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, options }: { label: ReactNode; value: string; onChange: (v: string) => void; options: readonly string[] }) {
  return (
    <div>
      <label className="block text-sm font-bold text-[#0a1530] mb-2">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm font-medium text-slate-800 bg-white focus:outline-none focus:border-[#0a1530] focus:ring-2 focus:ring-cyan-100 cursor-pointer">
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}
