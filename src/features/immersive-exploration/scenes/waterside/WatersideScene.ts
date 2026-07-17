/**
 * 水域场景 · 湖泊 + 岸线（洞爷湖风格，SCENES 拥有）
 *
 * 视觉元素（全部程序化）：
 * - 圆形湖面：Phong 高光近似反射（metalness/roughness 由 reflection preset 调），顶点波浪动画
 * - 水面 additive 波光层（程序化斑点纹理，UV 随时间平移，强度随 reflection preset）
 * - 岸线泡沫环（呼吸动画，风平浪静近乎不可见，风浪 risk 增强）
 * - 岸线环形地面、远处城市剪影（低矮盒子群 + 暖窗）、中岛
 * - 码头栈道、游船/独木舟(SUP) 区域浮标圈、湖岸步道弧线、环湖虚线步道
 * - 湿地芦苇丛（摆动）、候鸟粒子（quality≠low）、傍晚花火点（evening preset）
 * - 风险：风浪（浪高振幅 + 水面变暗）/ 低水温（冷色调 + 雾气）
 *
 * preset.visual 解释：mist / reflection / evening / season / light
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
  createSpeckleTexture,
  hashNoise,
  lerp,
  matchesAnyKeyword,
  nodeNamesFromRef,
  visualFlag,
  visualNumber,
  visualText,
} from "../shared"

/** 契约语义节点名握手（CONTRACT.md §SCENES） */
export const WATERSIDE_NODE_NAMES = [
  "shore_walk",
  "pier",
  "boat_zone",
  "paddle_zone",
  "viewpoint_a",
  "viewpoint_b",
  "wetland",
  "lakeside_trail",
  "risk_open_water",
] as const

const LAKE_RADIUS = 13

const BOAT_KEYWORDS = ["boat", "游船", "cruise", "游览船", "sightseeing"] as const
const PADDLE_KEYWORDS = ["paddle", "独木舟", "皮划", "kayak", "sup", "桨板", "canoe", "划船"] as const
const WALK_KEYWORDS = ["walk", "散步", "漫步", "环湖", "lakeside", "trail", "步道", "stroll", "cycling", "骑行"] as const
const WIND_KEYWORDS = ["风浪", "wind", "wave", "强风", "大风", "浪"] as const
const COLD_KEYWORDS = ["水温", "cold", "低温", "寒冷", "冰水"] as const

type HighlightState = "active" | "dim" | "hidden" | "default"
interface HighlightTarget {
  set(state: HighlightState): void
}

export function createWatersideScene(canvas: HTMLCanvasElement, sceneDef: ImmersiveSceneDefinition): SceneHandle {
  const session = new SceneSession({ canvas, sceneDef, controls: { minDistance: 6, maxDistance: 48, maxPolarAngle: Math.PI * 0.54 } })
  const { scene } = session

  // ================================================================ 天空穹顶 + 雾 + 灯光
  const skyUniforms = {
    topColor: { value: new THREE.Color(0x0d1622) },
    horizonColor: { value: new THREE.Color(0x31506b) },
    flash: { value: 0 },
    alpha: { value: 0.32 },
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
          color += flash * vec3(0.8, 0.85, 1.0);
          gl_FragColor = vec4(color, alpha);
        }`,
    }),
  )
  skyDome.name = "sky_dome"
  scene.add(skyDome)
  scene.fog = new THREE.Fog(0x31506b, 60, 170)

  const ambient = new THREE.AmbientLight(0x243240, 0.7)
  const sun = new THREE.DirectionalLight(0xffe8c2, 1.9)
  sun.position.set(-18, 16, 10)
  scene.add(ambient, sun)

  // ================================================================ 湖面（顶点波浪）
  const WATER_SEGMENTS = 64
  const waterGeometry = new THREE.PlaneGeometry(34, 34, WATER_SEGMENTS, WATER_SEGMENTS)
  const waterBasePositions = (waterGeometry.attributes.position as THREE.BufferAttribute).array.slice() as unknown as Float32Array
  const waterMaterial = new THREE.MeshPhongMaterial({
    color: 0x1b3a4d,
    specular: 0x9fc8d8,
    shininess: 90,
    transparent: true,
    opacity: 0.96,
  })
  const water = new THREE.Mesh(waterGeometry, waterMaterial)
  water.name = "lake_surface"
  water.rotation.x = -Math.PI / 2
  water.position.y = 0
  scene.add(water)

  // ================================================================ 水面波光层（additive 斑点，UV 随时间平移）
  const sparkleTexture = createSpeckleTexture(128, 260)
  sparkleTexture.repeat.set(3, 3)
  const sparkleMaterial = new THREE.MeshBasicMaterial({
    map: sparkleTexture,
    color: 0xbfe0e8,
    transparent: true,
    opacity: 0.12,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const sparkleLayer = new THREE.Mesh(new THREE.PlaneGeometry(34, 34), sparkleMaterial)
  sparkleLayer.name = "water_sparkle_layer"
  sparkleLayer.rotation.x = -Math.PI / 2
  sparkleLayer.position.y = 0.02
  scene.add(sparkleLayer)

  // ================================================================ 岸线泡沫环（呼吸动画，风浪增强）
  const foamMaterial = new THREE.MeshBasicMaterial({
    color: 0xe8f2f4,
    transparent: true,
    opacity: 0.05,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const foamRing = new THREE.Mesh(new THREE.RingGeometry(LAKE_RADIUS - 0.5, LAKE_RADIUS - 0.06, 96), foamMaterial)
  foamRing.name = "shore_foam_ring"
  foamRing.rotation.x = -Math.PI / 2
  foamRing.position.y = 0.03
  scene.add(foamRing)

  // ================================================================ 岸线环形地面
  const shoreGeometry = new THREE.RingGeometry(LAKE_RADIUS + 0.15, 90, 72, 1)
  const shoreMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true })
  /** 内圈沙滩色 → 外圈草色；snowT>0 时混入积雪亮白（冬季 preset） */
  function paintShore(snowT: number): void {
    const pos = shoreGeometry.attributes.position as THREE.BufferAttribute
    const colors = new Float32Array(pos.count * 3)
    const sand = new THREE.Color(0x8a7a5c).lerp(new THREE.Color(0xdde3e8), snowT * 0.7)
    const grass = new THREE.Color(0x2e3d26).lerp(new THREE.Color(0xc8d4d8), snowT * 0.55)
    const c = new THREE.Color()
    for (let i = 0; i < pos.count; i += 1) {
      const r = Math.hypot(pos.getX(i), pos.getY(i))
      c.copy(sand).lerp(grass, clamp01((r - LAKE_RADIUS) / 6))
      c.multiplyScalar(0.9 + 0.2 * hashNoise(pos.getX(i), pos.getY(i)))
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }
    shoreGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3))
    ;(shoreGeometry.attributes.color as THREE.BufferAttribute).needsUpdate = true
  }
  paintShore(0)
  const shore = new THREE.Mesh(shoreGeometry, shoreMaterial)
  shore.name = "shore_ring"
  shore.rotation.x = -Math.PI / 2
  shore.position.y = 0.12
  scene.add(shore)

  // ================================================================ 城市剪影（远岸低矮盒子群 + 暖窗）
  const townGroup = new THREE.Group()
  townGroup.name = "shoreline_town"
  const townMaterial = new THREE.MeshStandardMaterial({ color: 0x1a2532, roughness: 0.9, flatShading: true })
  const townWindowMaterial = new THREE.MeshBasicMaterial({ color: 0xffd28e, transparent: true, opacity: 0.75 })
  for (let i = 0; i < 22; i += 1) {
    const w = 0.7 + hashNoise(i, 3.3) * 1.4
    const h = 0.5 + hashNoise(i, 7.7) * 2.1
    const d = 0.7 + hashNoise(i, 5.1) * 0.8
    const x = -19 + i * 1.8 + hashNoise(i, 9.9) * 0.9
    const z = -15.5 - hashNoise(i, 4.4) * 2.5
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), townMaterial)
    box.position.set(x, h / 2, z)
    townGroup.add(box)
    if (hashNoise(i, 12.3) > 0.45) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.4, h * 0.25), townWindowMaterial)
      win.position.set(x, h * 0.55, z + d / 2 + 0.01)
      townGroup.add(win)
    }
  }
  scene.add(townGroup)

  // ================================================================ 中岛
  const island = new THREE.Group()
  island.name = "nakajima_island"
  const islandBase = new THREE.Mesh(
    new THREE.SphereGeometry(2.3, 20, 12),
    new THREE.MeshStandardMaterial({ color: 0x2c3c28, roughness: 1, flatShading: true }),
  )
  islandBase.scale.set(1.2, 0.32, 1)
  islandBase.position.y = 0.05
  island.add(islandBase)
  const islandTreeMat = new THREE.MeshStandardMaterial({ color: 0x24402a, roughness: 1, flatShading: true })
  for (let i = 0; i < 6; i += 1) {
    const tree = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9 + hashNoise(i, 2.2) * 0.5, 6), islandTreeMat)
    tree.position.set((hashNoise(i, 3.3) - 0.5) * 3.4, 0.75, (hashNoise(i, 4.4) - 0.5) * 2.6)
    island.add(tree)
  }
  island.position.set(2.6, 0, -3.6)
  scene.add(island)
  session.occluders.push(islandBase)

  // ================================================================ 码头栈道
  const pierGroup = new THREE.Group()
  pierGroup.name = "pier_deck"
  const pierMaterial = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.85, flatShading: true })
  const pierDeck = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.12, 5.2), pierMaterial)
  pierDeck.position.y = 0.32
  pierGroup.add(pierDeck)
  for (let i = 0; i < 4; i += 1) {
    for (const side of [-0.55, 0.55]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 6), pierMaterial)
      post.position.set(side, 0.1, -2.2 + i * 1.5)
      pierGroup.add(post)
    }
  }
  pierGroup.position.set(6.8, 0, 10.6)
  pierGroup.lookAt(2.2, 0, 3.2)
  scene.add(pierGroup)
  const pierEnd = new THREE.Vector3(4.7, 0.5, 8.3)

  // ================================================================ 浮标圈（游船区 / 桨板区）
  function addBuoyRing(cx: number, cz: number, radius: number, color: number, name: string): { group: THREE.Group; material: THREE.MeshBasicMaterial } {
    const group = new THREE.Group()
    group.name = name
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, depthWrite: false })
    const count = Math.max(6, Math.round(radius * 3))
    for (let i = 0; i < count; i += 1) {
      const a = (i / count) * Math.PI * 2
      const buoy = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), material)
      buoy.position.set(cx + Math.cos(a) * radius, 0.08, cz + Math.sin(a) * radius)
      group.add(buoy)
    }
    scene.add(group)
    return { group, material }
  }
  const boatZone = addBuoyRing(-5.2, 2.8, 3.1, 0xffb35c, "boat_zone_buoys")
  const paddleZone = addBuoyRing(5.6, 2.4, 2.2, 0x7dd87d, "paddle_zone_buoys")

  // 游船（绕游船区缓行）
  const boat = new THREE.Group()
  boat.name = "tour_boat"
  const boatHullMat = new THREE.MeshStandardMaterial({ color: 0x30404e, roughness: 0.7, flatShading: true })
  const boatCabinMat = new THREE.MeshStandardMaterial({ color: 0xd8dde2, roughness: 0.6, flatShading: true })
  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.5, 0.95), boatHullMat)
  hull.position.y = 0.28
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 0.7), boatCabinMat)
  cabin.position.y = 0.75
  const mastLight = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe8a0 }))
  mastLight.position.set(0.8, 1.15, 0)
  boat.add(hull, cabin, mastLight)
  scene.add(boat)

  // 桨板/独木舟（两叶小舟在桨板区漂浮）
  const kayakMat = new THREE.MeshStandardMaterial({ color: 0xc8643c, roughness: 0.7, flatShading: true })
  const kayaks: THREE.Mesh[] = []
  for (let i = 0; i < 2; i += 1) {
    const kayak = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 1.1, 4, 8), kayakMat)
    kayak.rotation.z = Math.PI / 2
    kayak.position.set(5.6 + (i - 0.5) * 1.6, 0.12, 2.4 + (i - 0.5) * 1.2)
    scene.add(kayak)
    kayaks.push(kayak)
  }

  // ================================================================ 湖岸步道（弧带）+ 环湖虚线
  const shoreWalkMaterial = new THREE.MeshStandardMaterial({ color: 0x6a6255, roughness: 1, flatShading: true })
  const shoreWalk = new THREE.Mesh(
    new THREE.TorusGeometry(LAKE_RADIUS + 1.2, 0.32, 6, 48, 1.7),
    shoreWalkMaterial,
  )
  shoreWalk.name = "shore_walk_deck"
  // Torus 默认在 XY 平面、弧从 +X 扫向 +Y；rotation.z 先在本地平面内转弧，
  // rotation.x = π/2 再压平到地面（原 +Y → 世界 +Z 即前岸），弧心正好落在正前方。
  shoreWalk.rotation.x = Math.PI / 2
  shoreWalk.rotation.z = Math.PI / 2 - 0.85
  shoreWalk.position.y = 0.16
  scene.add(shoreWalk)

  const lakesideTrailPoints: THREE.Vector3[] = []
  for (let i = 0; i <= 96; i += 1) {
    const a = (i / 96) * Math.PI * 2
    lakesideTrailPoints.push(new THREE.Vector3(Math.cos(a) * (LAKE_RADIUS + 2.2), 0.22, Math.sin(a) * (LAKE_RADIUS + 2.2)))
  }
  const lakesideTrailMaterial = new THREE.LineDashedMaterial({
    color: 0x8fd6ff,
    dashSize: 0.5,
    gapSize: 0.3,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
  })
  const lakesideTrail = new THREE.Line(new THREE.BufferGeometry().setFromPoints(lakesideTrailPoints), lakesideTrailMaterial)
  lakesideTrail.name = "lakeside_trail_line"
  lakesideTrail.computeLineDistances()
  scene.add(lakesideTrail)

  // ================================================================ 湿地芦苇
  const REED_COUNT = 42
  const reedGeometry = new THREE.PlaneGeometry(0.08, 1.0)
  const reedMaterial = new THREE.MeshStandardMaterial({ color: 0x4a6b3a, roughness: 1, side: THREE.DoubleSide })
  const reeds = new THREE.InstancedMesh(reedGeometry, reedMaterial, REED_COUNT)
  reeds.name = "wetland_reeds"
  const reedBases: Array<{ x: number; z: number; phase: number; scale: number }> = []
  for (let i = 0; i < REED_COUNT; i += 1) {
    reedBases.push({
      x: 8.6 + hashNoise(i, 2.1) * 3.4,
      z: 9.6 + hashNoise(i, 5.7) * 2.6,
      phase: hashNoise(i, 8.3) * Math.PI * 2,
      scale: 0.6 + hashNoise(i, 3.9) * 0.7,
    })
  }
  scene.add(reeds)

  // ================================================================ 候鸟粒子 + 花火点（quality≠low）
  const BIRD_COUNT = 26
  const birdPositions = new Float32Array(BIRD_COUNT * 3)
  const birdGeometry = new THREE.BufferGeometry()
  birdGeometry.setAttribute("position", new THREE.BufferAttribute(birdPositions, 3))
  const birdMaterial = new THREE.PointsMaterial({ color: 0xcfd9e2, size: 0.16, transparent: true, opacity: 0.85, depthWrite: false })
  const birds = new THREE.Points(birdGeometry, birdMaterial)
  birds.name = "migratory_birds"
  scene.add(birds)

  const FIREWORK_COUNT = 90
  const fireworkPositions = new Float32Array(FIREWORK_COUNT * 3)
  const fireworkSeeds = new Float32Array(FIREWORK_COUNT * 3)
  for (let i = 0; i < FIREWORK_COUNT; i += 1) {
    // 球面随机方向
    const theta = hashNoise(i, 1.1) * Math.PI * 2
    const phi = Math.acos(2 * hashNoise(i, 2.2) - 1)
    fireworkSeeds[i * 3] = Math.sin(phi) * Math.cos(theta)
    fireworkSeeds[i * 3 + 1] = Math.abs(Math.cos(phi))
    fireworkSeeds[i * 3 + 2] = Math.sin(phi) * Math.sin(theta)
  }
  const fireworkGeometry = new THREE.BufferGeometry()
  fireworkGeometry.setAttribute("position", new THREE.BufferAttribute(fireworkPositions, 3))
  const fireworkMaterial = new THREE.PointsMaterial({ color: 0xffc878, size: 0.14, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
  const fireworks = new THREE.Points(fireworkGeometry, fireworkMaterial)
  fireworks.name = "evening_fireworks"
  fireworks.position.set(0, 5.5, -6)
  scene.add(fireworks)

  // ================================================================ 清晨薄雾层
  const mistMaterial = new THREE.MeshBasicMaterial({ color: 0xd8e2ea, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide })
  const mistLayer = new THREE.Mesh(new THREE.CircleGeometry(22, 40), mistMaterial)
  mistLayer.name = "morning_mist"
  mistLayer.rotation.x = -Math.PI / 2
  mistLayer.position.y = 0.55
  scene.add(mistLayer)

  // ================================================================ 观景点丘 + 契约节点
  const hillMaterial = new THREE.MeshStandardMaterial({ color: 0x2c3c28, roughness: 1, flatShading: true })
  const hillA = new THREE.Mesh(new THREE.SphereGeometry(2.8, 18, 10), hillMaterial)
  hillA.scale.set(1.5, 0.55, 1.2)
  hillA.position.set(-16.5, 0.1, 12.5)
  const hillB = new THREE.Mesh(new THREE.SphereGeometry(2.2, 16, 10), hillMaterial)
  hillB.scale.set(1.4, 0.45, 1.1)
  hillB.position.set(17.2, 0.05, 6.4)
  scene.add(hillA, hillB)

  const nodes = new Map<string, THREE.Object3D>()
  function node(name: string, x: number, y: number, z: number, markerScale = 1): THREE.Object3D {
    const n = createNamedNode(scene, name, x, y, z)
    nodes.set(name, n)
    session.markers.addMarker(name, new THREE.Vector3(x, y, z), { scale: markerScale })
    return n
  }
  node("shore_walk", 0.5, 0.4, 14.6, 0.9)
  node("pier", pierEnd.x, pierEnd.y, pierEnd.z, 0.9)
  node("boat_zone", -5.2, 0.5, 2.8, 1.0)
  node("paddle_zone", 5.6, 0.4, 2.4, 0.9)
  node("viewpoint_a", -16.5, 1.75, 12.5, 0.95)
  node("viewpoint_b", 17.2, 1.2, 6.4, 0.95)
  node("wetland", 10.3, 0.6, 10.9, 0.9)
  node("lakeside_trail", -10.8, 0.4, 10.8, 0.9)
  node("risk_open_water", 0, 0.4, -1.5, 1.05)

  // ================================================================ 高亮系统
  function makeMaterialTarget(material: THREE.MeshBasicMaterial | THREE.LineDashedMaterial, activeColor: number, defaultColor: number, defaultOpacity: number): HighlightTarget {
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
  function makeShoreWalkTarget(): HighlightTarget {
    return {
      set(state) {
        shoreWalkMaterial.emissive.set(state === "active" ? 0x4a3a18 : 0x000000)
        shoreWalkMaterial.color.set(state === "active" ? 0x8a7a5e : 0x6a6255)
      },
    }
  }
  const highlightables = new Map<string, HighlightTarget>([
    ["boat_zone", makeMaterialTarget(boatZone.material, 0xffd28e, 0xffb35c, 0.7)],
    ["paddle_zone", makeMaterialTarget(paddleZone.material, 0xc8f0a0, 0x7dd87d, 0.7)],
    ["lakeside_trail", makeMaterialTarget(lakesideTrailMaterial, 0xffd28e, 0x8fd6ff, 0.6)],
    ["shore_walk", makeShoreWalkTarget()],
  ])
  const activityHighlight = new Map<string, "active" | "dim">()
  const audienceHidden = new Set<string>()

  function refreshHighlights(): void {
    for (const [name, target] of highlightables) {
      const base = activityHighlight.get(name) ?? "default"
      target.set(audienceHidden.has(name) ? "hidden" : base)
    }
    // 游船随游船区高亮增亮
    const boatState = audienceHidden.has("boat_zone") ? "hidden" : activityHighlight.get("boat_zone") ?? "default"
    boatCabinMat.emissive.set(boatState === "active" ? 0x554422 : 0x000000)
    mastLight.visible = boatState !== "hidden"
  }

  // ================================================================ 视觉状态（preset × risk 合成）
  let lastPreset: ScenePreset | null = null
  let mist = 0.3
  let evening = 0
  let dawnCool = 0
  let baseWaveAmp = 0.04
  let fireworksEnabled = false
  let reflectionStrength = 0.6
  let foamStrength = 0.05
  const effects = { wind: 0, cold: 0 }
  let waveAmp = 0.05
  const WATER_DEFAULT = new THREE.Color(0x1b3a4d)
  const WATER_STORM = new THREE.Color(0x0d1b26)
  const WATER_COLD = new THREE.Color(0x123243)
  const SKY_EVENING_TOP = new THREE.Color(0x1a1226)
  const SKY_EVENING_HORIZON = new THREE.Color(0xd86a3c)

  function applyVisualState(): void {
    // 浪高：preset 基础浪高 + 风浪风险加成
    waveAmp = baseWaveAmp + effects.wind * 0.33
    // 天空：evening preset → 夕阳色；风浪压暗（先算天空，水色要取天色做反射）
    const top = new THREE.Color(0x0d1622).lerp(SKY_EVENING_TOP, evening)
    const horizon = new THREE.Color(0x31506b).lerp(SKY_EVENING_HORIZON, evening * 0.85)
    top.multiplyScalar(1 - effects.wind * 0.4)
    horizon.lerp(new THREE.Color(0x1c222c), effects.wind * 0.6)
    skyUniforms.topColor.value.copy(top)
    skyUniforms.horizonColor.value.copy(horizon)
    // 水色：默认 → 风浪变暗 / 低水温冷色；再向天际线色轻微 lerp，让水面映出天色
    const waterColor = WATER_DEFAULT.clone()
    waterColor.lerp(WATER_COLD, effects.cold * 0.8)
    waterColor.lerp(WATER_STORM, effects.wind * 0.75)
    waterColor.lerp(horizon, 0.15)
    waterMaterial.color.copy(waterColor)
    // 波光层：reflection preset 调强弱，风浪打散的碎光减弱，quality=low 隐藏
    sparkleLayer.visible = session.quality !== "low"
    sparkleMaterial.opacity = (0.05 + reflectionStrength * 0.17) * (1 - effects.wind * 0.55)
    // 岸线泡沫：风平浪静几乎不可见，风浪 risk 增强
    foamStrength = 0.04 + effects.wind * 0.3
    // V1.2：穹顶半透明透出实景照片背景；风浪压回不透明
    skyUniforms.alpha.value = 0.32 + effects.wind * 0.5
    if (scene.fog instanceof THREE.Fog) scene.fog.color.copy(horizon)
    sun.color.set(evening > 0.5 ? 0xff9a4a : dawnCool > 0.5 ? 0xcfe0e8 : 0xffe8c2)
    sun.intensity = lerp(1.9, 1.2, evening) * (1 - dawnCool * 0.25) * (1 - effects.wind * 0.35)
    // 薄雾：mist preset + 低水温加成
    mistMaterial.opacity = clamp01(mist * 0.3 + effects.cold * 0.25)
    // 花火点：fireworks preset 且非 low 档
    fireworks.visible = fireworksEnabled && session.quality !== "low"
    birds.visible = session.quality !== "low"
  }

  // ================================================================ SceneHandle.apply*
  function applyPreset(preset: ScenePreset | null): void {
    lastPreset = preset
    const visual = preset?.visual
    mist = clamp01(visualNumber(visual, "mist", 0.3))
    // 基础浪高（DATA 约定 waveHeight 0..1）
    baseWaveAmp = 0.02 + clamp01(visualNumber(visual, "waveHeight", 0.08)) * 0.22
    // 傍晚/清晨冷调：evening 键、light 文案双通道
    const lightText = visualText(visual, "light")
    let eveningValue = visualFlag(visual, "evening") ? 1 : clamp01(visualNumber(visual, "evening", 0))
    if (lightText && matchesAnyKeyword(lightText, ["dusk", "黄昏", "evening", "日落"])) eveningValue = Math.max(eveningValue, 1)
    evening = eveningValue
    dawnCool = lightText && matchesAnyKeyword(lightText, ["dawn", "清晨", "winter", "冬", "cool", "soft"]) ? 1 : 0
    // 花火开关（DATA 约定 fireworks 布尔键）
    fireworksEnabled = visualFlag(visual, "fireworks", evening > 0.3)
    // reflection（倒影清晰度）→ 高光锐度 + 波光层强度
    const reflection = clamp01(visualNumber(visual, "reflection", 0.6))
    reflectionStrength = reflection
    waterMaterial.shininess = lerp(30, 140, reflection)
    waterMaterial.specular.set(0x9fc8d8).multiplyScalar(lerp(0.4, 1.2, reflection))
    waterMaterial.opacity = lerp(0.9, 0.98, reflection)
    // season / snow → 岸线植被与积雪
    const season = visualText(visual, "season")
    const snowT = visualFlag(visual, "snow") || (season ? matchesAnyKeyword(season, ["winter", "冬"]) : false) ? 1 : 0
    paintShore(snowT)
    if (snowT > 0) reedMaterial.color.set(0x5a5a48)
    else if (season && matchesAnyKeyword(season, ["autumn", "fall", "秋", "红叶"])) reedMaterial.color.set(0x8a6a3a)
    else reedMaterial.color.set(0x4a6b3a)
    applyVisualState()
    session.requestRender()
  }

  function resolveActivityNodeNames(activity: ActivityDefinition): Set<string> {
    const names = collectActivityNodeNames(activity, sceneDef.anchors)
    if (names.size === 0) {
      const text = `${activity.id} ${activity.label}`
      if (matchesAnyKeyword(text, BOAT_KEYWORDS)) names.add("boat_zone")
      if (matchesAnyKeyword(text, PADDLE_KEYWORDS)) names.add("paddle_zone")
      if (matchesAnyKeyword(text, WALK_KEYWORDS)) {
        names.add("lakeside_trail")
        names.add("shore_walk")
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
    }
    refreshHighlights()
    session.requestRender()
  }

  function applyRiskStep(risk: RiskScenarioDefinition, stepIndex: number): void {
    const stepFrac = risk.sequence.length > 1 ? clamp01(stepIndex / (risk.sequence.length - 1)) : 1
    const text = `${risk.id} ${risk.label} ${risk.cause.join(" ")} ${risk.sequence.map(s => `${s.title} ${s.description}`).join(" ")}`
    let wind = 0
    let cold = 0
    // 当前步的 sceneActions（DATA 每步完整重述，故不累计）
    const step = risk.sequence[Math.min(Math.max(stepIndex, 0), risk.sequence.length - 1)]
    for (const action of step?.sceneActions ?? []) {
      const params = action.params
      if (action.kind === "set_water") {
        // DATA 约定：waveHeight / wind / splash（风浪），temperatureCue（低水温）
        wind = Math.max(
          wind,
          visualNumber(params, "waveHeight", 0),
          visualNumber(params, "wave", visualNumber(params, "waveAmp", 0)),
          visualNumber(params, "wind", 0),
          visualNumber(params, "splash", 0) * 0.8,
        )
        cold = Math.max(cold, visualNumber(params, "temperatureCue", 0))
        if (visualText(params, "temperature") === "cold" || visualFlag(params, "cold")) cold = 1
      }
      if (action.kind === "set_weather") {
        if (visualFlag(params, "wind") || visualText(params, "preset") === "wind") {
          wind = Math.max(wind, visualNumber(params, "intensity", 1))
        }
        wind = Math.max(wind, visualNumber(params, "wind", 0))
        if (visualFlag(params, "cold")) cold = 1
      }
    }
    if (matchesAnyKeyword(text, WIND_KEYWORDS)) wind = Math.max(wind, 0.35 + 0.65 * stepFrac)
    if (matchesAnyKeyword(text, COLD_KEYWORDS)) cold = Math.max(cold, 0.5 + 0.5 * stepFrac)
    effects.wind = clamp01(wind)
    effects.cold = clamp01(cold)
    applyVisualState()
    session.requestRender()
  }

  function restoreCalm(): void {
    effects.wind = 0
    effects.cold = 0
    applyVisualState()
    session.requestRender()
  }

  const THEME_CAMERAS: Partial<Record<ImmersiveTheme, CameraPreset>> = {
    highlights: { position: [10, 7.5, 22], lookAt: [0, 0.5, -2], fov: 44 },
    experience: { position: [5.5, 2.2, 13.5], lookAt: [-2, 0.4, 2] },
    audience: { position: [4, 1.8, 15.5], lookAt: [3, 0.3, 8] },
    cautions: { position: [9, 4.5, 10], lookAt: [0, 0.2, -1.5] },
    water_ecology: { position: [-8, 2.8, 12], lookAt: [9, 0.2, 9] },
  }

  // ================================================================ 每帧动画
  let fireworkClock = 0
  session.setUpdater((time, delta) => {
    // 波浪顶点动画（湖面半径内，边缘归零）
    const posAttr = waterGeometry.attributes.position as THREE.BufferAttribute
    const t = time * 0.001
    for (let i = 0; i < posAttr.count; i += 1) {
      const x = waterBasePositions[i * 3]
      const y = waterBasePositions[i * 3 + 1]
      const r = Math.hypot(x, y)
      if (r < LAKE_RADIUS) {
        const edge = 1 - r / LAKE_RADIUS
        posAttr.setZ(i, Math.sin(x * 0.85 + t * 1.7) * Math.sin(y * 0.65 + t * 1.15) * waveAmp * edge)
      } else {
        posAttr.setZ(i, 0)
      }
    }
    posAttr.needsUpdate = true
    waterGeometry.computeVertexNormals()

    // 波光层 UV 缓慢平移（碎金漂移）
    if (sparkleLayer.visible) {
      sparkleTexture.offset.x = t * 0.008
      sparkleTexture.offset.y = t * 0.005
    }
    // 岸线泡沫呼吸（透明度脉动 + 轻微缩放）
    foamMaterial.opacity = foamStrength * (0.65 + 0.35 * Math.sin(t * 1.4))
    foamRing.scale.setScalar(1 + Math.sin(t * 0.9) * 0.004)

    // 游船绕区缓行
    const boatAngle = time * 0.00016
    boat.position.set(-5.2 + Math.cos(boatAngle) * 2.2, 0.02 + Math.sin(time * 0.0011) * 0.03, 2.8 + Math.sin(boatAngle) * 2.2)
    boat.rotation.y = -boatAngle + Math.PI / 2
    // 桨板轻微起伏
    for (let i = 0; i < kayaks.length; i += 1) {
      kayaks[i].position.y = 0.12 + Math.sin(time * 0.0013 + i * 2.1) * 0.04
      kayaks[i].rotation.x = Math.sin(time * 0.0009 + i) * 0.05
    }
    // 芦苇摆动
    {
      const matrix = new THREE.Matrix4()
      const quat = new THREE.Quaternion()
      const pos = new THREE.Vector3()
      const scl = new THREE.Vector3()
      for (let i = 0; i < REED_COUNT; i += 1) {
        const base = reedBases[i]
        pos.set(base.x, 0.5 * base.scale, base.z)
        quat.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.sin(time * 0.0011 + base.phase) * 0.09 * (1 + effects.wind * 2))
        scl.setScalar(base.scale)
        matrix.compose(pos, quat, scl)
        reeds.setMatrixAt(i, matrix)
      }
      reeds.instanceMatrix.needsUpdate = true
    }
    // 候鸟 V 形队列绕湖
    if (birds.visible) {
      const leadAngle = time * 0.00012
      for (let i = 0; i < BIRD_COUNT; i += 1) {
        const side = i % 2 === 0 ? 1 : -1
        const rank = Math.ceil(i / 2)
        const a = leadAngle - rank * 0.014
        const r = 17 + rank * 0.35
        birdPositions[i * 3] = Math.cos(a) * r + side * rank * 0.28
        birdPositions[i * 3 + 1] = 8.5 + Math.sin(time * 0.001 + i) * 0.25 + rank * 0.06
        birdPositions[i * 3 + 2] = Math.sin(a) * r
      }
      ;(birdGeometry.attributes.position as THREE.BufferAttribute).needsUpdate = true
    }
    // 花火：周期绽放
    if (fireworks.visible) {
      fireworkClock = (fireworkClock + delta) % 2.6
      const burst = fireworkClock / 2.6
      const radius = burst * 3.4
      fireworkMaterial.opacity = (1 - burst) * 0.9
      for (let i = 0; i < FIREWORK_COUNT; i += 1) {
        fireworkPositions[i * 3] = fireworkSeeds[i * 3] * radius
        fireworkPositions[i * 3 + 1] = fireworkSeeds[i * 3 + 1] * radius - burst * burst * 1.2
        fireworkPositions[i * 3 + 2] = fireworkSeeds[i * 3 + 2] * radius
      }
      ;(fireworkGeometry.attributes.position as THREE.BufferAttribute).needsUpdate = true
    }
    // 薄雾缓转
    mistLayer.rotation.z = time * 0.00003
  })

  session.onQualityChange(() => applyVisualState())

  // ================================================================ 初始渲染
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
