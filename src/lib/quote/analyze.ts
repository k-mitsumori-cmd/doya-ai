// ============================================
// ドヤ見積もりAI 商材解析＋品目候補生成
// ============================================
// URL → その会社が「何を・どう課金して売っているか」を読み取り、
// 見積書の品目候補と金額を出す。
//
// ⚠️ 最重要の設計判断: **金額の出所を4層の優先順位で決める。**
//   1. 自社サイトに書かれた公開価格   → own_price（最も強い根拠）
//   2. 相場マスタ（自社調査の一次情報）→ market
//   3. 競合の公開価格                 → competitor
//   4. どれも無い                     → unknown（「要見積」として空欄）
//
// ⚠️ **LLMの内部知識だけで金額を出すことは禁止。** 見積書は取引の意思表示であり、
//    もっともらしいだけの数字を印字させると実害になる。根拠が無いものは空欄にする。
import { safeFetchText, htmlToText } from '@/lib/net/safe-fetch'
import { geminiGenerateJson, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
import { lookupMarket, marketTableForPrompt } from './market'
import type { ProductProfile, SuggestedItem, PriceSource } from './types'

const PRICE_HINTS = ['/price', '/pricing', '/plan', '/plans', '/service', '/services', '/lp', '/about']
const MAX_PAGES = 5
const MAX_CHARS_PER_PAGE = 8000
const MAX_TOTAL_CHARS = 22000

function extractTitle(html: string): string | undefined {
  const og = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i)
  if (og?.[1]) return og[1].trim()
  const t = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  if (t?.[1]) return t[1].trim()
  return undefined
}

/** 料金ページを優先的に集める（見積もりは価格情報が命） */
async function collectPages(sourceUrl: string): Promise<{ text: string; siteName?: string }> {
  const base = new URL(sourceUrl)
  const parts: string[] = []
  let siteName: string | undefined

  const topHtml = await safeFetchText(base.toString()).catch(() => '')
  if (topHtml) {
    siteName = extractTitle(topHtml)
    parts.push(`【${base.toString()}】\n${htmlToText(topHtml).slice(0, MAX_CHARS_PER_PAGE)}`)
  }

  const paths = new Set<string>()
  if (topHtml) {
    const re = /href=["'](\/[^"'#?]*)/gi
    let m: RegExpExecArray | null
    while ((m = re.exec(topHtml)) !== null) {
      const path = m[1]
      if (PRICE_HINTS.some((h) => path.toLowerCase().startsWith(h))) paths.add(path)
      if (paths.size >= 20) break
    }
  }
  // 料金系を先頭に寄せる（文字数上限で切られても価格が残るように）
  const ordered = Array.from(paths).sort((a, b) => {
    const pa = /price|pricing|plan/i.test(a) ? 0 : 1
    const pb = /price|pricing|plan/i.test(b) ? 0 : 1
    return pa - pb
  })

  let total = parts.join('').length
  for (const path of ordered) {
    if (parts.length >= MAX_PAGES || total >= MAX_TOTAL_CHARS) break
    const url = new URL(path, base).toString()
    const html = await safeFetchText(url).catch(() => '')
    if (!html) continue
    const text = htmlToText(html).slice(0, MAX_CHARS_PER_PAGE)
    if (text.length < 200) continue
    parts.push(`【${url}】\n${text}`)
    total += text.length
  }

  return { text: parts.join('\n\n').slice(0, MAX_TOTAL_CHARS), siteName }
}

export async function analyzeProduct(sourceUrl: string): Promise<ProductProfile> {
  const { text, siteName } = await collectPages(sourceUrl)
  if (!text || text.length < 200) {
    throw new Error('サイトの内容を読み取れませんでした。URLをご確認ください。')
  }

  const prompt = [
    'あなたは法人向けサービスの提案を組み立てるプロです。',
    '以下のWebサイトの内容から、この会社が「何を・どういう課金の形で」売っているかを読み取ってください。',
    '',
    '【重要な制約】',
    '- publishedPrices には、**サイトに実際に書かれていた金額のみ**を書き写してください。',
    '  推測した金額・一般的な相場・あなたが知っている他社の金額を混ぜてはいけません。',
    '- 金額の記載が一切無ければ publishedPrices は空配列にしてください。空にすることを恐れないでください。',
    '- 金額を書き写すときは「月額50,000円（スタンダードプラン）」のように、何の金額かが分かる形にしてください。',
    '',
    '【出力するJSONの形式】',
    '{',
    '  "companyName": "会社名",',
    '  "summary": "何を提供しているか（150字程度）",',
    '  "deliveryModel": "SaaS / 受託制作 / 運用代行 / コンサル / スポット のいずれか近いもの",',
    '  "pricingAxis": "何を単位に課金しているか（月額 / 制作物単位 / 人数 / 工数 など）",',
    '  "targetCustomer": "想定顧客",',
    '  "publishedPrices": ["サイトに書かれていた金額（無ければ空配列）"],',
    '  "optionCandidates": ["見積書の品目になりそうなオプションや付帯サービス"]',
    '}',
    '',
    '【サイトの内容】',
    text,
  ].join('\n')

  const raw = await geminiGenerateJson<ProductProfile>({ prompt, model: GEMINI_TEXT_MODEL_DEFAULT }, 'QuoteProduct')

  return {
    companyName: String(raw?.companyName || siteName || '').slice(0, 120) || undefined,
    summary: String(raw?.summary || '').slice(0, 600) || undefined,
    deliveryModel: String(raw?.deliveryModel || '').slice(0, 60) || undefined,
    pricingAxis: String(raw?.pricingAxis || '').slice(0, 60) || undefined,
    targetCustomer: String(raw?.targetCustomer || '').slice(0, 200) || undefined,
    publishedPrices: (raw?.publishedPrices || []).filter((s) => typeof s === 'string').slice(0, 20),
    optionCandidates: (raw?.optionCandidates || []).filter((s) => typeof s === 'string').slice(0, 20),
  }
}

export interface SuggestInput {
  profile: ProductProfile
  productName: string
  /** 商談相手の状況・要望（あれば精度が上がる） */
  situation?: string
  /** 想定予算（円）。あれば構成を寄せる */
  budget?: number | null
}

/** 見積書の品目候補を出す */
export async function suggestItems(input: SuggestInput): Promise<SuggestedItem[]> {
  const { profile, productName, situation, budget } = input
  const published = (profile.publishedPrices || []).join('\n') || '（サイトに価格の記載なし）'

  const prompt = [
    'あなたは法人向けの見積書を作るプロです。以下の商材について、見積書に載せる品目を6〜10件提案してください。',
    '',
    '【金額の決め方】',
    '金額は必ず次の優先順位で決め、どこから取ったかを priceSource に記録してください。',
    '  1. own_price   … 下の「自社の公開価格」に書かれている金額をそのまま使う（最優先）',
    '  2. market      … 下の「相場データ」の範囲内から選ぶ（rangeMin/rangeMax も必ず埋める）',
    '  3. ai_estimate … 上のどちらにも該当が無い品目。**算出の根拠を示したうえで金額を入れる**',
    '',
    '**すべての品目に金額を入れてください。空欄（null）にしないでください。**',
    'ただし ai_estimate では、数字を思いつきで書かず、必ず積算の過程を sourceRef に書くこと。',
    '根拠の書けない金額は出さないでください（その場合だけ unknown / null が許されます）。',
    '',
    '【sourceRef の書き方】',
    '- own_price なら「サイト記載: 月額50,000円（スタンダードプラン）」のように引用する',
    '- market なら「相場: SEOコンサルティング 15〜50万円/月」のように書く',
    '- ai_estimate なら**どう積算したかを必ず書く**。例:',
    '    「作業3人日 × 8万円/人日 = 24万円」',
    '    「類似のサイト内部診断（20〜80万円）から、対象30ページ規模として35万円」',
    '    「初期設定2人日＋教育1人日 = 3人日 × 7万円 = 21万円」',
    '- 「一般的な相場から」「経験上」のような、検証できない書き方は禁止',
    '',
    '【構成の作り方】',
    '- 初期費用・月額・オプションが混ざるなら、その順に並べる',
    '- 継続課金の品目は unit を「月」にし、qty に契約月数を入れる（例: 6ヶ月契約なら qty=6）',
    '- 値引き行は作らない（値引きは見積書側の機能で扱う）',
    '- taxRate は原則10。軽減税率対象でなければ10のまま',
    '',
    '【出力するJSONの形式】',
    '{ "items": [',
    '  { "itemName": "品目名", "spec": "内訳・含まれるもの（80字程度）", "qty": 1, "unit": "式",',
    '    "unitPrice": 300000, "taxRate": 10, "priceSource": "own_price",',
    '    "sourceRef": "根拠", "rangeMin": null, "rangeMax": null }',
    '] }',
    '',
    `【商材】${productName}`,
    profile.summary ? `概要: ${profile.summary}` : '',
    profile.deliveryModel ? `提供形態: ${profile.deliveryModel}` : '',
    profile.pricingAxis ? `課金軸: ${profile.pricingAxis}` : '',
    profile.optionCandidates?.length ? `付帯サービス候補: ${profile.optionCandidates.join(' / ')}` : '',
    '',
    '【自社の公開価格】',
    published,
    '',
    '【相場データ（自社調査の一次情報。これ以外の相場を使わないこと）】',
    marketTableForPrompt(),
    '',
    situation ? `【商談相手の状況】\n${situation}` : '',
    budget ? `【想定予算】${budget.toLocaleString()}円。この範囲に収まる構成を優先してください` : '',
  ]
    .filter(Boolean)
    .join('\n')

  const raw = await geminiGenerateJson<{ items: SuggestedItem[] }>(
    { prompt, model: GEMINI_TEXT_MODEL_DEFAULT },
    'QuoteItems'
  )

  return (raw?.items || [])
    .filter((i) => i && i.itemName)
    .slice(0, 15)
    .map(normalizeItem)
}

/**
 * モデルが返した1品目を、画面とPDFが前提にしている形に正規化する。
 * ⚠️ suggestItems（一括生成）と estimateItem（1行だけAIで埋める）で必ず同じものを通すこと。
 *    片方だけ直すと、同じ画面の行なのに金額の出所の扱いが食い違う。
 */
function normalizeItem(i: any): SuggestedItem {
  const valid: PriceSource[] = ['own_price', 'market', 'competitor', 'manual', 'ai_estimate', 'unknown']

  let priceSource: PriceSource = valid.includes(i.priceSource) ? i.priceSource : 'unknown'
  let unitPrice = Number.isFinite(Number(i.unitPrice)) ? Math.max(0, Math.round(Number(i.unitPrice))) : null
  let rangeMin = Number.isFinite(Number(i.rangeMin)) ? Math.round(Number(i.rangeMin)) : null
  let rangeMax = Number.isFinite(Number(i.rangeMax)) ? Math.round(Number(i.rangeMax)) : null
  let sourceRef = String(i.sourceRef || '').slice(0, 300)

  // --- 生成後の安全網 ---
  // プロンプトで禁じても、モデルは「空欄で出す」より「それらしい数字を埋める」方へ倒れる。
  // 実際に mensetsu の分岐分類器でも同じ挙動を確認している。
  // そこで market を名乗る金額は相場表と突き合わせ、範囲外なら根拠なしとみなす。
  if (priceSource === 'market') {
    const m = lookupMarket(i.itemName)
    if (!m) {
      // 相場表に該当が無いのに market を名乗っている。
      // ⚠️ 以前はここで金額を捨てて「要見積」にしていたが、空欄だらけで使えないという
      //    実際の声を受けて、AIの積算として残す方針に変えた（2026-08-19）。
      //    相場データを引いたわけではないので、ラベルは必ず ai_estimate に落とす。
      priceSource = 'ai_estimate'
      rangeMin = rangeMax = null
      if (!sourceRef || /相場/.test(sourceRef)) {
        sourceRef = 'AIの積算（相場データに該当なし）'
      }
    } else {
      rangeMin = m.min
      rangeMax = m.max
      if (unitPrice != null && (unitPrice < m.min * 0.5 || unitPrice > m.max * 2)) {
        // 相場から大きく外れた数字は採用せず、範囲の中央値に寄せる
        unitPrice = Math.round((m.min + m.max) / 2)
      }
      // ⚠️ 根拠の文言は、実際に採用した相場エントリから作り直す。
      //    モデルが書いた根拠をそのまま残すと、引き当てた相場と別のものを
      //    引用してしまい（例: 根拠は「LLMO 15〜50万」なのに表示範囲は「コンサル 20〜100万」）、
      //    画面上で根拠と数字が食い違う。見積書では致命的。
      sourceRef = `相場: ${m.itemName} ${m.min.toLocaleString()}〜${m.max.toLocaleString()}円/${m.unit}（出典: ${m.source}）`
    }
  }
  // ⚠️ unknown でも金額と根拠が揃っていれば、捨てずに AI推定として残す。
  //    金額が無い／根拠が無いものだけを「要見積」として空欄にする。
  if (priceSource === 'unknown') {
    if (unitPrice != null && unitPrice > 0 && sourceRef && sourceRef.trim().length >= 6) {
      priceSource = 'ai_estimate'
    } else {
      unitPrice = null
    }
  }
  // ⚠️ ai_estimate で根拠が無い／薄いものは、数字だけが独り歩きするので採用しない
  if (priceSource === 'ai_estimate' && (!sourceRef || sourceRef.trim().length < 6)) {
    priceSource = 'unknown'
    unitPrice = null
  }

  // ⚠️ 相場以外の行に範囲を残さない。モデルは range に 0 を入れてくるため、
  //    そのままだと画面に「相場 ¥0〜¥0」と表示される。
  if (priceSource !== 'market' || !rangeMin || !rangeMax) {
    rangeMin = priceSource === 'market' ? rangeMin : null
    rangeMax = priceSource === 'market' ? rangeMax : null
  }
  if (rangeMin != null && rangeMin <= 0) rangeMin = null
  if (rangeMax != null && rangeMax <= 0) rangeMax = null

  return {
    itemName: String(i.itemName).slice(0, 120),
    spec: String(i.spec || '').slice(0, 300),
    qty: Number.isFinite(Number(i.qty)) ? Math.max(1, Math.round(Number(i.qty))) : 1,
    unit: String(i.unit || '式').slice(0, 12),
    unitPrice,
    taxRate: Number(i.taxRate) === 8 ? 8 : 10,
    priceSource,
    sourceRef,
    rangeMin,
    rangeMax,
  }
    return {
      itemName: String(i.itemName).slice(0, 120),
      spec: String(i.spec || '').slice(0, 300),
      qty: Number.isFinite(Number(i.qty)) ? Math.max(1, Math.round(Number(i.qty))) : 1,
      unit: String(i.unit || '式').slice(0, 12),
      unitPrice,
      taxRate: Number(i.taxRate) === 8 ? 8 : 10,
      priceSource,
      sourceRef,
      rangeMin,
      rangeMax,
    }
  }



// ============================================
// 品目名だけから、その1行の内訳・数量・単価をAIで埋める
// ============================================
// 画面の「内容を調整する」で、人が品目名を打った直後に押すボタン用。
// ⚠️ suggestItems と同じ4層の優先順位・同じ normalizeItem を通す。
//    ここだけ緩めると、同じ表の中に根拠のない金額が混ざる。
export interface EstimateItemInput {
  itemName: string
  /** 既に入っている内訳。空でなければ尊重して膨らませる */
  spec?: string
  /** 商材の文脈（あれば精度が上がる。無くても動く） */
  productName?: string
  profile?: ProductProfile | null
}

export async function estimateItem(input: EstimateItemInput): Promise<SuggestedItem> {
  const { itemName, spec, productName, profile } = input
  const published = (profile?.publishedPrices || []).join('\n') || '（サイトに価格の記載なし）'

  const prompt = [
    'あなたは法人向けの見積書を作るプロです。以下の「品目名」1件について、',
    '見積書に載せる内訳・数量・単位・単価を1件だけ決めてください。',
    '',
    '【金額の決め方】',
    '次の優先順位で決め、どこから取ったかを priceSource に記録してください。',
    '  1. own_price   … 下の「自社の公開価格」に該当があればそのまま使う（最優先）',
    '  2. market      … 下の「相場データ」の範囲内から選ぶ（rangeMin/rangeMax も埋める）',
    '  3. ai_estimate … 上のどちらにも該当が無い場合。**積算の過程を sourceRef に必ず書く**',
    '',
    '【sourceRef の書き方】',
    '- own_price なら「サイト記載: 月額50,000円（スタンダードプラン）」のように引用する',
    '- market なら「相場: SEOコンサルティング 15〜50万円/月」のように書く',
    '- ai_estimate なら**どう積算したかを必ず書く**。例「作業3人日 × 8万円/人日 = 24万円」',
    '- 「一般的な相場から」「経験上」のような、検証できない書き方は禁止',
    '- 根拠が書けないなら priceSource を unknown にし、unitPrice を null にする',
    '',
    '【数量・単位の決め方】',
    '- 継続課金なら unit を「月」にし、qty に妥当な契約月数を入れる（例: 6）',
    '- 一括なら unit は「式」、qty は 1',
    '- ページ数・人数のように数えられるものは、その単位と妥当な数を入れる',
    '',
    '【出力するJSONの形式（1件だけ）】',
    '{ "itemName": "品目名", "spec": "内訳・含まれるもの（80字程度）", "qty": 1, "unit": "式",',
    '  "unitPrice": 300000, "taxRate": 10, "priceSource": "market",',
    '  "sourceRef": "根拠", "rangeMin": null, "rangeMax": null }',
    '',
    `【品目名】${itemName}`,
    spec ? `【すでに入力されている内訳】${spec}\n（この内容を尊重して具体化してください）` : '',
    productName ? `【商材】${productName}` : '',
    profile?.summary ? `概要: ${profile.summary}` : '',
    profile?.pricingAxis ? `課金軸: ${profile.pricingAxis}` : '',
    '',
    '【自社の公開価格】',
    published,
    '',
    '【相場データ（自社調査の一次情報。これ以外の相場を使わないこと）】',
    marketTableForPrompt(),
  ]
    .filter(Boolean)
    .join('\n')

  const raw = await geminiGenerateJson<Record<string, unknown>>(
    { prompt, model: GEMINI_TEXT_MODEL_DEFAULT },
    'QuoteItem'
  )

  // モデルが { items: [...] } で返してくることがあるので拾う
  const one = (raw && Array.isArray((raw as any).items) ? (raw as any).items[0] : raw) || {}
  // 品目名は人が入れたものを正とする（AIに書き換えさせない）
  return normalizeItem({ ...one, itemName })
}
