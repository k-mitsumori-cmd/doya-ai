import Link from 'next/link'
import { Check, Sparkles, Zap } from 'lucide-react'

export default function AllinonePricingPage() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-allinone-primarySoft px-3 py-1 text-xs font-black text-allinone-primary">
          <Sparkles className="h-3 w-3" />
          PRICING
        </div>
        <h1 className="text-3xl font-black tracking-tight text-allinone-ink sm:text-5xl">
          シンプルな料金プラン
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm text-allinone-muted sm:text-base">
          まずは無料で月3回。本格運用なら PRO で無制限。
        </p>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-2">
        {/* Free */}
        <div className="relative overflow-hidden rounded-3xl border border-allinone-line bg-white p-8">
          <div className="mb-1 text-xs font-black uppercase tracking-wider text-allinone-muted">
            FREE
          </div>
          <h2 className="text-3xl font-black text-allinone-ink">無料プラン</h2>
          <div className="mt-3 flex items-end gap-1">
            <span className="text-5xl font-black text-allinone-ink">¥0</span>
            <span className="mb-2 text-sm text-allinone-muted">/ 月</span>
          </div>
          <p className="mt-2 text-sm text-allinone-muted">登録不要・ゲストでも利用可</p>
          <ul className="mt-6 space-y-2 text-sm text-allinone-inkSoft">
            {[
              'URL分析 月3回まで',
              'サイト / SEO / ペルソナ / ビジュアル / アクションの全タブ',
              'キービジュアル自動生成 3案',
              'AIチャット（簡潔モード）',
              'PDF / Excel / Markdown 出力',
            ].map((f) => (
              <li key={f} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 flex-none text-allinone-accent" />
                {f}
              </li>
            ))}
          </ul>
          <Link
            href="/allinone"
            className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full border border-allinone-line bg-white py-3 text-sm font-black text-allinone-ink transition hover:border-allinone-primary hover:text-allinone-primary"
          >
            無料で試す
          </Link>
        </div>

        {/* PRO */}
        <div className="relative overflow-hidden rounded-3xl border border-allinone-primary/40 bg-gradient-to-br from-allinone-primary via-fuchsia-500 to-allinone-cyan p-8 text-white shadow-2xl shadow-allinone-primary/30">
          <div className="absolute right-5 top-5 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-black">
            RECOMMENDED
          </div>
          <div className="mb-1 text-xs font-black uppercase tracking-wider">PRO</div>
          <h2 className="text-3xl font-black">プロプラン</h2>
          <div className="mt-3 flex items-end gap-1">
            <span className="text-5xl font-black">¥9,980</span>
            <span className="mb-2 text-sm opacity-80">/ 月</span>
          </div>
          <p className="mt-2 text-sm opacity-80">本格運用・提案資料作成向け</p>
          <ul className="mt-6 space-y-2 text-sm">
            {[
              'URL分析 無制限',
              '詳細（冗長）モードのAIチャット',
              'キービジュアル再生成・追加生成',
              '個別セクションのAI再生成',
              'PPTX / PDF を含む全フォーマット出力',
              'Ahrefs 連携（順次）',
            ].map((f) => (
              <li key={f} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 flex-none" />
                {f}
              </li>
            ))}
          </ul>
          <Link
            href="/allinone"
            className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-white py-3 text-sm font-black text-allinone-ink transition hover:-translate-y-0.5 hover:shadow-xl"
          >
            <Zap className="h-4 w-4 text-allinone-primary" />
            PROを試す
          </Link>
          <span className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-white/10 blur-3xl" />
        </div>
      </div>

      <p className="mt-10 text-center text-xs text-allinone-muted">
        ※ ドヤAI 全サービス共通のアカウントで利用できます。他ツールの料金は各サービスの料金ページをご覧ください。
      </p>
    </section>
  )
}
