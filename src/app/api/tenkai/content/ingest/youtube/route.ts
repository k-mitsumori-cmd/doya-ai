// ============================================
// POST /api/tenkai/content/ingest/youtube
// ============================================
// YouTube URL → トランスクリプト取得 → TenkaiProject作成
// 3段階フォールバック: HTMLパース → Innertube API → timedtext直接アクセス

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { incrementProjectCount } from '@/lib/tenkai/access'

const YOUTUBE_URL_REGEX =
  /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/

const bodySchema = z.object({
  url: z.string().regex(YOUTUBE_URL_REGEX, 'YouTube URLの形式が正しくありません'),
  projectId: z.string().optional(),
})

/** 字幕トラック情報 */
interface CaptionTrack {
  baseUrl: string
  languageCode: string
  vssId?: string
  name?: { simpleText?: string }
  kind?: string
}

/**
 * YouTube動画IDを抽出
 */
function extractVideoId(url: string): string | null {
  const match = url.match(YOUTUBE_URL_REGEX)
  return match ? match[1] : null
}

/**
 * 字幕XMLからテキストを抽出する共通処理
 */
function parseTranscriptXml(xml: string): string[] {
  const segments: string[] = []
  const matches = xml.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)
  for (const m of matches) {
    const decoded = m[1]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n/g, ' ')
      .trim()
    if (decoded) segments.push(decoded)
  }
  return segments
}

/**
 * 日本語トラックを優先して選択
 */
function selectBestTrack(tracks: CaptionTrack[]): CaptionTrack | null {
  if (tracks.length === 0) return null
  // 日本語を優先
  const ja = tracks.find(
    (t) => t.languageCode === 'ja' || t.vssId?.includes('.ja')
  )
  if (ja) return ja
  // 手動字幕を自動生成より優先
  const manual = tracks.find((t) => t.kind !== 'asr')
  return manual || tracks[0]
}

/**
 * 方法1: YouTube動画ページHTMLからcaptionTracksを抽出
 */
async function fetchViaHtmlParse(
  videoId: string
): Promise<{ tracks: CaptionTrack[]; playerResponse?: string }> {
  const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'ja,en;q=0.9',
    },
  })

  if (!pageRes.ok) {
    throw new Error('YouTube動画ページの取得に失敗しました')
  }

  const html = await pageRes.text()

  // captionTracks から字幕URLを抽出
  const captionMatch = html.match(/"captionTracks":(\[.*?\])/)
  if (!captionMatch) {
    return { tracks: [], playerResponse: html }
  }

  try {
    const tracks: CaptionTrack[] = JSON.parse(captionMatch[1])
    return { tracks, playerResponse: html }
  } catch {
    return { tracks: [], playerResponse: html }
  }
}

/**
 * 方法2: YouTube Innertube API (player endpoint)
 */
async function fetchViaInnertubeApi(
  videoId: string
): Promise<CaptionTrack[]> {
  const payload = {
    context: {
      client: {
        clientName: 'WEB',
        clientVersion: '2.20240101.01.00',
        hl: 'ja',
        gl: 'JP',
      },
    },
    videoId,
  }

  const res = await fetch(
    'https://www.youtube.com/youtubei/v1/player?prettyPrint=false',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  )

  if (!res.ok) return []

  const data = await res.json()
  const captionTracks =
    data?.captions?.playerCaptionsTracklistRenderer?.captionTracks
  if (!Array.isArray(captionTracks)) return []

  return captionTracks.map((t: Record<string, unknown>) => ({
    baseUrl: String(t.baseUrl || ''),
    languageCode: String(t.languageCode || ''),
    vssId: typeof t.vssId === 'string' ? t.vssId : undefined,
    kind: typeof t.kind === 'string' ? t.kind : undefined,
    name: t.name as CaptionTrack['name'],
  }))
}

/**
 * 方法3: timedtext API直接アクセス（最終フォールバック）
 */
async function fetchViaTimedtextApi(
  videoId: string,
  lang: string = 'ja'
): Promise<string[]> {
  // timedtext APIに直接アクセス
  const urls = [
    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=srv3`,
    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}`,
    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=srv3`,
    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en`,
  ]

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      })
      if (!res.ok) continue

      const xml = await res.text()
      if (!xml || xml.length < 50) continue

      const segments = parseTranscriptXml(xml)
      if (segments.length > 0) return segments
    } catch {
      continue
    }
  }

  return []
}

/**
 * YouTube動画タイトルを取得
 */
async function fetchVideoTitle(videoId: string): Promise<string> {
  try {
    const oembedRes = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    )
    if (oembedRes.ok) {
      const oembed = await oembedRes.json()
      return oembed.title || ''
    }
  } catch {
    // タイトル取得失敗は致命的ではない
  }
  return ''
}

/**
 * 3段階フォールバックでYouTube字幕を取得
 */
async function fetchYouTubeTranscript(
  videoId: string
): Promise<{ text: string; title: string; method: string }> {
  const title = await fetchVideoTitle(videoId)

  // === 方法1: HTMLパースからcaptionTracks抽出 ===
  try {
    const { tracks } = await fetchViaHtmlParse(videoId)
    if (tracks.length > 0) {
      const track = selectBestTrack(tracks)
      if (track?.baseUrl) {
        const captionRes = await fetch(track.baseUrl)
        if (captionRes.ok) {
          const xml = await captionRes.text()
          const segments = parseTranscriptXml(xml)
          if (segments.length > 0) {
            return {
              text: segments.join('\n'),
              title: title || `YouTube動画 (${videoId})`,
              method: 'html_parse',
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn('[tenkai] YouTube HTML parse failed:', e instanceof Error ? e.message : 'unknown')
  }

  // === 方法2: Innertube API ===
  try {
    const tracks = await fetchViaInnertubeApi(videoId)
    if (tracks.length > 0) {
      const track = selectBestTrack(tracks)
      if (track?.baseUrl) {
        const captionRes = await fetch(track.baseUrl)
        if (captionRes.ok) {
          const xml = await captionRes.text()
          const segments = parseTranscriptXml(xml)
          if (segments.length > 0) {
            return {
              text: segments.join('\n'),
              title: title || `YouTube動画 (${videoId})`,
              method: 'innertube_api',
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn('[tenkai] YouTube Innertube API failed:', e instanceof Error ? e.message : 'unknown')
  }

  // === 方法3: timedtext API直接アクセス ===
  try {
    const segments = await fetchViaTimedtextApi(videoId)
    if (segments.length > 0) {
      return {
        text: segments.join('\n'),
        title: title || `YouTube動画 (${videoId})`,
        method: 'timedtext_api',
      }
    }
  } catch (e) {
    console.warn('[tenkai] YouTube timedtext API failed:', e instanceof Error ? e.message : 'unknown')
  }

  throw new Error(
    'この動画の字幕を取得できませんでした。字幕が有効になっているか確認するか、テキスト入力をお試しください。'
  )
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id

    const body = await req.json()
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'YouTube URLが正しくありません', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const videoId = extractVideoId(parsed.data.url)
    if (!videoId) {
      return NextResponse.json(
        { error: 'YouTube動画IDを抽出できませんでした' },
        { status: 400 }
      )
    }

    // 字幕取得（3段階フォールバック）
    const transcript = await fetchYouTubeTranscript(videoId)

    let project
    if (parsed.data.projectId) {
      // 既存プロジェクトを更新
      const existing = await prisma.tenkaiProject.findUnique({ where: { id: parsed.data.projectId } })
      if (!existing || existing.userId !== userId) {
        return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 })
      }
      project = await prisma.tenkaiProject.update({
        where: { id: parsed.data.projectId },
        data: {
          inputUrl: parsed.data.url,
          transcript: transcript.text,
          inputText: transcript.text,
          wordCount: transcript.text.length,
          title: existing.title === '無題のプロジェクト' ? transcript.title : existing.title,
        },
      })
    } else {
      // 新規プロジェクト作成
      project = await prisma.tenkaiProject.create({
        data: {
          userId,
          title: transcript.title,
          inputType: 'youtube',
          inputUrl: parsed.data.url,
          transcript: transcript.text,
          inputText: transcript.text,
          status: 'draft',
          wordCount: transcript.text.length,
          language: 'ja',
        },
      })
      await incrementProjectCount(userId)
    }

    return NextResponse.json({
      projectId: project.id,
      title: transcript.title,
      contentPreview: transcript.text.slice(0, 300),
      wordCount: transcript.text.length,
      language: 'ja',
      transcriptMethod: transcript.method,
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'YouTube字幕の取得に失敗しました'
    console.error('[tenkai] ingest/youtube error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
