import { useEffect, useMemo, useState } from "react"
import { ArrowUpRight, ChevronDown, Compass, MapPin, RotateCcw } from "lucide-react"
import type { AttractionCategoryL1, AttractionPreference, RankedAttraction } from "./types"

const CATEGORIES: Array<"全部" | AttractionCategoryL1> = ["全部", "户外极限", "超级工程", "网红奇观", "自然风光", "人文历史", "休闲露营"]
const KIND_LABELS = { must: "必玩", alternative: "高替", "easter-egg": "彩蛋" }

interface AttractionExplorerPanelProps {
  items: RankedAttraction[]
  total: number
  zoom: number
  preference: AttractionPreference
  category: "全部" | AttractionCategoryL1
  selectedId: string | null
  /** Hide niche tab when it has no unique content vs popular */
  showNicheToggle?: boolean
  onPreferenceChange: (preference: AttractionPreference) => void
  onCategoryChange: (category: "全部" | AttractionCategoryL1) => void
  onSelect: (item: RankedAttraction) => void
  onClearSelection: () => void
  onBack: () => void
  backLabel: string
}

export function AttractionExplorerPanel({
  items,
  total,
  zoom,
  preference,
  category,
  selectedId,
  showNicheToggle = true,
  onPreferenceChange,
  onCategoryChange,
  onSelect,
  onClearSelection,
  onBack,
  backLabel,
}: AttractionExplorerPanelProps) {
  const [expanded, setExpanded] = useState(false)
  const selectedIndex = useMemo(() => items.findIndex(item => item.id === selectedId), [items, selectedId])
  useEffect(() => {
    if (selectedIndex >= 3) setExpanded(true)
  }, [selectedIndex])
  useEffect(() => setExpanded(false), [preference, category])
  const visibleItems = expanded ? items.slice(0, 10) : items.slice(0, 3)
  const activePreference = showNicheToggle ? preference : "popular"

  return <aside className="attraction-explorer-panel" aria-label="景点探索列表">
    <button className="attraction-back" onClick={onBack}><span>←</span><b>{backLabel}</b><small>BACK</small></button>
    <header className="attraction-panel-head"><div><span>LOCAL PLAYBOOK · 4+2+X</span><b>景点探索</b><small>地图与列表实时联动 · Z{zoom.toFixed(1)}</small></div><i><Compass size={17}/></i></header>
    <div className={`attraction-controls ${showNicheToggle ? "" : "preference-solo"}`}>
      {showNicheToggle ? (
        <div className="preference-toggle" role="group" aria-label="热门或小众排序">
          <button className={activePreference === "popular" ? "active" : ""} onClick={() => onPreferenceChange("popular")}>热门必玩</button>
          <button className={activePreference === "niche" ? "active" : ""} onClick={() => onPreferenceChange("niche")}>小众高替</button>
        </div>
      ) : (
        <div className="preference-static" aria-label="当前排序">热门必玩</div>
      )}
      <label><span>分类</span><select value={category} onChange={event => onCategoryChange(event.target.value as "全部" | AttractionCategoryL1)}>{CATEGORIES.map(item => <option key={item}>{item}</option>)}</select><ChevronDown size={13}/></label>
    </div>
    {selectedId && <button className="attraction-reset" onClick={onClearSelection}><RotateCcw size={12}/>回到地区视野，继续查看全部锚点</button>}
    <div className="attraction-list" aria-live="polite">
      {visibleItems.map(item => <button data-attraction={item.id} className={`attraction-list-item kind-${item.selection_kind} ${selectedId === item.id ? "selected" : ""}`} onClick={() => onSelect(item)} key={item.id}>
        <img src={item.image_url} alt=""/>
        <span className="attraction-copy"><em>{KIND_LABELS[item.selection_kind]} · {String(item.selection_rank).padStart(2,"0")}</em><b>{item.name}<small>{item.name_en}</small></b><i>{item.category_l2} · {item.best_season}</i><span>{item.tags.slice(0, 2).map(tag => <small key={tag}>{tag}</small>)}</span></span>
        <strong>{activePreference === "popular" ? item.popularity_score : item.niche_score}<small>{activePreference === "popular" ? "HOT" : "NICHE"}</small></strong>
        <MapPin className="item-pin" size={15}/>
      </button>)}
      {!items.length && <div className="attraction-empty"><MapPin size={24}/><b>该地区暂无景点结果</b><p>已尝试 API → 爬虫（OSM/Wikipedia/官方站）→ 种子数据。稍后重试或切换地区。</p></div>}
    </div>
    {items.length > 0 && (
      <footer className="attraction-panel-foot">
        <div className="attraction-foot-row">
          {items.length > 3 ? (
            <button type="button" onClick={() => setExpanded(value => !value)}>{expanded ? "收起" : `展开 ${Math.min(items.length, 10)}`}<ChevronDown size={12}/></button>
          ) : (
            <span className="attraction-foot-count">{items.length} / {total}</span>
          )}
          {visibleItems[0]?.source_url && visibleItems[0].source_url !== "#" && (
            <a href={visibleItems[0].source_url} target="_blank" rel="noreferrer">来源 <ArrowUpRight size={11}/></a>
          )}
        </div>
      </footer>
    )}
  </aside>
}
