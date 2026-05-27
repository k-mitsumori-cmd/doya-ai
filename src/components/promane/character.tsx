import Image from "next/image";
import { cn } from "@/lib/promane/utils";

type CharacterMood =
  | "hello" | "point" | "success" | "working" | "thinking"
  | "jump" | "thumbsup" | "surprise" | "love" | "ramen"
  | "sleep" | "focus" | "present" | "error" | "bug";

const SPEECH: Record<CharacterMood, string> = {
  hello: "やあ！一緒にがんばろう！",
  point: "ここがポイントだよ！",
  success: "やったー！すごい！",
  working: "もくもく作業中...",
  thinking: "うーん、考え中...",
  jump: "最高！！テンション上がる！",
  thumbsup: "いいね！その調子！",
  surprise: "おっ！新しい発見！",
  love: "このプロジェクト大好き！",
  ramen: "休憩も大事だよ〜",
  sleep: "zzz...おやすみ...",
  focus: "集中！集中！",
  present: "プレゼンの時間だ！",
  error: "うぅ...エラーだ...",
  bug: "バグ見つけた！許さない！",
};

export function Character({
  mood,
  size = 80,
  message,
  className,
  animate = "float",
}: {
  mood: CharacterMood;
  size?: number;
  message?: string;
  className?: string;
  animate?: "float" | "bounce-in" | "wiggle" | "none";
}) {
  const animClass = animate === "none" ? "" : `animate-${animate}`;
  const speech = message || SPEECH[mood];

  return (
    <div className={cn("flex items-end gap-2", className)}>
      <Image
        src={`/character/${mood}.png`}
        alt={mood}
        width={size}
        height={size}
        className={cn("drop-shadow-lg", animClass)}
        unoptimized
      />
      {speech && (
        <div className="relative animate-slide-in-right">
          <div className="rounded-2xl bg-white px-3 py-1.5 text-[13px] font-bold text-gray-700 shadow-md ring-1 ring-gray-100 max-w-[200px]">
            {speech}
          </div>
          <div className="absolute -left-1.5 bottom-2 h-3 w-3 rotate-45 bg-white ring-1 ring-gray-100" />
        </div>
      )}
    </div>
  );
}

export function CharacterOnly({
  mood,
  size = 64,
  className,
  animate = "float",
}: {
  mood: CharacterMood;
  size?: number;
  className?: string;
  animate?: "float" | "bounce-in" | "wiggle" | "none";
}) {
  const animClass = animate === "none" ? "" : `animate-${animate}`;
  return (
    <Image
      src={`/character/${mood}.png`}
      alt={mood}
      width={size}
      height={size}
      className={cn("drop-shadow-md", animClass, className)}
      unoptimized
    />
  );
}
