/**
 * 场景画布：持有 <canvas> 元素引用并上报给 ImmersiveExperience（SceneController.mount 的挂载点）。
 * 画布为纯视觉层，等价信息由 FallbackInfoView / InfoPanel 提供（§12.1），故整体 aria-hidden。
 *
 * V1.2：ix-stage__backdrop 渲染实景照片组（data/scene-photos.ts），
 * 9 秒交叉淡入轮播 + Ken Burns 缓慢推近；reducedMotion 时静止首帧。
 * 照片经 ix-stage__photo-shade 压暗，保证空间标签与 UI 可读。
 */

import { useEffect, useRef, useState } from "react"
import type { ScenePhoto } from "../data/scene-photos"

export interface SceneCanvasProps {
  onCanvasChange: (canvas: HTMLCanvasElement | null) => void
  photos?: readonly ScenePhoto[]
  reducedMotion?: boolean
}

const ROTATE_MS = 9000

export function SceneCanvas({ onCanvasChange, photos = [], reducedMotion = false }: SceneCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    onCanvasChange(canvasRef.current)
    return () => onCanvasChange(null)
  }, [onCanvasChange])

  useEffect(() => {
    setActiveIndex(0)
    if (reducedMotion || photos.length < 2) return
    const timer = setInterval(() => setActiveIndex(index => (index + 1) % photos.length), ROTATE_MS)
    return () => clearInterval(timer)
  }, [photos, reducedMotion])

  const activePhoto = photos[Math.min(activeIndex, photos.length - 1)] ?? null

  return (
    <div className="ix-stage" aria-hidden="true">
      <div className="ix-stage__backdrop">
        {photos.map((photo, index) => (
          <img
            key={photo.src}
            src={photo.src}
            alt=""
            draggable={false}
            loading={index === 0 ? "eager" : "lazy"}
            className={`ix-stage__photo${index === activeIndex ? " is-active" : ""}${reducedMotion ? " is-static" : ""}`}
          />
        ))}
        {photos.length > 0 && <div className="ix-stage__photo-shade" />}
        {activePhoto && (
          <span className="ix-stage__credit">
            {activePhoto.caption} · {activePhoto.credit}
          </span>
        )}
      </div>
      <canvas ref={canvasRef} className="ix-stage__canvas" data-testid="ix-scene-canvas" />
    </div>
  )
}
