import { useState } from "react";
import { useRouter } from "next/router";

export default function Home() {
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function start() {
    const n = name.trim();
    if (!n) {
      setErr("请先填写姓名");
      return;
    }
    setErr("");
    setLoading(true);
    try {
      const res = await fetch("/api/paper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: n }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "取卷失败");
      sessionStorage.setItem(
        "exam",
        JSON.stringify({ name: n, paper_id: data.paper_id, questions: data.questions })
      );
      router.push("/exam");
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container">
      <div className="card">
        <h1>企业文化考试</h1>
        <p className="sub">请填写姓名后开始答题（随机抽题：填空20题、判断10题、简答8题）</p>
        <input
          className="input"
          placeholder="请输入你的姓名"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && start()}
        />
        {err && <div className="err">{err}</div>}
        <button className="btn" onClick={start} disabled={loading}>
          {loading ? "正在生成试卷…" : "开始考试"}
        </button>
        <button className="link" onClick={() => router.push("/rank")}>
          查看排行榜
        </button>
      </div>
    </main>
  );
}
