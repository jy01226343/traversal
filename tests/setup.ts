// Vitest 全局 setup：提供 localStorage / window mock 给依赖浏览器的纯函数模块。
// jsdom 已内置 window/localStorage，这里仅做兜底与清理。
import { afterEach } from "vitest"

afterEach(() => {
  // 每个测试后清空 localStorage，避免测试间状态泄漏
  localStorage.clear()
})
