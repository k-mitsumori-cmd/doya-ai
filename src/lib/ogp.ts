// Codex内蔵の画像生成で作った静的OGP（public/ogp/<id>.jpg・1200x630）。
// ポータルは SaaSクマ＋ドヤッピー、各サービスはサービス別の SaaSクマ。
// ⚠️ ここに id を足すのは public/ogp/<id>.jpg を置いてから（無いと OGP が 404 になる）。
//    載っていない id は従来どおり /og/<id> の動的生成にフォールバックする。
export const STATIC_OGP_IDS = new Set([
  'portal',
  'banner', 'seo', 'interview', 'persona', 'hr', 'kintai', 'doyalist', 'doyaslide',
  'cunning', 'promane', 'sfa', 'shodan', 'aio', 'mensetsu', 'quote', 'aishodan', 'adimage',
  'asklink',
  'tenjikai',
])

export function staticOgpPath(id: string): string | null {
  return STATIC_OGP_IDS.has(id) ? `/ogp/${id}.jpg` : null
}
