// ドヤ展示会の色・角丸・影。名前はリニューアルの ds トークン（クリア。renewal.module.css）と同じにしてある。
// ds/* が main に入ったら、この値を ds の import に差し替えるだけで済むようにする（ADDON-SERVICES R-3）。
// CSS 側は src/app/tenjikai/tenjikai.css の .tenjikai-root に同名の変数（--blue 等）を置き、
// Tailwind の doya-* / ink はその変数を参照する（tailwind.config.ts）。
// SVG の属性や framer-motion のアニメーションは CSS 変数を補間できないため、ここの値を直接使う。

export const ds = {
  blue: '#0066ff',
  blueDeep: '#0047d6',
  blueSoft: '#e8f0ff',
  blueLine: '#d7e5ff',
  bar: '#dbe7ff',
  k1: '#00b4ff',
  navy: '#0a0f3c',
  ink: '#101633',
  sub: '#4a5375',
  muted: '#7a83a3',
  line: '#e3e8f4',
  lineStrong: '#c6cde0',
  track: '#eef1f8',
  bg: '#f4f7fd',
  surface2: '#f8faff',
  paper: '#ffffff',
  yellow: '#ffd400',
} as const

export type DsColor = keyof typeof ds
