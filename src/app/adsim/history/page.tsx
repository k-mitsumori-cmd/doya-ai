'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Loader2, Trash2, ChevronLeft } from 'lucide-react'
import toast from 'react-hot-toast'

interface AdSimProject {
  id: string
  name: string
  clientName: string
  industry: string
  productName: string
  status: string
  monthlyBudget: number
  periodMonths: number
  createdAt: string
}

const PAGE_SIZE = 20

export default function AdSimHistoryPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const isSessionLoading = status === 'loading'
  const isLoggedIn = !!session?.user
  const [projects, setProjects] = useState<AdSimProject[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isSessionLoading && !isLoggedIn) {
      router.replace('/auth/signin?callbackUrl=/adsim/history')
    }
  }, [isSessionLoading, isLoggedIn, router])

  const fetchPage = async (newOffset = offset) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/adsim/projects?limit=${PAGE_SIZE}&offset=${newOffset}`)
      if (res.ok) {
        const data = await res.json()
        setProjects(data.projects || [])
        setTotal(data.total || 0)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isLoggedIn) fetchPage(offset)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, offset])

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`「${name}」を削除しますか？`)) return
    const res = await fetch(`/api/adsim/projects/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('削除しました')
      fetchPage(offset)
    } else {
      toast.error('削除に失敗しました')
    }
  }

  if (isSessionLoading || !isLoggedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="mx-auto max-w-5xl px-4">
        <Link href="/adsim" className="inline-flex items-center text-sm text-indigo-600 hover:underline">
          <ChevronLeft className="h-4 w-4" />
          ダッシュボード
        </Link>
        <h1 className="mt-2 mb-6 text-2xl font-bold text-gray-900">提案履歴</h1>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
            </div>
          ) : projects.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500">プロジェクトがありません</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                  <th className="py-2">クライアント</th>
                  <th className="py-2">業種</th>
                  <th className="py-2">予算</th>
                  <th className="py-2">期間</th>
                  <th className="py-2">状態</th>
                  <th className="py-2">作成日</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2">
                      <Link href={`/adsim/${p.id}`} className="font-medium text-indigo-700 hover:underline">
                        {p.clientName}
                      </Link>
                      <div className="text-xs text-gray-500">{p.productName}</div>
                    </td>
                    <td className="py-2 text-gray-700">{p.industry}</td>
                    <td className="py-2 text-gray-700">¥{p.monthlyBudget.toLocaleString()}/月</td>
                    <td className="py-2 text-gray-700">{p.periodMonths}ヶ月</td>
                    <td className="py-2">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="py-2 text-xs text-gray-500">
                      {new Date(p.createdAt).toLocaleDateString('ja-JP')}
                    </td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(p.id, p.clientName)}
                        className="text-gray-400 hover:text-red-600"
                        title="削除"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {total > PAGE_SIZE && (
          <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
            <span>
              {offset + 1}〜{Math.min(offset + PAGE_SIZE, total)} 件 / 全 {total} 件
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                disabled={offset === 0}
                className="rounded border border-gray-300 px-3 py-1 disabled:opacity-30"
              >
                前へ
              </button>
              <button
                type="button"
                onClick={() => setOffset(offset + PAGE_SIZE)}
                disabled={offset + PAGE_SIZE >= total}
                className="rounded border border-gray-300 px-3 py-1 disabled:opacity-30"
              >
                次へ
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    draft: { label: '下書き', cls: 'bg-gray-100 text-gray-700' },
    generating: { label: '生成中', cls: 'bg-amber-100 text-amber-700' },
    completed: { label: '完了', cls: 'bg-green-100 text-green-700' },
    error: { label: 'エラー', cls: 'bg-red-100 text-red-700' },
  }
  const m = map[status] || map.draft
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${m.cls}`}>{m.label}</span>
}
