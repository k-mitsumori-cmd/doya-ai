// ============================================
// ドヤスライド 型定義
// ============================================

export type DocType =
  | 'sales' // 営業資料
  | 'proposal' // 提案資料
  | 'sns' // SNS用資料
  | 'seminar' // セミナー・登壇
  | 'recruit' // 採用
  | 'pitch' // ピッチ
  | 'internal' // 社内共有
  | 'custom' // 自由入力

export type AspectRatio = 'wide' | 'square' | 'vertical'

/**
 * スタイルプリセット（12種 = ビジネス系6 + 遊び系6）。
 * 各スタイルは directive（アートディレクション）で強く差別化し、
 * 遊び系は専用 layout（企業資料テンプレ不使用）を持つ。
 */
export type StylePreset =
  | 'corporate' // コーポレート（ビジネス）
  | 'minimal' // ミニマル（ビジネス）
  | 'luxury' // 高級（ビジネス）
  | 'gradient' // グラデーション（ビジネス）
  | 'nature' // ナチュラル（ビジネス）
  | 'mono' // モノクロ（ビジネス）
  | 'pop' // ポップ（遊び）
  | 'handwritten' // 手書き風（遊び）
  | 'isometric' // アイソメ図解（遊び）
  | 'flashy' // ド派手（遊び）
  | 'cyber' // サイバー（遊び）
  | 'retro' // レトロ（遊び）

export type LogoPosition =
  | 'top-right'
  | 'top-left'
  | 'bottom-right'
  | 'bottom-left'
  | 'top-center'
  | 'bottom-center'

export type LogoSize = 'S' | 'M' | 'L'

export type SlideStatus = 'pending' | 'generating' | 'done' | 'error'
export type ProjectStatus = 'draft' | 'structuring' | 'generating' | 'completed' | 'error'

/** AIが生成するスライド構成（1枚分） */
export interface SlideStructure {
  index: number
  role: string // 表紙 / 課題 / 解決 / 実績 / CTA など
  headline: string
  subText: string
  visualPrompt: string // そのスライドのビジュアル方針（背景・モチーフ・雰囲気）
}

/** チャット修正でAIが返す意図分解の結果 */
export interface ChatEditResult {
  reply: string // ユーザーへの返答
  headline?: string
  subText?: string
  visualPrompt?: string // 追記/上書きするビジュアル指示
  logoPosition?: LogoPosition
  logoSize?: LogoSize
}
