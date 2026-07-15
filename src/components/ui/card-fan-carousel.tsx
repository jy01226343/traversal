import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import gsap from "gsap"

export interface FanCardItem {
  id: string
  imgUrl: string
  alt?: string
  title: string
  location: string
  kicker: string
  summary: string
  score: number
  status?: "locked" | "unlocked" | "wishlist" | "preparing" | "mastered"
  grade?: "S" | "A" | "B"
  statusLabel?: string
  sourceLabel?: string
  /** Explicit wishlist membership (survives free-access / visited status) */
  wished?: boolean
}

interface CardFanCarouselProps {
  cards: FanCardItem[]
  onCardSelect?: (card: FanCardItem) => void
  onWishToggle?: (card: FanCardItem) => void
  /** auto: PC portals controls to #top; inline: keep controls under the fan (modals) */
  controlsMode?: "auto" | "inline"
}

function circularOffset(index: number, activeIndex: number, length: number) {
  let offset = index - activeIndex
  if (offset > length / 2) offset -= length
  if (offset < -length / 2) offset += length
  return offset
}

const STATUS_COPY: Record<string, string> = {
  unlocked: "已点亮 · 进入地图",
  mastered: "深度探索 · 进入地图",
  wishlist: "心愿单 · 查看准备",
  preparing: "准备中 · 继续清单",
  locked: "未解锁 · 查看条件",
}

export function CardFanCarousel({ cards, onCardSelect, onWishToggle, controlsMode = "auto" }: CardFanCarouselProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [compact, setCompact] = useState(() => typeof window !== "undefined" && window.innerWidth < 760)
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null)
  const visibleCards = useMemo(() => cards, [cards])
  const usePortal = controlsMode === "auto" && !compact && Boolean(portalHost)

  useEffect(() => {
    const sync = () => setCompact(window.innerWidth < 760)
    window.addEventListener("resize", sync)
    return () => window.removeEventListener("resize", sync)
  }, [])

  useEffect(() => {
    if (controlsMode === "inline") {
      setPortalHost(null)
      return
    }
    setPortalHost(document.getElementById("top"))
  }, [controlsMode])

  useEffect(() => setActiveIndex(0), [cards])

  useLayoutEffect(() => {
    if (!rootRef.current || !visibleCards.length) return
    const nodes = Array.from(rootRef.current.querySelectorAll<HTMLElement>(".fan-card"))
    const spacing = compact ? 54 : 76
    const fanLift = compact ? 7 : 12
    const ctx = gsap.context(() => {
      nodes.forEach((node, index) => {
        const offset = circularOffset(index, activeIndex, visibleCards.length)
        const hidden = Math.abs(offset) > 3
        gsap.killTweensOf(node)
        gsap.set(node, { zIndex: 20 - Math.abs(offset), pointerEvents: hidden ? "none" : "auto", opacity: hidden ? 0 : 1 })
        gsap.to(node, {
          x: offset * spacing,
          y: Math.abs(offset) * fanLift,
          rotation: offset * (compact ? 5.4 : 6.6),
          scale: offset === 0 ? 1 : 0.9 - Math.abs(offset) * 0.025,
          duration: 0.62,
          ease: "power3.out",
          overwrite: true,
        })
      })
    }, rootRef)
    return () => ctx.revert()
  }, [activeIndex, compact, visibleCards])

  const move = (direction: number) => setActiveIndex(current => (current + direction + visibleCards.length) % visibleCards.length)

  const controls = (
    <div className="fan-controls">
      <button type="button" onClick={() => move(-1)} aria-label="上一项推荐">←</button>
      <span>{String(activeIndex + 1).padStart(2, "0")} / {String(Math.max(visibleCards.length, 1)).padStart(2, "0")}</span>
      <button type="button" onClick={() => move(1)} aria-label="下一项推荐">→</button>
    </div>
  )

  return (
    <div className="seasonal-fan" ref={rootRef}>
      <div className="fan-stack" role="list" aria-label="当季旅行推荐">
        {visibleCards.map((card, index) => {
          const offset = circularOffset(index, activeIndex, visibleCards.length)
          const active = offset === 0
          const status = card.status || "locked"
          const wished = Boolean(card.wished) || status === "wishlist"
          return <div className={`fan-card ${active ? "is-active" : ""} status-${status}`} key={card.id}>
            <button
              type="button"
              className="fan-card-main"
              aria-label={`${card.title}，推荐指数 ${card.score}`}
              aria-current={active ? "true" : undefined}
              onClick={() => onCardSelect?.(card)}
            >
              <img src={card.imgUrl} alt={card.alt || card.title}/>
              <span className="fan-shade"/>
              {card.grade && <span className={`fan-grade grade-${card.grade}`} aria-label={`${card.grade}级推荐`}><em>{card.grade}</em><small>级</small></span>}
              <span className="fan-score"><small>SEASON FIT</small><b>{card.score}</b></span>
              <span className={`fan-access ${status}`}>{card.statusLabel || STATUS_COPY[status] || STATUS_COPY.locked}</span>
              <span className="fan-copy">
                <small>{card.kicker}</small>
                <b>{card.title}</b>
                <em>{card.location}</em>
                <i>{card.summary}</i>
                {card.sourceLabel && <u className="fan-source">◎ {card.sourceLabel}</u>}
              </span>
            </button>
            {onWishToggle && <button
              type="button"
              className={`fan-wish ${wished ? "is-on" : ""}`}
              aria-label={wished ? "移出心愿单" : "加入心愿单"}
              aria-pressed={wished}
              onClick={event => { event.stopPropagation(); onWishToggle(card) }}
            >{wished ? "♥" : "♡"}</button>}
          </div>
        })}
      </div>
      {/* auto PC: portal to hero; modal/mobile: keep controls under the fan */}
      {usePortal && portalHost ? createPortal(controls, portalHost) : controls}
    </div>
  )
}
