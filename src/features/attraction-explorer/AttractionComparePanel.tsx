import { X } from "lucide-react"
import type { Attraction } from "./types"

export function AttractionComparePanel({ items, onRemove }: { items: Attraction[]; onRemove: (id: string) => void }) {
  if (items.length < 2) return null
  return <aside className="attraction-compare archive-card" aria-label="目的地对比">
    <header><span>COMPARE · 2–3</span><b>并列比较</b></header>
    <div className="attraction-compare-grid">{items.map(item => <article key={item.id}><button type="button" onClick={() => onRemove(item.id)} aria-label={`移除 ${item.name}`}><X size={13}/></button><img src={item.image_url} alt=""/><b>{item.name}</b><small>{item.category_l2}</small><dl><div><dt>适合季节</dt><dd>{item.best_season}</dd></div><div><dt>开放信息</dt><dd>{item.opening_hours}</dd></div><div><dt>参考费用</dt><dd>{item.price}</dd></div></dl></article>)}</div>
  </aside>
}
