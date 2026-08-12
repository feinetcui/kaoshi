import { useState, useEffect } from "react";
import { useRouter } from "next/router";

const TYPE_LABEL = { single: "单选题", tf: "判断题", short: "简答题" };
const LETTERS = ["A", "B", "C", "D"];

export default function Exam() {
  const [exam, setExam] = useState(null);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const router = useRouter();

  useEffect(() => {
    const raw = sessionStorage.getItem("exam");
    if (!raw) {
      router.replace("/");
      return;
    }
    try {
      setExam(JSON.parse(raw));
    } catch {
      router.replace("/");
    }
  }, [router]);

  if (!exam)
    return (
      <main className="container">
        <div className="card">加载中…</div>
      </main>
    );

  function setAns(id, val) {
    setAnswers((a) => ({ ...a, [id]: val }));
  }

  async function submit() {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: exam.name,
          paper_id: exam.paper_id,
          answers,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "提交失败");
      sessionStorage.setItem("result", JSON.stringify(data));
      router.push("/result");
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  const groups = { single: [], tf: [], short: [] };
  exam.questions.forEach((q) => groups[q.q_type].push(q));

  return (
    <main className="container">
      <div className="card wide">
        <div className="exam-head">
          <h2>考生：{exam.name}</h2>
          <button className="btn small" onClick={submit} disabled={loading}>
            {loading ? "提交中…" : "提交试卷"}
          </button>
        </div>
        {err && <div className="err">{err}</div>}

        {["single", "tf", "short"].map((type) =>
          groups[type].length ? (
            <section key={type}>
              <h3>
                {TYPE_LABEL[type]}（{groups[type].length}题）
              </h3>
              {groups[type].map((q, i) => (
                <div className="q" key={q.id}>
                  <div className="q-title">
                    {i + 1}. {q.content}
                  </div>
                  {type === "single" && (
                    <div className="opts">
                      {q.options.map((opt, oi) => (
                        <label key={oi} className="opt">
                          <input
                            type="radio"
                            name={q.id}
                            value={LETTERS[oi]}
                            checked={answers[q.id] === LETTERS[oi]}
                            onChange={() => setAns(q.id, LETTERS[oi])}
                          />
                          {LETTERS[oi]}. {opt}
                        </label>
                      ))}
                    </div>
                  )}
                  {type === "tf" && (
                    <div className="opts">
                      {["正确", "错误"].map((v) => (
                        <label key={v} className="opt">
                          <input
                            type="radio"
                            name={q.id}
                            value={v}
                            checked={answers[q.id] === v}
                            onChange={() => setAns(q.id, v)}
                          />
                          {v}
                        </label>
                      ))}
                    </div>
                  )}
                  {type === "short" && (
                    <textarea
                      className="ta"
                      rows={3}
                      placeholder="请输入你的回答"
                      value={answers[q.id] || ""}
                      onChange={(e) => setAns(q.id, e.target.value)}
                    />
                  )}
                </div>
              ))}
            </section>
          ) : null
        )}
      </div>
    </main>
  );
}
