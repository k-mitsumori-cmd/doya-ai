import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureSeoSchema } from '@seo/lib/bootstrap'
import { canUseSeoImages, isTrialActive, normalizeSeoPlan } from '@/lib/seoAccess'

export const runtime = 'nodejs'

export default async function SeoImageDetailPage({ params }: { params: { id: string } }) {
  await ensureSeoSchema()
  const session = await getServerSession(authOptions)
  const user: any = session?.user || null
  const userId = String(user?.id || '')
  if (!userId) notFound()

  // 画像のダウンロード/コピーは「画像生成が解放されている条件」と同じに揃える
  const plan = normalizeSeoPlan(user?.seoPlan || user?.plan || 'FREE')
  const trial = isTrialActive(user?.firstLoginAt || null)
  const trialActive = !!userId && trial.active
  const imagesAllowed = canUseSeoImages({ isLoggedIn: true, plan, trialActive })

  const id = params.id
  const img = await (prisma as any).seoImage.findUnique({
    where: { id },
    include: { article: { select: { id: true, title: true, userId: true } } },
  })
  if (!img) notFound()
  if (String(img?.article?.userId || '') !== userId) notFound()

  const articleId = String(img.articleId || img.article?.id || '')
  const title = String(img.title || (img.kind === 'BANNER' ? '記事バナー' : '図解') || '画像')

  // 古いプロンプト/descriptionから不要な文言を除去
  function sanitizePromptText(raw: string): string {
    let text = String(raw || '').trim()
    // 古い「文字を入れない」系の文言を除去
    const removePatterns = [
      /（参考\s*[：:]\s*後から載せる想定のコピー案\s*[\/\/]\s*画像に文字は入れない）/g,
      /参考\s*[：:]\s*後から載せる想定のコピー案\s*[\/\/]\s*画像に文字は入れない/g,
      /画像に文字は入れない（日本語\/英語\/数字\/記号を含む）/g,
      /画像に文字は一切入れない（日本語\/英語\/数字\/記号を含む）/g,
      /後から文字を載せられる「大きな余白（ネガティブスペース）」を確保する[。．]?/g,
      /後から文字を載せられる大きな余白（ネガティブスペース）を確保する[。．]?/g,
      /・画像内に文字は一切入れない（日本語\/英語\/数字\/記号を含む）\n?/g,
      /・後から文字を載せられる大きな余白（ネガティブスペース）を確保する\n?/g,
      /-\s*画像内に文字は一切入れない[^\n]*\n?/g,
      /-\s*後から文字を載せられる[^\n]*\n?/g,
    ]
    for (const pat of removePatterns) {
      text = text.replace(pat, '')
    }
    // 連続空行を整理
    text = text.replace(/\n{3,}/g, '\n\n').trim()
    return text
  }

  const sanitizedPrompt = sanitizePromptText(img.prompt || '')
  const sanitizedDescription = sanitizePromptText((img as any).description || '')

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
            {imagesAllowed ? (
              <>
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
              </>
            ) : (
              <Link href="/seo/dashboard/plan" className="inline-flex">
                <span className="h-10 px-4 rounded-xl bg-gray-900 text-white font-black text-xs inline-flex items-center gap-2 hover:bg-gray-800">
                  料金プランを見る
                </span>
              </Link>
            )}
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
          <div className="p-4 sm:p-6">
            {!imagesAllowed && (
              <div className="mb-4 p-5 rounded-2xl bg-amber-50 border border-amber-100">
                <p className="font-black text-amber-900 text-sm">ダウンロードは有料プラン限定です</p>
                <p className="text-xs font-bold text-amber-800/80 mt-1">現在のプラン: {plan}</p>
                <Link href="/seo/dashboard/plan" className="inline-flex mt-3">
                  <span className="h-10 px-5 rounded-xl bg-gray-900 text-white font-black text-xs inline-flex items-center gap-2 hover:bg-gray-800">
                    アップグレードする
                  </span>
                </Link>
              </div>
            )}

            <div className="rounded-2xl border border-gray-100 overflow-hidden bg-gray-50 relative">
              <img src={`/api/seo/images/${id}`} alt={title} className="w-full h-auto" />
              {!imagesAllowed && (
                <div className="absolute inset-0 bg-black/55 flex items-center justify-center p-4">
                  <div className="rounded-2xl bg-black/55 border border-white/20 backdrop-blur-[2px] p-4 text-center">
                    <p className="text-white text-sm font-black">ロック中（表示のみ）</p>
                    <p className="mt-1 text-white/80 text-[11px] font-bold">
                      アップグレードでダウンロードできます
                    </p>
                    <Link href="/seo/dashboard/plan" className="inline-flex mt-3">
                      <span className="h-10 px-5 rounded-xl bg-white text-gray-900 font-black text-xs inline-flex items-center gap-2 hover:bg-gray-100">
                        料金プランを見る
                      </span>
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 p-4 rounded-2xl bg-gray-50 border border-gray-100">
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest">プロンプト（生成ログ）</p>
              <pre className="mt-2 text-[11px] whitespace-pre-wrap text-gray-700 font-medium leading-relaxed">
                {sanitizedPrompt || '（プロンプトが保存されていません）'}
              </pre>
            </div>

            {!!sanitizedDescription && (
              <div className="mt-4 p-4 rounded-2xl bg-white border border-gray-100">
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest">コピー構成 / デザイン意図（生成結果）</p>
                <pre className="mt-2 text-[11px] whitespace-pre-wrap text-gray-700 font-medium leading-relaxed">
                  {sanitizedDescription}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}


