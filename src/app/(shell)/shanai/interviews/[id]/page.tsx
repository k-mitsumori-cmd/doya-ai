'use client'

// ドヤ社内インタビュー インタビュー詳細
// 流れ: ① 素材（録音 or アンケート）→ ② 写真 → ③ 事実の確認 → ④ 記事の生成・編集・Word/サムネの書き出し
// ⚠️ 記事は ③ で確認した事実だけから書く。根拠のない段落は ④ で警告を出す
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  AlertTriangle, ArrowLeft, Check, ClipboardList, Copy, Download, FileText, ImagePlus, Loader2, Mic, RefreshCw, Sparkles, Star, Trash2, Upload,
} from 'lucide-react'
import toast from 'react-hot-toast'
import SurveyForm from '@/components/shanai/SurveyForm'
import {
  ActionError, api, Button, Card, ConfirmDialog, describeError, ErrorState, Field, ForbiddenState, inputCls, Notice, PageSkeleton, ProgressSteps, SectionTitle, StatusBadge, uploadToInterview, useLeaveGuard, useTimedStep, PageTitle,
} from '@/components/shanai/ui'
import { ErrorNotice } from '@/components/ds'
import { FACT_CATEGORY_LABELS, type ArticleBlock, type FactCategory, type SurveyAnswers } from '@/lib/shanai/types'
import { findQuestion } from '@/lib/shanai/survey'
import { ShellCostBadge, useDoyaPowerRetry } from '@/components/shell/power'

interface Photo { id: string; usage: string; caption: string; url: string | null }
interface Fact { id: string; sourceType: 'transcript' | 'answer' | 'company'; sourceRef: string; category: FactCategory; statement: string; quote: string; approved: boolean }
interface Article { id: string; version: number; title: string; lead: string; catchphrase: string; blocks: ArticleBlock[] }
interface Detail {
  id: string
  mode: 'voice' | 'survey'
  status: string
  intervieweeName: string
  department: string
  position: string
  joinYear: string
  survey: { token: string; answers: SurveyAnswers; submittedAt: string | null; check: { score: number; canSubmit: boolean; missing: { id: string; question: string; have: number; need: number }[] } }
  audio: { uploaded: boolean; size: number | null; durationSec: number | null; status: string; error: string | null; runs: number; segments: { start: number; speaker?: string; text: string }[] }
  photos: Photo[]
  facts: Fact[]
  article: Article | null
}

function fmtTime(sec: number) {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/** 処理の失敗。err は失敗の中身（status 付き）。無いときは、この画面で作った文（message）だけ */
type SectionError = { message: string; upgradeUrl?: string; err?: unknown }

/** 新しい見た目のキーボード操作の枠（focus-visible）。小さなアイコンボタンは 44px 四方にする */
const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)]'
const ICON_BTN_NEXT = `grid h-11 w-11 shrink-0 place-items-center rounded-lg text-[var(--muted)] hover:bg-rose-50 hover:text-rose-600 ${FOCUS}`

function LimitNotice({ error }: { error: SectionError | null }) {
  if (!error) return null
  // 新しい見た目: 生の文は出さない。上限なら料金プランへの道、それ以外は「何が起きたか・どうすればよいか」
  return error.err === undefined ? <ErrorNotice what={error.message} /> : <ActionError error={describeError(error.err)} />
}

export default function ShanaiInterviewPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [data, setData] = useState<Detail | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadFailure, setLoadFailure] = useState<unknown>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const load = useCallback(async () => {
    try {
      const d = await api<{ interview: Detail }>(`/api/shanai/interviews/${id}`)
      setData(d.interview)
    } catch (e) {
      const status = (e as any)?.status
      if (status === 401) window.location.href = `/auth/signin?callbackUrl=/shanai/interviews/${id}`
      setLoadError(status === 404 || status === 403 ? 'forbidden' : (e as Error).message)
      setLoadFailure(e)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  if (loadError) return loadError === 'forbidden' ? <ForbiddenState /> : <ErrorState message={loadError} error={loadFailure} onRetry={() => void load()} />
  if (!data) return <PageSkeleton variant="detail" />

  const remove = async () => {
    setConfirmDelete(false)
    try {
      await api(`/api/shanai/interviews/${id}`, { method: 'DELETE' })
      toast.success('削除しました', { duration: 3000 })
      router.push('/shanai')
    } catch (e) {
      toast.error(describeError(e).what)
    }
  }

  const materialReady = data.mode === 'voice' ? data.audio.status === 'done' : !!data.survey.submittedAt || data.survey.check.canSubmit

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <Link
        href="/shanai"
        className={`inline-flex items-center gap-1 text-xs font-black text-[var(--sub)] hover:text-[var(--ink)] -my-2 min-h-11 rounded-[var(--r-sm)] ${FOCUS}`}
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> インタビュー一覧
      </Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 [overflow-wrap:anywhere]">
          <PageTitle>{data.intervieweeName} さん</PageTitle>
          <p className="mt-1 text-sm font-bold text-[var(--sub)]">{[data.department, data.position, data.joinYear && `${data.joinYear}入社`].filter(Boolean).join(' / ') || '部署未設定'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={data.status} />
          <Button variant="danger" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-4 w-4" />
            削除
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={`${data.intervieweeName}さんのインタビューを削除しますか？`}
        body="録音・写真・記事もすべて削除され、元に戻せません。"
        confirmLabel="削除する"
        danger
        onConfirm={() => void remove()}
        onClose={() => setConfirmDelete(false)}
      />

      <div className="mt-6 space-y-4">
        {data.mode === 'voice' ? <VoiceSection data={data} onChange={setData} reload={load} /> : <SurveySection data={data} onChange={setData} />}
        <PhotoSection data={data} onChange={setData} />
        <FactSection data={data} onChange={setData} materialReady={materialReady} />
        <ArticleSection data={data} onChange={setData} />
      </div>
    </div>
  )
}

// ---------- ① 録音 ----------

function VoiceSection({ data, onChange, reload }: { data: Detail; onChange: (d: Detail) => void; reload: () => Promise<void> }) {
  const [progress, setProgress] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<SectionError | null>(null)
  const [showAll, setShowAll] = useState(false)
  const transcribeStep = useTimedStep(busy, 3, 20000)
  const inputRef = useRef<HTMLInputElement>(null)
  const cancelled = useRef(false)

  useEffect(() => () => void (cancelled.current = true), [])

  const upload = async (file: File) => {
    setError(null)
    setProgress(0)
    try {
      const d = await uploadToInterview(data.id, 'audio', file, setProgress)
      onChange(d.interview)
    } catch (e) {
      setError({ message: (e as Error).message, err: e })
    } finally {
      setProgress(null)
    }
  }

  // 文字起こしは長いと4分を超えるため、終わるまで呼び直す（2回目以降は完了待ちだけで追加の費用は出ない）
  const transcribe = async () => {
    setBusy(true)
    setError(null)
    try {
      for (let i = 0; i < 6 && !cancelled.current; i++) {
        const d = await api<{ pending?: boolean; interview?: Detail }>(`/api/shanai/interviews/${data.id}/transcribe`, { method: 'POST' })
        if (!d.pending && d.interview) {
          onChange(d.interview)
          return
        }
      }
      setError({ message: '文字起こしに時間がかかっています。しばらくしてからもう一度「文字起こしする」を押してください（追加の費用はかかりません）。' })
    } catch (e) {
      const err = e as Error & { data?: any }
      setError({ message: err.message, upgradeUrl: err.data?.upgradeUrl, err })
      await reload()
    } finally {
      setBusy(false)
    }
  }

  const segs = data.audio.segments
  return (
    <Card>
      <SectionTitle step="ステップ1" title="録音" desc="mp3・m4a・wav・mp4 などの録音ファイルをアップロードしてください（90分・1GBまで）。" />
      <input ref={inputRef} type="file" accept="audio/*,video/mp4,video/quicktime" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      <div className="flex flex-wrap items-center gap-2">
        <Button variant={data.audio.uploaded ? 'secondary' : 'primary'} onClick={() => inputRef.current?.click()} disabled={progress !== null || busy}>
          <Upload className="h-4 w-4" aria-hidden="true" />
          {data.audio.uploaded ? '録音を差し替える' : '録音をアップロード'}
        </Button>
        {data.audio.uploaded && data.audio.status !== 'done' && (
          <Button onClick={transcribe} loading={busy}>
            <Mic className="h-4 w-4" />
            文字起こしする
          </Button>
        )}
        {progress !== null && <span className="text-xs font-black text-[var(--sub)]" role="status">アップロード中 {progress}%</span>}
        {data.audio.uploaded && data.audio.size && progress === null && (
          <span className="text-xs font-bold text-[var(--muted)]">
            {(data.audio.size / 1024 / 1024).toFixed(1)}MB{data.audio.durationSec ? ` / ${fmtTime(data.audio.durationSec)}` : ''}
          </span>
        )}
      </div>
      {busy && <ProgressSteps steps={['録音の長さを確認しています', '文字起こしサービスに送っています', '話者を分けて文字にしています']} current={transcribeStep} note="30分の録音で数分かかります。" />}
      {data.audio.status === 'failed' && data.audio.error && !error && (
        <div className="mt-3">
          <ErrorNotice what="文字起こしができませんでした。" how="録音ファイルの形式（mp3・m4a・wav など）を確かめて、もう一度「文字起こしする」を押してください。続くときは、録音を差し替えてください。" />
        </div>
      )}
      {error && (
        <div className="mt-3">
          <LimitNotice error={error} />
        </div>
      )}
      {segs.length > 0 && (
        <div className="mt-4 rounded-[var(--r-sm)] border border-[var(--line)] bg-[var(--bg)] p-3">
          <p className="text-xs font-black text-[var(--sub)]">文字起こし（{segs.length}件の発言）</p>
          <ul className="mt-2 max-h-[360px] space-y-1.5 overflow-y-auto pr-1 text-sm">
            {(showAll ? segs : segs.slice(0, 12)).map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="w-12 shrink-0 font-mono text-[11px] text-[var(--muted)]">{fmtTime(s.start)}</span>
                <span className="w-14 shrink-0 text-[11px] font-black text-[var(--blue-deep)]">{s.speaker ? `話者${s.speaker}` : '話者'}</span>
                <span className="font-bold leading-relaxed text-[var(--sub)] min-w-0 [overflow-wrap:anywhere]">{s.text}</span>
              </li>
            ))}
          </ul>
          {segs.length > 12 && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              aria-expanded={showAll}
              className={`mt-2 text-xs font-black text-[var(--blue-deep)] -mb-2 min-h-11 rounded-[var(--r-sm)] px-1 ${FOCUS}`}
            >
              {showAll ? '閉じる' : 'すべて表示'}
            </button>
          )}
        </div>
      )}
    </Card>
  )
}

// ---------- ① アンケート ----------

function SurveySection({ data, onChange }: { data: Detail; onChange: (d: Detail) => void }) {
  const [answers, setAnswers] = useState<SurveyAnswers>(data.survey.answers)
  const [saving, setSaving] = useState(false)
  const [asking, setAsking] = useState(false)
  const [copied, setCopied] = useState(false)
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState<{ tone: 'info' | 'error' | 'warn'; text: string; err?: unknown } | null>(null)
  const [confirmRotate, setConfirmRotate] = useState(false)
  const rotate = async () => {
    setConfirmRotate(false)
    try {
      const d = await api<{ interview: Detail }>(`/api/shanai/interviews/${data.id}/survey`, { method: 'POST', json: { action: 'rotateToken' } })
      onChange(d.interview)
      toast.success('新しい回答URLを作りました。前のURLは使えなくなりました。', { duration: 3000 })
    } catch (e) {
      toast.error(describeError(e).what)
    }
  }
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/shanai/answer/${data.survey.token}` : ''
  const submitted = !!data.survey.submittedAt

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error('コピーできませんでした。URLを選択してコピーしてください。')
    }
  }

  const refresh = async () => {
    const d = await api<{ interview: Detail }>(`/api/shanai/interviews/${data.id}`)
    onChange(d.interview)
    setAnswers(d.interview.survey.answers)
  }

  const save = async () => {
    setSaving(true)
    setMessage(null)
    try {
      await api(`/api/shanai/interviews/${data.id}/survey`, { method: 'PUT', json: { answers } })
      await refresh()
      setMessage({ tone: 'info', text: '保存しました。' })
    } catch (e) {
      setMessage({ tone: 'error', text: (e as Error).message, err: e })
    } finally {
      setSaving(false)
    }
  }

  const followups = async () => {
    setAsking(true)
    setMessage(null)
    try {
      const d = await api<{ answers: SurveyAnswers; added: number }>(`/api/shanai/interviews/${data.id}/followups`, { method: 'POST', json: { answers } })
      setAnswers(d.answers)
      setMessage({ tone: d.added ? 'info' : 'warn', text: d.added ? `${d.added}件の設問に追加の質問を作りました。` : '追加で聞くべき設問は見つかりませんでした。' })
    } catch (e) {
      setMessage({ tone: 'error', text: (e as Error).message, err: e })
    } finally {
      setAsking(false)
    }
  }

  const submit = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const d = await api<{ interview: Detail }>(`/api/shanai/interviews/${data.id}/survey`, { method: 'POST', json: { answers } })
      onChange(d.interview)
      setMessage({ tone: 'info', text: '回答を確定しました。次は事実の抽出です。' })
    } catch (e) {
      setMessage({ tone: 'error', text: (e as Error).message, err: e })
    } finally {
      setSaving(false)
    }
  }

  const check = data.survey.check
  return (
    <Card>
      <SectionTitle step="ステップ1" title="アンケート" desc="下のURLを社員の方に送ってください。ログインは不要です。担当者がこの画面で代わりに入力することもできます。" />
      <div className="flex flex-wrap items-center gap-2 rounded-[var(--r-sm)] border border-[var(--line)] bg-[var(--bg)] p-2">
        <code className="min-w-0 flex-1 truncate px-2 text-xs font-bold text-[var(--sub)]">{shareUrl}</code>
        <button type="button" onClick={copy} className={`min-h-11 whitespace-nowrap ${FOCUS} focus-visible:ring-offset-2 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black text-white ${copied ? 'bg-[var(--ok-bg)]' : 'bg-[var(--blue)] hover:bg-[var(--blue-deep)]'}`}>
          {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
          {copied ? 'コピーしました' : 'URLをコピー'}
        </button>
        <span className="sr-only" role="status">{copied ? '回答URLをコピーしました' : ''}</span>
        {!submitted && (
          <button type="button" onClick={() => setConfirmRotate(true)} className={`min-h-[44px] rounded-[var(--r-sm)] px-3 text-xs font-black text-[var(--sub)] hover:bg-[var(--paper)] whitespace-nowrap ${FOCUS}`}>
            URLを作り直す
          </button>
        )}
      </div>
      <ConfirmDialog
        open={confirmRotate}
        title="回答URLを作り直しますか？"
        body="送り先を間違えたときに使います。前のURLは開けなくなります。書きかけの回答は残ります。"
        confirmLabel="作り直す"
        onConfirm={() => void rotate()}
        onClose={() => setConfirmRotate(false)}
      />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1 basis-48">
          <div className="flex items-center justify-between text-xs font-black text-[var(--sub)]">
            <span id="shanai-survey-score">回答の充実度</span>
            <span className="tabular-nums">{check.score}%</span>
          </div>
          <div
            className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--bg)]"
            {...({ role: 'progressbar', 'aria-labelledby': 'shanai-survey-score', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': check.score })}
          >
            <div className="h-full rounded-full bg-[var(--blue)] transition-all motion-reduce:transition-none" style={{ width: `${check.score}%` }} />
          </div>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${submitted ? 'bg-[var(--ok-bg)] text-[var(--ok-ink)]' : 'bg-[var(--bg)] text-[var(--sub)]'}`}>
          {submitted ? '提出済み' : check.canSubmit ? '提出できます' : `足りない設問 ${check.missing.length}件`}
        </span>
        <Button variant="ghost" onClick={refresh}>
          <RefreshCw className="h-4 w-4" />
          最新にする
        </Button>
      </div>

      {message && (
        <div className="mt-3">
          {message.tone === 'error' ? <ActionError error={describeError(message.err)} /> : <Notice tone={message.tone}>{message.text}</Notice>}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`mt-4 text-sm font-black text-[var(--blue-deep)] min-h-11 rounded-[var(--r-sm)] px-1 text-left ${FOCUS}`}
      >
        {open ? '回答を閉じる' : '回答を見る・代わりに入力する'}
      </button>
      {open && (
        <div className="mt-4">
          <SurveyForm answers={answers} onChange={setAnswers} disabled={submitted} />
          {!submitted && (
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={followups} loading={asking} disabled={saving}>
                <Sparkles className="h-4 w-4" />
                短い回答に追加質問を作る
              </Button>
              <Button variant="secondary" onClick={save} loading={saving} disabled={asking}>
                保存
              </Button>
              <Button onClick={submit} loading={saving} disabled={asking}>
                回答を確定
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

// ---------- ② 写真 ----------

function PhotoSection({ data, onChange }: { data: Detail; onChange: (d: Detail) => void }) {
  const [uploading, setUploading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // 失敗の中身（新しい見た目では生の文ではなく、ここから伝える文を組み立てる）
  const [failure, setFailure] = useState<unknown>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fail = (e: unknown) => {
    setError((e as Error).message)
    setFailure(e)
  }

  const upload = async (files: FileList) => {
    setError(null)
    for (const file of Array.from(files)) {
      setUploading(file.name)
      try {
        const d = await uploadToInterview(data.id, 'photo', file)
        onChange(d.interview)
      } catch (e) {
        fail(e)
        break
      }
    }
    setUploading(null)
  }

  const patch = async (photoId: string, body: object) => {
    try {
      const d = await api<{ interview: Detail }>(`/api/shanai/interviews/${data.id}/photos/${photoId}`, { method: 'PATCH', json: body })
      onChange(d.interview)
    } catch (e) {
      fail(e)
    }
  }

  const remove = async (photoId: string) => {
    try {
      const d = await api<{ interview: Detail }>(`/api/shanai/interviews/${data.id}/photos/${photoId}`, { method: 'DELETE' })
      onChange(d.interview)
    } catch (e) {
      fail(e)
    }
  }

  return (
    <Card>
      <SectionTitle step="ステップ2" title="写真" desc="ご本人の写真は3〜5枚がおすすめです（8枚まで）。星印を付けた写真をサムネに使います。" />
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => e.target.files && upload(e.target.files)} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {data.photos.map((p) => (
          <div key={p.id} className={`overflow-hidden rounded-[var(--r-sm)] border ${p.usage === 'thumbnail' ? 'border-[var(--blue)] ring-2 ring-[var(--blue-line)]' : 'border-[var(--line)]'}`}>
            <div className="relative aspect-[4/3] bg-[var(--bg)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {p.url && <img src={p.url} alt={p.caption || '社員の写真'} className="h-full w-full object-cover" />}
              <button
                type="button"
                onClick={() => patch(p.id, { usage: 'thumbnail' })}
                aria-pressed={p.usage === 'thumbnail'}
                className={`grid h-11 w-11 place-items-center ${FOCUS} absolute left-1.5 top-1.5 rounded-full p-1.5 ${p.usage === 'thumbnail' ? 'bg-[var(--blue)] text-white' : 'bg-[var(--paper)] text-[var(--sub)] hover:text-[var(--blue-deep)]'}`}
                aria-label="サムネに使う"
                title="サムネに使う"
              >
                <Star className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => remove(p.id)}
                className={`grid h-11 w-11 place-items-center ${FOCUS} absolute right-1.5 top-1.5 rounded-full bg-[var(--paper)] p-1.5 text-[var(--sub)] hover:text-rose-600`}
                aria-label="写真を削除"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
            <input
              className="w-full border-t border-[var(--line)] px-2 py-1.5 text-[11px] font-bold text-[var(--sub)] placeholder:text-[var(--muted)] focus:outline-none"
              defaultValue={p.caption}
              placeholder="キャプション（任意）"
              aria-label="キャプション"
              maxLength={100}
              onBlur={(e) => e.target.value !== p.caption && patch(p.id, { caption: e.target.value })}
            />
          </div>
        ))}
        {data.photos.length < 8 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={!!uploading}
            className={`${FOCUS} flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-[var(--r-sm)] border-2 border-dashed border-[var(--line)] text-xs font-black text-[var(--muted)] hover:border-[var(--blue)] hover:text-[var(--blue-deep)]`}
          >
            {uploading ? <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <ImagePlus className="h-5 w-5" aria-hidden="true" />}
            {uploading ? 'アップロード中' : '写真を追加'}
          </button>
        )}
      </div>
      {error && (
        <div className="mt-3">
          <ActionError error={describeError(failure)} />
        </div>
      )}
    </Card>
  )
}

// ---------- ③ 事実 ----------

function sourceLabel(f: Fact) {
  if (f.sourceType === 'company') return '会社'
  if (f.sourceType === 'answer') return findQuestion(f.sourceRef)?.section ? `回答: ${findQuestion(f.sourceRef)!.question.slice(0, 18)}…` : '回答'
  return `発言 #${Number(f.sourceRef) + 1}`
}

function FactSection({ data, onChange, materialReady }: { data: Detail; onChange: (d: Detail) => void; materialReady: boolean }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<SectionError | null>(null)

  const [confirmRedo, setConfirmRedo] = useState(false)
  const factStep = useTimedStep(busy, 3, 15000)
  const extract = async () => {
    setConfirmRedo(false)
    setBusy(true)
    setError(null)
    try {
      const d = await api<{ interview: Detail }>(`/api/shanai/interviews/${data.id}/facts`, { method: 'POST' })
      onChange(d.interview)
    } catch (e) {
      const err = e as Error & { data?: any }
      setError({ message: err.message, upgradeUrl: err.data?.upgradeUrl, err })
    } finally {
      setBusy(false)
    }
  }

  const update = async (facts: object[]) => {
    try {
      const d = await api<{ interview: Detail }>(`/api/shanai/interviews/${data.id}/facts`, { method: 'PUT', json: { facts } })
      onChange(d.interview)
    } catch (e) {
      setError({ message: (e as Error).message, err: e })
    }
  }

  const person = data.facts.filter((f) => f.sourceType !== 'company')
  const company = data.facts.filter((f) => f.sourceType === 'company')

  const FactRow = ({ f }: { f: Fact }) => (
    <li className={`rounded-[var(--r-sm)] border p-3 ${f.approved ? 'border-[var(--line)] bg-[var(--paper)]' : 'border-[var(--line)] bg-[var(--bg)] opacity-70'}`}>
      <div className="flex items-start gap-3">
        <input type="checkbox" checked={f.approved} onChange={(e) => update([{ id: f.id, approved: e.target.checked }])} className="mt-1 h-4 w-4 accent-[var(--blue)]" aria-label={`「${f.statement}」を記事に使う`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-[var(--blue-soft)] px-2 py-0.5 text-[10px] font-black text-[var(--blue-deep)]">{FACT_CATEGORY_LABELS[f.category] || f.category}</span>
            <span className="text-[10px] font-bold text-[var(--muted)]">{sourceLabel(f)}</span>
          </div>
          <input
            className="mt-1 w-full rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-sm font-black text-[var(--ink)] hover:border-[var(--line)] focus:border-[var(--blue)] focus:outline-none"
            defaultValue={f.statement}
            aria-label="事実の言い回し"
            maxLength={300}
            onBlur={(e) => e.target.value.trim() && e.target.value !== f.statement && update([{ id: f.id, statement: e.target.value }])}
          />
          <p className="mt-0.5 px-1 text-xs font-bold leading-relaxed text-[var(--sub)] [overflow-wrap:anywhere]">原文: {f.quote}</p>
        </div>
        <button type="button" onClick={() => update([{ id: f.id, delete: true }])} className={`-my-2 -mr-2 ${ICON_BTN_NEXT}`} aria-label="この事実を削除">
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </li>
  )

  return (
    <Card>
      <SectionTitle
        step="ステップ3"
        title="記事に使う事実"
        desc="録音・回答・会社プロフィールから、記事の材料になる事実を原文つきで抜き出します。記事にしてよいものにチェックを入れてください。文の言い回しは直せますが、原文は変えられません。"
      />
      <ConfirmDialog
        open={confirmRedo}
        title="事実を抽出し直しますか？"
        body="いまのチェックや言い回しの修正は消え、素材からもう一度抜き出します。"
        confirmLabel="抽出し直す"
        onConfirm={() => void extract()}
        onClose={() => setConfirmRedo(false)}
      />
      <Button onClick={() => (data.facts.length ? setConfirmRedo(true) : void extract())} loading={busy} disabled={!materialReady} variant={data.facts.length ? 'secondary' : 'primary'}>
        <ClipboardList className="h-4 w-4" />
        {data.facts.length ? '事実を抽出し直す' : '事実を抽出する'}
      </Button>
      {!materialReady && <p className="mt-2 text-xs font-bold text-[var(--muted)]">{data.mode === 'voice' ? '先に録音を文字起こししてください。' : 'アンケートの必須設問が埋まると抽出できます。'}</p>}
      {busy && <ProgressSteps steps={['素材を読み込んでいます', '事実を原文つきで抜き出しています', '原文と照らし合わせて確かめています']} current={factStep} note="1分ほどかかります。" />}
      {error && (
        <div className="mt-3">
          <LimitNotice error={error} />
        </div>
      )}
      {person.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-black text-[var(--sub)]">ご本人のお話（{person.filter((f) => f.approved).length} / {person.length}件を使用）</p>
          <ul className="mt-2 space-y-2">
            {person.map((f) => (
              <FactRow key={f.id} f={f} />
            ))}
          </ul>
        </div>
      )}
      {company.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-black text-[var(--sub)]">会社の事実（{company.filter((f) => f.approved).length} / {company.length}件を使用）</p>
          <ul className="mt-2 space-y-2">
            {company.map((f) => (
              <FactRow key={f.id} f={f} />
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}

// ---------- ④ 記事 ----------

function ArticleSection({ data, onChange }: { data: Detail; onChange: (d: Detail) => void }) {
  const [article, setArticle] = useState<Article | null>(data.article)
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [thumbKey, setThumbKey] = useState(0)
  const [error, setError] = useState<SectionError | null>(null)
  const [saved, setSaved] = useState(false)
  // ドヤパワー: 記事を作り直すときは、前に作ったときのキーを送る（5分以内なら減る量が半分。決めるのはサーバー）
  const retry = useDoyaPowerRetry(`shanai-article:${data.id}`)

  // ⚠️ 事実の更新などで data が入れ替わっても、編集中の記事は消さない（別の版になったときだけ差し替える）
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setArticle(data.article), [data.article?.id, data.article?.version])

  const factById = useMemo(() => new Map(data.facts.map((f) => [f.id, f])), [data.facts])
  const approvedPerson = data.facts.filter((f) => f.approved && f.sourceType !== 'company').length

  const [confirmRegen, setConfirmRegen] = useState(false)
  const articleStep = useTimedStep(busy, 3, 25000)
  useLeaveGuard(dirty)
  const generate = async () => {
    setConfirmRegen(false)
    setBusy(true)
    setError(null)
    try {
      const d = await api<{ article: Article }>(`/api/shanai/interviews/${data.id}/article`, {
        method: 'POST',
        headers: article ? retry.headers() : {},
        onOk: retry.remember,
      })
      setArticle(d.article)
      setDirty(false)
      setThumbKey((k) => k + 1)
      onChange({ ...data, article: d.article, status: 'DONE' })
      window.dispatchEvent(new Event('shanai:generated'))
      toast.success('記事ができました', { duration: 3000 })
    } catch (e) {
      const err = e as Error & { data?: any }
      setError({ message: err.message, upgradeUrl: err.data?.upgradeUrl, err })
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    if (!article) return
    setSaving(true)
    setError(null)
    try {
      const d = await api<{ article: Article }>(`/api/shanai/interviews/${data.id}/article`, { method: 'PUT', json: { articleId: article.id, ...article } })
      setArticle(d.article)
      setDirty(false)
      setSaved(true)
      toast.success('保存しました', { duration: 3000 })
      setThumbKey((k) => k + 1)
      setTimeout(() => setSaved(false), 1800)
    } catch (e) {
      setError({ message: (e as Error).message, err: e })
    } finally {
      setSaving(false)
    }
  }

  const edit = (patch: Partial<Article>) => {
    setArticle((a) => (a ? { ...a, ...patch } : a))
    setDirty(true)
  }
  const editBlock = (i: number, patch: Partial<ArticleBlock>) => {
    setArticle((a) => (a ? { ...a, blocks: a.blocks.map((b, j) => (j === i ? { ...b, ...patch } : b)) } : a))
    setDirty(true)
  }
  const removeBlock = (i: number) => {
    setArticle((a) => (a ? { ...a, blocks: a.blocks.filter((_, j) => j !== i) } : a))
    setDirty(true)
  }

  const unsupported = article?.blocks.filter((b) => b.unsupported).length || 0

  return (
    <Card>
      <SectionTitle step="ステップ4" title="記事" desc="チェックを入れた事実だけを使って記事を書きます。会社の事実は、ご本人の仕事とつなげて紹介します。" />
      <div className="flex flex-wrap items-center gap-2">
        <ConfirmDialog
          open={confirmRegen}
          title="記事を作り直しますか？"
          body="新しい版ができます（利用回数を1回使います）。いまの編集内容は新しい版には引き継がれません。"
          confirmLabel="作り直す"
          onConfirm={() => void generate()}
          onClose={() => setConfirmRegen(false)}
        />
        <Button onClick={() => (article ? setConfirmRegen(true) : void generate())} loading={busy} disabled={approvedPerson < 5} variant={article ? 'secondary' : 'primary'}>
          <Sparkles className="h-4 w-4" />
          {article ? '記事を作り直す' : '記事を作る'}
          <ShellCostBadge action="interview.article" retry={!!article && retry.halved} />
        </Button>
        {article && (
          <>
            <Button onClick={save} loading={saving} disabled={!dirty}>
              {saved ? <Check className="h-4 w-4" /> : null}
              {saved ? '保存しました' : '編集を保存'}
            </Button>
            {/* 新しい見た目: 編集中でも href を残し、キーボードで届くようにする（押したときに止めて案内する） */}
            <a
              href={`/api/shanai/interviews/${data.id}/export`}
              onClick={(e) => dirty && (e.preventDefault(), toast.error('先に「編集を保存」を押してください。'))}
              aria-disabled={dirty ? true : undefined}
              className={`inline-flex items-center gap-1.5 rounded-[var(--r-sm)] border border-[var(--line)] bg-[var(--paper)] px-4 py-2.5 text-sm font-black text-[var(--ink)] hover:bg-[var(--bg)] min-h-[44px] whitespace-nowrap ${FOCUS}`}
            >
              <FileText className="h-4 w-4" aria-hidden="true" />
              Wordでダウンロード
            </a>
          </>
        )}
      </div>
      {approvedPerson < 5 && <p className="mt-2 text-xs font-bold text-[var(--muted)]">ご本人のお話の事実が5件以上チェックされると作れます。</p>}
      {busy && <ProgressSteps steps={['確認済みの事実を整理しています', '記事の構成を組み立てています', '本文を書き、根拠を照らし合わせています']} current={articleStep} note="1〜2分かかります。" />}
      {error && (
        <div className="mt-3">
          <LimitNotice error={error} />
        </div>
      )}

      {article && (
        <div className="mt-6 space-y-5">
          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <div className="space-y-3">
              <Field label="タイトル">
                <input className={`${inputCls} text-base`} value={article.title} maxLength={120} onChange={(e) => edit({ title: e.target.value })} />
              </Field>
              <Field label="サムネに載せる一言" hint="20字前後">
                <input className={inputCls} value={article.catchphrase} maxLength={40} onChange={(e) => edit({ catchphrase: e.target.value })} />
              </Field>
            </div>
            <div>
              <p className="text-xs font-black text-[var(--sub)]">サムネイル</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img key={thumbKey} src={`/api/shanai/interviews/${data.id}/thumbnail?v=${thumbKey}`} alt="サムネイル画像" className="mt-1 w-full rounded-[var(--r-sm)] border border-[var(--line)]" />
              <a
                href={`/api/shanai/interviews/${data.id}/thumbnail?download=1`}
                className={`mt-2 inline-flex items-center gap-1 text-xs font-black text-[var(--blue-deep)] min-h-11 rounded-[var(--r-sm)] ${FOCUS}`}
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                サムネをダウンロード（1200×630）
              </a>
              {dirty && <p className="mt-1 text-[11px] font-bold text-[var(--muted)]">一言の変更は保存後に反映されます。</p>}
            </div>
          </div>

          <Field label="リード文">
            <textarea className={`${inputCls} min-h-[100px] leading-relaxed`} value={article.lead} maxLength={2000} onChange={(e) => edit({ lead: e.target.value })} />
          </Field>

          {unsupported > 0 && (
            <Notice tone="warn">
              <AlertTriangle className="mr-1 inline h-4 w-4" />
              根拠の事実がない段落が{unsupported}件あります。黄色の枠の段落を確認し、事実と違う内容があれば直すか削除してください。
            </Notice>
          )}

          <div className="space-y-3">
            {article.blocks.map((b, i) =>
              b.type === 'heading' ? (
                <div key={i} className="flex items-center gap-2 pt-2">
                  <input className={`${inputCls} text-base font-black`} value={b.heading || ''} maxLength={120} onChange={(e) => editBlock(i, { heading: e.target.value })} aria-label="見出し" />
                  <button type="button" onClick={() => removeBlock(i)} className={ICON_BTN_NEXT} aria-label="見出しを削除">
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <div key={i} className={`rounded-[var(--r-sm)] border p-3 ${b.unsupported ? 'border-[var(--note-ink)] bg-[var(--note-bg)]' : b.type === 'company' ? 'border-[var(--line)] bg-[var(--bg)]' : 'border-[var(--line)] bg-[var(--paper)]'}`}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-black text-[var(--sub)] min-w-0">
                      {b.type === 'qa' ? '質問と答え' : b.type === 'quote' ? '印象に残った一言' : b.type === 'company' ? '会社について' : '本文'}
                      {b.unsupported && <span className="ml-2 text-[var(--note-ink)]">根拠の事実がありません</span>}
                    </span>
                    <button type="button" onClick={() => removeBlock(i)} className={`-my-3 -mr-2 ${ICON_BTN_NEXT}`} aria-label="段落を削除">
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                  {b.type === 'qa' && <input className={`${inputCls} mb-2 font-black text-[var(--blue-deep)]`} value={b.question || ''} maxLength={300} onChange={(e) => editBlock(i, { question: e.target.value })} aria-label="質問" />}
                  <textarea
                    className={`${inputCls} leading-relaxed ${b.type === 'quote' ? 'min-h-[60px] text-base font-black' : 'min-h-[120px]'}`}
                    value={b.body}
                    aria-label={(b.type === 'qa' ? '答え' : b.type === 'quote' ? '印象に残った一言' : b.type === 'company' ? '会社について' : '本文')}
                    maxLength={5000}
                    onChange={(e) => editBlock(i, { body: e.target.value })}
                  />
                  {b.factIds.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-[11px] font-black text-[var(--muted)]">根拠の事実（{b.factIds.length}件）</summary>
                      <ul className="mt-1 space-y-1">
                        {b.factIds.map((fid) => {
                          const f = factById.get(fid)
                          return f ? (
                            <li key={fid} className="text-[11px] font-bold leading-relaxed text-[var(--sub)]">
                              ・{f.statement}
                              <span className="text-[var(--muted)]">（原文: {f.quote}）</span>
                            </li>
                          ) : null
                        })}
                      </ul>
                    </details>
                  )}
                </div>
              )
            )}
          </div>

          <p className="text-[11px] font-bold leading-relaxed text-[var(--muted)]">
            Googleドキュメントで編集するときは、WordファイルをGoogleドライブにアップロードして開いてください。公開する前に、ご本人と内容を必ずご確認ください。
          </p>
        </div>
      )}
    </Card>
  )
}
