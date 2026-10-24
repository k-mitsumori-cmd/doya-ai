"use client";

import { parsePromaneIntegerInput } from "@/lib/promane/time-input";
import { useState } from "react";
import { useRouter } from "next/navigation";
// 注: updateMemberRate Server Action は Server Components renderエラー/チャンクキャッシュの
//     問題を回避するため、代わりに /api/promane/members/[id]/rate (PATCH) を使用
import { Input } from "@/components/promane/ui/input";
import { Button } from "@/components/promane/ui/button";
import { Badge } from "@/components/promane/ui/badge";
import { formatCurrency, formatDuration } from "@/lib/promane/format";
import { AlertTriangle, Pencil, Save, Timer, UserPlus, Wallet } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import { InviteModal } from "@/components/promane/invite-modal";
import { userErrorMessage } from '@/lib/promane/user-error'

type MemberItem = {
  id: string;
  displayName: string;
  role: string;
  email: string | null;
  hourlyRate: number;
  totalMinutes: number;
};

const ROLE_LABELS: Record<string, string> = {
  owner: "オーナー",
  admin: "管理者",
  member: "メンバー",
  guest: "ゲスト",
};

export function MemberList({
  workspaceId,
  workspaceSlug,
  canInvite,
  myMemberId,
  members,
}: {
  workspaceId: string;
  workspaceSlug: string;
  canInvite: boolean;
  myMemberId?: string;
  members: MemberItem[];
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  // ⚠️ 重要: number ではなく string 型で保持
  // 理由: number 型だと parseInt("-") = NaN → 0 にリセット → 続く "3000" が +3000 として入力される（絶対値化バグ）
  // string で保持すれば "-3000" がそのまま残り、Save時に validation 可能
  const [rateInput, setRateInput] = useState("0");
  const [inviteOpen, setInviteOpen] = useState(false);
  let rate = 0;
  let rateError: string | null = null;
  try { rate = parsePromaneIntegerInput(rateInput, "時間単価", false) }
  catch (error) { rateError = userErrorMessage(error instanceof Error ? error.message : null, "時間単価を確認してください") }
  const rateValid = rateError === null;

  async function handleSaveRate(memberId: string) {
    // クライアント側 事前バリデーション (rateInput文字列から parseしてチェック)
    if (rateError) {
      toast.error(rateError, {
        duration: 6000,
        icon: <Image src="/character/error.png" alt="" width={28} height={28} unoptimized />,
      });
      return;
    }
    try {
      // Server Action → API ルート化 (チャンクキャッシュ問題回避)
      const res = await fetch(`/api/promane/members/${memberId}/rate`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceSlug, hourlyRate: rate }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(userErrorMessage(data?.error, '時間単価を更新できませんでした。もう一度お試しください。'), {
          duration: 6000,
          icon: <Image src="/character/error.png" alt="" width={28} height={28} unoptimized />,
        });
        console.error("[promane/member] rate update failed", res.status, data);
        return;
      }
      toast.success("時間単価を更新したよ！");
      setEditingId(null);
      router.refresh();
    } catch (e: any) {
      console.error("[promane/member] rate update exception");
      toast.error(userErrorMessage(e?.message, "通信できませんでした。通信を確かめて、もう一度お試しください。"), { duration: 6000 });
    }
  }

  return (
    <>
      {/* 招待ボタン */}
      {canInvite && (
        <div className="mb-6 flex justify-end">
          <Button
            onClick={() => setInviteOpen(true)}
            className="rounded-full h-12 px-7 text-[15px] font-black shadow-lg bg-gradient-to-r from-blue-500 to-brand-500 hover:from-blue-600 hover:to-brand-600 transition-all hover:scale-105 active:scale-95"
          >
            <UserPlus className="mr-2 h-5 w-5" />
            メンバーを招待
          </Button>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {members.map((member, i) => {
          const isMe = member.id === myMemberId;
          return (
            <div
              key={member.id}
              className={`rounded-3xl bg-white ring-1 shadow-sm p-6 transition-all hover:shadow-xl hover:scale-[1.02] animate-slide-up stagger-${Math.min(i + 1, 5)} ${
                isMe ? 'ring-2 ring-blue-400 bg-gradient-to-br from-blue-50/50 to-brand-50/50' : 'ring-gray-200 hover:ring-green-300'
              }`}
            >
              <div className="flex items-center gap-4 mb-5">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-brand-400 text-[20px] font-black text-white shadow-md">
                  {member.displayName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[17px] font-black text-gray-900 truncate">{member.displayName}</p>
                    {isMe && (
                      <span className="text-[10px] font-black bg-blue-500 text-white px-2 py-0.5 rounded-full flex-shrink-0">YOU</span>
                    )}
                  </div>
                  <p className="text-[13px] font-bold text-gray-400 truncate">{member.email}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[14px] font-bold text-gray-500">ロール</span>
                  <Badge variant="secondary" className="font-black text-[13px] rounded-full px-3 py-1">
                    {ROLE_LABELS[member.role]}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="inline-flex items-center gap-1 text-[14px] font-bold text-gray-500"><Timer className="h-4 w-4" aria-hidden />総稼働</span>
                  <span className="text-[15px] font-black text-gray-900">{formatDuration(member.totalMinutes)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="inline-flex items-center gap-1 text-[14px] font-bold text-gray-500"><Wallet className="h-4 w-4" aria-hidden />時間単価</span>
                  {editingId === member.id ? (
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={rateInput}
                          onChange={(e) => {
                            // string で生入力を保持 (絶対値化バグの根本対処)
                            // 入力を変換せず保持し、小数や文字は検証で拒否する。
                            setRateInput(e.target.value);
                          }}
                          className={`h-9 w-28 text-right text-[14px] font-black rounded-xl ${
                            !rateValid ? "border-2 border-rose-500 bg-rose-50 text-rose-700" : ""
                          }`}
                          placeholder="0"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={!rateValid}
                          className="h-9 w-9 p-0 rounded-xl hover:bg-green-50 disabled:opacity-40 disabled:cursor-not-allowed"
                          onClick={() => handleSaveRate(member.id)}
                          title={!rateValid ? rateError || "保存できません" : "保存"}
                        >
                          <Save className={`h-4 w-4 ${!rateValid ? "text-rose-400" : "text-green-600"}`} />
                        </Button>
                      </div>
                      {rateError && (
                        <p className="flex items-start justify-end gap-1 text-[11px] font-bold text-rose-600 max-w-[160px] text-right">
                          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />{rateError}
                        </p>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingId(member.id);
                        setRateInput(String(member.hourlyRate ?? 0));
                      }}
                      aria-label={`${member.displayName}の時間単価を変える`}
                      className="inline-flex items-center gap-1 text-[16px] font-black text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      {formatCurrency(member.hourlyRate)}/h <Pencil className="h-4 w-4" aria-hidden />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <InviteModal
        workspaceId={workspaceId}
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        canInvite={canInvite}
      />
    </>
  );
}
