export interface PassportProfile {
  code: string
  country: string
  nationality: string
  passportLabel: string
  color: string
  accent: string
  emblem: string
  focus: [number, number]
  continent: string
}

export const PASSPORT_OPTIONS: PassportProfile[] = [
  { code: "CHN", country: "中国", nationality: "中国旅人", passportLabel: "中华人民共和国护照", color: "#7b1626", accent: "#e5c274", emblem: "✦", focus: [35.8, 104.2], continent: "亚洲" },
  { code: "JPN", country: "日本", nationality: "日本旅人", passportLabel: "日本国旅券", color: "#702433", accent: "#e7c98b", emblem: "◉", focus: [36.2, 138.2], continent: "亚洲" },
  { code: "USA", country: "美国", nationality: "美国旅人", passportLabel: "UNITED STATES PASSPORT", color: "#173b63", accent: "#e7c878", emblem: "★", focus: [39.8, -98.6], continent: "北美" },
  { code: "FRA", country: "法国", nationality: "法国旅人", passportLabel: "RÉPUBLIQUE FRANÇAISE", color: "#681f32", accent: "#ddc48e", emblem: "⚜", focus: [46.3, 2.2], continent: "欧洲" },
  { code: "AUS", country: "澳大利亚", nationality: "澳洲旅人", passportLabel: "AUSTRALIAN PASSPORT", color: "#163f55", accent: "#e9ce7e", emblem: "✧", focus: [-25.3, 133.8], continent: "大洋洲" },
]

export const ICELAND_UNLOCK = {
  code: "ISL",
  name: "冰岛",
  english: "Iceland",
  focus: [64.9631, -19.0208] as [number, number],
  continent: "欧洲",
}

export const ICELAND_TASKS = [
  { id: "identity", label: "护照与签证确认", detail: "旅行证件已核验" },
  { id: "route", label: "环岛路线存入地图", detail: "关键停靠点已保存" },
  { id: "stay", label: "冬季住宿准备", detail: "恶劣天气备选方案" },
  { id: "gear", label: "防寒装备检查", detail: "分层穿着与应急物资" },
]
