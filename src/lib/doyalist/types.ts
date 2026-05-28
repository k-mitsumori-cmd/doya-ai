export interface TargetCriteria {
  industries: string[]
  areas: string[]
  keywords: string[]
  companySize?: {
    minEmployees?: number
    maxEmployees?: number
  }
  capital?: {
    min?: number
    max?: number
  }
}

export interface AiSuggestion {
  industries: string[]
  areas: string[]
  keywords: string[]
  companySize?: {
    minEmployees?: number
    maxEmployees?: number
  }
  reasoning: string
  approachTips: string
}

export interface CompanyScore {
  matchScore: number
  needsAnalysis: string
  approachAdvice: string
  riskFlags: string
}

export type ProjectStatus = 'draft' | 'collecting' | 'analyzing' | 'completed' | 'archived'

export type ContactStatus = '未着手' | '連絡済' | '返信あり' | '商談中' | '成約' | '見送り'

export type ApproachType = 'email' | 'form' | 'letter' | 'phone_script'

export type ApproachTone = 'formal' | 'casual' | 'consultative'

export const CONTACT_STATUS_OPTIONS: { value: ContactStatus; label: string; color: string }[] = [
  { value: '未着手', label: '未着手', color: 'bg-gray-100 text-gray-700' },
  { value: '連絡済', label: '連絡済', color: 'bg-blue-100 text-blue-700' },
  { value: '返信あり', label: '返信あり', color: 'bg-yellow-100 text-yellow-700' },
  { value: '商談中', label: '商談中', color: 'bg-purple-100 text-purple-700' },
  { value: '成約', label: '成約', color: 'bg-green-100 text-green-700' },
  { value: '見送り', label: '見送り', color: 'bg-slate-100 text-slate-500' },
]

export const PROJECT_STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string; icon: string }> = {
  draft: { label: '下書き', color: 'bg-gray-100 text-gray-700', icon: 'edit_note' },
  collecting: { label: '収集中', color: 'bg-blue-100 text-blue-700', icon: 'downloading' },
  analyzing: { label: '分析中', color: 'bg-amber-100 text-amber-700', icon: 'analytics' },
  completed: { label: '完了', color: 'bg-green-100 text-green-700', icon: 'check_circle' },
  archived: { label: 'アーカイブ', color: 'bg-slate-100 text-slate-500', icon: 'archive' },
}

export const INDUSTRIES = [
  '情報通信業', 'サービス業', '製造業', '卸売業・小売業', '建設業',
  '不動産業', '金融業・保険業', '医療・福祉', '教育・学習支援',
  '宿泊業・飲食サービス業', '運輸業・郵便業', '農林漁業',
  '電気・ガス・水道業', '鉱業', '複合サービス業', 'その他',
]

export const PREFECTURES = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県',
  '岐阜県', '静岡県', '愛知県', '三重県',
  '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県',
  '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県',
  '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
]
