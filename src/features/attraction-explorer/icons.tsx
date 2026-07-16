import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import {
  Mountain, Waves, Building, Building2, Footprints, Tent, Camera,
  Snowflake, Flame, Ship, Church, Castle, Landmark, TreePine, Flower2, Leaf,
  PawPrint, Fish, Bike, Car, Anchor, Sparkles, Users, Moon, Home, Calendar,
  UtensilsCrossed, type LucideIcon,
} from "lucide-react"
import type { Attraction } from "./types"

/** 地图标记图标：按 category_l1 + category_l2 匹配最精准的图标。
 *  那拉提草原 → TreePine（草原）而不是 Mountain（山），
 *  洞爷湖 → Waves（湖泊），富田农场 → Flower2（花田）。 */
export function categoryIcon(item: Attraction): LucideIcon {
  const { category_l1, category_l2 } = item
  switch (category_l2) {
    case "湖泊": case "透明湖水": return Waves
    case "草原": case "花田": return TreePine
    case "海洋": case "白沙滩": case "积丹蓝": case "海岸徒步": return Ship
    case "瀑布": case "瀑布谷": return Waves
    case "雪山": case "雪峰": case "大雪山": case "粉雪": case "滑雪": return Snowflake
    case "火山": case "火山湖": case "火山地貌": return Flame
    case "山谷": case "丘陵": case "喀斯特": case "峡谷": return Mountain
    case "原始森林": case "秋色": case "红叶": return Leaf
    case "古寺": case "神社": case "千本鸟居": return Church
    case "古城": case "庄园": case "历史街区": return Castle
    case "现代建筑": case "城市": return Building
    case "场馆": return Building2
    case "高山列车": case "史诗公路": return Car
    case "自驾": return Car
    case "徒步": case "高山徒步": case "登山": return Footprints
    case "潜水": return Anchor
    case "独木舟": case "游船": return Ship
    case "骑马": return PawPrint
    case "骑行": return Bike
    case "摄影": case "观景": case "夜景": return Camera
    case "鲸鲨": case "海豹": case "冰山": return Fish
    case "鹿": case "野生动物": return PawPrint
    case "世界遗产": case "京都": case "广场": return Landmark
    case "美食": return UtensilsCrossed
    case "亲子": return Users
    case "离岛": return Ship
    case "室内": return Home
    case "季节性": case "花季": return Calendar
    case "温泉": return Flame
    case "露营": return Tent
    default: break
  }
  switch (category_l1) {
    case "自然风光": return Mountain
    case "人文历史": return Landmark
    case "户外极限": return Footprints
    case "超级工程": return Building2
    case "网红奇观": return Sparkles
    case "休闲露营": return Tent
    default: return Sparkles
  }
}

/** 将 Lucide 组件渲染为内联 SVG 字符串，供 Leaflet divIcon 使用。 */
export function renderIconSvg(Icon: LucideIcon, size = 16, color = "currentColor"): string {
  return renderToStaticMarkup(createElement(Icon, { size, color, strokeWidth: 1.8 }))
}

/** 标签 → Lucide 图标映射，一眼看懂标签含义。 */
export function tagIcon(tag: string): LucideIcon {
  if (/火山|地貌/.test(tag)) return Flame
  if (/湖泊|湖水/.test(tag)) return Waves
  if (/瀑布/.test(tag)) return Waves
  if (/冰川|冰山|粉雪/.test(tag)) return Snowflake
  if (/海洋|沙滩|海岸|积丹/.test(tag)) return Ship
  if (/草原|花田|薰衣草/.test(tag)) return Flower2
  if (/森林|秋色|红叶/.test(tag)) return Leaf
  if (/雪山|雪峰/.test(tag)) return Snowflake
  if (/峡谷|喀斯特|丘陵|山谷/.test(tag)) return Mountain
  if (/玄武岩/.test(tag)) return Mountain
  if (/徒步|登山|高山/.test(tag)) return Footprints
  if (/滑雪/.test(tag)) return Snowflake
  if (/潜水/.test(tag)) return Anchor
  if (/独木舟|游船/.test(tag)) return Ship
  if (/骑马/.test(tag)) return PawPrint
  if (/骑行/.test(tag)) return Bike
  if (/自驾|公路/.test(tag)) return Car
  if (/摄影|观景/.test(tag)) return Camera
  if (/温泉/.test(tag)) return Flame
  if (/鹿|动物/.test(tag)) return PawPrint
  if (/海豹|鲸鲨/.test(tag)) return Fish
  if (/世界遗产|京都|广场/.test(tag)) return Landmark
  if (/鸟居|神社|古寺|庭园/.test(tag)) return Church
  if (/古都|街区|庄园/.test(tag)) return Castle
  if (/美食/.test(tag)) return UtensilsCrossed
  if (/亲子/.test(tag)) return Users
  if (/夜景|城市/.test(tag)) return Moon
  if (/离岛/.test(tag)) return Ship
  if (/室内/.test(tag)) return Home
  if (/季节|花季/.test(tag)) return Calendar
  return Sparkles
}
