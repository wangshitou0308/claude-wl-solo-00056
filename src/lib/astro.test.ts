import { describe, expect, it } from "vitest";
import {
  SIDEREAL_RATE_DEG_PER_MIN,
  altitudeDeg,
  angularDistanceDeg,
  azimuthDeg,
  formatSiderealHms,
  normalizeDeg360,
  siderealAtDeg,
  wrapDeltaDeg
} from "./astro";

describe("astro", () => {
  it("恒星时按 0.250684°/min 推进并取模", () => {
    expect(siderealAtDeg(100, 60)).toBeCloseTo(100 + 0.250684 * 60, 10);
    expect(siderealAtDeg(350, 60)).toBeCloseTo(350 + 0.250684 * 60 - 360, 10);
    expect(siderealAtDeg(10, 60 * 24 * 10)).toBeGreaterThanOrEqual(0);
    expect(siderealAtDeg(10, 60 * 24 * 10)).toBeLessThan(360);
    expect(SIDEREAL_RATE_DEG_PER_MIN).toBe(0.250684);
  });

  it("角度归一化", () => {
    expect(normalizeDeg360(-10)).toBe(350);
    expect(normalizeDeg360(360)).toBe(0);
    expect(wrapDeltaDeg(190)).toBe(-170);
    expect(wrapDeltaDeg(-190)).toBe(170);
  });

  it("球面角距：同一颗星为 0，两极之间为 180", () => {
    expect(angularDistanceDeg({ raDeg: 10, decDeg: 20 }, { raDeg: 10, decDeg: 20 })).toBeCloseTo(0, 10);
    expect(
      angularDistanceDeg({ raDeg: 0, decDeg: -90 }, { raDeg: 123, decDeg: 90 })
    ).toBeCloseTo(180, 10);
    // 赤道上相差 90° 赤经
    expect(angularDistanceDeg({ raDeg: 0, decDeg: 0 }, { raDeg: 90, decDeg: 0 })).toBeCloseTo(90, 10);
    // 小角距精度：赤纬 60° 处赤经差 1° ≈ 0.5°
    expect(
      angularDistanceDeg({ raDeg: 100, decDeg: 60 }, { raDeg: 101, decDeg: 60 })
    ).toBeCloseTo(0.5, 2);
  });

  it("高度：赤纬等于纬度且过子午线时在天顶", () => {
    // asin 在 90° 附近导数极大，浮点误差放大，放宽到 1e-5°（约 0.04 角秒）
    expect(altitudeDeg({ raDeg: 50, decDeg: 40 }, 50, 40)).toBeCloseTo(90, 5);
    // 恒星在东升西落：时角 ±90° 且赤纬 0、纬度 0 时高度 0
    expect(altitudeDeg({ raDeg: 0, decDeg: 0 }, 90, 0)).toBeCloseTo(0, 8);
    // 北极星在北极天顶
    expect(altitudeDeg({ raDeg: 0, decDeg: 90 }, 0, 90)).toBeCloseTo(90, 5);
  });

  it("方位角：南中天恒星方位 180°", () => {
    expect(azimuthDeg({ raDeg: 100, decDeg: 20 }, 100, 40)).toBeCloseTo(180, 6);
  });

  it("恒星时格式化", () => {
    expect(formatSiderealHms(0)).toBe("00:00:00");
    expect(formatSiderealHms(15)).toBe("01:00:00");
    expect(formatSiderealHms(359.9)).toBe("23:59:36");
  });
});
