export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/doyaslide/access'
import { getUserDoyaSlideLimits } from '@/lib/doyaslide/limits'
import { createProjectWithinLimit, limitReachedBody } from '@/lib/doyaslide/create-project'
import { getDocType } from '@/lib/doyaslide/constants'
import { buildQuoteBrief, HANDOFF_ID_PATTERN, HANDOFF_KINDS } from '@/lib/doyaslide/quote-handoff'
import { loadQuoteForHandoff } from '@/lib/quote/access'
import { isGuidePopupsEnabled } from '@/lib/notice/flag'
import { errorSuffix } from '@/lib/doyaslide/errors'

const NO_STORE = { 'Cache-Control': 'private, no-store' }

// POST /api/doyaslide/projects/from-quote — 見積書を材料に、新しいスライドのプロジェクトを作る
// ブラウザが送るのは { kind: 'quote', id } だけ。タイトルやリンクは受け取らない（送られても読まない）。
// ⚠️ ここでは AI も Web検索も呼ばない。構成づくり（/structure）は画面が続けて呼ぶ。
//    Web検索は customBrief の内部の目印で、structure 側が止める（quote-handoff.ts）。
export async function POST(req: NextRequest) {
  try {
    // 旗が off のときは、本文もセッションも読まずに404
    if (!(await isGuidePopupsEnabled())) {
      return NextResponse.json({ error: '見つかりません' }, { status: 404 })
    }
    const userId = await getUserId()
    if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: '入力内容を確認してください' }, { status: 400 })
    }
    const { kind, id } = body as { kind?: unknown; id?: unknown }
    if (typeof kind !== 'string' || !(HANDOFF_KINDS as readonly string[]).includes(kind)) {
      return NextResponse.json({ error: '入力内容を確認してください' }, { status: 400 })
    }
    if (kind !== 'quote') {
      return NextResponse.json({ error: 'まだ対応していません' }, { status: 400 })
    }
    if (typeof id !== 'string' || !HANDOFF_ID_PATTERN.test(id)) {
      return NextResponse.json({ error: '入力内容を確認してください' }, { status: 400 })
    }

    // 他組織・招待中・存在しないは、どれも同じ404と同じ文言にする
    const doc = await loadQuoteForHandoff(userId, id)
    if (!doc) return NextResponse.json({ error: '見つかりません' }, { status: 404 })

    const dt = getDocType('proposal')
    const limits = await getUserDoyaSlideLimits(userId)
    const project = await createProjectWithinLimit({
      userId,
      // 取引先名はタイトルに入れない（タイトルは一覧や検索語に出やすいため）
      title: doc.title.trim().slice(0, 120) || '見積書からの資料',
      docType: dt.value,
      customBrief: buildQuoteBrief(doc),
      slideCount: dt.defaultCount,
      aspectRatio: dt.defaultAspect,
      themeColor: '#7f19e6',
      stylePreset: 'corporate',
      status: 'draft',
    }, limits.maxProjects)
    if (!project) {
      return NextResponse.json(limitReachedBody(limits.maxProjects), { status: 403, headers: NO_STORE })
    }
    return NextResponse.json({ projectId: project.id }, { status: 201, headers: NO_STORE })
  } catch (e: any) {
    console.error('[doyaslide/projects/from-quote][POST] failed')
    return NextResponse.json({ error: `作成に失敗しました${errorSuffix(e)}` }, { status: 500 })
  }
}
