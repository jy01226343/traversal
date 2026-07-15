import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
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
  status?: "locked" | "unlocked"
}

interface CardFanCarouselProps {
  cards: FanCardItem[]
  onCardSelect?: (card: FanCardItem) => void
}

function circularOffset(index: number, activeIndex: number, length: number) {
  let offset = index - activeIndex
  if (offset > length / 2) offset -= length
  if (offset < -length / 2) offset += length
  return offset
}

export function CardFanCarousel({ cards, onCardSelect }: CardFanCarouselProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [compact, setCompact] = useState(() => typeof window !== "undefined" && window.innerWidth < 760)
  const visibleCards = useMemo(() => cards, [cards])

  useEffect(() => {
    const sync = () => setCompact(window.innerWidth < 760)
    window.addEventListener("resize", sync)
    return () => window.removeEventListener("resize", sync)
  }, [])

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

  return (
    <div className="seasonal-fan" ref={rootRef}>
      <div className="fan-stack" role="list" aria-label="当季旅行推荐">
        {visibleCards.map((card, index) => {
          const offset = circularOffset(index, activeIndex, visibleCards.length)
          const active = offset === 0
          return <button
            type="button"
            className={`fan-card ${active ? "is-active" : ""}`}
            aria-label={`${card.title}，推荐指数 ${card.score}`}
            aria-current={active ? "true" : undefined}
            onClick={() => onCardSelect?.(card)}
            key={card.id}
          >
            <img src={card.imgUrl} alt={card.alt || card.title}/>
            <span className="fan-shade"/>
            <span className="fan-score"><small>SEASON FIT</small><b>{card.score}</b></span>
            <span className={`fan-access ${card.status || "locked"}`}>{card.status === "unlocked" ? "已解锁 · 进入地图" : "未解锁 · 查看条件"}</span>
            <span className="fan-copy"><small>{card.kicker}</small><b>{card.title}</b><em>{card.location}</em><i>{card.summary}</i></span>
          </button>
        })}
      </div>
      <div className="fan-controls">
        <button type="button" onClick={() => move(-1)} aria-label="上一项推荐">←</button>
        <span>{String(activeIndex + 1).padStart(2, "0")} / {String(visibleCards.length).padStart(2, "0")}</span>
        <button type="button" onClick={() => move(1)} aria-label="下一项推荐">→</button>
      </div>
    </div>
  )
}
