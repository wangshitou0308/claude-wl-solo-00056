/**
 * 路径搜索：
 *  - 候选星：星等 ≤ 极限星等；
 *  - 可进入视场：球面角距 ≤ 视场角；
 *  - 到达高度：按第 k 次到达的恒星时计算，须 ≥ 最低高度；
 *  - 路径不重复星点、最多 8 跳；
 *  - 优选顺序：跳数最少 → 全程最低高度余量最大 → 总角距最短 → 编号序列字典序最小。
 *
 * 实现：先按跳数递增做精确 DFS（迭代加深），在固定跳数内用分支限界
 * （余量上界 / 角距下界 / 字典序剪枝）枚举所有简单路径并保留最优。
 * 另做一次时间扩展 BFS，用于可达性预判与无路时的分层边界星报告。
 */
import {
  altitudeDeg,
  angularDistanceDeg,
  azimuthDeg,
  siderealAtDeg,
  wrapDeltaDeg
} from "./astro";
import type {
  BoundaryEntry,
  HopEvidence,
  NoPathResult,
  PathResult,
  PlanResult,
  PlannerInput,
  SearchLayerReport
} from "./types";

export const MAX_HOPS = 8;
/** 每层边界星条目上限（超出仅计数，防止病态稠密输入产生海量条目）。 */
export const BOUNDARY_CAP_PER_LAYER = 500;
/** 每颗前沿星最多列出的“超出视场”近邻数量。 */
export const FOV_NEAREST_PER_FRONTIER = 3;

const EPS = 1e-9;

interface Ctx {
  /** 候选星（星等达标）在 stars 数组中的下标。 */
  candIdx: number[];
  /** 候选星编号（与 candIdx 平行）。 */
  candIds: number[];
  /** 候选星两两角距矩阵。 */
  dist: number[][];
  /** 每个候选星的视场内邻居（按下标，编号升序）。 */
  adj: number[][];
  /** margins[c][k]：候选 c 在第 k 次到达时刻的高度余量（度），k = 0..MAX_HOPS。 */
  margins: number[][];
  startC: number;
  targetC: number;
}

function buildCtx(input: PlannerInput): {
  ctx: Ctx;
  magnitudeExcludedIds: number[];
  startCandidate: boolean;
  targetCandidate: boolean;
} {
  const { stars, limitingMag, fovDeg, initialSiderealDeg, minutesPerHop, latitudeDeg, minAltitudeDeg } =
    input;
  const magnitudeExcludedIds = stars.filter((s) => s.mag > limitingMag).map((s) => s.id);
  const candIdx = stars
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.mag <= limitingMag)
    .map(({ i }) => i);
  const candIds = candIdx.map((i) => stars[i].id);

  const n = candIdx.length;
  const dist: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let a = 0; a < n; a++) {
    for (let b = a + 1; b < n; b++) {
      const d = angularDistanceDeg(stars[candIdx[a]], stars[candIdx[b]]);
      dist[a][b] = d;
      dist[b][a] = d;
    }
  }
  const adj: number[][] = Array.from({ length: n }, (_, a) =>
    Array.from({ length: n }, (_, b) => b)
      .filter((b) => b !== a && dist[a][b] <= fovDeg + EPS)
      .sort((x, y) => candIds[x] - candIds[y])
  );

  const margins: number[][] = Array.from({ length: n }, (_, c) => {
    const star = stars[candIdx[c]];
    const row: number[] = [];
    for (let k = 0; k <= MAX_HOPS; k++) {
      const lst = siderealAtDeg(initialSiderealDeg, k * minutesPerHop);
      row.push(altitudeDeg(star, lst, latitudeDeg) - minAltitudeDeg);
    }
    return row;
  });

  const startC = candIds.indexOf(input.startId);
  const targetC = candIds.indexOf(input.targetId);
  return {
    ctx: { candIdx, candIds, dist, adj, margins, startC, targetC },
    magnitudeExcludedIds,
    startCandidate: startC >= 0,
    targetCandidate: targetC >= 0
  };
}

/** 时间扩展 BFS：产出可达性与分层边界星报告。 */
function computeLayers(input: PlannerInput, ctx: Ctx): {
  layers: SearchLayerReport[];
  walkReachable: boolean;
} {
  const { candIds, dist, adj, margins, startC, targetC } = ctx;
  const n = candIds.length;
  const layers: SearchLayerReport[] = [];
  let frontier: number[] = [startC];
  let walkReachable = false;

  for (let layer = 1; layer <= MAX_HOPS; layer++) {
    if (frontier.length === 0) break;
    const next = new Set<number>();
    const boundaryMap = new Map<string, BoundaryEntry>();
    let truncated = 0;

    const pushBoundary = (entry: BoundaryEntry, better: (a: BoundaryEntry, b: BoundaryEntry) => boolean) => {
      const key = `${entry.toId}:${entry.reason}`;
      const prev = boundaryMap.get(key);
      if (!prev || better(entry, prev)) {
        boundaryMap.set(key, entry);
      }
    };

    for (const u of frontier) {
      // 视场内但高度不足的候选星
      for (const v of adj[u]) {
        if (margins[v][layer] >= -EPS) {
          next.add(v);
        } else {
          pushBoundary(
            {
              layer,
              fromId: candIds[u],
              toId: candIds[v],
              reason: "altitude",
              distanceDeg: dist[u][v],
              fovDeg: input.fovDeg,
              altDeg: margins[v][layer] + input.minAltitudeDeg,
              minAltitudeDeg: input.minAltitudeDeg,
              marginDeg: margins[v][layer]
            },
            (a, b) => (a.marginDeg ?? -Infinity) > (b.marginDeg ?? -Infinity)
          );
        }
      }
      // 超出视场的最近邻（提示“再远一点就能够到”的边界星）
      const beyond: number[] = [];
      for (let v = 0; v < n; v++) {
        if (v !== u && dist[u][v] > input.fovDeg + EPS) beyond.push(v);
      }
      beyond.sort((a, b) => dist[u][a] - dist[u][b]);
      for (const v of beyond.slice(0, FOV_NEAREST_PER_FRONTIER)) {
        pushBoundary(
          {
            layer,
            fromId: candIds[u],
            toId: candIds[v],
            reason: "fov",
            distanceDeg: dist[u][v],
            fovDeg: input.fovDeg,
            excessDeg: dist[u][v] - input.fovDeg
          },
          (a, b) => a.distanceDeg < b.distanceDeg
        );
      }
    }

    let boundary = [...boundaryMap.values()].sort(
      (a, b) => a.reason.localeCompare(b.reason) || a.toId - b.toId
    );
    if (boundary.length > BOUNDARY_CAP_PER_LAYER) {
      truncated = boundary.length - BOUNDARY_CAP_PER_LAYER;
      boundary = boundary.slice(0, BOUNDARY_CAP_PER_LAYER);
    }

    layers.push({
      layer,
      frontierIds: frontier.map((c) => candIds[c]).sort((a, b) => a - b),
      boundary,
      truncatedCount: truncated
    });

    if (next.has(targetC)) walkReachable = true;
    frontier = [...next];
  }
  return { layers, walkReachable };
}

interface Best {
  path: number[];
  margin: number;
  dist: number;
}

/** 编号序列字典序比较（a < b 返回负数）。 */
function compareIdSeq(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return a.length - b.length;
}

/**
 * 在固定跳数 n 内枚举所有简单可行路径并保留最优（分支限界）。
 * 返回是否存在可行路径；最优解写入 best。
 */
function optimizeExactDepth(ctx: Ctx, n: number): Best | null {
  const { candIds, dist, adj, margins, startC, targetC } = ctx;
  const count = candIds.length;

  // 角距下界启发：h[v][r] = 从 v 出发恰好 r 跳到目标的最小角距（忽略高度与重复约束，可采纳）。
  const INF = Number.POSITIVE_INFINITY;
  const h: number[][] = Array.from({ length: count }, () => new Array<number>(n + 1).fill(INF));
  h[targetC][0] = 0;
  for (let r = 1; r <= n; r++) {
    for (let v = 0; v < count; v++) {
      let bestH = INF;
      for (const w of adj[v]) {
        const cand = dist[v][w] + h[w][r - 1];
        if (cand < bestH) bestH = cand;
      }
      h[v][r] = bestH;
    }
  }

  // 余量上界：第 k 层所有候选的最大余量之后缀最小值。
  const layerMax = new Array<number>(n + 1).fill(-Infinity);
  for (let k = 1; k <= n; k++) {
    let m = -Infinity;
    for (let v = 0; v < count; v++) if (margins[v][k] > m) m = margins[v][k];
    layerMax[k] = m;
  }
  const suffixMin = new Array<number>(n + 2).fill(Infinity);
  for (let k = n; k >= 1; k--) suffixMin[k] = Math.min(suffixMin[k + 1], layerMax[k]);

  let best: Best | null = null;
  const visited = new Array<boolean>(count).fill(false);
  const path: number[] = [startC];
  visited[startC] = true;

  const lexGreaterThanBestPrefix = (): boolean => {
    if (!best) return false;
    for (let i = 0; i < path.length; i++) {
      const a = candIds[path[i]];
      const b = candIds[best.path[i]];
      if (a !== b) return a > b;
    }
    return false;
  };

  const dfs = (cur: number, depth: number, prefixMargin: number, prefixDist: number): void => {
    const remaining = n - depth;
    if (remaining === 0) {
      if (cur !== targetC) return;
      const cand: Best = { path: [...path], margin: prefixMargin, dist: prefixDist };
      if (!best) {
        best = cand;
        return;
      }
      if (cand.margin > best.margin + EPS) {
        best = cand;
      } else if (Math.abs(cand.margin - best.margin) <= EPS) {
        if (cand.dist < best.dist - EPS) {
          best = cand;
        } else if (Math.abs(cand.dist - best.dist) <= EPS) {
          const pa = cand.path.map((c) => candIds[c]);
          const pb = best.path.map((c) => candIds[c]);
          if (compareIdSeq(pa, pb) < 0) best = cand;
        }
      }
      return;
    }

    // 剪枝（仅当已有完整解时生效）
    if (best) {
      const marginBound = Math.min(prefixMargin, suffixMin[depth + 1]);
      if (marginBound < best.margin - EPS) return;
      const marginCanBeat = marginBound > best.margin + EPS;
      if (!marginCanBeat) {
        const distBound = prefixDist + h[cur][remaining];
        if (distBound > best.dist + EPS) return;
        const distCanBeat = distBound < best.dist - EPS;
        if (!distCanBeat && lexGreaterThanBestPrefix()) return;
      }
    }

    for (const nxt of adj[cur]) {
      if (visited[nxt]) continue;
      const m = margins[nxt][depth + 1];
      if (m < -EPS) continue; // 到达高度不足
      // 目标之外的星不必留到最后一跳才用；目标只允许在第 n 跳进入
      if (nxt === targetC && depth + 1 !== n) continue;
      visited[nxt] = true;
      path.push(nxt);
      dfs(nxt, depth + 1, Math.min(prefixMargin, m), prefixDist + dist[cur][nxt]);
      path.pop();
      visited[nxt] = false;
    }
  };

  dfs(startC, 0, margins[startC][0], 0);
  return best;
}

function buildPathResult(input: PlannerInput, ctx: Ctx, best: Best): PathResult {
  const { candIdx, candIds, dist, margins } = ctx;
  const starIds = best.path.map((c) => candIds[c]);
  const hops: HopEvidence[] = [];
  for (let k = 1; k < best.path.length; k++) {
    const from = best.path[k - 1];
    const to = best.path[k];
    const star = input.stars[candIdx[to]];
    const elapsedMin = k * input.minutesPerHop;
    const lst = siderealAtDeg(input.initialSiderealDeg, elapsedMin);
    hops.push({
      hopIndex: k,
      fromId: candIds[from],
      toId: candIds[to],
      elapsedMin,
      lstDeg: lst,
      hourAngleDeg: wrapDeltaDeg(lst - star.raDeg),
      distanceDeg: dist[from][to],
      arrivalAltDeg: margins[to][k] + input.minAltitudeDeg,
      arrivalAzDeg: azimuthDeg(star, lst, input.latitudeDeg),
      arrivalMarginDeg: margins[to][k]
    });
  }
  const startStar = input.stars[candIdx[best.path[0]]];
  return {
    status: "path",
    starIds,
    hopsCount: hops.length,
    hops,
    startAltDeg: margins[best.path[0]][0] + input.minAltitudeDeg,
    startAzDeg: azimuthDeg(startStar, input.initialSiderealDeg, input.latitudeDeg),
    startLstDeg: siderealAtDeg(input.initialSiderealDeg, 0),
    minMarginDeg: best.margin,
    totalDistanceDeg: best.dist
  };
}

function noPath(reason: string, layers: SearchLayerReport[], magnitudeExcludedIds: number[], candidateCount: number): NoPathResult {
  return { status: "no-path", reason, layers, magnitudeExcludedIds, candidateCount };
}

/** 主入口：对合法输入计算最优路径或无路报告。 */
export function planPath(input: PlannerInput): PlanResult {
  const { ctx, magnitudeExcludedIds, startCandidate, targetCandidate } = buildCtx(input);
  const candidateCount = ctx.candIds.length;

  if (!startCandidate) {
    const s = input.stars.find((s) => s.id === input.startId);
    return noPath(
      `起点星（编号 ${input.startId}）星等 ${s?.mag} 超过极限星等 ${input.limitingMag}，不可作为候选`,
      [],
      magnitudeExcludedIds,
      candidateCount
    );
  }
  if (!targetCandidate) {
    const t = input.stars.find((s) => s.id === input.targetId);
    return noPath(
      `目标星（编号 ${input.targetId}）星等 ${t?.mag} 超过极限星等 ${input.limitingMag}，不可作为候选`,
      [],
      magnitudeExcludedIds,
      candidateCount
    );
  }
  if (ctx.margins[ctx.startC][0] < -EPS) {
    const alt = ctx.margins[ctx.startC][0] + input.minAltitudeDeg;
    return noPath(
      `起点在初始恒星时的高度为 ${alt.toFixed(2)}°，低于最低高度 ${input.minAltitudeDeg}°`,
      [],
      magnitudeExcludedIds,
      candidateCount
    );
  }

  const { layers, walkReachable } = computeLayers(input, ctx);

  if (!walkReachable) {
    return noPath(
      `目标在 ${MAX_HOPS} 跳内不可达（受视场角 ${input.fovDeg}° 或最低高度 ${input.minAltitudeDeg}° 限制）`,
      layers,
      magnitudeExcludedIds,
      candidateCount
    );
  }

  // 迭代加深：跳数最少优先；固定跳数内做带剪枝的精确优化。
  for (let n = 1; n <= MAX_HOPS; n++) {
    const best = optimizeExactDepth(ctx, n);
    if (best) {
      return buildPathResult(input, ctx, best);
    }
  }

  return noPath(
    `目标在 ${MAX_HOPS} 跳内可接近，但不存在不超过 ${MAX_HOPS} 跳且不重复星点的可行路径`,
    layers,
    magnitudeExcludedIds,
    candidateCount
  );
}
