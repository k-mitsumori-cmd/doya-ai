export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// POST   /api/adimage/brands/[id]/logo — ロゴを登録
// DELETE /api/adimage/brands/[id]/logo — ロゴを外す
//
// ⚠️ ロゴは本サービスで唯一「合成」する要素。
//    画像生成AIにロゴを描かせると形状・字間・色が必ず変わるため。
import sharp from 'sharp'
import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getIdentity, requireUser } from '@/lib/adimage/access'
import { uploadPng } from '@/lib/adimage/storage'
import { AdImageLogoError, readAdImageLogoForm, readAdImageLogoRemovalContext } from '@/lib/adimage/logo-input'
import { adImageLogoReply } from '@/lib/adimage/logo-operation-http'
import { beginAdImageLogo, finishAdImageLogo, failAdImageLogo, type AdImageLogoOperation } from '@/lib/adimage/logo-operation'

type Ctx = { params: Promise<{ id: string }> }
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' }
function failure(error: unknown) {
  return NextResponse.json({ error: error instanceof AdImageLogoError ? error.message : 'ロゴの保存状態を確認できませんでした。時間をおいて状態を確認してください。' }, { status: error instanceof AdImageLogoError ? error.status : 503, headers })
}

export async function POST(req: NextRequest, ctxParam: Ctx) {
  let operation: AdImageLogoOperation | undefined
  let admitted = false
  try {
    const identity = await getIdentity(req)
    const auth = requireUser(identity)
    if (!auth.ok || !identity.userId) return NextResponse.json({ error: '再ログインしてください。' }, { status: 401, headers })
    const p = await ctxParam.params
    const operationId = req.headers.get('X-AdImage-Operation-Id')
    if (!operationId) throw new AdImageLogoError(409, '画面を更新してから操作してください。')
    operation = { actor: identity.userId, targetId: p.id, operationId, kind: 'logo-upload' }
    const { file, config, context } = await readAdImageLogoForm(req)
    const raw = Buffer.from(await file.arrayBuffer())
    const name = file.name.trim().slice(0, 200) || 'ロゴ画像'
    const inputHash = createHash('sha256').update(raw).update(JSON.stringify([config, name, context || null])).digest('hex')
    const begin = await beginAdImageLogo(operation, inputHash, config, name, context)
    if (!begin.admitted) return await adImageLogoReply(operation, begin.value)
    admitted = true
    let png: Buffer
    try {
      const image = sharp(raw, { limitInputPixels: 16_000_000, animated: false, pages: 1 })
      const metadata = await image.metadata()
      if (!metadata.width || !metadata.height || metadata.width > 8192 || metadata.height > 8192) throw new Error()
      png = await image.rotate().png().toBuffer()
      if (png.byteLength > 12 * 1024 * 1024) throw new Error()
    } catch { throw new AdImageLogoError(400, '画像を読み取れないか、画像サイズが大きすぎます。縦横8192px以内・1600万画素以下の画像を選択してください。') }
    // Every upload gets a new immutable object. A failed/stale DB update cannot overwrite a referenced logo.
    await uploadPng(begin.receipt.path!, png)
    const result = await finishAdImageLogo(operation)
    return await adImageLogoReply(operation, result)
  } catch (error) { return failure(error) }
  finally { if (admitted && operation) await failAdImageLogo(operation).catch(() => {}) }
}

export async function DELETE(req: NextRequest, ctxParam: Ctx) {
  let operation: AdImageLogoOperation | undefined
  let admitted = false
  try {
    const identity = await getIdentity(req)
    const auth = requireUser(identity)
    if (!auth.ok || !identity.userId) return NextResponse.json({ error: '再ログインしてください。' }, { status: 401, headers })
    const p = await ctxParam.params
    const operationId = req.headers.get('X-AdImage-Operation-Id')
    if (!operationId) throw new AdImageLogoError(409, '画面を更新してから操作してください。')
    operation = { actor: identity.userId, targetId: p.id, operationId, kind: 'logo-remove' }
    const context = await readAdImageLogoRemovalContext(req)
    const begin = await beginAdImageLogo(operation, createHash('sha256').update('remove-logo').update(JSON.stringify(context || null)).digest('hex'), null, null, context)
    if (!begin.admitted) return await adImageLogoReply(operation, begin.value)
    admitted = true
    // Referenced historical objects are retained; only this current owned brand reference is removed.
    const result = await finishAdImageLogo(operation)
    return await adImageLogoReply(operation, result)
  } catch (error) { return failure(error) }
  finally { if (admitted && operation) await failAdImageLogo(operation).catch(() => {}) }
}
