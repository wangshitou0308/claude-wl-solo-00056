import { describe, expect, it } from "vitest";
import { buildEvidence } from "./report";
import { planPath } from "./search";
import { parseAndValidate } from "./validate";
import { SAMPLE_JSON } from "../sample";

describe("证据文档", () => {
  it("包含输入摘要、路径与计算证据", () => {
    const v = parseAndValidate(SAMPLE_JSON);
    if (!v.ok) throw new Error("sample invalid");
    const result = planPath(v.input);
    const doc = buildEvidence(v.input, result);

    expect(doc.constants.siderealRateDegPerMin).toBe(0.250684);
    expect(doc.inputSummary.starCount).toBe(12);
    expect(doc.inputSummary.stars).toHaveLength(12);
    expect(doc.result.status).toBe("path");
    if (doc.result.status === "path") {
      // 每跳都有完整证据链：时刻、时角、角距、高度、余量
      for (const h of doc.result.hops) {
        expect(h.elapsedMin).toBe(h.hopIndex * doc.inputSummary.minutesPerHop);
        expect(h.lstDeg).toBeGreaterThanOrEqual(0);
        expect(h.lstDeg).toBeLessThan(360);
        expect(h.arrivalMarginDeg).toBeCloseTo(
          h.arrivalAltDeg - doc.inputSummary.minAltitudeDeg,
          9
        );
      }
    }
    // 可序列化（下载为 JSON）
    expect(() => JSON.stringify(doc)).not.toThrow();
  });
});
