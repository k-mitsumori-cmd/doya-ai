// ============================================
// 名前の切り替え（ドヤAI → ドヤ部下）の、ビルド時の置き換え（webpack のローダー）
// ============================================
// 2026-10-30 本人の決定。旗 NEXT_PUBLIC_BRAND_RENAME_ROLLOUT=all のビルドのときだけ、next.config.js が、このローダーを src と seo の
// ソースに掛ける。旗が off のビルドでは、このローダーは使われず、ソースはそのまま（今の「ドヤAI」のまま）。
// - 置き換えるのは、サービス名の「ドヤAI」だけ。ツールの名前（ドヤAIO・ドヤAI質問リンク・ドヤAI商談）は変えない。
// - 「brand-keep」と書いた行は、置き換えない（旧名の検索の受け皿など、残したい行）。
// - src/lib/brand/ は置き換えない（旧名の定数が入っているため）。テスト（*.test.*）も対象外。
// - 利用規約・プライバシーポリシー・特定商取引法の表記（src/app/terms・privacy・tokushoho）も対象外。法務の確認のあとに別に書き換える。
// - URL・識別名（doya-ai、doya_ai）は、そもそも「ドヤAI」という日本語を含まないので、変わらない。
const OLD = 'ドヤAI'
const NEW = 'ドヤ部下'
// 「ドヤAI」のあとに続くと、別のツールの名前になる語
const KEEP_AFTER = 'O|質問リンク|商談'
const RE = new RegExp(`${OLD}(?!${KEEP_AFTER})`, 'g')

/** ソースの文字列の「ドヤAI」を置き換える。brand-keep の行は変えない */
function renameSource(source) {
  return source
    .split('\n')
    .map((line) => (line.includes('brand-keep') ? line : line.replace(RE, NEW)))
    .join('\n')
}

/** このファイルを置き換えの対象にするか（パスで決める） */
function isTarget(resourcePath) {
  const p = resourcePath.replace(/\\/g, '/')
  if (!/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(p)) return false
  if (/\.test\.(ts|tsx|js)$/.test(p)) return false
  if (p.includes('/src/lib/brand/')) return false
  // 利用規約・プライバシーポリシー・特定商取引法の表記は、本人の承認と法務の確認のあとに、別に書き換える（置き換えの対象外）
  if (/\/src\/app\/(terms|privacy|tokushoho)\//.test(p)) return false
  return p.includes('/src/') || p.includes('/seo/')
}

module.exports = function renameLoader(source) {
  if (!isTarget(this.resourcePath)) return source
  return renameSource(source)
}
module.exports.renameSource = renameSource
module.exports.isTarget = isTarget
