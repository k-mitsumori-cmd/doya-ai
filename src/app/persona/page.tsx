'use client'

import { useMemo, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  Image as ImageIcon,
  FileText,
  Download,
  Clipboard,
  ChevronRight,
  ChevronDown,
  Target,
  Check,
} from 'lucide-react'

// 演出用：候補ペルソナ（ダミー）
const LOADING_CANDIDATES = [
  { name: '佐藤 まどか', age: 29, role: 'EC運用担当', note: '価格比較→即決タイプ' },
  { name: '鈴木 恒一', age: 41, role: '情報システム部', note: '稟議・セキュリティ重視' },
  { name: '高橋 さくら', age: 33, role: 'マーケ責任者', note: 'CVR改善・運用重視' },
  { name: '田中 健', age: 27, role: '個人事業主', note: 'スピード・コスパ重視' },
  { name: '伊藤 恒一', age: 38, role: '営業Mgr', note: '導入事例・実績で判断' },
  { name: '渡辺 由衣', age: 45, role: '人事責任者', note: '採用・ブランド重視' },
] as const

function formatJpDate(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}年${mm}月${dd}日`
}

function GoogleGMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M21.35 11.1H12v2.98h5.38c-.54 3.05-3.12 4.38-5.38 4.38a6.2 6.2 0 1 1 0-12.4c1.76 0 2.95.72 3.62 1.34l2.02-1.96C16.4 4.31 14.46 3.5 12 3.5A8.5 8.5 0 1 0 12 20.5c4.88 0 8.2-3.43 8.2-8.26 0-.55-.07-1.01-.15-1.14z"
        fill="#4285F4"
      />
      <path d="M3.55 8.66l2.45 1.8A6.2 6.2 0 0 1 12 6.06c1.76 0 2.95.72 3.62 1.34l2.02-1.96C16.4 4.31 14.46 3.5 12 3.5A8.48 8.48 0 0 0 3.55 8.66z" fill="#EA4335" opacity=".0" />
      <path d="M12 20.5c2.33 0 4.28-.77 5.7-2.09l-2.26-1.86c-.63.43-1.48.72-3.44.72a6.2 6.2 0 0 1-5.86-4.3l-2.52 1.94A8.5 8.5 0 0 0 12 20.5z" fill="#34A853" opacity=".0" />
      <path d="M6.14 12.97A6.2 6.2 0 0 1 5.8 11c0-.68.12-1.34.34-1.97L3.56 7.23A8.48 8.48 0 0 0 3.5 11c0 1.37.33 2.67.92 3.77l1.72-1.8z" fill="#FBBC05" opacity=".0" />
    </svg>
  )
}

function MetaMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M12 6.3c-2.2 0-3.7 2.1-4.9 4.4-1.2 2.3-2 4.7-2 6.1 0 1.2.7 1.9 1.6 1.9 1.2 0 2.2-1.2 3.6-3.8.6-1.1 1.1-2.1 1.7-3.1.6 1 1.1 2 1.7 3.1 1.4 2.6 2.4 3.8 3.6 3.8.9 0 1.6-.7 1.6-1.9 0-1.4-.8-3.8-2-6.1C15.7 8.4 14.2 6.3 12 6.3zm0 2.2c.9 0 2 1.5 3 3.4 1 2 1.7 4.1 1.7 4.9 0 .2 0 .4-.2.4-.2 0-.6-.3-1.3-1.4-.6-.9-1.3-2.2-2-3.6-.4-.8-.8-1.6-1.2-2.3-.4.7-.8 1.5-1.2 2.3-.7 1.4-1.4 2.7-2 3.6-.7 1.1-1.1 1.4-1.3 1.4-.2 0-.2-.2-.2-.4 0-.8.7-2.9 1.7-4.9 1-1.9 2.1-3.4 3-3.4z"
        fill="currentColor"
      />
    </svg>
  )
}

// バナーサイズオプション
const BANNER_SIZES = [
  { key: 'google-responsive', label: 'Google レスポンシブ (1200×628)', width: 1200, height: 628 },
  { key: 'google-square', label: 'Google スクエア (1200×1200)', width: 1200, height: 1200 },
  { key: 'meta-feed', label: 'Meta フィード (1080×1080)', width: 1080, height: 1080 },
  { key: 'meta-story', label: 'Meta ストーリー (1080×1920)', width: 1080, height: 1920 },
  { key: 'twitter', label: 'Twitter/X (1200×675)', width: 1200, height: 675 },
  { key: 'youtube', label: 'YouTube サムネイル (1280×720)', width: 1280, height: 720 },
]

interface PersonaData {
  name: string
  age: number
  gender: string
  occupation: string
  industry?: string
  companySize?: string
  income: string
  location: string
  familyStructure: string
  education?: string
  lifestyle: string
  devices?: string[]
  challenges: string[]
  goals: string[]
  values?: string[]
  mediaUsage: string[]
  searchKeywords?: string[]
  purchaseMotivation: string[]
  objections: string[]
  objectionHandling?: string[]
  personalityTraits: string[]
  dayInLife: string
  quote: string
  dailySchedule?: { time: string; title: string; detail: string; mood?: string }[]
  diary?: { title: string; body: string; captionText: string; sceneKeywords: string[] }
}

interface CreativesData {
  topCatchphrases?: { rank: 1 | 2 | 3; text: string; reason: string }[]
  catchphrases: string[]
  lpStructure: {
    hero: string
    problem: string
    solution: string
    benefits: string[]
    cta: string
  }
  adCopy: {
    google: string[]
    meta: string[]
  }
  emailDraft: {
    subject: string
    body: string
  }
}

interface GeneratedData {
  persona: PersonaData
  creatives: CreativesData
}

export default function PersonaPage() {
  const [url, setUrl] = useState('')
  const [serviceName, setServiceName] = useState('')
  const [additionalInfo, setAdditionalInfo] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [generatedData, setGeneratedData] = useState<GeneratedData | null>(null)
  const [portraitImage, setPortraitImage] = useState<string | null>(null)
  const [portraitLoading, setPortraitLoading] = useState(false)
  const [bannerImage, setBannerImage] = useState<string | null>(null)
  const [bannerLoading, setBannerLoading] = useState(false)
  const [diaryImage, setDiaryImage] = useState<string | null>(null)
  const [diaryCaption, setDiaryCaption] = useState<string>('ある日の記録')
  const [diaryLoading, setDiaryLoading] = useState(false)
  const [selectedBannerSize, setSelectedBannerSize] = useState(BANNER_SIZES[0].key)
  const [selectedCatchphrase, setSelectedCatchphrase] = useState('')
  const [activeTab, setActiveTab] = useState<'persona' | 'creatives'>('persona')
  const [copied, setCopied] = useState<string | null>(null)
  const [stageText, setStageText] = useState<string>('サイトを解析しています…')
  const [stageIdx, setStageIdx] = useState<number>(0)
  const [showFlash, setShowFlash] = useState(false)

  // ローカルストレージから履歴読み込み
  useEffect(() => {
    const stored = localStorage.getItem('doya_persona_last')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (parsed.data) {
          setGeneratedData(parsed.data)
          setPortraitImage(parsed.portrait || null)
        }
      } catch {}
    }
  }, [])

  // 生成中のド派手演出（テキスト/候補スライド）
  useEffect(() => {
    if (!loading) return
    setShowFlash(true)
    setStageIdx(0)
    const stages = [
      'サイトを解析しています…',
      'ユーザーの悩みを抽出しています…',
      '意思決定パターンを推定中…',
      '競合と差別化ポイントを特定中…',
      'ペルソナ候補をスキャン中…',
      '売れるコピーの筋を作っています…',
    ]
    const t = window.setInterval(() => {
      setStageIdx((v) => (v + 1) % stages.length)
      setStageText((prev) => stages[(stages.indexOf(prev) + 1 + stages.length) % stages.length] || stages[0])
    }, 850)
    return () => window.clearInterval(t)
  }, [loading])

  const generatePortraitForPersona = async (persona: any) => {
    setPortraitLoading(true)
    try {
      const res = await fetch('/api/persona/portrait', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona }),
      })
      const raw = await res.text()
      let data: any = null
      try {
        data = raw ? JSON.parse(raw) : null
      } catch {
        data = null
      }
      if (!res.ok || !data?.success || !data?.image) {
        throw new Error((data && (data.error || data.message)) || 'ポートレート生成に失敗しました')
      }
      setPortraitImage(data.image)

      // ローカルストレージ更新（最新）
      const stored = JSON.parse(localStorage.getItem('doya_persona_last') || '{}')
      stored.portrait = data.image
      localStorage.setItem('doya_persona_last', JSON.stringify(stored))

      // 履歴の先頭にもportraitを反映（存在すれば）
      const history = JSON.parse(localStorage.getItem('doya_persona_history') || '[]')
      if (Array.isArray(history) && history.length > 0) {
        history[0] = { ...history[0], portrait: data.image }
        localStorage.setItem('doya_persona_history', JSON.stringify(history))
      }
    } finally {
      setPortraitLoading(false)
    }
  }

  const handleGenerate = async () => {
    if (!url.trim()) {
      setError('URLを入力してください')
      return
    }

    setLoading(true)
    setError('')
    setGeneratedData(null)
    setPortraitImage(null)
    setBannerImage(null)

    try {
      const res = await fetch('/api/persona/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, serviceName, additionalInfo }),
      })

      // NOTE: APIがHTMLや途中切れJSONを返した場合でも、ここで落とさずにメッセージ化する
      const raw = await res.text()
      let data: any = null
      try {
        data = raw ? JSON.parse(raw) : null
      } catch {
        data = null
      }

      if (!res.ok) {
        const msg =
          (data && (data.error || data.message)) ||
          (raw && raw.slice(0, 200)) ||
          'ペルソナ生成に失敗しました'
        throw new Error(msg)
      }

      if (!data?.data || !data?.data?.persona) {
        throw new Error('ペルソナデータの取得に失敗しました')
      }

      setGeneratedData(data.data)
      setDiaryImage(null)
      const cap = String(data?.data?.persona?.diary?.captionText || '').trim()
      setDiaryCaption(cap || 'ある日の記録')
      // 生成と同時にポートレートも自動生成
      try {
        await generatePortraitForPersona(data.data.persona)
      } catch (e) {
        // ポートレート失敗は致命ではない（UI上は再生成ボタンで復旧できる）
        setError(e instanceof Error ? e.message : 'ポートレート生成エラー')
      }

      // ローカルストレージに保存
      localStorage.setItem('doya_persona_last', JSON.stringify({ data: data.data, url, timestamp: Date.now() }))

      // 履歴に追加
      const history = JSON.parse(localStorage.getItem('doya_persona_history') || '[]')
      history.unshift({ data: data.data, url, timestamp: Date.now() })
      localStorage.setItem('doya_persona_history', JSON.stringify(history.slice(0, 20)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラーが発生しました')
    } finally {
      setLoading(false)
      setTimeout(() => setShowFlash(false), 250)
    }
  }

  const handleGeneratePortrait = async () => {
    if (!generatedData?.persona) return

    try {
      await generatePortraitForPersona(generatedData.persona)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ポートレート生成エラー')
    }
  }

  const handleGenerateBanner = async () => {
    if (!generatedData?.persona || !selectedCatchphrase) {
      setError('キャッチコピーを選択してください')
      return
    }

    setBannerLoading(true)
    try {
      const res = await fetch('/api/persona/banner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          persona: generatedData.persona,
          serviceName,
          catchphrase: selectedCatchphrase,
          sizeKey: selectedBannerSize,
        }),
      })

      const data = await res.json()
      if (data.success && data.image) {
        setBannerImage(data.image)
      } else {
        throw new Error(data.error || 'バナー生成失敗')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'バナー生成エラー')
    } finally {
      setBannerLoading(false)
    }
  }

  const generateBannerFromText = async (text: string) => {
    if (!generatedData?.persona) return
    setSelectedCatchphrase(text)
    setBannerLoading(true)
    setBannerImage(null)
    try {
      const res = await fetch('/api/persona/banner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          persona: generatedData.persona,
          serviceName,
          catchphrase: text,
          sizeKey: selectedBannerSize,
        }),
      })
      const raw = await res.text()
      let data: any = null
      try {
        data = raw ? JSON.parse(raw) : null
      } catch {
        data = null
      }
      if (!res.ok || !data?.success || !data?.image) {
        throw new Error((data && (data.error || data.message)) || 'バナー生成失敗')
      }
      setBannerImage(data.image)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'バナー生成エラー')
    } finally {
      setBannerLoading(false)
    }
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const downloadImage = (dataUrl: string, filename: string) => {
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = filename
    link.click()
  }

  const generateDiaryImage = async () => {
    if (!generatedData?.persona?.diary?.body) {
      setError('日記が未生成です（再生成してください）')
      return
    }
    setDiaryLoading(true)
    try {
      const res = await fetch('/api/persona/diary-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          diaryText: generatedData.persona.diary.body,
          captionText: diaryCaption,
          keywords: generatedData.persona.diary.sceneKeywords || [],
          size: '1200x628',
        }),
      })
      const raw = await res.text()
      let data: any = null
      try {
        data = raw ? JSON.parse(raw) : null
      } catch {
        data = null
      }
      if (!res.ok || !data?.success || !data?.image) {
        throw new Error((data && (data.error || data.message)) || '日記イメージ生成に失敗しました')
      }
      setDiaryImage(data.image)
    } catch (e) {
      setError(e instanceof Error ? e.message : '日記イメージ生成エラー')
    } finally {
      setDiaryLoading(false)
    }
  }

  const downloadPersonaJson = () => {
    if (!generatedData) return
    const payload = {
      generatedAt: new Date().toISOString(),
      url,
      serviceName,
      persona: generatedData.persona,
      creatives: generatedData.creatives,
      portraitImage,
      diaryImage,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `persona-${generatedData.persona.name}-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const downloadPersonaHtml = () => {
    if (!generatedData) return
    const escape = (s: string) =>
      String(s || '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;')

    const schedule = Array.isArray(generatedData.persona.dailySchedule) ? generatedData.persona.dailySchedule : []
    const diary = generatedData.persona.diary
    const html = `<!doctype html>
<html lang=\"ja\">
<head>
  <meta charset=\"utf-8\" />
  <meta name=\"viewport\" content=\"width=device-width,initial-scale=1\" />
  <title>ペルソナ履歴書 - ${escape(generatedData.persona.name)}</title>
  <style>
    body{font-family: ui-sans-serif, system-ui, -apple-system, 'Noto Sans JP', sans-serif; background:#f8fafc; padding:24px;}
    .paper{max-width:980px; margin:0 auto; background:#fff; border:2px solid #0f172a;}
    .grid{display:grid; grid-template-columns:3fr 1fr;}
    .cell{padding:16px; border-bottom:1px solid #0f172a;}
    .right{border-left:1px solid #0f172a;}
    .photo{aspect-ratio:3/4; border:2px solid #0f172a; background:#fff; overflow:hidden;}
    .label{font-size:11px; font-weight:800; color:#475569;}
    .value{font-size:14px; font-weight:700; color:#0f172a;}
    .name{font-size:28px; font-weight:900; letter-spacing:0.02em;}
    .row{display:grid; grid-template-columns:120px 1fr; border-top:1px solid #e2e8f0;}
    .row > div{padding:10px 12px;}
    .row .k{background:#f8fafc; font-weight:800; color:#334155; border-right:1px solid #e2e8f0;}
    .diary{border-top:1px solid #0f172a; padding:16px;}
    .img{max-width:100%; border:1px solid #e2e8f0; border-radius:10px;}
    table{width:100%; border-collapse:collapse; margin-top:8px;}
    th,td{border:1px solid #e2e8f0; padding:8px; font-size:12px;}
    th{background:#f8fafc; text-align:left;}
  </style>
</head>
<body>
  <div class=\"paper\">
    <div class=\"grid\">
      <div class=\"cell\">
        <div class=\"label\">ふりがな（仮）</div>
        <div class=\"name\">${escape(generatedData.persona.name)}</div>
        <div style=\"margin-top:10px; display:grid; grid-template-columns:repeat(3,1fr); gap:8px;\">
          <div style=\"border:1px solid #e2e8f0; background:#f8fafc; padding:10px;\"><div class=\"label\">年齢</div><div class=\"value\">${escape(String(generatedData.persona.age))}歳</div></div>
          <div style=\"border:1px solid #e2e8f0; background:#f8fafc; padding:10px;\"><div class=\"label\">性別</div><div class=\"value\">${escape(generatedData.persona.gender)}</div></div>
          <div style=\"border:1px solid #e2e8f0; background:#f8fafc; padding:10px;\"><div class=\"label\">職業</div><div class=\"value\">${escape(generatedData.persona.occupation)}</div></div>
        </div>
        <div style=\"margin-top:10px; border:1px solid #e2e8f0; padding:10px;\"><div class=\"label\">本人の一言</div><div class=\"value\">${escape(generatedData.persona.quote || '')}</div></div>
      </div>
      <div class=\"cell right\">
        <div class=\"label\">写真（AI生成）</div>
        <div class=\"photo\">${portraitImage ? `<img src=\"${portraitImage}\" style=\"width:100%;height:100%;object-fit:cover;\"/>` : ''}</div>
      </div>
    </div>

    <div class=\"row\"><div class=\"k\">現住所</div><div>${escape(generatedData.persona.location)}</div></div>
    <div class=\"row\"><div class=\"k\">家族構成</div><div>${escape(generatedData.persona.familyStructure)}</div></div>
    <div class=\"row\"><div class=\"k\">年収</div><div>${escape(generatedData.persona.income)}</div></div>
    <div class=\"row\"><div class=\"k\">生活</div><div>${escape(generatedData.persona.lifestyle)}</div></div>
    <div class=\"row\"><div class=\"k\">一日</div><div>${escape(generatedData.persona.dayInLife)}</div></div>

    <div class=\"diary\">
      <h2 style=\"margin:0 0 8px; font-size:16px; font-weight:900;\">特徴：日々の生活（1日のスケジュール）</h2>
      <table>
        <thead><tr><th style=\"width:80px;\">時間</th><th>内容</th><th style=\"width:120px;\">気分</th></tr></thead>
        <tbody>
          ${schedule.map((s) => `<tr><td>${escape(s.time)}</td><td><b>${escape(s.title)}</b><br/>${escape(s.detail)}</td><td>${escape(s.mood || '')}</td></tr>`).join('')}
        </tbody>
      </table>

      ${diary ? `<h2 style=\"margin:16px 0 8px; font-size:16px; font-weight:900;\">日記：${escape(diary.title)}</h2>
      <p style=\"white-space:pre-wrap; font-size:13px; color:#0f172a; line-height:1.8;\">${escape(diary.body)}</p>` : ''}

      ${diaryImage ? `<h3 style=\"margin:16px 0 8px; font-size:14px; font-weight:900;\">日記イメージ</h3>
      <img class=\"img\" src=\"${diaryImage}\" />` : ''}
    </div>
  </div>
</body>
</html>`

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `persona-${generatedData.persona.name}-${Date.now()}.html`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const resumeIssueDate = useMemo(() => formatJpDate(new Date()), [])

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ド派手：生成中オーバーレイ */}
      <AnimatePresence>
        {showFlash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm"
          >
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute -top-40 -left-40 w-[520px] h-[520px] rounded-full bg-purple-500/30 blur-3xl" />
              <div className="absolute -bottom-40 -right-40 w-[520px] h-[520px] rounded-full bg-pink-500/30 blur-3xl" />
            </div>

            <div className="relative h-full flex flex-col items-center justify-center px-4">
              <motion.div
                initial={{ y: 12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="w-full max-w-3xl"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-white">
                    <Sparkles className="w-4 h-4" />
                    <span className="text-xs font-black tracking-widest">PERSONA SCAN</span>
                  </div>
                  <div className="text-white/80 text-xs font-bold">いま、めちゃくちゃペルソナを検索しています…</div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 md:p-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
                      <Target className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-black text-lg leading-tight">ペルソナ生成中</p>
                      <p className="text-white/70 text-sm font-bold truncate">{stageText}</p>
                    </div>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  </div>

                  {/* progress */}
                  <div className="mt-4 h-2 rounded-full bg-white/10 overflow-hidden">
                    <motion.div
                      className="h-2 bg-gradient-to-r from-purple-400 to-pink-400"
                      initial={{ width: '12%' }}
                      animate={{ width: ['12%', '92%', '28%', '100%'] }}
                      transition={{ duration: 2.6, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }}
                    />
                  </div>

                  {/* sliding candidates */}
                  <div className="mt-5 overflow-hidden">
                    <motion.div
                      className="flex gap-3"
                      animate={{ x: ['0%', '-50%'] }}
                      transition={{ duration: 6.5, repeat: Infinity, ease: 'linear' }}
                    >
                      {[...LOADING_CANDIDATES, ...LOADING_CANDIDATES].map((c, idx) => (
                        <div
                          key={`${c.name}-${idx}`}
                          className="w-[240px] flex-shrink-0 rounded-xl border border-white/15 bg-white/10 p-3"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center text-white/80 font-black">
                              {c.name.slice(0, 1)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-white font-black truncate">{c.name}</p>
                              <p className="text-white/70 text-xs font-bold">{c.age}歳 / {c.role}</p>
                              <p className="text-white/60 text-[11px] font-bold mt-1 truncate">「{c.note}」</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  </div>

                  {/* popup-like hints */}
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-2">
                    {[
                      'LPの勝ち筋を推定中…',
                      '広告クリック心理を逆算中…',
                      '刺さる言葉のトーンを調整中…',
                    ].map((t, i) => (
                      <motion.div
                        key={t}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: [0.4, 1, 0.6], y: [6, 0, 4] }}
                        transition={{ duration: 1.8, delay: i * 0.2, repeat: Infinity, repeatType: 'mirror' }}
                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white/80 text-xs font-bold"
                      >
                        {t}
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-6xl mx-auto p-4 lg:p-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl lg:text-3xl font-black text-slate-900 mb-1 flex items-center gap-3">
            <Target className="w-8 h-8 text-purple-400" />
            ドヤペルソナAI
          </h1>
          <p className="text-slate-600 text-sm">URLからマーケティングペルソナを自動生成</p>
        </div>

        {/* Input Section */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6 shadow-sm">
          {/* URL Input - Primary */}
          <div className="mb-4">
            <label className="block text-sm font-bold text-slate-900 mb-2">
              サイトURL <span className="text-purple-400">*</span>
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 text-base"
            />
          </div>

          {/* Advanced Settings Toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors mb-4"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
            詳細設定（任意）
          </button>

          {/* Advanced Settings */}
          <AnimatePresence>
            {showAdvanced && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-4 pb-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      サービス名（任意）
                    </label>
                    <input
                      type="text"
                      value={serviceName}
                      onChange={(e) => setServiceName(e.target.value)}
                      placeholder="例: ドヤマーケ"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      追加情報（任意）
                    </label>
                    <textarea
                      value={additionalInfo}
                      onChange={(e) => setAdditionalInfo(e.target.value)}
                      placeholder="ターゲット層や商品の特徴など、補足情報があれば入力してください"
                      rows={3}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 resize-none"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={loading || !url.trim()}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-base hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-500/25"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                ペルソナを生成
              </>
            )}
          </button>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Results */}
        {generatedData && (
          <div className="space-y-6">
            {/* Tabs */}
            <div className="flex gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
              {[
                { key: 'persona', label: 'ペルソナ', icon: Target },
                { key: 'creatives', label: 'クリエイティブ', icon: Sparkles },
              ].map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as any)}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm transition-all ${
                      activeTab === tab.key
                        ? 'bg-purple-600 text-white shadow-lg'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                )
              })}
            </div>

            {/* Persona Tab */}
            {activeTab === 'persona' && generatedData.persona && (
              <div className="mx-auto max-w-5xl">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="text-slate-700 text-sm font-black">履歴書（ペルソナ）</div>
                    <span className="hidden sm:inline text-slate-400 text-xs font-bold">/ ダウンロード可能</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-slate-500 text-xs font-bold">作成日：{resumeIssueDate}</div>
                    <button
                      onClick={downloadPersonaJson}
                      className="h-8 px-3 rounded-lg bg-slate-900 text-white text-xs font-black hover:bg-slate-800"
                      title="JSONでダウンロード"
                    >
                      JSON
                    </button>
                    <button
                      onClick={downloadPersonaHtml}
                      className="h-8 px-3 rounded-lg bg-purple-600 text-white text-xs font-black hover:bg-purple-500"
                      title="HTMLでダウンロード（画像も埋め込み）"
                    >
                      HTML
                    </button>
                  </div>
                </div>

                {/* 履歴書風：A4っぽい枠線 */}
                <div className="bg-white border-2 border-slate-800">
                  {/* Header row */}
                  <div className="grid grid-cols-12 border-b border-slate-800">
                    <div className="col-span-9 p-4 border-r border-slate-800">
                      <div className="text-sm font-black text-slate-900">ふりがな（仮）</div>
                      <div className="mt-1 text-2xl font-black text-slate-900 tracking-wide">{generatedData.persona.name}</div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                          <div className="text-[10px] font-bold text-slate-500">年齢</div>
                          <div className="text-slate-900 font-black">{generatedData.persona.age}歳</div>
                        </div>
                        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                          <div className="text-[10px] font-bold text-slate-500">性別</div>
                          <div className="text-slate-900 font-black">{generatedData.persona.gender}</div>
                        </div>
                        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                          <div className="text-[10px] font-bold text-slate-500">職業</div>
                          <div className="text-slate-900 font-black truncate">{generatedData.persona.occupation}</div>
                        </div>
                      </div>
                      {generatedData.persona.quote ? (
                        <div className="mt-3 rounded-md border border-slate-200 bg-white px-3 py-2">
                          <div className="text-[10px] font-bold text-slate-500">本人の一言（口癖）</div>
                          <div className="text-slate-900 font-bold">「{generatedData.persona.quote}」</div>
                        </div>
                      ) : null}
                    </div>

                    {/* Photo cell */}
                    <div className="col-span-3 p-4">
                      <div className="text-[10px] font-black text-slate-500">写真（AI生成）</div>
                      <div className="mt-2 aspect-[3/4] border-2 border-slate-800 bg-white overflow-hidden flex items-center justify-center">
                        {portraitImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={portraitImage} alt="portrait" className="w-full h-full object-cover" />
                        ) : (
                          <div className="text-slate-400 text-xs font-bold">生成中…</div>
                        )}
                      </div>
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={handleGeneratePortrait}
                          disabled={portraitLoading}
                          className="flex-1 h-9 rounded-lg bg-slate-900 text-white text-xs font-black hover:bg-slate-800 disabled:opacity-50"
                        >
                          {portraitLoading ? '生成中…' : '再生成'}
                        </button>
                        {portraitImage ? (
                          <button
                            onClick={() => downloadImage(portraitImage, `persona-${generatedData.persona.name}.png`)}
                            className="flex-1 h-9 rounded-lg bg-purple-600 text-white text-xs font-black hover:bg-purple-500"
                          >
                            保存
                          </button>
                        ) : (
                          <button
                            disabled
                            className="flex-1 h-9 rounded-lg bg-slate-200 text-slate-500 text-xs font-black"
                          >
                            保存
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Body grid: resume-like rows */}
                  <div className="grid grid-cols-12">
                    {/* left column */}
                    <div className="col-span-6 border-r border-slate-800">
                      <div className="grid grid-cols-4 border-b border-slate-200">
                        <div className="col-span-1 p-3 text-xs font-black text-slate-700 bg-slate-50 border-r border-slate-200">現住所</div>
                        <div className="col-span-3 p-3 text-sm font-bold text-slate-900">{generatedData.persona.location}</div>
                      </div>
                      <div className="grid grid-cols-4 border-b border-slate-200">
                        <div className="col-span-1 p-3 text-xs font-black text-slate-700 bg-slate-50 border-r border-slate-200">家族構成</div>
                        <div className="col-span-3 p-3 text-sm font-bold text-slate-900">{generatedData.persona.familyStructure}</div>
                      </div>
                      <div className="grid grid-cols-4 border-b border-slate-200">
                        <div className="col-span-1 p-3 text-xs font-black text-slate-700 bg-slate-50 border-r border-slate-200">年収</div>
                        <div className="col-span-3 p-3 text-sm font-bold text-slate-900">{generatedData.persona.income}</div>
                      </div>
                      <div className="grid grid-cols-4 border-b border-slate-200">
                        <div className="col-span-1 p-3 text-xs font-black text-slate-700 bg-slate-50 border-r border-slate-200">生活</div>
                        <div className="col-span-3 p-3 text-sm text-slate-900">{generatedData.persona.lifestyle}</div>
                      </div>
                      <div className="grid grid-cols-4 border-b border-slate-200">
                        <div className="col-span-1 p-3 text-xs font-black text-slate-700 bg-slate-50 border-r border-slate-200">一日</div>
                        <div className="col-span-3 p-3 text-sm text-slate-900">{generatedData.persona.dayInLife}</div>
                      </div>
                    </div>

                    {/* right column */}
                    <div className="col-span-6">
                      <div className="grid grid-cols-4 border-b border-slate-200">
                        <div className="col-span-1 p-3 text-xs font-black text-slate-700 bg-slate-50 border-r border-slate-200">性格</div>
                        <div className="col-span-3 p-3 text-sm text-slate-900">
                          {(generatedData.persona.personalityTraits || []).join(' / ') || '—'}
                        </div>
                      </div>
                      <div className="grid grid-cols-4 border-b border-slate-200">
                        <div className="col-span-1 p-3 text-xs font-black text-slate-700 bg-slate-50 border-r border-slate-200">メディア</div>
                        <div className="col-span-3 p-3 text-sm text-slate-900">
                          {(generatedData.persona.mediaUsage || []).join(' / ') || '—'}
                        </div>
                      </div>

                      <div className="p-4 border-b border-slate-200">
                        <div className="text-xs font-black text-slate-700 mb-2">課題・悩み（重要）</div>
                        <div className="grid gap-2">
                          {(generatedData.persona.challenges || []).slice(0, 6).map((c, i) => (
                            <div key={i} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900">
                              {c}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="p-4">
                        <div className="text-xs font-black text-slate-700 mb-2">目標・願望（刺さる未来）</div>
                        <div className="grid gap-2">
                          {(generatedData.persona.goals || []).slice(0, 6).map((g, i) => (
                            <div key={i} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900">
                              {g}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 履歴書の下：特徴（スケジュール＋日記＋日記イメージ） */}
                <div className="mt-6 bg-white border border-slate-200 rounded-xl shadow-sm">
                  <div className="px-5 py-4 border-b border-slate-200">
                    <div className="text-slate-900 font-black text-base">特徴：日々の生活（1日のスケジュール）</div>
                    <div className="text-slate-500 text-xs font-bold mt-1">“実在感”を出すため、日常のリズムをそのまま使えます。</div>
                  </div>

                  <div className="p-5">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-slate-50">
                            <th className="text-left text-xs font-black text-slate-700 border border-slate-200 px-3 py-2 w-[92px]">時間</th>
                            <th className="text-left text-xs font-black text-slate-700 border border-slate-200 px-3 py-2">内容</th>
                            <th className="text-left text-xs font-black text-slate-700 border border-slate-200 px-3 py-2 w-[140px]">気分</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(generatedData.persona.dailySchedule || []).slice(0, 18).map((s, i) => (
                            <tr key={i} className="align-top">
                              <td className="border border-slate-200 px-3 py-2 text-xs font-black text-slate-900">{s.time}</td>
                              <td className="border border-slate-200 px-3 py-2">
                                <div className="text-sm font-black text-slate-900">{s.title}</div>
                                <div className="text-sm text-slate-700 mt-1">{s.detail}</div>
                              </td>
                              <td className="border border-slate-200 px-3 py-2 text-sm text-slate-700">{s.mood || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {generatedData.persona.diary && (
                      <div className="mt-6 grid lg:grid-cols-2 gap-4">
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                          <div className="text-slate-900 font-black">日記：{generatedData.persona.diary.title}</div>
                          <p className="mt-2 text-slate-800 text-sm leading-relaxed whitespace-pre-wrap">
                            {generatedData.persona.diary.body}
                          </p>
                          <div className="mt-4">
                            <div className="text-xs font-black text-slate-700 mb-1">画像に入れるテキスト（編集OK）</div>
                            <input
                              value={diaryCaption}
                              onChange={(e) => setDiaryCaption(e.target.value)}
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                              placeholder="例：今日も、ちゃんと頑張った。"
                            />
                            <div className="mt-3 flex gap-2">
                              <button
                                onClick={generateDiaryImage}
                                disabled={diaryLoading}
                                className="h-10 px-4 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-black disabled:opacity-50"
                              >
                                {diaryLoading ? '日記イメージ生成中…' : '日記イメージを生成（Nano Banana Pro）'}
                              </button>
                              {diaryImage ? (
                                <button
                                  onClick={() => downloadImage(diaryImage, `diary-${generatedData.persona.name}.png`)}
                                  className="h-10 px-4 rounded-lg bg-slate-900 text-white text-sm font-black hover:bg-slate-800"
                                >
                                  画像保存
                                </button>
                              ) : (
                                <button disabled className="h-10 px-4 rounded-lg bg-slate-200 text-slate-500 text-sm font-black">
                                  画像保存
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-xl p-4">
                          <div className="text-slate-900 font-black">日記イメージ</div>
                          <div className="mt-3 aspect-[1200/628] rounded-xl border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center">
                            {diaryImage ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={diaryImage} alt="diary" className="w-full h-full object-cover" />
                            ) : (
                              <div className="text-slate-400 text-sm font-bold">まだ生成されていません</div>
                            )}
                          </div>
                          <div className="mt-3 text-xs text-slate-500 font-bold">
                            ※「日記イメージを生成」を押すと、日記内容に合わせた画像を作り、テキストも入れます。
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Creatives Tab */}
            {activeTab === 'creatives' && generatedData.creatives && (
              <div className="space-y-6">
                {/* TOP3 */}
                {Array.isArray(generatedData.creatives.topCatchphrases) && generatedData.creatives.topCatchphrases.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <div className="text-slate-900 text-lg font-black">おすすめキャッチコピー TOP3</div>
                        <div className="text-slate-500 text-xs font-bold mt-1">
                          「このコピー、こんなに素晴らしい」まで理由つきで出します（クリックで即バナー生成）。
                        </div>
                      </div>
                      <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-50 border border-purple-100 text-purple-700 text-xs font-black">
                        <Sparkles className="w-4 h-4" />
                        TOP PICKS
                      </div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-3">
                      {generatedData.creatives.topCatchphrases.slice(0, 3).map((t) => (
                        <button
                          key={t.rank}
                          onClick={() => void generateBannerFromText(t.text)}
                          className="text-left rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 hover:border-purple-200 hover:shadow-lg transition-all p-4"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="inline-flex items-center gap-2">
                              <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 text-white font-black flex items-center justify-center">
                                {t.rank}
                              </span>
                              <span className="text-xs font-black text-slate-600">おすすめ</span>
                            </div>
                            <ChevronRight className="w-4 h-4 text-purple-400" />
                          </div>
                          <div className="text-slate-900 text-lg font-black leading-snug">{t.text}</div>
                          <div className="mt-3 text-slate-600 text-xs font-bold leading-relaxed">
                            {t.reason}
                          </div>
                          <div className="mt-3 inline-flex items-center gap-2 text-xs font-black text-purple-700">
                            <ImageIcon className="w-4 h-4" />
                            これでバナー生成
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Catchphrases with Banner Generation */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                  <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                    ✨ キャッチコピー候補
                    <span className="text-xs text-slate-500 font-normal">（クリックで選択 → バナー生成）</span>
                  </h3>
                  <div className="space-y-2 mb-5">
                    {generatedData.creatives.catchphrases?.map((c, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          if (!bannerLoading) void generateBannerFromText(c)
                        }}
                        className={`w-full text-left p-3 rounded-lg border transition-all flex items-center justify-between ${
                          selectedCatchphrase === c
                            ? 'bg-purple-50 border-purple-200 text-purple-800'
                            : 'bg-white border-slate-200 text-slate-900 hover:border-slate-300'
                        }`}
                      >
                        <span className="font-medium text-sm">{c}</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); copyToClipboard(c, `catch-${i}`) }}
                            className="p-1 hover:bg-slate-100 rounded"
                            title="コピー"
                          >
                            {copied === `catch-${i}` ? <Check className="w-4 h-4 text-green-400" /> : <Clipboard className="w-4 h-4" />}
                          </button>
                          {selectedCatchphrase === c && <ChevronRight className="w-4 h-4 text-purple-400" />}
                        </div>
                      </button>
                    ))}
                  </div>

                  {selectedCatchphrase && (
                    <div className="border-t border-slate-200 pt-5">
                      <h4 className="text-sm font-bold text-slate-900 mb-3">🎨 バナー画像生成</h4>
                      <div className="flex flex-wrap gap-3 mb-4">
                        <select
                          value={selectedBannerSize}
                          onChange={(e) => setSelectedBannerSize(e.target.value)}
                          className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                        >
                          {BANNER_SIZES.map((size) => (
                            <option key={size.key} value={size.key}>{size.label}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => void generateBannerFromText(selectedCatchphrase)}
                          disabled={bannerLoading}
                          className="px-5 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-bold hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 flex items-center gap-2"
                        >
                          {bannerLoading ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              生成中...
                            </>
                          ) : (
                            <>
                              <ImageIcon className="w-4 h-4" />
                              バナー生成
                            </>
                          )}
                        </button>
                      </div>

                      {bannerImage && (
                        <div className="mt-4">
                          <img src={bannerImage} alt="Generated Banner" className="max-w-full h-auto rounded-lg border border-slate-200" />
                          <button
                            onClick={() => downloadImage(bannerImage, `banner-${selectedBannerSize}.png`)}
                            className="mt-3 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 flex items-center gap-2 text-sm font-bold"
                          >
                            <Download className="w-4 h-4" />
                            ダウンロード
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* LP Structure */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                  <h3 className="text-base font-bold text-slate-900 mb-4">📄 LP構成案</h3>
                  <div className="space-y-3">
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 border-l-4 border-purple-500">
                      <p className="text-xs text-purple-400 font-bold mb-1">ヒーローセクション</p>
                      <p className="text-slate-900 text-sm">{generatedData.creatives.lpStructure?.hero}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 border-l-4 border-red-500">
                      <p className="text-xs text-red-400 font-bold mb-1">課題提起</p>
                      <p className="text-slate-900 text-sm">{generatedData.creatives.lpStructure?.problem}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 border-l-4 border-green-500">
                      <p className="text-xs text-green-400 font-bold mb-1">解決策</p>
                      <p className="text-slate-900 text-sm">{generatedData.creatives.lpStructure?.solution}</p>
                    </div>
                    {generatedData.creatives.lpStructure?.benefits && (
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <p className="text-xs text-blue-700 font-bold mb-2">ベネフィット</p>
                        <ul className="space-y-1">
                          {generatedData.creatives.lpStructure.benefits.map((b, i) => (
                            <li key={i} className="text-slate-700 text-sm">✓ {b}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {generatedData.creatives.lpStructure?.cta && (
                      <div className="p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg text-center border border-purple-100">
                        <p className="text-xs text-slate-500 mb-1">CTA</p>
                        <p className="text-lg font-bold text-slate-900">{generatedData.creatives.lpStructure.cta}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Ad Copy */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center">
                          <GoogleGMark className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-slate-900 font-black">Google 検索広告</div>
                          <div className="text-slate-500 text-xs font-bold">“公式っぽい”見た目で、そのまま運用に落とせます</div>
                        </div>
                      </div>
                      <span className="text-xs font-black text-slate-500">ADS</span>
                    </div>
                    <div className="space-y-2">
                      {generatedData.creatives.adCopy?.google?.map((ad, i) => (
                        <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-100 group">
                          <p className="text-slate-800 text-sm font-bold">{ad}</p>
                          <div className="mt-2 flex items-center gap-3">
                            <button
                              onClick={() => copyToClipboard(ad, `google-${i}`)}
                              className="text-xs text-slate-500 hover:text-purple-700 flex items-center gap-1 font-bold"
                            >
                              {copied === `google-${i}` ? <Check className="w-3 h-3 text-green-400" /> : <Clipboard className="w-3 h-3" />}
                              コピー
                            </button>
                            <button
                              onClick={() => void generateBannerFromText(ad)}
                              disabled={bannerLoading}
                              className="text-xs font-black text-purple-700 hover:text-purple-800 flex items-center gap-1"
                            >
                              <ImageIcon className="w-3 h-3" />
                              この広告文でバナー生成
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                          <MetaMark className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-slate-900 font-black">Meta / SNS広告</div>
                          <div className="text-slate-500 text-xs font-bold">スクロールを止める一言に寄せます</div>
                        </div>
                      </div>
                      <span className="text-xs font-black text-slate-500">META</span>
                    </div>
                    <div className="space-y-2">
                      {generatedData.creatives.adCopy?.meta?.map((ad, i) => (
                        <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <p className="text-slate-800 text-sm font-bold">{ad}</p>
                          <div className="mt-2 flex items-center gap-3">
                            <button
                              onClick={() => copyToClipboard(ad, `meta-${i}`)}
                              className="text-xs text-slate-500 hover:text-purple-700 flex items-center gap-1 font-bold"
                            >
                              {copied === `meta-${i}` ? <Check className="w-3 h-3 text-green-400" /> : <Clipboard className="w-3 h-3" />}
                              コピー
                            </button>
                            <button
                              onClick={() => void generateBannerFromText(ad)}
                              disabled={bannerLoading}
                              className="text-xs font-black text-purple-700 hover:text-purple-800 flex items-center gap-1"
                            >
                              <ImageIcon className="w-3 h-3" />
                              この広告文でバナー生成
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  )
}
