import { describe, expect, it } from "vitest";
import { parseAndValidate, validatePlannerInput } from "./validate";

function validRaw() {
  return {
    stars: [
      { id: 1, raDeg: 10, decDeg: 20, mag: 2 },
      { id: 2, raDeg: 14, decDeg: 21, mag: 3 },
      { id: 3, raDeg: 18, decDeg: 20, mag: 4 }
    ],
    startId: 1,
    targetId: 3,
    latitudeDeg: 40,
    initialSiderealDeg: 100,
    fovDeg: 5,
    limitingMag: 6,
    minutesPerHop: 4,
    minAltitudeDeg: 10,
    opticsMode: "inverted"
  };
}

describe("validate", () => {
  it("合法输入通过", () => {
    const r = validatePlannerInput(validRaw());
    expect(r.ok).toBe(true);
  });

  it("JSON 解析失败整次拒绝", () => {
    const r = parseAndValidate("{ not json");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0].path).toBe("$");
  });

  it("坐标越界整次拒绝", () => {
    const bad = validRaw();
    bad.stars[0].raDeg = 360;
    const r = validatePlannerInput(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.path.includes("raDeg"))).toBe(true);

    const bad2 = validRaw();
    bad2.stars[1].decDeg = -91;
    expect(validatePlannerInput(bad2).ok).toBe(false);
  });

  it("编号重复整次拒绝", () => {
    const bad = validRaw();
    bad.stars[1].id = 1;
    const r = validatePlannerInput(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.message.includes("重复"))).toBe(true);
  });

  it("引用不存在的编号整次拒绝", () => {
    const bad = validRaw();
    bad.targetId = 99;
    const r = validatePlannerInput(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.path === "targetId")).toBe(true);
  });

  it("起点目标相同整次拒绝", () => {
    const bad = validRaw();
    bad.targetId = 1;
    expect(validatePlannerInput(bad).ok).toBe(false);
  });

  it("恒星数量限制：2～120", () => {
    const one = validRaw();
    one.stars = one.stars.slice(0, 1);
    expect(validatePlannerInput(one).ok).toBe(false);

    const many = validRaw();
    many.stars = Array.from({ length: 121 }, (_, i) => ({
      id: i + 1,
      raDeg: (i * 3) % 360,
      decDeg: ((i * 7) % 170) - 85,
      mag: 5
    }));
    many.startId = 1;
    many.targetId = 121;
    const r = validatePlannerInput(many);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.message.includes("2～120"))).toBe(true);
  });

  it("非法光学模式与非法数值整次拒绝", () => {
    const bad = validRaw();
    (bad as Record<string, unknown>).opticsMode = "diagonal";
    expect(validatePlannerInput(bad).ok).toBe(false);

    const bad2 = validRaw();
    bad2.minutesPerHop = 0;
    expect(validatePlannerInput(bad2).ok).toBe(false);

    const bad3 = validRaw();
    bad3.fovDeg = 0;
    expect(validatePlannerInput(bad3).ok).toBe(false);

    const bad4 = validRaw();
    (bad4 as Record<string, unknown>).latitudeDeg = "40";
    expect(validatePlannerInput(bad4).ok).toBe(false);
  });

  it("多处错误一次性全部列出", () => {
    const bad = validRaw();
    bad.stars[0].raDeg = -5;
    bad.latitudeDeg = 200;
    (bad as Record<string, unknown>).opticsMode = "x";
    const r = validatePlannerInput(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.length).toBeGreaterThanOrEqual(3);
  });
});
