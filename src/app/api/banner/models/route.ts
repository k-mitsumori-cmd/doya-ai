import { NextRequest, NextResponse } from 'next/server'
import { isNanobannerConfigured } from '@/lib/nanobanner'
import { requireBannerAdmin } from '@/lib/banner-admin-guard'

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

function getApiKey(): string | null {
  return (
    process.env.GOOGLE_GENAI_API_KEY ||
    process.env.GOOGLE_AI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.NANOBANNER_API_KEY ||
    null
  )
}

export async function GET(request: NextRequest) {
  const denied = requireBannerAdmin(request)
  if (denied) return denied
  try {
    if (!isNanobannerConfigured()) {
      return NextResponse.json(
        { error: 'APIキーが未設定です（GOOGLE_GENAI_API_KEY など）' },
        { status: 503 }
      )
    }

    const apiKey = getApiKey()
    if (!apiKey) {
      return NextResponse.json({ error: 'APIキーが未設定です' }, { status: 503 })
    }

    const res = await fetch(`${GEMINI_API_BASE}/models`, {
      method: 'GET',
      headers: {
        'x-goog-api-key': apiKey,
      },
    })
    if (!res.ok) {
      console.error('[Banner models] ListModels failed:', res.status)
      return NextResponse.json(
        { error: 'AIモデル一覧を取得できませんでした。' },
        { status: 502 }
      )
    }

    const json = await res.json()
    const models = Array.isArray(json?.models) ? json.models : []

    // “画像生成っぽい”候補（名前に banana/image が含まれ、generateContent対応のものを優先）
    const candidates = models
      .filter((m: any) => Array.isArray(m?.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
      .map((m: any) => String(m?.name || ''))
      .filter(Boolean)

    const imageCandidates = candidates.filter((n: string) => {
      const l = n.toLowerCase()
      return l.includes('banana') || l.includes('image')
    })

    return NextResponse.json({
      suggestedImageModels: imageCandidates,
      allGenerateContentModels: candidates,
      allModels: models.map((m: any) => ({ name: m?.name, supportedGenerationMethods: m?.supportedGenerationMethods })),
    })
  } catch (e: any) {
    console.error('[Banner models] Unexpected failure:', e)
    return NextResponse.json({ error: 'AIモデル一覧を取得できませんでした。' }, { status: 500 })
  }
}

