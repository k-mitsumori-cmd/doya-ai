// ============================================
// ドヤ社内インタビュー アンケートURLのトークン
// ============================================
// ⚠️ 推測できない値にする。cuid は時刻と連番を含み、総当たりの手がかりになるため使わない。
//    URL を知っていれば誰でも回答を読み書きできるので、CSPRNG の 192 ビットにする。
import { randomBytes } from 'node:crypto'

export function newSurveyToken(): string {
  return randomBytes(24).toString('base64url') // 32文字
}

export function isSurveyToken(token: unknown): token is string {
  return typeof token === 'string' && /^[A-Za-z0-9_-]{32}$/.test(token)
}
