import { useEffect, useRef, useState } from "react"
import { MapPin, Mic, Search, X } from "lucide-react"
import { searchAtlas, type AtlasSearchItem } from "./search-index"

interface AtlasSearchOverlayProps {
  open: boolean
  query: string
  items: AtlasSearchItem[]
  recent: AtlasSearchItem[]
  onQueryChange: (value: string) => void
  onClose: () => void
  onSelect: (item: AtlasSearchItem) => void
}

const KIND_LABEL = { country: "国家", region: "旅行区域", poi: "目的地" }

export function AtlasSearchOverlay({ open, query, items, recent, onQueryChange, onClose, onSelect }: AtlasSearchOverlayProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [listening, setListening] = useState(false)
  useEffect(() => { if (open) window.setTimeout(() => inputRef.current?.focus(), 0) }, [open])
  if (!open) return null
  const startVoiceSearch = () => {
    const Recognition = (window as Window & { SpeechRecognition?: new () => { lang: string; interimResults: boolean; onresult: (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onerror: () => void; onend: () => void; start: () => void }; webkitSpeechRecognition?: new () => { lang: string; interimResults: boolean; onresult: (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onerror: () => void; onend: () => void; start: () => void } }).SpeechRecognition || (window as Window & { webkitSpeechRecognition?: new () => { lang: string; interimResults: boolean; onresult: (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onerror: () => void; onend: () => void; start: () => void } }).webkitSpeechRecognition
    if (!Recognition) return inputRef.current?.focus()
    const recognition = new Recognition()
    recognition.lang = "zh-CN"
    recognition.interimResults = false
    recognition.onresult = event => onQueryChange(event.results[0]?.[0]?.transcript || "")
    recognition.onerror = () => setListening(false)
    recognition.onend = () => setListening(false)
    setListening(true)
    recognition.start()
  }
  const results = searchAtlas(items, query)
  const visible = query.trim() ? results : recent
  return <div className="atlas-search-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="atlas-search archive-card" role="dialog" aria-modal="true" aria-label="搜索目的地" onMouseDown={event => event.stopPropagation()}>
      <header><Search size={18}/><input ref={inputRef} value={query} onChange={event => onQueryChange(event.target.value)} placeholder="搜索国家、旅行区域或目的地" aria-label="搜索国家、旅行区域或目的地"/><button type="button" onClick={startVoiceSearch} aria-label={listening ? "正在语音输入" : "语音输入"} aria-pressed={listening}><Mic size={18}/></button><button type="button" onClick={onClose} aria-label="关闭搜索"><X size={18}/></button></header>
      <p>{query.trim() ? `找到 ${results.length} 项` : recent.length ? "最近浏览" : "输入名称开始探索"}</p>
      <ul>{visible.map(item => <li key={item.id}><button type="button" onClick={() => onSelect(item)}><MapPin size={15}/><span><b>{item.label}</b><small>{item.context}</small></span><em>{KIND_LABEL[item.kind]}</em></button></li>)}</ul>
      {query.trim() && !results.length && <div className="atlas-search-empty">没有匹配结果。可以尝试国家、旅行区域或目的地名称。</div>}
    </section>
  </div>
}
