#!/usr/bin/env python3
"""Build source-only ER data from a verified DMMF bundle. Does not read a database."""
import argparse
import csv
import hashlib
import json
import pathlib
import re
import shutil
import subprocess
from collections import Counter


def sha(data):
    return hashlib.sha256(data).hexdigest()


def git(root, *args):
    return subprocess.check_output(['git', '-C', str(root), *args], text=True).strip()


def fail(message):
    raise ValueError(message)


def read_bundle(root, inp, date):
    manifest = json.loads((inp / 'manifest.json').read_text())
    if manifest['date'] != date or not manifest.get('formattedSourceSchemaSha256') or \
            manifest['formattedSourceSchemaSha256'] != manifest.get('formattedGeneratedClientSchemaSha256'):
        fail('Date or pinned-formatter generated schema binding mismatch')
    if manifest['sourceStatus']:
        fail('Input export came from a dirty tracked source')
    if git(root, 'rev-parse', manifest['sourceCommit'] + '^{tree}') != manifest['sourceTree']:
        fail('Input source commit/tree unavailable or mismatched')
    for name, expected in manifest['filesSha256'].items():
        if sha((inp / name).read_bytes()) != expected:
            fail('Input bundle hash mismatch: ' + name)
    if sha((root / 'prisma/schema.prisma').read_bytes()) != manifest['schemaSha256']:
        fail('Current schema differs from exported input')
    for name, expected in manifest['closureSha256'].items():
        # The generated client is bound and verified by CI; a local checkout may not
        # contain it. All tracked source dependencies must still match exact bytes.
        if name.startswith('node_modules/'):
            continue
        file = root / name
        if not file.is_file() or sha(file.read_bytes()) != expected:
            fail('Source closure changed: ' + name)
    dmmf = json.loads((inp / 'dmmf.json').read_text())
    registry = json.loads((inp / 'service-registry.json').read_text())
    if len(dmmf['models']) != manifest['counts']['models'] or len(dmmf['enums']) != manifest['counts']['enums']:
        fail('DMMF counts mismatch')
    if len(registry) != manifest['counts']['services'] or sum(s['public'] for s in registry) != manifest['counts']['publicServices']:
        fail('Service registry counts mismatch')
    return manifest, dmmf, registry


def source_blocks(schema, keyword):
    # Only source excerpts/line references come from text; DMMF supplies structure.
    pattern = re.compile(r'^' + keyword + r'\s+(\w+)\s*\{', re.M)
    found = {}
    for match in pattern.finditer(schema):
        close = re.search(r'^\}', schema[match.end():], re.M)
        if close is None or match.group(1) in found:
            fail('Unsupported or duplicate schema block: ' + match.group(1))
        end = match.end() + close.end()
        found[match.group(1)] = {'line': schema[:match.start()].count('\n') + 1, 'raw': schema[match.start():end]}
    return found


def relation_edges(models):
    by_name = {m['name']: m for m in models}
    edges = []
    for child in models:
        names = {f['name']: f for f in child['fields']}
        primary_ordered = (child.get('primaryKey') or {}).get('fields') or [f['name'] for f in child['fields'] if f.get('isId')]
        primary = set(primary_ordered)
        groups = [tuple(x) for x in child.get('uniqueFields', [])]
        groups += [tuple((x.get('fields') or [])) for x in child.get('uniqueIndexes', [])]
        if primary:
            groups.append(tuple(primary_ordered))
        for field in child['fields']:
            if field['kind'] != 'object' or not field.get('relationFromFields'):
                continue
            parent = by_name.get(field['type'])
            fk, refs = field['relationFromFields'], field.get('relationToFields') or []
            if parent is None or len(fk) != len(refs) or not fk:
                fail('Invalid DMMF relation target/columns: ' + child['name'] + '.' + field['name'])
            parent_names = {f['name']: f for f in parent['fields']}
            for left, right in zip(fk, refs):
                if left not in names or right not in parent_names or names[left]['kind'] == 'object' or parent_names[right]['kind'] == 'object':
                    fail('Invalid ordered FK/reference: ' + child['name'] + '.' + field['name'])
            unique = len(fk) == 1 and (names[fk[0]].get('isUnique') or names[fk[0]].get('isId'))
            # Cardinality depends on the same columns, but the recorded FK and
            # declared constraint order remain untouched for provenance.
            unique = bool(unique or any(len(fk) == len(g) and sorted(fk) == sorted(g) for g in groups))
            edges.append({
                'parent': parent['name'], 'parentTable': parent.get('dbName') or parent['name'],
                'child': child['name'], 'childTable': child.get('dbName') or child['name'],
                'relationField': field['name'], 'relationName': field.get('relationName'),
                'fk': fk, 'references': refs, 'optional': not field['isRequired'],
                'unique': unique, 'identifying': set(fk).issubset(primary),
                'onDelete': field.get('relationOnDelete'), 'onUpdate': field.get('relationOnUpdate')
            })
    return edges


def mermaid(models, edges, selected):
    selected = set(selected)
    lines = ['erDiagram', '    direction LR']
    for model in models:
        if model['name'] not in selected:
            continue
        name = model['name']
        fk = {n for e in edges if e['child'] == name for n in e['fk']}
        pk = set((model.get('primaryKey') or {}).get('fields') or [])
        lines.append('    ' + name + ' {')
        for f in model['fields']:
            if f['kind'] == 'object':
                continue
            typ = re.sub(r'[^A-Za-z0-9_]', '_', f['type']) + ('_array' if f['isList'] else '')
            keys = [k for k, enabled in [('PK', f.get('isId') or f['name'] in pk), ('FK', f['name'] in fk), ('UK', f.get('isUnique'))] if enabled]
            line = '        ' + typ + ' ' + f['name'] + (' ' + ','.join(keys) if keys else '')
            if not f['isRequired']:
                line += ' "nullable"'
            lines.append(line)
        lines.append('    }')
    for e in edges:
        if e['parent'] not in selected or e['child'] not in selected:
            continue
        left = '|o' if e['optional'] else '||'
        sep = '--' if e['identifying'] else '..'
        right = 'o|' if e['unique'] else 'o{'
        label = e['relationField'] + ':' + ','.join(e['fk']) + '->' + ','.join(e['references'])
        lines.append('    ' + e['parent'] + ' ' + left + sep + right + ' ' + e['child'] + ' : "' + label + '"')
    return '\n'.join(lines) + '\n'


def build(root, inp, out, date, mermaid_source, group_map_file):
    if out.exists() or out == root / 'docs/architecture/2026-10-06-er':
        fail('Output must be a new path; old ER snapshot is immutable')
    manifest, dmmf, registry = read_bundle(root, inp, date)
    schema = (inp / 'schema.prisma').read_text()
    model_blocks = source_blocks(schema, 'model')
    enum_blocks = source_blocks(schema, 'enum')
    models, enums = dmmf['models'], dmmf['enums']
    if set(model_blocks) != {m['name'] for m in models} or set(enum_blocks) != {e['name'] for e in enums}:
        fail('Schema and DMMF model/enum sets differ')
    groups = json.loads(group_map_file.read_text())
    if groups['schemaSha256'] != manifest['schemaSha256'] or set(groups['models']) != set(model_blocks):
        fail('Group map is not complete for current source schema')
    if not groups.get('sourceCommit') or not groups.get('evidenceSha256'):
        fail('Group map has no source-bound caller evidence')
    referenced = {decision[key] for decision in groups['models'].values()
                  for key in ('evidence', 'actualRoute') if decision.get(key)}
    if set(groups['evidenceSha256']) != referenced:
        fail('Group map evidence closure differs from referenced callers')
    for relative, expected in groups['evidenceSha256'].items():
        file = root / relative
        if not file.is_file() or sha(file.read_bytes()) != expected:
            fail('Group map caller changed: ' + relative)
        try:
            authored = subprocess.check_output(['git', '-C', str(root), 'cat-file', 'blob',
                                                groups['sourceCommit'] + ':' + relative])
        except subprocess.CalledProcessError:
            fail('Group map source commit lacks caller: ' + relative)
        if sha(authored) != expected:
            fail('Group map caller hash differs from source commit: ' + relative)
    for name, decision in groups['models'].items():
        evidence = root / decision['evidence']
        if not evidence.is_file() or decision['group'] == 'unknown':
            fail('Unverified model group: ' + name)
        if decision.get('actualRoute') and not (root / decision['actualRoute']).is_file():
            fail('Missing actual route for model: ' + name)
    edges = relation_edges(models)
    linked = {(e['parent'], e['child']) for e in edges} | {(e['child'], e['parent']) for e in edges}
    for name, decision in groups['models'].items():
        relation_path = decision.get('relationPath')
        if relation_path:
            if relation_path[0] != name or any((a, b) not in linked for a, b in zip(relation_path, relation_path[1:])):
                fail('Classification relation path is not declared in DMMF: ' + name)
            anchor = groups['models'][relation_path[-1]]
            if anchor['group'] != decision['group'] or anchor.get('basis') != 'actual-model-caller':
                fail('Classification relation path has no actual caller anchor: ' + name)
    indexed = {m['name']: m for m in models}
    own_groups = sorted({g['group'] for g in groups['models'].values()})
    chart_defs = [{'id': 'overview', 'title': '共通基盤の要約', 'kind': '全体', 'names': [x for x in ['User','Account','Subscription','UserServiceSubscription','Generation','Template','Category'] if x in indexed]}]
    for group in own_groups:
        own = {n for n, g in groups['models'].items() if g['group'] == group}
        if not own:
            continue
        names = own | {e['parent'] for e in edges if e['child'] in own}
        service = next((s for s in registry if s['id'] == group), None)
        chart_defs.append({'id': group, 'title': service['name'] if service else group, 'kind': '公開対象' if service and service['public'] else '共通・関連・非公開', 'names': sorted(names)})
    chart_defs.append({'id': 'all', 'title': '全モデル統合図', 'kind': '全体', 'names': list(indexed)})
    charts = [dict(c, code=mermaid(models, edges, c['names'])) for c in chart_defs]
    out.mkdir(parents=True, mode=0o700)
    def put(name, content):
        path = out / name
        path.write_text(content)
    for c in charts:
        put(c['id'] + '.mmd', c['code'])
    data = {'manifest': {'date': date, 'sourceCommit': manifest['sourceCommit'], 'sourceTree': manifest['sourceTree'], 'schemaSha256': manifest['schemaSha256'], 'servicesSha256': manifest['closureSha256']['src/lib/services.ts'], 'models': len(models), 'relations': len(edges), 'publicServices': sum(s['public'] for s in registry), 'charts': len(charts), 'renderStatus': 'not_run'}, 'models': {m['name']: dict(m, group=groups['models'][m['name']]['group'], sourceLine=model_blocks[m['name']]['line'], raw=model_blocks[m['name']]['raw']) for m in models}, 'enums': {e['name']: dict(e, sourceLine=enum_blocks[e['name']]['line'], raw=enum_blocks[e['name']]['raw']) for e in enums}, 'relations': edges, 'charts': charts, 'services': registry, 'groups': groups['models']}
    put('data.json', json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    with (out / 'entities.csv').open('w', newline='') as handle:
        writer = csv.writer(handle, lineterminator='\n')
        writer.writerow(['group','model','table','field','kind','type','list','required','dbName','isId','isUnique','sourceLine'])
        for m in models:
            for f in m['fields']:
                writer.writerow([groups['models'][m['name']]['group'], m['name'], m.get('dbName') or m['name'], f['name'], f['kind'], f['type'], f['isList'], f['isRequired'], f.get('dbName') or '', f.get('isId'), f.get('isUnique'), model_blocks[m['name']]['line']])
    with (out / 'relations.csv').open('w', newline='') as handle:
        writer = csv.writer(handle, lineterminator='\n')
        writer.writerow(['parent','parentTable','child','childTable','relationField','relationName','fkOrdered','referencesOrdered','optional','unique','identifying','onDelete','onUpdate'])
        for e in edges:
            writer.writerow([e['parent'],e['parentTable'],e['child'],e['childTable'],e['relationField'],e['relationName'] or '',json.dumps(e['fk']),json.dumps(e['references']),e['optional'],e['unique'],e['identifying'],e['onDelete'] or '未指定',e['onUpdate'] or '未指定'])
    basis_counts = Counter(decision.get('basis', 'unspecified') for decision in groups['models'].values())
    basis_text = '、'.join(f'{basis} {count}件' for basis, count in sorted(basis_counts.items()))
    readme = [
        '# 全サービス ER 設計図', '',
        f'資料作成日: {date}。入力 source commit: `{manifest["sourceCommit"]}`、tree: `{manifest["sourceTree"]}`。', '',
        f'{len(models)}モデル、{len(edges)}宣言済み FK 関係、公開サービス {sum(s["public"] for s in registry)} 件。', '',
        'Prisma schema とサービス定義から作成した構造資料です。'
        'DBの実レコード、実DB制約、サービス稼働や認可の証明ではありません。'
        '図のブラウザ描画は未実施です。', '',
        '`index.html` は Mermaid 描画用です。全フィールドと enum は `data.json` / `dictionary.md`、'
        '関係の ordered FK と参照列は `relations.csv` を確認してください。', '',
        f'モデル分類の根拠: {basis_text}。`previous-snapshot` は旧分類を継承したもので、'
        '現callerの意味確認済みとは扱いません。'
        'caller/evidenceのファイル同一性は `model-groups.json` のSHAで確認します。'
        '共有/非公開モデルも全体図に含めています。',
    ]
    put('README.md', '\n'.join(readme) + '\n')
    dictionary = ['# モデル・enum データ辞書', '', 'DMMF に対応するソース抜粋。実DB行や provider 内部の推測は含みません。', '']
    for name in indexed:
        dictionary += ['## ' + name, '', f'分類: {groups["models"][name]["group"]} / テーブル: {indexed[name].get("dbName") or name} / schema.prisma:{model_blocks[name]["line"]}', '', '```prisma', model_blocks[name]['raw'], '```', '']
    for name in data['enums']:
        dictionary += ['## enum ' + name, '', '```prisma', enum_blocks[name]['raw'], '```', '']
    put('dictionary.md', '\n'.join(dictionary))
    put('model-groups.json', group_map_file.read_text())
    shutil.copyfile(mermaid_source, out / 'mermaid.js')
    outputs = {p.name: sha(p.read_bytes()) for p in sorted(out.iterdir()) if p.is_file()}
    result_manifest = {'date': date, 'sourceCommit': manifest['sourceCommit'], 'sourceTree': manifest['sourceTree'], 'inputManifestSha256': sha((inp / 'manifest.json').read_bytes()), 'schemaSha256': manifest['schemaSha256'], 'dmmfSha256': manifest['filesSha256']['dmmf.json'], 'serviceRegistrySha256': manifest['filesSha256']['service-registry.json'], 'groupMapSha256': sha(group_map_file.read_bytes()), 'counts': data['manifest'], 'outputSha256': outputs, 'renderStatus': 'not_run'}
    put('manifest.json', json.dumps(result_manifest, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'built': True, 'models': len(models), 'relations': len(edges), 'out': str(out)}))


def main():
    p = argparse.ArgumentParser()
    for flag in ['root','input-dir','out-dir','date','mermaid-source']:
        p.add_argument('--' + flag, required=True)
    p.add_argument('--group-map')
    args = p.parse_args()
    group_map = pathlib.Path(args.group_map).resolve() if args.group_map else pathlib.Path(__file__).with_name('model-groups.json')
    build(pathlib.Path(args.root).resolve(), pathlib.Path(args.input_dir).resolve(), pathlib.Path(args.out_dir).resolve(), args.date, pathlib.Path(args.mermaid_source).resolve(), group_map)


if __name__ == '__main__':
    main()
