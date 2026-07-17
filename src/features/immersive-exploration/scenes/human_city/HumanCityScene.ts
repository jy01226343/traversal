/**
 * 人文城市场景 · 都市天际线（东京风格，SCENES 拥有）
 *
 * 视觉元素（全部程序化，无外链资产）：
 * - 程序化楼群（InstancedMesh 盒子 + 程序化窗灯 emissive 纹理，夜景 emissive 增强）
 * - 地标塔（分段收分塔身 + 环状观景台 + 天线，accent 自发光缓慢变色）
 * - 街道灯河（发光网格线 + 双向车流光点：去程白 / 回程红）
 * - 滨河步道（反光河面条带 + 步道虚线）、老街街区（低矮盒子群 + 暖灯笼点）
 * - 日夜随 preset（light 文案/dusk/night）：窗灯/街灯/天空/雾色联动，夜景 bloom 友好
 * - 风险：暴雨（雨幕粒子 + 天空压暗 + 路面反光增强）、拥挤（人群粒子 + 警示琥珀色）
 * - 后处理 bloom（standard/high），reducedMotion 直渲一帧
 *
 * preset.visual 解释：light / night / rain / crowd / illumination
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
  createNamedNode,
  hashNoise,
  lerp,
  matchesAnyKeyword,
  nodeNamesFromRef,
  visualFlag,
  visualNumber,
  visualText,
} from "../shared"

/** 契约语义节点名握手（CONTRACT.md §SCENES） */
export const HUMAN_CITY_NODE_NAMES = [
  "landmark_tower",
  "skyline_cluster",
  "river_promenade",
  "night_view_deck",
  "street_market",
  "viewpoint_a",
  "historic_block",
  "risk_crowd_zone",
] as const

const TOWER_KEYWORDS = ["塔", "tower", "skytree", "晴空塔", "地标", "展望"] as const
const NIGHT_KEYWORDS = ["夜景", "night", "点灯", "灯光", "illumination"] as const
const MARKET_KEYWORDS = ["市集", "market", "商店街", "美食", "老街", "街区"] as const
const RAIN_KEYWORDS = ["雨", "rain", "暴雨", "台風", "台风", "storm"] as const
const CROWD_KEYWORDS = ["拥挤", "crowd", "人流", "拥堵", "排队"] as const

type HighlightState = "active" | "dim" | "hidden" | "default"
interface HighlightTarget {
  set(state: HighlightState): void
}

/** 程序化窗灯纹理（运行期 canvas，禁止模块顶层调用——本函数在场景工厂内调用） */
function createWindowLightTexture(cols = 6, rows = 10, litRatio = 0.42): THREE.CanvasTexture {
  const canvas = document.createElement("canvas")
  canvas.width = 64
  canvas.height = 96
  const ctx = canvas.getContext("2d")!
  ctx.fillStyle = "#000000"
  ctx.fillRect(0, 0, 64, 96)
  const w = 64 / cols
  const h = 96 / rows
  for (let cx = 0; cx < cols; cx += 1) {
    for (let cy = 0; cy < rows; cy += 1) {
      const lit = hashNoise(cx * 3.1, cy * 7.7) < litRatio
      if (!lit) continue
      const warm = hashNoise(cx * 5.3, cy * 9.9)
      ctx.fillStyle = warm > 0.6 ? "#ffd28e" : warm > 0.25 ? "#cfe4ff" : "#fff2c8"
      ctx.globalAlpha = 0.55 + hashNoise(cx * 11.7, cy * 13.1) * 0.45
      ctx.fillRect(cx * w + w * 0.22, cy * h + h * 0.24, w * 0.56, h * 0.5)
    }
  }
  ctx.globalAlpha = 1
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export function createHumanCityScene(canvas: HTMLCanvasElement, sceneDef: ImmersiveSceneDefinition): SceneHandle {
  const session = new SceneSession({
    canvas,
    sceneDef,
    controls: { minDistance: 6, maxDistance: 70, maxPolarAngle: Math.PI * 0.56 },
    bloom: { strength: 0.38, radius: 0.5, threshold: 0.62 },
  })
  const { scene } = session

  // ================================================================ 天空穹顶 + 雾 + 灯光
  const skyUniforms = {
    topColor: { value: new THREE.Color(0x0a1020) },
    horizonColor: { value: new THREE.Color(0x2a3248) },
    flash: { value: 0 },
    alpha: { value: 0.34 },
  }
  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(170, 32, 18),
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
  scene.fog = new THREE.Fog(0x2a3248, 65, 180)

  const ambient = new THREE.AmbientLight(0x2a3040, 0.75)
  const sun = new THREE.DirectionalLight(0xffe8c2, 1.6)
  sun.position.set(-20, 22, 12)
  const cityGlow = new THREE.PointLight(0xffc878, 0, 60, 1.6)
  cityGlow.position.set(0, 6, 0)
  scene.add(ambient, sun, cityGlow)

  // ================================================================ 地面（暗色基座 + 路网凹槽）
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(150, 150),
    new THREE.MeshStandardMaterial({ color: 0x14181f, roughness: 0.95, metalness: 0.05 }),
  )
  ground.name = "city_ground"
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -0.02
  scene.add(ground)

  // ================================================================ 街道灯河（发光网格线）
  const streetGroup = new THREE.Group()
  streetGroup.name = "street_light_grid"
  const streetMaterial = new THREE.LineBasicMaterial({ color: 0xffc878, transparent: true, opacity: 0.4 })
  const streetPoints: THREE.Vector3[] = []
  const STREET_MIN = -26
  const STREET_MAX = 26
  const STREET_STEP = 6.5
  for (let x = STREET_MIN; x <= STREET_MAX; x += STREET_STEP) {
    streetPoints.push(new THREE.Vector3(x, 0.06, STREET_MIN), new THREE.Vector3(x, 0.06, STREET_MAX))
  }
  for (let z = STREET_MIN; z <= STREET_MAX; z += STREET_STEP) {
    streetPoints.push(new THREE.Vector3(STREET_MIN, 0.06, z), new THREE.Vector3(STREET_MAX, 0.06, z))
  }
  const streetLines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(streetPoints), streetMaterial)
  streetGroup.add(streetLines)
  scene.add(streetGroup)

  // 车流光点（沿街道双向：去程暖白 / 回程红）
  const CAR_COUNT = 90
  const carPositions = new Float32Array(CAR_COUNT * 3)
  const carColors = new Float32Array(CAR_COUNT * 3)
  const carSeeds: Array<{ axis: "x" | "z"; lane: number; u: number; speed: number; dir: 1 | -1 }> = []
  for (let i = 0; i < CAR_COUNT; i += 1) {
    const laneIndex = Math.floor(hashNoise(i, 3.3) * 8)
    const lane = STREET_MIN + laneIndex * STREET_STEP + (hashNoise(i, 4.4) > 0.5 ? 0.35 : -0.35)
    const dir = hashNoise(i, 5.5) > 0.5 ? 1 : -1
    carSeeds.push({
      axis: hashNoise(i, 2.2) > 0.5 ? "x" : "z",
      lane,
      u: hashNoise(i, 6.6),
      speed: 0.5 + hashNoise(i, 7.7) * 0.8,
      dir,
    })
    const c = dir === 1 ? [1.0, 0.9, 0.7] : [1.0, 0.25, 0.15]
    carColors[i * 3] = c[0]
    carColors[i * 3 + 1] = c[1]
    carColors[i * 3 + 2] = c[2]
  }
  const carGeometry = new THREE.BufferGeometry()
  carGeometry.setAttribute("position", new THREE.BufferAttribute(carPositions, 3))
  carGeometry.setAttribute("color", new THREE.BufferAttribute(carColors, 3))
  const carMaterial = new THREE.PointsMaterial({
    size: 0.22,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const carLights = new THREE.Points(carGeometry, carMaterial)
  carLights.name = "traffic_lights"
  scene.add(carLights)

  // ================================================================ 程序化楼群（InstancedMesh + 窗灯 emissive）
  const windowTexture = createWindowLightTexture()
  const BUILDING_COUNT = 170
  const buildingGeometry = new THREE.BoxGeometry(1, 1, 1)
  buildingGeometry.translate(0, 0.5, 0) // 底部对齐地面
  const buildingMaterial = new THREE.MeshStandardMaterial({
    color: 0x2a3340,
    roughness: 0.85,
    metalness: 0.15,
    emissive: 0xffffff,
    emissiveMap: windowTexture,
    emissiveIntensity: 0.9,
  })
  const buildings = new THREE.InstancedMesh(buildingGeometry, buildingMaterial, BUILDING_COUNT)
  buildings.name = "skyline_buildings"
  {
    const matrix = new THREE.Matrix4()
    const pos = new THREE.Vector3()
    const quat = new THREE.Quaternion()
    const scl = new THREE.Vector3()
    const tint = new THREE.Color()
    let placed = 0
    for (let i = 0; placed < BUILDING_COUNT; i += 1) {
      const gx = STREET_MIN + 3.2 + Math.floor(hashNoise(i, 1.1) * 8) * STREET_STEP + (hashNoise(i, 2.2) - 0.5) * 3.4
      const gz = STREET_MIN + 3.2 + Math.floor(hashNoise(i, 3.3) * 8) * STREET_STEP + (hashNoise(i, 4.4) - 0.5) * 3.4
      // 地标塔广场、滨河带（z>10 的前场）、老街街区留空
      if (Math.hypot(gx, gz) < 4.5) continue
      if (gz > 10) continue
      if (gx < -14 && gz > 2) continue
      const centerBoost = 1 - clamp01(Math.hypot(gx, gz) / 34)
      const h = 1.2 + hashNoise(i, 5.5) * 3.2 + centerBoost * centerBoost * hashNoise(i, 6.6) * 9
      const w = 1.1 + hashNoise(i, 7.7) * 1.6
      const d = 1.1 + hashNoise(i, 8.8) * 1.6
      pos.set(gx, 0, gz)
      quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.floor(hashNoise(i, 9.9) * 4) * (Math.PI / 2))
      scl.set(w, h, d)
      matrix.compose(pos, quat, scl)
      buildings.setMatrixAt(placed, matrix)
      tint.setHSL(0.6 + hashNoise(i, 12.1) * 0.08, 0.18, 0.32 + hashNoise(i, 13.3) * 0.18)
      buildings.setColorAt(placed, tint)
      placed += 1
    }
    buildings.instanceMatrix.needsUpdate = true
    if (buildings.instanceColor) buildings.instanceColor.needsUpdate = true
  }
  scene.add(buildings)

  // ================================================================ 地标塔（晴空塔风格收分塔身）
  const towerGroup = new THREE.Group()
  towerGroup.name = "landmark_tower_structure"
  const towerMaterial = new THREE.MeshStandardMaterial({ color: 0xb8c4d0, roughness: 0.5, metalness: 0.5 })
  const towerAccentMaterial = new THREE.MeshBasicMaterial({ color: 0x8fd6ff, transparent: true, opacity: 0.9 })
  {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.9, 1.2, 8), towerMaterial)
    base.position.y = 0.6
    const shaft1 = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 1.15, 5.2, 8), towerMaterial)
    shaft1.position.y = 3.8
    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.09, 8, 24), towerAccentMaterial)
    ring1.rotation.x = Math.PI / 2
    ring1.position.y = 6.6
    const shaft2 = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.55, 3.2, 8), towerMaterial)
    shaft2.position.y = 7.9
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.07, 8, 24), towerAccentMaterial)
    ring2.rotation.x = Math.PI / 2
    ring2.position.y = 9.6
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.1, 2.6, 6), towerMaterial)
    antenna.position.y = 10.8
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), towerAccentMaterial)
    beacon.position.y = 12.1
    towerGroup.add(base, shaft1, ring1, shaft2, ring2, antenna, beacon)
  }
  scene.add(towerGroup)

  // ================================================================ 滨河带（反光河面 + 步道虚线）
  const riverMaterial = new THREE.MeshPhongMaterial({
    color: 0x16222e,
    specular: 0x9fc8e8,
    shininess: 120,
    transparent: true,
    opacity: 0.94,
  })
  const river = new THREE.Mesh(new THREE.PlaneGeometry(64, 7), riverMaterial)
  river.name = "river_band"
  river.rotation.x = -Math.PI / 2
  river.position.set(0, 0.04, 14.5)
  scene.add(river)
  const promenadePoints: THREE.Vector3[] = []
  for (let i = 0; i <= 64; i += 1) {
    const x = -32 + (i / 64) * 64
    promenadePoints.push(new THREE.Vector3(x, 0.12, 10.6 + Math.sin(x * 0.2) * 0.4))
  }
  const promenadeMaterial = new THREE.LineDashedMaterial({
    color: 0x8fd6ff,
    dashSize: 0.5,
    gapSize: 0.3,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
  })
  const promenade = new THREE.Line(new THREE.BufferGeometry().setFromPoints(promenadePoints), promenadeMaterial)
  promenade.name = "river_promenade_line"
  promenade.computeLineDistances()
  scene.add(promenade)

  // ================================================================ 老街街区（低矮盒子群 + 暖灯笼点）
  const oldTownGroup = new THREE.Group()
  oldTownGroup.name = "historic_block_houses"
  const oldTownMaterial = new THREE.MeshStandardMaterial({ color: 0x3a2e22, roughness: 0.95, flatShading: true })
  const lanternMaterial = new THREE.MeshBasicMaterial({ color: 0xffb35c, transparent: true, opacity: 0.85 })
  for (let i = 0; i < 14; i += 1) {
    const w = 0.9 + hashNoise(i, 3.3) * 0.8
    const h = 0.7 + hashNoise(i, 5.7) * 0.9
    const d = 0.9 + hashNoise(i, 7.9) * 0.6
    const x = -22 + hashNoise(i, 9.1) * 7
    const z = 3 + hashNoise(i, 11.3) * 6
    const house = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), oldTownMaterial)
    house.position.set(x, h / 2, z)
    oldTownGroup.add(house)
    if (hashNoise(i, 13.5) > 0.35) {
      const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), lanternMaterial)
      lantern.position.set(x + w * 0.4, h * 0.7, z + d / 2 + 0.08)
      oldTownGroup.add(lantern)
    }
  }
  scene.add(oldTownGroup)

  // ================================================================ 市集强调环 + 人群粒子（拥挤 risk）
  function makeZoneRing(x: number, z: number, radius: number, y = 0.14): { mesh: THREE.Mesh; material: THREE.MeshBasicMaterial } {
    const material = new THREE.MeshBasicMaterial({ color: 0x8fd6ff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })
    const mesh = new THREE.Mesh(new THREE.RingGeometry(radius - 0.14, radius, 40), material)
    mesh.rotation.x = -Math.PI / 2
    mesh.position.set(x, y, z)
    scene.add(mesh)
    return { mesh, material }
  }
  const towerRing = makeZoneRing(0, 0, 3.2)
  const marketRing = makeZoneRing(-18.5, 6, 4.6)

  const CROWD_COUNT = 120
  const crowdPositions = new Float32Array(CROWD_COUNT * 3)
  const crowdSeeds: Array<{ cx: number; cz: number; r: number; speed: number; phase: number }> = []
  for (let i = 0; i < CROWD_COUNT; i += 1) {
    crowdSeeds.push({
      cx: -18.5 + (hashNoise(i, 1.7) - 0.5) * 6,
      cz: 6 + (hashNoise(i, 3.1) - 0.5) * 5,
      r: 0.3 + hashNoise(i, 5.3) * 1.4,
      speed: 0.3 + hashNoise(i, 7.7) * 0.7,
      phase: hashNoise(i, 9.9) * Math.PI * 2,
    })
  }
  const crowdGeometry = new THREE.BufferGeometry()
  crowdGeometry.setAttribute("position", new THREE.BufferAttribute(crowdPositions, 3))
  const crowdMaterial = new THREE.PointsMaterial({ color: 0xe8b34a, size: 0.16, transparent: true, opacity: 0, depthWrite: false })
  const crowd = new THREE.Points(crowdGeometry, crowdMaterial)
  crowd.name = "crowd_particles"
  crowd.visible = false
  scene.add(crowd)

  // ================================================================ 雨幕粒子（暴雨 risk）
  const RAIN_COUNT = 420
  const rainPositions = new Float32Array(RAIN_COUNT * 3)
  const rainSeeds = new Float32Array(RAIN_COUNT * 3)
  for (let i = 0; i < RAIN_COUNT; i += 1) {
    rainSeeds[i * 3] = -32 + hashNoise(i, 1.1) * 64
    rainSeeds[i * 3 + 1] = hashNoise(i, 2.3) * 22
    rainSeeds[i * 3 + 2] = -30 + hashNoise(i, 3.5) * 52
  }
  const rainGeometry = new THREE.BufferGeometry()
  rainGeometry.setAttribute("position", new THREE.BufferAttribute(rainPositions, 3))
  const rainMaterial = new THREE.PointsMaterial({ color: 0x9fb8d8, size: 0.09, transparent: true, opacity: 0, depthWrite: false })
  const rain = new THREE.Points(rainGeometry, rainMaterial)
  rain.name = "rain_particles"
  rain.visible = false
  scene.add(rain)

  // ================================================================ 契约语义节点 + 标记柱
  const nodes = new Map<string, THREE.Object3D>()
  function node(name: string, x: number, y: number, z: number, markerScale = 1): THREE.Object3D {
    const n = createNamedNode(scene, name, x, y, z)
    nodes.set(name, n)
    session.markers.addMarker(name, new THREE.Vector3(x, y, z), { scale: markerScale })
    return n
  }
  node("landmark_tower", 0, 12.4, 0, 1.15)
  node("skyline_cluster", 8, 7.5, -10, 1.0)
  node("river_promenade", 6, 0.5, 11, 0.95)
  node("night_view_deck", 0, 6.9, 0, 0.95)
  node("street_market", -18.5, 1.2, 6, 0.95)
  node("viewpoint_a", 12, 8.6, -14, 0.95)
  node("historic_block", -19, 1.4, 4.5, 0.95)
  node("risk_crowd_zone", -18.5, 0.6, 6, 1.0)

  // ================================================================ 高亮系统
  function makeMaterialTarget(material: THREE.MeshBasicMaterial | THREE.LineDashedMaterial | THREE.LineBasicMaterial, activeColor: number, defaultColor: number, defaultOpacity: number): HighlightTarget {
    return {
      set(state) {
        if (state === "active") {
          material.color.set(activeColor)
          material.opacity = 1
        } else if (state === "dim") {
          material.color.set(defaultColor)
          material.opacity = defaultOpacity * 0.3
        } else if (state === "hidden") {
          material.color.set(defaultColor)
          material.opacity = defaultOpacity * 0.1
        } else {
          material.color.set(defaultColor)
          material.opacity = defaultOpacity
        }
      },
    }
  }
  function makeRingTarget(ring: { material: THREE.MeshBasicMaterial }): HighlightTarget {
    return {
      set(state) {
        ring.material.opacity = state === "active" ? 0.65 : state === "dim" ? 0.1 : state === "hidden" ? 0.03 : 0
        ring.material.color.set(state === "active" ? 0xffd28e : 0x8fd6ff)
      },
    }
  }
  const highlightables = new Map<string, HighlightTarget>([
    ["landmark_tower", makeRingTarget(towerRing)],
    ["street_market", makeRingTarget(marketRing)],
    ["historic_block", makeMaterialTarget(lanternMaterial, 0xffd28e, 0xffb35c, 0.85)],
    ["river_promenade", makeMaterialTarget(promenadeMaterial, 0xffd28e, 0x8fd6ff, 0.6)],
  ])
  const activityHighlight = new Map<string, "active" | "dim">()
  const audienceHidden = new Set<string>()

  function refreshHighlights(): void {
    for (const [name, target] of highlightables) {
      const base = activityHighlight.get(name) ?? "default"
      target.set(audienceHidden.has(name) ? "hidden" : base)
    }
  }

  // ================================================================ 视觉状态（preset × risk 合成）
  let lastPreset: ScenePreset | null = null
  let night = 0.65 // 默认夜景（城市最具代表性）
  let illumination = 0.9
  const effects = { rain: 0, crowd: 0 }
  let lightningFlash = 0
  let sunBaseIntensity = 1.6

  const DAY_TOP = new THREE.Color(0x3a5a80)
  const DAY_HORIZON = new THREE.Color(0xc8d4dc)
  const NIGHT_TOP = new THREE.Color(0x060a16)
  const NIGHT_HORIZON = new THREE.Color(0x2a3248)
  const DUSK_TOP = new THREE.Color(0x1a1430)
  const DUSK_HORIZON = new THREE.Color(0xd86a3c)
  const RAIN_TOP = new THREE.Color(0x0a0e14)
  const RAIN_HORIZON = new THREE.Color(0x232a32)

  function applyVisualState(): void {
    const dusk = clamp01(night * 2) * (1 - clamp01((night - 0.5) * 2))
    const nightT = clamp01((night - 0.5) * 2)
    const top = DAY_TOP.clone().lerp(DUSK_TOP, dusk).lerp(NIGHT_TOP, nightT)
    const horizon = DAY_HORIZON.clone().lerp(DUSK_HORIZON, dusk).lerp(NIGHT_HORIZON, nightT)
    top.lerp(RAIN_TOP, effects.rain * 0.8)
    horizon.lerp(RAIN_HORIZON, effects.rain * 0.75)
    skyUniforms.topColor.value.copy(top)
    skyUniforms.horizonColor.value.copy(horizon)
    skyUniforms.alpha.value = 0.34 + effects.rain * 0.4
    if (scene.fog instanceof THREE.Fog) scene.fog.color.copy(horizon)

    // 日光随夜化减弱；城市辉光夜化增强
    sunBaseIntensity = lerp(2.2, 0.4, nightT) * (1 - effects.rain * 0.5)
    sun.intensity = sunBaseIntensity
    sun.color.set(dusk > 0.5 ? 0xff9a4a : nightT > 0.5 ? 0x8fb4d8 : 0xffe8c2)
    ambient.intensity = lerp(0.9, 0.55, nightT) * (1 - effects.rain * 0.2)
    cityGlow.intensity = nightT * 55 * illumination

    // 窗灯 / 街灯 / 车流随夜化与点灯率
    buildingMaterial.emissiveIntensity = (0.15 + nightT * 1.1) * illumination
    streetMaterial.opacity = 0.12 + nightT * 0.4 * illumination
    carMaterial.opacity = (0.25 + nightT * 0.75) * illumination
    carLights.visible = session.quality !== "low" && illumination > 0.05
    lanternMaterial.opacity = (0.3 + nightT * 0.7) * illumination
    towerAccentMaterial.opacity = 0.35 + nightT * 0.65
    // 河面反光：夜景反射城市灯色
    riverMaterial.specular.set(nightT > 0.4 ? 0xffc878 : 0x9fc8e8)

    // 风险：雨幕 / 人群
    rain.visible = effects.rain > 0.03 && session.quality !== "low"
    rainMaterial.opacity = effects.rain * 0.55
    crowd.visible = effects.crowd > 0.03
    crowdMaterial.opacity = effects.crowd * 0.85
  }

  // ================================================================ SceneHandle.apply*
  function applyPreset(preset: ScenePreset | null): void {
    lastPreset = preset
    const visual = preset?.visual
    const nightNum = visualNumber(visual, "night", Number.NaN)
    let nightValue = Number.isFinite(nightNum) ? clamp01(nightNum) : visualFlag(visual, "night") ? 1 : 0.65
    const lightText = visualText(visual, "light")
    if (lightText) {
      if (matchesAnyKeyword(lightText, ["night", "夜", "点灯"])) nightValue = 1
      else if (matchesAnyKeyword(lightText, ["dusk", "黄昏", "傍晚", "日落"])) nightValue = 0.55
      else if (matchesAnyKeyword(lightText, ["day", "白天", "正午", "morning", "上午", "clear"])) nightValue = 0.12
    }
    night = nightValue
    illumination = clamp01(visualNumber(visual, "illumination", 0.9))
    applyVisualState()
    session.requestRender()
  }

  function resolveActivityNodeNames(activity: ActivityDefinition): Set<string> {
    const names = collectActivityNodeNames(activity, sceneDef.anchors)
    if (names.size === 0) {
      const text = `${activity.id} ${activity.label}`
      if (matchesAnyKeyword(text, TOWER_KEYWORDS)) names.add("landmark_tower")
      if (matchesAnyKeyword(text, NIGHT_KEYWORDS)) {
        names.add("night_view_deck")
        names.add("viewpoint_a")
      }
      if (matchesAnyKeyword(text, MARKET_KEYWORDS)) {
        names.add("street_market")
        names.add("historic_block")
      }
      if (matchesAnyKeyword(text, ["河", "river", "滨", "步道", "散步"])) names.add("river_promenade")
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
    }
    refreshHighlights()
    session.requestRender()
  }

  function applyRiskStep(risk: RiskScenarioDefinition, stepIndex: number): void {
    const stepFrac = risk.sequence.length > 1 ? clamp01(stepIndex / (risk.sequence.length - 1)) : 1
    const text = `${risk.id} ${risk.label} ${risk.cause.join(" ")} ${risk.sequence.map(s => `${s.title} ${s.description}`).join(" ")}`
    let rainValue = 0
    let crowdValue = 0
    const step = risk.sequence[Math.min(Math.max(stepIndex, 0), risk.sequence.length - 1)]
    for (const action of step?.sceneActions ?? []) {
      const params = action.params
      if (action.kind === "set_weather") {
        if (visualFlag(params, "rain") || visualText(params, "preset") === "rain") {
          rainValue = Math.max(rainValue, visualNumber(params, "intensity", 1))
        }
        rainValue = Math.max(rainValue, visualNumber(params, "rain", 0), visualNumber(params, "storm", 0))
        if (visualFlag(params, "crowd")) crowdValue = Math.max(crowdValue, visualNumber(params, "intensity", 1))
      }
      if (action.kind === "spawn_group" && matchesAnyKeyword(action.target ?? "", CROWD_KEYWORDS)) crowdValue = 1
      if (action.kind === "highlight_anchor") {
        const names = collectAnchorNodeNames(sceneDef.anchors, action.target ? [action.target] : [])
        if (names.has("risk_crowd_zone")) crowdValue = Math.max(crowdValue, 0.5)
      }
    }
    if (matchesAnyKeyword(text, RAIN_KEYWORDS)) rainValue = Math.max(rainValue, 0.4 + 0.6 * stepFrac)
    if (matchesAnyKeyword(text, CROWD_KEYWORDS)) crowdValue = Math.max(crowdValue, 0.4 + 0.6 * stepFrac)
    effects.rain = clamp01(rainValue)
    effects.crowd = clamp01(crowdValue)
    applyVisualState()
    session.requestRender()
  }

  function restoreCalm(): void {
    effects.rain = 0
    effects.crowd = 0
    lightningFlash = 0
    skyUniforms.flash.value = 0
    applyVisualState()
    session.requestRender()
  }

  const THEME_CAMERAS: Partial<Record<ImmersiveTheme, CameraPreset>> = {
    highlights: { position: [16, 9, 26], lookAt: [0, 5, -2], fov: 44 },
    experience: { position: [6, 3, 18], lookAt: [0, 6.5, 0] },
    audience: { position: [-8, 2.4, 16], lookAt: [-18, 1, 6] },
    cautions: { position: [-10, 4, 14], lookAt: [-18.5, 0.6, 6] },
    story_past: { position: [-13, 2.8, 11], lookAt: [-19, 1, 4.5], fov: 42 },
  }

  // ================================================================ 每帧动画
  session.setUpdater((time, delta) => {
    const t = time * 0.001
    // 车流光点沿街道移动
    if (carLights.visible) {
      for (let i = 0; i < CAR_COUNT; i += 1) {
        const seed = carSeeds[i]
        const u = (((seed.u + t * 0.02 * seed.speed * seed.dir) % 1) + 1) % 1
        const along = STREET_MIN + u * (STREET_MAX - STREET_MIN)
        carPositions[i * 3] = seed.axis === "x" ? along : seed.lane
        carPositions[i * 3 + 1] = 0.15
        carPositions[i * 3 + 2] = seed.axis === "x" ? seed.lane : along
      }
      ;(carGeometry.attributes.position as THREE.BufferAttribute).needsUpdate = true
    }
    // 地标塔 accent 缓慢变色（夜景灯色循环）
    const hue = (t * 0.01) % 1
    towerAccentMaterial.color.setHSL(0.52 + Math.sin(hue * Math.PI * 2) * 0.12, 0.7, 0.65)
    // 人群粒子绕街市涡动
    if (crowd.visible) {
      for (let i = 0; i < CROWD_COUNT; i += 1) {
        const seed = crowdSeeds[i]
        const a = seed.phase + t * seed.speed
        crowdPositions[i * 3] = seed.cx + Math.cos(a) * seed.r
        crowdPositions[i * 3 + 1] = 0.2
        crowdPositions[i * 3 + 2] = seed.cz + Math.sin(a) * seed.r * 0.7
      }
      ;(crowdGeometry.attributes.position as THREE.BufferAttribute).needsUpdate = true
    }
    // 雨幕下落循环 + 偶发闪电
    if (rain.visible) {
      for (let i = 0; i < RAIN_COUNT; i += 1) {
        const fall = (rainSeeds[i * 3 + 1] + t * 9) % 22
        rainPositions[i * 3] = rainSeeds[i * 3] + Math.sin(t * 0.5) * 0.6
        rainPositions[i * 3 + 1] = 22 - fall
        rainPositions[i * 3 + 2] = rainSeeds[i * 3 + 2]
      }
      ;(rainGeometry.attributes.position as THREE.BufferAttribute).needsUpdate = true
      if (effects.rain > 0.5 && Math.random() < 0.015) lightningFlash = 0.8
    }
    lightningFlash *= Math.pow(0.002, delta)
    skyUniforms.flash.value = lightningFlash * 0.7
    sun.intensity = sunBaseIntensity + lightningFlash * 2
    // 河面微光波动
    riverMaterial.opacity = 0.9 + Math.sin(t * 0.7) * 0.04
  })

  // quality 三档差异：车流/雨幕 drawRange、楼群实例数（几何段数在建场景时按初始档位定）
  const BUILDING_FULL = buildings.count
  function applyQualityTier(q: "high" | "standard" | "low"): void {
    carGeometry.setDrawRange(0, q === "high" ? CAR_COUNT : q === "standard" ? 60 : 30)
    rainGeometry.setDrawRange(0, q === "high" ? RAIN_COUNT : q === "standard" ? 280 : 140)
    buildings.count = q === "high" ? BUILDING_FULL : q === "standard" ? Math.floor(BUILDING_FULL * 0.8) : Math.floor(BUILDING_FULL * 0.55)
  }
  session.onQualityChange(q => {
    applyQualityTier(q)
    applyVisualState()
  })

  // ================================================================ 初始渲染
  applyQualityTier(session.quality)
  applyVisualState()
  session.requestRender()

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
