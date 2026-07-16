export interface DestinationFilters {
  experiences?: string[]
  travelers?: string[]
  month?: number
  transportDifficultyMax?: "low" | "medium" | "high"
  stayDuration?: "half_day" | "one_day" | "two_days_plus"
}

export interface SemanticFilterParseResult {
  filters: DestinationFilters
  confidence: number
  unsupportedTerms: string[]
  explanation?: string
}

export interface SemanticFilterProvider {
  parse(query: string, context: { locale: string; currentRegionId?: string; availableFilterSchema: DestinationFilters }): Promise<SemanticFilterParseResult>
}

/** Deliberate safe default: no natural-language interpretation without a provider. */
export const unavailableSemanticFilterProvider: SemanticFilterProvider = {
  async parse() { throw new Error("AI 语义筛选服务尚未配置，请使用手动筛选") },
}

export function canApplySemanticFilters(result: SemanticFilterParseResult) {
  return result.confidence >= 0.8 && Object.keys(result.filters).length > 0
}
