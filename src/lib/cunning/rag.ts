// ============================================
// ドヤカンニング 簡易RAG（チャンク化 + 字句類似検索）
// ============================================
// pgvector/embeddings は Phase 2。MVPは「文字バイグラムのコサイン類似」で
// 質問にマッチするチャンクを取り出す（依存なし・日本語に強く・低レイテンシ）。
import { prisma } from '@/lib/prisma'
import type { KnowledgeChunkLite } from './types'

/** テキストを意味のまとまり（段落/文）でチャンク化。長すぎる塊は文字数で分割。 */
export function chunkText(text: string, target = 600, max = 1000): string[] {
  const blocks = text
    .split(/\n\s*\n|\n(?=[#＊・\-●])/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0)

  const chunks: string[] = []
  let buf = ''
  const flush = () => {
    const t = buf.trim()
    if (t) chunks.push(t)
    buf = ''
  }
  for (const block of blocks) {
    if (block.length > max) {
      flush()
      // 長文は句点で割って max 以下に詰める
      const sentences = block.split(/(?<=[。．!?！？])/)
      let sb = ''
      for (const s of sentences) {
        if ((sb + s).length > max) {
          if (sb.trim()) chunks.push(sb.trim())
          sb = s
        } else {
          sb += s
        }
      }
      if (sb.trim()) chunks.push(sb.trim())
      continue
    }
    if ((buf + '\n' + block).length > target) {
      flush()
      buf = block
    } else {
      buf = buf ? buf + '\n' + block : block
    }
  }
  flush()
  return chunks
}

function bigrams(s: string): Map<string, number> {
  const norm = s.toLowerCase().replace(/\s+/g, '')
  const m = new Map<string, number>()
  for (let i = 0; i < norm.length - 1; i++) {
    const g = norm.slice(i, i + 2)
    m.set(g, (m.get(g) || 0) + 1)
  }
  return m
}

function cosine(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0
  let na = 0
  let nb = 0
  for (const v of a.values()) na += v * v
  for (const v of b.values()) nb += v * v
  const [small, big] = a.size < b.size ? [a, b] : [b, a]
  for (const [g, v] of small) {
    const w = big.get(g)
    if (w) dot += v * w
  }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

/** ナレッジベースから質問に関連するチャンク上位N件を返す。 */
export async function retrieveChunks(
  knowledgeBaseId: string,
  query: string,
  topK = 4
): Promise<KnowledgeChunkLite[]> {
  const chunks = await prisma.cunningKnowledgeChunk.findMany({
    where: { knowledgeBaseId },
    select: { id: true, content: true, sourceUrl: true, sourceLabel: true },
    take: 500,
  })
  if (chunks.length === 0) return []
  const qg = bigrams(query)
  const scored = chunks
    .map((c) => ({ c, score: cosine(qg, bigrams(c.content)) }))
    .sort((a, b) => b.score - a.score)
    .filter((s) => s.score > 0.02)
    .slice(0, topK)
  return scored.map((s) => s.c)
}
