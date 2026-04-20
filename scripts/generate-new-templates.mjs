#!/usr/bin/env node
/**
 * 新規テンプレート画像生成スクリプト
 * 
 * 使用方法:
 * node scripts/generate-new-templates.mjs
 * 
 * 環境変数:
 * - DATABASE_URL: PostgreSQL接続URL
 * - GOOGLE_GENAI_API_KEY: Google AI Studio APIキー
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

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

// Google AI API設定
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

async function generateImage(prompt, apiKey) {
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

async function main() {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY
  if (!apiKey) {
    console.error('Error: GOOGLE_GENAI_API_KEY is not set')
    process.exit(1)
  }

  console.log('Loading BANNER_PROMPTS_V2...')
  
  // 動的インポート
  const { BANNER_PROMPTS_V2 } = await import('../src/lib/banner-prompts-v2.ts')
  
  // 新規テンプレートのみ抽出
  const newPrompts = BANNER_PROMPTS_V2.filter(p => NEW_TEMPLATE_IDS.includes(p.id))
  console.log(`Found ${newPrompts.length} new templates to generate`)

  let successCount = 0
  let errorCount = 0

  for (const prompt of newPrompts) {
    console.log(`\n[${successCount + errorCount + 1}/${newPrompts.length}] Generating: ${prompt.id} (${prompt.displayTitle})`)
    
    try {
      // 既にDBに存在するかチェック
      const existing = await prisma.bannerTemplate.findUnique({
        where: { templateId: prompt.id }
      })
      
      if (existing) {
        console.log(`  → Already exists, skipping...`)
        successCount++
        continue
      }

      // 画像生成
      console.log(`  → Generating image...`)
      const imageData = await generateImage(prompt.fullPrompt, apiKey)
      console.log(`  → Image generated (${Math.round(imageData.length / 1024)}KB)`)

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
      
      console.log(`  → Saved to database`)
      successCount++
      
      // レート制限対策: 3秒待機
      await new Promise(resolve => setTimeout(resolve, 3000))
      
    } catch (error) {
      console.error(`  → Error: ${error.message}`)
      errorCount++
      
      // エラー時は10秒待機
      await new Promise(resolve => setTimeout(resolve, 10000))
    }
  }

  console.log(`\n========================================`)
  console.log(`Generation complete!`)
  console.log(`  Success: ${successCount}`)
  console.log(`  Errors: ${errorCount}`)
  console.log(`========================================`)

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
