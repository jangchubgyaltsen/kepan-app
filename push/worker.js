// 科判 · 每日提醒推送服务（Cloudflare Worker + D1）
//
// 手机在设置里打开「每日提醒」时，把推送订阅和提醒时间发到这里；
// 定时任务每 5 分钟看一遍，谁到了提醒时间、今天还没提醒过，就给谁发一条推送。
// 推送不带内容，手机上的应用收到后自己算「今天有几条要复习」再显示通知，
// 所以这里不保存任何学习记录。

const CORS = (env, req) => {
  const allow = (env.ALLOWED_ORIGINS || "https://jangchubgyaltsen.github.io").split(",").map((s) => s.trim());
  const o = req.headers.get("origin") || "";
  return {
    "access-control-allow-origin": allow.includes(o) || allow.includes("*") ? o || "*" : allow[0],
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    vary: "origin",
  };
};
const json = (data, status, h) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", ...h } });

export default {
  async fetch(req, env) {
    const h = CORS(env, req);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
    const { pathname } = new URL(req.url);
    try {
      if (pathname === "/vapid" && req.method === "GET") return json({ publicKey: env.VAPID_PUBLIC }, 200, h);
      if (pathname === "/subscribe" && req.method === "POST") {
        const { sub, time, tz } = await req.json();
        if (!sub || !sub.endpoint || !/^https:\/\//.test(sub.endpoint)) return json({ error: "bad subscription" }, 400, h);
        if (!/^\d{2}:\d{2}$/.test(time || "")) return json({ error: "bad time" }, 400, h);
        const zone = validTz(tz) ? tz : "Asia/Shanghai";
        await env.DB.prepare(
          `INSERT INTO subs (endpoint, sub, time, tz, last_sent, created) VALUES (?1, ?2, ?3, ?4, '', ?5)
           ON CONFLICT(endpoint) DO UPDATE SET sub = ?2, time = ?3, tz = ?4`
        ).bind(sub.endpoint, JSON.stringify(sub), time, zone, Date.now()).run();
        return json({ ok: true }, 200, h);
      }
      if (pathname === "/unsubscribe" && req.method === "POST") {
        const { endpoint } = await req.json();
        if (endpoint) await env.DB.prepare("DELETE FROM subs WHERE endpoint = ?1").bind(endpoint).run();
        return json({ ok: true }, 200, h);
      }
      if (pathname === "/") return new Response("kepan push ok", { headers: h });
      return json({ error: "not found" }, 404, h);
    } catch (e) {
      return json({ error: String(e && e.message || e) }, 500, h);
    }
  },

  async scheduled(_ev, env, ctx) {
    ctx.waitUntil(sendDue(env));
  },
};

function validTz(tz) {
  try { new Intl.DateTimeFormat("en", { timeZone: tz }); return !!tz; } catch { return false; }
}

// 某个时区此刻的日期和分钟数
function localNow(tz, now) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(now).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, min: +p.hour * 60 + +p.minute };
}

async function sendDue(env) {
  const now = new Date();
  const { results } = await env.DB.prepare("SELECT endpoint, time, tz, last_sent FROM subs").all();
  const jobs = [];
  for (const r of results) {
    const L = localNow(r.tz, now);
    const [hh, mm] = r.time.split(":").map(Number);
    const late = L.min - (hh * 60 + mm);
    // 到点后一小时内补发（定时任务偶尔会晚几分钟），一天只发一次
    if (late < 0 || late > 60 || r.last_sent === L.date) continue;
    jobs.push(push(env, r.endpoint).then(async (st) => {
      if (st === 404 || st === 410) await env.DB.prepare("DELETE FROM subs WHERE endpoint = ?1").bind(r.endpoint).run();
      else if (st >= 200 && st < 300) await env.DB.prepare("UPDATE subs SET last_sent = ?1 WHERE endpoint = ?2").bind(L.date, r.endpoint).run();
      else console.log("push failed", st, r.endpoint.slice(0, 60));
    }));
  }
  await Promise.allSettled(jobs);
}

// ---- 不带内容的 Web Push（VAPID，RFC 8292）
async function push(env, endpoint) {
  const aud = new URL(endpoint).origin;
  const jwt = await vapidJWT(env, aud);
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { TTL: "21600", Urgency: "normal", Authorization: `vapid t=${jwt}, k=${env.VAPID_PUBLIC}`, "Content-Length": "0" },
  });
  return res.status;
}

const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64uStr = (s) => b64u(new TextEncoder().encode(s));
let KEY = null;
async function vapidJWT(env, aud) {
  if (!KEY) KEY = await crypto.subtle.importKey("jwk", JSON.parse(env.VAPID_PRIVATE_JWK), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const head = b64uStr(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const body = b64uStr(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: env.VAPID_SUBJECT || "https://jangchubgyaltsen.github.io/kepan-app/" }));
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, KEY, new TextEncoder().encode(`${head}.${body}`));
  return `${head}.${body}.${b64u(sig)}`;
}
