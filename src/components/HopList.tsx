/**
 * 逐跳详情：每跳的时刻（恒星时）、高度、角距，以及经光学变换后的目镜移动箭头小图。
 */
import { formatSiderealHms, toRad, wrapDeltaDeg } from "../lib/astro";
import { transformVector } from "../lib/optics";
import type { HopEvidence, PathResult, PlannerInput, StarInput } from "../lib/types";

interface Props {
  input: PlannerInput;
  result: PathResult;
}

const HOP_COLORS = ["#ff7b72", "#79c0ff", "#d2a8ff", "#7ee787", "#ffa657", "#ff9bce", "#a5d6ff", "#f8e3a1"];

const fmt = (x: number, d = 2) => x.toFixed(d);

/** 目镜小图：圆为视场边界，中心为当前星，箭头为光学变换后的目标方向。 */
function Eyepiece({
  input,
  hop,
  from,
  to,
  color
}: {
  input: PlannerInput;
  hop: HopEvidence;
  from: StarInput;
  to: StarInput;
  color: string;
}) {
  const R = 56;
  const C = 66;
  // 局部切平面上的真实位移（东在左、北在上）
  const raw = {
    x: -wrapDeltaDeg(to.raDeg - from.raDeg) * Math.cos(toRad(from.decDeg)),
    y: to.decDeg - from.decDeg
  };
  const tv = transformVector(input.opticsMode, raw);
  const len = Math.hypot(tv.x, tv.y) || 1;
  const frac = Math.min(hop.distanceDeg / input.fovDeg, 1);
  const ax = (tv.x / len) * R * frac;
  const ay = (tv.y / len) * R * frac;
  const headLen = 8;
  const ux = tv.x / len;
  const uy = tv.y / len;
  const tipX = C + ax;
  const tipY = C - ay; // SVG y 向下
  const hx = C + ax - ux * headLen;
  const hy = C - ay + uy * headLen;
  const px = -uy;
  const py = ux;

  return (
    <svg className="eyepiece" width="132" height="132" viewBox="0 0 132 132" role="img" aria-label={`第 ${hop.hopIndex} 跳目镜视图`}>
      <circle cx={C} cy={C} r={R} fill="none" stroke="#30363d" strokeWidth="1.5" />
      <circle cx={C} cy={C} r="2.6" fill="#ffd76d" />
      {/* 光学变换后的移动方向 */}
      <line x1={C} y1={C} x2={tipX} y2={tipY} stroke={color} strokeWidth="2.4" />
      <polygon
        points={`${tipX},${tipY} ${hx + px * 4},${hy - py * 4} ${hx - px * 4},${hy + py * 4}`}
        fill={color}
      />
      <text x={Math.min(124, Math.max(8, tipX + ux * 10))} y={Math.min(126, Math.max(10, tipY - uy * 10))} fill={color} fontSize="11" fontWeight="700" textAnchor="middle">
        {hop.toId}
      </text>
    </svg>
  );
}

export default function HopList({ input, result }: Props) {
  const byId = new Map<number, StarInput>(input.stars.map((s) => [s.id, s]));
  return (
    <div>
      <div className="hop-card" style={{ gridTemplateColumns: "1fr" }}>
        <div>
          <h3>
            第 0 次到达（起点）：编号 {result.starIds[0]}
          </h3>
          <dl>
            <dt>恒星时</dt>
            <dd>
              {fmt(result.startLstDeg)}°（{formatSiderealHms(result.startLstDeg)}）
            </dd>
            <dt>高度 / 方位</dt>
            <dd>
              {fmt(result.startAltDeg)}° / {fmt(result.startAzDeg)}°
            </dd>
          </dl>
        </div>
      </div>
      {result.hops.map((hop, i) => (
        <div className="hop-card" key={hop.hopIndex}>
          <div>
            <h3 style={{ color: HOP_COLORS[i % HOP_COLORS.length] }}>
              第 {hop.hopIndex} 跳：{hop.fromId} → {hop.toId}
            </h3>
            <dl>
              <dt>累计分钟</dt>
              <dd>{fmt(hop.elapsedMin, 1)} min</dd>
              <dt>到达恒星时</dt>
              <dd>
                {fmt(hop.lstDeg)}°（{formatSiderealHms(hop.lstDeg)}）
              </dd>
              <dt>到达高度</dt>
              <dd>
                {fmt(hop.arrivalAltDeg)}°（余量 {fmt(hop.arrivalMarginDeg)}°）
              </dd>
              <dt>到达方位角</dt>
              <dd>{fmt(hop.arrivalAzDeg)}°</dd>
              <dt>本跳角距</dt>
              <dd>{fmt(hop.distanceDeg)}° / 视场 {fmt(input.fovDeg)}°</dd>
            </dl>
          </div>
          <Eyepiece
            input={input}
            hop={hop}
            from={byId.get(hop.fromId)!}
            to={byId.get(hop.toId)!}
            color={HOP_COLORS[i % HOP_COLORS.length]}
          />
        </div>
      ))}
    </div>
  );
}
