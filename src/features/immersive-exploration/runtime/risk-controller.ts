/**
 * 沉浸探索 · 风险演示播放控制器（CONTRACT CORE 节 / §1 冻结规则）
 *
 * playing=true 时每 stepMs（默认 2600ms）推进 onStep(stepIndex+1)；
 * 播到最后一步停住——不循环、不自动消失；playing=false 或清理时停表。
 */

import type { RiskScenarioDefinition } from "../domain/types";

const DEFAULT_STEP_MS = 2600;

export function runRiskPlayback(opts: {
  risk: RiskScenarioDefinition;
  stepIndex: number;
  playing: boolean;
  stepMs?: number;
  onStep: (nextIndex: number) => void;
}): () => void {
  const { risk, playing, onStep } = opts;
  const stepMs = opts.stepMs ?? DEFAULT_STEP_MS;
  const lastIndex = Math.max(risk.sequence.length - 1, 0);

  let current = opts.stepIndex;

  // 暂停中 / 已在最后一步：不启动计时器（停住，不自动消失）
  if (!playing || current >= lastIndex) {
    return () => {};
  }

  const timer = setInterval(() => {
    if (current >= lastIndex) {
      clearInterval(timer);
      return;
    }
    current += 1;
    onStep(current);
    if (current >= lastIndex) {
      // 播完最后一步停住
      clearInterval(timer);
    }
  }, stepMs);

  return () => clearInterval(timer);
}
