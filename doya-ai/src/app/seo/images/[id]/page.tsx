import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureSeoSchema } from '@seo/lib/bootstrap'

export const runtime = 'nodejs'

export default async function SeoImageDetailPage({ params }: { params: { id: string } }) {
  await ensureSeoSchema()
  const session = await getServerSession(authOptions)
  const user: any = session?.user || null
  const userId = String(user?.id || '')
  if (!userId) notFound()

  const id = params.id
  const img = await (prisma as any).seoImage.findUnique({
    where: { id },
    include: { article: { select: { id: true, title: true, userId: true } } },
  })
  if (!img) notFound()
  if (String(img?.article?.userId || '') !== userId) notFound()

  const articleId = String(img.articleId || img.article?.id || '')
  const title = String(img.title || (img.kind === 'BANNER' ? '記事バナー' : '図解') || '画像')

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#F8FAFC] to-white py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div>
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">画像詳細</p>
            <h1 className="text-xl sm:text-2xl font-black text-gray-900 mt-1">{title}</h1>
            <p className="text-xs font-bold text-gray-500 mt-2">
              {img.kind} / {new Date(img.createdAt).toLocaleString()}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <Link href={`/seo/articles/${articleId}?tab=media`} className="inline-flex">
              <span className="h-10 px-4 rounded-xl bg-white border border-gray-200 text-gray-800 font-black text-xs inline-flex items-center gap-2 hover:bg-gray-50">
                記事に戻る
              </span>
            </Link>
            <a
              href={`/api/seo/images/${id}`}
              download
              className="h-10 px-4 rounded-xl bg-gray-900 text-white font-black text-xs inline-flex items-center gap-2 hover:bg-gray-800"
            >
              ダウンロード
            </a>
            <a
              href={`/api/seo/images/${id}`}
              target="_blank"
              rel="noreferrer"
              className="h-10 px-4 rounded-xl bg-white border border-gray-200 text-gray-800 font-black text-xs inline-flex items-center gap-2 hover:bg-gray-50"
            >
              新しいタブで開く
            </a>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
          <div className="p-4 sm:p-6">
            <div className="rounded-2xl border border-gray-100 overflow-hidden bg-gray-50">
              <img src={`/api/seo/images/${id}`} alt={title} className="w-full h-auto" />
            </div>

            <div className="mt-6 p-4 rounded-2xl bg-gray-50 border border-gray-100">
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest">プロンプト（生成ログ）</p>
              <pre className="mt-2 text-[11px] whitespace-pre-wrap text-gray-700 font-medium leading-relaxed">
                {String(img.prompt || '').trim() || '（プロンプトが保存されていません）'}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}


