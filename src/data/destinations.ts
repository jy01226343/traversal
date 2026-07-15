export interface DestinationCountry {
  code: string
  name: string
  english: string
  focus: [number, number]
  score: number
  tagline: string
  season: string
  visited: boolean
}

export interface DestinationRegion {
  id: string
  name: string
  english: string
  focus: [number, number]
  heat: number
  visited: boolean
  summary: string
  resources: DestinationResource[]
}

export interface DestinationResource {
  type: string
  score: number
}

export interface DestinationSpot {
  name: string
  focus: [number, number]
  image: string
  imageSource: string
  sourceUrl: string
}

export const RESOURCE_ICONS: Record<string, string> = {
  古都: "🏯", 文化: "🏯", 滑雪: "🏂", 骑马草原: "🐎", 草原: "🐎",
  潜水: "🐠", 徒步: "🥾", 自驾: "🚙", 温泉: "♨️", 摄影: "📷",
  骑行: "🚴", 海岸: "🏝️", 海岛: "🏝️", 冲浪: "🏄", 露营: "⛺",
  美食: "🍜", 城市: "🏙️", 亲子: "🪁",
}

const REGION_SPOTLIGHTS: Record<string, Record<string, string[]>> = {
  hokkaido: { 滑雪: ["羊蹄山", "留寿都"], 徒步: ["大雪山", "知床五湖"], 温泉: ["洞爷湖", "登别"] },
  okinawa: { 潜水: ["庆良间群岛", "青之洞窟"], 海岛: ["石垣岛", "宫古岛"], 亲子: ["美丽海水族馆", "古宇利岛"] },
  kyushu: { 徒步: ["阿苏火山", "屋久岛"], 温泉: ["由布院", "黑川温泉"], 自驾: ["日南海岸", "阿苏环线"] },
  chugoku: { 文化: ["严岛神社", "仓敷古城"], 徒步: ["大山", "三段峡"], 骑行: ["岛波海道", "宍道湖"] },
  kansai: { 文化: ["京都古寺", "奈良町"], 徒步: ["熊野古道", "六甲山"], 美食: ["大阪道顿堀", "锦市场"] },
  kanto: { 城市: ["东京塔", "横滨港"], 徒步: ["富士山", "高尾山"], 滑雪: ["谷川岳", "草津"] },
  xinjiang: { 骑马草原: ["喀拉峻", "那拉提"], 徒步: ["夏塔古道", "喀纳斯"], 滑雪: ["将军山", "丝绸之路"] },
  south: { 潜水: ["蜈支洲岛", "涠洲岛"], 徒步: ["武功山", "漓江古道"], 美食: ["广州西关", "潮州古城"] },
  north: { 文化: ["北京中轴线", "大同古城"], 徒步: ["长城", "五台山"], 滑雪: ["崇礼", "南山"] },
  northwest: { 自驾: ["河西走廊", "独库公路"], 徒步: ["祁连山", "麦积山"], 摄影: ["敦煌", "张掖丹霞"] },
  northeast: { 滑雪: ["长白山", "亚布力"], 徒步: ["大兴安岭", "镜泊湖"], 温泉: ["长白山温泉", "阿尔山"] },
  "north-italy": { 徒步: ["多洛米蒂", "科莫湖"], 滑雪: ["科尔蒂纳", "瓦尔加迪纳"], 自驾: ["加尔达湖", "斯泰尔维奥"] },
  tuscany: { 文化: ["佛罗伦萨", "锡耶纳"], 骑行: ["奥尔恰谷", "基安蒂"], 美食: ["卢卡", "圣吉米尼亚诺"] },
  "west-coast": { 自驾: ["一号公路", "红杉公路"], 徒步: ["优胜美地", "雷尼尔山"], 冲浪: ["圣克鲁兹", "马里布"] },
  rockies: { 徒步: ["大提顿", "冰川公园"], 滑雪: ["阿斯彭", "杰克逊霍尔"], 露营: ["黄石", "落基山公园"] },
  "south-iceland": { 自驾: ["维克", "杰古沙龙冰河湖"], 徒步: ["斯科加瀑布", "斯卡夫塔山"], 温泉: ["蓝湖", "天空之湖"] },
  "bernese-oberland": { 徒步: ["格林德瓦", "劳特布龙嫩"], 摄影: ["少女峰", "布里恩茨湖"], 亲子: ["因特拉肯", "门利兴"] },
  "west-fjords": { 自驾: ["松恩峡湾", "大西洋之路"], 徒步: ["布道石", "恶魔之舌"], 摄影: ["盖朗厄尔峡湾", "弗洛姆"] },
  bali: { 潜水: ["努沙佩尼达", "图兰奔"], 徒步: ["巴杜尔火山", "坎普罕山脊"], 海岸: ["乌鲁瓦图", "水明漾"] },
  "south-island": { 自驾: ["米尔福德峡湾", "瓦纳卡"], 徒步: ["胡克谷步道", "路特本步道"], 亲子: ["皇后镇", "蒂卡波湖"] },
  "canadian-rockies": { 徒步: ["露易丝湖", "冰原大道"], 自驾: ["班夫", "贾斯珀"], 摄影: ["梦莲湖", "佩托湖"] },
  "andaman-coast": { 潜水: ["斯米兰群岛", "皮皮岛"], 海岛: ["普吉岛", "兰塔岛"], 亲子: ["甲米", "攀牙湾"] },
  "queensland-tropics": { 潜水: ["大堡礁", "圣灵群岛"], 徒步: ["丹翠雨林", "库兰达"], 海岛: ["汉密尔顿岛", "磁岛"] },
}

const SPOT_COORDINATES: Record<string, [number, number]> = {
  羊蹄山: [42.826, 140.811], 留寿都: [42.738, 140.872], 大雪山: [43.663, 142.854], 知床五湖: [44.125, 145.079], 洞爷湖: [42.603, 140.852], 登别: [42.493, 141.144],
  庆良间群岛: [26.199, 127.333], 青之洞窟: [26.444, 127.771], 石垣岛: [24.341, 124.155], 宫古岛: [24.805, 125.281], 美丽海水族馆: [26.694, 127.878], 古宇利岛: [26.703, 128.019],
  阿苏火山: [32.884, 131.104], 屋久岛: [30.358, 130.529], 由布院: [33.266, 131.36], 黑川温泉: [33.079, 131.143], 日南海岸: [31.658, 131.469], 阿苏环线: [32.951, 131.121],
  严岛神社: [34.296, 132.319], 仓敷古城: [34.596, 133.771], 大山: [35.371, 133.546], 三段峡: [34.609, 132.131], 岛波海道: [34.325, 133.174], 宍道湖: [35.454, 132.947],
  京都古寺: [35.011, 135.768], 奈良町: [34.681, 135.828], 熊野古道: [33.837, 135.776], 六甲山: [34.778, 135.263], 大阪道顿堀: [34.669, 135.501], 锦市场: [35.005, 135.765],
  东京塔: [35.659, 139.745], 横滨港: [35.455, 139.638], 富士山: [35.361, 138.727], 高尾山: [35.626, 139.244], 谷川岳: [36.837, 138.93], 草津: [36.622, 138.597],
  喀拉峻: [43.083, 82.166], 那拉提: [43.249, 84.002], 夏塔古道: [42.469, 80.786], 喀纳斯: [48.704, 87.018], 将军山: [47.844, 88.126], 丝绸之路: [43.445, 87.307],
  蜈支洲岛: [18.315, 109.763], 涠洲岛: [21.03, 109.113], 武功山: [27.465, 114.178], 漓江古道: [25.201, 110.424], 广州西关: [23.118, 113.244], 潮州古城: [23.663, 116.647],
  北京中轴线: [39.91, 116.397], 大同古城: [40.09, 113.298], 长城: [40.431, 116.57], 五台山: [39.008, 113.596], 崇礼: [40.974, 115.282], 南山: [40.348, 116.845],
  长白山: [42.006, 128.056], 亚布力: [44.779, 128.452], 大兴安岭: [50.412, 124.118], 镜泊湖: [43.894, 128.948], 长白山温泉: [42.118, 128.095], 阿尔山: [47.177, 119.943],
  维克: [63.419, -19.006], 杰古沙龙冰河湖: [64.048, -16.179], 斯科加瀑布: [63.532, -19.511], 斯卡夫塔山: [64.017, -16.967], 蓝湖: [63.88, -22.449], 天空之湖: [64.101, -21.681],
  格林德瓦: [46.624, 8.041], 劳特布龙嫩: [46.593, 7.908], 少女峰: [46.536, 7.962], 布里恩茨湖: [46.724, 7.972], 因特拉肯: [46.686, 7.863], 门利兴: [46.612, 7.943],
  松恩峡湾: [61.153, 7.174], 大西洋之路: [63.016, 7.354], 布道石: [58.986, 6.19], 恶魔之舌: [60.124, 6.74], 盖朗厄尔峡湾: [62.104, 7.205], 弗洛姆: [60.861, 7.114],
  努沙佩尼达: [-8.727, 115.544], 图兰奔: [-8.278, 115.593], 巴杜尔火山: [-8.242, 115.375], 坎普罕山脊: [-8.497, 115.254], 乌鲁瓦图: [-8.829, 115.085], 水明漾: [-8.691, 115.168],
  米尔福德峡湾: [-44.671, 167.925], 瓦纳卡: [-44.694, 169.141], 胡克谷步道: [-43.713, 170.098], 路特本步道: [-44.717, 168.117], 皇后镇: [-45.031, 168.662], 蒂卡波湖: [-44.004, 170.477],
  露易丝湖: [51.416, -116.217], 冰原大道: [52.219, -117.224], 班夫: [51.178, -115.571], 贾斯珀: [52.873, -118.081], 梦莲湖: [51.321, -116.186], 佩托湖: [51.717, -116.508],
  斯米兰群岛: [8.658, 97.64], 皮皮岛: [7.741, 98.778], 普吉岛: [7.951, 98.339], 兰塔岛: [7.624, 99.079], 甲米: [8.086, 98.906], 攀牙湾: [8.274, 98.501],
  大堡礁: [-18.287, 147.699], 圣灵群岛: [-20.282, 148.957], 丹翠雨林: [-16.17, 145.418], 库兰达: [-16.819, 145.638], 汉密尔顿岛: [-20.352, 148.95], 磁岛: [-19.139, 146.842],
}

const SPOT_MEDIA: Record<string, { image: string; imageSource: string; sourceUrl: string }> = {
  羊蹄山: { image: "https://www.visit-hokkaido.jp/lsc/upfile/spot/0001/0334/10334_7_l.jpg", imageSource: "HOKKAIDO LOVE! 官方实景", sourceUrl: "https://www.visit-hokkaido.jp/en/spot/detail_10334.html" },
  留寿都: { image: "https://www.visit-hokkaido.jp/lsc/upfile/spot/0001/0331/10331_5_l.jpg", imageSource: "HOKKAIDO LOVE! 官方实景", sourceUrl: "https://www.visit-hokkaido.jp/en/spot/detail_10331.html" },
  大雪山: { image: "https://www.visit-hokkaido.jp/lsc/upfile/spot/0001/0353/10353_1_l.jpg", imageSource: "HOKKAIDO LOVE! 官方实景", sourceUrl: "https://www.visit-hokkaido.jp/en/spot/detail_10353.html" },
  知床五湖: { image: "https://www.visit-hokkaido.jp/lsc/upfile/spot/0001/0404/10404_7_l.jpg", imageSource: "HOKKAIDO LOVE! 官方实景", sourceUrl: "https://www.visit-hokkaido.jp/en/spot/detail_10404.html" },
  洞爷湖: { image: "https://www.visit-hokkaido.jp/lsc/upfile/spot/0001/0050/10050_9_l.jpg", imageSource: "HOKKAIDO LOVE! 官方实景", sourceUrl: "https://www.visit-hokkaido.jp/cn/spot/detail_10050.html" },
  登别: { image: "https://www.visit-hokkaido.jp/lsc/upfile/spot/0001/0614/10614_8_l.jpg", imageSource: "HOKKAIDO LOVE! 官方实景", sourceUrl: "https://www.visit-hokkaido.jp/en/spa/spot/detail_10614.html" },
  将军山: { image: "https://www.news.cn/20250212/b5612e5c6c4e44278b69868df0ad880f/20250212b5612e5c6c4e44278b69868df0ad880f_bfb3f8135a744fc4ac6dd14c0bf70462.JPG", imageSource: "新华社 · 冰雪阿勒泰实拍", sourceUrl: "https://www.news.cn/20250212/b5612e5c6c4e44278b69868df0ad880f/c.html" },
}

const RESOURCE_MEDIA: Record<string, { image: string; imageSource: string; sourceUrl: string }> = {
  滑雪: { image: "https://images.unsplash.com/photo-1551524559-8af4e6624178?auto=format&fit=crop&w=640&q=82", imageSource: "目的地实景图库", sourceUrl: "https://unsplash.com/" },
  徒步: { image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=640&q=82", imageSource: "目的地实景图库", sourceUrl: "https://unsplash.com/" },
  潜水: { image: "https://images.unsplash.com/photo-1530053969600-caed2596d242?auto=format&fit=crop&w=640&q=82", imageSource: "目的地实景图库", sourceUrl: "https://unsplash.com/" },
  海岛: { image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=640&q=82", imageSource: "目的地实景图库", sourceUrl: "https://unsplash.com/" },
  海岸: { image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=640&q=82", imageSource: "目的地实景图库", sourceUrl: "https://unsplash.com/" },
  温泉: { image: "https://images.unsplash.com/photo-1578469645742-46cae010e5d4?auto=format&fit=crop&w=640&q=82", imageSource: "目的地实景图库", sourceUrl: "https://unsplash.com/" },
  自驾: { image: "https://images.unsplash.com/photo-1511497584788-876760111969?auto=format&fit=crop&w=640&q=82", imageSource: "目的地实景图库", sourceUrl: "https://unsplash.com/" },
  摄影: { image: "https://images.unsplash.com/photo-1464278533981-50106e6176b1?auto=format&fit=crop&w=640&q=82", imageSource: "目的地实景图库", sourceUrl: "https://unsplash.com/" },
  文化: { image: "https://images.unsplash.com/photo-1528360983277-13d401cdc186?auto=format&fit=crop&w=640&q=82", imageSource: "目的地实景图库", sourceUrl: "https://unsplash.com/" },
  亲子: { image: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=640&q=82", imageSource: "目的地实景图库", sourceUrl: "https://unsplash.com/" },
}

export function getRegionResourceSpots(region: DestinationRegion, resourceType: string): DestinationSpot[] {
  const names = REGION_SPOTLIGHTS[region.id]?.[resourceType] || [region.summary]
  return names.map(name => ({ name, focus: SPOT_COORDINATES[name] || region.focus, ...(SPOT_MEDIA[name] || RESOURCE_MEDIA[resourceType] || RESOURCE_MEDIA.徒步) }))
}

export const COUNTRIES_BY_CONTINENT: Record<string, DestinationCountry[]> = {
  亚洲: [
    { code: "JPN", name: "日本", english: "Japan", focus: [36.2, 138.2], score: 98, tagline: "雪国、古都与海岸线", season: "全年", visited: true },
    { code: "THA", name: "泰国", english: "Thailand", focus: [15.8, 101], score: 95, tagline: "海岛与热带城市", season: "11—02 月", visited: false },
    { code: "IDN", name: "印度尼西亚", english: "Indonesia", focus: [-2.4, 118], score: 93, tagline: "火山群岛与潜水", season: "05—09 月", visited: false },
    { code: "VNM", name: "越南", english: "Vietnam", focus: [16.2, 107.8], score: 91, tagline: "山海公路与古城", season: "02—04 月", visited: false },
    { code: "CHN", name: "中国", english: "China", focus: [35.8, 104.2], score: 90, tagline: "高原、森林与长城", season: "全年", visited: true },
    { code: "KOR", name: "韩国", english: "South Korea", focus: [36.4, 127.9], score: 87, tagline: "城市、美食与海岛", season: "04—10 月", visited: false },
  ],
  欧洲: [
    { code: "ITA", name: "意大利", english: "Italy", focus: [42.8, 12.5], score: 99, tagline: "艺术、山海与古城", season: "04—10 月", visited: false },
    { code: "FRA", name: "法国", english: "France", focus: [46.3, 2.2], score: 97, tagline: "城堡、山谷与海岸", season: "05—09 月", visited: false },
    { code: "ISL", name: "冰岛", english: "Iceland", focus: [64.9, -18.7], score: 96, tagline: "冰川、火山与极光", season: "09—03 月", visited: false },
    { code: "ESP", name: "西班牙", english: "Spain", focus: [40.3, -3.7], score: 94, tagline: "建筑、海岸与公路", season: "03—06 月", visited: false },
    { code: "CHE", name: "瑞士", english: "Switzerland", focus: [46.8, 8.2], score: 93, tagline: "高山列车与湖泊", season: "06—09 月", visited: false },
    { code: "NOR", name: "挪威", english: "Norway", focus: [61.6, 8.5], score: 91, tagline: "峡湾与北境公路", season: "05—09 月", visited: false },
  ],
  大洋洲: [
    { code: "NZL", name: "新西兰", english: "New Zealand", focus: [-41.2, 174.7], score: 98, tagline: "雪山、湖泊与牧场", season: "11—03 月", visited: false },
    { code: "AUS", name: "澳大利亚", english: "Australia", focus: [-25.3, 133.8], score: 96, tagline: "荒野、海岸与珊瑚礁", season: "04—10 月", visited: false },
    { code: "FJI", name: "斐济", english: "Fiji", focus: [-17.7, 178.1], score: 90, tagline: "热带岛屿与潟湖", season: "05—10 月", visited: false },
  ],
  北美: [
    { code: "USA", name: "美国", english: "United States", focus: [39.8, -98.6], score: 98, tagline: "国家公园与传奇公路", season: "05—10 月", visited: false },
    { code: "CAN", name: "加拿大", english: "Canada", focus: [56.1, -106.3], score: 96, tagline: "落基山与冰川湖", season: "06—09 月", visited: false },
    { code: "MEX", name: "墨西哥", english: "Mexico", focus: [23.6, -102.5], score: 92, tagline: "遗址、色彩与加勒比海", season: "11—04 月", visited: false },
    { code: "CRI", name: "哥斯达黎加", english: "Costa Rica", focus: [9.7, -84.1], score: 89, tagline: "雨林、火山与动物", season: "12—04 月", visited: false },
  ],
}

export function findCountry(code: string) {
  return Object.values(COUNTRIES_BY_CONTINENT).flat().find(country => country.code === code)
}

export const REGIONS_BY_COUNTRY: Record<string, DestinationRegion[]> = {
  JPN: [
    { id: "hokkaido", name: "北海道", english: "Hokkaido", focus: [43.2, 142.7], heat: 99, visited: true, summary: "粉雪、火山湖与长距离自驾", resources: [{ type: "滑雪", score: 99 }, { type: "徒步", score: 91 }, { type: "温泉", score: 96 }] },
    { id: "okinawa", name: "冲绳", english: "Okinawa", focus: [26.3, 127.8], heat: 96, visited: false, summary: "珊瑚海、离岛与亚热带森林", resources: [{ type: "潜水", score: 99 }, { type: "海岛", score: 97 }, { type: "亲子", score: 91 }] },
    { id: "kyushu", name: "九州", english: "Kyushu", focus: [32.6, 130.8], heat: 93, visited: false, summary: "活火山、温泉与山海公路", resources: [{ type: "徒步", score: 95 }, { type: "温泉", score: 98 }, { type: "自驾", score: 92 }] },
    { id: "chugoku", name: "中国地区", english: "Chugoku", focus: [34.5, 133.5], heat: 87, visited: false, summary: "古城、峡谷与濑户内海", resources: [{ type: "文化", score: 93 }, { type: "徒步", score: 84 }, { type: "骑行", score: 91 }] },
    { id: "kansai", name: "关西", english: "Kansai", focus: [34.8, 135.5], heat: 98, visited: true, summary: "京都古寺、熊野古道与美食", resources: [{ type: "文化", score: 99 }, { type: "徒步", score: 92 }, { type: "美食", score: 98 }] },
    { id: "kanto", name: "关东", english: "Kanto", focus: [36, 139.5], heat: 97, visited: true, summary: "东京城市圈与富士山路线", resources: [{ type: "城市", score: 99 }, { type: "徒步", score: 93 }, { type: "滑雪", score: 87 }] },
  ],
  CHN: [
    { id: "xinjiang", name: "新疆", english: "Xinjiang", focus: [42.3, 85.6], heat: 99, visited: true, summary: "雪山、草原、沙漠与史诗公路", resources: [{ type: "骑马草原", score: 99 }, { type: "徒步", score: 98 }, { type: "滑雪", score: 93 }] },
    { id: "south", name: "华南", english: "South China", focus: [23.5, 112.6], heat: 95, visited: true, summary: "喀斯特、海岛与热带雨林", resources: [{ type: "潜水", score: 94 }, { type: "徒步", score: 90 }, { type: "美食", score: 98 }] },
    { id: "north", name: "华北", english: "North China", focus: [38.5, 115.2], heat: 93, visited: true, summary: "长城、古都与山地穿越", resources: [{ type: "文化", score: 99 }, { type: "徒步", score: 94 }, { type: "滑雪", score: 86 }] },
    { id: "northwest", name: "西北", english: "Northwest China", focus: [36.8, 103.3], heat: 96, visited: false, summary: "高原、戈壁与丝路遗迹", resources: [{ type: "自驾", score: 98 }, { type: "徒步", score: 95 }, { type: "摄影", score: 99 }] },
    { id: "northeast", name: "东北", english: "Northeast China", focus: [45.3, 126.6], heat: 91, visited: false, summary: "森林、火山湖与冰雪世界", resources: [{ type: "滑雪", score: 98 }, { type: "徒步", score: 90 }, { type: "温泉", score: 88 }] },
  ],
  ISL: [
    { id: "south-iceland", name: "冰岛南岸", english: "South Iceland", focus: [63.8, -19.6], heat: 98, visited: false, summary: "黑沙滩、瀑布、冰川与火山地貌", resources: [{ type: "自驾", score: 99 }, { type: "徒步", score: 94 }, { type: "温泉", score: 96 }] },
    { id: "north-iceland", name: "北部冰岛", english: "North Iceland", focus: [65.6, -17.2], heat: 91, visited: false, summary: "火山湖、峡谷与北境观鲸", resources: [{ type: "自驾", score: 93 }, { type: "摄影", score: 97 }, { type: "温泉", score: 91 }] },
  ],
  CHE: [
    { id: "bernese-oberland", name: "伯尔尼高地", english: "Bernese Oberland", focus: [46.62, 7.94], heat: 98, visited: false, summary: "雪峰、瀑布谷与高山列车", resources: [{ type: "徒步", score: 99 }, { type: "摄影", score: 98 }, { type: "亲子", score: 94 }] },
    { id: "lake-geneva", name: "日内瓦湖区", english: "Lake Geneva", focus: [46.45, 6.55], heat: 93, visited: false, summary: "湖岸葡萄园与法语古城", resources: [{ type: "文化", score: 96 }, { type: "骑行", score: 92 }, { type: "美食", score: 95 }] },
  ],
  NOR: [
    { id: "west-fjords", name: "西部峡湾", english: "Western Fjords", focus: [61.1, 6.8], heat: 99, visited: false, summary: "峡湾公路、瀑布与高山步道", resources: [{ type: "自驾", score: 99 }, { type: "徒步", score: 97 }, { type: "摄影", score: 99 }] },
    { id: "arctic-norway", name: "北极圈北部", english: "Arctic Norway", focus: [68.4, 17.6], heat: 95, visited: false, summary: "极光、海岸山脉与午夜太阳", resources: [{ type: "摄影", score: 99 }, { type: "徒步", score: 94 }, { type: "自驾", score: 92 }] },
  ],
  IDN: [
    { id: "bali", name: "巴厘岛", english: "Bali", focus: [-8.42, 115.19], heat: 98, visited: false, summary: "火山、珊瑚海与稻田文化", resources: [{ type: "潜水", score: 98 }, { type: "徒步", score: 91 }, { type: "海岸", score: 97 }] },
    { id: "java", name: "爪哇岛", english: "Java", focus: [-7.5, 110.2], heat: 94, visited: false, summary: "火山群、古迹与纵贯铁路", resources: [{ type: "徒步", score: 97 }, { type: "文化", score: 98 }, { type: "摄影", score: 95 }] },
  ],
  NZL: [
    { id: "south-island", name: "南岛", english: "South Island", focus: [-44.6, 169.1], heat: 99, visited: false, summary: "冰川、峡湾与高山湖泊", resources: [{ type: "自驾", score: 99 }, { type: "徒步", score: 99 }, { type: "亲子", score: 94 }] },
    { id: "north-island", name: "北岛", english: "North Island", focus: [-38.4, 175.6], heat: 94, visited: false, summary: "火山地热、海湾与毛利文化", resources: [{ type: "文化", score: 96 }, { type: "徒步", score: 93 }, { type: "海岸", score: 95 }] },
  ],
  CAN: [
    { id: "canadian-rockies", name: "加拿大落基山", english: "Canadian Rockies", focus: [51.3, -116.2], heat: 99, visited: false, summary: "冰川湖、高山公路与国家公园", resources: [{ type: "徒步", score: 99 }, { type: "自驾", score: 98 }, { type: "摄影", score: 99 }] },
    { id: "pacific-canada", name: "太平洋沿岸", english: "Pacific Canada", focus: [49.4, -123.2], heat: 94, visited: false, summary: "雨林、海湾与山海城市", resources: [{ type: "海岸", score: 96 }, { type: "徒步", score: 94 }, { type: "城市", score: 95 }] },
  ],
  THA: [
    { id: "andaman-coast", name: "安达曼海岸", english: "Andaman Coast", focus: [8.1, 98.4], heat: 97, visited: false, summary: "石灰岩海湾、离岛与潜点", resources: [{ type: "潜水", score: 98 }, { type: "海岛", score: 99 }, { type: "亲子", score: 92 }] },
    { id: "north-thailand", name: "泰北", english: "North Thailand", focus: [18.8, 99.0], heat: 92, visited: false, summary: "山地古城、森林与市集", resources: [{ type: "文化", score: 96 }, { type: "徒步", score: 91 }, { type: "美食", score: 97 }] },
  ],
  AUS: [
    { id: "queensland-tropics", name: "昆士兰热带北部", english: "Tropical Queensland", focus: [-18.2, 146.2], heat: 98, visited: false, summary: "珊瑚礁、热带雨林与海岛", resources: [{ type: "潜水", score: 99 }, { type: "徒步", score: 91 }, { type: "海岛", score: 98 }] },
    { id: "tasmania", name: "塔斯马尼亚", english: "Tasmania", focus: [-42.0, 146.7], heat: 94, visited: false, summary: "荒野海岸与高山步道", resources: [{ type: "徒步", score: 98 }, { type: "自驾", score: 96 }, { type: "摄影", score: 95 }] },
  ],
  ITA: [
    { id: "north-italy", name: "意大利北部", english: "Northern Italy", focus: [45.7, 10.7], heat: 98, visited: false, summary: "多洛米蒂与湖区", resources: [{ type: "徒步", score: 99 }, { type: "滑雪", score: 97 }, { type: "自驾", score: 94 }] },
    { id: "tuscany", name: "托斯卡纳", english: "Tuscany", focus: [43.4, 11.1], heat: 97, visited: false, summary: "丘陵、庄园与文艺古城", resources: [{ type: "文化", score: 99 }, { type: "骑行", score: 94 }, { type: "美食", score: 98 }] },
    { id: "south-italy", name: "意大利南部", english: "Southern Italy", focus: [40.5, 16.2], heat: 92, visited: false, summary: "悬崖海岸与古老村落", resources: [{ type: "海岸", score: 97 }, { type: "徒步", score: 89 }, { type: "文化", score: 95 }] },
    { id: "sicily", name: "西西里", english: "Sicily", focus: [37.6, 14.1], heat: 94, visited: false, summary: "火山、遗址与地中海", resources: [{ type: "潜水", score: 91 }, { type: "徒步", score: 95 }, { type: "美食", score: 96 }] },
  ],
  USA: [
    { id: "west-coast", name: "西海岸", english: "West Coast", focus: [37.2, -120.1], heat: 99, visited: false, summary: "太平洋公路与国家公园", resources: [{ type: "自驾", score: 99 }, { type: "徒步", score: 98 }, { type: "冲浪", score: 93 }] },
    { id: "rockies", name: "落基山地区", english: "Rockies", focus: [42.4, -110.1], heat: 97, visited: false, summary: "雪山、峡谷与荒野", resources: [{ type: "徒步", score: 99 }, { type: "滑雪", score: 98 }, { type: "露营", score: 97 }] },
    { id: "northeast-us", name: "东北部", english: "Northeast", focus: [42.5, -73.2], heat: 91, visited: false, summary: "城市、森林与秋色公路", resources: [{ type: "城市", score: 97 }, { type: "徒步", score: 88 }, { type: "自驾", score: 91 }] },
    { id: "hawaii", name: "夏威夷", english: "Hawaii", focus: [20.8, -156.3], heat: 96, visited: false, summary: "火山群岛与深蓝海洋", resources: [{ type: "潜水", score: 99 }, { type: "冲浪", score: 99 }, { type: "徒步", score: 94 }] },
  ],
}

export function getRegionsForCountry(country: DestinationCountry | null): DestinationRegion[] {
  if (!country) return []
  if (REGIONS_BY_COUNTRY[country.code]) return REGIONS_BY_COUNTRY[country.code]
  const [lat, lon] = country.focus
  return [
    { id: `${country.code}-north`, name: "北部探索区", english: `North ${country.english}`, focus: [lat + 3, lon], heat: 91, visited: false, summary: "山地、森林与季节路线", resources: [{ type: "徒步", score: 92 }, { type: "自驾", score: 88 }, { type: "摄影", score: 90 }] },
    { id: `${country.code}-central`, name: "中部核心区", english: `Central ${country.english}`, focus: [lat, lon], heat: 95, visited: false, summary: "城市文化与经典线路", resources: [{ type: "文化", score: 96 }, { type: "美食", score: 94 }, { type: "亲子", score: 89 }] },
    { id: `${country.code}-coast`, name: "海岸探索区", english: `Coastal ${country.english}`, focus: [lat - 2, lon + 2], heat: 89, visited: false, summary: "海岸、公路与水上活动", resources: [{ type: "潜水", score: 86 }, { type: "海岸", score: 93 }, { type: "自驾", score: 91 }] },
  ]
}
