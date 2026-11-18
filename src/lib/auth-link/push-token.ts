/**
 * Expo のプッシュトークンの形の検証（純粋関数）。設計: docs/architecture/2026-11-18-app/push-design.md。
 * 形は ExponentPushToken[xxxx] または ExpoPushToken[xxxx]。中身は英数字と「-」「_」。
 * トークンは端末を指す値で、ログ・URL・エラーの本文に出さない。
 */
const EXPO_PUSH_TOKEN = /^(?:Exponent|Expo)PushToken\[[A-Za-z0-9_-]{8,200}\]$/

export function isValidExpoPushToken(v: unknown): v is string {
  return typeof v === 'string' && v.length <= 256 && EXPO_PUSH_TOKEN.test(v)
}
