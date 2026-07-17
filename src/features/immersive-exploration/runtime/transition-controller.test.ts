/**
 * transition-controller 测试（fake timers）：
 * 逐拍推进 / reducedMotion 节拍 / 水下总时长均分 / 取消后不再回调 / isCurrent 失效即停 /
 * runArrivalObserve 时长与 reducedMotion 上限。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ImmersiveSceneDefinition } from "../domain/types";
import { runArrivalObserve, runEnterSequence } from "./transition-controller";

function makeScene(family: "mountain" | "underwater", beats: string[], observeMs = 1200): ImmersiveSceneDefinition {
  return {
    id: "scene-test",
    family,
    entityName: "测试",
    regionLabel: "测试地区",
    defaultCamera: { position: [0, 0, 10], lookAt: [0, 0, 0] },
    arrival: {
      subtitle: "副标题",
      headlineSight: "景观",
      headlineActivity: "玩法",
      observeMs,
      transitionBeats: beats,
    },
    themes: [],
    anchors: [],
    previewPresets: [],
    activities: [],
    audiences: [],
    risks: [],
    summaryRules: [],
    assets: { proceduralNodes: [], estimatedBytes: 0 },
    fallback: { summary: "", sections: [] },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("runEnterSequence", () => {
  it("山地场景按每拍约 420ms 逐拍推进，最后触发 onDone", () => {
    const beats = ["接近", "下降", "稳定"];
    const onBeat = vi.fn();
    const onDone = vi.fn();
    runEnterSequence({
      scene: makeScene("mountain", beats),
      token: 1,
      isCurrent: () => true,
      reducedMotion: false,
      onBeat,
      onDone,
    });
    expect(onBeat).not.toHaveBeenCalled();
    vi.advanceTimersByTime(420);
    expect(onBeat).toHaveBeenCalledWith("接近", 0);
    vi.advanceTimersByTime(420);
    expect(onBeat).toHaveBeenCalledWith("下降", 1);
    vi.advanceTimersByTime(420);
    expect(onBeat).toHaveBeenCalledWith("稳定", 2);
    // 最后一拍同拍触发 onDone
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("reducedMotion 时每拍 60ms", () => {
    const onBeat = vi.fn();
    const onDone = vi.fn();
    runEnterSequence({
      scene: makeScene("mountain", ["a", "b"]),
      token: 1,
      isCurrent: () => true,
      reducedMotion: true,
      onBeat,
      onDone,
    });
    vi.advanceTimersByTime(60);
    expect(onBeat).toHaveBeenCalledWith("a", 0);
    vi.advanceTimersByTime(120);
    expect(onBeat).toHaveBeenCalledWith("b", 1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("水下场景总时长约 2.2s 按拍数均分", () => {
    const beats = ["接近水面", "穿过水面", "光线变化", "场景稳定", "生态进入", "主题入口"];
    const onBeat = vi.fn();
    const onDone = vi.fn();
    runEnterSequence({
      scene: makeScene("underwater", beats),
      token: 1,
      isCurrent: () => true,
      reducedMotion: false,
      onBeat,
      onDone,
    });
    vi.advanceTimersByTime(2200);
    expect(onBeat).toHaveBeenCalledTimes(6);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("取消函数调用后不再回调", () => {
    const onBeat = vi.fn();
    const onDone = vi.fn();
    const cancel = runEnterSequence({
      scene: makeScene("mountain", ["a", "b", "c"]),
      token: 1,
      isCurrent: () => true,
      reducedMotion: false,
      onBeat,
      onDone,
    });
    vi.advanceTimersByTime(420);
    expect(onBeat).toHaveBeenCalledTimes(1);
    cancel();
    vi.advanceTimersByTime(5000);
    expect(onBeat).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
  });

  it("isCurrent(token) 为 false 即停止", () => {
    const onBeat = vi.fn();
    const onDone = vi.fn();
    let currentToken = 1;
    runEnterSequence({
      scene: makeScene("mountain", ["a", "b"]),
      token: 1,
      isCurrent: (token) => token === currentToken,
      reducedMotion: false,
      onBeat,
      onDone,
    });
    vi.advanceTimersByTime(420);
    expect(onBeat).toHaveBeenCalledWith("a", 0);
    currentToken = 2; // 新目标选择使旧令牌失效
    vi.advanceTimersByTime(5000);
    expect(onBeat).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
  });
});

describe("runArrivalObserve", () => {
  it("observeMs 后触发 onDone", () => {
    const onDone = vi.fn();
    runArrivalObserve(makeScene("mountain", ["a"], 1500), false, onDone);
    vi.advanceTimersByTime(1499);
    expect(onDone).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("reducedMotion 时不超过 300ms", () => {
    const onDone = vi.fn();
    runArrivalObserve(makeScene("mountain", ["a"], 1500), true, onDone);
    vi.advanceTimersByTime(300);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("清理后不再触发", () => {
    const onDone = vi.fn();
    const cancel = runArrivalObserve(makeScene("mountain", ["a"], 1000), false, onDone);
    cancel();
    vi.advanceTimersByTime(5000);
    expect(onDone).not.toHaveBeenCalled();
  });
});
