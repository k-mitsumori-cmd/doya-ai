'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { readInterviewCreationResponse, InterviewCreationResponseError } from '@/lib/interview/creation-response'
import { motion, AnimatePresence } from 'framer-motion'
import { SUPPORT_CONTACT_URL } from '@/lib/pricing'
import { findInterviewUploadAttempt } from '@/lib/interview/upload-attempt'

// ============================================
// プラン別のファイルサイズ上限に対応した直接アップロードUI
// ============================================
// フロー:
// 1. ファイル選択 (ドラッグ&ドロップ / ボタン)
// 2. API → 署名付きアップロードURL取得 (数KB, 高速)
// 3. ブラウザ → Supabase Storage へ直接PUT (Vercel経由しない)
// 4. API → アップロード完了確認 → DBに保存
// これにより Vercel の 4.5MB ボディサイズ制限を完全回避

interface MaterialItem {
  id: string
  type: string
  fileName: string
  fileSize: number | null
  mimeType: string | null
  status: string
  error: string | null
  createdAt: string
  transcriptionStatus?: string
}

interface UploadingFile {
  file: File
  progress: number
  status: 'uploading' | 'confirming' | 'done' | 'error'
  error?: string
  errorActionUrl?: string
  errorActionLabel?: string
  materialId?: string
}

interface TranscriptionProgress {
  startTime: number
  materialId: string
  fileName: string
  fileSize: number | null
  status: 'starting' | 'processing' | 'completed' | 'error'
  error?: string
  limitReached?: boolean
  limitAction?: 'pricing' | 'contact' | null
  durationMinutes?: number | null
}

const TRANSCRIPTION_STEPS = [
  { label: 'ファイル取得', icon: 'cloud_download', timeThreshold: 0 },
  { label: '音声解析', icon: 'graphic_eq', timeThreshold: 5 },
  { label: 'テキスト変換', icon: 'text_fields', timeThreshold: 15 },
  { label: '結果保存', icon: 'check_circle', timeThreshold: 45 },
]

const STATUS_ICONS: Record<string, string> = {
  UPLOADED: 'schedule',
  PROCESSING: 'sync',
  COMPLETED: 'check_circle',
  ERROR: 'error',
}

const FILE_TYPE_ICONS: Record<string, string> = {
  audio: 'music_note',
  video: 'movie',
  pdf: 'description',
  text: 'article',
  image: 'image',
}


const UPLOAD_TIPS = [
  { icon: 'auto_awesome', text: 'AIが音声を文字起こしします。結果は確認・編集できます' },
  { icon: 'speed', text: '処理時間は音声の長さや混雑状況によって変わります' },
  { icon: 'mic', text: '複数の話者がいる場合も、AIが自動で話者を分離します' },
  { icon: 'translate', text: '日本語・英語をはじめ、多言語の文字起こしに対応しています' },
  { icon: 'article', text: '文字起こし結果からAIが自動でプロ品質の記事を生成します' },
  { icon: 'edit_note', text: '生成された記事はエディタで自由に編集・カスタマイズできます' },
  { icon: 'fact_check', text: 'ファクトチェック機能で記事の信頼性を自動検証します' },
  { icon: 'share', text: 'SNS投稿文の自動生成で、記事の拡散も簡単です' },
]

const SUPPORTED_FORMATS = [
  { label: 'MP4', color: 'bg-red-100 text-red-700 border-red-200' },
  { label: 'MOV', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { label: 'MP3', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { label: 'WAV', color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  { label: 'M4A', color: 'bg-teal-100 text-teal-700 border-teal-200' },
  { label: 'PDF', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { label: 'DOCX', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
]

const FLOATING_ICONS = ['mic', 'movie', 'music_note', 'description', 'image', 'graphic_eq']

const WORKFLOW_STEPS = [
  { icon: 'cloud_upload', label: 'アップロード', desc: '素材をアップロード' },
  { icon: 'transcribe', label: '文字起こし', desc: 'AIが自動文字起こし' },
  { icon: 'auto_awesome', label: 'スキル選択', desc: '記事の構成を選択' },
  { icon: 'edit_note', label: '記事生成', desc: 'AIが記事を自動生成' },
]

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 }
  }
}

const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  show: { opacity: 1, x: 0, transition: { duration: 0.4, ease: 'easeOut' } }
}

const scaleInVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: 'easeOut' } }
}

export default function MaterialsPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string
  const { data: session, status: sessionStatus } = useSession()
  const resolvedActor = String(session?.user?.id || 'guest')
  const lastResolvedActor = useRef(resolvedActor)
  const uploadActor = sessionStatus === 'loading' ? lastResolvedActor.current : resolvedActor
  const uploadContext = JSON.stringify([projectId, uploadActor])
  const uploadContextRef = useRef(uploadContext)
  const uploadLifecycle = useRef(new AbortController())
  const materialUploads = useRef<Map<string, { key: string; controller: AbortController | null; materialId?: string; signedUrl?: string; uploaded?: boolean; completed?: boolean }>>(new Map())
  const uploadsAlive = useRef(true)
  const transcriptionOperations = useRef<Map<string, { controller: AbortController | null; accepted: boolean; timer?: ReturnType<typeof setTimeout> }>>(new Map())
  const materialActions = useRef<Map<string, AbortController>>(new Map())
  const projectRead = useRef<AbortController | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [materials, setMaterials] = useState<MaterialItem[]>([])
  const [uploads, setUploads] = useState<Map<string, UploadingFile>>(new Map())
  const [comparingCount, setComparingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [projectError, setProjectError] = useState(false)
  const [projectTitle, setProjectTitle] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [transcribing, setTranscribing] = useState<Map<string, TranscriptionProgress>>(new Map())
  const [elapsedTick, setElapsedTick] = useState(0) // 経過時間更新用
  const [tipIndex, setTipIndex] = useState(0)
  const [confirmingMaterialId, setConfirmingMaterialId] = useState<string | null>(null)
  const [materialActionError, setMaterialActionError] = useState<{ message: string; actionUrl?: string } | null>(null)
  const uploadSpeedRef = useRef<Map<string, { startTime: number; lastLoaded: number; speed: number }>>(new Map())

  useEffect(() => {
    uploadsAlive.current = true
    uploadContextRef.current = uploadContext
    uploadLifecycle.current = new AbortController()
    const lifecycle = uploadLifecycle.current
    materialUploads.current = new Map()
    const operations = materialUploads.current
    transcriptionOperations.current = new Map()
    const transcriptions = transcriptionOperations.current
    materialActions.current = new Map()
    const actions = materialActions.current
    setConfirmingMaterialId(null)
    setMaterialActionError(null)
    setTranscribing(new Map())
    setUploads(new Map())
    setComparingCount(0)
    setMaterials([])
    setProjectTitle('')
    setProjectError(false)
    setLoading(true)
    return () => {
      uploadsAlive.current = false
      lifecycle.abort()
      uploadLifecycle.current.abort()
      for (const operation of operations.values()) operation.controller?.abort()
      for (const controller of actions.values()) controller.abort()
      for (const operation of transcriptions.values()) { operation.controller?.abort(); clearTimeout(operation.timer) }
      projectRead.current?.abort()
    }
  }, [uploadContext])

  useEffect(() => {
    if (sessionStatus !== 'loading') lastResolvedActor.current = resolvedActor
    if (sessionStatus === 'loading') {
      uploadLifecycle.current.abort()
      for (const operation of materialUploads.current.values()) operation.controller?.abort()
      for (const operation of transcriptionOperations.current.values()) operation.controller?.abort()
      for (const controller of materialActions.current.values()) controller.abort()
      projectRead.current?.abort()
      setComparingCount(0)
      setConfirmingMaterialId(null)
      setLoading(true)
      setMaterials([])
      setProjectTitle('')
      setUploads(prev => new Map(Array.from(prev, ([key, item]) => [key,
        item.status === 'done' || item.status === 'error' ? item : { ...item, status: 'error' as const,
          error: '利用情報を再確認しています。確認後に再試行してください。',
          errorActionUrl: '/interview/projects/' + encodeURIComponent(projectId) + '/materials', errorActionLabel: '保存済み素材を確認する' },
      ])))
    } else if (uploadLifecycle.current.signal.aborted) uploadLifecycle.current = new AbortController()
  }, [sessionStatus, resolvedActor, uploadContext, projectId])

  // プロジェクトと素材一覧を取得
  const fetchProject = useCallback(async (forceRefresh: unknown = false) => {
    if (sessionStatus === 'loading' || !uploadsAlive.current || uploadContextRef.current !== uploadContext) return
    if (projectRead.current && !projectRead.current.signal.aborted) {
      if (forceRefresh !== true) return
      projectRead.current.abort()
    }
    const active = new AbortController()
    projectRead.current = active
    const isCurrent = () => uploadsAlive.current && uploadContextRef.current === uploadContext && projectRead.current === active && !active.signal.aborted
    try {
      const reply = await readInterviewCreationResponse('/api/interview/projects/' + encodeURIComponent(projectId), {
        cache: 'no-store', signal: active.signal,
      }, '素材一覧を取得できませんでした。', 5 * 1024 * 1024)
      if (!isCurrent()) return
      const data = reply.data
      if (!reply.res.ok || data?.success !== true || !data.project || !Array.isArray(data.project.materials)) throw new Error('素材一覧を取得できません')
      setProjectTitle(data.project.title)
      setMaterials(data.project.materials.map((m: any) => ({
        ...m, transcriptionStatus: data.project.transcriptions?.find((t: any) => t.materialId === m.id)?.status,
      })))
      setProjectError(false)
    } catch {
      if (isCurrent()) setProjectError(true)
    } finally {
      if (isCurrent()) { setLoading(false); projectRead.current = null }
    }
  }, [projectId, uploadContext, sessionStatus])

  useEffect(() => {
    fetchProject()
  }, [fetchProject])

  // 素材にPROCESSINGがある場合はポーリング
  useEffect(() => {
    const hasProcessing = materials.some(
      (m) => m.status === 'PROCESSING' || m.transcriptionStatus === 'PROCESSING'
    )
    if (!hasProcessing && !Array.from(transcribing.values()).some((info) => info.status === 'processing')) return

    const interval = setInterval(fetchProject, 5000)
    return () => clearInterval(interval)
  }, [materials, transcribing, fetchProject])

  // Refreshes must not leak provider errors or remove a newer operation's progress.
  useEffect(() => {
    for (const mat of materials) {
      const operation = transcriptionOperations.current.get(mat.id)
      if (!operation) continue
      if (mat.transcriptionStatus === 'ERROR') {
        operation.accepted = false
        clearTimeout(operation.timer)
        operation.timer = undefined
        setTranscribing((prev) => {
          const info = prev.get(mat.id)
          if (!info || info.status === 'error') return prev
          return new Map(prev).set(mat.id, { ...info, status: 'error', error: '文字起こしに失敗しました。素材を確認して再試行してください。' })
        })
      } else if (mat.transcriptionStatus === 'COMPLETED' && !operation.timer) {
        operation.accepted = true
        setTranscribing((prev) => {
          const info = prev.get(mat.id)
          return info ? new Map(prev).set(mat.id, { ...info, status: 'completed' }) : prev
        })
        operation.timer = setTimeout(() => {
          if (!uploadsAlive.current || uploadContextRef.current !== uploadContext || transcriptionOperations.current.get(mat.id) !== operation) return
          setTranscribing((prev) => { const next = new Map(prev); next.delete(mat.id); return next })
        }, 5000)
      }
    }
  }, [materials, uploadContext])

  // 経過時間を毎秒更新
  useEffect(() => {
    if (transcribing.size === 0) return
    const hasActive = Array.from(transcribing.values()).some(
      (t) => t.status === 'starting' || t.status === 'processing'
    )
    if (!hasActive) return

    const interval = setInterval(() => setElapsedTick((t) => t + 1), 1000)
    return () => clearInterval(interval)
  }, [transcribing])

  // アップロード中のブラウザ離脱防止
  useEffect(() => {
    const hasActive = Array.from(uploads.values()).some(
      (u) => u.status === 'uploading' || u.status === 'confirming'
    )
    if (!hasActive && comparingCount === 0) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [uploads, comparingCount])

  // 豆知識のサイクル
  useEffect(() => {
    const hasActive = Array.from(uploads.values()).some(
      (u) => u.status === 'uploading' || u.status === 'confirming'
    )
    if (!hasActive) return
    const interval = setInterval(() => setTipIndex((i) => (i + 1) % UPLOAD_TIPS.length), 5000)
    return () => clearInterval(interval)
  }, [uploads])

  // 経過時間フォーマット
  const formatElapsed = (startTime: number) => {
    const seconds = Math.floor((Date.now() - startTime) / 1000)
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins > 0) return `${mins}分${secs.toString().padStart(2, '0')}秒`
    return `${secs}秒`
  }

  // 現在のステップを経過時間から推定
  const getCurrentStep = (startTime: number) => {
    const seconds = Math.floor((Date.now() - startTime) / 1000)
    let step = 0
    for (let i = TRANSCRIPTION_STEPS.length - 1; i >= 0; i--) {
      if (seconds >= TRANSCRIPTION_STEPS[i].timeThreshold) {
        step = i
        break
      }
    }
    return step
  }

  // ============================================
  // 直接アップロード処理 (Vercelバイパス)
  // ============================================
  const uploadFile = async (file: File) => {
    if (sessionStatus === 'loading' || !uploadsAlive.current || uploadContextRef.current !== uploadContext) return
    const lifecycle = uploadLifecycle.current
    let operation: (typeof materialUploads.current extends Map<string, infer T> ? T : never)
    try {
      const found = findInterviewUploadAttempt(file, materialUploads.current, () => ({
        key: crypto.randomUUID(), controller: null,
      }), lifecycle.signal)
      if ('then' in found) {
        setComparingCount(count => count + 1)
        try { operation = await found } finally {
          if (uploadsAlive.current && uploadContextRef.current === uploadContext && uploadLifecycle.current === lifecycle && !lifecycle.signal.aborted) setComparingCount(count => Math.max(0, count - 1))
        }
      } else operation = found
    } catch {
      if (uploadsAlive.current && uploadContextRef.current === uploadContext && uploadLifecycle.current === lifecycle && !lifecycle.signal.aborted) {
        setUploads(prev => new Map(prev).set(crypto.randomUUID(), { file, progress: 0, status: 'error',
          error: 'ファイルの内容を確認できませんでした。再試行してください。' }))
      }
      return
    }
    if (!uploadsAlive.current || uploadContextRef.current !== uploadContext || uploadLifecycle.current !== lifecycle || lifecycle.signal.aborted) return
    if (operation?.controller || operation?.completed) return
    const record = operation
    const active = new AbortController()
    record.controller = active
    const isCurrent = () => uploadsAlive.current && uploadContextRef.current === uploadContext && record.controller === active && !active.signal.aborted
    const uploadKey = record.key
    const rejectPreparation = (data: any) => {
      const messages: Record<string, string> = {
        GUEST_UPLOAD_LIMIT: 'ゲストの容量上限に達しました。ログインして利用条件をご確認ください。',
        PLAN_UPLOAD_LIMIT: 'プランの容量上限に達しました。利用条件をご確認ください。',
        STORAGE_UPLOAD_LIMIT: '保存領域の容量上限を超えています。ファイルを分割または圧縮してください。',
        UPLOAD_REQUEST_CONFLICT: 'このアップロード操作の入力が変わっています。保存済み素材をご確認ください。',
        UPLOAD_REQUEST_UNAVAILABLE: 'このアップロード操作は再開できません。保存済み素材をご確認ください。',
      }
      const error: any = new InterviewCreationResponseError((typeof data?.code === 'string' && Object.hasOwn(messages, data.code) ? messages[data.code] : 'アップロードの結果を確認できませんでした。保存済み素材をご確認ください。'))
      error.actionUrl = ['/interview/pricing', '/auth/signin?callbackUrl=/interview', SUPPORT_CONTACT_URL].includes(data?.actionUrl) ? data.actionUrl : '/interview/projects/' + encodeURIComponent(projectId) + '/materials'
      error.actionLabel = error.actionUrl === '/interview/pricing' ? 'プランと利用条件を確認する' : error.actionUrl === SUPPORT_CONTACT_URL ? '追加の利用枠を相談する' : error.actionUrl.startsWith('/auth/') ? 'ログインして続ける' : '保存済み素材を確認する'
      throw error
    }

    setUploads((prev) => {
      const next = new Map(prev)
      next.set(uploadKey, { file, progress: 0, status: 'uploading' })
      return next
    })

    try {
      if (!record.uploaded) {
        const reply = await readInterviewCreationResponse('/api/interview/materials/upload-url', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: active.signal,
          body: JSON.stringify({ projectId, requestKey: uploadKey, fileName: file.name, mimeType: file.type, fileSize: file.size,
            ...(record.materialId ? { materialId: record.materialId } : {}) }),
        }, 'アップロード準備の結果を確認できませんでした。保存済み素材をご確認ください。')
        if (!isCurrent()) return
        if (!reply.res.ok || reply.data?.success !== true) rejectPreparation(reply.data)
        const { signedUrl, materialId } = reply.data
        if (typeof materialId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(materialId) || typeof signedUrl !== 'string') throw new InterviewCreationResponseError('保存先を確認できませんでした。保存済み素材をご確認ください。')
        let url: URL
        try { url = new URL(signedUrl) } catch { throw new InterviewCreationResponseError('保存先を確認できませんでした。') }
        if (url.protocol !== 'https:' || url.username || url.password || (record.materialId && record.materialId !== materialId)) throw new InterviewCreationResponseError('保存先を確認できませんでした。保存済み素材をご確認ください。')
        record.materialId = materialId
        record.signedUrl = signedUrl
      }
      if (!record.materialId || !record.signedUrl) throw new InterviewCreationResponseError('保存先を確認できませんでした。')
      const { signedUrl, materialId } = record

      // Step 2: Supabase Storage へ直接PUT (リトライ付き)
      const maxRetries = 3
      for (let attempt = 1; !record.uploaded && attempt <= maxRetries; attempt++) {
        if (!isCurrent()) return
        try {
          await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest()

            xhr.upload.addEventListener('progress', (e) => {
              if (!isCurrent()) return
              if (e.lengthComputable) {
                const progress = Math.round((e.loaded / e.total) * 100)
                // 速度計算
                const speedInfo = uploadSpeedRef.current.get(uploadKey)
                if (speedInfo) {
                  const elapsed = (Date.now() - speedInfo.startTime) / 1000
                  if (elapsed > 0) {
                    speedInfo.speed = e.loaded / elapsed
                    speedInfo.lastLoaded = e.loaded
                  }
                } else {
                  uploadSpeedRef.current.set(uploadKey, { startTime: Date.now(), lastLoaded: e.loaded, speed: 0 })
                }
                setUploads((prev) => {
                  const next = new Map(prev)
                  const item = next.get(uploadKey)
                  if (item) next.set(uploadKey, { ...item, progress, materialId })
                  return next
                })
              }
            })

            xhr.addEventListener('load', () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                resolve()
              } else {
                reject(new Error(`Upload failed: ${xhr.status}`))
              }
            })

            xhr.addEventListener('error', () => reject(new Error('ネットワークエラー')))
            xhr.addEventListener('abort', () => reject(new Error('アップロードが中断されました')))

            const formData = new FormData()
            formData.append('cacheControl', '3600')
            formData.append('', file, file.name)

            const abortUpload = () => xhr.abort()
            active.signal.addEventListener('abort', abortUpload, { once: true })
            xhr.addEventListener('loadend', () => active.signal.removeEventListener('abort', abortUpload))
            xhr.timeout = 3600000
            xhr.addEventListener('timeout', () => reject(new InterviewCreationResponseError('アップロードの完了を確認できませんでした。保存済み素材をご確認ください。')))
            xhr.open('PUT', signedUrl)
            xhr.setRequestHeader('x-upsert', 'true')
            xhr.send(formData)
          })
          if (!isCurrent()) return
          record.uploaded = true
          break // 成功したらループを抜ける
        } catch (uploadErr: any) {
          if (!isCurrent()) return
          const is5xx = /Upload failed: 5\d\d/.test(uploadErr?.message || '')
          if (is5xx && attempt < maxRetries) {
            console.warn(`[interview] Upload attempt ${attempt} failed, retrying in ${attempt * 3}s...`)
            // プログレスをリセットして再試行
            setUploads((prev) => {
              const next = new Map(prev)
              const item = next.get(uploadKey)
              if (item) next.set(uploadKey, { ...item, progress: 0 })
              return next
            })
            uploadSpeedRef.current.delete(uploadKey)
            await new Promise(r => setTimeout(r, attempt * 3000))
            continue
          }
          throw uploadErr
        }
      }

      // Step 3: アップロード完了確認 (API → DBに保存)
      setUploads((prev) => {
        const next = new Map(prev)
        const item = next.get(uploadKey)
        if (item) next.set(uploadKey, { ...item, status: 'confirming', progress: 100 })
        return next
      })

      if (!isCurrent()) return
      const confirmation = await readInterviewCreationResponse('/api/interview/materials/confirm', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: active.signal,
        body: JSON.stringify({ materialId }),
      }, '保存結果を確認できませんでした。保存済み素材をご確認ください。')
      if (!isCurrent()) return
      if (!confirmation.res.ok || confirmation.data?.success !== true) rejectPreparation(confirmation.data)
      record.completed = true

      // 完了
      setUploads((prev) => {
        const next = new Map(prev)
        const item = next.get(uploadKey)
        if (item) next.set(uploadKey, { ...item, status: 'done', materialId })
        return next
      })

      // 素材一覧を更新
      await fetchProject(true)
      if (!isCurrent()) return

      // 音声/動画ファイルなら自動で文字起こしを開始
      const isAudioVideo = file.type.startsWith('audio/') || file.type.startsWith('video/')
      if (isAudioVideo && materialId) {
        startTranscription(materialId)
      }

      // 3秒後にアップロード表示を消す
      setTimeout(() => {
        if (!uploadsAlive.current || uploadContextRef.current !== uploadContext) return
        setUploads((prev) => {
          const next = new Map(prev)
          next.delete(uploadKey)
          return next
        })
      }, 3000)
    } catch (e: any) {
      if (!isCurrent()) return
      setUploads((prev) => {
        const next = new Map(prev)
        const item = next.get(uploadKey)
        if (item) next.set(uploadKey, {
          ...item,
          status: 'error',
          error: e instanceof InterviewCreationResponseError ? e.message : '処理結果を確認できませんでした。保存済み素材をご確認ください。',
          errorActionUrl: e.actionUrl || '/interview/projects/' + encodeURIComponent(projectId) + '/materials',
          errorActionLabel: e.actionLabel || '保存済み素材を確認する',
        })
        return next
      })
    } finally {
      if (record.controller === active) record.controller = null
    }
  }

  // ファイル選択ハンドラー
  const handleFiles = (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      uploadFile(file)
    }
  }

  // ドラッグ&ドロップ
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files)
    }
  }

  // Keep a synchronous per-material claim until the server reports a terminal error.
  const startTranscription = async (materialId: string) => {
    if (sessionStatus === 'loading' || !uploadsAlive.current || uploadContextRef.current !== uploadContext || !/^[a-zA-Z0-9_-]{1,128}$/.test(materialId)) return
    const previous = transcriptionOperations.current.get(materialId)
    if (previous?.controller || previous?.accepted) return
    clearTimeout(previous?.timer)
    const active = new AbortController()
    const operation = { controller: active as AbortController | null, accepted: false, timer: undefined as ReturnType<typeof setTimeout> | undefined }
    transcriptionOperations.current.set(materialId, operation)
    const isCurrent = () => uploadsAlive.current && uploadContextRef.current === uploadContext && transcriptionOperations.current.get(materialId) === operation && !active.signal.aborted
    const mat = materials.find((m) => m.id === materialId)
    const unknownResult = '文字起こしの結果を確認できませんでした。素材一覧を更新して状況を確認してください。'
    const update = (changes: Partial<TranscriptionProgress>) => {
      if (!isCurrent()) return
      setTranscribing((prev) => {
        const info = prev.get(materialId)
        return info ? new Map(prev).set(materialId, { ...info, ...changes }) : prev
      })
    }
    setTranscribing((prev) => new Map(prev).set(materialId, {
      startTime: Date.now(), materialId, fileName: mat?.fileName || '', fileSize: mat?.fileSize || null, status: 'starting',
    }))
    try {
      const { res, data } = await readInterviewCreationResponse('/api/interview/materials/' + encodeURIComponent(materialId) + '/transcribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: active.signal,
      }, unknownResult, 65536, 310000)
      if (!isCurrent()) return
      if ([403, 429].includes(res.status) && data?.success === false && data?.limitExceeded === true) {
        update({ status: 'error', limitReached: true,
          limitAction: data.actionUrl === SUPPORT_CONTACT_URL ? 'contact' : data.actionUrl === '/interview/pricing' ? 'pricing' : null,
          error: '文字起こしの上限に達しました。利用可能なプランをご確認ください。' })
        return
      }
      if (!res.ok || data?.success !== true || typeof data.transcriptionId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(data.transcriptionId) || !['PROCESSING', 'COMPLETED'].includes(data.status)) {
        throw new InterviewCreationResponseError(unknownResult)
      }
      operation.accepted = true
      update({ status: data.status === 'COMPLETED' ? 'completed' : 'processing',
        durationMinutes: typeof data.durationMinutes === 'number' && Number.isFinite(data.durationMinutes) && data.durationMinutes >= 0 ? data.durationMinutes : null })
      if (data.status === 'COMPLETED') {
        operation.timer = setTimeout(() => {
          if (!isCurrent()) return
          setTranscribing((prev) => { const next = new Map(prev); next.delete(materialId); return next })
        }, 5000)
      }
      // A list refresh failure does not undo a verified transcription response.
      try { await fetchProject(true) } catch { /* The list exposes its own retry state. */ }
    } catch {
      update({ status: 'error', error: unknownResult })
    } finally {
      if (transcriptionOperations.current.get(materialId) === operation) operation.controller = null
    }
  }

  const runMaterialAction = async (mode: 'confirm' | 'delete', materialId: string) => {
    if (sessionStatus === 'loading' || !uploadsAlive.current || uploadContextRef.current !== uploadContext || materialActions.current.size || !/^[a-zA-Z0-9_-]{1,128}$/.test(materialId)) return
    const active = new AbortController()
    materialActions.current.set(materialId, active)
    const isCurrent = () => uploadsAlive.current && uploadContextRef.current === uploadContext && materialActions.current.get(materialId) === active && !active.signal.aborted
    const unknownResult = mode === 'confirm'
      ? 'アップロードの確認結果を取得できませんでした。素材一覧を更新して状況を確認してください。'
      : '素材の削除結果を取得できませんでした。素材一覧を更新して状況を確認してください。'
    setMaterialActionError(null)
    if (mode === 'confirm') setConfirmingMaterialId(materialId)
    try {
      const { res, data } = await readInterviewCreationResponse(mode === 'confirm' ? '/api/interview/materials/confirm' : '/api/interview/materials/' + encodeURIComponent(materialId), {
        method: mode === 'confirm' ? 'POST' : 'DELETE', signal: active.signal,
        ...(mode === 'confirm' ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ materialId }) } : {}),
      }, unknownResult)
      if (!isCurrent()) return
      if (mode === 'confirm' && res.status === 413 && data?.success === false && data?.code === 'UPLOAD_LIMIT_REACHED') {
        const actionUrl = data.limitSource === 'plan' && ['/auth/signin?callbackUrl=/interview', '/interview/pricing', SUPPORT_CONTACT_URL].includes(data.actionUrl) ? data.actionUrl : undefined
        setMaterialActionError({ message: data.limitSource === 'storage' ? 'ファイルを分割または圧縮して、再度アップロードしてください。' : 'ファイル容量がプランの上限を超えています。利用可能なプランをご確認ください。', actionUrl })
        try { await fetchProject(true) } catch { /* Preserve the verified quota reason. */ }
        return
      }
      if (!res.ok || data?.success !== true || (mode === 'confirm' && (data.material?.id !== materialId || data.material?.status !== 'COMPLETED' || typeof data.material?.fileSize !== 'number' || !Number.isSafeInteger(data.material.fileSize) || data.material.fileSize < 0))) throw new InterviewCreationResponseError(unknownResult)
      if (mode === 'confirm') {
        setMaterials((previous) => previous.map((material) => material.id === materialId ? { ...material, status: 'COMPLETED', fileSize: data.material.fileSize } : material))
      } else {
        setMaterials((previous) => previous.filter((material) => material.id !== materialId))
        const transcription = transcriptionOperations.current.get(materialId)
        transcription?.controller?.abort()
        clearTimeout(transcription?.timer)
        transcriptionOperations.current.delete(materialId)
        setTranscribing((previous) => { const next = new Map(previous); next.delete(materialId); return next })
      }
      try { await fetchProject(true) } catch { /* Keep the verified mutation even if the list cannot refresh. */ }
    } catch {
      if (isCurrent()) setMaterialActionError({ message: unknownResult })
    } finally {
      if (isCurrent() && mode === 'confirm') setConfirmingMaterialId(null)
      if (materialActions.current.get(materialId) === active) materialActions.current.delete(materialId)
    }
  }

  const deleteMaterial = async (materialId: string) => {
    if (!uploadsAlive.current || uploadContextRef.current !== uploadContext || materialActions.current.size) return
    if (confirm('この素材を削除しますか？')) await runMaterialAction('delete', materialId)
  }

  const confirmPendingUpload = async (materialId: string) => { await runMaterialAction('confirm', materialId) }

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '—'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
  }

  const formatSpeed = (bytesPerSec: number) => {
    if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(0)} B/s`
    if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`
    return `${(bytesPerSec / 1024 / 1024).toFixed(1)} MB/s`
  }

  const getFileTypeIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || ''
    if (['mp4', 'mov', 'avi', 'webm'].includes(ext)) return { icon: 'movie', color: 'text-red-500', bg: 'bg-red-100' }
    if (['mp3', 'wav', 'm4a', 'ogg', 'flac'].includes(ext)) return { icon: 'music_note', color: 'text-blue-500', bg: 'bg-blue-100' }
    if (['pdf'].includes(ext)) return { icon: 'description', color: 'text-amber-500', bg: 'bg-amber-100' }
    if (['txt', 'docx'].includes(ext)) return { icon: 'article', color: 'text-indigo-500', bg: 'bg-indigo-100' }
    if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return { icon: 'image', color: 'text-green-500', bg: 'bg-green-100' }
    return { icon: 'attach_file', color: 'text-slate-500', bg: 'bg-slate-100' }
  }

  // 完了済み素材数
  const completedMaterials = materials.filter((m) => m.status === 'COMPLETED').length
  const transcribedMaterials = materials.filter((m) => m.transcriptionStatus === 'COMPLETED').length
  // 現在のワークフローステップ
  const currentWorkflowStep = materials.length === 0 ? 0 : transcribedMaterials > 0 ? 2 : completedMaterials > 0 ? 1 : 0

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-0 py-6 sm:py-8 space-y-6 sm:space-y-8">
      {/* ワークフローステッパー */}
      <motion.div
        className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-6"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="overflow-x-auto -mx-1">
          <div className="flex items-center justify-between min-w-[360px] px-1">
            {WORKFLOW_STEPS.map((step, i) => (
              <div key={i} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center transition-all duration-500 ${
                    i < currentWorkflowStep
                      ? 'bg-green-500 shadow-lg shadow-green-500/30'
                      : i === currentWorkflowStep
                      ? 'bg-[#7f19e6] shadow-lg shadow-[#7f19e6]/30 scale-110'
                      : 'bg-slate-100'
                  }`}>
                    <span className={`material-symbols-outlined text-xl sm:text-2xl ${
                      i <= currentWorkflowStep ? 'text-white' : 'text-slate-400'
                    }`}>
                      {i < currentWorkflowStep ? 'check_circle' : step.icon}
                    </span>
                  </div>
                  <p className={`text-[10px] sm:text-xs font-bold mt-1.5 sm:mt-2 whitespace-nowrap ${
                    i === currentWorkflowStep ? 'text-[#7f19e6]' : i < currentWorkflowStep ? 'text-green-600' : 'text-slate-400'
                  }`}>{step.label}</p>
                  <p className="text-[10px] text-slate-400 hidden md:block">{step.desc}</p>
                </div>
                {i < WORKFLOW_STEPS.length - 1 && (
                  <div className={`h-0.5 w-full max-w-[40px] sm:max-w-[60px] mx-0.5 sm:mx-1 rounded-full transition-all duration-500 ${
                    i < currentWorkflowStep ? 'bg-green-400' : 'bg-slate-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ヘッダー */}
      <motion.div
        className="text-center mb-8 sm:mb-12"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#7f19e6]/10 rounded-full text-[#7f19e6] text-xs font-bold mb-4">
          <span className="material-symbols-outlined text-sm">cloud_upload</span>
          STEP 1
        </div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight mb-4">素材アップロード</h1>
        <p className="text-slate-500 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
          {projectTitle || 'インタビュー素材をアップロードして、AIが高精度の文字起こしと記事を自動生成します。'}
        </p>
        {materials.some((m) => m.status === 'COMPLETED') && (
          <motion.button
            onClick={() => router.push(`/interview/projects/${projectId}/skill`)}
            className="mt-6 px-8 py-3.5 bg-gradient-to-r from-[#7f19e6] to-[#a855f7] text-white rounded-xl text-sm font-bold hover:shadow-xl hover:shadow-[#7f19e6]/30 transition-all inline-flex items-center gap-2 group"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            スキル選択へ進む
            <span className="material-symbols-outlined text-lg group-hover:translate-x-1 transition-transform">arrow_forward</span>
          </motion.button>
        )}
      </motion.div>

      <motion.div
        className="bg-white shadow-2xl shadow-[#7f19e6]/5 rounded-2xl overflow-hidden border border-slate-100"
        variants={scaleInVariants}
        initial="hidden"
        animate="show"
      >
        <div className="p-5 sm:p-8 md:p-12">
          {sessionStatus === 'loading' && <p role="status" className="mb-4 text-sm text-slate-600">利用情報を確認しています。確認後にファイルを選択できます。</p>}
          {comparingCount > 0 && <p role="status" className="mb-4 text-sm text-slate-600">同じ名前のファイルの内容を確認しています。大きなファイルは時間がかかる場合があります。</p>}
          {/* ドラッグ&ドロップゾーン */}
          <div
            onDragOver={(e) => { e.preventDefault(); if (sessionStatus !== 'loading') setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => { if (sessionStatus !== 'loading') fileInputRef.current?.click() }}
            aria-disabled={sessionStatus === 'loading'}
            className={`relative border-2 border-dashed flex flex-col items-center justify-center py-12 sm:py-16 md:py-20 px-4 sm:px-6 transition-all group cursor-pointer rounded-2xl overflow-hidden ${
              dragOver
                ? 'border-[#7f19e6] bg-[#7f19e6]/10 scale-[1.01]'
                : 'border-[#7f19e6]/20 bg-gradient-to-b from-[#7f19e6]/5 to-[#7f19e6]/[0.02] hover:bg-[#7f19e6]/10 hover:border-[#7f19e6]/40'
            }`}
          >
            {/* 浮遊アイコン背景 */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {FLOATING_ICONS.map((icon, i) => (
                <motion.span
                  key={i}
                  className="material-symbols-outlined text-[#7f19e6]/[0.07] text-3xl absolute"
                  style={{
                    left: `${10 + (i * 15) % 80}%`,
                    top: `${15 + (i * 23) % 60}%`,
                  }}
                  animate={{
                    y: [0, -12, 0],
                    rotate: [0, i % 2 === 0 ? 8 : -8, 0],
                    scale: [1, 1.1, 1],
                  }}
                  transition={{
                    duration: 3 + i * 0.5,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: i * 0.4,
                  }}
                >
                  {icon}
                </motion.span>
              ))}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              disabled={sessionStatus === 'loading'}
              accept=".mp3,.wav,.m4a,.ogg,.webm,.flac,.mp4,.mov,.avi,.pdf,.txt,.docx,.jpg,.jpeg,.png,.webp"
              onChange={(e) => {
                if (e.target.files) handleFiles(e.target.files)
                e.target.value = ''
              }}
              className="hidden"
            />

            {/* メインアイコン */}
            <motion.div
              className="relative z-10 size-20 bg-white rounded-3xl shadow-xl shadow-[#7f19e6]/10 flex items-center justify-center mb-6"
              animate={dragOver ? { scale: 1.15, rotate: [0, -3, 3, 0] } : { scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <span className="material-symbols-outlined text-[#7f19e6] text-5xl">
                {dragOver ? 'downloading' : 'cloud_upload'}
              </span>
              {/* パルスリング */}
              <motion.div
                className="absolute inset-0 rounded-3xl border-2 border-[#7f19e6]/30"
                animate={{ scale: [1, 1.3, 1.3], opacity: [0.6, 0, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
              />
            </motion.div>

            <h3 className="relative z-10 text-xl font-black mb-2 text-slate-900">
              {sessionStatus === 'loading' ? '利用情報を確認しています' : dragOver ? 'ここにドロップ！' : 'ファイルをドラッグ&ドロップ'}
            </h3>
            <p className="relative z-10 text-slate-500 text-sm mb-4">または下のボタンから選択（1件の上限: ゲスト100MB・無料500MB・LIGHT 1GB・PRO 2GB・Enterprise 5GB。ストレージ設定によって小さくなる場合があります）</p>

            {/* 対応フォーマットバッジ */}
            <div className="relative z-10 flex flex-wrap justify-center gap-1.5 mb-6">
              {SUPPORTED_FORMATS.map((fmt) => (
                <span key={fmt.label} className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${fmt.color}`}>
                  {fmt.label}
                </span>
              ))}
            </div>

            <motion.span
              className="relative z-10 bg-gradient-to-r from-[#7f19e6] to-[#a855f7] text-white px-10 py-3.5 rounded-xl font-bold shadow-lg shadow-[#7f19e6]/25 flex items-center gap-2"
              whileHover={{ scale: 1.04, boxShadow: '0 20px 40px -10px rgba(127, 25, 230, 0.4)' }}
              whileTap={{ scale: 0.97 }}
            >
              <span className="material-symbols-outlined text-xl">add</span>
              ファイルを選択
            </motion.span>
          </div>

          {/* Transcription Settings */}
          <div className="mt-8 pt-6 border-t border-slate-100">
            <h5 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">文字起こし設定</h5>
            <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
              <label className="flex items-center justify-between p-3 sm:p-4 rounded-xl border-2 border-[#7f19e6] bg-[#7f19e6]/5 cursor-pointer">
                <div className="flex gap-3 sm:gap-4 items-center min-w-0">
                  <div className="size-10 bg-[#7f19e6] text-white rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined">record_voice_over</span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-sm sm:text-base">話者分離</p>
                    <p className="text-xs text-slate-500">複数の話者を自動識別</p>
                  </div>
                </div>
                <input type="checkbox" defaultChecked className="form-checkbox h-5 w-5 text-[#7f19e6] rounded border-slate-300 focus:ring-[#7f19e6] flex-shrink-0 ml-2" />
              </label>
              <label className="flex items-center justify-between p-3 sm:p-4 rounded-xl border-2 border-slate-100 hover:border-[#7f19e6]/30 transition-all cursor-pointer">
                <div className="flex gap-3 sm:gap-4 items-center min-w-0">
                  <div className="size-10 bg-slate-100 text-slate-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined">auto_awesome</span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-sm sm:text-base">自動記事生成</p>
                    <p className="text-xs text-slate-500">文字起こし後に即座に記事生成</p>
                  </div>
                </div>
                <input type="checkbox" className="form-checkbox h-5 w-5 text-[#7f19e6] rounded border-slate-300 focus:ring-[#7f19e6] flex-shrink-0 ml-2" />
              </label>
            </div>
          </div>
        </div>
      </motion.div>

      {/* フィーチャーハイライト */}
      <motion.div
        className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-5 mt-8 sm:mt-12"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {[
          { icon: 'speed', title: '高速アップロード', desc: 'Supabase Storage直接転送で大容量ファイルも高速にアップロード。', gradient: 'from-blue-500 to-cyan-500' },
          { icon: 'closed_caption', title: 'AI文字起こし', desc: '音声をAIが文字起こしします。1回の利用時間は残り枠内です。', gradient: 'from-[#7f19e6] to-[#a855f7]' },
          { icon: 'security', title: '安全・セキュア', desc: 'SSL/TLS暗号化転送。音声データはセキュアに保管されます。', gradient: 'from-emerald-500 to-green-500' },
        ].map((feature, i) => (
          <motion.div
            key={i}
            variants={itemVariants}
            className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-lg hover:border-[#7f19e6]/20 transition-all group"
          >
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg`}>
              <span className="material-symbols-outlined text-white text-2xl">{feature.icon}</span>
            </div>
            <h6 className="font-bold text-sm mb-1.5">{feature.title}</h6>
            <p className="text-sm text-slate-500 leading-relaxed">{feature.desc}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* セキュリティ・プライバシーポリシー */}
      <div className="mt-8 sm:mt-12 bg-slate-50 rounded-2xl border border-slate-200 p-5 sm:p-8">
        <div className="flex items-center gap-3 mb-4 sm:mb-6">
          <div className="w-10 h-10 bg-[#7f19e6]/10 rounded-xl flex items-center justify-center">
            <span className="material-symbols-outlined text-[#7f19e6] text-xl">shield</span>
          </div>
          <h3 className="text-lg font-bold text-slate-900">セキュリティ・プライバシーについて</h3>
        </div>
        <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-emerald-500 text-lg mt-0.5">verified_user</span>
              <div>
                <h4 className="text-sm font-bold text-slate-900">暗号化転送・保管</h4>
                <p className="text-xs text-slate-500 leading-relaxed">すべてのファイルはSSL/TLS暗号化で転送され、Supabase Storage上でセキュアに保管されます。</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-emerald-500 text-lg mt-0.5">lock</span>
              <div>
                <h4 className="text-sm font-bold text-slate-900">アクセス制御</h4>
                <p className="text-xs text-slate-500 leading-relaxed">アップロードされたファイルはプロジェクトオーナーのみがアクセス可能です。第三者からのアクセスは遮断されています。</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-emerald-500 text-lg mt-0.5">timer_off</span>
              <div>
                <h4 className="text-sm font-bold text-slate-900">署名付きURL（有効期限付き）</h4>
                <p className="text-xs text-slate-500 leading-relaxed">ファイルへのアクセスURLは7日間の有効期限付き。期限切れ後は自動的にアクセス不可になります。</p>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-emerald-500 text-lg mt-0.5">file_present</span>
              <div>
                <h4 className="text-sm font-bold text-slate-900">ファイル形式の検証</h4>
                <p className="text-xs text-slate-500 leading-relaxed">MIMEタイプとファイル拡張子の二重検証により、不正なファイルのアップロードを防止しています。</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-emerald-500 text-lg mt-0.5">transcribe</span>
              <div>
                <h4 className="text-sm font-bold text-slate-900">文字起こしデータの取扱い</h4>
                <p className="text-xs text-slate-500 leading-relaxed">文字起こし処理はAssemblyAI社のセキュアな環境で実行されます。処理後のデータはお客様のプロジェクト内にのみ保存されます。</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-emerald-500 text-lg mt-0.5">delete_sweep</span>
              <div>
                <h4 className="text-sm font-bold text-slate-900">データ削除</h4>
                <p className="text-xs text-slate-500 leading-relaxed">プロジェクトや素材は、いつでもお客様の操作で完全に削除できます。削除後は復元できません。</p>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-6 pt-4 border-t border-slate-200">
          <p className="text-[11px] text-slate-400 leading-relaxed">
            ※ 本サービスでは、お客様がアップロードしたファイルをAI学習目的で使用することはありません。
            セキュリティに関するご質問やご懸念がございましたら、お気軽にお問い合わせください。
          </p>
        </div>
      </div>

      {/* アップロード進捗 */}
      <AnimatePresence>
      {uploads.size > 0 && (
        <motion.div
          className="space-y-3"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
        >
          {Array.from(uploads.entries()).map(([key, upload]) => {
            const ft = getFileTypeIcon(upload.file.name)
            return (
            <motion.div
              key={key}
              className={`bg-white rounded-2xl p-5 border shadow-sm transition-all ${
                upload.status === 'done' ? 'border-green-200' : upload.status === 'error' ? 'border-red-200' : 'border-[#7f19e6]/20'
              }`}
              layout
            >
              <div className="flex items-center gap-4 mb-3">
                <div className={`w-12 h-12 ${
                  upload.status === 'done' ? 'bg-green-100' : upload.status === 'error' ? 'bg-red-100' : ft.bg
                } rounded-xl flex items-center justify-center flex-shrink-0`}>
                  <span className={`material-symbols-outlined text-2xl ${
                    upload.status === 'done' ? 'text-green-600' : upload.status === 'error' ? 'text-red-600' : ft.color
                  }`}>
                    {upload.status === 'done' ? 'check_circle' : upload.status === 'error' ? 'error' : ft.icon}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{upload.file.name}</p>
                  <span className="text-xs text-slate-500 font-mono">{formatFileSize(upload.file.size)}</span>
                </div>
                <span className={`text-lg font-black tabular-nums ${
                  upload.status === 'done' ? 'text-green-600' : upload.status === 'error' ? 'text-red-600' : 'text-[#7f19e6]'
                }`}>
                  {upload.status === 'done' ? '完了' : upload.status === 'error' ? '' : `${upload.progress}%`}
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <motion.div
                  className={`h-2.5 rounded-full transition-colors duration-300 ${
                    upload.status === 'error'
                      ? 'bg-red-500'
                      : upload.status === 'done'
                      ? 'bg-green-500'
                      : 'bg-gradient-to-r from-[#7f19e6] to-[#a855f7]'
                  }`}
                  initial={{ width: 0 }}
                  animate={{ width: `${upload.progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <div className="flex items-center gap-2 mt-2.5">
                {upload.status === 'uploading' && (
                  <>
                    <span className="material-symbols-outlined text-[#7f19e6] text-sm animate-spin">sync</span>
                    <p className="text-xs text-slate-600">アップロード中...</p>
                  </>
                )}
                {upload.status === 'confirming' && (
                  <>
                    <span className="material-symbols-outlined text-[#7f19e6] text-sm animate-pulse">pending</span>
                    <p className="text-xs text-slate-600">確認処理中...</p>
                  </>
                )}
                {upload.status === 'done' && (
                  <>
                    <span className="material-symbols-outlined text-green-600 text-sm">check_circle</span>
                    <p className="text-xs text-green-600 font-bold">アップロード完了</p>
                  </>
                )}
                {upload.status === 'error' && (
                  <div className="w-full space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-red-600 text-sm flex-shrink-0">error</span>
                      <p className="text-xs text-red-600">{upload.error}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <motion.button
                        onClick={(e) => {
                          e.stopPropagation()
                          const file = upload.file
                          setUploads((prev) => {
                            const next = new Map(prev)
                            next.delete(key)
                            return next
                          })
                          uploadFile(file)
                        }}
                        className="flex items-center gap-1 px-4 py-2 bg-red-500 text-white rounded-xl text-xs font-bold hover:bg-red-600 transition-colors shadow-sm"
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                      >
                        <span className="material-symbols-outlined text-sm">refresh</span>
                        再試行
                      </motion.button>
                      {upload.errorActionUrl && (
                        <motion.a
                          href={upload.errorActionUrl}
                          className="flex items-center gap-1 px-4 py-2 bg-[#7f19e6] text-white rounded-xl text-xs font-bold hover:bg-[#6b12c9] transition-colors shadow-sm"
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                        >
                          <span className="material-symbols-outlined text-sm">
                            {upload.errorActionUrl.includes('signin') ? 'login' : 'upgrade'}
                          </span>
                          {upload.errorActionLabel || '詳細'}
                        </motion.a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
            )
          })}
        </motion.div>
      )}
      </AnimatePresence>

      {/* 文字起こし進捗パネル */}
      <AnimatePresence>
      {transcribing.size > 0 && (
        <motion.div
          className="space-y-3"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          {Array.from(transcribing.entries()).map(([id, info]) => {
            const isActive = info.status === 'starting' || info.status === 'processing'
            const currentStep = isActive ? getCurrentStep(info.startTime) : TRANSCRIPTION_STEPS.length - 1
            const elapsed = isActive ? formatElapsed(info.startTime) : ''

            return (
              <div
                key={id}
                className={`rounded-xl p-6 border-2 transition-all shadow-lg ${
                  info.status === 'completed'
                    ? 'bg-green-50 border-green-200 shadow-green-200/50'
                    : info.status === 'error'
                    ? 'bg-red-50 border-red-200 shadow-red-200/50'
                    : 'bg-blue-50 border-blue-200 shadow-blue-200/50'
                }`}
              >
                {/* ヘッダー */}
                <div className="flex items-start sm:items-center justify-between gap-2 mb-4">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      info.status === 'completed' ? 'bg-green-500' :
                      info.status === 'error' ? 'bg-red-500' : 'bg-[#7f19e6]'
                    }`}>
                      <span className="material-symbols-outlined text-white text-xl sm:text-2xl">
                        {info.status === 'completed' ? 'check_circle' : info.status === 'error' ? 'error' : 'mic'}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-900">
                        {info.status === 'completed'
                          ? '文字起こし完了!'
                          : info.status === 'error'
                          ? '文字起こしエラー'
                          : '文字起こし中...'}
                      </p>
                      <p className="text-xs text-slate-600 truncate">
                        {info.fileName}
                        {info.status === 'completed' && info.durationMinutes && (
                          <span className="ml-1 sm:ml-2 text-green-600 font-bold">
                            ({info.durationMinutes}分完了)
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  {isActive && (
                    <div className="text-right flex-shrink-0">
                      <p className="text-base sm:text-lg font-mono font-bold text-[#7f19e6]">{elapsed}</p>
                      <p className="text-[10px] sm:text-xs text-slate-500">経過時間</p>
                    </div>
                  )}
                </div>

                {info.status === 'processing' && (
                  <button
                    onClick={() => router.push(`/interview/projects/${projectId}/transcribe?materialId=${encodeURIComponent(id)}`)}
                    className="mb-3 rounded-lg bg-[#7f19e6] px-3 py-2 text-xs font-bold text-white hover:bg-[#6b12c9]"
                  >
                    進捗を見る・処理を再開する
                  </button>
                )}

                {/* エラー表示 */}
                {info.status === 'error' && info.error && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 mb-3 bg-red-100 rounded-lg px-3 sm:px-4 py-3">
                    <div className="flex items-start sm:items-center gap-2 text-xs text-red-700 min-w-0">
                      <span className="material-symbols-outlined text-base flex-shrink-0 mt-0.5 sm:mt-0">error</span>
                      <p className="break-words">{info.error}</p>
                    </div>
                    {!info.limitReached && <button
                      onClick={() => {
                        // 進捗パネルから削除して再実行
                        setTranscribing((prev) => {
                          const next = new Map(prev)
                          next.delete(id)
                          return next
                        })
                        startTranscription(id)
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 transition-colors shadow-sm shrink-0 self-start sm:self-auto"
                    >
                      <span className="material-symbols-outlined text-sm">refresh</span>
                      再試行
                    </button>}
                    {info.limitReached && info.limitAction && (
                      <a
                        href={info.limitAction === 'contact' ? SUPPORT_CONTACT_URL : '/interview/pricing'}
                        className="flex items-center gap-1 px-3 py-1.5 bg-[#7f19e6] text-white rounded-lg text-xs font-medium hover:bg-[#6b12c9] transition-colors shadow-sm shrink-0 self-start sm:self-auto"
                      >
                        {info.limitAction === 'contact' ? '追加枠を相談する' : 'プランと無料体験を見る'}
                      </a>
                    )}
                  </div>
                )}

                {/* ステップインジケーター */}
                {info.status !== 'error' && (
                  <div className="flex items-center gap-2">
                    {TRANSCRIPTION_STEPS.map((step, i) => {
                      const isDone = info.status === 'completed' || i < currentStep
                      const isCurrent = isActive && i === currentStep
                      return (
                        <div key={i} className="flex items-center gap-2 flex-1">
                          <div className="flex flex-col items-center flex-1">
                            <div
                              className={`w-full h-2 rounded-full transition-all duration-500 ${
                                isDone
                                  ? 'bg-green-500'
                                  : isCurrent
                                  ? 'bg-[#7f19e6] animate-pulse'
                                  : 'bg-slate-200'
                              }`}
                            />
                            <div className="flex flex-col items-center gap-1 mt-2">
                              <span className={`material-symbols-outlined text-base ${
                                isDone ? 'text-green-600' : isCurrent ? 'text-[#7f19e6]' : 'text-slate-400'
                              }`}>
                                {step.icon}
                              </span>
                              <span
                                className={`text-[10px] ${
                                  isDone
                                    ? 'text-green-600 font-medium'
                                    : isCurrent
                                    ? 'text-[#7f19e6] font-bold'
                                    : 'text-slate-400'
                                }`}
                              >
                                {step.label}
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* ファイルサイズに応じた推定時間 */}
                {isActive && info.fileSize && (
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-4 bg-white/60 rounded-lg px-3 py-2">
                    <span className="material-symbols-outlined text-sm">schedule</span>
                    <p>
                      {info.fileSize > 25 * 1024 * 1024
                        ? '大容量ファイルのため、処理に数分かかる場合があります'
                        : '通常30秒〜2分程度で完了します'}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </motion.div>
      )}
      </AnimatePresence>

      {/* 素材一覧 */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#7f19e6] to-[#a855f7] rounded-xl flex items-center justify-center shadow-lg shadow-[#7f19e6]/20 flex-shrink-0">
              <span className="material-symbols-outlined text-white text-xl">folder</span>
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-slate-900">アップロード済み素材</h2>
              <p className="text-xs text-slate-500">{materials.length}件のファイル{transcribedMaterials > 0 && ` · ${transcribedMaterials}件文字起こし済み`}</p>
            </div>
          </div>
          {materials.length > 0 && (
            <div className="flex items-center gap-3 text-xs text-slate-500 pl-[52px] sm:pl-0">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500" />完了
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#7f19e6] animate-pulse" />処理中
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500" />エラー
              </span>
            </div>
          )}
        </div>

        {materialActionError && (
          <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <p>{materialActionError.message}</p>
            {materialActionError.actionUrl && <a href={materialActionError.actionUrl} className="mt-2 inline-block font-bold underline">{materialActionError.actionUrl === SUPPORT_CONTACT_URL ? '容量について相談する' : materialActionError.actionUrl.startsWith('/auth/') ? 'ログインする' : 'プランと無料体験を見る'}</a>}
            <button type="button" onClick={() => fetchProject(true)} className="ml-3 mt-2 font-bold underline">素材一覧を更新</button>
          </div>
        )}
        {projectError && (
          <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
            素材一覧を読み込めませんでした。表示中の素材がある場合は更新前の情報です。
            <button type="button" onClick={fetchProject} className="ml-3 underline">再試行</button>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm animate-pulse flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-200 rounded-xl" />
                <div className="flex-1">
                  <div className="h-4 bg-slate-200 rounded-lg w-1/3 mb-2" />
                  <div className="h-3 bg-slate-100 rounded-lg w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : projectError && materials.length === 0 ? (
          <div className="rounded-2xl border border-red-100 bg-white p-8 text-center text-sm font-bold text-slate-500">素材を表示できません</div>
        ) : materials.length === 0 ? (
          <motion.div
            className="text-center py-16 bg-gradient-to-b from-slate-50 to-white rounded-2xl border-2 border-dashed border-slate-200"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              <span className="material-symbols-outlined text-slate-200 text-7xl mb-4 block">inventory_2</span>
            </motion.div>
            <p className="text-base font-bold text-slate-400 mb-1">まだ素材がありません</p>
            <p className="text-sm text-slate-400">上のエリアからファイルをアップロードしてください</p>
          </motion.div>
        ) : (
          <motion.div
            className="space-y-3"
            variants={containerVariants}
            initial="hidden"
            animate="show"
          >
            {materials.map((m) => {
              const isTranscribing = transcribing.has(m.id)
              const transcriptionInfo = transcribing.get(m.id)
              const ft = getFileTypeIcon(m.fileName)

              return (
                <motion.div
                  key={m.id}
                  variants={itemVariants}
                  className={`bg-white rounded-2xl overflow-hidden border transition-all shadow-sm group ${
                    isTranscribing && transcriptionInfo?.status !== 'completed'
                      ? 'border-[#7f19e6]/30 shadow-[#7f19e6]/10'
                      : m.transcriptionStatus === 'COMPLETED'
                      ? 'border-green-200 hover:shadow-lg hover:shadow-green-100'
                      : m.status === 'ERROR'
                      ? 'border-red-200 hover:shadow-lg hover:shadow-red-100'
                      : 'border-slate-100 hover:border-[#7f19e6]/20 hover:shadow-lg'
                  }`}
                  whileHover={{ y: -1 }}
                >
                  <div className="p-4 sm:p-5">
                    <div className="flex items-center gap-3 sm:gap-4">
                      {/* ファイルタイプアイコン（左ボーダーグラデーション付き） */}
                      <div className="relative flex-shrink-0">
                        <div className={`w-11 h-11 sm:w-14 sm:h-14 ${ft.bg} rounded-xl sm:rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform`}>
                          <span className={`material-symbols-outlined ${ft.color} text-xl sm:text-2xl`}>{ft.icon}</span>
                        </div>
                        {/* ステータスバッジ */}
                        {m.transcriptionStatus === 'COMPLETED' && (
                          <div className="absolute -bottom-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 bg-green-500 rounded-lg flex items-center justify-center shadow-md">
                            <span className="material-symbols-outlined text-white text-xs sm:text-sm">check</span>
                          </div>
                        )}
                        {m.status === 'ERROR' && (
                          <div className="absolute -bottom-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 bg-red-500 rounded-lg flex items-center justify-center shadow-md">
                            <span className="material-symbols-outlined text-white text-xs sm:text-sm">priority_high</span>
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate mb-1.5">{m.fileName}</p>
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                          <span className="text-[10px] sm:text-[11px] font-mono text-slate-500 bg-slate-100 px-1.5 sm:px-2 py-0.5 rounded-md">{formatFileSize(m.fileSize)}</span>
                          <span className="text-[10px] sm:text-[11px] text-slate-500 bg-slate-100 px-1.5 sm:px-2 py-0.5 rounded-md capitalize">{m.type}</span>
                          {m.transcriptionStatus === 'COMPLETED' && (
                            <span className="text-[10px] sm:text-[11px] text-green-700 font-bold bg-green-100 px-2 sm:px-2.5 py-0.5 rounded-full flex items-center gap-1">
                              <span className="material-symbols-outlined text-xs">check_circle</span>
                              <span className="hidden sm:inline">文字起こし完了</span>
                              <span className="sm:hidden">完了</span>
                            </span>
                          )}
                          {m.status === 'ERROR' && (
                            <span className="text-[10px] sm:text-[11px] text-red-700 font-medium bg-red-100 px-2 sm:px-2.5 py-0.5 rounded-full flex items-center gap-1">
                              <span className="material-symbols-outlined text-xs">error</span>
                              {m.error || 'エラー'}
                            </span>
                          )}
                          {m.status === 'UPLOADED' && (
                            <span className="text-[10px] sm:text-[11px] text-amber-700 font-bold bg-amber-100 px-2 sm:px-2.5 py-0.5 rounded-full">アップロード確認待ち</span>
                          )}
                        </div>
                      </div>

                      {/* デスクトップ: 削除ボタンのみ横に表示 */}
                      <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
                        {m.status === 'UPLOADED' && (
                          <button type="button" onClick={() => confirmPendingUpload(m.id)} disabled={confirmingMaterialId !== null}
                            className="px-4 py-2.5 text-xs font-bold text-amber-800 bg-amber-100 rounded-xl hover:bg-amber-200 disabled:opacity-50">
                            {confirmingMaterialId === m.id ? '確認中…' : 'アップロードを確認'}
                          </button>
                        )}
                        {/* 素材自体がERRORの場合の再アップロードボタン */}
                        {m.status === 'ERROR' && (
                          <motion.button
                            onClick={() => fileInputRef.current?.click()}
                            className="px-4 py-2.5 text-xs font-bold text-white bg-red-500 rounded-xl hover:bg-red-600 transition-all flex items-center gap-1.5 shadow-lg shadow-red-500/20"
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                          >
                            <span className="material-symbols-outlined text-base">refresh</span>
                            再アップロード
                          </motion.button>
                        )}
                        {(m.type === 'audio' || m.type === 'video') &&
                          (m.status === 'COMPLETED' || (m.status === 'ERROR' && m.transcriptionStatus === 'ERROR')) &&
                          m.transcriptionStatus !== 'COMPLETED' &&
                          m.transcriptionStatus !== 'PROCESSING' &&
                          !isTranscribing && (
                            <motion.button
                              onClick={() => startTranscription(m.id)}
                              className={`px-5 py-2.5 text-xs font-bold text-white rounded-xl transition-all flex items-center gap-1.5 ${
                                m.transcriptionStatus === 'ERROR'
                                  ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/20'
                                  : 'bg-gradient-to-r from-[#7f19e6] to-[#a855f7] hover:shadow-xl shadow-lg shadow-[#7f19e6]/20'
                              }`}
                              whileHover={{ scale: 1.03 }}
                              whileTap={{ scale: 0.97 }}
                            >
                              <span className="material-symbols-outlined text-base">
                                {m.transcriptionStatus === 'ERROR' ? 'refresh' : 'transcribe'}
                              </span>
                              {m.transcriptionStatus === 'ERROR' ? '再試行' : '文字起こし'}
                            </motion.button>
                          )}
                        {(isTranscribing && transcriptionInfo?.status !== 'completed') && (
                          <span className="px-4 py-2.5 text-[11px] bg-[#7f19e6]/10 text-[#7f19e6] font-bold rounded-xl flex items-center gap-1.5 border border-[#7f19e6]/20">
                            <span className="material-symbols-outlined text-base animate-spin">sync</span>
                            処理中
                          </span>
                        )}
                        {!isTranscribing && m.transcriptionStatus === 'PROCESSING' && (
                          <span className="px-4 py-2.5 text-[11px] bg-[#7f19e6]/10 text-[#7f19e6] font-bold rounded-xl flex items-center gap-1.5 border border-[#7f19e6]/20">
                            <span className="material-symbols-outlined text-base animate-spin">sync</span>
                            処理中
                          </span>
                        )}
                        <button
                          onClick={() => deleteMaterial(m.id)}
                          className="p-2.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors opacity-0 group-hover:opacity-100"
                          title="削除"
                        >
                          <span className="material-symbols-outlined text-xl">delete</span>
                        </button>
                      </div>
                    </div>

                    {/* モバイル: アクションボタンを下に配置 */}
                    <div className="flex sm:hidden items-center gap-2 mt-3 pl-14">
                      {m.status === 'UPLOADED' && (
                        <button type="button" onClick={() => confirmPendingUpload(m.id)} disabled={confirmingMaterialId !== null}
                          className="px-3 py-2 text-xs font-bold text-amber-800 bg-amber-100 rounded-lg disabled:opacity-50">
                          {confirmingMaterialId === m.id ? '確認中…' : 'アップロードを確認'}
                        </button>
                      )}
                      {m.status === 'ERROR' && (
                        <motion.button
                          onClick={() => fileInputRef.current?.click()}
                          className="px-3 py-2 text-xs font-bold text-white bg-red-500 rounded-lg hover:bg-red-600 transition-all flex items-center gap-1 shadow-sm"
                          whileTap={{ scale: 0.97 }}
                        >
                          <span className="material-symbols-outlined text-sm">refresh</span>
                          再アップロード
                        </motion.button>
                      )}
                      {(m.type === 'audio' || m.type === 'video') &&
                        (m.status === 'COMPLETED' || (m.status === 'ERROR' && m.transcriptionStatus === 'ERROR')) &&
                        m.transcriptionStatus !== 'COMPLETED' &&
                        m.transcriptionStatus !== 'PROCESSING' &&
                        !isTranscribing && (
                          <motion.button
                            onClick={() => startTranscription(m.id)}
                            className={`px-3 py-2 text-xs font-bold text-white rounded-lg transition-all flex items-center gap-1 ${
                              m.transcriptionStatus === 'ERROR'
                                ? 'bg-red-500 hover:bg-red-600 shadow-sm'
                                : 'bg-gradient-to-r from-[#7f19e6] to-[#a855f7] shadow-sm'
                            }`}
                            whileTap={{ scale: 0.97 }}
                          >
                            <span className="material-symbols-outlined text-sm">
                              {m.transcriptionStatus === 'ERROR' ? 'refresh' : 'transcribe'}
                            </span>
                            {m.transcriptionStatus === 'ERROR' ? '再試行' : '文字起こし'}
                          </motion.button>
                        )}
                      {(isTranscribing && transcriptionInfo?.status !== 'completed') && (
                        <span className="px-3 py-2 text-[11px] bg-[#7f19e6]/10 text-[#7f19e6] font-bold rounded-lg flex items-center gap-1 border border-[#7f19e6]/20">
                          <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                          処理中
                        </span>
                      )}
                      {!isTranscribing && m.transcriptionStatus === 'PROCESSING' && (
                        <span className="px-3 py-2 text-[11px] bg-[#7f19e6]/10 text-[#7f19e6] font-bold rounded-lg flex items-center gap-1 border border-[#7f19e6]/20">
                          <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                          処理中
                        </span>
                      )}
                      <button
                        onClick={() => deleteMaterial(m.id)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-auto"
                        title="削除"
                      >
                        <span className="material-symbols-outlined text-lg">delete</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </div>

      {/* アップロード中モーダル */}
      <AnimatePresence>
        {Array.from(uploads.values()).some((u) => u.status === 'uploading' || u.status === 'confirming') && (() => {
          const activeUploads = Array.from(uploads.entries()).filter(([, u]) => u.status === 'uploading' || u.status === 'confirming')
          const totalProgress = activeUploads.length > 0
            ? Math.round(activeUploads.reduce((sum, [, u]) => sum + u.progress, 0) / activeUploads.length)
            : 0
          const circumference = 2 * Math.PI * 54
          const strokeDashoffset = circumference - (totalProgress / 100) * circumference

          return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden"
            >
              {/* 円形プログレスヘッダー */}
              <div className="relative px-6 pt-8 pb-4">
                {/* 背景グラデーション */}
                <div className="absolute inset-0 bg-gradient-to-b from-[#7f19e6]/5 to-transparent rounded-t-3xl" />

                <div className="relative flex flex-col items-center">
                  {/* 円形プログレスリング */}
                  <div className="relative w-32 h-32 mb-4">
                    <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
                      {/* 背景リング */}
                      <circle cx="60" cy="60" r="54" fill="none" stroke="#e2e8f0" strokeWidth="6" />
                      {/* プログレスリング */}
                      <motion.circle
                        cx="60" cy="60" r="54" fill="none"
                        stroke="url(#progressGradient)" strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        initial={{ strokeDashoffset: circumference }}
                        animate={{ strokeDashoffset }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                      />
                      <defs>
                        <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#7f19e6" />
                          <stop offset="100%" stopColor="#a855f7" />
                        </linearGradient>
                      </defs>
                    </svg>
                    {/* 中央のパーセンテージ */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-black text-[#7f19e6] tabular-nums">{totalProgress}</span>
                      <span className="text-[10px] font-bold text-slate-400 -mt-1">%</span>
                    </div>
                  </div>

                  <h3 className="text-lg font-black text-slate-900 mb-1">
                    {totalProgress === 100 ? '確認処理中...' : 'アップロード中...'}
                  </h3>
                  <p className="text-xs text-slate-500">このページを離れないでください</p>
                </div>
              </div>

              {/* ファイル別プログレス */}
              <div className="px-6 py-4 space-y-3">
                {activeUploads.map(([key, upload]) => {
                  const ft = getFileTypeIcon(upload.file.name)
                  const speedInfo = uploadSpeedRef.current.get(key)
                  const speed = speedInfo?.speed || 0
                  const remaining = speed > 0 ? (upload.file.size * (1 - upload.progress / 100)) / speed : 0

                  return (
                    <div key={key} className="bg-slate-50 rounded-xl p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-10 h-10 ${ft.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                          <span className={`material-symbols-outlined ${ft.color} text-xl`}>{ft.icon}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">{upload.file.name}</p>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500">
                            <span className="font-mono">{formatFileSize(upload.file.size)}</span>
                            {speed > 0 && upload.status === 'uploading' && (
                              <>
                                <span>·</span>
                                <span className="text-[#7f19e6] font-medium">{formatSpeed(speed)}</span>
                                {remaining > 0 && remaining < 3600 && (
                                  <>
                                    <span>·</span>
                                    <span>残り{remaining < 60 ? `${Math.ceil(remaining)}秒` : `${Math.ceil(remaining / 60)}分`}</span>
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                        <span className="text-sm font-bold text-[#7f19e6] tabular-nums">{upload.progress}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-[#7f19e6] to-[#a855f7]"
                          initial={{ width: 0 }}
                          animate={{ width: `${upload.progress}%` }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Tips section */}
              <div className="mx-6 mb-6 p-4 bg-gradient-to-r from-[#7f19e6]/5 to-[#a855f7]/5 rounded-xl border border-[#7f19e6]/10">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={tipIndex}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="flex items-start gap-3"
                  >
                    <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
                      <span className="material-symbols-outlined text-[#7f19e6] text-lg">{UPLOAD_TIPS[tipIndex].icon}</span>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-[#7f19e6]/60 uppercase tracking-wider mb-0.5">豆知識</p>
                      <p className="text-sm text-slate-600 leading-relaxed">{UPLOAD_TIPS[tipIndex].text}</p>
                    </div>
                  </motion.div>
                </AnimatePresence>
                {/* ドットインジケーター */}
                <div className="flex justify-center gap-1.5 mt-3">
                  {UPLOAD_TIPS.map((_, i) => (
                    <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${i === tipIndex ? 'bg-[#7f19e6] w-4' : 'bg-slate-300'}`} />
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
          )
        })()}
      </AnimatePresence>
    </div>
  )
}
