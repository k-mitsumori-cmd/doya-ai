// ============================================
// 開発中のベータ版のツールを開いた人に出す案内（サーバーで描く）
// ============================================
// services.ts で hidden: 'beta' にしたツールの layout が、許可していない人に children の代わりに出す。
// ⚠️ ツールの画面は描かない（API も 403 で止めている。src/lib/beta-service.server.ts）。
import Link from 'next/link'
import { UiIcon } from '@/components/icons'

export default function BetaServiceNotice({ serviceName, signedIn }: { serviceName: string; signedIn: boolean }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-16 bg-white">
      <section role="status" aria-labelledby="beta-service-title" className="w-full max-w-md text-center">
        <span className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-[#0066ff]/10 text-[#0066ff]">
          <UiIcon name="lock" size={24} aria-hidden />
        </span>
        <p className="mb-2 text-xs font-bold tracking-wider text-[#0066ff]">開発中のベータ版</p>
        <h1 id="beta-service-title" className="mb-3 text-xl font-bold text-gray-900">
          {serviceName}は開発中のベータ版です
        </h1>
        <p className="mb-8 text-sm leading-relaxed text-gray-600">
          いまは一部の方だけが使えます。<wbr />公開の準備ができしだい、<wbr />ドヤAIのツール一覧でお知らせします。
        </p>
        <Link
          href={signedIn ? '/home' : '/'}
          className="inline-flex items-center justify-center rounded-lg bg-[#0066ff] px-5 py-3 text-sm font-bold text-white hover:bg-[#0052cc]"
        >
          {signedIn ? '経営ホームへ戻る' : 'ドヤAIのトップへ'}
        </Link>
      </section>
    </div>
  )
}
