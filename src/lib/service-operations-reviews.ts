import jwt from 'jsonwebtoken';
import { createHash } from 'node:crypto';
import { makeJwt } from './appstore-sales-core';
import { OPS_SERVICES } from './service-operations-data';
import { readOps, writeOps, sendOps } from './service-operations-state';
export async function pollStoreReviews(dry = false) {
  const token = process.env.APPSTORE_REVIEWS_PRIVATE_KEY ? jwt.sign({ iss: process.env.APPSTORE_ISSUER_ID, aud: 'appstoreconnect-v1' }, process.env.APPSTORE_REVIEWS_PRIVATE_KEY.replace(/\\n/g, '\n'), { algorithm: 'ES256', expiresIn: 1200, keyid: process.env.APPSTORE_REVIEWS_KEY_ID }) : makeJwt();
  const results = [];
  for (const service of OPS_SERVICES.filter(s => s.appId)) {
    try {
      let url: string | null = `https://api.appstoreconnect.apple.com/v1/apps/${service.appId}/customerReviews?sort=-createdDate&limit=200`;
      const reviews: any[] = [];
      for (let page = 0; url && page < 5; page++) {
        const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) });
        if (!r.ok) throw new Error(`Appleレビュー取得 HTTP ${r.status}`);
        const json: any = await r.json(); reviews.push(...(json.data || [])); url = json.links?.next || null;
      }
      if (url) throw new Error('レビュー取得上限に達しました。全件確認前のため通知済み位置は進めません');
      const previous = await readOps<Record<string, string>>('reviews:' + service.key);
      const signatures = Object.fromEntries(reviews.map(r => [r.id, createHash('sha256').update(JSON.stringify(r.attributes)).digest('hex')]));
      const fresh = previous ? reviews.filter(r => previous[r.id] !== signatures[r.id]) : reviews.slice(0, 3);
      const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      for (const review of fresh) {
        const a = review.attributes;
        const text = [`【${service.name}】${previous ? 'レビューに新しい動き！' : '初回チェック・最近のレビューだよ'}${a.rating <= 2 ? '【要確認・低評価】' : ''}`,
          `評価：星 ${a.rating}／5`, `レビュー日：${a.createdDate}`, `ストア地域：${a.territory || '未確認'}`,
          `タイトル：${esc(a.title)}`, `内容：${esc(a.body).slice(0, 2200)}`, `確認先：https://appstoreconnect.apple.com/apps/${service.appId}/distribution/ratings`,
          '自動返信はしていないよ。困っている内容があれば、原因と案内を確認してね。'].join('\n');
        if (!dry) await sendOps(service.key, text, `review:${review.id}:${signatures[review.id]}`, a.rating <= 2 ? 'error' : 'activity');
      }
      if (!dry) { await writeOps('reviews:' + service.key, signatures); await writeOps('review-status:' + service.key, { ok: true, at: new Date().toISOString(), count: reviews.length }); }
      results.push({ service: service.key, ok: true, initial: !previous, newOrChanged: fresh.length, checked: reviews.length });
    } catch (error: any) {
      if (!dry) await writeOps('review-status:' + service.key, { ok: false, at: new Date().toISOString(), reason: String(error.message).slice(0, 140) });
      results.push({ service: service.key, ok: false, reason: String(error.message).slice(0, 140) });
    }
  }
  return results;
}
