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

/**
 * 中国省级行政区 → 旅游板块显式映射。
 * key = admin1 geojson 的 iso_3166_2 代码；value = 对应地区 id。
 * 替代过去"质心最近邻"的粗糙分派，让地图上每个省的板块归属与国家推荐旅游板块一致。
 * 台湾岛在本边界数据集内无独立省界，天然随福建省（CN-FJ → east）涵盖，无需单独处理。
 */
export const CHINA_PROVINCE_TO_REGION: Record<string, string> = {
  "CN-HL": "northeast", "CN-JL": "northeast", "CN-LN": "northeast",
  "CN-BJ": "north", "CN-TJ": "north", "CN-HE": "north", "CN-SX": "north", "CN-NM": "north",
  "CN-SH": "east", "CN-JS": "east", "CN-ZJ": "east", "CN-AH": "east", "CN-FJ": "east", "CN-JX": "east", "CN-SD": "east",
  "CN-HA": "central", "CN-HB": "central", "CN-HN": "central",
  "CN-GD": "south", "CN-GX": "south", "CN-HI": "south", "CN-X01~": "south",
  "CN-CQ": "southwest", "CN-SC": "southwest", "CN-GZ": "southwest", "CN-YN": "southwest", "CN-XZ": "southwest",
  "CN-SN": "northwest", "CN-GS": "northwest", "CN-QH": "northwest", "CN-NX": "northwest", "CN-XJ": "northwest",
}

/** 中国各旅游板块的地图配色（板块彩色填色，使华东/华南等地界一眼可辨）。 */
export const CHINA_REGION_PALETTE: Record<string, { fill: string; stroke: string }> = {
  northeast: { fill: "#2d5b8a", stroke: "#5fa8e6" },
  north: { fill: "#7a4a2e", stroke: "#e0a578" },
  east: { fill: "#1f6b5e", stroke: "#4ec3a8" },
  central: { fill: "#5a3d7a", stroke: "#b08be0" },
  south: { fill: "#8a3a2e", stroke: "#ef7a5a" },
  southwest: { fill: "#7a6a1f", stroke: "#e6c34e" },
  northwest: { fill: "#6b5a3a", stroke: "#d8b878" },
}

const REGION_SPOTLIGHTS: Record<string, Record<string, string[]>> = {
  hokkaido: { 滑雪: ["羊蹄山", "留寿都"], 徒步: ["大雪山", "知床五湖"], 温泉: ["洞爷湖", "登别"] },
  tohoku: { 温泉: ["银山温泉", "酸汤温泉"], 徒步: ["十和田湖", "藏王"], 文化: ["仙台", "平泉"] },
  kanto: { 城市: ["东京塔", "横滨港"], 徒步: ["高尾山", "奥多摩"], 滑雪: ["谷川岳", "草津"] },
  chubu: { 徒步: ["富士山", "上高地"], 滑雪: ["白马", "志贺高原"], 自驾: ["北阿尔卑斯", "立山黑部"] },
  kinki: { 文化: ["京都古寺", "奈良町"], 徒步: ["熊野古道", "六甲山"], 美食: ["大阪道顿堀", "锦市场"] },
  chugoku: { 文化: ["严岛神社", "仓敷古城"], 徒步: ["大山", "三段峡"], 骑行: ["岛波海道", "宍道湖"] },
  shikoku: { 徒步: ["四国遍路", "石锤山"], 文化: ["金刀比罗宫", "道后温泉"], 自驾: ["四国遍路公路", "祖谷溪"] },
  kyushu: { 徒步: ["阿苏火山", "屋久岛"], 温泉: ["由布院", "黑川温泉"], 潜水: ["青之洞窟", "屋久岛"] },
  okinawa: { 潜水: ["庆良间群岛", "青之洞窟"], 海岛: ["宫古岛", "石垣岛"], 亲子: ["美丽海水族馆", "古宇利岛"] },
  "capital-kr": { 城市: ["首尔南山", "仁川松岛"], 文化: ["景福宫", "北村"], 美食: ["弘大", "明洞"] },
  gangwon: { 滑雪: ["龙平滑雪场", "平昌"], 徒步: ["雪岳山", "五台山"], 海岸: ["江陵", "束草"] },
  chungcheong: { 文化: ["公州", "扶余"], 徒步: ["鸡龙山", "俗离山"], 城市: ["大田", "世宗"] },
  jeolla: { 美食: ["全州拌饭", "光州"], 海岸: ["木浦", "丽水"], 文化: ["全州韩屋村", "潭阳"] },
  gyeongsang: { 城市: ["釜山海云台", "大邱"], 文化: ["庆州佛国寺", "安东河回"], 海岸: ["釜山太宗台", "浦项"] },
  jeju: { 海岛: ["城山日出峰", "牛岛"], 徒步: ["汉拿山", "奥尔勒步道"], 亲子: ["泰迪熊博物馆", "香水湾"] },
  northeast: { 滑雪: ["长白山", "亚布力"], 徒步: ["大兴安岭", "镜泊湖"], 温泉: ["长白山温泉", "阿尔山"] },
  north: { 文化: ["北京中轴线", "大同古城"], 徒步: ["长城", "五台山"], 滑雪: ["崇礼", "南山"] },
  east: { 文化: ["苏州园林", "杭州西湖"], 海岸: ["青岛", "厦门鼓浪屿"], 美食: ["上海本帮", "南京秦淮"] },
  central: { 徒步: ["张家界", "三峡"], 文化: ["洛阳龙门", "武汉黄鹤楼"], 自驾: ["神农架", "恩施"] },
  south: { 潜水: ["蜈支洲岛", "涠洲岛"], 徒步: ["武功山", "漓江古道"], 美食: ["广州西关", "潮州古城"] },
  southwest: { 徒步: ["稻城亚丁", "香格里拉"], 文化: ["丽江古城", "布达拉宫"], 摄影: ["九寨沟", "黄果树"] },
  northwest: { 自驾: ["河西走廊", "独库公路"], 徒步: ["喀纳斯", "祁连山"], 摄影: ["敦煌", "张掖丹霞"] },
  "north-italy": { 徒步: ["多洛米蒂", "科莫湖"], 滑雪: ["科尔蒂纳", "瓦尔加迪纳"], 自驾: ["加尔达湖", "斯泰尔维奥"] },
  "central-italy": { 文化: ["佛罗伦萨", "锡耶纳"], 骑行: ["奥尔恰谷", "基安蒂"], 美食: ["卢卡", "圣吉米尼亚诺"] },
  "west": { 自驾: ["一号公路", "红杉公路"], 徒步: ["优胜美地", "雷尼尔山"], 冲浪: ["圣克鲁兹", "马里布"] },
  "mountain-us": { 徒步: ["大提顿", "冰川公园"], 滑雪: ["阿斯彭", "杰克逊霍尔"], 露营: ["黄石", "落基山公园"] },
  "south-iceland": { 自驾: ["维克", "杰古沙龙冰河湖"], 徒步: ["斯科加瀑布", "斯卡夫塔山"], 温泉: ["蓝湖", "天空之湖"] },
  "alpine-ch": { 徒步: ["格林德瓦", "劳特布龙嫩"], 摄影: ["少女峰", "布里恩茨湖"], 亲子: ["因特拉肯", "门利兴"] },
  "west-no": { 自驾: ["松恩峡湾", "大西洋之路"], 徒步: ["布道石", "恶魔之舌"], 摄影: ["盖朗厄尔峡湾", "弗洛姆"] },
  "bali-nt": { 潜水: ["努沙佩尼达", "图兰奔"], 徒步: ["巴杜尔火山", "坎普罕山脊"], 海岸: ["乌鲁瓦图", "水明漾"] },
  "south-island": { 自驾: ["米尔福德峡湾", "瓦纳卡"], 徒步: ["胡克谷步道", "路特本步道"], 亲子: ["皇后镇", "蒂卡波湖"] },
  "west-ca": { 徒步: ["露易丝湖", "冰原大道"], 自驾: ["班夫", "贾斯珀"], 摄影: ["梦莲湖", "佩托湖"] },
  "south-th": { 潜水: ["斯米兰群岛", "皮皮岛"], 海岛: ["普吉岛", "兰塔岛"], 亲子: ["甲米", "攀牙湾"] },
  qld: { 潜水: ["大堡礁", "圣灵群岛"], 徒步: ["丹翠雨林", "库兰达"], 海岛: ["汉密尔顿岛", "磁岛"] },
  "male-atolls": { 潜水: ["香蕉礁", "魔鬼鱼点"], 海岛: ["马累", "瑚湖尔岛"], 亲子: ["太阳岛", "天堂岛"] },
  "ari-atolls": { 潜水: ["珊瑚花园", "玛雅提拉"], 海岛: ["阿里环礁潟湖", "港丽岛"], 摄影: ["鲸鲨点", "夕阳海钓"] },
  "baa-atoll": { 潜水: ["哈尼法鲁湾", "蓝色洞穴"], 海岛: ["都喜天阙岛", "阿米拉岛"], 亲子: ["芭环礁生物圈", "海龟湾"] },
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
  // —— 马尔代夫 ——
  香蕉礁: [4.183, 73.532], 魔鬼鱼点: [3.978, 73.424], 马累: [4.175, 73.509], 瑚湖尔岛: [4.192, 73.541], 太阳岛: [4.278, 73.568], 天堂岛: [4.205, 73.532],
  珊瑚花园: [3.579, 72.812], 玛雅提拉: [3.662, 72.848], 阿里环礁潟湖: [3.62, 72.83], 港丽岛: [3.492, 72.818], 鲸鲨点: [3.552, 72.801], 夕阳海钓: [3.62, 72.83],
  哈尼法鲁湾: [5.189, 73.108], 蓝色洞穴: [5.102, 73.028], 都喜天阙岛: [5.131, 73.062], 阿米拉岛: [5.158, 73.068], 芭环礁生物圈: [5.189, 73.108], 海龟湾: [5.078, 73.002],
  // —— 日本：东北 / 中部 / 四国 ——
  银山温泉: [38.572, 140.523], 酸汤温泉: [40.464, 140.842], 十和田湖: [40.361, 141.013], 藏王: [38.166, 140.437], 仙台: [38.268, 140.872], 平泉: [38.989, 141.111],
  奥多摩: [35.808, 139.084], 上高地: [36.249, 137.69], 白马: [36.7, 137.732], 志贺高原: [36.76, 138.504], 北阿尔卑斯: [36.265, 137.646], 立山黑部: [36.541, 137.611],
  四国遍路: [33.841, 133.556], 石锤山: [33.767, 133.121], 金刀比罗宫: [34.183, 133.979], 道后温泉: [33.851, 132.789], 四国遍路公路: [33.841, 133.556], 祖谷溪: [33.853, 133.832],
  // —— 韩国 ——
  首尔南山: [37.552, 126.988], 仁川松岛: [37.398, 126.632], 景福宫: [37.58, 126.977], 北村: [37.583, 126.984], 弘大: [37.557, 126.924], 明洞: [37.564, 126.98],
  龙平滑雪场: [37.643, 128.669], 平昌: [37.37, 128.39], 雪岳山: [38.109, 128.467], 江陵: [37.752, 128.876], 束草: [38.207, 128.591],
  公州: [36.451, 127.121], 扶余: [36.281, 126.909], 鸡龙山: [36.495, 127.219], 俗离山: [36.026, 127.873], 大田: [36.351, 127.385], 世宗: [36.561, 127.259],
  全州拌饭: [35.824, 127.149], 光州: [35.16, 126.852], 木浦: [34.812, 126.392], 丽水: [34.76, 127.662], 全州韩屋村: [35.815, 127.153], 潭阳: [35.321, 126.988],
  釜山海云台: [35.158, 129.16], 大邱: [35.871, 128.601], 庆州佛国寺: [35.79, 129.332], 安东河回: [36.542, 128.226], 釜山太宗台: [35.051, 129.086], 浦项: [36.019, 129.343],
  城山日出峰: [33.46, 126.942], 牛岛: [33.506, 126.952], 汉拿山: [33.362, 126.532], 奥尔勒步道: [33.246, 126.561], 泰迪熊博物馆: [33.247, 126.412], 香水湾: [33.257, 126.642],
  // —— 中国 ——
  苏州园林: [31.325, 120.628], 杭州西湖: [30.242, 120.149], 青岛: [36.067, 120.383], 厦门鼓浪屿: [24.448, 118.067], 上海本帮: [31.231, 121.474], 南京秦淮: [32.019, 118.786],
  张家界: [29.326, 110.435], 三峡: [30.838, 111.046], 洛阳龙门: [34.556, 112.471], 武汉黄鹤楼: [30.545, 114.302], 神农架: [31.5, 110.5], 恩施: [30.272, 109.488],
  稻城亚丁: [28.448, 100.331], 香格里拉: [27.831, 99.706], 丽江古城: [26.872, 100.226], 布达拉宫: [29.658, 91.117], 九寨沟: [33.164, 103.917], 黄果树: [25.997, 105.678],
  河西走廊: [39.738, 98.494], 独库公路: [43.0, 84.5], 祁连山: [38.4, 99.5], 敦煌: [40.142, 94.664], 张掖丹霞: [38.961, 100.131],
  // —— 意大利 ——
  多洛米蒂: [46.41, 11.856], 科莫湖: [46.015, 9.257], 科尔蒂纳: [46.539, 12.136], 瓦尔加迪纳: [46.557, 11.825], 加尔达湖: [45.629, 10.637], 斯泰尔维奥: [46.518, 10.453],
  佛罗伦萨: [43.769, 11.256], 锡耶纳: [43.319, 11.331], 奥尔恰谷: [43.07, 11.61], 基安蒂: [43.446, 11.255], 卢卡: [43.843, 10.503], 圣吉米尼亚诺: [43.487, 11.043],
  // —— 美国 ——
  一号公路: [36.602, -121.902], 红杉公路: [40.444, -123.685], 优胜美地: [37.865, -119.538], 雷尼尔山: [46.852, -121.76], 圣克鲁兹: [36.974, -122.03], 马里布: [34.026, -118.779],
  大提顿: [43.79, -110.682], 冰川公园: [48.766, -113.788], 阿斯彭: [39.192, -106.817], 杰克逊霍尔: [43.479, -110.763], 黄石: [44.428, -110.588], 落基山公园: [40.343, -105.686],
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
    { code: "MDV", name: "马尔代夫", english: "Maldives", focus: [3.2, 73.2], score: 94, tagline: "珊瑚环礁与水下花园", season: "11—04 月", visited: false },
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
  南美: [
    { code: "BRA", name: "巴西", english: "Brazil", focus: [-14.2, -51.9], score: 97, tagline: "雨林、海岸与瀑布", season: "05—09 月", visited: false },
    { code: "ARG", name: "阿根廷", english: "Argentina", focus: [-38.4, -63.6], score: 96, tagline: "巴塔哥尼亚与冰川", season: "11—03 月", visited: false },
    { code: "PER", name: "秘鲁", english: "Peru", focus: [-9.2, -75.0], score: 95, tagline: "安第斯遗址与高原", season: "05—09 月", visited: false },
    { code: "CHL", name: "智利", english: "Chile", focus: [-35.7, -71.5], score: 93, tagline: "火山、沙漠与南端公路", season: "11—03 月", visited: false },
  ],
  非洲: [
    { code: "ZAF", name: "南非", english: "South Africa", focus: [-30.6, 22.9], score: 97, tagline: "国家公园与好望角", season: "05—09 月", visited: false },
    { code: "EGY", name: "埃及", english: "Egypt", focus: [26.8, 30.8], score: 95, tagline: "尼罗河与古文明", season: "10—04 月", visited: false },
    { code: "MAR", name: "摩洛哥", english: "Morocco", focus: [31.8, -7.1], score: 94, tagline: "古城、沙漠与阿特拉斯", season: "03—05 / 09—11 月", visited: false },
    { code: "KEN", name: "肯尼亚", english: "Kenya", focus: [0.0, 37.9], score: 96, tagline: "大迁徙与东非草原", season: "07—10 月", visited: false },
    { code: "TZA", name: "坦桑尼亚", english: "Tanzania", focus: [-6.4, 34.9], score: 95, tagline: "塞伦盖蒂与乞力马扎罗", season: "06—10 月", visited: false },
  ],
}

export function findCountry(code: string) {
  return Object.values(COUNTRIES_BY_CONTINENT).flat().find(country => country.code === code)
}

/** Regional divisions follow each country's common tourism / geographic scheme. */
export const REGIONS_BY_COUNTRY: Record<string, DestinationRegion[]> = {
  /* 日本：九大地方区分（九州与冲绳分立） */
  JPN: [
    { id: "hokkaido", name: "北海道地方", english: "Hokkaido", focus: [43.2, 142.7], heat: 99, visited: true, summary: "夏季花海与冬季粉雪滑雪", resources: [{ type: "滑雪", score: 99 }, { type: "徒步", score: 91 }, { type: "温泉", score: 96 }] },
    { id: "tohoku", name: "东北地方", english: "Tohoku", focus: [39.7, 140.7], heat: 92, visited: false, summary: "本州最北端的自然风光与温泉", resources: [{ type: "温泉", score: 97 }, { type: "徒步", score: 93 }, { type: "文化", score: 90 }] },
    { id: "kanto", name: "关东地方", english: "Kanto", focus: [36.0, 139.5], heat: 98, visited: true, summary: "以东京为中心的政治经济核心", resources: [{ type: "城市", score: 99 }, { type: "徒步", score: 90 }, { type: "美食", score: 96 }] },
    { id: "chubu", name: "中部地方", english: "Chubu", focus: [36.2, 138.0], heat: 97, visited: false, summary: "富士山与日本阿尔卑斯山景", resources: [{ type: "徒步", score: 99 }, { type: "滑雪", score: 96 }, { type: "自驾", score: 94 }] },
    { id: "kinki", name: "近畿地方", english: "Kinki (Kansai)", focus: [34.8, 135.5], heat: 99, visited: true, summary: "关西古都文化中心（京都·大阪·奈良）", resources: [{ type: "文化", score: 99 }, { type: "美食", score: 98 }, { type: "徒步", score: 92 }] },
    { id: "chugoku", name: "中国地方", english: "Chugoku", focus: [34.5, 133.2], heat: 88, visited: false, summary: "本州最西部的古城与濑户内海", resources: [{ type: "文化", score: 94 }, { type: "骑行", score: 92 }, { type: "徒步", score: 86 }] },
    { id: "shikoku", name: "四国地方", english: "Shikoku", focus: [33.8, 133.5], heat: 89, visited: false, summary: "四国岛遍路与溪谷山景", resources: [{ type: "徒步", score: 96 }, { type: "文化", score: 93 }, { type: "自驾", score: 90 }] },
    { id: "kyushu", name: "九州地方", english: "Kyushu", focus: [32.8, 130.7], heat: 96, visited: false, summary: "九州火山温泉与森林溪谷", resources: [{ type: "温泉", score: 98 }, { type: "徒步", score: 95 }, { type: "潜水", score: 92 }] },
    { id: "okinawa", name: "冲绳地方", english: "Okinawa", focus: [26.5, 128.0], heat: 97, visited: false, summary: "冲绳亚热带珊瑚礁与离岛", resources: [{ type: "潜水", score: 99 }, { type: "海岛", score: 98 }, { type: "亲子", score: 95 }] },
  ],
  /* 韩国：六大旅游文化圈 */
  KOR: [
    { id: "capital-kr", name: "首都圈", english: "Capital Area", focus: [37.5, 127.0], heat: 99, visited: false, summary: "首尔、京畿道与仁川", resources: [{ type: "城市", score: 99 }, { type: "文化", score: 97 }, { type: "美食", score: 96 }] },
    { id: "gangwon", name: "江原道", english: "Gangwon", focus: [37.8, 128.2], heat: 95, visited: false, summary: "山地自然风光与滑雪胜地", resources: [{ type: "滑雪", score: 98 }, { type: "徒步", score: 96 }, { type: "海岸", score: 90 }] },
    { id: "chungcheong", name: "忠清道", english: "Chungcheong", focus: [36.5, 127.3], heat: 88, visited: false, summary: "中部大田、世宗与百济遗产", resources: [{ type: "文化", score: 93 }, { type: "城市", score: 88 }, { type: "徒步", score: 86 }] },
    { id: "jeolla", name: "全罗道", english: "Jeolla", focus: [35.2, 126.9], heat: 92, visited: false, summary: "西南平原与韩式美食故乡", resources: [{ type: "美食", score: 99 }, { type: "文化", score: 94 }, { type: "海岸", score: 90 }] },
    { id: "gyeongsang", name: "庆尚道", english: "Gyeongsang", focus: [35.5, 128.8], heat: 96, visited: false, summary: "釜山、大邱与庆州新罗遗产", resources: [{ type: "城市", score: 97 }, { type: "文化", score: 98 }, { type: "海岸", score: 94 }] },
    { id: "jeju", name: "济州岛", english: "Jeju", focus: [33.4, 126.5], heat: 98, visited: false, summary: "韩国最大岛屿与度假胜地", resources: [{ type: "海岛", score: 99 }, { type: "徒步", score: 95 }, { type: "亲子", score: 96 }] },
  ],
  /* 中国：国家推荐七大旅游板块 + 粤港澳大湾区 */
  CHN: [
    { id: "northeast", name: "东北地区", english: "Northeast China", focus: [43.9, 126.5], heat: 93, visited: false, summary: "黑吉辽冰雪文化与林海雪原", resources: [{ type: "滑雪", score: 98 }, { type: "徒步", score: 90 }, { type: "温泉", score: 88 }] },
    { id: "north", name: "华北地区", english: "North China", focus: [39.5, 116.0], heat: 96, visited: true, summary: "京津冀晋与内蒙古古都草原", resources: [{ type: "文化", score: 99 }, { type: "徒步", score: 94 }, { type: "滑雪", score: 86 }] },
    { id: "east", name: "华东地区", english: "East China", focus: [30.8, 119.2], heat: 98, visited: false, summary: "沪苏浙皖闽赣鲁江南水乡与山水", resources: [{ type: "文化", score: 98 }, { type: "美食", score: 97 }, { type: "海岸", score: 92 }] },
    { id: "central", name: "华中地区", english: "Central China", focus: [30.6, 114.3], heat: 91, visited: false, summary: "豫鄂湘交通枢纽与山水奇观", resources: [{ type: "徒步", score: 96 }, { type: "文化", score: 93 }, { type: "自驾", score: 90 }] },
    { id: "south", name: "华南地区", english: "South China", focus: [22.8, 109.6], heat: 95, visited: true, summary: "粤桂琼热带海滨与喀斯特山水", resources: [{ type: "潜水", score: 94 }, { type: "美食", score: 98 }, { type: "海岸", score: 96 }] },
    { id: "greater-bay-area", name: "粤港澳大湾区", english: "Guangdong–HK–Macao Greater Bay Area", focus: [22.95, 113.65], heat: 99, visited: false, summary: "珠三角城市带与港澳（需港澳通行证）", resources: [{ type: "城市", score: 99 }, { type: "美食", score: 98 }, { type: "海岸", score: 95 }] },
    { id: "southwest", name: "西南地区", english: "Southwest China", focus: [29.6, 102.7], heat: 97, visited: false, summary: "渝川黔滇藏自然与民族文化", resources: [{ type: "徒步", score: 99 }, { type: "文化", score: 97 }, { type: "摄影", score: 99 }] },
    { id: "northwest", name: "西北地区", english: "Northwest China", focus: [40.0, 95.0], heat: 99, visited: true, summary: "陕甘青宁新丝路与大漠高山", resources: [{ type: "自驾", score: 99 }, { type: "徒步", score: 97 }, { type: "摄影", score: 99 }] },
  ],
  /* 泰国：北 / 东北 / 中部 / 东 / 南 */
  THA: [
    { id: "north-th", name: "北部", english: "Northern Thailand", focus: [18.8, 99.0], heat: 94, visited: false, summary: "清迈清莱山地古城与市集", resources: [{ type: "文化", score: 96 }, { type: "徒步", score: 91 }, { type: "美食", score: 97 }] },
    { id: "northeast-th", name: "东北部", english: "Isan", focus: [15.0, 103.0], heat: 86, visited: false, summary: "伊桑高原文化与高棉遗迹", resources: [{ type: "文化", score: 92 }, { type: "美食", score: 94 }, { type: "徒步", score: 84 }] },
    { id: "central-th", name: "中部", english: "Central Thailand", focus: [14.0, 100.5], heat: 95, visited: false, summary: "曼谷与大城古都核心", resources: [{ type: "城市", score: 98 }, { type: "文化", score: 97 }, { type: "美食", score: 96 }] },
    { id: "east-th", name: "东部", english: "Eastern Thailand", focus: [12.9, 100.9], heat: 90, visited: false, summary: "芭堤雅与东南海岸度假", resources: [{ type: "海岸", score: 95 }, { type: "亲子", score: 91 }, { type: "潜水", score: 88 }] },
    { id: "south-th", name: "南部", english: "Southern Thailand", focus: [8.1, 98.4], heat: 98, visited: false, summary: "安达曼与泰国湾海岛潜点", resources: [{ type: "潜水", score: 99 }, { type: "海岛", score: 99 }, { type: "亲子", score: 92 }] },
  ],
  /* 马尔代夫：按旅游环礁分区 */
  MDV: [
    { id: "male-atolls", name: "马累环礁", english: "Malé (Kaafu) Atolls", focus: [4.09, 73.45], heat: 96, visited: false, summary: "首都圈与经典度假岛礁", resources: [{ type: "海岛", score: 98 }, { type: "潜水", score: 94 }, { type: "亲子", score: 93 }] },
    { id: "ari-atolls", name: "阿里环礁", english: "Ari (Alifu) Atolls", focus: [3.62, 72.83], heat: 99, visited: false, summary: "珊瑚花园与鲸鲨潜点最密集", resources: [{ type: "潜水", score: 99 }, { type: "海岛", score: 97 }, { type: "摄影", score: 95 }] },
    { id: "baa-atoll", name: "芭环礁", english: "Baa Atoll", focus: [5.10, 73.03], heat: 95, visited: false, summary: "联合国教科文组织生物圈保护区", resources: [{ type: "潜水", score: 98 }, { type: "海岛", score: 94 }, { type: "亲子", score: 90 }] },
  ],
  /* 印尼：主要大岛分区 */
  IDN: [
    { id: "sumatra", name: "苏门答腊", english: "Sumatra", focus: [0.5, 101.5], heat: 88, visited: false, summary: "雨林、火山湖与猩猩栖息地", resources: [{ type: "徒步", score: 94 }, { type: "摄影", score: 92 }, { type: "文化", score: 88 }] },
    { id: "java", name: "爪哇", english: "Java", focus: [-7.5, 110.2], heat: 95, visited: false, summary: "火山群、日惹古迹与纵贯铁路", resources: [{ type: "徒步", score: 97 }, { type: "文化", score: 98 }, { type: "摄影", score: 95 }] },
    { id: "bali-nt", name: "巴厘与努沙登加拉", english: "Bali & Nusa Tenggara", focus: [-8.5, 117.0], heat: 99, visited: false, summary: "巴厘文化与科莫多群岛", resources: [{ type: "潜水", score: 98 }, { type: "海岸", score: 97 }, { type: "徒步", score: 91 }] },
    { id: "kalimantan", name: "加里曼丹", english: "Kalimantan", focus: [0.5, 114.0], heat: 84, visited: false, summary: "婆罗洲雨林与河岸生态", resources: [{ type: "徒步", score: 93 }, { type: "摄影", score: 90 }, { type: "亲子", score: 80 }] },
    { id: "sulawesi", name: "苏拉威西", english: "Sulawesi", focus: [-2.0, 120.0], heat: 87, visited: false, summary: "托拉查文化与布纳肯潜水", resources: [{ type: "潜水", score: 97 }, { type: "文化", score: 94 }, { type: "徒步", score: 88 }] },
    { id: "papua-maluku", name: "巴布亚与马鲁古", english: "Papua & Maluku", focus: [-4.0, 138.0], heat: 85, visited: false, summary: "极东群岛与原始雨林", resources: [{ type: "潜水", score: 96 }, { type: "徒步", score: 95 }, { type: "摄影", score: 94 }] },
  ],
  /* 越南：北中南 */
  VNM: [
    { id: "north-vn", name: "北部", english: "Northern Vietnam", focus: [21.0, 105.8], heat: 97, visited: false, summary: "河内、下龙湾与沙巴山地", resources: [{ type: "文化", score: 96 }, { type: "徒步", score: 94 }, { type: "海岸", score: 93 }] },
    { id: "central-vn", name: "中部", english: "Central Vietnam", focus: [16.0, 108.2], heat: 95, visited: false, summary: "顺化会安与岘港海岸", resources: [{ type: "文化", score: 98 }, { type: "海岸", score: 95 }, { type: "美食", score: 94 }] },
    { id: "south-vn", name: "南部", english: "Southern Vietnam", focus: [10.8, 106.7], heat: 94, visited: false, summary: "胡志明市与湄公河三角洲", resources: [{ type: "城市", score: 95 }, { type: "美食", score: 96 }, { type: "亲子", score: 88 }] },
  ],
  /* 意大利：西北 / 东北 / 中部 / 南部 / 岛屿 */
  ITA: [
    { id: "northwest-it", name: "西北部", english: "Northwest Italy", focus: [45.1, 7.7], heat: 94, visited: false, summary: "米兰、都灵与利古里亚海岸", resources: [{ type: "城市", score: 97 }, { type: "美食", score: 96 }, { type: "海岸", score: 92 }] },
    { id: "northeast-it", name: "东北部", english: "Northeast Italy", focus: [45.7, 11.5], heat: 98, visited: false, summary: "多洛米蒂、威尼斯与加尔达湖", resources: [{ type: "徒步", score: 99 }, { type: "滑雪", score: 97 }, { type: "文化", score: 96 }] },
    { id: "central-italy", name: "中部", english: "Central Italy", focus: [42.9, 12.5], heat: 99, visited: false, summary: "罗马、托斯卡纳与翁布里亚", resources: [{ type: "文化", score: 99 }, { type: "美食", score: 98 }, { type: "骑行", score: 94 }] },
    { id: "south-italy", name: "南部", english: "Southern Italy", focus: [40.9, 15.0], heat: 93, visited: false, summary: "那不勒斯湾与普利亚海岸", resources: [{ type: "海岸", score: 97 }, { type: "美食", score: 96 }, { type: "文化", score: 94 }] },
    { id: "islands-it", name: "西西里与撒丁", english: "Sicily & Sardinia", focus: [39.0, 9.1], heat: 95, visited: false, summary: "地中海火山岛与沙滩", resources: [{ type: "海岸", score: 98 }, { type: "徒步", score: 93 }, { type: "美食", score: 95 }] },
  ],
  /* 法国：本土主要旅游大区 */
  FRA: [
    { id: "idf", name: "法兰西岛", english: "Île-de-France", focus: [48.86, 2.35], heat: 99, visited: false, summary: "巴黎都会与周边城堡", resources: [{ type: "城市", score: 99 }, { type: "文化", score: 99 }, { type: "美食", score: 97 }] },
    { id: "north-fra", name: "北部与诺曼底", english: "North & Normandy", focus: [49.2, 0.4], heat: 90, visited: false, summary: "海岸、二战遗址与田园", resources: [{ type: "海岸", score: 93 }, { type: "文化", score: 94 }, { type: "自驾", score: 90 }] },
    { id: "east-fra", name: "东部阿尔卑斯", english: "East & Alps", focus: [45.9, 6.1], heat: 96, visited: false, summary: "霞慕尼与汝拉山地", resources: [{ type: "滑雪", score: 98 }, { type: "徒步", score: 97 }, { type: "摄影", score: 95 }] },
    { id: "west-fra", name: "西部大西洋", english: "West Atlantic", focus: [47.2, -1.6], heat: 91, visited: false, summary: "布列塔尼与卢瓦尔河谷", resources: [{ type: "海岸", score: 95 }, { type: "文化", score: 96 }, { type: "骑行", score: 92 }] },
    { id: "south-fra", name: "南部地中海", english: "South Mediterranean", focus: [43.6, 5.4], heat: 98, visited: false, summary: "普罗旺斯、蔚蓝海岸与科西嘉", resources: [{ type: "海岸", score: 98 }, { type: "美食", score: 97 }, { type: "摄影", score: 96 }] },
  ],
  /* 冰岛：首都 / 西 / 北 / 东 / 南 */
  ISL: [
    { id: "capital-is", name: "首都圈", english: "Capital Region", focus: [64.15, -21.95], heat: 94, visited: false, summary: "雷克雅未克与周边温泉", resources: [{ type: "城市", score: 93 }, { type: "温泉", score: 96 }, { type: "文化", score: 90 }] },
    { id: "west-is", name: "西部与西峡湾", english: "West & Westfjords", focus: [65.0, -22.5], heat: 90, visited: false, summary: "斯奈山半岛与西峡湾", resources: [{ type: "自驾", score: 95 }, { type: "摄影", score: 97 }, { type: "徒步", score: 92 }] },
    { id: "north-is", name: "北部", english: "North Iceland", focus: [65.6, -18.0], heat: 92, visited: false, summary: "阿克雷里、米湖与观鲸", resources: [{ type: "自驾", score: 93 }, { type: "摄影", score: 97 }, { type: "温泉", score: 91 }] },
    { id: "east-is", name: "东部", english: "East Iceland", focus: [65.0, -14.0], heat: 88, visited: false, summary: "峡湾村落与冰川前缘", resources: [{ type: "自驾", score: 92 }, { type: "徒步", score: 93 }, { type: "摄影", score: 94 }] },
    { id: "south-iceland", name: "南部", english: "South Iceland", focus: [63.8, -19.6], heat: 99, visited: false, summary: "黑沙滩、瀑布与杰古沙龙", resources: [{ type: "自驾", score: 99 }, { type: "徒步", score: 94 }, { type: "温泉", score: 96 }] },
  ],
  /* 西班牙：北 / 中 / 东 / 南 / 群岛 */
  ESP: [
    { id: "north-es", name: "北部", english: "Northern Spain", focus: [43.3, -3.0], heat: 93, visited: false, summary: "巴斯克、阿斯图里亚斯与朝圣之路", resources: [{ type: "美食", score: 98 }, { type: "徒步", score: 95 }, { type: "海岸", score: 92 }] },
    { id: "central-es", name: "中部", english: "Central Spain", focus: [40.4, -3.7], heat: 95, visited: false, summary: "马德里与卡斯蒂利亚古城", resources: [{ type: "城市", score: 97 }, { type: "文化", score: 98 }, { type: "美食", score: 94 }] },
    { id: "east-es", name: "东部", english: "Eastern Spain", focus: [39.5, -0.4], heat: 94, visited: false, summary: "巴塞罗那、瓦伦西亚与地中海", resources: [{ type: "城市", score: 98 }, { type: "海岸", score: 95 }, { type: "文化", score: 96 }] },
    { id: "south-es", name: "南部", english: "Andalusia", focus: [37.4, -5.0], heat: 97, visited: false, summary: "安达卢西亚摩尔遗产与阳光海岸", resources: [{ type: "文化", score: 99 }, { type: "海岸", score: 94 }, { type: "美食", score: 95 }] },
    { id: "islands-es", name: "群岛", english: "Balearic & Canary", focus: [28.3, -16.5], heat: 96, visited: false, summary: "巴利阿里与加那利度假群岛", resources: [{ type: "海岛", score: 98 }, { type: "冲浪", score: 94 }, { type: "徒步", score: 90 }] },
  ],
  /* 瑞士：西 / 中原 / 阿尔卑斯 / 南提契诺 */
  CHE: [
    { id: "west-ch", name: "西部罗曼蒂", english: "Romandy", focus: [46.5, 6.6], heat: 94, visited: false, summary: "日内瓦湖区与法语区古城", resources: [{ type: "文化", score: 96 }, { type: "骑行", score: 92 }, { type: "美食", score: 95 }] },
    { id: "plateau-ch", name: "中部高原", english: "Swiss Plateau", focus: [47.4, 8.5], heat: 91, visited: false, summary: "苏黎世、伯尔尼与城市湖岸", resources: [{ type: "城市", score: 95 }, { type: "文化", score: 93 }, { type: "亲子", score: 90 }] },
    { id: "alpine-ch", name: "阿尔卑斯", english: "Swiss Alps", focus: [46.6, 8.0], heat: 99, visited: false, summary: "伯尔尼高地、瓦莱与高山列车", resources: [{ type: "徒步", score: 99 }, { type: "摄影", score: 98 }, { type: "滑雪", score: 97 }] },
    { id: "ticino", name: "提契诺", english: "Ticino", focus: [46.2, 8.8], heat: 90, visited: false, summary: "南阿尔卑斯意大利语区湖城", resources: [{ type: "海岸", score: 88 }, { type: "徒步", score: 92 }, { type: "美食", score: 93 }] },
  ],
  /* 挪威：东 / 南 / 西 / 中 / 北 */
  NOR: [
    { id: "east-no", name: "东部", english: "Eastern Norway", focus: [59.9, 10.8], heat: 92, visited: false, summary: "奥斯陆与内陆山林", resources: [{ type: "城市", score: 94 }, { type: "徒步", score: 91 }, { type: "文化", score: 90 }] },
    { id: "south-no", name: "南部", english: "Southern Norway", focus: [58.1, 7.0], heat: 88, visited: false, summary: "南海岸夏日小镇", resources: [{ type: "海岸", score: 93 }, { type: "亲子", score: 90 }, { type: "自驾", score: 88 }] },
    { id: "west-no", name: "西部峡湾", english: "Western Fjords", focus: [61.1, 6.8], heat: 99, visited: false, summary: "松恩、盖朗厄尔与国家景观公路", resources: [{ type: "自驾", score: 99 }, { type: "徒步", score: 97 }, { type: "摄影", score: 99 }] },
    { id: "central-no", name: "中部", english: "Trøndelag", focus: [63.4, 10.4], heat: 87, visited: false, summary: "特隆赫姆与海岸山脉", resources: [{ type: "文化", score: 90 }, { type: "徒步", score: 91 }, { type: "自驾", score: 88 }] },
    { id: "north-no", name: "北部", english: "Northern Norway", focus: [68.4, 17.6], heat: 96, visited: false, summary: "罗弗敦、特罗姆瑟与极光", resources: [{ type: "摄影", score: 99 }, { type: "徒步", score: 94 }, { type: "自驾", score: 93 }] },
  ],
  /* 新西兰：南北岛 */
  NZL: [
    { id: "north-island", name: "北岛", english: "North Island", focus: [-38.4, 175.6], heat: 94, visited: false, summary: "火山地热、海湾与毛利文化", resources: [{ type: "文化", score: 96 }, { type: "徒步", score: 93 }, { type: "海岸", score: 95 }] },
    { id: "south-island", name: "南岛", english: "South Island", focus: [-44.0, 170.0], heat: 99, visited: false, summary: "冰川、峡湾与高山湖泊", resources: [{ type: "自驾", score: 99 }, { type: "徒步", score: 99 }, { type: "亲子", score: 94 }] },
  ],
  /* 澳大利亚：六州二领地（旅游合并） */
  AUS: [
    { id: "nsw-act", name: "新南威尔士与首都", english: "NSW & ACT", focus: [-33.9, 151.2], heat: 95, visited: false, summary: "悉尼、蓝山与堪培拉", resources: [{ type: "城市", score: 97 }, { type: "海岸", score: 95 }, { type: "徒步", score: 92 }] },
    { id: "vic", name: "维多利亚", english: "Victoria", focus: [-37.8, 144.9], heat: 94, visited: false, summary: "墨尔本与大洋路", resources: [{ type: "城市", score: 96 }, { type: "自驾", score: 97 }, { type: "美食", score: 95 }] },
    { id: "qld", name: "昆士兰", english: "Queensland", focus: [-18.2, 146.2], heat: 98, visited: false, summary: "大堡礁与热带北部", resources: [{ type: "潜水", score: 99 }, { type: "海岛", score: 98 }, { type: "徒步", score: 91 }] },
    { id: "sa", name: "南澳", english: "South Australia", focus: [-34.9, 138.6], heat: 88, visited: false, summary: "阿德莱德与酒乡袋鼠岛", resources: [{ type: "美食", score: 94 }, { type: "海岸", score: 90 }, { type: "自驾", score: 89 }] },
    { id: "wa", name: "西澳", english: "Western Australia", focus: [-31.9, 115.9], heat: 90, visited: false, summary: "珀斯、宁格鲁礁与荒野公路", resources: [{ type: "自驾", score: 96 }, { type: "潜水", score: 95 }, { type: "海岸", score: 93 }] },
    { id: "tas", name: "塔斯马尼亚", english: "Tasmania", focus: [-42.0, 146.7], heat: 93, visited: false, summary: "荒野海岸与高山步道", resources: [{ type: "徒步", score: 98 }, { type: "自驾", score: 96 }, { type: "摄影", score: 95 }] },
    { id: "nt", name: "北领地", english: "Northern Territory", focus: [-23.7, 133.9], heat: 91, visited: false, summary: "乌鲁鲁与卡卡杜", resources: [{ type: "摄影", score: 98 }, { type: "徒步", score: 94 }, { type: "文化", score: 93 }] },
  ],
  FJI: [
    { id: "viti-levu", name: "维提岛", english: "Viti Levu", focus: [-17.8, 178.0], heat: 95, visited: false, summary: "主岛城市、海岸与高地", resources: [{ type: "海岸", score: 96 }, { type: "文化", score: 92 }, { type: "亲子", score: 93 }] },
    { id: "vanua-levu", name: "瓦努阿岛", english: "Vanua Levu", focus: [-16.6, 179.0], heat: 88, visited: false, summary: "北岛潜水与种植园", resources: [{ type: "潜水", score: 94 }, { type: "海岸", score: 92 }, { type: "摄影", score: 88 }] },
    { id: "outer-islands", name: "外岛群", english: "Outer Islands", focus: [-17.5, 177.0], heat: 92, visited: false, summary: "玛玛努卡与亚萨瓦度假岛", resources: [{ type: "海岛", score: 99 }, { type: "潜水", score: 97 }, { type: "亲子", score: 94 }] },
  ],
  /* 美国：人口普查四大区 + 夏威夷 / 阿拉斯加 */
  USA: [
    { id: "northeast-us", name: "东北部", english: "Northeast", focus: [41.5, -73.5], heat: 93, visited: false, summary: "纽约、新英格兰与秋色公路", resources: [{ type: "城市", score: 98 }, { type: "徒步", score: 90 }, { type: "自驾", score: 91 }] },
    { id: "midwest", name: "中西部", english: "Midwest", focus: [41.9, -87.6], heat: 88, visited: false, summary: "五大湖与草原都市", resources: [{ type: "城市", score: 92 }, { type: "自驾", score: 90 }, { type: "亲子", score: 88 }] },
    { id: "south-us", name: "南部", english: "South", focus: [32.8, -96.8], heat: 92, visited: false, summary: "德州、湾岸与东南海岸", resources: [{ type: "海岸", score: 93 }, { type: "美食", score: 95 }, { type: "文化", score: 92 }] },
    { id: "west", name: "西部", english: "West", focus: [37.2, -119.0], heat: 99, visited: false, summary: "加州海岸与西南国家公园", resources: [{ type: "自驾", score: 99 }, { type: "徒步", score: 98 }, { type: "冲浪", score: 93 }] },
    { id: "mountain-us", name: "山地区", english: "Mountain West", focus: [40.5, -111.0], heat: 97, visited: false, summary: "落基山与大盆地荒野", resources: [{ type: "徒步", score: 99 }, { type: "滑雪", score: 98 }, { type: "露营", score: 97 }] },
    { id: "hawaii", name: "夏威夷", english: "Hawaii", focus: [20.8, -156.3], heat: 96, visited: false, summary: "火山群岛与深蓝海洋", resources: [{ type: "潜水", score: 99 }, { type: "冲浪", score: 99 }, { type: "徒步", score: 94 }] },
    { id: "alaska", name: "阿拉斯加", english: "Alaska", focus: [64.2, -149.5], heat: 91, visited: false, summary: "冰川峡湾与极地公路", resources: [{ type: "摄影", score: 99 }, { type: "徒步", score: 95 }, { type: "自驾", score: 92 }] },
  ],
  /* 加拿大：大西洋 / 魁北克 / 安大略 / 草原 / 西部 / 北部 */
  CAN: [
    { id: "atlantic-ca", name: "大西洋沿岸", english: "Atlantic Canada", focus: [46.1, -63.0], heat: 90, visited: false, summary: "新斯科舍与纽芬兰海岸", resources: [{ type: "海岸", score: 96 }, { type: "自驾", score: 93 }, { type: "摄影", score: 92 }] },
    { id: "quebec", name: "魁北克", english: "Quebec", focus: [46.8, -71.2], heat: 93, visited: false, summary: "魁北克城与蒙特利尔法语文化", resources: [{ type: "文化", score: 97 }, { type: "城市", score: 95 }, { type: "美食", score: 94 }] },
    { id: "ontario", name: "安大略", english: "Ontario", focus: [43.7, -79.4], heat: 94, visited: false, summary: "多伦多、渥太华与尼亚加拉", resources: [{ type: "城市", score: 96 }, { type: "亲子", score: 93 }, { type: "徒步", score: 88 }] },
    { id: "prairies", name: "草原三省", english: "Prairies", focus: [51.0, -106.0], heat: 87, visited: false, summary: "草原公路与湖区", resources: [{ type: "自驾", score: 92 }, { type: "摄影", score: 90 }, { type: "徒步", score: 86 }] },
    { id: "west-ca", name: "西部", english: "Western Canada", focus: [51.0, -116.5], heat: 99, visited: false, summary: "BC 与阿尔伯塔落基山国家公园", resources: [{ type: "徒步", score: 99 }, { type: "自驾", score: 98 }, { type: "摄影", score: 99 }] },
    { id: "north-ca", name: "北部领地", english: "Northern Territories", focus: [62.5, -114.4], heat: 86, visited: false, summary: "育空、西北与努纳武特极地", resources: [{ type: "摄影", score: 97 }, { type: "徒步", score: 93 }, { type: "自驾", score: 88 }] },
  ],
  MEX: [
    { id: "north-mx", name: "北部", english: "Northern Mexico", focus: [28.6, -106.1], heat: 86, visited: false, summary: "沙漠边境与铜峡谷", resources: [{ type: "自驾", score: 92 }, { type: "徒步", score: 90 }, { type: "文化", score: 88 }] },
    { id: "central-mx", name: "中部高原", english: "Central Highlands", focus: [19.4, -99.1], heat: 97, visited: false, summary: "墨西哥城与殖民古城", resources: [{ type: "文化", score: 99 }, { type: "美食", score: 98 }, { type: "城市", score: 96 }] },
    { id: "pacific-mx", name: "太平洋沿岸", english: "Pacific Coast", focus: [20.7, -105.2], heat: 93, visited: false, summary: "巴亚尔塔港与瓦哈卡海岸", resources: [{ type: "海岸", score: 96 }, { type: "冲浪", score: 94 }, { type: "美食", score: 93 }] },
    { id: "yucatan", name: "尤卡坦半岛", english: "Yucatán", focus: [20.7, -88.0], heat: 98, visited: false, summary: "玛雅遗址与加勒比海", resources: [{ type: "文化", score: 99 }, { type: "潜水", score: 97 }, { type: "海岛", score: 96 }] },
  ],
  CRI: [
    { id: "central-valley", name: "中央谷地", english: "Central Valley", focus: [9.9, -84.1], heat: 92, visited: false, summary: "圣何塞与火山门户", resources: [{ type: "城市", score: 90 }, { type: "文化", score: 88 }, { type: "亲子", score: 89 }] },
    { id: "pacific-north-cr", name: "北太平洋", english: "North Pacific", focus: [10.3, -85.8], heat: 95, visited: false, summary: "瓜纳卡斯特海滩与旱林", resources: [{ type: "海岸", score: 97 }, { type: "冲浪", score: 95 }, { type: "亲子", score: 92 }] },
    { id: "pacific-south-cr", name: "南太平洋", english: "South Pacific", focus: [9.2, -83.8], heat: 93, visited: false, summary: "马努埃尔安东尼奥与奥萨半岛", resources: [{ type: "徒步", score: 96 }, { type: "海岸", score: 95 }, { type: "摄影", score: 94 }] },
    { id: "caribbean-cr", name: "加勒比沿岸", english: "Caribbean Coast", focus: [9.9, -83.0], heat: 91, visited: false, summary: "利蒙与托尔图盖罗雨林", resources: [{ type: "海岸", score: 94 }, { type: "徒步", score: 93 }, { type: "摄影", score: 92 }] },
    { id: "north-plains-cr", name: "北部平原", english: "Northern Plains", focus: [10.5, -84.5], heat: 90, visited: false, summary: "阿雷纳尔火山与云雾林", resources: [{ type: "徒步", score: 97 }, { type: "摄影", score: 95 }, { type: "亲子", score: 91 }] },
  ],
  /* 巴西：IBGE 五大区 */
  BRA: [
    { id: "north-br", name: "北部", english: "North Brazil", focus: [-3.1, -60.0], heat: 94, visited: false, summary: "亚马孙雨林与河港都市", resources: [{ type: "徒步", score: 94 }, { type: "摄影", score: 97 }, { type: "亲子", score: 86 }] },
    { id: "northeast-br", name: "东北部", english: "Northeast Brazil", focus: [-8.1, -34.9], heat: 95, visited: false, summary: "累西腓、萨尔瓦多与阳光海岸", resources: [{ type: "海岸", score: 98 }, { type: "文化", score: 96 }, { type: "美食", score: 94 }] },
    { id: "central-west-br", name: "中西部", english: "Central-West", focus: [-15.8, -47.9], heat: 89, visited: false, summary: "巴西利亚与潘塔纳尔湿地", resources: [{ type: "摄影", score: 96 }, { type: "文化", score: 90 }, { type: "自驾", score: 88 }] },
    { id: "southeast-br", name: "东南部", english: "Southeast Brazil", focus: [-22.9, -43.2], heat: 99, visited: false, summary: "里约、圣保罗与米纳斯", resources: [{ type: "城市", score: 98 }, { type: "海岸", score: 97 }, { type: "徒步", score: 92 }] },
    { id: "south-br", name: "南部", english: "South Brazil", focus: [-27.6, -48.5], heat: 91, visited: false, summary: "伊瓜苏瀑布与欧洲风小镇", resources: [{ type: "徒步", score: 96 }, { type: "摄影", score: 97 }, { type: "亲子", score: 91 }] },
  ],
  /* 阿根廷：旅游地理分区 */
  ARG: [
    { id: "northwest-ar", name: "西北部", english: "Northwest Argentina", focus: [-24.2, -65.3], heat: 92, visited: false, summary: "彩色山脊与安第斯小镇", resources: [{ type: "自驾", score: 95 }, { type: "摄影", score: 98 }, { type: "文化", score: 92 }] },
    { id: "northeast-ar", name: "东北部", english: "Northeast Argentina", focus: [-25.7, -54.6], heat: 91, visited: false, summary: "伊瓜苏与美索不达米亚湿地", resources: [{ type: "徒步", score: 94 }, { type: "摄影", score: 96 }, { type: "亲子", score: 90 }] },
    { id: "cuyo", name: "库约", english: "Cuyo", focus: [-32.9, -68.8], heat: 90, visited: false, summary: "门多萨酒乡与阿空加瓜", resources: [{ type: "美食", score: 96 }, { type: "徒步", score: 94 }, { type: "自驾", score: 91 }] },
    { id: "pampas", name: "潘帕与布宜诺斯艾利斯", english: "Pampas & Buenos Aires", focus: [-34.6, -58.4], heat: 95, visited: false, summary: "首都探戈与潘帕牧场", resources: [{ type: "城市", score: 97 }, { type: "文化", score: 98 }, { type: "美食", score: 96 }] },
    { id: "patagonia-ar", name: "巴塔哥尼亚", english: "Patagonia", focus: [-50.1, -73.0], heat: 99, visited: false, summary: "冰川、菲茨罗伊与无尽公路", resources: [{ type: "徒步", score: 99 }, { type: "自驾", score: 96 }, { type: "摄影", score: 99 }] },
  ],
  /* 秘鲁：海岸 / 高原 / 亚马孙 */
  PER: [
    { id: "coast-pe", name: "太平洋沿岸", english: "Coast", focus: [-12.0, -77.0], heat: 93, visited: false, summary: "利马美食与北部沙漠海岸", resources: [{ type: "美食", score: 99 }, { type: "文化", score: 94 }, { type: "海岸", score: 90 }] },
    { id: "sierra-pe", name: "安第斯高原", english: "Sierra", focus: [-13.5, -71.9], heat: 99, visited: false, summary: "库斯科圣谷与马丘比丘", resources: [{ type: "徒步", score: 99 }, { type: "文化", score: 99 }, { type: "摄影", score: 97 }] },
    { id: "amazon-pe", name: "亚马孙", english: "Amazon Peru", focus: [-3.7, -73.2], heat: 90, visited: false, summary: "伊基托斯与热带雨林", resources: [{ type: "摄影", score: 95 }, { type: "徒步", score: 92 }, { type: "亲子", score: 85 }] },
  ],
  /* 智利：大北 / 小北 / 中部 / 南部 / 极南 */
  CHL: [
    { id: "norte-grande", name: "大北部", english: "Norte Grande", focus: [-23.6, -68.2], heat: 96, visited: false, summary: "阿塔卡马沙漠与星空", resources: [{ type: "摄影", score: 99 }, { type: "自驾", score: 94 }, { type: "徒步", score: 91 }] },
    { id: "norte-chico", name: "小北部", english: "Norte Chico", focus: [-29.9, -71.3], heat: 88, visited: false, summary: "海岸天文与半干旱谷地", resources: [{ type: "海岸", score: 90 }, { type: "摄影", score: 91 }, { type: "自驾", score: 89 }] },
    { id: "central-cl", name: "中部", english: "Central Chile", focus: [-33.4, -70.7], heat: 93, visited: false, summary: "圣地亚哥、瓦尔帕莱索与酒谷", resources: [{ type: "城市", score: 95 }, { type: "美食", score: 94 }, { type: "文化", score: 93 }] },
    { id: "south-cl", name: "南部湖区", english: "Lake District", focus: [-41.5, -72.9], heat: 94, visited: false, summary: "火山湖泊与奇洛埃", resources: [{ type: "徒步", score: 96 }, { type: "自驾", score: 94 }, { type: "摄影", score: 95 }] },
    { id: "patagonia-cl", name: "极南巴塔哥尼亚", english: "Austral Patagonia", focus: [-51.0, -73.0], heat: 99, visited: false, summary: "托雷斯德尔帕伊内与峡湾", resources: [{ type: "徒步", score: 99 }, { type: "摄影", score: 98 }, { type: "露营", score: 95 }] },
  ],
  /* 南非：主要旅游区 */
  ZAF: [
    { id: "gauteng", name: "豪登", english: "Gauteng", focus: [-26.2, 28.0], heat: 90, visited: false, summary: "约翰内斯堡与比勒陀利亚门户", resources: [{ type: "城市", score: 93 }, { type: "文化", score: 92 }, { type: "亲子", score: 88 }] },
    { id: "cape-region", name: "西开普", english: "Western Cape", focus: [-33.9, 18.4], heat: 99, visited: false, summary: "开普敦、好望角与酒乡", resources: [{ type: "自驾", score: 97 }, { type: "海岸", score: 96 }, { type: "美食", score: 94 }] },
    { id: "garden-route", name: "花园大道与东开普", english: "Garden Route & Eastern Cape", focus: [-34.0, 23.0], heat: 94, visited: false, summary: "森林泻湖与滨海小镇", resources: [{ type: "自驾", score: 98 }, { type: "徒步", score: 92 }, { type: "海岸", score: 95 }] },
    { id: "kzn", name: "夸祖鲁-纳塔尔", english: "KwaZulu-Natal", focus: [-29.9, 31.0], heat: 93, visited: false, summary: "德班海岸与德拉肯斯堡", resources: [{ type: "海岸", score: 95 }, { type: "徒步", score: 94 }, { type: "文化", score: 91 }] },
    { id: "kruger", name: "克鲁格与低veld", english: "Kruger & Lowveld", focus: [-24.0, 31.5], heat: 99, visited: false, summary: "大型野生动物保护区", resources: [{ type: "摄影", score: 99 }, { type: "自驾", score: 95 }, { type: "亲子", score: 93 }] },
  ],
  /* 埃及：开罗 / 上埃及 / 红海 / 三角洲 / 西部沙漠 */
  EGY: [
    { id: "cairo-giza", name: "开罗与吉萨", english: "Cairo & Giza", focus: [29.98, 31.13], heat: 99, visited: false, summary: "金字塔与尼罗河都市", resources: [{ type: "文化", score: 99 }, { type: "摄影", score: 96 }, { type: "亲子", score: 90 }] },
    { id: "upper-egypt", name: "上埃及", english: "Upper Egypt", focus: [25.7, 32.6], heat: 97, visited: false, summary: "卢克索、阿斯旺与尼罗河游船", resources: [{ type: "文化", score: 99 }, { type: "摄影", score: 95 }, { type: "自驾", score: 88 }] },
    { id: "red-sea", name: "红海与西奈", english: "Red Sea & Sinai", focus: [27.3, 33.8], heat: 96, visited: false, summary: "赫尔格达、沙姆与珊瑚礁", resources: [{ type: "潜水", score: 99 }, { type: "海岸", score: 97 }, { type: "亲子", score: 91 }] },
    { id: "delta-alex", name: "三角洲与亚历山大", english: "Delta & Alexandria", focus: [31.2, 29.9], heat: 90, visited: false, summary: "地中海都市与尼罗河口", resources: [{ type: "城市", score: 92 }, { type: "文化", score: 93 }, { type: "海岸", score: 90 }] },
    { id: "western-desert", name: "西部沙漠", english: "Western Desert", focus: [25.5, 29.0], heat: 88, visited: false, summary: "绿洲与白色沙漠", resources: [{ type: "自驾", score: 94 }, { type: "摄影", score: 96 }, { type: "露营", score: 91 }] },
  ],
  /* 摩洛哥：北 / 中阿特拉斯 / 大西洋 / 撒哈拉 / 东 */
  MAR: [
    { id: "north-ma", name: "北部", english: "Northern Morocco", focus: [35.8, -5.8], heat: 91, visited: false, summary: "丹吉尔、舍夫沙万与里夫山", resources: [{ type: "文化", score: 95 }, { type: "徒步", score: 90 }, { type: "海岸", score: 89 }] },
    { id: "marrakech-atlas", name: "中部与阿特拉斯", english: "Marrakech & Atlas", focus: [31.6, -8.0], heat: 99, visited: false, summary: "马拉喀什集市与高山村落", resources: [{ type: "文化", score: 99 }, { type: "徒步", score: 94 }, { type: "美食", score: 96 }] },
    { id: "atlantic-ma", name: "大西洋沿岸", english: "Atlantic Coast", focus: [33.6, -7.6], heat: 93, visited: false, summary: "卡萨布兰卡、拉巴特与索维拉", resources: [{ type: "海岸", score: 94 }, { type: "城市", score: 92 }, { type: "冲浪", score: 93 }] },
    { id: "sahara-edge", name: "撒哈拉边缘", english: "Sahara Edge", focus: [31.0, -4.0], heat: 96, visited: false, summary: "梅尔祖卡沙丘与绿洲公路", resources: [{ type: "自驾", score: 96 }, { type: "摄影", score: 98 }, { type: "露营", score: 93 }] },
    { id: "east-ma", name: "东部", english: "Eastern Morocco", focus: [34.0, -2.0], heat: 85, visited: false, summary: "乌季达与东部高原", resources: [{ type: "文化", score: 88 }, { type: "自驾", score: 86 }, { type: "摄影", score: 85 }] },
  ],
  /* 肯尼亚：常见旅游环线分区 */
  KEN: [
    { id: "nairobi", name: "内罗毕", english: "Nairobi", focus: [-1.3, 36.8], heat: 92, visited: false, summary: "首都门户与城市国家公园", resources: [{ type: "城市", score: 93 }, { type: "文化", score: 90 }, { type: "亲子", score: 88 }] },
    { id: "masai-mara", name: "西南草原", english: "Masai Mara & Southwest", focus: [-1.5, 35.1], heat: 99, visited: false, summary: "马赛马拉大迁徙核心", resources: [{ type: "摄影", score: 99 }, { type: "自驾", score: 94 }, { type: "亲子", score: 90 }] },
    { id: "rift-valley", name: "裂谷", english: "Rift Valley", focus: [-0.5, 36.1], heat: 94, visited: false, summary: "纳库鲁、奈瓦沙与火烈鸟湖", resources: [{ type: "摄影", score: 97 }, { type: "徒步", score: 91 }, { type: "自驾", score: 92 }] },
    { id: "coast-ke", name: "印度洋海岸", english: "Kenya Coast", focus: [-4.0, 39.7], heat: 93, visited: false, summary: "蒙巴萨与拉穆海岸", resources: [{ type: "海岸", score: 96 }, { type: "文化", score: 93 }, { type: "潜水", score: 90 }] },
    { id: "central-highlands", name: "中央高地", english: "Central Highlands", focus: [-0.4, 37.0], heat: 90, visited: false, summary: "肯尼亚山与咖啡产区", resources: [{ type: "徒步", score: 95 }, { type: "摄影", score: 92 }, { type: "文化", score: 88 }] },
    { id: "north-ke", name: "北部", english: "Northern Kenya", focus: [2.0, 37.5], heat: 86, visited: false, summary: "桑布鲁与图尔卡纳边疆", resources: [{ type: "摄影", score: 94 }, { type: "自驾", score: 90 }, { type: "徒步", score: 88 }] },
  ],
  /* 坦桑尼亚：北环 / 南环 / 海岸桑岛 / 西部 / 中部 */
  TZA: [
    { id: "northern-circuit", name: "北部环线", english: "Northern Circuit", focus: [-3.0, 36.5], heat: 99, visited: false, summary: "塞伦盖蒂、恩戈罗恩戈罗与乞力马", resources: [{ type: "摄影", score: 99 }, { type: "徒步", score: 97 }, { type: "露营", score: 93 }] },
    { id: "southern-circuit", name: "南部环线", english: "Southern Circuit", focus: [-7.8, 35.0], heat: 90, visited: false, summary: "塞卢斯与鲁阿哈荒野", resources: [{ type: "摄影", score: 96 }, { type: "自驾", score: 91 }, { type: "露营", score: 92 }] },
    { id: "zanzibar", name: "桑给巴尔与海岸", english: "Zanzibar & Coast", focus: [-6.2, 39.2], heat: 96, visited: false, summary: "香料岛与印度洋海滩", resources: [{ type: "海岸", score: 98 }, { type: "潜水", score: 95 }, { type: "文化", score: 93 }] },
    { id: "western-tz", name: "西部", english: "Western Tanzania", focus: [-4.9, 29.7], heat: 87, visited: false, summary: "马哈莱与戈姆贝黑猩猩", resources: [{ type: "徒步", score: 95 }, { type: "摄影", score: 94 }, { type: "露营", score: 90 }] },
    { id: "central-tz", name: "中部", english: "Central Tanzania", focus: [-6.2, 35.7], heat: 84, visited: false, summary: "多多马高原门户", resources: [{ type: "自驾", score: 86 }, { type: "文化", score: 84 }, { type: "摄影", score: 83 }] },
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
