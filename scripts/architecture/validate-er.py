#!/usr/bin/env python3
"""Independent DMMF-to-all-output structural validation for ER snapshot."""
import argparse
import csv
import hashlib
import importlib.util
import json
import pathlib
import re
import subprocess


def sha(data): return hashlib.sha256(data).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    for name in ['root','input-dir','out-dir','date']:
        parser.add_argument('--' + name, required=True)
    a = parser.parse_args()
    root, inp, out = map(lambda p: pathlib.Path(p).resolve(), (a.root, a.input_dir, a.out_dir))
    spec = importlib.util.spec_from_file_location('build_er', pathlib.Path(__file__).with_name('build-er.py'))
    build_er = importlib.util.module_from_spec(spec); spec.loader.exec_module(build_er)
    exported, dmmf, services = build_er.read_bundle(root, inp, a.date)
    manifest = json.loads((out / 'manifest.json').read_text())
    data = json.loads((out / 'data.json').read_text())
    if manifest['inputManifestSha256'] != sha((inp / 'manifest.json').read_bytes()) or manifest['date'] != a.date:
        raise ValueError('Output input provenance mismatch')
    if manifest['sourceCommit'] != exported['sourceCommit'] or manifest['sourceTree'] != exported['sourceTree']:
        raise ValueError('Output source commit/tree mismatch')
    if manifest['schemaSha256'] != exported['schemaSha256'] or manifest['dmmfSha256'] != exported['filesSha256']['dmmf.json']:
        raise ValueError('Output source/schema DMMF hash mismatch')
    expected_files = set(manifest['outputSha256']) | {'manifest.json'}
    if {p.name for p in out.iterdir() if p.is_file()} != expected_files:
        raise ValueError('Output path set mismatch')
    for name, expected in manifest['outputSha256'].items():
        if sha((out / name).read_bytes()) != expected:
            raise ValueError('Output hash mismatch: ' + name)
    if set(data['models']) != {m['name'] for m in dmmf['models']} or set(data['enums']) != {e['name'] for e in dmmf['enums']}:
        raise ValueError('Model or enum set mismatch')
    dmodels = {m['name']: m for m in dmmf['models']}
    for name, model in data['models'].items():
        copy = {k: v for k, v in model.items() if k not in ('group','sourceLine','raw')}
        if copy != dmodels[name]:
            raise ValueError('Model fields/indices/relationships differ: ' + name)
        if {f['name'] for f in model['fields']} != {f['name'] for f in dmodels[name]['fields']}:
            raise ValueError('Field set mismatch: ' + name)
    for e in dmmf['enums']:
        copy = {k:v for k,v in data['enums'][e['name']].items() if k not in ('sourceLine','raw')}
        if copy != e:
            raise ValueError('Enum names/values differ: ' + e['name'])
    edges = build_er.relation_edges(dmmf['models'])
    if data['relations'] != edges:
        raise ValueError('Ordered FK/target/optionality/relation identity mismatch')
    if data['services'] != services:
        raise ValueError('Service registry mismatch')
    groups = json.loads((out / 'model-groups.json').read_text())
    if set(groups['models']) != set(data['models']) or data['groups'] != groups['models']:
        raise ValueError('Incomplete group classification')
    charts = data['charts']
    if len({c['id'] for c in charts}) != len(charts):
        raise ValueError('Duplicate chart IDs')
    all_chart = next(c for c in charts if c['id'] == 'all')
    if set(all_chart['names']) != set(data['models']):
        raise ValueError('Whole chart dropped a model')
    for c in charts:
        expected = build_er.mermaid(dmmf['models'], edges, c['names'])
        if c['code'] != expected or (out / (c['id'] + '.mmd')).read_text() != expected:
            raise ValueError('Mermaid field or ordered edge missing/reversed: ' + c['id'])
    with (out / 'entities.csv').open(newline='') as f:
        reader = csv.DictReader(f); entity_header = reader.fieldnames; rows = list(reader)
    if len(rows) != sum(len(m['fields']) for m in dmmf['models']):
        raise ValueError('Entity CSV omitted fields')
    field_keys = [(m['name'], f['name']) for m in dmmf['models'] for f in m['fields']]
    if [(x['model'],x['field']) for x in rows] != field_keys:
        raise ValueError('Entity CSV ordered model/field mismatch')
    expected_entity_header = ['group','model','table','field','kind','type','list','required','dbName','isId','isUnique','sourceLine']
    if entity_header != expected_entity_header:
        raise ValueError('Entity CSV header mismatch')
    def cell(value): return '' if value is None else str(value)
    expected_rows = []
    for model in dmmf['models']:
        for field in model['fields']:
            expected_rows.append(dict(zip(expected_entity_header, map(cell, [
                data['groups'][model['name']]['group'], model['name'], model.get('dbName') or model['name'],
                field['name'], field['kind'], field['type'], field['isList'], field['isRequired'],
                field.get('dbName') or '', field.get('isId'), field.get('isUnique'),
                data['models'][model['name']]['sourceLine']]))))
    if rows != expected_rows:
        raise ValueError('Entity CSV semantic column mismatch')
    with (out / 'relations.csv').open(newline='') as f:
        reader = csv.DictReader(f); relation_header = reader.fieldnames; relation_rows = list(reader)
    if len(relation_rows) != len(edges):
        raise ValueError('Relation CSV omitted edge')
    expected_relation_header = ['parent','parentTable','child','childTable','relationField','relationName','fkOrdered','referencesOrdered','optional','unique','identifying','onDelete','onUpdate']
    if relation_header != expected_relation_header:
        raise ValueError('Relation CSV header mismatch')
    expected_relations = [dict(zip(expected_relation_header, map(cell, [
        edge['parent'], edge['parentTable'], edge['child'], edge['childTable'], edge['relationField'],
        edge['relationName'] or '', json.dumps(edge['fk']), json.dumps(edge['references']),
        edge['optional'], edge['unique'], edge['identifying'], edge['onDelete'] or '未指定',
        edge['onUpdate'] or '未指定']))) for edge in edges]
    if relation_rows != expected_relations:
        raise ValueError('Relation CSV semantic column mismatch')
    html = (out / 'index.html').read_text()
    if 'window.renderAll' not in html or 'const DATA=' not in html or manifest['renderStatus'] != 'not_run':
        raise ValueError('HTML source data or render status mismatch')
    scripts = re.findall(r'<script>(.*?)</script>', html, re.S)
    if len(scripts) != 2:
        raise ValueError('Unexpected inline JavaScript script count')
    for index, script in enumerate(scripts):
        checked = subprocess.run(['node', '--check'], input=script, text=True, capture_output=True)
        if checked.returncode:
            raise ValueError(f'Inline JavaScript syntax invalid in script {index}: {checked.stderr.strip()}')
    if data['manifest']['models'] != len(dmmf['models']) or data['manifest']['relations'] != len(edges) or data['manifest']['charts'] != len(charts):
        raise ValueError('Summary counts mismatch')
    print(json.dumps({'passed':True,'models':len(dmmf['models']),'fields':len(rows),'orderedRelations':len(edges),'enums':len(dmmf['enums']),'charts':len(charts),'publicServices':sum(s['public'] for s in services),'renderStatus':'not_run'}))


if __name__ == '__main__': main()
