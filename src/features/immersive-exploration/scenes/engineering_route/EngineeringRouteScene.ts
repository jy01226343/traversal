/**
 * 工程线路场景 · 景观公路（独库公路风格，SCENES 拥有）
 *
 * 视觉元素（全部程序化，无外链资产）：
 * - 地形条带（fbm 山地位移 + 峡谷下切，顶点色按海拔草-岩-雪分层）
 * - 发光路线（贴地 CatmullRom 车行道 Tube + 发光虚线，沿途里程碑小柱）
 * - 桥隧节点：峡谷高架桥（桥塔 + 拉索 Line）/ 山体隧道口（暗色拱门）
 * - 车辆光点沿线移动（去程暖白 / 回程红，夜间 preset 更亮更密）
 * - 达坂垭口雪原（海拔雪线）、服务区小屋群、观景点平台
 * - 风险：落石（坡面滚石粒子 + 警示泛红）、暴雪封路（雪幕粒子 + 白化雾 + 路线冻结）
 * - 后处理 bloom（standard/high），reducedMotion 直渲一帧
 *
 * preset.visual 解释：light / season / snowLine / traffic / night
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
  fbm2D,
  hashNoise,
  lerp,
  matchesAnyKeyword,
  nodeNamesFromRef,
  smoothstep,
  visualFlag,
  visualNumber,
  visualText,
} from "../shared"

/** 契约语义节点名握手（CONTRACT.md §SCENES） */
export const ENGINEERING_ROUTE_NODE_NAMES = [
  "route_main",
  "bridge_node",
  "tunnel_node",
  "pass_summit",
  "viewpoint_a",
  "service_stop",
  "risk_rockfall_zone",
  "scenic_spur",
] as const

const DRIVE_KEYWORDS = ["自驾", "drive", "公路", "highway", "车行", "巡游"] as const
const BRIDGE_KEYWORDS = ["桥", "bridge", "高架"] as const
const TUNNEL_KEYWORDS = ["隧道", "tunnel"] as const
const PHOTO_KEYWORDS = ["photo", "摄影", "观景", "viewpoint", "拍照"] as const
const ROCKFALL_KEYWORDS = ["落石", "rockfall", "滚石", "崩落", "碎石", "塌方"] as const
const SNOWSTORM_KEYWORDS = ["暴雪", "snowstorm", "暴风雪", "封路", "积雪"] as const

type HighlightState = "active" | "dim" | "hidden" | "default"
interface HighlightTarget {
  set(state: HighlightState): void
}

/** 峡谷中心（高架桥跨越段） */
const GORGE_X = -7

/** 地形高度（世界坐标）：山地 fbm + 峡谷下切 */
function routeTerrainHeight(x: number, z: number): number {
  let y = (fbm2D(x * 0.04 + 3.1, z * 0.05 + 7.7, 4) - 0.5) * 9
  // 两侧高山夹持：|z| 越大越高，中间留出走廊
  y += smoothstep(8, 26, Math.abs(z)) * 7
  // 东端达坂抬升（雪线以上）
  y += smoothstep(10, 40, x) * 5
  // 峡谷下切
  y -= smoothstep(6, 1.5, Math.abs(x - GORGE_X)) * 7
  return y
}

/** 公路中心线控制点（x 西→东，z 蛇形） */
const ROUTE_CONTROLS: ReadonlyArray<readonly [number, number]> = [
  [-46, 6],
  [-34, -4],
  [-22, 3],
  [-14, -2],
  [GORGE_X, 0], // 峡谷（桥位）
  [0, 2.5],
  [8, -3.5],
  [18, 2],
  [28, -2],
  [38, 3],
  [46, -2],
]

function routePointAt(xz: readonly [number, number]): THREE.Vector3 {
  return new THREE.Vector3(xz[0], routeTerrainHeight(xz[0], xz[1]) + 0.18, xz[1])
}

const routeCurve = new THREE.CatmullRomCurve3(ROUTE_CONTROLS.map(routePointAt))

export function createEngineeringRouteScene(canvas: HTMLCanvasElement, sceneDef: ImmersiveSceneDefinition): SceneHandle {
  const session = new SceneSession({
    canvas,
    sceneDef,
    controls: { minDistance: 6, maxDistance: 80, maxPolarAngle: Math.PI * 0.56 },
    bloom: { strength: 0.3, radius: 0.5, threshold: 0.7 },
  })
  const { scene } = session

  // ================================================================ 天空穹顶 + 雾 + 灯光
  const skyUniforms = {
    topColor: { value: new THREE.Color(0x1c2f4a) },
    horizonColor: { value: new THREE.Color(0x7f9ab5) },
    flash: { value: 0 },
    alpha: { value: 0.33 },
  }
  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(200, 32, 18),
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
          color += flash * vec3(0.9, 0.92, 1.0);
          gl_FragColor = vec4(color, alpha);
        }`,
    }),
  )
  skyDome.name = "sky_dome"
  scene.add(skyDome)
  scene.fog = new THREE.Fog(0x7f9ab5, 70, 210)

  const ambient = new THREE.AmbientLight(0x2a3440, 0.7)
  const sun = new THREE.DirectionalLight(0xfff2d8, 2.2)
  sun.position.set(-18, 26, 14)
  const rim = new THREE.DirectionalLight(0x9fc8e8, 0.45)
  rim.position.set(24, 12, -20)
  scene.add(ambient, sun, rim)

  // ================================================================ 地形条带（海拔分层顶点色）
  const TERRAIN_W = 130
  const TERRAIN_D = 70
  const TERRAIN_SEGMENTS = session.quality === "high" ? 130 : session.quality === "standard" ? 96 : 56
  const terrainGeometry = new THREE.PlaneGeometry(TERRAIN_W, TERRAIN_D, TERRAIN_SEGMENTS, Math.floor(TERRAIN_SEGMENTS * 0.55))
  const SNOW_LINE_Y = 6.5
  const GRASS = new THREE.Color(0x4a5c2e)
  const ROCK = new THREE.Color(0x6a6058)
  const SCREE = new THREE.Color(0x7a6a4c)
  const SNOW = new THREE.Color(0xe8eef2)
  let paintedSnowLine = -1
  function paintTerrain(snowLineY: number): void {
    const pos = terrainGeometry.attributes.position as THREE.BufferAttribute
    const colors = new Float32Array(pos.count * 3)
    const c = new THREE.Color()
    for (let i = 0; i < pos.count; i += 1) {
      const lx = pos.getX(i)
      const ly = pos.getY(i)
      const wx = lx
      const wz = -ly // rotation.x=-π/2 后 local y → world -z
      const h = routeTerrainHeight(wx, wz)
      pos.setZ(i, h)
      const alt = clamp01(h / 12)
      c.copy(GRASS).lerp(SCREE, smoothstep(0.15, 0.45, alt))
      c.lerp(ROCK, smoothstep(0.45, 0.7, alt))
      c.lerp(SNOW, smoothstep(snowLineY, snowLineY + 1.5, h))
      c.multiplyScalar(0.86 + 0.28 * hashNoise(wx * 1.9, wz * 1.9))
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }
    terrainGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3))
    ;(terrainGeometry.attributes.color as THREE.BufferAttribute).needsUpdate = true
    terrainGeometry.computeVertexNormals()
    paintedSnowLine = snowLineY
  }
  paintTerrain(SNOW_LINE_Y)
  const terrain = new THREE.Mesh(
    terrainGeometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }),
  )
  terrain.name = "terrain_strip"
  terrain.rotation.x = -Math.PI / 2
  scene.add(terrain)
  session.occluders.push(terrain)

  // ================================================================ 车行道（贴地 Tube）+ 发光虚线
  const ROAD_SAMPLES = 220
  const roadPoints = routeCurve.getSpacedPoints(ROAD_SAMPLES)
  const roadCurve = new THREE.CatmullRomCurve3(roadPoints)
  const road = new THREE.Mesh(
    new THREE.TubeGeometry(roadCurve, 160, 0.42, 6, false),
    new THREE.MeshStandardMaterial({ color: 0x23262c, roughness: 0.9, metalness: 0.05 }),
  )
  road.name = "route_road_tube"
  scene.add(road)

  const glowLineMaterial = new THREE.LineDashedMaterial({
    color: 0xffc878,
    dashSize: 0.55,
    gapSize: 0.35,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  })
  const glowPoints = roadPoints.map(p => new THREE.Vector3(p.x, p.y + 0.28, p.z))
  const glowLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(glowPoints), glowLineMaterial)
  glowLine.name = "route_glow_line"
  glowLine.computeLineDistances()
  scene.add(glowLine)

  // 里程碑小柱（沿线均布）
  const milestoneMaterial = new THREE.MeshBasicMaterial({ color: 0xd8c88a, transparent: true, opacity: 0.75 })
  const MILESTONE_COUNT = 9
  for (let i = 1; i <= MILESTONE_COUNT; i += 1) {
    const u = i / (MILESTONE_COUNT + 1)
    const p = roadCurve.getPointAt(u)
    const tangent = roadCurve.getTangentAt(u)
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize()
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.55, 6), milestoneMaterial)
    post.name = `milestone_${i}`
    post.position.set(p.x + side.x * 0.9, p.y + 0.28, p.z + side.z * 0.9)
    scene.add(post)
  }

  // ================================================================ 峡谷高架桥（桥塔 + 拉索）
  const bridgeGroup = new THREE.Group()
  bridgeGroup.name = "gorge_bridge"
  const bridgeMaterial = new THREE.MeshStandardMaterial({ color: 0x8a929c, roughness: 0.6, metalness: 0.4 })
  const cableMaterial = new THREE.LineBasicMaterial({ color: 0xd8e2ea, transparent: true, opacity: 0.65 })
  {
    // 桥面沿路线跨越峡谷（取峡谷前后两个垭口点拉直）
    const deckA = new THREE.Vector3(GORGE_X - 6, routeTerrainHeight(GORGE_X - 6, -1.4) + 0.3, -1.4)
    const deckB = new THREE.Vector3(GORGE_X + 6, routeTerrainHeight(GORGE_X + 6, 1.2) + 0.3, 1.2)
    const deckLength = deckA.distanceTo(deckB)
    const deck = new THREE.Mesh(new THREE.BoxGeometry(deckLength, 0.28, 1.6), bridgeMaterial)
    deck.position.copy(deckA).lerp(deckB, 0.5)
    deck.lookAt(deckB)
    bridgeGroup.add(deck)
    // 双桥塔 + 扇形拉索
    const cablePoints: THREE.Vector3[] = []
    for (const tu of [0.32, 0.68]) {
      const towerPos = deckA.clone().lerp(deckB, tu)
      const tower = new THREE.Mesh(new THREE.BoxGeometry(0.35, 5.2, 0.35), bridgeMaterial)
      tower.position.set(towerPos.x, towerPos.y + 2.5, towerPos.z)
      bridgeGroup.add(tower)
      const towerTop = new THREE.Vector3(towerPos.x, towerPos.y + 5.1, towerPos.z)
      for (let k = -3; k <= 3; k += 1) {
        if (k === 0) continue
        const anchor = deckA.clone().lerp(deckB, clamp01(tu + k * 0.07))
        cablePoints.push(towerTop.clone(), new THREE.Vector3(anchor.x, anchor.y + 0.14, anchor.z))
      }
    }
    const cables = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(cablePoints), cableMaterial)
    bridgeGroup.add(cables)
  }
  scene.add(bridgeGroup)

  // ================================================================ 山体隧道口（西段）
  const tunnelGroup = new THREE.Group()
  tunnelGroup.name = "tunnel_portal"
  const portalMaterial = new THREE.MeshStandardMaterial({ color: 0x5a5348, roughness: 0.9, flatShading: true })
  {
    const u = 0.16
    const p = roadCurve.getPointAt(u)
    const tangent = roadCurve.getTangentAt(u)
    const frame = new THREE.Mesh(new THREE.BoxGeometry(3.0, 2.6, 0.7), portalMaterial)
    frame.position.set(p.x, p.y + 1.0, p.z)
    frame.lookAt(p.clone().add(tangent))
    const mouth = new THREE.Mesh(
      new THREE.PlaneGeometry(1.7, 1.7),
      new THREE.MeshBasicMaterial({ color: 0x020608 }),
    )
    mouth.position.set(p.x, p.y + 0.85, p.z)
    mouth.lookAt(p.clone().add(tangent))
    mouth.translateZ(0.37)
    tunnelGroup.add(frame, mouth)
  }
  scene.add(tunnelGroup)

  // ================================================================ 服务区小屋群（中段）
  const serviceGroup = new THREE.Group()
  serviceGroup.name = "service_stop_huts"
  const hutBodyMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.9, flatShading: true })
  const hutRoofMat = new THREE.MeshStandardMaterial({ color: 0x33404e, roughness: 0.8, flatShading: true })
  const hutWindowMat = new THREE.MeshBasicMaterial({ color: 0xffd28e, transparent: true, opacity: 0.85 })
  {
    const base = roadCurve.getPointAt(0.56)
    for (let i = 0; i < 3; i += 1) {
      const w = 0.8 - i * 0.15
      const h = 0.55 - i * 0.08
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.7), hutBodyMat)
      body.position.set(base.x + 2.2 + i * 1.1, routeTerrainHeight(base.x + 2.2 + i * 1.1, base.z + 2.4) + h / 2, base.z + 2.4)
      const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.72, h * 0.6, 4), hutRoofMat)
      roof.position.set(body.position.x, body.position.y + h / 2 + h * 0.3, body.position.z)
      roof.rotation.y = Math.PI / 4
      const win = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.3, h * 0.3), hutWindowMat)
      win.position.set(body.position.x, body.position.y, body.position.z + 0.36)
      serviceGroup.add(body, roof, win)
    }
  }
  scene.add(serviceGroup)

  // ================================================================ 观景点平台（达坂垭口下方）
  const viewpointGroup = new THREE.Group()
  viewpointGroup.name = "viewpoint_platform"
  {
    const deck = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.25, 0.14, 12),
      new THREE.MeshStandardMaterial({ color: 0x5a5348, roughness: 0.9, flatShading: true }),
    )
    deck.position.set(26, routeTerrainHeight(26, 8) + 0.1, 8)
    const rail = new THREE.Mesh(
      new THREE.TorusGeometry(1.15, 0.04, 6, 28),
      new THREE.MeshBasicMaterial({ color: 0x8fd6ff, transparent: true, opacity: 0.5 }),
    )
    rail.rotation.x = Math.PI / 2
    rail.position.set(26, routeTerrainHeight(26, 8) + 0.6, 8)
    viewpointGroup.add(deck, rail)
  }
  scene.add(viewpointGroup)

  // ================================================================ 车辆光点（沿线移动，去程白 / 回程红）
  const VEHICLE_COUNT = 26
  const vehiclePositions = new Float32Array(VEHICLE_COUNT * 3)
  const vehicleColors = new Float32Array(VEHICLE_COUNT * 3)
  const vehicleSeeds: Array<{ u: number; speed: number; dir: 1 | -1 }> = []
  for (let i = 0; i < VEHICLE_COUNT; i += 1) {
    const dir = i % 2 === 0 ? 1 : -1
    vehicleSeeds.push({ u: hashNoise(i, 3.3), speed: 0.5 + hashNoise(i, 5.7) * 0.7, dir })
    const c = dir === 1 ? [1.0, 0.92, 0.72] : [1.0, 0.28, 0.16]
    vehicleColors[i * 3] = c[0]
    vehicleColors[i * 3 + 1] = c[1]
    vehicleColors[i * 3 + 2] = c[2]
  }
  const vehicleGeometry = new THREE.BufferGeometry()
  vehicleGeometry.setAttribute("position", new THREE.BufferAttribute(vehiclePositions, 3))
  vehicleGeometry.setAttribute("color", new THREE.BufferAttribute(vehicleColors, 3))
  const vehicleMaterial = new THREE.PointsMaterial({
    size: 0.3,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const vehicles = new THREE.Points(vehicleGeometry, vehicleMaterial)
  vehicles.name = "vehicle_lights"
  scene.add(vehicles)

  // ================================================================ 落石粒子 + 风险坡面 + 暴雪粒子
  const ROCKFALL_COUNT = 34
  const rockfallPositions = new Float32Array(ROCKFALL_COUNT * 3)
  const rockfallProgress = new Float32Array(ROCKFALL_COUNT)
  const rockfallSeedX = new Float32Array(ROCKFALL_COUNT)
  const rockfallSpeed = new Float32Array(ROCKFALL_COUNT)
  for (let i = 0; i < ROCKFALL_COUNT; i += 1) {
    rockfallProgress[i] = hashNoise(i, 1.3)
    rockfallSeedX[i] = 10 + hashNoise(i, 2.9) * 8
    rockfallSpeed[i] = 0.3 + hashNoise(i, 4.1) * 0.4
  }
  const rockfallGeometry = new THREE.BufferGeometry()
  rockfallGeometry.setAttribute("position", new THREE.BufferAttribute(rockfallPositions, 3))
  const rockfallMaterial = new THREE.PointsMaterial({ color: 0xb09a80, size: 0.22, transparent: true, opacity: 0.9, depthWrite: false })
  const rockfall = new THREE.Points(rockfallGeometry, rockfallMaterial)
  rockfall.name = "rockfall_particles"
  rockfall.visible = false
  scene.add(rockfall)
  const riskSlopeMaterial = new THREE.MeshBasicMaterial({ color: 0xe05545, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })
  const riskSlope = new THREE.Mesh(new THREE.PlaneGeometry(9, 5), riskSlopeMaterial)
  riskSlope.name = "risk_slope_overlay"
  riskSlope.position.set(14, routeTerrainHeight(14, -8) + 2.2, -8)
  riskSlope.rotation.x = -Math.PI / 3
  scene.add(riskSlope)

  const BLIZZARD_COUNT = 380
  const blizzardPositions = new Float32Array(BLIZZARD_COUNT * 3)
  const blizzardSeeds = new Float32Array(BLIZZARD_COUNT * 3)
  for (let i = 0; i < BLIZZARD_COUNT; i += 1) {
    blizzardSeeds[i * 3] = -48 + hashNoise(i, 1.1) * 96
    blizzardSeeds[i * 3 + 1] = hashNoise(i, 2.3) * 18
    blizzardSeeds[i * 3 + 2] = -30 + hashNoise(i, 3.5) * 60
  }
  const blizzardGeometry = new THREE.BufferGeometry()
  blizzardGeometry.setAttribute("position", new THREE.BufferAttribute(blizzardPositions, 3))
  const blizzardMaterial = new THREE.PointsMaterial({ color: 0xe8f0f4, size: 0.16, transparent: true, opacity: 0, depthWrite: false })
  const blizzard = new THREE.Points(blizzardGeometry, blizzardMaterial)
  blizzard.name = "blizzard_particles"
  blizzard.visible = false
  scene.add(blizzard)

  // ================================================================ 契约语义节点 + 标记柱
  const nodes = new Map<string, THREE.Object3D>()
  function node(name: string, x: number, y: number, z: number, markerScale = 1): THREE.Object3D {
    const n = createNamedNode(scene, name, x, y, z)
    nodes.set(name, n)
    session.markers.addMarker(name, new THREE.Vector3(x, y, z), { scale: markerScale })
    return n
  }
  {
    const mid = roadCurve.getPointAt(0.5)
    const bridgeP = new THREE.Vector3(GORGE_X, routeTerrainHeight(GORGE_X - 6, -1.4) + 1.2, 0)
    const tunnelP = roadCurve.getPointAt(0.16)
    const summitP = roadCurve.getPointAt(0.88)
    node("route_main", mid.x, mid.y + 0.8, mid.z, 1.0)
    node("bridge_node", bridgeP.x, bridgeP.y, bridgeP.z, 1.0)
    node("tunnel_node", tunnelP.x, tunnelP.y + 1.2, tunnelP.z, 0.95)
    node("pass_summit", summitP.x, summitP.y + 1.2, summitP.z, 1.0)
    node("viewpoint_a", 26, routeTerrainHeight(26, 8) + 1.0, 8, 0.95)
    node("service_stop", roadCurve.getPointAt(0.56).x + 2.2, routeTerrainHeight(roadCurve.getPointAt(0.56).x + 2.2, roadCurve.getPointAt(0.56).z + 2.4) + 0.9, roadCurve.getPointAt(0.56).z + 2.4, 0.9)
    node("risk_rockfall_zone", 14, routeTerrainHeight(14, -8) + 1.6, -8, 1.0)
    node("scenic_spur", roadCurve.getPointAt(0.72).x, roadCurve.getPointAt(0.72).y + 0.8, roadCurve.getPointAt(0.72).z, 0.9)
  }

  // ================================================================ 高亮系统
  function makeLineTarget(material: THREE.LineDashedMaterial, activeColor: number, defaultColor: number, defaultOpacity: number): HighlightTarget {
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
          material.opacity = defaultOpacity * 0.08
        } else {
          material.color.set(defaultColor)
          material.opacity = defaultOpacity
        }
      },
    }
  }
  const highlightables = new Map<string, HighlightTarget>([
    ["route_main", makeLineTarget(glowLineMaterial, 0xffd28e, 0xffc878, 0.85)],
    ["bridge_node", {
      set(state) {
        cableMaterial.opacity = state === "active" ? 1 : state === "dim" ? 0.2 : state === "hidden" ? 0.08 : 0.65
        cableMaterial.color.set(state === "active" ? 0xffd28e : 0xd8e2ea)
      },
    }],
    ["tunnel_node", {
      set(state) {
        portalMaterial.emissive.set(state === "active" ? 0x4a3a18 : 0x000000)
      },
    }],
    ["service_stop", {
      set(state) {
        hutWindowMat.opacity = state === "active" ? 1 : state === "dim" ? 0.3 : state === "hidden" ? 0.12 : 0.85
        hutWindowMat.color.set(state === "active" ? 0xffe8b0 : 0xffd28e)
      },
    }],
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
  let lightT = 0.55
  let snowLineY = SNOW_LINE_Y
  let night = 0
  let traffic = 0.8
  const effects = { rockfall: 0, blizzard: 0, slopeAlert: 0 }

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
    { t: 0.5, top: 0x1c2f4a, horizon: 0x7f9ab5, sun: 0xfff2d8, sunIntensity: 2.6 },
    { t: 0.75, top: 0x1a2033, horizon: 0xf08a3c, sun: 0xff9a4a, sunIntensity: 1.9 },
    { t: 1.0, top: 0x05080f, horizon: 0x1c2a3a, sun: 0x8fb4d8, sunIntensity: 0.3 },
  ]
  function sampleSky(t: number): { top: THREE.Color; horizon: THREE.Color; sun: THREE.Color; sunIntensity: number } {
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
  const LIGHT_TEXT_MAP: Record<string, number> = {
    night: 0, 夜晚: 0, 深夜: 0,
    dawn: 0.25, 清晨: 0.25, 日出: 0.25,
    morning: 0.38, 上午: 0.38,
    noon: 0.5, day: 0.5, 正午: 0.5, 白天: 0.5, clear: 0.5,
    afternoon: 0.62, 下午: 0.62,
    dusk: 0.75, 黄昏: 0.75, 傍晚: 0.75, 日落: 0.75,
  }

  const WHITEOUT_TOP = new THREE.Color(0x9aa8b4)
  const WHITEOUT_HORIZON = new THREE.Color(0xc8d2da)

  function applyVisualState(): void {
    const sky = sampleSky(lightT)
    // 暴雪白化
    sky.top.lerp(WHITEOUT_TOP, effects.blizzard * 0.85)
    sky.horizon.lerp(WHITEOUT_HORIZON, effects.blizzard * 0.85)
    skyUniforms.topColor.value.copy(sky.top)
    skyUniforms.horizonColor.value.copy(sky.horizon)
    skyUniforms.alpha.value = 0.33 + effects.blizzard * 0.5
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.copy(sky.horizon)
      scene.fog.near = lerp(70, 22, effects.blizzard)
      scene.fog.far = lerp(210, 90, effects.blizzard)
    }

    const az = Math.PI * (1 - lightT)
    sun.position.set(Math.cos(az) * 30, 5 + Math.sin(Math.PI * lightT) * 24, 14)
    sun.color.copy(sky.sun)
    sun.intensity = sky.sunIntensity * (1 - effects.blizzard * 0.7)
    ambient.intensity = 0.7 * (1 - effects.blizzard * 0.2)
    rim.intensity = 0.45 * (1 - effects.blizzard * 0.5)

    // 雪线（变化才重画地形顶点色）
    if (Math.abs(snowLineY - paintedSnowLine) > 0.05) paintTerrain(snowLineY)

    // 夜间：路线发光增强、车窗灯更亮
    glowLineMaterial.opacity = 0.6 + night * 0.4
    vehicleMaterial.size = 0.26 + night * 0.14
    vehicleMaterial.opacity = (0.35 + night * 0.65) * (0.4 + traffic * 0.6) * (1 - effects.blizzard * 0.85)
    vehicles.visible = session.quality !== "low" && traffic > 0.03 && effects.blizzard < 0.9
    hutWindowMat.opacity = 0.4 + night * 0.6

    // 风险：落石 + 坡面泛红 + 暴雪
    rockfall.visible = effects.rockfall > 0.02 && session.quality !== "low"
    rockfallMaterial.opacity = clamp01(effects.rockfall) * 0.9
    riskSlopeMaterial.opacity = effects.slopeAlert * 0.3
    blizzard.visible = effects.blizzard > 0.03 && session.quality !== "low"
    blizzardMaterial.opacity = effects.blizzard * 0.8
  }

  // ================================================================ SceneHandle.apply*
  function applyPreset(preset: ScenePreset | null): void {
    lastPreset = preset
    const visual = preset?.visual
    const lightText = visualText(visual, "light")
    if (lightText) {
      const mapped = Object.entries(LIGHT_TEXT_MAP).find(([key]) => lightText.toLowerCase().includes(key))
      lightT = mapped ? mapped[1] : 0.55
    } else {
      lightT = clamp01(visualNumber(visual, "lightT", visualNumber(visual, "daylight", 0.55)))
    }
    night = visualFlag(visual, "night") || (lightText ? matchesAnyKeyword(lightText, ["night", "夜"]) : false) ? 1 : clamp01(visualNumber(visual, "night", 0))
    // 雪线：snowLine 双模量纲（≤1 比例 / >1 场景海拔单位 0..12）
    const snowValue = visualNumber(visual, "snowLine", Number.NaN)
    if (Number.isFinite(snowValue)) {
      snowLineY = snowValue <= 1 ? lerp(1.5, 11, snowValue) : clamp01(snowValue / 12) * 12
    } else {
      const season = visualText(visual, "season")
      snowLineY = season && matchesAnyKeyword(season, ["winter", "冬", "雪"]) ? 3 : season && matchesAnyKeyword(season, ["spring", "春"]) ? 6 : 9.5
    }
    traffic = clamp01(visualNumber(visual, "traffic", 0.8))
    applyVisualState()
    session.requestRender()
  }

  function resolveActivityNodeNames(activity: ActivityDefinition): Set<string> {
    const names = collectActivityNodeNames(activity, sceneDef.anchors)
    if (names.size === 0) {
      const text = `${activity.id} ${activity.label}`
      if (matchesAnyKeyword(text, DRIVE_KEYWORDS)) names.add("route_main")
      if (matchesAnyKeyword(text, BRIDGE_KEYWORDS)) names.add("bridge_node")
      if (matchesAnyKeyword(text, TUNNEL_KEYWORDS)) names.add("tunnel_node")
      if (matchesAnyKeyword(text, PHOTO_KEYWORDS)) names.add("viewpoint_a")
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
    let rockfallValue = 0
    let blizzardValue = 0
    let slope = 0
    const step = risk.sequence[Math.min(Math.max(stepIndex, 0), risk.sequence.length - 1)]
    for (const action of step?.sceneActions ?? []) {
      const params = action.params
      if (action.kind === "set_weather") {
        if (visualFlag(params, "rockfall")) rockfallValue = Math.max(rockfallValue, visualNumber(params, "intensity", 1))
        rockfallValue = Math.max(rockfallValue, visualNumber(params, "dust", 0))
        if (visualFlag(params, "blizzard") || visualFlag(params, "snowstorm") || visualText(params, "preset") === "blizzard") {
          blizzardValue = Math.max(blizzardValue, visualNumber(params, "intensity", 1))
        }
        blizzardValue = Math.max(blizzardValue, visualNumber(params, "snow", 0), visualNumber(params, "wind", 0) * 0.7)
      }
      if (action.kind === "highlight_anchor") {
        const names = collectAnchorNodeNames(sceneDef.anchors, action.target ? [action.target] : [])
        if (names.has("risk_rockfall_zone")) slope = 1
      }
    }
    if (matchesAnyKeyword(text, ROCKFALL_KEYWORDS)) {
      rockfallValue = Math.max(rockfallValue, 0.4 + 0.6 * stepFrac)
      slope = Math.max(slope, 0.3 + 0.5 * stepFrac)
    }
    if (matchesAnyKeyword(text, SNOWSTORM_KEYWORDS)) blizzardValue = Math.max(blizzardValue, 0.4 + 0.6 * stepFrac)
    effects.rockfall = clamp01(rockfallValue)
    effects.blizzard = clamp01(blizzardValue)
    effects.slopeAlert = clamp01(slope)
    applyVisualState()
    session.requestRender()
  }

  function restoreCalm(): void {
    effects.rockfall = 0
    effects.blizzard = 0
    effects.slopeAlert = 0
    applyVisualState()
    session.requestRender()
  }

  const THEME_CAMERAS: Partial<Record<ImmersiveTheme, CameraPreset>> = {
    highlights: { position: [-6, 14, 30], lookAt: [0, 2, -2], fov: 46 },
    experience: { position: [-16, 4.5, 12], lookAt: [-4, 1.5, -2] },
    audience: { position: [2, 3.5, 14], lookAt: [12, 2, 2] },
    cautions: { position: [8, 6, 4], lookAt: [14, 2, -8] },
    engineering_operation: { position: [-13, 5.5, 8], lookAt: [GORGE_X, 0.5, 0], fov: 40 },
  }

  // ================================================================ 每帧动画
  session.setUpdater((time, delta) => {
    const t = time * 0.001
    // 车辆光点沿线移动（暴雪封路时停滞）
    if (vehicles.visible) {
      const flow = 1 - clamp01(effects.blizzard * 1.2)
      for (let i = 0; i < VEHICLE_COUNT; i += 1) {
        const seed = vehicleSeeds[i]
        const u = (((seed.u + t * 0.012 * seed.speed * seed.dir * flow) % 1) + 1) % 1
        const p = roadCurve.getPointAt(u)
        vehiclePositions[i * 3] = p.x
        vehiclePositions[i * 3 + 1] = p.y + 0.32
        vehiclePositions[i * 3 + 2] = p.z
      }
      ;(vehicleGeometry.attributes.position as THREE.BufferAttribute).needsUpdate = true
    }
    // 落石沿坡面滚落
    if (rockfall.visible) {
      for (let i = 0; i < ROCKFALL_COUNT; i += 1) {
        rockfallProgress[i] += delta * rockfallSpeed[i] * (0.5 + effects.rockfall)
        if (rockfallProgress[i] > 1) rockfallProgress[i] = 0
        const prog = rockfallProgress[i]
        const x = rockfallSeedX[i]
        const z = -6 - prog * 6
        rockfallPositions[i * 3] = x + Math.sin(i * 2.1) * 0.8
        rockfallPositions[i * 3 + 1] = routeTerrainHeight(x, z) + 0.3 + (1 - prog) * 1.2
        rockfallPositions[i * 3 + 2] = z
      }
      ;(rockfallGeometry.attributes.position as THREE.BufferAttribute).needsUpdate = true
    }
    // 暴雪横向飘移
    if (blizzard.visible) {
      for (let i = 0; i < BLIZZARD_COUNT; i += 1) {
        const fall = (blizzardSeeds[i * 3 + 1] + t * 5.5) % 18
        blizzardPositions[i * 3] = blizzardSeeds[i * 3] + Math.sin(t * 0.9 + i) * 1.8 + t * 2 % 10
        blizzardPositions[i * 3 + 1] = 18 - fall
        blizzardPositions[i * 3 + 2] = blizzardSeeds[i * 3 + 2] + Math.cos(t * 0.6 + i * 0.7) * 1.2
      }
      ;(blizzardGeometry.attributes.position as THREE.BufferAttribute).needsUpdate = true
    }
  })

  // quality 三档差异：车辆/暴雪 drawRange（几何段数在建场景时按初始档位定）
  function applyQualityTier(q: "high" | "standard" | "low"): void {
    vehicleGeometry.setDrawRange(0, q === "high" ? VEHICLE_COUNT : q === "standard" ? 18 : 10)
    blizzardGeometry.setDrawRange(0, q === "high" ? BLIZZARD_COUNT : q === "standard" ? 240 : 120)
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
