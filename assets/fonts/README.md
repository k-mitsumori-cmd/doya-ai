# PDF用の日本語フォント

## なぜ同梱しているか

PDFは puppeteer-core + @sparticuz/chromium（Lambda用Chromium）で作っている。
**この実行環境には日本語フォントが1つも入っていない。** そのためCSSで
`font-family: "Noto Sans JP", "Hiragino Sans"` と書いても解決先が無く、
日本語のグリフが**すべて空白として描画される**（ASCIIだけ出る）。

ローカルのmacOSにはヒラギノがあるので再現せず、**本番でだけ壊れる**。
2026-08-31 に実際に発行された見積書PDFが全文字消えていた。

## どう使うか

`chromium.font(<絶対パス>)` に渡すと Chromium のフォントディレクトリへ
symlink され、fontconfig 経由で解決できるようになる。使われたグリフは
Chromium がPDFへサブセット埋め込みするので、**閲覧する端末に
このフォントが無くても正しく表示される**。

同梱を忘れないよう next.config.js の outputFileTracingIncludes に
このディレクトリを追加してある（Next.js の tracing は動的パス参照を
検出できないため、書かないと関数バンドルから落ちる）。

## ライセンス

Noto Sans JP / SIL Open Font License 1.1
http://scripts.sil.org/OFL

OFL はフォントファイルの同梱・再配布を許諾している。
