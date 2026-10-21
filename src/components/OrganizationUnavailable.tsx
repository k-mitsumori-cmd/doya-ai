import Link from 'next/link'
import SignInReturnLink from '@/components/SignInReturnLink'

export default function OrganizationUnavailable({ serviceHref, serviceName }: {
  serviceHref: '/aio' | '/shodan'
  serviceName: string
}) {
  return (
    <section className="mx-auto max-w-xl space-y-4 px-6 py-12" aria-labelledby="organization-unavailable-title">
      <h1 id="organization-unavailable-title" className="text-xl font-bold text-slate-900">この組織を表示できません</h1>
      <p className="text-sm leading-7 text-slate-600">組織が削除されたか、アクセス権限が変更された可能性があります。ログイン中のアカウントをご確認ください。</p>
      <nav aria-label="利用を再開する" className="flex flex-wrap gap-4 text-sm font-bold text-blue-700">
        <SignInReturnLink fallback={serviceHref} className="underline">アカウントを確認してログイン</SignInReturnLink>
        <Link href={serviceHref} className="underline">{serviceName}の入口へ</Link>
        <Link href="/home" className="underline">経営ホームへ戻る</Link>
      </nav>
    </section>
  )
}
