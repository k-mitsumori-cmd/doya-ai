// スワイプカードのメタ情報定義

export type CardCategory = '集客' | '育成' | '商談' | '受注' | '組織' | '予算' | 'ツール'
export type ImpactType = 'CV' | '認知' | 'リード' | '商談' | '受注' | '効率化'
export type CostLevel = 'low' | 'mid' | 'high'
export type Difficulty = 'easy' | 'normal' | 'hard'
export type Channel = 'SEO' | '広告' | 'SNS' | 'コンテンツ' | '営業' | '展示会' | 'メール' | 'ウェビナー'

export interface StrategyCard {
  id: string
  text: string // 質問 or 施策案（短文・断定系）
  description?: string // 補足説明（小さく）
  category: CardCategory
  impact: ImpactType[]
  cost_level: CostLevel
  difficulty: Difficulty
  channel: Channel[]
  recommended_when?: string // "BtoB / 予算少 / 中長期" など
}

export const STRATEGY_CARDS: StrategyCard[] = [
  // 集客系
  {
    id: 'seo_priority',
    text: '広告よりSEOを優先すべき',
    description: '中長期で資産になる施策',
    category: '集客',
    impact: ['CV', '認知'],
    cost_level: 'low',
    difficulty: 'normal',
    channel: ['SEO'],
    recommended_when: 'BtoB / 予算少 / 中長期',
  },
  {
    id: 'comparison_articles',
    text: '比較記事を増やすべき',
    description: '検索流入とCV獲得に効果的',
    category: '集客',
    impact: ['CV', '認知'],
    cost_level: 'mid',
    difficulty: 'normal',
    channel: ['SEO', 'コンテンツ'],
    recommended_when: 'BtoB / 競合が多い',
  },
  {
    id: 'paid_ads',
    text: '広告予算を増やすべき',
    description: '即効性が高いが継続コストも高い',
    category: '集客',
    impact: ['CV', '認知'],
    cost_level: 'high',
    difficulty: 'easy',
    channel: ['広告'],
    recommended_when: '予算あり / 短期成果重視',
  },
  {
    id: 'sns_marketing',
    text: 'SNSマーケティングを強化すべき',
    description: '認知拡大とエンゲージメント向上',
    category: '集客',
    impact: ['認知', 'リード'],
    cost_level: 'mid',
    difficulty: 'normal',
    channel: ['SNS'],
    recommended_when: 'BtoC / 若年層ターゲット',
  },
  {
    id: 'tiktok_no',
    text: 'TikTokは今やるべきではない',
    description: 'リソース対効果を慎重に検討',
    category: '集客',
    impact: ['認知'],
    cost_level: 'mid',
    difficulty: 'hard',
    channel: ['SNS'],
  },
  {
    id: 'content_marketing',
    text: 'コンテンツマーケティングを強化すべき',
    description: '中長期でリード獲得の基盤',
    category: '集客',
    impact: ['リード', '認知'],
    cost_level: 'mid',
    difficulty: 'normal',
    channel: ['コンテンツ', 'SEO'],
    recommended_when: 'BtoB / 中長期',
  },

  // 育成系
  {
    id: 'whitepaper',
    text: 'ホワイトペーパーを起点にすべき',
    description: '高品質リード獲得に効果的',
    category: '育成',
    impact: ['リード', '商談'],
    cost_level: 'mid',
    difficulty: 'normal',
    channel: ['コンテンツ'],
    recommended_when: 'BtoB / 複雑なサービス',
  },
  {
    id: 'email_nurture',
    text: 'メール育成を自動化すべき',
    description: 'リードを段階的に育成',
    category: '育成',
    impact: ['リード', '商談'],
    cost_level: 'low',
    difficulty: 'easy',
    channel: ['メール'],
    recommended_when: 'リード数が多い',
  },
  {
    id: 'webinar',
    text: 'ウェビナーを定期開催すべき',
    description: '高品質リードの獲得と育成',
    category: '育成',
    impact: ['リード', '商談'],
    cost_level: 'mid',
    difficulty: 'normal',
    channel: ['ウェビナー'],
    recommended_when: 'BtoB / 専門性が高い',
  },

  // 商談系
  {
    id: 'sales_automation',
    text: '営業よりマーケ主導に切り替える',
    description: 'スケーラブルな成長モデル',
    category: '商談',
    impact: ['商談', '効率化'],
    cost_level: 'mid',
    difficulty: 'hard',
    channel: ['営業', 'マーケ'],
    recommended_when: '成長期 / スケール重視',
  },
  {
    id: 'demo_automation',
    text: 'デモ予約を自動化すべき',
    description: '商談機会の最大化',
    category: '商談',
    impact: ['商談'],
    cost_level: 'low',
    difficulty: 'easy',
    channel: ['ツール'],
    recommended_when: 'デモ需要が高い',
  },
  {
    id: 'sales_enablement',
    text: '営業支援ツールを導入すべき',
    description: '営業効率と成約率向上',
    category: '商談',
    impact: ['商談', '効率化'],
    cost_level: 'mid',
    difficulty: 'normal',
    channel: ['ツール', '営業'],
    recommended_when: '営業チームが大きい',
  },

  // 受注系
  {
    id: 'case_study',
    text: '成功事例を増やすべき',
    description: '信頼性向上と成約率向上',
    category: '受注',
    impact: ['受注'],
    cost_level: 'low',
    difficulty: 'easy',
    channel: ['コンテンツ'],
    recommended_when: '成約率を上げたい',
  },
  {
    id: 'pricing_optimization',
    text: '価格戦略を見直すべき',
    description: '収益性と競争力のバランス',
    category: '受注',
    impact: ['受注'],
    cost_level: 'low',
    difficulty: 'normal',
    channel: ['組織'],
    recommended_when: '競合が多い',
  },

  // 組織系
  {
    id: 'marketing_team',
    text: 'マーケティングチームを拡充すべき',
    description: '専門性と実行力の向上',
    category: '組織',
    impact: ['効率化'],
    cost_level: 'high',
    difficulty: 'hard',
    channel: ['組織'],
    recommended_when: '成長期 / 予算あり',
  },
  {
    id: 'agency_partnership',
    text: '外部パートナーと連携すべき',
    description: '専門性とスピードの両立',
    category: '組織',
    impact: ['効率化'],
    cost_level: 'mid',
    difficulty: 'normal',
    channel: ['組織'],
    recommended_when: '専門性が必要 / 短期',
  },

  // 予算・ツール系
  {
    id: 'crm_tool',
    text: 'CRMツールを導入すべき',
    description: '顧客管理と分析の効率化',
    category: 'ツール',
    impact: ['効率化', '商談'],
    cost_level: 'mid',
    difficulty: 'normal',
    channel: ['ツール'],
    recommended_when: '顧客数が多い',
  },
  {
    id: 'analytics_tool',
    text: '分析ツールを強化すべき',
    description: 'データドリブンな意思決定',
    category: 'ツール',
    impact: ['効率化'],
    cost_level: 'mid',
    difficulty: 'normal',
    channel: ['ツール'],
    recommended_when: 'データ活用したい',
  },
  {
    id: 'exhibition',
    text: '展示会は今年やる価値がある',
    description: '直接的な商談機会と認知向上',
    category: '集客',
    impact: ['認知', '商談'],
    cost_level: 'high',
    difficulty: 'normal',
    channel: ['展示会'],
    recommended_when: 'BtoB / 業界イベント',
  },
  {
    id: 'referral_program',
    text: '紹介プログラムを始めるべき',
    description: '低コストで高品質なリード獲得',
    category: '集客',
    impact: ['リード', '受注'],
    cost_level: 'low',
    difficulty: 'normal',
    channel: ['マーケ'],
    recommended_when: '顧客満足度が高い',
  },
  {
    id: 'community_building',
    text: 'コミュニティを構築すべき',
    description: '長期的な顧客関係と口コミ',
    category: '育成',
    impact: ['リード', '認知'],
    cost_level: 'mid',
    difficulty: 'hard',
    channel: ['SNS', 'コミュニティ'],
    recommended_when: '中長期 / エンゲージメント重視',
  },
]
