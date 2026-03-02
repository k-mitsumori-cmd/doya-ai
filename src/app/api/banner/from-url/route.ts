import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateBanners, isNanobannerConfigured, getModelDisplayName } from '@/lib/nanobanner'
import { prisma } from '@/lib/prisma'
import { BANNER_PRICING, HIGH_USAGE_CONTACT_URL, getBannerMonthlyLimitByUserPlan, shouldResetMonthlyUsage, getCurrentMonthJST, isWithinFreeHour } from '@/lib/pricing'
import crypto from 'crypto'
import sharp from 'sharp'

export const runtime = 'nodejs'
export const maxDuration = 300

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

// ゲストの月次上限（Cookieで管理 - /api/banner/generate と共通）
const BANNER_GUEST_USAGE_COOKIE = 'doya_banner_guest_usage'
type GuestMonthlyUsage = { date: string; count: number } // date = "YYYY-MM"

function readGuestMonthlyUsage(request: NextRequest, currentMonth: string): GuestMonthlyUsage {
  try {
    const raw = request.cookies.get(BANNER_GUEST_USAGE_COOKIE)?.value
    if (!raw) return { date: currentMonth, count: 0 }
    const parsed = JSON.parse(raw) as any
    const date = typeof parsed?.date === 'string' ? parsed.date : currentMonth
    const count = typeof parsed?.count === 'number' ? parsed.count : 0
    // 月が変わっていたらリセット（旧YYYY-MM-DD形式にも対応）
    if (date.slice(0, 7) !== currentMonth) return { date: currentMonth, count: 0 }
    return { date: currentMonth, count }
  } catch {
    return { date: currentMonth, count: 0 }
  }
}
const VISION_API_BASE = 'https://vision.googleapis.com/v1'

type FromUrlRequest = {
  // 互換: 旧UIでは targetUrl/camelCase。新UIでは target_url/snake_case（URLのみ入力）
  targetUrl?: string
  target_url?: string
  // 選択したバナーを基準に“似た形”で再生成する（data:image/...）
  baseImage?: string
  base_image?: string
  bannerPurpose?: string
  industry?: string
  size?: string
  requiredText?: string
  language?: 'ja'
  // optional assets
  logoImage?: string
  personImages?: string[]
  // brand constraints
  mainColor?: string
  subColor?: string
  toneKeywords?: string
  // compliance
  avoid?: string
  mustInclude?: string
  // app integrations
  purpose?: string // app purpose key (sns_ad/youtube/...)
  referenceImages?: string[]
  brandColors?: string[]
  shareToGallery?: boolean
  shareProfile?: boolean
  count?: number
}

function getApiKey(): string {
  const apiKey =
    process.env.GOOGLE_GENAI_API_KEY ||
    process.env.GOOGLE_AI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.NANOBANNER_API_KEY
  if (!apiKey) throw new Error('GOOGLE_GENAI_API_KEY が設定されていません')
  return apiKey
}

function safeTrim(v: any, max = 4000): string {
  const s = typeof v === 'string' ? v : ''
  return s.trim().slice(0, max)
}

function isValidHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

function stripHtmlToText(html: string): string {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
  const text = withoutScripts
    .replace(/<\/(p|div|br|li|h1|h2|h3|h4|h5|h6)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
  return text
}

function extractMeta(html: string) {
  const pick = (re: RegExp) => {
    const m = html.match(re)
    return m?.[1]?.trim() || ''
  }
  const title = pick(/<title[^>]*>([^<]{1,200})<\/title>/i)
  const ogTitle = pick(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']{1,200})["'][^>]*>/i)
  const desc = pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{1,300})["'][^>]*>/i)
  const ogDesc = pick(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']{1,300})["'][^>]*>/i)
  return {
    title: ogTitle || title,
    description: ogDesc || desc,
  }
}

function coerceJson(text: string): any {
  const t = String(text || '').trim()
  if (!t) return null
  try {
    return JSON.parse(t)
  } catch {}
  // ```json ... ``` 対策
  const fence = t.match(/```json\s*([\s\S]*?)\s*```/i)?.[1]?.trim()
  if (fence) {
    try {
      return JSON.parse(fence)
    } catch {}
  }
  // code fence / extra text 対策：最初の { ... } を抜く
  const start = t.indexOf('{')
  if (start !== -1) {
    // ブレース対応：最初に成立する JSON オブジェクトを抽出
    let depth = 0
    let inStr = false
    let esc = false
    for (let i = start; i < t.length; i++) {
      const ch = t[i]
      if (inStr) {
        if (esc) esc = false
        else if (ch === '\\') esc = true
        else if (ch === '"') inStr = false
        continue
      }
      if (ch === '"') {
        inStr = true
        continue
      }
      if (ch === '{') depth++
      if (ch === '}') {
        depth--
        if (depth === 0) {
          const candidate = t.slice(start, i + 1)
          try {
            return JSON.parse(candidate)
          } catch {
            break
          }
        }
      }
    }
  }
  return null
}

async function callGeminiForJson(prompt: string, apiKey: string): Promise<any> {
  const models = ['gemini-3-pro-preview', 'gemini-3-flash-preview']
  let lastErr: string | null = null

  for (const model of models) {
    try {
      const endpoint = `${GEMINI_API_BASE}/models/${model}:generateContent`
      const jsonSchema = {
        type: 'OBJECT',
        properties: {
          banner_analysis: { type: 'STRING' },
          image_generation_prompt: { type: 'STRING' },
          negative_prompt: { type: 'STRING' },
        },
        required: ['banner_analysis', 'image_generation_prompt'],
      }
      const buildBody = (jsonMode: boolean) => ({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 4096,
          topP: 0.9,
          topK: 40,
          ...(jsonMode ? { responseMimeType: 'application/json', responseSchema: jsonSchema } : {}),
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
        ],
      })

      const attempt = async (jsonMode: boolean) =>
        fetch(`${endpoint}?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildBody(jsonMode)),
        })

      let res = await attempt(true)
      if (res.status === 502 || res.status === 503) {
        await new Promise((r) => setTimeout(r, 700))
        res = await attempt(true)
      }

      if (!res.ok) {
        const t = await res.text()
        // JSONモードが弾かれたら通常モードで再試行
        if (res.status === 400 && (t.includes('responseMimeType') || t.includes('responseSchema') || t.includes('INVALID_ARGUMENT'))) {
          let retry = await attempt(false)
          if (retry.status === 502 || retry.status === 503) {
            await new Promise((r) => setTimeout(r, 700))
            retry = await attempt(false)
          }
          if (retry.ok) {
            const json = await retry.json()
            const text = json?.candidates?.[0]?.content?.parts?.map((p: any) => (p?.text ? String(p.text) : '')).join('\n').trim()
            const parsed = coerceJson(text)
            if (parsed) return parsed
          }
          lastErr = `Gemini ${model} error (retry): ${retry.status} - ${(await retry.text()).substring(0, 400)}`
          continue
        }
        lastErr = `Gemini ${model} error: ${res.status} - ${t.substring(0, 400)}`
        continue
      }

      const json = await res.json()
      const text = json?.candidates?.[0]?.content?.parts?.map((p: any) => (p?.text ? String(p.text) : '')).join('\n').trim()
      const parsed = coerceJson(text)
      if (!parsed) {
        lastErr = `Gemini ${model} returned non-JSON: ${String(text || '').slice(0, 220)}`
        continue
      }
      return parsed
    } catch (e: any) {
      lastErr = `Gemini failed: ${e?.message || e}`
      continue
    }
  }
  throw new Error(lastErr || 'Gemini failed')
}

function buildWebsiteBannerPrompt(input: {
  target_url: string
  size: string
  language: 'ja'
  optional_assets: { logo_image?: string; person_images?: number }
  brand_constraints: { main_color?: string; sub_color?: string; tone_keywords?: string }
  compliance: { avoid?: string; must_include?: string }
  page_meta: { title?: string; description?: string }
  page_text: string
  color_hints: string
  visual_hints: string
  inferred?: { industry?: string; objective?: string; target?: string; evidence_keywords?: string[] }
}) {
  const inferredIndustry = safeTrim(input.inferred?.industry, 64) || '未推定'
  const inferredObjective = safeTrim(input.inferred?.objective, 64) || '未推定'
  const inferredTarget = safeTrim(input.inferred?.target, 120) || '未推定'
  const inferredEvidence = (Array.isArray(input.inferred?.evidence_keywords) ? input.inferred?.evidence_keywords : [])
    .map((x) => safeTrim(String(x || ''), 24))
    .filter(Boolean)
    .slice(0, 12)
    .join('、') || 'なし'

  // URL解析結果（title/description/text/visual hints 等）を材料に「成果前提の広告バナー」を設計し、最終画像プロンプトまで落とし込む
  // NOTE: 出力は互換のため banner_analysis / image_generation_prompt の2キーのみ（JSONのみ）
  return `あなたは「広告・マーケティング成果を最大化するバナー」を専門に制作する、トップレベルの広告デザイナー兼マーケターです。

これから渡されるのは、あるWebサイト（target_url）を解析して得られた情報です。

【あなたの目的】
そのサイト内容・業種・ユーザー心理に最適化された「思わずクリック・申込み・ダウンロードしたくなる広告バナー」を生成してください。

単なる見た目の良さではなく、
・広告として強い（クリック/申込につながる）
・情報が一瞬で伝わる（視認性/優先順位）
・実際に使われていそう（人が作ったようなクオリティ）
を最優先してください。

---

【最重要：あなたが内部で必ず行うステップ】

STEP1: サイト理解（推定してよいが、根拠は page_text/metadata から）
- サービス内容（何を提供しているか）
- 業種/業界（該当しやすいものを1つ選ぶ）
- 想定ターゲット（年齢/性別/立場/状況）
- 提供価値（ベネフィット：ユーザーが得る結果）
- 強い訴求軸（価格/実績/簡単/限定/専門性/権威性/緊急性 など）
- 最適CTA（問い合わせ/資料DL/無料相談/申込/購入/採用応募など）

STEP2: 勝ちパターン（構成）を自動選択（必須）
以下のいずれかを選び、業種に最適化して使うこと（混ぜすぎない）：
1) 課題提起 → 解決策 → ベネフィット → 信頼要素 → CTA（BtoB/SaaSに強い）
2) ベネフィット先出し → 実績/根拠 → 具体内容 → CTA（教育/スクールに強い）
3) オファー（割引/特典） → 期限/限定 → 商品/内容 → CTA（EC/キャンペーンに強い）
4) 効果/変化 → 成分/理由 → 安心要素（監修/実績） → CTA（美容/健康に強い）
5) 仕事内容/魅力 → 条件/メリット → 信頼/文化 → CTA（採用/転職に強い）

STEP3: コピー設計（日本の広告バナーらしい短さ/強さ）
- メイン見出し：短く強い（目安 8〜16文字）。一瞬で価値が伝わる言い回し。
- サブコピー：0〜2行。補足は削り、主張を強める。
- CTA：短く自然（例：無料で試す/資料DL/無料相談/今すぐチェック）
- 重要：根拠のない数字や誇張（「必ず」「100%」等）は禁止。サイトに明示がある場合のみ数値利用可。

STEP4: デザイン（人間のデザイナーの思考）
- 文字が「確実に読める」ことを最優先（コントラスト、余白、文字量）
- 情報の優先順位：メインコピー ＞ サブコピー ＞ CTA ＞ 補足（ロゴ等）
- 写真/人物/商品は “意味のある配置” と “視線誘導” を行う（ただ置かない）
- 安っぽい/AI感が強い装飾は禁止（過度なグロー、雑な3D、過密、ランダムフォント）
- BtoB/教育は「信頼・整理・プロ感」、ECは「お得感・緊急性」、美容は「清潔感・余白」を優先

STEP5: 最終プロンプト（image_generation_prompt）を作る
- 1本のプロンプトとして完結（見出し/箇条書き不要）
- 生成するバナーは日本語。文字が崩れない/読めるよう強く指示
- サイズ（size）に合わせたレイアウトの指示を含める

---

【システムから渡す解析情報（この情報のみで設計する）】
- target_url: ${input.target_url}
- size: ${input.size}
- language: ${input.language}
- optional_assets:
  - logo_image: ${input.optional_assets.logo_image ? 'あり（提供済み）' : 'なし'}
  - person_images: ${input.optional_assets.person_images ? `${input.optional_assets.person_images}枚（提供済み）` : 'なし'}
- brand_constraints:
  - main_color: ${input.brand_constraints.main_color || '未指定'}
  - sub_color: ${input.brand_constraints.sub_color || '未指定'}
  - tone_keywords: ${input.brand_constraints.tone_keywords || '未指定'}
- compliance:
  - avoid: ${input.compliance.avoid || '未指定'}
  - must_include: ${input.compliance.must_include || '未指定'}
- page_title: ${safeTrim(input.page_meta.title, 200)}
- page_description: ${safeTrim(input.page_meta.description, 320)}
- color_hints: ${safeTrim(input.color_hints, 800)}
- visual_hints: ${safeTrim(input.visual_hints, 1400)}

【バックエンド推定ヒント（あくまでヒント。矛盾する場合は page_text を優先）】
- inferred_industry: ${inferredIndustry}
- inferred_objective: ${inferredObjective}
- inferred_target: ${inferredTarget}
- inferred_evidence_keywords: ${inferredEvidence}

### page_text（重要：ページ本文の抜粋）
${safeTrim(input.page_text, 18000)}

---

【出力形式（厳守）】
次の2つだけを出力する（JSONのみ。余計な文章やキーは禁止）：
{
  "banner_analysis": "",
  "image_generation_prompt": ""
}

【banner_analysis に必ず含める（見出し付き）】
1) サイトの要約（サービス/業種/ターゲット/ベネフィット）
2) 採用した勝ちパターン（上の1〜5のどれか）と理由
3) 訴求軸（信頼/お得/権威/緊急など）とCTA方針
4) メインカラー/サブカラー（color_hints/visual_hintsを根拠に）
5) 採用するコピー案（メイン/サブ/CTA）※日本語で
（長すぎると失敗しやすいので banner_analysis は全体で 900〜1400文字以内に要約する）

【image_generation_prompt の厳格ルール】
- そのまま画像生成AIに渡せる “完成形の1本のプロンプト” のみ
- 具体的に「レイアウト」「背景」「配色」「文字の階層」「CTAボタン」「余白」「写真/人物/商品配置」を指示
- 日本語テキストは “読みやすく正確に” を強制（文字崩れ禁止、過密禁止）
- 広告として実在しそうなクオリティ（安っぽさ/AI感の強いデザインは禁止）
- 虚偽・過剰表現は禁止。`
}

function extractColorHints(html: string): string {
  try {
    const theme = (html.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']{1,32})["']/i)?.[1] || '').trim()
    const all = html.match(/#[0-9a-fA-F]{3,6}\b/g) || []
    const normalized = all
      .map((c) => c.toUpperCase())
      .map((c) => (c.length === 4 ? `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}` : c))
      .filter((c) => /^#[0-9A-F]{6}$/.test(c))
    const freq = new Map<string, number>()
    for (const c of normalized) freq.set(c, (freq.get(c) || 0) + 1)
    const top = Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([c, n]) => `${c}(${n})`)
      .join(', ')
    const parts = []
    if (theme) parts.push(`theme-color=${theme}`)
    if (top) parts.push(`html/css hex top=${top}`)
    return parts.join(' / ')
  } catch {
    return ''
  }
}

type InferredBannerInfo = { industry?: string; objective?: string; target?: string; evidence_keywords?: string[] }

function inferBannerInfoFromText(args: { url: string; title?: string; description?: string; pageText: string }): InferredBannerInfo {
  const blob = `${args.url}\n${args.title || ''}\n${args.description || ''}\n${args.pageText || ''}`.toLowerCase()
  const hit = (words: Array<string | RegExp>) =>
    words.some((w) => (typeof w === 'string' ? blob.includes(w) : w.test(blob)))

  const evidence: string[] = []
  const pushEvidence = (arr: string[]) => {
    for (const w of arr) {
      if (blob.includes(w.toLowerCase())) evidence.push(w)
      if (evidence.length >= 12) break
    }
  }

  // industry
  let industry: string | undefined
  if (hit(['ec', 'カート', '購入', '送料無料', 'セール', 'クーポン', '%off', 'off', /楽天|amazon|shopify/i])) {
    industry = 'EC/セール/キャンペーン'
    pushEvidence(['セール', 'クーポン', '送料無料', '購入'])
  } else if (hit(['スクール', '講座', '受講', 'オンライン講座', 'カリキュラム', '資格', '未経験', '学習', '教材'])) {
    industry = '教育/スクール'
    pushEvidence(['未経験', '受講', '資格', 'カリキュラム'])
  } else if (hit(['採用', '求人', 'エントリー', '転職', '面談', 'スカウト', '応募', '人材', 'キャリア'])) {
    industry = '転職/採用/人材'
    pushEvidence(['採用', '求人', '応募', '面談'])
  } else if (hit(['美容', 'コスメ', 'スキンケア', '毛穴', '美白', 'エステ', 'ダイエット', 'サプリ', '健康', '食品', '成分', '監修'])) {
    industry = '美容/健康/食品'
    pushEvidence(['成分', '監修', 'スキンケア', '健康'])
  } else if (hit(['saas', 'b2b', '導入', '資料請求', '無料相談', '工数', '業務', '効率化', '課題', '解決', '法人', 'セキュリティ', 'api'])) {
    industry = 'BtoB/SaaS'
    pushEvidence(['導入', '資料請求', '無料相談', '効率化'])
  } else if (hit(['ノウハウ', '教材', 'メルマガ', 'LINE登録', '無料プレゼント', '特典', 'セミナー', 'ウェビナー', 'AIツール'])) {
    industry = '情報商材/ノウハウ/AIツール'
    pushEvidence(['特典', '無料', 'セミナー', 'AI'])
  } else if (hit(['web制作', '制作会社', 'マーケティング', '広告運用', 'lp', 'seo', 'sns'])) {
    industry = 'Web/IT/マーケ支援'
    pushEvidence(['広告運用', 'SEO', 'SNS', 'LP'])
  }

  // objective
  let objective: string | undefined
  if (hit(['資料請求', 'ホワイトペーパー', 'download', 'ダウンロード'])) objective = '資料DL'
  else if (hit(['問い合わせ', 'お問い合わせ', 'contact'])) objective = '問い合わせ'
  else if (hit(['無料相談', '相談', 'demo', 'デモ'])) objective = '無料相談'
  else if (hit(['購入', 'カート', '注文', 'buy'])) objective = '購入'
  else if (hit(['申し込み', '申込', '予約', 'エントリー', '応募'])) objective = '申込/応募'

  // target (rough)
  let target: string | undefined
  if (industry === 'BtoB/SaaS') target = '法人担当者（経営者/マーケ/情シス/営業/人事など）'
  else if (industry === '教育/スクール') target = '学習者（未経験/スキルアップ/転職目的など）'
  else if (industry === '転職/採用/人材') target = '求職者または採用担当者'
  else if (industry === '美容/健康/食品') target = '悩みを持つ個人（主に女性/健康志向）'
  else if (industry === 'EC/セール/キャンペーン') target = '購入検討中の個人ユーザー'

  return {
    industry,
    objective,
    target,
    evidence_keywords: evidence.length > 0 ? Array.from(new Set(evidence)) : undefined,
  }
}

function normalizeCssColorToHex(input: string): string | null {
  const raw = String(input || '').trim()
  if (!raw) return null
  const hex = raw.match(/#[0-9a-fA-F]{3,8}\b/)?.[0]
  if (hex) {
    const up = hex.toUpperCase()
    if (up.length === 4) return `#${up[1]}${up[1]}${up[2]}${up[2]}${up[3]}${up[3]}`
    if (up.length === 7) return up
  }
  // rgb/rgba
  const m = raw
    .replace(/\s+/g, '')
    .match(/^rgba?\((\d{1,3}),(\d{1,3}),(\d{1,3})(?:,([\d.]+))?\)$/i)
  if (m) {
    const r = Number(m[1])
    const g = Number(m[2])
    const b = Number(m[3])
    const a = m[4] == null ? 1 : Number(m[4])
    if (![r, g, b, a].every((n) => Number.isFinite(n))) return null
    if (a <= 0.08) return null
    return rgbToHex(r, g, b)
  }
  return null
}

function isNearNeutralHex(hex: string): boolean {
  const h = String(hex || '').toUpperCase()
  if (!/^#[0-9A-F]{6}$/.test(h)) return true
  const r = parseInt(h.slice(1, 3), 16)
  const g = parseInt(h.slice(3, 5), 16)
  const b = parseInt(h.slice(5, 7), 16)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  // ほぼ白/黒/グレー
  if (max - min < 10) return true
  if (max > 245 && min > 235) return true
  if (max < 25 && min < 15) return true
  return false
}

function extractPaletteFromCss(html: string): string[] {
  try {
    const candidates: string[] = []
    const theme = (html.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']{1,64})["']/i)?.[1] || '').trim()
    const tile = (html.match(/<meta[^>]+name=["']msapplication-TileColor["'][^>]+content=["']([^"']{1,64})["']/i)?.[1] || '').trim()
    for (const v of [theme, tile]) {
      const hex = normalizeCssColorToHex(v)
      if (hex) candidates.push(hex)
    }

    // CSS variables in <style> blocks
    const varRe =
      /--(?:primary|main|brand|accent|secondary|theme|color|cta|link|btn)[a-zA-Z0-9_-]{0,40}\s*:\s*([^;]{1,80});/gi
    let m: RegExpExecArray | null
    while ((m = varRe.exec(html))) {
      const hex = normalizeCssColorToHex(m[1])
      if (hex) candidates.push(hex)
      if (candidates.length > 30) break
    }

    // raw hex in HTML/CSS
    const all = html.match(/#[0-9a-fA-F]{3,6}\b/g) || []
    for (const c of all.slice(0, 400)) {
      const hex = normalizeCssColorToHex(c)
      if (hex) candidates.push(hex)
    }

    // 重複除去＆中立色は後回し
    const uniq = Array.from(new Set(candidates.map((c) => c.toUpperCase())))
    const colorful = uniq.filter((c) => !isNearNeutralHex(c))
    const neutral = uniq.filter((c) => isNearNeutralHex(c))
    return [...colorful, ...neutral].slice(0, 6)
  } catch {
    return []
  }
}

type CachedPalette = { ts: number; palette: string[] }
const HEADLESS_PALETTE_CACHE = new Map<string, CachedPalette>()
const HEADLESS_PALETTE_TTL_MS = 6 * 60 * 60 * 1000

async function extractPaletteViaHeadlessComputedStyles(targetUrl: string, timeoutMs = 12_000): Promise<string[]> {
  const disable = process.env.DOYA_DISABLE_HEADLESS_COLOR === '1'
  if (disable) return []

  let cacheKey = ''
  try {
    const u = new URL(targetUrl)
    cacheKey = u.hostname
  } catch {
    return []
  }

  const cached = HEADLESS_PALETTE_CACHE.get(cacheKey)
  if (cached && Date.now() - cached.ts < HEADLESS_PALETTE_TTL_MS) return cached.palette

  let puppeteer: any
  let chromium: any
  try {
    const p = await import('puppeteer-core')
    puppeteer = (p as any).default || p
    const c = await import('@sparticuz/chromium')
    chromium = (c as any).default || c
  } catch {
    return []
  }

  let browser: any
  try {
    const executablePath = await chromium.executablePath()
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1200, height: 800 },
      executablePath,
      headless: chromium.headless,
    })
    const page = await browser.newPage()

    // 高速化（画像/フォントはブロック）
    await page.setRequestInterception(true)
    page.on('request', (req: any) => {
      const type = req.resourceType()
      if (type === 'image' || type === 'font' || type === 'media') return req.abort()
      return req.continue()
    })

    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs })

    const palette: string[] = await page.evaluate(() => {
      const out: Array<{ hex: string; w: number }> = []

      const toHex = (input: string): string | null => {
        const raw = String(input || '').trim()
        if (!raw) return null
        // normalize via canvas trick
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) return null
        ctx.fillStyle = '#000000'
        const before = String(ctx.fillStyle || '').toLowerCase()
        ctx.fillStyle = raw
        const normalized = String(ctx.fillStyle || '').toLowerCase()
        // invalid colors often keep previous value; guard
        if (!normalized || normalized === before) return null

        const hex = normalized.match(/#[0-9a-f]{6}\b/)?.[0]
        if (hex) return hex.toUpperCase()
        const m = normalized.replace(/\s+/g, '').match(/^rgba?\((\d+),(\d+),(\d+)(?:,([\d.]+))?\)$/)
        if (m) {
          const r = Number(m[1])
          const g = Number(m[2])
          const b = Number(m[3])
          const a = m[4] == null ? 1 : Number(m[4])
          if (a <= 0.08) return null
          const to = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
          return `#${to(r)}${to(g)}${to(b)}`.toUpperCase()
        }
        return null
      }

      const isNeutral = (hex: string): boolean => {
        const h = String(hex || '').toUpperCase()
        if (!/^#[0-9A-F]{6}$/.test(h)) return true
        const r = parseInt(h.slice(1, 3), 16)
        const g = parseInt(h.slice(3, 5), 16)
        const b = parseInt(h.slice(5, 7), 16)
        const max = Math.max(r, g, b)
        const min = Math.min(r, g, b)
        if (max - min < 10) return true
        if (max > 245 && min > 235) return true
        if (max < 25 && min < 15) return true
        return false
      }

      const push = (value: string, w: number) => {
        const hex = toHex(value)
        if (!hex) return
        out.push({ hex, w })
      }

      // meta theme-color
      const theme = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null
      if (theme?.content) push(theme.content, 3.0)

      // root css vars (often used by modern sites)
      try {
        const root = getComputedStyle(document.documentElement)
        const keys = [
          '--primary',
          '--primary-color',
          '--main',
          '--main-color',
          '--brand',
          '--brand-color',
          '--accent',
          '--accent-color',
          '--secondary',
          '--secondary-color',
          '--link',
          '--link-color',
          '--cta',
          '--cta-color',
          '--button',
          '--button-color',
        ]
        for (const k of keys) {
          const v = root.getPropertyValue(k)
          if (v) push(v, 2.0)
        }
      } catch {
        // ignore
      }

      const selectors = [
        'header',
        'nav',
        'main',
        'footer',
        'a',
        'button',
        '[role="button"]',
        '[class*="btn"]',
        '[class*="Button"]',
        '[class*="button"]',
        '[class*="cta"]',
        '[class*="CTA"]',
      ]
      const els = Array.from(document.querySelectorAll(selectors.join(','))).slice(0, 180) as HTMLElement[]
      for (const el of els) {
        const rect = el.getBoundingClientRect()
        if (rect.width < 24 || rect.height < 12) continue
        // viewport内の要素だけに寄せる
        if (rect.bottom < 0 || rect.right < 0 || rect.top > window.innerHeight || rect.left > window.innerWidth) continue
        const area = Math.min(rect.width * rect.height, window.innerWidth * window.innerHeight)
        const w = Math.max(0.2, Math.min(6.0, area / 40000))
        const cs = getComputedStyle(el)
        const bg = cs.backgroundColor
        const color = cs.color
        const border = cs.borderTopColor
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') push(bg, w * 1.2)
        if (color) push(color, w * 0.7)
        if (border && border !== 'rgba(0, 0, 0, 0)' && border !== 'transparent') push(border, w * 0.3)
      }

      const weight = new Map<string, number>()
      for (const x of out) weight.set(x.hex, (weight.get(x.hex) || 0) + x.w)
      const entries = Array.from(weight.entries()).sort((a, b) => b[1] - a[1])
      const colorful = entries.filter(([hex]) => !isNeutral(hex)).map(([hex]) => hex)
      const neutral = entries.filter(([hex]) => isNeutral(hex)).map(([hex]) => hex)
      return [...colorful, ...neutral].slice(0, 6)
    })

    const final = Array.from(new Set((palette || []).map((c) => String(c).toUpperCase())))
      .filter((c) => /^#[0-9A-F]{6}$/.test(c))
      .slice(0, 3)
    HEADLESS_PALETTE_CACHE.set(cacheKey, { ts: Date.now(), palette: final })
    return final
  } catch {
    return []
  } finally {
    try {
      await browser?.close?.()
    } catch {
      // ignore
    }
  }
}

type VisualColorByArea = { hex: string; ratio: number }
type VisualBrandReport = {
  viewport: { width: number; height: number }
  colorsByArea: VisualColorByArea[] // top colors with area ratio (0..1)
  mainColor?: string
  subColors: string[]
  colorSummaryText: string
  imageSummaryText: string
  imageAreaRatio?: number // 0..1 (viewport only)
  bgImageAreaRatio?: number // 0..1 (viewport only)
  people: 'あり' | 'なし' | '不明'
}

type CachedVisual = { ts: number; report: VisualBrandReport }
const HEADLESS_VISUAL_CACHE = new Map<string, CachedVisual>()
const HEADLESS_VISUAL_TTL_MS = 2 * 60 * 60 * 1000

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = String(hex || '').trim().toUpperCase()
  if (!/^#[0-9A-F]{6}$/.test(h)) return null
  return {
    r: parseInt(h.slice(1, 3), 16),
    g: parseInt(h.slice(3, 5), 16),
    b: parseInt(h.slice(5, 7), 16),
  }
}

function colorDistance(a: string, b: string): number {
  const ra = hexToRgb(a)
  const rb = hexToRgb(b)
  if (!ra || !rb) return 999
  const dr = ra.r - rb.r
  const dg = ra.g - rb.g
  const db = ra.b - rb.b
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

async function extractColorsByAreaFromScreenshot(
  screenshotPng: Buffer,
  sampleW = 160,
  sampleH = 100
): Promise<VisualColorByArea[]> {
  try {
    const out: any = await sharp(screenshotPng)
      .resize(sampleW, sampleH, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true } as any)
    const data: Buffer = out?.data
    const info: any = out?.info
    const channels = (info as any)?.channels || 3
    const totalPixels = Math.max(1, Number((info as any)?.width || sampleW) * Number((info as any)?.height || sampleH))

    // 4bit quantization per channel (16 bins) => 4096 buckets
    const counts = new Map<number, number>()
    for (let i = 0; i + 2 < data.length; i += channels) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
      counts.set(key, (counts.get(key) || 0) + 1)
    }

    const entries = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 16)
    const results: VisualColorByArea[] = []
    for (const [key, c] of entries) {
      const rBin = (key >> 8) & 0x0f
      const gBin = (key >> 4) & 0x0f
      const bBin = key & 0x0f
      // map bin 0..15 to 0..255 (0,17,34,...255)
      const r = rBin * 17
      const g = gBin * 17
      const b = bBin * 17
      const hex = rgbToHex(r, g, b)
      const ratio = c / totalPixels
      results.push({ hex, ratio })
    }
    // dedupe just in case
    const uniq = new Map<string, number>()
    for (const r of results) uniq.set(r.hex, (uniq.get(r.hex) || 0) + r.ratio)
    return Array.from(uniq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([hex, ratio]) => ({ hex, ratio }))
  } catch {
    return []
  }
}

async function detectPeopleViaVision(imageUrls: string[]): Promise<'あり' | 'なし' | '不明'> {
  const apiKey = getVisionApiKey()
  if (!apiKey) return '不明'
  const urls = Array.from(new Set(imageUrls.filter(Boolean))).slice(0, 3)
  if (urls.length === 0) return '不明'

  try {
    const endpoint = `${VISION_API_BASE}/images:annotate?key=${encodeURIComponent(apiKey)}`
    const body = {
      requests: urls.map((u) => ({
        image: { source: { imageUri: u } },
        features: [{ type: 'FACE_DETECTION', maxResults: 3 }],
      })),
    }
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout))
    if (!res.ok) return '不明'
    const json: any = await res.json().catch(() => null)
    const responses: any[] = Array.isArray(json?.responses) ? json.responses : []
    for (const r of responses) {
      const faces: any[] = Array.isArray(r?.faceAnnotations) ? r.faceAnnotations : []
      if (faces.length > 0) return 'あり'
    }
    return 'なし'
  } catch {
    return '不明'
  }
}

async function analyzeSiteVisualViaHeadless(targetUrl: string, timeoutMs = 16_000): Promise<VisualBrandReport> {
  const disable = process.env.DOYA_DISABLE_HEADLESS_COLOR === '1'
  if (disable) {
    return {
      viewport: { width: 1200, height: 800 },
      colorsByArea: [],
      subColors: [],
      colorSummaryText: '',
      imageSummaryText: '',
      people: '不明',
    }
  }

  let cacheKey = ''
  try {
    const u = new URL(targetUrl)
    cacheKey = u.hostname
  } catch {
    cacheKey = targetUrl.slice(0, 120)
  }
  const cached = HEADLESS_VISUAL_CACHE.get(cacheKey)
  if (cached && Date.now() - cached.ts < HEADLESS_VISUAL_TTL_MS) return cached.report

  let puppeteer: any
  let chromium: any
  try {
    const p = await import('puppeteer-core')
    puppeteer = (p as any).default || p
    const c = await import('@sparticuz/chromium')
    chromium = (c as any).default || c
  } catch {
    return {
      viewport: { width: 1200, height: 800 },
      colorsByArea: [],
      subColors: [],
      colorSummaryText: '',
      imageSummaryText: '',
      people: '不明',
    }
  }

  const viewport = { width: 1200, height: 800 }
  let browser: any
  try {
    const executablePath = await chromium.executablePath()
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: viewport,
      executablePath,
      headless: chromium.headless,
    })
    const page = await browser.newPage()

    // 高速化（フォント/メディアはブロック、画像は許可して“見え方”を取る）
    await page.setRequestInterception(true)
    page.on('request', (req: any) => {
      const type = req.resourceType()
      if (type === 'font' || type === 'media') return req.abort()
      return req.continue()
    })

    // まずはレンダリング
    try {
      await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: timeoutMs })
    } catch {
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs }).catch(() => {})
    }
    // CSS適用・レイアウト安定待ち（短め）
    await page.waitForTimeout(900).catch(() => {})

    const pageInfo: any = await page.evaluate(() => {
      const w = window.innerWidth
      const h = window.innerHeight
      const viewportArea = Math.max(1, w * h)

      const imgs = Array.from(document.images || [])
      const imgSrcs = imgs
        .map((im) => (im as HTMLImageElement).currentSrc || (im as HTMLImageElement).src || '')
        .filter(Boolean)
      const svgCount = document.querySelectorAll('svg').length + imgSrcs.filter((u) => u.toLowerCase().includes('.svg')).length
      const rasterCount = imgSrcs.filter((u) => !u.toLowerCase().includes('.svg')).length

      // viewport内の画像面積（img要素）
      let imgArea = 0
      for (const im of imgs) {
        const r = (im as HTMLImageElement).getBoundingClientRect()
        const iw = Math.max(0, Math.min(w, r.right) - Math.max(0, r.left))
        const ih = Math.max(0, Math.min(h, r.bottom) - Math.max(0, r.top))
        if (iw > 0 && ih > 0) imgArea += iw * ih
      }

      // viewport内の background-image 面積（主要要素をサンプル）
      let bgImgArea = 0
      const nodes = Array.from(document.querySelectorAll('header,main,section,div,nav,footer')).slice(0, 220) as HTMLElement[]
      for (const el of nodes) {
        const cs = getComputedStyle(el)
        const bg = cs.backgroundImage
        if (!bg || bg === 'none') continue
        const r = el.getBoundingClientRect()
        const iw = Math.max(0, Math.min(w, r.right) - Math.max(0, r.left))
        const ih = Math.max(0, Math.min(h, r.bottom) - Math.max(0, r.top))
        if (iw > 0 && ih > 0) bgImgArea += iw * ih
      }

      const iconLinks = Array.from(document.querySelectorAll('link[rel~="icon"],link[rel="apple-touch-icon"],link[rel="shortcut icon"]')) as HTMLLinkElement[]

      // 大きい順に画像URLを採用（人物検出/種類判定用）
      const imgCandidates = imgs
        .map((im) => {
          const r = (im as HTMLImageElement).getBoundingClientRect()
          const area = Math.max(0, r.width) * Math.max(0, r.height)
          const src = (im as HTMLImageElement).currentSrc || (im as HTMLImageElement).src || ''
          return { src, area }
        })
        .filter((x) => x.src && x.area > 6000)
        .sort((a, b) => b.area - a.area)
        .slice(0, 6)
        .map((x) => x.src)

      return {
        viewport: { width: w, height: h },
        svgCount,
        rasterCount,
        imgCount: imgs.length,
        iconCount: iconLinks.length,
        imgAreaRatio: Math.min(1, imgArea / viewportArea),
        bgImgAreaRatio: Math.min(1, bgImgArea / viewportArea),
        imgCandidates,
      }
    })

    // computed styles から「UI色」を抽出（写真が多いサイトでスクショ色がズレる問題への対策）
    const computedColorsRaw: Array<{ hex: string; w: number }> = await page.evaluate(() => {
      const out: Array<{ hex: string; w: number }> = []
      const toHex = (input: string): string | null => {
        const raw = String(input || '').trim()
        if (!raw) return null
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) return null
        ctx.fillStyle = '#000000'
        const before = String(ctx.fillStyle || '').toLowerCase()
        ctx.fillStyle = raw
        const normalized = String(ctx.fillStyle || '').toLowerCase()
        if (!normalized || normalized === before) return null
        const hex = normalized.match(/#[0-9a-f]{6}\b/)?.[0]
        if (hex) return hex.toUpperCase()
        const m = normalized.replace(/\s+/g, '').match(/^rgba?\((\d+),(\d+),(\d+)(?:,([\d.]+))?\)$/)
        if (m) {
          const r = Number(m[1])
          const g = Number(m[2])
          const b = Number(m[3])
          const a = m[4] == null ? 1 : Number(m[4])
          if (a <= 0.08) return null
          const to = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
          return `#${to(r)}${to(g)}${to(b)}`.toUpperCase()
        }
        return null
      }
      const push = (value: string, w: number) => {
        const hex = toHex(value)
        if (!hex) return
        out.push({ hex, w })
      }

      // body/background
      try {
        const body = document.body
        if (body) {
          const cs = getComputedStyle(body)
          if (cs.backgroundColor) push(cs.backgroundColor, 3.5)
          if (cs.color) push(cs.color, 1.0)
        }
      } catch {}

      const selectors = [
        'header',
        'nav',
        'main',
        'footer',
        'a',
        'button',
        '[role="button"]',
        '[class*="btn"]',
        '[class*="Button"]',
        '[class*="button"]',
        '[class*="cta"]',
        '[class*="CTA"]',
      ]
      const els = Array.from(document.querySelectorAll(selectors.join(','))).slice(0, 220) as HTMLElement[]
      for (const el of els) {
        const r = el.getBoundingClientRect()
        const area = Math.max(0, r.width) * Math.max(0, r.height)
        if (area < 1200) continue
        const cs = getComputedStyle(el)
        // background / border / text / link colors
        if (cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent') push(cs.backgroundColor, Math.min(6, area / 25000))
        if (cs.borderColor && cs.borderColor !== 'rgba(0, 0, 0, 0)' && cs.borderColor !== 'transparent') push(cs.borderColor, Math.min(2, area / 60000))
        if (cs.color) push(cs.color, Math.min(2, area / 60000))
      }

      return out
    })

    const screenshot = (await page.screenshot({ type: 'png' })) as Buffer
    const screenshotColorsByArea = await extractColorsByAreaFromScreenshot(screenshot)

    const computedColorsByArea: VisualColorByArea[] = (() => {
      const m = new Map<string, number>()
      for (const item of computedColorsRaw) {
        const hex = String(item?.hex || '').toUpperCase()
        const w = Number(item?.w || 0)
        if (!/^#[0-9A-F]{6}$/.test(hex)) continue
        if (!Number.isFinite(w) || w <= 0) continue
        m.set(hex, (m.get(hex) || 0) + w)
      }
      const total = Array.from(m.values()).reduce((a, b) => a + b, 0) || 1
      const arr = Array.from(m.entries())
        .map(([hex, w]) => ({ hex, ratio: Math.min(1, w / total) }))
        .sort((a, b) => b.ratio - a.ratio)
        .slice(0, 10)
      // 色味を先に（中立色は後ろへ）
      const colorful = arr.filter((c) => !isNearNeutralHex(c.hex))
      const neutral = arr.filter((c) => isNearNeutralHex(c.hex))
      return [...colorful, ...neutral]
    })()

    const photoHeavy = ((pageInfo?.imgAreaRatio || 0) + (pageInfo?.bgImgAreaRatio || 0)) >= 0.28
    const colorsByArea = (photoHeavy && computedColorsByArea.length >= 2) ? computedColorsByArea : screenshotColorsByArea

    const mainColor = colorsByArea[0]?.hex
    const subs: string[] = []
    // サブは「アクセント候補」優先（中立色は後回し）。ただし面積比順に、近い色は除外。
    for (const c of colorsByArea.slice(1)) {
      if (!c?.hex) continue
      if (subs.length >= 3) break
      if (mainColor && colorDistance(mainColor, c.hex) < 32) continue
      if (subs.some((s) => colorDistance(s, c.hex) < 32)) continue
      if (isNearNeutralHex(c.hex) && subs.length < 2) continue
      subs.push(c.hex)
    }
    // まだ足りなければ中立色も含めて埋める
    if (subs.length < 2) {
      for (const c of colorsByArea.slice(1)) {
        if (subs.length >= 3) break
        if (!c?.hex) continue
        if (subs.includes(c.hex)) continue
        if (mainColor && colorDistance(mainColor, c.hex) < 32) continue
        subs.push(c.hex)
      }
    }

    // 画像の種類（根拠はDOM要素の構成）
    const kind =
      pageInfo.svgCount > Math.max(6, pageInfo.rasterCount) ? 'アイコン/イラスト（SVG中心）' :
      pageInfo.rasterCount > Math.max(6, pageInfo.svgCount) ? '写真/実写（ラスタ画像中心）' :
      '混在（写真+アイコン/イラスト）'

    const people = await detectPeopleViaVision(Array.isArray(pageInfo.imgCandidates) ? pageInfo.imgCandidates : [])

    const colorSummaryText = colorsByArea
      .slice(0, 8)
      .map((c) => `${c.hex}(${Math.round(c.ratio * 100)}%)`)
      .join(', ')
    const imageSummaryText = `images=${pageInfo.imgCount} (raster=${pageInfo.rasterCount}, svg≈${pageInfo.svgCount}, icons=${pageInfo.iconCount}) / kind=${kind} / viewport_image_area=${Math.round((pageInfo.imgAreaRatio || 0) * 100)}% / viewport_bg_image_area=${Math.round((pageInfo.bgImgAreaRatio || 0) * 100)}% / people=${people}`

    const report: VisualBrandReport = {
      viewport,
      colorsByArea,
      mainColor,
      subColors: subs,
      colorSummaryText,
      imageSummaryText,
      imageAreaRatio: pageInfo.imgAreaRatio,
      bgImageAreaRatio: pageInfo.bgImgAreaRatio,
      people,
    }
    HEADLESS_VISUAL_CACHE.set(cacheKey, { ts: Date.now(), report })
    return report
  } catch {
    return {
      viewport,
      colorsByArea: [],
      subColors: [],
      colorSummaryText: '',
      imageSummaryText: '',
      people: '不明',
    }
  } finally {
    try {
      await browser?.close?.()
    } catch {
      // ignore
    }
  }
}

function getVisionApiKey(): string | null {
  const key =
    process.env.GOOGLE_CLOUD_VISION_API_KEY ||
    process.env.GOOGLE_VISION_API_KEY ||
    process.env.GCP_VISION_API_KEY ||
    process.env.VISION_API_KEY ||
    ''
  return key ? String(key).trim() : null
}

function isValidSizeString(v: string): boolean {
  const s = String(v || '').trim()
  if (!/^\d{2,4}x\d{2,4}$/.test(s)) return false
  const [wStr, hStr] = s.split('x')
  const w = Number(wStr)
  const h = Number(hStr)
  if (!Number.isFinite(w) || !Number.isFinite(h)) return false
  if (w < 100 || h < 100) return false
  if (w > 4096 || h > 4096) return false
  return true
}

function toAbsoluteUrl(maybeUrl: string, baseUrl: string): string | null {
  const raw = String(maybeUrl || '').trim()
  if (!raw) return null
  try {
    return new URL(raw, baseUrl).toString()
  } catch {
    return null
  }
}

function extractImageCandidates(html: string, baseUrl: string): string[] {
  const picks: string[] = []
  const take = (re: RegExp) => {
    const m = html.match(re)
    const u = m?.[1]?.trim()
    const abs = u ? toAbsoluteUrl(u, baseUrl) : null
    if (abs) picks.push(abs)
  }
  // og / twitter
  take(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']{1,500})["'][^>]*>/i)
  take(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']{1,500})["'][^>]*>/i)
  // icons
  take(/<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']([^"']{1,500})["'][^>]*>/i)
  take(/<link[^>]+rel=["']icon["'][^>]+href=["']([^"']{1,500})["'][^>]*>/i)
  take(/<link[^>]+rel=["']shortcut icon["'][^>]+href=["']([^"']{1,500})["'][^>]*>/i)
  // 重複排除
  return Array.from(new Set(picks)).slice(0, 4)
}

function extractLikelyHeroImages(html: string, baseUrl: string): string[] {
  // OGがない/薄いサイト向け：ページ内のimgを少し拾う
  const urls: string[] = []
  const re = /<img[^>]+src=["']([^"']{1,500})["'][^>]*>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const abs = toAbsoluteUrl(m[1], baseUrl)
    if (abs) urls.push(abs)
    if (urls.length >= 6) break
  }
  return Array.from(new Set(urls)).slice(0, 6)
}

function extractProductLikeImages(html: string, baseUrl: string): string[] {
  // 商品画像/プロダクト画像っぽいものを拾う（ECやLPを想定）
  const urls: string[] = []
  const re = /<img[^>]+src=["']([^"']{1,500})["'][^>]*>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const tag = m[0] || ''
    const src = m[1] || ''
    const abs = toAbsoluteUrl(src, baseUrl)
    if (!abs) continue
    const lowerTag = tag.toLowerCase()
    const lowerUrl = abs.toLowerCase()

    const alt = (tag.match(/\salt=["']([^"']{0,120})["']/i)?.[1] || '').toLowerCase()
    const cls = (tag.match(/\sclass=["']([^"']{0,200})["']/i)?.[1] || '').toLowerCase()

    const looksProduct =
      alt.includes('商品') ||
      alt.includes('製品') ||
      alt.includes('プロダクト') ||
      alt.includes('product') ||
      alt.includes('item') ||
      cls.includes('product') ||
      cls.includes('item') ||
      cls.includes('goods') ||
      cls.includes('card') ||
      lowerUrl.includes('/product') ||
      lowerUrl.includes('/products') ||
      lowerUrl.includes('/item') ||
      lowerUrl.includes('/items') ||
      lowerUrl.includes('/goods') ||
      lowerUrl.includes('/sku') ||
      lowerUrl.includes('product') ||
      lowerUrl.includes('item')

    // svg/icon系は避ける（参考画像としては弱い）
    const isIconish = lowerUrl.endsWith('.svg') || lowerTag.includes('icon') || lowerTag.includes('logo')
    if (looksProduct && !isIconish) {
      urls.push(abs)
      if (urls.length >= 10) break
    }
  }
  return Array.from(new Set(urls)).slice(0, 10)
}

function rgbToHex(r: number, g: number, b: number): string {
  const to = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase()
}

async function fetchImageAsReferenceDataUrl(url: string, timeoutMs = 7000): Promise<string | null> {
  // 参照画像としてモデルに渡す用に軽量化（dataURL化）
  try {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), timeoutMs)
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DoyaBannerAI/1.0)' },
      signal: controller.signal,
    })
    clearTimeout(t)
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())

    // 画像が巨大な場合でもサーバ負荷/速度を抑えるため縮小
    const out = await sharp(buf)
      .rotate()
      .resize(640, 640, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 72, mozjpeg: true })
      .toBuffer()

    const b64 = out.toString('base64')
    // 参考画像は2枚まで使うので、1枚が大きすぎる場合は捨てる（安全側）
    if (b64.length > 900_000) return null // ~675KB
    return `data:image/jpeg;base64,${b64}`
  } catch {
    return null
  }
}

async function extractPaletteFromImages(urls: string[], timeoutMs = 6000): Promise<string[]> {
  const colors: string[] = []
  for (const u of urls) {
    try {
      const controller = new AbortController()
      const t = setTimeout(() => controller.abort(), timeoutMs)
      const res = await fetch(u, {
        method: 'GET',
        redirect: 'follow',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DoyaBannerAI/1.0)' },
        signal: controller.signal,
      })
      clearTimeout(t)
      if (!res.ok) continue
      const buf = Buffer.from(await res.arrayBuffer())
      // 小さくしてから統計（高速化）
      const stats = await sharp(buf).resize(128, 128, { fit: 'inside' }).stats()
      const d = (stats as any)?.dominant
      if (d && typeof d.r === 'number') {
        colors.push(rgbToHex(d.r, d.g, d.b))
      } else {
        // フォールバック：平均値
        const ch = stats.channels || []
        if (ch.length >= 3) colors.push(rgbToHex(ch[0].mean, ch[1].mean, ch[2].mean))
      }
    } catch {
      continue
    }
  }
  // 上位3色まで
  return Array.from(new Set(colors)).slice(0, 3)
}

async function extractPaletteViaVision(imageUrls: string[]): Promise<string[]> {
  const apiKey = getVisionApiKey()
  if (!apiKey) throw new Error('VISION_API_KEY is not set')
  const urls = Array.from(new Set(imageUrls.filter(Boolean))).slice(0, 6)
  if (urls.length === 0) return []

  const endpoint = `${VISION_API_BASE}/images:annotate?key=${encodeURIComponent(apiKey)}`
  const body = {
    requests: urls.map((u) => ({
      image: { source: { imageUri: u } },
      features: [{ type: 'IMAGE_PROPERTIES' }],
    })),
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout))

  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(`Vision API error: ${res.status} ${t.slice(0, 200)}`)
  }

  const json: any = await res.json()
  const responses: any[] = Array.isArray(json?.responses) ? json.responses : []

  const weights = new Map<string, number>()
  for (const r of responses) {
    const cols: any[] = r?.imagePropertiesAnnotation?.dominantColors?.colors || []
    for (const c of cols) {
      const rgb = c?.color
      if (!rgb || typeof rgb.red !== 'number') continue
      const hex = rgbToHex(rgb.red, rgb.green, rgb.blue)
      const score = typeof c.score === 'number' ? c.score : 0.5
      const frac = typeof c.pixelFraction === 'number' ? c.pixelFraction : 0.5
      const w = score * frac
      weights.set(hex, (weights.get(hex) || 0) + w)
    }
  }

  return Array.from(weights.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([hex]) => hex)
    .slice(0, 3)
}

export async function POST(request: NextRequest) {
  try {
    const disableLimits = process.env.DOYA_DISABLE_LIMITS === '1'
    const session = await getServerSession(authOptions)
    const isGuest = !session
    const currentMonth = getCurrentMonthJST() // 月次管理用 "YYYY-MM"
    const userId = !isGuest ? ((session?.user as any)?.id as string | undefined) : undefined

    const body = (await request.json()) as FromUrlRequest
    const targetUrl = safeTrim(body?.targetUrl || body?.target_url, 2000)
    const baseImageRaw =
      typeof (body as any)?.baseImage === 'string'
        ? (body as any).baseImage
        : (typeof (body as any)?.base_image === 'string' ? (body as any).base_image : '')
    const baseImage = typeof baseImageRaw === 'string' && baseImageRaw.startsWith('data:image/') ? baseImageRaw : ''
    const requestedSizeRaw = safeTrim(body?.size, 32) || '1080x1080'
    const category = safeTrim(body?.industry, 40) || 'other'
    const appPurpose = safeTrim(body?.purpose, 32) || 'sns_ad'
    const requestedCountRaw = Number(body?.count)
    const requestedCount = Number.isFinite(requestedCountRaw) ? Math.floor(requestedCountRaw) : 3
    const planRaw = !isGuest
      ? String((session?.user as any)?.bannerPlan || (session?.user as any)?.plan || 'FREE').toUpperCase()
      : 'GUEST'
    const isPaidUser = !isGuest && planRaw !== 'FREE'

    // 1時間生成し放題の判定（セッションから firstLoginAt を取得）
    const firstLoginAt = (session?.user as any)?.firstLoginAt
    const isFreeHourActive = !isGuest && isWithinFreeHour(firstLoginAt)

    // ==============================
    // 枚数/サイズの強制（改ざん対策）
    // - 無料/ゲスト：1〜3枚・1080x1080固定
    // - 有料または1時間生成し放題中：1〜10枚、サイズ指定可（範囲チェック）
    // ==============================
    const canUseUnlimited = isPaidUser || isFreeHourActive
    const desiredCount = canUseUnlimited
      ? Math.max(1, Math.min(10, requestedCount || 3))
      : Math.max(1, Math.min(3, requestedCount || 3))
    const size = canUseUnlimited ? (isValidSizeString(requestedSizeRaw) ? requestedSizeRaw : '1080x1080') : '1080x1080'

    if (!targetUrl || !isValidHttpUrl(targetUrl)) {
      return NextResponse.json({ error: 'URLが不正です（https://〜 を入力してください）' }, { status: 400 })
    }
    if (!isNanobannerConfigured()) {
      return NextResponse.json({ error: 'バナー生成APIが設定されていません。管理者にお問い合わせください。' }, { status: 503 })
    }

    // 月次上限（画像枚数）
    let guestUsage: GuestMonthlyUsage | null = null
    let usageInfo: null | { monthlyLimit: number; monthlyUsed: number; monthlyRemaining: number } = null

    if (!disableLimits) {
      if (isGuest) {
        // ゲストはCookieで使用量を管理（/api/banner/generate と共通Cookie）
        guestUsage = readGuestMonthlyUsage(request, currentMonth)
        const monthlyLimit = BANNER_PRICING.guestLimit
        const monthlyUsed = guestUsage.count
        usageInfo = { monthlyLimit, monthlyUsed, monthlyRemaining: Math.max(0, monthlyLimit - monthlyUsed) }

        if (monthlyUsed + desiredCount > monthlyLimit) {
          return NextResponse.json(
            {
              error: 'ゲストは今月分の生成上限を超えています。ログインしてご利用ください。',
              code: 'MONTHLY_LIMIT_REACHED',
              usage: usageInfo,
              upgradeUrl: '/auth/doyamarke/signin?callbackUrl=%2Fbanner',
            },
            { status: 429 }
          )
        }
      } else {
        // 1時間生成し放題中は月次上限チェックをスキップ
        if (!isFreeHourActive) {
          const monthlyLimit = getBannerMonthlyLimitByUserPlan(planRaw)
          if (userId && monthlyLimit !== -1) {
            const sub = await prisma.userServiceSubscription.findUnique({
              where: { userId_serviceId: { userId, serviceId: 'banner' } },
              select: { monthlyUsage: true, lastUsageReset: true, plan: true },
            })
            // 月が変わっていたらリセット（日本時間基準）
            let used = sub?.monthlyUsage || 0
            if (shouldResetMonthlyUsage(sub?.lastUsageReset)) {
              used = 0
              // DBもリセット（非同期で更新、エラーは握りつぶす）
              prisma.userServiceSubscription.update({
                where: { userId_serviceId: { userId, serviceId: 'banner' } },
                data: { monthlyUsage: 0, lastUsageReset: new Date() },
              }).catch(() => {})
            }
            if (used + desiredCount > monthlyLimit) {
              return NextResponse.json(
                {
                  error: '今月の生成上限に達しました。',
                  code: 'MONTHLY_LIMIT_REACHED',
                  usage: { monthlyLimit, monthlyUsed: used, monthlyRemaining: Math.max(0, monthlyLimit - used) },
                  upgradeUrl: planRaw === 'FREE' ? '/banner' : (HIGH_USAGE_CONTACT_URL || '/banner'),
                },
                { status: 429 }
              )
            }
          }
        }
      }
    }

    // URL からHTML取得
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12_000)
    let html = ''
    try {
      const res = await fetch(targetUrl, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; DoyaBannerAI/1.0; +https://doya-ai.vercel.app)',
          'Accept': 'text/html,application/xhtml+xml',
        },
        signal: controller.signal,
      })
      html = await res.text()
      if (!res.ok) {
        return NextResponse.json({ error: `URLの取得に失敗しました（status=${res.status}）` }, { status: 400 })
      }
    } catch (e: any) {
      return NextResponse.json({ error: `URLの取得に失敗しました（${e?.message || 'timeout'}）` }, { status: 400 })
    } finally {
      clearTimeout(timeout)
    }

    const meta = extractMeta(html)
    const pageText = stripHtmlToText(html)
    const colorHintsFromHtml = extractColorHints(html)
    const paletteFromCss = extractPaletteFromCss(html)
    // headless visual analysis（必須）：スクショのピクセル面積比で主要色を算出し、画像の種類/面積比も抽出
    const visual = await analyzeSiteVisualViaHeadless(targetUrl)
    const paletteFromHeadlessArea = (visual.colorsByArea || []).map((c) => String(c.hex || '').toUpperCase()).filter((c) => /^#[0-9A-F]{6}$/.test(c)).slice(0, 3)
    // 画像（OG/ICON + ページ内の主要img）から実色を抽出（補助：サイト全体の色とズレる場合もある）
    const imageCandidates = extractImageCandidates(html, targetUrl)
    const heroCandidates = extractLikelyHeroImages(html, targetUrl)
    const productCandidates = extractProductLikeImages(html, targetUrl)
    const imageSources = Array.from(new Set([...imageCandidates, ...heroCandidates, ...productCandidates])).slice(0, 8)
    const paletteFromImages = await extractPaletteFromImages(imageSources)
    const mergedPalette = Array.from(
      new Set([...(paletteFromHeadlessArea || []), ...(paletteFromCss || []), ...(paletteFromImages || [])].map((c) => String(c).toUpperCase()))
    )
      .filter((c) => /^#[0-9A-F]{6}$/.test(c))
      .slice(0, 3)
    const colorHints = [
      colorHintsFromHtml ? `html=${colorHintsFromHtml}` : '',
      paletteFromHeadlessArea.length > 0 ? `headless_area_palette=${paletteFromHeadlessArea.join(',')}` : '',
      paletteFromCss.length > 0 ? `css_palette=${paletteFromCss.slice(0, 3).join(',')}` : '',
      paletteFromImages.length > 0 ? `image_palette=${paletteFromImages.join(',')}` : '',
      imageSources.length > 0 ? `image_sources=${imageSources.slice(0, 2).join(',')}` : '',
    ]
      .filter(Boolean)
      .join(' / ')
    const visualHints = [
      visual?.colorSummaryText ? `colors_by_area=${visual.colorSummaryText}` : '',
      visual?.imageSummaryText ? `visual_image=${visual.imageSummaryText}` : '',
      productCandidates.length > 0 ? `product_image_candidates=${productCandidates.slice(0, 2).join(',')}` : '',
    ]
      .filter(Boolean)
      .join(' / ')

    const apiKey = getApiKey()
    const specPrompt = buildWebsiteBannerPrompt({
      target_url: targetUrl,
      size,
      language: 'ja',
      optional_assets: {
        logo_image: body.logoImage ? 'provided' : undefined,
        person_images: Array.isArray(body.personImages) ? body.personImages.length : 0,
      },
      brand_constraints: {
        main_color: body.mainColor || visual?.mainColor || mergedPalette[0],
        sub_color: body.subColor || (Array.isArray(visual?.subColors) ? visual?.subColors?.[0] : undefined) || mergedPalette[1],
        tone_keywords: body.toneKeywords,
      },
      compliance: { avoid: body.avoid, must_include: body.mustInclude },
      page_meta: meta,
      page_text: pageText,
      color_hints: colorHints,
      visual_hints: visualHints,
      inferred: inferBannerInfoFromText({ url: targetUrl, title: meta?.title, description: meta?.description, pageText }),
    })

    const structured = await callGeminiForJson(specPrompt, apiKey)
    const bannerAnalysis = safeTrim(structured?.banner_analysis, 6000)
    const imagePrompt = safeTrim(structured?.image_generation_prompt, 24000)
    // 互換: 旧promptでは negative_prompt を返していた。なければ空でOK。
    const negativePrompt = safeTrim(structured?.negative_prompt, 6000)

    if (!imagePrompt) {
      return NextResponse.json({ error: 'サイト解析はできましたが、画像生成プロンプトの生成に失敗しました。' }, { status: 500 })
    }

    // 画像生成（Nano Banana Pro）
    // サイト内の主要画像（商品/サービス画像など）を参照画像として渡し、バナーに“素材感”を反映させる
    const autoReferenceSources = Array.from(new Set([...productCandidates, ...imageCandidates, ...heroCandidates])).slice(0, 4)
    const autoReferenceImages: string[] = []
    for (const u of autoReferenceSources) {
      const dataUrl = await fetchImageAsReferenceDataUrl(u)
      if (dataUrl) autoReferenceImages.push(dataUrl)
      if (autoReferenceImages.length >= 2) break
    }

    const options = {
      purpose: appPurpose,
      logoImage: body.logoImage,
      // 人物写真は1名（1枚）に固定
      personImages: Array.isArray(body.personImages) ? body.personImages.slice(0, 1) : undefined,
      // 基準バナーが指定されている場合はそれを最優先の参照画像として渡す（似た形で再生成）
      // 明示指定(referenceImages)があればそれを優先。なければサイトから自動抽出した参照画像を使用。
      referenceImages: baseImage
        ? [baseImage, ...(autoReferenceImages.slice(0, 1) || [])]
        : (Array.isArray(body.referenceImages) && body.referenceImages.length > 0
            ? body.referenceImages
            : (autoReferenceImages.length > 0 ? autoReferenceImages : undefined)),
      // brandColors が未指定なら、抽出したパレットを使用（色抽出精度UP）
      brandColors: Array.isArray(body.brandColors)
        ? body.brandColors
        : (visual?.mainColor
            ? [visual.mainColor, ...(visual.subColors || [])].map((c) => String(c || '').toUpperCase()).filter((c) => /^#[0-9A-F]{6}$/.test(c)).slice(0, 3)
            : (mergedPalette.length > 0 ? mergedPalette : undefined)),
      // URLのみ入力のため、最終プロンプトをそのまま使用
      customImagePrompt: baseImage
        ? [
            imagePrompt,
            '',
            '=== BASE DESIGN MODE (SIMILAR REGENERATION) ===',
            'Use the FIRST provided reference image as the base design template.',
            '- Keep a similar overall layout / composition / spacing as the reference.',
            '- Do NOT copy it 1:1. Generate new originals that feel like variations made by the same designer.',
            '- Across multiple outputs, vary details (photo scene, accent shapes, CTA style, color accent) while staying in the same template.',
          ].join('\n')
        : imagePrompt,
      negativePrompt,
      variationMode: baseImage ? 'similar' : 'diverse',
    }

    // keyword は履歴/メタ用途。なければ title を採用（customImagePromptを使うので生成品質には影響しない）
    const keywordForMeta = safeTrim(meta.title, 80) || 'URL自動生成'
    const result = await generateBanners(category || 'other', keywordForMeta, size, options as any, desiredCount)

    // ==============================
    // 履歴保存（ログインユーザーのみ / DB）
    // ==============================
    if (!isGuest && userId) {
      try {
        const banners = Array.isArray(result.banners) ? result.banners : []
        const images = banners.filter((b) => typeof b === 'string' && b.startsWith('data:image/'))
        if (images.length > 0) {
          const nowIso = new Date().toISOString()
          const patterns = 'ABCDEFGHIJ'.split('')
          const batchId = crypto.randomUUID()
          const shared = body?.shareToGallery === true
          await prisma.generation.createMany({
            data: images.map((img: string, idx: number) => ({
              userId,
              serviceId: 'banner',
              input: {
                category,
                keyword: keywordForMeta,
                size,
                purpose: appPurpose || 'sns_ad',
                count: desiredCount,
                source: 'url',
                targetUrl,
                bannerPurpose: 'auto',
              },
              output: img,
              outputType: 'IMAGE',
              metadata: {
                batchId,
                category,
                purpose: appPurpose || 'sns_ad',
                size,
                keyword: keywordForMeta,
                targetUrl,
                bannerPurpose: 'auto',
                pattern: patterns[idx] || String(idx + 1),
                usedModel: result.usedModel || null,
                shared,
                ...(shared ? { sharedAt: nowIso, shareProfile: body?.shareProfile === true } : {}),
              },
            })),
          })
        }
      } catch (e: any) {
        console.error('from-url history persist failed:', e)
      }
    }

    // ==============================
    // 使用回数加算（画像枚数ベース）
    // ==============================
    const chargedCount = Math.max(
      1,
      Math.min(
        desiredCount,
        Array.isArray(result.banners) ? result.banners.filter((b) => typeof b === 'string' && b.startsWith('data:image/')).length : desiredCount
      )
    )

    // ゲストの場合: Cookie を更新
    if (!disableLimits && isGuest && guestUsage) {
      guestUsage = { date: currentMonth, count: guestUsage.date === currentMonth ? guestUsage.count + chargedCount : chargedCount }
      if (usageInfo) {
        usageInfo = {
          monthlyLimit: usageInfo.monthlyLimit,
          monthlyUsed: guestUsage.count,
          monthlyRemaining: usageInfo.monthlyLimit === -1 ? -1 : Math.max(0, usageInfo.monthlyLimit - guestUsage.count),
        }
      }
    }

    // ログインユーザーの場合: DB を更新（月間のみ）
    if (!disableLimits && !isGuest && userId) {
      try {
        await prisma.userServiceSubscription.update({
          where: { userId_serviceId: { userId, serviceId: 'banner' } },
          data: { monthlyUsage: { increment: chargedCount } },
        }).catch(() => {})
      } catch (e: any) {
        console.error('from-url usage increment failed:', e)
      }
    }

    // レスポンス
    // - bannerAnalysis: 解析結果（テキスト）
    // - analysisJson: UI互換用（legacy）に key_message / cta / tone を切り出して返す
    const legacyAnalysisJson = {
      key_message: bannerAnalysis || undefined,
      cta: undefined as string | undefined,
      tone: undefined as string | undefined,
    }
    // bannerAnalysis からCTA/トーンの推定（簡易パース）
    const ctaMatch = String(bannerAnalysis || '').match(/(CTA|アクション)[：:]\s*(.{2,30})/i)
    if (ctaMatch) legacyAnalysisJson.cta = ctaMatch[2].split(/[、。]/)[0].trim()
    const toneMatch = String(bannerAnalysis || '').match(/(トーン|雰囲気)[：:]\s*(.{2,20})/i)
    if (toneMatch) legacyAnalysisJson.tone = toneMatch[2].split(/[、。]/)[0].trim()

    const res = NextResponse.json({
      banners: result.banners,
      bannerAnalysis: bannerAnalysis || undefined,
      analysisJson: legacyAnalysisJson, // UI互換
      imagePrompt,
      negativePrompt,
      usedModel: result.usedModel || undefined,
      usedModelDisplay: result.usedModel ? getModelDisplayName(result.usedModel) : undefined,
      usage: usageInfo || undefined,
      warning: result.error || undefined,
    })

    // ゲストの場合: Cookie をセット
    if (!disableLimits && isGuest && guestUsage) {
      res.cookies.set(BANNER_GUEST_USAGE_COOKIE, JSON.stringify(guestUsage), {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 2, // 2日
      })
    }

    return res
  } catch (e: any) {
    console.error('from-url error:', e)
    return NextResponse.json({ error: e?.message || 'URLからの自動生成に失敗しました' }, { status: 500 })
  }
}


