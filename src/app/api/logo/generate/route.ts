import { NextRequest, NextResponse } from 'next/server'
import { generateText } from '@/lib/openai'

import { DoyaLogoInputSchema } from '../../../../../LOGO/generator/types'
import { generatePaletteSet } from '../../../../../LOGO/generator/paletteGenerator'
import { buildExplainPrompt } from '../../../../../LOGO/generator/prompt'
import { exportProjectToDisk } from '../../../../../LOGO/generator/exportManager'
import { generateLogoProject } from '../../../../../LOGO/generator/logoGenerator'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type ReturnMode = 'zip' | 'json'

function isReturnMode(v: unknown): v is ReturnMode {
  return v === 'zip' || v === 'json'
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'リクエスト形式が不正です' }, { status: 400 })
    }

    const parsed = DoyaLogoInputSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: '入力が不正です', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const returnMode: ReturnMode = isReturnMode((body as any).returnMode) ? (body as any).returnMode : 'zip'
    const useAI = Boolean((body as any).useAI)

    const input = parsed.data
    const palettes = generatePaletteSet(input)
    const project = await generateLogoProject({ input, palettes })

    // Optional: make "reasons" richer with OpenAI (if configured)
    if (useAI && process.env.OPENAI_API_KEY) {
      for (const p of project.patterns) {
        const prompt = buildExplainPrompt({
          input,
          patternId: p.id,
          patternTitle: p.title,
          patternDescription: p.description,
          palette: p.palette,
        })
        try {
          const ai = await generateText(prompt, {})
          if (ai && ai.trim().length > 40) p.reasons = ai.trim()
        } catch {
          // fallback to base reasons
        }
      }
    }

    if (returnMode === 'json') {
      const preview = project.patterns.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        palette: p.palette,
        reasons: p.reasons,
        growthStory: p.growthStory,
        oneLiner: p.oneLiner,
        trademarkNote: p.trademarkNote,
        logos: p.logos.map((l) => ({
          layout: l.layout,
          mode: l.mode,
          svg: l.svg.content,
        })),
      }))
      return NextResponse.json(
        {
          success: true,
          meta: project.meta,
          guidelineMarkdown: project.guidelineMarkdown,
          paletteMarkdown: project.paletteMarkdown,
          patterns: preview,
        },
        { headers: { 'Cache-Control': 'no-store' } }
      )
    }

    // zip mode
    const { zipPath } = await exportProjectToDisk(project)
    const buf = await import('node:fs/promises').then((m) => m.readFile(zipPath))
    const filename = `${project.meta.serviceSlug}-logo-kit.zip`

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || '不明なエラー' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { generateText } from '@/lib/openai'

import { DoyaLogoInputSchema } from '../../../../../LOGO/generator/types'
import { generatePaletteSet } from '../../../../../LOGO/generator/paletteGenerator'
import { buildExplainPrompt } from '../../../../../LOGO/generator/prompt'
import { exportProjectToDisk } from '../../../../../LOGO/generator/exportManager'
import { generateLogoProject } from '../../../../../LOGO/generator/logoGenerator'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type ReturnMode = 'zip' | 'json'

function isReturnMode(v: unknown): v is ReturnMode {
  return v === 'zip' || v === 'json'
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'リクエスト形式が不正です' }, { status: 400 })
    }

    const parsed = DoyaLogoInputSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: '入力が不正です', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const returnMode: ReturnMode = isReturnMode((body as any).returnMode) ? (body as any).returnMode : 'zip'
    const useAI = Boolean((body as any).useAI)

    const input = parsed.data
    const palettes = generatePaletteSet(input)
    const project = await generateLogoProject({ input, palettes })

    // Optional: make "reasons" richer with OpenAI (if configured)
    if (useAI && process.env.OPENAI_API_KEY) {
      for (const p of project.patterns) {
        const prompt = buildExplainPrompt({
          input,
          patternId: p.id,
          patternTitle: p.title,
          patternDescription: p.description,
          palette: p.palette,
        })
        try {
          const ai = await generateText(prompt, {})
          if (ai && ai.trim().length > 40) p.reasons = ai.trim()
        } catch {
          // fallback to base reasons
        }
      }
    }

    if (returnMode === 'json') {
      // lightweight preview payload (include SVG only)
      const preview = project.patterns.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        palette: p.palette,
        reasons: p.reasons,
        growthStory: p.growthStory,
        oneLiner: p.oneLiner,
        trademarkNote: p.trademarkNote,
        logos: p.logos.map((l) => ({
          layout: l.layout,
          mode: l.mode,
          svg: l.svg.content,
        })),
      }))
      return NextResponse.json(
        {
          success: true,
          meta: project.meta,
          guidelineMarkdown: project.guidelineMarkdown,
          paletteMarkdown: project.paletteMarkdown,
          patterns: preview,
        },
        { headers: { 'Cache-Control': 'no-store' } }
      )
    }

    // zip mode
    const { zipPath } = await exportProjectToDisk(project)
    const buf = await import('node:fs/promises').then((m) => m.readFile(zipPath))
    const filename = `${project.meta.serviceSlug}-logo-kit.zip`

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || '不明なエラー' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}


