// ============================================
// フラグ ui.shell.<svc>（共通シェルへの載せ替え）
// ============================================
// 環境変数 UI_SHELL_SERVICES にサービス id をカンマ区切りで書くと、そのツールが AppShell＋ToolFrame で表示される。
//   例) UI_SHELL_SERVICES=quote,shodan   /   UI_SHELL_SERVICES=all（全ツール）
// ⚠️ 既定は OFF（未設定なら従来のレイアウトのまま）。戻すときは値から id を消すだけ（データは一切変わらない）。
// ⚠️ サーバー側（layout.tsx）で読むこと。クライアントに出す必要はない。
// 仕様: README §18.6 手順 1・5
export function isShellEnabled(serviceId: string, raw: string | undefined = process.env.UI_SHELL_SERVICES): boolean {
  const ids = (raw ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  return ids.includes('all') || ids.includes(serviceId.toLowerCase())
}

/**
 * UI_SHELL_SERVICES に書かれた id の一覧（小文字）。共通の枠（src/app/(shell)/layout.tsx）がクライアントに渡す。
 * ⚠️ 返すのはツールの id だけ。ほかの環境変数は渡さない。
 */
export function shellEnabledIds(raw: string | undefined = process.env.UI_SHELL_SERVICES): string[] {
  return (raw ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}
