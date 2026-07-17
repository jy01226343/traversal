import { useEffect, useRef, useState } from "react"
import L from "leaflet"
import { RESOURCE_ICONS, type DestinationCountry, type DestinationRegion } from "@/data/destinations"
import { getSectorPalette, PROVINCE_TO_REGION, resolveProvinceSector } from "@/data/province-sectors"
import type { AttractionMapView, RankedAttraction } from "@/features/attraction-explorer"
import { categoryIcon, renderIconSvg } from "@/features/attraction-explorer/icons"
import { getAttractionMarkerMode } from "@/features/attraction-explorer/focus-state"
import { resolveMarkerPresentations } from "@/features/attraction-explorer/marker-layout"

interface PickedCountry {
  code: string
  name: string
  english: string
  focus: [number, number]
}

interface FlatAtlasMapProps {
  continent: string
  level: "continent" | "country" | "region"
  country: DestinationCountry | null
  region: DestinationRegion | null
  regions: DestinationRegion[]
  attractions: RankedAttraction[]
  selectedAttraction: RankedAttraction | null
  hoveredAttractionId?: string | null
  comparedAttractionIds?: string[]
  journeyStops?: Array<{ id: string; label: string; latitude: number; longitude: number; order: number }>
  /** Set of `countryCode:regionId` currently on wishlist */
  wishedRegionKeys?: string[]
  onCountrySelect: (country: PickedCountry) => void
  onRegionSelect: (region: DestinationRegion) => void
  /** Unlocked / free regions open map; locked pins toggle wishlist */
  onRegionWish?: (region: DestinationRegion) => void
  onAttractionSelect: (attraction: RankedAttraction) => void
  onAttractionHover?: (id: string | null) => void
  onMapBlankClick?: () => void
  onMapViewChange: (view: AttractionMapView) => void
  /** Fired when user zooms out from region to country level (zoom drops below threshold) */
  onExitToCountry?: () => void
  /** Fired when user zooms out from attraction detail to region list (zoom drops below detail threshold) */
  onExitToRegionList?: () => void
  /** Fired when user zooms out from country to continent level (zoom drops below threshold) */
  onExitToContinent?: () => void
  /** Commands from the mobile overlay; map stays mounted and owns its Leaflet instance. */
  mapCommand?: { id: number; type: "locate" | "zoom_in" | "zoom_out" } | null
  /** Space reserved beneath a selected marker for a mobile bottom sheet. */
  cameraBottomPadding?: number
}

const continentConfig: Record<string, { file: string; focus: [number, number]; zoom: number }> = {
  亚洲: { file: "asia", focus: [34, 105], zoom: 3.25 },
  欧洲: { file: "europe", focus: [50, 14], zoom: 4 },
  大洋洲: { file: "oceania", focus: [-24, 135], zoom: 3.5 },
  北美: { file: "north-america", focus: [43, -105], zoom: 3.5 },
  南美: { file: "south-america", focus: [-15, -60], zoom: 3.2 },
  非洲: { file: "africa", focus: [2, 20], zoom: 3.1 },
}

function countryFromFeature(feature: GeoJSON.Feature): PickedCountry {
  const properties = (feature.properties || {}) as Record<string, string | number>
  return {
    code: String(properties.ADM0_A3),
    name: String(properties.NAME_ZH || properties.NAME || properties.ADMIN),
    english: String(properties.NAME_EN || properties.NAME || properties.ADMIN),
    focus: [Number(properties.LABEL_Y || 0), Number(properties.LABEL_X || 0)],
  }
}

function resourceMarker(
  region: DestinationRegion,
  selected: boolean,
  wished: boolean,
  onSelect: () => void,
) {
  const primary = region.resources[0]
  const icon = RESOURCE_ICONS[primary?.type] || "✦"
  const unvisited = !region.visited
  const hint = unvisited
    ? (wished ? "心愿中 · 点击查看地区" : "待探索 · 点击查看地区")
    : "已到访 · 进入地区"
  const html = `<div class="map-resource-pin ${region.visited ? "is-visited" : "is-unvisited"} ${selected ? "is-selected" : ""} ${wished ? "is-wished" : ""}" title="${hint}">
    <span>${icon}</span>
    <b>${region.name}</b>
    <small>${unvisited ? (wished ? "♥ 心愿中" : "待探索 · 仍可查看") : `${primary?.type || "旅行"}`}</small>
  </div>`
  const marker = L.marker(region.focus, {
    icon: L.divIcon({ html, className: "atlas-div-icon", iconSize: [124, 58], iconAnchor: [62, 52] }),
    pane: "atlas-resource-pane",
    keyboard: true,
    title: `${region.name} · ${hint}`,
  })
  marker.on("click", onSelect)
  return marker
}

/** Feature centroid for nearest-region assignment (fog slice ownership). */
function featureCentroid(feature: GeoJSON.Feature): [number, number] | null {
  try {
    const layer = L.geoJSON(feature as GeoJSON.GeoJsonObject)
    const center = layer.getBounds().getCenter()
    return [center.lat, center.lng]
  } catch {
    return null
  }
}

function nearestRegion(lat: number, lng: number, regions: DestinationRegion[]) {
  let best = regions[0]
  let bestDist = Number.POSITIVE_INFINITY
  for (const region of regions) {
    const [rLat, rLng] = region.focus
    const dLat = lat - rLat
    const dLng = (lng - rLng) * Math.cos((lat * Math.PI) / 180)
    const dist = dLat * dLat + dLng * dLng
    if (dist < bestDist) {
      bestDist = dist
      best = region
    }
  }
  return best
}

/** Find the item (by id) whose point is nearest to (lat, lng). */
function nearestPoint(lat: number, lng: number, items: { id: string; point: [number, number] }[]) {
  if (!items.length) return null
  let best = items[0]
  let bestDist = Number.POSITIVE_INFINITY
  for (const item of items) {
    const [iLat, iLng] = item.point
    const dLat = lat - iLat
    const dLng = (lng - iLng) * Math.cos((lat * Math.PI) / 180)
    const dist = dLat * dLat + dLng * dLng
    if (dist < bestDist) {
      bestDist = dist
      best = item
    }
  }
  return best
}

/**
 * China tourism-sector overlay — fill each admin1 province by its explicit
 * tourism sector (CHINA_PROVINCE_TO_REGION) using a per-sector color, so the
 * boundaries of 华东 / 华南 / 华北 … are unambiguous at a glance.
 * Each sector gets a soft translucent fill + a colored outline; the active
 * (hovered/selected) sector is brightened.
 */
/**
 * Tourism-sector overlay — fill each admin1 province by its explicit sector
 * (province-sectors mapping) using a per-sector color, so the boundaries of
 * each country's tourism regions (华东/华南, Kyushu/Okinawa, …) are unambiguous.
 * The active (hovered/selected) sector is brightened.
 */
function paintSectorOverlay(
  features: GeoJSON.Feature[],
  countryCode: string,
  overlayLayer: L.LayerGroup,
  renderer: L.Canvas,
  options: { activeRegionId?: string | null } = {},
) {
  if (!features.length) return 0
  let painted = 0
  features.forEach(feature => {
    const sectorId = resolveProvinceSector(countryCode, feature)
    if (!sectorId) return
    const palette = getSectorPalette(countryCode, sectorId)
    const active = options.activeRegionId === sectorId
    L.geoJSON(feature as GeoJSON.GeoJsonObject, {
      interactive: false,
      style: () => ({
        renderer,
        stroke: true,
        color: palette.stroke,
        weight: active ? 1.8 : 0.7,
        opacity: active ? 0.98 : 0.62,
        fill: true,
        fillColor: palette.fill,
        fillOpacity: active ? 0.55 : 0.3,
        lineJoin: "round",
        className: `atlas-sector-fill sector-${sectorId}`,
      }),
    }).addTo(overlayLayer)
    painted += 1
  })
  return painted
}

/**
 * Fog of war for locked regions — lightweight canvas mask slices only
 * (no SVG turbulence / mist wisps; those were freezing on complex admin geometry).
 * Province→region ownership prefers an explicit owner map when provided
 * (e.g. China's tourism sectors); otherwise it falls back to centroid nearest.
 */
function paintFogOfWar(
  features: GeoJSON.Feature[],
  regions: DestinationRegion[],
  fogLayer: L.LayerGroup,
  darkRenderer: L.Canvas,
  options: { activeRegionId?: string | null; ownerOf?: (feature: GeoJSON.Feature) => string | null } = {},
) {
  if (!features.length || !regions.length) return
  const lockedIds = new Set(
    regions
      .filter(region => {
        if (options.activeRegionId && region.id === options.activeRegionId) return false
        return !region.visited
      })
      .map(region => region.id),
  )
  if (!lockedIds.size) return

  const fogFeatures = features.filter(feature => {
    if (options.ownerOf) {
      const owner = options.ownerOf(feature)
      if (owner) return lockedIds.has(owner)
    }
    const center = featureCentroid(feature)
    if (!center) return false
    const owner = nearestRegion(center[0], center[1], regions)
    return lockedIds.has(owner.id)
  })
  if (!fogFeatures.length) return

  const collection = { type: "FeatureCollection", features: fogFeatures } as GeoJSON.FeatureCollection

  // Soft edge veil
  L.geoJSON(collection, {
    interactive: false,
    style: () => ({
      renderer: darkRenderer,
      stroke: true,
      color: "#0b1c20",
      weight: 8,
      opacity: 0.3,
      fill: true,
      fillColor: "#061014",
      fillOpacity: 0.22,
      lineCap: "round",
      lineJoin: "round",
      className: "atlas-fog-veil",
    }),
  }).addTo(fogLayer)

  // Solid dark mask slice matching admin boundaries
  L.geoJSON(collection, {
    interactive: false,
    style: () => ({
      renderer: darkRenderer,
      stroke: true,
      color: "#03090b",
      weight: 1,
      opacity: 0.45,
      fill: true,
      fillColor: "#010507",
      fillOpacity: 0.6,
      lineCap: "round",
      lineJoin: "round",
      className: "atlas-fog-mask",
    }),
  }).addTo(fogLayer)
}

/**
 * Region-level focus mask: darken everything outside the active region.
 * - Other countries (from continent GeoJSON): solid dark fill
 * - Same-country provinces not in the active region's sector: solid dark fill
 * This ensures the user's visual focus is the active region only.
 */
function paintFocusMask(
  continentFeatures: GeoJSON.Feature[],
  adminFeatures: GeoJSON.Feature[],
  countryCode: string,
  activeRegionId: string,
  fogLayer: L.LayerGroup,
  darkRenderer: L.Canvas,
) {
  // 1. Darken all OTHER countries from the continent GeoJSON
  const otherCountries = continentFeatures.filter(
    feature => feature.properties?.ADM0_A3 !== countryCode,
  )
  if (otherCountries.length) {
    const collection = { type: "FeatureCollection", features: otherCountries } as GeoJSON.FeatureCollection
    L.geoJSON(collection, {
      interactive: false,
      style: () => ({
        renderer: darkRenderer,
        stroke: false,
        fill: true,
        fillColor: "#010507",
        fillOpacity: 0.72,
        className: "atlas-focus-mask",
      }),
    }).addTo(fogLayer)
  }

  // 2. Darken same-country provinces not belonging to the active region
  const otherProvinces = adminFeatures.filter(feature => {
    const sectorId = resolveProvinceSector(countryCode, feature)
    return sectorId !== activeRegionId
  })
  if (!otherProvinces.length) return

  const collection = { type: "FeatureCollection", features: otherProvinces } as GeoJSON.FeatureCollection
  L.geoJSON(collection, {
    interactive: false,
    style: () => ({
      renderer: darkRenderer,
      stroke: true,
      color: "#03090b",
      weight: 1,
      opacity: 0.4,
      fill: true,
      fillColor: "#010507",
      fillOpacity: 0.68,
      lineCap: "round",
      lineJoin: "round",
      className: "atlas-focus-mask",
    }),
  }).addTo(fogLayer)
}

const KIND_LABELS = { must: "值得专程", alternative: "适合顺路发现", "easter-egg": "小众发现" }
/** 为景点生成 Lucide SVG 图标（根据 category_l2 精准匹配）。当前选中景点用金白色调。 */
function attractionPinIcon(item: RankedAttraction, selected: boolean): string {
  const Icon = categoryIcon(item)
  const color = selected ? "#fdf6e3" : "#e8e0c8"
  return `<span style="display:grid;place-items:center;width:100%;height:100%;color:${color}">${renderIconSvg(Icon, 17, color)}</span>`
}
const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, character => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" })[character] || character)

export function FlatAtlasMap({
  continent,
  level,
  country,
  region,
  regions,
  attractions,
  selectedAttraction,
  hoveredAttractionId = null,
  comparedAttractionIds = [],
  journeyStops = [],
  wishedRegionKeys = [],
  onCountrySelect,
  onRegionSelect,
  onRegionWish,
  onAttractionSelect,
  onAttractionHover,
  onMapBlankClick,
  onMapViewChange,
  onExitToCountry,
  onExitToRegionList,
  onExitToContinent,
  mapCommand,
  cameraBottomPadding = 0,
}: FlatAtlasMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const boundaryLayerRef = useRef<L.LayerGroup | null>(null)
  const fogLayerRef = useRef<L.LayerGroup | null>(null)
  const sectorOverlayLayerRef = useRef<L.LayerGroup | null>(null)
  const resourceLayerRef = useRef<L.LayerGroup | null>(null)
  const spotLayerRef = useRef<L.LayerGroup | null>(null)
  const journeyRouteLayerRef = useRef<L.LayerGroup | null>(null)
  const boundaryRendererRef = useRef<L.Canvas | null>(null)
  const fogRendererRef = useRef<L.Canvas | null>(null)
  const sectorOverlayRendererRef = useRef<L.Canvas | null>(null)
  const resourceRendererRef = useRef<L.Canvas | null>(null)
  const imageryLayerRef = useRef<L.TileLayer | null>(null)
  const requestIdRef = useRef(0)
  const previousSelectedAttractionRef = useRef<string | null>(null)
  /** Tracks programmatic flyTo to distinguish from user-initiated zoom/pan */
  const flyingRef = useRef(false)
  /** Tracks whether user has manually zoomed (to suppress auto-flyTo after) */
  const userZoomedRef = useRef(false)
  const onCountrySelectRef = useRef(onCountrySelect)
  const onRegionSelectRef = useRef(onRegionSelect)
  const onRegionWishRef = useRef(onRegionWish)
  const onAttractionSelectRef = useRef(onAttractionSelect)
  const onMapViewChangeRef = useRef(onMapViewChange)
  const onMapBlankClickRef = useRef(onMapBlankClick)
  const onExitToCountryRef = useRef(onExitToCountry)
  const onExitToRegionListRef = useRef(onExitToRegionList)
  const onExitToContinentRef = useRef(onExitToContinent)
  /** Grace window (ms epoch) after each programmatic flyTo starts. Stale
   *  moveend/zoomend events from an interrupted previous flight are ignored
   *  for exit/auto-advance decisions while inside this window — otherwise a
   *  fast continent→country click bounces back via exitToContinent. */
  const flightGraceUntilRef = useRef(0)
  /** True synchronously around programmatic flyTo/zoomIn/zoomOut calls.
   *  Leaflet fires `zoomstart` synchronously from flyTo's _moveStart, and our
   *  zoomstart handler must ignore those: calling map.stop() there injects
   *  setZoom(snap)+viewreset mid-flight, which races the flyTo frame loop and
   *  can leave the tile pane with a stale scale transform (tiles vs borders
   *  misaligned), besides corrupting flyingRef/userZoomedRef. */
  const programmaticZoomRef = useRef(false)
  const levelRef = useRef(level)
  levelRef.current = level
  const wishedRegionKeysRef = useRef(wishedRegionKeys)
  const [travelling, setTravelling] = useState(true)
  const [detailReady, setDetailReady] = useState(false)
  const [cityDetailMode, setCityDetailMode] = useState(false)
  const [scaleBar, setScaleBar] = useState({ text: "", widthPx: 60 })
  onCountrySelectRef.current = onCountrySelect
  onRegionSelectRef.current = onRegionSelect
  onRegionWishRef.current = onRegionWish
  onAttractionSelectRef.current = onAttractionSelect
  onMapViewChangeRef.current = onMapViewChange
  onMapBlankClickRef.current = onMapBlankClick
  onExitToCountryRef.current = onExitToCountry
  onExitToRegionListRef.current = onExitToRegionList
  onExitToContinentRef.current = onExitToContinent
  wishedRegionKeysRef.current = wishedRegionKeys

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, {
      center: continentConfig[continent].focus,
      zoom: 2.5,
      minZoom: 2,
      maxZoom: 18,
      zoomControl: false,
      attributionControl: true,
      zoomSnap: 0.25,
      wheelPxPerZoomLevel: 85,
      preferCanvas: true,
    })
    const boundaryPane = map.createPane("atlas-boundary-pane")
    const fogPane = map.createPane("atlas-fog-pane")
    const sectorOverlayPane = map.createPane("atlas-sector-pane")
    const resourcePane = map.createPane("atlas-resource-pane")
    const attractionPane = map.createPane("atlas-attraction-pane")
    boundaryPane.style.zIndex = "430"
    fogPane.style.zIndex = "434"
    fogPane.classList.add("atlas-fog-pane")
    sectorOverlayPane.style.zIndex = "436"
    resourcePane.style.zIndex = "440"
    attractionPane.style.zIndex = "460"
    boundaryRendererRef.current = L.canvas({ pane: "atlas-boundary-pane", padding: 0.8, tolerance: 8 })
    fogRendererRef.current = L.canvas({ pane: "atlas-fog-pane", padding: 0.8, tolerance: 8 })
    sectorOverlayRendererRef.current = L.canvas({ pane: "atlas-sector-pane", padding: 0.8, tolerance: 8 })
    resourceRendererRef.current = L.canvas({ pane: "atlas-resource-pane", padding: 0.8, tolerance: 8 })
    // 卫星瓦片多源降级：services.arcgisonline.com 在部分网络不可达时，
    // 自动切换到 Esri 经典端点，最终退到 Carto 暗色底图，避免"地图纹理消失"。
    const IMAGERY_SOURCES = [
      { url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", attribution: "Imagery © Esri, Maxar, Earthstar Geographics" },
      { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", attribution: "Imagery © Esri, Maxar, Earthstar Geographics" },
      { url: "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png", attribution: "© OpenStreetMap contributors © CARTO" },
    ]
    let imagerySourceIndex = 0
    let imageryErrorCount = 0
    let imageryTileLoaded = false
    let imageryProbeTimer = 0
    const armImageryProbe = () => {
      window.clearTimeout(imageryProbeTimer)
      // 网络挂起（连接超时，非快速报错）时 tileerror 要等浏览器超时才触发，
      // 纹理会空白十几秒。3 秒内没有任何瓦片加载成功就主动切到下一源。
      imageryProbeTimer = window.setTimeout(() => {
        if (!imageryTileLoaded) switchImagerySource()
      }, 3000)
    }
    const switchImagerySource = () => {
      if (imagerySourceIndex >= IMAGERY_SOURCES.length - 1) return
      imagerySourceIndex += 1
      imageryErrorCount = 0
      imageryTileLoaded = false
      const next = IMAGERY_SOURCES[imagerySourceIndex]
      imageryLayer.setUrl(next.url)
      if (map.attributionControl) {
        map.attributionControl.setPrefix(false).addAttribution(next.attribution)
      }
      armImageryProbe()
    }
    const imageryLayer = L.tileLayer(IMAGERY_SOURCES[0].url, {
      maxZoom: 18,
      attribution: IMAGERY_SOURCES[0].attribution,
    })
    imageryLayer.on("tileload", () => { imageryTileLoaded = true })
    imageryLayer.on("tileerror", () => {
      imageryErrorCount += 1
      if (imageryErrorCount >= 4) switchImagerySource()
    })
    armImageryProbe()
    imageryLayerRef.current = imageryLayer.addTo(map)
    L.control.zoom({ position: "bottomleft" }).addTo(map)
    boundaryLayerRef.current = L.layerGroup().addTo(map)
    fogLayerRef.current = L.layerGroup().addTo(map)
    sectorOverlayLayerRef.current = L.layerGroup().addTo(map)
    resourceLayerRef.current = L.layerGroup().addTo(map)
    spotLayerRef.current = L.layerGroup().addTo(map)
    journeyRouteLayerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    const redraw = () => requestAnimationFrame(() => map.invalidateSize({ animate: false, pan: false }))

    // Compute a human-readable scale bar from the current map view.
    // Measures the real-world distance of ~80px at the map center latitude.
    function computeScaleBar() {
      const zoom = map.getZoom()
      const center = map.getCenter()
      const lat = center.lat
      // Meters per pixel at this zoom and latitude
      const metersPerPixel = (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom)
      const targetPx = 80
      const targetMeters = metersPerPixel * targetPx
      // Round to a nice number: 1, 2, 5, 10, 20, 50, 100, 200, 500, 1km, 2km, 5km...
      const niceValues = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000, 1000000, 2000000]
      let chosen = niceValues[0]
      for (const v of niceValues) {
        if (v >= targetMeters) { chosen = v; break }
        chosen = v
      }
      const widthPx = chosen / metersPerPixel
      const text = chosen >= 1000
        ? chosen >= 100000
          ? `${Math.round(chosen / 1000)} km`
          : `${(chosen / 1000).toFixed(chosen >= 10000 ? 0 : 1)} km`
        : chosen >= 100
          ? `${chosen} m`
          : `${chosen} m`
      setScaleBar({ text, widthPx: Math.min(200, Math.max(40, widthPx)) })
    }

    const syncMapView = () => {
      const zoom = map.getZoom()
      const currentLevel = levelRef.current
      // Settled = no programmatic flight in progress AND outside the post-flyTo
      // grace window. Stale moveend/zoomend events from an interrupted flight
      // fire at intermediate zooms; without the grace check they can trigger a
      // false zoom-out exit (e.g. fast continent→country click bounces back).
      const settled = !flyingRef.current && Date.now() >= flightGraceUntilRef.current
      setCityDetailMode(zoom >= 9.2)
      // Bug 2 fix: skip state feedback during programmatic flyTo to prevent
      // zoom-reset feedback loop on mobile pinch-zoom
      if (settled) {
        const bounds = map.getBounds()
        onMapViewChangeRef.current({ zoom, bounds: { north: bounds.getNorth(), south: bounds.getSouth(), east: bounds.getEast(), west: bounds.getWest() } })
      }
      // Bug 1 part 2: when at region level and user zooms out below country
      // threshold, exit back to country level (restore sectors + region hotlist)
      if (currentLevel === "region" && zoom < 5.5 && settled) {
        onExitToCountryRef.current?.()
      }
      // Country -> continent: when at country level and user zooms out below
      // continent threshold, exit back to continent view
      if (currentLevel === "country" && zoom < 4.5 && settled) {
        onExitToContinentRef.current?.()
      }
      // Zoom-in transitions: auto-enter deeper level when zoom crosses threshold
      if (settled) {
        if (currentLevel === "country" && zoom >= 6.2 && regions.length) {
          const center = map.getCenter()
          const nearest = nearestPoint(center.lat, center.lng, regions.map(r => ({ id: r.id, point: r.focus })))
          if (nearest) onRegionSelectRef.current(regions.find(r => r.id === nearest.id)!)
        }
        if (currentLevel === "region" && zoom >= 8.2 && attractions.length) {
          const center = map.getCenter()
          const nearest = nearestPoint(center.lat, center.lng, attractions.map(a => ({ id: a.id, point: [a.lat_wgs84, a.lng_wgs84] as [number, number] })))
          if (nearest) onAttractionSelectRef.current(attractions.find(a => a.id === nearest.id)!)
        }
      }
      computeScaleBar()
      // Bug 3: when at region level with a selected attraction, zooming out
      // below the detail threshold clears the selection so the list returns
      // to the attraction explorer panel (not the detail view)
      if (currentLevel === "region" && zoom < 7.8 && settled) {
        onExitToRegionListRef.current?.()
      }
      computeScaleBar()
    }
    // Bug 2 fix: cancel any pending programmatic flyTo when user manually interacts
    const onUserZoomStart = () => {
      // 程序化 flyTo 的 zoomstart 是同步触发的：此时绝不能 map.stop()
      // （stop 会 setZoom 吸附整数缩放 + fire viewreset，与飞行帧循环争抢
      // 瓦片变换，可能留下残留 scale 导致瓦片/矢量错位）。
      if (programmaticZoomRef.current) return
      if (flyingRef.current) {
        map.stop()
        flyingRef.current = false
      }
      userZoomedRef.current = true
    }
    const onUserTouch = () => {
      if (flyingRef.current) {
        map.stop()
        flyingRef.current = false
      }
    }
    const resizeObserver = new ResizeObserver(redraw)
    resizeObserver.observe(containerRef.current)
    window.addEventListener("orientationchange", redraw)
    map.on("zoomstart", onUserZoomStart)
    map.on("touchstart", onUserTouch)
    map.on("click", () => onMapBlankClickRef.current?.())
    map.on("zoomend", syncMapView)
    map.on("moveend", syncMapView)
    const settleTimers = [80, 320, 720].map(delay => window.setTimeout(redraw, delay))
    redraw()
    return () => {
      resizeObserver.disconnect()
      window.removeEventListener("orientationchange", redraw)
      map.off("zoomstart", onUserZoomStart)
    map.off("touchstart", onUserTouch)
      map.off("click")
      map.off("zoomend", syncMapView)
      map.off("moveend", syncMapView)
      settleTimers.forEach(timer => window.clearTimeout(timer))
      window.clearTimeout(imageryProbeTimer)
      map.remove()
      mapRef.current = null
      boundaryRendererRef.current = null
      fogRendererRef.current = null
      sectorOverlayRendererRef.current = null
      resourceRendererRef.current = null
      imageryLayerRef.current = null
      spotLayerRef.current = null
      journeyRouteLayerRef.current = null
      fogLayerRef.current = null
      sectorOverlayLayerRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapCommand) return
    programmaticZoomRef.current = true
    try {
      if (mapCommand.type === "zoom_in") {
        map.zoomIn(1, { animate: true })
        return
      }
      if (mapCommand.type === "zoom_out") {
        map.zoomOut(1, { animate: true })
        return
      }
      const target = level === "region" && region
        ? region.focus
        : level === "country" && country
          ? country.focus
          : continentConfig[continent].focus
      map.flyTo(target, Math.max(map.getZoom(), level === "region" ? 7.4 : level === "country" ? 5.4 : continentConfig[continent].zoom), { animate: true, duration: 0.45 })
    } finally {
      programmaticZoomRef.current = false
    }
  }, [mapCommand, continent, country, level, region])

  useEffect(() => {
    const map = mapRef.current
    const boundaries = boundaryLayerRef.current
    const fogLayer = fogLayerRef.current
    const sectorOverlayLayer = sectorOverlayLayerRef.current
    const resources = resourceLayerRef.current
    const spots = spotLayerRef.current
    const boundaryRenderer = boundaryRendererRef.current
    const fogRenderer = fogRendererRef.current
    const resourceRenderer = resourceRendererRef.current
    const sectorOverlayRenderer = sectorOverlayRendererRef.current
    const imagery = imageryLayerRef.current
    if (!map || !boundaries || !fogLayer || !sectorOverlayLayer || !resources || !spots || !boundaryRenderer || !fogRenderer || !sectorOverlayRenderer || !resourceRenderer || !imagery) return
    const requestId = ++requestIdRef.current
    const controller = new AbortController()
    let cancelled = false
    let flightTimer = 0
    let tileTimer = 0
    let revealTimer = 0
    let onMoveEnd = () => {}
    let onTilesReady = () => {}
    const boundaryPane = map.getPane("atlas-boundary-pane")
    const fogPane = map.getPane("atlas-fog-pane")
    const sectorPane = map.getPane("atlas-sector-pane")
    const resourcePane = map.getPane("atlas-resource-pane")
    const attractionPane = map.getPane("atlas-attraction-pane")
    const transitionPanes = [boundaryPane, fogPane, sectorPane, resourcePane, attractionPane].filter(Boolean) as HTMLElement[]

    setTravelling(true)
    setDetailReady(false)
    transitionPanes.forEach(pane => {
      pane.classList.add("is-switching")
      pane.classList.remove("is-ready")
    })
    boundaries.clearLayers()
    fogLayer.clearLayers()
    sectorOverlayLayer.clearLayers()
    resources.clearLayers()
    spots.clearLayers()
    setCityDetailMode(false)

    const config = continentConfig[continent]
    const target = level === "region" && region ? region.focus : level === "country" && country ? country.focus : config.focus
    const zoom = level === "region" ? 7.4 : level === "country" ? 5.4 : config.zoom
    // Snappier flights: continent needs a bit more distance, country/region are quick dives
    const flightDuration = level === "continent" ? 1.05 : level === "country" ? 0.85 : 0.75

    // Track flight completion for overlay sync
    const flightComplete = new Promise<void>(resolve => {
      let finished = false
      onMoveEnd = () => {
        if (finished) return
        finished = true
        map.off("moveend", onMoveEnd)
        window.clearTimeout(flightTimer)
        resolve()
      }
      map.once("moveend", onMoveEnd)
      flightTimer = window.setTimeout(onMoveEnd, flightDuration * 1000 + 300)
    })

    // Tiles-loading gate — very generous fallback so it never blocks reveal indefinitely
    const terrainComplete = new Promise<void>(resolve => {
      let finished = false
      onTilesReady = () => {
        if (finished) return
        finished = true
        imagery.off("load", onTilesReady)
        window.clearTimeout(tileTimer)
        resolve()
      }
      imagery.once("load", onTilesReady)
      tileTimer = window.setTimeout(onTilesReady, flightDuration * 1000 + 800)
    })

    flyingRef.current = true
    userZoomedRef.current = false
    flightGraceUntilRef.current = Date.now() + flightDuration * 1000 + 700
    programmaticZoomRef.current = true
    try {
      map.flyTo(target, zoom, { animate: true, duration: flightDuration, easeLinearity: 0.28 })
    } finally {
      programmaticZoomRef.current = false
    }
    flightComplete.then(() => {
      flyingRef.current = false
      // 保险：飞行结束后若瓦片 pane 仍残留缩放变换（被中断的 zoom 动画），
      // 触发一次 viewreset 让瓦片层按当前视图复位（矢量层随之重绘）。
      const tilePane = map.getPane("tilePane")
      if (tilePane && (tilePane.style.transform || "").includes("scale")) {
        map.fire("viewreset")
      }
    })

    const continentUrl = `/geo/continents/${config.file}.geojson`
    const loadGeoJson = async (url: string) => {
      const response = await fetch(url, { signal: controller.signal })
      if (!response.ok) throw new Error(`Unable to load map geometry: ${url}`)
      return response.json() as Promise<GeoJSON.FeatureCollection>
    }
    const adminPromise = level !== "continent" && country
      ? loadGeoJson(`/geo/admin1/${country.code.toLowerCase()}.geojson`)
      : Promise.resolve<GeoJSON.FeatureCollection | null>(null)
    // Load global countries GeoJSON at region level to darken other continents
    const countriesPromise = level === "region"
      ? loadGeoJson(`/geo/countries.geojson`)
      : Promise.resolve<GeoJSON.FeatureCollection | null>(null)

    const geometryComplete = Promise.all([loadGeoJson(continentUrl), adminPromise, countriesPromise]).then(([data, adminData, countriesData]) => {
      if (cancelled || requestId !== requestIdRef.current) return null
      // NOTE: borders are NOT drawn here. They are drawn in the Promise.all().then()
      // below, AFTER tiles are ready, so borders and tiles reveal together (no flash).
      return { data, adminData, countriesData }
    })

    // Draw borders from loaded geo data. Called only after tiles + flight are ready.
    // Refs are guaranteed non-null (checked at top of useEffect); alias them here.
    function drawBoundaries(geo: { data: GeoJSON.FeatureCollection; adminData: GeoJSON.FeatureCollection | null; countriesData: GeoJSON.FeatureCollection | null } | null) {
      if (!geo) return
      const br = boundaryRenderer!
      const bl = boundaries!
      const fl = fogLayer!
      const sol = sectorOverlayLayer!
      const sor = sectorOverlayRenderer!
      const fr = fogRenderer!
      const rl = resources!
      const { data, adminData } = geo
      if (level === "continent") {
        L.geoJSON(data, {
          interactive: false,
          style: () => ({ renderer: br, color: "#061718", weight: 3.1, opacity: 0.76, fill: false, lineCap: "round", lineJoin: "round" }),
        }).addTo(bl)
        L.geoJSON(data, {
          style: () => ({ renderer: br, color: "#f7dfaa", weight: 1.15, opacity: 0.96, fillColor: "#173e3d", fillOpacity: 0.055, lineCap: "round", lineJoin: "round" }),
          onEachFeature: (feature, layer) => {
            layer.on({ click: () => onCountrySelectRef.current(countryFromFeature(feature)) })
            const picked = countryFromFeature(feature)
            layer.bindTooltip(picked.name, { className: "atlas-country-tooltip", sticky: true, direction: "top" })
          },
        }).addTo(bl)
      } else if (country) {
        const selected = data.features.filter((feature: GeoJSON.Feature) => feature.properties?.ADM0_A3 === country.code)
        L.geoJSON({ type: "FeatureCollection", features: selected } as GeoJSON.FeatureCollection, {
          interactive: false,
          style: () => ({ renderer: br, color: "#07191a", weight: 4.1, opacity: 0.84, fill: false, lineCap: "round", lineJoin: "round" }),
        }).addTo(bl)
        L.geoJSON({ type: "FeatureCollection", features: selected } as GeoJSON.FeatureCollection, {
          style: () => ({ renderer: br, color: "#ef8c66", weight: 1.75, opacity: 1, fill: false, lineCap: "round", lineJoin: "round" }),
        }).addTo(bl)
      }

      if (level !== "continent" && country && adminData) {
        L.geoJSON(adminData, {
          interactive: false,
          style: () => ({ renderer: br, color: "#061718", weight: 2.5, opacity: 0.68, fill: false, lineCap: "round", lineJoin: "round" }),
        }).addTo(bl)
        L.geoJSON(adminData, {
          style: () => ({ renderer: br, color: "#fff1ca", weight: level === "region" ? 1.2 : 1, opacity: 0.93, fillColor: "#071f22", fillOpacity: 0.035, dashArray: level === "region" ? undefined : "5 3", lineCap: "round", lineJoin: "round" }),
          onEachFeature: (feature, layer) => {
            const name = feature.properties?.name_zh || feature.properties?.name || feature.properties?.name_en
            if (name) layer.bindTooltip(String(name), { className: "atlas-province-tooltip", sticky: true })
            // Click province to enter its region (same as clicking hotlist item)
            if (level === "country") {
              layer.on("click", () => {
                const sectorId = resolveProvinceSector(country.code, feature)
                if (!sectorId) return
                const target = regions.find(r => r.id === sectorId)
                if (target) onRegionSelectRef.current(target)
              })
            }
          },
        }).addTo(bl)

        const hasSectorMap = level === "country" && paintSectorOverlay(
          adminData.features as GeoJSON.Feature[],
          country.code,
          sol,
          sor,
          { activeRegionId: region?.id },
        ) > 0

        if (level === "region" && region) {
          paintFocusMask(
            data.features as GeoJSON.Feature[],
            adminData.features as GeoJSON.Feature[],
            country.code,
            region.id,
            fl,
            fr,
          )
        } else {
          paintFogOfWar(adminData.features as GeoJSON.Feature[], regions, fl, fr, {
            activeRegionId: region?.id,
            ownerOf: hasSectorMap
              ? (feature) => resolveProvinceSector(country.code, feature)
              : undefined,
          })
        }

        if (level === "country") {
          regions.forEach(item => {
            const isWished = wishedRegionKeysRef.current.includes(`${country.code}:${item.id}`)
            const handlePin = () => {
              onRegionSelectRef.current(item)
            }
            resourceMarker(item, region?.id === item.id, isWished, handlePin).addTo(rl)
          })
        }
      } else if (level === "country" && country && regions.length) {
        regions.filter(item => !item.visited).forEach(item => {
          L.circle(item.focus, {
            renderer: fr,
            radius: 150000,
            stroke: true,
            color: "#061014",
            weight: 8,
            fillColor: "#010507",
            fillOpacity: 0.62,
            opacity: 0.35,
            interactive: false,
            className: "atlas-fog-mask",
          }).addTo(fl)
        })
        regions.forEach(item => {
          const isWished = wishedRegionKeysRef.current.includes(`${country.code}:${item.id}`)
          const handlePin = () => {
            onRegionSelectRef.current(item)
          }
          resourceMarker(item, region?.id === item.id, isWished, handlePin).addTo(rl)
        })
      }
      setDetailReady(level === "continent" || Boolean(adminData))
    }

    // Progressive reveal: draw + reveal boundaries as soon as geometry loads,
    // without waiting for tiles. This cuts perceived latency by 300-600ms.
    geometryComplete.then((geoData) => {
      if (cancelled || requestId !== requestIdRef.current || !geoData) return
      drawBoundaries(geoData)
      map.invalidateSize({ animate: false, pan: false })
      map.fire("viewreset")
      // Reveal panes with stagger — boundaries first, then fog/sector, then resources
      requestAnimationFrame(() => {
        if (cancelled || requestId !== requestIdRef.current) return
        transitionPanes.forEach(pane => {
          pane.classList.remove("is-switching")
          pane.classList.add("is-ready")
        })
      })
    }).catch(error => {
      if (cancelled || controller.signal.aborted) return
      console.warn(error)
      transitionPanes.forEach(pane => pane.classList.remove("is-switching"))
    })

    // Hide the flight overlay once both flight and tiles are settled
    Promise.all([flightComplete, terrainComplete]).then(() => {
      if (cancelled || requestId !== requestIdRef.current) return
      revealTimer = window.setTimeout(() => setTravelling(false), 120)
    })

    return () => {
      cancelled = true
      controller.abort()
      map.off("moveend", onMoveEnd)
      imagery.off("load", onTilesReady)
      window.clearTimeout(flightTimer)
      window.clearTimeout(tileTimer)
      window.clearTimeout(revealTimer)
    }
  }, [continent, country?.code, level, region?.id, regions])

  // Refresh country-level pins when wishlist changes (without re-flying the map)
  useEffect(() => {
    const resources = resourceLayerRef.current
    const countryItem = country
    if (!resources || level !== "country" || !countryItem || !regions.length) return
    resources.clearLayers()
    regions.forEach(item => {
      const isWished = wishedRegionKeys.includes(`${countryItem.code}:${item.id}`)
      const handlePin = () => {
        onRegionSelectRef.current(item)
      }
      resourceMarker(item, region?.id === item.id, isWished, handlePin).addTo(resources)
    })
  }, [wishedRegionKeys, level, country?.code, regions, region?.id])

  useEffect(() => {
    const map = mapRef.current
    const spotLayer = spotLayerRef.current
    if (!map || !spotLayer) return
    spotLayer.clearLayers()
    if (level !== "region") return
    const presentations = resolveMarkerPresentations(attractions.map(attraction => {
      const point = map.latLngToContainerPoint([attraction.lat_wgs84, attraction.lng_wgs84])
      const priority = attraction.selection_kind === "must" ? 3 : attraction.selection_kind === "alternative" ? 2 : 1
      return { id: attraction.id, x: point.x, y: point.y, priority, selected: attraction.id === selectedAttraction?.id }
    }))
    attractions.forEach(attraction => {
      const markerMode = getAttractionMarkerMode(attraction.id, selectedAttraction?.id, hoveredAttractionId)
      const presentation = presentations.get(attraction.id) || "compact"
      const isSelected = presentation === "selected"
      const coordinate = `${attraction.lat_wgs84.toFixed(3)}° · ${attraction.lng_wgs84.toFixed(3)}°`
      const html = isSelected
        ? `<div class="attraction-map-pin is-selected kind-${attraction.selection_kind}"><img src="${escapeHtml(attraction.image_url)}" alt=""/><div><span>${attractionPinIcon(attraction, true)}</span><p><b>${escapeHtml(attraction.name)}</b><small>${coordinate} · ${KIND_LABELS[attraction.selection_kind]}</small></p></div></div>`
        : presentation === "compact"
          ? `<div class="attraction-map-dot kind-${attraction.selection_kind}" aria-label="${escapeHtml(attraction.name)}"><span>${attractionPinIcon(attraction, false)}</span></div>`
          : `<div class="attraction-map-pin kind-${attraction.selection_kind}"><span>${attractionPinIcon(attraction, false)}</span><b>${escapeHtml(attraction.name)}</b><small>${KIND_LABELS[attraction.selection_kind]} · ${attraction.category_l2}</small></div>`
      const marker = L.marker([attraction.lat_wgs84, attraction.lng_wgs84], {
        pane: "atlas-attraction-pane",
        keyboard: true,
        title: `${attraction.name} · ${coordinate}`,
        icon: L.divIcon({ className: `atlas-div-icon marker-${markerMode} marker-${presentation} ${comparedAttractionIds.includes(attraction.id) ? "marker-compared" : ""} ${isSelected ? "selected-attraction-icon" : ""}`, iconSize: isSelected ? [184, 132] : presentation === "compact" ? [30, 30] : [112, 55], iconAnchor: isSelected ? [92, 128] : presentation === "compact" ? [15, 15] : [16, 52], html }),
        zIndexOffset: isSelected ? 600 : 0,
      })
      marker.on("click", event => {
        L.DomEvent.stopPropagation(event.originalEvent)
        onAttractionSelectRef.current(attraction)
      })
      marker.on("mouseover", () => onAttractionHover?.(attraction.id))
      marker.on("mouseout", () => onAttractionHover?.(null))
      marker.on("focus", () => onAttractionHover?.(attraction.id))
      marker.on("blur", () => onAttractionHover?.(null))
      marker.on("add", () => {
        const pin = marker.getElement()?.querySelector<HTMLElement>(".attraction-map-pin")
        if (!pin) return
        pin.addEventListener("click", event => {
          L.DomEvent.stopPropagation(event)
          onAttractionSelectRef.current(attraction)
        }, { once: true })
      })
      marker.addTo(spotLayer)
    })
  }, [attractions, level, selectedAttraction?.id, hoveredAttractionId, comparedAttractionIds, onAttractionHover])

  useEffect(() => {
    const routeLayer = journeyRouteLayerRef.current
    if (!routeLayer) return
    routeLayer.clearLayers()
    if (level !== "region" || !journeyStops.length) return
    const sorted = [...journeyStops].sort((a, b) => a.order - b.order)
    if (sorted.length > 1) L.polyline(sorted.map(stop => [stop.latitude, stop.longitude] as L.LatLngExpression), { color: "#e8833b", weight: 3, opacity: 0.9, dashArray: "7 6" }).addTo(routeLayer)
    sorted.forEach(stop => L.marker([stop.latitude, stop.longitude], { pane: "atlas-attraction-pane", keyboard: true, title: `${stop.order}. ${stop.label}`, icon: L.divIcon({ className: "atlas-journey-stop-icon", iconSize: [28, 28], iconAnchor: [14, 14], html: `<span class="journey-route-stop">${stop.order}</span>` }), zIndexOffset: 500 }).addTo(routeLayer))
  }, [level, journeyStops])

  useEffect(() => {
    const map = mapRef.current
    if (!map || level !== "region") return
    const previousId = previousSelectedAttractionRef.current
    if (selectedAttraction) {
      // Bug 2 fix: don't auto-fly if user is actively zooming/panning
      if (userZoomedRef.current) return
      flyingRef.current = true
      flightGraceUntilRef.current = Date.now() + 1400
      programmaticZoomRef.current = true
      try {
        map.flyTo([selectedAttraction.lat_wgs84, selectedAttraction.lng_wgs84], 8.75, { animate: true, duration: 0.7, easeLinearity: 0.3 })
          .once("moveend", () => {
            if (cameraBottomPadding) map.panBy([0, Math.round(cameraBottomPadding / 2)], { animate: true, duration: 0.22 })
            flyingRef.current = false
          })
      } finally {
        programmaticZoomRef.current = false
      }
    } else if (previousId && region) {
      if (userZoomedRef.current) return
      flyingRef.current = true
      flightGraceUntilRef.current = Date.now() + 1300
      programmaticZoomRef.current = true
      try {
        map.flyTo(region.focus, 7.4, { animate: true, duration: 0.6, easeLinearity: 0.32 })
          .once("moveend", () => { flyingRef.current = false })
      } finally {
        programmaticZoomRef.current = false
      }
    }
    previousSelectedAttractionRef.current = selectedAttraction?.id || null
  }, [level, region?.id, selectedAttraction?.id, cameraBottomPadding])

  return (
    <div className={`flat-atlas-map level-${level} ${travelling ? "is-flying" : ""} ${cityDetailMode ? "city-detail-mode" : ""}`}>
      <div ref={containerRef} className="leaflet-canvas" />
      <div className="flat-map-hud"><span><i className={detailReady || level === "continent" ? "ready" : ""}/>{level === "continent" ? "10M COUNTRY BORDERS" : "FOG OF WAR · BORDER MASK"}</span><b>SATELLITE DETAIL · Z{level === "region" ? "7.4+" : level === "country" ? "5.4" : continentConfig[continent].zoom}</b></div>
      <div className="map-scale-bar" aria-label="地图比例尺"><div className="scale-line" style={{ width: `${scaleBar.widthPx}px` }} /><span>{scaleBar.text}</span></div>
      {level === "country" && country && PROVINCE_TO_REGION[country.code] && (
        <div className="atlas-sector-legend" aria-label={`${country.name}旅游板块图例`}>
          <span>TOURISM SECTORS · 旅游板块</span>
          <ul>
            {(() => {
              // Only list regions that actually own ≥1 province in the sector map,
              // so non-province regions (e.g. CHN 大湾区) don't pollute the sector legend.
              const ownedSectors = new Set(Object.values(PROVINCE_TO_REGION[country.code]))
              return regions
                .filter(r => ownedSectors.has(r.id))
                .map(r => {
                  const palette = getSectorPalette(country.code, r.id)
                  return (
                    <li key={r.id} className={region?.id === r.id ? "is-active" : ""}>
                      <i style={{ background: palette.fill, borderColor: palette.stroke }} />
                      {r.name}
                    </li>
                  )
                })
            })()}
          </ul>
        </div>
      )}
      {selectedAttraction && <div className="city-focus-status"><span>已定位</span><b>{selectedAttraction.name}</b><small>LAT {selectedAttraction.lat_wgs84.toFixed(4)}° · LNG {selectedAttraction.lng_wgs84.toFixed(4)}°</small></div>}
      <div className={`flat-map-flight ${travelling ? "is-active" : ""}`}><i/><span>ATLAS SYNC</span><b>{region?.name || country?.name || continent}</b><small>同步新地形、卫星瓦片与边界…</small></div>
    </div>
  )
}
