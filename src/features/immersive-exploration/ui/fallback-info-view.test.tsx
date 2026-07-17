/**
 * FallbackInfoView 测试（§12.1 / §12.2）：
 * ⑦ 五主题章节齐全 + 空间标签等价文本列表 + 重试/返回按钮；
 * 集成：SceneController.mount 失败 → FALLBACK → 等价图文页 → 重试恢复；
 * 非沉浸入口：feature flag 关闭 → 直接渲染等价图文页（standalone）。
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

/* ------------------------------- runtime 边界 mock（与 immersive-ui.test 同策略） ------------------------------- */
const runtime = vi.hoisted(() => ({
  autoAdvance: true,
  mountResult: true,
  mountCount: 0,
  disposeCount: 0,
}))

vi.mock("../runtime/scene-controller", () => ({
  SceneController: class {
    mount() {
      runtime.mountCount += 1
      return runtime.mountResult
    }
    syncState() {}
    setQuality() {}
    setReducedMotion() {}
    projectAnchor() {
      return { x: 100, y: 100 }
    }
    onFrame() {
      return () => {}
    }
    dispose() {
      runtime.disposeCount += 1
    }
  },
}))

vi.mock("../runtime/transition-controller", () => ({
  runEnterSequence: (opts: { onDone: () => void }) => {
    if (runtime.autoAdvance) opts.onDone()
    return () => {}
  },
  runArrivalObserve: (_s: unknown, _r: unknown, onDone: () => void) => {
    if (runtime.autoAdvance) onDone()
    return () => {}
  },
}))

vi.mock("../runtime/risk-controller", () => ({
  runRiskPlayback: () => () => {},
}))

import { clearImmersiveEvents, readImmersiveEvents } from "../analytics/immersive-events"
import { FallbackInfoView } from "./FallbackInfoView"
import { ImmersiveExperience } from "./ImmersiveExperience"
import { makeTestEntity, makeTestScene } from "./test-fixtures"

beforeEach(() => {
  runtime.autoAdvance = true
  runtime.mountResult = true
  runtime.mountCount = 0
  runtime.disposeCount = 0
  clearImmersiveEvents()
})

describe("⑦ FallbackInfoView 等价图文页", () => {
  it("五主题章节齐全 + 点位等价列表 + 重试/返回按钮", () => {
    const onRetry = vi.fn()
    const onReturnMap = vi.fn()
    render(
      <FallbackInfoView
        entity={makeTestEntity()}
        scene={makeTestScene()}
        errorReason="scene_mount_failed"
        onRetry={onRetry}
        onReturnMap={onReturnMap}
      />,
    )

    // 摘要 + 异常提示（不含堆栈）
    expect(screen.getByText(/测试山是一座成层火山/)).toBeTruthy()
    expect(screen.getByRole("alert").textContent).toContain("沉浸场景暂时不可用")

    // 全部五主题章节
    for (const title of ["看什么", "怎么体验", "适合谁", "注意什么", "自然观察"]) {
      expect(screen.getByRole("heading", { name: new RegExp(title) })).toBeTruthy()
    }

    // 空间标签等价文本列表（§12.1）
    expect(screen.getByRole("heading", { name: /场景点位一览/ })).toBeTruthy()
    expect(screen.getByText(/松动碎石区域/)).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: /重试进入沉浸场景/ }))
    expect(onRetry).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole("button", { name: "返回地图" }))
    expect(onReturnMap).toHaveBeenCalledTimes(1)
  })

  it("集成：场景挂载失败 → FALLBACK 等价图文页 → 重试恢复探索", async () => {
    runtime.mountResult = false
    const onExit = vi.fn()
    render(
      <ImmersiveExperience
        entity={makeTestEntity()}
        scene={makeTestScene()}
        onExit={onExit}
        reducedMotion
      />,
    )

    // mount 失败 → fatalError → FALLBACK（埋点 fallback_enter）
    await waitFor(() => expect(screen.getByTestId("ix-fallback")).toBeTruthy())
    expect(screen.getByRole("alert").textContent).toContain("scene_mount_failed")
    expect(readImmersiveEvents({ name: "fallback_enter" }).length).toBe(1)
    expect(screen.getByRole("heading", { name: /注意什么/ })).toBeTruthy()

    // 重试：场景恢复 → 重新进入并抵达探索态
    runtime.mountResult = true
    fireEvent.click(screen.getByRole("button", { name: /重试进入沉浸场景/ }))
    await waitFor(() => expect(screen.getByRole("button", { name: "景色" })).toBeTruthy())
    expect(screen.queryByTestId("ix-fallback")).toBeNull()
    expect(runtime.mountCount).toBeGreaterThanOrEqual(2)
  })

  it("非沉浸入口：feature flag 关闭 → 直接渲染等价图文页", () => {
    localStorage.setItem("atlas-immersive-exploration", "off")
    const onExit = vi.fn()
    render(
      <ImmersiveExperience
        entity={makeTestEntity()}
        scene={makeTestScene()}
        onExit={onExit}
      />,
    )

    expect(screen.getByTestId("ix-fallback")).toBeTruthy()
    expect(screen.getByText(/图文模式/)).toBeTruthy()
    expect(screen.queryByTestId("ix-theme-menu")).toBeNull()
    // standalone 模式无重试按钮
    expect(screen.queryByRole("button", { name: /重试进入沉浸场景/ })).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "返回地图" }))
    expect(onExit).toHaveBeenCalledWith("return_map")
  })
})
