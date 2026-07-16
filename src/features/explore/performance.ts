export type GlobeQuality = "high" | "standard" | "low"
export type GlobeQualityPreference = "auto" | GlobeQuality

export function resolveGlobeQuality(preference: GlobeQualityPreference, deviceMemory?: number, hardwareConcurrency?: number): GlobeQuality {
  if (preference !== "auto") return preference
  if ((deviceMemory !== undefined && deviceMemory < 4) || (hardwareConcurrency !== undefined && hardwareConcurrency <= 2)) return "low"
  if (deviceMemory !== undefined && deviceMemory >= 8 && hardwareConcurrency !== undefined && hardwareConcurrency >= 8) return "high"
  return "standard"
}
