/**
 * ナグサメ 共通型定義
 */

/** 将来のセグメント拡張に備えた文字列ユニオン */
export type NagusameSegment = 'default' | 'business' | 'student'

/** ペルソナ（1体のキャラクター） */
export interface Persona {
  /** 安定ID（DBに保存される）。変更すると過去返信との紐付けが切れるので要注意 */
  id: string
  /** 表示名 */
  name: string
  /** 一言属性（例: "80歳の祖母"） */
  tagline: string
  /** 慰めスタイル（包容 / 共感 / ユーモア / 叱咤激励 / 論破 / 方言 / ファンタジー） */
  style:
    | 'embrace'
    | 'empathy'
    | 'humor'
    | 'cheer'
    | 'rational'
    | 'dialect'
    | 'fantasy'
  /** アバターの絵文字（MVP。将来はイラスト差し替え予定） */
  avatar: string
  /** Claude system prompt 用のキャラクター指示 */
  systemPrompt: string
  /** Free プランで利用可能か */
  freeTier: boolean
  /** 表示順（小さいほど先に返信が届く傾向にする） */
  order: number
}

/** SSE イベントタイプ（参考用。クライアントは unknown で受けてから判定する） */
export interface NagusameSafetyResource {
  name: string
  phone: string
  hours: string
  url: string
}

export type NagusameStreamEvent =
  | { type: 'start'; postId: string; expectedReplies: number }
  | {
      type: 'reply'
      personaId: string
      personaName: string
      avatar: string
      content: string
      index: number
    }
  | { type: 'star_lit'; count: number; total: number }
  | {
      type: 'safety_escalation'
      resources: {
        locale: string
        intro: string
        disclaimer: string
        lines: NagusameSafetyResource[]
      }
    }
  | { type: 'limit_reached'; reason: string }
  | { type: 'done'; postId: string; totalReplies: number }
  | { type: 'error'; message: string }
