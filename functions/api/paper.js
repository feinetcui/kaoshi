// EdgeOne Pages Function: POST /api/paper
// 返回随机试卷（仅题干+选项，不含答案），前端凭 paper_id 交卷时再由服务端判分。
// 题库通过边缘缓存 10 分钟，减少飞书 API 调用与函数执行时间。

import { getEnv, listTable, json, cached } from "./_shared.js";

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

export async function onRequestPost(context) {
  try {
    const env = await getEnv(context);
    const all = await cached("questions", 600, () => listTable(env, env.FEISHU_Q_TABLE));
    const fill = all.filter((q) => q.q_type === "fill");
    const tf = all.filter((q) => q.q_type === "tf");
    const short = all.filter((q) => q.q_type === "short");
    const selected = [...sampleN(fill, 20), ...sampleN(tf, 10), ...sampleN(short, 5)];
    const paperId = JSON.stringify(selected.map((q) => q.id));
    const questions = selected.map((q) => ({
      id: q.id,
      q_type: q.q_type,
      content: q.content,
    }));
    return json({ paper_id: paperId, questions });
  } catch (e) {
    return json({ error: String(e && e.message ? e.message : e) }, 500);
  }
}
