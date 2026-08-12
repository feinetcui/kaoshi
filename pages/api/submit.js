import { listQuestions, createScore } from "../../lib/feishu";
import { gradeOne } from "../../lib/grading";

function pad(n) {
  return String(n).padStart(2, "0");
}
function formatDateTime(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "仅支持 POST" });
  try {
    const { name, paper_id, answers } = req.body || {};
    if (!name || !paper_id || !answers)
      return res.status(400).json({ error: "缺少必填字段" });
    const ids = JSON.parse(paper_id);
    const all = await listQuestions();
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
    await createScore({
      name,
      paper_id,
      single_score: singleScore,
      tf_score: tfScore,
      short_score: shortScore,
      total_score: total,
      wrong_detail: JSON.stringify(wrong),
      created_at: formatDateTime(new Date()),
    });
    res.json({
      total,
      single_score: singleScore,
      tf_score: tfScore,
      short_score: shortScore,
      wrong,
    });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
