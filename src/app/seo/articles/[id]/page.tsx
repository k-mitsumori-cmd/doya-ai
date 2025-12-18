'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { MarkdownPreview } from '@seo/components/MarkdownPreview'
import { Download, Image as ImageIcon, Link2, RefreshCcw, Sparkles } from 'lucide-react'

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

type Article = {
  id: string
  title: string
  status: string
  targetChars: number
  outline?: string | null
  finalMarkdown?: string | null
  jobs?: { id: string; status: string; progress: number; step: string; createdAt: string }[]
  memo?: { content: string } | null
  audits: SeoAudit[]
  images: SeoImage[]
  linkChecks: { url: string; ok: boolean; statusCode?: number | null; finalUrl?: string | null; error?: string | null }[]
  knowledgeItems?: SeoKnowledge[]
}

export default function SeoArticlePage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const [article, setArticle] = useState<Article | null>(null)
  const [loading, setLoading] = useState(true)
  const [memo, setMemo] = useState('')
  const [tab, setTab] = useState<'preview' | 'markdown'>('preview')
  const [diagramTitle, setDiagramTitle] = useState('')
  const [diagramDesc, setDiagramDesc] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const markdown = useMemo(() => article?.finalMarkdown || '', [article])

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/seo/articles/${id}`, { cache: 'no-store' })
    const json = await res.json()
    setArticle(json.article || null)
    setMemo(json.article?.memo?.content || '')
    setLoading(false)
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
    load()
  }, [load])

  if (loading || !article) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-10">
        <div className="text-gray-600">読み込み中...</div>
      </main>
    )
  }

  const latestAudit = article.audits?.[0]
  const latestJobId = article.jobs?.[0]?.id
  const knowledgeByType = (t: string) => (article.knowledgeItems || []).filter((k) => k.type === t)

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900">{article.title}</h1>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600">
            <span className="px-2 py-1 rounded-full bg-gray-100">status: {article.status}</span>
            <span className="px-2 py-1 rounded-full bg-gray-100">目標: {article.targetChars}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {latestJobId ? (
            <Link
              href={`/seo/jobs/${latestJobId}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 font-bold text-gray-700 hover:bg-gray-50"
            >
              ジョブへ
            </Link>
          ) : null}
          <a
            href={`/api/seo/articles/${id}/export/markdown`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 font-bold text-gray-700 hover:bg-gray-50"
          >
            <Download className="w-4 h-4" />
            Markdown
          </a>
          <a
            href={`/api/seo/articles/${id}/export/html`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 font-bold text-gray-700 hover:bg-gray-50"
          >
            <Download className="w-4 h-4" />
            HTML
          </a>
          <button
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50"
            onClick={load}
          >
            <RefreshCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {message ? (
        <div className="mt-4 p-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-800">
          {message}
        </div>
      ) : null}

      <div className="mt-6 grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <button
                className={`px-3 py-2 rounded-xl text-sm font-bold border ${
                  tab === 'preview' ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-700'
                }`}
                onClick={() => setTab('preview')}
              >
                プレビュー
              </button>
              <button
                className={`px-3 py-2 rounded-xl text-sm font-bold border ${
                  tab === 'markdown' ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-700'
                }`}
                onClick={() => setTab('markdown')}
              >
                Markdown
              </button>
            </div>
            <div className="text-xs text-gray-500">画像は `![alt](/api/seo/images/&lt;id&gt;)` で挿入できます</div>
          </div>

          <div className="mt-3 p-4 rounded-2xl border border-gray-200">
            {tab === 'preview' ? (
              markdown ? (
                <MarkdownPreview markdown={markdown} />
              ) : (
                <div className="text-gray-500">（まだ最終稿がありません。ジョブを完了してください）</div>
              )
            ) : (
              <textarea
                className="w-full min-h-[520px] font-mono text-xs p-3 rounded-xl border border-gray-200"
                value={markdown || article.outline || ''}
                readOnly
              />
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="p-4 rounded-2xl border border-gray-200">
            <p className="font-bold text-gray-900">参考URL解析（ナレッジ蓄積）</p>
            <p className="text-xs text-gray-500 mt-1">参考URLがある場合のみ実行します（要点化・言い換え）。</p>
            <button
              className="mt-3 w-full px-4 py-2 rounded-xl bg-gray-900 text-white font-bold hover:bg-gray-800 disabled:opacity-60"
              disabled={!!busy}
              onClick={() =>
                act('research', async () => {
                  const res = await fetch(`/api/seo/articles/${id}/research`, { method: 'POST' })
                  const json = await res.json()
                  if (!json.success) throw new Error(json.error || '失敗しました')
                })
              }
            >
              {busy === 'research' ? '解析中...' : '解析を実行'}
            </button>
          </div>

          <div className="p-4 rounded-2xl border border-gray-200">
            <p className="font-bold text-gray-900">“AIっぽさ”メモ</p>
            <p className="text-xs text-gray-500 mt-1">次回のリライトで反映されます（体験談/葛藤/失敗談/具体例など）。</p>
            <textarea
              className="mt-3 w-full min-h-28 px-3 py-2 rounded-xl border border-gray-200 text-sm"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="例）結論が綺麗すぎる。失敗談・判断基準の具体例を増やしたい。"
            />
            <button
              className="mt-3 w-full px-4 py-2 rounded-xl border border-gray-200 font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              disabled={!!busy}
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
            >
              {busy === 'memo' ? '保存中...' : '保存'}
            </button>
          </div>

          <div className="p-4 rounded-2xl border border-gray-200">
            <p className="font-bold text-gray-900">品質監査（二重チェック）</p>
            <div className="flex gap-2 mt-3">
              <button
                className="flex-1 px-4 py-2 rounded-xl bg-gray-900 text-white font-bold hover:bg-gray-800 disabled:opacity-60"
                disabled={!!busy}
                onClick={() =>
                  act('audit', async () => {
                    const res = await fetch(`/api/seo/articles/${id}/audit`, { method: 'POST' })
                    const json = await res.json()
                    if (!json.success) throw new Error(json.error || '失敗しました')
                  })
                }
              >
                {busy === 'audit' ? '監査中...' : '監査'}
              </button>
              <button
                className="flex-1 px-4 py-2 rounded-xl border border-gray-200 font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                disabled={!!busy || !latestAudit}
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
              >
                {busy === 'autofix' ? '修正中...' : '自動修正'}
              </button>
            </div>
            <div className="mt-3">
              {latestAudit ? (
                <details>
                  <summary className="text-sm font-bold text-gray-700 cursor-pointer">最新の監査レポート</summary>
                  <pre className="text-xs whitespace-pre-wrap mt-2 p-3 rounded-xl bg-gray-50 border border-gray-200">
                    {latestAudit.report}
                  </pre>
                </details>
              ) : (
                <p className="text-xs text-gray-500">（まだ監査レポートがありません）</p>
              )}
            </div>
          </div>

          <div className="p-4 rounded-2xl border border-gray-200">
            <p className="font-bold text-gray-900">画像生成（バナー / 図解）</p>
            <button
              className="mt-3 w-full px-4 py-2 rounded-xl bg-gray-900 text-white font-bold hover:bg-gray-800 disabled:opacity-60 inline-flex items-center justify-center gap-2"
              disabled={!!busy}
              onClick={() =>
                act('banner', async () => {
                  const res = await fetch(`/api/seo/articles/${id}/images/banner`, { method: 'POST' })
                  const json = await res.json()
                  if (!json.success) throw new Error(json.error || '失敗しました')
                })
              }
            >
              <ImageIcon className="w-4 h-4" />
              {busy === 'banner' ? '生成中...' : 'バナー生成'}
            </button>

            <div className="mt-4 grid gap-2">
              <input
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm"
                value={diagramTitle}
                onChange={(e) => setDiagramTitle(e.target.value)}
                placeholder="図解タイトル（例：LLMOの施策マップ）"
              />
              <textarea
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm min-h-20"
                value={diagramDesc}
                onChange={(e) => setDiagramDesc(e.target.value)}
                placeholder="図解で表現する内容（例：入力→解析→生成→監査→公開の流れ）"
              />
              <button
                className="w-full px-4 py-2 rounded-xl border border-gray-200 font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-60 inline-flex items-center justify-center gap-2"
                disabled={!!busy || !diagramTitle.trim() || !diagramDesc.trim()}
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
              >
                <Sparkles className="w-4 h-4" />
                {busy === 'diagram' ? '生成中...' : '図解生成'}
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {article.images?.map((img) => (
                <div key={img.id} className="p-3 rounded-xl border border-gray-200">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-gray-900">
                      {img.kind}: {img.title || img.id}
                    </p>
                    <a
                      className="text-xs text-blue-600 hover:text-blue-700"
                      href={`/api/seo/images/${img.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      表示
                    </a>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    挿入用: <code className="px-1 py-0.5 bg-gray-100 rounded">![{img.title || 'image'}](/api/seo/images/{img.id})</code>
                  </p>
                </div>
              ))}
              {article.images?.length ? null : <p className="text-xs text-gray-500">（画像はまだありません）</p>}
            </div>
          </div>

          <div className="p-4 rounded-2xl border border-gray-200">
            <p className="font-bold text-gray-900">リンクチェック</p>
            <button
              className="mt-3 w-full px-4 py-2 rounded-xl border border-gray-200 font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-60 inline-flex items-center justify-center gap-2"
              disabled={!!busy}
              onClick={() =>
                act('linkcheck', async () => {
                  const res = await fetch(`/api/seo/articles/${id}/link-check`, { method: 'POST' })
                  const json = await res.json()
                  if (!json.success) throw new Error(json.error || '失敗しました')
                })
              }
            >
              <Link2 className="w-4 h-4" />
              {busy === 'linkcheck' ? '確認中...' : 'リンクチェック実行'}
            </button>
            <div className="mt-3 max-h-56 overflow-auto border border-gray-100 rounded-xl">
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
                <div className="p-3 text-xs text-gray-500">（未実行）</div>
              )}
            </div>
          </div>

          <div className="p-4 rounded-2xl border border-gray-200">
            <p className="font-bold text-gray-900">ナレッジ（差別化機能）</p>
            <div className="mt-2 space-y-3">
              {knowledgeByType('intro_ab').map((k) => (
                <details key={k.id} className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                  <summary className="text-sm font-bold text-gray-800 cursor-pointer">{k.title || '導入文案A/B'}</summary>
                  <pre className="text-xs whitespace-pre-wrap mt-2">{k.content}</pre>
                </details>
              ))}
              {knowledgeByType('internal_link').map((k) => (
                <details key={k.id} className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                  <summary className="text-sm font-bold text-gray-800 cursor-pointer">{k.title || '内部リンク提案'}</summary>
                  <pre className="text-xs whitespace-pre-wrap mt-2">{k.content}</pre>
                </details>
              ))}
              {knowledgeByType('sns').map((k) => (
                <details key={k.id} className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                  <summary className="text-sm font-bold text-gray-800 cursor-pointer">{k.title || 'SNS要約 & CTA案'}</summary>
                  <pre className="text-xs whitespace-pre-wrap mt-2">{k.content}</pre>
                </details>
              ))}
              {!article.knowledgeItems?.length ? (
                <p className="text-xs text-gray-500">（まだナレッジがありません。ジョブ完了後に自動生成されます）</p>
              ) : null}
            </div>
          </div>
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


