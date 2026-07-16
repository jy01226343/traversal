import { useEffect, useMemo, useState } from "react"
import { ArrowUpRight, ChevronDown, Compass, MapPin, RotateCcw, type LucideIcon } from "lucide-react"
import type { AttractionCategoryL1, AttractionPreference, RankedAttraction } from "./types"
import { EXPERIENCE_FILTERS, type AttractionExperience } from "./manual-filters"
import { tagIcon } from "./icons"
import { SemanticFilterInput } from "@/features/semantic-filter/SemanticFilterInput"
import { unavailableSemanticFilterProvider } from "@/features/semantic-filter/semantic-filter"

const CATEGORIES: Array<"全部" | AttractionCategoryL1> = ["全部", "户外极限", "超级工程", "网红奇观", "自然风光", "人文历史", "休闲露营"]
const KIND_LABELS = { must: "值得专程", alternative: "适合顺路发现", "easter-egg": "小众发现" }

/** 渲染标签的 Lucide 图标 */
function TagIcon({ tag }: { tag: string }) {
  const Icon = tagIcon(tag) as LucideIcon
  return <Icon size={11} strokeWidth={2} />
}

interface AttractionExplorerPanelProps {
  items: RankedAttraction[]
  total: number
  zoom: number
  preference: AttractionPreference
  category: "全部" | AttractionCategoryL1
  experiences: AttractionExperience[]
  selectedId: string | null
  hoveredId: string | null
  comparedIds: string[]
  semanticFilterEnabled?: boolean
  currentRegionId?: string
  /** Hide niche tab when it has no unique content vs popular */
  showNicheToggle?: boolean
  onPreferenceChange: (preference: AttractionPreference) => void
  onCategoryChange: (category: "全部" | AttractionCategoryL1) => void
  onExperienceToggle: (experience: AttractionExperience) => void
  onClearExperiences: () => void
  onSelect: (item: RankedAttraction) => void
  onHoverChange: (id: string | null) => void
  onCompareToggle: (id: string) => void
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
  experiences,
  selectedId,
  hoveredId,
  comparedIds,
  semanticFilterEnabled = false,
  currentRegionId,
  showNicheToggle = true,
  onPreferenceChange,
  onCategoryChange,
  onExperienceToggle,
  onClearExperiences,
  onSelect,
  onHoverChange,
  onCompareToggle,
  onClearSelection,
  onBack,
  backLabel,
}: AttractionExplorerPanelProps) {
  const [expanded, setExpanded] = useState(false)
  const [sheetPercent, setSheetPercent] = useState<25 | 55 | 90>(25)
  const selectedIndex = useMemo(() => items.findIndex(item => item.id === selectedId), [items, selectedId])
  useEffect(() => {
    if (selectedIndex >= 3) setExpanded(true)
  }, [selectedIndex])
  useEffect(() => setExpanded(false), [preference, category])
  useEffect(() => { if (selectedId) setSheetPercent(55) }, [selectedId])
  useEffect(() => {
    if (!selectedId) return
    const item = document.querySelector<HTMLElement>(`[data-attraction="${CSS.escape(selectedId)}"]`)
    item?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" })
  }, [selectedId])
  const visibleItems = expanded ? items.slice(0, 10) : items.slice(0, 3)
  const activePreference = showNicheToggle ? preference : "popular"

  return <aside className={`attraction-explorer-panel sheet-${sheetPercent}`} aria-label="景点探索列表">
    <div className="mobile-sheet-stops" role="group" aria-label="地图信息抽屉高度">
      {([25, 55, 90] as const).map(percent => <button key={percent} type="button" className={sheetPercent === percent ? "active" : ""} onClick={() => setSheetPercent(percent)} aria-pressed={sheetPercent === percent}>{percent}%</button>)}
    </div>
    <button className="attraction-back" onClick={onBack}><span>←</span><b>{backLabel}</b></button>
    <header className="attraction-panel-head"><div><span>LOCAL PLAYBOOK · 4+2+X</span><b>景点探索</b><small>地图与列表实时联动 · Z{zoom.toFixed(1)}</small></div><i><Compass size={17}/></i></header>
    <div className={`attraction-controls ${showNicheToggle ? "" : "preference-solo"}`}>
      {showNicheToggle ? (
        <div className="preference-toggle" role="group" aria-label="浏览偏好">
          <button className={activePreference === "popular" ? "active" : ""} onClick={() => onPreferenceChange("popular")}>值得专程</button>
          <button className={activePreference === "niche" ? "active" : ""} onClick={() => onPreferenceChange("niche")}>小众发现</button>
        </div>
      ) : (
        <div className="preference-static" aria-label="当前浏览偏好">值得专程</div>
      )}
      <label><span>分类</span><select value={category} onChange={event => onCategoryChange(event.target.value as "全部" | AttractionCategoryL1)}>{CATEGORIES.map(item => <option key={item}>{item}</option>)}</select><ChevronDown size={13}/></label>
    </div>
    <div className="experience-filter" aria-label="我想体验"><span>我想体验</span><div>{EXPERIENCE_FILTERS.map(experience => <button type="button" key={experience} className={experiences.includes(experience) ? "active" : ""} onClick={() => onExperienceToggle(experience)} aria-pressed={experiences.includes(experience)}>{experience}</button>)}{experiences.length > 0 && <button type="button" className="clear" onClick={onClearExperiences}>清除</button>}</div></div>
    {semanticFilterEnabled && <SemanticFilterInput provider={unavailableSemanticFilterProvider} currentRegionId={currentRegionId}/>}
    {selectedId && <button className="attraction-reset" onClick={onClearSelection}><RotateCcw size={12}/>回到地区视野，继续查看全部锚点</button>}
    <div className="attraction-list" aria-live="polite">
      {visibleItems.map(item => <div className="attraction-list-entry" key={item.id}><button data-attraction={item.id} className={`attraction-list-item kind-${item.selection_kind} ${selectedId === item.id ? "selected" : ""} ${hoveredId === item.id ? "is-external-hover" : ""}`} onClick={() => onSelect(item)} onMouseEnter={() => onHoverChange(item.id)} onMouseLeave={() => onHoverChange(null)} onFocus={() => onHoverChange(item.id)} onBlur={() => onHoverChange(null)}>
        <img src={item.image_url} alt=""/>
        <span className="attraction-copy"><em>{KIND_LABELS[item.selection_kind]}</em><b>{item.name}<small>{item.name_en}</small></b><i>{item.category_l2} · {item.best_season}</i><span>{item.tags.slice(0, 2).map(tag => <small key={tag}><TagIcon tag={tag} />{tag}</small>)}</span></span>
        <MapPin className="item-pin" size={15}/>
      </button><button type="button" className={`attraction-compare-toggle ${comparedIds.includes(item.id) ? "is-on" : ""}`} onClick={() => onCompareToggle(item.id)} aria-pressed={comparedIds.includes(item.id)}>{comparedIds.includes(item.id) ? "已比较" : "比较"}</button></div>)}
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
