/**
 * 沉浸探索 Feature Flag（施工清单 P9-07）
 *
 * 关闭顺序（任一关闭即整体关闭）：
 * 1. 构建期 `VITE_IMMERSIVE_EXPLORATION=off`
 * 2. 运行期 localStorage `atlas-immersive-exploration=off`
 *
 * 默认开启。关闭后：地图入口隐藏，直达路径（编程调用）返回不可用，不渲染沉浸层。
 */

export function isImmersiveExplorationEnabled(): boolean {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    if (env?.VITE_IMMERSIVE_EXPLORATION === "off") return false;
  } catch {
    /* env 不可用时按默认开启 */
  }
  try {
    if (localStorage.getItem("atlas-immersive-exploration") === "off") return false;
  } catch {
    /* private mode */
  }
  return true;
}
