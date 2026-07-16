import { useState } from "react"
import type { SemanticFilterProvider } from "./semantic-filter"

interface SemanticFilterInputProps {
  provider: SemanticFilterProvider
  currentRegionId?: string
}

export function SemanticFilterInput({ provider, currentRegionId }: SemanticFilterInputProps) {
  const [query, setQuery] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const parse = async () => {
    if (!query.trim()) return
    setLoading(true); setMessage(null)
    try {
      const result = await provider.parse(query, { locale: "zh-CN", currentRegionId, availableFilterSchema: { experiences: [], travelers: [], month: 1, transportDifficultyMax: "high", stayDuration: "one_day" } })
      setMessage(result.confidence >= 0.8 ? "解析结果需要接入现有筛选条件后方可应用。" : "理解置信度不足，请继续使用手动筛选。")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "语义筛选暂不可用，请使用手动筛选")
    } finally { setLoading(false) }
  }
  return <div className="semantic-filter"><label>描述你想去的地方<input value={query} onChange={event => setQuery(event.target.value)} placeholder="例如：适合带 3 岁孩子、7 月看花海"/></label><button type="button" onClick={() => void parse()} disabled={loading}>{loading ? "解析中" : "理解条件"}</button>{message && <p>{message}</p>}</div>
}
