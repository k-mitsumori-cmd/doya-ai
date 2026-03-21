import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: '特定商取引法に基づく表記 | ドヤAI',
  description: '株式会社スリスタが運営するドヤAIの特定商取引法に基づく表記',
}

export default function TokushohoPage() {
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
        <h1 className="text-3xl font-bold text-gray-900 mb-8">特定商取引法に基づく表記</h1>

        <div className="prose prose-gray max-w-none">
          <p className="text-gray-600 mb-8">最終更新日: 2026年3月20日</p>

          <table className="w-full border-collapse">
            <tbody className="divide-y divide-gray-200">
              <tr>
                <th className="py-4 pr-4 text-left text-sm font-bold text-gray-900 align-top w-1/3">事業者名</th>
                <td className="py-4 text-sm text-gray-700">株式会社スリスタ（3star Inc.）</td>
              </tr>
              <tr>
                <th className="py-4 pr-4 text-left text-sm font-bold text-gray-900 align-top">代表者</th>
                <td className="py-4 text-sm text-gray-700">三森 捷暉</td>
              </tr>
              <tr>
                <th className="py-4 pr-4 text-left text-sm font-bold text-gray-900 align-top">所在地</th>
                <td className="py-4 text-sm text-gray-700">
                  〒221-0056<br />
                  神奈川県横浜市神奈川区金港町5-14 クアドリフォリオ8階
                </td>
              </tr>
              <tr>
                <th className="py-4 pr-4 text-left text-sm font-bold text-gray-900 align-top">電話番号</th>
                <td className="py-4 text-sm text-gray-700">
                  070-8581-8224<br />
                  <span className="text-xs text-gray-500">※お問い合わせはメールにてお願いいたします</span>
                </td>
              </tr>
              <tr>
                <th className="py-4 pr-4 text-left text-sm font-bold text-gray-900 align-top">メールアドレス</th>
                <td className="py-4 text-sm text-gray-700">
                  k-mitsumori@surisuta.jp
                </td>
              </tr>
              <tr>
                <th className="py-4 pr-4 text-left text-sm font-bold text-gray-900 align-top">ウェブサイト</th>
                <td className="py-4 text-sm text-gray-700">
                  <a href="https://surisuta.jp/" className="text-blue-600 hover:text-blue-800 underline" target="_blank" rel="noreferrer">
                    https://surisuta.jp/
                  </a>
                </td>
              </tr>
              <tr>
                <th className="py-4 pr-4 text-left text-sm font-bold text-gray-900 align-top">サービス名</th>
                <td className="py-4 text-sm text-gray-700">ドヤAI（ドヤライティングAI、ドヤバナーAI、ドヤインタビューAI、ドヤペルソナAI 等）</td>
              </tr>
              <tr>
                <th className="py-4 pr-4 text-left text-sm font-bold text-gray-900 align-top">サービスURL</th>
                <td className="py-4 text-sm text-gray-700">
                  <a href="https://doya-ai.surisuta.jp/" className="text-blue-600 hover:text-blue-800 underline" target="_blank" rel="noreferrer">
                    https://doya-ai.surisuta.jp/
                  </a>
                </td>
              </tr>
              <tr>
                <th className="py-4 pr-4 text-left text-sm font-bold text-gray-900 align-top">販売価格</th>
                <td className="py-4 text-sm text-gray-700">
                  各サービスの料金ページに記載の通り。<br />
                  月額プラン: ¥2,980〜¥49,800（税込）<br />
                  <span className="text-xs text-gray-500">※プランにより異なります。詳細は各サービスの料金ページをご確認ください。</span>
                </td>
              </tr>
              <tr>
                <th className="py-4 pr-4 text-left text-sm font-bold text-gray-900 align-top">販売価格以外の必要料金</th>
                <td className="py-4 text-sm text-gray-700">
                  インターネット接続料金、通信料金等はお客様のご負担となります。
                </td>
              </tr>
              <tr>
                <th className="py-4 pr-4 text-left text-sm font-bold text-gray-900 align-top">支払方法</th>
                <td className="py-4 text-sm text-gray-700">
                  クレジットカード決済（Stripe経由）<br />
                  <span className="text-xs text-gray-500">VISA / Mastercard / American Express / JCB 等</span>
                </td>
              </tr>
              <tr>
                <th className="py-4 pr-4 text-left text-sm font-bold text-gray-900 align-top">支払時期</th>
                <td className="py-4 text-sm text-gray-700">
                  お申し込み時に即時決済。以降、月額プランは毎月同日に自動課金されます。
                </td>
              </tr>
              <tr>
                <th className="py-4 pr-4 text-left text-sm font-bold text-gray-900 align-top">サービス提供時期</th>
                <td className="py-4 text-sm text-gray-700">
                  お支払い完了後、直ちにご利用いただけます。
                </td>
              </tr>
              <tr>
                <th className="py-4 pr-4 text-left text-sm font-bold text-gray-900 align-top">返品・キャンセルについて</th>
                <td className="py-4 text-sm text-gray-700">
                  デジタルコンテンツの性質上、お支払い後の返品・返金は原則として承っておりません。<br />
                  ただし、サービスの重大な不具合により利用できない場合は、個別にご相談ください。
                </td>
              </tr>
              <tr>
                <th className="py-4 pr-4 text-left text-sm font-bold text-gray-900 align-top">解約について</th>
                <td className="py-4 text-sm text-gray-700">
                  月額プランはいつでも解約可能です。解約後も、現在の請求期間の終了日まで有料機能をご利用いただけます。<br />
                  解約手続きは各サービスのプラン管理ページ、またはStripeカスタマーポータルから行えます。<br />
                  解約に伴う違約金・ペナルティはありません。
                </td>
              </tr>
              <tr>
                <th className="py-4 pr-4 text-left text-sm font-bold text-gray-900 align-top">動作環境</th>
                <td className="py-4 text-sm text-gray-700">
                  最新版の Google Chrome / Safari / Firefox / Microsoft Edge を推奨。<br />
                  <span className="text-xs text-gray-500">※一部機能はモバイルブラウザでもご利用いただけますが、PC環境を推奨します。</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <footer className="mt-16 pt-8 border-t border-gray-200 text-center">
          <div className="flex items-center justify-center gap-4 text-xs text-gray-400 font-bold mb-4">
            <Link href="/terms" className="hover:text-gray-600">利用規約</Link>
            <span>|</span>
            <Link href="/privacy" className="hover:text-gray-600">プライバシーポリシー</Link>
          </div>
          <p className="text-xs text-gray-400">© 2025 株式会社スリスタ</p>
        </footer>
      </main>
    </div>
  )
}
