# -*- coding: utf-8 -*-
from pathlib import Path
import re,json,csv,hashlib,subprocess,html
R=Path('/Users/mitsumori_katsuki/Code/09_Cursol'); O=Path(__file__).parent
s=(R/'prisma/schema.prisma').read_text(); models={}; relations=[]
for m in re.finditer(r'^model (\w+) \{\n(.*?)^\}',s,re.M|re.S):
 name,body=m.group(1,2); fields=[]
 for l in body.splitlines():
  f=re.match(r'\s*(\w+)\s+([\w\[\]?]+)(.*)',l)
  if f: fields.append(dict(name=f[1],type=f[2],attrs=f[3].strip()))
 models[name]=dict(name=name,fields=fields,body=body,line=s[:m.start()].count('\n')+1,table=(re.search(r'@@map\("([^"]+)"\)',body).group(1) if '@@map(' in body else name))
for n,m in models.items():
 for f in m['fields']:
  target=f['type'].rstrip('?[]'); a=f['attrs']
  if target in models and 'fields:' in a:
   fk=re.search(r'fields:\s*\[([^]]+)\]',a)[1].replace(' ','').split(',')
   refs=re.search(r'references:\s*\[([^]]+)\]',a)[1]
   unique=any(x['name'] in fk and ('@unique' in x['attrs'] or '@id' in x['attrs']) for x in m['fields']) if len(fk)==1 else False
   unique=unique or any({x.strip() for x in u.split(',')}==set(fk) for u in re.findall(r'@@(?:unique|id)\(\[([^]]+)\]',m['body']))
   primary={x['name'] for x in m['fields'] if '@id' in x['attrs']}
   for keys in re.findall(r'@@id\(\[([^]]+)\]',m['body']): primary.update(x.strip() for x in keys.split(','))
   relations.append(dict(parent=target,child=n,field=f['name'],fk=fk,refs=refs,optional=f['type'].endswith('?'),unique=unique,identifying=set(fk).issubset(primary),delete=(re.search(r'onDelete:\s*(\w+)',a)[1] if 'onDelete:' in a else '未指定')))
prefixes={'Seo':'seo','Swipe':'seo','InterviewX':'interviewx','Interview':'interview','Strategy':'strategy','Tenkai':'tenkai','Opening':'opening','Copy':'copy','Lp':'lp','Voice':'voice','Movie':'movie','AdSim':'adsim','Hr':'hr','Kintai':'kintai','Promane':'promane','Doyalist':'doyalist','DoyaSlide':'doyaslide','Cunning':'cunning','Sfa':'sfa','Shodan':'shodan','AdBanner':'adbanner','Aio':'aio','Mensetsu':'mensetsu','Quote':'quote','Aishodan':'aishodan','AdImage':'adimage','Drip':'drip','Mitsuboshi':'external','Doyamana':'doyamana','BannerTemplate':'banner','Persona':'persona'}
for n,m in models.items(): m['group']=next((v for k,v in prefixes.items() if n.startswith(k)),'core')
services=json.loads((O/'service-registry.json').read_text()); retired={x['id'] for x in services if x['retired']}
labels={x['id']:x['name'] for x in services}; labels.update(core='共通基盤・認証・課金',drip='運営・メール配信',external='別事業：三ツ星ナグサメ',doyamana='関連機能：ドヤマナ',strategy='関連定義：戦略プロジェクト')
def diagram(names,compact=False):
 names=set(names); lines=['erDiagram','    direction LR']
 for n in models:
  if n not in names: continue
  m=models[n]; scalars=[f for f in m['fields'] if f['type'].rstrip('?[]') not in models]; fk={k for r in relations if r['child']==n for k in r['fk']}
  chosen=[f for f in scalars if '@id' in f['attrs'] or f['name'] in fk or '@unique' in f['attrs'] or f['name'] in ['name','title','status','plan','serviceId','slug','userId','organizationId','createdAt']]
  if compact: chosen=[f for f in chosen if '@id' in f['attrs'] or f['name'] in fk or f['name'] in ['plan','serviceId','userId','organizationId']]
  lines.append('    '+n+' {')
  for f in chosen:
   keys=[]
   if '@id' in f['attrs']: keys.append('PK')
   if f['name'] in fk: keys.append('FK')
   if '@unique' in f['attrs']: keys.append('UK')
   ty=f['type'].replace('?','').replace('[]','_array'); note=' "nullable"' if '?' in f['type'] else ''
   lines.append('        '+ty+' '+f['name']+(' '+','.join(keys) if keys else '')+note)
  lines.append('    }')
 for r in relations:
  if r['parent'] in names and r['child'] in names:
   left='|o' if r['optional'] else '||'; right='o|' if r['unique'] else 'o{'
   separator='--' if r['identifying'] else '..'
   lines.append(f'    {r["parent"]} {left}{separator}{right} {r["child"]} : "{",".join(r["fk"])}"')
 return '\n'.join(lines)
# Declared relations only; primary-key foreign keys use identifying lines.
charts=[]
core=['User','Account','Subscription','UserServiceSubscription','Generation','Template','Category']
charts.append(dict(id='overview',title='共通基盤の要約（抜粋）',kind='全体',code=diagram(core,True),names=core))
for group in ['core']+[x['id'] for x in services if x['public']]+['drip','doyamana','strategy']+[x['id'] for x in services if x['retired']]+['external']:
 own=[n for n,m in models.items() if m['group']==group]
 if group in ['banner','persona']: own+=['Generation','UserServiceSubscription']
 if not own: continue
 names=set(own)
 for r in relations:
  if r['child'] in own: names.add(r['parent'])
 kind='公開対象' if any(x['id']==group and x['public'] for x in services) else ('提供終了・旧定義' if group in retired else '共通・関連')
 charts.append(dict(id=group,title=labels.get(group,group),kind=kind,code=diagram(names),names=sorted(names)))
charts.append(dict(id='all',title='全モデル統合図（大型）',kind='全体',code=diagram(models,True),names=list(models)))
for c in charts: (O/(c['id']+'.mmd')).write_text(c['code'])
with (O/'entities.csv').open('w') as f:
 w=csv.writer(f,lineterminator="\n");w.writerow(['domain','model','table','field','type','attributes','schema_line'])
 for n,m in models.items():
  for x in m['fields']: w.writerow([m['group'],n,m['table'],x['name'],x['type'],x['attrs'],m['line']])
with (O/'relations.csv').open('w') as f:
 w=csv.DictWriter(f,fieldnames=list(relations[0]),lineterminator="\n");w.writeheader();w.writerows(relations)
manifest=dict(date='2026-10-06',commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=R,text=True).strip(),schema_sha256=hashlib.sha256(s.encode()).hexdigest(),services_sha256=hashlib.sha256((R/'src/lib/services.ts').read_bytes()).hexdigest(),models=len(models),relations=len(relations),public_services=sum(x['public'] for x in services),charts=len(charts),source='現在のローカルPrismaスキーマとサービス定義から生成。作業ツリー変更を含む。DMMFと別途照合する。DB実レコード・本番DB構造・稼働状態の確認結果ではない。')
(O/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
notes='''対象はドヤマーケの現行ローカルPrisma定義です。190モデルなどの件数は生成元から計算します。接続先DBの実レコードや本番反映状態はこの図から判断できません。外部サービス内部やStudio CMSの構造は対象外です。

サービス一覧はsrc/lib/services.tsの実getPublicServices()の結果です。公開区分は稼働保証ではありません。Generation.serviceIdやUserServiceSubscription.serviceIdは文字列であり、ServiceへのFKとして描画しません。

ペルソナにはPersonaProject、PersonaImageJob、PersonaImageUsageDay、PersonaUsageDay、PersonaImagePurgeTaskの専用モデルが存在します。旧2026-09-16版の専用モデルなしという記述は現行定義に一致しません。StrategyProjectは別の戦略用定義です。

利用枠・契約者・課金判定の業務仕様はER線だけでは表現できません。src/lib/unified-plan.ts、サービス別quota/admissionと課金実装を併せて確認してください。FKのないID列もアプリでの本人・所属確認が必要です。

ER線は宣言済みrelationFromFieldsとreferencesに対応するものだけです。主キーでもあるFKは一意として1対1にし、親キーが子の主キーに含まれる識別関係は実線、その他は点線です。CunningRecordingLease.sessionIdの主キー兼FKを1対多にする旧生成処理を修正しました。必須/任意・一意制約を示し、親に子が必ず存在することは保証しません。全フィールド、複合一意制約、索引、デフォルトはデータ辞書に収録します。StringやJson内部を推測して新しいテーブルを作り足しません。

旧版と本資料は監査時点の別スナップショットです。全サービス監査・本番通し確認は継続中です。図の更新を不具合ゼロや復旧済みの証拠として扱いません。'''
md=['# どやまーけ サービス全体 ER設計図','',f'作成日：2026-10-06 ｜ 公開対象 {manifest["public_services"]} サービス ｜ {len(models)} モデル ｜ {len(relations)} リレーション','',notes,'','## サービス・データ対応表','','|サービスID|サービス名|区分|専用モデル数|','|---|---|---|---|']
for x in services:
 count=sum(m['group']==x['id'] for m in models.values()); md.append(f'|{x["id"]}|{x["name"]}|'+('公開対象' if x['public'] else '提供終了・非公開')+f'|{count}'+('（専用モデルなし。共通生成履歴等はAPI参照）' if not count else '')+'|')
md+=['','## 読み方','','index.html を開き、左のサービスを選択してください。SVG保存・Mermaid保存ができます。全モデル統合図は広いため、サービス別図を推奨します。','']
for c in charts:
 if c['id']=='all': continue
 md+=['## '+c['title'],'','```mermaid',c['code'],'```','']
md+=['## 参照元','','- prisma/schema.prisma（本書の正本）','- src/lib/services.ts（公開区分・サービス名）','- reference/11-billing-spec.md（課金不変条件）','- src/app/api/banner/generate/route.ts（共通Generation利用）','- src/app/api/persona/generate/route.ts（ペルソナの利用ログ記録）','','旧 reference/04-database.md のモデル数・課金制約には現スキーマとの不一致があるため、本資料では現スキーマを採用。']
(O/'README.md').write_text('\n'.join(md))
dictionary=['# 全モデル データ辞書','', 'スキーマの構造定義のみ。実レコードや環境変数値は含みません。','']
for n,m in models.items(): dictionary+=['## '+n,'',f'領域: {labels.get(m["group"],m["group"])} / DBテーブル: {m["table"]} / schema.prisma:{m["line"]}','','```prisma','model '+n+' {',m['body'],'}','```','']
(O/'dictionary.md').write_text('\n'.join(dictionary))
audit_path=O/'audit.md'
if audit_path.exists():
 notes+='\n\n'+audit_path.read_text()
 with (O/'README.md').open('a') as f: f.write('\n\n'+audit_path.read_text())
payload=dict(charts=charts,models=models,services=services,manifest=manifest,notes=notes)
(O/'data.json').write_text(json.dumps(payload,ensure_ascii=False))
print(json.dumps(manifest,ensure_ascii=False));print('Groups:',[(c['id'],len(c['names'])) for c in charts])
