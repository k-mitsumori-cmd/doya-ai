import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { BANNER_PROMPTS_V2 } from '@/lib/banner-prompts-v2'

export const runtime = 'nodejs'
export const maxDuration = 300

// Google AI API設定
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

// 新規追加する22個のテンプレートID
const NEW_TEMPLATE_IDS = [
  'new-branding-001',
  'new-showroom-001',
  'new-copywriter-001',
  'new-philosophy-001',
  'new-rebranding-001',
  'new-creative-001',
  'new-strategy-001',
  'new-recruit-001',
  'new-book-001',
  'new-webinar-001',
  'new-marketing-001',
  'new-crm-001',
  'new-sales-001',
  'new-dream-001',
  'new-ga4-001',
  'new-director-001',
  'new-crisis-001',
  'new-design-value-001',
  'new-interview-001',
  'new-btob-001',
  'new-featured-001',
  'new-sales-overview-001',
]

async function generateImage(prompt: string, apiKey: string): Promise<string> {
  const model = 'gemini-2.0-flash-exp'
  const endpoint = `${GEMINI_API_BASE}/models/${model}:generateContent`
  
  const requestBody = {
    contents: [{
      role: 'user',
      parts: [{
        text: `${prompt}

=== MANDATORY OUTPUT CONSTRAINTS ===
**TARGET SIZE: 1200x628 pixels (width x height)**
**ASPECT RATIO: 1.91:1**

CRITICAL REQUIREMENTS:
- Generate image with 1.91:1 aspect ratio (standard banner format).
- Fill the entire canvas edge-to-edge with content.
- NO letterboxing, NO empty bars, NO padding, NO borders.
- DO NOT include any company logos, brand names, or specific company text.
- Use placeholder text or generic headlines only.
- Japanese text must be PERFECTLY CORRECT and READABLE.
- If you cannot render Japanese text correctly, DO NOT include any text.

Return ONE PNG image.`
      }]
    }],
    generationConfig: {
      responseModalities: ['IMAGE'],
      temperature: 0.7,
      candidateCount: 1,
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
    ],
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Image generation failed: ${response.status} - ${errorText.substring(0, 200)}`)
  }

  const result = await response.json()
  
  // 画像データを抽出
  const candidates = result?.candidates || []
  for (const candidate of candidates) {
    const parts = candidate?.content?.parts || []
    for (const part of parts) {
      if (part?.inlineData?.mimeType?.startsWith('image/')) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
      }
    }
  }
  
  throw new Error('No image generated')
}

// POST: 新規テンプレートをバッチ生成
export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_GENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
    }

    const body = await request.json().catch(() => ({}))
    const { templateIds, limit = 5 } = body as { templateIds?: string[], limit?: number }

    // 対象テンプレートを決定
    const targetIds = templateIds || NEW_TEMPLATE_IDS
    const newPrompts = BANNER_PROMPTS_V2.filter(p => targetIds.includes(p.id))
    
    if (newPrompts.length === 0) {
      return NextResponse.json({ error: 'No matching templates found' }, { status: 404 })
    }

    // 既存のテンプレートを除外
    const existingTemplates = await prisma.bannerTemplate.findMany({
      where: { templateId: { in: targetIds } },
      select: { templateId: true }
    })
    const existingIds = new Set(existingTemplates.map(t => t.templateId))
    
    const pendingPrompts = newPrompts.filter(p => !existingIds.has(p.id)).slice(0, limit)
    
    if (pendingPrompts.length === 0) {
      return NextResponse.json({ 
        message: 'All templates already exist',
        existing: existingIds.size,
        total: targetIds.length
      })
    }

    console.log(`[Generate Batch] Generating ${pendingPrompts.length} templates...`)
    
    const results: { id: string; status: 'success' | 'error'; error?: string }[] = []

    for (const prompt of pendingPrompts) {
      console.log(`[Generate Batch] Processing: ${prompt.id}`)
      
      try {
        // 画像生成
        const imageData = await generateImage(prompt.fullPrompt, apiKey)
        console.log(`[Generate Batch] Image generated for ${prompt.id}`)

        // データベースに保存
        await prisma.bannerTemplate.create({
          data: {
            templateId: prompt.id,
            industry: prompt.genre,
            category: prompt.category,
            prompt: prompt.fullPrompt,
            size: '1200x628',
            imageUrl: imageData,
            previewUrl: imageData,
            isFeatured: false,
            isActive: true,
          }
        })
        
        results.push({ id: prompt.id, status: 'success' })
        
        // レート制限対策: 2秒待機
        await new Promise(resolve => setTimeout(resolve, 2000))
        
      } catch (error: any) {
        console.error(`[Generate Batch] Error for ${prompt.id}:`, error.message)
        results.push({ id: prompt.id, status: 'error', error: error.message })
        
        // エラー時は5秒待機
        await new Promise(resolve => setTimeout(resolve, 5000))
      }
    }

    const successCount = results.filter(r => r.status === 'success').length
    const errorCount = results.filter(r => r.status === 'error').length

    return NextResponse.json({
      message: `Generated ${successCount} templates`,
      results,
      summary: {
        success: successCount,
        error: errorCount,
        existing: existingIds.size,
        pending: newPrompts.length - existingIds.size - pendingPrompts.length,
      }
    })

  } catch (error: any) {
    console.error('[Generate Batch] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// GET: 生成状況を確認
export async function GET() {
  try {
    const existingTemplates = await prisma.bannerTemplate.findMany({
      where: { templateId: { in: NEW_TEMPLATE_IDS } },
      select: { templateId: true, isActive: true, createdAt: true }
    })

    const existingIds = existingTemplates.map(t => t.templateId)
    const pendingIds = NEW_TEMPLATE_IDS.filter(id => !existingIds.includes(id))

    return NextResponse.json({
      total: NEW_TEMPLATE_IDS.length,
      generated: existingIds.length,
      pending: pendingIds.length,
      existingTemplates: existingTemplates.map(t => ({
        id: t.templateId,
        isActive: t.isActive,
        createdAt: t.createdAt
      })),
      pendingTemplates: pendingIds
    })
  } catch (error: any) {
    console.error('[Generate Batch GET] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
