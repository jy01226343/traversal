/**
 * 沉浸式探索 UI 层测试（RTL + jsdom）
 *
 * 策略：
 * - 真实 CORE：ImmersiveStoreProvider/useImmersiveStore（含真实状态机与埋点）、
 *   selectVisibleAnchors/selectDimmedAnchorIds、buildTravelDecisionSummary、
 *   resolveThemePanel、useAnchorPositions —— 全链路集成；
 * - mock 仅三个 runtime 边界：SceneController（jsdom 无 WebGL）、
 *   transition-controller（节拍计时可控化）、risk-controller（步进可控化）；
 * - 事件分发断言通过真实埋点缓冲 readImmersiveEvents 完成。
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ComponentProps } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

/* ------------------------------- runtime 边界 mock（可控、确定性） ------------------------------- */
const runtime = vi.hoisted(() => ({
  autoAdvance: true,
  mountResult: true,
  riskOnStep: null as null | ((nextIndex: number) => void),
  enterOpts: null as null | {
    onBeat?: (beat: string, index: number) => void
    onDone: () => void
  },
  syncStatuses: [] as string[],
  mountCount: 0,
  disposeCount: 0,
}))

vi.mock("../runtime/scene-controller", () => ({
  SceneController: class {
    mount() {
      runtime.mountCount += 1
      return runtime.mountResult
    }
    syncState(state: { status: string }) {
      runtime.syncStatuses.push(state.status)
    }
    setQuality() {}
    setReducedMotion() {}
    /** 依据 positionRef 生成确定性屏幕坐标（供真实 useAnchorPositions 消费，键为 positionRef） */
    projectAnchor(positionRef: string) {
      let hash = 0
      for (let i = 0; i < positionRef.length; i++) hash = (hash * 31 + positionRef.charCodeAt(i)) % 997
      return { x: 120 + (hash % 5) * 130, y: 140 + (hash % 3) * 90 }
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
  runEnterSequence: (opts: typeof runtime.enterOpts) => {
    runtime.enterOpts = opts
    if (runtime.autoAdvance) opts?.onDone()
    return () => {}
  },
  runArrivalObserve: (_scene: unknown, _reducedMotion: unknown, onDone: () => void) => {
    if (runtime.autoAdvance) onDone()
    return () => {}
  },
}))

vi.mock("../runtime/risk-controller", () => ({
  runRiskPlayback: (opts: { onStep: (nextIndex: number) => void }) => {
    runtime.riskOnStep = opts.onStep
    return () => {}
  },
}))

/* ----------------------------------------------- 真实模块 ----------------------------------------------- */
import { clearImmersiveEvents, readImmersiveEvents } from "../analytics/immersive-events"
import { ImmersiveExperience } from "./ImmersiveExperience"
import { makeLiveSnapshot, makeTestEntity, makeTestScene } from "./test-fixtures"

type ExperienceProps = ComponentProps<typeof ImmersiveExperience>

function renderExperience(props: Partial<ExperienceProps> = {}) {
  const onExit = vi.fn()
  const utils = render(
    <ImmersiveExperience
      entity={makeTestEntity()}
      scene={makeTestScene()}
      onExit={onExit}
      {...props}
    />,
  )
  return { onExit, ...utils }
}

/** 进入 cautions 主题并启动风险演示 */
function startRiskDemo() {
  fireEvent.click(screen.getByRole("button", { name: "注意什么" }))
  fireEvent.click(screen.getByRole("button", { name: /开始演示/ }))
}

beforeEach(() => {
  runtime.autoAdvance = true
  runtime.mountResult = true
  runtime.riskOnStep = null
  runtime.enterOpts = null
  runtime.syncStatuses = []
  runtime.mountCount = 0
  runtime.disposeCount = 0
  clearImmersiveEvents()
})

describe("ImmersiveExperience 全链路", () => {
  it("① 单主题激活：同一时间只有一个主题处于激活态", () => {
    renderExperience()
    const highlights = screen.getByRole("button", { name: "景色" })
    const experience = screen.getByRole("button", { name: "怎么玩" })

    // V1.2：简介结束后自动展开首个主题（景色），页面不再空白
    expect(highlights.getAttribute("aria-pressed")).toBe("true")
    expect(screen.getByTestId("ix-info-panel").getAttribute("data-kind")).toBe("presets")

    fireEvent.click(experience)
    expect(experience.getAttribute("aria-pressed")).toBe("true")
    expect(highlights.getAttribute("aria-pressed")).toBe("false")
    expect(screen.getByTestId("ix-info-panel").getAttribute("data-kind")).toBe("activities")

    // 再次点击当前主题 → 清除主题回探索态
    fireEvent.click(experience)
    expect(experience.getAttribute("aria-pressed")).toBe("false")
    expect(screen.queryByTestId("ix-info-panel")).toBeNull()
  })

  it("② 切换主题清理：风险演示中切到景色 → 风险 UI 消失", () => {
    renderExperience()
    startRiskDemo()
    expect(screen.getByTestId("ix-risk-controls")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "景色" }))
    expect(screen.queryByTestId("ix-risk-controls")).toBeNull()
    expect(screen.getByTestId("ix-info-panel").getAttribute("data-kind")).toBe("presets")
    expect(screen.getByRole("button", { name: /秋季晴景/ })).toBeTruthy()
    expect(screen.queryByRole("button", { name: /开始演示/ })).toBeNull()
  })

  it("③ 风险触发入口只在 cautions 主题出现", () => {
    renderExperience()
    expect(screen.queryByRole("button", { name: /开始演示/ })).toBeNull()

    for (const tab of ["景色", "怎么玩", "适合谁", "自然观察"]) {
      fireEvent.click(screen.getByRole("button", { name: tab }))
      expect(screen.queryByRole("button", { name: /开始演示/ })).toBeNull()
    }
    fireEvent.click(screen.getByRole("button", { name: "注意什么" }))
    expect(screen.getByRole("button", { name: /开始演示/ })).toBeTruthy()
  })

  it("④ 风险控制：暂停/重播/恢复分发正确事件，步骤可手动推进", () => {
    renderExperience()
    startRiskDemo()
    expect(screen.getByText(/第 1 \/ 共 2 步/)).toBeTruthy()

    // 暂停 → 按钮变为「继续」，埋点 risk_pause
    fireEvent.click(screen.getByRole("button", { name: /暂停/ }))
    expect(screen.getByRole("button", { name: /继续/ })).toBeTruthy()
    expect(readImmersiveEvents({ name: "risk_pause" }).length).toBe(1)

    // 手动下一步 → 进度推进（riskStep）
    fireEvent.click(screen.getByRole("button", { name: /下一步/ }))
    expect(screen.getByText(/第 2 \/ 共 2 步/)).toBeTruthy()
    expect(screen.getByRole("button", { name: /下一步/ }).hasAttribute("disabled")).toBe(true)

    // 重播 → 回到第 1 步，埋点 risk_replay
    fireEvent.click(screen.getByRole("button", { name: /重播/ }))
    expect(screen.getByText(/第 1 \/ 共 2 步/)).toBeTruthy()
    expect(readImmersiveEvents({ name: "risk_replay" }).length).toBe(1)

    // 恢复平静 → 回到 cautions 面板，埋点 risk_restore
    fireEvent.click(screen.getByRole("button", { name: /恢复平静/ }))
    expect(screen.queryByTestId("ix-risk-controls")).toBeNull()
    expect(screen.getByRole("button", { name: /开始演示/ })).toBeTruthy()
    expect(readImmersiveEvents({ name: "risk_restore" }).length).toBe(1)
  })

  it("⑤ 空间标签数量 ≤ 上限（默认 3 / 主题态 5），按优先级截断", () => {
    const { container, unmount } = renderExperience()
    // V1.2：简介后自动展开景色主题；先点击景色页签清除主题，回到默认探索态
    fireEvent.click(screen.getByRole("button", { name: "景色" }))
    // 默认态：4 个锚点 → 截断为 3（priority 前 3：山顶/五合目/观景台）
    expect(container.querySelectorAll(".ix-anchor").length).toBe(3)
    expect(screen.getByRole("button", { name: "山顶" })).toBeTruthy()
    expect(screen.queryByRole("button", { name: "碎石坡" })).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "注意什么" }))
    expect(container.querySelectorAll(".ix-anchor").length).toBe(1)
    fireEvent.click(screen.getByRole("button", { name: "景色" }))
    expect(container.querySelectorAll(".ix-anchor").length).toBe(2)
    unmount()

    // 主题态上限 5：7 个 highlights 锚点 → 自动展开的景色主题渲染 5 个；清除后回默认 3 个
    const scene = makeTestScene()
    scene.anchors = Array.from({ length: 7 }, (_, i) => ({
      id: `x${i}`,
      label: `点${i}`,
      anchorType: "viewpoint" as const,
      positionRef: `node:p${i}`,
      themes: ["highlights" as const],
      contentId: "c1",
      priority: i + 1,
    }))
    const variant = renderExperience({ scene })
    expect(variant.container.querySelectorAll(".ix-anchor").length).toBe(5)
    fireEvent.click(screen.getByRole("button", { name: "景色" }))
    expect(variant.container.querySelectorAll(".ix-anchor").length).toBe(3)
  })

  it("⑥ 未做选择直接结束探索 → 总结页含默认结论与「未选择具体人群」", async () => {
    const onAddWishlist = vi.fn()
    const { onExit } = renderExperience({ plannedMonth: 10, onAddWishlist, reducedMotion: true })

    fireEvent.click(screen.getByRole("button", { name: "结束探索" }))
    expect(screen.getByText("本次探索总结")).toBeTruthy()

    // 四卡片
    expect(screen.getByText("最适合的季节")).toBeTruthy()
    expect(screen.getByText("最适合的玩法")).toBeTruthy()
    expect(screen.getByText("适合的人群")).toBeTruthy()
    expect(screen.getByText("需要留意的风险")).toBeTruthy()
    // 默认预览（plannedMonth=10 → 秋季晴景）的时间段文案 + 代表性玩法
    expect(screen.getByText("10 月下旬至 11 月中旬，晴天率高")).toBeTruthy()
    expect(screen.getAllByText("经典徒步").length).toBeGreaterThan(0)
    // 未选择人群：卡片取值 + 引擎原因（§4.7 默认规则）
    expect(screen.getAllByText(/未选择具体人群/).length).toBeGreaterThan(0)
    // 主要风险来自适用风险的判断信号；准备事项来自 summaryRules
    expect(screen.getAllByText(/云层快速增厚/).length).toBeGreaterThan(0)
    expect(screen.getByText("保暖衣物")).toBeTruthy()

    // 业务动作：已接入的回调触发 + summaryAction 埋点
    fireEvent.click(screen.getByRole("button", { name: /加入心愿单/ }))
    expect(onAddWishlist).toHaveBeenCalledTimes(1)
    expect(readImmersiveEvents({ name: "summary_action" })[0]?.params?.action).toBe("add_wishlist")
    // 未接入入口：禁用且不伪装（§11.3）
    expect(screen.getByRole("button", { name: /加入 Journey/ }).hasAttribute("disabled")).toBe(true)

    // 返回地图 → RETURNING → onExit('return_map')
    fireEvent.click(screen.getByRole("button", { name: "返回地图" }))
    await waitFor(() => expect(onExit).toHaveBeenCalledWith("return_map"), { timeout: 1500 })
  })

  it("⑧ Esc 键逐级返回：风险 → 主题 → 探索 → 返回地图", async () => {
    const { onExit } = renderExperience({ reducedMotion: true })

    // V1.2：简介后自动展开景色主题，信息面板已可见
    expect(screen.getByTestId("ix-info-panel")).toBeTruthy()
    fireEvent.keyDown(window, { key: "Escape" })
    expect(screen.queryByTestId("ix-info-panel")).toBeNull()
    expect(screen.getByRole("button", { name: "景色" }).getAttribute("aria-pressed")).toBe("false")

    startRiskDemo()
    expect(screen.getByTestId("ix-risk-controls")).toBeTruthy()
    fireEvent.keyDown(window, { key: "Escape" }) // RISK_ACTIVE → restoreCalm
    expect(screen.queryByTestId("ix-risk-controls")).toBeNull()
    expect(screen.getByRole("button", { name: /开始演示/ })).toBeTruthy()

    fireEvent.keyDown(window, { key: "Escape" }) // THEME_ACTIVE → clearTheme
    expect(screen.queryByTestId("ix-info-panel")).toBeNull()

    fireEvent.keyDown(window, { key: "Escape" }) // EXPLORE_IDLE → returnMap
    await waitFor(() => expect(onExit).toHaveBeenCalledWith("return_map"), { timeout: 1500 })
  })

  it("⑨ 三态口径标识：当前实况 / 典型景色预览 / 风险情境演示", () => {
    const { container } = renderExperience({ liveSnapshot: makeLiveSnapshot(), plannedMonth: 10 })

    // live：来源 + 本地化时间（仅 fresh 时）
    const liveBadge = container.querySelector('[data-mode="live"]')
    expect(liveBadge?.textContent).toContain("当前实况 · 测试气象源 · ")

    // typical_preview：景色主题后角标 + 面板卡片标（V1.2：简介后景色主题已自动展开）
    expect(container.querySelectorAll('[data-mode="typical_preview"]').length).toBeGreaterThan(1)

    // risk_simulation：醒目「风险情境演示 · 非当前实况」
    startRiskDemo()
    const riskBadges = container.querySelectorAll('[data-mode="risk_simulation"]')
    expect(riskBadges.length).toBeGreaterThan(0)
    expect(riskBadges[0]?.textContent).toContain("风险情境演示 · 非当前实况")

    // 总结页不抹平口径：两种标识都在
    fireEvent.click(screen.getByRole("button", { name: "结束探索" }))
    const summary = screen.getByTestId("ix-summary")
    expect(summary.querySelector('[data-mode="typical_preview"]')).toBeTruthy()
    expect(summary.querySelector('[data-mode="risk_simulation"]')).toBeTruthy()
  })

  it("进入转场可取消：显示名称/类型/计划月份/beat，取消 → onExit('cancel')", () => {
    runtime.autoAdvance = false
    const { onExit } = renderExperience({ plannedMonth: 10 })

    expect(screen.getByRole("heading", { name: "测试山" })).toBeTruthy()
    expect(screen.getByText(/火山 · 山地高原/)).toBeTruthy()
    expect(screen.getByText(/山地 · 地点/)).toBeTruthy()
    expect(screen.getByText("计划月份：10 月")).toBeTruthy()
    expect(screen.getByText("准备进入 3D 探索…")).toBeTruthy()

    act(() => {
      runtime.enterOpts?.onBeat?.("穿过云层", 1)
    })
    expect(screen.getByText("穿过云层")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "取消进入" }))
    expect(onExit).toHaveBeenCalledTimes(1)
    expect(onExit).toHaveBeenCalledWith("cancel")
    expect(readImmersiveEvents({ name: "enter_cancel" }).length).toBe(1)
  })

  it("空间标签点击：dispatch selectAnchor 并展示锚点说明，非相关标签降强调", () => {
    const { container } = renderExperience()
    // V1.2：简介后自动展开景色主题；先清除主题回到默认探索态（锚点选中才展开面板）
    fireEvent.click(screen.getByRole("button", { name: "景色" }))
    fireEvent.click(screen.getByRole("button", { name: "山顶" }))

    // 锚点说明内容（anchorsContent 容错解析）
    expect(screen.getByText("山顶（3,776m）")).toBeTruthy()
    expect(screen.getByText(/主峰顶点/)).toBeTruthy()
    expect(readImmersiveEvents({ name: "scene_anchor_activate" })[0]?.params?.anchorId).toBe("a1")

    // 主题集合无交集的 五合目(experience) 降强调；有交集的 观景台(highlights) 不降
    const dimmed = container.querySelectorAll(".ix-anchor--dimmed")
    expect(dimmed.length).toBe(1)
    expect(dimmed[0]?.textContent).toContain("五合目")

    // 再次点击取消选中 → 面板关闭
    fireEvent.click(screen.getByRole("button", { name: "山顶" }))
    expect(screen.queryByTestId("ix-info-panel")).toBeNull()
  })

  it("退出流程：返回地图 → RETURNING → onExit('return_map')；卸载 dispose 控制器", async () => {
    const { onExit, unmount } = renderExperience({ reducedMotion: true })
    expect(runtime.mountCount).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole("button", { name: "返回地图" }))
    await waitFor(() => expect(onExit).toHaveBeenCalledWith("return_map"), { timeout: 1500 })

    unmount()
    expect(runtime.disposeCount).toBeGreaterThan(0)
  })
})
