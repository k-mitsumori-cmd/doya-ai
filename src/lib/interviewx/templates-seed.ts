// ============================================
// ドヤヒヤリングAI — プリセットテンプレート
// ============================================

export interface TemplateQuestion {
  text: string
  type: 'TEXT' | 'TEXTAREA' | 'SELECT' | 'RATING' | 'YES_NO'
  required: boolean
  order: number
  description?: string
  options?: string[]
}

export interface PresetTemplate {
  name: string
  description: string
  category: string
  icon: string
  defaultQuestions: TemplateQuestion[]
  promptTemplate: string
  sampleArticle?: string
}

export const PRESET_TEMPLATES: PresetTemplate[] = [
  // ========================================
  // 商談ヒヤリング
  // ========================================
  {
    name: '商談ヒヤリング',
    description: '営業商談の事前・事後ヒヤリング。課題・予算・スケジュール・決裁フローを整理。',
    category: 'BUSINESS_MEETING',
    icon: '🤝',
    defaultQuestions: [
      { text: '現在抱えている課題や困りごとを教えてください。', type: 'TEXTAREA', required: true, order: 1, description: 'できるだけ具体的に教えてください' },
      { text: '課題解決に向けて、これまでどのような取り組みをされましたか？', type: 'TEXTAREA', required: true, order: 2 },
      { text: '理想的な解決策のイメージはありますか？', type: 'TEXTAREA', required: true, order: 3 },
      { text: '導入を検討する際に重視するポイントは何ですか？', type: 'TEXTAREA', required: true, order: 4, description: '例: コスト、操作性、サポート体制、実績など' },
      { text: '予算感やご予算の目安はありますか？', type: 'TEXTAREA', required: false, order: 5 },
      { text: '導入のスケジュール感を教えてください。', type: 'TEXTAREA', required: true, order: 6, description: 'いつまでに導入したいか' },
      { text: '意思決定のプロセスや関係者を教えてください。', type: 'TEXTAREA', required: false, order: 7, description: '決裁フロー、最終決定者など' },
      { text: '他社のサービスも検討されていますか？', type: 'TEXTAREA', required: false, order: 8 },
      { text: '今回のお打ち合わせで確認したいことはありますか？', type: 'TEXTAREA', required: true, order: 9 },
      { text: 'その他、共有しておきたい情報があれば教えてください。', type: 'TEXTAREA', required: false, order: 10 },
    ],
    promptTemplate: `ヒヤリング結果を以下の観点で要約してください。

## 要約構成
1. **要約概要**: 3-5行でヒヤリング内容を要約
2. **課題・ニーズ**: 顧客が抱える課題とニーズを整理
3. **予算・スケジュール**: 予算感と導入スケジュール
4. **意思決定プロセス**: 決裁フロー・関係者
5. **競合状況**: 他社検討状況
6. **次のアクション**: 商談を進めるための次のステップ
7. **重要ポイント**: 特に留意すべき点

## ルール
- 事実ベースで簡潔に
- 数値や固有名詞は正確に
- アクションアイテムは具体的に`,
  },

  // ========================================
  // サービス調査
  // ========================================
  {
    name: 'サービス調査',
    description: '他社サービス・ツールの利用状況や評価を調査。乗り換え検討にも。',
    category: 'SERVICE_RESEARCH',
    icon: '🔍',
    defaultQuestions: [
      { text: '現在利用しているサービス・ツールの名前を教えてください。', type: 'TEXT', required: true, order: 1 },
      { text: 'そのサービスの利用目的・用途を教えてください。', type: 'TEXTAREA', required: true, order: 2 },
      { text: '利用頻度はどのくらいですか？', type: 'TEXTAREA', required: true, order: 3, description: '毎日、週数回、月数回など' },
      { text: '気に入っている機能・ポイントを教えてください。', type: 'TEXTAREA', required: true, order: 4 },
      { text: '不満に感じている点や改善してほしい点はありますか？', type: 'TEXTAREA', required: true, order: 5 },
      { text: '月額・年額のコストはどのくらいですか？', type: 'TEXTAREA', required: false, order: 6 },
      { text: 'コストパフォーマンスについてどう感じていますか？', type: 'RATING', required: true, order: 7, description: '1=非常に悪い 〜 5=非常に良い' },
      { text: 'サポート体制の評価を教えてください。', type: 'TEXTAREA', required: false, order: 8 },
      { text: '他のサービスへの乗り換えを検討したことはありますか？理由もお聞かせください。', type: 'TEXTAREA', required: true, order: 9 },
      { text: '理想的なサービスがあるとしたら、どんな機能が欲しいですか？', type: 'TEXTAREA', required: true, order: 10 },
    ],
    promptTemplate: `ヒヤリング結果を以下の観点で要約してください。

## 要約構成
1. **要約概要**: サービス利用状況の全体像
2. **利用中サービス**: サービス名・用途・利用頻度
3. **満足ポイント**: 高評価の機能・特徴
4. **課題・不満**: 改善要望・不満点
5. **コスト評価**: 費用対効果の評価
6. **乗り換え意向**: 検討状況と理由
7. **理想のサービス像**: 求める機能・条件

## ルール
- 客観的な事実を優先
- 比較ポイントを明確に`,
  },

  // ========================================
  // 顧客満足度
  // ========================================
  {
    name: '顧客満足度ヒヤリング',
    description: '既存顧客の満足度調査。サービス改善やNPS向上に活用。',
    category: 'CUSTOMER_SATISFACTION',
    icon: '⭐',
    defaultQuestions: [
      { text: 'ご利用中のサービス・プランを教えてください。', type: 'TEXT', required: true, order: 1 },
      { text: 'サービスの総合満足度を教えてください。', type: 'RATING', required: true, order: 2, description: '1=非常に不満 〜 5=非常に満足' },
      { text: 'サービスで最も価値を感じている点は何ですか？', type: 'TEXTAREA', required: true, order: 3 },
      { text: '改善してほしい点があれば教えてください。', type: 'TEXTAREA', required: true, order: 4 },
      { text: 'サポート対応の満足度はいかがですか？', type: 'RATING', required: true, order: 5, description: '1=非常に不満 〜 5=非常に満足' },
      { text: '料金に対する納得感はいかがですか？', type: 'RATING', required: true, order: 6, description: '1=非常に割高 〜 5=非常にお得' },
      { text: 'このサービスを知人や同僚に勧める可能性はどのくらいですか？', type: 'RATING', required: true, order: 7, description: '1=全く勧めない 〜 5=強く勧める（NPS）' },
      { text: '今後追加してほしい機能やサービスはありますか？', type: 'TEXTAREA', required: false, order: 8 },
      { text: '他に共有しておきたいご意見・ご要望はありますか？', type: 'TEXTAREA', required: false, order: 9 },
    ],
    promptTemplate: `ヒヤリング結果を以下の観点で要約してください。

## 要約構成
1. **要約概要**: 満足度の全体像（スコア含む）
2. **満足度スコア**: 各項目のスコアまとめ
3. **強み・高評価ポイント**: 顧客が価値を感じている点
4. **改善要望**: 不満点・改善リクエスト
5. **NPS**: 推奨度とその理由
6. **機能要望**: 追加機能リクエスト
7. **アクションアイテム**: 改善に向けた具体的なアクション

## ルール
- スコアは数値で明記
- 顧客の声をそのまま引用`,
  },

  // ========================================
  // 要件定義
  // ========================================
  {
    name: '要件定義ヒヤリング',
    description: 'システム開発・業務改善の要件整理。現状の業務フローと課題を明確化。',
    category: 'REQUIREMENTS',
    icon: '📋',
    defaultQuestions: [
      { text: '対象となる業務・プロジェクトの概要を教えてください。', type: 'TEXTAREA', required: true, order: 1 },
      { text: '現在の業務フロー（手順）を教えてください。', type: 'TEXTAREA', required: true, order: 2, description: 'ステップごとに記述してください' },
      { text: '現状の課題やボトルネックは何ですか？', type: 'TEXTAREA', required: true, order: 3 },
      { text: '改善後の理想的な業務フローのイメージはありますか？', type: 'TEXTAREA', required: true, order: 4 },
      { text: '必須で実現したい機能・要件を教えてください。', type: 'TEXTAREA', required: true, order: 5, description: 'マスト要件' },
      { text: 'あると嬉しい機能・要件はありますか？', type: 'TEXTAREA', required: false, order: 6, description: 'ウォント要件' },
      { text: '利用するユーザー数や規模感を教えてください。', type: 'TEXTAREA', required: true, order: 7 },
      { text: '連携が必要な既存システムやツールはありますか？', type: 'TEXTAREA', required: false, order: 8 },
      { text: 'スケジュールや納期の目安を教えてください。', type: 'TEXTAREA', required: true, order: 9 },
      { text: '予算感や制約事項があれば教えてください。', type: 'TEXTAREA', required: false, order: 10 },
    ],
    promptTemplate: `ヒヤリング結果を以下の観点で要約してください。

## 要約構成
1. **要約概要**: プロジェクト概要の要約
2. **現状の業務フロー**: 現在の手順を整理
3. **課題・ボトルネック**: 問題点の一覧
4. **要件一覧**: マスト要件とウォント要件を分類
5. **システム連携**: 既存システムとの連携要件
6. **非機能要件**: ユーザー数・性能・セキュリティ
7. **スケジュール・予算**: 納期と予算の制約
8. **次のステップ**: 要件確定に向けたアクション

## ルール
- 要件は箇条書きで明確に
- 優先度を付与（マスト/ウォント）`,
  },

  // ========================================
  // 社内ヒヤリング
  // ========================================
  {
    name: '社内ヒヤリング',
    description: '社内調査・1on1ミーティング・組織改善のためのヒヤリング。',
    category: 'INTERNAL_HEARING',
    icon: '🏢',
    defaultQuestions: [
      { text: 'お名前と所属部署を教えてください。', type: 'TEXT', required: true, order: 1 },
      { text: '現在の業務内容と役割を簡単に教えてください。', type: 'TEXTAREA', required: true, order: 2 },
      { text: '業務で上手くいっていること・成果が出ていることは何ですか？', type: 'TEXTAREA', required: true, order: 3 },
      { text: '業務上の課題や困っていることはありますか？', type: 'TEXTAREA', required: true, order: 4 },
      { text: 'チーム内のコミュニケーションについてどう感じていますか？', type: 'TEXTAREA', required: true, order: 5 },
      { text: '会社や組織に対して改善してほしいことはありますか？', type: 'TEXTAREA', required: false, order: 6 },
      { text: '今後チャレンジしたいこと・キャリアの方向性を教えてください。', type: 'TEXTAREA', required: true, order: 7 },
      { text: 'サポートが必要なこと・上長に相談したいことはありますか？', type: 'TEXTAREA', required: false, order: 8 },
      { text: '職場環境の満足度を教えてください。', type: 'RATING', required: true, order: 9, description: '1=非常に不満 〜 5=非常に満足' },
    ],
    promptTemplate: `ヒヤリング結果を以下の観点で要約してください。

## 要約構成
1. **要約概要**: ヒヤリング対象者と全体の所感
2. **業務状況**: 現在の業務と成果
3. **課題・困りごと**: 業務上の問題点
4. **組織・コミュニケーション**: チーム・組織への評価
5. **キャリア意向**: 今後の方向性・希望
6. **要望・相談事項**: 上長やHRへの要望
7. **アクションアイテム**: フォローすべき事項

## ルール
- 個人情報の取り扱いに注意
- 率直な意見をそのまま記録`,
  },

  // ========================================
  // 競合調査
  // ========================================
  {
    name: '競合調査ヒヤリング',
    description: '競合企業・競合サービスに関する情報を体系的に収集・分析。',
    category: 'COMPETITOR_ANALYSIS',
    icon: '📊',
    defaultQuestions: [
      { text: '調査対象の競合企業・サービス名を教えてください。', type: 'TEXT', required: true, order: 1 },
      { text: 'その競合の主な事業内容・サービスの概要を教えてください。', type: 'TEXTAREA', required: true, order: 2 },
      { text: '競合の強み・差別化ポイントは何だと思いますか？', type: 'TEXTAREA', required: true, order: 3 },
      { text: '競合の弱み・課題だと感じる点はありますか？', type: 'TEXTAREA', required: true, order: 4 },
      { text: '価格帯やビジネスモデルについて知っていることを教えてください。', type: 'TEXTAREA', required: false, order: 5 },
      { text: '顧客層やターゲット市場はどこだと思いますか？', type: 'TEXTAREA', required: true, order: 6 },
      { text: '自社と比較した場合の優位性・劣位性は？', type: 'TEXTAREA', required: true, order: 7 },
      { text: '競合の最近の動き（新サービス・資金調達・提携等）を知っていれば教えてください。', type: 'TEXTAREA', required: false, order: 8 },
      { text: '競合に対する自社の戦略として、何が効果的だと思いますか？', type: 'TEXTAREA', required: true, order: 9 },
    ],
    promptTemplate: `ヒヤリング結果を以下の観点で要約してください。

## 要約構成
1. **要約概要**: 競合分析の全体像
2. **競合プロフィール**: 企業名・事業概要・規模
3. **強み分析**: 競合の差別化ポイント
4. **弱み分析**: 競合の課題・弱点
5. **価格・ビジネスモデル**: 収益構造
6. **自社との比較**: 優位性・劣位性のマトリクス
7. **市場動向**: 最近の動き・トレンド
8. **戦略提言**: 自社がとるべきアクション

## ルール
- SWOT分析の視点で整理
- 客観的な事実と主観的な見解を区別`,
  },

  // ========================================
  // 新規事業調査
  // ========================================
  {
    name: '新規事業調査ヒヤリング',
    description: '新規事業・新サービスの市場調査、ニーズ検証のためのヒヤリング。',
    category: 'NEW_BUSINESS',
    icon: '🚀',
    defaultQuestions: [
      { text: '検討中の事業・サービスのアイデアを教えてください。', type: 'TEXTAREA', required: true, order: 1 },
      { text: 'このアイデアが解決する課題は何ですか？', type: 'TEXTAREA', required: true, order: 2 },
      { text: 'ターゲットとなるユーザー・顧客層はどこですか？', type: 'TEXTAREA', required: true, order: 3 },
      { text: '現時点でこの課題はどのように解決されていますか？（既存の代替手段）', type: 'TEXTAREA', required: true, order: 4 },
      { text: 'あなたのアイデアの独自性・差別化ポイントは？', type: 'TEXTAREA', required: true, order: 5 },
      { text: '想定するビジネスモデル・収益構造を教えてください。', type: 'TEXTAREA', required: true, order: 6 },
      { text: '市場規模やトレンドについてどう見ていますか？', type: 'TEXTAREA', required: false, order: 7 },
      { text: 'リスクや懸念事項はありますか？', type: 'TEXTAREA', required: true, order: 8 },
      { text: '実現に必要なリソース（人・モノ・カネ）は？', type: 'TEXTAREA', required: false, order: 9 },
      { text: 'まず最初に検証したいことは何ですか？', type: 'TEXTAREA', required: true, order: 10 },
    ],
    promptTemplate: `ヒヤリング結果を以下の観点で要約してください。

## 要約構成
1. **要約概要**: 新規事業アイデアの全体像
2. **課題と解決策**: 解決する課題とアプローチ
3. **ターゲット市場**: 顧客層と市場規模
4. **競合・代替手段**: 既存ソリューションとの比較
5. **差別化ポイント**: 独自の強み
6. **ビジネスモデル**: 収益構造と価格戦略
7. **リスク分析**: 懸念事項と対策
8. **必要リソース**: 人・モノ・カネの見積もり
9. **次のステップ**: MVP・検証計画

## ルール
- リーンスタートアップの視点で整理
- 仮説と事実を明確に区別`,
  },

  // ========================================
  // カスタム
  // ========================================
  {
    name: 'カスタムヒヤリング',
    description: '自由にヒヤリング項目を設定。目的に合わせてAIが質問を自動生成。',
    category: 'CUSTOM',
    icon: '✏️',
    defaultQuestions: [
      { text: '今回のヒヤリングの背景を教えてください。', type: 'TEXTAREA', required: true, order: 1 },
      { text: '現状について詳しく教えてください。', type: 'TEXTAREA', required: true, order: 2 },
      { text: '課題や困っていることはありますか？', type: 'TEXTAREA', required: true, order: 3 },
      { text: '理想の状態やゴールを教えてください。', type: 'TEXTAREA', required: true, order: 4 },
      { text: 'これまでに試したことはありますか？', type: 'TEXTAREA', required: false, order: 5 },
      { text: '優先順位や重要度で気にしていることはありますか？', type: 'TEXTAREA', required: true, order: 6 },
      { text: 'スケジュールや期限はありますか？', type: 'TEXTAREA', required: false, order: 7 },
      { text: 'その他、共有しておきたい情報があれば教えてください。', type: 'TEXTAREA', required: false, order: 8 },
    ],
    promptTemplate: `ヒヤリング結果を以下の観点で要約してください。

## 要約構成
1. **要約概要**: ヒヤリング内容の全体像を3-5行で
2. **背景・現状**: 現在の状況
3. **課題・ニーズ**: 問題点と求めていること
4. **目標・ゴール**: 理想の状態
5. **重要ポイント**: 特に留意すべき点
6. **アクションアイテム**: 次のステップ

## ルール
- 事実ベースで簡潔に
- 回答者の言葉をなるべく活かす`,
  },
]
