import { listScores } from "../../lib/feishu";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "仅支持 GET" });
  try {
    const scores = await listScores();
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
    const sort = req.query.sort === "name" ? "name" : "score";
    if (sort === "name") arr.sort((a, b) => a.name.localeCompare(b.name, "zh"));
    else arr.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "zh"));
    res.json({ rank: arr });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
