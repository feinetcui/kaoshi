import { useState, useEffect } from "react";
import { useRouter } from "next/router";

export default function Rank() {
  const [rank, setRank] = useState([]);
  const [sort, setSort] = useState("score");
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch("/api/rank?sort=" + sort)
      .then((r) => r.json())
      .then((d) => {
        if (active) setRank(d.rank || []);
      })
      .catch(() => {
        if (active) setRank([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [sort]);

  return (
    <main className="container">
      <div className="card wide">
        <div className="exam-head">
          <h2>排行榜</h2>
          <div>
            <button
              className={"btn small" + (sort === "score" ? " active" : "")}
              onClick={() => setSort("score")}
            >
              按分数
            </button>
            <button
              className={"btn small" + (sort === "name" ? " active" : "")}
              onClick={() => setSort("name")}
            >
              按姓名
            </button>
          </div>
        </div>
        {loading ? (
          <p>加载中…</p>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>#</th>
                <th>姓名</th>
                <th>最高分</th>
                <th>参考次数</th>
              </tr>
            </thead>
            <tbody>
              {rank.map((r, i) => (
                <tr key={r.name}>
                  <td>{i + 1}</td>
                  <td>{r.name}</td>
                  <td>{r.total}</td>
                  <td>{r.attempts}</td>
                </tr>
              ))}
              {rank.length === 0 && (
                <tr>
                  <td colSpan={4}>暂无成绩</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
        <div className="actions">
          <button className="link" onClick={() => router.push("/")}>
            返回首页
          </button>
        </div>
      </div>
    </main>
  );
}
