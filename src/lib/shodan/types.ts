// ============================================
// ドヤ商談準備（Shodan）型定義
// ============================================
export type ShodanRole = 'owner' | 'admin' | 'manager' | 'member'

export interface ShodanContext {
  userId: string
  organizationId: string
  organizationSlug: string
  role: ShodanRole
  memberId: string
}

export const ROLE_HIERARCHY: Record<string, number> = {
  member: 0,
  manager: 1,
  admin: 2,
  owner: 3,
}

export const ROLE_LABEL: Record<ShodanRole, string> = {
  member: 'メンバー（営業担当）',
  manager: 'マネージャー',
  admin: '管理者',
  owner: 'オーナー',
}

export type MemberStatus = 'ACTIVE' | 'PENDING' | 'INACTIVE'
// processing=リサーチ実行中 / researched=調査完了・提案生成待ち or 生成中 / done=完成 / failed=失敗
export type PrepStatus = 'processing' | 'researched' | 'done' | 'failed'

// Vercel maxDuration(300s) でハンドラが強制終了されると catch が走らず 'processing' のまま残る。
// この時間を超えた処理中は実質失敗とみなす（無限スピナー防止）。maxDuration(5分)より長く取る。
export const PREP_STALE_MS = 6 * 60 * 1000
export function effectivePrepStatus(status: string, updatedAt: Date | string): string {
  if (status === 'processing' && Date.now() - new Date(updatedAt).getTime() > PREP_STALE_MS) return 'failed'
  return status
}

// ---- リサーチ（深掘り調査）の構造 ----
export interface CompanyResearch {
  companyName?: string
  url: string
  // 公的データ（gBizINFO）
  corporateNumber?: string
  employeeCount?: number | null // 実従業員数
  employeeCountSource?: 'gbizinfo' | 'website' | 'estimate' | 'unknown'
  capital?: string | null
  industry?: string | null
  foundedYear?: string | null
  address?: string | null
  representative?: string | null
  // 事業概要（サイト解析）
  description?: string
  services?: string[]
  // ビジュアル
  ogImage?: string | null // トップページの og:image（あれば）
  crawledUrls?: string[] // スクリーンショット表示用に実際に見たページURL（target＋メディア）
  // マーケティング実施状況
  marketing: {
    snsChannels: string[] // 検出したSNS（X/Facebook/Instagram/YouTube/LinkedIn/note 等）
    hasContactForm: boolean // 問い合わせ/資料請求 導線
    hasLeadMagnet: boolean // 資料DL・メルマガ等のリード獲得
    martechTools: string[] // 検出したMA/解析ツール（GA/GTM/HubSpot/Marketo/Pardot 等）
    runsAds: boolean // 広告タグの痕跡
    summary: string // 実施状況の一言要約
  }
  // オウンドメディア・サイト規模
  ownedMedia: {
    hasOwnedMedia: boolean // ブログ/ニュース/コラム等の有無
    mediaUrls: string[] // 見つけたメディア/ブログ/ニュースのURL
    articleCountEstimate: number // 記事数の概算
    latestArticleDate?: string | null // 最新記事の日付（YYYY-MM-DD）
    updateFrequency: 'high' | 'medium' | 'low' | 'inactive' | 'unknown' // 更新頻度
    frequencyNote: string // 更新頻度の根拠（一言）
    siteScale: 'large' | 'medium' | 'small' | 'unknown' // サイト規模感
  }
  // プレスリリース（PR TIMES 等。市場・企業の最新動向）
  pressReleases?: PressRelease[]
  // 取得した生テキスト（分析用、保存はしない/短縮）
  rawNotes?: string
}

export interface ProposalSlide {
  title: string
  subtitle?: string
  bullets?: string[]
  note?: string
  type?: 'cover' | 'agenda' | 'content' | 'closing'
}

export interface PressRelease {
  title: string
  url: string
  date?: string | null
  image?: string | null
  source?: string // 'PR TIMES' 等
}

// ---- 分析（現状分析・課題仮説・解決策） ----
export interface Hypothesis {
  issue: string // 課題仮説（はっきりめ）
  basis: string // 根拠（調査事実にひもづける）
  impact: string // 放置した場合の悪影響
}
export interface Solution {
  title: string // 解決策のタイトル
  detail: string // 内容（自社商材にひもづける）
  expectedEffect: string // 期待効果
}
export interface CompanyAnalysis {
  currentStateAssessment: string // 現状分析（はっきりめ・歯に衣着せない）
  strengths: string[] // 相手企業の強み
  weaknesses: string[] // 弱み・伸びしろ
  hypotheses: Hypothesis[] // 課題仮説
  solutions: Solution[] // 解決策（自社商材ベース）
  talkingPoints: string[] // 商談で刺さる論点
  firstMessage: string // 最初の一言（アイスブレイク〜本題への入り）
}
