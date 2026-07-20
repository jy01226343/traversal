/**
 * 山地场景 · 富士山真实 DEM 电影级地形（SCENES 拥有）
 *
 * 地貌数据源：public/terrain/fuji/fuji-dem.bin（Uint16 小端、行主序、北在上，
 * 1456×1323，bounds 138.55–139.05E / 35.25–35.62N，海拔 -381–3754m，
 * Mapzen Terrarium zoom12；元数据同目录 fuji-dem.json，关键常量同步在下方 DEM_META）。
 * 运行时仅 fetch .bin 二进制（16-bit 精度），不 fetch PNG（canvas 解码会丢精度）。
 *
 * 坐标约定：场景 1 单位 = 1km；富士山顶（35.3606, 138.7274）为原点；
 * +x 向东，+z 向南，y 为海拔（km）。整区约 45.3 × 41.1km，山顶约 3.75 单位。
 *
 * 渲染结构：
 * - 5×5 地形分块（chunk），按相机距离三档 LOD（近 256² / 中 96² / 远 48²），
 *   逐帧最多重建 1 个 chunk；接缝两侧采样同一 DEM 双线性函数，边界一致无裂缝。
 * - 地形材质：MeshStandardMaterial + onBeforeCompile 注入四类地表混合
 *   （积雪 / 岩石 / 火山砾 / 森林 / 草地），混合因子 = 海拔 + 坡度（法线 y）
 *   + procedural 值噪声抖动；顶点属性 aAO 为高度图预计算遮蔽项（廉价 AO）。
 *   阴影 / 雾 / ACES 色调映射由标准材质管线原生获得。
 * - 富士四湖真实水面（河口湖 831m / 西湖 900m / 精进湖 901m / 山中湖 982m）：
 *   菲涅尔深蓝渐变 + 微波纹法线扰动 + 太阳高光 + 距离雾融合。
 * - 天空渐变穹顶（不透明）、程序化云团 sprite、距离雾空气透视、远景山脊剪影环。
 * - 光照：太阳方向光（2048 shadow map 覆盖可视区）+ 半球环境光 + 冷色轮廓补光。
 * - 路线 trail_main / trail_family：路径点采样 DEM 贴地 ribbon（+0.012 抬升防 z-fight）。
 * - 全部契约节点（MOUNTAIN_NODE_NAMES）坐标由 DEM 采样放置。
 *
 * preset.visual 解释：snowLine（>1 视为雪线海拔米数；≤1 视为 0..1 比例 ×3800m，
 * 即海拔基准）/ snow（积雪覆盖度兜底反推雪线）/ leafColor / season / light /
 * mist（hazeDensity 兜底）/ cloudCover。未识别的键安全忽略。
 */
import * as THREE from "three"
import type {
  ActivityDefinition,
  AudienceDefinition,
  CameraPreset,
  ImmersiveSceneDefinition,
  ImmersiveTheme,
  RiskScenarioDefinition,
  ScenePreset,
} from "../../domain/types"
import type { SceneHandle } from "../scene-registry"
import {
  SceneSession,
  clamp01,
  collectActivityNodeNames,
  collectAnchorNodeNames,
  createCloudPuffTexture,
  createNamedNode,
  hashNoise,
  lerp,
  matchesAnyKeyword,
  nodeNamesFromRef,
  resolveActionTargetNodeNames,
  smoothstep,
  visualColor,
  visualFlag,
  visualNumber,
  visualText,
} from "../shared"

/** 契约语义节点名握手（CONTRACT.md §SCENES）——必须精确创建 */
export const MOUNTAIN_NODE_NAMES = [
  "peak",
  "crater",
  "trail_main",
  "trail_family",
  "viewpoint_a",
  "viewpoint_b",
  "station_5th",
  "snow_line",
  "vegetation_alpine",
  "risk_slope",
] as const

// ---------------------------------------------------------------- DEM 元数据与坐标系（纯函数区，可测）

/** 与 public/terrain/fuji/fuji-dem.json 同步的冻结元数据 */
const DEM_META = {
  west: 138.55,
  east: 139.05,
  south: 35.25,
  north: 35.62,
  width: 1456,
  height: 1323,
  minElevation: -381,
  maxElevation: 3754,
} as const

/** 场景原点：富士山顶（契约锚点坐标） */
const CENTER_LAT = 35.3606
const CENTER_LNG = 138.7274
/** 1° 纬度的公里数（局部近似） */
const KM_PER_DEG_LAT = 110.94
/** 1° 经度的公里数（按区域中纬 35.435° 近似） */
const KM_PER_DEG_LNG = 111.32 * Math.cos((35.435 * Math.PI) / 180)

/** 地理坐标 → 场景世界坐标（x 向东 km，z 向南 km） */
export function worldFromGeo(lat: number, lng: number): [number, number] {
  return [(lng - CENTER_LNG) * KM_PER_DEG_LNG, -(lat - CENTER_LAT) * KM_PER_DEG_LAT]
}

/** 场景世界坐标 → 地理坐标 */
export function geoFromWorld(x: number, z: number): [number, number] {
  return [CENTER_LAT - z / KM_PER_DEG_LAT, CENTER_LNG + x / KM_PER_DEG_LNG]
}

/** 解码 Uint16-LE DEM 为 Float32Array（米）。纯函数，不触碰 WebGL。 */
export function decodeDem(buffer: ArrayBuffer): Float32Array {
  const { width, height, minElevation, maxElevation } = DEM_META
  const expected = width * height
  if (buffer.byteLength < expected * 2) throw new Error("fuji-dem.bin 长度不足")
  const view = new DataView(buffer)
  const out = new Float32Array(expected)
  const scale = (maxElevation - minElevation) / 65535
  for (let i = 0; i < expected; i += 1) {
    out[i] = minElevation + view.getUint16(i * 2, true) * scale
  }
  // 空洞/毛刺滤波：与四邻均值偏差 >350m 的孤点视为 DEM 坏点（细针尖峰/深坑），替换为邻域均值
  for (let z = 1; z < height - 1; z += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = z * width + x
      const avg = (out[i - 1] + out[i + 1] + out[i - width] + out[i + width]) / 4
      if (Math.abs(out[i] - avg) > 350) out[i] = avg
    }
  }
  return out
}

/** DEM 双线性采样器：海拔（米）与解析法线，全部在世界/地理坐标下工作。 */
export class DemSampler {
  private readonly data: Float32Array
  readonly width = DEM_META.width
  readonly height = DEM_META.height

  constructor(data: Float32Array) {
    this.data = data
  }

  /** 网格坐标（gx 列/gz 行）双线性采样海拔（米），越界自动夹取。 */
  heightAtGrid(gx: number, gz: number): number {
    const w = this.width
    const h = this.height
    const x = Math.min(Math.max(gx, 0), w - 1.001)
    const z = Math.min(Math.max(gz, 0), h - 1.001)
    const x0 = Math.floor(x)
    const z0 = Math.floor(z)
    const fx = x - x0
    const fz = z - z0
    const i00 = z0 * w + x0
    const h00 = this.data[i00]
    const h10 = this.data[i00 + 1]
    const h01 = this.data[i00 + w]
    const h11 = this.data[i00 + w + 1]
    return lerp(lerp(h00, h10, fx), lerp(h01, h11, fx), fz)
  }

  /** 地理坐标采样海拔（米）。 */
  heightAtGeo(lat: number, lng: number): number {
    const gx = ((lng - DEM_META.west) / (DEM_META.east - DEM_META.west)) * (this.width - 1)
    const gz = ((DEM_META.north - lat) / (DEM_META.north - DEM_META.south)) * (this.height - 1)
    return this.heightAtGrid(gx, gz)
  }

  /** 世界坐标采样海拔（场景单位 km）。 */
  heightAtWorld(x: number, z: number): number {
    const [lat, lng] = geoFromWorld(x, z)
    return this.heightAtGeo(lat, lng) / 1000
  }

  /** 世界坐标解析法线（中心差分，eps 单位 km）。 */
  normalAtWorld(x: number, z: number, eps = 0.04): THREE.Vector3 {
    const hL = this.heightAtWorld(x - eps, z)
    const hR = this.heightAtWorld(x + eps, z)
    const hD = this.heightAtWorld(x, z - eps)
    const hU = this.heightAtWorld(x, z + eps)
    const n = new THREE.Vector3(-(hR - hL) / (2 * eps), 1, -(hU - hD) / (2 * eps))
    return n.normalize()
  }
}

/** 富士四湖（真实水面海拔 +2m 抬升以覆盖 DEM 湖底误差；椭圆半径单位 km） */
const LAKES = [
  { name: "kawaguchiko", lat: 35.517, lng: 138.755, elevM: 833, rx: 3.4, rz: 1.7, rot: 0.18 },
  { name: "saiko", lat: 35.499, lng: 138.685, elevM: 902, rx: 1.25, rz: 1.0, rot: -0.35 },
  { name: "shojiko", lat: 35.498, lng: 138.607, elevM: 903, rx: 1.05, rz: 0.8, rot: 0.1 },
  { name: "yamanakako", lat: 35.417, lng: 138.875, elevM: 984, rx: 2.3, rz: 1.6, rot: -0.15 },
] as const

/** 契约节点的地理坐标（真实 POI）；y 在 DEM 就绪后采样精确化 */
const NODE_GEO: Record<(typeof MOUNTAIN_NODE_NAMES)[number], { lat: number; lng: number; liftM: number; provisionalY: number; markerScale: number }> = {
  peak: { lat: 35.3606, lng: 138.7274, liftM: 300, provisionalY: 4.05, markerScale: 1.05 },
  crater: { lat: 35.3633, lng: 138.7288, liftM: 260, provisionalY: 3.9, markerScale: 0.85 },
  station_5th: { lat: 35.393, lng: 138.737, liftM: 180, provisionalY: 2.5, markerScale: 0.85 },
  viewpoint_a: { lat: 35.525, lng: 138.755, liftM: 120, provisionalY: 0.95, markerScale: 0.9 },
  viewpoint_b: { lat: 35.5012, lng: 138.6235, liftM: 120, provisionalY: 1.03, markerScale: 0.9 },
  trail_main: { lat: 35.3765, lng: 138.7343, liftM: 220, provisionalY: 3.1, markerScale: 0.85 },
  trail_family: { lat: 35.395, lng: 138.7425, liftM: 160, provisionalY: 2.4, markerScale: 0.85 },
  vegetation_alpine: { lat: 35.3755, lng: 138.7105, liftM: 180, provisionalY: 1.85, markerScale: 0.85 },
  risk_slope: { lat: 35.3835, lng: 138.7398, liftM: 220, provisionalY: 3.15, markerScale: 0.95 },
  snow_line: { lat: 35.372, lng: 138.7274, liftM: 200, provisionalY: 3.1, markerScale: 0.8 },
}

/** 吉田路线折线（五合目 → 山顶，真实路径概化），逐点采样 DEM 贴地 */
const MAIN_TRAIL_GEO: ReadonlyArray<readonly [number, number]> = [
  [35.393, 138.737],
  [35.3888, 138.7402],
  [35.3862, 138.7348],
  [35.3822, 138.7382],
  [35.3788, 138.7332],
  [35.3748, 138.7362],
  [35.3708, 138.7316],
  [35.3668, 138.7342],
  [35.3632, 138.7302],
  [35.3606, 138.7274],
]

/** 亲子轻松线（五合目周边平缓环线） */
const FAMILY_TRAIL_CENTER = { lat: 35.3946, lng: 138.7408, rKm: 0.55 }

// ---------------------------------------------------------------- 光照调色板（按一天时刻 t∈[0,1] 插值）

interface SkyStop {
  t: number
  top: number
  horizon: number
  sun: number
  sunIntensity: number
}

const SKY_STOPS: readonly SkyStop[] = [
  { t: 0.0, top: 0x060a12, horizon: 0x1c2a3a, sun: 0x8fb4d8, sunIntensity: 0.25 },
  { t: 0.25, top: 0x2b3a55, horizon: 0xe8a05e, sun: 0xffb35c, sunIntensity: 1.9 },
  { t: 0.5, top: 0x2a5a9c, horizon: 0xa8c4dc, sun: 0xfff2d8, sunIntensity: 3.0 },
  { t: 0.75, top: 0x1a2033, horizon: 0xf08a3c, sun: 0xff9a4a, sunIntensity: 2.0 },
  { t: 1.0, top: 0x060a12, horizon: 0x1c2a3a, sun: 0x8fb4d8, sunIntensity: 0.25 },
]

// 子串匹配按插入顺序取先命中者：季节词必须排在 clear/bright/day 等泛词之前
const LIGHT_TEXT_MAP: Record<string, number> = {
  night: 0, 夜晚: 0, 深夜: 0,
  dawn: 0.25, 清晨: 0.25, 日出: 0.25, 黎明: 0.25,
  morning: 0.38, 上午: 0.38, 朝: 0.38,
  spring: 0.42, 春: 0.42,
  autumn: 0.6, 秋: 0.6,
  winter: 0.52, 冬: 0.52,
  summer: 0.5, 夏: 0.5,
  noon: 0.5, day: 0.5, 正午: 0.5, 白天: 0.5,
  bright: 0.5, clear: 0.5,
  afternoon: 0.6, 下午: 0.6,
  dusk: 0.75, 黄昏: 0.75, 傍晚: 0.75, 日落: 0.75,
  evening: 0.85, 晚间: 0.85,
}

function sampleSkyStops(t: number): { top: THREE.Color; horizon: THREE.Color; sun: THREE.Color; sunIntensity: number } {
  const tt = clamp01(t)
  let a = SKY_STOPS[0]
  let b = SKY_STOPS[SKY_STOPS.length - 1]
  for (let i = 1; i < SKY_STOPS.length; i += 1) {
    if (tt <= SKY_STOPS[i].t) {
      a = SKY_STOPS[i - 1]
      b = SKY_STOPS[i]
      break
    }
  }
  const f = smoothstep(a.t, b.t, tt)
  return {
    top: new THREE.Color(a.top).lerp(new THREE.Color(b.top), f),
    horizon: new THREE.Color(a.horizon).lerp(new THREE.Color(b.horizon), f),
    sun: new THREE.Color(a.sun).lerp(new THREE.Color(b.sun), f),
    sunIntensity: lerp(a.sunIntensity, b.sunIntensity, f),
  }
}

const DEFAULT_LIGHT_T = 0.58

// ---------------------------------------------------------------- 关键词（activity 无 routeRef 时的兜底解释）

const MAIN_TRAIL_KEYWORDS = ["trail_main", "summit", "主峰", "登顶", "登山", "hike", "climb"] as const
const FAMILY_TRAIL_KEYWORDS = ["trail_family", "family", "亲子", "轻松", "easy", "初心者"] as const
const PHOTO_KEYWORDS = ["photo", "摄影", "观景", "viewpoint", "viewing", "拍照"] as const
const THUNDER_KEYWORDS = ["雷", "thunder", "storm", "雷电", "暴雨", "雷雨"] as const
const ROCKFALL_KEYWORDS = ["落石", "rockfall", "滚石", "崩落", "碎石"] as const

type HighlightState = "active" | "dim" | "hidden" | "default"
interface HighlightTarget {
  set(state: HighlightState): void
}

// ---------------------------------------------------------------- 地形分块 LOD

const CHUNKS_X = 5
const CHUNKS_Z = 5
/** 三档 LOD：网格分辨率 + 相机距离上限（km，含 ±1.5 滞回） */
const LOD_LEVELS = [
  { res: 256, maxDist: 13 },
  { res: 96, maxDist: 28 },
  { res: 48, maxDist: Number.POSITIVE_INFINITY },
] as const

const GLSL_NOISE = /* glsl */ `
  float faHash21(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
  }
  float faNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(faHash21(i), faHash21(i + vec2(1.0, 0.0)), u.x),
      mix(faHash21(i + vec2(0.0, 1.0)), faHash21(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }
`

export function createMountainScene(canvas: HTMLCanvasElement, sceneDef: ImmersiveSceneDefinition): SceneHandle {
  const session = new SceneSession({
    canvas,
    sceneDef,
    near: 0.05,
    far: 700,
    controls: { minDistance: 2.5, maxDistance: 70, maxPolarAngle: Math.PI * 0.495 },
    bloom: { strength: 0.22, radius: 0.4, threshold: 0.85 },
  })
  const { scene } = session

  // 真实地形需要自阴影：本场景开启 shadow map（其它场景不受影响——它们的灯不投影）
  session.renderer.shadowMap.enabled = true
  session.renderer.shadowMap.type = THREE.PCFSoftShadowMap

  // ================================================================ 天空穹顶 + 雾 + 灯光
  const skyUniforms = {
    topColor: { value: new THREE.Color(0x2a5a9c) },
    horizonColor: { value: new THREE.Color(0xa8c4dc) },
    flash: { value: 0 },
    alpha: { value: 1 },
  }
  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(320, 40, 20),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      transparent: true,
      uniforms: skyUniforms,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        uniform float flash;
        uniform float alpha;
        varying vec3 vDir;
        void main() {
          float t = smoothstep(-0.04, 0.42, vDir.y);
          vec3 color = mix(horizonColor, topColor, t);
          // 低空轻微增亮，模拟地表反照
          color += vec3(0.04, 0.035, 0.03) * (1.0 - smoothstep(-0.02, 0.2, vDir.y));
          color += flash * vec3(0.85, 0.9, 1.0);
          gl_FragColor = vec4(color, alpha);
        }`,
    }),
  )
  skyDome.name = "sky_dome"
  scene.add(skyDome)
  scene.fog = new THREE.Fog(0xa8c4dc, 40, 200)

  const hemi = new THREE.HemisphereLight(0x9ab8d8, 0x3a4030, 0.75)
  const ambient = new THREE.AmbientLight(0x2a3440, 0.35)
  const sun = new THREE.DirectionalLight(0xfff2d8, 2.8)
  sun.position.set(-20, 40, -18)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.camera.left = -30
  sun.shadow.camera.right = 30
  sun.shadow.camera.top = 30
  sun.shadow.camera.bottom = -30
  sun.shadow.camera.near = 5
  sun.shadow.camera.far = 180
  sun.shadow.bias = -0.0004
  sun.shadow.normalBias = 0.04
  sun.target.position.set(0, 1.5, -4)
  // 冷色轮廓补光（背侧）：让山体边缘从天空里分离出来
  const rim = new THREE.DirectionalLight(0x9fc8e8, 0.45)
  rim.position.set(26, 18, 24)
  scene.add(hemi, ambient, sun, sun.target, rim)

  // ================================================================ 地衬（DEM 边缘之外的世界，雾中低饱和林地色）
  const groundSkirt = new THREE.Mesh(
    new THREE.CircleGeometry(400, 64),
    new THREE.MeshStandardMaterial({ color: 0x2c3626, roughness: 1, metalness: 0 }),
  )
  groundSkirt.name = "ground_skirt"
  groundSkirt.rotation.x = -Math.PI / 2
  groundSkirt.position.y = 0.28
  groundSkirt.receiveShadow = true
  scene.add(groundSkirt)

  // ================================================================ 远景山脊剪影（一圈超远景，雾中层次）
  const ridgeMaterial = new THREE.MeshBasicMaterial({ color: 0x46586a })
  const ridgeGroup = new THREE.Group()
  ridgeGroup.name = "distant_ridges"
  for (let i = 0; i < 12; i += 1) {
    const seed = i * 7.31
    const angle = (i / 12) * Math.PI * 2 + hashNoise(seed, 1.1) * 0.5
    const height = 6 + hashNoise(seed, 2.9) * 9
    const baseRadius = 14 + hashNoise(seed, 4.1) * 16
    const distance = 120 + hashNoise(seed, 5.5) * 60
    const peak = new THREE.Mesh(new THREE.ConeGeometry(baseRadius, height, 7), ridgeMaterial)
    peak.position.set(Math.cos(angle) * distance, height / 2 - 0.5, Math.sin(angle) * distance)
    peak.scale.x = 1.2 + hashNoise(seed, 8.3) * 1.4
    ridgeGroup.add(peak)
  }
  scene.add(ridgeGroup)

  // ================================================================ 湖泊水面（真实水面海拔，菲涅尔 + 微波纹 + 太阳高光）
  const waterUniforms = {
    fogColor: { value: new THREE.Color(0xa8c4dc) },
    fogNear: { value: 40 },
    fogFar: { value: 200 },
    uTime: { value: 0 },
    uDeep: { value: new THREE.Color(0x14344f) },
    uShallow: { value: new THREE.Color(0x3a6f92) },
    uSky: { value: new THREE.Color(0xa8c4dc) },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Color(0xfff2d8) },
  }
  const waterMaterial = new THREE.ShaderMaterial({
    uniforms: waterUniforms,
    fog: true,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec3 vW;
      varying float vFogDepth;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vW = wp.xyz;
        vec4 mv = viewMatrix * wp;
        vFogDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 fogColor;
      uniform float fogNear;
      uniform float fogFar;
      uniform float uTime;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uSky;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      varying vec3 vW;
      varying float vFogDepth;
      ${GLSL_NOISE}
      void main() {
        vec3 viewDir = normalize(cameraPosition - vW);
        vec2 p = vW.xz;
        // 两组错频滚动噪声扰动法线 → 微波纹
        float w1 = faNoise(p * 2.6 + vec2(uTime * 0.045, uTime * 0.028));
        float w2 = faNoise(p * 6.4 + vec2(-uTime * 0.06, uTime * 0.04));
        vec3 N = normalize(vec3((w1 - 0.5) * 0.22 + (w2 - 0.5) * 0.1, 1.0, (w2 - 0.5) * 0.22 + (w1 - 0.5) * 0.08));
        float ndv = max(dot(viewDir, N), 0.0);
        float fres = pow(1.0 - ndv, 2.2);
        // 湖面始终带天空反射（俯视时真实湖水主要反射天色），菲涅尔增强掠射角
        vec3 waterCol = mix(uDeep, uShallow, 0.35 + ndv * 0.45);
        vec3 col = mix(waterCol, uSky, 0.32 + fres * 0.55);
        // 太阳高光带
        vec3 R = reflect(-normalize(uSunDir), N);
        col += uSunColor * pow(max(dot(R, viewDir), 0.0), 220.0) * 1.6;
        col += uSunColor * pow(max(dot(R, viewDir), 0.0), 24.0) * 0.08;
        float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
        col = mix(col, fogColor, fogFactor);
        gl_FragColor = vec4(col, 0.94);
      }`,
  })
  for (const lake of LAKES) {
    const [x, z] = worldFromGeo(lake.lat, lake.lng)
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(1, 48), waterMaterial)
    mesh.name = `lake_${lake.name}`
    mesh.rotation.x = -Math.PI / 2
    mesh.rotation.z = lake.rot
    mesh.scale.set(lake.rx, lake.rz, 1)
    mesh.position.set(x, lake.elevM / 1000, z)
    mesh.renderOrder = 1
    scene.add(mesh)
  }

  // ================================================================ 程序化云团（双层团簇纹理 sprite，绕山漂移）
  interface CloudSprite {
    sprite: THREE.Sprite
    material: THREE.SpriteMaterial
    baseAngle: number
    radius: number
    y: number
    speed: number
    phase: number
    baseOpacity: number
  }
  const cloudPuffTextureA = createCloudPuffTexture(128, 8)
  const cloudPuffTextureB = createCloudPuffTexture(128, 14)
  const cloudSprites: CloudSprite[] = []
  for (let i = 0; i < 20; i += 1) {
    const material = new THREE.SpriteMaterial({
      map: i % 2 === 0 ? cloudPuffTextureA : cloudPuffTextureB,
      color: 0xf2f6fa,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    })
    const sprite = new THREE.Sprite(material)
    const scale = 5 + hashNoise(i, 2.3) * 8
    sprite.scale.set(scale, scale * 0.42, 1)
    cloudSprites.push({
      sprite,
      material,
      baseAngle: hashNoise(i, 1.3) * Math.PI * 2,
      radius: 10 + hashNoise(i, 3.7) * 24,
      y: 3.2 + hashNoise(i, 5.1) * 2.4,
      speed: 4 + hashNoise(i, 7.9) * 7,
      phase: hashNoise(i, 9.7) * Math.PI * 2,
      baseOpacity: 0.16 + hashNoise(i, 11.3) * 0.18,
    })
    scene.add(sprite)
  }

  // ================================================================ 地形材质（标准材质 + onBeforeCompile 注入地表混合）
  // 共享 uniforms：preset 变化时改值即可，不重新编译
  const terrainUniforms = {
    uSnowLineM: { value: 2900 },
    uLeafColor: { value: new THREE.Color(0x3d5a3a).convertSRGBToLinear() },
  }

  function createTerrainMaterial(): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({ roughness: 0.96, metalness: 0 })
    material.onBeforeCompile = shader => {
      shader.uniforms.uSnowLineM = terrainUniforms.uSnowLineM
      shader.uniforms.uLeafColor = terrainUniforms.uLeafColor
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
          attribute float aAO;
          varying float vAO;
          varying vec3 vWPos;
          varying vec3 vNorm;`,
        )
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          vAO = aAO;
          vWPos = position;
          vNorm = normal;`,
        )
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
          uniform float uSnowLineM;
          uniform vec3 uLeafColor;
          varying float vAO;
          varying vec3 vWPos;
          varying vec3 vNorm;
          ${GLSL_NOISE}`,
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          {
            vec3 nrm = normalize(vNorm);
            float slope = 1.0 - clamp(nrm.y, 0.0, 1.0);
            float e = vWPos.y * 1000.0;
            float nBig = faNoise(vWPos.xz * 0.55);
            float nMid = faNoise(vWPos.xz * 3.1);
            float nFine = faNoise(vWPos.xz * 13.0);
            float jit = (nBig - 0.5) * 230.0 + (nMid - 0.5) * 70.0;

            vec3 rock = mix(vec3(0.235, 0.205, 0.185), vec3(0.36, 0.315, 0.28), nMid);
            vec3 scree = mix(vec3(0.29, 0.175, 0.125), vec3(0.385, 0.24, 0.17), nMid);
            vec3 forest = uLeafColor * (0.85 + 0.6 * nBig);
            vec3 grass = vec3(0.185, 0.26, 0.095) * (0.75 + 0.5 * nMid);
            vec3 snow = vec3(0.90, 0.94, 0.985);

            // 雪：高海拔且缓坡（陡壁挂不住雪露岩），带噪声抖动的雪线
            float snowLine = uSnowLineM + jit;
            float snowT = smoothstep(snowLine - 70.0, snowLine + 50.0, e)
              * (1.0 - smoothstep(0.28, 0.5, slope))
              * smoothstep(500.0, 900.0, e);
            float steep = smoothstep(0.30, 0.52, slope);
            // 森林 900–2400m 缓坡；草地低海拔缓坡；上部火山砾缓坡
            float forestBand = smoothstep(650.0, 950.0, e + jit * 0.5) * (1.0 - smoothstep(2280.0, 2520.0, e + jit * 0.5));
            float forestT = forestBand * (1.0 - steep);
            float grassT = (1.0 - smoothstep(700.0, 1000.0, e + jit)) * (1.0 - steep * 0.85);
            float screeT = smoothstep(2350.0, 2650.0, e + jit * 0.5);

            vec3 col = rock;
            col = mix(col, grass, clamp(grassT, 0.0, 1.0));
            col = mix(col, forest, clamp(forestT, 0.0, 1.0));
            col = mix(col, scree, clamp(screeT, 0.0, 1.0) * (1.0 - steep * 0.5));
            col = mix(col, snow, clamp(snowT, 0.0, 1.0));
            col *= 0.84 + 0.28 * nFine;   // 细节纹理
            col *= vAO;                    // 高度图预计算遮蔽（廉价 AO）
            diffuseColor.rgb = col;
          }`,
        )
    }
    return material
  }

  // ================================================================ 地形分块（DEM 就绪后构建）
  interface TerrainChunk {
    mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>
    centerX: number
    centerZ: number
    x0: number
    x1: number
    z0: number
    z1: number
    level: number
  }

  const terrainGroup = new THREE.Group()
  terrainGroup.name = "terrain_chunks"
  const terrainMaterial = createTerrainMaterial()
  const chunks: TerrainChunk[] = []
  let sampler: DemSampler | null = null

  /** 世界范围（DEM bounds → 世界坐标，含 0.5km 内缩避免边缘采样越界） */
  const [worldWestX, worldSouthZ] = worldFromGeo(DEM_META.south, DEM_META.west)
  const [worldEastX, worldNorthZ] = worldFromGeo(DEM_META.north, DEM_META.east)

  /** 单 chunk 几何：位置 / 解析法线 / aAO（遮蔽项）全部从 DEM 采样，保证接缝一致 */
  function buildChunkGeometry(chunk: TerrainChunk, res: number, sm: DemSampler): THREE.BufferGeometry {
    const verts = res + 1
    const positions = new Float32Array(verts * verts * 3)
    const normals = new Float32Array(verts * verts * 3)
    const aos = new Float32Array(verts * verts)
    const AO_DIRS = 8
    const AO_RADIUS = 0.32 // km
    for (let j = 0; j < verts; j += 1) {
      const z = chunk.z0 + ((chunk.z1 - chunk.z0) * j) / res
      for (let i = 0; i < verts; i += 1) {
        const x = chunk.x0 + ((chunk.x1 - chunk.x0) * i) / res
        const idx = j * verts + i
        const y = sm.heightAtWorld(x, z)
        positions[idx * 3] = x
        positions[idx * 3 + 1] = y
        positions[idx * 3 + 2] = z
        const n = sm.normalAtWorld(x, z)
        normals[idx * 3] = n.x
        normals[idx * 3 + 1] = n.y
        normals[idx * 3 + 2] = n.z
        // 廉价 AO：8 方向邻域高于本点的坡度占比 → 谷底/冲沟变暗
        let occ = 0
        for (let d = 0; d < AO_DIRS; d += 1) {
          const a = (d / AO_DIRS) * Math.PI * 2
          const h2 = sm.heightAtWorld(x + Math.cos(a) * AO_RADIUS, z + Math.sin(a) * AO_RADIUS)
          occ += clamp01(((h2 - y) / AO_RADIUS - 0.22) * 2.2)
        }
        aos[idx] = 1 - (occ / AO_DIRS) * 0.5
      }
    }
    const indices = new Uint32Array(res * res * 6)
    let k = 0
    for (let j = 0; j < res; j += 1) {
      for (let i = 0; i < res; i += 1) {
        const a = j * verts + i
        const b = a + 1
        const c = a + verts
        const d = c + 1
        indices[k++] = a
        indices[k++] = c
        indices[k++] = b
        indices[k++] = b
        indices[k++] = c
        indices[k++] = d
      }
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3))
    geometry.setAttribute("aAO", new THREE.BufferAttribute(aos, 1))
    geometry.setIndex(new THREE.BufferAttribute(indices, 1))
    geometry.computeBoundingSphere()
    return geometry
  }

  function desiredLevel(distance: number, current: number): number {
    // 滞回：升档要在阈值内 1.5km，降档要超出 1.5km，避免边界抖动
    for (let l = 0; l < LOD_LEVELS.length; l += 1) {
      const limit = LOD_LEVELS[l].maxDist + (current === l ? 1.5 : -1.5)
      if (distance <= limit) return l
    }
    return LOD_LEVELS.length - 1
  }

  function rebuildChunk(chunk: TerrainChunk, level: number): void {
    if (!sampler) return
    const geometry = buildChunkGeometry(chunk, LOD_LEVELS[level].res, sampler)
    chunk.mesh.geometry.dispose()
    chunk.mesh.geometry = geometry
    chunk.level = level
  }

  function buildTerrain(sm: DemSampler): void {
    const cw = (worldEastX - worldWestX) / CHUNKS_X
    const ch = (worldSouthZ - worldNorthZ) / CHUNKS_Z
    for (let cz = 0; cz < CHUNKS_Z; cz += 1) {
      for (let cx = 0; cx < CHUNKS_X; cx += 1) {
        const chunk: TerrainChunk = {
          mesh: new THREE.Mesh(new THREE.BufferGeometry(), terrainMaterial),
          centerX: worldWestX + (cx + 0.5) * cw,
          centerZ: worldNorthZ + (cz + 0.5) * ch,
          x0: worldWestX + cx * cw,
          x1: worldWestX + (cx + 1) * cw,
          z0: worldNorthZ + cz * ch,
          z1: worldNorthZ + (cz + 1) * ch,
          level: -1,
        }
        chunk.mesh.name = `terrain_chunk_${cx}_${cz}`
        chunk.mesh.castShadow = true
        chunk.mesh.receiveShadow = true
        chunk.mesh.matrixAutoUpdate = false
        const dist = session.camera.position.distanceTo(new THREE.Vector3(chunk.centerX, 1, chunk.centerZ))
        const level = desiredLevel(dist, 2)
        chunk.mesh.geometry = buildChunkGeometry(chunk, LOD_LEVELS[level].res, sm)
        chunk.level = level
        chunks.push(chunk)
        terrainGroup.add(chunk.mesh)
      }
    }
    scene.add(terrainGroup)

    // 标签遮挡检测代理：64² 低模地形（不入场景树，仅供 raycast）
    const proxyChunk: TerrainChunk = {
      mesh: new THREE.Mesh(new THREE.BufferGeometry(), terrainMaterial),
      centerX: 0,
      centerZ: 0,
      x0: worldWestX,
      x1: worldEastX,
      z0: worldNorthZ,
      z1: worldSouthZ,
      level: 2,
    }
    proxyChunk.mesh.geometry = buildChunkGeometry(proxyChunk, 64, sm)
    proxyChunk.mesh.updateMatrixWorld(true)
    session.occluders.push(proxyChunk.mesh)
  }

  // ================================================================ 贴地路线 ribbon
  interface Trail {
    mesh: THREE.Mesh
    material: THREE.MeshBasicMaterial
    curve: THREE.CatmullRomCurve3
  }

  function buildTrailRibbon(points: THREE.Vector3[], width: number, color: number): Trail {
    const curve = new THREE.CatmullRomCurve3(points)
    const samples = curve.getPoints(160)
    const verts = samples.length
    const positions = new Float32Array(verts * 2 * 3)
    const side = new THREE.Vector3()
    const tangent = new THREE.Vector3()
    const up = new THREE.Vector3(0, 1, 0)
    for (let i = 0; i < verts; i += 1) {
      const prev = samples[Math.max(i - 1, 0)]
      const next = samples[Math.min(i + 1, verts - 1)]
      tangent.subVectors(next, prev).setY(0).normalize()
      side.crossVectors(up, tangent).normalize().multiplyScalar(width / 2)
      const p = samples[i]
      positions[i * 6] = p.x - side.x
      positions[i * 6 + 1] = p.y
      positions[i * 6 + 2] = p.z - side.z
      positions[i * 6 + 3] = p.x + side.x
      positions[i * 6 + 4] = p.y
      positions[i * 6 + 5] = p.z + side.z
    }
    const indices: number[] = []
    for (let i = 0; i < verts - 1; i += 1) {
      const a = i * 2
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3))
    geometry.setIndex(indices)
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.renderOrder = 3
    return { mesh, material, curve }
  }

  /** 地理折线 → 贴地采样点（+lift 抬升防 z-fight） */
  function groundTrailPoints(geo: ReadonlyArray<readonly [number, number]>, lift: number, sm: DemSampler): THREE.Vector3[] {
    return geo.map(([lat, lng]) => {
      const [x, z] = worldFromGeo(lat, lng)
      return new THREE.Vector3(x, sm.heightAtWorld(x, z) + lift, z)
    })
  }

  const trails = new Map<string, Trail>()
  function buildTrails(sm: DemSampler): void {
    // 登山主路线：吉田口五合目 → 山顶
    const main = buildTrailRibbon(groundTrailPoints(MAIN_TRAIL_GEO, 0.014, sm), 0.07, 0xffb35c)
    main.mesh.name = "trail_main_line"
    scene.add(main.mesh)
    trails.set("trail_main", main)
    // 亲子短线：五合目周边平缓环线
    const [cx, cz] = worldFromGeo(FAMILY_TRAIL_CENTER.lat, FAMILY_TRAIL_CENTER.lng)
    const loop: THREE.Vector3[] = []
    for (let i = 0; i <= 24; i += 1) {
      const a = (i / 24) * Math.PI * 2
      const x = cx + Math.cos(a) * FAMILY_TRAIL_CENTER.rKm
      const z = cz + Math.sin(a) * FAMILY_TRAIL_CENTER.rKm * 0.8
      loop.push(new THREE.Vector3(x, sm.heightAtWorld(x, z) + 0.014, z))
    }
    const family = buildTrailRibbon(loop, 0.06, 0x7dd87d)
    family.mesh.name = "trail_family_line"
    scene.add(family.mesh)
    trails.set("trail_family", family)
  }

  // ================================================================ 契约语义节点（先按已知海拔放置，DEM 就绪后采样精确化）
  const nodes = new Map<string, THREE.Object3D>()
  function createNodes(): void {
    for (const name of MOUNTAIN_NODE_NAMES) {
      const geo = NODE_GEO[name]
      const [x, z] = worldFromGeo(geo.lat, geo.lng)
      const n = createNamedNode(scene, name, x, geo.provisionalY, z)
      nodes.set(name, n)
      session.markers.addMarker(name, new THREE.Vector3(x, geo.provisionalY, z), { scale: geo.markerScale })
    }
  }

  function refineNodes(sm: DemSampler): void {
    for (const name of MOUNTAIN_NODE_NAMES) {
      if (name === "snow_line") continue // 雪线节点由 preset 驱动
      const geo = NODE_GEO[name]
      const [x, z] = worldFromGeo(geo.lat, geo.lng)
      const y = sm.heightAtWorld(x, z) + geo.liftM / 1000
      const node = nodes.get(name)
      if (node) node.position.set(x, y, z)
      session.markers.moveMarker(name, new THREE.Vector3(x, y, z))
    }
    // trail_main 节点吸附到路线中点
    const main = trails.get("trail_main")
    if (main) {
      const mid = main.curve.getPoint(0.5)
      const node = nodes.get("trail_main")
      if (node) node.position.copy(mid).y += 0.2
      session.markers.moveMarker("trail_main", node!.position)
    }
  }

  // ================================================================ 五合目小屋群组（DEM 贴地）
  const stationGroup = new THREE.Group()
  stationGroup.name = "station_5th_huts"
  function buildStationHuts(sm: DemSampler): void {
    const hutBodyMat = new THREE.MeshStandardMaterial({ color: 0x4a3828, roughness: 0.9 })
    const hutRoofMat = new THREE.MeshStandardMaterial({ color: 0x33404e, roughness: 0.8 })
    const hutWindowMat = new THREE.MeshBasicMaterial({ color: 0xffd28e, transparent: true, opacity: 0.85 })
    const geo = NODE_GEO.station_5th
    const [sx, sz] = worldFromGeo(geo.lat, geo.lng)
    const layouts: Array<[number, number, number, number, number]> = [
      [0, 0, 0.1, 0.07, 0.08],
      [0.12, -0.05, 0.075, 0.055, 0.065],
      [-0.1, 0.06, 0.065, 0.05, 0.055],
    ]
    for (const [dx, dz, w, h, d] of layouts) {
      const x = sx + dx
      const z = sz + dz
      const y = sm.heightAtWorld(x, z)
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), hutBodyMat)
      body.position.set(x, y + h / 2, z)
      body.castShadow = true
      const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.72, h * 0.55, 4), hutRoofMat)
      roof.position.set(x, y + h + h * 0.26, z)
      roof.rotation.y = Math.PI / 4
      const windowPane = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.34, h * 0.32), hutWindowMat)
      windowPane.position.set(x, y + h * 0.55, z + d / 2 + 0.002)
      stationGroup.add(body, roof, windowPane)
    }
    scene.add(stationGroup)
  }

  // ================================================================ 观景点平台（DEM 贴地）
  interface Platform {
    group: THREE.Group
    ringMat: THREE.MeshBasicMaterial
  }
  const platforms = new Map<string, Platform>()
  function buildViewpointPlatform(name: "viewpoint_a" | "viewpoint_b", sm: DemSampler): void {
    const geo = NODE_GEO[name]
    const [x, z] = worldFromGeo(geo.lat, geo.lng)
    const y = sm.heightAtWorld(x, z)
    const group = new THREE.Group()
    group.name = `${name}_platform`
    const deck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.14, 0.02, 12),
      new THREE.MeshStandardMaterial({ color: 0x5a5348, roughness: 0.9 }),
    )
    deck.position.y = 0.01
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x8fd6ff, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false })
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.15, 0.18, 32), ringMat)
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.03
    group.add(deck, ring)
    group.position.set(x, y + 0.01, z)
    scene.add(group)
    platforms.set(name, { group, ringMat })
  }

  // ================================================================ 设施小柱（audience 时增亮）
  const facilityMaterial = new THREE.MeshBasicMaterial({ color: 0xa8e6c8, transparent: true, opacity: 0.6, depthWrite: false })
  const facilityPosts: THREE.Mesh[] = []
  function buildFacilityPosts(sm: DemSampler): void {
    const spots: Array<[number, number, string]> = [
      [35.3922, 138.738, "facility_rest_a"],
      [35.5244, 138.7535, "facility_rest_b"],
    ]
    for (const [lat, lng, name] of spots) {
      const [x, z] = worldFromGeo(lat, lng)
      const y = sm.heightAtWorld(x, z)
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.13, 6), facilityMaterial)
      post.name = name
      post.position.set(x, y + 0.065, z)
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.04, 0.01), facilityMaterial)
      cap.position.set(0, 0.08, 0)
      post.add(cap)
      scene.add(post)
      facilityPosts.push(post)
    }
  }

  // ================================================================ 森林带实例化植被（森林限界以下缓坡，按 quality 缩放）
  const TREE_COUNT = 5200
  const treeMaterial = new THREE.MeshStandardMaterial({ color: 0x2e4a2e, roughness: 1 })
  let trees: THREE.InstancedMesh | null = null
  function buildVegetation(sm: DemSampler): void {
    const geometry = new THREE.ConeGeometry(0.032, 0.095, 5)
    trees = new THREE.InstancedMesh(geometry, treeMaterial, TREE_COUNT)
    trees.name = "vegetation_belt"
    trees.castShadow = true
    const matrix = new THREE.Matrix4()
    const pos = new THREE.Vector3()
    const quat = new THREE.Quaternion()
    const scl = new THREE.Vector3()
    const yAxis = new THREE.Vector3(0, 1, 0)
    let placed = 0
    for (let i = 0; i < TREE_COUNT * 3 && placed < TREE_COUNT; i += 1) {
      // 富士山周边 + 湖岸范围拒绝采样：海拔 700–2350m 且坡度平缓
      const lng = 138.58 + hashNoise(i, 3.1) * 0.34
      const lat = 35.3 + hashNoise(i, 7.3) * 0.26
      const hM = sm.heightAtGeo(lat, lng)
      if (hM < 700 || hM > 2350) continue
      const [x, z] = worldFromGeo(lat, lng)
      // 湖面范围排除：位于湖椭圆内且海拔低于水面 + 8m 的点不长树
      let inLake = false
      for (const lake of LAKES) {
        const [lx, lz] = worldFromGeo(lake.lat, lake.lng)
        const c = Math.cos(-lake.rot)
        const s = Math.sin(-lake.rot)
        const ex = (x - lx) * c - (z - lz) * s
        const ez = (x - lx) * s + (z - lz) * c
        if ((ex / lake.rx) ** 2 + (ez / lake.rz) ** 2 < 1.2 && hM < lake.elevM + 8) {
          inLake = true
          break
        }
      }
      if (inLake) continue
      if (sm.normalAtWorld(x, z).y < 0.78) continue
      const s = 0.65 + hashNoise(i, 11.7) * 0.8
      pos.set(x, hM / 1000 + 0.04 * s, z)
      quat.setFromAxisAngle(yAxis, hashNoise(i, 5.5) * Math.PI)
      scl.setScalar(s)
      matrix.compose(pos, quat, scl)
      trees.setMatrixAt(placed, matrix)
      placed += 1
    }
    trees.count = placed
    trees.instanceMatrix.needsUpdate = true
    scene.add(trees)
  }

  // ================================================================ 风险坡面（贴地警示斑块）+ 落石粒子
  const riskSlopeMaterial = new THREE.MeshBasicMaterial({
    color: 0xe05545,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  let riskSlopeBuilt = false
  function buildRiskSlope(sm: DemSampler): void {
    const geo = NODE_GEO.risk_slope
    const [cx, cz] = worldFromGeo(geo.lat, geo.lng)
    const half = 0.9
    const res = 20
    const verts = res + 1
    const positions = new Float32Array(verts * verts * 3)
    for (let j = 0; j < verts; j += 1) {
      for (let i = 0; i < verts; i += 1) {
        const x = cx - half + (2 * half * i) / res
        const z = cz - half + (2 * half * j) / res
        const idx = j * verts + i
        positions[idx * 3] = x
        positions[idx * 3 + 1] = sm.heightAtWorld(x, z) + 0.016
        positions[idx * 3 + 2] = z
      }
    }
    const indices: number[] = []
    for (let j = 0; j < res; j += 1) {
      for (let i = 0; i < res; i += 1) {
        const a = j * verts + i
        indices.push(a, a + verts, a + 1, a + 1, a + verts, a + verts + 1)
      }
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3))
    geometry.setIndex(indices)
    const mesh = new THREE.Mesh(geometry, riskSlopeMaterial)
    mesh.name = "risk_slope_overlay"
    mesh.renderOrder = 2
    scene.add(mesh)
    riskSlopeBuilt = true
  }

  const ROCKFALL_COUNT = 26
  const rockfallPositions = new Float32Array(ROCKFALL_COUNT * 3)
  const rockfallProgress = new Float32Array(ROCKFALL_COUNT)
  const rockfallDir = new Float32Array(ROCKFALL_COUNT * 2)
  const rockfallStart = new Float32Array(ROCKFALL_COUNT * 2)
  const rockfallSpeed = new Float32Array(ROCKFALL_COUNT)
  const rockfallGeometry = new THREE.BufferGeometry()
  rockfallGeometry.setAttribute("position", new THREE.BufferAttribute(rockfallPositions, 3))
  const rockfallMaterial = new THREE.PointsMaterial({ color: 0xb09a80, size: 0.12, transparent: true, opacity: 0.9, depthWrite: false })
  const rockfallPoints = new THREE.Points(rockfallGeometry, rockfallMaterial)
  rockfallPoints.name = "rockfall_particles"
  rockfallPoints.visible = false
  scene.add(rockfallPoints)

  function seedRockfall(sm: DemSampler): void {
    const geo = NODE_GEO.risk_slope
    const [cx, cz] = worldFromGeo(geo.lat, geo.lng)
    for (let i = 0; i < ROCKFALL_COUNT; i += 1) {
      const ox = (hashNoise(i, 2.9) - 0.5) * 0.7
      const oz = (hashNoise(i, 4.7) - 0.5) * 0.5
      rockfallStart[i * 2] = cx + ox
      rockfallStart[i * 2 + 1] = cz + oz
      // 下坡方向 = 法线水平分量
      const n = sm.normalAtWorld(cx + ox, cz + oz)
      const len = Math.hypot(n.x, n.z) || 1
      rockfallDir[i * 2] = n.x / len
      rockfallDir[i * 2 + 1] = n.z / len
      rockfallProgress[i] = hashNoise(i, 1.3)
      rockfallSpeed[i] = 0.22 + hashNoise(i, 4.1) * 0.28
    }
  }

  // ================================================================ 雪线轮廓（沿 DEM 等值线，随 preset 重算）
  const snowLineMaterial = new THREE.LineBasicMaterial({ color: 0xe8f0f8, transparent: true, opacity: 0.55 })
  let snowLineRing: THREE.Line | null = null
  function rebuildSnowLineContour(sm: DemSampler, snowLineM: number): void {
    if (snowLineRing) {
      snowLineRing.geometry.dispose()
      scene.remove(snowLineRing)
      snowLineRing = null
    }
    if (snowLineM >= 3740) return // 雪线高过山顶，无可见轮廓
    const points: THREE.Vector3[] = []
    for (let i = 0; i <= 128; i += 1) {
      const a = (i / 128) * Math.PI * 2
      const dx = Math.cos(a)
      const dz = Math.sin(a)
      // 自山顶向外步进，找海拔首次跌破雪线的位置
      let r = 8
      for (let step = 0; step <= 320; step += 1) {
        const rr = (step / 320) * 8
        if (sm.heightAtWorld(dx * rr, dz * rr) * 1000 < snowLineM) {
          r = rr
          break
        }
      }
      const x = dx * r
      const z = dz * r
      points.push(new THREE.Vector3(x, sm.heightAtWorld(x, z) + 0.03, z))
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points)
    snowLineRing = new THREE.Line(geometry, snowLineMaterial)
    snowLineRing.name = "snow_line_ring"
    scene.add(snowLineRing)
    // 雪线节点：放在北坡（河口湖方向可见面）雪线处
    const north = points.find((_, i) => i === 96) ?? points[0]
    const node = nodes.get("snow_line")
    if (node) {
      node.position.copy(north).y += 0.2
      session.markers.moveMarker("snow_line", node.position)
    }
  }

  // ================================================================ 高亮系统
  function makeTrailTarget(trail: Trail | undefined, activeColor: number, defaultColor: number): HighlightTarget {
    return {
      set(state) {
        if (!trail) return
        if (state === "active") {
          trail.material.color.set(activeColor)
          trail.material.opacity = 1
        } else if (state === "dim") {
          trail.material.color.set(defaultColor)
          trail.material.opacity = 0.25
        } else if (state === "hidden") {
          trail.material.color.set(defaultColor)
          trail.material.opacity = 0.08
        } else {
          trail.material.color.set(defaultColor)
          trail.material.opacity = 0.9
        }
      },
    }
  }
  function makePlatformTarget(platform: Platform | undefined): HighlightTarget {
    return {
      set(state) {
        if (!platform) return
        platform.ringMat.opacity = state === "active" ? 0.95 : state === "dim" ? 0.18 : state === "hidden" ? 0.06 : 0.5
        platform.ringMat.color.set(state === "active" ? 0xffd28e : 0x8fd6ff)
      },
    }
  }
  const highlightables = new Map<string, HighlightTarget>()
  const activityHighlight = new Map<string, "active" | "dim">()
  const audienceHidden = new Set<string>()

  function refreshHighlights(): void {
    for (const [name, target] of highlightables) {
      const base = activityHighlight.get(name) ?? "default"
      target.set(audienceHidden.has(name) ? "hidden" : base)
    }
  }

  function rebuildHighlightTargets(): void {
    highlightables.clear()
    highlightables.set("trail_main", makeTrailTarget(trails.get("trail_main"), 0xffd28e, 0xffb35c))
    highlightables.set("trail_family", makeTrailTarget(trails.get("trail_family"), 0xc8f0a0, 0x7dd87d))
    highlightables.set("viewpoint_a", makePlatformTarget(platforms.get("viewpoint_a")))
    highlightables.set("viewpoint_b", makePlatformTarget(platforms.get("viewpoint_b")))
    refreshHighlights()
  }

  function setFacilityEmphasis(on: boolean): void {
    facilityMaterial.opacity = on ? 1 : 0.6
    facilityMaterial.color.set(on ? 0xd8ffd0 : 0xa8e6c8)
    for (const post of facilityPosts) post.scale.setScalar(on ? 1.25 : 1)
  }

  // ================================================================ 视觉状态（preset × risk 合成）
  let lightT = DEFAULT_LIGHT_T
  let snowLineM = 2900
  let paintedSnowLineM = -1
  const vegColor = new THREE.Color(0x3d5a3a)
  let mist = 0.3
  let cloudCover = 0.45
  const effects = { storm: 0, lightning: 0, rockfall: 0, slopeAlert: 0 }
  let lightningFlash = 0
  let sunBaseIntensity = 2.8

  const STORM_TOP = new THREE.Color(0x0a0d14)
  const STORM_HORIZON = new THREE.Color(0x232a36)

  function applyVisualState(): void {
    const sky = sampleSkyStops(lightT)
    sky.top.lerp(STORM_TOP, effects.storm * 0.85)
    sky.horizon.lerp(STORM_HORIZON, effects.storm * 0.85)
    skyUniforms.topColor.value.copy(sky.top)
    skyUniforms.horizonColor.value.copy(sky.horizon)
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.copy(sky.horizon)
      // 空气透视：薄雾越浓，雾距越近
      scene.fog.near = lerp(46, 14, mist) * (1 - effects.storm * 0.35)
      scene.fog.far = lerp(220, 85, mist) * (1 - effects.storm * 0.3)
    }

    const az = Math.PI * (1 - lightT)
    const sunDir = new THREE.Vector3(Math.cos(az) * 0.75, 0.25 + Math.sin(Math.PI * lightT) * 0.7, -0.3).normalize()
    sun.position.copy(sunDir).multiplyScalar(90).add(new THREE.Vector3(0, 1.5, -4))
    sun.color.copy(sky.sun).lerp(new THREE.Color(0x5a6a80), effects.storm * 0.7)
    sunBaseIntensity = sky.sunIntensity * (1 - effects.storm * 0.65)
    sun.intensity = sunBaseIntensity
    hemi.intensity = 0.75 * (1 - effects.storm * 0.4)
    hemi.color.copy(sky.top).lerp(new THREE.Color(0xffffff), 0.35)
    ambient.intensity = 0.35 * (1 - effects.storm * 0.3)
    rim.intensity = 0.45 * (1 - effects.storm * 0.55)
    rim.color.set(0x9fc8e8).lerp(sky.horizon, 0.3)

    // 水面反射天色 / 太阳方向
    waterUniforms.uSky.value.copy(sky.horizon).lerp(sky.top, 0.4)
    waterUniforms.uSunDir.value.copy(sunDir)
    waterUniforms.uSunColor.value.copy(sky.sun).multiplyScalar(1 - effects.storm * 0.7)
    waterUniforms.uDeep.value.set(0x14344f).lerp(new THREE.Color(0x0a1218), effects.storm * 0.7)

    // 远景山脊随雾色调色
    ridgeMaterial.color.set(0x46586a).lerp(sky.horizon, 0.55)

    // 雪线 uniform + 轮廓 + 森林色调（uniform 共享，无需重编译）
    terrainUniforms.uSnowLineM.value = snowLineM
    terrainUniforms.uLeafColor.value.copy(vegColor).convertSRGBToLinear()
    treeMaterial.color.copy(vegColor).multiplyScalar(0.7)
    treeMaterial.emissive.copy(vegColor).multiplyScalar(0.22)
    if (sampler && Math.abs(snowLineM - paintedSnowLineM) > 5) {
      rebuildSnowLineContour(sampler, snowLineM)
      paintedSnowLineM = snowLineM
    }

    // 云团：密度随 cloudCover；雷暴染灰；quality=low 整层关闭
    const cloudSpritesOn = session.quality !== "low"
    for (const cloud of cloudSprites) {
      cloud.sprite.visible = cloudSpritesOn
      cloud.material.color.set(0xf2f6fa).lerp(new THREE.Color(0x5a6470), effects.storm * 0.75)
    }

    // 风险坡面泛红 + 落石
    riskSlopeMaterial.opacity = effects.slopeAlert * 0.32
    rockfallPoints.visible = effects.rockfall > 0.02 && session.quality !== "low" && riskSlopeBuilt
    rockfallMaterial.opacity = clamp01(effects.rockfall) * 0.9
  }

  // ================================================================ DEM 异步加载（就绪前天空/湖泊/云层先行渲染）
  let demReady = false
  async function loadDem(): Promise<void> {
    try {
      const env = (import.meta as { env?: { BASE_URL?: string } }).env
      const base = env?.BASE_URL ?? "/"
      const response = await fetch(`${base}terrain/fuji/fuji-dem.bin`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const buffer = await response.arrayBuffer()
      const sm = new DemSampler(decodeDem(buffer))
      sampler = sm
      buildTerrain(sm)
      buildTrails(sm)
      refineNodes(sm)
      buildStationHuts(sm)
      buildViewpointPlatform("viewpoint_a", sm)
      buildViewpointPlatform("viewpoint_b", sm)
      buildFacilityPosts(sm)
      buildVegetation(sm)
      buildRiskSlope(sm)
      seedRockfall(sm)
      rebuildHighlightTargets()
      demReady = true
      applyQualityTier(session.quality)
      applyVisualState()
      session.requestRender()
    } catch (error) {
      // DEM 加载失败：保留天空/湖泊/云层的兜底画面，不阻断 SceneHandle
      console.error("[MountainScene] DEM 加载失败，地形不可用：", error)
    }
  }

  // ================================================================ SceneHandle.apply*
  function applyPreset(preset: ScenePreset | null): void {
    const visual = preset?.visual
    // snowLine 双模量纲：>1 视为雪线海拔米数（富士山按 3800m 封顶）；
    // ≤1 视为 0..1 比例 ×3800m；snow（积雪覆盖度）反向换算兜底
    const snowLineValue = visualNumber(visual, "snowLine", Number.NaN)
    if (Number.isFinite(snowLineValue)) {
      snowLineM = snowLineValue > 1 ? Math.min(snowLineValue, 3800) : clamp01(snowLineValue) * 3800
    } else {
      snowLineM = (1 - clamp01(visualNumber(visual, "snow", 0.45))) * 3800
    }
    // 红叶/季节 → 植被色
    const leaf = visualColor(visual, "leafColor")
    const season = visualText(visual, "season")
    if (leaf) vegColor.copy(leaf)
    else if (season && matchesAnyKeyword(season, ["autumn", "fall", "秋", "红叶"])) vegColor.set(0x8a4a2c)
    else if (season && matchesAnyKeyword(season, ["winter", "冬"])) vegColor.set(0x4a5548)
    else if (season && matchesAnyKeyword(season, ["spring", "春"])) vegColor.set(0x4d7a45)
    else vegColor.set(0x3d5a3a)
    // 光照时刻
    const lightText = visualText(visual, "light")
    if (lightText) {
      const mapped = Object.entries(LIGHT_TEXT_MAP).find(([key]) => lightText.toLowerCase().includes(key))
      lightT = mapped ? mapped[1] : DEFAULT_LIGHT_T
    } else {
      lightT = clamp01(visualNumber(visual, "lightT", visualNumber(visual, "daylight", DEFAULT_LIGHT_T)))
    }
    // 薄雾（mist 优先，hazeDensity 兜底）；云层密度（cloudCover 优先）
    mist = clamp01(visualNumber(visual, "mist", visualNumber(visual, "hazeDensity", 0.3) * 1.5))
    cloudCover = clamp01(visualNumber(visual, "cloudCover", mist))
    applyVisualState()
    session.requestRender()
  }

  function resolveActivityNodeNames(activity: ActivityDefinition): Set<string> {
    const names = collectActivityNodeNames(activity, sceneDef.anchors)
    if (names.size === 0) {
      const text = `${activity.id} ${activity.label}`
      if (matchesAnyKeyword(text, MAIN_TRAIL_KEYWORDS)) names.add("trail_main")
      if (matchesAnyKeyword(text, FAMILY_TRAIL_KEYWORDS)) names.add("trail_family")
      if (matchesAnyKeyword(text, PHOTO_KEYWORDS)) {
        names.add("viewpoint_a")
        names.add("viewpoint_b")
      }
    }
    return names
  }

  function applyActivity(activity: ActivityDefinition | null): void {
    activityHighlight.clear()
    if (activity) {
      const names = resolveActivityNodeNames(activity)
      if (names.size > 0) {
        for (const name of highlightables.keys()) {
          activityHighlight.set(name, names.has(name) ? "active" : "dim")
        }
      }
    }
    refreshHighlights()
    session.requestRender()
  }

  function applyAudience(audience: AudienceDefinition | null): void {
    audienceHidden.clear()
    if (audience) {
      for (const routeId of audience.hiddenRouteIds ?? []) {
        for (const name of nodeNamesFromRef(routeId)) audienceHidden.add(name)
      }
      for (const activity of sceneDef.activities) {
        if (audience.allowedActivityIds.includes(activity.id)) continue
        for (const name of resolveActivityNodeNames(activity)) audienceHidden.add(name)
      }
      setFacilityEmphasis((audience.facilityPriority?.length ?? 0) > 0 || audience.id === "toddler_family" || audience.id === "senior")
    } else {
      setFacilityEmphasis(false)
    }
    refreshHighlights()
    session.requestRender()
  }

  function applyRiskStep(risk: RiskScenarioDefinition, stepIndex: number): void {
    const stepFrac = risk.sequence.length > 1 ? clamp01(stepIndex / (risk.sequence.length - 1)) : 1
    const text = `${risk.id} ${risk.label} ${risk.cause.join(" ")} ${risk.sequence.map(s => `${s.title} ${s.description}`).join(" ")}`
    let storm = 0
    let rockfall = 0
    let slope = 0
    let lightning = 0
    const step = risk.sequence[Math.min(Math.max(stepIndex, 0), risk.sequence.length - 1)]
    for (const action of step?.sceneActions ?? []) {
      const params = action.params
      if (action.kind === "set_weather") {
        if (visualFlag(params, "thunderstorm")) {
          storm = Math.max(storm, visualNumber(params, "intensity", 1))
          lightning = 1
        }
        if (visualFlag(params, "storm") || visualText(params, "preset") === "storm") {
          storm = Math.max(storm, visualNumber(params, "intensity", 1))
          lightning = Math.max(lightning, visualFlag(params, "lightning", true) ? 1 : 0)
        }
        if (visualFlag(params, "lightning")) lightning = 1
        storm = Math.max(
          storm,
          Math.max(
            visualNumber(params, "wind", 0),
            visualNumber(params, "cloudCover", 0),
            visualNumber(params, "rain", 0),
            visualNumber(params, "fog", 0),
          ) * 0.85,
        )
        if (visualFlag(params, "darken")) storm = Math.max(storm, visualNumber(params, "intensity", 0.7))
        rockfall = Math.max(rockfall, visualNumber(params, "dust", 0))
        if (visualFlag(params, "rockfall")) rockfall = Math.max(rockfall, visualNumber(params, "intensity", 1))
      }
      if (action.kind === "highlight_anchor") {
        if (resolveActionTargetNodeNames(action.target, sceneDef.anchors).includes("risk_slope")) slope = 1
      }
      if (action.kind === "spawn_group" && matchesAnyKeyword(action.target ?? "", ROCKFALL_KEYWORDS)) rockfall = 1
    }
    if (matchesAnyKeyword(text, THUNDER_KEYWORDS)) {
      storm = Math.max(storm, 0.45 + 0.55 * stepFrac)
      lightning = 1
      slope = Math.max(slope, 0.5 + 0.5 * stepFrac)
    }
    if (matchesAnyKeyword(text, ROCKFALL_KEYWORDS)) {
      rockfall = Math.max(rockfall, 0.4 + 0.6 * stepFrac)
      slope = Math.max(slope, 0.3 + 0.5 * stepFrac)
    }
    effects.storm = clamp01(storm)
    effects.lightning = lightning
    effects.rockfall = clamp01(rockfall)
    effects.slopeAlert = clamp01(Math.max(slope, risk.affectedAnchorIds.length > 0 ? 0.3 + 0.4 * stepFrac : 0))
    applyVisualState()
    session.requestRender()
  }

  function restoreCalm(): void {
    effects.storm = 0
    effects.lightning = 0
    effects.rockfall = 0
    effects.slopeAlert = 0
    lightningFlash = 0
    skyUniforms.flash.value = 0
    applyVisualState()
    session.requestRender()
  }

  // 主题机位（场景世界坐标：1 单位 = 1km，富士山顶为原点）
  const THEME_CAMERAS: Partial<Record<ImmersiveTheme, CameraPreset>> = {
    highlights: { position: [3.0, 1.6, -16.5], lookAt: [0, 2.2, 0], fov: 46 },
    experience: { position: [3.1, 3.2, 1.2], lookAt: [0.87, 2.5, -3.6] },
    audience: { position: [4.6, 1.7, -15.2], lookAt: [2.5, 1.0, -18.2] },
    cautions: { position: [3.6, 3.7, 0.8], lookAt: [1.14, 3.0, -2.5] },
    nature_geology: { position: [2.8, 5.0, 2.6], lookAt: [0, 3.7, 0], fov: 40 },
  }

  // ================================================================ 每帧动画
  session.setUpdater((time, delta) => {
    waterUniforms.uTime.value = time / 1000
    // 地形 LOD：逐帧检测，最多重建 1 个 chunk（分摊重建成本）
    if (demReady) {
      for (const chunk of chunks) {
        const dist = session.camera.position.distanceTo(new THREE.Vector3(chunk.centerX, 1.2, chunk.centerZ))
        const level = desiredLevel(dist, chunk.level)
        if (level !== chunk.level) {
          rebuildChunk(chunk, level)
          break
        }
      }
    }
    // 云团漂移 + 透明度脉动（密度随 cloudCover）
    const cloudDensity = 0.35 + cloudCover * 1.0
    for (const cloud of cloudSprites) {
      if (!cloud.sprite.visible) continue
      const angle = cloud.baseAngle + time * 0.00008 * cloud.speed
      cloud.sprite.position.set(
        Math.cos(angle) * cloud.radius,
        cloud.y + Math.sin(time * 0.0004 + cloud.phase) * 0.3,
        Math.sin(angle) * cloud.radius,
      )
      cloud.material.opacity = cloud.baseOpacity * cloudDensity * (0.72 + 0.28 * Math.sin(time * 0.0006 + cloud.phase))
    }
    // 闪电闪光（reducedMotion 时 updater 仅在静态帧运行，闪烁自然停用）
    if (effects.lightning > 0 && Math.random() < 0.03) lightningFlash = 0.95
    lightningFlash *= Math.pow(0.0018, delta)
    skyUniforms.flash.value = lightningFlash * 0.75
    sun.intensity = sunBaseIntensity + lightningFlash * 2.2
    // 落石粒子沿 DEM 下坡方向滚落
    if (rockfallPoints.visible && sampler) {
      for (let i = 0; i < ROCKFALL_COUNT; i += 1) {
        rockfallProgress[i] += delta * rockfallSpeed[i] * (0.5 + effects.rockfall)
        if (rockfallProgress[i] > 1) rockfallProgress[i] = 0
        const dist = rockfallProgress[i] * 1.4
        const x = rockfallStart[i * 2] + rockfallDir[i * 2] * dist
        const z = rockfallStart[i * 2 + 1] + rockfallDir[i * 2 + 1] * dist
        rockfallPositions[i * 3] = x
        rockfallPositions[i * 3 + 1] = sampler.heightAtWorld(x, z) + 0.03
        rockfallPositions[i * 3 + 2] = z
      }
      ;(rockfallGeometry.attributes.position as THREE.BufferAttribute).needsUpdate = true
    }
  })

  // quality 三档差异：植被实例数 + low 档关云团/落石/阴影贴图降档
  function applyQualityTier(q: "high" | "standard" | "low"): void {
    if (trees) {
      const total = trees.instanceMatrix.count
      trees.count = q === "high" ? total : q === "standard" ? Math.floor(total * 0.65) : Math.floor(total * 0.35)
    }
    sun.shadow.mapSize.set(q === "low" ? 1024 : 2048, q === "low" ? 1024 : 2048)
    if (sun.shadow.map) {
      sun.shadow.map.dispose()
      sun.shadow.map = null
    }
  }
  session.onQualityChange(q => {
    applyQualityTier(q)
    applyVisualState()
  })

  // ================================================================ 初始渲染
  createNodes()
  applyVisualState()
  session.requestRender() // mount 即完成首帧（天空/湖泊/云层）
  void loadDem() // 地形异步就绪后自动补帧

  return {
    applyTheme(theme) {
      session.moveCamera((theme && THEME_CAMERAS[theme]) ?? null)
    },
    applyPreset,
    applyActivity,
    applyAudience,
    applyRiskStep,
    restoreCalm,
    setAnchorEmphasis(selectedAnchorId, dimmedIds) {
      const selected = new Set<string>()
      if (selectedAnchorId) {
        for (const name of collectAnchorNodeNames(sceneDef.anchors, [selectedAnchorId])) selected.add(name)
      }
      session.markers.setEmphasis(selected, collectAnchorNodeNames(sceneDef.anchors, dimmedIds))
      session.requestRender()
    },
    projectToScreen(positionRef) {
      // 距离隐藏：超过 34km 的锚点不出标签（屏幕空间标签避让由 UI 层处理）
      const node = session.scene.getObjectByName(positionRef.replace(/^node:/, ""))
      if (node) {
        const world = new THREE.Vector3()
        node.getWorldPosition(world)
        if (session.camera.position.distanceTo(world) > 34) return null
      }
      return session.projectToScreen(positionRef)
    },
    onFrame(cb) {
      return session.onFrame(cb)
    },
    setQuality(q) {
      session.setQuality(q)
    },
    setReducedMotion(reduced) {
      session.setReducedMotion(reduced)
    },
    zoomBy(factor) {
      session.zoomBy(factor)
    },
    resetCamera() {
      session.resetCamera()
    },
    setAutoRotate(on) {
      session.setAutoRotate(on)
    },
    dispose() {
      session.dispose()
    },
  }
}
