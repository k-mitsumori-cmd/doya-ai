import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'プライバシーポリシー | ドヤAI',
  description: '株式会社スリスタが運営するドヤAI（ドヤバナーAI・ドヤ記事作成 等の各サービス）共通のプライバシーポリシー',
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-black text-slate-900 mb-2">プライバシーポリシー</h1>
        <p className="text-sm text-slate-500 mb-8">最終更新日: 2026年5月31日</p>

        <div className="space-y-8 text-slate-700 leading-relaxed">
          <section>
            <p>
              株式会社スリスタ（3star Inc.、以下「当社」）は、当社が提供する「ドヤAI」を構成する各サービス（ドヤバナーAI、ドヤ記事作成、ドヤインタビュー、ドヤペルソナAI、ドヤ勤怠、ドヤリスト、ドヤプロマネ、その他今後追加されるサービスを含み、以下総称して「本サービス」）における利用者（以下「ユーザー」）の個人情報の取扱いについて、以下のとおりプライバシーポリシー（以下「本ポリシー」）を定めます。本ポリシーは本サービス共通で適用されます。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-slate-800 mb-4">1. 運営者情報</h2>
            <p>
              本サービスは、株式会社スリスタ（3star Inc.）が運営しています。本サービスに関する個人情報の管理責任者は当社とします。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-slate-800 mb-4">2. 取得する情報</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>アカウント情報（氏名、メールアドレス、認証情報 等）</li>
              <li>利用情報（生成履歴、入力内容、アップロードされたファイル、アクセスログ、IPアドレス、利用端末・ブラウザ情報 等）</li>
              <li>決済情報（決済代行事業者 Stripe を通じて処理されます。当社はクレジットカード番号等を保持しません）</li>
              <li>お問い合わせ・改善依頼等を通じてご提供いただく情報</li>
              <li>Cookie および類似技術により取得される情報</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-black text-slate-800 mb-4">3. 利用目的</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>本サービスの提供・運営・維持・改善</li>
              <li>ユーザー認証およびアカウント管理</li>
              <li>料金の請求・決済処理</li>
              <li>ユーザーサポート、お問い合わせ・改善依頼への対応</li>
              <li>不正利用の防止およびセキュリティの確保</li>
              <li>本サービスに関する重要なお知らせ・案内の配信</li>
              <li>利用状況の分析、新機能・新サービスの開発</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-black text-slate-800 mb-4">4. AIによる処理について</h2>
            <p>
              本サービスは、入力された内容の処理のために外部のAI・クラウド事業者（OpenAI、Google 等）のAPIを利用する場合があります。これらの事業者には、サービス提供に必要な範囲でデータが送信されます。機密情報・第三者の個人情報など、第三者に送信されることが望ましくない情報の入力はお控えください。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-slate-800 mb-4">5. メール配信について</h2>
            <p>
              当社は、本サービスに関する重要なお知らせのほか、マーケティング情報をメールで配信する場合があります。マーケティングメールは、配信停止用リンクからいつでも配信を停止できます。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-slate-800 mb-4">6. 第三者提供・業務委託</h2>
            <p>
              当社は、次の場合を除き、あらかじめユーザーの同意を得ることなく個人情報を第三者に提供しません。
            </p>
            <ul className="list-disc list-inside space-y-2 mt-2">
              <li>法令に基づく場合</li>
              <li>人の生命・身体・財産の保護のために必要で、本人の同意を得ることが困難な場合</li>
              <li>本サービス提供に必要な範囲で、決済・クラウド・分析等の業務を委託する場合（この場合、当社は委託先に対し適切な監督を行います）</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-black text-slate-800 mb-4">7. データの保管期間</h2>
            <p>
              当社は、利用目的の達成に必要な期間、個人情報を保管します。アカウント削除後は、法令により保存が義務付けられている場合を除き、合理的な期間内に適切に削除または匿名化します。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-slate-800 mb-4">8. 安全管理措置</h2>
            <p>
              当社は、取り扱う個人情報の漏えい、滅失または毀損の防止その他の安全管理のために、必要かつ適切な措置を講じます。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-slate-800 mb-4">9. 免責事項</h2>
            <p>
              当社は前条の安全管理措置を講じますが、インターネットを利用したサービスの性質上、情報の安全性を完全に保証することはできません。
              当社は、当社が善良な管理者の注意をもって適切な安全管理措置を講じていたにもかかわらず、次の各号に起因して生じた損害については、法令で許容される範囲において責任を負わないものとします。
            </p>
            <ul className="list-disc list-inside space-y-2 mt-2">
              <li>第三者による不正アクセス、サイバー攻撃、不正なプログラム等、当社の合理的な管理を超える行為</li>
              <li>ユーザー自身による認証情報の管理不備、誤操作、または第三者へのアカウント情報の開示・共有</li>
              <li>当社が利用する外部サービス・通信回線・インフラの障害等、当社の責めに帰すことのできない事由</li>
              <li>天災地変その他の不可抗力</li>
            </ul>
            <p className="mt-3">
              なお、本条その他本ポリシーの定めは、当社の故意または重過失による場合、および消費者契約法その他の強行法規により責任の制限が認められない場合には適用されず、当社は法令に従い責任を負います。当社が責任を負う場合であっても、その範囲は現実に発生した直接かつ通常の損害に限られるものとします。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-slate-800 mb-4">10. 開示・訂正・削除等の請求</h2>
            <p>
              ユーザーは、当社が保有する自己の個人情報について、法令に基づき、開示・訂正・利用停止・削除等を請求することができます。ご請求は、下記のお問い合わせ窓口までご連絡ください。本人確認のうえ、法令に従い対応します。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-slate-800 mb-4">11. お問い合わせ</h2>
            <p>
              本ポリシーに関するお問い合わせ、および個人情報の取扱いに関するご請求は、本サービス内の「お問い合わせ・改善依頼」窓口、または当社所定の連絡先までご連絡ください。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-slate-800 mb-4">12. 本ポリシーの改定</h2>
            <p>
              当社は、法令の変更やサービス内容の変更等に応じて、本ポリシーを改定することがあります。重要な変更を行う場合は、本サービス上での掲示その他適切な方法により周知します。改定後のポリシーは、本ページに掲載した時点から効力を生じます。
            </p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-slate-100">
          <p className="text-xs text-slate-400 font-bold">© 2026 株式会社スリスタ（3star Inc.）</p>
        </div>
      </div>
    </div>
  )
}
