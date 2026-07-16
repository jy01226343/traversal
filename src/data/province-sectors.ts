/**
 * 全量省级行政区 → 旅游板块显式映射。
 * 替代过去"质心最近邻"的粗糙分派，让地图上每个省/州/道的板块归属
 * 与该国官方/通行旅游分区一致，板块边界一眼可辨。
 *
 * key = admin1 geojson 的 iso_3166_2 代码（如 CN-FJ、JP-01）；value = destinations.ts 里的 region.id。
 * 中国板块的专属配色见下方 CHINA 固定调色；其他国家按板块数量动态分配色相。
 */
import { CHINA_REGION_PALETTE } from "./destinations"

/**
 * 每个国家的 ISO_3166_2 → region.id 映射。
 * 仅收录在 destinations.ts 中存在的国家；无 admin1 ISO 数据的国家
 * (ARG/CHL/EGY/KEN/MAR/PER/TZA) 不收录，地图沿用质心最近邻兜底。
 */
export const PROVINCE_TO_REGION: Record<string, Record<string, string>> = {
  /* ===== 中国：七大旅游板块（专属配色见 CHINA_REGION_PALETTE） ===== */
  CHN: {
    "CN-HL": "northeast", "CN-JL": "northeast", "CN-LN": "northeast",
    "CN-BJ": "north", "CN-TJ": "north", "CN-HE": "north", "CN-SX": "north", "CN-NM": "north",
    "CN-SH": "east", "CN-JS": "east", "CN-ZJ": "east", "CN-AH": "east", "CN-FJ": "east", "CN-JX": "east", "CN-SD": "east",
    "CN-HA": "central", "CN-HB": "central", "CN-HN": "central",
    "CN-GD": "south", "CN-GX": "south", "CN-HI": "south", "CN-X01~": "south",
    "CN-CQ": "southwest", "CN-SC": "southwest", "CN-GZ": "southwest", "CN-YN": "southwest", "CN-XZ": "southwest",
    "CN-SN": "northwest", "CN-GS": "northwest", "CN-QH": "northwest", "CN-NX": "northwest", "CN-XJ": "northwest",
  },

  /* ===== 日本：九大地方区分 ===== */
  JPN: {
    "JP-01": "hokkaido",
    "JP-02": "tohoku", "JP-03": "tohoku", "JP-04": "tohoku", "JP-05": "tohoku", "JP-06": "tohoku", "JP-07": "tohoku",
    "JP-08": "kanto", "JP-09": "kanto", "JP-10": "kanto", "JP-11": "kanto", "JP-12": "kanto", "JP-13": "kanto", "JP-14": "kanto",
    "JP-15": "chubu", "JP-16": "chubu", "JP-17": "chubu", "JP-19": "chubu", "JP-20": "chubu", "JP-21": "chubu", "JP-22": "chubu",
    "JP-18": "chubu",
    "JP-23": "chubu", "JP-24": "kinki",
    "JP-25": "kinki", "JP-26": "kinki", "JP-27": "kinki", "JP-28": "kinki", "JP-29": "kinki", "JP-30": "kinki",
    "JP-31": "chugoku", "JP-32": "chugoku", "JP-33": "chugoku", "JP-34": "chugoku", "JP-35": "chugoku",
    "JP-36": "shikoku", "JP-37": "shikoku", "JP-38": "shikoku", "JP-39": "shikoku",
    "JP-40": "kyushu", "JP-41": "kyushu", "JP-42": "kyushu", "JP-43": "kyushu", "JP-44": "kyushu", "JP-45": "kyushu", "JP-46": "kyushu",
    "JP-47": "okinawa",
  },

  /* ===== 韩国：六大旅游文化圈 ===== */
  KOR: {
    "KR-11": "capital-kr", "KR-41": "capital-kr", "KR-28": "capital-kr", "KR-50": "capital-kr",
    "KR-42": "gangwon",
    "KR-43": "chungcheong", "KR-44": "chungcheong", "KR-30": "chungcheong",
    "KR-45": "jeolla", "KR-46": "jeolla", "KR-29": "jeolla",
    "KR-47": "gyeongsang", "KR-48": "gyeongsang", "KR-26": "gyeongsang", "KR-27": "gyeongsang", "KR-31": "gyeongsang",
    "KR-49": "jeju",
  },

  /* ===== 泰国：北/东北/中/东/南 ===== */
  THA: {
    // 北部
    "TH-50": "north-th", "TH-57": "north-th", "TH-58": "north-th", "TH-63": "north-th", "TH-55": "north-th", "TH-54": "north-th", "TH-51": "north-th", "TH-52": "north-th", "TH-53": "north-th", "TH-56": "north-th", "TH-62": "north-th", "TH-64": "north-th", "TH-66": "north-th", "TH-67": "north-th", "TH-60": "north-th", "TH-65": "north-th", "TH-61": "north-th", "TH-71": "north-th",
    // 东北部(伊桑)
    "TH-30": "northeast-th", "TH-31": "northeast-th", "TH-32": "northeast-th", "TH-33": "northeast-th", "TH-34": "northeast-th", "TH-35": "northeast-th", "TH-36": "northeast-th", "TH-37": "northeast-th", "TH-38": "northeast-th", "TH-39": "northeast-th", "TH-40": "northeast-th", "TH-41": "northeast-th", "TH-42": "northeast-th", "TH-43": "northeast-th", "TH-44": "northeast-th", "TH-45": "northeast-th", "TH-46": "northeast-th", "TH-47": "northeast-th", "TH-48": "northeast-th", "TH-49": "northeast-th",
    // 中部
    "TH-10": "central-th", "TH-11": "central-th", "TH-12": "central-th", "TH-13": "central-th", "TH-14": "central-th", "TH-15": "central-th", "TH-16": "central-th", "TH-17": "central-th", "TH-18": "central-th", "TH-19": "central-th", "TH-24": "central-th", "TH-25": "central-th", "TH-26": "central-th", "TH-72": "central-th", "TH-73": "central-th", "TH-74": "central-th", "TH-75": "central-th", "TH-76": "central-th", "TH-77": "central-th",
    // 东部
    "TH-20": "east-th", "TH-21": "east-th", "TH-22": "east-th", "TH-23": "east-th",
    // 南部
    "TH-70": "south-th", "TH-80": "south-th", "TH-81": "south-th", "TH-82": "south-th", "TH-83": "south-th", "TH-84": "south-th", "TH-85": "south-th", "TH-86": "south-th", "TH-90": "south-th", "TH-91": "south-th", "TH-92": "south-th", "TH-93": "south-th", "TH-94": "south-th", "TH-95": "south-th", "TH-96": "south-th",
  },

  /* ===== 印尼：六大岛群 ===== */
  IDN: {
    // 苏门答腊
    "ID-AC": "sumatra", "ID-SU": "sumatra", "ID-SB": "sumatra", "ID-RI": "sumatra", "ID-JA": "sumatra", "ID-SS": "sumatra", "ID-LA": "sumatra", "ID-BE": "sumatra", "ID-BB": "sumatra",
    // 爪哇
    "ID-JK": "java", "ID-JB": "java", "ID-JT": "java", "ID-JI": "java", "ID-YO": "java", "ID-BT": "java",
    // 巴厘与努沙登加拉
    "ID-BA": "bali-nt", "ID-NB": "bali-nt", "ID-NT": "bali-nt",
    // 加里曼丹
    "ID-KB": "kalimantan", "ID-KT": "kalimantan", "ID-KS": "kalimantan", "ID-KI": "kalimantan",
    // 苏拉威西
    "ID-SN": "sulawesi", "ID-ST": "sulawesi", "ID-SG": "sulawesi", "ID-SR": "sulawesi",
    // 巴布亚与马鲁古
    "ID-MA": "papua-maluku", "ID-MU": "papua-maluku", "ID-PA": "papua-maluku", "ID-PB": "papua-maluku",
  },

  /* ===== 越南：北/中/南 ===== */
  VNM: {
    // 北部
    "VN-01": "north-vn", "VN-02": "north-vn", "VN-03": "north-vn", "VN-04": "north-vn", "VN-05": "north-vn", "VN-06": "north-vn", "VN-07": "north-vn", "VN-09": "north-vn", "VN-13": "north-vn", "VN-14": "north-vn", "VN-18": "north-vn", "VN-HN": "north-vn", "VN-HP": "north-vn", "VN-20": "north-vn", "VN-21": "north-vn", "VN-22": "north-vn", "VN-23": "north-vn", "VN-24": "north-vn", "VN-25": "north-vn", "VN-26": "north-vn", "VN-27": "north-vn", "VN-28": "north-vn", "VN-29": "north-vn", "VN-30": "north-vn", "VN-31": "north-vn", "VN-32": "north-vn", "VN-33": "north-vn", "VN-34": "north-vn", "VN-35": "north-vn", "VN-52": "north-vn", "VN-54": "north-vn", "VN-56": "north-vn", "VN-57": "north-vn", "VN-58": "north-vn", "VN-61": "north-vn", "VN-63": "north-vn", "VN-66": "north-vn", "VN-67": "north-vn", "VN-68": "north-vn", "VN-69": "north-vn", "VN-70": "north-vn", "VN-71": "north-vn", "VN-72": "north-vn", "VN-73": "north-vn", "VN-53": "north-vn",
    // 中部
    "VN-37": "central-vn", "VN-38": "central-vn", "VN-39": "central-vn", "VN-40": "central-vn", "VN-41": "central-vn", "VN-42": "central-vn", "VN-43": "central-vn", "VN-44": "central-vn", "VN-45": "central-vn", "VN-46": "central-vn", "VN-47": "central-vn", "VN-48": "central-vn", "VN-49": "central-vn", "VN-50": "central-vn", "VN-51": "central-vn", "VN-59": "central-vn", "VN-55": "central-vn", "VN-CT": "central-vn", "VN-DN": "central-vn",
    // 南部
    "VN-SG": "south-vn", "VN-36": "south-vn", "VN-64": "south-vn",
  },

  /* ===== 意大利：西北/东北/中/南/群岛 ===== */
  ITA: {
    "IT-AO": "northwest-it", "IT-TO": "northwest-it", "IT-VC": "northwest-it", "IT-VB": "northwest-it", "IT-NO": "northwest-it", "IT-AL": "northwest-it", "IT-AT": "northwest-it", "IT-CN": "northwest-it", "IT-IM": "northwest-it", "IT-SV": "northwest-it", "IT-GE": "northwest-it", "IT-PV": "northwest-it", "IT-LO": "northwest-it", "IT-MI": "northwest-it", "IT-MB": "northwest-it", "IT-VA": "northwest-it", "IT-CO": "northwest-it", "IT-LC": "northwest-it", "IT-SO": "northwest-it", "IT-BG": "northwest-it", "IT-BS": "northwest-it", "IT-CR": "northwest-it", "IT-MN": "northwest-it", "IT-BI": "northwest-it",
    "IT-BZ": "northeast-it", "IT-TN": "northeast-it", "IT-VR": "northeast-it", "IT-VI": "northeast-it", "IT-BL": "northeast-it", "IT-TV": "northeast-it", "IT-PD": "northeast-it", "IT-RO": "northeast-it", "IT-VE": "northeast-it", "IT-UD": "northeast-it", "IT-GO": "northeast-it", "IT-TS": "northeast-it", "IT-PC": "northeast-it", "IT-PR": "northeast-it", "IT-RE": "northeast-it", "IT-MO": "northeast-it", "IT-BO": "northeast-it", "IT-FE": "northeast-it", "IT-RA": "northeast-it", "IT-FC": "northeast-it", "IT-PN": "northeast-it",
    "IT-FR": "central-italy", "IT-RI": "central-italy", "IT-PG": "central-italy", "IT-TR": "central-italy", "IT-AR": "central-italy", "IT-SI": "central-italy", "IT-FI": "central-italy", "IT-PT": "central-italy", "IT-PO": "central-italy", "IT-LU": "central-italy", "IT-MS": "central-italy", "IT-SP": "central-italy", "IT-PI": "central-italy", "IT-LI": "central-italy", "IT-GR": "central-italy", "IT-VT": "central-italy", "IT-AN": "central-italy", "IT-MC": "central-italy", "IT-FM": "central-italy", "IT-AP": "central-italy", "IT-RM": "central-italy", "IT-LT": "central-italy",
    "IT-AV": "south-italy", "IT-BN": "south-italy", "IT-CE": "south-italy", "IT-SA": "south-italy", "IT-NA": "south-italy", "IT-CB": "south-italy", "IT-IS": "south-italy", "IT-CH": "south-italy", "IT-PE": "south-italy", "IT-TE": "south-italy", "IT-FG": "south-italy", "IT-BT": "south-italy", "IT-BA": "south-italy", "IT-BR": "south-italy", "IT-LE": "south-italy", "IT-TA": "south-italy", "IT-MT": "south-italy", "IT-CS": "south-italy", "IT-KR": "south-italy", "IT-CZ": "south-italy", "IT-RC": "south-italy", "IT-VV": "south-italy", "IT-PZ": "south-italy", "IT-AQ": "south-italy", "IT-EN": "south-italy",
    "IT-TP": "islands-it", "IT-ME": "islands-it", "IT-PA": "islands-it", "IT-AG": "islands-it", "IT-CL": "islands-it", "IT-RG": "islands-it", "IT-SR": "islands-it", "IT-CT": "islands-it", "IT-CI": "islands-it", "IT-SS": "islands-it", "IT-NU": "islands-it", "IT-OT": "islands-it", "IT-OR": "islands-it", "IT-VS": "islands-it", "IT-CA": "islands-it", "IT-OG": "islands-it",
  },

  /* ===== 法国：本土五大旅游区（法兰西岛/北部诺曼底/东部阿尔卑斯/西部大西洋/南部地中海） ===== */
  FRA: {
    "FR-75": "idf", "FR-77": "idf", "FR-78": "idf", "FR-91": "idf", "FR-92": "idf", "FR-93": "idf", "FR-94": "idf", "FR-95": "idf",
    "FR-59": "north-fra", "FR-62": "north-fra", "FR-80": "north-fra", "FR-02": "north-fra", "FR-60": "north-fra", "FR-51": "north-fra", "FR-08": "north-fra", "FR-55": "north-fra", "FR-54": "north-fra", "FR-57": "north-fra", "FR-76": "north-fra", "FR-27": "north-fra", "FR-14": "north-fra", "FR-50": "north-fra", "FR-61": "north-fra", "FR-28": "north-fra",
    "FR-67": "east-fra", "FR-68": "east-fra", "FR-88": "east-fra", "FR-52": "east-fra", "FR-10": "east-fra", "FR-21": "east-fra", "FR-71": "east-fra", "FR-89": "east-fra", "FR-58": "east-fra", "FR-39": "east-fra", "FR-25": "east-fra", "FR-90": "east-fra", "FR-70": "east-fra", "FR-01": "east-fra", "FR-69": "east-fra", "FR-38": "east-fra", "FR-26": "east-fra", "FR-07": "east-fra", "FR-42": "east-fra", "FR-63": "east-fra", "FR-03": "east-fra", "FR-15": "east-fra", "FR-43": "east-fra", "FR-73": "east-fra", "FR-74": "east-fra", "FR-05": "east-fra",
    "FR-29": "west-fra", "FR-22": "west-fra", "FR-56": "west-fra", "FR-35": "west-fra", "FR-44": "west-fra", "FR-85": "west-fra", "FR-49": "west-fra", "FR-53": "west-fra", "FR-72": "west-fra", "FR-79": "west-fra", "FR-86": "west-fra", "FR-37": "west-fra", "FR-36": "west-fra", "FR-41": "west-fra", "FR-45": "west-fra", "FR-18": "west-fra", "FR-16": "west-fra", "FR-17": "west-fra", "FR-33": "west-fra", "FR-40": "west-fra", "FR-47": "west-fra", "FR-24": "west-fra", "FR-19": "west-fra", "FR-23": "west-fra", "FR-87": "west-fra",
    "FR-83": "south-fra", "FR-13": "south-fra", "FR-84": "south-fra", "FR-04": "south-fra", "FR-06": "south-fra", "FR-30": "south-fra", "FR-34": "south-fra", "FR-11": "south-fra", "FR-66": "south-fra", "FR-09": "south-fra", "FR-31": "south-fra", "FR-65": "south-fra", "FR-64": "south-fra", "FR-32": "south-fra", "FR-82": "south-fra", "FR-81": "south-fra", "FR-12": "south-fra", "FR-46": "south-fra", "FR-48": "south-fra", "FR-2A": "south-fra", "FR-2B": "south-fra",
  },

  /* ===== 冰岛：首都/西/北/东/南 ===== */
  ISL: {
    "IS-0": "capital-is", "IS-1": "capital-is", "IS-2": "capital-is", "IS-3": "west-is", "IS-4": "west-is",
    "IS-5": "north-is", "IS-6": "north-is", "IS-7": "east-is", "IS-8": "south-iceland",
  },

  /* ===== 西班牙：北(巴斯克·加利西亚·阿斯图里亚斯)/中(马德里·卡斯蒂利亚)/东(加泰罗尼亚·巴伦西亚)/南(安达卢西亚)/群岛 ===== */
  ESP: {
    "ES-SS": "north-es", "ES-BI": "north-es", "ES-VI": "north-es", "ES-O": "north-es", "ES-S": "north-es", "ES-NA": "north-es", "ES-OR": "north-es", "ES-PO": "north-es", "ES-LU": "north-es", "ES-C": "north-es",
    "ES-M": "central-es", "ES-AV": "central-es", "ES-SG": "central-es", "ES-VA": "central-es", "ES-LE": "central-es", "ES-BU": "central-es", "ES-SO": "central-es", "ES-P": "central-es", "ES-SA": "central-es", "ES-CC": "central-es", "ES-ZA": "central-es", "ES-AB": "central-es", "ES-CU": "central-es", "ES-TE": "central-es", "ES-GU": "central-es", "ES-CR": "central-es", "ES-J": "central-es", "ES-TO": "central-es", "ES-LO": "central-es", "ES-Z": "central-es", "ES-HU": "central-es", "ES-BA": "central-es",
    "ES-B": "east-es", "ES-T": "east-es", "ES-CS": "east-es", "ES-V": "east-es", "ES-A": "east-es", "ES-MU": "east-es", "ES-GI": "east-es", "ES-L": "east-es",
    "ES-CA": "south-es", "ES-H": "south-es", "ES-AL": "south-es", "ES-GR": "south-es", "ES-MA": "south-es", "ES-SE": "south-es", "ES-CO": "south-es",
    "ES-TF": "islands-es", "ES-GC": "islands-es", "ES-PM": "islands-es", "ES-CE": "islands-es", "ES-ML": "islands-es",
  },

  /* ===== 瑞士：西(罗曼蒂)/高原/阿尔卑斯/提契诺 ===== */
  CHE: {
    "CH-VD": "west-ch", "CH-GE": "west-ch", "CH-VS": "west-ch", "CH-NE": "west-ch", "CH-JU": "west-ch", "CH-FR": "west-ch",
    "CH-ZH": "plateau-ch", "CH-BE": "plateau-ch", "CH-LU": "plateau-ch", "CH-AG": "plateau-ch", "CH-SG": "plateau-ch", "CH-SO": "plateau-ch", "CH-BL": "plateau-ch", "CH-BS": "plateau-ch", "CH-SH": "plateau-ch", "CH-TG": "plateau-ch", "CH-ZG": "plateau-ch", "CH-AR": "plateau-ch", "CH-AI": "plateau-ch",
    "CH-GR": "alpine-ch", "CH-UR": "alpine-ch", "CH-SZ": "alpine-ch", "CH-OW": "alpine-ch", "CH-NW": "alpine-ch", "CH-GL": "alpine-ch",
    "CH-TI": "ticino",
  },

  /* ===== 挪威：东/南/西/中/北 ===== */
  NOR: {
    "NO-01": "east-no", "NO-02": "east-no", "NO-03": "east-no", "NO-04": "east-no", "NO-05": "east-no", "NO-06": "east-no",
    "NO-07": "south-no", "NO-08": "south-no", "NO-09": "south-no", "NO-10": "south-no",
    "NO-11": "west-no", "NO-12": "west-no", "NO-14": "west-no", "NO-15": "west-no",
    "NO-16": "central-no", "NO-17": "central-no",
    "NO-18": "north-no", "NO-19": "north-no", "NO-20": "north-no", "NO-21": "north-no", "NO-X01~": "north-no",
  },

  /* ===== 新西兰：南北岛 ===== */
  NZL: {
    "NZ-NTL": "north-island", "NZ-AUK": "north-island", "NZ-WKO": "north-island", "NZ-BOP": "north-island", "NZ-GIS": "north-island", "NZ-HKB": "north-island", "NZ-TKI": "north-island", "NZ-MWT": "north-island", "NZ-WGN": "north-island", "NZ-CIT": "north-island", "NZ-X01~": "north-island",
    "NZ-TAS": "south-island", "NZ-NSN": "south-island", "NZ-MBH": "south-island", "NZ-WTC": "south-island", "NZ-CAN": "south-island", "NZ-OTA": "south-island", "NZ-STL": "south-island", "NZ-X03~": "south-island", "NZ-X04~": "south-island", "NZ-X05~": "south-island", "NZ-X06~": "south-island", "NZ-X07~": "south-island", "TK-X01~": "south-island",
  },

  /* ===== 澳大利亚：六州二领地(旅游合并) ===== */
  AUS: {
    "AU-NSW": "nsw-act", "AU-ACT": "nsw-act", "AU-X02~": "nsw-act",
    "AU-VIC": "vic",
    "AU-QLD": "qld",
    "AU-SA": "sa",
    "AU-WA": "wa", "AU-X03~": "wa",
    "AU-TAS": "tas",
    "AU-NT": "nt",
  },

  /* ===== 斐济：主岛/北岛/外岛 ===== */
  FJI: {
    "FJ-C": "viti-levu", "FJ-W": "viti-levu", "FJ-E": "viti-levu",
    "FJ-N": "vanua-levu", "FJ-R": "outer-islands",
  },

  /* ===== 美国：人口普查四大区 + 夏威夷/阿拉斯加 ===== */
  USA: {
    "US-CT": "northeast-us", "US-ME": "northeast-us", "US-MA": "northeast-us", "US-NH": "northeast-us", "US-RI": "northeast-us", "US-VT": "northeast-us", "US-NJ": "northeast-us", "US-NY": "northeast-us", "US-PA": "northeast-us",
    "US-IL": "midwest", "US-IN": "midwest", "US-MI": "midwest", "US-OH": "midwest", "US-WI": "midwest", "US-IA": "midwest", "US-KS": "midwest", "US-MN": "midwest", "US-MO": "midwest", "US-NE": "midwest", "US-ND": "midwest", "US-SD": "midwest",
    "US-DE": "south-us", "US-FL": "south-us", "US-GA": "south-us", "US-MD": "south-us", "US-NC": "south-us", "US-SC": "south-us", "US-VA": "south-us", "US-WV": "south-us", "US-DC": "south-us", "US-AL": "south-us", "US-KY": "south-us", "US-MS": "south-us", "US-TN": "south-us", "US-AR": "south-us", "US-LA": "south-us", "US-OK": "south-us", "US-TX": "south-us",
    "US-CA": "west", "US-OR": "west", "US-WA": "west", "US-NV": "west",
    "US-AZ": "mountain-us", "US-CO": "mountain-us", "US-ID": "mountain-us", "US-MT": "mountain-us", "US-NM": "mountain-us", "US-UT": "mountain-us", "US-WY": "mountain-us",
    "US-HI": "hawaii",
    "US-AK": "alaska",
  },

  /* ===== 加拿大：大西洋/魁北克/安大略/草原/西部/北部 ===== */
  CAN: {
    "CA-NB": "atlantic-ca", "CA-NS": "atlantic-ca", "CA-PE": "atlantic-ca", "CA-NL": "atlantic-ca",
    "CA-QC": "quebec",
    "CA-ON": "ontario",
    "CA-MB": "prairies", "CA-SK": "prairies", "CA-AB": "prairies",
    "CA-BC": "west-ca",
    "CA-YT": "north-ca", "CA-NT": "north-ca", "CA-NU": "north-ca",
  },

  /* ===== 墨西哥：北/中高原/太平洋/尤卡坦 ===== */
  MEX: {
    "MX-BCN": "north-mx", "MX-BCS": "north-mx", "MX-SON": "north-mx", "MX-CHH": "north-mx", "MX-COA": "north-mx", "MX-NLE": "north-mx", "MX-TAM": "north-mx", "MX-DUR": "north-mx", "MX-SIN": "north-mx",
    "MX-AGU": "central-mx", "MX-GUA": "central-mx", "MX-QUE": "central-mx", "MX-HID": "central-mx", "MX-MEX": "central-mx", "MX-DIF": "central-mx", "MX-MOR": "central-mx", "MX-PUE": "central-mx", "MX-TLA": "central-mx", "MX-SLP": "central-mx", "MX-ZAC": "central-mx", "MX-JAL": "central-mx", "MX-MIC": "central-mx", "MX-X01~": "central-mx",
    "MX-NAY": "pacific-mx", "MX-COL": "pacific-mx", "MX-GRO": "pacific-mx", "MX-OAX": "pacific-mx", "MX-VER": "pacific-mx", "MX-CHP": "pacific-mx", "MX-TAB": "pacific-mx", "MX-CAM": "pacific-mx",
    "MX-YUC": "yucatan", "MX-ROO": "yucatan",
  },

  /* ===== 哥斯达黎加：中央谷地/北太平洋/南太平洋/加勒比/北平原 ===== */
  CRI: {
    "CR-SJ": "central-valley", "CR-A": "central-valley", "CR-H": "central-valley", "CR-C": "central-valley",
    "CR-G": "pacific-north-cr",
    "CR-P": "pacific-south-cr",
    "CR-L": "caribbean-cr",
  },

  /* ===== 巴西：IBGE 五大区 ===== */
  BRA: {
    "BR-AC": "north-br", "BR-AM": "north-br", "BR-AP": "north-br", "BR-PA": "north-br", "BR-RO": "north-br", "BR-RR": "north-br", "BR-TO": "north-br",
    "BR-MA": "northeast-br", "BR-PI": "northeast-br", "BR-CE": "northeast-br", "BR-RN": "northeast-br", "BR-PB": "northeast-br", "BR-PE": "northeast-br", "BR-AL": "northeast-br", "BR-SE": "northeast-br", "BR-BA": "northeast-br",
    "BR-MT": "central-west-br", "BR-MS": "central-west-br", "BR-GO": "central-west-br", "BR-DF": "central-west-br",
    "BR-MG": "southeast-br", "BR-ES": "southeast-br", "BR-RJ": "southeast-br", "BR-SP": "southeast-br",
    "BR-PR": "south-br", "BR-SC": "south-br", "BR-RS": "south-br",
  },

  /* ===== 南非：豪登/西开普/花园大道/夸祖鲁/克鲁格 ===== */
  ZAF: {
    "ZA-GT": "gauteng",
    "ZA-WC": "cape-region",
    "ZA-EC": "garden-route",
    "ZA-NL": "kzn",
    "ZA-NC": "kruger", "ZA-NW": "kruger", "ZA-FS": "kruger", "ZA-MP": "kruger", "ZA-LP": "kruger",
  },
}

/**
 * 8 段色相盘（HSL），用于为任意国家的旅游板块动态生成区分色。
 * 避免相邻板块色相相近，保证一眼可辨。
 */
const HUE_SPREAD = [200, 28, 145, 340, 95, 260, 20, 175, 310, 50]

/** 由 regionId 稳定映射到色相索引（同 id 永远同色）。 */
function hueIndexForRegion(regionId: string): number {
  let hash = 0
  for (let i = 0; i < regionId.length; i += 1) {
    hash = (hash * 31 + regionId.charCodeAt(i)) >>> 0
  }
  return hash % HUE_SPREAD.length
}

/**
 * 取某国家某板块的配色。中国用专属固定调色；其他国家按色相盘动态分配，
 * 同一 regionId 在多次渲染中颜色稳定。
 */
export function getSectorPalette(countryCode: string, regionId: string): { fill: string; stroke: string } {
  if (countryCode === "CHN" && CHINA_REGION_PALETTE[regionId]) {
    return CHINA_REGION_PALETTE[regionId]
  }
  const hue = HUE_SPREAD[hueIndexForRegion(regionId)]
  return {
    fill: `hsl(${hue}, 48%, 32%)`,
    stroke: `hsl(${hue}, 62%, 62%)`,
  }
}

/**
 * 解析某省级行政区所属的旅游板块 regionId。
 * 返回 null 表示该国家不在显式映射中（地图将沿用质心最近邻兜底）。
 */
export function resolveProvinceSector(countryCode: string, feature: GeoJSON.Feature): string | null {
  const countryMap = PROVINCE_TO_REGION[countryCode]
  if (!countryMap) return null
  const iso = feature.properties?.iso_3166_2 as string | undefined
  if (!iso) return null
  return countryMap[iso] || null
}
