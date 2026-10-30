// 言葉の分け方（CSS・React に依らない純粋な部品。試験で読めるように ds/motion から切り出した）
/** 日本語の文を、読点・句点・助詞の切れ目で短い塊に分ける（英数字は空白で） */
export function splitWords(text: string): string[] {
  const out: string[] = []
  for (const part of text.split(/(?<=[、。,.！？!?・…])|(?<=\s)/)) {
    if (!part) continue
    // 長い塊は、6文字ほどで分ける（一度に濃くならないように）
    if (part.length > 8) for (let i = 0; i < part.length; i += 6) out.push(part.slice(i, i + 6))
    else out.push(part)
  }
  return out
}
