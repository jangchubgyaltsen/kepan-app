// 科判 / 讲记转换引擎：在浏览器里用 Pyodide 运行 tools/pdf2kepan.py 和 tools/epub2shiyi.py。
// 这个文件的内容会被 build.py 原样嵌进 kepan-convert.js，既可以放进 Web Worker 跑，也可以在主线程跑。
// PY_FILES、WHEELS 两个占位由 build.py 填入。
/* global loadPyodide, importScripts */
function makeEngine(indexURL, log, stdLibURL) {
  const PY_FILES = __PY_FILES__;   // {文件名: 源码}
  const WHEELS = __WHEELS__;       // {文件名: base64}
  let py = null;

  function b64(s) {
    const bin = atob(s); const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }

  async function init() {
    if (py) return;
    log && log('正在加载运行环境…');
    if (typeof loadPyodide === 'undefined') {
      if (typeof importScripts === 'function') importScripts(indexURL + 'pyodide.js');
      else await new Promise((ok, bad) => {
        const s = document.createElement('script'); s.src = indexURL + 'pyodide.js';
        s.onload = ok; s.onerror = () => bad(new Error('运行环境下载失败，请检查网络')); document.head.appendChild(s);
      });
    }
    py = await loadPyodide(stdLibURL ? { indexURL, stdLibURL } : { indexURL });
    py.FS.mkdirTree('/kp/wheels');
    for (const [name, data] of Object.entries(WHEELS)) py.FS.writeFile('/kp/wheels/' + name, b64(data));
    for (const [name, src] of Object.entries(PY_FILES)) py.FS.writeFile('/kp/' + name, src);
    py.runPython(`
import sys, zipfile, glob, os, types
site = '/kp/site'
os.makedirs(site, exist_ok=True)
for w in glob.glob('/kp/wheels/*'):
    zipfile.ZipFile(w).extractall(site)
# pdfminer 只在读加密 PDF 时才用 cryptography；浏览器版不带它，遇到加密 PDF 会报错
def _stub(name, **attrs):
    m = types.ModuleType(name); m.__dict__.update(attrs); sys.modules[name] = m
_stub('cryptography'); _stub('cryptography.hazmat'); _stub('cryptography.hazmat.primitives')
_stub('cryptography.hazmat.backends', default_backend=lambda: None)
_stub('cryptography.hazmat.primitives.ciphers', Cipher=None, algorithms=None, modes=None)
sys.path[:0] = [site, '/kp']
import pdf2kepan, epub2shiyi
`);
    log && log('运行环境已就绪');
  }

  // 科判 PDF → 科判树
  async function kepanFromPdf(bytes, opts = {}, progress) {
    await init();
    py.FS.writeFile('/kp/in.pdf', new Uint8Array(bytes));
    py.globals.set('_progress', progress || undefined);
    py.globals.set('_opts', JSON.stringify({ id: opts.id || 'book', fixes: opts.fixes || null, name: opts.name || 'in.pdf' }));
    const out = py.runPython(`
import json
_o = json.loads(_opts)
_r = pdf2kepan.convert('/kp/in.pdf', _o['id'], _o['fixes'], None, (lambda a, b: _progress(a, b)) if _progress else None)
_r['source']['file'] = _o['name']
json.dumps(_r, ensure_ascii=False)
`);
    return JSON.parse(out);
  }

  // 讲记 epub + 科判树 → 释义数据和对照报告
  async function shiyiFromEpub(bytes, tree, opts = {}) {
    await init();
    py.FS.writeFile('/kp/in.epub', new Uint8Array(bytes));
    py.globals.set('_tree', JSON.stringify(tree));
    py.globals.set('_name', opts.name || 'in.epub');
    const out = py.runPython(`
import json
_t = json.loads(_tree)
_d = epub2shiyi.convert('/kp/in.epub', _t)
_d['source']['file'] = _name
_title = (_t.get('meta') or {}).get('title') or _t.get('id') or ''
json.dumps({'data': _d, 'reportHtml': epub2shiyi.build_report(_d, _title),
            'suggestions': epub2shiyi.suggest_fixes(_d, _t)}, ensure_ascii=False)
`);
    return JSON.parse(out);
  }

  // 套用勘误（不用重读 PDF），重新自检；读过讲记的话再重新比对一次
  async function applyFixes(tree, fixes) {
    await init();
    py.globals.set('_tree', JSON.stringify(tree));
    py.globals.set('_fixes', JSON.stringify(fixes));
    const out = py.runPython(`
import json, os
_t = pdf2kepan.apply_fixes_to_tree(json.loads(_tree), json.loads(_fixes))
_res = {'tree': _t}
if os.path.exists('/kp/in.epub'):
    _d = epub2shiyi.convert('/kp/in.epub', _t)
    _d['source']['file'] = _name if '_name' in globals() else 'in.epub'
    _title = (_t.get('meta') or {}).get('title') or _t.get('id') or ''
    _res.update(data=_d, reportHtml=epub2shiyi.build_report(_d, _title), suggestions=epub2shiyi.suggest_fixes(_d, _t))
json.dumps(_res, ensure_ascii=False)
`);
    return JSON.parse(out);
  }

  return { init, kepanFromPdf, shiyiFromEpub, applyFixes };
}
