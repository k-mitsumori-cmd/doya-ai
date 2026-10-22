// ============================================
// 画面の切り替え（ログインなしの LP の間）で、背景の色が一瞬変わらない・透明にならない
// ============================================
// 移る前の画面のリンクを押して移る（リンクが無ければ location で移る）。
// その間、毎フレームのキャンバスの背景（html、透明なら body）を記録し、
//   - 透明（rgba(0,0,0,0)）のフレームが無い
//   - 「移る前の色」「移った後の色」以外の色が出ない
// を確かめる。最初の描画の前のフレームは画面に出ないので数えない（直前の1フレームだけは数える）。
import { test, expect, openAndSettle, attachIfFailed } from './fixtures'
import { transitionPairs } from './routes'
import { BG_INIT_SCRIPT, isTransparent, type BgFrame } from './measure'

for (const [from, to] of transitionPairs()) {
  test(`${from} → ${to}`, async ({ page }, testInfo) => {
    const frames: BgFrame[] = []
    await page.exposeBinding('__e2eBg', (_src, f: BgFrame) => {
      frames.push(f)
    })
    await page.addInitScript(BG_INIT_SCRIPT)

    await openAndSettle(page, from)
    const before = frames.length ? frames[frames.length - 1].bg : ''

    // 移る前の画面のリンクを押す（人と同じ移り方）。無ければ location で移る
    const link = page.locator(`a[href="${to}"]:visible`).first()
    const hasLink = (await link.count()) > 0
    const startIndex = frames.length
    if (hasLink) {
      await link.scrollIntoViewIfNeeded().catch(() => {})
      await Promise.all([page.waitForURL((u) => u.pathname === to, { timeout: 30_000 }), link.click()])
    } else {
      await Promise.all([
        page.waitForURL((u) => u.pathname === to, { timeout: 30_000 }),
        page.evaluate((p) => {
          location.href = p
        }, to),
      ])
    }
    await page.waitForLoadState('load')
    await page.waitForTimeout(1_500)
    const after = frames.length ? frames[frames.length - 1].bg : ''

    // 見えたはずのフレームだけにする（新しいページの、最初の描画の前は画面に出ない）
    const during = frames.slice(startIndex)
    const shown: BgFrame[] = []
    for (let i = 0; i < during.length; i++) {
      const f = during[i]
      const next = during[i + 1]
      if (f.painted || (next && next.painted && next.path === f.path)) shown.push(f)
    }
    const allowed = new Set([before, after])
    const transparent = shown.filter((f) => isTransparent(f.bg))
    const unexpected = shown.filter((f) => !isTransparent(f.bg) && !allowed.has(f.bg))
    const shot = await page.screenshot({ type: 'jpeg', quality: 70 }).catch(() => null)

    await testInfo.attach('e2e-transition', {
      contentType: 'application/json',
      body: JSON.stringify({
        from,
        to,
        project: testInfo.project.name,
        via: hasLink ? 'link' : 'location',
        before,
        after,
        frames: shown.length,
        transparent: transparent.length,
        unexpected: [...new Set(unexpected.map((f) => `${f.path} ${f.bg}`))],
      }),
    })

    expect(before, '移る前の背景が取れていること').not.toBe('')
    expect.soft(isTransparent(before), `移る前の背景が透明でない（${before}）`).toBe(false)
    expect.soft(isTransparent(after), `移った後の背景が透明でない（${after}）`).toBe(false)
    expect.soft(transparent.length, `切り替えの間に背景が透明になるフレームが無い（${transparent.map((f) => f.path).join(',')}）`).toBe(0)
    expect
      .soft(
        [...new Set(unexpected.map((f) => `${f.path} ${f.bg}`))],
        `切り替えの間に、前後と違う背景の色が出ない（前: ${before} / 後: ${after}）`,
      )
      .toEqual([])

    await attachIfFailed(testInfo, 'after-transition', shot)
  })
}
