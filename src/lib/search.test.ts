import { describe, expect, it } from "vitest";
import { planPath } from "./search";
import { parseAndValidate } from "./validate";
import { SAMPLE_JSON } from "../sample";
import type { PlannerInput, StarInput } from "./types";

const star = (id: number, raDeg: number, decDeg: number, mag = 3): StarInput => ({
  id,
  raDeg,
  decDeg,
  mag
});

function makeInput(partial: Partial<PlannerInput> & { stars: StarInput[] }): PlannerInput {
  return {
    startId: 1,
    targetId: 2,
    latitudeDeg: 0,
    initialSiderealDeg: 0,
    fovDeg: 5,
    limitingMag: 6,
    minutesPerHop: 10,
    minAltitudeDeg: -90,
    opticsMode: "inverted",
    ...partial
  };
}

describe("planPath 基本寻路", () => {
  it("内置示例：6 跳链 1→…→7", () => {
    const v = parseAndValidate(SAMPLE_JSON);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const r = planPath(v.input);
    expect(r.status).toBe("path");
    if (r.status !== "path") return;
    expect(r.hopsCount).toBe(6);
    expect(r.starIds).toEqual([1, 2, 3, 4, 5, 6, 7]);
    // 第 1 跳到达恒星时 = 125 + 0.250684×4
    expect(r.hops[0].lstDeg).toBeCloseTo(125 + 0.250684 * 4, 9);
    expect(r.hops[0].elapsedMin).toBe(4);
    // 每跳角距都不超过视场，到达高度都不低于最低高度
    for (const h of r.hops) {
      expect(h.distanceDeg).toBeLessThanOrEqual(v.input.fovDeg + 1e-9);
      expect(h.arrivalAltDeg).toBeGreaterThanOrEqual(v.input.minAltitudeDeg - 1e-9);
    }
    // 总角距等于各跳之和
    expect(r.totalDistanceDeg).toBeCloseTo(r.hops.reduce((a, h) => a + h.distanceDeg, 0), 12);
  });

  it("跳数最少优先：能 1 跳直达就不走 2 跳", () => {
    const input = makeInput({
      stars: [star(1, 0, 0), star(2, 3, 0), star(3, 6, 0)],
      targetId: 3,
      fovDeg: 7
    });
    const r = planPath(input);
    expect(r.status).toBe("path");
    if (r.status !== "path") return;
    expect(r.hopsCount).toBe(1);
    expect(r.starIds).toEqual([1, 3]);
    expect(r.totalDistanceDeg).toBeCloseTo(6, 6);
  });

  it("全程最低高度余量最大优先于总角距最短", () => {
    // 纬度 40°，lst 每跳推进 30.082°：
    // 经星 2（短但低，高度 ≈69.3°，总角距 ≈46.0°）
    // 经星 3（长但高，高度 ≈75.1°，总角距 ≈50.4°）→ 应选星 3
    const input = makeInput({
      stars: [star(1, 0, 40), star(2, 3, 40), star(3, 30, 55), star(4, 60, 40)],
      targetId: 4,
      latitudeDeg: 40,
      fovDeg: 45,
      minutesPerHop: 120,
      minAltitudeDeg: 0
    });
    const r = planPath(input);
    expect(r.status).toBe("path");
    if (r.status !== "path") return;
    expect(r.starIds).toEqual([1, 3, 4]);
    // 星 3（赤纬 55°、纬度 40°）过中天附近，最低余量 ≈ 75°
    expect(r.minMarginDeg).toBeCloseTo(75.0, 1);
  });

  it("余量相同则总角距最短优先", () => {
    // 目标高度（≈89.01°）压低两条路径的最低余量，使其相等；角距短的经星 2 胜出
    const input = makeInput({
      stars: [star(1, 0, 0), star(2, 3, 0), star(5, 3, 0.5), star(3, 6, 0)],
      targetId: 3,
      fovDeg: 4
    });
    const r = planPath(input);
    expect(r.status).toBe("path");
    if (r.status !== "path") return;
    expect(r.starIds).toEqual([1, 2, 3]);
    expect(r.totalDistanceDeg).toBeCloseTo(6, 6);
  });

  it("余量与角距都相同则编号序列字典序最小优先", () => {
    // 星 2 与星 5 关于赤道对称，角距与高度完全相同
    const input = makeInput({
      stars: [star(1, 0, 0), star(2, 3, 0.5), star(5, 3, -0.5), star(3, 6, 0)],
      targetId: 3,
      fovDeg: 4
    });
    const r = planPath(input);
    expect(r.status).toBe("path");
    if (r.status !== "path") return;
    expect(r.starIds).toEqual([1, 2, 3]);
  });

  it("路径不重复星点", () => {
    const input = makeInput({
      stars: [star(1, 0, 0), star(2, 3, 0), star(3, 6, 0), star(4, 9, 0)],
      targetId: 4,
      fovDeg: 4
    });
    const r = planPath(input);
    expect(r.status).toBe("path");
    if (r.status !== "path") return;
    expect(new Set(r.starIds).size).toBe(r.starIds.length);
  });
});

describe("planPath 约束与无路报告", () => {
  it("最多 8 跳：需要 9 跳的链判定无路", () => {
    const stars = Array.from({ length: 10 }, (_, i) => star(i + 1, i * 3, 0));
    const input = makeInput({ stars, targetId: 10, fovDeg: 4 });
    const r = planPath(input);
    expect(r.status).toBe("no-path");
    if (r.status !== "no-path") return;
    expect(r.reason).toContain("8");
    expect(r.layers.length).toBe(8);
    // 每层都有因视场被排除的边界星
    expect(r.layers[0].boundary.some((b) => b.reason === "fov")).toBe(true);
  });

  it("高度不足：边界星按层列出且原因为 altitude", () => {
    const input = makeInput({
      stars: [star(1, 0, 0), star(2, 40, 0)],
      fovDeg: 50,
      minAltitudeDeg: 60
    });
    const r = planPath(input);
    expect(r.status).toBe("no-path");
    if (r.status !== "no-path") return;
    const b = r.layers[0].boundary.find((x) => x.toId === 2);
    expect(b?.reason).toBe("altitude");
    expect(b?.altDeg).toBeCloseTo(52.5, 0);
  });

  it("超出视场：边界星原因为 fov 并给出超出量", () => {
    const input = makeInput({
      stars: [star(1, 0, 0), star(2, 30, 0)],
      fovDeg: 10
    });
    const r = planPath(input);
    expect(r.status).toBe("no-path");
    if (r.status !== "no-path") return;
    const b = r.layers[0].boundary.find((x) => x.toId === 2);
    expect(b?.reason).toBe("fov");
    expect(b?.excessDeg).toBeCloseTo(20, 6);
  });

  it("星点随时间落低：第 2 层目标高度不足", () => {
    const input = makeInput({
      stars: [star(1, 0, 0), star(2, 3, 0), star(3, 6, 0)],
      targetId: 3,
      fovDeg: 4,
      minutesPerHop: 300,
      minAltitudeDeg: 10
    });
    const r = planPath(input);
    expect(r.status).toBe("no-path");
    if (r.status !== "no-path") return;
    expect(r.layers.length).toBe(2);
    const b = r.layers[1].boundary.find((x) => x.toId === 3);
    expect(b?.reason).toBe("altitude");
    expect(b?.altDeg!).toBeLessThan(10);
  });

  it("目标星等超限：整次无路并列入星等排除表", () => {
    const input = makeInput({
      stars: [star(1, 0, 0), star(2, 3, 0, 7)],
      fovDeg: 5
    });
    const r = planPath(input);
    expect(r.status).toBe("no-path");
    if (r.status !== "no-path") return;
    expect(r.reason).toContain("目标星");
    expect(r.magnitudeExcludedIds).toContain(2);
  });

  it("起点高度低于最低高度：无路", () => {
    const input = makeInput({
      stars: [star(1, 50, 0), star(2, 53, 0)],
      minAltitudeDeg: 60
    });
    const r = planPath(input);
    expect(r.status).toBe("no-path");
    if (r.status !== "no-path") return;
    expect(r.reason).toContain("起点");
  });

  it("不返回半条路线：无路结果不含 hops", () => {
    const input = makeInput({
      stars: [star(1, 0, 0), star(2, 30, 0)],
      fovDeg: 10
    });
    const r = planPath(input);
    expect(r.status).toBe("no-path");
    expect("hops" in r).toBe(false);
  });
});
