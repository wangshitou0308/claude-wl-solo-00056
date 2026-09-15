/**
 * 构建可下载的证据 JSON：输入摘要 + 路径/无路报告 + 计算证据。
 */
import { SIDEREAL_RATE_DEG_PER_MIN } from "./astro";
import { MAX_HOPS } from "./search";
import type { PlanResult, PlannerInput } from "./types";

export interface EvidenceDocument {
  tool: string;
  version: string;
  generatedAt: string;
  constants: {
    siderealRateDegPerMin: number;
    maxHops: number;
    formulas: Record<string, string>;
  };
  inputSummary: {
    starCount: number;
    startId: number;
    targetId: number;
    latitudeDeg: number;
    initialSiderealDeg: number;
    fovDeg: number;
    limitingMag: number;
    minutesPerHop: number;
    minAltitudeDeg: number;
    opticsMode: string;
    stars: PlannerInput["stars"];
  };
  result: PlanResult;
}

export function buildEvidence(input: PlannerInput, result: PlanResult): EvidenceDocument {
  return {
    tool: "离线寻星路径预演台",
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    constants: {
      siderealRateDegPerMin: SIDEREAL_RATE_DEG_PER_MIN,
      maxHops: MAX_HOPS,
      formulas: {
        siderealTime: "lst(k) = (initialSiderealDeg + 0.250684 × k × minutesPerHop) mod 360",
        angularDistance: "球面 Vincenty：d = atan2(√[(cosδ₂·sinΔα)² + (cosδ₁·sinδ₂ − sinδ₁·cosδ₂·cosΔα)²], sinδ₁·sinδ₂ + cosδ₁·cosδ₂·cosΔα)",
        altitude: "sin(alt) = sinδ·sinφ + cosδ·cosφ·cosH，H = lst − ra",
        criteria: "跳数最少 → 全程最低高度余量最大 → 总角距最短 → 编号序列字典序最小"
      }
    },
    inputSummary: {
      starCount: input.stars.length,
      startId: input.startId,
      targetId: input.targetId,
      latitudeDeg: input.latitudeDeg,
      initialSiderealDeg: input.initialSiderealDeg,
      fovDeg: input.fovDeg,
      limitingMag: input.limitingMag,
      minutesPerHop: input.minutesPerHop,
      minAltitudeDeg: input.minAltitudeDeg,
      opticsMode: input.opticsMode,
      stars: input.stars
    },
    result
  };
}

export function downloadEvidence(input: PlannerInput, result: PlanResult): void {
  const doc = buildEvidence(input, result);
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  a.download = `star-hop-evidence-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
