import { prisma } from '@/lib/prisma'
import { BANNER_PROMPTS_V2, GENRES } from '@/lib/banner-prompts-v2'

const promptGenres = new Map(BANNER_PROMPTS_V2.map(prompt => [prompt.id, prompt.genre]))

export interface DoyamanaCategoryView {
  id: string
  name: string
  slug: string
  description: string | null
  order: number
  isActive: boolean
  imageCount: number
  activeImageCount: number
  isManaged: boolean
  createdAt: Date | null
}

/** BannerTemplate is the image library; DoyamanaCategory stores metadata for added genres only. */
export async function listDoyamanaCategories() {
  const [managed, templates] = await Promise.all([
    prisma.doyamanaCategory.findMany({ orderBy: [{ order: 'asc' }, { name: 'asc' }] }),
    prisma.bannerTemplate.findMany({
      select: { id: true, templateId: true, industry: true, category: true, isActive: true },
    }),
  ])

  const categories = new Map<string, DoyamanaCategoryView>()
  const templateIds = new Map<string, string[]>()
  GENRES.forEach((genre, order) => {
    categories.set(genre.name, {
      id: genre.name, name: genre.name, slug: genre.id, description: null,
      order, isActive: true, imageCount: 0, activeImageCount: 0,
      isManaged: false, createdAt: null,
    })
  })
  for (const category of managed) {
    categories.set(category.id, {
      id: category.id, name: category.name, slug: category.slug,
      description: category.description, order: category.order, isActive: category.isActive,
      imageCount: 0, activeImageCount: 0, isManaged: true, createdAt: category.createdAt,
    })
  }
  const managedBySlug = new Map(managed.map(category => [category.slug, category.id]))

  for (const template of templates) {
    const genre = promptGenres.get(template.templateId) || template.industry
    const id = promptGenres.has(template.templateId)
      ? genre
      : managedBySlug.get(template.category) || genre
    if (!categories.has(id)) {
      categories.set(id, {
        id, name: genre, slug: genre, description: null,
        order: GENRES.length + managed.length + categories.size,
        isActive: true, imageCount: 0, activeImageCount: 0,
        isManaged: false, createdAt: null,
      })
    }
    const category = categories.get(id)!
    category.imageCount++
    if (template.isActive) category.activeImageCount++
    const ids = templateIds.get(id) || []
    ids.push(template.id)
    templateIds.set(id, ids)
  }

  return {
    categories: [...categories.values()].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'ja')),
    templateIds,
  }
}

export function isReservedDoyamanaCategory(name: string, slug: string) {
  return GENRES.some(genre => genre.name === name || genre.id === slug || genre.category === slug)
}
