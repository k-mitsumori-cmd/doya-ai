// 面の画像の切り出し・額縁の検出の確かめ（image-fit.ts）。課金 API・DB・ブラウザは使わない。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { aspectOf, cropBox, cutFractions, grayFrameInset, safeZone } from './image-fit'

test('切り出し: 面の実寸の縦横比に、中央から切る。切られる量を先に計算する', () => {
  // 背面壁の中央（6000×2700mm）を 21:9 で作ると、上下が少し切られる
  const wall = cropBox(2688, 1152, 6000 / 2700)
  assert.ok(Math.abs(wall.sw / wall.sh - 6000 / 2700) < 0.01)
  // ロールアップ（850×2000）を 9:16 で作ると、左右が各 12% ほど切られる
  const f = cutFractions('9:16', 850 / 2000)
  assert.ok(f.x > 0.11 && f.x < 0.13 && f.y === 0, JSON.stringify(f))
  const z = safeZone('9:16', 850 / 2000)
  assert.ok(z.safeWidthPct >= 70 && z.safeWidthPct <= 76 && z.safeHeightPct === 100, JSON.stringify(z))
  // 近い比率は、切らない
  assert.deepEqual(safeZone('3:4', 2000 / 2700), { safeWidthPct: 100, safeHeightPct: 100 })
  assert.deepEqual(cropBox(1536, 2048, aspectOf('3:4')), { sx: 0, sy: 0, sw: 1536, sh: 2048 })
  // 切った結果は、元の画像の中に収まる
  const b = cropBox(1000, 1000, 0.5)
  assert.ok(b.sx >= 0 && b.sx + b.sw <= 1000 && b.sh === 1000)
})

test('灰色の額縁（台紙）を見つける。白い下の帯や、紺の円は、額縁とみなさない', () => {
  const w = 100, h = 140
  const make = (frame: boolean) => {
    const px = new Uint8ClampedArray(w * h * 4)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const inside = x >= 8 && x < w - 8 && y >= 8 && y < h - 8
      let c: [number, number, number] = [255, 255, 255] // 紙
      if (y >= 8 && y < 50) c = [0, 102, 255] // 主色の帯
      if (x > 50 && x < 90 && y > 80 && y < 110) c = [10, 15, 60] // 紺の円
      if (frame && !inside) c = [95, 95, 95] // 灰色の台紙
      ;[px[i], px[i + 1], px[i + 2], px[i + 3]] = [c[0], c[1], c[2], 255]
    }
    return px
  }
  const f = grayFrameInset(make(true), w, h)
  assert.ok(f.top > 0.05 && f.left > 0.05 && f.bottom > 0.05 && f.right > 0.05, JSON.stringify(f))
  assert.ok(f.top < 0.2 && f.left < 0.2)
  assert.deepEqual(grayFrameInset(make(false), w, h), { top: 0, right: 0, bottom: 0, left: 0 })
})
