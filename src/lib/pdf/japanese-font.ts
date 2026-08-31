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
 * 同梱の日本語フォントを Chromium に登録する。
 * ⚠️ 失敗しても throw しない。フォントが無ければ日本語は消えるが、
 *    ここで止めると PDF がまったく出せなくなり、かえって被害が大きい。
 *    代わりに必ずログを残し、本番で気づけるようにする。
 */
export async function registerJapaneseFonts(chromium: any, tag = 'pdf'): Promise<void> {
  const path = await import('node:path')
  const fs = await import('node:fs')

  for (const file of FONT_FILES) {
    const abs = path.join(process.cwd(), 'assets', 'fonts', file)
    try {
      if (!fs.existsSync(abs)) {
        console.error(`[${tag}] 日本語フォントが見つかりません（PDFの日本語が消えます）:`, abs)
        continue
      }
      await chromium.font(abs)
    } catch (err) {
      console.error(`[${tag}] フォント登録に失敗:`, file, err instanceof Error ? err.message : err)
    }
  }
}
