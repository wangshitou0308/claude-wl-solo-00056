import { useCallback, useRef, useState } from "react";
import HopList from "./components/HopList";
import NoPathReport from "./components/NoPathReport";
import StarChart from "./components/StarChart";
import { downloadEvidence } from "./lib/report";
import { planPath } from "./lib/search";
import { OPTICS_MODE_LABELS } from "./lib/types";
import type { PlanResult, PlannerInput, ValidationError } from "./lib/types";
import { parseAndValidate } from "./lib/validate";
import { SAMPLE_JSON } from "./sample";

const fmt = (x: number, d = 2) => x.toFixed(d);

interface Computed {
  input: PlannerInput;
  result: PlanResult;
}

export default function App() {
  const [text, setText] = useState(SAMPLE_JSON);
  const [computed, setComputed] = useState<Computed | null>(null);
  const [errors, setErrors] = useState<ValidationError[] | null>(null);
  const [invalidated, setInvalidated] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  /** 修改输入立即废止旧结果。 */
  const handleTextChange = useCallback(
    (value: string) => {
      setText(value);
      if (computed || errors) {
        setComputed(null);
        setErrors(null);
        setInvalidated(true);
      }
    },
    [computed, errors]
  );

  const handleCompute = useCallback(() => {
    const outcome = parseAndValidate(text);
    setInvalidated(false);
    if (!outcome.ok) {
      // 坐标或引用非法：整次拒绝，不产出任何部分结果
      setErrors(outcome.errors);
      setComputed(null);
      return;
    }
    setErrors(null);
    setComputed({ input: outcome.input, result: planPath(outcome.input) });
  }, [text]);

  const handleFile = useCallback(
    (file: File) => {
      file.text().then((content) => handleTextChange(content));
    },
    [handleTextChange]
  );

  const path = computed?.result.status === "path" ? computed.result : null;

  return (
    <div>
      <h1>离线寻星路径预演台</h1>
      <p className="subtitle">
        全部计算在浏览器本地完成，无需联网。导入 JSON → 预演 → 按跳查看时刻、高度、角距与目镜移动方向。
      </p>
      <div className="layout">
        <div>
          <div className="panel">
            <h2>输入（JSON）</h2>
            <textarea
              value={text}
              onChange={(e) => handleTextChange(e.target.value)}
              spellCheck={false}
              aria-label="寻星输入 JSON"
            />
            <div className="button-row">
              <button className="primary" onClick={handleCompute}>
                开始预演
              </button>
              <button onClick={() => fileRef.current?.click()}>导入 JSON 文件…</button>
              <button onClick={() => handleTextChange(SAMPLE_JSON)}>载入示例</button>
              <button
                disabled={!computed}
                onClick={() => computed && downloadEvidence(computed.input, computed.result)}
                title="下载含输入摘要、路径与计算证据的 JSON"
              >
                下载证据 JSON
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
            {invalidated && !computed && !errors && (
              <p className="notice">输入已修改，旧结果已废止，请重新预演。</p>
            )}
            {errors && (
              <div className="error-list" role="alert">
                <h3>输入非法，本次导入已整体拒绝（{errors.length} 处问题）：</h3>
                <ul>
                  {errors.map((e, i) => (
                    <li key={i}>
                      <code>{e.path}</code>：{e.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="panel">
            <h2>输入格式说明</h2>
            <p className="muted" style={{ margin: 0 }}>
              字段：<code>stars</code>（2～120 颗，<code>id</code> 整数唯一，<code>raDeg</code>∈[0,360)、
              <code>decDeg</code>∈[−90,90]、<code>mag</code>）、<code>startId</code>、<code>targetId</code>、
              <code>latitudeDeg</code>、<code>initialSiderealDeg</code>（度制恒星时）、<code>fovDeg</code>、
              <code>limitingMag</code>、<code>minutesPerHop</code>、<code>minAltitudeDeg</code>、
              <code>opticsMode</code>（erect 正像 / mirror 水平镜像 / inverted 倒像）。
              第 k 次到达恒星时 = (初值 + 0.250684 × k × 每跳分钟数) mod 360；候选星须星等 ≤ 极限星等，
              相邻两跳球面角距 ≤ 视场角，每次到达高度 ≥ 最低高度；路径不重复星点、最多 8 跳。
              优选顺序：跳数最少 → 全程最低高度余量最大 → 总角距最短 → 编号序列字典序最小。
            </p>
          </div>
        </div>

        <div>
          {computed && computed.result.status === "path" && path && (
            <>
              <div className="panel">
                <h2>预演结果</h2>
                <div className="summary-grid">
                  <div className="summary-item">
                    <div className="label">跳数</div>
                    <div className="value">{path.hopsCount}</div>
                  </div>
                  <div className="summary-item">
                    <div className="label">全程最低高度余量</div>
                    <div className="value">{fmt(path.minMarginDeg)}°</div>
                  </div>
                  <div className="summary-item">
                    <div className="label">总角距</div>
                    <div className="value">{fmt(path.totalDistanceDeg)}°</div>
                  </div>
                  <div className="summary-item">
                    <div className="label">编号序列</div>
                    <div className="value" style={{ fontSize: 13 }}>
                      {path.starIds.join(" → ")}
                    </div>
                  </div>
                  <div className="summary-item">
                    <div className="label">光学模式</div>
                    <div className="value" style={{ fontSize: 13 }}>
                      {OPTICS_MODE_LABELS[computed.input.opticsMode]}
                    </div>
                  </div>
                </div>
                <StarChart input={computed.input} result={path} />
              </div>
              <div className="panel">
                <h2>逐跳预演</h2>
                <HopList input={computed.input} result={path} />
              </div>
            </>
          )}
          {computed && computed.result.status === "no-path" && (
            <div className="panel">
              <h2>无路报告</h2>
              <NoPathReport result={computed.result} />
            </div>
          )}
          {!computed && !errors && (
            <div className="panel">
              <h2>预演结果</h2>
              <p className="muted">点击「开始预演」后在此显示星图、逐跳信息与无路报告。</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
