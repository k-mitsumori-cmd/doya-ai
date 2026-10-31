// Codex内蔵の画像生成で作った静的OGP（public/ogp/<id>.jpg・1200x630）。
// ポータルは SaaSクマ＋ドヤッピー、各サービスはサービス別の SaaSクマ。
// ⚠️ ここに id を足すのは public/ogp/<id>.jpg を置いてから（無いと OGP が 404 になる）。
//    載っていない id は従来どおり /og/<id> の動的生成にフォールバックする。
import { isBrandRenamed } from './brand'

export const STATIC_OGP_IDS = new Set([
  'portal',
  'banner', 'seo', 'interview', 'persona', 'hr', 'kintai', 'doyalist', 'doyaslide',
  'cunning', 'promane', 'sfa', 'shodan', 'aio', 'mensetsu', 'quote', 'aishodan', 'adimage',
  'asklink',
  'popup',
  'tenjikai',
  'shanai',
])

export function staticOgpPath(id: string): string | null {
  if (!STATIC_OGP_IDS.has(id)) return null
  // 旗 NEXT_PUBLIC_BRAND_RENAME_ROLLOUT=all のときは、ドヤバディの新ロゴの OGP（public/ogp-buddy/）を出す。off の間は今の画像のまま。
  return isBrandRenamed() ? `/ogp-buddy/${id}.jpg` : `/ogp/${id}.jpg`
}
