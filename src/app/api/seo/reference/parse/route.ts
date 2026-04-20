import { NextRequest, NextResponse } from 'next/server'
import { ensureSeoSchema } from '@seo/lib/bootstrap'
import { geminiGenerateJson, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
import { z } from 'zod'

export const runtime = 'nodejs'
export const maxDuration = 60

const BodySchema = z.object({
  // 参考記事（URL/貼り付け/ファイル）のいずれか
  url: z.string().url().optional(),
  text: z.string().max(300_000).optional(),
  titleHint: z.string().max(200).optional(),
})

function extractHeadingsFromText(text: string): { h2: string[]; h3: string[] } {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n')
  const h2: string[] = []
  const h3: string[] = []
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    // Markdown形式
    const m2 = line.match(/^##\s+(.+?)\s*$/)
    if (m2) {
      const t = m2[1].trim()
      if (t && !h2.includes(t)) h2.push(t)
      continue
    }
    const m3 = line.match(/^###\s+(.+?)\s*$/)
    if (m3) {
      const t = m3[1].trim()
      if (t && !h3.includes(t)) h3.push(t)
      continue
    }
    // 日本語見出しっぽい行（短く、末尾に句点が少ない）
    if (line.length <= 40 && !/[。！？]$/.test(line) && (/^【.+】$/.test(line) || /^(?:\d+\.|・|■|▼)/.test(line))) {
      const t = line.replace(/^(?:\d+\.|・|■|▼)\s*/, '').replace(/^【|】$/g, '').trim()
      if (t && !h2.includes(t)) h2.push(t)
    }
    if (h2.length >= 40 && h3.length >= 60) break
  }
  return { h2: h2.slice(0, 50), h3: h3.slice(0, 80) }
}

export async function POST(req: NextRequest) {
  try {
    await ensureSeoSchema()
    const body = BodySchema.parse(await req.json())
    if (!body.url && !body.text) {
      return NextResponse.json({ success: false, error: 'url または text が必要です' }, { status: 400 })
    }

    let url = body.url || null
    let title = body.titleHint || null
    let extractedText = body.text || ''

    if (url) {
      // 軽量に本文抽出（HTML想定）
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; DoyaSeoBot/1.0; +https://example.invalid) AppleWebKit/537.36 (KHTML, like Gecko)',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        cache: 'no-store',
      })
      const html = await res.text()
      if (!title) {
        const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
        if (m) title = String(m[1]).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200)
      }
      extractedText = html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 250_000)
    }

    const headings = extractHeadingsFromText(extractedText)

    // 比較記事テンプレ生成のための「軸抽出」をAIに依頼（UIプレビュー用）
    const model = GEMINI_TEXT_MODEL_DEFAULT

    const prompt = [
      'You are a Japanese SEO editor specializing in comparison articles.',
      'From the reference article text, extract a reusable comparison template.',
      '',
      'Output STRICT JSON only. No markdown. No extra text.',
      '',
      'JSON schema:',
      '{',
      '  "axes": string[],',
      '  "tables": string[],',
      '  "faq": string[],',
      '  "summary": string,',
      '  "scoringCriteria": string[]',
      '}',
      '',
      `Title hint: ${title || ''}`,
      `URL: ${url || ''}`,
      '',
      'Reference (truncated):',
      extractedText.slice(0, 60000),
    ].join('\n')

    let template: any = null
    try {
      template = await geminiGenerateJson<any>(
        { model, prompt, generationConfig: { temperature: 0.2, maxOutputTokens: 2048 } },
        'COMPARISON_TEMPLATE_JSON'
      )
    } catch {
      template = { axes: [], tables: [], faq: [], summary: '', scoringCriteria: [] }
    }

    return NextResponse.json({
      success: true,
      url,
      title,
      headings,
      template,
      usedModel: model,
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '不明なエラー' }, { status: 400 })
  }
}


