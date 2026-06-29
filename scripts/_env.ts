// スクリプト共通: .env.local（または AIO_ENV_FILE 指定のファイル）を process.env に読み込む。
// 各スクリプトに同じパーサをコピペすると修正が片方だけに入って壊れるため、ここに一本化する。
import fs from 'fs'
import path from 'path'

export function loadEnv(): void {
  // 既定はリポジトリ直下の .env.local を __dirname 基準で解決（実行時の cwd に依存しない）。
  // AIO_ENV_FILE が指定されていればそちらを優先。
  const p = process.env.AIO_ENV_FILE || path.resolve(__dirname, '../.env.local')
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    // 大文字キーだけでなく小文字混在キーも許容する。
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  }
}
