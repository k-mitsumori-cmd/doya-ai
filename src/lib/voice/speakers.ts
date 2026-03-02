// ============================================
// ドヤボイスAI ボイスキャラクターマスターデータ
// ============================================

export interface VoiceSpeaker {
  id: string
  name: string
  nameEn: string
  gender: 'male' | 'female' | 'neutral'
  ageGroup: '10s' | '20s' | '30s' | '40s' | '50s'
  description: string
  characteristics: string
  useCases: string[]
  voiceId: string           // Google Cloud TTS voice name
  tags: string[]
  isPro: boolean
  order: number
  sampleText: string
}

export const VOICE_SPEAKERS: VoiceSpeaker[] = [
  {
    id: 'akira',
    name: 'アキラ',
    nameEn: 'Akira',
    gender: 'male',
    ageGroup: '30s',
    description: '落ち着きと信頼感のある声',
    characteristics: '安心感・プロフェッショナル',
    useCases: ['企業VP', 'ナレーション', '商品紹介'],
    voiceId: 'ja-JP-Neural2-C',
    tags: ['calm', 'professional', 'trustworthy'],
    isPro: false,
    order: 1,
    sampleText: 'こんにちは、アキラです。落ち着いた声でお届けします。',
  },
  {
    id: 'haruto',
    name: 'ハルト',
    nameEn: 'Haruto',
    gender: 'male',
    ageGroup: '20s',
    description: '明るく爽やかな声',
    characteristics: '元気・親しみやすい',
    useCases: ['YouTube', 'SNS広告', 'アプリ'],
    voiceId: 'ja-JP-Neural2-D',
    tags: ['bright', 'energetic', 'friendly'],
    isPro: false,
    order: 2,
    sampleText: 'やあ！ハルトです。明るく元気にお届けします！',
  },
  {
    id: 'sakura',
    name: 'サクラ',
    nameEn: 'Sakura',
    gender: 'female',
    ageGroup: '20s',
    description: '明るく元気な声',
    characteristics: '活発・フレッシュ',
    useCases: ['商品紹介', 'キャンペーン', 'SNS広告'],
    voiceId: 'ja-JP-Neural2-B',
    tags: ['bright', 'energetic', 'cheerful'],
    isPro: false,
    order: 3,
    sampleText: 'こんにちは！サクラです。元気いっぱいにお届けします！',
  },
  {
    id: 'misaki',
    name: 'ミサキ',
    nameEn: 'Misaki',
    gender: 'female',
    ageGroup: '30s',
    description: '知的で落ち着いた声',
    characteristics: '知性・信頼感',
    useCases: ['e-Learning', '医療', 'ビジネス'],
    voiceId: 'ja-JP-Neural2-A',
    tags: ['intelligent', 'calm', 'professional'],
    isPro: false,
    order: 4,
    sampleText: 'ミサキです。知的で落ち着いた声でお届けします。',
  },
  {
    id: 'kenji',
    name: 'ケンジ',
    nameEn: 'Kenji',
    gender: 'male',
    ageGroup: '40s',
    description: '重厚で威厳のある声',
    characteristics: '重厚感・威厳',
    useCases: ['ドキュメンタリー', '金融', '企業VP'],
    voiceId: 'ja-JP-Wavenet-C',
    tags: ['deep', 'authoritative', 'serious'],
    isPro: true,
    order: 5,
    sampleText: 'ケンジです。重厚で迫力のある声でお届けします。',
  },
  {
    id: 'yuki',
    name: 'ユウキ',
    nameEn: 'Yuki',
    gender: 'male',
    ageGroup: '20s',
    description: 'カジュアルで親しみやすい声',
    characteristics: 'フランク・親近感',
    useCases: ['チュートリアル', '解説動画', 'ゲーム'],
    voiceId: 'ja-JP-Wavenet-D',
    tags: ['casual', 'friendly', 'relatable'],
    isPro: true,
    order: 6,
    sampleText: 'どうも、ユウキです！気軽にお届けします。',
  },
  {
    id: 'aoi',
    name: 'アオイ',
    nameEn: 'Aoi',
    gender: 'female',
    ageGroup: '20s',
    description: 'やわらかく優しい声',
    characteristics: '優しさ・温かみ',
    useCases: ['美容', 'ウェルネス', 'ヒーリング'],
    voiceId: 'ja-JP-Wavenet-A',
    tags: ['soft', 'gentle', 'warm'],
    isPro: true,
    order: 7,
    sampleText: 'アオイです。やわらかく優しい声でお届けします。',
  },
  {
    id: 'rin',
    name: 'リン',
    nameEn: 'Rin',
    gender: 'female',
    ageGroup: '30s',
    description: 'プロフェッショナルで明瞭な声',
    characteristics: '明確・信頼性',
    useCases: ['ニュース', 'プレスリリース', '報道'],
    voiceId: 'ja-JP-Wavenet-B',
    tags: ['professional', 'clear', 'precise'],
    isPro: true,
    order: 8,
    sampleText: 'リンです。明瞭で信頼感のある声でお届けします。',
  },
  {
    id: 'kotaro',
    name: 'コタロウ',
    nameEn: 'Kotaro',
    gender: 'male',
    ageGroup: '50s',
    description: '渋みと包容力のある声',
    characteristics: '風格・安定感',
    useCases: ['高級ブランド', '不動産', '保険'],
    voiceId: 'ja-JP-Wavenet-C',
    tags: ['mature', 'dignified', 'reassuring'],
    isPro: true,
    order: 9,
    sampleText: 'コタロウです。渋みのある声でお届けします。',
  },
  {
    id: 'hinata',
    name: 'ヒナタ',
    nameEn: 'Hinata',
    gender: 'female',
    ageGroup: '10s',
    description: 'フレッシュでポップな声',
    characteristics: '若々しさ・活気',
    useCases: ['アプリ', 'ゲーム', '若年向けコンテンツ'],
    voiceId: 'ja-JP-Wavenet-B',
    tags: ['youthful', 'pop', 'energetic'],
    isPro: true,
    order: 10,
    sampleText: 'ヒナタだよ！フレッシュな声でお届けするね！',
  },
  {
    id: 'navigator',
    name: 'ナビゲーター',
    nameEn: 'Navigator',
    gender: 'neutral',
    ageGroup: '30s',
    description: 'ニュートラルで聞き取りやすい声',
    characteristics: '中性・明瞭',
    useCases: ['IVR', '音声ガイド', 'アシスタント'],
    voiceId: 'ja-JP-Neural2-D',
    tags: ['neutral', 'clear', 'guide'],
    isPro: true,
    order: 11,
    sampleText: 'ナビゲーターです。ご案内いたします。',
  },
  {
    id: 'announcer',
    name: 'アナウンサー',
    nameEn: 'Announcer',
    gender: 'female',
    ageGroup: '30s',
    description: '正確で明瞭な標準語アナウンス',
    characteristics: '正確・明瞭・標準語',
    useCases: ['公式アナウンス', '報道', '式典'],
    voiceId: 'ja-JP-Neural2-A',
    tags: ['formal', 'precise', 'standard'],
    isPro: true,
    order: 12,
    sampleText: 'アナウンサーです。正確で明瞭にお伝えします。',
  },
]

export function getSpeakerById(id: string): VoiceSpeaker | undefined {
  return VOICE_SPEAKERS.find(s => s.id === id)
}

export function getFreeSpeakers(): VoiceSpeaker[] {
  return VOICE_SPEAKERS.filter(s => !s.isPro).sort((a, b) => a.order - b.order)
}

export function getAllSpeakers(): VoiceSpeaker[] {
  return [...VOICE_SPEAKERS].sort((a, b) => a.order - b.order)
}
