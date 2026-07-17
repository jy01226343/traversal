/**
 * 沉浸探索 · 空间标签位置 Hook（CONTRACT CORE 节）
 *
 * 订阅 SceneController.onFrame，每帧把锚点 positionRef 投影为屏幕坐标，
 * 返回 positionRef → { x, y } 映射；projectAnchor 返回 null 的键省略。
 */

import { useEffect, useState } from "react";

import type { SceneAnchorDefinition } from "../domain/types";
import type { SceneController } from "./scene-controller";

export function useAnchorPositions(
  controller: SceneController | null,
  anchors: SceneAnchorDefinition[],
): Record<string, { x: number; y: number }> {
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});

  useEffect(() => {
    if (!controller) {
      setPositions({});
      return;
    }
    const recompute = () => {
      const next: Record<string, { x: number; y: number }> = {};
      for (const anchor of anchors) {
        const point = controller.projectAnchor(anchor.positionRef);
        if (point) next[anchor.positionRef] = point;
      }
      setPositions(next);
    };
    recompute();
    const unsubscribe = controller.onFrame(recompute);
    return unsubscribe;
  }, [controller, anchors]);

  return positions;
}
