/**
 * 沉浸探索 · 进入/抵达时序控制器（CONTRACT CORE 节）
 *
 * - runEnterSequence：按 scene.arrival.transitionBeats 逐拍推进；
 *   reducedMotion 时每拍 60ms；水下场景把总时长 ~2.2s 按拍数均分；其他场景每拍约 420ms。
 *   isCurrent(token) 为 false 或返回的取消函数被调用即停止（不再回调）。
 * - runArrivalObserve：纯场景观察，observeMs 后 onDone（reducedMotion 时 ≤300ms）。
 *
 * 全部基于 setTimeout，返回的函数可完全清理。
 */

import type { ImmersiveSceneDefinition } from "../domain/types";

const ENTER_BEAT_MS = 420;
const ENTER_BEAT_MS_REDUCED = 60;
const UNDERWATER_ENTER_TOTAL_MS = 2200;
const ARRIVAL_OBSERVE_MS_REDUCED_MAX = 300;

export function runEnterSequence(opts: {
  scene: ImmersiveSceneDefinition;
  token: number;
  isCurrent: (token: number) => boolean;
  reducedMotion: boolean;
  onBeat?: (beat: string, index: number) => void;
  onDone: () => void;
}): () => void {
  const { scene, token, isCurrent, reducedMotion, onBeat, onDone } = opts;
  const beats = scene.arrival.transitionBeats;

  let beatMs: number;
  if (reducedMotion) {
    beatMs = ENTER_BEAT_MS_REDUCED;
  } else if (scene.family === "underwater") {
    // 水下穿水叙事：总时长 ~2.2s 按拍数均分（最后一拍后接 onDone）
    beatMs = UNDERWATER_ENTER_TOTAL_MS / Math.max(beats.length, 1);
  } else {
    beatMs = ENTER_BEAT_MS;
  }

  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const alive = () => !cancelled && isCurrent(token);

  const step = (index: number) => {
    if (!alive()) return;
    onBeat?.(beats[index], index);
    if (index >= beats.length - 1) {
      // 最后一拍完成后同拍结束：总时长 = 拍数 × beatMs（水下 ≈2.2s）
      onDone();
      return;
    }
    timer = setTimeout(() => step(index + 1), beatMs);
  };

  if (beats.length === 0) {
    timer = setTimeout(() => {
      if (alive()) onDone();
    }, 0);
  } else {
    timer = setTimeout(() => step(0), beatMs);
  }

  return () => {
    cancelled = true;
    if (timer != null) clearTimeout(timer);
  };
}

export function runArrivalObserve(
  scene: ImmersiveSceneDefinition,
  reducedMotion: boolean,
  onDone: () => void,
): () => void {
  const observeMs = reducedMotion
    ? Math.min(scene.arrival.observeMs, ARRIVAL_OBSERVE_MS_REDUCED_MAX)
    : scene.arrival.observeMs;
  const timer = setTimeout(onDone, observeMs);
  return () => clearTimeout(timer);
}
