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
  const id = params.id
  const session = await getServerSession(authOptions)
  const user: any = session?.user || null
  const userId = String(user?.id || '')
  // ゲスト/未ログインで「詳細ページ」導線に触れてもエラーページにならないようにする
  if (!userId) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-[#F8FAFC] to-white py-10 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-xl p-8">
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">画像詳細</p>
            <h1 className="text-xl sm:text-2xl font-black text-gray-900 mt-2">ログインが必要です</h1>
            <p className="text-sm font-bold text-gray-600 mt-3 leading-relaxed">
              画像の詳細ページはログイン後に利用できます。ログインすると、この画像のプレビューや生成ログが確認できます。
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link href={`/auth/signin?next=/seo/images/${id}`} className="inline-flex">
                <span className="h-11 px-6 rounded-xl bg-gray-900 text-white font-black text-sm inline-flex items-center hover:bg-gray-800">
                  ログインする
                </span>
              </Link>
              <Link href="/seo/pricing" className="inline-flex">
                <span className="h-11 px-6 rounded-xl bg-white border border-gray-200 text-gray-900 font-black text-sm inline-flex items-center hover:bg-gray-50">
                  料金プランを見る
                </span>
              </Link>
            </div>
          </div>
        </div>
      </main>
    )
  }

  // 画像のダウンロード/コピーは「画像生成が解放されている条件」と同じに揃える
  const plan = normalizeSeoPlan(user?.seoPlan || user?.plan || 'FREE')
  const trial = isTrialActive(user?.firstLoginAt || null)
  const trialActive = !!userId && trial.active
  const imagesAllowed = canUseSeoImages({ isLoggedIn: true, plan, trialActive })

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
    // 古い「文字を入れない」系の文言を行単位で除去
    const lines = text.replace(/\r\n/g, '\n').split('\n')
    const filtered = lines.filter((line) => {
      const t = line.trim()
      if (!t) return true
      // 「文字を入れない」「文字は入れない」「NO TEXT」系を含む行を除去
      if (/文字.*入れない/i.test(t)) return false
      if (/文字は一切入れない/i.test(t)) return false
      if (/画像内に文字/i.test(t)) return false
      if (/NO TEXT/i.test(t)) return false
      // 「ネガティブスペース」「余白を確保」「余白（ネガティブスペース）」を含む行を除去
      if (/ネガティブスペース/i.test(t)) return false
      if (/後から文字を載せ/i.test(t)) return false
      if (/余白.*確保/i.test(t)) return false
      if (/大きな余白/i.test(t)) return false
      // 「参考：後から載せる…」パターン
      if (/参考.*後から載せる.*コピー/i.test(t)) return false
      if (/画像に文字は入れない/i.test(t)) return false
      // CTAを作らない系
      if (/CTA要素.*作らない.*入れない/i.test(t)) return false
      if (/CTA.*入れない/i.test(t)) return false
      // 広告バナーではない系
      if (/これは広告バナーではない/i.test(t)) return false
      return true
    })
    text = filtered.join('\n')
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


