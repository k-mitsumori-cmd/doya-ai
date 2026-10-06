// ドヤマーケ ナーチャリング：YouTube動画を紹介するステップメールの HTML を組み立てる。
// 既存12通（gen_nurture.py 製）と同じ見た目・同じ署名にそろえてある。
// 使い道: scripts/drip/append-video-steps.mjs（初回の一括投入とスタジオからの追加の両方）

export const SITE = 'https://doya-ai.surisuta.jp'
export const CONSULT_URL = 'https://doyamarke.surisuta.jp/download/base02_doyamarke-free-1'
export const LINE_URL = 'https://lin.ee/7KWNULn'

// サービス紹介GIF（public/drip/nurture/gif/<id>.gif）。元は doyamarke-remotion-videos の pivot-search-v7
export const SERVICES = {
  banner: { name: 'ドヤバナーAI', path: '/banner' },
  seo: { name: 'ドヤライティングAI', path: '/seo' },
  interview: { name: 'ドヤインタビューAI', path: '/interview' },
  persona: { name: 'ドヤペルソナAI', path: '/persona' },
  hr: { name: 'ドヤHR', path: '/hr' },
  kintai: { name: 'ドヤ勤怠', path: '/kintai' },
  doyalist: { name: 'ドヤリスト', path: '/doyalist' },
  promane: { name: 'ドヤプロマネ', path: '/promane' },
  doyaslide: { name: 'ドヤスライド', path: '/doyaslide' },
  cunning: { name: 'ドヤカンニングAI', path: '/cunning' },
  sfa: { name: 'ドヤSFA', path: '/sfa' },
  shodan: { name: 'ドヤ商談準備', path: '/shodan' },
  aio: { name: 'ドヤAIO', path: '/aio' },
  mensetsu: { name: 'ドヤ面接官', path: '/mensetsu' },
  quote: { name: 'ドヤ見積もりAI', path: '/quote' },
  aishodan: { name: 'ドヤAI商談', path: '/aishodan' },
  adimage: { name: 'ドヤ広告画像AI', path: '/adimage' },
}

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const TEXT = 'font-size:14.5px;line-height:1.85;color:#33415c;'
const row = (inner, pad = '6px 28px') => `<tr><td style="padding:${pad};">${inner}</td></tr>\n`
const p = (t, weight = 400) => row(`<div style="${TEXT}font-weight:${weight};">${t}</div>`)
const rule = () => row('<div style="border-top:1px solid #e6ebf2;"></div>')
const heading = (badge, title) =>
  row(
    `<div style="display:inline-block;background:#eaf1ff;color:#0066ff;font-size:12px;font-weight:700;padding:4px 10px;border-radius:999px;margin-bottom:8px;">${esc(badge)}</div><div style="font-size:17px;font-weight:700;color:#14213d;line-height:1.5;">${esc(title)}</div>`,
    '20px 28px 6px',
  )
const button = (href, label) =>
  `<tr><td style="padding:10px 28px 18px;" align="center"><a href="${esc(href)}" style="display:inline-block;background:#0066ff;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 26px;border-radius:8px;">${esc(label)}</a></td></tr>\n`
const subButton = (href, label) =>
  `<tr><td style="padding:2px 28px 16px;" align="center"><a href="${esc(href)}" style="display:inline-block;background:#ffffff;color:#0066ff;text-decoration:none;font-weight:700;font-size:14px;padding:11px 22px;border-radius:8px;border:1.5px solid #0066ff;">${esc(label)}</a></td></tr>\n`
const linkedImage = (href, src, alt, caption) =>
  `<tr><td style="padding:14px 28px 4px;" align="center"><a href="${esc(href)}" style="text-decoration:none;"><img src="${esc(src)}" width="544" style="width:100%;max-width:544px;height:auto;border-radius:10px;border:1px solid #eef1f6;display:block;" alt="${esc(alt)}"></a></td></tr>\n` +
  (caption ? `<tr><td style="padding:0 28px 10px;" align="center"><div style="font-size:12px;color:#9aa4b2;">${esc(caption)}</div></td></tr>\n` : '')

export const youtubeUrl = (id) => `https://www.youtube.com/watch?v=${id}`
export const thumbUrl = (id, quality = 'maxresdefault') => `https://i.ytimg.com/vi/${id}/${quality}.jpg`

// 既存メールにも差し込む、サービス画面のGIFブロック
export function serviceGifBlock(serviceId, caption) {
  const s = SERVICES[serviceId]
  if (!s) throw new Error(`unknown service: ${serviceId}`)
  return linkedImage(
    SITE + s.path,
    `${SITE}/drip/nurture/gif/${serviceId}.gif`,
    `${s.name}の実際の画面`,
    caption || `${s.name}の実際の画面（クリックで開きます）`,
  )
}

const HEAD = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f4f6fb;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:24px 0;"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e9edf5;"><tr><td style="background:#0066ff;height:6px;line-height:6px;font-size:6px;">&nbsp;</td></tr><tr><td style="background:#ffffff;padding:22px 28px 16px;border-bottom:1px solid #eef1f6;" align="center"><img src="${SITE}/drip/nurture/doyamarke-logo.png" width="300" alt="ドヤマーケ｜Marketing × AI" style="width:300px;max-width:80%;height:auto;display:block;border:0;"></td></tr>\n`

const FOOT =
  p('最後までお読みいただき、ありがとうございました。') +
  p('ドヤマーケ編集部　三森（ミツモリ）') +
  p('株式会社スリスタ') +
  p('ドヤマーケAI：https://doya-ai.surisuta.jp/　／　ドヤマーケ（実行支援）：https://doyamarke.surisuta.jp/lp/doyamarke') +
  `<tr><td style="padding:4px 28px;"><div style="font-size:12px;color:#9aa4b2;">※本メールはドヤマーケAIにご登録いただいた方へお送りしています。</div></td></tr><tr><td style="padding:18px 28px 26px;"><div style="border-top:1px solid #eef1f6;"></div></td></tr></table></td></tr></table></body></html>`

/**
 * entry:
 *  kind: 'video' | 'service' | 'digest'
 *  subject, intro, title(見出し), lead[], points[], youtubeId, minutes, channel('doyamarke'|'saas'),
 *  service?: { id, text[] , cta? }, line?: { keyword, what }, outro?, thumbQuality?
 *  digest: videos: [{ youtubeId, title, note }]
 */
export function renderVideoEmail(entry) {
  let h = HEAD + rule()
  h += p('{{user_name}}様', 700)
  h += p('ドヤマーケの三森です。')
  for (const t of entry.intro || []) h += p(esc(t))
  h += rule()

  if (entry.kind === 'video') {
    const chName = entry.channel === 'saas' ? 'SaaSは死にましぇん' : 'ドヤマーケAI'
    h += heading(entry.channel === 'saas' ? '開発してみた動画' : '今回の動画', entry.title)
    for (const t of entry.lead || []) h += p(esc(t))
    h += linkedImage(
      youtubeUrl(entry.youtubeId),
      thumbUrl(entry.youtubeId, entry.thumbQuality),
      entry.title,
      `YouTube「${chName}」チャンネル${entry.minutes ? `｜約${entry.minutes}分` : ''}（画像をクリックで再生）`,
    )
    if (entry.points?.length) {
      h += p('この動画でわかること', 700)
      for (const t of entry.points) h += p('・' + esc(t))
    }
    h += button(youtubeUrl(entry.youtubeId), 'YouTubeで動画を見る')
  }

  if (entry.kind === 'digest') {
    h += heading('1分で見られるショート動画', entry.title)
    for (const t of entry.lead || []) h += p(esc(t))
    for (const v of entry.videos) {
      h += `<tr><td style="padding:8px 28px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td width="110" valign="top"><a href="${esc(youtubeUrl(v.youtubeId))}"><img src="${esc(thumbUrl(v.youtubeId, 'hqdefault'))}" width="100" style="width:100px;height:auto;border-radius:8px;display:block;border:1px solid #eef1f6;" alt=""></a></td><td valign="top" style="padding-left:12px;"><a href="${esc(youtubeUrl(v.youtubeId))}" style="font-size:14.5px;font-weight:700;color:#14213d;text-decoration:none;line-height:1.6;">${esc(v.title)}</a><div style="${TEXT}font-size:13.5px;">${esc(v.note || '')}</div></td></tr></table></td></tr>\n`
    }
  }

  if (entry.line) {
    h += p(
      `この動画の内容は資料にまとめています。<a href="${LINE_URL}" style="color:#0066ff;font-weight:700;">ドヤマーケ公式LINE</a>を友だち追加して「${esc(entry.line.keyword)}」と送ると、${esc(entry.line.what || '資料')}を受け取れます。`,
    )
    h += subButton(LINE_URL, `公式LINEで「${entry.line.keyword}」と送る`)
  }

  if (entry.service) {
    const s = SERVICES[entry.service.id]
    h += rule()
    h += heading('ツールを使いこなす', entry.service.title || `${s.name}の実際の画面`)
    for (const t of entry.service.text || []) h += p(esc(t))
    h += serviceGifBlock(entry.service.id)
    h += button(SITE + s.path, entry.service.cta || `${s.name}を試す（プロプランは30日間無料）`)
  }

  h += rule()
  if (entry.consult) {
    h += heading('AIマーケチームの作り方', entry.consult.title)
    for (const t of entry.consult.text || []) h += p(esc(t))
    h += button(CONSULT_URL, entry.consult.cta || '自社に合う進め方を無料相談する')
    h += rule()
  }
  for (const t of entry.outro || []) h += p(esc(t))
  h += FOOT
  return h
}

export function renderText(entry) {
  const lines = ['{{user_name}}様', '', 'ドヤマーケの三森です。', ...(entry.intro || []), '', entry.title, ...(entry.lead || [])]
  if (entry.youtubeId) lines.push('', '動画はこちら：' + youtubeUrl(entry.youtubeId))
  for (const v of entry.videos || []) lines.push(`・${v.title} ${youtubeUrl(v.youtubeId)}`)
  if (entry.service) lines.push('', `${SERVICES[entry.service.id].name}：${SITE}${SERVICES[entry.service.id].path}`)
  lines.push('', '無料相談：' + CONSULT_URL, '', 'ドヤマーケ編集部　三森（ミツモリ）', '株式会社スリスタ')
  return lines.join('\n')
}
