export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// GET /api/adimage/concepts/[id]/export — 媒体別フォルダに整理したZIPで一括ダウンロード
// そのまま入稿できる状態で渡すのが目的なので、フォルダ名とファイル名に媒体・配置・実寸を入れる。
import archiver from 'archiver'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getIdentity, ownerWhere, requireUser } from '@/lib/adimage/access'
import { downloadBuffer } from '@/lib/adimage/storage'
import { findPlacement } from '@/lib/adimage/placements'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

export async function GET(req: NextRequest, ctxParam: Ctx) {
  const p = 'then' in ctxParam.params ? await ctxParam.params : ctxParam.params
  const identity = await getIdentity(req)
  // ⚠️ ログイン必須。未ログインは識別子が無く、以降のスコープ条件が成立しない
  const auth = requireUser(identity)
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: 401 })
  const where = ownerWhere(identity)
  if (!where) return NextResponse.json({ error: '利用者を識別できませんでした' }, { status: 400 })

  const concept = await prisma.adImageConcept.findFirst({
    where: { id: p.id, campaign: where },
    include: { creatives: true, campaign: { select: { brand: { select: { name: true } } } } },
  })
  if (!concept) return NextResponse.json({ error: 'コンセプトが見つかりません' }, { status: 404 })
  if (concept.creatives.length === 0) {
    return NextResponse.json({ error: 'ダウンロードできる画像がありません' }, { status: 400 })
  }

  // 画像を先に全部取ってから固める（ストリーム途中で失敗すると壊れたZIPが届く）
  const files: Array<{ name: string; buf: Buffer }> = []
  /** ZIP内の名前の重複を防ぐ */
  const used = new Map<string, number>()
  for (const cr of concept.creatives) {
    const buf = await downloadBuffer(cr.imagePath)
    if (!buf) continue
    const pl = findPlacement(cr.placementKey)
    const media = (pl?.media || 'other').replace(/[^\w\-一-龠ぁ-んァ-ヶ!]/g, '')
    const name = (pl?.name || cr.placementKey).replace(/[\/\\:*?"<>|]/g, '_')
    // ⚠️ 3パターン生成では同じ配置が複数あるため、名前が衝突する。
    //    ZIP内で同名が並ぶと展開時に上書きされ、1枚しか残らない。
    let entry = `${media}/${name}_${cr.size}.png`
    if (used.has(entry)) {
      const n = (used.get(entry) || 1) + 1
      used.set(entry, n)
      entry = `${media}/${name}_${cr.size}_${cr.compositionKey || n}.png`
      // それでも重なるなら連番で必ず一意にする
      let i = 2
      while (used.has(entry)) {
        entry = `${media}/${name}_${cr.size}_${cr.compositionKey || ''}${i}.png`
        i++
      }
    }
    used.set(entry, 1)
    files.push({ name: entry, buf })
  }
  if (files.length === 0) {
    return NextResponse.json({ error: '画像を読み込めませんでした' }, { status: 502 })
  }

  const zip = await new Promise<Buffer>((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 6 } })
    const chunks: Buffer[] = []
    archive.on('data', (c: Buffer) => chunks.push(c))
    archive.on('error', reject)
    archive.on('end', () => resolve(Buffer.concat(chunks)))
    for (const f of files) archive.append(f.buf, { name: f.name })
    void archive.finalize()
  })

  // ⚠️ ファイル名に日本語が入ると環境によって壊れる。ASCIIのフォールバックと RFC5987 の両方を出す
  const asciiName = `adimage_${concept.id}.zip`
  const utf8Name = encodeURIComponent(`${concept.campaign.brand.name}_広告画像_${concept.label}.zip`)

  return new NextResponse(new Uint8Array(zip), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`,
      'Cache-Control': 'no-store',
    },
  })
}
