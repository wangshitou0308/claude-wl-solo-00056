/**
 * 输入校验：对导入的 JSON 做严格检查。
 * 任何坐标或引用非法都会收集为错误并导致整次拒绝，绝不用部分数据继续计算。
 */
import { OPTICS_MODES, type OpticsMode, type PlannerInput, type StarInput, type ValidationError } from "./types";

export const MIN_STARS = 2;
export const MAX_STARS = 120;

interface CheckOk {
  ok: true;
  input: PlannerInput;
}

interface CheckFail {
  ok: false;
  errors: ValidationError[];
}

export type ValidationOutcome = CheckOk | CheckFail;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function checkRange(
  errors: ValidationError[],
  path: string,
  value: unknown,
  min: number,
  max: number,
  minExclusive = false
): value is number {
  if (!isFiniteNumber(value)) {
    errors.push({ path, message: `必须是有限数字，实际为 ${JSON.stringify(value)}` });
    return false;
  }
  const below = minExclusive ? value <= min : value < min;
  if (below || value > max) {
    const lo = minExclusive ? `(${min}` : `[${min}`;
    errors.push({ path, message: `取值 ${value} 超出范围 ${lo}, ${max}]` });
    return false;
  }
  return true;
}

function parseStar(raw: unknown, index: number, errors: ValidationError[]): StarInput | null {
  const path = `stars[${index}]`;
  if (!isRecord(raw)) {
    errors.push({ path, message: "恒星条目必须是对象" });
    return null;
  }
  let ok = true;
  const id = raw.id;
  if (typeof id !== "number" || !Number.isInteger(id)) {
    errors.push({ path: `${path}.id`, message: "编号必须是整数" });
    ok = false;
  }
  const raDeg = raw.raDeg;
  if (!checkRange(errors, `${path}.raDeg`, raDeg, 0, 360)) {
    ok = false;
  } else if (raDeg === 360) {
    errors.push({ path: `${path}.raDeg`, message: "赤经须满足 0 ≤ ra < 360（360 请写作 0）" });
    ok = false;
  }
  const decDeg = raw.decDeg;
  if (!checkRange(errors, `${path}.decDeg`, decDeg, -90, 90)) {
    ok = false;
  }
  const mag = raw.mag;
  if (!isFiniteNumber(mag)) {
    errors.push({ path: `${path}.mag`, message: "星等必须是有限数字" });
    ok = false;
  }
  if (!ok) return null;
  return { id: id as number, raDeg: raDeg as number, decDeg: decDeg as number, mag: mag as number };
}

/**
 * 校验已解析的 JSON 值。返回完整输入或全部错误列表。
 */
export function validatePlannerInput(raw: unknown): ValidationOutcome {
  const errors: ValidationError[] = [];
  if (!isRecord(raw)) {
    return { ok: false, errors: [{ path: "$", message: "根节点必须是 JSON 对象" }] };
  }

  // --- 恒星表 ---
  let stars: StarInput[] = [];
  const rawStars = raw.stars;
  if (!Array.isArray(rawStars)) {
    errors.push({ path: "stars", message: "必须是数组" });
  } else {
    if (rawStars.length < MIN_STARS || rawStars.length > MAX_STARS) {
      errors.push({
        path: "stars",
        message: `恒星数量须为 ${MIN_STARS}～${MAX_STARS}，实际为 ${rawStars.length}`
      });
    }
    const seen = new Set<number>();
    stars = rawStars
      .map((s, i) => parseStar(s, i, errors))
      .filter((s): s is StarInput => s !== null);
    for (const s of stars) {
      if (seen.has(s.id)) {
        errors.push({ path: "stars", message: `编号 ${s.id} 重复，编号必须唯一` });
      }
      seen.add(s.id);
    }
  }

  // --- 标量字段 ---
  const startId = raw.startId;
  if (typeof startId !== "number" || !Number.isInteger(startId)) {
    errors.push({ path: "startId", message: "起点编号必须是整数" });
  }
  const targetId = raw.targetId;
  if (typeof targetId !== "number" || !Number.isInteger(targetId)) {
    errors.push({ path: "targetId", message: "目标编号必须是整数" });
  }

  const latitudeDeg = raw.latitudeDeg;
  checkRange(errors, "latitudeDeg", latitudeDeg, -90, 90);
  const initialSiderealDeg = raw.initialSiderealDeg;
  checkRange(errors, "initialSiderealDeg", initialSiderealDeg, 0, 360);
  const fovDeg = raw.fovDeg;
  checkRange(errors, "fovDeg", fovDeg, 0, 180, true);
  const limitingMag = raw.limitingMag;
  if (!isFiniteNumber(limitingMag)) {
    errors.push({ path: "limitingMag", message: "极限星等必须是有限数字" });
  }
  const minutesPerHop = raw.minutesPerHop;
  if (!isFiniteNumber(minutesPerHop) || minutesPerHop <= 0) {
    errors.push({ path: "minutesPerHop", message: "每跳分钟数必须是正数" });
  }
  const minAltitudeDeg = raw.minAltitudeDeg;
  checkRange(errors, "minAltitudeDeg", minAltitudeDeg, -90, 90);

  const opticsMode = raw.opticsMode;
  if (typeof opticsMode !== "string" || !OPTICS_MODES.includes(opticsMode as OpticsMode)) {
    errors.push({
      path: "opticsMode",
      message: `必须是 ${OPTICS_MODES.map((m) => `"${m}"`).join(" / ")} 之一`
    });
  }

  // --- 引用完整性（仅在编号本身合法时检查） ---
  if (errors.length === 0) {
    const ids = new Set(stars.map((s) => s.id));
    if (!ids.has(startId as number)) {
      errors.push({ path: "startId", message: `起点编号 ${startId} 在恒星表中不存在` });
    }
    if (!ids.has(targetId as number)) {
      errors.push({ path: "targetId", message: `目标编号 ${targetId} 在恒星表中不存在` });
    }
    if (startId === targetId) {
      errors.push({ path: "targetId", message: "起点与目标不能是同一颗恒星" });
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    input: {
      stars,
      startId: startId as number,
      targetId: targetId as number,
      latitudeDeg: latitudeDeg as number,
      initialSiderealDeg: initialSiderealDeg as number,
      fovDeg: fovDeg as number,
      limitingMag: limitingMag as number,
      minutesPerHop: minutesPerHop as number,
      minAltitudeDeg: minAltitudeDeg as number,
      opticsMode: opticsMode as OpticsMode
    }
  };
}

/** 解析 JSON 文本并校验；解析失败同样整次拒绝。 */
export function parseAndValidate(text: string): ValidationOutcome {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return {
      ok: false,
      errors: [{ path: "$", message: `JSON 解析失败：${e instanceof Error ? e.message : String(e)}` }]
    };
  }
  return validatePlannerInput(raw);
}
