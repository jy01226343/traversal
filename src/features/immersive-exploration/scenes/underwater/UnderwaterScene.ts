/**
 * 水下场景 · 珊瑚礁 + 鱼群（马尔代夫珊瑚花园风格，SCENES 拥有）
 *
 * 视觉元素（全部程序化）：
 * - 水体雾（FogExp2 深蓝绿，visibility preset 调雾距）+ 水面透光层 + 光线柱（9 根半透明锥体，横向漂移）
 * - 水面光晕双圈（sunGlow 主圈 + 外圈柔光）+ 海底焦散（程序化正弦干涉 ShaderMaterial，强度随 lightDepth）
 * - 上升气泡（珊瑚区 → 水面循环，additive 小点，quality=low 关闭）
 * - 海底地形（起伏平面：沙丘 / reef_flat 平台 / drop_off 断崖，顶点色随深度变暗）
 * - 珊瑚群（InstancedMesh 三类低多边形 + instanceColor）、海草摆动带、礁石洞穴
 * - 鱼群 Points 绕场游动（大小两群，尺寸质感分层）、海龟慢游、游船航道（浮标线 + 水面船影）、入水点绳环
 * - 悬浮浮游生物粒子（plankton preset 调密度，quality=low 关闭）
 * - 风险：海流（定向粒子流 + 警示琥珀色 + 鱼群逃散）、能见度下降（雾距骤缩）、
 *   水面风浪（光柱抖动 + 水面闪烁）
 *
 * preset.visual 解释：visibility / lightDepth / plankton / dusk
 * activity 机位：浮潜→贴水面 / 体验潜水→中层 / 持证潜水→深层 + 手电光锥
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
  normalizeUnitInterval,
  smoothstep,
  visualFlag,
  visualNumber,
  visualText,
} from "../shared"

/** 契约语义节点名握手（CONTRACT.md §SCENES） */
export const UNDERWATER_NODE_NAMES = [
  "entry_point",
  "reef_flat",
  "coral_garden",
  "seagrass",
  "cave",
  "drop_off",
  "fish_school",
  "turtle_zone",
  "boat_channel",
  "risk_current",
] as const

const SNORKEL_KEYWORDS = ["浮潜", "snorkel"] as const
const DISCOVERY_KEYWORDS = ["体验潜水", "体验", "discovery", "discover", "intro", "beginner_dive"] as const
const CERTIFIED_KEYWORDS = ["持证", "深潜", "certified", "advanced", "scuba", "deep"] as const
const CURRENT_KEYWORDS = ["海流", "current", "潮流", "急流", "drift"] as const
const VISIBILITY_KEYWORDS = ["能见度", "visibility", "浑浊", "murk"] as const
const SWELL_KEYWORDS = ["风浪", "swell", "wave", "涌浪", "surge"] as const

/** 海底地形高度（世界坐标） */
function terrainHeight(x: number, z: number): number {
  let y = -4 + Math.sin(x * 0.3) * Math.cos(z * 0.25) * 0.5
  // reef_flat 平台（较浅较平）
  const flatDist = Math.hypot(x - 3.5, z + 1)
  y = lerp(y, -3.3, smoothstep(6, 2, flatDist) * 0.8)
  // drop_off 断崖（x 越大越深）
  y -= smoothstep(8, 15, x) * 10
  return y
}

type HighlightState = "active" | "dim" | "hidden" | "default"
interface HighlightTarget {
  set(state: HighlightState): void
}

export function createUnderwaterScene(canvas: HTMLCanvasElement, sceneDef: ImmersiveSceneDefinition): SceneHandle {
  const session = new SceneSession({
    canvas,
    sceneDef,
    far: 300,
    controls: { minDistance: 3.5, maxDistance: 40, maxPolarAngle: Math.PI * 0.8 },
    bloom: { strength: 0.32, radius: 0.5, threshold: 0.68 },
  })
  const { scene } = session
  scene.add(session.camera) // 手电挂在相机上，需要相机入场景树

  // ================================================================ 水体雾 + 背景 + 灯光
  const FOG_DEFAULT = new THREE.Color(0x06232e)
  const FOG_DUSK = new THREE.Color(0x020d14)
  const FOG_MURK = new THREE.Color(0x1a2a20)
  const FOG_GREEN = new THREE.Color(0x0a3328)
  scene.fog = new THREE.FogExp2(FOG_DEFAULT.getHex(), 0.034)
  // V1.2：背景透明，透出 ix-stage 实景照片层（水下照片与雾色自然融合）
  scene.background = null

  const ambient = new THREE.AmbientLight(0x1c3d4a, 0.85)
  const sunThroughWater = new THREE.DirectionalLight(0x7fd4c9, 1.2)
  sunThroughWater.position.set(0, 10, 2)
  scene.add(ambient, sunThroughWater)

  // 水面透光层（从下方看）
  const surfaceMaterial = new THREE.MeshBasicMaterial({
    color: 0x2a6a7a,
    transparent: true,
    opacity: 0.22,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
  const surface = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), surfaceMaterial)
  surface.name = "water_surface"
  surface.rotation.x = Math.PI / 2
  surface.position.y = 7
  scene.add(surface)

  // 水面光斑（主圈 + 外圈柔光）
  const sunGlowMaterial = new THREE.MeshBasicMaterial({
    color: 0xbfe8dc,
    transparent: true,
    opacity: 0.3,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const sunGlow = new THREE.Mesh(new THREE.CircleGeometry(4.2, 32), sunGlowMaterial)
  sunGlow.name = "sun_glow"
  sunGlow.rotation.x = Math.PI / 2
  sunGlow.position.set(3, 6.9, -2)
  scene.add(sunGlow)
  const sunGlowOuterMaterial = new THREE.MeshBasicMaterial({
    color: 0x8fd4c8,
    transparent: true,
    opacity: 0.1,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const sunGlowOuter = new THREE.Mesh(new THREE.CircleGeometry(7.2, 32), sunGlowOuterMaterial)
  sunGlowOuter.name = "sun_glow_outer"
  sunGlowOuter.rotation.x = Math.PI / 2
  sunGlowOuter.position.set(3, 6.88, -2)
  scene.add(sunGlowOuter)

  // ================================================================ 光线柱（半透明锥柱，缓慢横向漂移）
  const SHAFT_COUNT = 9
  const shaftMaterial = new THREE.MeshBasicMaterial({
    color: 0x9fe8dc,
    transparent: true,
    opacity: 0.08,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const shafts: THREE.Mesh[] = []
  const shaftBaseX: number[] = []
  for (let i = 0; i < SHAFT_COUNT; i += 1) {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 2.4, 13, 12, 1, true), shaftMaterial)
    shaft.name = `light_shaft_${i}`
    shaft.position.set(-10 + i * 2.8 + hashNoise(i, 3.3) * 1.4, 0.5, -5 + hashNoise(i, 7.7) * 9)
    shafts.push(shaft)
    shaftBaseX.push(shaft.position.x)
    scene.add(shaft)
  }

  // ================================================================ 海底地形
  const FLOOR_SIZE = 90
  const FLOOR_SEGMENTS = session.quality === "high" ? 96 : session.quality === "standard" ? 64 : 40
  const floorGeometry = new THREE.PlaneGeometry(FLOOR_SIZE, FLOOR_SIZE, FLOOR_SEGMENTS, FLOOR_SEGMENTS)
  {
    const pos = floorGeometry.attributes.position as THREE.BufferAttribute
    const colors = new Float32Array(pos.count * 3)
    const sand = new THREE.Color(0x8a7a5c)
    const deep = new THREE.Color(0x0a2530)
    const channelSilts = new THREE.Color(0x5a5244)
    const c = new THREE.Color()
    for (let i = 0; i < pos.count; i += 1) {
      const localX = pos.getX(i)
      const localY = pos.getY(i)
      const worldX = localX
      const worldZ = -localY // rotation.x = -π/2 后 local y → world -z
      const h = terrainHeight(worldX, worldZ)
      pos.setZ(i, h)
      const depthFactor = clamp01((-h - 3) / 11)
      c.copy(sand).lerp(deep, depthFactor)
      // 航道区域偏粉砂暗色
      if (Math.abs(worldZ + 7) < 2.2 && worldX > -8 && worldX < 10) c.lerp(channelSilts, 0.5)
      c.multiplyScalar(0.88 + 0.24 * hashNoise(worldX * 1.3, worldZ * 1.3))
      // 海沙纹理（V1.4）：浅区平行沙纹脊 + 细颗粒 speckle 高光
      if (depthFactor < 0.45) {
        const ripple = Math.sin(worldX * 1.9 + Math.sin(worldZ * 0.9) * 2.4 + worldZ * 0.35)
        c.multiplyScalar(1 + ripple * 0.05)
        if (hashNoise(worldX * 7.3, worldZ * 7.3) > 0.9) c.multiplyScalar(1.14)
      }
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }
    floorGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3))
    floorGeometry.computeVertexNormals()
  }
  const floor = new THREE.Mesh(
    floorGeometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }),
  )
  floor.name = "sea_floor"
  floor.rotation.x = -Math.PI / 2
  scene.add(floor)

  // ================================================================ 海底焦散（程序化正弦干涉，additive，贴地形）
  // 覆盖 reef_flat / coral_garden / seagrass / cave 区域；顶点按 terrainHeight 贴合海底
  const CAUSTIC_OFFSET_X = -0.5
  const CAUSTIC_OFFSET_Z = 0.5
  const causticUniforms = {
    uTime: { value: 0 },
    uIntensity: { value: 0.35 },
    uColor: { value: new THREE.Color(0x9fe8d0) },
  }
  const causticGeometry = new THREE.PlaneGeometry(22, 15, 44, 30)
  {
    const pos = causticGeometry.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i += 1) {
      const worldX = pos.getX(i) + CAUSTIC_OFFSET_X
      const worldZ = -pos.getY(i) + CAUSTIC_OFFSET_Z // rotation.x = -π/2 后 local y → world -z
      pos.setZ(i, terrainHeight(worldX, worldZ) + 0.07)
    }
  }
  const causticMaterial = new THREE.ShaderMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    uniforms: causticUniforms,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform float uTime;
      uniform float uIntensity;
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        vec2 p = vUv * 9.0;
        float t = uTime * 0.55;
        float w1 = sin(p.x * 1.7 + t) + sin(p.y * 2.1 - t * 1.3) + sin((p.x + p.y) * 1.4 + t * 0.7);
        float w2 = sin(p.x * 2.3 - t * 0.9) + sin(p.y * 1.5 + t * 1.1) + sin((p.y - p.x) * 1.9 - t * 0.6);
        float c = (w1 + w2) * 0.25 + 0.5;
        float caustic = pow(clamp(c, 0.0, 1.0), 6.0);
        // 边缘淡出，避免贴片硬边
        float edge = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x)
                   * smoothstep(0.0, 0.12, vUv.y) * smoothstep(1.0, 0.88, vUv.y);
        gl_FragColor = vec4(uColor, 1.0) * caustic * uIntensity * edge;
      }`,
  })
  const caustics = new THREE.Mesh(causticGeometry, causticMaterial)
  caustics.name = "sea_floor_caustics"
  caustics.rotation.x = -Math.PI / 2
  caustics.position.set(CAUSTIC_OFFSET_X, 0, CAUSTIC_OFFSET_Z)
  scene.add(caustics)

  // ================================================================ 珊瑚群（InstancedMesh × 3 类 + instanceColor）
  const CORAL_PALETTE = [0xff7d6e, 0xffb35c, 0xc678dd, 0x5cd6c0, 0xe86a8a, 0xf0d78a]
  function scatterCorals(
    geometry: THREE.BufferGeometry,
    spots: Array<{ x: number; z: number; scale: number; rot: number }>,
    name: string,
  ): THREE.InstancedMesh {
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, flatShading: true })
    const mesh = new THREE.InstancedMesh(geometry, material, spots.length)
    mesh.name = name
    const matrix = new THREE.Matrix4()
    const pos = new THREE.Vector3()
    const quat = new THREE.Quaternion()
    const scl = new THREE.Vector3()
    const color = new THREE.Color()
    spots.forEach((spot, i) => {
      pos.set(spot.x, terrainHeight(spot.x, spot.z) + 0.15 * spot.scale, spot.z)
      quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), spot.rot)
      scl.setScalar(spot.scale)
      matrix.compose(pos, quat, scl)
      mesh.setMatrixAt(i, matrix)
      color.set(CORAL_PALETTE[i % CORAL_PALETTE.length]).multiplyScalar(0.85 + hashNoise(i, 9.1) * 0.3)
      mesh.setColorAt(i, color)
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    scene.add(mesh)
    return mesh
  }
  function makeSpots(cx: number, cz: number, radius: number, count: number, seed: number, minS = 0.25, maxS = 0.7) {
    const spots: Array<{ x: number; z: number; scale: number; rot: number }> = []
    for (let i = 0; i < count; i += 1) {
      const a = hashNoise(i, seed) * Math.PI * 2
      const r = Math.sqrt(hashNoise(i, seed + 1.7)) * radius
      spots.push({
        x: cx + Math.cos(a) * r,
        z: cz + Math.sin(a) * r,
        scale: minS + hashNoise(i, seed + 3.1) * (maxS - minS),
        rot: hashNoise(i, seed + 5.5) * Math.PI * 2,
      })
    }
    return spots
  }
  // ---------------------------------------------------------------- 程序化珊瑚几何（V1.4：四种真实形态，确定性 hashNoise 驱动）
  /** 鹿角珊瑚：递归分支锥柱（2-3 级分叉） */
  function buildStaghornGeometry(seed = 0): THREE.BufferGeometry {
    const parts: THREE.BufferGeometry[] = []
    const up = new THREE.Vector3(0, 1, 0)
    const branch = (origin: THREE.Vector3, dir: THREE.Vector3, length: number, radius: number, depth: number): void => {
      const seg = new THREE.CylinderGeometry(radius * 0.55, radius, length, 5)
      seg.translate(0, length / 2, 0)
      seg.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize()))
      seg.translate(origin.x, origin.y, origin.z)
      parts.push(seg)
      if (depth <= 0) return
      const end = origin.clone().addScaledVector(dir, length)
      const children = 2 + Math.floor(hashNoise(seed + depth * 1.7, length * 10) * 2)
      for (let i = 0; i < children; i += 1) {
        const spread = 0.5 + hashNoise(i, seed + depth * 3.1) * 0.5
        const nd = dir
          .clone()
          .add(new THREE.Vector3(
            (hashNoise(i, 1.1 + seed + depth) - 0.5) * 2 * spread,
            hashNoise(i, 2.3 + seed + depth) * 0.7,
            (hashNoise(i, 3.7 + seed + depth) - 0.5) * 2 * spread,
          ))
          .normalize()
        branch(end, nd, length * 0.62, radius * 0.62, depth - 1)
      }
    }
    branch(new THREE.Vector3(0, 0, 0), up.clone(), 0.34, 0.075, 3)
    return mergeGeometries(parts) ?? new THREE.ConeGeometry(0.3, 0.9, 6)
  }
  /** 脑珊瑚：球体多频沟槽位移（脑回纹） */
  function buildBrainCoralGeometry(): THREE.BufferGeometry {
    const geo = new THREE.SphereGeometry(0.5, 26, 20)
    const pos = geo.attributes.position as THREE.BufferAttribute
    const n = new THREE.Vector3()
    for (let i = 0; i < pos.count; i += 1) {
      n.set(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize()
      const groove = Math.sin(n.x * 14 + n.y * 6) * Math.sin(n.z * 12 - n.y * 5)
      const d = 0.045 * groove + 0.05 * (fbm2D(n.x * 4 + 3, n.z * 4 + 7, 3) - 0.5)
      const r = 0.5 + d
      pos.setXYZ(i, n.x * r, Math.max(n.y, -0.12) * r * 0.72, n.z * r)
    }
    geo.computeVertexNormals()
    return geo
  }
  /** 扇珊瑚：底部收窄、扇面展开并微卷的网格 */
  function buildFanCoralGeometry(): THREE.BufferGeometry {
    const geo = new THREE.PlaneGeometry(1.0, 0.9, 14, 10)
    const pos = geo.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      const v = (y + 0.45) / 0.9 // 0 底 → 1 顶
      const spread = 0.15 + v * 0.85
      pos.setXYZ(i, x * spread, v * 0.9, Math.sin(x * 4) * 0.04 * v + v * v * 0.18)
    }
    geo.computeVertexNormals()
    return geo
  }
  /** 软珊瑚：一簇顶端弯曲的触手锥 */
  function buildSoftCoralGeometry(): THREE.BufferGeometry {
    const parts: THREE.BufferGeometry[] = []
    for (let i = 0; i < 7; i += 1) {
      const h = 0.5 + hashNoise(i, 2.2) * 0.4
      const cone = new THREE.ConeGeometry(0.07, h, 6)
      cone.translate(0, h / 2, 0)
      const bend = (hashNoise(i, 4.4) - 0.5) * 0.5
      const p = cone.attributes.position as THREE.BufferAttribute
      for (let j = 0; j < p.count; j += 1) {
        const y = p.getY(j)
        p.setX(j, p.getX(j) + bend * (y / h) * (y / h) * 0.4)
      }
      const angle = (i / 7) * Math.PI * 2
      cone.rotateZ((hashNoise(i, 6.6) - 0.5) * 0.7)
      cone.rotateY(angle)
      cone.translate(Math.cos(angle) * 0.12, 0, Math.sin(angle) * 0.12)
      parts.push(cone)
    }
    return mergeGeometries(parts) ?? new THREE.ConeGeometry(0.2, 0.8, 6)
  }

  // 珊瑚花园（密集）+ reef_flat（稀疏）：鹿角 / 脑珊瑚 / 扇珊瑚 / 软珊瑚四类
  const coralMeshes: THREE.InstancedMesh[] = []
  function scatterCoralKind(
    geometry: THREE.BufferGeometry,
    spots: Array<{ x: number; z: number; scale: number; rot: number }>,
    name: string,
  ): void {
    coralMeshes.push(scatterCorals(geometry, spots, name))
  }
  scatterCoralKind(buildBrainCoralGeometry(), [...makeSpots(-3.5, 1.8, 3.2, 16, 1.3), ...makeSpots(3.5, -1, 4, 7, 2.9, 0.2, 0.45)], "coral_brain")
  scatterCoralKind(buildStaghornGeometry(0), [...makeSpots(-3.5, 1.8, 3.4, 14, 4.7), ...makeSpots(3.5, -1, 4, 6, 6.1, 0.2, 0.4)], "coral_staghorn")
  scatterCoralKind(buildStaghornGeometry(5.5), makeSpots(-3.2, 2.2, 3.0, 8, 8.3, 0.4, 0.85), "coral_staghorn_b")
  scatterCoralKind(buildFanCoralGeometry(), [...makeSpots(-4.2, 1.2, 3.0, 12, 10.9, 0.5, 1.0), ...makeSpots(3.8, -1.4, 3.6, 5, 12.7, 0.4, 0.7)], "coral_fan")
  scatterCoralKind(buildSoftCoralGeometry(), [...makeSpots(-2.8, 2.6, 2.8, 10, 14.3, 0.5, 1.0), ...makeSpots(4.2, -0.6, 3.2, 4, 16.1, 0.4, 0.7)], "coral_soft")
  const CORAL_FULL_COUNTS = coralMeshes.map(mesh => mesh.count)

  // ================================================================ 海草摆动带
  const GRASS_COUNT = 36
  const grassGeometry = new THREE.PlaneGeometry(0.14, 1.5)
  const grassMaterial = new THREE.MeshStandardMaterial({ color: 0x3f9e6d, roughness: 1, side: THREE.DoubleSide })
  const seagrass = new THREE.InstancedMesh(grassGeometry, grassMaterial, GRASS_COUNT)
  seagrass.name = "seagrass_blades"
  const grassBases: Array<{ x: number; z: number; y: number; phase: number; scale: number }> = []
  for (let i = 0; i < GRASS_COUNT; i += 1) {
    const x = -8.5 + hashNoise(i, 2.7) * 3.4
    const z = -4.5 + hashNoise(i, 6.3) * 3.2
    grassBases.push({
      x,
      z,
      y: terrainHeight(x, z),
      phase: hashNoise(i, 8.9) * Math.PI * 2,
      scale: 0.7 + hashNoise(i, 4.5) * 0.6,
    })
  }
  scene.add(seagrass)

  // ================================================================ 洞穴（暗色块拱）
  const caveGroup = new THREE.Group()
  caveGroup.name = "reef_cave"
  const caveMaterial = new THREE.MeshStandardMaterial({ color: 0x1a222a, roughness: 1, flatShading: true })
  const caveFloorY = terrainHeight(-10, 5.5)
  const caveLeft = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.2, 1.6), caveMaterial)
  caveLeft.position.set(-1.1, 1.1, 0)
  const caveRight = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.9, 1.6), caveMaterial)
  caveRight.position.set(1.1, 0.95, 0)
  const caveTop = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.8, 1.8), caveMaterial)
  caveTop.position.set(0, 2.2, 0)
  const caveMouth = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 1.6),
    new THREE.MeshBasicMaterial({ color: 0x020608 }),
  )
  caveMouth.position.set(0, 0.9, 0.82)
  caveGroup.add(caveLeft, caveRight, caveTop, caveMouth)
  caveGroup.position.set(-10, caveFloorY, 5.5)
  caveGroup.lookAt(-6, caveFloorY + 0.5, 3)
  scene.add(caveGroup)

  // ================================================================ 鱼群（大群 InstancedMesh 摆尾游动，小群 Points 远景碎银）
  /** 程序化小鱼几何：侧扁锥身 + 尾鳍，头朝 +z */
  function buildFishGeometry(): THREE.BufferGeometry {
    const body = new THREE.ConeGeometry(0.085, 0.4, 6)
    body.rotateX(Math.PI / 2)
    body.scale(0.55, 1, 1)
    const tail = new THREE.ConeGeometry(0.075, 0.16, 4)
    tail.rotateX(-Math.PI / 2)
    tail.scale(0.3, 1, 1)
    tail.translate(0, 0, -0.25)
    return mergeGeometries([body, tail]) ?? body
  }
  const FISH_COUNT = 110
  const FISH_LARGE = 55 // 前 55 条为大鱼群（近景主体，摆尾动画），其余为小鱼群（远景碎银）
  const fishPositionsSmall = new Float32Array((FISH_COUNT - FISH_LARGE) * 3)
  const fishParams: Array<{ angle: number; radius: number; height: number; speed: number; wobble: number; size: number }> = []
  for (let i = 0; i < FISH_COUNT; i += 1) {
    fishParams.push({
      angle: hashNoise(i, 1.9) * Math.PI * 2,
      radius: 2.8 + hashNoise(i, 3.7) * 3.4,
      height: -3 + hashNoise(i, 5.3) * 3.2,
      speed: 0.6 + hashNoise(i, 7.1) * 0.8,
      wobble: hashNoise(i, 9.7) * Math.PI * 2,
      size: 0.75 + hashNoise(i, 12.3) * 0.55,
    })
  }
  const fishMaterial = new THREE.MeshStandardMaterial({ color: 0xbfe8e0, roughness: 0.55, metalness: 0.25, flatShading: true })
  const fishSchool = new THREE.InstancedMesh(buildFishGeometry(), fishMaterial, FISH_LARGE)
  fishSchool.name = "fish_school_points"
  {
    const tint = new THREE.Color()
    for (let i = 0; i < FISH_LARGE; i += 1) {
      tint.set(0xbfe8e0).multiplyScalar(0.75 + hashNoise(i, 15.1) * 0.45)
      fishSchool.setColorAt(i, tint)
    }
    if (fishSchool.instanceColor) fishSchool.instanceColor.needsUpdate = true
  }
  scene.add(fishSchool)
  const fishGeometrySmall = new THREE.BufferGeometry()
  fishGeometrySmall.setAttribute("position", new THREE.BufferAttribute(fishPositionsSmall, 3))
  const fishMaterialSmall = new THREE.PointsMaterial({ color: 0x9fc8c0, size: 0.09, transparent: true, opacity: 0.8, depthWrite: false })
  const fishSchoolSmall = new THREE.Points(fishGeometrySmall, fishMaterialSmall)
  fishSchoolSmall.name = "fish_school_points_small"
  scene.add(fishSchoolSmall)

  // ================================================================ 海龟（简单多面体慢游）
  const turtle = new THREE.Group()
  turtle.name = "sea_turtle"
  const turtleShellMat = new THREE.MeshStandardMaterial({ color: 0x4a5a3a, roughness: 0.9, flatShading: true })
  const turtleBodyMat = new THREE.MeshStandardMaterial({ color: 0x6a7a5a, roughness: 0.9, flatShading: true })
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), turtleShellMat)
  shell.scale.set(1.2, 0.5, 0.9)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), turtleBodyMat)
  head.position.set(0.68, 0.02, 0)
  const flippers: THREE.Mesh[] = []
  for (const [fx, fz] of [[0.3, 0.5], [0.3, -0.5], [-0.35, 0.45], [-0.35, -0.45]] as const) {
    const flipper = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.22), turtleBodyMat)
    flipper.position.set(fx, -0.08, fz)
    flipper.rotation.y = fz > 0 ? 0.5 : -0.5
    turtle.add(flipper)
    flippers.push(flipper)
  }
  turtle.add(shell, head)
  scene.add(turtle)
  const TURTLE_CENTER = new THREE.Vector3(6, -2.2, 4)

  // ================================================================ 游船航道（浮标线 + 水面船影）
  const channelGroup = new THREE.Group()
  channelGroup.name = "boat_channel_markers"
  const channelBuoyMat = new THREE.MeshBasicMaterial({ color: 0xd8b25c, transparent: true, opacity: 0.8, depthWrite: false })
  for (let i = 0; i < 4; i += 1) {
    const buoy = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), channelBuoyMat)
    buoy.position.set(0, 0.4 + i * 2.1, -7)
    channelGroup.add(buoy)
  }
  const boatShadow = new THREE.Mesh(
    new THREE.BoxGeometry(3.6, 0.8, 1.5),
    new THREE.MeshStandardMaterial({ color: 0x0a141c, roughness: 1, flatShading: true }),
  )
  boatShadow.name = "boat_hull_shadow"
  boatShadow.position.set(0.5, 6.85, -7.2)
  channelGroup.add(boatShadow)
  scene.add(channelGroup)

  // ================================================================ 入水点（绳环 + 下潜绳）
  const entryGroup = new THREE.Group()
  entryGroup.name = "entry_point_rig"
  const entryRingMat = new THREE.MeshBasicMaterial({ color: 0x8fd6ff, transparent: true, opacity: 0.7, depthWrite: false })
  const entryRing = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.05, 8, 24), entryRingMat)
  entryRing.rotation.x = Math.PI / 2
  const entryRope = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 5.2, 6),
    new THREE.MeshBasicMaterial({ color: 0x9fb8c8, transparent: true, opacity: 0.55 }),
  )
  entryRope.position.y = -2.6
  entryGroup.add(entryRing, entryRope)
  entryGroup.position.set(1.5, 6.3, -6)
  scene.add(entryGroup)

  // ================================================================ 浮游生物 + 海流粒子
  const PLANKTON_COUNT = 240
  const planktonPositions = new Float32Array(PLANKTON_COUNT * 3)
  const planktonBase = new Float32Array(PLANKTON_COUNT * 3)
  for (let i = 0; i < PLANKTON_COUNT; i += 1) {
    planktonBase[i * 3] = -15 + hashNoise(i, 1.1) * 30
    planktonBase[i * 3 + 1] = -5 + hashNoise(i, 2.3) * 11
    planktonBase[i * 3 + 2] = -12 + hashNoise(i, 3.5) * 22
  }
  planktonPositions.set(planktonBase)
  const planktonGeometry = new THREE.BufferGeometry()
  planktonGeometry.setAttribute("position", new THREE.BufferAttribute(planktonPositions, 3))
  // 微光浮游生物：柔光纹理 + additive，随水流闪烁（V1.4 质感升级）
  const planktonMaterial = new THREE.PointsMaterial({
    color: 0xc8e8d8,
    size: 0.05,
    map: createRadialGlowTexture(24),
    transparent: true,
    opacity: 0.4,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const plankton = new THREE.Points(planktonGeometry, planktonMaterial)
  plankton.name = "plankton_particles"
  scene.add(plankton)

  const CURRENT_COUNT = 140
  const currentPositions = new Float32Array(CURRENT_COUNT * 3)
  const currentSpeed = new Float32Array(CURRENT_COUNT)
  for (let i = 0; i < CURRENT_COUNT; i += 1) {
    currentPositions[i * 3] = -8 + hashNoise(i, 4.1) * 18
    currentPositions[i * 3 + 1] = -4.2 + hashNoise(i, 5.9) * 3.6
    currentPositions[i * 3 + 2] = -8.5 + hashNoise(i, 7.3) * 3
    currentSpeed[i] = 0.8 + hashNoise(i, 9.5) * 1.4
  }
  const currentGeometry = new THREE.BufferGeometry()
  currentGeometry.setAttribute("position", new THREE.BufferAttribute(currentPositions, 3))
  const currentMaterial = new THREE.PointsMaterial({ color: 0xe8b34a, size: 0.09, transparent: true, opacity: 0, depthWrite: false })
  const currentStream = new THREE.Points(currentGeometry, currentMaterial)
  currentStream.name = "current_stream"
  currentStream.visible = false
  scene.add(currentStream)

  // ================================================================ 上升气泡（珊瑚区 → 水面循环，quality=low 关闭）
  const BUBBLE_COUNT = 60
  const bubblePositions = new Float32Array(BUBBLE_COUNT * 3)
  const bubbleSeeds: Array<{ x: number; z: number; floorY: number; offset: number; speed: number; wobble: number }> = []
  for (let i = 0; i < BUBBLE_COUNT; i += 1) {
    // 一半出自珊瑚花园，一半出自 reef_flat
    const cx = i % 2 === 0 ? -3.5 : 3.5
    const cz = i % 2 === 0 ? 1.8 : -1
    const x = cx + (hashNoise(i, 1.7) - 0.5) * 4.5
    const z = cz + (hashNoise(i, 3.1) - 0.5) * 4.5
    bubbleSeeds.push({
      x,
      z,
      floorY: terrainHeight(x, z),
      offset: hashNoise(i, 5.3),
      speed: 0.045 + hashNoise(i, 7.7) * 0.06,
      wobble: hashNoise(i, 9.9) * Math.PI * 2,
    })
  }
  const bubbleGeometry = new THREE.BufferGeometry()
  bubbleGeometry.setAttribute("position", new THREE.BufferAttribute(bubblePositions, 3))
  const bubbleMaterial = new THREE.PointsMaterial({
    color: 0xd8f4ec,
    size: 0.08,
    map: createRadialGlowTexture(32),
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const bubbles = new THREE.Points(bubbleGeometry, bubbleMaterial)
  bubbles.name = "rising_bubbles"
  scene.add(bubbles)

  // ================================================================ 手电光锥（持证潜水）
  const flashlight = new THREE.SpotLight(0xfff2cc, 0, 32, 0.5, 0.45, 1.2)
  flashlight.position.set(0, 0, 0)
  const flashlightTarget = new THREE.Object3D()
  flashlightTarget.position.set(0, -0.35, -8)
  session.camera.add(flashlight, flashlightTarget)
  flashlight.target = flashlightTarget
  const torchConeMaterial = new THREE.MeshBasicMaterial({
    color: 0xfff2cc,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const torchCone = new THREE.Mesh(new THREE.ConeGeometry(1.5, 7, 16, 1, true), torchConeMaterial)
  torchCone.name = "torch_cone"
  // 窄端（锥尖）贴相机、宽端朝向前方 -z
  torchCone.rotation.x = Math.PI / 2
  torchCone.position.set(0, -0.2, -4)
  session.camera.add(torchCone)

  // ================================================================ 契约语义节点 + 标记柱
  const nodes = new Map<string, THREE.Object3D>()
  function node(name: string, x: number, y: number, z: number, markerScale = 1): THREE.Object3D {
    const n = createNamedNode(scene, name, x, y, z)
    nodes.set(name, n)
    session.markers.addMarker(name, new THREE.Vector3(x, y, z), { scale: markerScale })
    return n
  }
  node("entry_point", 1.5, 5.7, -6, 0.9)
  node("reef_flat", 3.5, -3.0, -1, 1.0)
  node("coral_garden", -3.5, -2.9, 1.8, 1.05)
  node("seagrass", -7, -3.1, -3, 0.9)
  node("cave", -9.2, caveFloorY + 1.1, 4.6, 0.95)
  node("drop_off", 8.5, -4.0, 0, 1.0)
  node("fish_school", 0, -1.4, 0, 1.0)
  node("turtle_zone", TURTLE_CENTER.x, TURTLE_CENTER.y, TURTLE_CENTER.z, 0.9)
  node("boat_channel", 0, -3.2, -7, 0.95)
  node("risk_current", 3, -2.4, -6, 1.0)

  // ================================================================ 高亮系统（区域环增亮）
  const zoneRingMaterial = new THREE.MeshBasicMaterial({ color: 0x8fd6ff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })
  const zoneRings = new Map<string, THREE.Mesh>()
  function addZoneRing(name: string, x: number, z: number, radius: number): void {
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius - 0.12, radius, 40), zoneRingMaterial.clone())
    ring.name = `zone_ring:${name}`
    ring.rotation.x = -Math.PI / 2
    ring.position.set(x, terrainHeight(x, z) + 0.25, z)
    scene.add(ring)
    zoneRings.set(name, ring)
  }
  addZoneRing("coral_garden", -3.5, 1.8, 3.6)
  addZoneRing("reef_flat", 3.5, -1, 4.2)
  addZoneRing("seagrass", -7, -3, 2.4)
  addZoneRing("turtle_zone", TURTLE_CENTER.x, TURTLE_CENTER.z, 2.6)
  addZoneRing("drop_off", 8.5, 0, 3.0)

  function makeZoneRingTarget(name: string): HighlightTarget {
    const ring = zoneRings.get(name)!
    const material = ring.material as THREE.MeshBasicMaterial
    return {
      set(state) {
        material.opacity = state === "active" ? 0.65 : state === "dim" ? 0.1 : state === "hidden" ? 0.03 : 0
        material.color.set(state === "active" ? 0xffd28e : 0x8fd6ff)
      },
    }
  }
  /** 鱼群高亮：大鱼群变暖色 + 自发光，小鱼群同步变大变暖 */
  function makeFishTarget(): HighlightTarget {
    return {
      set(state) {
        fishMaterial.color.set(state === "active" ? 0xffe8b0 : state === "dim" ? 0x5a7a78 : state === "hidden" ? 0x2a3a38 : 0xbfe8e0)
        fishMaterial.emissive.set(state === "active" ? 0x4a3a18 : 0x000000)
        fishMaterialSmall.size = state === "active" ? 0.13 : 0.09
        fishMaterialSmall.color.set(state === "active" ? 0xffe0a0 : state === "dim" ? 0x5a7a78 : state === "hidden" ? 0x3a4a48 : 0x9fc8c0)
        fishMaterialSmall.opacity = state === "hidden" ? 0.22 : state === "dim" ? 0.45 : 0.8
      },
    }
  }
  const highlightables = new Map<string, HighlightTarget>([
    ...[...zoneRings.keys()].map((name): [string, HighlightTarget] => [name, makeZoneRingTarget(name)]),
    ["fish_school", makeFishTarget()],
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
  let visibility = 0.7
  let lightDepth = 0.6
  let dusk = 0
  let greenTint = 0
  let baseSwell = 0.1
  const effects = { current: 0, visibilityDrop: 0, swell: 0 }
  let deepDiveMode = false

  function applyVisualState(): void {
    // 雾距：visibility preset × 能见度风险
    const baseFogDensity = lerp(0.085, 0.02, clamp01(visibility))
    const fogDensity = baseFogDensity * (1 + effects.visibilityDrop * 2.2)
    if (scene.fog instanceof THREE.FogExp2) {
      scene.fog.density = fogDensity
      const fogColor = FOG_DEFAULT.clone().lerp(FOG_DUSK, dusk)
      fogColor.lerp(FOG_MURK, effects.visibilityDrop * 0.55)
      fogColor.lerp(FOG_GREEN, greenTint * 0.5)
      scene.fog.color.copy(fogColor)
      if (scene.background instanceof THREE.Color) scene.background.copy(fogColor).multiplyScalar(0.55)
    }
    // 光柱：lightDepth preset × dusk 暖色 × 海流警示色
    const shaftColor = new THREE.Color(0x9fe8dc).lerp(new THREE.Color(0xe8c98a), Math.max(dusk, effects.current * 0.45))
    shaftMaterial.color.copy(shaftColor)
    shaftMaterial.opacity = lerp(0.03, 0.14, clamp01(lightDepth)) * (1 - effects.visibilityDrop * 0.5)
    sunThroughWater.intensity = lerp(0.5, 1.7, clamp01(lightDepth)) * (1 - dusk * 0.45) * (1 - greenTint * 0.25)
    sunThroughWater.color.set(dusk > 0.5 ? 0xe8c98a : 0x7fd4c9)
    ambient.intensity = 0.85 * (1 - dusk * 0.4) * (1 - effects.visibilityDrop * 0.25)
    sunGlowMaterial.opacity = lerp(0.12, 0.38, clamp01(lightDepth)) * (1 - dusk * 0.5)
    sunGlowOuterMaterial.opacity = lerp(0.04, 0.15, clamp01(lightDepth)) * (1 - dusk * 0.5)
    // 海底焦散：强度随 lightDepth，暮色/低能见度时衰减，颜色随光柱警示色
    causticUniforms.uIntensity.value = lerp(0.1, 0.55, clamp01(lightDepth)) * (1 - effects.visibilityDrop * 0.7) * (1 - dusk * 0.6)
    causticUniforms.uColor.value.copy(shaftColor)
    // 水面
    surfaceMaterial.color.set(dusk > 0.5 ? 0x3a4a5a : 0x2a6a7a)
    // 浮游生物密度
    planktonMaterial.opacity = clamp01(0.1 + planktonDensity * 0.5)
    plankton.visible = planktonDensity > 0.03 && session.quality !== "low"
    // 海流粒子
    currentStream.visible = effects.current > 0.02 && session.quality !== "low"
    currentMaterial.opacity = effects.current * 0.85
    fishSchool.visible = session.quality !== "low"
    fishSchoolSmall.visible = session.quality !== "low"
    // 上升气泡：quality=low 关闭
    bubbles.visible = session.quality !== "low"
    // 手电
    flashlight.intensity = deepDiveMode ? 90 : 0
    torchConeMaterial.opacity = deepDiveMode ? 0.07 : 0
  }

  let planktonDensity = 0.5

  // ================================================================ SceneHandle.apply*
  function applyPreset(preset: ScenePreset | null): void {
    lastPreset = preset
    const visual = preset?.visual
    // 双模量纲：≤1 视为比例；>1 视为米数（能见度按 3–25m、光穿透按 0–25m 归一）
    const visibilityValue = visualNumber(visual, "visibility", 0.7)
    visibility = visibilityValue <= 1 ? clamp01(visibilityValue) : normalizeUnitInterval(visibilityValue, 25, 3)
    const lightDepthValue = visualNumber(visual, "lightDepth", 0.6)
    lightDepth = lightDepthValue <= 1 ? clamp01(lightDepthValue) : normalizeUnitInterval(lightDepthValue, 25)
    planktonDensity = clamp01(visualNumber(visual, "plankton", 0.5))
    // 水面浪高（DATA 约定 waveHeight 0..1）→ 光柱抖动/水面闪烁基线
    baseSwell = clamp01(visualNumber(visual, "waveHeight", 0.2)) * 0.5
    // dusk / light 文案：dusk_blue → 暮色；diffused_green → 绿调散射
    let duskValue = visualFlag(visual, "dusk") ? 1 : clamp01(visualNumber(visual, "dusk", 0))
    const lightText = visualText(visual, "light")
    if (lightText && matchesAnyKeyword(lightText, ["dusk", "黄昏", "傍晚"])) duskValue = Math.max(duskValue, 1)
    dusk = duskValue
    greenTint = lightText && matchesAnyKeyword(lightText, ["diffused", "green", "散射"]) ? 1 : 0
    applyVisualState()
    session.requestRender()
  }

  function resolveActivityNodeNames(activity: ActivityDefinition): Set<string> {
    return collectActivityNodeNames(activity, sceneDef.anchors)
  }

  function applyActivity(activity: ActivityDefinition | null): void {
    activityHighlight.clear()
    deepDiveMode = false
    if (activity) {
      const names = resolveActivityNodeNames(activity)
      if (names.size > 0) {
        for (const name of highlightables.keys()) {
          activityHighlight.set(name, names.has(name) ? "active" : "dim")
        }
      }
      // 机位分层：浮潜贴水面 / 体验潜水中层 / 持证潜水深层 + 手电
      const text = `${activity.id} ${activity.label}`
      if (matchesAnyKeyword(text, SNORKEL_KEYWORDS)) {
        session.moveCamera({ position: [0, 5.4, 6.5], lookAt: [-1, -1.5, -1], fov: 50 })
      } else if (matchesAnyKeyword(text, CERTIFIED_KEYWORDS)) {
        deepDiveMode = true
        session.moveCamera({ position: [6.5, -2.2, 4.5], lookAt: [10, -5.5, -2], fov: 55 })
      } else if (matchesAnyKeyword(text, DISCOVERY_KEYWORDS)) {
        session.moveCamera({ position: [3, 0.6, 8], lookAt: [-2.5, -2.5, 0.5] })
      }
    }
    refreshHighlights()
    applyVisualState()
    session.requestRender()
  }

  function applyAudience(audience: AudienceDefinition | null): void {
    audienceHidden.clear()
    if (audience) {
      for (const routeId of audience.hiddenRouteIds ?? []) {
        for (const name of nodeNamesFromRef(routeId)) audienceHidden.add(name)
      }
      // 不允许的玩法 → 对应区域降透明度；亲子/新手额外淡化深层区
      for (const activity of sceneDef.activities) {
        if (audience.allowedActivityIds.includes(activity.id)) continue
        for (const name of resolveActivityNodeNames(activity)) audienceHidden.add(name)
      }
      if (audience.id === "toddler_family" || audience.id === "beginner" || audience.id === "senior") {
        audienceHidden.add("drop_off")
      }
    }
    refreshHighlights()
    session.requestRender()
  }

  function applyRiskStep(risk: RiskScenarioDefinition, stepIndex: number): void {
    const stepFrac = risk.sequence.length > 1 ? clamp01(stepIndex / (risk.sequence.length - 1)) : 1
    const text = `${risk.id} ${risk.label} ${risk.cause.join(" ")} ${risk.sequence.map(s => `${s.title} ${s.description}`).join(" ")}`
    let current = 0
    let visibilityDrop = 0
    let swell = 0
    // 当前步的 sceneActions（DATA 每步完整重述，故不累计）
    const step = risk.sequence[Math.min(Math.max(stepIndex, 0), risk.sequence.length - 1)]
    for (const action of step?.sceneActions ?? []) {
      const params = action.params
      if (action.kind === "set_water") {
        // DATA 约定：current（海流）、waveHeight / surfaceChop（水面风浪）、downcurrent（下降流加成）
        current = Math.max(current, visualNumber(params, "current", 0))
        if (visualFlag(params, "downcurrent")) current = Math.min(1, current + 0.15)
        swell = Math.max(
          swell,
          visualNumber(params, "waveHeight", 0),
          visualNumber(params, "surfaceChop", 0),
          visualNumber(params, "wave", visualNumber(params, "swell", 0)),
        )
        visibilityDrop = Math.max(visibilityDrop, visualNumber(params, "turbidity", 0))
      }
      if (action.kind === "set_light") {
        // DATA 约定：低能见度步骤用 set_light { visibility: <米数>, plankton }（plankton 折入雾中悬浮物）
        const visParam = visualNumber(params, "visibility", Number.NaN)
        if (Number.isFinite(visParam)) {
          visibilityDrop = Math.max(visibilityDrop, visParam <= 1 ? 1 - visParam : clamp01((20 - visParam) / 17))
        }
        if (visualFlag(params, "low_visibility") || visualText(params, "preset") === "low_visibility") {
          visibilityDrop = Math.max(visibilityDrop, visualNumber(params, "intensity", 1))
        }
        if (visualFlag(params, "dim")) visibilityDrop = Math.max(visibilityDrop, visualNumber(params, "intensity", 0.5))
      }
      if (action.kind === "set_weather" && (visualFlag(params, "low_visibility") || visualText(params, "preset") === "low_visibility")) {
        visibilityDrop = Math.max(visibilityDrop, visualNumber(params, "intensity", 1))
      }
    }
    if (matchesAnyKeyword(text, CURRENT_KEYWORDS)) current = Math.max(current, 0.4 + 0.6 * stepFrac)
    if (matchesAnyKeyword(text, VISIBILITY_KEYWORDS)) visibilityDrop = Math.max(visibilityDrop, 0.4 + 0.6 * stepFrac)
    if (matchesAnyKeyword(text, SWELL_KEYWORDS)) swell = Math.max(swell, 0.35 + 0.65 * stepFrac)
    effects.current = clamp01(current)
    effects.visibilityDrop = clamp01(visibilityDrop)
    effects.swell = clamp01(swell)
    applyVisualState()
    session.requestRender()
  }

  function restoreCalm(): void {
    effects.current = 0
    effects.visibilityDrop = 0
    effects.swell = 0
    applyVisualState()
    session.requestRender()
  }

  const THEME_CAMERAS: Partial<Record<ImmersiveTheme, CameraPreset>> = {
    highlights: { position: [0, 1.5, 13], lookAt: [0, -2, 0], fov: 48 },
    experience: { position: [3, 0.5, 8.5], lookAt: [-2, -2, 0] },
    audience: { position: [-1, 1.8, 9], lookAt: [3.5, -2.5, -1] },
    cautions: { position: [5.5, 0.2, 2], lookAt: [3, -2.5, -6] },
    underwater_ecology: { position: [-4, -0.6, 5.5], lookAt: [-3.5, -3, 1.5], fov: 42 },
  }

  // ================================================================ 每帧动画
  let turtleAngle = 0
  session.setUpdater((time, delta) => {
    const t = time * 0.001
    const totalSwell = clamp01(baseSwell + effects.swell)
    // 光柱摇曳（水面浪高/风浪 → 抖动加剧）+ 缓慢横向漂移
    for (let i = 0; i < SHAFT_COUNT; i += 1) {
      shafts[i].rotation.z = Math.sin(t * 0.6 + i * 1.7) * 0.03 * (1 + totalSwell * 5)
      shafts[i].rotation.x = Math.cos(t * 0.45 + i) * 0.02 * (1 + totalSwell * 4)
      shafts[i].position.x = shaftBaseX[i] + Math.sin(t * 0.12 + i * 1.3) * 0.9
    }
    // 海底焦散随时间流动（quality=low 冻结为静态帧）
    if (session.quality !== "low") {
      causticUniforms.uTime.value = t
    }
    // 上升气泡：珊瑚区缓慢上升，到水面消失循环
    if (bubbles.visible) {
      for (let i = 0; i < BUBBLE_COUNT; i += 1) {
        const seed = bubbleSeeds[i]
        const cycle = (t * seed.speed + seed.offset) % 1
        bubblePositions[i * 3] = seed.x + Math.sin(t * 1.3 + seed.wobble) * 0.22
        bubblePositions[i * 3 + 1] = lerp(seed.floorY + 0.3, 6.7, cycle)
        bubblePositions[i * 3 + 2] = seed.z + Math.cos(t * 1.1 + seed.wobble) * 0.22
      }
      ;(bubbleGeometry.attributes.position as THREE.BufferAttribute).needsUpdate = true
    }
    // 水面起伏闪烁
    surfaceMaterial.opacity = 0.2 + Math.sin(t * 0.5) * 0.03 + totalSwell * Math.abs(Math.sin(t * 8)) * 0.12
    // 鱼群游动（海流 → 加速逃散）；大鱼群逐实例摆尾 + 朝向航向
    const scatter = 1 + effects.current * 0.5
    const drift = effects.current * 2.2
    {
      const m = new THREE.Matrix4()
      const p = new THREE.Vector3()
      const q = new THREE.Quaternion()
      const e = new THREE.Euler()
      const s = new THREE.Vector3()
      for (let i = 0; i < FISH_COUNT; i += 1) {
        const fp = fishParams[i]
        fp.angle += delta * 0.24 * fp.speed * (1 + effects.current * 1.8)
        const radius = fp.radius * scatter
        const x = Math.cos(fp.angle) * radius + drift + Math.sin(t * 1.3 + fp.wobble) * 0.3
        const y = fp.height + Math.sin(t * 0.9 + fp.wobble) * 0.35
        const z = Math.sin(fp.angle) * radius * 0.8 + Math.cos(t * 1.1 + fp.wobble) * 0.3
        if (i < FISH_LARGE) {
          // 航向 = 轨道切线方向；摆尾 = 偏航正弦 + 轻微横滚
          const yaw = Math.atan2(-Math.sin(fp.angle), Math.cos(fp.angle) * 0.8)
          const wag = Math.sin(t * 7 + fp.wobble) * 0.32
          e.set(Math.sin(t * 0.9 + fp.wobble) * 0.12, yaw + wag, Math.sin(t * 5 + fp.wobble) * 0.18, "YXZ")
          q.setFromEuler(e)
          p.set(x, y, z)
          s.setScalar(fp.size)
          m.compose(p, q, s)
          fishSchool.setMatrixAt(i, m)
        } else {
          const j = i - FISH_LARGE
          fishPositionsSmall[j * 3] = x
          fishPositionsSmall[j * 3 + 1] = y
          fishPositionsSmall[j * 3 + 2] = z
        }
      }
      fishSchool.instanceMatrix.needsUpdate = true
    }
    ;(fishGeometrySmall.attributes.position as THREE.BufferAttribute).needsUpdate = true
    // 海龟慢游
    turtleAngle += delta * 0.16
    turtle.position.set(
      TURTLE_CENTER.x + Math.cos(turtleAngle) * 2.4,
      TURTLE_CENTER.y + Math.sin(t * 0.35) * 0.35,
      TURTLE_CENTER.z + Math.sin(turtleAngle) * 2.4,
    )
    turtle.rotation.y = -turtleAngle
    for (let i = 0; i < flippers.length; i += 1) {
      flippers[i].rotation.z = Math.sin(t * 2.2 + i * 1.4) * 0.4
    }
    // 海草摆动
    {
      const matrix = new THREE.Matrix4()
      const quat = new THREE.Quaternion()
      const pos = new THREE.Vector3()
      const scl = new THREE.Vector3()
      const axis = new THREE.Vector3(0, 0, 1)
      for (let i = 0; i < GRASS_COUNT; i += 1) {
        const base = grassBases[i]
        pos.set(base.x, base.y + 0.7 * base.scale, base.z)
        quat.setFromAxisAngle(axis, Math.sin(t * 1.1 + base.phase) * (0.16 + effects.current * 0.25))
        scl.setScalar(base.scale)
        matrix.compose(pos, quat, scl)
        seagrass.setMatrixAt(i, matrix)
      }
      seagrass.instanceMatrix.needsUpdate = true
    }
    // 浮游生物漂移 + 微光闪烁
    if (plankton.visible) {
      for (let i = 0; i < PLANKTON_COUNT; i += 1) {
        planktonPositions[i * 3] = planktonBase[i * 3] + Math.sin(t * 0.22 + i) * 0.4 + effects.current * ((t * 1.5 + i * 0.7) % 6)
        planktonPositions[i * 3 + 1] = planktonBase[i * 3 + 1] + Math.sin(t * 0.3 + i * 0.7) * 0.3
        planktonPositions[i * 3 + 2] = planktonBase[i * 3 + 2] + Math.cos(t * 0.18 + i * 1.3) * 0.4
      }
      ;(planktonGeometry.attributes.position as THREE.BufferAttribute).needsUpdate = true
      planktonMaterial.opacity = clamp01(0.1 + planktonDensity * 0.5) * (0.78 + 0.22 * Math.sin(t * 2.1))
      planktonMaterial.size = 0.045 + 0.012 * Math.sin(t * 1.3 + 0.7)
    }
    // 海流粒子定向流动
    if (currentStream.visible) {
      for (let i = 0; i < CURRENT_COUNT; i += 1) {
        currentPositions[i * 3] += delta * currentSpeed[i] * (1.2 + effects.current * 3.2)
        if (currentPositions[i * 3] > 10) currentPositions[i * 3] = -8
      }
      ;(currentGeometry.attributes.position as THREE.BufferAttribute).needsUpdate = true
    }
    // 入水绳环微摆
    entryGroup.rotation.z = Math.sin(t * 0.8) * 0.05 * (1 + effects.swell * 3)
  })

  // quality 三档差异：珊瑚实例数 / 海草 drawRange / 粒子层开关（几何段数在建场景时按初始档位定）
  function applyQualityTier(q: "high" | "standard" | "low"): void {
    const ratio = q === "high" ? 1 : q === "standard" ? 0.7 : 0.45
    coralMeshes.forEach((mesh, index) => {
      mesh.count = Math.max(2, Math.floor(CORAL_FULL_COUNTS[index] * ratio))
    })
    seagrass.count = q === "high" ? GRASS_COUNT : q === "standard" ? Math.floor(GRASS_COUNT * 0.75) : Math.floor(GRASS_COUNT * 0.5)
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
