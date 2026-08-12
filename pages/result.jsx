import { useState, useEffect } from "react";
import { useRouter } from "next/router";

export default function Result() {
  const [result, setResult] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const raw = sessionStorage.getItem("result");
    if (!raw) {
      router.replace("/");
      return;
    }
    try {
      setResult(JSON.parse(raw));
    } catch {
      router.replace("/");
    }
  }, [router]);

  if (!result)
    return (
      <main className="container">
        <div className="card">加载中…</div>
      </main>
    );

  return (
    <main className="container">
      <div className="card wide">
        <h2>考试结果</h2>
        <div className="score-big">{result.total} 分</div>
        <div className="breakdown">
          填空 {result.fill_score} ｜ 判断 {result.tf_score} ｜ 简答 {result.short_score}
        </div>

        <h3>答错题目（{result.wrong.length}）</h3>
        {result.wrong.length === 0 ? (
          <p className="ok">全部正确，太棒了！</p>
        ) : (
          result.wrong.map((w, i) => (
            <div className="wrong" key={i}>
              <div className="wq">
                {i + 1}. {w.content}
              </div>
              <div className="wa">你的答案：{w.your_answer || "（未作答）"}</div>
              <div className="wc">正确答案：{w.correct_answer}</div>
            </div>
          ))
        )}

        <div className="actions">
          <button
            className="btn"
            onClick={() => {
              sessionStorage.removeItem("exam");
              sessionStorage.removeItem("result");
              router.push("/");
            }}
          >
            再考一次
          </button>
          <button className="link" onClick={() => router.push("/rank")}>
            查看排行榜
          </button>
        </div>
      </div>
    </main>
  );
}
