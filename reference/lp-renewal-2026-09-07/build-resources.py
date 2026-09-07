# -*- coding: utf-8 -*-
import json, html, subprocess
from pathlib import Path
ids='banner seo interview persona hr kintai doyalist promane doyaslide cunning sfa shodan aio mensetsu quote aishodan adimage'.split()
repo=Path(__file__).resolve().parents[2]
payload=subprocess.check_output([str(repo/'node_modules/.bin/tsx'),'-e','import {SERVICES} from "./src/lib/services"; console.log(JSON.stringify(SERVICES))'],cwd=repo,text=True)
services=[s for s in json.loads(payload) if s['id'] in ids]
checks={
'banner':['説明・見出し・ブランドカラー','訴求、日本語、サイズ、画像の利用権'],
'seo':['テーマ・キーワード・読者像','事実、引用元、固有名詞'],
'interview':['取材音声やテキスト・記事の目的','話者、発言意図、公開許諾'],
'persona':['対象サービスのURLや説明','顧客仮説と実際の顧客情報の整合性'],
'hr':['従業員情報・部署・評価項目','個人情報へのアクセス範囲と評価根拠'],
'kintai':['従業員・就業ルール・承認担当者','打刻、残業、休暇の集計と社内ルール'],
'doyalist':['対象業種・エリア・リスト条件','情報の鮮度、連絡先、営業文の内容'],
'promane':['案件名・担当者・期日・タスク','メンバー権限、担当者、期限'],
'doyaslide':['テーマ・目的・枚数・スタイル','ページごとの数値、文章、図表'],
'cunning':['会議資料・ナレッジ・音声環境','相手への説明、録音の同意、回答根拠'],
'sfa':['取引先・商談・担当者・フェーズ','重複登録、権限、更新ルール'],
'shodan':['商談先URL・自社の商材情報','調査結果の根拠と課題仮説'],
'aio':['ブランドURL・監視したい質問','測定日時、対象AI、改善施策'],
'mensetsu':['職種・評価基準・質問セット','応募者への説明、同意、採用担当者による最終判断'],
'quote':['サービスURL・品目・数量・単価','金額の根拠、税区分、納期、契約条件'],
'aishodan':['商材説明・ヒアリング項目・判定基準','相手への説明、同意、営業担当者によるレビュー'],
'adimage':['商品URL・媒体・配置・訴求内容','広告表現、文字、サイズ、媒体の入稿要件']}
css='''*{box-sizing:border-box}body{margin:0;background:#f3f7ff;color:#16284b;font-family:Arial,sans-serif;line-height:1.9}header,main,footer{max-width:960px;margin:auto;padding:36px}header{padding-top:60px}header small{letter-spacing:.15em;color:#0066ff;font-weight:800}h1{font-size:40px;line-height:1.4}h2{font-size:25px;line-height:1.5;margin-top:0}h3{font-size:17px}p,li{font-size:16px}section{scroll-margin-top:30px;background:#fff;border:1px solid #dce7fa;border-radius:20px;padding:32px;margin-bottom:24px;break-inside:avoid}a{color:#0054d6}nav{display:flex;flex-wrap:wrap;gap:12px;margin:25px 0}button,.button{display:inline-block;background:#0066ff;color:#fff;padding:12px 22px;border:0;border-radius:50px;font-weight:700;text-decoration:none;cursor:pointer}.checklist{list-style:none;padding:0}.checklist li{border-bottom:1px solid #e4ebf8;padding:12px 0}.checklist input{width:18px;height:18px;margin-right:12px;accent-color:#0066ff}footer{font-size:13px;color:#64748b}@media(max-width:600px){header,main,footer{padding:22px}h1{font-size:28px}section{padding:22px}}@media print{body{background:white}header,main,footer{max-width:none;padding:0}nav,button,.button{display:none}section{border:none;border-top:2px solid #0066ff;border-radius:0;padding:24px 0}a{color:inherit;text-decoration:none}}'''
intro={'overview':('サービス紹介','17サービスの役割と活用シーンをまとめました。自分の業務に合うAIを見つけてください。'),'getting-started':('はじめ方ガイド','必要な情報の準備から成果物の確認まで。サービスごとの進め方を整理しました。'),'checklist':('導入チェックリスト','チェック内容は送信されません。印刷またはPDF保存して、社内での検討にご活用ください。')}
nav='<nav>'+''.join('<a href="#'+s['id']+'">'+html.escape(s['name'])+'</a>' for s in services)+'</nav>'
for file,(title,lead) in intro.items():
 blocks=[]
 if file=='checklist':
  qs=['利用する業務と担当者を決めた','入力するデータと公開・共有の範囲を確認した','社内のAI利用方針と利用規約を確認した','無料プランで操作を確かめた','成果物を確認・承認する担当者を決めた','プロプランの料金と各サービスの利用上限を確認した','継続利用を判断する基準を決めた']
  blocks.append('<section><h2>共通の確認事項</h2><ul class="checklist">'+''.join('<li><label><input type="checkbox">'+q+'</label></li>' for q in qs)+'</ul><p>プロプランは月額9,980円（税込）の共通プランです。各サービスには利用上限があります。最新条件は<a href="/pricing">料金ページ</a>をご確認ください。</p></section>')
 for s in services:
  sid=s['id'];name=html.escape(s['name']);inp,check=checks[sid]
  if file=='overview':
   body='<p>'+html.escape(s['description'])+'</p><h3>主な機能</h3><ul>'+''.join('<li>'+html.escape(f)+'</li>' for f in s['features'][:5])+'</ul><h3>活用シーン</h3><p>'+html.escape(' / '.join(s.get('useCases',[])[:3]))+'</p>'
  elif file=='getting-started':
   body='<ol><li>サービスページを開き、無料プランから開始します。</li><li>'+inp+'を準備します。</li><li>画面の案内に沿って入力し、作成・登録を進めます。</li><li>'+check+'を確認します。</li></ol><p>AIの提案には誤りが含まれる場合があります。担当者が内容を確認・修正してから実際の業務でご利用ください。</p>'
  else:
   qs=[inp+'を用意した',check+'を確認した','利用する人数・件数とプランの利用枠を照合した','運用後のレビュー担当と頻度を決めた']
   body='<ul class="checklist">'+''.join('<li><label><input type="checkbox">'+q+'</label></li>' for q in qs)+'</ul>'
  blocks.append('<section id="'+sid+'"><h2>'+name+'</h2>'+body+'<a class="button" href="/'+sid+'">'+name+'を見る →</a></section>')
 page='<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+title+' | ドヤマーケAI</title><meta name="description" content="'+lead+'"><style>'+css+'</style></head><body><header><small>DOYA MARKE AI / STARTER KIT</small><h1>'+title+'</h1><p>'+lead+'</p><button onclick="window.print()">印刷・PDFに保存</button>'+nav+'</header><main>'+''.join(blocks)+'</main><footer>作成日：2026年9月7日 / 運営：株式会社スリスタ<br><a href="/">ドヤマーケAIへ戻る</a> · <a href="/pricing">最新の料金と利用枠</a></footer></body></html>'
 (repo/'public/resources/doya-ai'/ (file+'.html')).write_text(page,encoding='utf-8')
print('Created 3 documents, 17 service sections each')
