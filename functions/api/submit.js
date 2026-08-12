// EdgeOne Pages Function: POST /api/submit
// 解析 paper_id -> 从飞书题库取标准答案 -> 逐题判分 -> 写入成绩表 -> 返回总分与错题。
// 题库通过边缘缓存 10 分钟（题库变更后最长 10 分钟生效）。

import { getEnv, listTable, feishuRequest, json, cached } from "./_shared.js";

function normalize(s) {
  return String(s == null ? "" : s)
    .toLowerCase()
    .replace(/[\s\p{P}]+/gu, "");
}

function gradeOne(q, userAnswer) {
  const score = Number(q.score) || 0;
  if (q.q_type === "fill" || q.q_type === "tf") {
    const given = normalize(userAnswer);
    const candidates = String(q.answer == null ? "" : q.answer)
      .split("|")
      .map(normalize)
      .filter(Boolean);
    const isCorrect = candidates.length > 0 && candidates.includes(given);
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

export async function onRequestPost(context) {
  try {
    const env = await getEnv(context);
    const body = await context.request.json();
    const { name, paper_id, answers } = body || {};
    if (!name || !paper_id || !answers) return json({ error: "缺少必填字段" }, 400);
    const ids = typeof paper_id === "string" ? JSON.parse(paper_id) : paper_id;
    const all = await cached("questions", 600, () => listTable(env, env.FEISHU_Q_TABLE));
    const map = new Map(all.map((q) => [q.id, q]));
    let fillScore = 0,
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
      if (q.q_type === "fill") fillScore += r.got;
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
          name: String(name).slice(0, 50),
          paper_id,
          single_score: fillScore,
          tf_score: tfScore,
          short_score: shortScore,
          total_score: total,
          wrong_detail: JSON.stringify(wrong),
          created_at: Date.now(),
        },
      }
    );
    if (data.code !== 0) throw new Error("写入成绩失败: " + data.msg);
    return json({ total, fill_score: fillScore, tf_score: tfScore, short_score: shortScore, wrong });
  } catch (e) {
    return json({ error: String(e && e.message ? e.message : e) }, 500);
  }
}
