#!/usr/bin/env node
// CI が落ちたときに、どの検査が・どんなエラーで落ちたかを書き出す。
// docs/audits の *-supervise.py は検査の出力をログファイルへ書き、画面には
// {"status":"failed","probeExitCode":1} しか出さない。これだと「失敗した」ことしか分からないため、
// 今回の実行で失敗した *-supervisor.json を探し、対になるログから原因の行と末尾を取り出す。
// 出力先: 標準出力、GITHUB_STEP_SUMMARY（あれば）、GitHub の ::error 注釈。
// 使い方: node scripts/ci-failure-report.cjs [探すフォルダ=docs/audits]
//   CI_STARTED_AT（エポックミリ秒）より後に書かれたファイルだけを見る。無ければ直近3時間。
'use strict'
const fs = require('node:fs')
const path = require('node:path')

const ERROR_LINE = /(Error|ERR_|assert|Assertion|ENOENT|Unmocked|FAIL|Traceback|not ok)/i

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

/** ログから原因の見当がつく行（最初の数行）と末尾を取り出す。 */
function summarizeLog(text, tailLines = 30) {
  const lines = text.split('\n').map(l => l.replace(/\s+$/, ''))
  const causes = lines
    .filter(l => ERROR_LINE.test(l) && !/^\s+at /.test(l) && l.length < 400)
    .slice(0, 5)
  const tail = lines.filter(Boolean).slice(-tailLines).map(l => (l.length > 400 ? l.slice(0, 400) + '…' : l))
  return { causes, tail }
}

/** 今回の実行で失敗した検査を集める。 */
function collectFailures(root, sinceMs) {
  const files = walk(root)
  const recent = files.filter(f => fs.statSync(f).mtimeMs >= sinceMs)
  const failures = []
  for (const file of recent.filter(f => f.endsWith('-supervisor.json'))) {
    let state
    try { state = JSON.parse(fs.readFileSync(file, 'utf8')) } catch { continue }
    if (state.status === 'passed') continue
    const stem = file.slice(0, -'-supervisor.json'.length)
    // 対のログは「同じ名前.log」。無ければ、その検査の実行中に書かれたログを探す
    let log = fs.existsSync(stem + '.log') ? stem + '.log' : null
    if (!log && state.startedAt) {
      const from = Date.parse(state.startedAt) - 1000
      const to = Date.parse(state.endedAt || new Date().toISOString()) + 1000
      log = recent.find(f => f.endsWith('.log') && fs.statSync(f).mtimeMs >= from && fs.statSync(f).mtimeMs <= to) || null
    }
    const summary = log ? summarizeLog(fs.readFileSync(log, 'utf8')) : { causes: [], tail: [] }
    failures.push({ supervisor: file, log, state, ...summary })
  }
  return failures
}

function toMarkdown(failures) {
  if (!failures.length) return '### CI の失敗の要約\n\n記録の残る検査（*-supervisor.json）に失敗はありません。失敗したステップのログを直接確認してください。\n'
  const parts = [`### CI の失敗の要約（${failures.length}件）\n`]
  for (const f of failures) {
    parts.push(`#### ${path.basename(f.supervisor, '-supervisor.json')}`)
    parts.push(`- 状態: ${f.state.status} / 検査の終了コード: ${f.state.probeExitCode ?? '記録なし'} / 結果の記録の確認: ${f.state.evidenceValid ?? '記録なし'}`)
    parts.push(`- 時刻: ${f.state.startedAt ?? '?'} 〜 ${f.state.endedAt ?? '?'}`)
    parts.push(`- ログ: ${f.log ?? '見つかりません（検査を起動する前に落ちた可能性があります）'}`)
    if (f.causes.length) parts.push('- 原因の行:\n' + f.causes.map(c => '  - `' + c.replace(/`/g, "'") + '`').join('\n'))
    if (f.tail.length) parts.push('\n<details><summary>ログの末尾</summary>\n\n```\n' + f.tail.join('\n') + '\n```\n</details>\n')
  }
  return parts.join('\n') + '\n'
}

function main() {
  const root = process.argv[2] || 'docs/audits'
  const sinceMs = Number(process.env.CI_STARTED_AT) || Date.now() - 3 * 3600_000
  const failures = collectFailures(root, sinceMs)
  const md = toMarkdown(failures)
  process.stdout.write(md)
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md)
  if (process.env.GITHUB_ACTIONS) {
    for (const f of failures) {
      const msg = (f.causes[0] || `status=${f.state.status} probeExitCode=${f.state.probeExitCode}`).replace(/%/g, '%25').replace(/\r?\n/g, ' ')
      process.stdout.write(`::error title=${path.basename(f.supervisor, '-supervisor.json')}::${msg}\n`)
    }
  }
}

if (require.main === module) main()
module.exports = { collectFailures, summarizeLog, toMarkdown }
