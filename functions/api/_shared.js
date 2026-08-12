// 共享模块：飞书 API 封装 + 边缘缓存 + 响应工具。
// 被 paper.js / submit.js / rank.js 引用，避免重复代码。

const BASE = "https://open.feishu.cn";
let _token = null;
let _expireAt = 0;

export async function getEnv(context) {
  const base = typeof process !== "undefined" && process.env ? Object.assign({}, process.env) : {};
  const e = (context && context.env) || {};
  let fileEnv = {};
  try {
    const mod = await import("./_env.js");
    fileEnv = (mod && mod.ENV) || {};
  } catch (_) {}
  // 优先级：控制台环境变量(context.env) > 本地兜底文件 > process.env
  return Object.assign({}, base, fileEnv, e);
}

async function getToken(env) {
  const now = Date.now();
  if (_token && now < _expireAt - 5000) return _token;
  const res = await fetch(BASE + "/open-apis/auth/v3/tenant_access_token/internal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: env.FEISHU_APP_ID, app_secret: env.FEISHU_APP_SECRET }),
  });
  const data = await res.json();
  if (data.code !== 0) throw new Error("飞书获取令牌失败: " + data.msg);
  _token = data.tenant_access_token;
  _expireAt = now + (data.expire || 7200) * 1000;
  return _token;
}

export async function feishuRequest(env, method, path, body) {
  const token = await getToken(env);
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

export async function listTable(env, table) {
  const appToken = env.FEISHU_APP_TOKEN;
  const out = [];
  let pageToken = "";
  while (true) {
    let path = `/open-apis/bitable/v1/apps/${appToken}/tables/${table}/records?page_size=500`;
    if (pageToken) path += "&page_token=" + encodeURIComponent(pageToken);
    const data = await feishuRequest(env, "GET", path);
    if (data.code !== 0) throw new Error("读取多维表格失败: " + data.msg);
    const items = (data.data && data.data.items) || [];
    for (const it of items) out.push({ id: it.record_id, ...it.fields });
    if (!data.data.has_more) break;
    pageToken = data.data.page_token || "";
    if (!pageToken) break;
  }
  return out;
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

// 缓存：优先用边缘 Cache API（跨实例共享），失败则退回实例内存缓存。
const mem = new Map();

async function cacheGet(key) {
  const url = "https://cache.local/exam/" + key;
  try {
    if (typeof caches !== "undefined") {
      const c = await caches.open("exam");
      const r = await c.match(url);
      if (r) return await r.json();
    }
  } catch (_) {}
  const m = mem.get(key);
  if (m && Date.now() < m.exp) return m.val;
  return null;
}

async function cacheSet(key, ttl, val) {
  mem.set(key, { val, exp: Date.now() + ttl * 1000 });
  try {
    if (typeof caches !== "undefined") {
      const c = await caches.open("exam");
      await c.put(
        "https://cache.local/exam/" + key,
        new Response(JSON.stringify(val), {
          status: 200,
          headers: { "Content-Type": "application/json", "Cache-Control": "max-age=" + ttl },
        })
      );
    }
  } catch (_) {}
}

export async function cached(key, ttl, fetcher) {
  const hit = await cacheGet(key);
  if (hit) return hit;
  const val = await fetcher();
  await cacheSet(key, ttl, val);
  return val;
}
