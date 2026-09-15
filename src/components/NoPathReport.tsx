/**
 * 无路报告：按搜索层列出因视场或高度被排除的边界星，绝不返回半条路线。
 */
import type { NoPathResult } from "../lib/types";

const fmt = (x: number, d = 2) => x.toFixed(d);

export default function NoPathReport({ result }: { result: NoPathResult }) {
  return (
    <div>
      <p className="notice" role="alert">
        未找到可行路径：{result.reason}
      </p>
      <p className="muted">
        候选星 {result.candidateCount} 颗（星等 ≤ 极限星等）。
        {result.magnitudeExcludedIds.length > 0 && (
          <>
            {" "}星等超限被排除：
            {result.magnitudeExcludedIds.map((id) => (
              <span className="tag bad" key={id}>
                {id}
              </span>
            ))}
          </>
        )}
      </p>
      {result.layers.map((layer) => (
        <div className="layer-block" key={layer.layer}>
          <h3>
            第 {layer.layer} 层（第 {layer.layer} 跳出发前沿：
            {layer.frontierIds.length > 0 ? layer.frontierIds.join("、") : "（空）"}）
          </h3>
          {layer.boundary.length === 0 ? (
            <p className="muted">本层无被排除的边界星。</p>
          ) : (
            <table className="boundary">
              <thead>
                <tr>
                  <th>排除原因</th>
                  <th>从 → 到</th>
                  <th>角距°</th>
                  <th>详情</th>
                </tr>
              </thead>
              <tbody>
                {layer.boundary.map((b, i) => (
                  <tr key={`${b.toId}-${b.reason}-${i}`}>
                    <td className={b.reason === "altitude" ? "reason-alt" : "reason-fov"}>
                      {b.reason === "altitude" ? "高度不足" : "超出视场"}
                    </td>
                    <td>
                      {b.fromId} → {b.toId}
                    </td>
                    <td>{fmt(b.distanceDeg)}</td>
                    <td>
                      {b.reason === "altitude"
                        ? `到达高度 ${fmt(b.altDeg!)}° < 最低高度 ${fmt(b.minAltitudeDeg!)}°（余量 ${fmt(
                            b.marginDeg!
                          )}°）`
                        : `角距超出视场 ${fmt(b.excessDeg!)}°（视场 ${fmt(b.fovDeg)}°）`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {layer.truncatedCount > 0 && (
            <p className="muted">另有 {layer.truncatedCount} 条边界星条目从略（已达每层上限）。</p>
          )}
        </div>
      ))}
    </div>
  );
}
