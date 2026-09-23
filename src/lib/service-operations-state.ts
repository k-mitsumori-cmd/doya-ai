import { prisma } from './prisma';
import { withSlackVoice, type Mood } from './slack-voice';
import { OPS_SERVICES, type ServiceKey, jstDay } from './service-operations-data';
export async function readOps<T>(key: string): Promise<T | null> {
  const row = await prisma.systemSetting.findUnique({ where: { key: 'ops:v1:' + key } });
  if (!row) return null;
  try { return JSON.parse(row.value) as T; } catch { return null; }
}
export async function writeOps(key: string, value: unknown): Promise<void> {
  const k = 'ops:v1:' + key, v = JSON.stringify(value);
  await prisma.systemSetting.upsert({ where: { key: k }, create: { key: k, value: v }, update: { value: v } });
}
/** 競合実行はDBの一意キーで排除。処理中に落ちた場合は期限後に再取得できる。 */
export async function claimOps(key: string, ttl = 600000): Promise<boolean> {
  const k = 'ops:v1:lock:' + key, now = Date.now();
  try { await prisma.systemSetting.create({ data: { key: k, value: String(now + ttl) } }); return true; }
  catch (error: any) { if (error?.code !== 'P2002') throw error; }
  const previous = await prisma.systemSetting.findUnique({ where: { key: k } });
  if (!previous || Number(previous.value) >= now) return false;
  return (await prisma.systemSetting.updateMany({ where: { key: k, value: previous.value }, data: { value: String(now + ttl) } })).count === 1;
}
export async function releaseOps(key: string): Promise<void> {
  await prisma.systemSetting.deleteMany({ where: { key: 'ops:v1:lock:' + key } });
}
export async function recordReportDelivered(key: string): Promise<void> {
  await writeOps('receipt:' + key, { at: new Date().toISOString(), day: jstDay() });
}
export async function sendOps(serviceKey: ServiceKey, text: string, receipt: string, mood?: Mood): Promise<boolean> {
  if (await readOps('sent:' + receipt)) return false;
  if (!await claimOps('send:' + receipt)) return false;
  try {
    if (await readOps('sent:' + receipt)) return false;
    const service = OPS_SERVICES.find(s => s.key === serviceKey)!;
    let hook = process.env[service.webhook];
    if (serviceKey === 'doya') hook = (await prisma.systemSetting.findUnique({ where: { key: 'slack_webhook' } }))?.value || process.env.SLACK_ANALYTICS_WEBHOOK_URL;
    if (!hook) throw new Error('通知先が未設定です');
    const response = await fetch(hook, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: withSlackVoice(text, { mood, seed: receipt }) }), signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`Slack HTTP ${response.status}`);
    await writeOps('sent:' + receipt, { at: new Date().toISOString() });
    return true;
  } finally { await releaseOps('send:' + receipt); }
}
