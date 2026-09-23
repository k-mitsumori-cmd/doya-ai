import { OPS_SERVICES, type ServiceKey } from './service-operations-data';
import { readOps, writeOps, sendOps } from './service-operations-state';
// Only explicitly registered direct public landing URLs; tracking redirects must never be followed.
const allowedHosts = new Set(['game.surisuta.jp', 'doya-ai.surisuta.jp', 'mitsumoritravel.surisuta.jp', 'www.jalan.net', 'travel.rakuten.co.jp']);
export function safeLandingUrl(raw: string): boolean {
  try { const u = new URL(raw); return u.protocol === 'https:' && !u.username && !u.password && !u.port && !u.search && !u.hash && allowedHosts.has(u.hostname); } catch { return false; }
}
export async function checkServiceLinks(service: ServiceKey, dry = false): Promise<string[]> {
  const configured = await readOps<{ label: string; url: string }[]>('landing-links:' + service);
  const links = configured || [{ label: '公式ページ', url: OPS_SERVICES.find(s => s.key === service)!.path }];
  const lines: string[] = [];
  for (const link of links) {
    if (!safeLandingUrl(link.url)) { lines.push(`${link.label}：安全に確認できる直接URLの登録待ち`); continue; }
    let state = 'unavailable';
    try { const r = await fetch(link.url, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(8000) }); state = r.ok ? 'ok' : r.status >= 300 && r.status < 400 ? 'redirect' : String(r.status); } catch {}
    lines.push(`${link.label}：${state === 'ok' ? 'HTTP応答あり' : state === 'redirect' ? '転送先の確認が必要' : '要確認（' + state + '）'}`);
    if (!dry) {
      const previous = await readOps<{ state: string }>('link:' + service + ':' + link.label);
      if (state !== 'ok' && state !== 'redirect' && previous?.state !== state) await sendOps(service, `【リンク・要確認】${link.label}に接続できなかったよ\n確認先：${link.url}\n確認結果：${state}\nサイトがHEAD接続を拒否している場合もあります。通常のブラウザーで確認してね。`, `link:${service}:${link.label}:${state}:${new Date().toISOString().slice(0,10)}`, 'error');
      await writeOps('link:' + service + ':' + link.label, { state, at: new Date().toISOString() });
    }
  }
  return [...lines, configured ? '計測用リンクは自動クリックしていないよ。申込受付・販売終了の判定は別途確認が必要です。' : '紹介先の直接URL一覧は未登録。公式ページの接続だけを確認し、計測用リンクはクリックしていません。'];
}
