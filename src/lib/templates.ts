// 68種類のテキスト生成テンプレート（15カテゴリ）
// 🎯 コンセプト：仕事が爆速になるAI × 超初心者でも使える

export const CATEGORIES = [
  {
    id: 'business',
    name: '📧 メール・ビジネス文書',
    slug: 'business',
    icon: '📧',
    color: '#F59E0B',
    description: '今すぐ使える！メール、報告書、議事録など',
  },
  {
    id: 'content',
    name: '📝 文章作成・ブログ',
    slug: 'content',
    icon: '📝',
    color: '#06B6D4',
    description: 'ブログ、記事、ニュースレターなど',
  },
  {
    id: 'sns',
    name: '📱 SNS投稿',
    slug: 'sns',
    icon: '📱',
    color: '#EC4899',
    description: 'Instagram、Twitter/X、TikTok、YouTubeなど',
  },
  {
    id: 'marketing',
    name: '📢 広告・LP作成',
    slug: 'marketing',
    icon: '📢',
    color: '#8B5CF6',
    description: 'Google広告、Facebook広告、LP作成など',
  },
  {
    id: 'sales',
    name: '🎯 営業・セールス',
    slug: 'sales',
    icon: '🎯',
    color: '#EF4444',
    description: '商品説明、提案書、営業メールなど',
  },
  {
    id: 'creative',
    name: '✨ キャッチコピー・ネーミング',
    slug: 'creative',
    icon: '✨',
    color: '#8B5CF6',
    description: 'キャッチコピー、ネーミング、スローガンなど',
  },
  {
    id: 'persona',
    name: '👥 分析・リサーチ',
    slug: 'persona',
    icon: '👥',
    color: '#10B981',
    description: 'ペルソナ作成、市場分析、競合分析など',
  },
  {
    id: 'video',
    name: '🎬 動画台本',
    slug: 'video',
    icon: '🎬',
    color: '#DC2626',
    description: 'YouTube台本、TikTok台本など',
  },
  {
    id: 'planning',
    name: '💡 企画・アイデア出し',
    slug: 'planning',
    icon: '💡',
    color: '#FBBF24',
    description: '新規事業、イベント企画、ブレストなど',
  },
  {
    id: 'education',
    name: '📚 マニュアル・研修',
    slug: 'education',
    icon: '📚',
    color: '#2563EB',
    description: '業務マニュアル、研修資料、FAQなど',
  },
  {
    id: 'hr',
    name: '👔 人事・採用',
    slug: 'hr',
    icon: '👔',
    color: '#7C3AED',
    description: '求人票、面接質問、評価シートなど',
  },
  {
    id: 'customer',
    name: '🎧 お問い合わせ対応',
    slug: 'customer',
    icon: '🎧',
    color: '#0891B2',
    description: 'FAQ、お問い合わせ回答、クレーム対応など',
  },
  {
    id: 'legal',
    name: '⚖️ 契約・規約',
    slug: 'legal',
    icon: '⚖️',
    color: '#374151',
    description: '利用規約、プライバシーポリシーなど',
  },
  {
    id: 'translation',
    name: '🌐 翻訳',
    slug: 'translation',
    icon: '🌐',
    color: '#3B82F6',
    description: '英語⇔日本語の翻訳など',
  },
  {
    id: 'writing',
    name: '✍️ 文章の改善・校正',
    slug: 'writing',
    icon: '✍️',
    color: '#6366F1',
    description: 'リライト、要約、校正、トーン変更など',
  },
]

export const SAMPLE_TEMPLATES = [
  // ==================== マーケティング ====================
  {
    id: 'google-ad-title',
    name: 'Google広告タイトル作成',
    description: '高クリック率を狙えるGoogle広告のタイトルを複数パターン生成',
    categoryId: 'marketing',
    prompt: `以下の商品/サービスについて、Google広告で使用する効果的なタイトルを10パターン作成してください。

商品/サービス名: {{productName}}
ターゲット層: {{targetAudience}}
主な特徴・強み: {{features}}
目的: {{objective}}

【条件】
- 30文字以内
- ユーザーの関心を引く表現
- 具体的な数値やメリットを含める`,
    inputFields: [
      { name: 'productName', label: '商品/サービス名', type: 'text', required: true, placeholder: '例：オンライン英会話' },
      { name: 'targetAudience', label: 'ターゲット層', type: 'text', required: true, placeholder: '例：30代ビジネスパーソン' },
      { name: 'features', label: '特徴・強み', type: 'textarea', required: true, placeholder: '例：24時間受講可能、ネイティブ講師' },
      { name: 'objective', label: '広告の目的', type: 'select', required: true, options: ['認知拡大', '資料請求', '無料体験申込', '購入促進'] },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },
  {
    id: 'google-ad-description',
    name: 'Google広告説明文作成',
    description: 'Google広告の説明文を複数パターン生成',
    categoryId: 'marketing',
    prompt: `以下の情報をもとに、Google広告の説明文を5パターン作成してください。

商品/サービス名: {{productName}}
ターゲット: {{target}}
訴求ポイント: {{appeal}}
CTA: {{cta}}

【条件】
- 90文字以内
- 行動を促す表現を含める`,
    inputFields: [
      { name: 'productName', label: '商品/サービス名', type: 'text', required: true },
      { name: 'target', label: 'ターゲット', type: 'text', required: true },
      { name: 'appeal', label: '訴求ポイント', type: 'textarea', required: true },
      { name: 'cta', label: 'CTA（行動喚起）', type: 'select', required: true, options: ['今すぐ申込', '無料で試す', '詳細を見る', '資料請求', 'お問い合わせ'] },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },
  {
    id: 'facebook-ad-copy',
    name: 'Facebook広告文作成',
    description: 'ターゲットに響くFacebook広告のコピーを生成',
    categoryId: 'marketing',
    prompt: `以下の情報をもとに、Facebook広告用の広告文を3パターン作成してください。

商品/サービス名: {{productName}}
ターゲット層: {{targetAudience}}
商品の特徴: {{features}}
訴求ポイント: {{appealPoint}}

各パターンに以下を含めてください：
- メインテキスト（125文字以内）
- 見出し（25文字以内）
- 説明文（30文字以内）
- CTAボタンの提案`,
    inputFields: [
      { name: 'productName', label: '商品/サービス名', type: 'text', required: true },
      { name: 'targetAudience', label: 'ターゲット層', type: 'text', required: true },
      { name: 'features', label: '商品の特徴', type: 'textarea', required: true },
      { name: 'appealPoint', label: '訴求ポイント', type: 'textarea', required: true },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },
  {
    id: 'instagram-ad',
    name: 'Instagram広告文作成',
    description: 'Instagram広告用のキャプションとハッシュタグを生成',
    categoryId: 'marketing',
    prompt: `Instagram広告用のキャプションを作成してください。

商品/サービス: {{product}}
ターゲット: {{target}}
訴求ポイント: {{appeal}}
トーン: {{tone}}

【出力形式】
- キャプション（3パターン）
- おすすめハッシュタグ（15個）`,
    inputFields: [
      { name: 'product', label: '商品/サービス', type: 'text', required: true },
      { name: 'target', label: 'ターゲット', type: 'text', required: true },
      { name: 'appeal', label: '訴求ポイント', type: 'textarea', required: true },
      { name: 'tone', label: 'トーン', type: 'select', required: true, options: ['カジュアル', 'プロフェッショナル', 'ポップ', 'エレガント'] },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },
  {
    id: 'twitter-ad',
    name: 'Twitter/X広告文作成',
    description: 'Twitter/X広告用のツイート文を複数パターン生成',
    categoryId: 'marketing',
    prompt: `Twitter/X広告用のツイート文を5パターン作成してください。

商品/サービス: {{product}}
ターゲット: {{target}}
訴求ポイント: {{appeal}}

【条件】
- 140文字以内
- 絵文字を適度に使用
- CTAを含める`,
    inputFields: [
      { name: 'product', label: '商品/サービス', type: 'text', required: true },
      { name: 'target', label: 'ターゲット', type: 'text', required: true },
      { name: 'appeal', label: '訴求ポイント', type: 'textarea', required: true },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },
  {
    id: 'lp-full-text',
    name: 'LP構成案・テキスト作成',
    description: 'ランディングページの構成とテキストを生成',
    categoryId: 'marketing',
    prompt: `以下の商品/サービスのLP構成とテキストを作成してください。

商品/サービス名: {{productName}}
サービス概要: {{description}}
ターゲット層: {{targetAudience}}
価格: {{price}}
差別化ポイント: {{differentiator}}

【出力形式】
1. ファーストビュー（キャッチコピー、サブコピー）
2. 悩み・課題の提示
3. 解決策の提示
4. 特徴・メリット（3つ以上）
5. 使い方・流れ
6. お客様の声（サンプル3件）
7. よくある質問（FAQ 5件）
8. CTA（行動喚起）`,
    inputFields: [
      { name: 'productName', label: '商品/サービス名', type: 'text', required: true },
      { name: 'description', label: 'サービス概要', type: 'textarea', required: true },
      { name: 'targetAudience', label: 'ターゲット層', type: 'text', required: true },
      { name: 'price', label: '価格', type: 'text', required: false },
      { name: 'differentiator', label: '差別化ポイント', type: 'textarea', required: true },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },
  {
    id: 'lp-headline',
    name: 'LPキャッチコピー作成',
    description: 'LP用の強力なキャッチコピーを複数生成',
    categoryId: 'marketing',
    prompt: `LPのファーストビュー用キャッチコピーを10パターン作成してください。

商品/サービス: {{product}}
ターゲット: {{target}}
主なベネフィット: {{benefit}}
競合との違い: {{difference}}

【条件】
- インパクトのある表現
- 具体的な数値を含むパターンも
- サブコピーも併せて提案`,
    inputFields: [
      { name: 'product', label: '商品/サービス', type: 'text', required: true },
      { name: 'target', label: 'ターゲット', type: 'text', required: true },
      { name: 'benefit', label: '主なベネフィット', type: 'textarea', required: true },
      { name: 'difference', label: '競合との違い', type: 'textarea', required: true },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },
  {
    id: 'ab-test-copy',
    name: 'A/Bテスト用コピー作成',
    description: 'A/Bテスト用に異なるアプローチのコピーを生成',
    categoryId: 'marketing',
    prompt: `A/Bテスト用に、異なるアプローチのコピーを作成してください。

対象: {{target}}
目的: {{objective}}
現在のコピー: {{currentCopy}}

【出力形式】
- パターンA（論理的アプローチ）
- パターンB（感情的アプローチ）
- パターンC（具体的数値）
- パターンD（問題提起型）
- パターンE（ベネフィット訴求型）`,
    inputFields: [
      { name: 'target', label: '対象（広告/LP/メールなど）', type: 'text', required: true },
      { name: 'objective', label: '目的', type: 'text', required: true },
      { name: 'currentCopy', label: '現在のコピー', type: 'textarea', required: true },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },

  // ==================== ペルソナ・分析 ====================
  {
    id: 'persona-creation',
    name: 'ペルソナ作成',
    description: '詳細な顧客ペルソナを作成',
    categoryId: 'persona',
    prompt: `以下の商品/サービスのターゲットとなる顧客ペルソナを詳細に作成してください。

商品/サービスの名前: {{productName}}
商品/サービスの概要: {{description}}
ターゲット層: {{targetAudience}}

【出力形式】
## 顧客ペルソナ：[名前]

### 基本情報
- 名前、年齢、性別、居住地
- 職業、年収、家族構成

### ライフスタイル
- 1日のスケジュール
- 趣味・関心事
- 情報収集方法

### 価値観・考え方
- 大切にしていること
- 将来の目標
- 不安・悩み

### 購買行動
- 購買決定のプロセス
- 重視するポイント`,
    inputFields: [
      { name: 'productName', label: '商品/サービス名', type: 'text', required: true },
      { name: 'description', label: '概要', type: 'textarea', required: true },
      { name: 'targetAudience', label: 'ターゲット層', type: 'text', required: true },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },
  {
    id: 'market-analysis',
    name: '市場分析レポート',
    description: '業界・市場の分析レポートを生成',
    categoryId: 'persona',
    prompt: `以下の市場について詳細な分析レポートを作成してください。

業界/市場: {{market}}
地域: {{region}}
分析の目的: {{purpose}}

【出力形式】
1. 市場概要
2. 市場規模と成長率
3. 主要プレイヤー
4. トレンドと動向
5. 機会と脅威
6. 今後の予測`,
    inputFields: [
      { name: 'market', label: '業界/市場', type: 'text', required: true },
      { name: 'region', label: '対象地域', type: 'select', required: true, options: ['日本', 'アジア太平洋', 'グローバル'] },
      { name: 'purpose', label: '分析の目的', type: 'textarea', required: true },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },
  {
    id: 'competitor-analysis',
    name: '競合分析レポート',
    description: '競合他社の分析レポートを生成',
    categoryId: 'persona',
    prompt: `競合分析レポートを作成してください。

自社サービス: {{ourService}}
競合サービス: {{competitors}}
業界: {{industry}}

【出力形式】
1. 競合概要
2. 各社の強み・弱み
3. 価格比較
4. 機能比較
5. ポジショニングマップ
6. 差別化ポイント`,
    inputFields: [
      { name: 'ourService', label: '自社サービス', type: 'text', required: true },
      { name: 'competitors', label: '競合サービス（カンマ区切り）', type: 'textarea', required: true },
      { name: 'industry', label: '業界', type: 'text', required: true },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },
  {
    id: 'swot-analysis',
    name: 'SWOT分析',
    description: 'SWOT分析を実施',
    categoryId: 'persona',
    prompt: `以下のビジネスについてSWOT分析を実施してください。

ビジネス名: {{business}}
業界: {{industry}}
現在の状況: {{situation}}

【出力形式】
## SWOT分析

### Strengths（強み）
### Weaknesses（弱み）
### Opportunities（機会）
### Threats（脅威）
### 戦略的示唆`,
    inputFields: [
      { name: 'business', label: 'ビジネス名', type: 'text', required: true },
      { name: 'industry', label: '業界', type: 'text', required: true },
      { name: 'situation', label: '現在の状況', type: 'textarea', required: true },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },
  {
    id: 'user-journey',
    name: 'カスタマージャーニーマップ',
    description: 'カスタマージャーニーマップを作成',
    categoryId: 'persona',
    prompt: `カスタマージャーニーマップを作成してください。

サービス: {{service}}
ターゲット: {{target}}
ゴール: {{goal}}

【フェーズ別に記載】
1. 認知フェーズ
2. 興味・検討フェーズ
3. 購入・契約フェーズ
4. 利用フェーズ
5. 継続・推奨フェーズ

各フェーズで以下を記載：
- ユーザーの行動
- タッチポイント
- 思考・感情
- 課題・ペインポイント
- 施策案`,
    inputFields: [
      { name: 'service', label: 'サービス名', type: 'text', required: true },
      { name: 'target', label: 'ターゲットペルソナ', type: 'textarea', required: true },
      { name: 'goal', label: 'ゴール', type: 'text', required: true },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },

  // ==================== SNS運用 ====================
  {
    id: 'instagram-caption',
    name: 'Instagram投稿文作成',
    description: 'エンゲージメントを高めるInstagramキャプションを生成',
    categoryId: 'sns',
    prompt: `Instagram投稿用のキャプションを3パターン作成してください。

投稿内容: {{content}}
アカウントの雰囲気: {{tone}}
ターゲット: {{target}}

【各パターンに含める】
- フック（冒頭）
- 本文
- CTA
- ハッシュタグ15個`,
    inputFields: [
      { name: 'content', label: '投稿内容', type: 'textarea', required: true },
      { name: 'tone', label: '雰囲気', type: 'select', required: true, options: ['カジュアル', 'プロフェッショナル', 'ポップ', 'エレガント'] },
      { name: 'target', label: 'ターゲット', type: 'text', required: true },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },
  {
    id: 'twitter-thread',
    name: 'Twitter/Xスレッド作成',
    description: 'バズりやすいTwitterスレッドを生成',
    categoryId: 'sns',
    prompt: `Twitter/X用のスレッドを作成してください。

テーマ: {{theme}}
ターゲット: {{target}}
目的: {{purpose}}

【条件】
- 10ツイート程度
- 最初のツイートでフックを作る
- 最後にCTAを入れる`,
    inputFields: [
      { name: 'theme', label: 'テーマ', type: 'text', required: true },
      { name: 'target', label: 'ターゲット', type: 'text', required: true },
      { name: 'purpose', label: '目的', type: 'text', required: true },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },
  {
    id: 'tiktok-script',
    name: 'TikTok台本作成',
    description: 'バズりやすいTikTok動画の台本を生成',
    categoryId: 'sns',
    prompt: `TikTok動画の台本を作成してください。

テーマ: {{theme}}
動画の長さ: {{duration}}
ターゲット: {{target}}

【出力形式】
- フック（0-3秒）
- メインコンテンツ
- CTA
- 撮影のポイント
- おすすめBGM`,
    inputFields: [
      { name: 'theme', label: 'テーマ', type: 'text', required: true },
      { name: 'duration', label: '長さ', type: 'select', required: true, options: ['15秒', '30秒', '60秒', '3分'] },
      { name: 'target', label: 'ターゲット', type: 'text', required: true },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },
  {
    id: 'youtube-script',
    name: 'YouTube台本作成',
    description: '視聴維持率を意識したYouTube台本を生成',
    categoryId: 'sns',
    prompt: `YouTube動画の台本を作成してください。

タイトル案: {{title}}
長さ: {{duration}}
ジャンル: {{genre}}
ターゲット: {{target}}

【出力形式】
- タイトル案（3つ）
- サムネイル提案
- 構成
- 詳細台本`,
    inputFields: [
      { name: 'title', label: 'タイトル案', type: 'text', required: true },
      { name: 'duration', label: '長さ', type: 'select', required: true, options: ['5分', '10分', '15分', '20分以上'] },
      { name: 'genre', label: 'ジャンル', type: 'text', required: true },
      { name: 'target', label: 'ターゲット', type: 'text', required: true },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },
  {
    id: 'linkedin-post',
    name: 'LinkedIn投稿文作成',
    description: 'ビジネス向けLinkedIn投稿を生成',
    categoryId: 'sns',
    prompt: `LinkedIn用の投稿文を作成してください。

テーマ: {{theme}}
目的: {{purpose}}
トーン: {{tone}}

【条件】
- ビジネスパーソン向け
- 価値提供を意識
- 適度な改行`,
    inputFields: [
      { name: 'theme', label: 'テーマ', type: 'text', required: true },
      { name: 'purpose', label: '目的', type: 'select', required: true, options: ['ブランディング', 'ナレッジ共有', '採用', 'サービス紹介'] },
      { name: 'tone', label: 'トーン', type: 'select', required: true, options: ['フォーマル', 'カジュアル', '情熱的', '教育的'] },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },
  {
    id: 'sns-content-calendar',
    name: 'SNSコンテンツカレンダー',
    description: '1ヶ月分のSNS投稿計画を生成',
    categoryId: 'sns',
    prompt: `1ヶ月分のSNSコンテンツカレンダーを作成してください。

プラットフォーム: {{platform}}
業種: {{industry}}
目的: {{purpose}}

【出力形式】
週ごとのテーマと各日の投稿内容案`,
    inputFields: [
      { name: 'platform', label: 'プラットフォーム', type: 'select', required: true, options: ['Instagram', 'Twitter/X', 'TikTok', 'LinkedIn', '複数'] },
      { name: 'industry', label: '業種', type: 'text', required: true },
      { name: 'purpose', label: '目的', type: 'text', required: true },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },

  // ==================== ビジネス文書 ====================
  {
    id: 'business-email',
    name: 'ビジネスメール作成',
    description: '仕事で使えるメールを秒速で作成！依頼・お礼・お詫びなど様々なシーンに対応',
    categoryId: 'business',
    prompt: `以下の情報をもとに、ビジネスメールを作成してください。

【メールの種類】{{emailType}}
【送信先】{{recipient}}
【用件】{{subject}}
【伝えたい内容】{{content}}
【トーン】{{tone}}

【条件】
- 件名と本文を出力
- ビジネスマナーに沿った形式
- 適切な敬語を使用
- 簡潔で分かりやすい文章`,
    inputFields: [
      { name: 'emailType', label: 'メールの種類', type: 'select', required: true, options: ['依頼・お願い', 'お礼', 'お詫び・謝罪', '報告・連絡', '確認', '提案', 'お断り', '挨拶・自己紹介'] },
      { name: 'recipient', label: '誰に送る？', type: 'select', required: true, options: ['社内の上司', '社内の同僚・後輩', '取引先・クライアント', '新規のお客様', '既存のお客様', 'その他'] },
      { name: 'subject', label: '何についてのメール？', type: 'text', required: true, placeholder: '例：打ち合わせ日程の調整、資料送付のお願い' },
      { name: 'content', label: '伝えたいことを入力', type: 'textarea', required: true, placeholder: '例：来週中に1時間ほど打ち合わせしたい。新サービスの説明をしたい。' },
      { name: 'tone', label: 'メールの雰囲気', type: 'select', required: true, options: ['フォーマル（かしこまった感じ）', 'ややカジュアル（親しみやすく）', '丁寧（無難に）'] },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },
  {
    id: 'email-reply',
    name: 'メール返信作成',
    description: '受け取ったメールへの返信を生成',
    categoryId: 'business',
    prompt: `メールの返信を作成してください。

受け取ったメール: {{originalEmail}}
返信の方向性: {{direction}}
追加情報: {{additional}}`,
    inputFields: [
      { name: 'originalEmail', label: '受け取ったメール', type: 'textarea', required: true },
      { name: 'direction', label: '返信の方向性', type: 'select', required: true, options: ['了承', '断り', '確認', '質問', '提案'] },
      { name: 'additional', label: '追加情報', type: 'textarea', required: false },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },
  {
    id: 'meeting-agenda',
    name: '会議アジェンダ作成',
    description: '効率的な会議アジェンダを生成',
    categoryId: 'business',
    prompt: `会議アジェンダを作成してください。

会議名: {{meetingName}}
目的: {{purpose}}
参加者: {{participants}}
所要時間: {{duration}}
議題: {{topics}}`,
    inputFields: [
      { name: 'meetingName', label: '会議名', type: 'text', required: true },
      { name: 'purpose', label: '目的', type: 'text', required: true },
      { name: 'participants', label: '参加者', type: 'text', required: true },
      { name: 'duration', label: '所要時間', type: 'select', required: true, options: ['30分', '1時間', '1.5時間', '2時間'] },
      { name: 'topics', label: '議題', type: 'textarea', required: true },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },
  {
    id: 'meeting-minutes',
    name: '議事録作成',
    description: '会議メモから議事録を生成',
    categoryId: 'business',
    prompt: `議事録を作成してください。

会議名: {{meetingName}}
日時: {{datetime}}
参加者: {{participants}}
会議メモ: {{notes}}

【出力形式】
- 基本情報
- 議題と決定事項
- アクションアイテム
- 次回予定`,
    inputFields: [
      { name: 'meetingName', label: '会議名', type: 'text', required: true },
      { name: 'datetime', label: '日時', type: 'text', required: true },
      { name: 'participants', label: '参加者', type: 'text', required: true },
      { name: 'notes', label: '会議メモ', type: 'textarea', required: true },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },
  {
    id: 'proposal-document',
    name: '提案書作成',
    description: '企画提案書を生成',
    categoryId: 'business',
    prompt: `提案書を作成してください。

提案タイトル: {{title}}
背景・課題: {{background}}
提案内容: {{proposal}}
期待効果: {{effect}}
スケジュール: {{schedule}}`,
    inputFields: [
      { name: 'title', label: 'タイトル', type: 'text', required: true },
      { name: 'background', label: '背景・課題', type: 'textarea', required: true },
      { name: 'proposal', label: '提案内容', type: 'textarea', required: true },
      { name: 'effect', label: '期待効果', type: 'textarea', required: true },
      { name: 'schedule', label: 'スケジュール', type: 'text', required: false },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },
  {
    id: 'report-weekly',
    name: '週次報告書作成',
    description: '週次の業務報告書を生成',
    categoryId: 'business',
    prompt: `週次報告書を作成してください。

期間: {{period}}
主な実績: {{achievements}}
課題・問題点: {{issues}}
来週の予定: {{nextWeek}}`,
    inputFields: [
      { name: 'period', label: '期間', type: 'text', required: true, placeholder: '例：12/11〜12/15' },
      { name: 'achievements', label: '主な実績', type: 'textarea', required: true },
      { name: 'issues', label: '課題・問題点', type: 'textarea', required: false },
      { name: 'nextWeek', label: '来週の予定', type: 'textarea', required: true },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },
  {
    id: 'presentation-outline',
    name: 'プレゼン構成作成',
    description: 'プレゼン資料の構成案を生成',
    categoryId: 'business',
    prompt: `プレゼン資料の構成を作成してください。

テーマ: {{theme}}
目的: {{purpose}}
対象者: {{audience}}
時間: {{duration}}

【出力形式】
- 全体構成
- 各スライドの内容案
- ポイント`,
    inputFields: [
      { name: 'theme', label: 'テーマ', type: 'text', required: true },
      { name: 'purpose', label: '目的', type: 'text', required: true },
      { name: 'audience', label: '対象者', type: 'text', required: true },
      { name: 'duration', label: '時間', type: 'select', required: true, options: ['5分', '10分', '15分', '30分'] },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },

  // ==================== 記事・コンテンツ ====================
  {
    id: 'blog-article',
    name: 'ブログ記事作成',
    description: 'SEOを意識したブログ記事を生成',
    categoryId: 'content',
    prompt: `ブログ記事を作成してください。

テーマ: {{theme}}
ターゲット: {{target}}
目的: {{purpose}}
キーワード: {{keywords}}
文字数: {{wordCount}}`,
    inputFields: [
      { name: 'theme', label: 'テーマ', type: 'text', required: true },
      { name: 'target', label: 'ターゲット', type: 'text', required: true },
      { name: 'purpose', label: '目的', type: 'select', required: true, options: ['情報提供', '問題解決', '商品紹介', 'ハウツー'] },
      { name: 'keywords', label: 'キーワード', type: 'text', required: false },
      { name: 'wordCount', label: '文字数', type: 'select', required: true, options: ['1000文字', '2000文字', '3000文字', '5000文字'] },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },
  {
    id: 'article-outline',
    name: '記事構成案作成',
    description: '記事の見出し構成を生成',
    categoryId: 'content',
    prompt: `記事の構成案を作成してください。

テーマ: {{theme}}
ターゲット: {{target}}
記事の種類: {{type}}

【出力形式】
- タイトル案（3つ）
- リード文
- 見出し構成（H2, H3）
- 各見出しで書く内容の概要`,
    inputFields: [
      { name: 'theme', label: 'テーマ', type: 'text', required: true },
      { name: 'target', label: 'ターゲット', type: 'text', required: true },
      { name: 'type', label: '記事種類', type: 'select', required: true, options: ['ハウツー', '比較記事', 'まとめ記事', 'レビュー', 'ニュース'] },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },
  {
    id: 'seo-title-meta',
    name: 'SEOタイトル・メタ作成',
    description: 'SEO用のタイトルとメタディスクリプションを生成',
    categoryId: 'content',
    prompt: `SEO用のタイトルとメタディスクリプションを作成してください。

記事テーマ: {{theme}}
メインキーワード: {{keyword}}
記事の概要: {{summary}}

【出力形式】
- タイトル（5パターン、32文字以内）
- メタディスクリプション（3パターン、120文字以内）`,
    inputFields: [
      { name: 'theme', label: '記事テーマ', type: 'text', required: true },
      { name: 'keyword', label: 'メインキーワード', type: 'text', required: true },
      { name: 'summary', label: '記事の概要', type: 'textarea', required: true },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },
  {
    id: 'article-summary',
    name: '記事・論文要約',
    description: '長い文章を要約',
    categoryId: 'content',
    prompt: `以下の文章を要約してください。

元の文章: {{originalText}}
要約形式: {{format}}
要約の長さ: {{length}}`,
    inputFields: [
      { name: 'originalText', label: '要約したい文章', type: 'textarea', required: true },
      { name: 'format', label: '形式', type: 'select', required: true, options: ['箇条書き', '文章形式', '図解用'] },
      { name: 'length', label: '長さ', type: 'select', required: true, options: ['100文字程度', '300文字程度', '500文字程度'] },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },
  {
    id: 'press-release',
    name: 'プレスリリース作成',
    description: 'プレスリリースを生成',
    categoryId: 'content',
    prompt: `プレスリリースを作成してください。

タイトル: {{title}}
発表内容: {{content}}
会社情報: {{company}}
発表日: {{date}}

【プレスリリース形式で出力】`,
    inputFields: [
      { name: 'title', label: 'タイトル', type: 'text', required: true },
      { name: 'content', label: '発表内容', type: 'textarea', required: true },
      { name: 'company', label: '会社名', type: 'text', required: true },
      { name: 'date', label: '発表日', type: 'text', required: true },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },
  {
    id: 'newsletter',
    name: 'メルマガ作成',
    description: 'メールマガジンを生成',
    categoryId: 'content',
    prompt: `メールマガジンを作成してください。

テーマ: {{theme}}
ターゲット: {{target}}
目的: {{purpose}}
含めたい情報: {{info}}`,
    inputFields: [
      { name: 'theme', label: 'テーマ', type: 'text', required: true },
      { name: 'target', label: 'ターゲット', type: 'text', required: true },
      { name: 'purpose', label: '目的', type: 'select', required: true, options: ['情報提供', '商品紹介', 'イベント告知', 'ブランディング'] },
      { name: 'info', label: '含めたい情報', type: 'textarea', required: true },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },

  // ==================== 営業・セールス ====================
  {
    id: 'sales-pitch',
    name: 'セールスピッチ作成',
    description: '商品・サービスのセールスピッチを生成',
    categoryId: 'sales',
    prompt: `セールスピッチを作成してください。

商品/サービス: {{product}}
ターゲット: {{target}}
課題: {{problem}}
解決策: {{solution}}`,
    inputFields: [
      { name: 'product', label: '商品/サービス', type: 'text', required: true },
      { name: 'target', label: 'ターゲット', type: 'text', required: true },
      { name: 'problem', label: '課題', type: 'textarea', required: true },
      { name: 'solution', label: '解決策', type: 'textarea', required: true },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },
  {
    id: 'product-description',
    name: '商品説明文作成',
    description: '魅力的な商品説明文を生成',
    categoryId: 'sales',
    prompt: `商品説明文を作成してください。

商品名: {{productName}}
カテゴリ: {{category}}
特徴: {{features}}
ターゲット: {{target}}
価格帯: {{price}}`,
    inputFields: [
      { name: 'productName', label: '商品名', type: 'text', required: true },
      { name: 'category', label: 'カテゴリ', type: 'text', required: true },
      { name: 'features', label: '特徴', type: 'textarea', required: true },
      { name: 'target', label: 'ターゲット', type: 'text', required: true },
      { name: 'price', label: '価格帯', type: 'text', required: false },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },
  {
    id: 'sales-email',
    name: '営業メール作成',
    description: '新規開拓・フォローアップメールを生成',
    categoryId: 'sales',
    prompt: `営業メールを作成してください。

目的: {{purpose}}
商品/サービス: {{product}}
送信先の情報: {{recipient}}
訴求ポイント: {{appeal}}`,
    inputFields: [
      { name: 'purpose', label: '目的', type: 'select', required: true, options: ['新規開拓', 'フォローアップ', 'アップセル', '休眠顧客掘り起こし'] },
      { name: 'product', label: '商品/サービス', type: 'text', required: true },
      { name: 'recipient', label: '送信先情報', type: 'textarea', required: true },
      { name: 'appeal', label: '訴求ポイント', type: 'textarea', required: true },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },
  {
    id: 'objection-handling',
    name: '反論対応スクリプト',
    description: '営業での反論対応トークを生成',
    categoryId: 'sales',
    prompt: `よくある反論とその対応トークを作成してください。

商品/サービス: {{product}}
よくある反論: {{objections}}

【出力形式】
各反論に対して：
- 反論内容
- 対応トーク（3パターン）`,
    inputFields: [
      { name: 'product', label: '商品/サービス', type: 'text', required: true },
      { name: 'objections', label: 'よくある反論', type: 'textarea', required: true, placeholder: '例：価格が高い、今は必要ない、他社と比較したい' },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },
  {
    id: 'case-study',
    name: '導入事例作成',
    description: '顧客の導入事例を生成',
    categoryId: 'sales',
    prompt: `導入事例を作成してください。

顧客情報: {{customer}}
導入サービス: {{service}}
課題: {{problem}}
導入効果: {{result}}`,
    inputFields: [
      { name: 'customer', label: '顧客情報（業種・規模）', type: 'text', required: true },
      { name: 'service', label: '導入サービス', type: 'text', required: true },
      { name: 'problem', label: '導入前の課題', type: 'textarea', required: true },
      { name: 'result', label: '導入効果', type: 'textarea', required: true },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },

  // ==================== クリエイティブ ====================
  {
    id: 'catchcopy',
    name: 'キャッチコピー作成',
    description: 'インパクトのあるキャッチコピーを生成',
    categoryId: 'creative',
    prompt: `キャッチコピーを10パターン作成してください。

商品/サービス: {{product}}
ターゲット: {{target}}
訴求ポイント: {{appeal}}
トーン: {{tone}}`,
    inputFields: [
      { name: 'product', label: '商品/サービス', type: 'text', required: true },
      { name: 'target', label: 'ターゲット', type: 'text', required: true },
      { name: 'appeal', label: '訴求ポイント', type: 'textarea', required: true },
      { name: 'tone', label: 'トーン', type: 'select', required: true, options: ['インパクト重視', '信頼感重視', '親しみやすさ', '高級感'] },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },
  {
    id: 'naming',
    name: 'ネーミング作成',
    description: '商品・サービス・会社名のネーミングを生成',
    categoryId: 'creative',
    prompt: `ネーミング案を20個作成してください。

対象: {{target}}
コンセプト: {{concept}}
イメージ: {{image}}
NG条件: {{ng}}`,
    inputFields: [
      { name: 'target', label: '対象（商品/サービス/会社など）', type: 'text', required: true },
      { name: 'concept', label: 'コンセプト', type: 'textarea', required: true },
      { name: 'image', label: 'イメージ', type: 'text', required: true },
      { name: 'ng', label: 'NG条件', type: 'text', required: false },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },
  {
    id: 'slogan',
    name: 'スローガン・タグライン作成',
    description: '企業やブランドのスローガンを生成',
    categoryId: 'creative',
    prompt: `スローガン・タグラインを10パターン作成してください。

企業/ブランド名: {{brand}}
事業内容: {{business}}
ミッション/ビジョン: {{mission}}
ターゲット: {{target}}`,
    inputFields: [
      { name: 'brand', label: '企業/ブランド名', type: 'text', required: true },
      { name: 'business', label: '事業内容', type: 'textarea', required: true },
      { name: 'mission', label: 'ミッション/ビジョン', type: 'textarea', required: true },
      { name: 'target', label: 'ターゲット', type: 'text', required: true },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },
  {
    id: 'brand-story',
    name: 'ブランドストーリー作成',
    description: '感情に訴えるブランドストーリーを生成',
    categoryId: 'creative',
    prompt: `ブランドストーリーを作成してください。

ブランド名: {{brand}}
創業背景: {{background}}
ミッション: {{mission}}
価値観: {{values}}`,
    inputFields: [
      { name: 'brand', label: 'ブランド名', type: 'text', required: true },
      { name: 'background', label: '創業背景', type: 'textarea', required: true },
      { name: 'mission', label: 'ミッション', type: 'textarea', required: true },
      { name: 'values', label: '大切にしている価値観', type: 'textarea', required: true },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },

  // ==================== 教育・研修 ====================
  {
    id: 'business-manual',
    name: '業務マニュアル作成',
    description: '分かりやすい業務マニュアルを生成',
    categoryId: 'education',
    prompt: `業務マニュアルを作成してください。

業務名: {{taskName}}
概要: {{description}}
対象者: {{audience}}
前提知識: {{prerequisites}}`,
    inputFields: [
      { name: 'taskName', label: '業務名', type: 'text', required: true },
      { name: 'description', label: '概要', type: 'textarea', required: true },
      { name: 'audience', label: '対象者', type: 'text', required: true },
      { name: 'prerequisites', label: '前提知識', type: 'textarea', required: false },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },
  {
    id: 'training-curriculum',
    name: '研修カリキュラム作成',
    description: '研修のカリキュラムを生成',
    categoryId: 'education',
    prompt: `研修カリキュラムを作成してください。

研修テーマ: {{theme}}
対象者: {{audience}}
期間: {{duration}}
ゴール: {{goal}}`,
    inputFields: [
      { name: 'theme', label: 'テーマ', type: 'text', required: true },
      { name: 'audience', label: '対象者', type: 'text', required: true },
      { name: 'duration', label: '期間', type: 'select', required: true, options: ['半日', '1日', '2日', '1週間', '1ヶ月'] },
      { name: 'goal', label: 'ゴール', type: 'textarea', required: true },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },
  {
    id: 'faq-creation',
    name: 'FAQ作成',
    description: 'よくある質問と回答を生成',
    categoryId: 'education',
    prompt: `FAQを作成してください。

対象サービス: {{service}}
ターゲット: {{target}}
カテゴリ: {{categories}}

【出力形式】
カテゴリごとにQ&Aを5つずつ`,
    inputFields: [
      { name: 'service', label: 'サービス名', type: 'text', required: true },
      { name: 'target', label: 'ターゲット', type: 'text', required: true },
      { name: 'categories', label: 'カテゴリ', type: 'textarea', required: true, placeholder: '例：料金、機能、サポート、契約' },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },
  {
    id: 'quiz-creation',
    name: 'テスト問題作成',
    description: '理解度確認用のテスト問題を生成',
    categoryId: 'education',
    prompt: `テスト問題を作成してください。

テーマ: {{theme}}
難易度: {{difficulty}}
問題数: {{count}}
形式: {{format}}`,
    inputFields: [
      { name: 'theme', label: 'テーマ', type: 'text', required: true },
      { name: 'difficulty', label: '難易度', type: 'select', required: true, options: ['初級', '中級', '上級'] },
      { name: 'count', label: '問題数', type: 'select', required: true, options: ['5問', '10問', '20問'] },
      { name: 'format', label: '形式', type: 'select', required: true, options: ['選択式', '記述式', '混合'] },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },

  // ==================== 人事・採用 ====================
  {
    id: 'job-posting',
    name: '求人票作成',
    description: '魅力的な求人票を生成',
    categoryId: 'hr',
    prompt: `求人票を作成してください。

職種: {{position}}
雇用形態: {{type}}
会社の魅力: {{appeal}}
求める人物像: {{requirements}}`,
    inputFields: [
      { name: 'position', label: '職種', type: 'text', required: true },
      { name: 'type', label: '雇用形態', type: 'select', required: true, options: ['正社員', '契約社員', 'アルバイト', '業務委託'] },
      { name: 'appeal', label: '会社の魅力', type: 'textarea', required: true },
      { name: 'requirements', label: '求める人物像', type: 'textarea', required: true },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },
  {
    id: 'interview-questions',
    name: '面接質問作成',
    description: '採用面接用の質問を生成',
    categoryId: 'hr',
    prompt: `面接質問を作成してください。

職種: {{position}}
評価したいポイント: {{evaluation}}
面接段階: {{stage}}`,
    inputFields: [
      { name: 'position', label: '職種', type: 'text', required: true },
      { name: 'evaluation', label: '評価ポイント', type: 'textarea', required: true },
      { name: 'stage', label: '面接段階', type: 'select', required: true, options: ['一次面接', '二次面接', '最終面接'] },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },
  {
    id: 'evaluation-sheet',
    name: '人事評価シート作成',
    description: '人事評価用のシートを生成',
    categoryId: 'hr',
    prompt: `人事評価シートを作成してください。

対象職種: {{position}}
評価期間: {{period}}
評価項目: {{items}}`,
    inputFields: [
      { name: 'position', label: '職種', type: 'text', required: true },
      { name: 'period', label: '評価期間', type: 'select', required: true, options: ['四半期', '半期', '年間'] },
      { name: 'items', label: '評価項目', type: 'textarea', required: true, placeholder: '例：業績、能力、姿勢' },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },

  // ==================== 法務・契約 ====================
  {
    id: 'terms-of-service',
    name: '利用規約作成',
    description: 'Webサービスの利用規約を生成',
    categoryId: 'legal',
    prompt: `利用規約を作成してください。

サービス名: {{serviceName}}
サービス概要: {{description}}
想定ユーザー: {{users}}`,
    inputFields: [
      { name: 'serviceName', label: 'サービス名', type: 'text', required: true },
      { name: 'description', label: 'サービス概要', type: 'textarea', required: true },
      { name: 'users', label: '想定ユーザー', type: 'select', required: true, options: ['個人', '法人', '両方'] },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },
  {
    id: 'privacy-policy',
    name: 'プライバシーポリシー作成',
    description: 'プライバシーポリシーを生成',
    categoryId: 'legal',
    prompt: `プライバシーポリシーを作成してください。

サービス名: {{serviceName}}
収集する情報: {{dataCollected}}
利用目的: {{purpose}}`,
    inputFields: [
      { name: 'serviceName', label: 'サービス名', type: 'text', required: true },
      { name: 'dataCollected', label: '収集する情報', type: 'textarea', required: true },
      { name: 'purpose', label: '利用目的', type: 'textarea', required: true },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },

  // ==================== カスタマーサポート ====================
  {
    id: 'support-response',
    name: 'お問い合わせ回答作成',
    description: 'カスタマーサポートの回答を生成',
    categoryId: 'customer',
    prompt: `お問い合わせへの回答を作成してください。

お問い合わせ内容: {{inquiry}}
回答の方向性: {{direction}}
トーン: {{tone}}`,
    inputFields: [
      { name: 'inquiry', label: 'お問い合わせ内容', type: 'textarea', required: true },
      { name: 'direction', label: '回答の方向性', type: 'select', required: true, options: ['解決策の提示', '謝罪', '情報提供', '確認依頼'] },
      { name: 'tone', label: 'トーン', type: 'select', required: true, options: ['フォーマル', '丁寧', '親しみやすい'] },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },
  {
    id: 'complaint-response',
    name: 'クレーム対応文作成',
    description: 'クレームへの対応文を生成',
    categoryId: 'customer',
    prompt: `クレームへの対応文を作成してください。

クレーム内容: {{complaint}}
原因: {{cause}}
対応策: {{solution}}`,
    inputFields: [
      { name: 'complaint', label: 'クレーム内容', type: 'textarea', required: true },
      { name: 'cause', label: '原因', type: 'textarea', required: true },
      { name: 'solution', label: '対応策', type: 'textarea', required: true },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },

  // ==================== 企画・アイデア ====================
  {
    id: 'brainstorm',
    name: 'ブレストアイデア出し',
    description: 'テーマに沿ったアイデアを大量に生成',
    categoryId: 'planning',
    prompt: `以下のテーマでブレストを行い、アイデアを30個出してください。

テーマ: {{theme}}
制約条件: {{constraints}}
ターゲット: {{target}}`,
    inputFields: [
      { name: 'theme', label: 'テーマ', type: 'text', required: true },
      { name: 'constraints', label: '制約条件', type: 'textarea', required: false },
      { name: 'target', label: 'ターゲット', type: 'text', required: true },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },
  {
    id: 'business-plan',
    name: '新規事業企画書作成',
    description: '新規事業の企画書を生成',
    categoryId: 'planning',
    prompt: `新規事業企画書を作成してください。

事業名: {{businessName}}
事業概要: {{description}}
市場: {{market}}
収益モデル: {{revenue}}`,
    inputFields: [
      { name: 'businessName', label: '事業名', type: 'text', required: true },
      { name: 'description', label: '事業概要', type: 'textarea', required: true },
      { name: 'market', label: 'ターゲット市場', type: 'textarea', required: true },
      { name: 'revenue', label: '収益モデル', type: 'textarea', required: true },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },
  {
    id: 'event-plan',
    name: 'イベント企画書作成',
    description: 'イベントの企画書を生成',
    categoryId: 'planning',
    prompt: `イベント企画書を作成してください。

イベント名: {{eventName}}
目的: {{purpose}}
ターゲット: {{target}}
予算: {{budget}}
日程: {{date}}`,
    inputFields: [
      { name: 'eventName', label: 'イベント名', type: 'text', required: true },
      { name: 'purpose', label: '目的', type: 'textarea', required: true },
      { name: 'target', label: 'ターゲット', type: 'text', required: true },
      { name: 'budget', label: '予算', type: 'text', required: false },
      { name: 'date', label: '日程', type: 'text', required: false },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },

  // ==================== 翻訳・多言語 ====================
  {
    id: 'translate-en',
    name: '英語翻訳',
    description: '日本語から英語に翻訳',
    categoryId: 'translation',
    prompt: `以下の文章を英語に翻訳してください。

日本語: {{japanese}}
トーン: {{tone}}`,
    inputFields: [
      { name: 'japanese', label: '日本語テキスト', type: 'textarea', required: true },
      { name: 'tone', label: 'トーン', type: 'select', required: true, options: ['フォーマル', 'カジュアル', 'ビジネス'] },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },
  {
    id: 'translate-ja',
    name: '日本語翻訳',
    description: '英語から日本語に翻訳',
    categoryId: 'translation',
    prompt: `以下の文章を日本語に翻訳してください。

英語: {{english}}
トーン: {{tone}}`,
    inputFields: [
      { name: 'english', label: '英語テキスト', type: 'textarea', required: true },
      { name: 'tone', label: 'トーン', type: 'select', required: true, options: ['フォーマル', 'カジュアル', 'ビジネス'] },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },

  // ==================== 文章改善・校正 ====================
  {
    id: 'rewrite-text',
    name: '文章リライト',
    description: '文章をより良くリライト',
    categoryId: 'writing',
    prompt: `以下の文章をリライトしてください。

元の文章: {{originalText}}
方向性: {{direction}}
トーン: {{tone}}`,
    inputFields: [
      { name: 'originalText', label: '元の文章', type: 'textarea', required: true },
      { name: 'direction', label: '方向性', type: 'select', required: true, options: ['分かりやすく', 'フォーマルに', '簡潔に', '詳しく', '説得力UP'] },
      { name: 'tone', label: 'トーン', type: 'select', required: true, options: ['ビジネス', 'カジュアル', 'アカデミック'] },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },
  {
    id: 'proofread',
    name: '文章校正',
    description: '文章の誤字脱字・文法をチェック',
    categoryId: 'writing',
    prompt: `以下の文章を校正してください。

文章: {{text}}

【出力形式】
- 修正箇所の指摘
- 修正後の文章`,
    inputFields: [
      { name: 'text', label: '校正したい文章', type: 'textarea', required: true },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },
  {
    id: 'tone-change',
    name: 'トーン変更',
    description: '文章のトーンを変更',
    categoryId: 'writing',
    prompt: `以下の文章のトーンを変更してください。

元の文章: {{text}}
変更後のトーン: {{tone}}`,
    inputFields: [
      { name: 'text', label: '元の文章', type: 'textarea', required: true },
      { name: 'tone', label: '変更後のトーン', type: 'select', required: true, options: ['フォーマル', 'カジュアル', '親しみやすい', '権威的', '説得力重視'] },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },
  {
    id: 'expand-text',
    name: '文章を膨らませる',
    description: '短い文章を詳しく展開',
    categoryId: 'writing',
    prompt: `以下の文章を膨らませて詳しくしてください。

元の文章: {{text}}
目標文字数: {{targetLength}}`,
    inputFields: [
      { name: 'text', label: '元の文章', type: 'textarea', required: true },
      { name: 'targetLength', label: '目標文字数', type: 'select', required: true, options: ['2倍程度', '3倍程度', '5倍程度'] },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },
  {
    id: 'shorten-text',
    name: '文章を短くする',
    description: '長い文章を簡潔にまとめる',
    categoryId: 'writing',
    prompt: `以下の文章を短くまとめてください。

元の文章: {{text}}
目標: {{target}}`,
    inputFields: [
      { name: 'text', label: '元の文章', type: 'textarea', required: true },
      { name: 'target', label: '目標', type: 'select', required: true, options: ['半分程度', '1/3程度', '1文にまとめる'] },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },
  {
    id: 'code-review',
    name: 'コードレビュー',
    description: 'コードをレビューして改善点を提案',
    categoryId: 'writing',
    prompt: `以下のコードをレビューしてください。

言語: {{language}}
コード: {{code}}
観点: {{focus}}

【出力形式】
- 良い点
- 改善点
- 修正後のコード`,
    inputFields: [
      { name: 'language', label: '言語', type: 'select', required: true, options: ['JavaScript', 'TypeScript', 'Python', 'Java', 'その他'] },
      { name: 'code', label: 'コード', type: 'textarea', required: true },
      { name: 'focus', label: '観点', type: 'select', required: true, options: ['全般', 'パフォーマンス', 'セキュリティ', '可読性'] },
    ],
    outputType: 'TEXT',
    isPremium: false,
  },
]

export function generateTemplateId(category: string, index: number): string {
  return `${category}-${index.toString().padStart(3, '0')}`
}
