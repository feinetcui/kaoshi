// EdgeOne Pages Function: POST /api/submit
// 解析 paper_id -> 从飞书题库取标准答案 -> 逐题判分 -> 写入成绩表 -> 返回总分与错题。

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

function normalize(s) {
  return String(s == null ? "" : s)
    .toLowerCase()
    .replace(/[\s\p{P}]+/gu, "");
}

function gradeOne(q, userAnswer) {
  const score = Number(q.score) || 0;
  if (q.q_type === "single" || q.q_type === "tf") {
    const isCorrect = normalize(q.answer) === normalize(userAnswer);
    return { correct: isCorrect, got: isCorrect ? score : 0, full: score };
  }
  const kws = String(q.keywords || "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  if (kws.length === 0) return { correct: false, got: 0, full: score };
  const ans = normalize(userAnswer);
  let hits = 0;
  for (const k of kws) if (ans.includes(normalize(k))) hits++;
  const ratio = hits / kws.length;
  const got = Math.round(score * ratio);
  return { correct: ratio >= 0.6, got, full: score };
}

function pad(n) {
  return String(n).padStart(2, "0");
}
function formatDateTime(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}:${pad(d.getSeconds())}`;
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
    const body = await context.request.json();
    const { name, paper_id, answers } = body || {};
    if (!name || !paper_id || !answers) return json({ error: "缺少必填字段" }, 400);
    const ids = JSON.parse(paper_id);
    const all = await listTable(env, env.FEISHU_Q_TABLE);
    const map = new Map(all.map((q) => [q.id, q]));
    let singleScore = 0,
      tfScore = 0,
      shortScore = 0,
      total = 0;
    const wrong = [];
    for (const id of ids) {
      const q = map.get(id);
      if (!q) continue;
      const userAns = answers[id];
      const r = gradeOne(q, userAns);
      total += r.got;
      if (q.q_type === "single") singleScore += r.got;
      else if (q.q_type === "tf") tfScore += r.got;
      else shortScore += r.got;
      if (!r.correct) {
        wrong.push({
          q_type: q.q_type,
          content: q.content,
          your_answer: userAns == null ? "" : String(userAns),
          correct_answer: q.answer,
        });
      }
    }
    const data = await feishuRequest(
      env,
      "POST",
      `/open-apis/bitable/v1/apps/${env.FEISHU_APP_TOKEN}/tables/${env.FEISHU_S_TABLE}/records`,
      {
        fields: {
          name,
          paper_id,
          single_score: singleScore,
          tf_score: tfScore,
          short_score: shortScore,
          total_score: total,
          wrong_detail: JSON.stringify(wrong),
          created_at: formatDateTime(new Date()),
        },
      }
    );
    if (data.code !== 0) throw new Error("写入成绩失败: " + data.msg);
    return json({ total, single_score: singleScore, tf_score: tfScore, short_score: shortScore, wrong });
  } catch (e) {
    return json({ error: String(e && e.message ? e.message : e) }, 500);
  }
}
