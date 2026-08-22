import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const OUTPUT_DIR = path.resolve(
  'reference/generated-assets/2026-08-23-banner-template-refresh',
)

const genres = [
  { slug: 'beauty-cosme', label: '美容・コスメ', source: '/category/beauty' },
  { slug: 'fashion-apparel', label: 'ファッション・アパレル', source: '/category/fashion' },
  { slug: 'food-beverage', label: '飲料・食品', source: '/category/food' },
  { slug: 'ec-sale', label: 'EC・セール', source: '/taste/sale' },
  { slug: 'health-fitness', label: '健康・フィットネス', source: '/category/outdoor' },
  { slug: 'medical-healthcare', label: '医療・ヘルスケア', source: '/category/beauty' },
  { slug: 'it-saas', label: 'IT・SaaS', source: '/category/service' },
  { slug: 'it-technology', label: 'IT・テクノロジー', source: '/category/product' },
  { slug: 'education-seminar', label: '教育・セミナー', source: '/category/school' },
  { slug: 'recruit-career', label: '採用・転職', source: '/taste/person' },
  { slug: 'realestate-housing', label: '不動産・住宅', source: '/category/housing' },
  { slug: 'finance-insurance', label: '金融・保険', source: '/taste/typography' },
  { slug: 'travel-tourism', label: '旅行・観光', source: '/category/travel' },
  { slug: 'event-media', label: 'イベント・メディア', source: '/category/media' },
  { slug: 'lifestyle-pet', label: '暮らし・ペット', source: '/category/interior' },
]

const decodeHtml = (value) =>
  value
    .replaceAll('&#8217;', "'")
    .replaceAll('&#038;', '&')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#8211;', '–')
    .replaceAll('&#8212;', '—')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')

function parsePosts(html) {
  const posts = []
  const pattern = /<a href="https:\/\/design-library\.jp\/(\d+)" target="_blank">[\s\S]*?<img[^>]+src="([^"]+)"[^>]+alt="([^"]+)"[^>]*>[\s\S]*?<p class="c-post__tag">([\s\S]*?)<\/p>/g

  for (const match of html.matchAll(pattern)) {
    const [, id, imageUrl, rawAlt, rawTags] = match
    const title = decodeHtml(rawAlt).replace(/のバナーデザイン$/, '')
    const tags = [...rawTags.matchAll(/<a [^>]*>([^<]+)<\/a>/g)].map((tag) =>
      decodeHtml(tag[1].trim()),
    )
    posts.push({
      id,
      url: `https://design-library.jp/${id}`,
      imageUrl,
      title,
      tags,
    })
  }

  return posts
}

async function fetchPosts(source) {
  const response = await fetch(`https://design-library.jp${source}`)
  if (!response.ok) {
    throw new Error(`${source}: HTTP ${response.status}`)
  }
  return parsePosts(await response.text())
}

const used = new Set()
const inventory = []

for (const genre of genres) {
  const posts = await fetchPosts(genre.source)
  const selected = []

  for (const post of posts) {
    if (used.has(post.id)) continue
    used.add(post.id)
    selected.push(post)
    if (selected.length === 10) break
  }

  if (selected.length !== 10) {
    throw new Error(
      `${genre.slug}: expected 10 unique references, found ${selected.length}`,
    )
  }

  selected.forEach((post, index) => {
    inventory.push({
      templateId: `${genre.slug}-${String(index + 1).padStart(2, '0')}`,
      genre: genre.label,
      genreSlug: genre.slug,
      sourceCollection: `https://design-library.jp${genre.source}`,
      ...post,
    })
  })
}

await mkdir(OUTPUT_DIR, { recursive: true })
await writeFile(
  path.join(OUTPUT_DIR, 'reference-inventory.json'),
  `${JSON.stringify(inventory, null, 2)}\n`,
)

const markdown = [
  '# BANNER LIBRARY 150件 参照インベントリ',
  '',
  `収集日: 2026-08-23 / 合計: ${inventory.length}件 / 重複ID: 0件`,
  '',
  '各行の実在バナーから構図・情報階層・配色だけを参照する。実在名・ロゴ・商品固有表現は生成画像へ流用しない。',
]

for (const genre of genres) {
  markdown.push('', `## ${genre.label}`, '')
  for (const item of inventory.filter((entry) => entry.genreSlug === genre.slug)) {
    markdown.push(
      `- \`${item.templateId}\` — [${item.title}](${item.url}) — ${item.tags.join(' / ')}`,
    )
  }
}

await writeFile(
  path.join(OUTPUT_DIR, 'reference-inventory.md'),
  `${markdown.join('\n')}\n`,
)

console.log(
  JSON.stringify({
    count: inventory.length,
    uniqueIds: used.size,
    output: path.join(OUTPUT_DIR, 'reference-inventory.json'),
  }),
)
