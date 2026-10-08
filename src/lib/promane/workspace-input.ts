export type PromaneWorkspaceCreateInput = { name: string };
export type PromaneWorkspacePatch = { expectedUpdatedAt: string; name?: string; slug?: string };
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('ワークスペースの入力を確認してください');
  return value as Record<string, unknown>;
}
function name(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('ワークスペース名は必須です');
  const result=value.trim();
  if (result.length > 100) throw new Error('ワークスペース名は100文字以内');
  return result;
}
export function parsePromaneWorkspaceCreate(value: unknown): PromaneWorkspaceCreateInput {
  const data=object(value);
  return {name:name(data.name)};
}
export function parsePromaneWorkspacePatch(value: unknown): PromaneWorkspacePatch {
  const data=object(value);
  if (typeof data.expectedUpdatedAt !== 'string' || !Number.isFinite(+new Date(data.expectedUpdatedAt)) || new Date(data.expectedUpdatedAt).toISOString() !== data.expectedUpdatedAt) throw new Error('ワークスペースの更新情報を確認できません。入力を保管して最新版を開き直してください');
  const patch: PromaneWorkspacePatch={expectedUpdatedAt:data.expectedUpdatedAt};
  if (data.name !== undefined) patch.name=name(data.name);
  if (data.slug !== undefined) {
    if (typeof data.slug !== 'string') throw new Error('スラッグの形式が不正です');
    const slug=data.slug.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{2,49}$/.test(slug)) throw new Error('スラッグは半角英数字とハイフン、3〜50文字');
    patch.slug=slug;
  }
  if (patch.name === undefined && patch.slug === undefined) throw new Error('変更項目がありません');
  return patch;
}
