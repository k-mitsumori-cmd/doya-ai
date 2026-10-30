// 実行: npx tsx --test src/lib/brand/rename-loader.test.ts
// 名前の切り替え（ドヤAI → ドヤ部下）のビルド時の置き換えが、コードを壊さないことの回帰テスト。画面は描かない。
// - 旗が on のビルドで掛かる置き換え（scripts/brand/rename-loader.cjs）を、src と seo の全ファイルに掛けて確かめる。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
const loader = require('../../../scripts/brand/rename-loader.cjs') as { renameSource: (s: string) => string; isTarget: (p: string) => boolean }

const ROOT = process.cwd()

function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    if (n === 'node_modules' || n === '.next') continue
    const p = join(dir, n)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(n)) out.push(p)
  }
  return out
}
const targets = [...walk(join(ROOT, 'src')), ...walk(join(ROOT, 'seo'))].filter((p) => loader.isTarget(p))

function syntaxErrors(file: string, code: string): number {
  const r = ts.transpileModule(code, {
    reportDiagnostics: true,
    fileName: file,
    compilerOptions: { jsx: ts.JsxEmit.Preserve, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  })
  return (r.diagnostics ?? []).filter((d) => d.category === ts.DiagnosticCategory.Error).length
}

test('置き換え: サービス名だけを変え、ツール名・brand-keep の行・URL は変えない', () => {
  const s = 'ドヤAIに頼む\nドヤAIO ドヤAI質問リンク ドヤAI商談\nconst k = ["ドヤAI"] // brand-keep\nhttps://doya-ai.surisuta.jp doya_ai'
  assert.equal(
    loader.renameSource(s),
    'ドヤ部下に頼む\nドヤAIO ドヤAI質問リンク ドヤAI商談\nconst k = ["ドヤAI"] // brand-keep\nhttps://doya-ai.surisuta.jp doya_ai',
  )
  assert.equal(loader.isTarget('/x/src/lib/brand/index.ts'), false, 'brand の部品は置き換えない（旧名の定数が入っている）')
  assert.equal(loader.isTarget('/x/src/lib/a.test.ts'), false)
  assert.equal(loader.isTarget('/x/src/app/terms/page.tsx'), false, '利用規約は、法務の確認のあとに別に書き換える')
  assert.equal(loader.isTarget('/x/src/app/privacy/page.tsx'), false)
  assert.equal(loader.isTarget('/x/src/app/tokushoho/page.tsx'), false)
  assert.equal(loader.isTarget('/x/src/app/a.tsx'), true)
  assert.equal(loader.isTarget('/x/seo/lib/a.ts'), true)
  assert.equal(loader.isTarget('/x/public/a.js'), false)
})

test('置き換え後も、すべてのファイルの構文が壊れない', () => {
  assert.ok(targets.length > 300, `対象ファイル ${targets.length}`)
  let changed = 0
  for (const f of targets) {
    const src = readFileSync(f, 'utf8')
    const out = loader.renameSource(src)
    if (out !== src) {
      changed++
      assert.equal(syntaxErrors(f, out), syntaxErrors(f, src), `${f}: 置き換えで構文の誤りが増えた`)
    }
  }
  assert.ok(changed >= 100, `置き換わったファイル ${changed}`)
})

test('置き換え後に「ドヤAI」が残るのは、ツール名・brand-keep の行・コメントだけ', () => {
  const left: string[] = []
  for (const f of targets) {
    const out = loader.renameSource(readFileSync(f, 'utf8'))
    out.split('\n').forEach((line, i) => {
      if (line.includes('brand-keep')) return
      const stripped = line.replace(/ドヤAI(O|質問リンク|商談)/g, '')
      if (stripped.includes('ドヤAI')) left.push(`${f.replace(ROOT, '')}:${i + 1}`)
    })
  }
  assert.deepEqual(left, [])
})

test('危ない書き方がない: 「ドヤAI」を比較・検索・正規表現に使う所（置き換えると動きが変わる所）が、brand-keep 無しで無い', () => {
  const risky: string[] = []
  const re = /(===|!==|==|!=)\s*['"`]ドヤAI|['"`]ドヤAI['"`]\s*(===|!==)|(includes|startsWith|endsWith|indexOf|match|test)\(\s*['"`/][^)]*ドヤAI|\/[^/\n]*ドヤAI[^/\n]*\/[dgimsuy]*[.,;)]/
  for (const f of targets) {
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      if (line.includes('brand-keep')) return
      // 比べる側も、比べられる側（各 LP の eyebrow="ドヤAI"）も、同じ置き換えを受けるので、結果は変わらない（両方「ドヤ部下」になる）
      if (f.endsWith('/components/lp/renewal/Renewal.tsx') && line.includes('props.eyebrow !==')) return
      if (re.test(line.replace(/ドヤAI(O|質問リンク|商談)/g, ''))) risky.push(`${f.replace(ROOT, '')}:${i + 1}: ${line.trim().slice(0, 100)}`)
    })
  }
  assert.deepEqual(risky, [])
})
