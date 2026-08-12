// EdgeOne Pages Function: POST /api/paper
// 返回随机试卷（仅题干+选项，不含答案），前端凭 paper_id 交卷时再由服务端判分。

const BASE = "https://open.feishu.cn";
let _token = null;
let _expireAt = 0;

function getEnv(context) {
  const base = typeof process !== "undefined" && process.env ? Object.assign({}, process.env) : {};
  const e = (context && context.env) || {};
  return Object.assign(base, e);
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
    for (const it of data.data.items) out.push({ id: it.record_id, ...it.fields });
    if (!data.data.has_more) break;
    pageToken = data.data.page_token || "";
    if (!pageToken) break;
  }
  return out;
}

function sampleN(arr, n) {
  if (!arr || arr.length === 0) return [];
  if (arr.length >= n) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, n);
  }
  const out = [];
  for (let i = 0; i < n; i++) out.push(arr[Math.floor(Math.random() * arr.length)]);
  return out;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export async function onRequestPost(context) {
  try {
    const env = getEnv(context);
    const all = await listTable(env, env.FEISHU_Q_TABLE);
    const single = all.filter((q) => q.q_type === "single");
    const tf = all.filter((q) => q.q_type === "tf");
    const short = all.filter((q) => q.q_type === "short");
    const selected = [...sampleN(single, 20), ...sampleN(tf, 10), ...sampleN(short, 8)];
    const paperId = JSON.stringify(selected.map((q) => q.id));
    const questions = selected.map((q) => ({
      id: q.id,
      q_type: q.q_type,
      content: q.content,
      options: q.q_type === "single" ? [q.opt_a, q.opt_b, q.opt_c, q.opt_d].filter(Boolean) : undefined,
    }));
    return json({ paper_id: paperId, questions });
  } catch (e) {
    return json({ error: String(e && e.message ? e.message : e) }, 500);
  }
}
