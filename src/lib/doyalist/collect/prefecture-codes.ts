/**
 * 都道府県コード変換（JIS X 0401 / 全国地方公共団体コード 2桁）
 * gBizINFO API の `prefecture` パラメータは漢字名ではなく
 * 2桁の都道府県コードを要求するため、ここで変換する。
 */
export const PREFECTURE_TO_CODE: Record<string, string> = {
  '北海道': '01',
  '青森県': '02',
  '岩手県': '03',
  '宮城県': '04',
  '秋田県': '05',
  '山形県': '06',
  '福島県': '07',
  '茨城県': '08',
  '栃木県': '09',
  '群馬県': '10',
  '埼玉県': '11',
  '千葉県': '12',
  '東京都': '13',
  '神奈川県': '14',
  '新潟県': '15',
  '富山県': '16',
  '石川県': '17',
  '福井県': '18',
  '山梨県': '19',
  '長野県': '20',
  '岐阜県': '21',
  '静岡県': '22',
  '愛知県': '23',
  '三重県': '24',
  '滋賀県': '25',
  '京都府': '26',
  '大阪府': '27',
  '兵庫県': '28',
  '奈良県': '29',
  '和歌山県': '30',
  '鳥取県': '31',
  '島根県': '32',
  '岡山県': '33',
  '広島県': '34',
  '山口県': '35',
  '徳島県': '36',
  '香川県': '37',
  '愛媛県': '38',
  '高知県': '39',
  '福岡県': '40',
  '佐賀県': '41',
  '長崎県': '42',
  '熊本県': '43',
  '大分県': '44',
  '宮崎県': '45',
  '鹿児島県': '46',
  '沖縄県': '47',
}

/** エリア（地方区分）→ 都道府県名配列 */
export const AREA_TO_PREFECTURES: Record<string, string[]> = {
  '北海道・東北': ['北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県'],
  '関東': ['東京都', '神奈川県', '埼玉県', '千葉県', '茨城県', '栃木県', '群馬県'],
  '中部': ['新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県', '静岡県', '愛知県'],
  '近畿': ['三重県', '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県'],
  '中国': ['鳥取県', '島根県', '岡山県', '広島県', '山口県'],
  '四国': ['徳島県', '香川県', '愛媛県', '高知県'],
  '九州・沖縄': ['福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'],
}

/**
 * 入力（漢字名/コード/エリア名/省略形）から都道府県コード配列を返す
 * - 単一都道府県名/コード → [code]
 * - エリア名 → そのエリアの全都道府県コード
 * - "全国"/空 → []
 * - 「東京」→「東京都」のような省略にも対応
 */
export function resolvePrefectureCodes(input: string | undefined | null): string[] {
  if (!input) return []
  const v = String(input).trim()
  if (!v || v === '全国') return []

  // 既にコード（2桁数字）
  if (/^\d{1,2}$/.test(v)) {
    const padded = v.padStart(2, '0')
    return PREFECTURE_TO_CODE[Object.keys(PREFECTURE_TO_CODE).find(k => PREFECTURE_TO_CODE[k] === padded) || ''] ? [padded] : []
  }

  // エリア名（複数都道府県）
  if (AREA_TO_PREFECTURES[v]) {
    return AREA_TO_PREFECTURES[v].map((p) => PREFECTURE_TO_CODE[p]).filter(Boolean)
  }

  // 完全一致（漢字フル名）
  if (PREFECTURE_TO_CODE[v]) return [PREFECTURE_TO_CODE[v]]

  // 省略形（例: 東京 → 東京都、大阪 → 大阪府）
  const match = Object.keys(PREFECTURE_TO_CODE).find((k) => k.startsWith(v) || v.startsWith(k))
  if (match) return [PREFECTURE_TO_CODE[match]]

  return []
}
