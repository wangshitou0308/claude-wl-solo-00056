/**
 * 星图：以路径中心做简易等距圆柱投影（北在上、东在左），
 * 绘制全部恒星、每跳视场圈、真实路径（虚线）与经光学变换后的移动箭头（实线）。
 */
import { useMemo } from "react";
import { toRad, wrapDeltaDeg } from "../lib/astro";
import { transformVector } from "../lib/optics";
import { OPTICS_DESCRIPTIONS } from "../lib/optics";
import type { PathResult, PlannerInput, StarInput } from "../lib/types";

const HOP_COLORS = ["#ff7b72", "#79c0ff", "#d2a8ff", "#7ee787", "#ffa657", "#ff9bce", "#a5d6ff", "#f8e3a1"];

interface Props {
  input: PlannerInput;
  result: PathResult;
}

interface Pt {
  x: number;
  y: number;
}

export default function StarChart({ input, result }: Props) {
  const model = useMemo(() => {
    const byId = new Map<number, StarInput>(input.stars.map((s) => [s.id, s]));
    const pathStars = result.starIds.map((id) => byId.get(id)!);

    // 以路径恒星为中心做投影，赤经按首星展开避免 0/360 跳变
    const unwrapped: number[] = [pathStars[0].raDeg];
    for (let i = 1; i < pathStars.length; i++) {
      unwrapped.push(unwrapped[i - 1] + wrapDeltaDeg(pathStars[i].raDeg - pathStars[i - 1].raDeg));
    }
    const ra0 = unwrapped.reduce((a, b) => a + b, 0) / unwrapped.length;
    const dec0 = pathStars.reduce((a, s) => a + s.decDeg, 0) / pathStars.length;
    const cosDec0 = Math.cos(toRad(dec0));

    const proj = (s: StarInput): Pt => ({
      x: -wrapDeltaDeg(s.raDeg - ra0) * cosDec0,
      y: s.decDeg - dec0
    });

    const pts = new Map<number, Pt>(input.stars.map((s) => [s.id, proj(s)]));
    const xs = [...pts.values()].map((p) => p.x);
    const ys = [...pts.values()].map((p) => p.y);
    const pad = input.fovDeg * 1.3 + 2;
    const minX = Math.min(...xs) - pad;
    const maxX = Math.max(...xs) + pad;
    const minY = Math.min(...ys) - pad;
    const maxY = Math.max(...ys) + pad;
    const w = maxX - minX;
    const h = maxY - minY;
    const unit = Math.max(w, h) / 100; // 相对尺寸基准

    return { byId, pts, pathStars, minX, maxY, w, h, unit, cosDec0 };
  }, [input, result]);

  const { byId, pts, pathStars, minX, maxY, w, h, unit, cosDec0 } = model;
  const pathPts = result.starIds.map((id) => pts.get(id)!);
  const starR = (mag: number) => unit * Math.min(7, Math.max(1.5, 6 - 0.7 * mag)) * 0.5;
  const arrowLen = Math.max(w, h) * 0.09;
  const fontSize = unit * 3.2;

  const sx = (p: Pt) => p.x;
  const sy = (p: Pt) => -p.y; // SVG y 轴向下

  return (
    <div>
      <svg
        viewBox={`${minX} ${-maxY} ${w} ${h}`}
        width="100%"
        role="img"
        aria-label="寻星路径星图"
        style={{ background: "#05070c", borderRadius: 8, border: "1px solid #30363d" }}
      >
        <defs>
          {HOP_COLORS.map((c, i) => (
            <marker
              key={c}
              id={`arrowhead-${i}`}
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="3"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d={`M0,0 L7,3 L0,6 Z`} fill={c} />
            </marker>
          ))}
        </defs>

        {/* 方位指北针：北在上，东在左 */}
        <g stroke="#8b949e" strokeWidth={unit * 0.25} fill="#8b949e">
          <line x1={minX + unit * 6} y1={-maxY + unit * 10} x2={minX + unit * 6} y2={-maxY + unit * 4} />
          <text x={minX + unit * 6} y={-maxY + unit * 2.6} fontSize={fontSize} textAnchor="middle" stroke="none">
            北
          </text>
          <line x1={minX + unit * 3} y1={-maxY + unit * 7} x2={minX + unit * 9} y2={-maxY + unit * 7} />
          <text x={minX + unit * 1.6} y={-maxY + unit * 8} fontSize={fontSize} textAnchor="middle" stroke="none">
            东
          </text>
        </g>

        {/* 每跳出发星的视场圈（角距 ≤ 视场角 的近似投影） */}
        {result.hops.map((hop) => {
          const star = byId.get(hop.fromId)!;
          const p = pts.get(hop.fromId)!;
          const cosDec = Math.max(0.05, Math.cos(toRad(star.decDeg)));
          return (
            <ellipse
              key={`fov-${hop.hopIndex}`}
              cx={sx(p)}
              cy={sy(p)}
              rx={(input.fovDeg * cosDec0) / cosDec}
              ry={input.fovDeg}
              fill="none"
              stroke="#30363d"
              strokeDasharray={`${unit} ${unit}`}
              strokeWidth={unit * 0.22}
            />
          );
        })}

        {/* 全部恒星 */}
        {input.stars.map((s) => {
          const p = pts.get(s.id)!;
          const isCandidate = s.mag <= input.limitingMag;
          const onPath = result.starIds.includes(s.id);
          return (
            <circle
              key={s.id}
              cx={sx(p)}
              cy={sy(p)}
              r={starR(s.mag)}
              fill={onPath ? "#ffd76d" : isCandidate ? "#9fb4ff" : "#4c525c"}
              opacity={onPath ? 1 : isCandidate ? 0.85 : 0.5}
            />
          );
        })}

        {/* 真实路径（星图方向，虚线） */}
        <polyline
          points={pathPts.map((p) => `${sx(p)},${sy(p)}`).join(" ")}
          fill="none"
          stroke="#8b949e"
          strokeWidth={unit * 0.3}
          strokeDasharray={`${unit * 1.2} ${unit * 0.9}`}
          opacity={0.8}
        />

        {/* 每跳经光学变换后的移动箭头（目镜中应看到的移动方向） */}
        {result.hops.map((hop, i) => {
          const a = pts.get(hop.fromId)!;
          const b = pts.get(hop.toId)!;
          const tv = transformVector(input.opticsMode, { x: b.x - a.x, y: b.y - a.y });
          const len = Math.hypot(tv.x, tv.y);
          if (len < 1e-9) return null;
          const dx = (tv.x / len) * arrowLen;
          const dy = (tv.y / len) * arrowLen;
          const color = HOP_COLORS[i % HOP_COLORS.length];
          return (
            <g key={`hop-${hop.hopIndex}`}>
              <title>
                {`第 ${hop.hopIndex} 跳 ${hop.fromId}→${hop.toId}｜恒星时 ${hop.lstDeg.toFixed(2)}°｜高度 ${hop.arrivalAltDeg.toFixed(2)}°｜角距 ${hop.distanceDeg.toFixed(2)}°`}
              </title>
              <line
                x1={sx(a)}
                y1={sy(a)}
                x2={sx(a) + dx}
                y2={sy(a) - dy}
                stroke={color}
                strokeWidth={unit * 0.55}
                markerEnd={`url(#arrowhead-${i % HOP_COLORS.length})`}
              />
              <text
                x={sx(a) + dx * 1.18}
                y={sy(a) - dy * 1.18}
                fill={color}
                fontSize={fontSize}
                fontWeight={700}
                textAnchor="middle"
              >
                {hop.hopIndex}
              </text>
            </g>
          );
        })}

        {/* 起点/目标标记与编号 */}
        {pathStars.map((s, i) => {
          const p = pts.get(s.id)!;
          const isStart = i === 0;
          const isTarget = i === pathStars.length - 1;
          return (
            <g key={`mark-${s.id}`}>
              {(isStart || isTarget) && (
                <circle
                  cx={sx(p)}
                  cy={sy(p)}
                  r={starR(s.mag) + unit * 1.1}
                  fill="none"
                  stroke={isStart ? "#3fb950" : "#f85149"}
                  strokeWidth={unit * 0.4}
                />
              )}
              <text
                x={sx(p) + unit * 1.6}
                y={sy(p) - unit * 1.6}
                fill="#e6edf3"
                fontSize={fontSize * 0.9}
              >
                {s.id}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="legend">
        灰虚线：星图上的真实路径；彩色实线箭头：{OPTICS_DESCRIPTIONS[input.opticsMode]}，即目镜中星点的表观移动方向（数字为跳序）。
        虚线圈：各跳出发星的视场范围（近似）。绿圈=起点，红圈=目标；黄点=路径星，蓝点=其他候选星，灰点=星等超限星。
      </p>
    </div>
  );
}
