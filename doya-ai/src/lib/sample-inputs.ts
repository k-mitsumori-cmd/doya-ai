/**
 * 各テンプレートのサンプル入力データ
 * テンプレートIDをキーにして、入力フィールドのサンプル値を定義
 */

export const SAMPLE_INPUTS: Record<string, Record<string, string>> = {
  // ==================== ビジネスメール ====================
  'business-email': {
    emailType: '依頼・お願い',
    recipient: '取引先・クライアント',
    subject: '打ち合わせ日程のご相談',
    content: '来週中に1時間ほどオンラインでお打ち合わせさせていただきたいです。新サービスのご提案をさせていただきたく存じます。ご都合の良い日程をご教示いただけますと幸いです。',
    tone: '丁寧（無難に）',
  },
  'email-reply': {
    originalEmail: '先日はお打ち合わせありがとうございました。ご提案いただいた件について、社内で検討いたしました。つきましては、詳細について再度ご説明いただけますでしょうか。来週中であれば対応可能です。',
    direction: '了承',
    additional: '来週火曜日の14時から16時の間で調整したい',
  },
  'meeting-agenda': {
    meetingName: '第2四半期マーケティング戦略会議',
    purpose: '来期の広告予算配分と新規施策の決定',
    participants: '営業部長、マーケティングマネージャー、広報担当',
    duration: '1時間',
    topics: '前四半期の振り返り、競合分析報告、新規施策の提案、予算配分の決定',
  },
  'meeting-minutes': {
    meetingName: '新規プロジェクト キックオフ',
    datetime: '2024年12月17日 14:00-15:30',
    participants: '田中（PM）、佐藤、鈴木、山田',
    notes: '目的：ECサイトリニューアル。期限は来年3月末。予算500万円。佐藤がUI設計担当。鈴木がバックエンド。山田がQA。週次定例は毎週水曜14時。次回までにワイヤーフレーム完成。',
  },
  'proposal-document': {
    title: '業務効率化のためのチャットボット導入提案',
    background: '現在、カスタマーサポートの問い合わせ対応に月平均200時間を費やしており、対応待ち時間が平均2時間と長い状況です。',
    proposal: 'AIチャットボットを導入し、よくある質問（FAQ）への自動回答を実現します。24時間対応が可能になり、問い合わせの約70%を自動化できます。',
    effect: '月150時間の工数削減、顧客満足度20%向上、夜間・休日対応の実現',
    schedule: '導入準備1ヶ月、テスト運用2週間、本番稼働3月から',
  },
  'report-weekly': {
    period: '12/11〜12/15',
    achievements: '新規リード獲得30件（目標25件）、提案資料3件完成、A社契約締結',
    issues: 'B社案件が予算調整で停滞中。リソース不足で新規営業に割ける時間が少ない',
    nextWeek: 'B社フォローアップ、D社初回訪問、年末挨拶メール送付',
  },
  'presentation-outline': {
    theme: 'DX推進による業務効率化',
    purpose: '経営層への予算承認',
    audience: '役員・経営企画部',
    duration: '15分',
  },

  // ==================== SNS ====================
  'instagram-caption': {
    content: '新しいオフィスに移転しました！開放感のあるワークスペースで、チームの生産性もアップ。窓から見える景色も最高です。',
    tone: 'カジュアル',
    target: 'ビジネスに興味のある20-40代',
  },
  'twitter-thread': {
    theme: 'リモートワークを成功させる5つのコツ',
    target: 'リモートワーカー、フリーランス',
    purpose: 'フォロワー獲得とブランディング',
  },
  'tiktok-script': {
    theme: '仕事効率を3倍にする朝のルーティン',
    duration: '60秒',
    target: '20-30代の社会人',
  },
  'youtube-script': {
    title: '【保存版】ChatGPTを仕事で使いこなす方法',
    duration: '10分',
    genre: 'ビジネス・自己啓発',
    target: '30-50代のビジネスパーソン',
  },
  'linkedin-post': {
    theme: '起業して3年目に学んだ最も大切なこと',
    purpose: 'ブランディング',
    tone: '情熱的',
  },
  'sns-content-calendar': {
    platform: 'Instagram',
    industry: '美容・コスメ',
    purpose: 'フォロワー増加と商品認知向上',
  },

  // ==================== 広告・マーケティング ====================
  'google-ad-title': {
    productName: 'オンライン英会話サービス「スピークアップ」',
    targetAudience: '30-40代のビジネスパーソン',
    features: '24時間受講可能、ネイティブ講師100人以上、ビジネス英語特化',
    objective: '無料体験申込',
  },
  'google-ad-description': {
    productName: 'クラウド会計ソフト「カンタン経理」',
    target: '個人事業主・フリーランス',
    appeal: '月額980円から、銀行口座連携で自動仕訳、確定申告もラクラク',
    cta: '無料で試す',
  },
  'facebook-ad-copy': {
    productName: 'オーガニックスキンケア「ナチュラルグロウ」',
    targetAudience: '30-40代女性、敏感肌に悩む方',
    features: '100%天然成分、敏感肌向け、無添加',
    appealPoint: '肌に優しく、効果を実感できる',
  },
  'instagram-ad': {
    product: 'プロテインスムージー「フィットシェイク」',
    target: '健康・美容意識の高い20-30代',
    appeal: '美味しくて続けられる、1杯でタンパク質20g',
    tone: 'ポップ',
  },
  'twitter-ad': {
    product: 'AIライティングツール「スマートペン」',
    target: 'マーケター、ライター、ブロガー',
    appeal: '文章作成時間を80%削減、無料トライアルあり',
  },
  'lp-full-text': {
    productName: 'ビジネスチャット「チームトーク」',
    description: 'チームのコミュニケーションを効率化するビジネスチャットツール。ファイル共有、ビデオ通話、タスク管理が一つに。',
    targetAudience: '中小企業の経営者・管理職',
    price: '月額500円/ユーザー〜',
    differentiator: '直感的なUI、日本語サポート、データ国内保管',
  },
  'lp-headline': {
    product: 'オンライン学習プラットフォーム',
    target: 'スキルアップしたい社会人',
    benefit: '1日15分で新しいスキルが身につく',
    difference: '実践的なカリキュラムと専門家のフィードバック',
  },
  'ab-test-copy': {
    target: 'LP（ランディングページ）',
    objective: '無料トライアル申込率の向上',
    currentCopy: '今すぐ無料で始めましょう',
  },

  // ==================== 分析・リサーチ ====================
  'persona-creation': {
    productName: '時短家事サービス「ラクラク家事」',
    description: '忙しい共働き家庭向けに、掃除・洗濯・料理をプロが代行するサービス',
    targetAudience: '30-40代の共働き夫婦',
  },
  'market-analysis': {
    market: 'オンラインフィットネス',
    region: '日本',
    purpose: '新規事業参入の可否判断',
  },
  'competitor-analysis': {
    ourService: 'クラウド人事管理システム',
    competitors: 'SmartHR, freee人事労務, ジョブカン',
    industry: 'HR Tech',
  },
  'swot-analysis': {
    business: '地域密着型のカフェチェーン',
    industry: '飲食業',
    situation: '3店舗を展開中。常連客は多いが新規客の獲得に苦戦。デリバリーは未対応。',
  },
  'user-journey': {
    service: 'オンライン料理教室',
    target: '料理初心者の30代女性。仕事帰りに家で美味しい料理を作りたいと思っている。',
    goal: '月額会員への転換と継続利用',
  },

  // ==================== 営業・セールス ====================
  'sales-pitch': {
    product: '法人向けセキュリティソフト「ガードプロ」',
    target: '中小企業のIT担当者',
    problem: 'サイバー攻撃のリスクが高まっているが、専任のセキュリティ担当がいない',
    solution: 'AIが24時間監視、脅威を自動検知・対応。専門知識不要で導入可能',
  },
  'product-description': {
    productName: 'ワイヤレスイヤホン「クリアサウンド Pro」',
    category: 'オーディオ機器',
    features: 'ノイズキャンセリング、12時間連続再生、防水IPX5、ハイレゾ対応',
    target: '音楽好きの通勤者',
    price: '12,800円',
  },
  'sales-email': {
    purpose: '新規開拓',
    product: 'クラウド型勤怠管理システム',
    recipient: '従業員50名規模のIT企業。紙のタイムカードで勤怠管理をしている可能性あり',
    appeal: '月額1人300円から、スマホで打刻、残業アラート機能付き',
  },
  'objection-handling': {
    product: 'マーケティングオートメーションツール',
    objections: '価格が高い、今は必要ない、使いこなせるか不安、他社と比較したい',
  },
  'case-study': {
    customer: 'EC事業を展開する従業員30名のアパレル企業',
    service: 'カスタマーサポート自動化ツール',
    problem: '問い合わせ対応に1日4時間を費やしており、本業に集中できない',
    result: '対応時間70%削減、顧客満足度15%向上、夜間対応が可能に',
  },

  // ==================== クリエイティブ ====================
  'catchcopy': {
    product: '睡眠サポートサプリメント',
    target: '睡眠の質に悩む30-50代',
    appeal: '翌朝のスッキリ感が違う、天然成分100%',
    tone: '信頼感重視',
  },
  'naming': {
    target: '新しいプロジェクト管理アプリ',
    concept: 'シンプルで直感的、チームの生産性を最大化',
    image: 'スマート、効率的、未来的',
    ng: '既存サービスと被る名前、発音しにくい名前',
  },
  'slogan': {
    brand: 'エコフレンドリー家具ブランド「グリーンリビング」',
    business: '環境に配慮したサステナブルな家具の製造・販売',
    mission: '地球に優しい暮らしを、すべての家庭に届ける',
    target: '環境意識の高い30-40代のファミリー層',
  },
  'brand-story': {
    brand: 'オーガニックコスメ「ピュアネイチャー」',
    background: '創業者が肌荒れに悩んだ経験から、本当に肌に優しい化粧品を作りたいと起業',
    mission: '自然の力で、すべての人の肌を健やかに',
    values: '正直さ、自然への敬意、お客様第一',
  },

  // ==================== 記事・コンテンツ ====================
  'blog-article': {
    theme: '在宅ワークの生産性を高める方法',
    target: 'リモートワーク中の会社員',
    purpose: '情報提供',
    keywords: '在宅ワーク 生産性 集中力',
    wordCount: '2000文字',
  },
  'article-outline': {
    theme: '2024年のデジタルマーケティングトレンド',
    target: 'マーケティング担当者',
    type: 'まとめ記事',
  },
  'seo-title-meta': {
    theme: 'プログラミング初心者が最初に学ぶべき言語',
    keyword: 'プログラミング 初心者 おすすめ言語',
    summary: 'プログラミング初心者向けに、最初に学ぶべきプログラミング言語を紹介。Python、JavaScript、Rubyなどの特徴と学習ロードマップを解説。',
  },
  'article-summary': {
    originalText: '近年、リモートワークの普及により働き方が大きく変化しています。多くの企業がオフィス勤務からハイブリッド勤務へ移行し、従業員は自宅やカフェなど様々な場所で仕事ができるようになりました。この変化は従業員のワークライフバランス向上に寄与する一方で、コミュニケーションの課題やチームビルディングの難しさといった新たな問題も生まれています。企業はこれらの課題に対応するため、オンラインツールの活用やバーチャルチームビルディング活動の実施など、様々な取り組みを行っています。',
    format: '箇条書き',
    length: '100文字程度',
  },
  'press-release': {
    title: '新サービス「AIアシスタント」提供開始のお知らせ',
    content: 'AIを活用した業務効率化サービスを12月20日より提供開始。月額9,800円から利用可能。すでに100社以上から事前予約あり。',
    company: '株式会社テックイノベーション',
    date: '2024年12月17日',
  },
  'newsletter': {
    theme: '年末年始のご挨拶と新年のサービス予定',
    target: '既存顧客',
    purpose: 'ブランディング',
    info: '年末年始の営業日、新年のキャンペーン、今年の振り返り',
  },

  // ==================== 教育・研修 ====================
  'business-manual': {
    taskName: '新規顧客の問い合わせ対応',
    description: '電話やメールで寄せられる新規顧客からの問い合わせに対応する業務。商品説明、見積もり作成、アポイント調整などを行う。',
    audience: '入社1年目の営業アシスタント',
    prerequisites: '社内システムの基本操作、商品知識の基礎',
  },
  'training-curriculum': {
    theme: '新入社員向けビジネスマナー研修',
    audience: '新卒入社社員',
    duration: '1日',
    goal: '社会人としての基本的なビジネスマナーを習得する',
  },
  'faq-creation': {
    service: 'クラウド会計ソフト',
    target: '個人事業主・小規模事業者',
    categories: '料金プラン、機能、導入方法、サポート、セキュリティ',
  },
  'quiz-creation': {
    theme: '情報セキュリティの基礎',
    difficulty: '初級',
    count: '10問',
    format: '選択式',
  },

  // ==================== 人事・採用 ====================
  'job-posting': {
    position: 'フロントエンドエンジニア',
    type: '正社員',
    appeal: 'リモートワークOK、フレックスタイム制、副業可、技術選定から関われる',
    requirements: 'React/Vue.jsでの開発経験3年以上、チームでの開発経験、自走できる方',
  },
  'interview-questions': {
    position: 'マーケティングマネージャー',
    evaluation: 'リーダーシップ、戦略立案能力、データ分析力、チームマネジメント経験',
    stage: '二次面接',
  },
  'evaluation-sheet': {
    position: '営業職',
    period: '半期',
    items: '売上目標達成率、新規顧客獲得数、顧客満足度、チームへの貢献',
  },

  // ==================== 法務・契約 ====================
  'terms-of-service': {
    serviceName: 'タスク管理アプリ「ToDo Pro」',
    description: 'タスクの作成・管理・共有ができるWebアプリケーション。チーム機能、リマインダー、カレンダー連携あり。',
    users: '両方',
  },
  'privacy-policy': {
    serviceName: '健康管理アプリ「ヘルスログ」',
    dataCollected: 'メールアドレス、体重、睡眠時間、運動記録、位置情報（任意）',
    purpose: 'サービス提供、健康アドバイスの提案、サービス改善',
  },

  // ==================== カスタマーサポート ====================
  'support-response': {
    inquiry: '先日購入した商品が届きません。注文番号は12345です。配送状況を教えてください。',
    direction: '情報提供',
    tone: '丁寧',
  },
  'complaint-response': {
    complaint: '届いた商品が破損していました。交換か返金を希望します。',
    cause: '配送中の衝撃による破損',
    solution: '新品を即日発送で再送、破損品は着払いで返送いただく',
  },

  // ==================== 企画・アイデア ====================
  'brainstorm': {
    theme: '若者向け新規カフェ事業のコンセプト',
    constraints: '予算1000万円以内、都心部で50平米程度のスペース',
    target: '20-30代の働く女性',
  },
  'business-plan': {
    businessName: 'ペットシッターマッチングサービス',
    description: 'ペットオーナーと信頼できるペットシッターをマッチングするプラットフォーム',
    market: '共働き世帯、一人暮らしのペットオーナー',
    revenue: 'マッチング手数料15%、月額サブスクリプション',
  },
  'event-plan': {
    eventName: '創業10周年感謝祭',
    purpose: '顧客への感謝を伝え、ブランドロイヤリティを高める',
    target: '既存顧客、パートナー企業',
    budget: '500万円',
    date: '2025年3月15日',
  },

  // ==================== 翻訳 ====================
  'translate-en': {
    japanese: '私たちのサービスは、AIを活用して業務効率を大幅に向上させます。24時間365日のサポート体制で、お客様のビジネスを支援いたします。',
    tone: 'ビジネス',
  },
  'translate-ja': {
    english: 'Our innovative solution leverages cutting-edge AI technology to streamline your workflow and boost productivity. With 24/7 support, we ensure your business runs smoothly.',
    tone: 'ビジネス',
  },

  // ==================== 文章改善・校正 ====================
  'rewrite-text': {
    originalText: '弊社は様々な製品を提供しておりますが、その中でも特にお客様に人気なのがこちらの商品となっております。',
    direction: '簡潔に',
    tone: 'ビジネス',
  },
  'proofread': {
    text: 'この度は、弊社製品をごご購入いただき誠にあにがとうございます。製品の使い方でご不明な点がございましたが、お気軽にお問合せくさい。',
  },
  'tone-change': {
    text: 'お疲れ様です。例の件、進捗どうですか？明日までに資料もらえると助かります。',
    tone: 'フォーマル',
  },
  'expand-text': {
    text: 'AIの進化が仕事を変えている。',
    targetLength: '3倍程度',
  },
  'shorten-text': {
    text: '本日は、お忙しいところ、わざわざ弊社までお越しいただきまして、誠にありがとうございます。本日の会議では、来期の事業戦略について、様々な観点から議論を行いたいと考えております。皆様からの活発なご意見をお待ちしております。',
    target: '1文にまとめる',
  },
  'code-review': {
    language: 'JavaScript',
    code: `function getUserData(id) {
  var data = fetch('/api/user/' + id)
  return data
}`,
    focus: '全般',
  },
}

