import { useCallback, useEffect, useRef, useState } from "react"
import * as THREE from "three"
import type { DestinationBeacon } from "@/data/beacons"
import type { DestinationCountry, DestinationRegion } from "@/data/destinations"

export type MapLevel = "world" | "continent" | "country" | "region"

interface TerrainMarker {
  id: string
  location: [number, number]
  symbol: string
  label: string
}

interface PickedCountry {
  code: string
  name: string
  english: string
  focus: [number, number]
}

export interface GlobeRouteFlight {
  id: number
  from: { name: string; focus: [number, number] }
  to: { name: string; focus: [number, number] }
}

interface GlobeWeatherProps {
  continent?: string
  level?: MapLevel
  country?: DestinationCountry | null
  region?: DestinationRegion | null
  regions?: DestinationRegion[]
  className?: string
  speed?: number
  quality?: "high" | "standard" | "low"
  reducedMotion?: boolean
  onCountrySelect?: (country: PickedCountry) => void
  routeFlight?: GlobeRouteFlight | null
  onRouteFlightComplete?: () => void
  /** Destination beacons projected on the globe (world level) */
  beacons?: DestinationBeacon[]
  onBeaconSelect?: (beacon: DestinationBeacon) => void
}

interface GeoFeature {
  properties: Record<string, string | number | null>
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: number[][][] | number[][][][] }
}

interface GeoCollection { features: GeoFeature[] }

/** World globe default front: China geographic center, north-up. */
const WORLD_FRONT_FOCUS: [number, number] = [35.8, 104.2]

const continentConfig: Record<string, { focus: [number, number]; markers: TerrainMarker[] }> = {
  亚洲: {
    focus: [34, 105],
    markers: [
      { id: "asia-snow", location: [43.1, 142.2], symbol: "❄", label: "北海道雪原" },
      { id: "asia-mountain", location: [28.1, 86.9], symbol: "▲", label: "喜马拉雅山脉" },
      { id: "asia-forest", location: [24.5, 101.3], symbol: "♣", label: "横断山森林" },
    ],
  },
  欧洲: {
    focus: [50, 14],
    markers: [
      { id: "europe-alps", location: [46.5, 9.7], symbol: "▲", label: "阿尔卑斯山" },
      { id: "europe-nordic", location: [64.2, 16.1], symbol: "✦", label: "北欧极光带" },
      { id: "europe-sea", location: [38.4, 15.2], symbol: "≈", label: "地中海岸" },
    ],
  },
  大洋洲: {
    focus: [-24, 135],
    markers: [
      { id: "oceania-reef", location: [-18.3, 147.7], symbol: "≈", label: "大堡礁" },
      { id: "oceania-rock", location: [-25.3, 131], symbol: "▲", label: "乌鲁鲁" },
      { id: "oceania-forest", location: [-42.1, 147.1], symbol: "♣", label: "塔斯曼森林" },
    ],
  },
  北美: {
    focus: [43, -105],
    markers: [
      { id: "america-rockies", location: [45.2, -110.4], symbol: "▲", label: "落基山脉" },
      { id: "america-lake", location: [46.8, -87.2], symbol: "≈", label: "五大湖" },
      { id: "america-aurora", location: [65.1, -120.2], symbol: "✦", label: "极光走廊" },
    ],
  },
  南美: {
    focus: [-15, -60],
    markers: [
      { id: "sa-andes", location: [-13.2, -72.5], symbol: "▲", label: "安第斯山脉" },
      { id: "sa-amazon", location: [-3.1, -60.0], symbol: "♣", label: "亚马孙雨林" },
      { id: "sa-patagonia", location: [-50.1, -73.0], symbol: "❄", label: "巴塔哥尼亚" },
    ],
  },
  非洲: {
    focus: [2, 20],
    markers: [
      { id: "af-sahara", location: [23.4, 12.0], symbol: "✧", label: "撒哈拉沙漠" },
      { id: "af-serengeti", location: [-2.3, 34.8], symbol: "✦", label: "塞伦盖蒂" },
      { id: "af-cape", location: [-33.9, 18.4], symbol: "≈", label: "好望角" },
    ],
  },
}

function latLonToVector(lat: number, lon: number, radius = 1) {
  const phi = THREE.MathUtils.degToRad(90 - lat)
  const theta = THREE.MathUtils.degToRad(lon + 180)
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  )
}

function vectorToLatLon(point: THREE.Vector3): [number, number] {
  const normalized = point.clone().normalize()
  return [
    THREE.MathUtils.radToDeg(Math.asin(normalized.y)),
    THREE.MathUtils.radToDeg(Math.atan2(-normalized.z, normalized.x)),
  ]
}

/**
 * Classic globe pose: north pole screen-up, south pole screen-down.
 * Only yaw around the polar axis so `lon` faces the camera (+Z).
 * Identity mesh has roughly lon=-90° on the front face.
 */
function focusQuaternion([_lat, lon]: [number, number]) {
  return new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    THREE.MathUtils.degToRad(-(lon + 90)),
  )
}

function easeInOutExpo(value: number) {
  if (value === 0 || value === 1) return value
  return value < 0.5
    ? Math.pow(2, 20 * value - 10) / 2
    : (2 - Math.pow(2, -20 * value + 10)) / 2
}

/** Deeper-out easing for camera dive — fast start, gentle settle. */
function easeOutQuint(value: number) {
  return 1 - Math.pow(1 - value, 5)
}

function ringsFromFeature(feature: GeoFeature): number[][][] {
  if (feature.geometry.type === "Polygon") return feature.geometry.coordinates as number[][][]
  return (feature.geometry.coordinates as number[][][][]).flatMap(polygon => polygon)
}

function splitAtDateline(ring: number[][]) {
  const segments: number[][][] = []
  let current: number[][] = []
  ring.forEach((coordinate, index) => {
    if (index > 0 && Math.abs(coordinate[0] - ring[index - 1][0]) > 180) {
      if (current.length > 1) segments.push(current)
      current = []
    }
    current.push(coordinate)
  })
  if (current.length > 1) segments.push(current)
  return segments
}

function addFeatureLines(
  target: THREE.Group,
  features: GeoFeature[],
  radius: number,
  material: THREE.LineBasicMaterial,
) {
  features.forEach(feature => {
    ringsFromFeature(feature).forEach(ring => {
      splitAtDateline(ring).forEach(segment => {
        const points = segment.map(([lon, lat]) => latLonToVector(lat, lon, radius))
        const geometry = new THREE.BufferGeometry().setFromPoints(points)
        target.add(new THREE.Line(geometry, material))
      })
    })
  })
}

function clearLineGroup(group: THREE.Group) {
  group.children.forEach(child => {
    const line = child as THREE.Line
    line.geometry?.dispose()
  })
  group.clear()
}

function clearMeshGroup(group: THREE.Group) {
  group.children.forEach(child => {
    const mesh = child as THREE.Mesh
    mesh.geometry?.dispose()
    ;(mesh.material as THREE.Material)?.dispose()
  })
  group.clear()
}

function pointInRing(lon: number, lat: number, ring: number[][]) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    const crosses = yi > lat !== yj > lat
    const atLon = ((xj - xi) * (lat - yi)) / (yj - yi || Number.EPSILON) + xi
    if (crosses && lon < atLon) inside = !inside
  }
  return inside
}

function pointInFeature(lon: number, lat: number, feature: GeoFeature) {
  if (feature.geometry.type === "Polygon") {
    const polygons = feature.geometry.coordinates as number[][][]
    return pointInRing(lon, lat, polygons[0])
  }
  return (feature.geometry.coordinates as number[][][][])
    .some(polygon => pointInRing(lon, lat, polygon[0]))
}

export function GlobeWeather({
  continent = "亚洲",
  level = "world",
  country = null,
  region = null,
  regions = [],
  className = "",
  speed = 0.0014,
  quality = "standard",
  reducedMotion = false,
  onCountrySelect,
  routeFlight = null,
  onRouteFlightComplete,
  beacons = [],
  onBeaconSelect,
}: GlobeWeatherProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const shellRef = useRef<HTMLDivElement>(null)
  const labelsRef = useRef<Array<HTMLSpanElement | null>>([])
  const beaconElsRef = useRef<Array<HTMLButtonElement | null>>([])
  const beaconsRef = useRef(beacons)
  const focusLabelRef = useRef<HTMLSpanElement | null>(null)
  const flightPlaneRef = useRef<HTMLSpanElement | null>(null)
  const levelRef = useRef(level)
  const countryRef = useRef(country)
  const regionRef = useRef(region)
  const regionsRef = useRef(regions)
  const configRef = useRef(continentConfig[continent])
  const onCountrySelectRef = useRef(onCountrySelect)
  const onBeaconSelectRef = useRef(onBeaconSelect)
  const routeFlightRef = useRef(routeFlight)
  const onRouteFlightCompleteRef = useRef(onRouteFlightComplete)
  const targetQuaternion = useRef(focusQuaternion(WORLD_FRONT_FOCUS))
  const drag = useRef<{ x: number; y: number; quaternion: THREE.Quaternion; moved: boolean } | null>(null)
  const [transitioning, setTransitioning] = useState(false)
  const [boundariesReady, setBoundariesReady] = useState(false)
  const [textureMode, setTextureMode] = useState("2K GLOBAL")
  const [routeFlightStage, setRouteFlightStage] = useState<"departing" | "enroute" | "arriving" | "arrived" | null>(null)
  const transitionRef = useRef<{
    start: number
    duration: number
    startQuaternion: THREE.Quaternion
    endQuaternion: THREE.Quaternion
    startZ: number
    pullZ: number
    endZ: number
  } | null>(null)
  const apiRef = useRef<{
    globe: THREE.Group
    camera: THREE.PerspectiveCamera
    earth: THREE.Mesh
    countryFeatures: GeoFeature[]
    countryBorders: THREE.Group
    countryHighlight: THREE.Group
    adminBorders: THREE.Group
    unvisitedMasks: THREE.Group
    sync: () => void
    pick: (clientX: number, clientY: number) => void
  } | null>(null)

  levelRef.current = level
  countryRef.current = country
  regionRef.current = region
  regionsRef.current = regions
  beaconsRef.current = beacons
  onCountrySelectRef.current = onCountrySelect
  onBeaconSelectRef.current = onBeaconSelect
  routeFlightRef.current = routeFlight
  onRouteFlightCompleteRef.current = onRouteFlightComplete

  useEffect(() => {
    configRef.current = continentConfig[continent]
    // World layer always fronts China; lower levels use region / country / continent focus.
    const point: [number, number] = level === "world"
      ? WORLD_FRONT_FOCUS
      : level === "region" && region
        ? region.focus
        : level === "country" && country
          ? country.focus
          : configRef.current.focus
    const endQuaternion = focusQuaternion(point)
    targetQuaternion.current.copy(endQuaternion)
    const api = apiRef.current
    if (api) {
      const endZ = level === "world" ? 5.2 : level === "continent" ? 3.55 : level === "country" ? 2.42 : 2.08
      transitionRef.current = {
        start: performance.now(),
        // Snappier: region 850ms, country 950ms, continent/world 1100ms
        duration: level === "region" ? 850 : level === "country" ? 950 : 1100,
        startQuaternion: api.globe.quaternion.clone(),
        endQuaternion,
        startZ: api.camera.position.z,
        // Smaller pull-back (0.35 vs 0.65) — less wasted motion
        pullZ: Math.max(api.camera.position.z + 0.35, 5.4),
        endZ,
      }
      setTransitioning(true)
      api.sync()
    }
  }, [continent, country?.code, region?.id, level])

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    drag.current = {
      x: event.clientX,
      y: event.clientY,
      quaternion: targetQuaternion.current.clone(),
      moved: false,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }, [])

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drag.current || transitioning) return
    const dx = event.clientX - drag.current.x
    const dy = event.clientY - drag.current.y
    if (Math.abs(dx) + Math.abs(dy) > 5) drag.current.moved = true
    const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), dx / 165)
    const pitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), dy / 240)
    targetQuaternion.current.copy(drag.current.quaternion).premultiply(yaw).premultiply(pitch)
  }, [transitioning])

  const onPointerUp = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const interaction = drag.current
    drag.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (interaction && !interaction.moved && !transitioning && levelRef.current === "continent") {
      apiRef.current?.pick(event.clientX, event.clientY)
    }
  }, [transitioning])

  useEffect(() => {
    const canvas = canvasRef.current
    const shell = shellRef.current
    if (!canvas || !shell) return

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality !== "low", alpha: true, powerPreference: quality === "high" ? "high-performance" : "default" })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality === "high" ? 2 : quality === "standard" ? 1.35 : 1))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.16

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100)
    camera.position.set(0, 0, 5.2)
    const globe = new THREE.Group()
    globe.quaternion.copy(targetQuaternion.current)
    scene.add(globe)

    const loader = new THREE.TextureLoader()
    const colorMap = loader.load("/earth/earth-color.jpg")
    const normalMap = loader.load("/earth/earth-normal.jpg")
    const oceanMask = loader.load("/earth/earth-specular.jpg")
    const lightsMap = loader.load("/earth/earth-lights.png")
    const cloudsMap = loader.load("/earth/earth-clouds.png")
    colorMap.colorSpace = THREE.SRGBColorSpace
    lightsMap.colorSpace = THREE.SRGBColorSpace

    const geometry = new THREE.SphereGeometry(1.46, 256, 160)
    const material = new THREE.MeshPhongMaterial({
      map: colorMap,
      normalMap,
      normalScale: new THREE.Vector2(1.05, 1.05),
      specularMap: oceanMask,
      specular: new THREE.Color(0x6f9ba2),
      shininess: 34,
      displacementMap: oceanMask,
      displacementScale: -0.035,
      displacementBias: 0.035,
      emissiveMap: lightsMap,
      emissive: new THREE.Color(0x9fb8a6),
      emissiveIntensity: 0.26,
    })
    let highResReady = false
    const highResMap = loader.load("/earth/earth-color-8k.jpg", () => {
      highResReady = true
      highResMap.colorSpace = THREE.SRGBColorSpace
      highResMap.anisotropy = renderer.capabilities.getMaxAnisotropy()
      if (levelRef.current !== "world") {
        material.map = highResMap
        material.needsUpdate = true
        setTextureMode("8K DETAIL")
      }
    })
    highResMap.colorSpace = THREE.SRGBColorSpace
    colorMap.anisotropy = renderer.capabilities.getMaxAnisotropy()
    const earth = new THREE.Mesh(geometry, material)
    globe.add(earth)

    const cloudGeometry = new THREE.SphereGeometry(1.502, 160, 96)
    const cloudMaterial = new THREE.MeshPhongMaterial({ map: cloudsMap, transparent: true, opacity: 0.36, depthWrite: false })
    const clouds = new THREE.Mesh(cloudGeometry, cloudMaterial)
    globe.add(clouds)

    const countryMaterial = new THREE.LineBasicMaterial({ color: 0xf4d39c, transparent: true, opacity: 0.78 })
    const highlightMaterial = new THREE.LineBasicMaterial({ color: 0xff6f47, transparent: true, opacity: 1 })
    const adminMaterial = new THREE.LineBasicMaterial({ color: 0xffe5af, transparent: true, opacity: 0.92 })
    const countryBorders = new THREE.Group()
    const countryHighlight = new THREE.Group()
    const adminBorders = new THREE.Group()
    const unvisitedMasks = new THREE.Group()
    globe.add(countryBorders, countryHighlight, adminBorders, unvisitedMasks)

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.56, 96, 64),
      new THREE.ShaderMaterial({
        transparent: true,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        vertexShader: `varying vec3 vNormal;void main(){vNormal=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
        fragmentShader: `varying vec3 vNormal;void main(){float f=pow(0.72-dot(vNormal,vec3(0.,0.,1.)),3.2);gl_FragColor=vec4(.18,.72,.88,1.)*f*.72;}`,
      }),
    )
    scene.add(atmosphere)
    scene.add(new THREE.AmbientLight(0x173238, 0.34))
    const sun = new THREE.DirectionalLight(0xffedc2, 4.2)
    sun.position.set(-4.5, 2.8, 5.2)
    scene.add(sun)
    const rim = new THREE.DirectionalLight(0x67b7d5, 0.75)
    rim.position.set(4, -1.5, -3)
    scene.add(rim)

    let adminData: GeoCollection | null = null
    let adminPromise: Promise<GeoCollection> | null = null
    const syncBoundaries = () => {
      const currentLevel = levelRef.current
      const selected = countryRef.current
      countryBorders.visible = currentLevel !== "world"
      countryMaterial.opacity = currentLevel === "country" || currentLevel === "region" ? 0.24 : 0.78
      countryHighlight.visible = currentLevel === "country" || currentLevel === "region"
      adminBorders.visible = currentLevel === "country" || currentLevel === "region"
      material.map = currentLevel === "world" || !highResReady ? colorMap : highResMap
      material.needsUpdate = true
      cloudMaterial.opacity = currentLevel === "world" ? 0.36 : currentLevel === "continent" ? 0.2 : currentLevel === "country" ? 0.08 : 0.025
      setTextureMode(currentLevel === "world" ? "2K GLOBAL" : highResReady ? "8K DETAIL" : "8K STREAMING")
      clearLineGroup(countryHighlight)
      clearLineGroup(adminBorders)
      clearMeshGroup(unvisitedMasks)
      if ((currentLevel === "country" || currentLevel === "region") && selected) {
        regionsRef.current.filter(item => !item.visited).forEach(item => {
          const normal = latLonToVector(item.focus[0], item.focus[1]).normalize()
          const mask = new THREE.Mesh(
            new THREE.CircleGeometry(0.038, 40),
            new THREE.MeshBasicMaterial({ color: 0x02090b, transparent: true, opacity: 0.56, depthWrite: false, side: THREE.DoubleSide }),
          )
          mask.position.copy(normal).multiplyScalar(1.539)
          mask.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal)
          unvisitedMasks.add(mask)
        })
      }
      if ((currentLevel !== "country" && currentLevel !== "region") || !selected || !apiRef.current?.countryFeatures.length) return
      const selectedFeature = apiRef.current.countryFeatures.find(feature => feature.properties.ADM0_A3 === selected.code)
      if (selectedFeature) addFeatureLines(countryHighlight, [selectedFeature], 1.529, highlightMaterial)
      const buildAdmin = (collection: GeoCollection) => {
        if (countryRef.current?.code !== selected.code || (levelRef.current !== "country" && levelRef.current !== "region")) return
        const provinces = collection.features.filter(feature => feature.properties.adm0_a3 === selected.code)
        addFeatureLines(adminBorders, provinces, 1.533, adminMaterial)
      }
      if (adminData) buildAdmin(adminData)
      else {
        adminPromise ??= fetch("/geo/admin1-all.geojson").then(response => response.json())
        adminPromise.then(collection => {
          adminData = collection
          buildAdmin(collection)
        })
      }
    }

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const pickCountry = (clientX: number, clientY: number) => {
      if (!apiRef.current?.countryFeatures.length) return
      const rect = canvas.getBoundingClientRect()
      pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
      raycaster.setFromCamera(pointer, camera)
      const intersection = raycaster.intersectObject(earth, false)[0]
      if (!intersection) return
      globe.updateMatrixWorld(true)
      const localPoint = globe.worldToLocal(intersection.point.clone())
      const [lat, lon] = vectorToLatLon(localPoint)
      const feature = apiRef.current.countryFeatures.find(candidate => pointInFeature(lon, lat, candidate))
      if (!feature) return
      const properties = feature.properties
      onCountrySelectRef.current?.({
        code: String(properties.ADM0_A3),
        name: String(properties.NAME_ZH || properties.NAME || properties.ADMIN),
        english: String(properties.NAME_EN || properties.NAME || properties.ADMIN),
        focus: [Number(properties.LABEL_Y || lat), Number(properties.LABEL_X || lon)],
      })
    }

    apiRef.current = {
      globe,
      camera,
      earth,
      countryFeatures: [],
      countryBorders,
      countryHighlight,
      adminBorders,
      unvisitedMasks,
      sync: syncBoundaries,
      pick: pickCountry,
    }
    fetch("/geo/countries.geojson")
      .then(response => response.json())
      .then((collection: GeoCollection) => {
        if (!apiRef.current) return
        apiRef.current.countryFeatures = collection.features
        addFeatureLines(countryBorders, collection.features, 1.523, countryMaterial)
        syncBoundaries()
        setBoundariesReady(true)
      })

    let routeAnimation: {
      id: number
      start: number
      duration: number
      stage: "departing" | "enroute" | "arriving" | "arrived"
      startQuaternion: THREE.Quaternion
      fromQuaternion: THREE.Quaternion
      toQuaternion: THREE.Quaternion
      fromVector: THREE.Vector3
      routeRotation: THREE.Quaternion
      startCameraZ: number
      line: THREE.Line
      geometry: THREE.BufferGeometry
      material: THREE.LineBasicMaterial
    } | null = null
    let lastRouteId = 0
    const routeStepQuaternion = new THREE.Quaternion()
    const routeDisplayPoint = new THREE.Vector3()
    const beginRouteFlight = (request: GlobeRouteFlight, time: number) => {
      lastRouteId = request.id
      transitionRef.current = null
      setTransitioning(false)
      const fromVector = latLonToVector(request.from.focus[0], request.from.focus[1]).normalize()
      const toVector = latLonToVector(request.to.focus[0], request.to.focus[1]).normalize()
      const routeRotation = new THREE.Quaternion().setFromUnitVectors(fromVector, toVector)
      const points: THREE.Vector3[] = []
      for (let index = 0; index <= 120; index += 1) {
        const progress = index / 120
        routeStepQuaternion.identity().slerp(routeRotation, progress)
        const point = fromVector.clone().applyQuaternion(routeStepQuaternion)
        point.multiplyScalar(1.575 + Math.sin(Math.PI * progress) * 0.17)
        points.push(point)
      }
      const routeGeometry = new THREE.BufferGeometry().setFromPoints(points)
      const routeMaterial = new THREE.LineBasicMaterial({ color: 0xffd28e, transparent: true, opacity: 0.94 })
      const routeLine = new THREE.Line(routeGeometry, routeMaterial)
      globe.add(routeLine)
      routeAnimation = {
        id: request.id,
        start: time,
        duration: 5400,
        stage: "departing",
        startQuaternion: globe.quaternion.clone(),
        fromQuaternion: focusQuaternion(request.from.focus),
        toQuaternion: focusQuaternion(request.to.focus),
        fromVector,
        routeRotation,
        startCameraZ: camera.position.z,
        line: routeLine,
        geometry: routeGeometry,
        material: routeMaterial,
      }
      setRouteFlightStage("departing")
    }

    const projected = new THREE.Vector3()
    const worldPoint = new THREE.Vector3()
    const axis = new THREE.Vector3(0, 1, 0)
    const autoTurn = new THREE.Quaternion()
    let frame = 0
    let lastTime = performance.now()
    let transitionFinished = false

    const resize = () => {
      const { width, height } = shell.getBoundingClientRect()
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(shell)
    resize()

    const render = (time: number) => {
      const delta = Math.min((time - lastTime) / 16.67, 2)
      lastTime = time
      const requestedRoute = routeFlightRef.current
      if (requestedRoute && requestedRoute.id !== lastRouteId && !routeAnimation) beginRouteFlight(requestedRoute, time)
      if (routeAnimation) {
        const activeRoute = routeAnimation
        const progress = Math.min((time - activeRoute.start) / activeRoute.duration, 1)
        let routeProgress = 0
        let nextStage: "departing" | "enroute" | "arriving" | "arrived" = "departing"
        if (progress < 0.18) {
          const phase = easeInOutExpo(progress / 0.18)
          globe.quaternion.copy(activeRoute.startQuaternion).slerp(activeRoute.fromQuaternion, phase)
          camera.position.z = THREE.MathUtils.lerp(activeRoute.startCameraZ, 4.9, phase)
        } else if (progress < 0.72) {
          const phase = easeInOutExpo((progress - 0.18) / 0.54)
          routeProgress = phase
          nextStage = "enroute"
          globe.quaternion.copy(activeRoute.fromQuaternion).slerp(activeRoute.toQuaternion, phase)
          camera.position.z = 4.9 - Math.sin(Math.PI * phase) * 0.42
        } else if (progress < 0.88) {
          const phase = easeInOutExpo((progress - 0.72) / 0.16)
          routeProgress = 1
          nextStage = "arriving"
          globe.quaternion.copy(activeRoute.toQuaternion)
          camera.position.z = THREE.MathUtils.lerp(4.9, 3.15, phase)
        } else {
          const phase = Math.min(1, (progress - 0.88) / 0.12)
          routeProgress = 1
          nextStage = "arrived"
          globe.quaternion.copy(activeRoute.toQuaternion)
          camera.position.z = phase < 0.46 ? 3.15 : THREE.MathUtils.lerp(3.15, 4.75, easeInOutExpo((phase - 0.46) / 0.54))
          activeRoute.material.opacity = 0.94 * (1 - phase)
        }
        if (activeRoute.stage !== nextStage) {
          activeRoute.stage = nextStage
          setRouteFlightStage(nextStage)
        }
        routeStepQuaternion.identity().slerp(activeRoute.routeRotation, routeProgress)
        routeDisplayPoint.copy(activeRoute.fromVector).applyQuaternion(routeStepQuaternion).multiplyScalar(1.68 + Math.sin(Math.PI * routeProgress) * 0.12)
        if (progress >= 1) {
          targetQuaternion.current.copy(activeRoute.toQuaternion)
          globe.remove(activeRoute.line)
          activeRoute.geometry.dispose()
          activeRoute.material.dispose()
          routeAnimation = null
          setRouteFlightStage(null)
          onRouteFlightCompleteRef.current?.()
        }
      } else {
        const flight = transitionRef.current
        if (flight) {
          const progress = Math.min((time - flight.start) / flight.duration, 1)
          // Rotation starts immediately (no 0.12 delay), uses expo for weighty feel
          const rotateProgress = easeInOutExpo(Math.max(0, Math.min(1, (progress - 0.05) / 0.85)))
          globe.quaternion.copy(flight.startQuaternion).slerp(flight.endQuaternion, rotateProgress)
          // Camera: brief pull-back (first 15%), then dive with easeOutQuint
          if (progress < 0.15) {
            camera.position.z = THREE.MathUtils.lerp(flight.startZ, flight.pullZ, progress / 0.15)
          } else {
            camera.position.z = THREE.MathUtils.lerp(flight.pullZ, flight.endZ, easeOutQuint((progress - 0.15) / 0.85))
          }
          if (progress >= 1) {
            globe.quaternion.copy(flight.endQuaternion)
            targetQuaternion.current.copy(flight.endQuaternion)
            camera.position.z = flight.endZ
            transitionRef.current = null
            if (!transitionFinished) {
              transitionFinished = true
              setTransitioning(false)
            }
          } else transitionFinished = false
        } else {
          // Spin on Earth's polar axis (local Y) so China-front / north-up orientation stays stable.
          if (!reducedMotion && quality !== "low" && levelRef.current === "world" && !drag.current) {
            autoTurn.setFromAxisAngle(axis, speed * delta)
            targetQuaternion.current.multiply(autoTurn)
          }
          globe.quaternion.slerp(targetQuaternion.current, 0.055)
        }
      }
      // Cloud layer rotates ~1.2x faster than its previous rate, independent
      // from the globe surface so clouds visibly drift against terrain.
      if (!reducedMotion && quality !== "low") clouds.rotation.y += 0.000384 * delta

      const { width, height } = shell.getBoundingClientRect()
      if (flightPlaneRef.current) {
        if (routeAnimation) {
          worldPoint.copy(routeDisplayPoint).applyQuaternion(globe.quaternion)
          projected.copy(worldPoint).project(camera)
          flightPlaneRef.current.style.opacity = worldPoint.z > 0.05 ? "1" : "0"
          flightPlaneRef.current.style.transform = `translate3d(${(projected.x * .5 + .5) * width}px, ${(-projected.y * .5 + .5) * height}px, 0) translate(-50%, -50%) rotate(-18deg)`
        } else {
          flightPlaneRef.current.style.opacity = "0"
        }
      }
      configRef.current.markers.forEach((marker, index) => {
        const label = labelsRef.current[index]
        if (!label) return
        worldPoint.copy(latLonToVector(marker.location[0], marker.location[1], 1.54)).applyQuaternion(globe.quaternion)
        projected.copy(worldPoint).project(camera)
        const visible = levelRef.current === "continent" && !transitionRef.current && worldPoint.z > 0.1
        label.style.opacity = visible ? "1" : "0"
        label.style.transform = `translate3d(${(projected.x * .5 + .5) * width}px, ${(-projected.y * .5 + .5) * height}px, 0) translate(-50%, -105%)`
      })
      // Destination Beacons — HTML nodes projected from lat/lon (world level)
      beaconsRef.current.forEach((beacon, index) => {
        const el = beaconElsRef.current[index]
        if (!el) return
        worldPoint.copy(latLonToVector(beacon.focus[0], beacon.focus[1], 1.52)).applyQuaternion(globe.quaternion)
        projected.copy(worldPoint).project(camera)
        const onFront = worldPoint.z > 0.12
        const inView = projected.x > -1.15 && projected.x < 1.15 && projected.y > -1.15 && projected.y < 1.15
        const visible = levelRef.current === "world" && !transitionRef.current && !routeAnimation && onFront && inView
        el.style.opacity = visible ? "1" : "0"
        el.style.pointerEvents = visible ? "auto" : "none"
        el.style.zIndex = String(20 + Math.round(worldPoint.z * 40))
        el.style.transform = `translate3d(${(projected.x * .5 + .5) * width}px, ${(-projected.y * .5 + .5) * height}px, 0) translate(-50%, -100%)`
      })
      if (focusLabelRef.current) {
        const focus = levelRef.current === "region" && regionRef.current
          ? regionRef.current.focus
          : levelRef.current === "country" && countryRef.current ? countryRef.current.focus : configRef.current.focus
        worldPoint.copy(latLonToVector(focus[0], focus[1], 1.56)).applyQuaternion(globe.quaternion)
        projected.copy(worldPoint).project(camera)
        const visible = levelRef.current !== "world" && !transitionRef.current && worldPoint.z > 0.12
        focusLabelRef.current.style.opacity = visible ? "1" : "0"
        focusLabelRef.current.style.transform = `translate3d(${(projected.x * .5 + .5) * width}px, ${(-projected.y * .5 + .5) * height}px, 0) translate(-50%, -50%)`
      }
      renderer.render(scene, camera)
      frame = requestAnimationFrame(render)
    }
    frame = requestAnimationFrame(render)

    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
      apiRef.current = null
      clearLineGroup(countryBorders)
      clearLineGroup(countryHighlight)
      clearLineGroup(adminBorders)
      clearMeshGroup(unvisitedMasks)
      if (routeAnimation) {
        globe.remove(routeAnimation.line)
        routeAnimation.geometry.dispose()
        routeAnimation.material.dispose()
        routeAnimation = null
      }
      geometry.dispose(); material.dispose(); cloudGeometry.dispose(); cloudMaterial.dispose()
      atmosphere.geometry.dispose(); (atmosphere.material as THREE.Material).dispose()
      countryMaterial.dispose(); highlightMaterial.dispose(); adminMaterial.dispose()
      ;[colorMap, highResMap, normalMap, oceanMask, lightsMap, cloudsMap].forEach(texture => texture.dispose())
      renderer.dispose()
    }
  }, [speed, quality, reducedMotion])

  const config = continentConfig[continent]
  const focus = level === "region" && region
    ? region.focus
    : level === "country" && country ? country.focus : config.focus
  const focusName = level === "region" && region
    ? region.name
    : level === "country" && country ? country.name : continent
  const flightStageLabel = routeFlightStage === "departing" ? "DEPARTING FROM HOME"
    : routeFlightStage === "enroute" ? "FOLLOWING GREAT-CIRCLE ROUTE"
    : routeFlightStage === "arriving" ? "DESCENDING TO DESTINATION"
        : "DESTINATION READY"
  return (
    <div ref={shellRef} className={`cobe-globe terrain-globe level-${level} ${transitioning ? "is-travelling" : ""} ${className}`}>
      <div className="sun-source"><i /><span>SUNLIGHT<br />DIRECTIONAL</span></div>
      <div className="solar-ray" />
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        aria-label={`${focusName}真实地貌三维地图，可拖动旋转${level === "continent" ? "，单击国家继续探索" : ""}`}
      />
      {routeFlight && routeFlightStage && <>
        <span ref={flightPlaneRef} className="route-flight-plane">✈</span>
        <div className={`route-flight-hud stage-${routeFlightStage}`}><span>{flightStageLabel}</span><b>{routeFlight.from.name}<i>→</i>{routeFlight.to.name}</b><small>3D EARTH · CAMERA FOLLOW</small></div>
      </>}
      <div className="light-status"><span>☀ DAYLIGHT</span><span>◐ NIGHT LIGHTS</span></div>
      <div className="terrain-legend">
        {config.markers.map((marker, index) => (
          <span ref={element => { labelsRef.current[index] = element }} className="terrain-pin" key={marker.id}>
            <i>{marker.symbol}</i><b>{marker.label}</b>
          </span>
        ))}
        <span ref={focusLabelRef} className="region-anchor">
          <i /><b>{focusName}</b><small>{focus[0]}° · {focus[1]}°</small>
        </span>
      </div>
      <div className="beacon-layer" aria-label="Destination beacons">
        {beacons.map((beacon, index) => (
          <button
            type="button"
            key={beacon.id}
            ref={element => { beaconElsRef.current[index] = element }}
            className={`dest-beacon visual-${beacon.visual} status-${beacon.status.toLowerCase()}`}
            style={{ opacity: 0, pointerEvents: "none" }}
            onClick={event => {
              event.stopPropagation()
              onBeaconSelectRef.current?.(beacon)
            }}
            aria-label={`${beacon.title}，${beacon.status}`}
          >
            <span className="beacon-fx" aria-hidden="true">
              <i className="beacon-core">{beacon.symbol}</i>
              <i className="beacon-ring r1" />
              <i className="beacon-ring r2" />
              <i className="beacon-pillar" />
              <i className="beacon-spark s1" /><i className="beacon-spark s2" /><i className="beacon-spark s3" />
            </span>
            <span className="beacon-label">
              <small>{beacon.status === "WISHLIST" ? "心愿中" : beacon.status === "EXPLORED" || beacon.status === "DEEP_EXPLORED" ? "已到访" : beacon.status === "UNLOCKED" ? "准备完成" : beacon.status === "PREPARING" ? "准备中" : "待探索"}</small>
              <b>{beacon.title.split(" · ")[0]}</b>
            </span>
          </button>
        ))}
      </div>
      {level !== "world" && <div className="boundary-legend">
        <i className={boundariesReady ? "ready" : ""}/>
        {level === "continent" ? "国家边界 · 点击选择" : level === "region" ? "地区聚焦 · 省州边界" : "省 / 州边界"}
      </div>}
      <div className={`texture-tier ${textureMode.startsWith("8K") ? "detail" : ""}`}><i/>{textureMode}</div>
      {transitioning && <div className="cinematic-flight">
        <div className="flight-reticle"><i/><i/><i/></div>
        <span>{level === "region" ? "DESCENDING TO REGION" : level === "country" ? "DESCENDING TO COUNTRY" : "ORBITAL APPROACH"}</span>
        <b>{focusName}</b>
        <small>{focus[0]}° / {focus[1]}°</small>
      </div>}
      <div className="geo-coordinate">FOCUS {focus[0]}° · {focus[1]}°</div>
      <div className="drag-hint">{level === "continent" ? "单击国家 · 拖动旋转" : "↔ 拖动旋转地球"}</div>
    </div>
  )
}
