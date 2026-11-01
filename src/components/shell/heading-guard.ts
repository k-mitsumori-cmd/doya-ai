// ============================================
// 枠の中の h1 を1つにする（UI 品質 S-57）
// ============================================
// 枠に入ると、ToolFrame の見出し（h1）と、ページの側の古い見出し（h1）が並ぶ画面がある（24画面のうち18）。
// ページの本体は各ツールが持つので、ここでは読み上げと見出しの一覧の上だけで2段目にする。
// - 残す h1: data-shell-title の付いたもの（ToolFrame）。無ければ最初の h1
// - ほかの h1: role="heading" aria-level="2" を付ける（見た目は変えない）
// ⚠️  AppShell から呼ぶ。各ツールが見出しを直したら、この処理は何もしなくなる。

export function demoteExtraH1(root: ParentNode): number {
  const all = Array.from(root.querySelectorAll('h1'))
  if (all.length <= 1) return 0
  const keep = all.find((h) => h.hasAttribute('data-shell-title')) ?? all[0]
  let n = 0
  for (const h of all) {
    if (h === keep) {
      if (h.hasAttribute('data-shell-demoted')) {
        h.removeAttribute('role'); h.removeAttribute('aria-level'); h.removeAttribute('data-shell-demoted')
      }
      continue
    }
    if (h.getAttribute('aria-level') === '2' && h.hasAttribute('data-shell-demoted')) continue
    h.setAttribute('role', 'heading')
    h.setAttribute('aria-level', '2')
    h.setAttribute('data-shell-demoted', 'true')
    n++
  }
  return n
}
