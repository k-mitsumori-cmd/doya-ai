// ============================================
// ドヤAI商談 日程調整リンク
// ============================================
// 一次商談の出口は「次アポの確定」。商談の最後に、見込み客が
// そのまま実際の担当者と日程を決められるボタンを出す。
//
// ⚠️ このURLは**未ログインの見込み客の画面にボタンとして描画される**。
//    ホストが設定する値だが、検証せずに通すと次の事故が起きうる:
//      - `javascript:` を入れられると、商談ルームを開いた相手のブラウザで
//        任意のスクリプトが走る（保存型XSS）
//      - `data:` で偽のページを開かせられる
//    そのため **https のみ**を許可する。http も許さない
//    （日程調整サービスは例外なく https で提供されており、
//      平文だと相手の予定という個人情報が経路上で読まれる）。

export interface SchedulingConfig {
  url: string | null
  label: string | null
}

/** ボタンの既定文言 */
export const DEFAULT_SCHEDULING_LABEL = '担当者と日程を決める'

export interface SchedulingValidation {
  ok: boolean
  /** 正規化したURL（ok のときだけ） */
  url?: string
  reason?: string
}

/**
 * ホストが入力した日程調整URLを検証する。
 * ⚠️ 通すのは https のみ。判断に迷ったら通さない側へ倒す。
 */
export function validateSchedulingUrl(raw: unknown): SchedulingValidation {
  const t = String(raw ?? '').trim()
  if (!t) return { ok: true, url: undefined } // 未設定は許容（ボタンを出さないだけ）

  if (t.length > 500) return { ok: false, reason: 'URLが長すぎます' }

  let u: URL
  try {
    u = new URL(t)
  } catch {
    return { ok: false, reason: 'URLの形式が正しくありません（https:// から始まる形で入力してください）' }
  }

  // ⚠️ javascript: / data: / vbscript: などを確実に弾く。
  //    「http以外を拒否」ではなく「httpsだけを許可」と書くこと。
  if (u.protocol !== 'https:') {
    return { ok: false, reason: 'https:// から始まるURLのみ設定できます' }
  }
  // 認証情報つきURL（https://user:pass@evil.example）は紛らわしいので拒否する
  if (u.username || u.password) {
    return { ok: false, reason: 'ユーザー名・パスワードを含むURLは設定できません' }
  }
  if (!u.hostname || !u.hostname.includes('.')) {
    return { ok: false, reason: 'ホスト名が正しくありません' }
  }

  return { ok: true, url: u.toString() }
}

/** ボタン文言を整える（改行やタグを持ち込ませない） */
export function normalizeSchedulingLabel(raw: unknown): string | null {
  const t = String(raw ?? '').replace(/[\r\n\t]/g, ' ').trim()
  if (!t) return null
  return t.slice(0, 40)
}
