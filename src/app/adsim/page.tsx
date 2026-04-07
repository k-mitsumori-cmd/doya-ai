'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { BarChart3, Plus, FileText, Sparkles, Loader2, Trash2 } from 'lucide-react'

interface AdSimProject {
  id: string
  name: string
  clientName: string
  industry: string
  status: string
  createdAt: string
}

export default function AdSimDashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [projects, setProjects] = useState<AdSimProject[]>([])
  const [loading, setLoading] = useState(false)

  const isLoggedIn = !!session?.user
  const isSessionLoading = status === 'loading'

  // 未ログインなら /auth/signin にリダイレクト
  useEffect(() => {
    if (!isSessionLoading && !isLoggedIn) {
      router.replace('/auth/signin?callbackUrl=/adsim')
    }
  }, [isSessionLoading, isLoggedIn, router])

  const fetchProjects = () => {
    setLoading(true)
    fetch('/api/adsim/projects?limit=10')
      .then((r) => r.json())
      .then((d) => setProjects(d.projects || []))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (isLoggedIn) fetchProjects()
  }, [isLoggedIn])

  const handleDelete = async (id: string, name: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`「${name}」を削除しますか？`)) return
    const res = await fetch(`/api/adsim/projects/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('削除しました')
      fetchProjects()
    } else {
      toast.error('削除に失敗しました')
    }
  }

  if (isSessionLoading || !isLoggedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 to-blue-50">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50">
      <div className="mx-auto max-w-6xl px-4 py-12">
        {/* Hero */}
        <div className="mb-12 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-indigo-100 px-4 py-1 text-sm font-medium text-indigo-700">
            <Sparkles className="h-4 w-4" />
            開発中（近日公開）
          </div>
          <h1 className="mb-4 bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-4xl font-bold text-transparent md:text-5xl">
            ドヤ広告シミュレーションAI
          </h1>
          <p className="mb-8 text-lg text-gray-600">
            広告提案資料を、AIが一発生成。<br />
            数値・グラフ・提案テキスト・スライドまで全部おまかせ。
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/adsim/new"
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 font-semibold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700"
            >
              <Plus className="h-5 w-5" />
              新規提案を作成
            </Link>
            <Link
              href="/adsim/history"
              className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-white px-6 py-3 font-semibold text-indigo-700 transition hover:bg-indigo-50"
            >
              提案履歴
            </Link>
            <Link
              href="/adsim/guide"
              className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-white px-6 py-3 font-semibold text-indigo-700 transition hover:bg-indigo-50"
            >
              使い方ガイド
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="mb-12 grid gap-4 md:grid-cols-3">
          {[
            { icon: BarChart3, title: '数値シミュレーション', desc: '媒体別×月次でImp/Click/CV/CPA/ROASを自動算出' },
            { icon: FileText, title: '提案テキスト10セクション', desc: 'AIが提案書そのまま使えるレベルの文章を生成' },
            { icon: Sparkles, title: 'PDF/PPTX出力', desc: 'プレビュー確認後、そのまま提出ファイルとしてダウンロード' },
          ].map((f, i) => (
            <div key={i} className="rounded-xl border border-indigo-100 bg-white p-6 shadow-sm">
              <f.icon className="mb-3 h-8 w-8 text-indigo-600" />
              <h3 className="mb-2 font-bold text-gray-900">{f.title}</h3>
              <p className="text-sm text-gray-600">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Recent projects */}
        {isLoggedIn && (
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-bold text-gray-900">最近の提案プロジェクト</h2>
            {loading ? (
              <p className="text-sm text-gray-500">読み込み中...</p>
            ) : projects.length === 0 ? (
              <p className="text-sm text-gray-500">まだプロジェクトがありません。</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {projects.map((p) => (
                  <li key={p.id} className="group flex items-center justify-between py-3 hover:bg-gray-50">
                    <Link href={`/adsim/${p.id}`} className="flex-1">
                      <div className="font-medium text-gray-900">{p.name}</div>
                      <div className="text-xs text-gray-500">
                        {p.clientName} / {p.industry}
                      </div>
                    </Link>
                    <span className="mr-3 text-xs text-gray-400">
                      {new Date(p.createdAt).toLocaleDateString('ja-JP')}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => handleDelete(p.id, p.clientName, e)}
                      className="text-gray-300 opacity-0 transition group-hover:opacity-100 hover:text-red-600"
                      title="削除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
