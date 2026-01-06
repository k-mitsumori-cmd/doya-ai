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
import {
  PartyLoadingOverlay,
  ctaMotion,
  pageMount,
  useConfettiOnComplete,
  usePersonaMotionMode,
} from '@/components/persona/PersonaMotion'
import { LoadingProgress } from '@/components/persona/LoadingProgress'

const LOADING_STEPS = [
  { title: 'サイト解析', desc: '見出し/本文から価値と文脈を抽出', stage: 'サイトを解析しています…', artifact: 'サイト情報' },
  { title: '課題抽出', desc: '悩み/不安/摩擦を言語化', stage: 'ユーザーの悩みを抽出しています…', artifact: '課題リスト' },
  { title: '意思決定推定', desc: '購入条件/反論/稟議を推定', stage: '意思決定パターンを推定中…', artifact: '意思決定モデル' },
  { title: '差別化設計', desc: '競合/強み/訴求軸を整理', stage: '競合と差別化ポイントを特定中…', artifact: '訴求軸' },
  { title: '人物設計', desc: '年齢/職業/生活/価値観を具体化', stage: 'ペルソナ候補を調査中…', artifact: 'ペルソナ' },
  { title: '履歴書生成', desc: '枠線/項目/整形で“履歴書”化', stage: '履歴書レイアウトを組み立てています…', artifact: '履歴書' },
  { title: '生活スケジュール', desc: '1日の行動を時系列で作成', stage: '生活スケジュールを生成しています…', artifact: 'スケジュール' },
  { title: '日記執筆', desc: '生活感ある日記で実在感を増幅', stage: '日記を執筆しています…', artifact: '日記' },
  { title: '広告コピー設計', desc: 'Google/Meta用の文言を生成', stage: '広告コピーを設計しています…', artifact: '広告コピー' },
  { title: '画像生成準備', desc: '日記/スケジュール用の絵を準備', stage: '画像生成の準備をしています…', artifact: '画像' },
] as const

function isQuotaExceeded(e: any): boolean {
  const name = String(e?.name || '')
  const msg = String(e?.message || '')
  return (
    name === 'QuotaExceededError' ||
    name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    msg.toLowerCase().includes('exceeded the quota') ||
    msg.toLowerCase().includes('quota')
  )
}

function safeLocalStorageSet(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value)
    return true
  } catch (e) {
    console.warn('localStorage.setItem failed', key, e)
    return false
  }
}

function safeWritePersonaHistory(history: any[]): void {
  const compacted = compactPersonaHistory(history)
  const tries = [20, 10, 5, 2, 1, 0]
  for (const n of tries) {
    const slice = n === 0 ? [] : compacted.slice(0, n)
    const ok = safeLocalStorageSet('doya_persona_history', JSON.stringify(slice))
    if (ok) return
  }
  // 最後の手段：履歴は諦める（エラーは画面に出さない）
  try {
    localStorage.removeItem('doya_persona_history')
  } catch {}
}

function compactPersonaHistory(raw: any): any[] {
  if (!Array.isArray(raw)) return []
  // 履歴は「テキスト中心」にして容量を守る（画像base64は絶対に保存しない）
  return raw
    .map((h) => {
      if (!h || typeof h !== 'object') return null
      const data = (h as any).data
      const url = String((h as any).url || '')
      const timestamp = Number((h as any).timestamp || Date.now())
      // 万が一入っている画像を削除
      const clean = { ...(h as any) }
      delete (clean as any).portrait
      delete (clean as any).diaryImage
      delete (clean as any).scheduleImages

      // data自体も大きくなり過ぎる場合があるので、最低限の構造だけ残す（互換維持）
      return {
        url,
        timestamp,
        data,
      }
    })
    .filter(Boolean) as any[]
}

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
  dailySchedule?: { time: string; title: string; detail: string; mood?: string; imageCaption?: string; sceneKeywords?: string[] }[]
  diary?: { title: string; body: string; captionText: string; sceneKeywords: string[] }
}

interface GeneratedData {
  analysis?: {
    siteSummary?: string
    keyOffer?: string
    targetHypothesis?: string
    whyThisPersona?: string
    evidence?: string[]
  }
  persona: PersonaData
}

export default function PersonaPage() {
  const motionMode = usePersonaMotionMode()
  const [url, setUrl] = useState('')
  const [serviceName, setServiceName] = useState('')
  const [additionalInfo, setAdditionalInfo] = useState('')
  const [revisionInput, setRevisionInput] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [generatedData, setGeneratedData] = useState<GeneratedData | null>(null)
  const [portraitImage, setPortraitImage] = useState<string | null>(null)
  const [portraitLoading, setPortraitLoading] = useState(false)
  const [diaryImage, setDiaryImage] = useState<string | null>(null)
  const [diaryCaption, setDiaryCaption] = useState<string>('ある日の記録')
  const [diaryLoading, setDiaryLoading] = useState(false)
  const [scheduleImages, setScheduleImages] = useState<Record<number, string>>({})
  const [scheduleImagesLoading, setScheduleImagesLoading] = useState(false)
  const [scheduleImageLoadingMap, setScheduleImageLoadingMap] = useState<Record<number, boolean>>({})
  const [copied, setCopied] = useState<string | null>(null)
  const [stageText, setStageText] = useState<string>('サイトを解析しています…')
  const [stageIdx, setStageIdx] = useState<number>(0)
  const [showFlash, setShowFlash] = useState(false)
  const [regenLoading, setRegenLoading] = useState(false)

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

    // 既に肥大化している履歴を軽量化（画像が混ざっているケースを救済）
    try {
      const historyRaw = JSON.parse(localStorage.getItem('doya_persona_history') || '[]')
      safeWritePersonaHistory(Array.isArray(historyRaw) ? historyRaw : [])
    } catch {}
  }, [])

  // 生成中のド派手演出（テキスト/候補スライド）
  useEffect(() => {
    if (!loading) return
    setShowFlash(true)
    setStageIdx(0)
    const stages = LOADING_STEPS.map((s) => s.stage)
    const t = window.setInterval(() => {
      setStageIdx((v) => {
        const next = (v + 1) % stages.length
        setStageText(stages[next] || stages[0])
        return next
      })
    }, 850)
    return () => window.clearInterval(t)
  }, [loading])

  const overlayProgress = useMemo(() => {
    const base = Math.round(((stageIdx + 1) / Math.max(1, LOADING_STEPS.length)) * 100)
    if (!loading) return 100
    return Math.min(96, Math.max(10, base))
  }, [loading, stageIdx])

  const overlayMood = useMemo(() => {
    if (!loading) return 'idle' as const
    if (overlayProgress < 35) return 'search' as const
    if (overlayProgress < 70) return 'think' as const
    return 'happy' as const
  }, [loading, overlayProgress])

  useConfettiOnComplete({
    enabled: motionMode === 'party',
    when: !loading && Boolean(generatedData),
  })

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
      // NOTE: doya_persona_history には画像を保存しない（容量超過の原因）
      safeLocalStorageSet('doya_persona_last', JSON.stringify(stored))
    } finally {
      setPortraitLoading(false)
    }
  }

  const handleGenerate = async (opts?: { basePersona?: any; revision?: string }) => {
    if (!url.trim()) {
      setError('URLを入力してください')
      return
    }

    setLoading(true)
    setError('')
    setGeneratedData(null)
    setPortraitImage(null)
    setDiaryImage(null)
    setScheduleImages({})

    try {
      const controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), 65_000)
      const res = await fetch('/api/persona/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, serviceName, additionalInfo, basePersona: opts?.basePersona, revision: opts?.revision }),
        signal: controller.signal,
      }).finally(() => window.clearTimeout(timeout))

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
      // 日記/スケジュール画像も自動生成（非同期で進める）
      void autoGenerateDiaryAndScheduleImages(data.data)

      // ローカルストレージに保存
      safeLocalStorageSet('doya_persona_last', JSON.stringify({ data: data.data, url, timestamp: Date.now() }))

      // 履歴に追加
      const history = JSON.parse(localStorage.getItem('doya_persona_history') || '[]')
      const nextHistory = Array.isArray(history) ? history : []
      nextHistory.unshift({ data: data.data, url, timestamp: Date.now() })
      safeWritePersonaHistory(nextHistory)
    } catch (e) {
      const msg =
        e instanceof DOMException && e.name === 'AbortError'
          ? '生成がタイムアウトしました（通信が長時間応答しませんでした）。もう一度お試しください。'
          : e instanceof Error
          ? e.message
          : 'エラーが発生しました'
      setError(msg)
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

  const generateDiaryImageFor = async (args: {
    diaryText: string
    captionText: string
    keywords: string[]
    gender?: string
  }): Promise<string> => {
    const res = await fetch('/api/persona/diary-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...args, size: '1200x628' }),
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
    return data.image
  }

  const generateScheduleImageFor = async (args: {
    title: string
    detail: string
    mood?: string
    captionText?: string
    keywords?: string[]
    gender?: string
  }): Promise<string> => {
    const diaryText = `${args.title}\n${args.detail}${args.mood ? `\n気分: ${args.mood}` : ''}`.trim()
    const captionText = String(args.captionText || args.title || '生活の一コマ').slice(0, 32)
    const keywords = Array.isArray(args.keywords) ? args.keywords.map(String).filter(Boolean).slice(0, 12) : []
    return await generateDiaryImageFor({ diaryText, captionText, keywords, gender: args.gender })
  }

  const generateScheduleImageForIndex = async (idx: number, s: any) => {
    setScheduleImageLoadingMap((prev) => ({ ...prev, [idx]: true }))
    try {
      const img = await generateScheduleImageFor({
        title: s.title,
        detail: s.detail,
        mood: s.mood,
        captionText: s.imageCaption || s.title,
        keywords: s.sceneKeywords || [],
        gender: generatedData?.persona?.gender,
      })
      setScheduleImages((prev) => ({ ...prev, [idx]: img }))
      return img
    } finally {
      setScheduleImageLoadingMap((prev) => ({ ...prev, [idx]: false }))
    }
  }

  const autoGenerateDiaryAndScheduleImages = async (data: GeneratedData) => {
    // 日記は自動生成（1枚）
    const diary = data.persona.diary
    if (diary?.body) {
      setDiaryLoading(true)
      try {
        const img = await generateDiaryImageFor({
          diaryText: diary.body,
          captionText: String(diary.captionText || diaryCaption || 'ある日の記録'),
          keywords: diary.sceneKeywords || [],
          gender: data.persona.gender,
        })
        setDiaryImage(img)
      } catch (e) {
        // 非致命
        console.warn('auto diary image failed', e)
      } finally {
        setDiaryLoading(false)
      }
    }

    // スケジュール画像（全件はコスト大なので優先度高いイベントを自動生成）
    const schedule = Array.isArray(data.persona.dailySchedule) ? data.persona.dailySchedule : []
    if (schedule.length === 0) return

    // 画像は「1日あたり約4枚」に絞る（読みやすさ＆コスト最適化）
    const textOf = (s: any) => `${String(s?.title || '')} ${String(s?.detail || '')}`
    const pickFirst = (re: RegExp, used: Set<number>) => {
      const idx = schedule.findIndex((s, i) => !used.has(i) && re.test(textOf(s)))
      if (idx >= 0) {
        used.add(idx)
        return idx
      }
      return -1
    }
    const used = new Set<number>()
    const priority: RegExp[] = [
      /業務開始|始業|仕事開始|出社/i,
      /会議|商談|提案|打合せ|MTG/i,
      /ランチ|昼食|昼休み|食事/i,
      /作業|分析|制作|運用|資料/i,
      /帰宅|退勤|夕食|夜|子ども|家族/i,
    ]
    const targetIdx: number[] = []
    for (const re of priority) {
      const idx = pickFirst(re, used)
      if (idx >= 0) targetIdx.push(idx)
      if (targetIdx.length >= 4) break
    }
    // 足りなければ前から埋める
    for (let i = 0; i < schedule.length && targetIdx.length < 4; i++) {
      if (!used.has(i)) {
        used.add(i)
        targetIdx.push(i)
      }
    }

    if (targetIdx.length === 0) return
    setScheduleImagesLoading(true)
    try {
      for (const i of targetIdx) {
        const s = schedule[i]
        if (!s) continue
        try {
          await generateScheduleImageForIndex(i, s)
        } catch (e) {
          console.warn('schedule image failed', i, e)
        }
      }
    } finally {
      setScheduleImagesLoading(false)
    }
  }

  const generateDiaryImage = async () => {
    if (!generatedData?.persona?.diary?.body) {
      setError('日記が未生成です（再生成してください）')
      return
    }
    setDiaryLoading(true)
    try {
      const img = await generateDiaryImageFor({
        diaryText: generatedData.persona.diary.body,
        captionText: diaryCaption,
        keywords: generatedData.persona.diary.sceneKeywords || [],
        gender: generatedData.persona.gender,
      })
      setDiaryImage(img)
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
        <div class=\"photo\">${portraitImage ? `<img src=\"${portraitImage}\" style=\"width:100%;height:100%;object-fit:cover;object-position:center;\"/>` : ''}</div>
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

  const downloadPersonaPdf = () => {
    if (!generatedData) return
    // 依存を増やさずPDF対応：印刷（A4）→「PDFとして保存」
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
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>ペルソナ履歴書（PDF） - ${escape(generatedData.persona.name)}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    body{font-family: ui-sans-serif, system-ui, -apple-system, 'Noto Sans JP', sans-serif; background:#fff; }
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
    th,td{border:1px solid #e2e8f0; padding:8px; font-size:12px; vertical-align:top;}
    th{background:#f8fafc; text-align:left;}
    .muted{color:#64748b; font-weight:700; font-size:11px;}
  </style>
</head>
<body>
  <div class="paper">
    <div class="grid">
      <div class="cell">
        <div class="label">ふりがな（仮）</div>
        <div class="name">${escape(generatedData.persona.name)}</div>
        <div style="margin-top:10px; display:grid; grid-template-columns:repeat(3,1fr); gap:8px;">
          <div style="border:1px solid #e2e8f0; background:#f8fafc; padding:10px;"><div class="label">年齢</div><div class="value">${escape(String(generatedData.persona.age))}歳</div></div>
          <div style="border:1px solid #e2e8f0; background:#f8fafc; padding:10px;"><div class="label">性別</div><div class="value">${escape(generatedData.persona.gender)}</div></div>
          <div style="border:1px solid #e2e8f0; background:#f8fafc; padding:10px;"><div class="label">職業</div><div class="value">${escape(generatedData.persona.occupation)}</div></div>
        </div>
        <div style="margin-top:10px; border:1px solid #e2e8f0; padding:10px;"><div class="label">本人の一言</div><div class="value">${escape(generatedData.persona.quote || '')}</div></div>
      </div>
      <div class="cell right">
        <div class="label">写真（AI生成）</div>
        <div class="photo">${portraitImage ? `<img src="${portraitImage}" style="width:100%;height:100%;object-fit:cover;object-position:center;"/>` : ''}</div>
      </div>
    </div>
    <div class="row"><div class="k">現住所</div><div>${escape(generatedData.persona.location)}</div></div>
    <div class="row"><div class="k">家族構成</div><div>${escape(generatedData.persona.familyStructure)}</div></div>
    <div class="row"><div class="k">年収</div><div>${escape(generatedData.persona.income)}</div></div>
    <div class="row"><div class="k">生活</div><div>${escape(generatedData.persona.lifestyle)}</div></div>
    <div class="row"><div class="k">一日</div><div>${escape(generatedData.persona.dayInLife)}</div></div>
    <div class="diary">
      <h2 style="margin:0 0 8px; font-size:16px; font-weight:900;">特徴：こういったスケジュールで1日を送っています</h2>
      <div class="muted">※PDFでは画像は省略しています（画面上で生成した画像はHTML/画像保存をご利用ください）</div>
      <table>
        <thead><tr><th style="width:80px;">時間</th><th>内容</th><th style="width:120px;">気分</th></tr></thead>
        <tbody>
          ${schedule
            .map((s) => `<tr><td>${escape(s.time)}</td><td><b>${escape(s.title)}</b><br/>${escape(s.detail)}</td><td>${escape(s.mood || '')}</td></tr>`)
            .join('')}
        </tbody>
      </table>
      ${diary ? `<h2 style="margin:16px 0 8px; font-size:16px; font-weight:900;">日記：${escape(diary.title)}</h2>
      <p style="white-space:pre-wrap; font-size:13px; color:#0f172a; line-height:1.8;">${escape(diary.body)}</p>` : ''}
      ${diaryImage ? `<h3 style="margin:16px 0 8px; font-size:14px; font-weight:900;">日記イメージ</h3>
      <img class="img" src="${diaryImage}" />` : ''}
    </div>
  </div>
  <script>
    window.onload = function() {
      try { window.focus(); } catch(e) {}
      try { window.print(); } catch(e) {}
    };
  </script>
</body>
</html>`

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const urlObj = URL.createObjectURL(blob)
    const w = window.open(urlObj, '_blank', 'noopener,noreferrer')
    if (!w) {
      setError('ポップアップがブロックされました。ブラウザのポップアップ許可後に再度お試しください。')
      return
    }
    // URLは少し遅らせて解放
    setTimeout(() => URL.revokeObjectURL(urlObj), 30_000)
  }

  const handleRegenerateWithRevision = async () => {
    if (!generatedData?.persona) {
      setError('先にペルソナを生成してください')
      return
    }
    if (!revisionInput.trim()) {
      setError('変更したい内容を入力してください')
      return
    }
    setRegenLoading(true)
    try {
      await handleGenerate({ basePersona: generatedData.persona, revision: revisionInput.trim() })
    } finally {
      setRegenLoading(false)
    }
  }

  const resumeIssueDate = useMemo(() => formatJpDate(new Date()), [])

  const keyScheduleIndices = useMemo(() => {
    const schedule = generatedData?.persona?.dailySchedule || []
    if (!Array.isArray(schedule) || schedule.length === 0) return []
    const textOf = (s: any) => `${String(s?.title || '')} ${String(s?.detail || '')}`
    const used = new Set<number>()
    const picked: number[] = []
    const priority: RegExp[] = [
      /業務開始|始業|仕事開始|出社/i,
      /会議|商談|提案|打合せ|MTG/i,
      /ランチ|昼食|昼休み|食事/i,
      /作業|分析|制作|運用|資料/i,
      /帰宅|退勤|夕食|夜|子ども|家族/i,
    ]
    for (const re of priority) {
      const idx = schedule.findIndex((s, i) => !used.has(i) && re.test(textOf(s)))
      if (idx >= 0) {
        used.add(idx)
        picked.push(idx)
      }
      if (picked.length >= 4) break
    }
    for (let i = 0; i < schedule.length && picked.length < 4; i++) {
      if (!used.has(i)) {
        used.add(i)
        picked.push(i)
      }
    }
    return picked.sort((a, b) => a - b)
  }, [generatedData?.persona?.dailySchedule])

  return (
    <motion.div variants={pageMount} initial="initial" animate="animate" className="min-h-screen bg-slate-50">
      {/* 生成中オーバーレイ（表示層のみ / partyデフォルト） */}
      <PartyLoadingOverlay
        open={showFlash}
        mode={motionMode}
        progress={overlayProgress}
        stageText={stageText || 'ペルソナを調査中…'}
        mood={overlayMood}
        steps={[
          { label: '解析', threshold: 15 },
          { label: '設計', threshold: 45 },
          { label: '履歴書', threshold: 70 },
          { label: '日記', threshold: 90 },
        ]}
      />

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
          <motion.button
            onClick={handleGenerate}
            disabled={loading || !url.trim()}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-base hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-500/25"
            {...ctaMotion(motionMode)}
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
          </motion.button>

          {/* Regenerate Section */}
          {generatedData?.persona && (
            <div className="mt-5 p-4 rounded-xl border border-slate-200 bg-slate-50">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <div className="text-slate-900 font-black text-sm">このペルソナを調整して再生成</div>
                  <div className="text-slate-500 text-xs font-bold mt-1">
                    「ここを変えたい」を書くと、その意図を反映した別人格に作り直します。
                  </div>
                </div>
                <button
                  onClick={() => void handleGenerate()}
                  disabled={loading}
                  className="hidden sm:inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-black hover:bg-slate-100 disabled:opacity-50 px-3 py-2 leading-none"
                  title="同条件で再生成"
                >
                  同条件で再生成
                </button>
              </div>
              <textarea
                value={revisionInput}
                onChange={(e) => setRevisionInput(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 resize-none"
                placeholder="例：業界はSaaS、決裁者は部長。慎重派で導入は稟議が必須。ランチは社食で同僚と情報交換…など"
              />
              <div className="mt-3 flex flex-col sm:flex-row gap-2">
                <motion.button
                  onClick={handleRegenerateWithRevision}
                  disabled={regenLoading || loading}
                  className="h-10 px-4 rounded-lg bg-slate-900 text-white text-sm font-black hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-2"
                  {...ctaMotion(motionMode)}
                >
                  {regenLoading || loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      再生成中…
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      この指示で再生成
                    </>
                  )}
                </motion.button>
                <button
                  onClick={() => setRevisionInput('')}
                  className="h-10 px-4 rounded-lg bg-white border border-slate-200 text-slate-700 text-sm font-black hover:bg-slate-100"
                >
                  入力をクリア
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Results */}
        {generatedData && generatedData.persona && (
          <div className="space-y-6">
            {/* Persona Only (no tabs) */}
            <div className="mx-auto max-w-5xl">
              {/* Site analysis & rationale */}
              {generatedData.analysis && (
                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                  className="mb-4 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
                >
                  <div className="relative px-5 py-4 border-b border-slate-200 bg-gradient-to-r from-purple-600 to-pink-600">
                    <div className="absolute inset-0 opacity-20">
                      <div className="absolute -top-24 -left-24 w-64 h-64 rounded-full bg-white blur-3xl" />
                      <div className="absolute -bottom-24 -right-24 w-64 h-64 rounded-full bg-white blur-3xl" />
                    </div>
                    <div className="relative flex items-center justify-between gap-3">
                      <div>
                        <div className="text-white/90 text-[11px] font-black tracking-wider">SITE INTELLIGENCE</div>
                        <div className="text-white text-lg font-black leading-tight">サイト分析 / なぜこのペルソナ？</div>
                      </div>
                      <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 border border-white/20 text-white text-xs font-black">
                        PERSONA RATIONALE
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="relative mt-3 flex flex-wrap gap-2 text-xs font-bold text-white/90">
                      <span className="px-2 py-1 rounded-lg bg-white/15 border border-white/20">
                        URL: {url || '（未入力）'}
                      </span>
                      {serviceName && (
                        <span className="px-2 py-1 rounded-lg bg-white/15 border border-white/20">
                          サービス名: {serviceName}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="grid md:grid-cols-3 gap-3">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-[10px] font-black text-slate-500 mb-1">要約</div>
                        <div className="text-slate-900 text-sm font-bold leading-relaxed whitespace-pre-wrap">
                          {generatedData.analysis.siteSummary}
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-[10px] font-black text-slate-500 mb-1">価値提案（誰の課題をどう解決）</div>
                        <div className="text-slate-900 text-sm font-bold leading-relaxed whitespace-pre-wrap">
                          {generatedData.analysis.keyOffer}
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-[10px] font-black text-slate-500 mb-1">ターゲット仮説</div>
                        <div className="text-slate-900 text-sm font-bold leading-relaxed whitespace-pre-wrap">
                          {generatedData.analysis.targetHypothesis}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-slate-900 font-black">なぜこのペルソナになったのか</div>
                        <div className="hidden sm:flex items-center gap-2 text-xs font-black text-purple-700">
                          <Sparkles className="w-4 h-4" />
                          EXPLAINED
                        </div>
                      </div>
                      <div className="mt-2 text-slate-800 text-sm font-bold leading-relaxed whitespace-pre-wrap">
                        {generatedData.analysis.whyThisPersona}
                      </div>

                      {Array.isArray(generatedData.analysis.evidence) && generatedData.analysis.evidence.length > 0 && (
                        <div className="mt-3">
                          <div className="text-[10px] font-black text-slate-500 mb-2">根拠（抽出）</div>
                          <div className="flex flex-wrap gap-2">
                            {generatedData.analysis.evidence.slice(0, 8).map((e, idx) => (
                              <span
                                key={idx}
                                className="px-2.5 py-1 rounded-full bg-purple-50 border border-purple-100 text-purple-700 text-xs font-bold"
                              >
                                {e}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

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
                    <button
                      onClick={downloadPersonaPdf}
                      className="h-8 px-3 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-black hover:bg-slate-50"
                      title="印刷用ページを開き、PDFとして保存できます"
                    >
                      PDF
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
                      {/* 履歴書っぽさ強化：上部の情報密度を上げる */}
                      <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                          <div className="text-[10px] font-bold text-slate-500">現住所</div>
                          <div className="text-slate-900 font-black truncate">{generatedData.persona.location}</div>
                        </div>
                        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                          <div className="text-[10px] font-bold text-slate-500">年収</div>
                          <div className="text-slate-900 font-black truncate">{generatedData.persona.income}</div>
                        </div>
                        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                          <div className="text-[10px] font-bold text-slate-500">業界</div>
                          <div className="text-slate-900 font-black truncate">{generatedData.persona.industry || '—'}</div>
                        </div>
                        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                          <div className="text-[10px] font-bold text-slate-500">会社規模</div>
                          <div className="text-slate-900 font-black truncate">{generatedData.persona.companySize || '—'}</div>
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                        <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
                          <div className="text-[10px] font-bold text-slate-500">家族構成</div>
                          <div className="text-slate-900 font-black truncate">{generatedData.persona.familyStructure}</div>
                        </div>
                        <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
                          <div className="text-[10px] font-bold text-slate-500">学歴</div>
                          <div className="text-slate-900 font-black truncate">{generatedData.persona.education || '—'}</div>
                        </div>
                        <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
                          <div className="text-[10px] font-bold text-slate-500">推定生年</div>
                          <div className="text-slate-900 font-black">
                            {generatedData.persona.age ? `${new Date().getFullYear() - generatedData.persona.age}年頃` : '—'}
                          </div>
                        </div>
                        <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
                          <div className="text-[10px] font-bold text-slate-500">デバイス</div>
                          <div className="text-slate-900 font-black truncate">
                            {Array.isArray(generatedData.persona.devices) && generatedData.persona.devices.length > 0
                              ? generatedData.persona.devices.slice(0, 2).join(' / ')
                              : '—'}
                          </div>
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
                          <img src={portraitImage} alt="portrait" className="w-full h-full object-cover object-center" />
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
                      {(generatedData.persona.industry || generatedData.persona.companySize) && (
                        <div className="grid grid-cols-4 border-b border-slate-200">
                          <div className="col-span-1 p-3 text-xs font-black text-slate-700 bg-slate-50 border-r border-slate-200">所属</div>
                          <div className="col-span-3 p-3 text-sm text-slate-900">
                            <span className="font-black">{generatedData.persona.industry || '—'}</span>
                            <span className="text-slate-500 font-bold"> / </span>
                            <span className="font-black">{generatedData.persona.companySize || '—'}</span>
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-4 border-b border-slate-200">
                        <div className="col-span-1 p-3 text-xs font-black text-slate-700 bg-slate-50 border-r border-slate-200">家族構成</div>
                        <div className="col-span-3 p-3 text-sm font-bold text-slate-900">{generatedData.persona.familyStructure}</div>
                      </div>
                      {generatedData.persona.education && (
                        <div className="grid grid-cols-4 border-b border-slate-200">
                          <div className="col-span-1 p-3 text-xs font-black text-slate-700 bg-slate-50 border-r border-slate-200">学歴</div>
                          <div className="col-span-3 p-3 text-sm text-slate-900">{generatedData.persona.education}</div>
                        </div>
                      )}
                      <div className="grid grid-cols-4 border-b border-slate-200">
                        <div className="col-span-1 p-3 text-xs font-black text-slate-700 bg-slate-50 border-r border-slate-200">年収</div>
                        <div className="col-span-3 p-3 text-sm font-bold text-slate-900">{generatedData.persona.income}</div>
                      </div>
                      {Array.isArray(generatedData.persona.devices) && generatedData.persona.devices.length > 0 && (
                        <div className="grid grid-cols-4 border-b border-slate-200">
                          <div className="col-span-1 p-3 text-xs font-black text-slate-700 bg-slate-50 border-r border-slate-200">デバイス</div>
                          <div className="col-span-3 p-3 text-sm text-slate-900">
                            {generatedData.persona.devices.join(' / ')}
                          </div>
                        </div>
                      )}
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
                      {Array.isArray(generatedData.persona.values) && generatedData.persona.values.length > 0 && (
                        <div className="grid grid-cols-4 border-b border-slate-200">
                          <div className="col-span-1 p-3 text-xs font-black text-slate-700 bg-slate-50 border-r border-slate-200">大事なこと</div>
                          <div className="col-span-3 p-3 text-sm text-slate-900">
                            {generatedData.persona.values.join(' / ')}
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-4 border-b border-slate-200">
                        <div className="col-span-1 p-3 text-xs font-black text-slate-700 bg-slate-50 border-r border-slate-200">メディア</div>
                        <div className="col-span-3 p-3 text-sm text-slate-900">
                          {(generatedData.persona.mediaUsage || []).join(' / ') || '—'}
                        </div>
                      </div>
                      {Array.isArray(generatedData.persona.searchKeywords) && generatedData.persona.searchKeywords.length > 0 && (
                        <div className="grid grid-cols-4 border-b border-slate-200">
                          <div className="col-span-1 p-3 text-xs font-black text-slate-700 bg-slate-50 border-r border-slate-200">検索KW</div>
                          <div className="col-span-3 p-3 text-sm text-slate-900">
                            {generatedData.persona.searchKeywords.slice(0, 8).join(' / ')}
                          </div>
                        </div>
                      )}

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
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-slate-900 font-black text-base">特徴：こういったスケジュールで1日を送っています</div>
                        <div className="text-slate-500 text-xs font-bold mt-1">“実在感”を出すため、日常のリズムをそのまま使えます。</div>
                      </div>
                      <button
                        onClick={() => void autoGenerateDiaryAndScheduleImages(generatedData)}
                        disabled={scheduleImagesLoading || diaryLoading}
                        className="h-9 px-3 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-black hover:bg-slate-50 disabled:opacity-50"
                        title="業務開始/ランチ等の優先イベントを中心に画像を自動生成します"
                      >
                        {scheduleImagesLoading || diaryLoading ? '自動生成中…' : '画像を自動生成'}
                      </button>
                    </div>
                  </div>

                  <div className="p-5">
                    {/* ドキュメント風：1日の流れ（画像は約4枚だけ） */}
                    <div>
                        <div className="prose prose-slate max-w-none">
                          <p className="text-slate-700 text-base font-bold leading-relaxed">
                            {generatedData.persona.dayInLife}
                          </p>
                        </div>

                        <div className="mt-5 space-y-4">
                          {(generatedData.persona.dailySchedule || []).slice(0, 18).map((s, i) => {
                            const showImg = keyScheduleIndices.includes(i)
                            return (
                              <div key={i} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                                <div className="p-5">
                                  <div className={`grid gap-4 ${showImg ? 'md:grid-cols-12' : ''}`}>
                                    <div className={showImg ? 'md:col-span-5' : ''}>
                                      <div className="flex items-baseline gap-3 flex-wrap">
                                        <span className="px-3 py-1 rounded-lg bg-slate-100 text-slate-900 text-sm font-black">
                                          {s.time}
                                        </span>
                                        <span className="text-slate-900 text-lg font-black">{s.title}</span>
                                        {s.mood ? (
                                          <span className="text-slate-500 text-sm font-bold">気分：{s.mood}</span>
                                        ) : null}
                                      </div>
                                      <div className="mt-3 text-slate-800 text-base leading-relaxed whitespace-pre-wrap">
                                        {s.detail}
                                      </div>
                                    </div>

                                    {showImg && (
                                      <div className="md:col-span-7">
                                        <div className="text-slate-900 text-sm font-black mb-2">このシーンのイメージ</div>
                                        <div className="aspect-[1200/628] rounded-2xl overflow-hidden border border-slate-200 bg-white flex items-center justify-center">
                                          {scheduleImages[i] ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={scheduleImages[i]} alt={`${s.title}`} className="w-full h-full object-cover" />
                                          ) : scheduleImageLoadingMap[i] || scheduleImagesLoading ? (
                                            <div className="w-full h-full flex items-center justify-center bg-slate-50">
                                              <LoadingProgress label="スケジュール画像を生成しています" />
                                            </div>
                                          ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-slate-50">
                                              <div className="text-center">
                                                <div className="text-slate-900 font-black text-sm">このシーンは画像化します（全体で約4枚）</div>
                                                <div className="text-slate-500 text-xs font-bold mt-1">必要な重要シーンだけを抜粋しています。</div>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                        <div className="mt-3 flex gap-2">
                                          <button
                                            onClick={() =>
                                              void (async () => {
                                                try {
                                                  await generateScheduleImageForIndex(i, s)
                                                } catch (e) {
                                                  setError(e instanceof Error ? e.message : 'スケジュール画像生成エラー')
                                                }
                                              })()
                                            }
                                            disabled={!!scheduleImageLoadingMap[i]}
                                            className="h-10 px-4 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-black hover:bg-slate-100 disabled:opacity-50"
                                          >
                                            {scheduleImageLoadingMap[i] ? '生成中…' : scheduleImages[i] ? '再生成' : '画像を生成'}
                                          </button>
                                          {scheduleImages[i] ? (
                                            <button
                                              onClick={() =>
                                                downloadImage(scheduleImages[i], `schedule-${i + 1}-${generatedData.persona.name}.png`)
                                              }
                                              className="h-10 px-4 rounded-xl bg-slate-900 text-white text-sm font-black hover:bg-slate-800"
                                            >
                                              画像を保存
                                            </button>
                                          ) : (
                                            <button
                                              disabled
                                              className="h-10 px-4 rounded-xl bg-slate-200 text-slate-500 text-sm font-black"
                                            >
                                              画像を保存
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                    </div>

                    {generatedData.persona.diary && (
                      <div className="mt-6">
                        {/* ノート/手紙っぽい日記 */}
                        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                          <div className="px-5 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
                            <div className="text-slate-900 font-black">日記：{generatedData.persona.diary.title}</div>
                            <div className="text-slate-500 text-xs font-bold mt-1">“手書きノート”っぽく、生活感が出るように表示しています。</div>
                          </div>

                          <div className="p-5">
                            <div
                              className="relative rounded-2xl border border-slate-200 overflow-hidden"
                              style={{
                                background:
                                  'repeating-linear-gradient(to bottom, #ffffff 0px, #ffffff 26px, #eef2ff 27px, #ffffff 28px)',
                              }}
                            >
                              {/* 余白 */}
                              <div className="px-6 py-6">
                                <p
                                  className="text-slate-900 leading-[2.05] whitespace-pre-wrap text-lg"
                                  style={{
                                    fontFamily:
                                      "'Hannotate SC','YuKyokasho','YuKyokasho Yoko','Hiragino Maru Gothic ProN','Hiragino Sans','Segoe Print','Bradley Hand','Comic Sans MS',ui-sans-serif,system-ui",
                                  }}
                                >
                                  {generatedData.persona.diary.body}
                                </p>
                              </div>
                            </div>

                            {/* 日記イメージ（縦に伸ばす） */}
                            <div className="mt-5">
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div>
                                  <div className="text-slate-900 font-black">日記イメージ</div>
                                  <div className="text-slate-500 text-xs font-bold mt-1">日記内容に合わせた画像を自動生成します。</div>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={generateDiaryImage}
                                    disabled={diaryLoading}
                                    className="h-10 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-black disabled:opacity-50"
                                  >
                                    {diaryLoading ? '生成中…' : '画像を生成'}
                                  </button>
                                  {diaryImage ? (
                                    <button
                                      onClick={() => downloadImage(diaryImage, `diary-${generatedData.persona.name}.png`)}
                                      className="h-10 px-4 rounded-xl bg-slate-900 text-white text-sm font-black hover:bg-slate-800"
                                    >
                                      画像保存
                                    </button>
                                  ) : (
                                    <button
                                      disabled
                                      className="h-10 px-4 rounded-xl bg-slate-200 text-slate-500 text-sm font-black"
                                    >
                                      画像保存
                                    </button>
                                  )}
                                </div>
                              </div>

                              <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden">
                                <div className="aspect-[1200/628] flex items-center justify-center">
                                  {diaryImage ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={diaryImage} alt="diary" className="w-full h-full object-cover" />
                                  ) : diaryLoading ? (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <LoadingProgress label="日記イメージを生成しています" />
                                    </div>
                                  ) : (
                                    <div className="text-slate-400 text-sm font-bold">まだ生成されていません</div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          </div>
        )}
      </div>
    </motion.div>
  )
}
