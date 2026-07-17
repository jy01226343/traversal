/**
 * 荒野场景 · 稀树草原（马赛马拉风格，SCENES 拥有）
 *
 * 视觉元素（全部程序化，无外链资产）：
 * - 起伏草原地形（fbm 位移平面 + 顶点色草色/干燥土色混合，随 preset 季节调色）
 * - 金合欢树（伞盖剪影：弯干 + 扁平伞盖合并几何，InstancedMesh 散布）
 * - 草海波浪（InstancedMesh 草叶，逐实例正弦摆动，风 risk 加剧）
 * - 远处动物群剪影（合并几何 InstancedMesh，整体缓慢迁徙移动 + 个体起伏）
 * - 地平线图层（两圈低矮丘陵剪影，颜色随天际线/雾色插值）
 * - 水洼（Phong 高光圆盘 + 泥岸环）、 kopje 岩丘群、游猎环线发光虚线
 * - 晨昏色调随 preset（light 文案/dawn/dusk/night）联动；火险 risk：天空橙染 + 烟柱粒子 + 草色焦枯
 * - 后处理 bloom（standard/high），reducedMotion 直渲一帧
 *
 * preset.visual 解释：light / season / dry / grassColor / herdDensity / mist
 */
import * as THREE from "three"
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js"
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
  createRadialGlowTexture,
  fbm2D,
  hashNoise,
  lerp,
  matchesAnyKeyword,
  nodeNamesFromRef,
  smoothstep,
  visualColor,
  visualFlag,
  visualNumber,
  visualText,
} from "../shared"

/** 契约语义节点名握手（CONTRACT.md §SCENES） */
export const WILDERNESS_NODE_NAMES = [
  "waterhole",
  "acacia_grove",
  "grassland_sea",
  "herd_zone",
  "safari_loop",
  "viewpoint_a",
  "kopje_rocks",
  "risk_fire_zone",
] as const

const SAFARI_KEYWORDS = ["safari", "游猎", "观兽", "车行", "巡游"] as const
const HERD_KEYWORDS = ["迁徙", "角马", "兽群", "herd", "migration", "wildebeest", "动物"] as const
const PHOTO_KEYWORDS = ["photo", "摄影", "观景", "viewpoint", "拍照", "日出", "日落"] as const
const FIRE_KEYWORDS = ["火", "fire", "野火", "草原火", "burn"] as const
const DROUGHT_KEYWORDS = ["干旱", "drought", "dry", "旱季", "缺水"] as const

type HighlightState = "active" | "dim" | "hidden" | "default"
interface HighlightTarget {
  set(state: HighlightState): void
}

/** 草原地形高度（世界坐标） */
function savannaHeight(x: number, z: number): number {
  let y = (fbm2D(x * 0.05 + 3.1, z * 0.05 + 7.7, 4) - 0.5) * 2.2
  // 水洼盆地
  y -= smoothstep(6, 1.5, Math.hypot(x + 8, z - 6)) * 0.7
  // kopje 岩丘抬升
  y += smoothstep(7, 2, Math.hypot(x - 14, z + 10)) * 0.9
  return y
}

export function createWildernessScene(canvas: HTMLCanvasElement, sceneDef: ImmersiveSceneDefinition): SceneHandle {
  const session = new SceneSession({
    canvas,
    sceneDef,
    controls: { minDistance: 5, maxDistance: 60, maxPolarAngle: Math.PI * 0.55 },
    bloom: { strength: 0.3, radius: 0.5, threshold: 0.7 },
  })
  const { scene } = session

  // ================================================================ 天空穹顶 + 雾 + 灯光
  const skyUniforms = {
    topColor: { value: new THREE.Color(0x2b3a55) },
    horizonColor: { value: new THREE.Color(0xe09a5a) },
    flash: { value: 0 },
    alpha: { value: 0.32 },
  }
  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(160, 32, 18),
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
          color += flash * vec3(0.9, 0.7, 0.45);
          gl_FragColor = vec4(color, alpha);
        }`,
    }),
  )
  skyDome.name = "sky_dome"
  scene.add(skyDome)
  scene.fog = new THREE.Fog(0xe09a5a, 60, 175)

  const ambient = new THREE.AmbientLight(0x3a3430, 0.7)
  const sun = new THREE.DirectionalLight(0xffb35c, 1.8)
  sun.position.set(-24, 12, 10)
  const rim = new THREE.DirectionalLight(0xffd0a0, 0.4)
  rim.position.set(20, 8, -18)
  scene.add(ambient, sun, rim)

  // ================================================================ 草原地形（fbm 位移 + 顶点色）
  const GROUND_SIZE = 130
  const GROUND_SEGMENTS = session.quality === "high" ? 110 : session.quality === "standard" ? 80 : 48
  const groundGeometry = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE, GROUND_SEGMENTS, GROUND_SEGMENTS)
  const GRASS_GREEN = new THREE.Color(0x5a6b2e)
  const GRASS_DRY = new THREE.Color(0x9a7d3c)
  const DIRT_COLOR = new THREE.Color(0x6b5232)
  function paintGround(dryT: number): void {
    const pos = groundGeometry.attributes.position as THREE.BufferAttribute
    const colors = new Float32Array(pos.count * 3)
    const c = new THREE.Color()
    for (let i = 0; i < pos.count; i += 1) {
      const lx = pos.getX(i)
      const ly = pos.getY(i)
      const wx = lx
      const wz = -ly // rotation.x=-π/2 后 local y → world -z
      pos.setZ(i, savannaHeight(wx, wz))
      // 草色：绿 ↔ 干燥黄，斑驳斑块 + 水洼周边泥色
      const patch = fbm2D(wx * 0.12 + 11, wz * 0.12 + 5, 3)
      c.copy(GRASS_GREEN).lerp(GRASS_DRY, clamp01(dryT * 0.85 + patch * 0.4))
      const mud = smoothstep(4.5, 1.6, Math.hypot(wx + 8, wz - 6))
      c.lerp(DIRT_COLOR, mud * 0.8)
      c.multiplyScalar(0.88 + 0.24 * hashNoise(wx * 2.1, wz * 2.1))
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }
    groundGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3))
    ;(groundGeometry.attributes.color as THREE.BufferAttribute).needsUpdate = true
    groundGeometry.computeVertexNormals()
  }
  paintGround(0.35)
  const ground = new THREE.Mesh(
    groundGeometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }),
  )
  ground.name = "savanna_ground"
  ground.rotation.x = -Math.PI / 2
  scene.add(ground)
  session.occluders.push(ground)

  // ================================================================ 地平线图层（两圈丘陵剪影）
  const HORIZON_BASE = [new THREE.Color(0x4a3f30), new THREE.Color(0x5c4c38)]
  const horizonMaterials: THREE.MeshBasicMaterial[] = []
  const horizonGroup = new THREE.Group()
  horizonGroup.name = "horizon_layers"
  ;[
    { radius: 62, count: 8, hMin: 1.6, hMax: 3.6 },
    { radius: 96, count: 10, hMin: 3.0, hMax: 6.5 },
  ].forEach((ring, ringIndex) => {
    const material = new THREE.MeshBasicMaterial({ color: HORIZON_BASE[ringIndex].getHex() })
    horizonMaterials.push(material)
    for (let i = 0; i < ring.count; i += 1) {
      const seed = ringIndex * 17.3 + i * 5.9
      const angle = (i / ring.count) * Math.PI * 2 + hashNoise(seed, 1.1) * 0.5
      const height = ring.hMin + hashNoise(seed, 2.9) * (ring.hMax - ring.hMin)
      const width = 7 + hashNoise(seed, 4.1) * 9
      const hill = new THREE.Mesh(new THREE.SphereGeometry(width, 12, 8), material)
      hill.scale.set(1.4, height / width, 1)
      hill.position.set(Math.cos(angle) * ring.radius, 0, Math.sin(angle) * ring.radius)
      horizonGroup.add(hill)
    }
  })
  scene.add(horizonGroup)

  // ================================================================ 金合欢树（伞盖剪影 InstancedMesh）
  function buildAcaciaGeometry(): THREE.BufferGeometry {
    const parts: THREE.BufferGeometry[] = []
    const trunk = new THREE.CylinderGeometry(0.06, 0.1, 1.5, 5)
    trunk.translate(0, 0.75, 0)
    trunk.rotateZ(0.12)
    parts.push(trunk)
    const branchA = new THREE.CylinderGeometry(0.035, 0.05, 0.8, 4)
    branchA.translate(0, 0.4, 0)
    branchA.rotateZ(0.55)
    branchA.translate(-0.12, 1.35, 0)
    parts.push(branchA)
    // 扁平伞盖：压扁球体
    const canopy = new THREE.SphereGeometry(1.0, 12, 7)
    canopy.scale(1.15, 0.22, 1.15)
    canopy.translate(0.05, 1.75, 0)
    parts.push(canopy)
    const canopyTop = new THREE.SphereGeometry(0.7, 10, 6)
    canopyTop.scale(1.1, 0.16, 1.1)
    canopyTop.translate(0.02, 1.9, 0)
    parts.push(canopyTop)
    return mergeGeometries(parts) ?? trunk
  }
  const ACACIA_COUNT = 16
  const acaciaMaterial = new THREE.MeshStandardMaterial({ color: 0x2e2a1c, roughness: 1, flatShading: true })
  const acacias = new THREE.InstancedMesh(buildAcaciaGeometry(), acaciaMaterial, ACACIA_COUNT)
  acacias.name = "acacia_trees"
  {
    const matrix = new THREE.Matrix4()
    const pos = new THREE.Vector3()
    const quat = new THREE.Quaternion()
    const scl = new THREE.Vector3()
    for (let i = 0; i < ACACIA_COUNT; i += 1) {
      // 一半聚在 acacia_grove（东侧），其余散布
      const grove = i % 2 === 0
      const x = grove ? 10 + hashNoise(i, 3.3) * 10 : -26 + hashNoise(i, 3.3) * 52
      const z = grove ? -14 + hashNoise(i, 5.7) * 12 : -24 + hashNoise(i, 5.7) * 44
      const s = 0.9 + hashNoise(i, 7.9) * 1.3
      pos.set(x, savannaHeight(x, z), z)
      quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), hashNoise(i, 9.1) * Math.PI * 2)
      scl.setScalar(s)
      matrix.compose(pos, quat, scl)
      acacias.setMatrixAt(i, matrix)
    }
    acacias.instanceMatrix.needsUpdate = true
  }
  scene.add(acacias)

  // ================================================================ 草海（InstancedMesh 摆动草叶）
  const GRASS_COUNT = 520
  const grassGeometry = new THREE.PlaneGeometry(0.07, 0.6)
  const grassMaterial = new THREE.MeshStandardMaterial({ color: 0x7a7030, roughness: 1, side: THREE.DoubleSide })
  const grassSea = new THREE.InstancedMesh(grassGeometry, grassMaterial, GRASS_COUNT)
  grassSea.name = "grass_sea_blades"
  const grassBases: Array<{ x: number; z: number; y: number; phase: number; scale: number }> = []
  for (let i = 0; i < GRASS_COUNT; i += 1) {
    // 主要分布在 grassland_sea（中场）与前场
    const x = -22 + hashNoise(i, 2.7) * 44
    const z = -8 + hashNoise(i, 6.3) * 26
    grassBases.push({
      x,
      z,
      y: savannaHeight(x, z),
      phase: hashNoise(i, 8.9) * Math.PI * 2,
      scale: 0.6 + hashNoise(i, 4.5) * 0.8,
    })
  }
  scene.add(grassSea)

  // ================================================================ 动物群剪影（迁徙移动）
  function buildAntelopeGeometry(): THREE.BufferGeometry {
    const parts: THREE.BufferGeometry[] = []
    const body = new THREE.SphereGeometry(0.32, 8, 6)
    body.scale(1.5, 0.85, 0.7)
    body.translate(0, 0.62, 0)
    parts.push(body)
    const neck = new THREE.CylinderGeometry(0.06, 0.09, 0.42, 5)
    neck.translate(0, 0.2, 0)
    neck.rotateZ(-0.5)
    neck.translate(0.42, 0.85, 0)
    parts.push(neck)
    const head = new THREE.BoxGeometry(0.22, 0.12, 0.1)
    head.translate(0.58, 1.05, 0)
    parts.push(head)
    for (const [lx, lz] of [[0.28, 0.12], [0.28, -0.12], [-0.3, 0.12], [-0.3, -0.12]] as const) {
      const leg = new THREE.CylinderGeometry(0.03, 0.025, 0.55, 4)
      leg.translate(lx, 0.28, lz)
      parts.push(leg)
    }
    return mergeGeometries(parts) ?? body
  }
  const HERD_COUNT = 38
  const herdMaterial = new THREE.MeshBasicMaterial({ color: 0x241c12 })
  const herd = new THREE.InstancedMesh(buildAntelopeGeometry(), herdMaterial, HERD_COUNT)
  herd.name = "animal_herd"
  const herdBases: Array<{ u: number; lane: number; scale: number; phase: number }> = []
  for (let i = 0; i < HERD_COUNT; i += 1) {
    herdBases.push({
      u: hashNoise(i, 3.3),
      lane: (hashNoise(i, 5.7) - 0.5) * 6,
      scale: 0.7 + hashNoise(i, 7.9) * 0.6,
      phase: hashNoise(i, 9.1) * Math.PI * 2,
    })
  }
  scene.add(herd)

  // ================================================================ 水洼 + 泥岸
  const waterholeMaterial = new THREE.MeshPhongMaterial({
    color: 0x2a4a4a,
    specular: 0xffd0a0,
    shininess: 110,
    transparent: true,
    opacity: 0.92,
  })
  const waterhole = new THREE.Mesh(new THREE.CircleGeometry(2.1, 32), waterholeMaterial)
  waterhole.name = "waterhole_pool"
  waterhole.rotation.x = -Math.PI / 2
  waterhole.position.set(-8, savannaHeight(-8, 6) + 0.42, 6)
  scene.add(waterhole)
  const mudRing = new THREE.Mesh(
    new THREE.RingGeometry(2.1, 2.9, 32),
    new THREE.MeshStandardMaterial({ color: 0x5c4630, roughness: 1, flatShading: true }),
  )
  mudRing.rotation.x = -Math.PI / 2
  mudRing.position.set(-8, savannaHeight(-8, 6) + 0.4, 6)
  scene.add(mudRing)

  // ================================================================ kopje 岩丘群
  const kopjeGroup = new THREE.Group()
  kopjeGroup.name = "kopje_rocks_cluster"
  const kopjeMaterial = new THREE.MeshStandardMaterial({ color: 0x6a5a48, roughness: 0.95, flatShading: true })
  for (let i = 0; i < 6; i += 1) {
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8 + hashNoise(i, 3.3) * 1.1, 0), kopjeMaterial)
    const x = 14 + (hashNoise(i, 5.7) - 0.5) * 4.5
    const z = -10 + (hashNoise(i, 7.9) - 0.5) * 4
    rock.position.set(x, savannaHeight(x, z) + 0.4 + i * 0.12, z)
    rock.rotation.set(hashNoise(i, 9.1) * 2, hashNoise(i, 11.3) * 2, hashNoise(i, 13.5) * 2)
    rock.scale.y = 0.7 + hashNoise(i, 15.7) * 0.4
    kopjeGroup.add(rock)
  }
  scene.add(kopjeGroup)

  // ================================================================ 游猎环线（发光虚线）
  const safariPoints: THREE.Vector3[] = []
  for (let i = 0; i <= 60; i += 1) {
    const a = (i / 60) * Math.PI * 2
    const rx = 17 + Math.sin(a * 2) * 3.5
    const x = Math.cos(a) * rx + 1
    const z = Math.sin(a) * 12 - 1
    safariPoints.push(new THREE.Vector3(x, savannaHeight(x, z) + 0.35, z))
  }
  const safariMaterial = new THREE.LineDashedMaterial({
    color: 0xffd28e,
    dashSize: 0.5,
    gapSize: 0.32,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
  })
  const safariLoop = new THREE.Line(new THREE.BufferGeometry().setFromPoints(safariPoints), safariMaterial)
  safariLoop.name = "safari_loop_line"
  safariLoop.computeLineDistances()
  scene.add(safariLoop)

  // ================================================================ 观景点丘台 + 区域强调环
  const viewpointRock = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 1), kopjeMaterial)
  viewpointRock.scale.set(1.4, 0.5, 1.2)
  viewpointRock.position.set(-13, savannaHeight(-13, 12) + 0.3, 12)
  scene.add(viewpointRock)

  function makeZoneRing(x: number, z: number, radius: number, color = 0x8fd6ff): { mesh: THREE.Mesh; material: THREE.MeshBasicMaterial } {
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })
    const mesh = new THREE.Mesh(new THREE.RingGeometry(radius - 0.14, radius, 40), material)
    mesh.rotation.x = -Math.PI / 2
    mesh.position.set(x, savannaHeight(x, z) + 0.3, z)
    scene.add(mesh)
    return { mesh, material }
  }
  const herdRing = makeZoneRing(-6, -13, 5.2)
  const waterholeRing = makeZoneRing(-8, 6, 3.2)
  const groveRing = makeZoneRing(15, -8, 6.0)

  // ================================================================ 火险烟柱粒子 + 地面火光
  const SMOKE_COUNT = 90
  const smokePositions = new Float32Array(SMOKE_COUNT * 3)
  const smokeSeeds: Array<{ x: number; z: number; offset: number; speed: number; wobble: number }> = []
  for (let i = 0; i < SMOKE_COUNT; i += 1) {
    smokeSeeds.push({
      x: 20 + (hashNoise(i, 1.7) - 0.5) * 7,
      z: 8 + (hashNoise(i, 3.1) - 0.5) * 6,
      offset: hashNoise(i, 5.3),
      speed: 0.05 + hashNoise(i, 7.7) * 0.08,
      wobble: hashNoise(i, 9.9) * Math.PI * 2,
    })
  }
  const smokeGeometry = new THREE.BufferGeometry()
  smokeGeometry.setAttribute("position", new THREE.BufferAttribute(smokePositions, 3))
  const smokeMaterial = new THREE.PointsMaterial({
    color: 0x8a8078,
    size: 0.55,
    map: createRadialGlowTexture(48, "rgba(255,255,255,0.9)", "rgba(255,255,255,0.4)", "rgba(255,255,255,0)"),
    transparent: true,
    opacity: 0,
    depthWrite: false,
  })
  const smoke = new THREE.Points(smokeGeometry, smokeMaterial)
  smoke.name = "fire_smoke"
  smoke.visible = false
  scene.add(smoke)
  const fireGlowMaterial = new THREE.MeshBasicMaterial({
    color: 0xff7a3c,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const fireGlow = new THREE.Mesh(new THREE.CircleGeometry(4.6, 32), fireGlowMaterial)
  fireGlow.name = "fire_ground_glow"
  fireGlow.rotation.x = -Math.PI / 2
  fireGlow.position.set(20, savannaHeight(20, 8) + 0.35, 8)
  scene.add(fireGlow)

  // ================================================================ 契约语义节点 + 标记柱
  const nodes = new Map<string, THREE.Object3D>()
  function node(name: string, x: number, y: number, z: number, markerScale = 1): THREE.Object3D {
    const n = createNamedNode(scene, name, x, y, z)
    nodes.set(name, n)
    session.markers.addMarker(name, new THREE.Vector3(x, y, z), { scale: markerScale })
    return n
  }
  node("waterhole", -8, savannaHeight(-8, 6) + 0.9, 6, 0.95)
  node("acacia_grove", 15, savannaHeight(15, -8) + 2.2, -8, 1.0)
  node("grassland_sea", 0, savannaHeight(0, 4) + 0.8, 4, 0.95)
  node("herd_zone", -6, savannaHeight(-6, -13) + 1.0, -13, 1.0)
  node("safari_loop", 16.5, savannaHeight(16.5, 2.5) + 0.7, 2.5, 0.9)
  node("viewpoint_a", -13, savannaHeight(-13, 12) + 1.4, 12, 0.95)
  node("kopje_rocks", 14, savannaHeight(14, -10) + 1.8, -10, 0.95)
  node("risk_fire_zone", 20, savannaHeight(20, 8) + 1.0, 8, 1.0)

  // ================================================================ 高亮系统
  function makeMaterialTarget(material: THREE.MeshBasicMaterial | THREE.LineDashedMaterial, activeColor: number, defaultColor: number, defaultOpacity: number): HighlightTarget {
    return {
      set(state) {
        if (state === "active") {
          material.color.set(activeColor)
          material.opacity = Math.max(0.65, defaultOpacity)
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
    ["safari_loop", makeMaterialTarget(safariMaterial, 0xffd28e, 0xffd28e, 0.7)],
    ["herd_zone", makeRingTarget(herdRing)],
    ["waterhole", makeRingTarget(waterholeRing)],
    ["acacia_grove", makeRingTarget(groveRing)],
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
  let lightT = 0.3 // 默认清晨金调
  let dry = 0.35
  let herdDensity = 0.8
  let mist = 0.2
  const effects = { fire: 0, drought: 0 }
  let paintedDry = -1

  interface SkyStop {
    t: number
    top: number
    horizon: number
    sun: number
    sunIntensity: number
  }
  const SKY_STOPS: readonly SkyStop[] = [
    { t: 0.0, top: 0x060a14, horizon: 0x1a2030, sun: 0x8fb4d8, sunIntensity: 0.25 },
    { t: 0.25, top: 0x2b3a55, horizon: 0xe09a5a, sun: 0xffb35c, sunIntensity: 1.8 },
    { t: 0.5, top: 0x3a5a80, horizon: 0xc8d4dc, sun: 0xfff2d8, sunIntensity: 2.6 },
    { t: 0.75, top: 0x241a2e, horizon: 0xe8783c, sun: 0xff8a3c, sunIntensity: 2.0 },
    { t: 1.0, top: 0x060a14, horizon: 0x1a2030, sun: 0x8fb4d8, sunIntensity: 0.25 },
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
    dawn: 0.25, 清晨: 0.25, 日出: 0.25, 黎明: 0.25,
    morning: 0.35, 上午: 0.35,
    noon: 0.5, day: 0.5, 正午: 0.5, 白天: 0.5, bright: 0.5,
    afternoon: 0.62, 下午: 0.62,
    dusk: 0.75, 黄昏: 0.75, 傍晚: 0.75, 日落: 0.75, golden: 0.72,
    evening: 0.85, 晚间: 0.85,
  }

  const FIRE_TOP = new THREE.Color(0x1a0e08)
  const FIRE_HORIZON = new THREE.Color(0xb54a1e)

  function applyVisualState(): void {
    const sky = sampleSky(lightT)
    // 火险：地平线橙染、天顶压暗
    sky.top.lerp(FIRE_TOP, effects.fire * 0.75)
    sky.horizon.lerp(FIRE_HORIZON, effects.fire * 0.7)
    skyUniforms.topColor.value.copy(sky.top)
    skyUniforms.horizonColor.value.copy(sky.horizon)
    skyUniforms.alpha.value = 0.32 + effects.fire * 0.4
    if (scene.fog instanceof THREE.Fog) scene.fog.color.copy(sky.horizon)

    const az = Math.PI * (1 - lightT)
    sun.position.set(Math.cos(az) * 30, 4 + Math.sin(Math.PI * lightT) * 22, 10)
    sun.color.copy(sky.sun)
    sun.intensity = sky.sunIntensity * (1 - effects.fire * 0.3)
    ambient.intensity = 0.7 * (1 - effects.fire * 0.2)
    rim.color.set(0xffd0a0).lerp(new THREE.Color(0xff8a5c), effects.fire)

    // 地平线图层随雾色插值
    for (let i = 0; i < horizonMaterials.length; i += 1) {
      horizonMaterials[i].color.copy(HORIZON_BASE[i]).lerp(sky.horizon, 0.3 + i * 0.25)
    }

    // 草色随干旱/火险调色（变化才重画）
    const dryNow = clamp01(dry + effects.drought * 0.5)
    if (Math.abs(dryNow - paintedDry) > 0.01) {
      paintGround(dryNow)
      paintedDry = dryNow
    }
    grassMaterial.color.set(0x7a7030).lerp(new THREE.Color(0x9a8040), dryNow)
    grassMaterial.color.lerp(new THREE.Color(0x3a2a1a), effects.fire * 0.6)
    acaciaMaterial.color.set(0x2e2a1c).lerp(new THREE.Color(0x1a1410), effects.fire * 0.5)

    // 兽群密度（preset herdDensity 控制可见数量）
    herd.count = Math.max(4, Math.floor(HERD_COUNT * herdDensity * (1 - effects.fire * 0.7)))

    // 火险：烟柱 + 地面火光
    smoke.visible = effects.fire > 0.03 && session.quality !== "low"
    smokeMaterial.opacity = effects.fire * 0.5
    fireGlowMaterial.opacity = effects.fire * (0.2 + 0.1 * Math.sin(performance.now() * 0.004))
    // 水洼高光随日光
    waterholeMaterial.specular.copy(sky.sun)
  }

  // ================================================================ SceneHandle.apply*
  function applyPreset(preset: ScenePreset | null): void {
    lastPreset = preset
    const visual = preset?.visual
    const lightText = visualText(visual, "light")
    if (lightText) {
      const mapped = Object.entries(LIGHT_TEXT_MAP).find(([key]) => lightText.toLowerCase().includes(key))
      lightT = mapped ? mapped[1] : 0.3
    } else {
      lightT = clamp01(visualNumber(visual, "lightT", visualNumber(visual, "daylight", 0.3)))
    }
    // 干旱度：dry 键优先；季节词兜底（旱季 dry season → 黄草）
    let dryValue = clamp01(visualNumber(visual, "dry", 0.35))
    const season = visualText(visual, "season")
    if (season && matchesAnyKeyword(season, ["旱季", "dry"])) dryValue = Math.max(dryValue, 0.85)
    if (season && matchesAnyKeyword(season, ["雨季", "wet", "春"])) dryValue = Math.min(dryValue, 0.15)
    dry = dryValue
    const grassColor = visualColor(visual, "grassColor")
    if (grassColor) grassMaterial.color.copy(grassColor)
    herdDensity = clamp01(visualNumber(visual, "herdDensity", visualNumber(visual, "migration", 0.8)))
    mist = clamp01(visualNumber(visual, "mist", 0.2))
    applyVisualState()
    session.requestRender()
  }

  function resolveActivityNodeNames(activity: ActivityDefinition): Set<string> {
    const names = collectActivityNodeNames(activity, sceneDef.anchors)
    if (names.size === 0) {
      const text = `${activity.id} ${activity.label}`
      if (matchesAnyKeyword(text, SAFARI_KEYWORDS)) names.add("safari_loop")
      if (matchesAnyKeyword(text, HERD_KEYWORDS)) names.add("herd_zone")
      if (matchesAnyKeyword(text, PHOTO_KEYWORDS)) names.add("viewpoint_a")
      if (matchesAnyKeyword(text, ["水洼", "waterhole", "饮水"])) names.add("waterhole")
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
    let fire = 0
    let drought = 0
    const step = risk.sequence[Math.min(Math.max(stepIndex, 0), risk.sequence.length - 1)]
    for (const action of step?.sceneActions ?? []) {
      const params = action.params
      if (action.kind === "set_weather") {
        if (visualFlag(params, "fire") || visualText(params, "preset") === "fire") {
          fire = Math.max(fire, visualNumber(params, "intensity", 1))
        }
        fire = Math.max(fire, visualNumber(params, "smoke", 0) * 0.8)
        if (visualFlag(params, "drought")) drought = Math.max(drought, visualNumber(params, "intensity", 1))
        drought = Math.max(drought, visualNumber(params, "dry", 0))
      }
      if (action.kind === "highlight_anchor") {
        const names = collectAnchorNodeNames(sceneDef.anchors, action.target ? [action.target] : [])
        if (names.has("risk_fire_zone")) fire = Math.max(fire, 0.5)
      }
    }
    if (matchesAnyKeyword(text, FIRE_KEYWORDS)) fire = Math.max(fire, 0.4 + 0.6 * stepFrac)
    if (matchesAnyKeyword(text, DROUGHT_KEYWORDS)) drought = Math.max(drought, 0.4 + 0.6 * stepFrac)
    effects.fire = clamp01(fire)
    effects.drought = clamp01(drought)
    applyVisualState()
    session.requestRender()
  }

  function restoreCalm(): void {
    effects.fire = 0
    effects.drought = 0
    applyVisualState()
    session.requestRender()
  }

  const THEME_CAMERAS: Partial<Record<ImmersiveTheme, CameraPreset>> = {
    highlights: { position: [2, 8, 26], lookAt: [0, 1, -4], fov: 44 },
    experience: { position: [12, 3.2, 14], lookAt: [-4, 0.8, -6] },
    audience: { position: [-4, 2.6, 16], lookAt: [-8, 0.8, 6] },
    cautions: { position: [14, 5, 16], lookAt: [20, 0.6, 8] },
    nature_geology: { position: [-11, 2.2, 11], lookAt: [-8, 0.6, 6], fov: 42 },
  }

  // ================================================================ 每帧动画
  session.setUpdater((time, delta) => {
    const t = time * 0.001
    // 草海波浪（风随火险增强的热气流扰动）
    {
      const matrix = new THREE.Matrix4()
      const quat = new THREE.Quaternion()
      const pos = new THREE.Vector3()
      const scl = new THREE.Vector3()
      const axis = new THREE.Vector3(0, 0, 1)
      const swayAmp = 0.14 * (1 + effects.fire * 1.6)
      for (let i = 0; i < grassSea.count; i += 1) {
        const base = grassBases[i]
        pos.set(base.x, base.y + 0.3 * base.scale, base.z)
        quat.setFromAxisAngle(axis, Math.sin(t * 1.3 + base.phase + base.x * 0.15) * swayAmp)
        scl.setScalar(base.scale)
        matrix.compose(pos, quat, scl)
        grassSea.setMatrixAt(i, matrix)
      }
      grassSea.instanceMatrix.needsUpdate = true
    }
    // 兽群迁徙：整体沿东西向缓慢移动，个体上下起伏（火险时四散加速）
    {
      const matrix = new THREE.Matrix4()
      const pos = new THREE.Vector3()
      const quat = new THREE.Quaternion()
      const scl = new THREE.Vector3()
      const yAxis = new THREE.Vector3(0, 1, 0)
      const drift = effects.fire > 0.05 ? Math.sin(t * 0.4) * 3 : t * 0.12
      for (let i = 0; i < herd.count; i += 1) {
        const base = herdBases[i]
        // u∈[0,1) 沿 x 从 -30 到 30 循环；lane 横向偏移
        const u = (((base.u + drift * 0.008 * (1 + effects.fire * 4)) % 1) + 1) % 1
        const x = -30 + u * 60
        const z = -13 + base.lane + Math.sin(t * 0.3 + base.phase) * 0.6
        pos.set(x, savannaHeight(x, z) + Math.abs(Math.sin(t * 2 + base.phase)) * 0.06, z)
        quat.setFromAxisAngle(yAxis, Math.PI / 2 + Math.sin(t * 0.5 + base.phase) * 0.15)
        scl.setScalar(base.scale)
        matrix.compose(pos, quat, scl)
        herd.setMatrixAt(i, matrix)
      }
      herd.instanceMatrix.needsUpdate = true
    }
    // 火险烟柱上升循环
    if (smoke.visible) {
      for (let i = 0; i < SMOKE_COUNT; i += 1) {
        const seed = smokeSeeds[i]
        const cycle = (t * seed.speed + seed.offset) % 1
        smokePositions[i * 3] = seed.x + Math.sin(t * 0.8 + seed.wobble) * (0.4 + cycle * 1.6)
        smokePositions[i * 3 + 1] = savannaHeight(seed.x, seed.z) + 0.4 + cycle * 7
        smokePositions[i * 3 + 2] = seed.z + Math.cos(t * 0.7 + seed.wobble) * (0.4 + cycle * 1.4)
      }
      ;(smokeGeometry.attributes.position as THREE.BufferAttribute).needsUpdate = true
      fireGlowMaterial.opacity = effects.fire * (0.2 + 0.12 * Math.sin(t * 5))
    }
    // 水洼微光
    waterholeMaterial.opacity = 0.88 + Math.sin(t * 0.8) * 0.04
    void delta
  })

  // quality 三档差异：草叶实例数 / 烟粒子 drawRange（几何段数在建场景时按初始档位定）
  function applyQualityTier(q: "high" | "standard" | "low"): void {
    grassSea.count = q === "high" ? GRASS_COUNT : q === "standard" ? Math.floor(GRASS_COUNT * 0.65) : Math.floor(GRASS_COUNT * 0.35)
    smokeGeometry.setDrawRange(0, q === "high" ? SMOKE_COUNT : q === "standard" ? 60 : 30)
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
