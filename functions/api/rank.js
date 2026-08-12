// EdgeOne Pages Function: GET /api/rank?sort=score|name
// 读取成绩表，按姓名取历次最高分，统计参考次数，按分数或姓名排序返回。
// 成绩表通过边缘缓存 60 秒，避免每次全量拉取飞书表格。

import { getEnv, listTable, json, cached } from "./_shared.js";

export async function onRequestGet(context) {
  try {
    const env = await getEnv(context);
    const scores = await cached("scores", 60, () => listTable(env, env.FEISHU_S_TABLE));
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
