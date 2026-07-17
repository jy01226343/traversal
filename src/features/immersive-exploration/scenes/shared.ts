/**
 * 沉浸式景点探索 · 场景公共工具（SCENES 拥有）
 *
 * 分层设计：
 * 1. 纯函数区（parsePositionRef / visual* / clamp01 等）—— 不触碰 WebGL，jsdom 可直接测。
 * 2. three.js 运行期工具（createManagedRenderer / runAnimationLoop / disposeScene 等）——
 *    仅 import three 不产生 WebGL 上下文；`new WebGLRenderer` 只发生在场景工厂被调用时。
 * 3. SceneSession —— 三个场景共用的基础设施：renderer/camera/rig/循环/投影/释放。
 *
 * 风格参考 src/components/ui/cobe-globe-weather.tsx（raw three.js，无 R3F）。
 */
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js"
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js"
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js"
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js"
import type {
  ActivityDefinition,
  CameraPreset,
  ImmersiveSceneDefinition,
  SceneAnchorDefinition,
} from "../domain/types"

export type SceneQuality = "high" | "standard" | "low"

// ================================================================ 纯函数区（可测）

export type ParsedPositionRef =
  | { kind: "node"; name: string }
  | { kind: "xyz"; position: [number, number, number] }

/**
 * 解析 positionRef：`node:<name>` → 语义节点；`xyz:<x>,<y>,<z>` → 场景本地坐标。
 * 非法输入返回 null（不 throw）。
 */
export function parsePositionRef(ref: string): ParsedPositionRef | null {
  if (typeof ref !== "string") return null
  const trimmed = ref.trim()
  if (trimmed.startsWith("node:")) {
    const name = trimmed.slice("node:".length).trim()
    return name.length > 0 ? { kind: "node", name } : null
  }
  if (trimmed.startsWith("xyz:")) {
    const parts = trimmed.slice("xyz:".length).split(",")
    if (parts.length !== 3) return null
    const nums = parts.map(part => Number(part.trim()))
    if (nums.some(n => !Number.isFinite(n))) return null
    return { kind: "xyz", position: [nums[0], nums[1], nums[2]] }
  }
  return null
}

/** 锚点 positionRef 中的节点名；xyz 锚点无对应 Object3D，返回 null。 */
export function anchorNodeName(anchor: Pick<SceneAnchorDefinition, "positionRef">): string | null {
  const parsed = parsePositionRef(anchor.positionRef)
  return parsed && parsed.kind === "node" ? parsed.name : null
}

/**
 * 把锚点 id 集合翻译成节点名集合（xyz 锚点没有可强调的 Object3D，跳过）。
 * 供 setAnchorEmphasis(selectedAnchorId, dimmedIds) 使用。
 */
export function collectAnchorNodeNames(
  anchors: readonly SceneAnchorDefinition[],
  ids: Iterable<string>,
): Set<string> {
  const wanted = new Set(ids)
  const names = new Set<string>()
  for (const anchor of anchors) {
    if (!wanted.has(anchor.id)) continue
    const name = anchorNodeName(anchor)
    if (name) names.add(name)
  }
  return names
}

/**
 * routeRef / zoneRefs 的元素解析为节点名列表。
 * 兼容两种写法：positionRef（`node:xxx`）或裸节点名（`trail_main`）。
 */
export function nodeNamesFromRef(ref: string | undefined | null): string[] {
  if (!ref) return []
  const trimmed = ref.trim()
  if (!trimmed) return []
  const parsed = parsePositionRef(trimmed)
  if (parsed) return parsed.kind === "node" ? [parsed.name] : []
  return /^[a-z][a-z0-9_]*$/i.test(trimmed) ? [trimmed] : []
}

/** 任意 ref 列表 → 节点名集合。 */
export function collectNodeNamesFromRefs(refs: ReadonlyArray<string | undefined | null>): Set<string> {
  const names = new Set<string>()
  for (const ref of refs) for (const name of nodeNamesFromRef(ref)) names.add(name)
  return names
}

/**
 * SceneAction.target → 节点名列表。
 * DATA 约定的 target 形态：`anchor-xxx`（锚点 id）| `node:xxx` | 裸节点名。
 */
export function resolveActionTargetNodeNames(
  target: string | undefined | null,
  anchors: readonly SceneAnchorDefinition[],
): string[] {
  if (!target) return []
  const anchor = anchors.find(a => a.id === target)
  if (anchor) {
    const name = anchorNodeName(anchor)
    return name ? [name] : []
  }
  return nodeNamesFromRef(target)
}

/**
 * activity → 高亮节点名全集：routeRef / zoneRefs + sceneActions
 * （show_route / highlight_anchor / focus_camera / spawn_group 的 target，
 * 以及 set_water / set_weather 的 params.zone）。关键词兜底由各场景自行追加。
 */
export function collectActivityNodeNames(
  activity: Pick<ActivityDefinition, "routeRef" | "zoneRefs" | "sceneActions">,
  anchors: readonly SceneAnchorDefinition[],
): Set<string> {
  const names = collectNodeNamesFromRefs([activity.routeRef, ...(activity.zoneRefs ?? [])])
  for (const action of activity.sceneActions ?? []) {
    if (
      action.kind === "show_route" ||
      action.kind === "highlight_anchor" ||
      action.kind === "focus_camera" ||
      action.kind === "spawn_group"
    ) {
      for (const name of resolveActionTargetNodeNames(action.target, anchors)) names.add(name)
    }
    if (action.kind === "set_water" || action.kind === "set_weather") {
      const zone = action.params?.zone
      if (typeof zone === "string") for (const name of nodeNamesFromRef(zone)) names.add(name)
    }
  }
  return names
}

/**
 * 双模量纲归一：value ≤ 1 视为已是 0..1 比例；> 1 视为绝对量纲，
 * 按 [min, max] 线性映射到 0..1（如雪线海拔 1200–3700m、能见度 5–25m）。
 */
export function normalizeUnitInterval(value: number, max: number, min = 0): number {
  if (!Number.isFinite(value)) return 0
  if (value <= 1) return clamp01(value)
  return clamp01((value - min) / (max - min || Number.EPSILON))
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0 || Number.EPSILON))
  return t * t * (3 - 2 * t)
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/** 确定性伪随机（顶点扰动/散布用），不引入随机性测试负担。 */
export function hashNoise(x: number, z: number): number {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453
  return s - Math.floor(s)
}

/** 平滑值噪声（双线性 + smoothstep 插值，输出 0..1，确定性）。 */
export function valueNoise2D(x: number, z: number): number {
  const xi = Math.floor(x)
  const zi = Math.floor(z)
  const xf = x - xi
  const zf = z - zi
  const u = xf * xf * (3 - 2 * xf)
  const v = zf * zf * (3 - 2 * zf)
  return lerp(
    lerp(hashNoise(xi, zi), hashNoise(xi + 1, zi), u),
    lerp(hashNoise(xi, zi + 1), hashNoise(xi + 1, zi + 1), u),
    v,
  )
}

/** 多倍频分形噪声（fbm，输出 0..1）：山体位移 / 海岸线 / 地形起伏用。 */
export function fbm2D(x: number, z: number, octaves = 4, lacunarity = 2, gain = 0.5): number {
  let amplitude = 0.5
  let frequency = 1
  let sum = 0
  let norm = 0
  for (let i = 0; i < octaves; i += 1) {
    sum += valueNoise2D(x * frequency, z * frequency) * amplitude
    norm += amplitude
    amplitude *= gain
    frequency *= lacunarity
  }
  return sum / (norm || Number.EPSILON)
}

/** 脊线噪声（|0.5-fbm|×2，输出 0..1，0 处为沟壑）：侵蚀冲沟 / 山脊纹理用。 */
export function ridged2D(x: number, z: number, octaves = 3): number {
  return Math.abs(fbm2D(x, z, octaves) - 0.5) * 2
}

/** 文本是否命中任一关键词（大小写不敏感，支持中文）。 */
export function matchesAnyKeyword(text: string, keywords: readonly string[]): boolean {
  const lower = text.toLowerCase()
  return keywords.some(keyword => lower.includes(keyword.toLowerCase()))
}

// ---------------------------------------------------------------- preset.visual 读取

export type VisualParams = Record<string, number | string | boolean> | undefined

export function visualNumber(visual: VisualParams, key: string, fallback: number): number {
  const value = visual?.[key]
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "boolean") return value ? 1 : 0
  if (typeof value === "string") {
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return fallback
}

export function visualFlag(visual: VisualParams, key: string, fallback = false): boolean {
  const value = visual?.[key]
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value !== 0
  if (typeof value === "string") {
    const lower = value.toLowerCase()
    if (lower === "true" || lower === "on" || lower === "yes") return true
    if (lower === "false" || lower === "off" || lower === "no") return false
  }
  return fallback
}

export function visualText(visual: VisualParams, key: string): string | null {
  const value = visual?.[key]
  return typeof value === "string" && value.trim() ? value.trim() : null
}

/** 读取颜色参数：接受 "#rrggbb"/"#rgb" 字符串或十六进制数字。 */
export function visualColor(visual: VisualParams, key: string): THREE.Color | null {
  const value = visual?.[key]
  if (typeof value === "number" && Number.isFinite(value)) return new THREE.Color(value)
  if (typeof value === "string") {
    try {
      return new THREE.Color(value)
    } catch {
      return null
    }
  }
  return null
}

// ================================================================ three 运行期工具

/** quality → pixelRatio 上限：low=1，standard≤1.35，high≤2（纯函数，可测）。 */
export function pixelRatioForQuality(
  quality: SceneQuality,
  devicePixelRatio: number = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
): number {
  const cap = quality === "high" ? 2 : quality === "standard" ? 1.35 : 1
  return Math.min(devicePixelRatio, cap)
}

/**
 * 受管 renderer 工厂：antialias 按档位、pixelRatio 封顶、shadowMap 关闭。
 * 注意：本函数会创建 WebGL 上下文，只能在浏览器运行期调用（测试勿触）。
 */
export function createManagedRenderer(canvas: HTMLCanvasElement, quality: SceneQuality): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: quality !== "low",
    alpha: true,
    powerPreference: quality === "high" ? "high-performance" : "default",
  })
  renderer.setPixelRatio(pixelRatioForQuality(quality))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.12
  renderer.shadowMap.enabled = false
  return renderer
}

export interface AnimationLoop {
  stop(): void
  /** reducedMotion=true：停 RAF 并立即渲染一帧静态画面；false：恢复循环 */
  setReducedMotion(reduced: boolean): void
  readonly reducedMotion: boolean
}

/** 受控动画循环：返回 stop；reducedMotion 初始为 true 时只 render 一次。 */
export function runAnimationLoop(
  render: (time: number) => void,
  opts: { reducedMotion?: boolean } = {},
): AnimationLoop {
  let rafId = 0
  let stopped = false
  let reduced = !!opts.reducedMotion
  const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now())

  const tick = (time: number) => {
    if (stopped) return
    render(time)
    if (!reduced && !stopped) rafId = requestAnimationFrame(tick)
  }

  if (reduced) render(now())
  else rafId = requestAnimationFrame(tick)

  return {
    get reducedMotion() {
      return reduced
    },
    setReducedMotion(next: boolean) {
      if (stopped || next === reduced) return
      reduced = next
      if (reduced) {
        cancelAnimationFrame(rafId)
        render(now()) // 停循环后补一帧静态画面
      } else {
        rafId = requestAnimationFrame(tick)
      }
    },
    stop() {
      stopped = true
      cancelAnimationFrame(rafId)
    },
  }
}

/** getObjectByName → getWorldPosition；未命中返回 null（不 throw）。 */
export function findNodePosition(
  root: THREE.Object3D,
  name: string,
  out: THREE.Vector3 = new THREE.Vector3(),
): THREE.Vector3 | null {
  const node = root.getObjectByName(name)
  if (!node) return null
  node.updateWorldMatrix(true, false)
  return node.getWorldPosition(out)
}

/** positionRef → 世界坐标；未命中节点或非法 ref 返回 null。 */
export function resolveWorldPosition(
  root: THREE.Object3D,
  positionRef: string,
  out: THREE.Vector3 = new THREE.Vector3(),
): THREE.Vector3 | null {
  const parsed = parsePositionRef(positionRef)
  if (!parsed) return null
  if (parsed.kind === "xyz") return out.set(parsed.position[0], parsed.position[1], parsed.position[2])
  return findNodePosition(root, parsed.name, out)
}

function disposeMaterial(material: THREE.Material): void {
  for (const value of Object.values(material)) {
    if (value && typeof value === "object" && (value as THREE.Texture).isTexture) {
      ;(value as THREE.Texture).dispose()
    }
  }
  material.dispose()
}

/** traverse 释放 geometry / material / texture，并 dispose renderer。 */
export function disposeScene(root: THREE.Object3D, renderer?: THREE.WebGLRenderer | null): void {
  root.traverse(obj => {
    const disposable = obj as unknown as {
      geometry?: THREE.BufferGeometry
      material?: THREE.Material | THREE.Material[]
    }
    disposable.geometry?.dispose()
    const material = disposable.material
    if (Array.isArray(material)) material.forEach(disposeMaterial)
    else if (material) disposeMaterial(material)
  })
  renderer?.dispose()
}

// ---------------------------------------------------------------- 相机 rig

/** 相机位置/注视点/fov 的平滑过渡；reducedMotion 时由调用方传 instant 跳切。 */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera
  private lookCurrent = new THREE.Vector3()
  private fromPos = new THREE.Vector3()
  private toPos = new THREE.Vector3()
  private fromLook = new THREE.Vector3()
  private toLook = new THREE.Vector3()
  private fromFov = 45
  private toFov = 45
  private startTime = 0
  private durationMs = 900
  private active = false

  constructor(camera: THREE.PerspectiveCamera, preset?: CameraPreset) {
    this.camera = camera
    if (preset) this.snap(preset)
  }

  /** 当前注视点（OrbitControls target 同步用） */
  get lookTarget(): THREE.Vector3 {
    return this.lookCurrent
  }

  /** 用户接管相机（拖拽/缩放）时取消进行中的过渡 */
  cancel(): void {
    this.active = false
  }

  snap(preset: CameraPreset): void {
    this.active = false
    this.camera.position.set(preset.position[0], preset.position[1], preset.position[2])
    this.lookCurrent.set(preset.lookAt[0], preset.lookAt[1], preset.lookAt[2])
    if (preset.fov && preset.fov > 0) {
      this.camera.fov = preset.fov
      this.camera.updateProjectionMatrix()
    }
    this.camera.lookAt(this.lookCurrent)
  }

  transitionTo(preset: CameraPreset, now: number, instant = false): void {
    if (instant) {
      this.snap(preset)
      return
    }
    this.fromPos.copy(this.camera.position)
    this.fromLook.copy(this.lookCurrent)
    this.fromFov = this.camera.fov
    this.toPos.set(preset.position[0], preset.position[1], preset.position[2])
    this.toLook.set(preset.lookAt[0], preset.lookAt[1], preset.lookAt[2])
    this.toFov = preset.fov && preset.fov > 0 ? preset.fov : this.camera.fov
    this.startTime = now
    this.active = true
  }

  /** 每帧推进；返回是否仍在过渡中。 */
  update(now: number): boolean {
    if (!this.active) return false
    const t = clamp01((now - this.startTime) / this.durationMs)
    const e = easeInOutCubic(t)
    this.camera.position.lerpVectors(this.fromPos, this.toPos, e)
    this.lookCurrent.lerpVectors(this.fromLook, this.toLook, e)
    const fov = lerp(this.fromFov, this.toFov, e)
    if (Math.abs(fov - this.camera.fov) > 0.01) {
      this.camera.fov = fov
      this.camera.updateProjectionMatrix()
    }
    this.camera.lookAt(this.lookCurrent)
    if (t >= 1) this.active = false
    return this.active
  }
}

// ---------------------------------------------------------------- 锚点标记系统

interface AnchorMarkerEntry {
  name: string
  root: THREE.Group
  core: THREE.Mesh<THREE.OctahedronGeometry, THREE.MeshBasicMaterial>
  ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>
  pillar: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>
  phase: number
}

const MARKER_DEFAULT_OPACITY = { core: 0.8, ring: 0.42, pillar: 0.32 }
const MARKER_SELECTED_COLOR = 0xffd28e

/**
 * 每个语义节点的「标记柱」：发光八面体 + 细柱 + 地面环。
 * setAnchorEmphasis 的落点：选中放大发光，dimmed 变暗缩小。
 */
export class AnchorMarkerSystem {
  readonly group = new THREE.Group()
  private markers: AnchorMarkerEntry[] = []
  private byName = new Map<string, AnchorMarkerEntry>()
  private baseColor = new THREE.Color(0x8fd6ff)

  constructor(opts?: { color?: number | string }) {
    this.group.name = "anchor_markers"
    if (opts?.color !== undefined) this.baseColor = new THREE.Color(opts.color)
  }

  addMarker(name: string, position: THREE.Vector3, opts?: { scale?: number; color?: number | string }): void {
    if (this.byName.has(name)) return
    const color = new THREE.Color(opts?.color ?? this.baseColor)
    const root = new THREE.Group()
    root.name = `marker:${name}`
    root.position.copy(position)
    const scale = opts?.scale ?? 1

    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.17 * scale),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: MARKER_DEFAULT_OPACITY.core, depthWrite: false }),
    )
    core.name = `marker:${name}:core`
    core.position.y = 0.62 * scale

    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022 * scale, 0.022 * scale, 0.56 * scale, 6),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: MARKER_DEFAULT_OPACITY.pillar, depthWrite: false }),
    )
    pillar.name = `marker:${name}:pillar`
    pillar.position.y = 0.28 * scale

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.24 * scale, 0.32 * scale, 28),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: MARKER_DEFAULT_OPACITY.ring, depthWrite: false, side: THREE.DoubleSide }),
    )
    ring.name = `marker:${name}:ring`
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.03

    root.add(core, pillar, ring)
    this.group.add(root)
    const entry: AnchorMarkerEntry = { name, root, core, ring, pillar, phase: this.markers.length * 1.37 }
    this.markers.push(entry)
    this.byName.set(name, entry)
  }

  /** selected 放大发光、dimmed 变暗缩小、其余恢复默认。 */
  setEmphasis(selected: ReadonlySet<string>, dimmed: ReadonlySet<string>): void {
    for (const marker of this.markers) {
      const isSelected = selected.has(marker.name)
      const isDimmed = !isSelected && dimmed.has(marker.name)
      const targetScale = isSelected ? 1.5 : isDimmed ? 0.65 : 1
      marker.root.scale.setScalar(targetScale)
      marker.core.material.color.set(isSelected ? MARKER_SELECTED_COLOR : this.baseColor)
      marker.ring.material.color.set(isSelected ? MARKER_SELECTED_COLOR : this.baseColor)
      marker.pillar.material.color.set(isSelected ? MARKER_SELECTED_COLOR : this.baseColor)
      marker.core.material.opacity = isSelected ? 1 : isDimmed ? 0.14 : MARKER_DEFAULT_OPACITY.core
      marker.ring.material.opacity = isSelected ? 0.85 : isDimmed ? 0.08 : MARKER_DEFAULT_OPACITY.ring
      marker.pillar.material.opacity = isSelected ? 0.7 : isDimmed ? 0.06 : MARKER_DEFAULT_OPACITY.pillar
    }
  }

  /** 移动某个标记的位置（如雪线节点随 preset 变化）。 */
  moveMarker(name: string, position: THREE.Vector3): void {
    this.byName.get(name)?.root.position.copy(position)
  }

  /** 轻微上下浮动；motion=false 时保持静止。 */
  update(time: number, motion: boolean): void {
    if (!motion) return
    for (const marker of this.markers) {
      marker.core.position.y = 0.62 * marker.root.scale.y + Math.sin(time * 0.0021 + marker.phase) * 0.05
    }
  }
}

// ---------------------------------------------------------------- SceneSession

export interface SceneSessionOptions {
  canvas: HTMLCanvasElement
  sceneDef: ImmersiveSceneDefinition
  quality?: SceneQuality
  reducedMotion?: boolean
  near?: number
  far?: number
  /** OrbitControls 限制（V1.2）：各场景按 family 传不同范围 */
  controls?: {
    minDistance?: number
    maxDistance?: number
    maxPolarAngle?: number
  }
  /**
   * V1.4 商业级后处理：EffectComposer（RenderPass → UnrealBloomPass → OutputPass）。
   * 低阈值小强度泛光，只作用于 WebGL canvas（UI 照片背景层天然隔离）。
   * quality=low 或 reducedMotion 时自动跳过 composer 直渲（见 tick）。
   */
  bloom?: {
    strength?: number
    radius?: number
    threshold?: number
  }
}

const _projWorld = new THREE.Vector3()
const _projView = new THREE.Vector3()
const _projNdc = new THREE.Vector3()
const _rayDir = new THREE.Vector3()
const _raycaster = new THREE.Raycaster()

/**
 * 场景会话：renderer / scene / camera / rig / 动画循环 / 帧回调 / 投影 / 释放。
 * 三个场景工厂各自构建内容后，把 SceneHandle 的通用方法委托给本类。
 */
export class SceneSession {
  readonly canvas: HTMLCanvasElement
  readonly sceneDef: ImmersiveSceneDefinition
  readonly renderer: THREE.WebGLRenderer
  readonly scene = new THREE.Scene()
  readonly camera: THREE.PerspectiveCamera
  readonly rig: CameraRig
  readonly markers = new AnchorMarkerSystem()
  /** 用户视角控制（V1.2）：拖拽旋转 / 滚轮缩放；与 CameraRig 互斥协调 */
  readonly controls: OrbitControls
  /** 遮挡检测对象（如山体锥面）：锚点在几何体背后时 projectToScreen 返回 null */
  readonly occluders: THREE.Object3D[] = []
  quality: SceneQuality
  reducedMotion: boolean

  private updater: ((time: number, deltaSeconds: number) => void) | null = null
  private qualityListener: ((quality: SceneQuality) => void) | null = null
  private frameCallbacks = new Set<() => void>()
  private loop: AnimationLoop
  private resizeObserver: ResizeObserver | null = null
  private disposed = false
  private lastTime = 0
  private autoRotate = false
  private controlsSyncNeeded = false
  private composer: EffectComposer | null = null

  constructor(opts: SceneSessionOptions) {
    this.canvas = opts.canvas
    this.sceneDef = opts.sceneDef
    this.quality = opts.quality ?? "standard"
    this.reducedMotion = !!opts.reducedMotion
    this.renderer = createManagedRenderer(opts.canvas, this.quality)
    const fov = opts.sceneDef.defaultCamera.fov ?? 45
    this.camera = new THREE.PerspectiveCamera(fov, 1, opts.near ?? 0.1, opts.far ?? 400)
    this.rig = new CameraRig(this.camera, opts.sceneDef.defaultCamera)
    this.scene.add(this.markers.group)
    // ---- OrbitControls：用户旋转/缩放；start 时取消 rig 过渡，rig 过渡期间暂停 controls.update
    this.controls = new OrbitControls(this.camera, opts.canvas)
    const limits = opts.controls ?? {}
    this.controls.enableDamping = !this.reducedMotion
    this.controls.dampingFactor = 0.08
    this.controls.rotateSpeed = 0.55
    this.controls.zoomSpeed = 0.9
    this.controls.enablePan = false
    this.controls.minDistance = limits.minDistance ?? 4
    this.controls.maxDistance = limits.maxDistance ?? 90
    this.controls.maxPolarAngle = limits.maxPolarAngle ?? Math.PI * 0.58
    this.controls.autoRotateSpeed = 0.7
    this.controls.target.copy(this.rig.lookTarget)
    this.controls.update()
    this.controls.addEventListener("start", () => {
      this.rig.cancel()
      this.autoRotate = false
      this.controls.autoRotate = false
    })
    this.controls.addEventListener("change", () => {
      if (this.reducedMotion) this.requestRender()
    })
    // ---- 后处理管线（V1.4）：bloom 仅 standard/high 且非 reducedMotion 时启用（tick 内判断）
    if (opts.bloom) {
      const composer = new EffectComposer(this.renderer)
      composer.addPass(new RenderPass(this.scene, this.camera))
      const bloom = new UnrealBloomPass(
        new THREE.Vector2(1, 1),
        opts.bloom.strength ?? 0.32,
        opts.bloom.radius ?? 0.45,
        opts.bloom.threshold ?? 0.72,
      )
      composer.addPass(bloom)
      // OutputPass 在构造时读取 renderer 的 ACESFilmic tone mapping 与 sRGB 输出色彩空间
      composer.addPass(new OutputPass())
      // quality=high 时对离屏 render target 开 4x MSAA 抗锯齿（WebGL2）
      if (this.quality === "high") {
        composer.renderTarget1.samples = 4
        composer.renderTarget2.samples = 4
      }
      this.composer = composer
    }
    this.resize()
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.resize())
      this.resizeObserver.observe(opts.canvas)
    }
    this.loop = runAnimationLoop(time => this.tick(time), { reducedMotion: this.reducedMotion })
  }

  /** 场景专属每帧更新（材质动画、粒子、效果）。 */
  setUpdater(fn: (time: number, deltaSeconds: number) => void): void {
    this.updater = fn
  }

  /** quality 变化回调（场景用来开关粒子/降采样动画）。 */
  onQualityChange(fn: (quality: SceneQuality) => void): void {
    this.qualityListener = fn
  }

  onFrame(cb: () => void): () => void {
    this.frameCallbacks.add(cb)
    return () => {
      this.frameCallbacks.delete(cb)
    }
  }

  /** 相机过渡：reducedMotion 时跳切；preset=null 回默认机位。 */
  moveCamera(preset: CameraPreset | null): void {
    const target = preset ?? this.sceneDef.defaultCamera
    this.rig.transitionTo(target, this.nowMs(), this.reducedMotion)
    this.controlsSyncNeeded = true
    if (this.reducedMotion) {
      this.controls.target.copy(this.rig.lookTarget)
      this.controlsSyncNeeded = false
      this.requestRender()
    }
  }

  /** 程序化缩放：factor<1 拉近（放大），>1 拉远（缩小）；自动夹取距离限制。 */
  zoomBy(factor: number): void {
    if (this.disposed || !Number.isFinite(factor) || factor <= 0) return
    this.rig.cancel()
    const offset = this.camera.position.clone().sub(this.controls.target)
    const length = THREE.MathUtils.clamp(
      offset.length() * factor,
      this.controls.minDistance,
      this.controls.maxDistance,
    )
    offset.setLength(length)
    this.camera.position.copy(this.controls.target).add(offset)
    this.requestRender()
  }

  /** 复位到场景默认机位（平滑过渡）。 */
  resetCamera(): void {
    this.moveCamera(null)
  }

  /** 自动环绕旋转；用户一旦拖拽即自动关闭（start 监听里处理）。reducedMotion 强制关闭。 */
  setAutoRotate(on: boolean): void {
    this.autoRotate = on
    this.controls.autoRotate = on && !this.reducedMotion
    if (this.reducedMotion) this.requestRender()
  }

  resize(): void {
    if (this.disposed) return
    const width = this.canvas.clientWidth || this.canvas.parentElement?.clientWidth || 1
    const height = this.canvas.clientHeight || this.canvas.parentElement?.clientHeight || 1
    this.renderer.setSize(width, height, false)
    this.composer?.setSize(width, height)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }

  /** 立即渲染一帧（reducedMotion 状态下每次 apply* 后调用）。 */
  requestRender(): void {
    if (this.disposed) return
    this.tick(this.nowMs())
  }

  /**
   * positionRef → canvas CSS 像素坐标。
   * `node:` 按名取世界坐标；`xyz:` 直接投影。出屏 / 相机背面 / 被遮挡 → null。
   */
  projectToScreen(positionRef: string): { x: number; y: number } | null {
    if (this.disposed) return null
    const world = resolveWorldPosition(this.scene, positionRef, _projWorld)
    if (!world) return null
    // 相机背面：视图空间 z >= -near
    _projView.copy(world).applyMatrix4(this.camera.matrixWorldInverse)
    if (_projView.z > -this.camera.near) return null
    const ndc = _projNdc.copy(world).project(this.camera)
    if (ndc.z < -1 || ndc.z > 1 || ndc.x < -1 || ndc.x > 1 || ndc.y < -1 || ndc.y > 1) return null
    // 遮挡：对注册的主几何体做一次 raycast（山体/岛体等少数对象，代价可忽略）
    if (this.occluders.length > 0) {
      const distance = this.camera.position.distanceTo(world)
      _rayDir.copy(world).sub(this.camera.position).normalize()
      _raycaster.set(this.camera.position, _rayDir)
      const hits = _raycaster.intersectObjects(this.occluders, false)
      if (hits.length > 0 && hits[0].distance < distance - 0.05) return null
    }
    const rect = this.canvas.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return null
    return {
      x: (ndc.x * 0.5 + 0.5) * rect.width,
      y: (-ndc.y * 0.5 + 0.5) * rect.height,
    }
  }

  setQuality(quality: SceneQuality): void {
    if (quality === this.quality || this.disposed) return
    this.quality = quality
    this.renderer.setPixelRatio(pixelRatioForQuality(quality))
    this.composer?.setPixelRatio(pixelRatioForQuality(quality))
    this.qualityListener?.(quality)
    this.requestRender()
  }

  setReducedMotion(reduced: boolean): void {
    if (this.disposed || reduced === this.reducedMotion) return
    this.reducedMotion = reduced
    this.controls.enableDamping = !reduced
    this.controls.autoRotate = reduced ? false : this.autoRotate
    this.loop.setReducedMotion(reduced)
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.loop.stop()
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
    this.frameCallbacks.clear()
    this.updater = null
    this.qualityListener = null
    this.controls.dispose()
    if (this.composer) {
      for (const pass of this.composer.passes) {
        ;(pass as { dispose?: () => void }).dispose?.()
      }
      ;(this.composer as unknown as { dispose?: () => void }).dispose?.()
      this.composer = null
    }
    disposeScene(this.scene, this.renderer)
  }

  private nowMs(): number {
    return typeof performance !== "undefined" ? performance.now() : Date.now()
  }

  private tick(time: number): void {
    const deltaSeconds = this.lastTime === 0 ? 0 : Math.min((time - this.lastTime) / 1000, 0.1)
    this.lastTime = time
    const transitioning = this.rig.update(time)
    if (transitioning) {
      // rig 过渡期间：仅同步注视点，暂停 controls.update 防止双写相机
      this.controls.target.copy(this.rig.lookTarget)
      this.controlsSyncNeeded = true
    } else {
      if (this.controlsSyncNeeded) {
        this.controls.target.copy(this.rig.lookTarget)
        this.controlsSyncNeeded = false
      }
      this.controls.update()
    }
    this.updater?.(time, deltaSeconds)
    this.markers.update(time, !this.reducedMotion)
    // 后处理：composer 仅在 standard/high 且非 reducedMotion 时启用，否则直渲
    if (this.composer && this.quality !== "low" && !this.reducedMotion) {
      this.composer.render()
    } else {
      this.renderer.render(this.scene, this.camera)
    }
    this.frameCallbacks.forEach(cb => {
      try {
        cb()
      } catch {
        /* 帧回调异常不阻断渲染循环 */
      }
    })
  }
}

// ---------------------------------------------------------------- 节点创建小助手

/** 在场景根下创建命名空节点（契约语义节点锚点）。 */
export function createNamedNode(
  parent: THREE.Object3D,
  name: string,
  x: number,
  y: number,
  z: number,
): THREE.Object3D {
  const node = new THREE.Object3D()
  node.name = name
  node.position.set(x, y, z)
  parent.add(node)
  return node
}

// ---------------------------------------------------------------- 程序化纹理工厂（V1.3 氛围升级）
// 以下工厂会创建 DOM canvas：只允许在场景工厂运行期（浏览器）调用，禁止模块顶层调用。

/**
 * 柔光径向渐变纹理（雪顶闪光 / 气泡 / 光点 sprite 用）。
 * 中心不透明、边缘全透明，additive 叠加时呈柔和圆斑。
 */
export function createRadialGlowTexture(
  size = 64,
  inner = "rgba(255,255,255,1)",
  mid = "rgba(255,255,255,0.5)",
  outer = "rgba(255,255,255,0)",
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")!
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, inner)
  gradient.addColorStop(0.45, mid)
  gradient.addColorStop(1, outer)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/**
 * 多球团簇云纹理（柔光云 sprite 用）。
 * 若干偏移径向球叠加成不规则云团轮廓，确定性 hashNoise 撒点，无随机测试负担。
 */
export function createCloudPuffTexture(size = 128, blobs = 8): THREE.CanvasTexture {
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")!
  ctx.clearRect(0, 0, size, size)
  const half = size / 2
  for (let i = 0; i < blobs; i += 1) {
    const angle = hashNoise(i, 1.7) * Math.PI * 2
    const dist = hashNoise(i, 3.9) * size * 0.22
    const x = half + Math.cos(angle) * dist
    const y = half + Math.sin(angle) * dist * 0.55
    const r = size * (0.16 + hashNoise(i, 5.3) * 0.16)
    const alpha = 0.35 + hashNoise(i, 7.1) * 0.4
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, `rgba(255,255,255,${alpha})`)
    g.addColorStop(1, "rgba(255,255,255,0)")
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/**
 * 细碎斑点噪声纹理（水面波光层用，RepeatWrapping 平铺 + UV 平移）。
 * 亮斑稀疏分布，additive 叠加在波面上呈碎金闪烁。
 */
export function createSpeckleTexture(size = 128, count = 240): THREE.CanvasTexture {
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")!
  ctx.clearRect(0, 0, size, size)
  for (let i = 0; i < count; i += 1) {
    const x = hashNoise(i, 1.7) * size
    const y = hashNoise(i, 3.9) * size
    const r = 0.6 + hashNoise(i, 5.3) * 2.2
    const alpha = 0.2 + hashNoise(i, 7.1) * 0.8
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, `rgba(255,255,255,${alpha})`)
    g.addColorStop(1, "rgba(255,255,255,0)")
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}
