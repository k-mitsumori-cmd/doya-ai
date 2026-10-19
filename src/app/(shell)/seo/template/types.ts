export interface ArticleTemplate {
  id: string
  title: string
  patternLabel: string
  description: string
  category: string
  icon: string
  defaultKeyword: string
  defaultTitle: string
  exampleKeywords: string[]
  targetAudience: string
  recommendedTone: string
  recommendedChars: number
  articleType: string
  phase?: string
  imageUrl?: string
  usage?: string
}

export interface ArticleSection {
  title: string
  description?: string
  templates: ArticleTemplate[]
}

export interface ArticleCategory {
  id: string
  label: string
  emoji: string
  color: string
  templates: ArticleTemplate[]
}
