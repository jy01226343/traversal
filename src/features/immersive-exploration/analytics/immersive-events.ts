/**
 * 沉浸探索埋点（施工方案 V1.1 §11.4）
 *
 * 仓库当前无任何埋点体系（P0 审计 §5），本模块为最小抽象：
 * - console.debug 输出（dev 可见）
 * - localStorage 环形缓冲 `atlas-immersive-events-v1`（上限 500 条，漏斗可查询）
 * - 预留 sink 注入点（未来接 worker 端点时不改调用方）
 *
 * 事件参数只记录真实状态与选择，不得伪造。
 */

export type ImmersiveEventName =
  | "anchor_click"
  | "enter_start"
  | "enter_complete"
  | "enter_cancel"
  | "arrival_complete"
  | "theme_activate"
  | "scene_anchor_activate"
  | "preview_switch"
  | "activity_select"
  | "audience_select"
  | "risk_start"
  | "risk_pause"
  | "risk_replay"
  | "risk_restore"
  | "summary_generate"
  | "summary_action"
  | "fallback_enter"
  | "exit_method";

export interface ImmersiveEventRecord {
  name: ImmersiveEventName;
  entityId?: string;
  at: string;
  params?: Record<string, string | number | boolean | null | undefined>;
}

export type ImmersiveEventSink = (record: ImmersiveEventRecord) => void;

const STORAGE_KEY = "atlas-immersive-events-v1";
const MAX_RECORDS = 500;

let externalSink: ImmersiveEventSink | null = null;

/** 注入外部上报通道（如未来 worker 端点）。传 null 解除。 */
export function setImmersiveEventSink(sink: ImmersiveEventSink | null): void {
  externalSink = sink;
}

export function trackImmersiveEvent(
  name: ImmersiveEventName,
  params?: ImmersiveEventRecord["params"] & { entityId?: string },
): void {
  const { entityId, ...rest } = params ?? {};
  const record: ImmersiveEventRecord = {
    name,
    entityId,
    at: new Date().toISOString(),
    params: rest,
  };
  try {
    // eslint-disable-next-line no-console
    console.debug(`[immersive] ${name}`, record);
  } catch {
    /* noop */
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list: ImmersiveEventRecord[] = raw ? JSON.parse(raw) : [];
    list.push(record);
    if (list.length > MAX_RECORDS) list.splice(0, list.length - MAX_RECORDS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* private mode: 埋点丢失不影响流程 */
  }
  try {
    externalSink?.(record);
  } catch {
    /* 外部通道失败不影响流程 */
  }
}

/** 漏斗查询：读取本地事件缓冲（可按 name/entityId 过滤） */
export function readImmersiveEvents(filter?: {
  name?: ImmersiveEventName;
  entityId?: string;
}): ImmersiveEventRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list: ImmersiveEventRecord[] = raw ? JSON.parse(raw) : [];
    if (!filter) return list;
    return list.filter(
      (r) =>
        (!filter.name || r.name === filter.name) &&
        (!filter.entityId || r.entityId === filter.entityId),
    );
  } catch {
    return [];
  }
}

export function clearImmersiveEvents(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}
