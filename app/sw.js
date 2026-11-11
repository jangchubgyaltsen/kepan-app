// 离线缓存 + 每日提醒的通知。__VERSION__ 等占位由 tools/build_app.py 填入
const VERSION = "__VERSION__";
const SHELL = "kepan-shell-" + VERSION;
const CONVERT = "kepan-convert-__CONVHASH__";
const FONTS = "kepan-fonts";
// 书的数据单独一个缓存，网址带内容版本号（data/rxl.json?v=…）。发新版时只下载改过的文件，没改过的留着
const DATA = "kepan-data";
const PRECACHE = __PRECACHE__;
const DATAFILES = __DATAFILES__;

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    await (await caches.open(SHELL)).addAll(PRECACHE);
    const dc = await caches.open(DATA);
    await Promise.all(DATAFILES.map(async (u) => { if (!(await dc.match(u))) await dc.add(u); }));
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("kepan-") && ![SHELL, CONVERT, FONTS, DATA].includes(k)) await caches.delete(k);
    const keep = new Set(DATAFILES.map((u) => new URL(u, self.registration.scope).href));
    const dc = await caches.open(DATA);
    for (const r of await dc.keys()) if (!keep.has(r.url)) await dc.delete(r);
    await self.clients.claim();
  })());
});

async function cacheFirst(name, req, exact) {
  const c = await caches.open(name);
  const hit = await c.match(req, { ignoreSearch: !exact });
  if (hit) return hit;
  const res = await fetch(req);
  if (res && (res.ok || res.type === "opaque")) c.put(req, res.clone());
  return res;
}
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    if (req.mode === "navigate") {
      e.respondWith(caches.match("./", { cacheName: SHELL }).then((r) => r || fetch(req)).catch(() => fetch(req)));
      return;
    }
    if (url.pathname.includes("/convert/")) { e.respondWith(cacheFirst(CONVERT, req)); return; }
    if (url.pathname.includes("/data/") && url.searchParams.has("v")) { e.respondWith(cacheFirst(DATA, req, true)); return; }
    e.respondWith(caches.open(SHELL).then((c) => c.match(req, { ignoreSearch: true })).then((r) => r || fetch(req)));
    return;
  }
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") e.respondWith(cacheFirst(FONTS, req));
});

// ---- 每日提醒：推送服务只发一个空的「到点了」，要复习几条在本机算
function readState() {
  return new Promise((ok) => {
    const r = indexedDB.open("kepan", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("kv");
    r.onerror = () => ok(null);
    r.onsuccess = () => {
      try {
        const g = r.result.transaction("kv").objectStore("kv").get("state");
        g.onsuccess = () => ok(g.result || null);
        g.onerror = () => ok(null);
      } catch (e) { ok(null); }
    };
  });
}
function dayKey(t) { const d = new Date(t); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
async function reminderText() {
  const st = await readState();
  const SR = st && st.SR;
  if (!SR) return { title: "科判 · 每日背诵", body: "今天来背一颂，点亮今天的灯。" };
  const end = new Date(); end.setHours(23, 59, 59, 999);
  const due = Object.values(SR.it || {}).filter((c) => c && c.due <= +end).length;
  const today = (SR.hist || {})[dayKey(Date.now())];
  if (today && today.full) return { title: "今天的灯已经点满", body: "随喜！明天再来。" };
  if (due) return { title: "科判 · 今日复习 " + due + " 条", body: today && today.n ? "今天的灯已经点上，把剩下的做完，灯就满亮了。" : "做完今天的，点亮今天的灯。" };
  return { title: "科判 · 每日背诵", body: today && today.n ? "今天的灯已经点上。" : "今天来背一颂，点亮今天的灯。" };
}
self.addEventListener("push", (e) => {
  e.waitUntil(reminderText().then((m) => self.registration.showNotification(m.title, {
    body: m.body, icon: "icons/icon-192.png", badge: "icons/badge-96.png", tag: "kepan-daily", renotify: true, lang: "zh-CN",
  })));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) if ("focus" in c) return c.focus();
    return self.clients.openWindow("./");
  })());
});
