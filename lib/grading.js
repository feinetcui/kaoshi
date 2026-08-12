export function sampleN(arr, n) {
  if (!arr || arr.length === 0) return [];
  if (arr.length >= n) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, n);
  }
  // 题池不足时放回抽样补足
  const out = [];
  for (let i = 0; i < n; i++) out.push(arr[Math.floor(Math.random() * arr.length)]);
  return out;
}

function normalize(s) {
  return String(s == null ? "" : s)
    .toLowerCase()
    .replace(/[\s\p{P}]+/gu, "");
}

export function gradeOne(q, userAnswer) {
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
  // 简答题：关键词命中率给分
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
