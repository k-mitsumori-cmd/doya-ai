// ============================================
// Site Icon (App Router) — ドヤマーケAI 公式ブランドアイコン
// ============================================
// 素材の正本: reference/generated-assets/2026-08-19-p0-v1/brand-icon/master.svg
// Apple touch icon（180px）
// ⚠️ 旧版は next/og で「青角丸＋ロケット＋AI」を動的生成していたが、
//    ロケットの図形が分断して破片状にレンダリングされる不具合があったため、
//    検品済みPNG（icon-180.png）をそのまま返す方式に変更した。
//    差し替える時は master.svg から書き出し直し、このBase64を入れ替えること。
//    旧実装は reference/generated-assets/2026-08-19-p0-v1/legacy/ に保存。

export const runtime = 'edge'

export const size = {
  width: 180,
  height: 180,
}

export const contentType = 'image/png'

const PNG_BASE64 =
  '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'

export default function Icon() {
  const binary = atob(PNG_BASE64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

  return new Response(bytes, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
