/**
 * 山地场景 · 富士山风格锥体雪山（SCENES 拥有）
 *
 * 视觉元素（全部程序化，无外链资产）：
 * - LatheGeometry 火山锥（植被/岩壁/雪顶三段顶点色，雪线可随 preset 重算）
 * - 天际渐变穹顶（ShaderMaterial，uniform 随光照/雷暴插值）+ 雾
 * - 远山三圈低矮山脊剪影（颜色随雾色/天际线插值，营造纵深）
 * - 云海双层平面（低存在感）+ 柔光云团 sprite（程序化团簇纹理，漂移+脉动）
 * - 雪顶 additive 微闪点（雪线以上，quality=low 关闭）+ 冷色轮廓补光
 * - 发光虚线路线：trail_main（登山螺旋）/ trail_family（亲子环线）
 * - 五合目小屋群组、观景点平台、设施小柱、高山植被 InstancedMesh
 * - 风险：天空变暗 + 穹顶闪电闪光 + risk_slope 坡面泛红 + 落石粒子
 *
 * preset.visual 解释：snowLine / snow / leafColor / season / light / mist
 * （映射表见施工汇报；未识别的键安全忽略）。
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
  createRadialGlowTexture,
  hashNoise,
  lerp,
  matchesAnyKeyword,
  nodeNamesFromRef,
  normalizeUnitInterval,
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

// ---------------------------------------------------------------- 地形剖面

/** Lathe 剖面 (radius, height)，含火山口碗 */
const PROFILE: ReadonlyArray<readonly [number, number]> = [
  [11.0, 0.0],
  [8.0, 1.6],
  [5.4, 3.4],
  [3.2, 5.2],
  [1.6, 6.6],
  [1.05, 7.15],
  [0.85, 6.9],
  [0.0, 6.55],
]
const SUMMIT_Y = 7.15

function radiusAtHeight(y: number): number {
  if (y <= PROFILE[0][1]) return PROFILE[0][0]
  for (let i = 1; i < PROFILE.length; i += 1) {
    const [r1, h1] = PROFILE[i]
    const [r0, h0] = PROFILE[i - 1]
    if (y <= h1) return lerp(r0, r1, (y - h0) / (h1 - h0 || Number.EPSILON))
  }
  return PROFILE[PROFILE.length - 1][0]
}

// ---------------------------------------------------------------- 光照调色板（按一天时刻 t∈[0,1] 插值）

interface SkyStop {
  t: number
  top: number
  horizon: number
  sun: number
  sunIntensity: number
}

const SKY_STOPS: readonly SkyStop[] = [
  { t: 0.0, top: 0x05080f, horizon: 0x1c2a3a, sun: 0x8fb4d8, sunIntensity: 0.3 },
  { t: 0.25, top: 0x2b3a55, horizon: 0xe09a5a, sun: 0xffb35c, sunIntensity: 1.7 },
  { t: 0.5, top: 0x1c2f4a, horizon: 0x7f9ab5, sun: 0xfff2d8, sunIntensity: 2.7 },
  { t: 0.75, top: 0x1a2033, horizon: 0xf08a3c, sun: 0xff9a4a, sunIntensity: 1.9 },
  { t: 1.0, top: 0x05080f, horizon: 0x1c2a3a, sun: 0x8fb4d8, sunIntensity: 0.3 },
]

// 子串匹配按插入顺序取先命中者：季节词必须排在 clear/bright/day 等泛词之前
const LIGHT_TEXT_MAP: Record<string, number> = {
  night: 0, 夜晚: 0, 深夜: 0,
  dawn: 0.25, 清晨: 0.25, 日出: 0.25, 黎明: 0.25,
  morning: 0.38, 上午: 0.38, 朝: 0.38,
  spring: 0.4, 春: 0.4,
  autumn: 0.62, 秋: 0.62,
  winter: 0.52, 冬: 0.52,
  summer: 0.5, 夏: 0.5,
  noon: 0.5, day: 0.5, 正午: 0.5, 白天: 0.5,
  bright: 0.5, clear: 0.5,
  afternoon: 0.62, 下午: 0.62,
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

export function createMountainScene(canvas: HTMLCanvasElement, sceneDef: ImmersiveSceneDefinition): SceneHandle {
  const session = new SceneSession({ canvas, sceneDef, controls: { minDistance: 7, maxDistance: 55, maxPolarAngle: Math.PI * 0.54 } })
  const { scene } = session

  // ================================================================ 天空穹顶 + 雾 + 灯光
  const skyUniforms = {
    topColor: { value: new THREE.Color(0x1c2f4a) },
    horizonColor: { value: new THREE.Color(0x7f9ab5) },
    flash: { value: 0 },
    alpha: { value: 0.34 },
  }
  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(150, 32, 18),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      transparent: true,
      uniforms: skyUniforms,
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        uniform float flash;
        uniform float alpha;
        varying vec3 vDir;
        void main() {
          float t = smoothstep(-0.06, 0.5, vDir.y);
          vec3 color = mix(horizonColor, topColor, t);
          color += flash * vec3(0.85, 0.9, 1.0);
          gl_FragColor = vec4(color, alpha);
        }`,
    }),
  )
  skyDome.name = "sky_dome"
  scene.add(skyDome)
  scene.fog = new THREE.Fog(0x7f9ab5, 55, 165)

  const ambient = new THREE.AmbientLight(0x2a3440, 0.65)
  const sun = new THREE.DirectionalLight(0xfff2d8, 2.4)
  sun.position.set(0, 26, 14)
  // 冷色轮廓补光（背侧）：让山体边缘从实景照片背景里分离出来
  const rim = new THREE.DirectionalLight(0x9fc8e8, 0.5)
  rim.position.set(-22, 14, -20)
  scene.add(ambient, sun, rim)

  // ================================================================ 地面 + 前景丘
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(140, 48),
    new THREE.MeshStandardMaterial({ color: 0x24301f, roughness: 1, metalness: 0, flatShading: true }),
  )
  ground.name = "ground"
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -0.05
  scene.add(ground)

  const hillMaterial = new THREE.MeshStandardMaterial({ color: 0x2c3c28, roughness: 1, flatShading: true })
  const hillA = new THREE.Mesh(new THREE.SphereGeometry(3.2, 20, 12), hillMaterial)
  hillA.scale.set(1.4, 0.5, 1.1)
  hillA.position.set(-7.5, 0.1, 9.5)
  const hillB = new THREE.Mesh(new THREE.SphereGeometry(2.6, 18, 10), hillMaterial)
  hillB.scale.set(1.5, 0.42, 1.1)
  hillB.position.set(8.2, 0.05, 7.8)
  scene.add(hillA, hillB)

  // ================================================================ 远山剪影（三圈低矮山脊，纵深层次）
  // MeshBasicMaterial + 场景雾：外圈被雾大量吞没，颜色在 applyVisualState 里随天际线插值
  const RIDGE_BASE_COLORS = [
    new THREE.Color(0x2c3a44),
    new THREE.Color(0x36485a),
    new THREE.Color(0x42566a),
  ]
  const ridgeMaterials: THREE.MeshBasicMaterial[] = []
  const ridgeGroup = new THREE.Group()
  ridgeGroup.name = "distant_ridges"
  const RIDGE_RINGS = [
    { radius: 48, count: 7, hMin: 2.4, hMax: 5.0, spread: 8 },
    { radius: 80, count: 9, hMin: 4.5, hMax: 9.0, spread: 12 },
    { radius: 118, count: 10, hMin: 7.0, hMax: 14.0, spread: 16 },
  ]
  RIDGE_RINGS.forEach((ring, ringIndex) => {
    const material = new THREE.MeshBasicMaterial({ color: RIDGE_BASE_COLORS[ringIndex].getHex() })
    ridgeMaterials.push(material)
    for (let i = 0; i < ring.count; i += 1) {
      const seed = ringIndex * 31.7 + i * 7.3
      const angle = (i / ring.count) * Math.PI * 2 + hashNoise(seed, 1.1) * 0.55
      const height = ring.hMin + hashNoise(seed, 2.9) * (ring.hMax - ring.hMin)
      const baseRadius = 5 + hashNoise(seed, 4.1) * 7
      const distance = ring.radius + (hashNoise(seed, 5.5) - 0.5) * ring.spread
      const peak = new THREE.Mesh(new THREE.ConeGeometry(baseRadius, height, 7), material)
      peak.position.set(Math.cos(angle) * distance, height / 2 - 0.4, Math.sin(angle) * distance)
      peak.rotation.y = hashNoise(seed, 6.7) * Math.PI
      peak.scale.x = 1 + hashNoise(seed, 8.3) * 0.9 // 拉宽部分山脊，剪影更自然
      ridgeGroup.add(peak)
    }
  })
  scene.add(ridgeGroup)

  // ================================================================ 火山锥（顶点色三段材质）
  const lathePoints = PROFILE.map(([r, h]) => new THREE.Vector2(r, h))
  const mountainGeometry = new THREE.LatheGeometry(lathePoints, 128)
  const mountainMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.95,
    metalness: 0,
    flatShading: true,
  })
  const mountain = new THREE.Mesh(mountainGeometry, mountainMaterial)
  mountain.name = "mountain_body"
  scene.add(mountain)
  session.occluders.push(mountain)

  const VEG_DEFAULT = new THREE.Color(0x3d5a3a)
  const ROCK_COLOR = new THREE.Color(0x6a6058)
  const SNOW_COLOR = new THREE.Color(0xe8eef2)
  const CRATER_COLOR = new THREE.Color(0x4a423b)

  /** 重算顶点色：vegColor 植被带 / snowStartFrac 雪线起点（高度占比） */
  function paintMountain(vegColor: THREE.Color, snowStartFrac: number): void {
    const position = mountainGeometry.attributes.position as THREE.BufferAttribute
    const colors = new Float32Array(position.count * 3)
    const color = new THREE.Color()
    for (let i = 0; i < position.count; i += 1) {
      const x = position.getX(i)
      const y = position.getY(i)
      const z = position.getZ(i)
      const r = Math.hypot(x, z)
      const frac = clamp01(y / SUMMIT_Y)
      const variation = 0.9 + 0.2 * hashNoise(x * 1.7, z * 1.7)
      if (y > 6.4 && r < 1.0) {
        color.copy(CRATER_COLOR)
      } else {
        // 植被带 → 岩壁
        color.copy(vegColor).lerp(ROCK_COLOR, smoothstep(0.28, 0.5, frac))
        // 岩壁 → 雪顶
        color.lerp(SNOW_COLOR, smoothstep(snowStartFrac, Math.min(snowStartFrac + 0.09, 1), frac))
      }
      color.multiplyScalar(variation)
      colors[i * 3] = color.r
      colors[i * 3 + 1] = color.g
      colors[i * 3 + 2] = color.b
    }
    mountainGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3))
    ;(mountainGeometry.attributes.color as THREE.BufferAttribute).needsUpdate = true
  }

  // 火山口缘环
  const craterRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.95, 0.13, 10, 40),
    new THREE.MeshStandardMaterial({ color: 0x564a3e, roughness: 1, flatShading: true }),
  )
  craterRim.name = "crater_rim"
  craterRim.rotation.x = Math.PI / 2
  craterRim.position.y = 7.12
  scene.add(craterRim)

  // ================================================================ 雪线环
  const snowLineMaterial = new THREE.LineBasicMaterial({ color: 0xdfe9f2, transparent: true, opacity: 0.65 })
  function buildSnowLineGeometry(snowY: number): THREE.BufferGeometry {
    const radius = radiusAtHeight(snowY) + 0.06
    const points: THREE.Vector3[] = []
    for (let i = 0; i <= 96; i += 1) {
      const a = (i / 96) * Math.PI * 2
      points.push(new THREE.Vector3(Math.cos(a) * radius, snowY, Math.sin(a) * radius))
    }
    return new THREE.BufferGeometry().setFromPoints(points)
  }
  const snowLineRing = new THREE.Line(buildSnowLineGeometry(4.2), snowLineMaterial)
  snowLineRing.name = "snow_line_ring"
  scene.add(snowLineRing)

  // ================================================================ 雪顶闪光（additive 微闪点，雪线以上）
  const SPARKLE_COUNT = 120
  const sparklePositions = new Float32Array(SPARKLE_COUNT * 3)
  const sparkleGeometry = new THREE.BufferGeometry()
  sparkleGeometry.setAttribute("position", new THREE.BufferAttribute(sparklePositions, 3))
  const sparkleMaterial = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.13,
    map: createRadialGlowTexture(32),
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const snowSparkles = new THREE.Points(sparkleGeometry, sparkleMaterial)
  snowSparkles.name = "snow_sparkles"
  snowSparkles.visible = false
  scene.add(snowSparkles)

  /** 雪线变化时重撒闪光点（仅在顶点色重算时触发，非每帧） */
  function seedSparkles(snowFrac: number): void {
    for (let i = 0; i < SPARKLE_COUNT; i += 1) {
      const angle = hashNoise(i, 3.3) * Math.PI * 2
      const frac = snowFrac + 0.02 + hashNoise(i, 5.7) * Math.max(0.02, 0.96 - snowFrac)
      const y = frac * SUMMIT_Y
      const r = radiusAtHeight(y) + 0.06
      sparklePositions[i * 3] = Math.cos(angle) * r
      sparklePositions[i * 3 + 1] = y
      sparklePositions[i * 3 + 2] = Math.sin(angle) * r
    }
    ;(sparkleGeometry.attributes.position as THREE.BufferAttribute).needsUpdate = true
  }

  // ================================================================ 云海（双层大圆盘，低存在感）+ 柔光云团
  const cloudMaterialA = new THREE.MeshBasicMaterial({ color: 0xcfd9e2, transparent: true, opacity: 0.12, depthWrite: false })
  const cloudSeaA = new THREE.Mesh(new THREE.CircleGeometry(26, 48), cloudMaterialA)
  cloudSeaA.name = "cloud_sea_a"
  cloudSeaA.rotation.x = -Math.PI / 2
  cloudSeaA.position.y = 2.35
  const cloudMaterialB = new THREE.MeshBasicMaterial({ color: 0xc4d0dc, transparent: true, opacity: 0.07, depthWrite: false })
  const cloudSeaB = new THREE.Mesh(new THREE.CircleGeometry(42, 48), cloudMaterialB)
  cloudSeaB.name = "cloud_sea_b"
  cloudSeaB.rotation.x = -Math.PI / 2
  cloudSeaB.position.y = 1.5
  scene.add(cloudSeaA, cloudSeaB)

  // 柔光云团 sprite：程序化团簇纹理，缓慢绕山漂移 + 透明度脉动（quality=low 整层关闭）
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
  const cloudPuffTexture = createCloudPuffTexture(128)
  const cloudSprites: CloudSprite[] = []
  for (let i = 0; i < 18; i += 1) {
    const material = new THREE.SpriteMaterial({
      map: cloudPuffTexture,
      color: 0xdfe8f0,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    })
    const sprite = new THREE.Sprite(material)
    const scale = 4 + hashNoise(i, 2.3) * 5
    sprite.scale.set(scale, scale * 0.52, 1)
    cloudSprites.push({
      sprite,
      material,
      baseAngle: hashNoise(i, 1.3) * Math.PI * 2,
      radius: 15 + hashNoise(i, 3.7) * 26,
      y: 1.5 + hashNoise(i, 5.1) * 1.5,
      speed: 6 + hashNoise(i, 7.9) * 8, // 弧度/千秒级，极缓慢漂移
      phase: hashNoise(i, 9.7) * Math.PI * 2,
      baseOpacity: 0.2 + hashNoise(i, 11.3) * 0.16,
    })
    scene.add(sprite)
  }

  // ================================================================ 高山植被（InstancedMesh）
  const TREE_COUNT = 170
  const treeGeometry = new THREE.ConeGeometry(0.5, 1.25, 6)
  const treeMaterial = new THREE.MeshStandardMaterial({ color: 0x2e4a2e, roughness: 1, flatShading: true })
  const trees = new THREE.InstancedMesh(treeGeometry, treeMaterial, TREE_COUNT)
  trees.name = "vegetation_belt"
  {
    const matrix = new THREE.Matrix4()
    const pos = new THREE.Vector3()
    const quat = new THREE.Quaternion()
    const scl = new THREE.Vector3()
    for (let i = 0; i < TREE_COUNT; i += 1) {
      const angle = hashNoise(i, 7.3) * Math.PI * 2
      const frac = 0.04 + hashNoise(i, 3.1) * 0.36
      const y = frac * SUMMIT_Y
      const r = radiusAtHeight(y) + 0.12
      const s = 0.5 + hashNoise(i, 11.7) * 0.55
      pos.set(Math.cos(angle) * r, y + 0.4 * s, Math.sin(angle) * r)
      quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), hashNoise(i, 5.5) * Math.PI)
      scl.setScalar(s)
      matrix.compose(pos, quat, scl)
      trees.setMatrixAt(i, matrix)
    }
    trees.instanceMatrix.needsUpdate = true
  }
  scene.add(trees)

  // ================================================================ 路线（发光虚线）
  function buildTrailLine(points: THREE.Vector3[], color: number): { line: THREE.Line; material: THREE.LineDashedMaterial } {
    const curve = new THREE.CatmullRomCurve3(points)
    const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(140))
    const material = new THREE.LineDashedMaterial({
      color,
      dashSize: 0.42,
      gapSize: 0.26,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    })
    const line = new THREE.Line(geometry, material)
    line.computeLineDistances()
    return { line, material }
  }

  // 登山主路线：螺旋上攀至火山口
  const mainTrailPoints: THREE.Vector3[] = []
  for (let i = 0; i <= 13; i += 1) {
    const frac = i / 13
    const y = 0.15 + frac * 6.95
    const angle = 2.5 - frac * 3.7
    const r = radiusAtHeight(y) + 0.22
    mainTrailPoints.push(new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r))
  }
  const mainTrail = buildTrailLine(mainTrailPoints, 0xffb35c)
  mainTrail.line.name = "trail_main_line"
  scene.add(mainTrail.line)
  const mainTrailMid = new THREE.CatmullRomCurve3(mainTrailPoints).getPoint(0.55)

  // 亲子短线：山麓平缓环线
  const familyTrailPoints: THREE.Vector3[] = []
  const familyCenter = new THREE.Vector3(6.2, 0.35, 7.4)
  for (let i = 0; i <= 40; i += 1) {
    const a = (i / 40) * Math.PI * 2
    familyTrailPoints.push(new THREE.Vector3(
      familyCenter.x + Math.cos(a) * 3.1,
      0.32 + Math.sin(a * 2) * 0.08,
      familyCenter.z + Math.sin(a) * 2.1,
    ))
  }
  const familyTrail = buildTrailLine(familyTrailPoints, 0x7dd87d)
  familyTrail.line.name = "trail_family_line"
  scene.add(familyTrail.line)

  // ================================================================ 五合目小屋群组
  const stationGroup = new THREE.Group()
  stationGroup.name = "station_5th_huts"
  const hutBodyMat = new THREE.MeshStandardMaterial({ color: 0x4a3828, roughness: 0.9, flatShading: true })
  const hutRoofMat = new THREE.MeshStandardMaterial({ color: 0x33404e, roughness: 0.8, flatShading: true })
  const hutWindowMat = new THREE.MeshBasicMaterial({ color: 0xffd28e, transparent: true, opacity: 0.85 })
  function addHut(dx: number, dz: number, w: number, h: number, d: number): void {
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), hutBodyMat)
    body.position.set(dx, h / 2, dz)
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.72, h * 0.55, 4), hutRoofMat)
    roof.position.set(dx, h + h * 0.26, dz)
    roof.rotation.y = Math.PI / 4
    const windowPane = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.34, h * 0.32), hutWindowMat)
    windowPane.position.set(dx, h * 0.55, dz + d / 2 + 0.01)
    stationGroup.add(body, roof, windowPane)
  }
  addHut(0, 0, 0.55, 0.4, 0.45)
  addHut(0.62, -0.2, 0.4, 0.3, 0.36)
  addHut(-0.55, 0.25, 0.34, 0.26, 0.3)
  {
    const stationAnchor = new THREE.CatmullRomCurve3(mainTrailPoints).getPoint(0.52)
    const outward = new THREE.Vector3(stationAnchor.x, 0, stationAnchor.z).normalize()
    stationGroup.position.copy(stationAnchor).addScaledVector(outward, 0.55)
    stationGroup.position.y += 0.05
    stationGroup.lookAt(stationGroup.position.clone().add(outward))
  }
  scene.add(stationGroup)

  // ================================================================ 观景点平台 + 设施小柱
  function addViewpointPlatform(x: number, y: number, z: number): { group: THREE.Group; ringMat: THREE.MeshBasicMaterial } {
    const group = new THREE.Group()
    const deck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.65, 0.72, 0.1, 12),
      new THREE.MeshStandardMaterial({ color: 0x5a5348, roughness: 0.9, flatShading: true }),
    )
    deck.position.y = 0.05
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x8fd6ff, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false })
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.72, 0.82, 32), ringMat)
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.12
    group.add(deck, ring)
    group.position.set(x, y, z)
    scene.add(group)
    return { group, ringMat }
  }
  const viewpointA = addViewpointPlatform(-7.5, 1.35, 9.5)
  const viewpointB = addViewpointPlatform(8.2, 1.05, 7.8)

  // 设施小图标柱（厕所/休息站）：audience 时增亮
  const facilityMaterial = new THREE.MeshBasicMaterial({ color: 0xa8e6c8, transparent: true, opacity: 0.6, depthWrite: false })
  const facilityPosts: THREE.Mesh[] = []
  function addFacilityPost(x: number, y: number, z: number, name: string): void {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.7, 6), facilityMaterial)
    post.name = name
    post.position.set(x, y + 0.35, z)
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 0.05), facilityMaterial)
    cap.position.set(x, y + 0.78, z)
    post.add(cap)
    cap.position.set(0, 0.43, 0)
    scene.add(post)
    facilityPosts.push(post)
  }
  addFacilityPost(2.6, 0.1, 10.9, "facility_rest_a")
  addFacilityPost(-6.8, 1.3, 9.0, "facility_rest_b")

  // ================================================================ 风险坡面 + 落石粒子
  const riskSlopeMaterial = new THREE.MeshBasicMaterial({
    color: 0xe05545,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const riskSlope = new THREE.Mesh(
    new THREE.LatheGeometry(lathePoints, 24, -0.5, 1.15),
    riskSlopeMaterial,
  )
  riskSlope.name = "risk_slope_overlay"
  riskSlope.scale.set(1.018, 1.004, 1.018)
  scene.add(riskSlope)

  const ROCKFALL_COUNT = 30
  const rockfallPositions = new Float32Array(ROCKFALL_COUNT * 3)
  const rockfallProgress = new Float32Array(ROCKFALL_COUNT)
  const rockfallAzimuth = new Float32Array(ROCKFALL_COUNT)
  const rockfallSpeed = new Float32Array(ROCKFALL_COUNT)
  for (let i = 0; i < ROCKFALL_COUNT; i += 1) {
    rockfallProgress[i] = hashNoise(i, 1.3)
    rockfallAzimuth[i] = -0.5 + hashNoise(i, 2.9) * 1.15
    rockfallSpeed[i] = 0.28 + hashNoise(i, 4.1) * 0.3
  }
  const rockfallGeometry = new THREE.BufferGeometry()
  rockfallGeometry.setAttribute("position", new THREE.BufferAttribute(rockfallPositions, 3))
  const rockfallMaterial = new THREE.PointsMaterial({ color: 0xb09a80, size: 0.18, transparent: true, opacity: 0.9, depthWrite: false })
  const rockfallPoints = new THREE.Points(rockfallGeometry, rockfallMaterial)
  rockfallPoints.name = "rockfall_particles"
  rockfallPoints.visible = false
  scene.add(rockfallPoints)

  // ================================================================ 契约语义节点 + 标记柱
  const nodes = new Map<string, THREE.Object3D>()
  function node(name: string, x: number, y: number, z: number, markerScale = 1): THREE.Object3D {
    const n = createNamedNode(scene, name, x, y, z)
    nodes.set(name, n)
    session.markers.addMarker(name, new THREE.Vector3(x, y, z), { scale: markerScale })
    return n
  }
  node("peak", 0, SUMMIT_Y + 0.35, 0, 1.15)
  node("crater", 0, 7.2, 1.05, 0.9)
  node("trail_main", mainTrailMid.x, mainTrailMid.y + 0.3, mainTrailMid.z, 0.9)
  node("trail_family", familyCenter.x, 0.6, familyCenter.z + 2.1, 0.9)
  node("viewpoint_a", -7.5, 1.55, 9.5, 0.95)
  node("viewpoint_b", 8.2, 1.25, 7.8, 0.95)
  node("station_5th", stationGroup.position.x, stationGroup.position.y + 0.55, stationGroup.position.z, 0.9)
  node("vegetation_alpine", -5.6, 1.7, 6.4, 0.9)
  node("risk_slope", 4.9, 3.5, 4.6, 1.0)
  const snowLineNode = node("snow_line", 0, 4.4, 0, 0.85)

  function placeSnowLineNode(snowY: number): void {
    const r = radiusAtHeight(snowY) + 0.15
    snowLineNode.position.set(r * 0.72, snowY + 0.18, r * 0.72)
    session.markers.moveMarker("snow_line", snowLineNode.position)
  }

  // ================================================================ 高亮系统
  function makeTrailTarget(material: THREE.LineDashedMaterial, activeColor: number, defaultColor: number): HighlightTarget {
    return {
      set(state) {
        if (state === "active") {
          material.color.set(activeColor)
          material.opacity = 1
        } else if (state === "dim") {
          material.color.set(defaultColor)
          material.opacity = 0.22
        } else if (state === "hidden") {
          material.color.set(defaultColor)
          material.opacity = 0.07
        } else {
          material.color.set(defaultColor)
          material.opacity = 0.85
        }
      },
    }
  }
  function makePlatformTarget(platform: { ringMat: THREE.MeshBasicMaterial }): HighlightTarget {
    return {
      set(state) {
        platform.ringMat.opacity = state === "active" ? 0.95 : state === "dim" ? 0.18 : state === "hidden" ? 0.06 : 0.5
        platform.ringMat.color.set(state === "active" ? 0xffd28e : 0x8fd6ff)
      },
    }
  }
  const highlightables = new Map<string, HighlightTarget>([
    ["trail_main", makeTrailTarget(mainTrail.material, 0xffd28e, 0xffb35c)],
    ["trail_family", makeTrailTarget(familyTrail.material, 0xc8f0a0, 0x7dd87d)],
    ["viewpoint_a", makePlatformTarget(viewpointA)],
    ["viewpoint_b", makePlatformTarget(viewpointB)],
  ])
  const activityHighlight = new Map<string, "active" | "dim">()
  const audienceHidden = new Set<string>()

  function refreshHighlights(): void {
    for (const [name, target] of highlightables) {
      const base = activityHighlight.get(name) ?? "default"
      target.set(audienceHidden.has(name) ? "hidden" : base)
    }
  }

  function setFacilityEmphasis(on: boolean): void {
    facilityMaterial.opacity = on ? 1 : 0.6
    facilityMaterial.color.set(on ? 0xd8ffd0 : 0xa8e6c8)
    hutWindowMat.opacity = on ? 1 : 0.85
    for (const post of facilityPosts) post.scale.setScalar(on ? 1.25 : 1)
  }

  // ================================================================ 视觉状态（preset × risk 合成）
  let lastPreset: ScenePreset | null = null
  let lightT = DEFAULT_LIGHT_T
  let snowStartFrac = 0.55
  let paintedSnowStart = -1
  const vegColor = VEG_DEFAULT.clone()
  let paintedVeg = ""
  let mist = 0.45
  let cloudCover = 0.45
  const effects = { storm: 0, lightning: 0, rockfall: 0, slopeAlert: 0 }
  let lightningFlash = 0
  let sunBaseIntensity = 2.4

  const STORM_TOP = new THREE.Color(0x0a0d14)
  const STORM_HORIZON = new THREE.Color(0x232a36)

  function applyVisualState(): void {
    const sky = sampleSkyStops(lightT)
    sky.top.lerp(STORM_TOP, effects.storm * 0.85)
    sky.horizon.lerp(STORM_HORIZON, effects.storm * 0.85)
    skyUniforms.topColor.value.copy(sky.top)
    skyUniforms.horizonColor.value.copy(sky.horizon)
    // V1.2：穹顶半透明透出实景照片背景；雷暴时压回不透明以卖出风暴氛围
    skyUniforms.alpha.value = 0.34 + effects.storm * 0.55
    if (scene.fog instanceof THREE.Fog) scene.fog.color.copy(sky.horizon)

    const az = Math.PI * (1 - lightT)
    sun.position.set(Math.cos(az) * 28, 5 + Math.sin(Math.PI * lightT) * 24, 14)
    sun.color.copy(sky.sun).lerp(new THREE.Color(0x5a6a80), effects.storm * 0.7)
    sunBaseIntensity = sky.sunIntensity * (1 - effects.storm * 0.65)
    sun.intensity = sunBaseIntensity
    ambient.intensity = 0.65 * (1 - effects.storm * 0.4)
    // 轮廓补光：雷暴时收敛，颜色轻微跟随天际线
    rim.intensity = 0.5 * (1 - effects.storm * 0.55)
    rim.color.set(0x9fc8e8).lerp(sky.horizon, 0.3)

    // 远山剪影随雾色/天际线调色（外圈更贴近雾色，纵深更强）
    for (let i = 0; i < ridgeMaterials.length; i += 1) {
      ridgeMaterials[i].color.copy(RIDGE_BASE_COLORS[i]).lerp(sky.horizon, 0.3 + i * 0.22)
    }

    // 雪线（变化才重算顶点色，避免每帧重建）
    if (Math.abs(snowStartFrac - paintedSnowStart) > 0.002 || paintedVeg !== vegColor.getHexString()) {
      paintMountain(vegColor, snowStartFrac)
      paintedSnowStart = snowStartFrac
      paintedVeg = vegColor.getHexString()
      const snowY = snowStartFrac * SUMMIT_Y
      snowLineRing.geometry.dispose()
      snowLineRing.geometry = buildSnowLineGeometry(snowY)
      placeSnowLineNode(snowY)
      seedSparkles(snowStartFrac)
    }
    treeMaterial.color.copy(vegColor).multiplyScalar(0.75)

    // 云海密度（cloudCover preset；雷暴时云海额外增厚；双层大圆盘保持低存在感）
    const cloudFactor = 0.25 + cloudCover * 1.05 + effects.storm * 0.35
    cloudMaterialA.opacity = 0.12 * cloudFactor
    cloudMaterialB.opacity = 0.07 * cloudFactor
    cloudMaterialA.color.set(0xcfd9e2).lerp(new THREE.Color(0x5a6470), effects.storm * 0.7)
    cloudMaterialB.color.set(0xc4d0dc).lerp(new THREE.Color(0x4c5560), effects.storm * 0.7)
    // 柔光云团：quality=low 整层关闭；雷暴时染灰
    const cloudSpritesOn = session.quality !== "low"
    for (const cloud of cloudSprites) {
      cloud.sprite.visible = cloudSpritesOn
      cloud.material.color.set(0xdfe8f0).lerp(new THREE.Color(0x5a6470), effects.storm * 0.7)
    }
    // 雪顶闪光：quality=low 关闭；雷暴压暗时熄灭
    snowSparkles.visible = session.quality !== "low" && effects.storm < 0.6

    // 风险坡面泛红 + 落石
    riskSlopeMaterial.opacity = effects.slopeAlert * 0.34
    rockfallPoints.visible = effects.rockfall > 0.02 && session.quality !== "low"
    rockfallMaterial.opacity = clamp01(effects.rockfall) * 0.9
  }

  // ================================================================ SceneHandle.apply*
  function applyPreset(preset: ScenePreset | null): void {
    lastPreset = preset
    const visual = preset?.visual
    // snowLine 双模量纲：≤1 视为 0..1 比例；>1 视为海拔米数（富士山按 3800m 归一）
    // snow（积雪覆盖度）反向换算兜底
    const snowLineValue = visualNumber(visual, "snowLine", Number.NaN)
    const snowT = Number.isFinite(snowLineValue)
      ? normalizeUnitInterval(snowLineValue, 3800)
      : 1 - clamp01(visualNumber(visual, "snow", 0.55))
    snowStartFrac = lerp(0.28, 0.95, snowT)
    // 红叶/季节 → 植被色
    const leaf = visualColor(visual, "leafColor")
    const season = visualText(visual, "season")
    if (leaf) vegColor.copy(leaf)
    else if (season && matchesAnyKeyword(season, ["autumn", "fall", "秋", "红叶"])) vegColor.set(0x8a4a2c)
    else if (season && matchesAnyKeyword(season, ["winter", "冬"])) vegColor.set(0x4a5548)
    else if (season && matchesAnyKeyword(season, ["spring", "春"])) vegColor.set(0x4d7a45)
    else vegColor.copy(VEG_DEFAULT)
    // 光照时刻
    const lightText = visualText(visual, "light")
    if (lightText) {
      const mapped = Object.entries(LIGHT_TEXT_MAP).find(([key]) => lightText.toLowerCase().includes(key))
      lightT = mapped ? mapped[1] : DEFAULT_LIGHT_T
    } else {
      lightT = clamp01(visualNumber(visual, "lightT", visualNumber(visual, "daylight", DEFAULT_LIGHT_T)))
    }
    // 薄雾（mist 优先，hazeDensity 兜底）；云海密度（cloudCover 优先）
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
      // 不允许的玩法 → 对应路线/点位降透明度
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
    // 当前步的 sceneActions（DATA 每步完整重述天气状态，含减弱收尾步，故不累计取 max）
    const step = risk.sequence[Math.min(Math.max(stepIndex, 0), risk.sequence.length - 1)]
    for (const action of step?.sceneActions ?? []) {
      const params = action.params
      if (action.kind === "set_weather") {
        // DATA 约定：thunderstorm / wind / cloudCover / rain / fog（0..1 或 boolean）
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
        // DATA 约定：落石步骤用 dust 参数表示扬尘碎屑
        rockfall = Math.max(rockfall, visualNumber(params, "dust", 0))
        if (visualFlag(params, "rockfall")) rockfall = Math.max(rockfall, visualNumber(params, "intensity", 1))
      }
      if (action.kind === "highlight_anchor") {
        if (resolveActionTargetNodeNames(action.target, sceneDef.anchors).includes("risk_slope")) slope = 1
      }
      if (action.kind === "spawn_group" && matchesAnyKeyword(action.target ?? "", ROCKFALL_KEYWORDS)) rockfall = 1
    }
    // 关键词兜底（雷暴 / 落石），随步进增强
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

  // 主题机位
  const THEME_CAMERAS: Partial<Record<ImmersiveTheme, CameraPreset>> = {
    highlights: { position: [13, 6.5, 24], lookAt: [0, 3.2, 0], fov: 42 },
    experience: { position: [6.5, 2.6, 15.5], lookAt: [-1.5, 3.8, 2.5] },
    audience: { position: [2.5, 1.9, 13.5], lookAt: [1.5, 0.8, 6] },
    cautions: { position: [11, 4.5, 13], lookAt: [4.9, 3.4, 4.6] },
    nature_geology: { position: [3.5, 8.8, 8.5], lookAt: [0, 7, 0.4], fov: 38 },
  }

  // ================================================================ 每帧动画
  session.setUpdater((time, delta) => {
    // 云海缓动
    cloudSeaA.rotation.z = time * 0.00004
    cloudSeaB.rotation.z = -time * 0.00003
    // 柔光云团：绕山漂移 + 透明度脉动（密度随 cloudCover）
    const cloudDensity = 0.4 + cloudCover * 0.9
    for (const cloud of cloudSprites) {
      if (!cloud.sprite.visible) continue
      const angle = cloud.baseAngle + time * 0.0001 * cloud.speed
      cloud.sprite.position.set(
        Math.cos(angle) * cloud.radius,
        cloud.y + Math.sin(time * 0.0004 + cloud.phase) * 0.25,
        Math.sin(angle) * cloud.radius,
      )
      cloud.material.opacity = cloud.baseOpacity * cloudDensity * (0.72 + 0.28 * Math.sin(time * 0.0006 + cloud.phase))
    }
    // 雪顶闪光：整体透明度正弦脉动（PointsMaterial 级，零逐点开销）
    if (snowSparkles.visible) {
      sparkleMaterial.opacity = 0.32 + 0.32 * Math.sin(time * 0.0022)
      sparkleMaterial.size = 0.12 + 0.03 * Math.sin(time * 0.0017 + 1.3)
    }
    // 闪电闪光（reducedMotion 时 updater 仅在静态帧运行，random 闪烁自然停用）
    if (effects.lightning > 0 && Math.random() < 0.03) lightningFlash = 0.95
    lightningFlash *= Math.pow(0.0018, delta) // 快速衰减
    skyUniforms.flash.value = lightningFlash * 0.75
    sun.intensity = sunBaseIntensity + lightningFlash * 2.4
    // 落石粒子沿坡面滚落
    if (rockfallPoints.visible) {
      for (let i = 0; i < ROCKFALL_COUNT; i += 1) {
        rockfallProgress[i] += delta * rockfallSpeed[i] * (0.5 + effects.rockfall)
        if (rockfallProgress[i] > 1) {
          rockfallProgress[i] = 0
          rockfallAzimuth[i] = -0.5 + hashNoise(i, time * 0.001) * 1.15
        }
        const y = lerp(5.8, 0.5, rockfallProgress[i])
        const r = radiusAtHeight(y) + 0.28
        rockfallPositions[i * 3] = Math.cos(rockfallAzimuth[i]) * r
        rockfallPositions[i * 3 + 1] = y
        rockfallPositions[i * 3 + 2] = Math.sin(rockfallAzimuth[i]) * r
      }
      ;(rockfallGeometry.attributes.position as THREE.BufferAttribute).needsUpdate = true
    }
  })

  // quality=low 关粒子
  session.onQualityChange(() => applyVisualState())

  // ================================================================ 初始渲染
  applyVisualState()
  session.requestRender() // mount 即完成首帧

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
