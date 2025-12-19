'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { MarkdownPreview } from '@seo/components/MarkdownPreview'
import { ClientErrorBoundary } from '@seo/components/ClientErrorBoundary'
import { Tabs } from '@seo/components/ui/Tabs'
import { Button } from '@seo/components/ui/Button'
import { Card, CardBody, CardHeader, CardTitle, CardDesc } from '@seo/components/ui/Card'
import { Badge } from '@seo/components/ui/Badge'
import { ProgressBar } from '@seo/components/ui/ProgressBar'
import { StatCard } from '@seo/components/ui/StatCard'
import { analyzeMarkdown } from '@seo/lib/score'
import {
  Download,
  Image as ImageIcon,
  Link2,
  RefreshCcw,
  Sparkles,
  ExternalLink,
  Wand2,
  Settings,
  BookOpen,
  Search,
  FileText,
} from 'lucide-react'

type SeoImage = {
  id: string
  kind: string
  title?: string | null
  description?: string | null
  createdAt: string
}

type SeoAudit = {
  id: string
  report: string
  createdAt: string
}

type SeoKnowledge = {
  id: string
  type: string
  title?: string | null
  content: string
  createdAt: string
}

type SeoReference = {
  id: string
  url: string
  title?: string | null
  summary?: string | null
  headings?: any
  insights?: any
  createdAt: string
}

type Article = {
  id: string
  title: string
  status: string
  targetChars: number
  outline?: string | null
  finalMarkdown?: string | null
  jobs?: { id: string; status: string; progress: number; step: string; error?: string | null; createdAt: string }[]
  memo?: { content: string } | null
  audits: SeoAudit[]
  images: SeoImage[]
  linkChecks: { url: string; ok: boolean; statusCode?: number | null; finalUrl?: string | null; error?: string | null }[]
  knowledgeItems?: SeoKnowledge[]
  references?: SeoReference[]
  llmoOptions?: any
}

export default function SeoArticlePage() {
  return (
    <ClientErrorBoundary title="記事ページの表示でエラーが発生しました">
      <SeoArticleInner />
    </ClientErrorBoundary>
  )
}

function SeoArticleInner() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const searchParams = useSearchParams()
  const [article, setArticle] = useState<Article | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [autoRun, setAutoRun] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [memo, setMemo] = useState('')
  const [tab, setTab] = useState<
    'preview' | 'edit' | 'research' | 'outline' | 'meta' | 'audit' | 'media' | 'links' | 'export'
  >('preview')
  const [diagramTitle, setDiagramTitle] = useState('')
  const [diagramDesc, setDiagramDesc] = useState('')
  const [outlineDraft, setOutlineDraft] = useState('')
  const [markdownDraft, setMarkdownDraft] = useState('')
  const [normalizeOnSave, setNormalizeOnSave] = useState(true)
  const [updateOutlineOnSave, setUpdateOutlineOnSave] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const markdown = useMemo(() => article?.finalMarkdown || '', [article])
  const score = useMemo(() => analyzeMarkdown(markdown || ''), [markdown])

  const load = useCallback(async (opts?: { showLoading?: boolean }) => {
    const showLoading = opts?.showLoading === true
    if (showLoading) setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch(`/api/seo/articles/${id}`, { cache: 'no-store' })
      let json: any = null
      try {
        json = await res.json()
      } catch {
        json = null
      }
      if (!res.ok || json?.success === false) {
        throw new Error(json?.error || `API Error: ${res.status}`)
      }
      setArticle(json.article || null)
      setMemo(json.article?.memo?.content || '')
      setOutlineDraft(json.article?.outline || '')
      setMarkdownDraft(json.article?.finalMarkdown || '')
    } catch (e: any) {
      setLoadError(e?.message || '読み込みに失敗しました')
      // ポーリング時は画面が真っ白にならないよう維持。初回/明示リロード時はnullにする
      if (showLoading) setArticle(null)
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [id])

  async function act(name: string, fn: () => Promise<void>) {
    setBusy(name)
    setMessage(null)
    try {
      await fn()
      await load()
      setMessage('完了しました')
    } catch (e: any) {
      setMessage(e?.message || '失敗しました')
    } finally {
      setBusy(null)
    }
  }

  useEffect(() => {
    load({ showLoading: true })
    const t = setInterval(() => {
      load({ showLoading: false })
    }, 2500)
    return () => clearInterval(t)
  }, [load])

  // ?auto=1 で記事ページから自動生成を開始（ジョブページ不要）
  useEffect(() => {
    if (searchParams.get('auto') === '1') setAutoRun(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // NOTE: hooksは条件分岐の前に必ず宣言する（React error #310 対策）
  const latestJob = article?.jobs?.[0]
  const latestJobId = latestJob?.id

  const advanceOnce = useCallback(async () => {
    if (!latestJobId) return
    setActionError(null)
    const res = await fetch(`/api/seo/jobs/${latestJobId}/advance`, { method: 'POST' })
    let json: any = null
    try {
      json = await res.json()
    } catch {
      // ignore
    }
    if (!res.ok || json?.success === false) {
      const msg = json?.error || `advance failed (${res.status})`
      setActionError(msg)
      setAutoRun(false)
      return
    }
    await load({ showLoading: false })
  }, [latestJobId, load])

  useEffect(() => {
    if (!autoRun) return
    if (!latestJob) return
    if (latestJob.status === 'done' || latestJob.status === 'error') return
    const t = setTimeout(() => {
      advanceOnce()
    }, 700)
    return () => clearTimeout(t)
  }, [autoRun, latestJob, advanceOnce])

  if (loading) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-10">
        <div className="text-gray-600">読み込み中...</div>
      </main>
    )
  }
  if (!article) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-10">
        <div className="p-4 rounded-2xl border border-red-200 bg-red-50 text-red-800">
          <p className="font-bold">読み込みに失敗しました</p>
          <pre className="text-xs whitespace-pre-wrap mt-2">{loadError || '不明なエラー'}</pre>
          <p className="text-xs mt-2 text-red-800/90">
            まずは環境変数（<code>GOOGLE_GENAI_API_KEY</code> / <code>DATABASE_URL</code>）とDB接続状態を確認してください。
          </p>
        </div>
        <div className="mt-4">
          <button
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-white font-bold hover:bg-gray-800"
            onClick={() => load({ showLoading: true })}
          >
            再読み込み
          </button>
        </div>
      </main>
    )
  }

  const latestAudit = article.audits?.[0]
  const knowledgeByType = (t: string) => (article.knowledgeItems || []).filter((k) => k.type === t)
  const metaItem = knowledgeByType('meta')?.[0]

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 truncate">{article.title}</h1>
            <Badge tone={article.status === 'DONE' ? 'green' : article.status === 'ERROR' ? 'red' : 'blue'}>
              {article.status}
            </Badge>
            <Badge tone="gray">目標 {article.targetChars.toLocaleString('ja-JP')}</Badge>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Research → Outline → Write → Audit → Media/Links → Export の流れで品質を上げます
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {latestJobId ? (
            <Link href={`/seo/jobs/${latestJobId}`}>
              <Button variant="secondary">
                <ExternalLink className="w-4 h-4" />
                ジョブ
              </Button>
            </Link>
          ) : null}
          {latestJobId && latestJob?.status !== 'done' ? (
            <Button variant={autoRun ? 'secondary' : 'primary'} onClick={() => setAutoRun((v) => !v)}>
              {autoRun ? '自動停止' : '生成を開始'}
            </Button>
          ) : null}
          <Button variant="ghost" onClick={() => load({ showLoading: true })}>
            <RefreshCcw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {latestJobId && latestJob ? (
        <div className="mt-4">
          <Card>
            <CardBody className="flex items-center justify-between gap-4 flex-wrap">
              <div className="min-w-[260px]">
                <p className="text-xs text-gray-500 font-bold">生成進捗</p>
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  <Badge tone={latestJob.status === 'error' ? 'red' : latestJob.status === 'done' ? 'green' : 'amber'}>
                    {latestJob.status}
                  </Badge>
                  <span className="text-xs text-gray-600">step: {latestJob.step}</span>
                  <span className="text-xs text-gray-600">{latestJob.progress}%</span>
                </div>
                <ProgressBar value={latestJob.progress} className="mt-2" />
              </div>
              <div className="text-xs text-gray-600 max-w-[520px]">
                <p className="font-bold text-gray-700">使い方</p>
                <p className="mt-1">
                  このページを開いたまま自動で進みます（止まったら「生成を開始」を押してください）。
                </p>
              </div>
            </CardBody>
          </Card>
          {latestJob.error ? (
            <div className="mt-3 p-4 rounded-2xl border border-red-200 bg-red-50 text-red-800">
              <p className="font-bold">生成エラー</p>
              <pre className="text-xs whitespace-pre-wrap mt-2">{latestJob.error}</pre>
            </div>
          ) : null}
          {actionError ? (
            <div className="mt-3 p-4 rounded-2xl border border-red-200 bg-red-50 text-red-800">
              <p className="font-bold">実行エラー（advance）</p>
              <pre className="text-xs whitespace-pre-wrap mt-2">{actionError}</pre>
            </div>
          ) : null}
        </div>
      ) : null}

      {loadError ? (
        <div className="mt-4 p-3 rounded-xl border border-amber-200 bg-amber-50 text-sm text-amber-900">
          <p className="font-bold">更新に失敗しました（再試行中）</p>
          <p className="mt-1 whitespace-pre-wrap">{loadError}</p>
        </div>
      ) : null}

      {message ? (
        <div className="mt-4 p-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-800">
          {message}
        </div>
      ) : null}

      <div className="mt-6 grid md:grid-cols-4 gap-3">
        <StatCard label="Content Score" value={`${score.score}`} sub="目安: 70+で強い" tone={score.score >= 70 ? 'green' : score.score >= 50 ? 'amber' : 'red'} icon={<Sparkles className="w-5 h-5" />} />
        <StatCard label="文字数" value={score.charCount.toLocaleString('ja-JP')} sub={`目標 ${article.targetChars.toLocaleString('ja-JP')}`} />
        <StatCard label="構造" value={`${score.headingCount}見出し`} sub={`${score.tableCount ? '表あり' : '表なし'} / FAQ ${score.faqCount ? 'あり' : 'なし'}`} />
        <StatCard label="素材" value={`${score.linkCount}リンク`} sub={`${score.imageCount}画像`} />
      </div>

      <div className="mt-4">
        <Card>
          <CardBody className="flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-[240px]">
              <p className="text-xs text-gray-500 font-bold">進捗（最終稿の充実度）</p>
              <ProgressBar value={score.score} className="mt-2" />
            </div>
            <Tabs
              value={tab}
              onChange={setTab}
              tabs={[
                { id: 'preview', label: 'プレビュー', badge: 'Write' },
                { id: 'edit', label: '編集', badge: 'Edit' },
                { id: 'research', label: 'リサーチ', badge: 'Research' },
                { id: 'outline', label: 'アウトライン', badge: 'Outline' },
                { id: 'meta', label: 'メタ', badge: 'SEO' },
                { id: 'audit', label: '監査', badge: 'Audit' },
                { id: 'media', label: '画像', badge: 'Media' },
                { id: 'links', label: 'リンク', badge: 'Links' },
                { id: 'export', label: '出力', badge: 'Export' },
              ]}
            />
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {tab === 'preview' ? (
            <Card>
              <CardHeader>
                <CardTitle>プレビュー</CardTitle>
                <CardDesc>Markdownをレンダリングします（表/画像/リンク）。</CardDesc>
              </CardHeader>
              <CardBody>
                {markdown ? <MarkdownPreview markdown={markdown} /> : <div className="text-gray-500">（最終稿がありません）</div>}
              </CardBody>
            </Card>
          ) : null}

          {tab === 'edit' ? (
            <Card>
              <CardHeader>
                <CardTitle>最終稿（貼り付け・編集）</CardTitle>
                <CardDesc>
                  ここに本文を貼り付けて保存できます。Markdown見出し（<code>##</code>/<code>###</code>）があるとアウトライン抽出が安定します。
                </CardDesc>
              </CardHeader>
              <CardBody className="space-y-3">
                <textarea
                  className="w-full min-h-[520px] font-mono text-xs p-3 rounded-xl border border-gray-200"
                  value={markdownDraft}
                  onChange={(e) => setMarkdownDraft(e.target.value)}
                  placeholder="ここにMarkdown/テキストを貼り付け…"
                />

                <div className="flex items-center gap-4 flex-wrap text-sm text-gray-700">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={normalizeOnSave}
                      onChange={(e) => setNormalizeOnSave(e.target.checked)}
                    />
                    テキストを軽くMarkdown整形して保存（見出し推定）
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={updateOutlineOnSave}
                      onChange={(e) => setUpdateOutlineOnSave(e.target.checked)}
                    />
                    アウトラインも同時に更新（H2〜H4から抽出）
                  </label>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="secondary"
                    onClick={() => setMarkdownDraft(article.finalMarkdown || '')}
                    disabled={!!busy}
                  >
                    元に戻す
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() =>
                      act('content', async () => {
                        const res = await fetch(`/api/seo/articles/${id}/content`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            finalMarkdown: markdownDraft,
                            normalize: normalizeOnSave,
                            updateOutline: updateOutlineOnSave,
                          }),
                        })
                        const json = await res.json()
                        if (!json.success) throw new Error(json.error || '失敗しました')
                      })
                    }
                    disabled={!!busy || !markdownDraft.trim()}
                  >
                    <FileText className="w-4 h-4" />
                    保存
                  </Button>
                </div>
              </CardBody>
            </Card>
          ) : null}

          {tab === 'research' ? (
            <Card>
              <CardHeader>
                <CardTitle>リサーチ</CardTitle>
                <CardDesc>参考URLを要点化してナレッジとして蓄積します（丸写し禁止）。</CardDesc>
              </CardHeader>
              <CardBody className="space-y-4">
                <Button
                  variant="primary"
                  onClick={() =>
                    act('research', async () => {
                      const res = await fetch(`/api/seo/articles/${id}/research`, { method: 'POST' })
                      const json = await res.json()
                      if (!json.success) throw new Error(json.error || '失敗しました')
                    })
                  }
                  disabled={!!busy}
                >
                  <Search className="w-4 h-4" />
                  {busy === 'research' ? '解析中...' : '参考URLを解析'}
                </Button>

                <div className="space-y-3">
                  {(article.references || []).map((r) => (
                    <div key={r.id} className="p-4 rounded-2xl border border-gray-200 bg-white">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-bold text-gray-900 truncate">{r.title || r.url}</p>
                          <a className="text-xs text-blue-600 hover:underline" href={r.url} target="_blank" rel="noreferrer">
                            {r.url}
                          </a>
                        </div>
                        <Badge tone="purple">参考</Badge>
                      </div>
                      {r.summary ? <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{r.summary}</p> : null}
                    </div>
                  ))}
                  {(article.references || []).length === 0 ? (
                    <div className="text-sm text-gray-500">（まだ参考URL解析結果がありません）</div>
                  ) : null}
                </div>
              </CardBody>
            </Card>
          ) : null}

          {tab === 'outline' ? (
            <Card>
              <CardHeader>
                <CardTitle>アウトライン（編集可）</CardTitle>
                <CardDesc>アウトラインを整えると分割生成が安定します。</CardDesc>
              </CardHeader>
              <CardBody className="space-y-3">
                <textarea
                  className="w-full min-h-[380px] font-mono text-xs p-3 rounded-xl border border-gray-200"
                  value={outlineDraft}
                  onChange={(e) => setOutlineDraft(e.target.value)}
                  placeholder="（未生成）"
                />
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => setOutlineDraft(article.outline || '')}
                    disabled={!!busy}
                  >
                    元に戻す
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() =>
                      act('outline', async () => {
                        const res = await fetch(`/api/seo/articles/${id}/outline`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ outline: outlineDraft }),
                        })
                        const json = await res.json()
                        if (!json.success) throw new Error(json.error || '失敗しました')
                      })
                    }
                    disabled={!!busy}
                  >
                    <FileText className="w-4 h-4" />
                    保存
                  </Button>
                </div>
              </CardBody>
            </Card>
          ) : null}

          {tab === 'meta' ? (
            <Card>
              <CardHeader>
                <CardTitle>メタ生成（title/description/slug/OG）</CardTitle>
                <CardDesc>SERPスニペット用のメタをGeminiで生成し、記事に紐づけて保存します。</CardDesc>
              </CardHeader>
              <CardBody className="space-y-4">
                <Button
                  variant="primary"
                  onClick={() =>
                    act('meta', async () => {
                      const res = await fetch(`/api/seo/articles/${id}/meta`, { method: 'POST' })
                      const json = await res.json()
                      if (!json.success) throw new Error(json.error || '失敗しました')
                    })
                  }
                  disabled={!!busy}
                >
                  <Wand2 className="w-4 h-4" />
                  {busy === 'meta' ? '生成中...' : 'メタを生成'}
                </Button>

                <div className="grid gap-3">
                  {metaItem ? (
                    <pre className="text-xs whitespace-pre-wrap p-3 rounded-xl bg-gray-50 border border-gray-200">
                      {metaItem.content}
                    </pre>
                  ) : (
                    <p className="text-sm text-gray-500">（まだメタがありません）</p>
                  )}
                </div>
              </CardBody>
            </Card>
          ) : null}

          {tab === 'audit' ? (
            <Card>
              <CardHeader>
                <CardTitle>品質監査（二重チェック）</CardTitle>
                <CardDesc>別プロンプトで弱点を洗い出し、自動修正で反映します。</CardDesc>
              </CardHeader>
              <CardBody className="space-y-3">
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="primary"
                    onClick={() =>
                      act('audit', async () => {
                        const res = await fetch(`/api/seo/articles/${id}/audit`, { method: 'POST' })
                        const json = await res.json()
                        if (!json.success) throw new Error(json.error || '失敗しました')
                      })
                    }
                    disabled={!!busy}
                  >
                    <BookOpen className="w-4 h-4" />
                    {busy === 'audit' ? '監査中...' : '監査'}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      act('autofix', async () => {
                        const res = await fetch(`/api/seo/articles/${id}/autofix`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ auditId: latestAudit?.id }),
                        })
                        const json = await res.json()
                        if (!json.success) throw new Error(json.error || '失敗しました')
                      })
                    }
                    disabled={!!busy || !latestAudit}
                  >
                    自動修正
                  </Button>
                </div>
                {latestAudit ? (
                  <pre className="text-xs whitespace-pre-wrap p-3 rounded-xl bg-gray-50 border border-gray-200">
                    {latestAudit.report}
                  </pre>
                ) : (
                  <p className="text-sm text-gray-500">（まだ監査レポートがありません）</p>
                )}
              </CardBody>
            </Card>
          ) : null}

          {tab === 'media' ? (
            <Card>
              <CardHeader>
                <CardTitle>画像（バナー / 図解）</CardTitle>
                <CardDesc>Geminiで生成し、Markdownリンクで記事に挿入できます。</CardDesc>
              </CardHeader>
              <CardBody className="space-y-4">
                <Button
                  variant="primary"
                  onClick={() =>
                    act('banner', async () => {
                      const res = await fetch(`/api/seo/articles/${id}/images/banner`, { method: 'POST' })
                      const json = await res.json()
                      if (!json.success) throw new Error(json.error || '失敗しました')
                    })
                  }
                  disabled={!!busy}
                >
                  <ImageIcon className="w-4 h-4" />
                  {busy === 'banner' ? '生成中...' : 'バナー生成'}
                </Button>

                <div className="grid gap-2">
                  <input
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm"
                    value={diagramTitle}
                    onChange={(e) => setDiagramTitle(e.target.value)}
                    placeholder="図解タイトル（例：施策マップ）"
                  />
                  <textarea
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm min-h-20"
                    value={diagramDesc}
                    onChange={(e) => setDiagramDesc(e.target.value)}
                    placeholder="図解で表現する内容（例：入力→解析→生成→監査→公開の流れ）"
                  />
                  <Button
                    variant="secondary"
                    onClick={() =>
                      act('diagram', async () => {
                        const res = await fetch(`/api/seo/articles/${id}/images/diagram`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ title: diagramTitle, description: diagramDesc }),
                        })
                        const json = await res.json()
                        if (!json.success) throw new Error(json.error || '失敗しました')
                        setDiagramTitle('')
                        setDiagramDesc('')
                      })
                    }
                    disabled={!!busy || !diagramTitle.trim() || !diagramDesc.trim()}
                  >
                    <Sparkles className="w-4 h-4" />
                    {busy === 'diagram' ? '生成中...' : '図解生成'}
                  </Button>
                </div>

                <div className="space-y-3">
                  {article.images?.map((img) => (
                    <div key={img.id} className="p-3 rounded-xl border border-gray-200">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-gray-900">
                          {img.kind}: {img.title || img.id}
                        </p>
                        <a className="text-xs text-blue-600 hover:underline" href={`/api/seo/images/${img.id}`} target="_blank" rel="noreferrer">
                          表示
                        </a>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        挿入用: <code className="px-1 py-0.5 bg-gray-100 rounded">![{img.title || 'image'}](/api/seo/images/{img.id})</code>
                      </p>
                    </div>
                  ))}
                  {article.images?.length ? null : <p className="text-sm text-gray-500">（画像はまだありません）</p>}
                </div>
              </CardBody>
            </Card>
          ) : null}

          {tab === 'links' ? (
            <Card>
              <CardHeader>
                <CardTitle>リンクチェック</CardTitle>
                <CardDesc>記事内リンクを抽出して到達確認します。</CardDesc>
              </CardHeader>
              <CardBody className="space-y-3">
                <Button
                  variant="secondary"
                  onClick={() =>
                    act('linkcheck', async () => {
                      const res = await fetch(`/api/seo/articles/${id}/link-check`, { method: 'POST' })
                      const json = await res.json()
                      if (!json.success) throw new Error(json.error || '失敗しました')
                    })
                  }
                  disabled={!!busy}
                >
                  <Link2 className="w-4 h-4" />
                  {busy === 'linkcheck' ? '確認中...' : 'リンクチェック実行'}
                </Button>
                <div className="max-h-[420px] overflow-auto border border-gray-100 rounded-xl">
                  {article.linkChecks?.length ? (
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 text-gray-600">
                        <tr>
                          <th className="text-left p-2">URL</th>
                          <th className="text-left p-2">結果</th>
                        </tr>
                      </thead>
                      <tbody>
                        {article.linkChecks.map((r) => (
                          <tr key={r.url} className="border-t border-gray-100">
                            <td className="p-2">
                              <a className="text-blue-600 hover:underline" href={r.url} target="_blank" rel="noreferrer">
                                {r.url}
                              </a>
                              {r.finalUrl && r.finalUrl !== r.url ? (
                                <div className="text-[10px] text-gray-500 mt-1">→ {r.finalUrl}</div>
                              ) : null}
                            </td>
                            <td className={`p-2 ${r.ok ? 'text-green-700' : 'text-red-700'}`}>
                              {r.ok ? 'OK' : 'NG'} {r.statusCode ? `(${r.statusCode})` : ''}
                              {r.error ? <div className="text-[10px] mt-1">{r.error}</div> : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="p-3 text-sm text-gray-500">（未実行）</div>
                  )}
                </div>
              </CardBody>
            </Card>
          ) : null}

          {tab === 'export' ? (
            <Card>
              <CardHeader>
                <CardTitle>エクスポート</CardTitle>
                <CardDesc>用途別にダウンロードできます（WordPress貼り付け向け含む）。</CardDesc>
              </CardHeader>
              <CardBody className="flex flex-wrap gap-2">
                <a href={`/api/seo/articles/${id}/export/markdown`} className="inline-flex">
                  <Button variant="secondary">
                    <Download className="w-4 h-4" /> Markdown
                  </Button>
                </a>
                <a href={`/api/seo/articles/${id}/export/html`} className="inline-flex">
                  <Button variant="secondary">
                    <Download className="w-4 h-4" /> HTML
                  </Button>
                </a>
                <a href={`/api/seo/articles/${id}/export/wp`} className="inline-flex">
                  <Button variant="primary">
                    <Download className="w-4 h-4" /> WordPressクリーンHTML
                  </Button>
                </a>
              </CardBody>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>作業メモ（AIっぽさ対策）</CardTitle>
              <CardDesc>次回のリライトで反映します（体験談/葛藤/失敗談/具体例）。</CardDesc>
            </CardHeader>
            <CardBody className="space-y-3">
              <textarea
                className="w-full min-h-28 px-3 py-2 rounded-xl border border-gray-200 text-sm"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="例）断言が強い。判断基準のトレードオフを追加。失敗談が欲しい。"
              />
              <Button
                variant="secondary"
                onClick={() =>
                  act('memo', async () => {
                    const res = await fetch(`/api/seo/articles/${id}/memo`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ content: memo }),
                    })
                    const json = await res.json()
                    if (!json.success) throw new Error(json.error || '失敗しました')
                  })
                }
                disabled={!!busy}
              >
                <Settings className="w-4 h-4" />
                {busy === 'memo' ? '保存中...' : '保存'}
              </Button>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>ナレッジ（自動生成）</CardTitle>
              <CardDesc>導入A/B・内部リンク・SNS要約など</CardDesc>
            </CardHeader>
            <CardBody className="space-y-3">
              {['intro_ab', 'internal_link', 'sns'].flatMap((t) => knowledgeByType(t as any)).map((k) => (
                <details key={k.id} className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                  <summary className="text-sm font-bold text-gray-800 cursor-pointer">{k.title || k.type}</summary>
                  <pre className="text-xs whitespace-pre-wrap mt-2">{k.content}</pre>
                </details>
              ))}
              {!article.knowledgeItems?.length ? <p className="text-sm text-gray-500">（まだナレッジがありません）</p> : null}
            </CardBody>
          </Card>
        </div>
      </div>

      <div className="mt-10">
        <Link href="/seo" className="text-sm text-gray-500 hover:text-gray-700">
          ← 一覧へ戻る
        </Link>
      </div>
    </main>
  )
}


