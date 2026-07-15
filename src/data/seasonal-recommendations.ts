export type TravelSeasonId = "spring" | "summer" | "autumn" | "winter"

export interface SeasonalRecommendation {
  id: string
  months: number[]
  continent: "亚洲" | "欧洲" | "大洋洲" | "北美"
  countryCode: string
  regionId: string
  defaultUnlocked?: boolean
  title: string
  location: string
  theme: string
  reason: string
  image: string
  score: number
  priority: number
}

export const TRAVEL_SEASONS: Array<{ id: TravelSeasonId; label: string; months: number[] }> = [
  { id: "spring", label: "春季", months: [3, 4, 5] },
  { id: "summer", label: "夏季", months: [6, 7, 8] },
  { id: "autumn", label: "秋季", months: [9, 10, 11] },
  { id: "winter", label: "冬季", months: [12, 1, 2] },
]

export const SEASON_CONTINENTS = ["全球", "亚洲", "欧洲", "大洋洲", "北美"] as const

export const SEASONAL_RECOMMENDATIONS: SeasonalRecommendation[] = [
  { id: "hokkaido-summer", months: [6, 7, 8], continent: "亚洲", countryCode: "JPN", regionId: "hokkaido", defaultUnlocked: true, title: "北海道 · 花田盛夏", location: "日本 / 富良野与美瑛", theme: "花田 · 轻徒步 · 亲子", reason: "薰衣草见顷，昼长且温度舒适", image: "https://www.visit-hokkaido.jp/lsc/upfile/spot/0001/0174/10174_1_l.jpg", score: 99, priority: 10 },
  { id: "iceland-midnight-sun", months: [6, 7, 8], continent: "欧洲", countryCode: "ISL", regionId: "south-iceland", title: "冰岛 · 午夜阳光", location: "冰岛 / 南岸环线", theme: "火山 · 冰川 · 自驾", reason: "近乎全天明亮，适合高密度环岛", image: "https://images.unsplash.com/photo-1504893524553-b855bce32c67?auto=format&fit=crop&w=900&q=88", score: 97, priority: 9 },
  { id: "swiss-alps", months: [6, 7, 8, 9], continent: "欧洲", countryCode: "CHE", regionId: "bernese-oberland", title: "瑞士 · 高山花径", location: "瑞士 / 伯尔尼高地", theme: "徒步 · 湖泊 · 山地列车", reason: "高山步道开放，野花与雪峰同框", image: "https://images.unsplash.com/photo-1527668752968-14dc70a27c95?auto=format&fit=crop&w=900&q=88", score: 96, priority: 8 },
  { id: "norway-fjords", months: [5, 6, 7, 8, 9], continent: "欧洲", countryCode: "NOR", regionId: "west-fjords", title: "挪威 · 峡湾公路", location: "挪威 / 松恩峡湾", theme: "峡湾 · 公路 · 轻徒步", reason: "山路通行稳定，瀑布进入丰水期", image: "https://images.unsplash.com/photo-1507272931001-fc06c17e4f43?auto=format&fit=crop&w=900&q=88", score: 94, priority: 7 },
  { id: "bali-dry", months: [5, 6, 7, 8, 9], continent: "亚洲", countryCode: "IDN", regionId: "bali", title: "巴厘岛 · 旱季海风", location: "印度尼西亚 / 巴厘岛", theme: "潜水 · 火山 · 海岸", reason: "降水少、海况清澈，适合亲水活动", image: "https://images.unsplash.com/photo-1539367628448-4bc5c9d171c8?auto=format&fit=crop&w=900&q=88", score: 92, priority: 6 },
  { id: "queensland-dry", months: [6, 7, 8], continent: "大洋洲", countryCode: "AUS", regionId: "queensland-tropics", title: "昆士兰 · 珊瑚海旱季", location: "澳大利亚 / 大堡礁", theme: "潜水 · 雨林 · 海岛", reason: "湿度较低且海况相对稳定，适合礁区活动", image: "https://images.unsplash.com/photo-1587139223877-04cb899fa3e8?auto=format&fit=crop&w=900&q=88", score: 95, priority: 8 },
  { id: "iceland-aurora", months: [9, 10, 11, 12, 1, 2, 3], continent: "欧洲", countryCode: "ISL", regionId: "south-iceland", title: "冰岛 · 极光季", location: "冰岛 / 雷克雅未克与南岸", theme: "极光 · 冰洞 · 温泉", reason: "长夜与低光污染带来稳定观测窗口", image: "https://images.unsplash.com/photo-1483347756197-71ef80e95f73?auto=format&fit=crop&w=900&q=88", score: 98, priority: 10 },
  { id: "japan-sakura", months: [3, 4], continent: "亚洲", countryCode: "JPN", regionId: "kansai", defaultUnlocked: true, title: "关西 · 樱花古都", location: "日本 / 京都与奈良", theme: "古都 · 骑行 · 花见", reason: "樱花前线进入关西，古寺庭院盛放", image: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=900&q=88", score: 98, priority: 10 },
  { id: "xinjiang-autumn", months: [9, 10], continent: "亚洲", countryCode: "CHN", regionId: "xinjiang", defaultUnlocked: true, title: "新疆 · 金色北疆", location: "中国 / 阿勒泰", theme: "自驾 · 徒步 · 森林", reason: "白桦转金，牧场进入低密度季节", image: "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=900&q=88", score: 97, priority: 9 },
  { id: "new-zealand", months: [11, 12, 1, 2, 3], continent: "大洋洲", countryCode: "NZL", regionId: "south-island", title: "新西兰 · 南岛长昼", location: "新西兰 / 皇后镇", theme: "雪山 · 湖泊 · 房车", reason: "南半球盛夏，山湖线路完整开放", image: "https://images.unsplash.com/photo-1469521669194-babb45599def?auto=format&fit=crop&w=900&q=88", score: 96, priority: 8 },
  { id: "tuscany-spring", months: [4, 5, 6, 9, 10], continent: "欧洲", countryCode: "ITA", regionId: "tuscany", title: "托斯卡纳 · 丘陵花季", location: "意大利 / 奥尔恰谷", theme: "古城 · 骑行 · 美食", reason: "丘陵色彩层次丰富，乡村道路适合慢游", image: "https://images.unsplash.com/photo-1529260830199-42c24126f198?auto=format&fit=crop&w=900&q=88", score: 95, priority: 8 },
  { id: "california-coast", months: [3, 4, 5, 6, 9, 10], continent: "北美", countryCode: "USA", regionId: "west-coast", title: "加州 · 一号公路", location: "美国 / 太平洋海岸", theme: "自驾 · 红杉 · 海岸", reason: "避开盛夏拥堵，海岸雾与日落更具层次", image: "https://images.unsplash.com/photo-1515894347712-4d9164b20c6c?auto=format&fit=crop&w=900&q=88", score: 94, priority: 7 },
  { id: "canada-rockies", months: [6, 7, 8, 9, 10], continent: "北美", countryCode: "CAN", regionId: "canadian-rockies", title: "加拿大 · 落基山秋色", location: "加拿大 / 班夫与贾斯珀", theme: "湖泊 · 徒步 · 自驾", reason: "高山湖泊开放，九月落叶松进入金黄期", image: "https://images.unsplash.com/photo-1503614472-8c93d56e92ce?auto=format&fit=crop&w=900&q=88", score: 96, priority: 9 },
  { id: "hokkaido-powder", months: [12, 1, 2, 3], continent: "亚洲", countryCode: "JPN", regionId: "hokkaido", defaultUnlocked: true, title: "北海道 · 粉雪季", location: "日本 / 留寿都与二世古", theme: "滑雪 · 温泉 · 亲子", reason: "雪场稳定开放，粉雪与温泉形成完整体验", image: "https://www.visit-hokkaido.jp/lsc/upfile/spot/0001/0331/10331_5_l.jpg", score: 99, priority: 10 },
  { id: "rockies-winter", months: [12, 1, 2, 3], continent: "北美", countryCode: "USA", regionId: "rockies", title: "落基山 · 雪原季", location: "美国 / 怀俄明与科罗拉多", theme: "滑雪 · 温泉 · 雪地公路", reason: "高山雪场进入主季，冬季景观完整", image: "https://images.unsplash.com/photo-1486911278844-a81c5267e227?auto=format&fit=crop&w=900&q=88", score: 95, priority: 8 },
  { id: "thailand-andaman", months: [11, 12, 1, 2, 3], continent: "亚洲", countryCode: "THA", regionId: "andaman-coast", title: "泰南 · 安达曼海", location: "泰国 / 普吉与甲米", theme: "海岛 · 潜水 · 亲子", reason: "东北季风带来较少降雨与更稳定海况", image: "https://images.unsplash.com/photo-1506665531195-3566af2b4dfa?auto=format&fit=crop&w=900&q=88", score: 93, priority: 7 },
]

export const MONTH_NAMES = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]

export function getSeasonForDate(date = new Date()): TravelSeasonId {
  const month = date.getMonth() + 1
  return TRAVEL_SEASONS.find(season => season.months.includes(month))?.id || "summer"
}

export function getSeasonalRecommendations(season: TravelSeasonId, continent: string = "全球") {
  const months = TRAVEL_SEASONS.find(item => item.id === season)?.months || []
  return SEASONAL_RECOMMENDATIONS
    .filter(item => item.months.some(month => months.includes(month)))
    .filter(item => continent === "全球" || item.continent === continent)
    .sort((a, b) => b.priority - a.priority || b.score - a.score)
}

export function getDestinationKey(item: Pick<SeasonalRecommendation, "countryCode" | "regionId">) {
  return `${item.countryCode}:${item.regionId}`
}
