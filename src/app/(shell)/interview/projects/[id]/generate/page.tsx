'use client'

import { useState, useEffect, useRef, ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { readArticleInput, ArticleInputError } from '@/lib/interview/article-input-client'
import { SUPPORT_CONTACT_URL } from '@/lib/pricing'
import { ArticleStreamError, readArticleGeneration } from '@/lib/interview/article-stream-client'
import { getArticleActorScope, readArticleOperation, ArticleProtocolError, type ArticleIntentScope, type ArticleOperationView } from '@/lib/interview/article-operation-client'
import { readArticleIntent, claimArticleIntent, clearArticleIntent, type ArticleIntent } from '@/lib/interview/article-intent-client'

function articleFailureGuidance(error: unknown): string {
  return error instanceof ArticleStreamError || error instanceof ArticleProtocolError || error instanceof ArticleInputError
    ? error.message : '処理状況を確認できません。新しく生成せず、結果を再確認してください。'
}

// ── Inline formatting ──
function renderInline(text: string): ReactNode {
  const parts = text.split(/(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g)
  return parts.map((part, i) => {
    if (part.startsWith('***') && part.endsWith('***'))
      return <strong key={i} className="font-bold italic text-slate-900">{part.slice(3, -3)}</strong>
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2)
      return <em key={i} className="italic">{part.slice(1, -1)}</em>
    if (part.startsWith('`') && part.endsWith('`'))
      return <code key={i} className="px-1.5 py-0.5 bg-blue-50 rounded text-sm text-blue-700 font-mono">{part.slice(1, -1)}</code>
    return part
  })
}

// ── Rich Markdown Renderer ──
function renderRichContent(rawText: string): ReactNode[] {
  // Strip wrapping code fence if present
  let text = rawText
  if (text.trimStart().startsWith('```markdown')) {
    text = text.trimStart().slice('```markdown'.length)
    const lastFence = text.lastIndexOf('```')
    if (lastFence > 0) text = text.slice(0, lastFence)
  } else if (text.trimStart().startsWith('```')) {
    const first = text.indexOf('\n')
    if (first > -1) {
      text = text.slice(first + 1)
      const lastFence = text.lastIndexOf('```')
      if (lastFence > 0) text = text.slice(0, lastFence)
    }
  }

  const lines = text.split('\n')
  const elements: ReactNode[] = []
  let i = 0
  let firstH1 = true

  while (i < lines.length) {
    const line = lines[i]

    // Code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      if (i < lines.length) i++
      elements.push(
        <pre key={elements.length} className="bg-slate-900 text-slate-100 rounded-xl p-5 my-5 overflow-x-auto text-sm font-mono leading-relaxed">
          {lang && <div className="text-xs text-slate-400 mb-2 uppercase tracking-wider">{lang}</div>}
          <code>{codeLines.join('\n')}</code>
        </pre>
      )
      continue
    }

    // H1
    if (line.startsWith('# ')) {
      const content = line.slice(2)
      if (firstH1) {
        firstH1 = false
        elements.push(
          <h1 key={elements.length} className="text-3xl md:text-4xl font-extrabold leading-tight mb-6 mt-2">
            <span className="bg-gradient-to-r from-blue-900 via-blue-700 to-blue-500 bg-clip-text text-transparent">
              {content}
            </span>
          </h1>
        )
      } else {
        elements.push(
          <h1 key={elements.length} className="text-2xl md:text-3xl font-extrabold text-blue-900 mt-10 mb-4">{renderInline(content)}</h1>
        )
      }
      i++; continue
    }

    // H2
    if (line.startsWith('## ')) {
      elements.push(
        <div key={elements.length} className="mt-10 mb-4">
          <h2 className="text-xl md:text-2xl font-bold text-blue-900 pb-3 border-b-2 border-blue-100 flex items-center gap-2">
            <span className="w-1 h-6 bg-gradient-to-b from-blue-500 to-blue-300 rounded-full flex-shrink-0" />
            {renderInline(line.slice(3))}
          </h2>
        </div>
      )
      i++; continue
    }

    // H3
    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={elements.length} className="text-lg font-bold text-blue-800 mt-6 mb-3 pl-3 border-l-[3px] border-blue-300">
          {renderInline(line.slice(4))}
        </h3>
      )
      i++; continue
    }

    // H4
    if (line.startsWith('#### ')) {
      elements.push(
        <h4 key={elements.length} className="text-base font-bold text-slate-800 mt-4 mb-2">{renderInline(line.slice(5))}</h4>
      )
      i++; continue
    }

    // Blockquote
    if (line.startsWith('> ')) {
      const quoteLines: string[] = [line.slice(2)]
      i++
      while (i < lines.length && lines[i].startsWith('> ')) {
        quoteLines.push(lines[i].slice(2))
        i++
      }
      elements.push(
        <blockquote key={elements.length} className="border-l-4 border-blue-300 bg-gradient-to-r from-blue-50/80 to-transparent pl-5 py-4 my-5 rounded-r-lg">
          {quoteLines.map((ql, qi) => (
            <p key={qi} className="text-slate-600 italic leading-relaxed mb-1 last:mb-0">{renderInline(ql)}</p>
          ))}
        </blockquote>
      )
      continue
    }

    // Unordered list
    if (line.match(/^[\-\*] /)) {
      const items: string[] = [line.replace(/^[\-\*] /, '')]
      i++
      while (i < lines.length && lines[i].match(/^[\-\*] /)) {
        items.push(lines[i].replace(/^[\-\*] /, ''))
        i++
      }
      elements.push(
        <ul key={elements.length} className="my-4 space-y-2.5 pl-1">
          {items.map((item, ii) => (
            <li key={ii} className="flex items-start gap-3 text-slate-700">
              <span className="mt-[9px] w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
              <span className="leading-relaxed">{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      )
      continue
    }

    // Ordered list
    if (line.match(/^\d+[\.\)] /)) {
      const items: string[] = [line.replace(/^\d+[\.\)] /, '')]
      i++
      while (i < lines.length && lines[i].match(/^\d+[\.\)] /)) {
        items.push(lines[i].replace(/^\d+[\.\)] /, ''))
        i++
      }
      elements.push(
        <ol key={elements.length} className="my-4 space-y-2.5 pl-1">
          {items.map((item, ii) => (
            <li key={ii} className="flex items-start gap-3 text-slate-700">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-blue-100 to-blue-50 text-blue-600 text-xs font-bold flex items-center justify-center mt-0.5 ring-1 ring-blue-200/50">
                {ii + 1}
              </span>
              <span className="leading-relaxed">{renderInline(item)}</span>
            </li>
          ))}
        </ol>
      )
      continue
    }

    // Horizontal rule
    if (line.match(/^[-*_]{3,}$/)) {
      elements.push(
        <div key={elements.length} className="my-8 flex items-center gap-4">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-blue-200 to-transparent" />
          <div className="w-1.5 h-1.5 rounded-full bg-blue-200" />
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-blue-200 to-transparent" />
        </div>
      )
      i++; continue
    }

    // Empty line
    if (line.trim() === '') { i++; continue }

    // Regular paragraph
    elements.push(
      <p key={elements.length} className="text-[15px] text-slate-700 leading-[1.85] mb-4">{renderInline(line)}</p>
    )
    i++
  }
  return elements
}

// ── Confetti ──
function CelebrationConfetti() {
  const colors = ['#3b82f6', '#60a5fa', '#2563eb', '#1e40af', '#93c5fd', '#f59e0b', '#10b981', '#8b5cf6']
  return (
    <div className="fixed inset-0 pointer-events-none z-[60] overflow-hidden">
      {Array.from({ length: 40 }).map((_, i) => {
        const left = Math.random() * 100
        const delay = Math.random() * 0.8
        const duration = 2.5 + Math.random() * 2
        const size = 4 + Math.random() * 8
        const rotation = Math.random() * 720
        const xDrift = (Math.random() - 0.5) * 300
        return (
          <motion.div
            key={i}
            className="absolute rounded-sm"
            style={{
              backgroundColor: colors[i % colors.length],
              left: `${left}%`,
              top: -20,
              width: size,
              height: size,
            }}
            initial={{ y: -20, x: 0, rotate: 0, opacity: 1 }}
            animate={{ y: '100vh', x: xDrift, rotate: rotation, opacity: 0 }}
            transition={{ duration, delay, ease: 'easeOut' }}
          />
        )
      })}
    </div>
  )
}

// ── Animated Circular Gauge ──
function ScoreGauge({ score, size = 160, strokeWidth = 14 }: { score: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - score / 100)
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : '#ef4444'
  const label = score >= 80 ? '素晴らしい！' : score >= 60 ? '良い仕上がり' : '改善の余地あり'

  return (
    <div className="relative flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={strokeWidth} />
          <motion.circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.8, ease: [0.34, 1.56, 0.64, 1] }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className="text-5xl font-black"
            style={{ color }}
            initial={{ opacity: 0, scale: 0.3 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1, duration: 0.6, type: 'spring', stiffness: 200, damping: 12 }}
          >
            {score}
          </motion.span>
          <motion.span
            className="text-sm text-slate-500 font-medium"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.4 }}
          >
            点
          </motion.span>
        </div>
      </div>
      <motion.p
        className="text-sm font-bold mt-3"
        style={{ color }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.6 }}
      >
        {label}
      </motion.p>
    </div>
  )
}


export default function GeneratePage() {
  const { data: session, status: authStatus } = useSession()
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = params.id as string
  const recipeId = searchParams.get('recipeId') || ''
  const displayFormat = searchParams.get('displayFormat') || 'MONOLOGUE'
  const selectionId = searchParams.get('selectionId') || ''
  const legacyInstructions = searchParams.has('instructions')
  const inputRequired = legacyInstructions || searchParams.get('inputRequired') === '1'

  // Remove legacy private query values while retaining an explicit re-selection requirement.
  useEffect(() => {
    if (legacyInstructions) {
      const query = new URLSearchParams({ recipeId, displayFormat, inputRequired: '1' })
      router.replace(`/interview/projects/${projectId}/generate?${query}`)
    }
  }, [legacyInstructions, recipeId, displayFormat, projectId, router])

  // recipeId が未指定の場合はスキル選択ページへリダイレクト
  useEffect(() => {
    if (!recipeId) {
      router.replace(`/interview/projects/${projectId}/skill`)
    }
  }, [recipeId, projectId, router])

  const [status, setStatus] = useState<'idle' | 'generating' | 'done' | 'error'>('idle')
  const [progress, setProgress] = useState('')
  const [generatedText, setGeneratedText] = useState('')
  const [draftId, setDraftId] = useState<string | null>(null)
  const [wordCount, setWordCount] = useState(0)
  const [error, setError] = useState('')
  const [limitAction, setLimitAction] = useState<'pricing' | 'contact' | null>(null)
  const [providerConfigurationError, setProviderConfigurationError] = useState(false)
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)
  const [showCelebration, setShowCelebration] = useState(false)
  const [proofScore, setProofScore] = useState<number | null>(null)
  const [proofScoreLoading, setProofScoreLoading] = useState(false)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const inFlightRef = useRef(false)
  const activeRef = useRef(false)
  const [recovery, setRecovery] = useState<{ scope: ArticleIntentScope; intent: ArticleIntent; view: ArticleOperationView | null } | null>(null)
  const recoveryRef = useRef<typeof recovery>(null)
  const [storageRevision, setStorageRevision] = useState(0)
  const [operationBusy, setOperationBusy] = useState(false)
  const cancelRef = useRef(false)
  const contextKey = JSON.stringify([storageRevision, authStatus, session?.user?.id || null, projectId, recipeId, displayFormat, selectionId, inputRequired])
  const contextRef = useRef(contextKey)
  contextRef.current = contextKey

  useEffect(() => {
    activeRef.current = true
    return () => {
      activeRef.current = false
      abortRef.current?.abort()
      abortRef.current = null
      inFlightRef.current = false
    }
  }, [contextKey])

  useEffect(() => {
    const changed = (event: StorageEvent) => {
      const entry = recoveryRef.current
      if (!entry) return
      const key = 'interview-article-intent:v1:' + entry.scope.actorScope + ':' + encodeURIComponent(entry.scope.projectId)
      if (event.key === null || event.key === key) setStorageRevision(value => value + 1)
    }
    window.addEventListener('storage', changed)
    return () => window.removeEventListener('storage', changed)
  }, [])

  // Auto-scroll
  useEffect(() => {
    if (contentRef.current && status === 'generating') {
      contentRef.current.scrollTop = contentRef.current.scrollHeight
    }
  }, [generatedText, status])

  const remember = (value: typeof recovery) => { recoveryRef.current = value; setRecovery(value) }
  const applyOperation = (view: ArticleOperationView) => {
    const current = recoveryRef.current
    if (!current || current.intent.operationId !== view.operationId || current.scope.actorScope !== view.actorScope) return
    remember({ ...current, view })
    setLimitAction(null)
    if (view.state === 'completed' && view.result) {
      setDraftId(view.result.draftId); setWordCount(view.result.wordCount); setStatus('done'); setError('')
      setProgress('保存済みの記事を確認しました。エディタから記事を開けます。')
    } else if (view.state === 'failed') {
      setStatus('error')
      setError(view.code === 'ARTICLE_LIMIT' ? `本日の記事生成上限（${view.limit}回）に達しました。` : '前の生成は完了しませんでした。保存済みの記事を確認してから、新しい生成を開始できます。')
      setLimitAction(view.code === 'ARTICLE_LIMIT' ? view.contactUrl === SUPPORT_CONTACT_URL ? 'contact' : view.upgradePath === '/interview/pricing' ? 'pricing' : null : null)
    } else {
      setStatus('idle'); setError('')
      setProgress(view.state === 'cancelled' ? '前の生成は取り消されました。'
        : view.state === 'cancelling' ? '取消処理中です。元の処理が停止するまで新しい生成は開始できません。'
        : view.state === 'missing' ? '保存結果はまだ確認できません。新しく生成せず、結果を再確認するか、この処理を取り消してください。'
        : '前の記事生成を処理中です。結果を再確認してください。')
    }
  }
  const owns = (controller: AbortController, key: string) => activeRef.current && contextRef.current === key && abortRef.current === controller && !controller.signal.aborted
  const sameIntent = (scope: ArticleIntentScope, intent: ArticleIntent) => {
    try { return readArticleIntent(scope)?.operationId === intent.operationId } catch { return false }
  }
  const selectedInstructions = (scope: ArticleIntentScope) => {
    if (inputRequired) throw new ArticleInputError()
    return selectionId ? readArticleInput(scope, selectionId, recipeId, displayFormat) : ''
  }
  const startGeneration = async () => {
    if (inFlightRef.current || !activeRef.current || authStatus === 'loading') return
    if (!recipeId) { setError('スキルを選択してください。'); setStatus('error'); return }
    inFlightRef.current = true; setOperationBusy(true)
    abortRef.current?.abort()
    const controller = new AbortController(); abortRef.current = controller
    const current = () => owns(controller, contextKey)
    try {
      const scope = await getArticleActorScope(projectId, controller.signal)
      if (!current()) return
      const customInstructions = selectedInstructions(scope)
      const { intent, created } = await claimArticleIntent(scope, controller.signal)
      if (!current()) return
      remember({ scope, intent, view: null })
      const canApply = () => current() && sameIntent(scope, intent)
      if (!created) {
        const view = await readArticleOperation(scope, intent.operationId, 'GET', controller.signal)
        if (canApply()) applyOperation(view)
        return
      }
      setStatus('generating'); setGeneratedText(''); setError(''); setLimitAction(null)
      setProviderConfigurationError(false); setProgress('接続中...'); setThumbnailUrl(null)
      setShowCelebration(false); setProofScore(null); setProofScoreLoading(false)
      await readArticleGeneration({ projectId, recipeId, displayFormat, customInstructions: customInstructions || undefined, operationId: intent.operationId, actorScope: scope.actorScope }, controller.signal, event => {
        if (!canApply()) return
        switch (event.type) {
          case 'operation': applyOperation(event.operation); break
          case 'progress': setProgress(event.step); break
          case 'chunk': setGeneratedText(prev => prev + event.text); break
          case 'error':
            setError(event.message); setStatus('error')
            setProviderConfigurationError(event.code === 'ARTICLE_PROVIDER_CONFIGURATION')
            break
          case 'done': {
            const eid = event.draftId
            applyOperation({ operationId: intent.operationId, actorScope: scope.actorScope, state: 'completed', result: { draftId: eid, wordCount: event.wordCount, version: event.version }, code: null, limit: null })
            setShowCelebration(true)
            // Only a fresh, acknowledged generation runs these follow-ups.
            // Restoring an existing receipt never invokes either AI endpoint.
            fetch(`/api/interview/projects/${projectId}/thumbnail`, { method: 'POST', signal: controller.signal })
              .then(r => r.ok ? r.json() : null)
              .then(data => { if (canApply() && data?.success && typeof data.thumbnailUrl === 'string') setThumbnailUrl(data.thumbnailUrl) })
              .catch(() => {})
            setProofScoreLoading(true)
            fetch(`/api/interview/articles/${eid}/proofread`, { method: 'POST', signal: controller.signal })
              .then(r => r.ok ? r.json() : null)
              .then(data => { if (canApply() && data?.success && typeof data.score === 'number' && Number.isFinite(data.score) && data.score >= 0 && data.score <= 100) setProofScore(data.score) })
              .catch(() => {})
              .finally(() => { if (canApply()) setProofScoreLoading(false) })
            break
          }
        }
      })
    } catch (error: unknown) {
      if (!current()) return
      setError(articleFailureGuidance(error))
      setStatus('error')
    } finally {
      if (abortRef.current === controller) { inFlightRef.current = false; if (activeRef.current) setOperationBusy(false) }
    }
  }
  const recoverGeneration = async (cancel = false) => {
    const entry = recoveryRef.current
    if (!entry || (cancel ? cancelRef.current : inFlightRef.current)) return
    if (cancel) cancelRef.current = true
    abortRef.current?.abort()
    const controller = new AbortController(); abortRef.current = controller
    inFlightRef.current = true; setOperationBusy(true)
    try {
      const fresh = await getArticleActorScope(projectId, controller.signal)
      if (fresh.actorScope !== entry.scope.actorScope || !owns(controller, contextKey) || !sameIntent(entry.scope, entry.intent)) return
      const view = await readArticleOperation(entry.scope, entry.intent.operationId, cancel ? 'DELETE' : 'GET', controller.signal)
      if (owns(controller, contextKey) && sameIntent(entry.scope, entry.intent)) applyOperation(view)
    } catch (error: unknown) {
      if (owns(controller, contextKey)) { setError(articleFailureGuidance(error)); setStatus('error') }
    } finally {
      if (abortRef.current === controller) { inFlightRef.current = false; if (activeRef.current) setOperationBusy(false) }
      if (cancel) cancelRef.current = false
    }
  }
  const cancelGeneration = () => { void recoverGeneration(true) }
  const restartGeneration = async () => {
    const entry = recoveryRef.current
    if (!entry || inFlightRef.current || !entry.view || !['completed', 'failed', 'cancelled'].includes(entry.view.state)) return
    inFlightRef.current = true; setOperationBusy(true)
    abortRef.current?.abort()
    const controller = new AbortController(); abortRef.current = controller
    try {
      const scope = await getArticleActorScope(projectId, controller.signal)
      if (scope.actorScope !== entry.scope.actorScope || !owns(controller, contextKey)) return
      selectedInstructions(scope)
      const view = await readArticleOperation(scope, entry.intent.operationId, 'GET', controller.signal)
      if (!owns(controller, contextKey) || !['completed', 'failed', 'cancelled'].includes(view.state)) return
      await clearArticleIntent(scope, entry.intent.operationId, controller.signal)
      if (!owns(controller, contextKey)) return
      remember(null); inFlightRef.current = false
      void startGeneration()
    } catch (error: unknown) { if (owns(controller, contextKey)) { setError(articleFailureGuidance(error)); setStatus('error') } }
    finally { if (abortRef.current === controller) { inFlightRef.current = false; setOperationBusy(false) } }
  }

  useEffect(() => {
    const controller = new AbortController()
    abortRef.current = controller
    const current = () => owns(controller, contextKey)
    remember(null); setError(''); setGeneratedText(''); setDraftId(null); setWordCount(0); setStatus('idle'); setLimitAction(null)
    setThumbnailUrl(null); setProofScore(null); setProofScoreLoading(false); setShowCelebration(false)
    setProviderConfigurationError(false); setMobileDrawerOpen(false); setOperationBusy(false)
    setProgress('開始ボタンを押すと記事生成を1回使用します。')
    // Opening, returning to or reloading this page never creates an article.
    if (authStatus !== 'loading') void getArticleActorScope(projectId, controller.signal).then(async scope => {
      if (!current()) return
      const intent = readArticleIntent(scope)
      if (!intent) return
      remember({ scope, intent, view: null })
      const view = await readArticleOperation(scope, intent.operationId, 'GET', controller.signal)
      if (current() && sameIntent(scope, intent)) applyOperation(view)
    }).catch(error => { if (current()) { setError(articleFailureGuidance(error)); setStatus('error') } })
    return () => { controller.abort() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextKey])

  const progressPercent = status === 'done' ? 100 : status === 'generating' ? 75 : 0

  return (
    <>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />

      <div className="flex flex-1 -mx-4 md:-mx-8 -my-6 md:-my-8 h-[calc(100vh-4rem)] bg-gradient-to-br from-slate-50 to-blue-50/30 overflow-hidden">

        {/* ── Mobile slide-out drawer backdrop ── */}
        <AnimatePresence>
          {mobileDrawerOpen && (
            <motion.div
              className="fixed inset-0 bg-black/40 z-30 md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileDrawerOpen(false)}
            />
          )}
        </AnimatePresence>

        {/* ── Mobile slide-out drawer ── */}
        <AnimatePresence>
          {mobileDrawerOpen && (
            <motion.aside
              className="fixed top-0 left-0 bottom-0 w-80 max-w-[85vw] border-r border-blue-100 bg-white/95 backdrop-blur-md p-6 overflow-y-auto flex flex-col z-40 md:hidden"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              <button
                onClick={() => setMobileDrawerOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
              <div className="mb-8">
                <div className="flex items-center gap-2 text-blue-500 text-xs font-semibold uppercase tracking-wider mb-4">
                  <span className="material-symbols-outlined text-sm">auto_awesome</span>
                  <span>AI記事生成</span>
                </div>
                <h3 className="text-xl font-bold tracking-tight mb-1 text-slate-900">
                  {status === 'done' ? '記事が完成しました' : status === 'generating' ? '記事を生成中' : '記事生成の確認'}
                </h3>
                <p className="text-slate-500 text-sm">
                  {status === 'generating' && (progress || 'AI記事を生成中...')}
                  {status === 'done' && `完了 — ${wordCount.toLocaleString()}文字`}
                  {status === 'error' && 'エラーが発生しました'}
                  {status === 'idle' && '開始前の確認'}
                </p>
              </div>
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-bold text-slate-900">生成進捗</span>
                  <span className="bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent text-sm font-bold">
                    {progressPercent}%
                  </span>
                </div>
                <div className="w-full h-2 bg-blue-50 rounded-full overflow-hidden mb-6">
                  <motion.div
                    className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full"
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <div className="space-y-6">
                  {[
                    { label: '文字起こし解析', stepStatus: status === 'idle' ? 'pending' : 'completed' },
                    { label: '構成マッピング', stepStatus: status === 'idle' ? 'pending' : 'completed' },
                    { label: 'コンテンツ執筆', stepStatus: status === 'generating' ? 'active' : status === 'done' ? 'completed' : 'pending' },
                    { label: '最終仕上げ', stepStatus: status === 'done' ? 'completed' : 'pending' },
                  ].map((step, idx) => (
                    <div key={idx} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all ${
                          step.stepStatus === 'completed' ? 'bg-emerald-500 border-emerald-500 text-white' :
                          step.stepStatus === 'active' ? 'border-blue-500 text-blue-500 shadow-md shadow-blue-200' :
                          'border-slate-300'
                        }`}>
                          <span className="material-symbols-outlined text-sm">
                            {step.stepStatus === 'completed' ? 'check' : step.stepStatus === 'active' ? 'sync' : 'radio_button_unchecked'}
                          </span>
                        </div>
                        {idx < 3 && <div className={`w-px h-full my-1 ${step.stepStatus === 'completed' ? 'bg-emerald-300' : 'bg-slate-200'}`} />}
                      </div>
                      <p className={`text-sm font-bold tracking-tight ${
                        step.stepStatus === 'active' ? 'text-blue-600' : step.stepStatus === 'completed' ? 'text-slate-900' : 'text-slate-400'
                      }`}>{step.label}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-auto pt-4">
                {status === 'generating' && (
                  <button
                    onClick={() => { cancelGeneration(); setMobileDrawerOpen(false) }}
                    className="w-full px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-lg">cancel</span>
                    キャンセル
                  </button>
                )}
                {status === 'done' && draftId && (
                  <button
                    onClick={() => { setMobileDrawerOpen(false); router.push(`/interview/projects/${projectId}/edit?draftId=${draftId}`) }}
                    className="w-full px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-lg text-sm font-medium hover:from-blue-700 hover:to-blue-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                  >
                    <span className="material-symbols-outlined text-lg">edit_note</span>
                    エディタで編集
                  </button>
                )}
                {status === 'error' && (
                  <button
                    onClick={() => { startGeneration(); setMobileDrawerOpen(false) }}
                    className="w-full px-4 py-2.5 bg-red-100 text-red-700 rounded-xl text-sm font-semibold hover:bg-red-200 transition-colors flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-lg">refresh</span>
                    再試行
                  </button>
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* ── Left Sidebar (desktop) ── */}
        <aside className="w-80 border-r border-blue-100 bg-white/80 backdrop-blur-sm p-6 overflow-y-auto hidden md:flex md:flex-col">
          <div className="mb-8">
            <div className="flex items-center gap-2 text-blue-500 text-xs font-semibold uppercase tracking-wider mb-4">
              <span className="material-symbols-outlined text-sm">auto_awesome</span>
              <span>AI記事生成</span>
            </div>
            <h3 className="text-xl font-bold tracking-tight mb-1 text-slate-900">
              {status === 'done' ? '記事が完成しました' : status === 'generating' ? '記事を生成中' : '記事生成の確認'}
            </h3>
            <p className="text-slate-500 text-sm">
              {status === 'generating' && (progress || 'AI記事を生成中...')}
              {status === 'done' && `完了 — ${wordCount.toLocaleString()}文字`}
              {status === 'error' && 'エラーが発生しました'}
              {status === 'idle' && '開始前の確認'}
            </p>
          </div>

          {/* Progress bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-bold text-slate-900">生成進捗</span>
              <span className="bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent text-sm font-bold">
                {progressPercent}%
              </span>
            </div>
            <div className="w-full h-2 bg-blue-50 rounded-full overflow-hidden mb-6">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full"
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>

            {/* Stepper */}
            <div className="space-y-6">
              {[
                { label: '文字起こし解析', stepStatus: status === 'idle' ? 'pending' : 'completed' },
                { label: '構成マッピング', stepStatus: status === 'idle' ? 'pending' : 'completed' },
                { label: 'コンテンツ執筆', stepStatus: status === 'generating' ? 'active' : status === 'done' ? 'completed' : 'pending' },
                { label: '最終仕上げ', stepStatus: status === 'done' ? 'completed' : 'pending' },
              ].map((step, idx) => (
                <div key={idx} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all ${
                      step.stepStatus === 'completed' ? 'bg-emerald-500 border-emerald-500 text-white' :
                      step.stepStatus === 'active' ? 'border-blue-500 text-blue-500 shadow-md shadow-blue-200' :
                      'border-slate-300'
                    }`}>
                      <span className="material-symbols-outlined text-sm">
                        {step.stepStatus === 'completed' ? 'check' : step.stepStatus === 'active' ? 'sync' : 'radio_button_unchecked'}
                      </span>
                    </div>
                    {idx < 3 && <div className={`w-px h-full my-1 ${step.stepStatus === 'completed' ? 'bg-emerald-300' : 'bg-slate-200'}`} />}
                  </div>
                  <p className={`text-sm font-bold tracking-tight ${
                    step.stepStatus === 'active' ? 'text-blue-600' : step.stepStatus === 'completed' ? 'text-slate-900' : 'text-slate-400'
                  }`}>{step.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar actions */}
          <div className="mt-auto pt-4">
            {status === 'generating' && (
              <button
                onClick={cancelGeneration}
                className="w-full px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-lg">cancel</span>
                キャンセル
              </button>
            )}
            {status === 'done' && draftId && (
              <button
                onClick={() => router.push(`/interview/projects/${projectId}/edit?draftId=${draftId}`)}
                className="w-full px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-lg text-sm font-medium hover:from-blue-700 hover:to-blue-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
              >
                <span className="material-symbols-outlined text-lg">edit_note</span>
                エディタで編集
              </button>
            )}
            {status === 'error' && (
              <button
                onClick={startGeneration}
                className="w-full px-4 py-2.5 bg-red-100 text-red-700 rounded-xl text-sm font-semibold hover:bg-red-200 transition-colors flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-lg">refresh</span>
                再試行
              </button>
            )}
          </div>
        </aside>

        {/* ── Main Canvas ── */}
        <main className="flex-1 p-3 sm:p-6 md:p-8 pb-24 md:pb-8 overflow-y-auto relative" ref={contentRef}>
          {recovery && (
            <div className="max-w-[850px] mx-auto bg-white rounded-xl px-5 py-4 text-sm border border-blue-200 mb-6 space-y-3" role="status">
              <p>{progress || '前の記事生成の結果を確認してください。'}</p>
              <div className="flex flex-wrap gap-3">
                <button disabled={operationBusy} onClick={() => void recoverGeneration()} className="px-4 py-2 rounded-lg bg-blue-100 disabled:opacity-50">生成結果を再確認</button>
                {!recovery.view || ['pending', 'cancelling', 'missing', 'busy'].includes(recovery.view.state) ? (
                  <button disabled={cancelRef.current} onClick={cancelGeneration} className="px-4 py-2 rounded-lg bg-slate-100">前の生成を取り消す</button>
                ) : (
                  <button disabled={operationBusy} onClick={() => void restartGeneration()} className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-50">新しい記事を生成（1回使用）</button>
                )}
                {recovery.view?.result && <a href={`/interview/projects/${projectId}/edit?draftId=${recovery.view.result.draftId}`} className="px-4 py-2 rounded-lg bg-blue-100">保存済みの記事を開く</a>}
                <a href={`/interview/projects/${projectId}`} className="px-4 py-2 rounded-lg bg-slate-100">記事一覧を確認</a>
              </div>
            </div>
          )}
          {/* Error display */}
          {status === 'idle' && recipeId && !recovery && (
            <div className="max-w-[850px] mx-auto bg-white rounded-xl px-5 py-4 text-sm border border-blue-200 mb-6 flex flex-wrap items-center justify-between gap-3">
              <p className="text-slate-700">{progress || '記事生成の準備ができました。'}</p>
              <button onClick={startGeneration} className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700">
                記事生成を開始
              </button>
            </div>
          )}
          {status === 'error' && (
            <div className="max-w-[850px] mx-auto bg-red-50 text-red-600 rounded-xl px-5 py-4 text-sm border border-red-200 mb-6">
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-xl">error</span>
                <div className="flex-1">
                  <p className="font-medium mb-1">エラーが発生しました</p>
                  <p className="text-red-500">{error}</p>
                  {limitAction && <a href={limitAction === 'contact' ? SUPPORT_CONTACT_URL : '/interview/pricing'} className="mt-3 inline-block font-semibold text-blue-700 underline">{limitAction === 'contact' ? '追加枠を相談する' : 'プランを見る'}</a>}
                  <a href={`/interview/projects/${projectId}/skill`} className="mt-3 mr-4 inline-block font-semibold text-blue-700 underline">スキル選択に戻る</a>
                  {providerConfigurationError && <a href={SUPPORT_CONTACT_URL} target="_blank" rel="noreferrer" className="mt-3 inline-block font-semibold text-blue-700 underline">サポートに問い合わせる</a>}
                </div>
              </div>
            </div>
          )}

          {/* Document canvas */}
          <div className="max-w-[850px] mx-auto bg-white rounded-2xl shadow-sm border border-slate-200/80 min-h-[600px] relative overflow-hidden">

            {/* Header image */}
            <AnimatePresence>
              {thumbnailUrl && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  transition={{ duration: 0.6 }}
                  className="w-full aspect-[16/9] overflow-hidden"
                >
                  <img
                    src={thumbnailUrl}
                    alt="記事ヘッダー画像"
                    className="w-full h-full object-cover"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Article content */}
            <div className="p-4 sm:p-8 md:p-16">
              {generatedText ? (
                <article className="prose-article">
                  {renderRichContent(generatedText)}
                  {status === 'generating' && (
                    <span className="inline-block w-2 h-5 bg-gradient-to-t from-blue-600 to-blue-400 animate-pulse ml-0.5 rounded-sm" />
                  )}
                </article>
              ) : (
                <motion.div
                  className="space-y-8"
                  animate={status === 'generating' ? { opacity: [0.5, 1, 0.5] } : {}}
                  transition={status === 'generating' ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : {}}
                >
                  {/* Skeleton header image — negative margins match parent padding per breakpoint */}
                  <div className="aspect-[16/9] bg-gradient-to-br from-blue-50 to-slate-50 rounded-xl flex items-center justify-center -mx-4 -mt-4 sm:-mx-8 sm:-mt-8 md:-mx-16 md:-mt-16 w-[calc(100%+2rem)] sm:w-[calc(100%+4rem)] md:w-[calc(100%+8rem)]">
                    <span className="material-symbols-outlined text-blue-200 text-[64px]">image</span>
                  </div>
                  <div className="border-b border-slate-100 pb-8 pt-4">
                    <div className="h-9 w-3/4 bg-gradient-to-r from-blue-50 to-slate-50 rounded-lg mb-4" />
                    <div className="flex items-center gap-6 mt-6">
                      <div className="px-3 py-1 rounded-full bg-blue-50 text-blue-400 text-[10px] font-bold uppercase tracking-wider">
                        {status === 'generating' ? 'AI Writing...' : '準備中'}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="h-4 w-full bg-slate-50 rounded" />
                    <div className="h-4 w-full bg-slate-50 rounded" />
                    <div className="h-4 w-3/4 bg-slate-50 rounded" />
                    <div className="h-4 w-5/6 bg-slate-50 rounded" />
                  </div>
                </motion.div>
              )}
            </div>
          </div>

          {/* Floating status bar */}
          <AnimatePresence>
            {status === 'generating' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.3 }}
                className="fixed bottom-24 md:bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-2 sm:gap-4 bg-white/90 backdrop-blur-md px-3 sm:px-6 py-2.5 sm:py-3 rounded-full border border-blue-100 shadow-xl shadow-blue-500/10 z-20 max-w-[calc(100%-2rem)]"
              >
                <div className="flex items-center gap-2 sm:gap-3 pr-2 sm:pr-4 border-r border-slate-200 min-w-0">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-ping flex-shrink-0" />
                  <span className="text-xs sm:text-sm font-semibold text-slate-700 truncate">{progress || 'AIがコンテンツを執筆中...'}</span>
                </div>
                <button
                  onClick={cancelGeneration}
                  className="text-sm font-bold text-slate-500 hover:text-blue-600 transition-colors"
                >
                  停止
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Completion actions */}
          <AnimatePresence>
            {status === 'done' && (
              <motion.div
                className="max-w-[850px] mx-auto mt-6 mb-20 md:mb-6 flex flex-col sm:flex-row gap-3"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <button
                  onClick={() => router.push(`/interview/projects/${projectId}/skill`)}
                  className="px-5 py-3 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  <span className="material-symbols-outlined text-lg">arrow_back</span>
                  スキルを変えて再生成
                </button>
                <button
                  onClick={() => router.push(`/interview/projects/${projectId}/edit?draftId=${draftId}`)}
                  className="flex-1 px-5 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-lg text-sm font-medium hover:from-blue-700 hover:to-blue-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                >
                  <span className="material-symbols-outlined text-lg">edit_note</span>
                  エディタで編集する
                  <span className="material-symbols-outlined text-lg">arrow_forward</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* ── Mobile sticky bottom bar ── */}
        <div className="fixed bottom-0 left-0 right-0 md:hidden bg-white/95 backdrop-blur-md border-t border-blue-100 px-4 py-3 z-20 safe-area-pb">
          <div className="flex items-center gap-3">
            {/* Progress info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                {status === 'generating' && <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse flex-shrink-0" />}
                {status === 'done' && <span className="material-symbols-outlined text-emerald-500 text-sm flex-shrink-0">check_circle</span>}
                {status === 'error' && <span className="material-symbols-outlined text-red-500 text-sm flex-shrink-0">error</span>}
                {status === 'idle' && <div className="w-2 h-2 rounded-full bg-slate-300 flex-shrink-0" />}
                <span className="text-xs font-semibold text-slate-700 truncate">
                  {status === 'generating' && (progress || 'AI記事を生成中...')}
                  {status === 'done' && `完了 — ${wordCount.toLocaleString()}文字`}
                  {status === 'error' && 'エラーが発生しました'}
                  {status === 'idle' && '開始前の確認'}
                </span>
              </div>
              <div className="w-full h-1.5 bg-blue-50 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full"
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>
            {/* Action buttons */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {status === 'done' && draftId && (
                <button
                  onClick={() => router.push(`/interview/projects/${projectId}/edit?draftId=${draftId}`)}
                  className="px-3 py-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-lg text-xs font-medium shadow-md shadow-blue-500/20 flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">edit_note</span>
                  編集
                </button>
              )}
              {status === 'generating' && (
                <button
                  onClick={cancelGeneration}
                  className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">stop</span>
                  停止
                </button>
              )}
              {status === 'error' && (
                <button
                  onClick={startGeneration}
                  className="px-3 py-2 bg-red-100 text-red-700 rounded-lg text-xs font-semibold flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">refresh</span>
                  再試行
                </button>
              )}
              <button
                onClick={() => setMobileDrawerOpen(true)}
                className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <span className="material-symbols-outlined text-lg">menu</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Celebration Popup ── */}
      <AnimatePresence>
        {showCelebration && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={() => setShowCelebration(false)}
            />

            {/* Confetti */}
            <CelebrationConfetti />

            {/* Modal */}
            <motion.div
              className="relative bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full mx-4 text-center z-[61]"
              initial={{ scale: 0.7, y: 40, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            >
              {/* Close button */}
              <button
                onClick={() => setShowCelebration(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>

              {/* Icon */}
              <motion.div
                className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-500/30"
                initial={{ rotate: -10, scale: 0.5 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.2 }}
              >
                <span className="material-symbols-outlined text-white text-[32px]">celebration</span>
              </motion.div>

              <motion.h2
                className="text-2xl font-extrabold mb-2 bg-gradient-to-r from-blue-800 to-blue-500 bg-clip-text text-transparent"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                記事が完成しました！
              </motion.h2>

              <motion.p
                className="text-sm text-slate-500 mb-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                {wordCount.toLocaleString()}文字の記事が生成されました
              </motion.p>

              {/* Score gauge */}
              <div className="mb-8">
                {proofScoreLoading && (
                  <div className="flex flex-col items-center gap-3">
                    <div className="relative w-[160px] h-[160px] flex items-center justify-center">
                      <svg width={160} height={160} className="-rotate-90">
                        <circle cx={80} cy={80} r={66} fill="none" stroke="#e2e8f0" strokeWidth={14} />
                        <motion.circle
                          cx={80} cy={80} r={66}
                          fill="none" stroke="#93c5fd" strokeWidth={14} strokeLinecap="round"
                          strokeDasharray={2 * Math.PI * 66}
                          animate={{ strokeDashoffset: [2 * Math.PI * 66, 2 * Math.PI * 66 * 0.6, 2 * Math.PI * 66] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-sm text-blue-400 font-medium">採点中...</span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400">AIが記事を採点しています</p>
                  </div>
                )}
                {proofScore !== null && !proofScoreLoading && (
                  <ScoreGauge score={proofScore} />
                )}
                {proofScore === null && !proofScoreLoading && (
                  <div className="text-sm text-slate-400 py-4">
                    <span className="material-symbols-outlined text-slate-300 text-[48px] block mb-2">analytics</span>
                    スコアの取得に失敗しました
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="space-y-3">
                <button
                  onClick={() => {
                    setShowCelebration(false)
                    if (draftId) router.push(`/interview/projects/${projectId}/edit?draftId=${draftId}`)
                  }}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl text-sm font-medium hover:from-blue-700 hover:to-blue-600 transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-lg">edit_note</span>
                  エディタで編集する
                </button>
                <button
                  onClick={() => setShowCelebration(false)}
                  className="w-full py-2.5 text-slate-500 text-sm font-medium hover:text-slate-700 transition-colors"
                >
                  記事を確認する
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
