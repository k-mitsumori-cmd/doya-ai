import Link from 'next/link'

export const metadata = {
  title: 'プライバシーポリシー | ドヤバナーAI',
  description: '株式会社スリスタが運営するドヤバナーAIのプライバシーポリシー',
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="mb-8">
          <Link href="/banner" className="text-sm font-black text-blue-600 hover:text-blue-800">
            ← ドヤバナーAIに戻る
          </Link>
        </div>

        <h1 className="text-3xl font-black text-slate-900 mb-8">プライバシーポリシー</h1>

        <div className="prose prose-slate max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-black text-slate-800 mb-4">1. 運営者情報</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              本サービス「ドヤバナーAI」は、株式会社スリスタ（以下「当社」）が運営しています。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-slate-800 mb-4">2. 収集する情報</h2>
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              当社は、本サービスの提供にあたり、以下の情報を収集することがあります。
            </p>
            <ul className="list-disc list-inside text-sm text-slate-600 space-y-2">
              <li>Googleアカウントによるログイン時に取得されるメールアドレス、氏名、プロフィール画像</li>
              <li>本サービスの利用履歴（生成したバナー画像、入力したURL、テキスト等）</li>
              <li>決済情報（Stripeを通じて処理され、当社はカード情報を直接保持しません）</li>
              <li>IPアドレス、アクセスログ等の技術的情報</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-black text-slate-800 mb-4">3. 情報の利用目的</h2>
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              収集した情報は、以下の目的で利用します。
            </p>
            <ul className="list-disc list-inside text-sm text-slate-600 space-y-2">
              <li>本サービスの提供・運営・改善</li>
              <li>ユーザー認証およびアカウント管理</li>
              <li>有料プランの課金処理</li>
              <li>サービスに関するお知らせ・メール配信</li>
              <li>お問い合わせへの対応</li>
              <li>利用状況の分析・統計</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-black text-slate-800 mb-4">4. メール配信について</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              ご登録いただいたメールアドレスは、サービスに関する重要なお知らせ、機能アップデート情報、
              キャンペーン情報等のメール配信に使用させていただくことがあります。
              配信停止をご希望の場合は、メール内の配信停止リンクからお手続きいただけます。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-slate-800 mb-4">5. 第三者提供</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              当社は、法令に基づく場合を除き、ユーザーの同意なく個人情報を第三者に提供することはありません。
              ただし、以下のサービスと情報を共有することがあります。
            </p>
            <ul className="list-disc list-inside text-sm text-slate-600 space-y-2 mt-4">
              <li>Google（認証サービス）</li>
              <li>Stripe（決済サービス）</li>
              <li>Vercel（ホスティングサービス）</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-black text-slate-800 mb-4">6. データの保管期間</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              生成履歴データは最大3ヶ月間保持され、それ以降は自動的に削除されます。
              アカウント情報は、退会のお申し出があるまで保持されます。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-slate-800 mb-4">7. セキュリティ</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              当社は、個人情報の漏洩、滅失、毀損を防止するため、適切なセキュリティ対策を講じています。
              通信はSSL/TLSにより暗号化されています。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-slate-800 mb-4">8. お問い合わせ</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              プライバシーポリシーに関するお問い合わせは、サービス内のお問い合わせフォームよりご連絡ください。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-slate-800 mb-4">9. 改定</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              本ポリシーは、法令の改正やサービスの変更に伴い、予告なく変更されることがあります。
              変更後のポリシーは、本ページに掲載した時点で効力を生じるものとします。
            </p>
          </section>

          <div className="pt-8 border-t border-slate-200">
            <p className="text-xs text-slate-400">
              制定日：2025年1月1日<br />
              最終更新日：2025年1月1日
            </p>
          </div>
        </div>

        <footer className="mt-16 pt-8 border-t border-slate-200 text-center">
          <p className="text-xs text-slate-400 font-bold">© 2025 株式会社スリスタ</p>
        </footer>
      </div>
    </div>
  )
}
