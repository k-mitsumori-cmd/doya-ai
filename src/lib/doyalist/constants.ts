/**
 * ドヤリスト共通定数
 * 業界/エリア等、複数ページで使う表示値はここで一元管理する
 */

export const INDUSTRIES = [
  'IT・ソフトウェア',
  '製造業',
  '小売・EC',
  '医療・介護',
  '教育',
  '金融・保険',
  '不動産',
  '飲食',
  '物流',
  '建設',
  'コンサル',
  '広告・マーケ',
  '人材',
  'その他',
] as const

export const AREAS = [
  '全国',
  '北海道・東北',
  '関東',
  '中部',
  '近畿',
  '中国',
  '四国',
  '九州・沖縄',
] as const

export const SIZES = [
  '指定なし',
  'スタートアップ（〜20名）',
  '中小企業（20〜300名）',
  '中堅企業（300〜1000名）',
  '大企業（1000名〜）',
] as const

export type Industry = (typeof INDUSTRIES)[number]
export type Area = (typeof AREAS)[number]
export type CompanySize = (typeof SIZES)[number]
