import { describe, expect, it } from "vitest";
import { transformVector } from "./optics";

describe("optics 光学变换", () => {
  const v = { x: 2, y: 3 };
  it("正像不变", () => {
    expect(transformVector("erect", v)).toEqual({ x: 2, y: 3 });
  });
  it("水平镜像左右翻转", () => {
    expect(transformVector("mirror", v)).toEqual({ x: -2, y: 3 });
  });
  it("倒像旋转 180°", () => {
    expect(transformVector("inverted", v)).toEqual({ x: -2, y: -3 });
  });
});
