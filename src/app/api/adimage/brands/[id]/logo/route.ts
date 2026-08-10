export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// POST   /api/adimage/brands/[id]/logo — ロゴを登録
// DELETE /api/adimage/brands/[id]/logo — ロゴを外す
//
// ⚠️ ロゴは本サービスで唯一「合成」する要素。
//    画像生成AIにロゴを描かせると形状・字間・色が必ず変わるため。
import sharp from 'sharp'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getIdentity, ownerWhere } from '@/lib/adimage/access'
import { uploadPng } from '@/lib/adimage/storage'
import { DEFAULT_LOGO_CONFIG, type LogoConfig, type LogoPosition } from '@/lib/adimage/logo'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

const POSITIONS: LogoPosition[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center-top']

/** ⚠️ Vercel の本文上限（4.5MB）に当たらないよう、受け取る側でも制限する */
const MAX_BYTES = 3 * 1024 * 1024

export async function POST(req: NextRequest, ctxParam: Ctx) {
  const p = 'then' in ctxParam.params ? await ctxParam.params : ctxParam.params
  const identity = await getIdentity(req)
  const where = ownerWhere(identity)
  if (!where) return NextResponse.json({ error: '利用者を識別できませんでした' }, { status: 400 })

  // ⚠️ id だけで引かない（所有者条件と併用）
  const brand = await prisma.adImageBrand.findFirst({ where: { id: p.id, ...where }, select: { id: true } })
  if (!brand) return NextResponse.json({ error: 'ブランドが見つかりません' }, { status: 404 })

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'ロゴ画像を選択してください' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'ロゴ画像は3MB以下にしてください' }, { status: 413 })
  }

  const raw = Buffer.from(await file.arrayBuffer())
  let png: Buffer
  try {
    // 透過を保ったままPNGへ正規化する。壊れた画像はここで弾ける。
    png = await sharp(raw).png().toBuffer()
  } catch {
    return NextResponse.json({ error: '画像として読み取れませんでした' }, { status: 400 })
  }

  const posRaw = String(form?.get('pos') || '')
  const config: LogoConfig = {
    pos: POSITIONS.includes(posRaw as LogoPosition) ? (posRaw as LogoPosition) : DEFAULT_LOGO_CONFIG.pos,
    maxWidthPct: Number.isFinite(Number(form?.get('maxWidthPct')))
      ? Math.max(5, Math.min(50, Number(form?.get('maxWidthPct'))))
      : DEFAULT_LOGO_CONFIG.maxWidthPct,
    paddingPct: Number.isFinite(Number(form?.get('paddingPct')))
      ? Math.max(0, Math.min(15, Number(form?.get('paddingPct'))))
      : DEFAULT_LOGO_CONFIG.paddingPct,
  }

  const path = `${identity.userId || identity.guestId}/brand_${brand.id}/logo.png`
  await uploadPng(path, png)
  await prisma.adImageBrand.update({
    where: { id: brand.id },
    data: { logoPath: path, logoConfig: config as any },
  })

  return NextResponse.json({ ok: true, config })
}

export async function DELETE(req: NextRequest, ctxParam: Ctx) {
  const p = 'then' in ctxParam.params ? await ctxParam.params : ctxParam.params
  const identity = await getIdentity(req)
  const where = ownerWhere(identity)
  if (!where) return NextResponse.json({ error: '利用者を識別できませんでした' }, { status: 400 })

  // ⚠️ 画像の実体は消さない（過去に生成したクリエイティブの再現性を残す）。
  //    参照だけ外すことで「以後は載せない」を実現する。
  const updated = await prisma.adImageBrand.updateMany({
    where: { id: p.id, ...where },
    data: { logoPath: null },
  })
  if (updated.count === 0) return NextResponse.json({ error: 'ブランドが見つかりません' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
