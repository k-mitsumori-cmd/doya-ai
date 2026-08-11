import { loadEnv } from './_env'
loadEnv()
import { SERVICES } from '../src/lib/services'

const EXCLUDED_PREFIXES = ['/m/', '/mensetsu/live/', '/admin', '/auth', '/api']
function serviceIdFromPath(pathname: string): string | null {
  const seg = pathname.split('/').filter(Boolean)[0]
  if (!seg) return null
  const hit = SERVICES.find((s) => s.href === `/${seg}`)
  return hit ? hit.id : null
}
function willShow(p: string): string | null {
  if (EXCLUDED_PREFIXES.some((x) => p.startsWith(x))) return null
  return serviceIdFromPath(p)
}

let ng = 0
const chk = (n: string, ok: boolean, d = '') => { if (!ok) ng++; console.log(`  ${ok ? 'OK  ' : '*** NG'} ${n}${d ? ` — ${d}` : ''}`) }

console.log('=== 第三者が開く画面には絶対に出さない ===')
chk('商談ルーム /m/xxx（見込み客）', willShow('/m/abc123') === null)
chk('面接本番 /mensetsu/live/xxx（応募者）', willShow('/mensetsu/live/tok') === null)
chk('招待受諾 /quote/invite/xxx', willShow('/quote/invite/tok') === 'quote', '※ ログイン者向けなので出てよい')
chk('管理画面 /admin', willShow('/admin/users') === null)
chk('ログイン /auth', willShow('/auth/signin') === null)
chk('API', willShow('/api/quote/documents') === null)

console.log('\n=== サービス画面では出る ===')
for (const [p, want] of [['/quote', 'quote'], ['/quote/documents/abc', 'quote'], ['/aishodan', 'aishodan'],
  ['/aishodan/sessions/x', 'aishodan'], ['/adimage', 'adimage'], ['/mensetsu', 'mensetsu'],
  ['/seo/articles', 'seo'], ['/banner', 'banner']] as [string,string][]) {
  chk(`${p} → ${want}`, willShow(p) === want, String(willShow(p)))
}

console.log('\n=== サービスでない画面では出ない ===')
for (const p of ['/', '/pricing', '/terms', '/media/some-article', '/unknown-page']) {
  chk(`${p} は出ない`, willShow(p) === null, String(willShow(p)))
}

console.log('\n=== 全サービスのトップで判定できるか ===')
const missed = SERVICES.filter((s) => willShow(s.href) !== s.id).map((s) => `${s.id}(${s.href})`)
chk('全サービスで正しく判定', missed.length === 0, missed.length ? missed.join(', ') : `${SERVICES.length}件すべてOK`)

console.log(ng === 0 ? '\n結果: 全ケース期待どおり' : `\n結果: *** ${ng}件 期待外れ ***`)
