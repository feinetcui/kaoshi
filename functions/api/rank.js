// EdgeOne Pages Function: GET /api/rank?sort=score|name
// 读取成绩表，按姓名取历次最高分，统计参考次数，按分数或姓名排序返回。

const BASE = "https://open.feishu.cn";
let _token = null;
let _expireAt = 0;

async function getEnv(context) {
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

async function feishuRequest(env, method, path, body) {
  const token = await getToken(env);
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

async function listTable(env, table) {
  const appToken = env.FEISHU_APP_TOKEN;
  const out = [];
  let pageToken = "";
  while (true) {
    let path = `/open-apis/bitable/v1/apps/${appToken}/tables/${table}/records?page_size=100`;
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

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export async function onRequestGet(context) {
  try {
    const env = await getEnv(context);
    const scores = await listTable(env, env.FEISHU_S_TABLE);
    const best = new Map();
    const attempts = {};
    for (const s of scores) {
      const name = s.name;
      const t = Number(s.total_score) || 0;
      attempts[name] = (attempts[name] || 0) + 1;
      const cur = best.get(name);
      if (!cur || t > cur.total) best.set(name, { name, total: t });
    }
    let arr = [...best.values()].map((b) => ({
      name: b.name,
      total: b.total,
      attempts: attempts[b.name] || 1,
    }));
    const url = new URL(context.request.url);
    const sort = url.searchParams.get("sort") === "name" ? "name" : "score";
    if (sort === "name") arr.sort((a, b) => a.name.localeCompare(b.name, "zh"));
    else arr.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "zh"));
    return json({ rank: arr });
  } catch (e) {
    return json({ error: String(e && e.message ? e.message : e) }, 500);
  }
}
