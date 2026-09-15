/**
 * 全局类型定义：输入、结果与证据。
 */

/** 光学像模式：正像 / 水平镜像 / 倒像 */
export type OpticsMode = "erect" | "mirror" | "inverted";

export const OPTICS_MODES: readonly OpticsMode[] = ["erect", "mirror", "inverted"];

export const OPTICS_MODE_LABELS: Record<OpticsMode, string> = {
  erect: "正像（方向不变）",
  mirror: "水平镜像（左右翻转）",
  inverted: "倒像（旋转 180°）"
};

/** 单颗恒星的输入字段。赤经/赤纬为度制，星等为视星等。 */
export interface StarInput {
  id: number;
  raDeg: number;
  decDeg: number;
  mag: number;
}

/** 一次预演的完整输入。 */
export interface PlannerInput {
  stars: StarInput[];
  startId: number;
  targetId: number;
  latitudeDeg: number;
  initialSiderealDeg: number;
  fovDeg: number;
  limitingMag: number;
  minutesPerHop: number;
  minAltitudeDeg: number;
  opticsMode: OpticsMode;
}

/** 单跳的计算证据。 */
export interface HopEvidence {
  /** 第几跳（1 起）。 */
  hopIndex: number;
  fromId: number;
  toId: number;
  /** 到达时累计分钟数 = hopIndex × 每跳分钟数。 */
  elapsedMin: number;
  /** 到达时刻恒星时（度，已取模到 [0,360)）。 */
  lstDeg: number;
  /** 到达时刻目标的时角（度）。 */
  hourAngleDeg: number;
  /** 本跳球面角距（度）。 */
  distanceDeg: number;
  /** 到达时目标高度（度）。 */
  arrivalAltDeg: number;
  /** 到达时目标方位角（度，北起顺时针）。 */
  arrivalAzDeg: number;
  /** 高度余量 = 到达高度 − 最低高度（度）。 */
  arrivalMarginDeg: number;
}

/** 找到路径时的结果。 */
export interface PathResult {
  status: "path";
  /** 完整编号序列（含起点与目标）。 */
  starIds: number[];
  hopsCount: number;
  hops: HopEvidence[];
  /** 起点在初始恒星时的高度/方位（第 0 次到达）。 */
  startAltDeg: number;
  startAzDeg: number;
  startLstDeg: number;
  /** 全程最低高度余量（度）。 */
  minMarginDeg: number;
  /** 总角距（度）。 */
  totalDistanceDeg: number;
}

/** 无路时被排除的边界星条目。 */
export interface BoundaryEntry {
  /** 搜索层（1 起，表示从起点出发第几跳处被排除）。 */
  layer: number;
  /** 从哪颗前沿星尝试扩展。 */
  fromId: number;
  toId: number;
  reason: "altitude" | "fov";
  distanceDeg: number;
  fovDeg: number;
  /** 仅 reason=fov：角距超出视场的量（度）。 */
  excessDeg?: number;
  /** 仅 reason=altitude：到达高度、最低高度与余量（度）。 */
  altDeg?: number;
  minAltitudeDeg?: number;
  marginDeg?: number;
}

export interface SearchLayerReport {
  layer: number;
  /** 该层出发时所在的前沿星编号。 */
  frontierIds: number[];
  boundary: BoundaryEntry[];
  /** 因条目过多被截断的数量（证据 JSON 中同样截断，见 CAP 常量）。 */
  truncatedCount: number;
}

/** 无路时的结果。 */
export interface NoPathResult {
  status: "no-path";
  /** 人类可读的失败概述。 */
  reason: string;
  layers: SearchLayerReport[];
  /** 星等超限而被整体排除的恒星编号。 */
  magnitudeExcludedIds: number[];
  /** 参与搜索的候选星数量（星等达标）。 */
  candidateCount: number;
}

export type PlanResult = PathResult | NoPathResult;

/** 校验错误：任何一条都会导致整次拒绝。 */
export interface ValidationError {
  path: string;
  message: string;
}
