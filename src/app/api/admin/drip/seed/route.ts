import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminSession, COOKIE_NAME } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// 管理者専用: ドリップ配信のシードデータを投入
export async function POST() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  const { valid } = await verifyAdminSession(token || null)
  if (!valid) {
    return NextResponse.json({ error: '管理者認証が必要です' }, { status: 401 })
  }

  // 既にシーケンスが存在するかチェック
  const existingSeq = await prisma.dripSequence.findFirst()
  if (existingSeq) {
    return NextResponse.json({ error: 'シードデータは既に投入済みです', existing: true }, { status: 409 })
  }

  const baseStyle = `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr><td style="padding:40px 24px;"><table role="presentation" cellspacing="0" cellpadding="0" border="0" width="560" style="margin:0 auto;"><tr><td style="padding-bottom:24px;border-bottom:1px solid #e0e0e0;"><span style="font-size:18px;font-weight:700;color:#333;">`
  const baseEnd = `</td></tr><tr><td style="padding-top:32px;border-top:1px solid #f0f0f0;"><p style="margin:0 0 4px;font-size:13px;color:#333;"><strong>三森捷暉</strong></p><p style="margin:0 0 4px;font-size:13px;color:#888;">株式会社スリスタ 代表</p><p style="margin:0 0 4px;font-size:13px;color:#888;">BtoBマーケティング × SEO × AI活用</p><p style="margin:0;font-size:13px;"><a href="https://surisuta.jp" style="color:#4f46e5;text-decoration:none;">surisuta.jp</a>　|　<a href="https://www.youtube.com/@mitsumori_ai" style="color:#4f46e5;text-decoration:none;">YouTube</a>　|　<a href="https://doyamarke.surisuta.jp" style="color:#4f46e5;text-decoration:none;">ドヤマーケ</a></p></td></tr><tr><td style="padding-top:24px;border-top:1px solid #e0e0e0;"><p style="font-size:11px;color:#999;margin:0 0 4px;">© 2026 株式会社スリスタ</p><p style="font-size:11px;color:#999;margin:0 0 4px;"><a href="https://doyamarke.surisuta.jp" style="color:#999;text-decoration:none;">ドヤマーケ</a>　|　<a href="https://doyamarke.surisuta.jp/privacy" style="color:#999;text-decoration:none;">プライバシーポリシー</a></p></td></tr></table></td></tr></table>`

  function wrapHtml(headerTitle: string, bodyContent: string): string {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background-color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica Neue,Arial,sans-serif;color:#333333;font-size:15px;line-height:1.8;">${baseStyle}ドヤマーケ / ${headerTitle}</span></td></tr><tr><td style="padding-top:32px;">${bodyContent}</td></tr><tr><td style="padding:16px 0;text-align:center;"><a href="https://doyamarke.surisuta.jp/download/base02_doyamarke-free-1" style="display:inline-block;background-color:#4f46e5;color:#ffffff;padding:14px 40px;border-radius:6px;text-decoration:none;font-weight:700;font-size:15px;">マーケティング支援の無料相談を申し込む</a>${baseEnd}</body></html>`
  }

  try {
    // セグメント
    const segAll = await prisma.dripSegment.create({
      data: { name: '全ユーザー', key: 'all_users', conditions: { type: 'all' } },
    })

    // テンプレート8本
    const templates = await Promise.all([
      prisma.dripTemplate.create({ data: { name: 'D0_ウェルカム', subject: 'ドヤAIへのご登録ありがとうございます — 三森です', bodyHtml: wrapHtml('ドヤAIへのご登録ありがとうございます', '<p style="margin:0 0 20px;">はじめまして。株式会社スリスタ代表の三森です。</p><p style="margin:0 0 20px;">この度はドヤAIにご登録いただき、ありがとうございます。<br>YouTubeやWebサイトからお越しいただいた方も多いかと思います。</p><p style="margin:0 0 20px;">僕がドヤAIを作った理由はシンプルで、<br>「BtoBのマーケティングは外注すると高すぎる」という課題を解決したかったからです。</p><p style="margin:0 0 20px;">バナー制作を外注すれば1枚3〜5万円。SEO記事は1本5〜10万円。<br>中小企業にとって、この費用を毎月払い続けるのは現実的ではありません。</p><p style="margin:0 0 20px;">ドヤAIなら、月額9,980円でバナーもSEO記事もペルソナ設計も、<br>すべてAIで自動化できます。<strong>初回1時間は無料</strong>ですので、<br>まずは気になる機能を触ってみてください。</p><p style="margin:0 0 12px;font-weight:700;font-size:15px;color:#333;">まずはこちらからお試しください</p><p style="margin:0 0 8px;"><a href="https://doya-ai.surisuta.jp/banner" style="color:#4f46e5;font-weight:600;">▸ ドヤバナーAI — URLから広告バナーを自動生成</a></p><p style="margin:0 0 8px;"><a href="https://doya-ai.surisuta.jp/seo" style="color:#4f46e5;font-weight:600;">▸ ドヤライティングAI — SEO記事を自動生成</a></p><p style="margin:0 0 8px;"><a href="https://doya-ai.surisuta.jp/persona" style="color:#4f46e5;font-weight:600;">▸ ドヤペルソナAI — ターゲットペルソナを自動生成</a></p><p style="margin:24px 0 20px;">また、僕たち株式会社スリスタでは、AIを活用して低コストでマーケティングを進めたいという企業様向けに、<strong>BtoBマーケティングの支援サービス</strong>も行っています。</p><p style="margin:0 0 20px;">戦略設計から施策の実行・改善まで、御社の状況に合わせたご支援内容を詳しくお話しできますので、ご興味があればお気軽にお申し込みください。</p>') }}),

      prisma.dripTemplate.create({ data: { name: 'D1_バナーのコツ', subject: '【保存版】AIで広告バナーを量産する5つのコツ', bodyHtml: wrapHtml('AIで広告バナーを量産する5つのコツ', '<p style="margin:0 0 20px;">こんにちは、三森です。</p><p style="margin:0 0 20px;">昨日のご登録、ありがとうございました。<br>今日はYouTubeでもよくご質問をいただく<br>「AIバナーで成果を出すコツ」をまとめてお伝えします。</p><p style="margin:0 0 20px;">僕がクライアント企業さんの支援で実際に使っている方法なので、<br>ぜひ今日からの運用に取り入れてみてください。</p><p style="margin:0 0 12px;font-weight:700;font-size:16px;color:#333;">AIで広告バナーを量産する5つのコツ</p><p style="margin:0 0 20px;"><strong>1. まずURLを入れるだけで試す</strong><br>ドヤバナーAIは、WebサイトのURLを入力するだけでサイトのカラーや内容を自動解析し、バナーを生成します。デザインの指示書を作る必要はありません。まず1枚作ってみてください。</p><p style="margin:0 0 20px;"><strong>2. 1回で3パターン生成してA/Bテストに回す</strong><br>1回の生成で最大3パターンのバリエーションを同時作成できます。広告運用では「どのクリエイティブが刺さるか」を検証するのが鉄則。外注なら1週間かかるA/Bテスト用素材が、数分で揃います。</p><p style="margin:0 0 20px;"><strong>3. ペルソナを先に作ると訴求力が上がる</strong><br>ドヤペルソナAIでターゲット像を明確にしてからバナーを作ると、コピーやデザインの方向性がブレなくなります。ペルソナ → バナーの順番がおすすめです。</p><p style="margin:0 0 20px;"><strong>4. サイズを変えて媒体ごとに展開する</strong><br>同じ訴求でも、SNS広告・ディスプレイ広告・LP用ヘッダーなど媒体によって最適なサイズが異なります。</p><p style="margin:0 0 20px;"><strong>5. 月に10枚以上作るなら外注より圧倒的に安い</strong><br>デザイナーへの外注は1枚5,000〜10,000円が相場。月10枚で5〜10万円かかりますが、ドヤバナーAIなら定額で作り放題です。</p><p style="margin:0 0 20px;">ドヤバナーAIは<strong>無料で今すぐお試しいただけます</strong>。さらに活用されたい方には、月額2,980円のライトプランもご用意しています。</p><p style="margin:0 0 8px;"><a href="https://doya-ai.surisuta.jp/banner" style="color:#4f46e5;font-weight:600;">▸ ドヤバナーAI（無料で試す）</a></p><p style="margin:0 0 20px;"><a href="https://doyamarke.surisuta.jp" style="color:#4f46e5;font-weight:600;">▸ ドヤマーケ（マーケティングノウハウ・無料で読めます）</a></p><p style="margin:0 0 20px;">また、AIを活用して低コストでマーケティングを進めたいという企業様には、戦略設計から施策の実行・改善まで、トータルでのご支援も行っています。御社に合った具体的なご支援内容をお話しできますので、お気軽にご相談ください。</p>') }}),

      prisma.dripTemplate.create({ data: { name: 'D3_AIマーケ実践', subject: '月1万円から始める、中小企業のAIマーケティング', bodyHtml: wrapHtml('月1万円から始めるAIマーケティング', '<p style="margin:0 0 20px;">こんにちは、三森です。</p><p style="margin:0 0 20px;">YouTubeのコメントでも「AIは気になるけど、何から始めればいいかわからない」というご質問をよくいただきます。</p><p style="margin:0 0 20px;">今日は、僕が実際にクライアント企業さんに提案している<strong>「月1万円から始めるAIマーケティング」</strong>の3ステップをお伝えします。</p><p style="margin:0 0 12px;font-weight:700;font-size:16px;color:#333;">ステップ1：ペルソナを作る（Day 1）</p><p style="margin:0 0 20px;">まず、自社サイトのURLをドヤペルソナAIに入れてみてください。ターゲット顧客の人物像と、どんな訴求が刺さるかが自動で出てきます。これが全施策のベースになります。</p><p style="margin:0 0 12px;font-weight:700;font-size:16px;color:#333;">ステップ2：バナーを量産する（Day 2〜3）</p><p style="margin:0 0 20px;">ペルソナが決まったら、ドヤバナーAIで広告バナーを3〜5パターン作ります。SNS広告やディスプレイ広告に使えるクリエイティブが数分で揃います。外注なら1週間かかる作業です。</p><p style="margin:0 0 12px;font-weight:700;font-size:16px;color:#333;">ステップ3：SEO記事を積み上げる（Day 4〜）</p><p style="margin:0 0 20px;">広告で短期の集客をしつつ、SEO記事で中長期の流入を作ります。ドヤライティングAIなら、構成案から本文まで自動生成。品質監査機能で、公開前のチェックも効率化できます。</p><p style="margin:0 0 20px;">この3ステップを月1万円以下で回せるのが、AIマーケティングの最大のメリットです。</p><p style="margin:0 0 20px;">ただ、「うちの業種に合うキーワードがわからない」「広告予算の配分をどうすればいいか」といった<strong>マーケティング戦略の部分で悩まれている方</strong>も多いと思います。</p><p style="margin:0 0 20px;">僕たちは、AIを活用しながら低コストでマーケティングを進めたいという企業様に、戦略立案から施策実行までをトータルでご支援しています。御社に合った進め方を具体的にご提案しますので、ぜひ一度お話しさせてください。</p>') }}),

      prisma.dripTemplate.create({ data: { name: 'D5_SEO記事', subject: 'SEO記事をAIで書くときに絶対やってはいけないこと', bodyHtml: wrapHtml('SEO記事をAIで書くときの注意点', '<p style="margin:0 0 20px;">こんにちは、三森です。</p><p style="margin:0 0 20px;">今日は、SEO記事をAIで生成するときに<strong>やってしまいがちな失敗</strong>と、その対策をお伝えします。</p><p style="margin:0 0 20px;">YouTubeでも反響が大きかったテーマなので、すでにSEO記事を書いている方も、これから始める方も参考にしてみてください。</p><p style="margin:0 0 12px;font-weight:700;font-size:16px;color:#333;">やってはいけないこと3選</p><p style="margin:0 0 20px;"><strong>1. AIの出力をそのまま公開する</strong><br>AIが生成した文章は、そのままだと「どこかで読んだことがある」内容になりがちです。自社の経験や具体的な数字を加えることで、独自性のある記事に仕上がります。ドヤライティングAIの品質監査機能を使えば、公開前に品質チェックができます。</p><p style="margin:0 0 20px;"><strong>2. キーワードを決めずに書き始める</strong><br>「とりあえず記事を量産しよう」と始めてしまうと、検索ボリュームがないキーワードに時間を使ってしまいます。まずターゲットキーワードを決めてから書き始めることが鉄則です。</p><p style="margin:0 0 20px;"><strong>3. 1本の長文を一括で生成する</strong><br>3,000字以上の記事を一括で生成すると、後半の品質が落ちやすくなります。見出しごとに分割して生成し、最後に全体を通して確認する方法がおすすめです。ドヤライティングAIの分割生成機能はこの考え方で設計しています。</p><p style="margin:0 0 12px;font-weight:700;font-size:16px;color:#333;">逆に、うまくいっている人がやっていること</p><p style="margin:0 0 20px;">・ペルソナAIでターゲットを明確にしてからキーワードを選ぶ<br>・月に4〜8本のペースで継続的に記事を積み上げる<br>・公開後のアクセスデータを見て、タイトルや見出しを改善する</p><p style="margin:0 0 20px;">SEO記事は「書いて終わり」ではなく、改善し続けることで成果が出ます。</p><p style="margin:0 0 8px;"><a href="https://doya-ai.surisuta.jp/seo" style="color:#4f46e5;font-weight:600;">▸ ドヤライティングAI（無料で試す）</a></p><p style="margin:0 0 20px;"><a href="https://doyamarke.surisuta.jp" style="color:#4f46e5;font-weight:600;">▸ ドヤマーケ（SEOノウハウ記事・無料で読めます）</a></p><p style="margin:0 0 20px;">「自社に合ったキーワード戦略を相談したい」「SEOの優先順位を整理したい」という方は、無料相談をご利用ください。御社の状況に合わせたマーケティング施策をご提案します。</p>') }}),

      prisma.dripTemplate.create({ data: { name: 'D7_無料相談', subject: 'ツールだけでは解決しない部分、一緒に考えませんか？', bodyHtml: wrapHtml('ツールだけでは解決しない部分', '<p style="margin:0 0 20px;">こんにちは、三森です。</p><p style="margin:0 0 20px;">ドヤAIにご登録いただいて1週間が経ちました。ツールは使っていただけましたか？</p><p style="margin:0 0 20px;">僕がYouTubeやブログでお伝えしている通り、AIツールはマーケティングの「制作」を劇的に効率化してくれます。</p><p style="margin:0 0 20px;">ただ、正直に言うと<strong>ツールだけでは解決しない部分</strong>もあります。</p><p style="margin:0 0 8px;">・どのキーワードでSEO記事を書くべきか</p><p style="margin:0 0 8px;">・広告バナーのA/Bテストをどう設計するか</p><p style="margin:0 0 8px;">・リード獲得の導線をどう組み立てるか</p><p style="margin:0 0 20px;">・限られた予算をどの施策に配分するか</p><p style="margin:0 0 20px;">こうした「戦略」の部分は、やはり人が考える必要があります。</p><p style="margin:0 0 20px;">僕たち株式会社スリスタでは、<strong>AIを活用して低コストでマーケティングを進めたいという企業様向けに、BtoBマーケティングの支援サービス</strong>を提供しています。</p><p style="margin:0 0 20px;">具体的にお手伝いできる内容としては、</p><p style="margin:0 0 8px;">・<strong>マーケティング戦略の設計</strong>（ターゲット選定、チャネル戦略、KPI設計）</p><p style="margin:0 0 8px;">・<strong>コンテンツ施策の立案・実行</strong>（SEO記事、ホワイトペーパー、事例制作）</p><p style="margin:0 0 8px;">・<strong>広告運用・リード獲得の仕組みづくり</strong></p><p style="margin:0 0 20px;">・<strong>AIツールを組み合わせた業務効率化の提案</strong></p><p style="margin:0 0 20px;">といった形で、御社の状況と予算に合わせたプランをご提案しています。</p><p style="margin:0 0 20px;">30分程度のオンラインミーティングで、御社のマーケティング課題をお聞きした上で、どのようなご支援が可能か、具体的にお話しさせてください。</p><p style="margin:0 0 20px;font-size:14px;color:#666;">※ 無料相談は営業目的ではありません。御社にとってツールだけで十分な場合は、そのようにお伝えします。</p>') }}),

      prisma.dripTemplate.create({ data: { name: 'D10_ホワイトペーパー', subject: 'リード獲得の「仕組み」を作っていますか？', bodyHtml: wrapHtml('リード獲得の仕組みづくり', '<p style="margin:0 0 20px;">こんにちは、三森です。</p><p style="margin:0 0 20px;">今日は、BtoBマーケティングで最も効果的なリード獲得施策の一つ、<strong>ホワイトペーパー</strong>についてお話しします。</p><p style="margin:0 0 20px;">YouTubeでもお伝えしていますが、BtoBでリードを安定的に獲得するには「コンテンツと引き換えに連絡先をもらう」という仕組みが不可欠です。</p><p style="margin:0 0 12px;font-weight:700;font-size:16px;color:#333;">ホワイトペーパーが効果的な3つの理由</p><p style="margin:0 0 20px;"><strong>1. 「今すぐ客」以外にもリーチできる</strong><br>広告や問い合わせフォームだけでは、すでに購入意欲が高い人しか獲得できません。ホワイトペーパーなら「情報収集中」の段階のユーザーにもリーチでき、見込み顧客のリストを効率的に増やせます。</p><p style="margin:0 0 20px;"><strong>2. 専門性をアピールできる</strong><br>質の高いホワイトペーパーは、御社の専門性を証明する資料になります。「この会社は自社の課題を理解してくれている」と感じてもらえれば、商談化率も大幅に上がります。</p><p style="margin:0 0 20px;"><strong>3. 一度作れば長期間使い回せる</strong><br>ブログ記事と違い、ホワイトペーパーは「資料」としての寿命が長いのが特徴です。広告のランディングページ、メルマガ、営業資料など、さまざまな場面で活用できます。</p><p style="margin:0 0 20px;">ドヤマーケでは、ホワイトペーパーの作り方から配布戦略まで詳しく解説した記事も公開しています。</p><p style="margin:0 0 20px;"><a href="https://doyamarke.surisuta.jp" style="color:#4f46e5;font-weight:600;">▸ ドヤマーケ（無料で読めます）</a></p><p style="margin:0 0 20px;">「ホワイトペーパーを作りたいけど、何をテーマにすればいいかわからない」「リード獲得の導線全体を設計したい」という方は、ぜひ無料相談をご利用ください。御社の商材やターゲットに合わせたマーケティング施策の全体設計をご提案します。</p>') }}),

      prisma.dripTemplate.create({ data: { name: 'D14_自分vs外注vsAI', subject: 'マーケティング、自分でやるか・外注するか・AIに任せるか', bodyHtml: wrapHtml('自分でやるか・外注するか・AIか', '<p style="margin:0 0 20px;">こんにちは、三森です。</p><p style="margin:0 0 20px;">ドヤAIにご登録いただいて2週間が経ちました。今日は、僕がYouTubeやブログで最も反響をいただくテーマについてお話しします。</p><p style="margin:0 0 20px;"><strong>「マーケティング施策は自分でやるべき？外注すべき？AIに任せるべき？」</strong></p><p style="margin:0 0 20px;">結論から言うと、<strong>全部を一つの方法でやるのは間違い</strong>です。業務の種類によって、最適な方法が違います。</p><p style="margin:0 0 12px;font-weight:700;font-size:15px;color:#333;">AIに任せるべきもの</p><p style="margin:0 0 20px;">・バナー制作、SEO記事の下書き、ペルソナ設計など「制作系」の業務<br>・何度もパターンを出して検証する必要があるもの<br>・スピードが求められるもの</p><p style="margin:0 0 12px;font-weight:700;font-size:15px;color:#333;">人が判断すべきもの</p><p style="margin:0 0 20px;">・ターゲット選定、チャネル戦略、予算配分などの「戦略系」の業務<br>・ブランドのトーンや世界観に関わる意思決定<br>・数字を見て施策の優先順位を変える判断</p><p style="margin:0 0 12px;font-weight:700;font-size:15px;color:#333;">外注が有効なもの</p><p style="margin:0 0 20px;">・動画制作、Webサイト構築など専門スキルが必要な「制作」<br>・大量のコンテンツを短期間で仕上げる必要がある場合</p><p style="margin:0 0 20px;">僕たちが提案しているのは、この3つを<strong>最適に組み合わせる</strong>やり方です。AIで自動化できる部分はドヤAIに任せる。戦略の部分は僕たちと一緒に考える。必要な制作は外注先を含めてコーディネートする。</p><p style="margin:0 0 20px;">この<strong>「ハイブリッド型」</strong>が、中小企業にとって最もコスパが良く、かつ成果が出やすいアプローチだと考えています。</p><p style="margin:0 0 20px;">「うちの場合、どこをAIにして、どこを人に任せるべきか」具体的に整理したい方は、ぜひ無料相談をご利用ください。</p>') }}),

      prisma.dripTemplate.create({ data: { name: 'D21_導入事例', subject: '受注率を上げる「導入事例」、作っていますか？', bodyHtml: wrapHtml('導入事例の作り方', '<p style="margin:0 0 20px;">こんにちは、三森です。</p><p style="margin:0 0 20px;">今日は、BtoBの営業現場で最も効果的なコンテンツの一つ、<strong>導入事例</strong>についてお話しします。</p><p style="margin:0 0 20px;">僕がマーケティング支援をしている企業さんの多くが、「事例がないと商談が進まない」とおっしゃいます。</p><p style="margin:0 0 20px;">でも実際に事例コンテンツを作っている企業は、驚くほど少ないのが現状です。</p><p style="margin:0 0 12px;font-weight:700;font-size:16px;color:#333;">導入事例が強い3つの理由</p><p style="margin:0 0 20px;"><strong>1. 「自分ごと化」できる</strong><br>機能説明やスペックだけでは、お客様は「自社で使えるかどうか」がわかりません。同業種・同規模の企業の事例があると、一気に「自分ごと」になります。</p><p style="margin:0 0 20px;"><strong>2. 営業資料として使い回せる</strong><br>事例をPDF化すれば、営業チームが商談時に活用できます。Webサイトに掲載すれば、SEO経由の流入にもつながります。</p><p style="margin:0 0 20px;"><strong>3. AIで制作工程を効率化できる</strong><br>インタビュー音声の文字起こしから記事化まで、ドヤインタビューAIを使えば大幅に時間を短縮できます。</p><p style="margin:0 0 20px;">ドヤマーケでは、事例コンテンツの作り方を取材の準備からインタビュー質問集、記事構成のテンプレートまで詳しく解説しています。</p><p style="margin:0 0 20px;"><a href="https://doyamarke.surisuta.jp" style="color:#4f46e5;font-weight:600;">▸ ドヤマーケ（導入事例の作り方・無料で読めます）</a></p><p style="margin:0 0 20px;">「事例を作りたいけど、どの顧客に取材すればいいかわからない」「事例コンテンツをリード獲得につなげる方法を知りたい」という方は、お気軽にご相談ください。御社のマーケティング全体の中で、事例をどう位置づけるか。具体的なご支援内容をお話しします。</p>') }}),
    ])

    // シーケンス作成
    const seq = await prisma.dripSequence.create({
      data: { name: 'ドヤマーケ オンボーディング', status: 'active', segmentId: segAll.id },
    })

    // ステップ作成（8本）
    const stepConfigs = [
      { label: 'ウェルカム', dayOffset: 0, sendTime: '10:00', templateIdx: 0 },
      { label: 'バナーのコツ', dayOffset: 1, sendTime: '10:00', templateIdx: 1 },
      { label: 'AIマーケ実践', dayOffset: 3, sendTime: '10:00', templateIdx: 2 },
      { label: 'SEO記事', dayOffset: 5, sendTime: '10:00', templateIdx: 3 },
      { label: '無料相談', dayOffset: 7, sendTime: '10:00', templateIdx: 4 },
      { label: 'ホワイトペーパー', dayOffset: 10, sendTime: '10:00', templateIdx: 5 },
      { label: '自分vs外注vsAI', dayOffset: 14, sendTime: '10:00', templateIdx: 6 },
      { label: '導入事例', dayOffset: 21, sendTime: '10:00', templateIdx: 7 },
    ]

    for (let i = 0; i < stepConfigs.length; i++) {
      const s = stepConfigs[i]
      await prisma.dripStep.create({
        data: {
          sequenceId: seq.id,
          sortOrder: i,
          dayOffset: s.dayOffset,
          sendTime: s.sendTime,
          templateId: templates[s.templateIdx].id,
          conditionType: null,
          label: s.label,
        },
      })
    }

    // デフォルト設定
    const defaultSettings = [
      { key: 'fromName', value: '三森捷暉｜ドヤマーケ' },
      { key: 'fromEmail', value: 'noreply@surisuta.jp' },
      { key: 'replyTo', value: '' },
      { key: 'timezone', value: 'Asia/Tokyo' },
      { key: 'sendWindowStart', value: '08:00' },
      { key: 'sendWindowEnd', value: '21:00' },
      { key: 'rateLimit', value: 100 },
      { key: 'unsubscribeEnabled', value: true },
    ]
    for (const s of defaultSettings) {
      await prisma.dripSetting.upsert({
        where: { key: s.key },
        update: { value: s.value as any },
        create: { key: s.key, value: s.value as any },
      })
    }

    return NextResponse.json({
      success: true,
      segment: segAll.id,
      sequence: seq.id,
      templates: templates.length,
      steps: stepConfigs.length,
    })
  } catch (e) {
    console.error('[Drip Seed] Error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
