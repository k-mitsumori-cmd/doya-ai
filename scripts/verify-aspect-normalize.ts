// 検証用: 実際の生成画像(3:2)に対して、旧方式(中央クロップ)と新方式(コンテンツ検出)を比べる。
// 「タイトルの上端が切れていないか」を、上端付近の濃い画素の有無で判定する。
// 使い方: npx tsx scripts/verify-aspect-normalize.ts <画像1> <画像2> ...
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { normalizeGeneratedSlide } from '../src/lib/doyaslide/aspect'

const OUT = process.env.VERIFY_OUT_DIR || '/tmp'

async function topInkRow(buf: Buffer): Promise<{ row0: number; first: number; size: string }> {
  const { data, info } = await sharp(buf).greyscale().raw().toBuffer({ resolveWithObject: true })
  const { width: W, height: H } = info
  const darkInRow = (y: number) => {
    let c = 0
    for (let x = 0; x < W; x += 2) if (data[y * W + x] < 128) c++
    return c
  }
  let first = -1
  for (let y = 0; y < Math.floor(H * 0.25); y++) {
    if (darkInRow(y) > W * 0.005) { first = y; break }
  }
  return { row0: darkInRow(0), first, size: `${W}x${H}` }
}

async function legacyCenterCrop(buf: Buffer): Promise<Buffer> {
  return sharp(buf).resize(1920, 1080, { fit: 'cover', position: 'centre' }).png().toBuffer()
}

async function main() {
  const files = process.argv.slice(2)
  if (!files.length) { console.log('画像を指定してください'); return }
  for (const f of files) {
    const src = fs.readFileSync(f)
    const srcInfo = await topInkRow(src)
    const legacy = await legacyCenterCrop(src)
    const legacyInfo = await topInkRow(legacy)
    const fixed = await normalizeGeneratedSlide(src.toString('base64'), 'image/png', 'wide')
    const fixedInfo = await topInkRow(fixed.buffer)
    const outFile = path.join(OUT, `fixed-${path.basename(f)}`)
    fs.writeFileSync(outFile, fixed.buffer)
    const verdict = fixedInfo.row0 > 0 ? '❌ 上端に文字あり(切れの疑い)' : '✅ 上端クリア'
    console.log(
      `${path.basename(f)}\n` +
      `  元画像   ${srcInfo.size} 0行目の濃い画素=${srcInfo.row0} 最初の濃い行=${srcInfo.first}\n` +
      `  旧方式   ${legacyInfo.size} 0行目=${legacyInfo.row0} 最初の濃い行=${legacyInfo.first}\n` +
      `  新方式   ${fixedInfo.size} 0行目=${fixedInfo.row0} 最初の濃い行=${fixedInfo.first}  ${verdict}\n` +
      `  -> ${outFile}`
    )
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
