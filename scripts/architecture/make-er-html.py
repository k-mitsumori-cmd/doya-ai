#!/usr/bin/env python3
"""Embed the already bundled Mermaid runtime and verified ER data, without rendering."""
import argparse
import hashlib
import json
from pathlib import Path


def sha(data): return hashlib.sha256(data).hexdigest()


def main():
    p = argparse.ArgumentParser()
    for name in ['root','input-dir','out-dir','date']:
        p.add_argument('--' + name, required=True)
    a = p.parse_args()
    out = Path(a.out_dir).resolve()
    data_bytes = (out / 'data.json').read_bytes()
    manifest_path = out / 'manifest.json'
    manifest = json.loads(manifest_path.read_text())
    data = json.loads(data_bytes)
    if manifest['date'] != a.date or data['manifest']['date'] != a.date or manifest['sourceCommit'] != data['manifest']['sourceCommit']:
        raise ValueError('HTML input provenance mismatch')
    if (out / 'index.html').exists():
        raise ValueError('Existing HTML output cannot be overwritten')
    if sha(data_bytes) != manifest['outputSha256']['data.json']:
        raise ValueError('ER data hash mismatch')
    mermaid = (out / 'mermaid.js').read_text().replace('</script', '<\\/script')
    if sha((out / 'mermaid.js').read_bytes()) != manifest['outputSha256']['mermaid.js']:
        raise ValueError('Mermaid library hash mismatch')
    payload = data_bytes.decode().replace('</script', '<\\/script')
    html = '''<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>全サービス ER 設計図</title><style>
body{margin:0;font:14px system-ui,sans-serif;color:#172840;background:#f3f6fa}header{padding:20px;background:#10213a;color:white}h1{margin:0;font-size:23px}.layout{display:grid;grid-template-columns:250px 1fr;height:calc(100vh - 100px)}aside{overflow:auto;background:white;padding:12px;border-right:1px solid #ced7e3}main{overflow:auto;padding:18px}button,input{font:inherit}aside button{display:block;width:100%;padding:9px;text-align:left;border:0;background:white;color:#163352;cursor:pointer}aside button:focus-visible,button:focus-visible{outline:2px solid #1262ab}aside button.active{background:#dceafc}#canvas{overflow:auto;background:white;min-height:450px;padding:14px;border:1px solid #ced7e3}.toolbar{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.toolbar button{padding:7px 12px}pre{overflow:auto;white-space:pre-wrap}#status{margin:8px 0}
</style><header><h1>全サービス ER 設計図</h1><p id="summary"></p></header><div class="layout"><aside><label for="search">図を検索</label><input id="search"><nav id="nav" aria-label="図の一覧"></nav></aside><main><h2 id="title"></h2><p>宣言済みの Prisma 関係を示します。DB実データとブラウザ描画の検証結果ではありません。</p><div class="toolbar"><button id="fit">画面に合わせる</button><button id="svg">SVG保存</button><button id="mmd">Mermaid保存</button></div><div id="status" role="status"></div><div id="canvas"></div><details><summary>モデル・フィールド</summary><pre id="dictionary"></pre></details></main></div><script>__MERMAID__</script><script>
const DATA=__DATA__;window.DATA=DATA;let current=null,seq=0,selectionEpoch=0,readySvg=null;const cache={};const el=id=>document.getElementById(id);
mermaid.initialize({startOnLoad:false,securityLevel:'strict',theme:'base',maxEdges:2000,maxTextSize:500000,er:{useMaxWidth:false}});
function nav(q=''){el('nav').replaceChildren();for(const c of DATA.charts.filter(c=>(c.title+' '+c.names.join(' ')).toLowerCase().includes(q.toLowerCase()))){let b=document.createElement('button');b.type='button';b.textContent=c.title+' ('+c.names.length+')';b.className=c.id===current?.id?'active':'';b.onclick=()=>{void show(c.id)};el('nav').append(b)}}
async function show(id){const c=DATA.charts.find(x=>x.id===id);if(!c)return false;const epoch=++selectionEpoch;current=c;readySvg=null;el('svg').disabled=true;el('canvas').innerHTML='';el('dictionary').textContent='';el('title').textContent=c.title;el('status').textContent='図を描画しています';nav(el('search').value);try{const svg=cache[id]||(await mermaid.render('er'+(++seq),c.code)).svg;if(epoch!==selectionEpoch||current?.id!==id)return false;if(typeof svg!=='string'||!svg.trim())throw Error('SVGの応答が正しくありません');cache[id]=svg;el('canvas').innerHTML=svg;el('dictionary').textContent=c.names.map(n=>DATA.models[n].raw).join('\\n\\n');el('status').textContent=c.names.length+'モデル';readySvg={id,epoch,svg};el('svg').disabled=false;return true}catch(e){if(epoch!==selectionEpoch||current?.id!==id)return false;readySvg=null;el('svg').disabled=true;el('canvas').textContent='描画できませんでした';el('status').textContent=String(e?.message||e);return false}}
window.show=show;window.renderAll=async()=>{for(const c of DATA.charts){if(!cache[c.id])cache[c.id]=(await mermaid.render('er'+(++seq),c.code)).svg}return Object.fromEntries(Object.entries(cache))};
el('search').oninput=e=>nav(e.target.value);el('fit').onclick=()=>{const svg=el('canvas').querySelector('svg');if(svg)svg.style.width='100%'};function save(text,type,ext,id){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download='er-'+id+'.'+ext;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}el('svg').disabled=true;el('svg').onclick=()=>{const item=readySvg;if(!item||item.id!==current?.id||item.epoch!==selectionEpoch||typeof item.svg!=='string'||!item.svg.trim())return;save(item.svg,'image/svg+xml','svg',item.id)};el('mmd').onclick=()=>{if(current&&typeof current.code==='string')save(current.code,'text/plain','mmd',current.id)};
el('summary').textContent=DATA.manifest.models+'モデル / '+DATA.manifest.relations+'関係 / 公開サービス'+DATA.manifest.publicServices+'件 / 資料作成日 '+DATA.manifest.date+' / source '+DATA.manifest.sourceCommit;nav();show('overview');
</script></html>'''
    html = html.replace('__MERMAID__', mermaid).replace('__DATA__', payload)
    (out / 'index.html').write_text(html)
    manifest['outputSha256']['index.html'] = sha((out / 'index.html').read_bytes())
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'htmlCreated': True, 'bytes': len(html.encode()), 'renderStatus': 'not_run'}))


if __name__ == '__main__': main()
