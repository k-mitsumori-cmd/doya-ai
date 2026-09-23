import { NextResponse } from 'next/server';
import { OPS_SERVICES } from '@/lib/service-operations-data';
import { writeOps, readOps, sendOps } from '@/lib/service-operations-state';
import { safeLandingUrl } from '@/lib/service-operations-links';
import { readOperationalJson, OperationalBodyError } from '@/lib/operational-json';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  const secret = process.env.SLACK_OPS_SECRET;
  if (!secret || request.headers.get('authorization') !== 'Bearer ' + secret) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  let body: any;
  try { body = await readOperationalJson(request, 16000); } catch (error) { return NextResponse.json({ error: 'invalid_body' }, { status: error instanceof OperationalBodyError ? error.status : 400 }); }
  const service = OPS_SERVICES.find(s => s.key === body.service);
  if (!service) return NextResponse.json({ error: 'invalid_service' }, { status: 400 });
  const nonnegative = (v: unknown) => Number.isSafeInteger(v) && Number(v) >= 0;
  if (body.kind === 'affiliate' && /^\d{4}-\d{2}-\d{2}〜\d{4}-\d{2}-\d{2}$/.test(body.period) && [body.generated, body.approved, body.approvedJpy].every(nonnegative) && typeof body.source === 'string' && /^[\w .-]{1,80}$/.test(body.source)) {
    const value = { clicks: nonnegative(body.clicks) ? body.clicks : null, period: body.period, generated: body.generated, approved: body.approved, approvedJpy: body.approvedJpy, source: body.source, importedAt: new Date().toISOString() };
    const previous = await readOps<typeof value>('affiliate:' + service.key);
    await writeOps('affiliate:' + service.key, value);
    if ((!previous && (value.generated > 0 || value.approved > 0)) || (previous && ['generated','approved','approvedJpy'].some(k => (previous as any)[k] !== (value as any)[k]))) await sendOps(service.key, `【${service.name}】アフィリエイト成果レポートが届いたよ\n対象：${value.period}\n発生：${value.generated}件／承認：${value.approved}件／承認報酬：${value.approvedJpy}円\n元データ：${value.source}。クリックや入金額とは別の数字だよ。`, `affiliate:${service.key}:${value.period}:${value.generated}:${value.approved}:${value.approvedJpy}`, 'steady');
  } else if (body.kind === 'feedback' && typeof body.id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(body.id) && ['open','resolved'].includes(body.status)) {
    await writeOps('feedback:' + body.id, { status: body.status, service: service.key, updatedAt: new Date().toISOString() });
  } else if (body.kind === 'links' && Array.isArray(body.links) && body.links.length <= 20 && body.links.every((l: any) => l && typeof l === 'object' && !Array.isArray(l) && typeof l.label === 'string' && /^[^<>&\n]{1,60}$/.test(l.label) && typeof l.url === 'string' && safeLandingUrl(l.url))) {
    await writeOps('landing-links:' + service.key, body.links.map((l: any) => ({ label: l.label, url: l.url })));
  } else if (body.kind === 'budget' && nonnegative(body.monthlyJpy) && body.monthlyJpy > 0) {
    await writeOps('budget', { monthlyJpy: body.monthlyJpy });
  } else return NextResponse.json({ error: 'invalid_configuration' }, { status: 400 });
  return NextResponse.json({ ok: true });
}
