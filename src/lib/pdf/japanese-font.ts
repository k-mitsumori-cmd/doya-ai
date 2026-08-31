// ============================================
// PDF生成用の日本語フォント登録（Chromium共通）
// ============================================
// ⚠️ **PDFを作るコードは必ずこれを通すこと。**
//    Lambda用Chromium（@sparticuz/chromium）には日本語フォントが1つも入っていない。
//    そのためCSSで font-family を指定しても解決先が無く、日本語のグリフが
//    **すべて空白として出力される**（ASCIIだけ残る）。
//    ローカルのmacOSにはヒラギノがあるため再現せず、**本番でだけ壊れる**。
//    2026-08-31 に実際に発行された見積書PDFが全文字消えていた。
//
// 登録すると使ったグリフを Chromium が PDF にサブセット埋め込みするので、
// **閲覧する端末にフォントが無くても正しく表示される**。
//
// 同梱物と経緯は assets/fonts/README.md（Noto Sans JP / OFL 1.1）。
// ⚠️ 新しいPDFルートを足したら next.config.js の outputFileTracingIncludes に
//    './assets/fonts/*.ttf' も必ず追加すること。書かないと関数バンドルから落ちる。

/** PDFのCSSで使うフォント指定。全PDFでこれを使い、指定のばらつきを防ぐ */
export const PDF_FONT_STACK = '"Noto Sans JP", "Hiragino Sans", "Yu Gothic", sans-serif'

const FONT_FILES = ['NotoSansJP-Regular.ttf', 'NotoSansJP-Bold.ttf']

/**
 * 同梱の日本語フォントを Chromium から見える場所に置く。
 *
 * ⚠️ **chromium.font() は使わない。** あれは $HOME/.fonts か /tmp/.fonts に置くが、
 *    @sparticuz/chromium が同梱する fonts.conf の探索先は次の4つだけで、
 *      /var/task/.fonts, /var/task/fonts, /opt/fonts, /tmp/fonts
 *    /tmp/.fonts は含まれない。さらに Lambda の /var/task は読み取り専用なので
 *    $HOME/.fonts への mkdir は失敗する。どちらの経路でも解決されず、
 *    2026-08-31 の本番PDFは日本語が全て空白のままだった。
 *    → 書き込めて、かつ探索先に入っている /tmp/fonts に直接置く。
 *
 * ⚠️ 呼ぶ順番が重要。chromium.executablePath() が fonts.tar.br を /tmp/fonts へ
 *    展開するので、**executablePath() の後に呼ぶこと**。先に呼ぶと展開で消えうる。
 */
export async function registerJapaneseFonts(_chromium: unknown, tag = 'pdf'): Promise<void> {
  const path = await import('node:path')
  const fs = await import('node:fs')

  // fontconfig が fonts.conf を見つけられるようにする。
  // 展開先(/tmp/fonts)に fonts.conf が入っている。
  const FONT_DIR = '/tmp/fonts'
  try {
    fs.mkdirSync(FONT_DIR, { recursive: true })
  } catch (err) {
    console.error(`[${tag}] フォントディレクトリを作れません:`, err instanceof Error ? err.message : err)
    return
  }
  if (fs.existsSync(path.join(FONT_DIR, 'fonts.conf'))) {
    process.env.FONTCONFIG_PATH = FONT_DIR
  }

  for (const file of FONT_FILES) {
    const src = path.join(process.cwd(), 'assets', 'fonts', file)
    const dst = path.join(FONT_DIR, file)
    try {
      if (fs.existsSync(dst)) continue // 同じコンテナの2回目以降
      if (!fs.existsSync(src)) {
        console.error(`[${tag}] 日本語フォントが見つかりません（PDFの日本語が消えます）:`, src)
        continue
      }
      // ⚠️ symlink ではなく copy。symlink 先(/var/task)が読めない構成があるため。
      fs.copyFileSync(src, dst)
    } catch (err) {
      console.error(`[${tag}] フォント配置に失敗:`, file, err instanceof Error ? err.message : err)
    }
  }

  // 何が置けたかを必ず残す。ここが空なら日本語は出ない
  try {
    const placed = fs.readdirSync(FONT_DIR).filter((f) => f.toLowerCase().endsWith('.ttf'))
    console.log(`[${tag}] fonts in ${FONT_DIR}:`, placed.join(', ') || '(なし)', '/ FONTCONFIG_PATH=', process.env.FONTCONFIG_PATH || '(未設定)')
  } catch {
    /* ignore */
  }
}
