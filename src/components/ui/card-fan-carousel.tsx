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
  status?: "locked" | "unlocked" | "wishlist" | "preparing" | "mastered"
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
  reducedMotion?: boolean
}

function circularOffset(index: number, activeIndex: number, length: number) {
  let offset = index - activeIndex
  if (offset > length / 2) offset -= length
  if (offset < -length / 2) offset += length
  return offset
}

const STATUS_COPY: Record<string, string> = {
  unlocked: "准备完成 · 查看详情",
  mastered: "已到访 · 查看回忆",
  wishlist: "心愿中 · 开始准备",
  preparing: "准备中 · 继续清单",
  locked: "待探索 · 查看详情",
}

export function CardFanCarousel({ cards, onCardSelect, onWishToggle, controlsMode = "auto", reducedMotion = false }: CardFanCarouselProps) {
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
    if (reducedMotion) {
      nodes.forEach((node, index) => {
        const offset = circularOffset(index, activeIndex, visibleCards.length)
        Object.assign(node.style, {
          zIndex: String(30 - Math.abs(offset)),
          opacity: offset === 0 ? "1" : "0.56",
          transform: `translateX(calc(-50% + ${offset * 64}px))`,
          transition: "none",
        })
      })
      return
    }
    // Cover-flow spacing ≈ ~58–68% of card width so neighbors peek past the active card
    const spacing = compact ? 78 : 102
    const fanLift = compact ? 10 : 14
    const ctx = gsap.context(() => {
      nodes.forEach((node, index) => {
        const offset = circularOffset(index, activeIndex, visibleCards.length)
        const depth = Math.abs(offset)
        const hidden = depth > 2
        gsap.killTweensOf(node)
        // Active on top; side cards dimmed/scaled so stack reads as a deck, not a single card
        gsap.set(node, {
          zIndex: 30 - depth,
          pointerEvents: depth === 0 ? "auto" : depth <= 2 ? "auto" : "none",
          opacity: hidden ? 0 : depth === 0 ? 1 : Math.max(0.42, 0.92 - depth * 0.22),
          xPercent: -50,
        })
        gsap.to(node, {
          x: offset * spacing,
          y: depth * fanLift,
          xPercent: -50,
          rotation: offset * (compact ? 7.2 : 8.5),
          scale: depth === 0 ? 1 : Math.max(0.78, 0.94 - depth * 0.07),
          duration: 0.58,
          ease: "power3.out",
          overwrite: true,
        })
      })
    }, rootRef)
    return () => ctx.revert()
  }, [activeIndex, compact, reducedMotion, visibleCards])

  const move = (direction: number) => setActiveIndex(current => (current + direction + visibleCards.length) % visibleCards.length)

  const controls = (
    <div className="fan-controls">
      <button type="button" onClick={() => move(-1)} aria-label="上一项推荐">←</button>
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
              aria-label={`${card.title}，${card.statusLabel || STATUS_COPY[status] || STATUS_COPY.locked}`}
              aria-current={active ? "true" : undefined}
              onClick={() => onCardSelect?.(card)}
            >
              <img src={card.imgUrl} alt={card.alt || card.title}/>
              <span className="fan-shade"/>
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
