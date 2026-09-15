/**
 * 光学像变换：把星图（天球）上的位移向量变换为目镜中看到的表观方向。
 * 约定：星图 x 轴向东（赤经增大）在左、y 轴向北在上（常规星图方位）。
 */
import type { OpticsMode } from "./types";

export interface Vec2 {
  x: number;
  y: number;
}

/** 对位移向量应用光学变换。 */
export function transformVector(mode: OpticsMode, v: Vec2): Vec2 {
  switch (mode) {
    case "erect":
      return { x: v.x, y: v.y };
    case "mirror":
      // 水平镜像：左右翻转
      return { x: -v.x, y: v.y };
    case "inverted":
      // 倒像：旋转 180°，等效上下左右皆反
      return { x: -v.x, y: -v.y };
  }
}

export const OPTICS_DESCRIPTIONS: Record<OpticsMode, string> = {
  erect: "正像：目镜中移动方向与星图一致",
  mirror: "水平镜像：目镜中左右方向与星图相反，上下一致",
  inverted: "倒像：目镜中上下左右均与星图相反（旋转 180°）"
};
