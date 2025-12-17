import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* ヘッダー */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center">
          <Link href="/" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
            <ArrowLeft className="w-5 h-5" />
            <span>トップに戻る</span>
          </Link>
        </div>
      </header>

      {/* メイン */}
      <main className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">プライバシーポリシー</h1>
        
        <div className="prose prose-gray max-w-none">
          <p className="text-gray-600 mb-8">最終更新日: 2024年12月17日</p>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">1. はじめに</h2>
            <p className="text-gray-700 leading-relaxed">
              ドヤAI（以下「本サービス」）は、ユーザーのプライバシーを尊重し、
              個人情報の保護に努めます。本プライバシーポリシーは、
              当社がどのように個人情報を収集、使用、保護するかについて説明します。
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">2. 収集する情報</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              当社は、以下の情報を収集することがあります：
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Googleアカウント情報（メールアドレス、名前、プロフィール画像）</li>
              <li>利用状況データ（生成回数、使用テンプレート等）</li>
              <li>支払い情報（Stripeを通じて処理）</li>
              <li>技術情報（IPアドレス、ブラウザ情報、デバイス情報）</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">3. 情報の使用目的</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              収集した情報は、以下の目的で使用されます：
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>本サービスの提供・運営</li>
              <li>ユーザー認証</li>
              <li>課金処理</li>
              <li>サービス改善</li>
              <li>お問い合わせ対応</li>
              <li>重要なお知らせの送信</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">4. 情報の共有</h2>
            <p className="text-gray-700 leading-relaxed">
              当社は、法令に基づく場合を除き、ユーザーの個人情報を第三者に提供しません。
              ただし、以下のサービス提供者とデータを共有することがあります：
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2 mt-4">
              <li>Google（認証サービス）</li>
              <li>Stripe（決済処理）</li>
              <li>OpenAI（AI生成機能）</li>
              <li>Vercel（ホスティング）</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">5. データの保護</h2>
            <p className="text-gray-700 leading-relaxed">
              当社は、適切な技術的・組織的措置を講じて、
              ユーザーの個人情報を不正アクセス、紛失、破壊から保護します。
              すべてのデータ転送は暗号化されています。
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">6. Cookieの使用</h2>
            <p className="text-gray-700 leading-relaxed">
              本サービスでは、ユーザー体験の向上とセッション管理のためにCookieを使用します。
              ブラウザの設定でCookieを無効にすることができますが、
              一部の機能が正常に動作しなくなる場合があります。
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">7. ユーザーの権利</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              ユーザーは、以下の権利を有します：
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>個人情報へのアクセス</li>
              <li>個人情報の訂正</li>
              <li>アカウントの削除</li>
              <li>データのエクスポート</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">8. お問い合わせ</h2>
            <p className="text-gray-700 leading-relaxed">
              プライバシーに関するご質問やご要望は、以下までご連絡ください：
              <br />
              <a href="mailto:support@doya-ai.com" className="text-blue-600 hover:underline">
                support@doya-ai.com
              </a>
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">9. ポリシーの変更</h2>
            <p className="text-gray-700 leading-relaxed">
              当社は、必要に応じて本プライバシーポリシーを変更することがあります。
              重要な変更がある場合は、本サービス上でお知らせします。
            </p>
          </section>
        </div>
      </main>
    </div>
  )
}

