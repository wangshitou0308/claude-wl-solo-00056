import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// 构建产物为单个自包含 HTML，双击即可离线打开（file:// 无模块加载限制）。
export default defineConfig({
  base: "./",
  plugins: [react(), viteSingleFile()],
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"]
  }
});
