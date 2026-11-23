/**
 * 日本語の文を、意味の切れ目（文節ごと）の塊に分ける。アプリ表示モードで、塊のあいだに <wbr> を入れて、言葉の途中で折り返さないようにする。
 * WKWebView（Safari）は word-break: auto-phrase に対応していないため、Intl.Segmenter（Safari 14.1 以降）で分ける。
 * 分け方: 単語に分けたあと、短い（2文字以下の）ひらがなの語（助詞・語尾）を、前の語にくっつける。「記事」「を」→「記事を」。
 * Intl.Segmenter が使えない環境では、分けずにそのまま返す。
 */
type SegmentFn = (text: string) => string[]

const defaultSegment: SegmentFn | null =
  typeof Intl !== 'undefined' && typeof (Intl as unknown as { Segmenter?: unknown }).Segmenter === 'function'
    ? (text) => {
        const seg = new (Intl as unknown as { Segmenter: new (l: string, o: { granularity: 'word' }) => { segment(t: string): Iterable<{ segment: string }> } }).Segmenter('ja', { granularity: 'word' })
        return Array.from(seg.segment(text), (s) => s.segment)
      }
    : null

const SHORT_HIRAGANA = /^[ぁ-ゖー]{1,2}$/
const OPENING = /^[「『（(【［\[]/

export function phraseSegments(text: string, segment: SegmentFn | null = defaultSegment): string[] {
  if (!text) return []
  if (!segment) return [text]
  const words = segment(text)
  const out: string[] = []
  for (const w of words) {
    if (out.length > 0 && (SHORT_HIRAGANA.test(w) || /^[、。，．,.！？!?）)」』】］\]]+$/.test(w))) out[out.length - 1] += w
    else if (out.length > 0 && OPENING.test(out[out.length - 1]) && out[out.length - 1].length === 1) out[out.length - 1] += w
    else out.push(w)
  }
  return out
}
