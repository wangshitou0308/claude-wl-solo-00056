// @vitest-environment jsdom
/**
 * App 级冒烟测试：真实挂载组件树，验证预演、废止与无路报告的渲染。
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "../App";
import { SAMPLE_JSON } from "../sample";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function render() {
  await act(async () => root.render(<App />));
}

function clickButton(text: string) {
  const btn = [...container.querySelectorAll("button")].find((b) =>
    b.textContent?.includes(text)
  );
  expect(btn, `按钮「${text}」应存在`).toBeTruthy();
  return btn!;
}

function setTextarea(value: string) {
  const ta = container.querySelector("textarea")!;
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
  setter.call(ta, value);
  ta.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("App 冒烟", () => {
  it("默认示例：预演后渲染星图与逐跳列表", async () => {
    await render();
    await act(async () => clickButton("开始预演").dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(container.textContent).toContain("预演结果");
    expect(container.textContent).toContain("第 6 跳");
    expect(container.textContent).toContain("全程最低高度余量");
    // 星图 SVG 与每跳目镜小图
    expect(container.querySelectorAll("svg").length).toBeGreaterThanOrEqual(7);
  });

  it("修改输入立即废止旧结果", async () => {
    await render();
    await act(async () => clickButton("开始预演").dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(container.textContent).toContain("预演结果");
    await act(async () => setTextarea(SAMPLE_JSON.replace('"minutesPerHop": 4', '"minutesPerHop": 5')));
    // 「逐跳预演」只出现在结果区，结果应已被废止
    expect(container.textContent).not.toContain("逐跳预演");
    expect(container.textContent).toContain("旧结果已废止");
  });

  it("非法输入整次拒绝并列出错误", async () => {
    await render();
    await act(async () => setTextarea('{"stars":[{"id":1,"raDeg":400,"decDeg":0,"mag":2}]}'));
    await act(async () => clickButton("开始预演").dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(container.textContent).toContain("整体拒绝");
    expect(container.textContent).toContain("raDeg");
  });

  it("无路时按层显示边界星", async () => {
    await render();
    const noPath = JSON.stringify({
      stars: [
        { id: 1, raDeg: 0, decDeg: 0, mag: 2 },
        { id: 2, raDeg: 30, decDeg: 0, mag: 3 }
      ],
      startId: 1,
      targetId: 2,
      latitudeDeg: 0,
      initialSiderealDeg: 0,
      fovDeg: 10,
      limitingMag: 6,
      minutesPerHop: 10,
      minAltitudeDeg: -90,
      opticsMode: "erect"
    });
    await act(async () => setTextarea(noPath));
    await act(async () => clickButton("开始预演").dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(container.textContent).toContain("未找到可行路径");
    expect(container.textContent).toContain("第 1 层");
    expect(container.textContent).toContain("超出视场");
  });
});
