import type { SeasonalRecommendation } from "./seasonal-recommendations"
import { getDestinationKey } from "./seasonal-recommendations"

export interface UnlockTask {
  id: string
  label: string
  detail: string
  sourceLabel: string
  sourceUrl: string
}

export interface UnlockDestinationProfile {
  key: string
  name: string
  english: string
  code: string
  focus: [number, number]
  continent: string
  verifiedAt: string
  tasks: UnlockTask[]
}

const task = (id: string, label: string, detail: string, sourceLabel: string, sourceUrl: string): UnlockTask => ({ id, label, detail, sourceLabel, sourceUrl })

const profiles: Record<string, Omit<UnlockDestinationProfile, "key">> = {
  "JPN:hokkaido": { name: "北海道", english: "Hokkaido", code: "JP", focus: [43.2, 142.7], continent: "亚洲", verifiedAt: "2026-07-15", tasks: [
    task("entry", "按护照国籍核验日本入境条件", "签证豁免与签证类型必须以日本外务省最新页面为准", "日本外务省", "https://www.mofa.go.jp/j_info/visit/visa/index.html"),
    task("season", "确认花期或雪场运营窗口", "富良野薰衣草通常在六月末至八月初分批开放", "北海道官方旅游站", "https://www.visit-hokkaido.jp/en/spot/detail_10174.html"),
    task("weather", "保存北海道天气与预警入口", "山地天气变化快，出发前再次核对警报", "日本气象厅", "https://www.jma.go.jp/bosai/map.html"),
    task("transport", "核对 JR 与跨区域交通班次", "旺季指定席与偏远地区接驳需要提前确认", "JR 北海道", "https://www.jrhokkaido.co.jp/global/"),
  ] },
  "JPN:kansai": { name: "关西", english: "Kansai", code: "JP", focus: [34.8, 135.5], continent: "亚洲", verifiedAt: "2026-07-15", tasks: [
    task("entry", "按护照国籍核验日本入境条件", "签证与停留资格以日本外务省为准", "日本外务省", "https://www.mofa.go.jp/j_info/visit/visa/index.html"),
    task("bloom", "核对樱花或红叶实时情报", "花期会随当年气温前后浮动", "日本国家旅游局", "https://www.japan.travel/en/uk/inspiration/cherry-blossom-forecast/"),
    task("weather", "保存暴雨与高温预警", "春秋温差与夏季高温需按出行日复核", "日本气象厅", "https://www.jma.go.jp/bosai/map.html"),
    task("route", "预排京都奈良跨城交通", "热门时段优先采用公共交通并预留步行时间", "JR 西日本", "https://www.westjr.co.jp/global/en/"),
  ] },
  "ISL:south-iceland": { name: "冰岛南岸", english: "South Iceland", code: "IS", focus: [63.8, -19.6], continent: "欧洲", verifiedAt: "2026-07-15", tasks: [
    task("entry", "核验申根签证与护照有效期", "非 EEA/EFTA 旅客的证件通常需在离境后仍有效至少三个月", "Ísland.is", "https://island.is/en/entry-requirements-to-iceland"),
    task("insurance", "确认申根旅行医疗保险", "签证申请的医疗保险最低保障要求以官方清单为准", "Ísland.is", "https://island.is/en/get-a-visa/supporting-documents"),
    task("roads", "保存实时道路与封闭信息", "天气可能临时改变南岸和高地公路通行状态", "Icelandic Road Administration", "https://umferdin.is/en"),
    task("safety", "下载并检查 SafeTravel 警报", "风、海浪、火山与冰川活动需在出发前重新核对", "SafeTravel Iceland", "https://safetravel.is/"),
  ] },
  "CHE:bernese-oberland": { name: "伯尔尼高地", english: "Bernese Oberland", code: "CH", focus: [46.62, 7.94], continent: "欧洲", verifiedAt: "2026-07-15", tasks: [
    task("entry", "按国籍核验瑞士入境规则", "瑞士入境与申根签证要求取决于护照国籍", "瑞士移民国务秘书处", "https://www.sem.admin.ch/sem/en/home/overview-einreise.html"),
    task("trails", "下载步道并检查封闭状态", "高山路线会因积雪或维护临时调整", "SwitzerlandMobility", "https://schweizmobil.ch/en/hiking-in-switzerland"),
    task("weather", "保存山区天气预警", "雷暴和降雪会快速影响缆车与步道", "MeteoSwiss", "https://www.meteoswiss.admin.ch/"),
    task("rail", "核对山地列车与缆车时刻", "施工和季节班次应在出发日前再次确认", "SBB", "https://www.sbb.ch/en"),
  ] },
  "NOR:west-fjords": { name: "挪威西部峡湾", english: "Western Fjords", code: "NO", focus: [61.1, 6.8], continent: "欧洲", verifiedAt: "2026-07-15", tasks: [
    task("entry", "按国籍核验挪威访客签证", "短期访问通常适用申根规则，但须按国籍查询", "挪威移民局 UDI", "https://www.udi.no/en/want-to-apply/visit-and-holiday/visitors-visa-to-norway/"),
    task("route", "保存国家景观公路路线", "高山路段可能季节关闭，线路本身也是旅行核心", "Norwegian Scenic Routes", "https://www.nasjonaleturistveger.no/en/"),
    task("traffic", "订阅山口与渡轮实时状态", "挪威公路管理局提供山口、摄像头和交通警报", "Statens vegvesen", "https://www.vegvesen.no/en/traffic-information/traffic-information/"),
    task("weather", "核对峡湾和山地逐小时天气", "窄路、渡轮与徒步安排应保留天气备选", "Yr", "https://www.yr.no/en"),
  ] },
  "IDN:bali": { name: "巴厘岛", english: "Bali", code: "ID", focus: [-8.42, 115.19], continent: "亚洲", verifiedAt: "2026-07-15", tasks: [
    task("entry", "按护照核验电子签证资格", "仅使用印度尼西亚移民局官方电子签证入口", "Indonesia eVisa", "https://evisa.imigrasi.go.id/"),
    task("levy", "确认巴厘岛外国游客税", "官方规定外国游客税为 150,000 印尼盾，并提供电子凭证", "Love Bali", "https://lovebali.baliprov.go.id/"),
    task("volcano", "保存火山活动官方监测", "阿贡火山与周边活动状态可能影响路线", "MAGMA Indonesia", "https://magma.esdm.go.id/"),
    task("marine", "核对潜水海况与海上预警", "浪高和洋流应在出海当天再次确认", "BMKG Maritime", "https://maritim.bmkg.go.id/"),
  ] },
  "CHN:xinjiang": { name: "新疆", english: "Xinjiang", code: "CN", focus: [42.3, 85.6], continent: "亚洲", verifiedAt: "2026-07-15", tasks: [
    task("identity", "确认身份证件与边境地区要求", "部分边境线路可能需要额外证件或临时调整", "国家移民管理局", "https://en.nia.gov.cn/"),
    task("weather", "保存新疆气象预警", "山区降雪、沙尘和昼夜温差会影响公路与徒步", "中国天气网", "https://www.weather.com.cn/xinjiang/"),
    task("drive", "核对长距离自驾补给点", "独库公路等季节道路应在出发前确认开放状态", "新疆文旅厅", "https://wlt.xinjiang.gov.cn/"),
    task("ski", "确认雪场票务与运营公告", "将军山雪场班次和开放雪道按当日公告执行", "阿勒泰地区政府", "https://www.xjalt.gov.cn/"),
  ] },
  "NZL:south-island": { name: "新西兰南岛", english: "South Island", code: "NZ", focus: [-44.6, 169.1], continent: "大洋洲", verifiedAt: "2026-07-15", tasks: [
    task("entry", "核验签证或 NZeTA", "所需文件取决于护照、入境方式与停留目的", "Immigration New Zealand", "https://www.immigration.govt.nz/visit/what-you-need-to-visit-new-zealand/"),
    task("declaration", "准备 New Zealand Traveller Declaration", "航空旅客可在行程开始前 24 小时内提交", "NZ Traveller Declaration", "https://www.travellerdeclaration.govt.nz/"),
    task("tracks", "检查 DOC 步道警报", "高山步道和营地可能因天气或维护关闭", "Department of Conservation", "https://www.doc.govt.nz/parks-and-recreation/know-before-you-go/alerts/"),
    task("weather", "保存南岛山地预报", "强风和降雪会影响房车、高山口与步道", "MetService", "https://www.metservice.com/"),
  ] },
  "ITA:tuscany": { name: "托斯卡纳", english: "Tuscany", code: "IT", focus: [43.4, 11.1], continent: "欧洲", verifiedAt: "2026-07-15", tasks: [
    task("entry", "核验意大利与申根入境条件", "按护照国籍在意大利外交部官方工具查询", "Visa for Italy", "https://vistoperitalia.esteri.it/home/en"),
    task("route", "保存官方乡村与骑行路线", "历史城镇限行区和乡村道路需提前规划", "Visit Tuscany", "https://www.visittuscany.com/en/"),
    task("weather", "核对托斯卡纳区域天气", "春秋降雨会影响白路骑行和乡村步道", "LaMMA Toscana", "https://www.lamma.toscana.it/meteo/meteo-toscana"),
    task("traffic", "确认 ZTL 与停车规则", "进入古城前核对限行区和住宿车辆登记", "ACI", "https://www.aci.it/"),
  ] },
  "USA:west-coast": { name: "美国西海岸", english: "US West Coast", code: "US", focus: [37.2, -120.1], continent: "北美", verifiedAt: "2026-07-15", tasks: [
    task("entry", "核验美国签证或 ESTA 资格", "只通过美国政府官方入口核验与申请", "U.S. Department of State", "https://travel.state.gov/content/travel/en/us-visas/tourism-visit.html"),
    task("esta", "如适用，确认 ESTA 状态", "ESTA 仅适用于免签计划合资格旅客", "U.S. Customs and Border Protection", "https://esta.cbp.dhs.gov/"),
    task("parks", "检查国家公园警报与预约", "道路、山火和季节预约会影响线路", "National Park Service", "https://www.nps.gov/findapark/index.htm"),
    task("roads", "保存加州实时道路地图", "一号公路可能因落石或施工分段关闭", "Caltrans QuickMap", "https://quickmap.dot.ca.gov/"),
  ] },
  "USA:rockies": { name: "美国落基山地区", english: "US Rockies", code: "US", focus: [42.4, -110.1], continent: "北美", verifiedAt: "2026-07-15", tasks: [
    task("entry", "核验美国签证或 ESTA 资格", "按护照国籍使用美国政府官方入口", "U.S. Department of State", "https://travel.state.gov/content/travel/en/us-visas/tourism-visit.html"),
    task("parks", "检查国家公园道路与预约", "冬季道路和山口会长期关闭", "National Park Service", "https://www.nps.gov/romo/planyourvisit/conditions.htm"),
    task("weather", "保存山地天气预警", "高海拔天气变化会影响驾驶与滑雪", "National Weather Service", "https://www.weather.gov/"),
    task("avalanche", "核对雪崩预报", "进入非雪场控制区域前必须检查当地雪崩中心", "Avalanche.org", "https://avalanche.org/"),
  ] },
  "CAN:canadian-rockies": { name: "加拿大落基山", english: "Canadian Rockies", code: "CA", focus: [51.3, -116.2], continent: "北美", verifiedAt: "2026-07-15", tasks: [
    task("entry", "核验加拿大签证或 eTA", "入境文件取决于护照与抵达方式", "Government of Canada", "https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada.html"),
    task("parks", "检查班夫与贾斯珀公告", "山火、野生动物与道路施工可能改变线路", "Parks Canada", "https://parks.canada.ca/pn-np/ab/banff/visit/etat-sentiers-trail-conditions"),
    task("roads", "保存阿尔伯塔实时路况", "冰雪和山口天气需在驾车当天复核", "511 Alberta", "https://511.alberta.ca/"),
    task("wildlife", "确认野生动物安全规则", "保持距离并妥善存放食物", "Parks Canada", "https://parks.canada.ca/pn-np/mtn/ours-bears/securite-safety"),
  ] },
  "THA:andaman-coast": { name: "安达曼海岸", english: "Andaman Coast", code: "TH", focus: [8.1, 98.4], continent: "亚洲", verifiedAt: "2026-07-15", tasks: [
    task("entry", "核验泰国签证或电子签资格", "按护照国籍使用泰国官方电子签证入口", "Thai eVisa", "https://www.thaievisa.go.th/"),
    task("weather", "核对季风与海洋天气", "出海与潜水必须按当天浪高和雷暴预警调整", "Thai Meteorological Department", "https://www.tmd.go.th/en"),
    task("parks", "确认海洋国家公园开放期", "部分岛屿和潜点会季节性关闭", "Thailand National Parks", "https://www.dnp.go.th/"),
    task("tourism", "保存泰国旅游局目的地信息", "核对当地交通、开放时间与官方提醒", "Tourism Authority of Thailand", "https://www.tourismthailand.org/"),
  ] },
  "AUS:queensland-tropics": { name: "昆士兰热带北部", english: "Tropical Queensland", code: "AU", focus: [-18.2, 146.2], continent: "大洋洲", verifiedAt: "2026-07-15", tasks: [
    task("entry", "核验澳大利亚签证资格", "签证类别取决于护照与旅行目的", "Australian Department of Home Affairs", "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-finder/visit"),
    task("reef", "查看大堡礁分区与活动规则", "潜水、船艇和保护区活动应遵守官方分区要求", "Great Barrier Reef Marine Park Authority", "https://www2.gbrmpa.gov.au/"),
    task("weather", "核对热带海况与气象警报", "风浪和热带气旋会影响出海安排", "Bureau of Meteorology", "https://www.bom.gov.au/qld/"),
    task("parks", "检查雨林步道与公园警报", "暴雨和维护可能造成步道临时关闭", "Queensland Parks", "https://parks.desi.qld.gov.au/"),
  ] },
}

export function getUnlockProfile(item: SeasonalRecommendation): UnlockDestinationProfile {
  const key = getDestinationKey(item)
  const profile = profiles[key]
  if (profile) return { key, ...profile }
  return {
    key,
    name: item.title.split(" · ")[0],
    english: item.location,
    code: item.countryCode.slice(0, 2),
    focus: [0, 0],
    continent: item.continent,
    verifiedAt: "2026-07-15",
    tasks: [
      task("entry", "核验入境证件", "根据护照国籍查询目的地官方要求", "目的地政府", "#"),
      task("season", "确认季节开放状态", item.reason, "官方旅游机构", "#"),
      task("weather", "保存天气预警", "出发前再次核对实时天气和交通", "官方气象机构", "#"),
      task("route", "完成路线与备选方案", "保存离线地图并预留天气备选日", "OUR ATLAS", "#"),
    ],
  }
}
