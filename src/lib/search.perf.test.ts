import { describe, expect, it } from "vitest";
import { planPath } from "./search";
import type { PlannerInput, StarInput } from "./types";

/** 稠密星场（8 邻接网格）下的性能与正确性冒烟。 */
describe("planPath 性能冒烟", () => {
  it("40 星 8 邻接网格：5 跳内完成且结果最优", () => {
    // 8×5 网格，间距 4°，视场 6°（可达 8 邻接），起点角落、目标对角
    const stars: StarInput[] = [];
    let id = 1;
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 8; col++) {
        stars.push({ id: id++, raDeg: col * 4, decDeg: row * 4, mag: 4 });
      }
    }
    const input: PlannerInput = {
      stars,
      startId: 1,
      targetId: 40,
      latitudeDeg: 0,
      initialSiderealDeg: 0,
      fovDeg: 6,
      limitingMag: 6,
      minutesPerHop: 5,
      minAltitudeDeg: -90,
      opticsMode: "erect"
    };
    const t0 = performance.now();
    const r = planPath(input);
    const ms = performance.now() - t0;
    expect(r.status).toBe("path");
    if (r.status !== "path") return;
    // 对角 (28°, 16°)：每跳最多前进 1 列（8° > 6° 视场），7 列 ⇒ 恰好 7 跳
    expect(r.hopsCount).toBe(7);
    expect(ms).toBeLessThan(5000);
  }, 10000);

  it("120 星满表：构建与搜索在可接受时间内完成", () => {
    // 确定性伪随机（mulberry32）生成 120 星
    let seed = 42;
    const rand = () => {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const stars: StarInput[] = Array.from({ length: 120 }, (_, i) => ({
      id: i + 1,
      raDeg: rand() * 360,
      decDeg: rand() * 120 - 60,
      mag: 1 + rand() * 6
    }));
    const input: PlannerInput = {
      stars,
      startId: 1,
      targetId: 120,
      latitudeDeg: 35,
      initialSiderealDeg: 200,
      fovDeg: 15,
      limitingMag: 6.5,
      minutesPerHop: 6,
      minAltitudeDeg: -30,
      opticsMode: "mirror"
    };
    const t0 = performance.now();
    const r = planPath(input);
    const ms = performance.now() - t0;
    expect(["path", "no-path"]).toContain(r.status);
    if (r.status === "path") expect(r.hopsCount).toBeLessThanOrEqual(8);
    expect(ms).toBeLessThan(5000);
  }, 10000);
});
