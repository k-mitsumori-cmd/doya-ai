// ============================================
// E2E の結果のまとめ（合格・失敗の数・失敗した画面・遮断した外部通信の数）
// ============================================
// テストが残した attachment（e2e-checks / e2e-transition / blocked-external）を集め、
//   - 標準出力に要約を出す
//   - tests/e2e/.out/summary.md と summary.json に書く
import fs from 'node:fs'
import path from 'node:path'
import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter'

type Row = {
  title: string
  project: string
  status: string
  checks?: any
  transition?: any
  blocked?: { total: number; byVendor: Record<string, number>; byHost: Record<string, number> }
  errors: string[]
}

const OUT_DIR = path.resolve(__dirname, '.out')

function readJson(result: TestResult, name: string): any {
  const a = result.attachments.find((x) => x.name === name)
  if (!a?.body) return undefined
  try {
    return JSON.parse(a.body.toString('utf8'))
  } catch {
    return undefined
  }
}

const mark = (ok: boolean | undefined) => (ok === undefined ? '-' : ok ? 'OK' : 'NG')

export default class SummaryReporter implements Reporter {
  private rows: Row[] = []

  onTestEnd(test: TestCase, result: TestResult) {
    // リトライしたときは最後の結果だけを残す
    const project = test.parent.project()?.name ?? ''
    this.rows = this.rows.filter((r) => !(r.title === test.title && r.project === project))
    this.rows.push({
      title: test.title,
      project,
      status: result.status,
      checks: readJson(result, 'e2e-checks'),
      transition: readJson(result, 'e2e-transition'),
      blocked: readJson(result, 'blocked-external'),
      errors: result.errors.map((e) => (e.message ?? '').replace(/\u001b\[[0-9;]*m/g, '').split('\n')[0].slice(0, 300)),
    })
  }

  onEnd(result: FullResult) {
    // --list のように1件も流さなかったときは、前回のまとめを消さない
    if (this.rows.length === 0) return
    const passed = this.rows.filter((r) => r.status === 'passed').length
    const failed = this.rows.filter((r) => r.status === 'failed' || r.status === 'timedOut' || r.status === 'interrupted')
    const skipped = this.rows.filter((r) => r.status === 'skipped').length
    const blockedTotal = this.rows.reduce((n, r) => n + (r.blocked?.total ?? 0), 0)
    const byVendor: Record<string, number> = {}
    const byHost: Record<string, number> = {}
    for (const r of this.rows) {
      for (const [k, v] of Object.entries(r.blocked?.byVendor ?? {})) byVendor[k] = (byVendor[k] ?? 0) + v
      for (const [k, v] of Object.entries(r.blocked?.byHost ?? {})) byHost[k] = (byHost[k] ?? 0) + v
    }

    const lines: string[] = []
    lines.push(`# E2E の結果`, '')
    lines.push(`- 全体: ${result.status}`)
    lines.push(`- テスト: ${this.rows.length} 件（合格 ${passed} / 失敗 ${failed.length} / スキップ ${skipped}）`)
    lines.push(`- 遮断した外部への通信: ${blockedTotal} 件`)
    for (const [k, v] of Object.entries(byVendor).sort((a, b) => b[1] - a[1])) lines.push(`  - ${k}: ${v}`)
    lines.push('')

    const pages = this.rows.filter((r) => r.checks).sort((a, b) => (a.checks.path + a.project).localeCompare(b.checks.path + b.project))
    if (pages.length) {
      lines.push('## 画面ごと（h1 / 横はみ出し / CLS / 画像 / キービジュアル / 1文字の行）', '')
      lines.push('| 画面 | 幅 | 結果 | h1 | 横 | CLS | 画像 | KV | 1文字 | 遮断 |')
      lines.push('|---|---|---|---|---|---|---|---|---|---|')
      for (const r of pages) {
        const c = r.checks
        lines.push(
          `| ${c.path} | ${r.project} | ${r.status === 'passed' ? '合格' : '失敗'} | ${mark(c.h1.ok)} ${c.h1.count} | ${mark(c.overflow.ok)} | ${mark(c.cls.ok)} ${c.cls.value} | ${mark(c.images.ok)} | ${mark(c.keyVisual.ok)} | ${mark(c.singleCharLines.ok)} | ${c.blockedExternal} |`,
        )
      }
      lines.push('')
    }
    const trans = this.rows.filter((r) => r.transition)
    if (trans.length) {
      lines.push('## 画面の切り替え（背景の色）', '')
      lines.push('| 切り替え | 幅 | 結果 | 移り方 | 前の色 | 後の色 | 見えたフレーム | 透明 | 別の色 |')
      lines.push('|---|---|---|---|---|---|---|---|---|')
      for (const r of trans) {
        const t = r.transition
        lines.push(
          `| ${t.from} → ${t.to} | ${r.project} | ${r.status === 'passed' ? '合格' : '失敗'} | ${t.via} | ${t.before} | ${t.after} | ${t.frames} | ${t.transparent} | ${t.unexpected.length ? t.unexpected.join('<br>') : '-'} |`,
        )
      }
      lines.push('')
    }
    if (failed.length) {
      lines.push('## 失敗したテスト', '')
      for (const r of failed) {
        lines.push(`### ${r.title}（${r.project}）`)
        for (const e of r.errors) lines.push(`- ${e.replace(/\|/g, '\\|')}`)
        lines.push('')
      }
    }
    lines.push('## 遮断した宛先（ホストごと）', '')
    for (const [k, v] of Object.entries(byHost).sort((a, b) => b[1] - a[1])) lines.push(`- ${k}: ${v}`)
    lines.push('')

    fs.mkdirSync(OUT_DIR, { recursive: true })
    fs.writeFileSync(path.join(OUT_DIR, 'summary.md'), lines.join('\n'))
    fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify({ status: result.status, passed, failed: failed.length, skipped, blockedTotal, byVendor, byHost, rows: this.rows }, null, 2))

    console.log('')
    console.log(`[e2e] 合格 ${passed} / 失敗 ${failed.length} / スキップ ${skipped}（全 ${this.rows.length}）`)
    console.log(`[e2e] 遮断した外部への通信: ${blockedTotal} 件 ${JSON.stringify(byVendor)}`)
    for (const r of failed) console.log(`[e2e] 失敗: ${r.title}（${r.project}）`)
    console.log(`[e2e] まとめ: ${path.relative(process.cwd(), path.join(OUT_DIR, 'summary.md'))}`)
  }
}
