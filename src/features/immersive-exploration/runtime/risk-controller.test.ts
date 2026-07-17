/**
 * risk-controller 测试（fake timers）：
 * playing=true 每 stepMs 推进 onStep(stepIndex+1)；播到最后一步停住（不循环）；
 * playing=false 不启动；清理函数停表。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RiskScenarioDefinition } from "../domain/types";
import { runRiskPlayback } from "./risk-controller";

function makeRisk(steps: number): RiskScenarioDefinition {
  return {
    id: "risk-1",
    label: "强风",
    applicable: true,
    mode: "risk_simulation",
    cause: ["成因"],
    sequence: Array.from({ length: steps }, (_, i) => ({
      id: `s${i}`,
      title: `步骤${i}`,
      description: `描述${i}`,
      sceneActions: [],
    })),
    affectedAnchorIds: [],
    warningSignals: ["信号"],
    actions: ["行动"],
    impactTexts: {},
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("runRiskPlayback", () => {
  it("playing=true 时每 2600ms 推进 onStep(stepIndex+1)", () => {
    const onStep = vi.fn();
    runRiskPlayback({ risk: makeRisk(4), stepIndex: 0, playing: true, onStep });
    vi.advanceTimersByTime(2600);
    expect(onStep).toHaveBeenCalledWith(1);
    vi.advanceTimersByTime(2600);
    expect(onStep).toHaveBeenCalledWith(2);
    expect(onStep).toHaveBeenCalledTimes(2);
  });

  it("播到最后一步停住：不循环、不再回调", () => {
    const onStep = vi.fn();
    runRiskPlayback({ risk: makeRisk(3), stepIndex: 0, playing: true, onStep });
    vi.advanceTimersByTime(2600 * 2);
    expect(onStep).toHaveBeenLastCalledWith(2);
    expect(onStep).toHaveBeenCalledTimes(2);
    // 最后一步之后长时间不再推进
    vi.advanceTimersByTime(2600 * 10);
    expect(onStep).toHaveBeenCalledTimes(2);
  });

  it("已在最后一步时不启动计时器", () => {
    const onStep = vi.fn();
    runRiskPlayback({ risk: makeRisk(3), stepIndex: 2, playing: true, onStep });
    vi.advanceTimersByTime(2600 * 5);
    expect(onStep).not.toHaveBeenCalled();
  });

  it("playing=false 不启动", () => {
    const onStep = vi.fn();
    runRiskPlayback({ risk: makeRisk(3), stepIndex: 0, playing: false, onStep });
    vi.advanceTimersByTime(2600 * 5);
    expect(onStep).not.toHaveBeenCalled();
  });

  it("自定义 stepMs 生效；清理函数停表", () => {
    const onStep = vi.fn();
    const stop = runRiskPlayback({ risk: makeRisk(5), stepIndex: 0, playing: true, stepMs: 500, onStep });
    vi.advanceTimersByTime(500);
    expect(onStep).toHaveBeenCalledWith(1);
    stop();
    vi.advanceTimersByTime(5000);
    expect(onStep).toHaveBeenCalledTimes(1);
  });
});
