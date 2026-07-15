/**
 * 当季推荐数据：文案与窗口参考各国/地区官方旅游局及权威地理媒体的公开指南。
 * 评分用于产品排序，非 OTA 评分。图片优先官方旅游站，其次权威媒体图库。
 */
export type TravelSeasonId = "spring" | "summer" | "autumn" | "winter"

export type RecommendationGrade = "S" | "A" | "B"

export interface SeasonalRecommendation {
  id: string
  months: number[]
  continent: "亚洲" | "欧洲" | "大洋洲" | "北美" | "南美" | "非洲"
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
  /** 推荐等级：S 世界级 / A 国家代表 / B 特色线路 */
  grade: RecommendationGrade
  /** 权威来源（旅游局 / 国家地理类公开指南） */
  sourceLabel: string
  sourceUrl: string
  verifiedAt: string
  bestSeasonLabel: string
  difficulty: 1 | 2 | 3 | 4 | 5
  destinationType: "山峰" | "湖泊" | "城市" | "海岛" | "公路" | "遗址" | "草原" | "沙漠" | "峡湾" | "花田"
}

export const TRAVEL_SEASONS: Array<{ id: TravelSeasonId; label: string; months: number[] }> = [
  { id: "spring", label: "春季", months: [3, 4, 5] },
  { id: "summer", label: "夏季", months: [6, 7, 8] },
  { id: "autumn", label: "秋季", months: [9, 10, 11] },
  { id: "winter", label: "冬季", months: [12, 1, 2] },
]

export const SEASON_CONTINENTS = ["全球", "亚洲", "欧洲", "大洋洲", "北美", "南美", "非洲"] as const

const V = "2026-07-15"

export const SEASONAL_RECOMMENDATIONS: SeasonalRecommendation[] = [
  // —— 亚洲 ——
  {
    id: "hokkaido-summer", months: [6, 7, 8], continent: "亚洲", countryCode: "JPN", regionId: "hokkaido", defaultUnlocked: true,
    title: "北海道 · 花田盛夏", location: "日本 / 富良野与美瑛", theme: "花田 · 轻徒步 · 亲子",
    reason: "北海道官方旅游局将富良野—美瑛列为夏季花田核心区；薰衣草与彩色花带通常 7 月前后进入盛花，昼长且气温宜亲子慢游。",
    image: "https://www.visit-hokkaido.jp/lsc/upfile/spot/0001/0174/10174_1_l.jpg",
    score: 99, priority: 10, grade: "S",
    sourceLabel: "HOKKAIDO LOVE! · 北海道官方旅游", sourceUrl: "https://www.visit-hokkaido.jp/en/spot/detail_10174.html", verifiedAt: V,
    bestSeasonLabel: "06—08 月", difficulty: 2, destinationType: "花田",
  },
  {
    id: "japan-sakura", months: [3, 4], continent: "亚洲", countryCode: "JPN", regionId: "kinki", defaultUnlocked: true,
    title: "近畿 · 樱花古都", location: "日本 / 京都与奈良", theme: "古都 · 骑行 · 花见",
    reason: "日本国家旅游局（JNTO）将京都—奈良列为春季樱花经典线路；樱花前线通常 3 月下旬至 4 月上旬进入近畿，古寺庭院为观花核心。",
    image: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=900&q=88",
    score: 98, priority: 10, grade: "S",
    sourceLabel: "日本国家旅游局 JNTO", sourceUrl: "https://www.japan.travel/en/uk/inspiration/cherry-blossom-forecast/", verifiedAt: V,
    bestSeasonLabel: "03—04 月", difficulty: 2, destinationType: "城市",
  },
  {
    id: "hokkaido-powder", months: [12, 1, 2, 3], continent: "亚洲", countryCode: "JPN", regionId: "hokkaido", defaultUnlocked: true,
    title: "北海道 · 粉雪季", location: "日本 / 留寿都与二世古", theme: "滑雪 · 温泉 · 亲子",
    reason: "北海道官方站点持续将道央—道南雪场列为世界级粉雪目的地；12—3 月雪季稳定，雪场与温泉组合为官方主推冬日体验。",
    image: "https://www.visit-hokkaido.jp/lsc/upfile/spot/0001/0331/10331_5_l.jpg",
    score: 99, priority: 10, grade: "S",
    sourceLabel: "HOKKAIDO LOVE! · 雪场指南", sourceUrl: "https://www.visit-hokkaido.jp/en/spot/detail_10331.html", verifiedAt: V,
    bestSeasonLabel: "12—03 月", difficulty: 3, destinationType: "山峰",
  },
  {
    id: "xinjiang-autumn", months: [9, 10], continent: "亚洲", countryCode: "CHN", regionId: "northwest", defaultUnlocked: true,
    title: "西北 · 金色北疆", location: "中国 / 阿勒泰—喀纳斯", theme: "自驾 · 徒步 · 森林",
    reason: "新疆文旅部门与国内权威地理媒体常将 9—10 月列为北疆秋色窗口：白桦转金、牧场人流回落，喀纳斯—禾木—阿勒泰公路景观层次最完整。",
    image: "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=900&q=88",
    score: 97, priority: 9, grade: "S",
    sourceLabel: "新疆维吾尔自治区文化和旅游厅", sourceUrl: "https://wlt.xinjiang.gov.cn/", verifiedAt: V,
    bestSeasonLabel: "09—10 月", difficulty: 3, destinationType: "公路",
  },
  {
    id: "thailand-andaman", months: [11, 12, 1, 2, 3], continent: "亚洲", countryCode: "THA", regionId: "south-th",
    title: "泰南 · 安达曼海", location: "泰国 / 普吉—甲米—攀牙", theme: "海岛 · 潜水 · 亲子",
    reason: "泰国国家旅游局（TAT）将 11—4 月列为安达曼海岸旺季：东北季风带来更稳定海况，官方海岛与海洋国家公园开放窗口集中。",
    image: "https://images.unsplash.com/photo-1506665531195-3566af2b4dfa?auto=format&fit=crop&w=900&q=88",
    score: 93, priority: 7, grade: "A",
    sourceLabel: "Tourism Authority of Thailand", sourceUrl: "https://www.tourismthailand.org/", verifiedAt: V,
    bestSeasonLabel: "11—03 月", difficulty: 2, destinationType: "海岛",
  },
  {
    id: "bali-dry", months: [5, 6, 7, 8, 9], continent: "亚洲", countryCode: "IDN", regionId: "bali-nt",
    title: "巴厘 · 旱季海风", location: "印度尼西亚 / 巴厘与努沙登加拉", theme: "潜水 · 火山 · 海岸",
    reason: "印尼官方旅游站 Wonderful Indonesia 将 5—9 月视为巴厘—龙目一带相对旱季：降水偏少、能见度与海况更利于潜水与海岸活动。",
    image: "https://images.unsplash.com/photo-1539367628448-4bc5c9d171c8?auto=format&fit=crop&w=900&q=88",
    score: 92, priority: 6, grade: "A",
    sourceLabel: "Wonderful Indonesia", sourceUrl: "https://www.indonesia.travel/", verifiedAt: V,
    bestSeasonLabel: "05—09 月", difficulty: 2, destinationType: "海岛",
  },

  // —— 欧洲 ——
  {
    id: "iceland-midnight-sun", months: [6, 7, 8], continent: "欧洲", countryCode: "ISL", regionId: "south-iceland",
    title: "冰岛 · 午夜阳光", location: "冰岛 / 南岸环线", theme: "火山 · 冰川 · 自驾",
    reason: "Visit Iceland 将夏季午夜阳光列为国家级体验窗口；南岸环线在 6—8 月可近乎全天进行高密度自驾与短途徒步。",
    image: "https://images.unsplash.com/photo-1504893524553-b855bce32c67?auto=format&fit=crop&w=900&q=88",
    score: 97, priority: 9, grade: "S",
    sourceLabel: "Visit Iceland", sourceUrl: "https://www.visiticeland.com/", verifiedAt: V,
    bestSeasonLabel: "06—08 月", difficulty: 3, destinationType: "公路",
  },
  {
    id: "iceland-aurora", months: [9, 10, 11, 12, 1, 2, 3], continent: "欧洲", countryCode: "ISL", regionId: "south-iceland",
    title: "冰岛 · 极光季", location: "冰岛 / 雷克雅未克与南岸", theme: "极光 · 冰洞 · 温泉",
    reason: "冰岛官方与 SafeTravel 均强调秋冬长夜与低光污染走廊；9 月至 3 月为极光观测主窗口，南岸与雷区为高频路线。",
    image: "https://images.unsplash.com/photo-1483347756197-71ef80e95f73?auto=format&fit=crop&w=900&q=88",
    score: 98, priority: 10, grade: "S",
    sourceLabel: "Visit Iceland / SafeTravel", sourceUrl: "https://www.visiticeland.com/", verifiedAt: V,
    bestSeasonLabel: "09—03 月", difficulty: 3, destinationType: "公路",
  },
  {
    id: "swiss-alps", months: [6, 7, 8, 9], continent: "欧洲", countryCode: "CHE", regionId: "alpine-ch",
    title: "瑞士 · 高山花径", location: "瑞士 / 伯尔尼高地", theme: "徒步 · 湖泊 · 山地列车",
    reason: "瑞士国家旅游局（Switzerland Tourism）将 6—9 月列为高山步道主季：雪线退、缆车与山湖线路完整开放，少女峰—劳特布龙嫩为官方核心。",
    image: "https://images.unsplash.com/photo-1527668752968-14dc70a27c95?auto=format&fit=crop&w=900&q=88",
    score: 96, priority: 8, grade: "S",
    sourceLabel: "Switzerland Tourism", sourceUrl: "https://www.myswitzerland.com/en/", verifiedAt: V,
    bestSeasonLabel: "06—09 月", difficulty: 3, destinationType: "山峰",
  },
  {
    id: "norway-fjords", months: [5, 6, 7, 8, 9], continent: "欧洲", countryCode: "NOR", regionId: "west-no",
    title: "挪威 · 峡湾公路", location: "挪威 / 松恩—盖朗厄尔", theme: "峡湾 · 公路 · 轻徒步",
    reason: "Visit Norway 与 Norwegian Scenic Routes 将 5—9 月列为西部峡湾与国家景观公路最佳通行季；瀑布丰水、山路开放稳定。",
    image: "https://images.unsplash.com/photo-1507272931001-fc06c17e4f43?auto=format&fit=crop&w=900&q=88",
    score: 94, priority: 7, grade: "A",
    sourceLabel: "Visit Norway · Scenic Routes", sourceUrl: "https://www.visitnorway.com/", verifiedAt: V,
    bestSeasonLabel: "05—09 月", difficulty: 3, destinationType: "峡湾",
  },
  {
    id: "tuscany-spring", months: [4, 5, 6, 9, 10], continent: "欧洲", countryCode: "ITA", regionId: "central-italy",
    title: "托斯卡纳 · 丘陵花季", location: "意大利 / 奥尔恰谷—锡耶纳", theme: "古城 · 骑行 · 美食",
    reason: "Visit Tuscany 官方将春、秋列为丘陵与历史城镇慢游首选：色彩层次丰富、气温适中，避开盛夏高温与游客峰值。",
    image: "https://images.unsplash.com/photo-1529260830199-42c24126f198?auto=format&fit=crop&w=900&q=88",
    score: 95, priority: 8, grade: "A",
    sourceLabel: "Visit Tuscany", sourceUrl: "https://www.visittuscany.com/en/", verifiedAt: V,
    bestSeasonLabel: "04—06 / 09—10 月", difficulty: 2, destinationType: "城市",
  },

  // —— 大洋洲 ——
  {
    id: "queensland-dry", months: [6, 7, 8], continent: "大洋洲", countryCode: "AUS", regionId: "qld",
    title: "昆士兰 · 珊瑚海旱季", location: "澳大利亚 / 大堡礁", theme: "潜水 · 雨林 · 海岛",
    reason: "昆士兰旅游局与大堡礁海洋公园管理局（GBRMPA）指出 6—8 月为热带北岸相对旱季：湿度与风浪更利于礁区活动与雨林出行。",
    image: "https://images.unsplash.com/photo-1587139223877-04cb899fa3e8?auto=format&fit=crop&w=900&q=88",
    score: 95, priority: 8, grade: "S",
    sourceLabel: "Queensland Tourism / GBRMPA", sourceUrl: "https://www.queensland.com/", verifiedAt: V,
    bestSeasonLabel: "06—08 月", difficulty: 2, destinationType: "海岛",
  },
  {
    id: "new-zealand", months: [11, 12, 1, 2, 3], continent: "大洋洲", countryCode: "NZL", regionId: "south-island",
    title: "新西兰 · 南岛长昼", location: "新西兰 / 皇后镇—峡湾", theme: "雪山 · 湖泊 · 房车",
    reason: "新西兰旅游局（Tourism NZ）将 11—3 月列为南岛盛夏长昼季：步道与峡湾船班完整，皇后镇—米尔福德为官方核心线路。",
    image: "https://images.unsplash.com/photo-1469521669194-babb45599def?auto=format&fit=crop&w=900&q=88",
    score: 96, priority: 8, grade: "S",
    sourceLabel: "Tourism New Zealand", sourceUrl: "https://www.newzealand.com/int/", verifiedAt: V,
    bestSeasonLabel: "11—03 月", difficulty: 3, destinationType: "峡湾",
  },

  // —— 北美 ——
  {
    id: "canada-rockies", months: [6, 7, 8, 9, 10], continent: "北美", countryCode: "CAN", regionId: "west-ca",
    title: "加拿大 · 落基山湖色", location: "加拿大 / 班夫与贾斯珀", theme: "湖泊 · 徒步 · 自驾",
    reason: "Parks Canada 将 6—10 月列为落基山国家公园主游季：高山湖解冻、冰原大道通行，九月落叶松进入金黄期。",
    image: "https://images.unsplash.com/photo-1503614472-8c93d56e92ce?auto=format&fit=crop&w=900&q=88",
    score: 96, priority: 9, grade: "S",
    sourceLabel: "Parks Canada", sourceUrl: "https://parks.canada.ca/pn-np/ab/banff", verifiedAt: V,
    bestSeasonLabel: "06—10 月", difficulty: 3, destinationType: "湖泊",
  },
  {
    id: "california-coast", months: [3, 4, 5, 6, 9, 10], continent: "北美", countryCode: "USA", regionId: "west",
    title: "加州 · 一号公路", location: "美国 / 太平洋海岸", theme: "自驾 · 红杉 · 海岸",
    reason: "Visit California 与 Caltrans 建议避开盛夏拥堵窗口；春秋季海岸雾与日落层次更佳，一号公路与国家公园组合更舒适。",
    image: "https://images.unsplash.com/photo-1515894347712-4d9164b20c6c?auto=format&fit=crop&w=900&q=88",
    score: 94, priority: 7, grade: "A",
    sourceLabel: "Visit California", sourceUrl: "https://www.visitcalifornia.com/", verifiedAt: V,
    bestSeasonLabel: "03—06 / 09—10 月", difficulty: 2, destinationType: "公路",
  },
  {
    id: "rockies-winter", months: [12, 1, 2, 3], continent: "北美", countryCode: "USA", regionId: "mountain-us",
    title: "落基山 · 雪原季", location: "美国 / 科罗拉多—怀俄明", theme: "滑雪 · 温泉 · 雪地公路",
    reason: "美国国家公园局与各州雪场官方将 12—3 月列为高山雪季主窗口；雪质与设施运营进入完整状态。",
    image: "https://images.unsplash.com/photo-1486911278844-a81c5267e227?auto=format&fit=crop&w=900&q=88",
    score: 95, priority: 8, grade: "A",
    sourceLabel: "National Park Service / 州雪场公告", sourceUrl: "https://www.nps.gov/", verifiedAt: V,
    bestSeasonLabel: "12—03 月", difficulty: 4, destinationType: "山峰",
  },

  // —— 南美 ——
  {
    id: "patagonia-summer", months: [11, 12, 1, 2, 3], continent: "南美", countryCode: "ARG", regionId: "patagonia-ar",
    title: "巴塔哥尼亚 · 南半球盛夏", location: "阿根廷 / 埃尔卡拉法特—查尔腾", theme: "冰川 · 徒步 · 公路",
    reason: "阿根廷国家旅游与国家公园体系将 11—3 月列为巴塔哥尼亚徒步与冰川观景主季：长昼、山路与营地开放最完整。",
    image: "https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?auto=format&fit=crop&w=900&q=88",
    score: 98, priority: 10, grade: "S",
    sourceLabel: "Argentina.travel / Parques Nacionales", sourceUrl: "https://www.argentina.travel/", verifiedAt: V,
    bestSeasonLabel: "11—03 月", difficulty: 4, destinationType: "山峰",
  },
  {
    id: "machu-picchu-dry", months: [5, 6, 7, 8, 9], continent: "南美", countryCode: "PER", regionId: "sierra-pe",
    title: "秘鲁 · 圣谷旱季", location: "秘鲁 / 库斯科与马丘比丘", theme: "遗址 · 徒步 · 高原",
    reason: "PROMPERÚ 将 5—9 月列为安第斯旱季：降水少、能见度高，库斯科—圣谷—马丘比丘为官方核心文化线路。",
    image: "https://images.unsplash.com/photo-1526392060635-9d6019884377?auto=format&fit=crop&w=900&q=88",
    score: 97, priority: 9, grade: "S",
    sourceLabel: "PROMPERÚ", sourceUrl: "https://www.peru.travel/en", verifiedAt: V,
    bestSeasonLabel: "05—09 月", difficulty: 3, destinationType: "遗址",
  },
  {
    id: "rio-winter-escape", months: [6, 7, 8], continent: "南美", countryCode: "BRA", regionId: "southeast-br",
    title: "里约 · 干季海岸", location: "巴西 / 里约热内卢", theme: "海岸 · 城市 · 轻徒步",
    reason: "巴西旅游官方与东南部气候规律显示 6—8 月为里约一带相对干季：降雨减少，山脊步道与海滩更适合城市+自然组合。",
    image: "https://images.unsplash.com/photo-1483729558449-99ef09a8c325?auto=format&fit=crop&w=900&q=88",
    score: 94, priority: 7, grade: "A",
    sourceLabel: "Visit Brasil / Embratur", sourceUrl: "https://www.visitbrasil.com/", verifiedAt: V,
    bestSeasonLabel: "06—08 月", difficulty: 2, destinationType: "城市",
  },

  // —— 非洲 ——
  {
    id: "masai-mara-migration", months: [7, 8, 9, 10], continent: "非洲", countryCode: "KEN", regionId: "masai-mara",
    title: "马赛马拉 · 大迁徙", location: "肯尼亚 / 马赛马拉", theme: "野生动物 · 摄影 · 草原",
    reason: "Magical Kenya（肯尼亚旅游局）将 7—10 月列为马拉河渡与集群迁徙高看点窗口，是国家级野生动物摄影季。",
    image: "https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&w=900&q=88",
    score: 99, priority: 10, grade: "S",
    sourceLabel: "Magical Kenya", sourceUrl: "https://magicalkenya.com/", verifiedAt: V,
    bestSeasonLabel: "07—10 月", difficulty: 3, destinationType: "草原",
  },
  {
    id: "cape-whales", months: [6, 7, 8, 9, 10], continent: "非洲", countryCode: "ZAF", regionId: "cape-region",
    title: "开普 · 鲸季海岸", location: "南非 / 开普敦与花园大道", theme: "海岸 · 自驾 · 观鲸",
    reason: "南非旅游局与西开普官方将南半球冬季列为南露脊鲸回游窗口；开普半岛—花园大道为经典海岸自驾季。",
    image: "https://images.unsplash.com/photo-1580060839134-75a5edca2e99?auto=format&fit=crop&w=900&q=88",
    score: 96, priority: 9, grade: "A",
    sourceLabel: "South African Tourism", sourceUrl: "https://www.southafrica.net/", verifiedAt: V,
    bestSeasonLabel: "06—10 月", difficulty: 2, destinationType: "公路",
  },
  {
    id: "morocco-spring", months: [3, 4, 5, 9, 10, 11], continent: "非洲", countryCode: "MAR", regionId: "marrakech-atlas",
    title: "摩洛哥 · 古城花季", location: "摩洛哥 / 马拉喀什与阿特拉斯", theme: "古城 · 徒步 · 沙漠边缘",
    reason: "摩洛哥国家旅游局将春秋列为马拉喀什—阿特拉斯舒适窗口：避开盛夏高温，集市与高山村落组合更友好。",
    image: "https://images.unsplash.com/photo-1489749798305-4fea3ae63d43?auto=format&fit=crop&w=900&q=88",
    score: 95, priority: 8, grade: "A",
    sourceLabel: "Visit Morocco", sourceUrl: "https://www.visitmorocco.com/en", verifiedAt: V,
    bestSeasonLabel: "03—05 / 09—11 月", difficulty: 2, destinationType: "城市",
  },
  {
    id: "egypt-winter", months: [11, 12, 1, 2, 3], continent: "非洲", countryCode: "EGY", regionId: "cairo-giza",
    title: "埃及 · 冬日尼罗河", location: "埃及 / 开罗—卢克索", theme: "遗址 · 游船 · 亲子",
    reason: "埃及旅游部公开指南建议避开 6—8 月极端高温；11—3 月为金字塔、神庙与尼罗河游船的舒适参观季。",
    image: "https://images.unsplash.com/photo-1503177119275-0aa32b3a9368?auto=format&fit=crop&w=900&q=88",
    score: 96, priority: 8, grade: "S",
    sourceLabel: "Egypt Tourism", sourceUrl: "https://egypt.travel/", verifiedAt: V,
    bestSeasonLabel: "11—03 月", difficulty: 2, destinationType: "遗址",
  },

  // —— 中国文旅 / 地理媒体常用当季窗口（补充可感知的新条目）——
  {
    id: "zhangjiajie-summer", months: [4, 5, 6, 7, 8, 9, 10], continent: "亚洲", countryCode: "CHN", regionId: "central",
    title: "华中 · 张家界峰林", location: "中国 / 湖南张家界", theme: "峰林 · 徒步 · 摄影",
    reason: "湖南省文旅与国内权威地理媒体多将 4—10 月列为张家界武陵源峰林徒步与观景主季；雨季后空气通透、植被层次完整。",
    image: "https://images.unsplash.com/photo-1508804185872-d7badad00f7d?auto=format&fit=crop&w=900&q=88",
    score: 96, priority: 8, grade: "A",
    sourceLabel: "湖南省文化和旅游厅 / 武陵源景区", sourceUrl: "http://whhlyt.hunan.gov.cn/", verifiedAt: V,
    bestSeasonLabel: "04—10 月", difficulty: 3, destinationType: "山峰",
  },
  {
    id: "guilin-lijiang", months: [4, 5, 9, 10, 11], continent: "亚洲", countryCode: "CHN", regionId: "south",
    title: "华南 · 漓江喀斯特", location: "中国 / 桂林—阳朔", theme: "喀斯特 · 游船 · 骑行",
    reason: "广西文旅公开推广中，漓江—阳朔为华南喀斯特代表线路；春秋季水位与能见度更利于游船与骑行，避开盛夏湿热峰值。",
    image: "https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=900&q=88",
    score: 94, priority: 7, grade: "A",
    sourceLabel: "广西壮族自治区文化和旅游厅", sourceUrl: "https://wlt.gxzf.gov.cn/", verifiedAt: V,
    bestSeasonLabel: "04—05 / 09—11 月", difficulty: 2, destinationType: "公路",
  },
  {
    id: "huangshan-winter", months: [12, 1, 2], continent: "亚洲", countryCode: "CHN", regionId: "east",
    title: "华东 · 黄山冬雪", location: "中国 / 安徽黄山", theme: "雪景 · 云海 · 摄影",
    reason: "安徽文旅与黄山景区公告常将 12—2 月列为雾凇、雪景与云海高发窗口，是华东冬季摄影与短途深度游代表目的地。",
    image: "https://images.unsplash.com/photo-1513415564515-763d91423bdd?auto=format&fit=crop&w=900&q=88",
    score: 93, priority: 7, grade: "A",
    sourceLabel: "安徽省文化和旅游厅 / 黄山风景区", sourceUrl: "https://ct.ah.gov.cn/", verifiedAt: V,
    bestSeasonLabel: "12—02 月", difficulty: 3, destinationType: "山峰",
  },
  {
    id: "xizang-summer", months: [6, 7, 8, 9], continent: "亚洲", countryCode: "CHN", regionId: "southwest",
    title: "西南 · 川西—藏东长昼", location: "中国 / 稻城亚丁—林芝方向", theme: "高原 · 徒步 · 自驾",
    reason: "西南文旅线路与权威地理报道多将 6—9 月列为川西高原与藏东南相对适宜出行窗口：长昼、植被丰盛，需严格做高反准备。",
    image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=900&q=88",
    score: 95, priority: 8, grade: "S",
    sourceLabel: "四川省 / 西藏自治区文旅公开线路指南", sourceUrl: "https://wlt.sc.gov.cn/", verifiedAt: V,
    bestSeasonLabel: "06—09 月", difficulty: 4, destinationType: "山峰",
  },
]

// Fix cape-whales destinationType - I used wrong cast. Coast isn't in the type. Use 海岛 or keep 公路.
// I'll fix via replace - destinationType for cape should be something valid. Looking at type: "山峰" | "湖泊" | "城市" | "海岛" | "公路" | "遗址" | "草原" | "沙漠" | "峡湾" | "花田"
// Use 海岛 for whale coast or add 海岸 - I'll use 公路 for garden route / cape drive.

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

export function getRecommendationById(id: string) {
  return SEASONAL_RECOMMENDATIONS.find(item => item.id === id)
}
