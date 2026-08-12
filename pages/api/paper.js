import { listQuestions } from "../../lib/feishu";
import { sampleN } from "../../lib/grading";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "仅支持 POST" });
  try {
    const all = await listQuestions();
    const single = all.filter((q) => q.q_type === "single");
    const tf = all.filter((q) => q.q_type === "tf");
    const short = all.filter((q) => q.q_type === "short");
    const selected = [...sampleN(single, 20), ...sampleN(tf, 10), ...sampleN(short, 8)];
    const paperId = JSON.stringify(selected.map((q) => q.id));
    const questions = selected.map((q) => ({
      id: q.id,
      q_type: q.q_type,
      content: q.content,
      options:
        q.q_type === "single"
          ? [q.opt_a, q.opt_b, q.opt_c, q.opt_d].filter(Boolean)
          : undefined,
    }));
    res.json({ paper_id: paperId, questions });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
