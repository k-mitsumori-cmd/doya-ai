import Link from 'next/link'

type SearchParams = Promise<{ reason?: string | string[]; returnTo?: string | string[] }>

function safeReturnPath(raw: string | string[] | undefined): string {
  const value = typeof raw === 'string' ? raw.trim() : ''
  if (!value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f]/.test(value)) {
    return '/banner/dashboard/plan'
  }
  return value
}

export default async function PortalUnavailablePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const returnTo = safeReturnPath(params.returnTo)
  const missing = params.reason === 'missing'
  const retryUrl = `/api/stripe/portal?returnTo=${encodeURIComponent(returnTo)}`

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col justify-center px-6 py-16 text-slate-900">
      <h1 className="text-2xl font-bold">契約管理画面を開けませんでした</h1>
      <p className="mt-5 leading-7 text-slate-600">
        {missing
          ? '現在のアカウントに紐づく契約が見つかりませんでした。別のアカウントで契約した可能性がある場合は、ログイン状態をご確認ください。'
          : '契約情報の確認中にエラーが発生しました。時間をおいて、もう一度お試しください。'}
      </p>
      <div className="mt-8 flex flex-wrap gap-4">
        <Link href={retryUrl} className="rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-700">
          もう一度試す
        </Link>
        <Link href={returnTo} className="rounded-lg border border-slate-300 px-5 py-3 font-semibold text-slate-800 hover:bg-slate-50">
          元の画面に戻る
        </Link>
      </div>
    </main>
  )
}
