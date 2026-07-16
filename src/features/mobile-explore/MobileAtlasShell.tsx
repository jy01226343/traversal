import { type CSSProperties, type PointerEvent, type ReactNode, useEffect, useRef, useState } from "react"
import { ChevronDown, LocateFixed, Menu, Minus, Plus, Search, X } from "lucide-react"
import { type SheetDetent, resolveSheetHeight } from "./mobile-state"
import "./mobile-atlas.css"

interface MobileAtlasShellProps {
  detent: SheetDetent
  onDetentChange: (detent: SheetDetent, source: "user" | "selection" | "navigation") => void
  levelLabel: string
  contextLabel: string
  resultCount: number
  selectedLabel?: string | null
  onBack: () => void
  onOpenSearch: () => void
  onOpenMenu: () => void
  onOpenPath: () => void
  onLocate: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onClearSelection: () => void
  onViewDetail: () => void
  onPrimaryAction?: () => void
  primaryActionLabel?: string | null
  syncLabel?: string
  children: ReactNode
  stage: ReactNode
  reducedMotion?: boolean
}

const DETENTS: SheetDetent[] = ["peek", "browse", "detail"]

export function MobileAtlasShell(props: MobileAtlasShellProps) {
  const [viewport, setViewport] = useState({ width: 390, height: 800, keyboardHeight: 0 })
  const [dragStart, setDragStart] = useState<number | null>(null)
  const [dragDelta, setDragDelta] = useState(0)
  const pathTriggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const sync = () => {
      const visual = window.visualViewport
      const height = Math.round(visual?.height || window.innerHeight)
      setViewport({ width: Math.round(visual?.width || window.innerWidth), height, keyboardHeight: Math.max(0, window.innerHeight - height) })
      document.documentElement.style.setProperty("--atlas-visual-viewport", `${height}px`)
    }
    sync()
    window.visualViewport?.addEventListener("resize", sync)
    window.addEventListener("resize", sync)
    return () => { window.visualViewport?.removeEventListener("resize", sync); window.removeEventListener("resize", sync) }
  }, [])

  const height = resolveSheetHeight(props.detent, { viewportWidth: viewport.width, viewportHeight: viewport.height, safeAreaTop: 0, safeAreaBottom: 0, keyboardHeight: viewport.keyboardHeight, fontScale: 1, hasStickyCta: Boolean(props.primaryActionLabel) })
  const finishDrag = () => {
    if (dragStart === null) return
    const currentIndex = DETENTS.indexOf(props.detent)
    const nextIndex = dragDelta > 42 ? Math.max(0, currentIndex - 1) : dragDelta < -42 ? Math.min(DETENTS.length - 1, currentIndex + 1) : currentIndex
    if (nextIndex !== currentIndex) props.onDetentChange(DETENTS[nextIndex], "user")
    setDragStart(null); setDragDelta(0)
  }
  const onHandleDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragStart(event.clientY); setDragDelta(0)
  }
  const onHandleMove = (event: PointerEvent<HTMLButtonElement>) => { if (dragStart !== null) setDragDelta(event.clientY - dragStart) }

  return <div className={`mobile-atlas-shell detent-${props.detent} ${props.reducedMotion ? "motion-reduced" : ""}`} style={{ "--mobile-sheet-height": `${height}px` } as CSSProperties}>
    <div className="mobile-atlas-stage">{props.stage}</div>
    <header className="mobile-atlas-header" aria-label="探索导航">
      <button type="button" onClick={props.onBack} aria-label="返回上一层"><ChevronDown size={22}/></button>
      <button ref={pathTriggerRef} type="button" className="mobile-path-trigger" onClick={props.onOpenPath} aria-haspopup="dialog"><span>{props.levelLabel}</span><b>{props.contextLabel}</b><ChevronDown size={15}/></button>
      <div><button type="button" onClick={props.onOpenSearch} aria-label="搜索"><Search size={19}/></button><button type="button" onClick={props.onOpenMenu} aria-label="更多菜单"><Menu size={19}/></button></div>
    </header>
    <aside className="mobile-map-tools" aria-label="地图工具"><button type="button" onClick={props.onLocate} aria-label="定位当前区域"><LocateFixed size={19}/></button><details><summary aria-label="辅助缩放">•••</summary><div><button type="button" onClick={props.onZoomIn} aria-label="放大地图"><Plus size={17}/></button><button type="button" onClick={props.onZoomOut} aria-label="缩小地图"><Minus size={17}/></button></div></details></aside>
    <section className="mobile-atlas-sheet" aria-label={`探索抽屉：${props.detent}`} aria-live="polite">
      <button type="button" className="mobile-sheet-handle" aria-label="调整抽屉高度" onPointerDown={onHandleDown} onPointerMove={onHandleMove} onPointerUp={finishDrag} onPointerCancel={finishDrag}><span/></button>
      <header className="mobile-sheet-summary"><div><small>{props.syncLabel || "地图与列表已同步"}</small><b>{props.selectedLabel || props.contextLabel}</b><span>{props.resultCount} 个可浏览对象</span></div><div className="mobile-detent-buttons" role="group" aria-label="抽屉高度">{DETENTS.map(detent => <button type="button" key={detent} className={detent === props.detent ? "active" : ""} onClick={() => props.onDetentChange(detent, "user")} aria-pressed={detent === props.detent}>{({ peek: "概览", browse: "浏览", detail: "详情" } as const)[detent]}</button>)}</div></header>
      <div className="mobile-sheet-body">
        {props.detent === "peek" ? <div className="mobile-peek-content">{props.selectedLabel ? <><p>已选中地点</p><button type="button" onClick={() => props.onDetentChange("browse", "user")}>查看摘要</button></> : <p>拖动或点击“浏览”查看地点、筛选和地图操作。</p>}</div> : props.children}
        {props.detent === "detail" && props.selectedLabel && <section className="mobile-detail-actions"><button type="button" onClick={props.onViewDetail}>查看完整地点档案</button><button type="button" onClick={props.onClearSelection}><X size={15}/>取消选中</button></section>}
      </div>
      {props.primaryActionLabel && <footer className="mobile-sheet-cta"><button type="button" onClick={props.onPrimaryAction}>{props.primaryActionLabel}</button></footer>}
    </section>
  </div>
}
