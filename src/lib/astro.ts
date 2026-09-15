/**
 * 天文计算核心：球面角距、恒星时推进、赤道坐标转地平坐标。
 * 全部使用度制输入，内部转弧度计算。
 */

/** 恒星时相对累计分钟的推进速率（度/分钟）。 */
export const SIDEREAL_RATE_DEG_PER_MIN = 0.250684;

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

export function toRad(deg: number): number {
  return deg * DEG2RAD;
}

export function toDeg(rad: number): number {
  return rad * RAD2DEG;
}

/** 归一化角度到 [0, 360)。 */
export function normalizeDeg360(deg: number): number {
  const m = deg % 360;
  return m < 0 ? m + 360 : m;
}

/** 归一化角度差到 (-180, 180]。 */
export function wrapDeltaDeg(deg: number): number {
  return normalizeDeg360(deg + 180) - 180;
}

/**
 * 第 k 次到达时的恒星时：初值 + 0.250684 × 累计分钟，取模 360。
 * @param initialSiderealDeg 初始恒星时（度）
 * @param elapsedMin 累计分钟数
 */
export function siderealAtDeg(initialSiderealDeg: number, elapsedMin: number): number {
  return normalizeDeg360(initialSiderealDeg + SIDEREAL_RATE_DEG_PER_MIN * elapsedMin);
}

export interface Equatorial {
  raDeg: number;
  decDeg: number;
}

/**
 * 球面角距（度）。采用球面 Vincenty 公式（atan2 形式），
 * 对零距离与对跖点附近都数值稳定。
 */
export function angularDistanceDeg(a: Equatorial, b: Equatorial): number {
  const d1 = toRad(a.decDeg);
  const d2 = toRad(b.decDeg);
  const dRa = toRad(b.raDeg - a.raDeg);
  const sd1 = Math.sin(d1);
  const cd1 = Math.cos(d1);
  const sd2 = Math.sin(d2);
  const cd2 = Math.cos(d2);
  const cDRa = Math.cos(dRa);
  const sDRa = Math.sin(dRa);
  const num = Math.hypot(cd2 * sDRa, cd1 * sd2 - sd1 * cd2 * cDRa);
  const den = sd1 * sd2 + cd1 * cd2 * cDRa;
  return toDeg(Math.atan2(num, den));
}

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

/**
 * 赤道坐标转地平高度（度）。
 * sin(alt) = sinδ·sinφ + cosδ·cosφ·cosH，H = 恒星时 − 赤经。
 */
export function altitudeDeg(star: Equatorial, lstDeg: number, latitudeDeg: number): number {
  const H = toRad(lstDeg - star.raDeg);
  const dec = toRad(star.decDeg);
  const lat = toRad(latitudeDeg);
  const sinAlt =
    Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(H);
  return toDeg(Math.asin(clamp(sinAlt, -1, 1)));
}

/**
 * 赤道坐标转地平方位角（度，北起顺时针 0–360）。
 * 先按 Meeus 形式求南起方位，再 +180° 归一到北起。
 */
export function azimuthDeg(star: Equatorial, lstDeg: number, latitudeDeg: number): number {
  const H = toRad(lstDeg - star.raDeg);
  const dec = toRad(star.decDeg);
  const lat = toRad(latitudeDeg);
  const y = Math.sin(H);
  const x = Math.cos(H) * Math.sin(lat) - Math.tan(dec) * Math.cos(lat);
  return normalizeDeg360(toDeg(Math.atan2(y, x)) + 180);
}

/** 把度制恒星时格式化为 h:mm:ss（1 小时 = 15 度）。 */
export function formatSiderealHms(lstDeg: number): string {
  const totalSeconds = Math.round(normalizeDeg360(lstDeg) * 240); // 360° = 86400 s
  const h = Math.floor(totalSeconds / 3600) % 24;
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
