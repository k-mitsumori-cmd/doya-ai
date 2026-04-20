/**
 * POST /api/allinone/analysis/[id]/regenerate
 * 特定セクションだけ再生成（SEO / ペルソナ / ブランディング / ビジュアル / アクション / サマリー）
 * body: { section: 'site' | 'seo' | 'persona' | 'branding' | 'visual' | 'action' | 'summary', verbose?: boolean }
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { callClaude } from '@/lib/allinone/claude'
import {
  SYSTEM_ANALYST,
  SYSTEM_PERSONA,
  SYSTEM_BRANDING,
  SYSTEM_VISUAL,
  SYSTEM_ACTION,
  SYSTEM_SUMMARY,
  buildSitePrompt,
  buildSeoPrompt,
  buildPersonaPrompt,
  buildBrandingPrompt,
  buildVisualPrompt,
  buildActionPrompt,
  buildSummaryPrompt,
} from '@/lib/allinone/prompts'
import { scrapeUrl } from '@/lib/allinone/scrape'
import { generateImage } from '@/lib/allinone/imageGen'

export const runtime = 'nodejs'
export const maxDuration = 180
export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  let body: { section?: string; verbose?: boolean }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400 })
  }
  const section = body.section
  if (!section) return new Response(JSON.stringify({ error: 'section required' }), { status: 400 })

  const a = await prisma.allinoneAnalysis.findUnique({ where: { id: params.id } })
  if (!a) return new Response('not found', { status: 404 })

  // scrape を毎回再取得してもいいが、速度優先で既存の state を活用する。
  // ただし最新の scrape 情報を取ってきて頑健に
  const scrape = await scrapeUrl(a.url).catch(() => null)
  if (!scrape) return new Response(JSON.stringify({ error: 'scrape failed' }), { status: 500 })

  const patch: any = {}

  if (section === 'site') {
    const { json } = await callClaude({
      systemPrompt: SYSTEM_ANALYST,
      messages: [{ role: 'user', content: buildSitePrompt(scrape, { mobile: null, desktop: null }) }],
      model: 'power',
      jsonMode: true,
      maxTokens: 3500,
    })
    if (!json) return new Response('ai failed', { status: 500 })
    patch.siteAnalysis = { ...(a.siteAnalysis as any), ...json }
  } else if (section === 'seo') {
    const { json } = await callClaude({
      systemPrompt: SYSTEM_ANALYST,
      messages: [{ role: 'user', content: buildSeoPrompt(scrape, a.targetKw || undefined) }],
      model: 'power',
      jsonMode: true,
      maxTokens: 3500,
    })
    if (!json) return new Response('ai failed', { status: 500 })
    patch.seoAnalysis = json
  } else if (section === 'persona') {
    const { json } = await callClaude({
      systemPrompt: SYSTEM_PERSONA,
      messages: [{ role: 'user', content: buildPersonaPrompt(scrape, a.targetKw || undefined) }],
      model: 'power',
      jsonMode: true,
      maxTokens: 3000,
      temperature: 0.85,
    })
    if (!json?.personas) return new Response('ai failed', { status: 500 })
    patch.personas = json.personas
  } else if (section === 'branding') {
    const { json } = await callClaude({
      systemPrompt: SYSTEM_BRANDING,
      messages: [{ role: 'user', content: buildBrandingPrompt(scrape) }],
      model: 'power',
      jsonMode: true,
      maxTokens: 1800,
    })
    if (!json) return new Response('ai failed', { status: 500 })
    patch.branding = json
  } else if (section === 'visual') {
    const branding = (a.branding as any) || {}
    const { json } = await callClaude({
      systemPrompt: SYSTEM_VISUAL,
      messages: [
        {
          role: 'user',
          content: buildVisualPrompt(scrape, branding.tone || '', branding.palette || scrape.mainColors),
        },
      ],
      model: 'power',
      jsonMode: true,
      maxTokens: 2500,
      temperature: 0.9,
    })
    const rawList: any[] = json?.visuals || []
    // 画像生成も順次
    for (const v of rawList) {
      try {
        const img = await generateImage({
          prompt: v.prompt,
          aspectRatio: '16:9',
          style: 'brand',
        })
        v.imageUrl = img.dataUrl
      } catch {
        /* noop */
      }
    }
    patch.keyVisuals = rawList
  } else if (section === 'action') {
    const context = JSON.stringify({
      summary: a.summary,
      site: a.siteAnalysis,
      seo: a.seoAnalysis,
      personas: a.personas,
      branding: a.branding,
    }).slice(0, 8000)
    const { json } = await callClaude({
      systemPrompt: SYSTEM_ACTION,
      messages: [{ role: 'user', content: buildActionPrompt(context) }],
      model: 'power',
      jsonMode: true,
      maxTokens: 3500,
    })
    if (!json?.actions) return new Response('ai failed', { status: 500 })
    patch.actionPlan = json.actions
  } else if (section === 'summary') {
    const context = JSON.stringify({
      site: a.siteAnalysis,
      seo: a.seoAnalysis,
      personas: a.personas,
      branding: a.branding,
      actionPlan: a.actionPlan,
    }).slice(0, 8000)
    const { json } = await callClaude({
      systemPrompt: SYSTEM_SUMMARY,
      messages: [{ role: 'user', content: buildSummaryPrompt(context) }],
      model: 'power',
      jsonMode: true,
      maxTokens: 2000,
    })
    if (!json) return new Response('ai failed', { status: 500 })
    patch.summary = json
    if (typeof json.overallScore === 'number') patch.overallScore = json.overallScore
    if (json.radar) patch.radar = json.radar
  } else {
    return new Response(JSON.stringify({ error: 'unknown section' }), { status: 400 })
  }

  await prisma.allinoneAnalysis.update({ where: { id: a.id }, data: patch })
  return Response.json({ ok: true, section, patch })
}
