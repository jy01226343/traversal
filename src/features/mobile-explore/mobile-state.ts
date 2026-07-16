export type SheetDetent = "peek" | "browse" | "detail"

export interface MobileLayoutContext {
  viewportWidth: number
  viewportHeight: number
  safeAreaTop: number
  safeAreaBottom: number
  keyboardHeight: number
  fontScale: number
  hasStickyCta: boolean
}

export interface MobileViewState {
  routeKey: string
  detent: SheetDetent
  selectedEntityId: string | null
  focusedEntityId: string | null
  comparedEntityIds: string[]
  listScrollTop: number
  mapView: { zoom: number; center?: [number, number] }
}

export interface InitialDetentContext {
  entry: "home" | "region" | "search" | "recommendation" | "journey" | "detail"
  selectedEntityId?: string | null
}

export function resolveInitialDetent(context: InitialDetentContext): SheetDetent {
  if (context.entry === "detail") return "detail"
  if (context.selectedEntityId || context.entry === "search" || context.entry === "recommendation" || context.entry === "journey") return "browse"
  return "peek"
}

export function resolveSheetHeight(detent: SheetDetent, context: MobileLayoutContext) {
  const usableHeight = Math.max(280, context.viewportHeight - context.safeAreaTop - context.safeAreaBottom - context.keyboardHeight)
  const ctaAllowance = context.hasStickyCta ? 60 * Math.max(1, context.fontScale) : 0
  const ratios: Record<SheetDetent, number> = { peek: 0.27, browse: 0.58, detail: 0.9 }
  const minimums: Record<SheetDetent, number> = { peek: 132, browse: 286, detail: 360 }
  const height = Math.round(Math.max(minimums[detent] * Math.max(1, context.fontScale), usableHeight * ratios[detent], ctaAllowance + 88))
  return Math.min(usableHeight, height)
}

export function getCameraBottomPadding(detent: SheetDetent, sheetHeight: number) {
  const minimumVisible: Record<SheetDetent, number> = { peek: 0.65, browse: 0.35, detail: 0.12 }
  return Math.max(80, Math.round(sheetHeight + (1 - minimumVisible[detent]) * 56))
}

export type MobileBackAction = "close_filter" | "close_detail" | "clear_selection" | "collapse_sheet" | "navigate_up" | "none"

export function resolveMobileBackAction(input: { filterOpen: boolean; detailOpen: boolean; selectedEntityId: string | null; detent: SheetDetent; canNavigateUp: boolean }): MobileBackAction {
  if (input.filterOpen) return "close_filter"
  if (input.detailOpen) return "close_detail"
  if (input.selectedEntityId) return "clear_selection"
  if (input.detent === "detail" || input.detent === "browse") return "collapse_sheet"
  return input.canNavigateUp ? "navigate_up" : "none"
}

export function saveMobileViewState(state: MobileViewState) {
  try { sessionStorage.setItem(`atlas-mobile-view:${state.routeKey}`, JSON.stringify(state)) } catch { /* storage unavailable */ }
}

export function loadMobileViewState(routeKey: string): MobileViewState | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(`atlas-mobile-view:${routeKey}`) || "null")
    if (!value || !["peek", "browse", "detail"].includes(value.detent)) return null
    return value as MobileViewState
  } catch { return null }
}

export interface OfflineAction<T = unknown> { id: string; type: string; payload: T; createdAt: number; retryCount: number }

const OFFLINE_QUEUE_KEY = "atlas-mobile-offline-actions"

export function enqueueOfflineAction<T>(action: Omit<OfflineAction<T>, "id" | "createdAt" | "retryCount">) {
  const next: OfflineAction<T> = { ...action, id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`, createdAt: Date.now(), retryCount: 0 }
  try {
    const current = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || "[]") as OfflineAction<T>[]
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify([...current.filter(item => item.id !== next.id), next].slice(-20)))
  } catch { /* offline queue is best effort */ }
  return next
}

export function readOfflineActions(): OfflineAction[] {
  try { const value = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || "[]"); return Array.isArray(value) ? value : [] } catch { return [] }
}

export function removeOfflineAction(id: string) {
  try { localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(readOfflineActions().filter(action => action.id !== id))) } catch { /* storage unavailable */ }
}
