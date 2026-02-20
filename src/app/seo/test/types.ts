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
}

export interface ArticleCategory {
  id: string
  label: string
  emoji: string
  color: string
  templates: ArticleTemplate[]
}
