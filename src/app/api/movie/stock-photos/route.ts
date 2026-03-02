import { NextRequest, NextResponse } from 'next/server'

// GET /api/movie/stock-photos?query=...&page=1&per_page=12
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get('query') ?? 'business'
  const page = searchParams.get('page') ?? '1'
  const perPage = searchParams.get('per_page') ?? '12'

  try {
    const unsplashKey = process.env.UNSPLASH_ACCESS_KEY
    if (!unsplashKey) {
      return NextResponse.json({ photos: [], total: 0 })
    }

    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&page=${page}&per_page=${perPage}&orientation=landscape`,
      { headers: { Authorization: `Client-ID ${unsplashKey}` } }
    )

    if (!res.ok) throw new Error('Unsplash API error')

    const data = await res.json()
    const photos = data.results.map((p: { id: string; urls: { regular: string; small: string; full: string }; alt_description: string; user: { name: string } }) => ({
      id: p.id,
      url: p.urls.regular,
      thumb: p.urls.small,
      full: p.urls.full,
      alt: p.alt_description,
      credit: p.user.name,
    }))

    return NextResponse.json({ photos, total: data.total })
  } catch (error) {
    console.error('[GET /api/movie/stock-photos]', error)
    return NextResponse.json({ photos: [], total: 0 })
  }
}
