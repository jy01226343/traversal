import type { AttractionCategoryL1 } from "./types"
import type { MapBoundsWgs84 } from "./types"
import { getRegionResourceSpots, REGIONS_BY_COUNTRY } from "@/data/destinations"

export interface ScrapeTargetSpot {
  name: string
  name_en: string
  wiki?: string
  lat?: number
  lng?: number
  category_l1?: AttractionCategoryL1
  category_l2?: string
  tags?: string[]
  officialUrl?: string
}

export interface RegionScrapeTarget {
  countryCode: string
  regionId: string
  english: string
  focus: [number, number]
  /** Half-span in degrees for Overpass bbox when map bounds missing */
  span: number
  officialPortals: Array<{ label: string; url: string }>
  /** Known landmarks to enrich via Wikipedia / official pages */
  landmarks: ScrapeTargetSpot[]
}

/** Domains allowed through the HTML scrape proxy (official tourism & open data only). */
export const SCRAPE_ALLOWLIST_HOSTS = [
  "www.visit-hokkaido.jp",
  "visit-hokkaido.jp",
  "www.japan.travel",
  "www.visitokinawa.jp",
  "www.visiticeland.com",
  "safetravel.is",
  "www.myswitzerland.com",
  "www.visitnorway.com",
  "www.visittuscany.com",
  "www.newzealand.com",
  "www.queensland.com",
  "www2.gbrmpa.gov.au",
  "www.indonesia.travel",
  "www.tourismthailand.org",
  "www.nps.gov",
  "www.visitcalifornia.com",
  "parks.canada.ca",
  "www.visitbrasil.com",
  "www.argentina.travel",
  "www.peru.travel",
  "chile.travel",
  "www.southafrica.net",
  "www.sanparks.org",
  "egypt.travel",
  "www.visitmorocco.com",
  "magicalkenya.com",
  "www.tanzaniatourism.go.tz",
  "www.tanzaniaparks.go.tz",
  "wlt.xinjiang.gov.cn",
  "en.wikipedia.org",
  "zh.wikipedia.org",
  "overpass-api.de",
  "overpass.kumi.systems",
]

const PORTAL = (label: string, url: string) => ({ label, url })

/** Curated crawl recipes per region — used when live API is empty/unavailable. */
export const REGION_SCRAPE_TARGETS: Record<string, RegionScrapeTarget> = {
  "JPN:hokkaido": {
    countryCode: "JPN", regionId: "hokkaido", english: "Hokkaido", focus: [43.2, 142.7], span: 2.8,
    officialPortals: [PORTAL("HOKKAIDO LOVE!", "https://www.visit-hokkaido.jp/en/")],
    landmarks: [
      { name: "洞爷湖", name_en: "Lake Toya", wiki: "Lake_Tōya", lat: 42.603, lng: 140.852, category_l1: "自然风光", category_l2: "湖泊", tags: ["火山湖", "亲子"], officialUrl: "https://www.visit-hokkaido.jp/en/spot/detail_10050.html" },
      { name: "小樽运河", name_en: "Otaru Canal", wiki: "Otaru_Canal", lat: 43.198, lng: 140.994, category_l1: "人文历史", category_l2: "历史街区", tags: ["夜景"] },
      { name: "白金青池", name_en: "Blue Pond", wiki: "Blue_Pond_(Biei)", lat: 43.4935, lng: 142.614, category_l1: "网红奇观", category_l2: "湖泊", tags: ["摄影"] },
      { name: "富田农场", name_en: "Farm Tomita", wiki: "Farm_Tomita", lat: 43.418, lng: 142.425, category_l1: "自然风光", category_l2: "花田", tags: ["薰衣草"] },
      { name: "知床五湖", name_en: "Shiretoko Five Lakes", wiki: "Shiretoko_National_Park", lat: 44.125, lng: 145.079, category_l1: "户外极限", category_l2: "徒步", tags: ["世界遗产"] },
      { name: "登别地狱谷", name_en: "Noboribetsu Jigokudani", wiki: "Noboribetsu", lat: 42.497, lng: 141.144, category_l1: "自然风光", category_l2: "火山地貌", tags: ["温泉"] },
      { name: "函馆山", name_en: "Mount Hakodate", wiki: "Mount_Hakodate", lat: 41.759, lng: 140.704, category_l1: "自然风光", category_l2: "观景", tags: ["夜景"] },
      { name: "支笏湖", name_en: "Lake Shikotsu", wiki: "Lake_Shikotsu", lat: 42.759, lng: 141.329, category_l1: "自然风光", category_l2: "湖泊", tags: ["独木舟"] },
    ],
  },
  "JPN:kinki": {
    countryCode: "JPN", regionId: "kinki", english: "Kansai", focus: [34.8, 135.5], span: 1.2,
    officialPortals: [PORTAL("JNTO Kansai", "https://www.japan.travel/en/destinations/kansai/")],
    landmarks: [
      { name: "金阁寺", name_en: "Kinkaku-ji", wiki: "Kinkaku-ji", lat: 35.0394, lng: 135.7292, category_l1: "人文历史", category_l2: "古寺", tags: ["世界遗产"] },
      { name: "伏见稻荷大社", name_en: "Fushimi Inari", wiki: "Fushimi_Inari-taisha", lat: 34.9671, lng: 135.7727, category_l1: "人文历史", category_l2: "神社", tags: ["鸟居"] },
      { name: "奈良公园", name_en: "Nara Park", wiki: "Nara_Park", lat: 34.6851, lng: 135.843, category_l1: "自然风光", category_l2: "公园", tags: ["亲子"] },
    ],
  },
  "JPN:kyushu": {
    countryCode: "JPN", regionId: "kyushu", english: "Kyushu", focus: [32.8, 130.7], span: 2,
    officialPortals: [PORTAL("JNTO Kyushu", "https://www.japan.travel/en/destinations/kyushu/")],
    landmarks: [
      { name: "阿苏火山", name_en: "Mount Aso", wiki: "Mount_Aso", lat: 32.884, lng: 131.104, category_l1: "自然风光", category_l2: "火山", tags: ["火山口"] },
      { name: "由布院", name_en: "Yufuin", wiki: "Yufuin,_Ōita", lat: 33.266, lng: 131.36, category_l1: "休闲露营", category_l2: "温泉", tags: ["温泉乡"] },
      { name: "屋久岛", name_en: "Yakushima", wiki: "Yakushima", lat: 30.358, lng: 130.529, category_l1: "自然风光", category_l2: "雨林", tags: ["世界遗产"] },
    ],
  },
  "JPN:okinawa": {
    countryCode: "JPN", regionId: "okinawa", english: "Okinawa", focus: [26.5, 128.0], span: 1.5,
    officialPortals: [PORTAL("Visit Okinawa", "https://www.visitokinawa.jp/")],
    landmarks: [
      { name: "美丽海水族馆", name_en: "Churaumi Aquarium", wiki: "Okinawa_Churaumi_Aquarium", lat: 26.694, lng: 127.878, category_l1: "超级工程", category_l2: "场馆", tags: ["亲子"] },
      { name: "庆良间群岛", name_en: "Kerama Islands", wiki: "Kerama_Islands", lat: 26.199, lng: 127.333, category_l1: "自然风光", category_l2: "海洋", tags: ["潜水"] },
      { name: "宫古岛", name_en: "Miyakojima", wiki: "Miyakojima,_Okinawa", lat: 24.805, lng: 125.281, category_l1: "自然风光", category_l2: "海岛", tags: ["海滩"] },
    ],
  },
  "CHN:northwest": {
    countryCode: "CHN", regionId: "northwest", english: "Xinjiang", focus: [42.3, 85.6], span: 6,
    officialPortals: [PORTAL("新疆文旅厅", "https://wlt.xinjiang.gov.cn/")],
    landmarks: [
      { name: "喀纳斯", name_en: "Kanas Lake", wiki: "Kanas_Lake", lat: 48.704, lng: 87.018, category_l1: "自然风光", category_l2: "湖泊", tags: ["秋色"] },
      { name: "那拉提草原", name_en: "Narat Grassland", wiki: "Nalati_Grassland", lat: 43.249, lng: 84.002, category_l1: "自然风光", category_l2: "草原", tags: ["骑马"] },
    ],
  },
  "ISL:south-iceland": {
    countryCode: "ISL", regionId: "south-iceland", english: "South Iceland", focus: [63.8, -19.6], span: 2.2,
    officialPortals: [PORTAL("Visit Iceland", "https://www.visiticeland.com/")],
    landmarks: [
      { name: "斯科加瀑布", name_en: "Skógafoss", wiki: "Skógafoss", lat: 63.532, lng: -19.511, category_l1: "自然风光", category_l2: "瀑布", tags: ["自驾"] },
      { name: "杰古沙龙冰河湖", name_en: "Jökulsárlón", wiki: "Jökulsárlón", lat: 64.048, lng: -16.179, category_l1: "自然风光", category_l2: "冰川湖", tags: ["摄影"] },
      { name: "黑沙滩", name_en: "Reynisfjara", wiki: "Reynisfjara", lat: 63.404, lng: -19.066, category_l1: "自然风光", category_l2: "海岸", tags: ["玄武岩"] },
    ],
  },
  "CHE:alpine-ch": {
    countryCode: "CHE", regionId: "alpine-ch", english: "Bernese Oberland", focus: [46.62, 7.94], span: 0.6,
    officialPortals: [PORTAL("Switzerland Tourism", "https://www.myswitzerland.com/en/")],
    landmarks: [
      { name: "少女峰", name_en: "Jungfraujoch", wiki: "Jungfraujoch", lat: 46.547, lng: 7.98, category_l1: "超级工程", category_l2: "高山列车", tags: ["观景"] },
      { name: "劳特布龙嫩", name_en: "Lauterbrunnen", wiki: "Lauterbrunnen", lat: 46.593, lng: 7.908, category_l1: "自然风光", category_l2: "山谷", tags: ["瀑布"] },
    ],
  },
  "NOR:west-no": {
    countryCode: "NOR", regionId: "west-no", english: "Western Fjords", focus: [61.1, 6.8], span: 1.8,
    officialPortals: [PORTAL("Visit Norway", "https://www.visitnorway.com/")],
    landmarks: [
      { name: "布道石", name_en: "Preikestolen", wiki: "Preikestolen", lat: 58.986, lng: 6.19, category_l1: "户外极限", category_l2: "徒步", tags: ["峡湾"] },
    ],
  },
  "ITA:central-italy": {
    countryCode: "ITA", regionId: "central-italy", english: "Tuscany", focus: [43.4, 11.1], span: 1.2,
    officialPortals: [PORTAL("Visit Tuscany", "https://www.visittuscany.com/en/")],
    landmarks: [
      { name: "锡耶纳古城", name_en: "Siena", wiki: "Siena", lat: 43.3188, lng: 11.3308, category_l1: "人文历史", category_l2: "古城", tags: ["世界遗产"] },
      { name: "奥尔恰谷", name_en: "Val d'Orcia", wiki: "Val_d'Orcia", lat: 43.05, lng: 11.62, category_l1: "自然风光", category_l2: "丘陵", tags: ["摄影"] },
    ],
  },
  "NZL:south-island": {
    countryCode: "NZL", regionId: "south-island", english: "South Island", focus: [-44.6, 169.1], span: 3.5,
    officialPortals: [PORTAL("Tourism New Zealand", "https://www.newzealand.com/int/")],
    landmarks: [
      { name: "米尔福德峡湾", name_en: "Milford Sound", wiki: "Milford_Sound", lat: -44.671, lng: 167.925, category_l1: "自然风光", category_l2: "峡湾", tags: ["游船"] },
      { name: "皇后镇", name_en: "Queenstown", wiki: "Queenstown,_New_Zealand", lat: -45.031, lng: 168.662, category_l1: "户外极限", category_l2: "城镇", tags: ["亲子"] },
    ],
  },
  "AUS:qld": {
    countryCode: "AUS", regionId: "qld", english: "Tropical Queensland", focus: [-18.2, 146.2], span: 3,
    officialPortals: [PORTAL("Queensland", "https://www.queensland.com/"), PORTAL("GBRMPA", "https://www2.gbrmpa.gov.au/")],
    landmarks: [
      { name: "大堡礁", name_en: "Great Barrier Reef", wiki: "Great_Barrier_Reef", lat: -18.287, lng: 147.699, category_l1: "自然风光", category_l2: "珊瑚礁", tags: ["潜水"] },
      { name: "丹翠雨林", name_en: "Daintree Rainforest", wiki: "Daintree_Rainforest", lat: -16.17, lng: 145.418, category_l1: "自然风光", category_l2: "雨林", tags: ["世界遗产"] },
    ],
  },
  "IDN:bali-nt": {
    countryCode: "IDN", regionId: "bali-nt", english: "Bali", focus: [-8.42, 115.19], span: 0.8,
    officialPortals: [PORTAL("Wonderful Indonesia", "https://www.indonesia.travel/")],
    landmarks: [
      { name: "努沙佩尼达", name_en: "Nusa Penida", wiki: "Nusa_Penida", lat: -8.727, lng: 115.544, category_l1: "自然风光", category_l2: "离岛", tags: ["潜水"] },
      { name: "德格拉朗梯田", name_en: "Tegallalang", wiki: "Tegallalang", lat: -8.431, lng: 115.279, category_l1: "人文历史", category_l2: "农业景观", tags: ["稻田"] },
    ],
  },
  "THA:south-th": {
    countryCode: "THA", regionId: "south-th", english: "Andaman Coast", focus: [8.1, 98.4], span: 1.2,
    officialPortals: [PORTAL("Tourism Authority of Thailand", "https://www.tourismthailand.org/")],
    landmarks: [
      { name: "皮皮岛", name_en: "Phi Phi Islands", wiki: "Ko_Phi_Phi", lat: 7.741, lng: 98.778, category_l1: "自然风光", category_l2: "海岛", tags: ["浮潜"] },
      { name: "攀牙湾", name_en: "Phang Nga Bay", wiki: "Phang_Nga_Bay", lat: 8.274, lng: 98.501, category_l1: "自然风光", category_l2: "海湾", tags: ["石灰岩"] },
    ],
  },
  "USA:west": {
    countryCode: "USA", regionId: "west", english: "West Coast", focus: [37.2, -120.1], span: 4,
    officialPortals: [PORTAL("NPS", "https://www.nps.gov/"), PORTAL("Visit California", "https://www.visitcalifornia.com/")],
    landmarks: [
      { name: "优胜美地", name_en: "Yosemite", wiki: "Yosemite_National_Park", lat: 37.8651, lng: -119.5383, category_l1: "自然风光", category_l2: "国家公园", tags: ["徒步"] },
      { name: "大苏尔", name_en: "Big Sur", wiki: "Big_Sur", lat: 36.2704, lng: -121.8081, category_l1: "自然风光", category_l2: "海岸", tags: ["自驾"] },
    ],
  },
  "USA:mountain-us": {
    countryCode: "USA", regionId: "mountain-us", english: "Rockies", focus: [42.4, -110.1], span: 4,
    officialPortals: [PORTAL("NPS", "https://www.nps.gov/")],
    landmarks: [
      { name: "黄石公园", name_en: "Yellowstone", wiki: "Yellowstone_National_Park", lat: 44.428, lng: -110.5885, category_l1: "自然风光", category_l2: "国家公园", tags: ["间歇泉"] },
    ],
  },
  "CAN:west-ca": {
    countryCode: "CAN", regionId: "west-ca", english: "Canadian Rockies", focus: [51.3, -116.2], span: 2.5,
    officialPortals: [PORTAL("Parks Canada", "https://parks.canada.ca/")],
    landmarks: [
      { name: "露易丝湖", name_en: "Lake Louise", wiki: "Lake_Louise,_Alberta", lat: 51.4254, lng: -116.1773, category_l1: "自然风光", category_l2: "冰川湖", tags: ["摄影"] },
      { name: "梦莲湖", name_en: "Moraine Lake", wiki: "Moraine_Lake", lat: 51.3217, lng: -116.186, category_l1: "自然风光", category_l2: "冰川湖", tags: ["摄影"] },
    ],
  },
  "BRA:southeast-br": {
    countryCode: "BRA", regionId: "southeast-br", english: "Rio Coast", focus: [-22.9, -43.2], span: 0.8,
    officialPortals: [PORTAL("Visit Brasil", "https://www.visitbrasil.com/")],
    landmarks: [
      { name: "糖面包山", name_en: "Sugarloaf Mountain", wiki: "Sugarloaf_Mountain", lat: -22.9492, lng: -43.1545, category_l1: "自然风光", category_l2: "山体", tags: ["缆车"] },
      { name: "基督像", name_en: "Christ the Redeemer", wiki: "Christ_the_Redeemer_(statue)", lat: -22.9519, lng: -43.2105, category_l1: "人文历史", category_l2: "地标", tags: ["世界遗产"] },
    ],
  },
  "BRA:iguazu": {
    countryCode: "BRA", regionId: "iguazu", english: "Iguazu", focus: [-25.7, -54.4], span: 0.5,
    officialPortals: [PORTAL("Visit Brasil", "https://www.visitbrasil.com/")],
    landmarks: [
      { name: "伊瓜苏瀑布", name_en: "Iguaçu Falls", wiki: "Iguazu_Falls", lat: -25.6953, lng: -54.4367, category_l1: "自然风光", category_l2: "瀑布", tags: ["国家公园"] },
    ],
  },
  "ARG:patagonia-ar": {
    countryCode: "ARG", regionId: "patagonia-ar", english: "Patagonia AR", focus: [-50.1, -73.0], span: 2.5,
    officialPortals: [PORTAL("Argentina.travel", "https://www.argentina.travel/")],
    landmarks: [
      { name: "佩里托莫雷诺冰川", name_en: "Perito Moreno", wiki: "Perito_Moreno_Glacier", lat: -50.4967, lng: -73.1377, category_l1: "自然风光", category_l2: "冰川", tags: ["摄影"] },
      { name: "菲茨罗伊峰", name_en: "Fitz Roy", wiki: "Fitz_Roy", lat: -49.2713, lng: -73.0432, category_l1: "户外极限", category_l2: "徒步", tags: ["高山"] },
    ],
  },
  "PER:sierra-pe": {
    countryCode: "PER", regionId: "sierra-pe", english: "Cusco Sacred Valley", focus: [-13.5, -71.9], span: 1.2,
    officialPortals: [PORTAL("PROMPERÚ", "https://www.peru.travel/en")],
    landmarks: [
      { name: "马丘比丘", name_en: "Machu Picchu", wiki: "Machu_Picchu", lat: -13.1631, lng: -72.545, category_l1: "人文历史", category_l2: "遗址", tags: ["世界遗产"] },
    ],
  },
  "CHL:patagonia-cl": {
    countryCode: "CHL", regionId: "patagonia-cl", english: "Patagonia CL", focus: [-51.0, -73.0], span: 2,
    officialPortals: [PORTAL("Chile Travel", "https://chile.travel/en")],
    landmarks: [
      { name: "托雷斯德尔帕伊内", name_en: "Torres del Paine", wiki: "Torres_del_Paine_National_Park", lat: -50.9423, lng: -73.4068, category_l1: "户外极限", category_l2: "国家公园", tags: ["徒步"] },
    ],
  },
  "CHL:atacama": {
    countryCode: "CHL", regionId: "atacama", english: "Atacama", focus: [-23.6, -68.2], span: 1.5,
    officialPortals: [PORTAL("Chile Travel", "https://chile.travel/en")],
    landmarks: [
      { name: "月亮谷", name_en: "Valle de la Luna", wiki: "Valle_de_la_Luna_(Chile)", lat: -22.927, lng: -68.3222, category_l1: "自然风光", category_l2: "沙漠", tags: ["日落"] },
    ],
  },
  "ZAF:cape-region": {
    countryCode: "ZAF", regionId: "cape-region", english: "Cape Region", focus: [-33.9, 18.4], span: 1.2,
    officialPortals: [PORTAL("South African Tourism", "https://www.southafrica.net/")],
    landmarks: [
      { name: "桌山", name_en: "Table Mountain", wiki: "Table_Mountain", lat: -33.9628, lng: 18.4098, category_l1: "自然风光", category_l2: "山体", tags: ["缆车"] },
      { name: "好望角", name_en: "Cape Point", wiki: "Cape_Point", lat: -34.3568, lng: 18.4977, category_l1: "自然风光", category_l2: "海岸", tags: ["自驾"] },
    ],
  },
  "ZAF:kruger": {
    countryCode: "ZAF", regionId: "kruger", english: "Kruger", focus: [-24.0, 31.5], span: 1.8,
    officialPortals: [PORTAL("SANParks", "https://www.sanparks.org/parks/kruger")],
    landmarks: [
      { name: "克鲁格国家公园", name_en: "Kruger National Park", wiki: "Kruger_National_Park", lat: -24.0, lng: 31.5, category_l1: "自然风光", category_l2: "野生动物", tags: ["观兽"] },
    ],
  },
  "EGY:cairo-giza": {
    countryCode: "EGY", regionId: "cairo-giza", english: "Cairo Giza", focus: [29.98, 31.13], span: 0.5,
    officialPortals: [PORTAL("Egypt Travel", "https://egypt.travel/")],
    landmarks: [
      { name: "吉萨金字塔", name_en: "Giza Pyramids", wiki: "Giza_pyramid_complex", lat: 29.9792, lng: 31.1342, category_l1: "人文历史", category_l2: "遗址", tags: ["世界遗产"] },
    ],
  },
  "EGY:luxor-nile": {
    countryCode: "EGY", regionId: "luxor-nile", english: "Luxor Nile", focus: [25.7, 32.6], span: 0.6,
    officialPortals: [PORTAL("Egypt Travel", "https://egypt.travel/")],
    landmarks: [
      { name: "卡尔纳克神庙", name_en: "Karnak", wiki: "Karnak", lat: 25.7188, lng: 32.6573, category_l1: "人文历史", category_l2: "神庙", tags: ["考古"] },
    ],
  },
  "MAR:marrakech-atlas": {
    countryCode: "MAR", regionId: "marrakech-atlas", english: "Marrakech Atlas", focus: [31.6, -8.0], span: 1.2,
    officialPortals: [PORTAL("Visit Morocco", "https://www.visitmorocco.com/en")],
    landmarks: [
      { name: "马拉喀什老城", name_en: "Marrakech Medina", wiki: "Marrakesh", lat: 31.6295, lng: -7.9811, category_l1: "人文历史", category_l2: "古城", tags: ["集市"] },
    ],
  },
  "KEN:masai-mara": {
    countryCode: "KEN", regionId: "masai-mara", english: "Masai Mara", focus: [-1.5, 35.1], span: 1.2,
    officialPortals: [PORTAL("Magical Kenya", "https://magicalkenya.com/")],
    landmarks: [
      { name: "马赛马拉", name_en: "Masai Mara", wiki: "Maasai_Mara", lat: -1.4061, lng: 35.0117, category_l1: "自然风光", category_l2: "野生动物", tags: ["大迁徙"] },
    ],
  },
  "TZA:serengeti": {
    countryCode: "TZA", regionId: "serengeti", english: "Serengeti", focus: [-2.3, 34.8], span: 1.5,
    officialPortals: [PORTAL("Tanzania Tourism", "https://www.tanzaniatourism.go.tz/")],
    landmarks: [
      { name: "塞伦盖蒂国家公园", name_en: "Serengeti", wiki: "Serengeti_National_Park", lat: -2.3333, lng: 34.8333, category_l1: "自然风光", category_l2: "野生动物", tags: ["迁徙"] },
    ],
  },
  "TZA:kilimanjaro": {
    countryCode: "TZA", regionId: "kilimanjaro", english: "Kilimanjaro", focus: [-3.1, 37.4], span: 0.8,
    officialPortals: [PORTAL("TANAPA", "https://www.tanzaniaparks.go.tz/")],
    landmarks: [
      { name: "乞力马扎罗", name_en: "Mount Kilimanjaro", wiki: "Mount_Kilimanjaro", lat: -3.0674, lng: 37.3556, category_l1: "户外极限", category_l2: "高山徒步", tags: ["非洲屋脊"] },
    ],
  },
  "TZA:zanzibar": {
    countryCode: "TZA", regionId: "zanzibar", english: "Zanzibar", focus: [-6.2, 39.2], span: 0.8,
    officialPortals: [PORTAL("Tanzania Tourism", "https://www.tanzaniatourism.go.tz/")],
    landmarks: [
      { name: "石头城", name_en: "Stone Town", wiki: "Stone_Town", lat: -6.163, lng: 39.188, category_l1: "人文历史", category_l2: "古城", tags: ["世界遗产"] },
    ],
  },
}

export function getRegionScrapeTarget(countryCode?: string, regionId?: string): RegionScrapeTarget | null {
  if (!countryCode || !regionId) return null
  const key = `${countryCode}:${regionId}`
  if (REGION_SCRAPE_TARGETS[key]) return REGION_SCRAPE_TARGETS[key]
  const regions = REGIONS_BY_COUNTRY[countryCode] || []
  const region = regions.find(item => item.id === regionId)
  if (!region) return null
  // Fallback landmarks from region resource spots so crawler never starts empty
  const landmarks: ScrapeTargetSpot[] = []
  const seen = new Set<string>()
  region.resources.forEach(resource => {
    getRegionResourceSpots(region, resource.type).forEach(spot => {
      if (seen.has(spot.name)) return
      seen.add(spot.name)
      landmarks.push({
        name: spot.name,
        name_en: spot.name,
        lat: spot.focus[0],
        lng: spot.focus[1],
        category_l1: "自然风光",
        category_l2: resource.type,
        tags: [resource.type],
        officialUrl: spot.sourceUrl?.startsWith("http") && !spot.sourceUrl.includes("unsplash.com")
          ? spot.sourceUrl
          : undefined,
      })
    })
  })
  if (!landmarks.length) {
    landmarks.push({
      name: region.name,
      name_en: region.english,
      lat: region.focus[0],
      lng: region.focus[1],
      category_l1: "自然风光",
      category_l2: "地区",
      tags: [region.summary.slice(0, 10)],
    })
  }
  return {
    countryCode,
    regionId,
    english: region.english,
    focus: region.focus,
    span: 1.5,
    officialPortals: [],
    landmarks,
  }
}

export function boundsFromFocus(focus: [number, number], span: number): MapBoundsWgs84 {
  const [lat, lon] = focus
  return {
    north: Math.min(90, lat + span),
    south: Math.max(-90, lat - span),
    east: Math.min(180, lon + span),
    west: Math.max(-180, lon - span),
  }
}

export function isHostAllowlisted(hostname: string) {
  const host = hostname.toLowerCase()
  return SCRAPE_ALLOWLIST_HOSTS.some(allowed => host === allowed || host.endsWith(`.${allowed}`))
}
