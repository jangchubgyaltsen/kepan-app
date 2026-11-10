// 对外接口（ES module）。用法：
//   import { createConverter } from './kepan-convert.js';
//   const conv = createConverter({ onLog: s => console.log(s) });
//   const tree = await conv.kepanFromPdf(file, { id: 'rxl', fixes: [...] , onProgress: (i, n) => {} });
//   const { data, reportHtml } = await conv.shiyiFromEpub(epubFile, tree);
// 默认在 Web Worker 里跑，不卡界面；浏览器不允许时自动退回主线程。
// 运行环境 Pyodide 和本文件放在一起（dist/pyodide/），离线缓存和国内访问都更稳；也可以传 indexURL 指向别处。
const DEFAULT_INDEX = new URL('./pyodide/', import.meta.url).href;

export function createConverter({ indexURL = DEFAULT_INDEX, onLog, worker = true } = {}) {
  const toBuf = async (x) => {
    if (x instanceof ArrayBuffer) return x;
    if (ArrayBuffer.isView(x)) return x.buffer.slice(x.byteOffset, x.byteOffset + x.byteLength);
    return x.arrayBuffer();  // File / Blob
  };
  let impl = null;

  function mainThread() {
    const eng = makeEngine(indexURL, onLog);
    return {
      init: () => eng.init(),
      kepanFromPdf: (buf, o, p) => eng.kepanFromPdf(buf, o, p),
      shiyiFromEpub: (buf, t, o) => eng.shiyiFromEpub(buf, t, o),
    };
  }

  function inWorker() {
    const src = `${makeEngine.toString()}
let eng = null; const log = (s) => postMessage({ log: s });
onmessage = async (e) => {
  const { id, fn, args } = e.data;
  try {
    eng = eng || makeEngine(${JSON.stringify(indexURL)}, log);
    if (fn === 'kepanFromPdf') args[2] = (a, b) => postMessage({ id, progress: [a, b] });
    const result = await eng[fn](...args);
    postMessage({ id, result });
  } catch (err) { postMessage({ id, error: String(err && err.message || err) }); }
};`;
    const w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    let seq = 0; const pending = new Map();
    w.onerror = (e) => {
      const err = new Error(e.message || 'Worker 出错');
      for (const p of pending.values()) p.bad(err);
      pending.clear();
    };
    w.onmessage = (e) => {
      const m = e.data;
      if (m.log) return onLog && onLog(m.log);
      const p = pending.get(m.id); if (!p) return;
      if (m.progress) return p.onProgress && p.onProgress(...m.progress);
      pending.delete(m.id);
      m.error ? p.bad(new Error(m.error)) : p.ok(m.result);
    };
    const call = (fn, args, onProgress, transfer) => new Promise((ok, bad) => {
      const id = ++seq; pending.set(id, { ok, bad, onProgress });
      w.postMessage({ id, fn, args }, transfer || []);
    });
    return {
      init: () => call('init', []),
      kepanFromPdf: (buf, o, p) => call('kepanFromPdf', [buf, o, null], p, [buf]),
      shiyiFromEpub: (buf, t, o) => call('shiyiFromEpub', [buf, t, o], null, [buf]),
    };
  }

  async function get() {
    if (impl) return impl;
    if (worker) {
      try { impl = inWorker(); await impl.init(); return impl; }
      catch (e) { onLog && onLog('Worker 不可用，改在主线程运行：' + e.message); }
    }
    impl = mainThread(); await impl.init(); return impl;
  }

  return {
    ready: () => get().then(() => true),
    async kepanFromPdf(file, opts = {}) {
      const { onProgress, ...o } = opts;
      if (!o.name && file && file.name) o.name = file.name;
      return (await get()).kepanFromPdf(await toBuf(file), o, onProgress);
    },
    async shiyiFromEpub(file, tree, opts = {}) {
      const o = { ...opts }; if (!o.name && file && file.name) o.name = file.name;
      return (await get()).shiyiFromEpub(await toBuf(file), tree, o);
    },
  };
}
