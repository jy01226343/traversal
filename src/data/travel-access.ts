/**
 * Travel access rules by passport nationality (V1 demo matrix).
 * Domestic destinations and short-stay visa-free targets skip the unlock modal.
 * Rules are simplified product data — not legal immigration advice.
 */

export type AccessTier = "domestic" | "visa_free" | "already_unlocked" | "requires_unlock"

export interface TravelAccessResult {
  free: boolean
  tier: AccessTier
  label: string
}

/** Destination country codes that each passport can enter without a classic visa (short tourism). */
const VISA_FREE_BY_PASSPORT: Record<string, readonly string[]> = {
  // Chinese ordinary passport — common short-stay exemptions / free VOA used in demo
  CHN: ["THA", "IDN", "MAR", "FJI"],
  // Japanese passport — strong global access among demo destinations
  JPN: [
    "THA", "IDN", "KOR", "SGP", "MYS", "AUS", "NZL", "USA", "CAN", "MEX", "CRI",
    "FRA", "ITA", "ESP", "CHE", "NOR", "ISL", "GBR", "ARG", "PER", "BRA", "CHL",
    "ZAF", "MAR", "EGY", "KEN", "TZA", "FJI",
  ],
  // US passport
  USA: [
    "JPN", "KOR", "THA", "IDN", "AUS", "NZL", "CAN", "MEX", "CRI",
    "FRA", "ITA", "ESP", "CHE", "NOR", "ISL", "GBR", "ARG", "PER", "BRA", "CHL",
    "ZAF", "MAR", "EGY", "KEN", "TZA", "FJI",
  ],
  // French / Schengen passport
  FRA: [
    "JPN", "KOR", "THA", "IDN", "AUS", "NZL", "USA", "CAN", "MEX", "CRI",
    "ITA", "ESP", "CHE", "NOR", "ISL", "GBR", "ARG", "PER", "BRA", "CHL",
    "ZAF", "MAR", "EGY", "KEN", "TZA", "FJI",
  ],
  // Australian passport
  AUS: [
    "JPN", "KOR", "THA", "IDN", "NZL", "USA", "CAN", "MEX", "CRI",
    "FRA", "ITA", "ESP", "CHE", "NOR", "ISL", "GBR", "ARG", "PER", "BRA", "CHL",
    "ZAF", "MAR", "EGY", "KEN", "TZA", "FJI",
  ],
}

const TIER_LABEL: Record<AccessTier, string> = {
  domestic: "本国开放",
  visa_free: "免签开放",
  already_unlocked: "已点亮",
  requires_unlock: "需准备解锁",
}

/**
 * Destinations that, although administered by the passport holder's own country,
 * still require an extra travel permit / endorsement to enter. For a Chinese
 * ordinary passport this is the Hong Kong & Macao travel permit (往来港澳通行证).
 * Keyed by destination key (`countryCode:regionId`).
 */
const PERMIT_REQUIRED: ReadonlySet<string> = new Set([
  "CHN:greater-bay-area",
])

export function isDomesticDestination(destinationCountryCode: string, passportCode?: string | null) {
  if (!passportCode) return false
  return destinationCountryCode.toUpperCase() === passportCode.toUpperCase()
}

export function isVisaFreeDestination(destinationCountryCode: string, passportCode?: string | null) {
  if (!passportCode) return false
  const list = VISA_FREE_BY_PASSPORT[passportCode.toUpperCase()]
  if (!list) return false
  return list.includes(destinationCountryCode.toUpperCase())
}

export function resolveTravelAccess(input: {
  destinationCountryCode: string
  destinationKey: string
  passportCode?: string | null
  unlockedKeys?: string[]
}): TravelAccessResult {
  const dest = input.destinationCountryCode.toUpperCase()
  const passport = input.passportCode?.toUpperCase() || null
  const unlocked = input.unlockedKeys || []

  if (unlocked.includes(input.destinationKey)) {
    return { free: true, tier: "already_unlocked", label: TIER_LABEL.already_unlocked }
  }
  // Domestic destinations that nonetheless require an extra travel permit
  // (e.g. HK/Macao permit for mainland residents) gate behind the unlock flow.
  if (passport && dest === passport && PERMIT_REQUIRED.has(input.destinationKey)) {
    return { free: false, tier: "requires_unlock", label: "需港澳通行证" }
  }
  if (passport && dest === passport) {
    return { free: true, tier: "domestic", label: TIER_LABEL.domestic }
  }
  if (passport && isVisaFreeDestination(dest, passport)) {
    return { free: true, tier: "visa_free", label: TIER_LABEL.visa_free }
  }
  return { free: false, tier: "requires_unlock", label: TIER_LABEL.requires_unlock }
}

/** Country-level free entry for map fog / progress (domestic or visa-free). */
export function isCountryFreeAccess(countryCode: string, passportCode?: string | null) {
  return isDomesticDestination(countryCode, passportCode) || isVisaFreeDestination(countryCode, passportCode)
}
