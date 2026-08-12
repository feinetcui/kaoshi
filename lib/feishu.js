const BASE = "https://open.feishu.cn";

let _token = null;
let _expireAt = 0;

async function getToken() {
  const now = Date.now();
  if (_token && now < _expireAt - 5000) return _token;
  const res = await fetch(BASE + "/open-apis/auth/v3/tenant_access_token/internal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_id: process.env.FEISHU_APP_ID,
      app_secret: process.env.FEISHU_APP_SECRET,
    }),
  });
  const data = await res.json();
  if (data.code !== 0) throw new Error("飞书获取令牌失败: " + data.msg);
  _token = data.tenant_access_token;
  _expireAt = now + (data.expire || 7200) * 1000;
  return _token;
}

async function feishuRequest(method, path, body) {
  const token = await getToken();
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

async function listTable(table) {
  const appToken = process.env.FEISHU_APP_TOKEN;
  const out = [];
  let pageToken = "";
  while (true) {
    let path =
      `/open-apis/bitable/v1/apps/${appToken}/tables/${table}/records?page_size=100`;
    if (pageToken) path += "&page_token=" + encodeURIComponent(pageToken);
    const data = await feishuRequest("GET", path);
    if (data.code !== 0) throw new Error("读取多维表格失败: " + data.msg);
    for (const it of data.data.items) out.push({ id: it.record_id, ...it.fields });
    if (!data.data.has_more) break;
    pageToken = data.data.page_token || "";
    if (!pageToken) break;
  }
  return out;
}

export async function listQuestions() {
  return listTable(process.env.FEISHU_Q_TABLE);
}

export async function listScores() {
  return listTable(process.env.FEISHU_S_TABLE);
}

export async function createScore(fields) {
  const appToken = process.env.FEISHU_APP_TOKEN;
  const data = await feishuRequest(
    "POST",
    `/open-apis/bitable/v1/apps/${appToken}/tables/${process.env.FEISHU_S_TABLE}/records`,
    { fields }
  );
  if (data.code !== 0) throw new Error("写入成绩失败: " + data.msg);
  return data;
}
