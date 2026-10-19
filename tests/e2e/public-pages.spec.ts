// ============================================
// ログインなしで開ける画面の見た目の確かめ（375px / 1280px）
// ============================================
// 人が内蔵ブラウザで測っていた項目を、1画面につき1テストで確かめる。
// 項目ごとに expect.soft で確かめ、1つ落ちても残りの項目は最後まで測る。
//   1. h1 が1つ
//   2. 横のはみ出しが無い（最初の画面と、下までスクロールしたあと）
//   3. CLS が 0.1 未満（PerformanceObserver の layout-shift。セッションの窓の最大値）
//   4. 読み込めない画像が無い
//   5. 最初の画面にキービジュアル（120px 以上の画像）がある
//   6. 1文字だけの行が無い（行の高さで数える。下までスクロールした後に2回測り、2回とも出たものだけ）
// 結果の中身は attachment（e2e-checks）にも残し、summary-reporter.ts が表にまとめる。
import fs from 'node:fs'
import path from 'node:path'
import { test, expect, openAndSettle, attachIfFailed } from './fixtures'
import { PUBLIC_ROUTES, slug } from './routes'
import {
  CLS_INIT_SCRIPT,
  clsOf,
  readShifts,
  h1Info,
  horizontalOverflow,
  keyVisual,
  scrollThrough,
  brokenImages,
  singleCharLines,
} from './measure'

const CLS_LIMIT = 0.1

for (const route of PUBLIC_ROUTES) {
  test(`${route.path} ${route.label}`, async ({ page, blocked }, testInfo) => {
    await page.addInitScript(CLS_INIT_SCRIPT)

    // 同じ origin の画像で、4xx/5xx を返したもの
    const failedImages: string[] = []
    page.on('response', (res) => {
      if (res.request().resourceType() === 'image' && res.status() >= 400) failedImages.push(`${res.status()} ${res.url()}`)
    })
    const pageErrors: string[] = []
    page.on('pageerror', (e) => pageErrors.push(e.message.slice(0, 200)))

    const status = await openAndSettle(page, route.path)
    expect(status, 'ページが開けること（HTTP 200 番台）').toBeLessThan(400)

    // 最初の画面のスクリーンショット（失敗時の添付と、E2E_SCREENSHOT_DIR を渡したときの保存）
    const shot = await page.screenshot({ type: 'jpeg', quality: 70 }).catch(() => null)
    const shotDir = process.env.E2E_SCREENSHOT_DIR
    if (shot && shotDir) {
      const dir = path.resolve(shotDir, testInfo.project.name)
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(path.join(dir, `${slug(route.path)}.jpg`), shot)
    }

    // ---- 最初の画面で測る ----
    const { cls, worst } = clsOf(await readShifts(page))
    const h1 = await h1Info(page)
    const overflowTop = await horizontalOverflow(page)
    const kv = await keyVisual(page, [...blocked.imageUrls])

    // ---- 下までスクロールしてから測る ----
    await scrollThrough(page)
    const overflowBottom = await horizontalOverflow(page)
    const broken = [...(await brokenImages(page, [...blocked.imageUrls])), ...failedImages]
    const brokenUnique = [...new Set(broken)]
    // 1文字だけの行: アニメーションや JS の縮小が落ち着く前の一瞬を拾わないよう、
    // 下までスクロールした後に2回（0.8 秒あけて）測り、2回とも出たものだけを数える
    const lone1 = await singleCharLines(page)
    await page.waitForTimeout(800)
    const lone2 = await singleCharLines(page)
    const key = (l: { element: string; lone: string[] }) => `${l.element}|${l.lone.join('')}`
    const seen = new Set(lone1.map(key))
    const lone = lone2.filter((l) => seen.has(key(l)))

    const checks = {
      path: route.path,
      project: testInfo.project.name,
      status,
      h1: { ok: h1.count === 1, ...h1 },
      overflow: {
        ok: overflowTop.scrollX === 0 && overflowBottom.scrollX === 0,
        top: overflowTop,
        afterScroll: overflowBottom,
      },
      cls: { ok: cls < CLS_LIMIT, value: Number(cls.toFixed(4)), worst },
      images: { ok: brokenUnique.length === 0, broken: brokenUnique },
      keyVisual: { ok: kv.length > 0, found: kv },
      singleCharLines: { ok: lone.length === 0, found: lone },
      blockedExternal: blocked.total,
      pageErrors,
    }
    await testInfo.attach('e2e-checks', { contentType: 'application/json', body: JSON.stringify(checks) })

    expect.soft(h1.count, `h1 が1つ（今: ${h1.count} 個 ${JSON.stringify(h1.texts)}）`).toBe(1)
    expect.soft(overflowTop.scrollX, `横のはみ出しが無い（最初の画面）: ${overflowTop.culprits.join(' / ')}`).toBe(0)
    expect.soft(overflowBottom.scrollX, `横のはみ出しが無い（下までスクロール後）: ${overflowBottom.culprits.join(' / ')}`).toBe(0)
    expect
      .soft(cls, `CLS が ${CLS_LIMIT} 未満（大きいずれ: ${worst.map((w) => `${w.value.toFixed(3)} ${w.sources.join(',')}`).join(' / ')}）`)
      .toBeLessThan(CLS_LIMIT)
    expect.soft(brokenUnique, '読み込めない画像が無い').toEqual([])
    expect.soft(kv.length, '最初の画面にキービジュアル（120px 以上の画像）がある').toBeGreaterThan(0)
    expect
      .soft(lone, `1文字だけの行が無い: ${lone.map((l) => `「${l.lone.join('')}」 in ${l.element}（行: ${l.text}）`).join(' / ')}`)
      .toEqual([])

    await attachIfFailed(testInfo, 'first-view', shot)
  })
}
