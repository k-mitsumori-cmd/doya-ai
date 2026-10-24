// ============================================
// ds/next-step-copy — 各ツールの「次にやること帯」の文とボタン
// ============================================
// 状態（まだ何もない／作成中／できた／エラー）ごとに、1文（30〜45字）と主ボタンの文を決める。
// ⚠️ 文は1文。比喩を使わない。絵文字・モデル名・HTTP のコードを入れない（next-step.test.tsx が確かめる）
// ⚠️ n は件数・割合など、その状態で見せる数。数を使わない文は n を見ない
// 画面の部品は next-step.tsx、置き場所は各ツールの画面（docs/audits/2026-10-24-ux-clarity/FIX-PLAN.md の T1）
import type { NextStepCopy, NextStepState } from './next-step-model'

type Make = (n: number) => NextStepCopy
/** 4つの状態は必須。ツールによっては途中の状態（選ぶ・再開する・上限）を足す */
type ToolCopy = Record<NextStepState, Make> & Record<string, Make>

const fixed = (text: string, action?: string): Make => () => ({ text, action })

/** 上限に届いたとき（プランか問い合わせへ）。ボタンの文は画面の側で「プランを見る／問い合わせる」を選ぶ */
const limit: Make = fixed('今のプランで作れる回数の上限に届いたので、見直すと続けて作れます。', 'プランを見る')

export const NEXT_STEP_COPY = {
  banner: {
    empty: fixed('用途とサイズを選んで内容を入れると、バナーの案をまとめて作れます。', '入力へ進む'),
    working: (n) => ({ text: `バナーの案を作っていて、できたらこの画面の下に並びます（${n}%）。` }),
    done: (n) => ({ text: `${n}案のバナーができたので、選んで保存するか作り直しましょう。`, action: 'できた案を見る' }),
    error: fixed('バナーを作れなかったので、入力を確かめてもう一度作ってください。', 'もう一度作る'),
  },
  seo: {
    empty: fixed('まだ記事が無いので、キーワードを入れて1本目の記事を作りましょう。', '記事を作る'),
    working: (n) => ({ text: `${n}本の記事を書いていて、できた記事から順に開いて中身を直せます。`, action: '進み具合を見る' }),
    done: fixed('記事ができたので、開いて見出しと本文を確かめ、書き出しましょう。', '記事を開く'),
    error: fixed('作れなかった記事があるので、開いてもう一度作り直してください。', '記事を開く'),
    loadError: fixed('記事の一覧を読み込めなかったので、もう一度読み込んでください。', 'もう一度読み込む'),
  },
  persona: {
    empty: fixed('サイトのURLを入れると、買ってくれそうな人物像を1人ぶん作れます。', 'URLを入れる'),
    working: fixed('人物像を作っていて、できたらこの画面の下に名前と特徴が出てきます。'),
    done: fixed('人物像ができたので、中身を確かめてPDFか画像で保存しましょう。', '人物像を見る'),
    error: fixed('人物像を作れなかったので、入力を確かめてもう一度作ってください。', 'もう一度作る'),
    limit,
  },
  interview: {
    empty: fixed('まだ素材が無いので、取材の音声か動画を入れて文字起こしから始めましょう。', '素材を入れる'),
    working: (n) => ({ text: `${n}件の素材を文字起こししていて、終わったら記事作りへ進めます。`, action: '進み具合を見る' }),
    done: fixed('前回のプロジェクトを開いて、文字起こしの続きや記事作りを進めましょう。', 'プロジェクトを開く'),
    error: fixed('素材を読み込めなかったので、ファイルを確かめてもう一度入れてください。', 'もう一度入れる'),
    loadError: fixed('プロジェクトの一覧を読み込めなかったので、もう一度読み込んでください。', 'もう一度読み込む'),
  },
  doyaslide: {
    empty: fixed('まだ資料が無いので、テーマと話す内容を入れて1つ目の資料を作りましょう。', '資料を作る'),
    working: fixed('スライドを作っていて、できたら開いて1枚ずつ中身を直せます。', '進み具合を見る'),
    done: fixed('スライドができたので、開いて中身を確かめてから書き出しましょう。', '資料を開く'),
    error: fixed('作れなかった資料があるので、開いてもう一度作り直してください。', '資料を開く'),
    loadError: fixed('資料の一覧を読み込めなかったので、もう一度読み込んでください。', 'もう一度読み込む'),
  },
  doyalist: {
    empty: fixed('業種と地域を選ぶと、条件に合う会社の一覧をまとめて作れます。', '一覧を作る'),
    working: fixed('条件に合う会社を集めていて、終わったらこの画面の下に一覧が並びます。'),
    done: (n) => ({ text: `${n}社の一覧ができたので、中身を確かめてCSVに書き出しましょう。`, action: 'CSVに書き出す' }),
    error: fixed('一覧を作れなかったので、条件を確かめてもう一度作ってください。', 'もう一度作る'),
    resume: fixed('前回の一覧づくりが途中で止まっているので、続きから再開できます。', '続きから再開する'),
    limit,
  },
  shodan: {
    empty: fixed('まだ商談の準備が無いので、相手の会社名を入れて調べるところから始めましょう。', '準備を始める'),
    setup: fixed('先に自社の情報を入れると、相手に合わせた提案資料を作れるようになります。', '自社の情報を入れる'),
    working: fixed('相手の会社を調べていて、終わったら提案資料を作れるようになります。', '進み具合を見る'),
    done: fixed('調べた結果ができたので、開いて提案資料とスライドを作りましょう。', '結果を開く'),
    error: fixed('調べられなかった準備があるので、開いてもう一度調べ直してください。', '開いて調べ直す'),
    loadError: fixed('商談の準備の一覧を読み込めなかったので、もう一度読み込んでください。', 'もう一度読み込む'),
  },
  adimage: {
    empty: fixed('サイトのURLか紹介文を入れると、広告のコピーと画像の案を作れます。', 'URLを入れる'),
    choose: fixed('使うコピーと置き場所を選ぶと、広告の画像をまとめて作れます。', 'コピーを選ぶ'),
    working: fixed('広告の案を作っていて、できたものからこの画面の下に順に並びます。'),
    done: (n) => ({ text: `${n}枚の広告画像ができたので、確かめてまとめて保存しましょう。`, action: 'できた画像を見る' }),
    error: fixed('広告の案を作れなかったので、入力を確かめてもう一度作ってください。', 'もう一度作る'),
    limit,
  },
} satisfies Record<string, ToolCopy>

export type NextStepTool = keyof typeof NEXT_STEP_COPY
export const NEXT_STEP_TOOLS = Object.keys(NEXT_STEP_COPY) as NextStepTool[]

/** 数の入る文を確かめるときの数（小さい数・ふつうの数・大きい数） */
export const NEXT_STEP_SAMPLES = [1, 12, 100] as const

/** その状態の文とボタン。key は 4つの状態か、ツールが足した途中の状態 */
export function nextStepCopy<T extends NextStepTool>(tool: T, key: keyof (typeof NEXT_STEP_COPY)[T] & string, n = 0): NextStepCopy {
  const table = NEXT_STEP_COPY[tool] as Record<string, Make>
  return table[key](n)
}
