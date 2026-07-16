import { useEffect, useRef, useState } from "react"
import L from "leaflet"
import { RESOURCE_ICONS, type DestinationCountry, type DestinationRegion } from "@/data/destinations"
import { getSectorPalette, PROVINCE_TO_REGION, resolveProvinceSector } from "@/data/province-sectors"
import type { AttractionMapView, RankedAttraction } from "@/features/attraction-explorer"

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
  /** Set of `countryCode:regionId` currently on wishlist */
  wishedRegionKeys?: string[]
  onCountrySelect: (country: PickedCountry) => void
  onRegionSelect: (region: DestinationRegion) => void
  /** Unlocked / free regions open map; locked pins toggle wishlist */
  onRegionWish?: (region: DestinationRegion) => void
  onAttractionSelect: (attraction: RankedAttraction) => void
  onMapViewChange: (view: AttractionMapView) => void
  /** Fired when user zooms out from region to country level (zoom drops below threshold) */
  onExitToCountry?: () => void
  /** Fired when user zooms out from attraction detail to region list (zoom drops below detail threshold) */
  onExitToRegionList?: () => void
  /** Fired when user zooms out from country to continent level (zoom drops below threshold) */
  onExitToContinent?: () => void
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
  const locked = !region.visited
  const hint = locked
    ? (wished ? "心愿中 · 再点可移出" : "未解锁 · 点击加入心愿单")
    : "已点亮 · 进入地区"
  const html = `<div class="map-resource-pin ${region.visited ? "is-visited" : "is-unvisited"} ${selected ? "is-selected" : ""} ${wished ? "is-wished" : ""}" title="${hint}">
    <span>${icon}</span>
    <b>${region.name}</b>
    <small>${locked ? (wished ? "♥ 心愿" : "♡ 加入心愿") : `${primary?.type || "旅行"} ${primary?.score || region.heat}`}</small>
    ${locked ? `<i class="pin-wish ${wished ? "on" : ""}">${wished ? "♥" : "♡"}</i>` : ""}
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

const ATTRACTION_ICONS: Record<string, string> = { 自然风光: "◉", 人文历史: "🏯", 户外极限: "🥾", 超级工程: "⌁", 网红奇观: "✦", 休闲露营: "⛺" }
const KIND_LABELS = { must: "必玩", alternative: "高替", "easter-egg": "彩蛋" }
const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, character => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" })[character] || character)

export function FlatAtlasMap({
  continent,
  level,
  country,
  region,
  regions,
  attractions,
  selectedAttraction,
  wishedRegionKeys = [],
  onCountrySelect,
  onRegionSelect,
  onRegionWish,
  onAttractionSelect,
  onMapViewChange,
  onExitToCountry,
  onExitToRegionList,
  onExitToContinent,
}: FlatAtlasMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const boundaryLayerRef = useRef<L.LayerGroup | null>(null)
  const fogLayerRef = useRef<L.LayerGroup | null>(null)
  const sectorOverlayLayerRef = useRef<L.LayerGroup | null>(null)
  const resourceLayerRef = useRef<L.LayerGroup | null>(null)
  const spotLayerRef = useRef<L.LayerGroup | null>(null)
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
  const onExitToCountryRef = useRef(onExitToCountry)
  const onExitToRegionListRef = useRef(onExitToRegionList)
  const onExitToContinentRef = useRef(onExitToContinent)
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
    imageryLayerRef.current = L.tileLayer("https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 18,
      attribution: "Imagery © Esri, Maxar, Earthstar Geographics",
    }).addTo(map)
    L.control.zoom({ position: "bottomleft" }).addTo(map)
    boundaryLayerRef.current = L.layerGroup().addTo(map)
    fogLayerRef.current = L.layerGroup().addTo(map)
    sectorOverlayLayerRef.current = L.layerGroup().addTo(map)
    resourceLayerRef.current = L.layerGroup().addTo(map)
    spotLayerRef.current = L.layerGroup().addTo(map)
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
      setCityDetailMode(zoom >= 9.2)
      // Bug 2 fix: skip state feedback during programmatic flyTo to prevent
      // zoom-reset feedback loop on mobile pinch-zoom
      if (!flyingRef.current) {
        const bounds = map.getBounds()
        onMapViewChangeRef.current({ zoom, bounds: { north: bounds.getNorth(), south: bounds.getSouth(), east: bounds.getEast(), west: bounds.getWest() } })
      }
      // Bug 1 part 2: when at region level and user zooms out below country
      // threshold, exit back to country level (restore sectors + region hotlist)
      if (currentLevel === "region" && zoom < 5.5 && !flyingRef.current) {
        onExitToCountryRef.current?.()
      }
      // Country -> continent: when at country level and user zooms out below
      // continent threshold, exit back to continent view
      if (currentLevel === "country" && zoom < 4.5 && !flyingRef.current) {
        onExitToContinentRef.current?.()
      }
      // Bug 3: when at region level with a selected attraction, zooming out
      // below the detail threshold clears the selection so the list returns
      // to the attraction explorer panel (not the detail view)
      if (currentLevel === "region" && zoom < 7.8 && !flyingRef.current) {
        onExitToRegionListRef.current?.()
      }
      computeScaleBar()
    }
    // Bug 2 fix: cancel any pending programmatic flyTo when user manually interacts
    const onUserZoomStart = () => {
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
    map.on("zoomend", syncMapView)
    map.on("moveend", syncMapView)
    const settleTimers = [80, 320, 720].map(delay => window.setTimeout(redraw, delay))
    redraw()
    return () => {
      resizeObserver.disconnect()
      window.removeEventListener("orientationchange", redraw)
      map.off("zoomstart", onUserZoomStart)
      map.off("touchstart", onUserTouch)
      map.off("zoomend", syncMapView)
      map.off("moveend", syncMapView)
      settleTimers.forEach(timer => window.clearTimeout(timer))
      map.remove()
      mapRef.current = null
      boundaryRendererRef.current = null
      fogRendererRef.current = null
      sectorOverlayRendererRef.current = null
      resourceRendererRef.current = null
      imageryLayerRef.current = null
      spotLayerRef.current = null
      fogLayerRef.current = null
      sectorOverlayLayerRef.current = null
    }
  }, [])

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
    const flightDuration = level === "continent" ? 1.75 : 1.45

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
      flightTimer = window.setTimeout(onMoveEnd, flightDuration * 1000 + 650)
    })

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
      tileTimer = window.setTimeout(onTilesReady, flightDuration * 1000 + 1100)
    })

    flyingRef.current = true
    userZoomedRef.current = false
    map.flyTo(target, zoom, { animate: true, duration: flightDuration, easeLinearity: 0.16 })
    // Clear flying flag when the flight completes
    flightComplete.then(() => { flyingRef.current = false })

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
      if (cancelled || requestId !== requestIdRef.current) return
      if (level === "continent") {
        L.geoJSON(data, {
          interactive: false,
          style: () => ({ renderer: boundaryRenderer, color: "#061718", weight: 3.1, opacity: 0.76, fill: false, lineCap: "round", lineJoin: "round" }),
        }).addTo(boundaries)
        L.geoJSON(data, {
          style: () => ({ renderer: boundaryRenderer, color: "#f7dfaa", weight: 1.15, opacity: 0.96, fillColor: "#173e3d", fillOpacity: 0.055, lineCap: "round", lineJoin: "round" }),
          onEachFeature: (feature, layer) => {
            layer.on({ click: () => onCountrySelectRef.current(countryFromFeature(feature)) })
            const picked = countryFromFeature(feature)
            layer.bindTooltip(picked.name, { className: "atlas-country-tooltip", sticky: true, direction: "top" })
          },
        }).addTo(boundaries)
      } else if (country) {
        const selected = data.features.filter((feature: GeoJSON.Feature) => feature.properties?.ADM0_A3 === country.code)
        L.geoJSON({ type: "FeatureCollection", features: selected } as GeoJSON.FeatureCollection, {
          interactive: false,
          style: () => ({ renderer: boundaryRenderer, color: "#07191a", weight: 4.1, opacity: 0.84, fill: false, lineCap: "round", lineJoin: "round" }),
        }).addTo(boundaries)
        L.geoJSON({ type: "FeatureCollection", features: selected } as GeoJSON.FeatureCollection, {
          style: () => ({ renderer: boundaryRenderer, color: "#ef8c66", weight: 1.75, opacity: 1, fill: false, lineCap: "round", lineJoin: "round" }),
        }).addTo(boundaries)
      }

      if (level !== "continent" && country && adminData) {
        // Boundary strokes first (same geometry the fog mask will copy)
        L.geoJSON(adminData, {
          interactive: false,
          style: () => ({ renderer: boundaryRenderer, color: "#061718", weight: 2.5, opacity: 0.68, fill: false, lineCap: "round", lineJoin: "round" }),
        }).addTo(boundaries)
        L.geoJSON(adminData, {
          style: () => ({ renderer: boundaryRenderer, color: "#fff1ca", weight: level === "region" ? 1.2 : 1, opacity: 0.93, fillColor: "#071f22", fillOpacity: 0.035, dashArray: level === "region" ? undefined : "5 3", lineCap: "round", lineJoin: "round" }),
          onEachFeature: (feature, layer) => {
            const name = feature.properties?.name_zh || feature.properties?.name || feature.properties?.name_en
            if (name) layer.bindTooltip(String(name), { className: "atlas-province-tooltip", sticky: true })
          },
        }).addTo(boundaries)

        // Bug 1 fix: at region level, skip the colorful tourism-sector overlay.
        // Instead, darken all regions except the active one so the user focuses
        // on the selected region. Colorful sectors only show at country level.
        const hasSectorMap = level === "country" && paintSectorOverlay(
          adminData.features as GeoJSON.Feature[],
          country.code,
          sectorOverlayLayer,
          sectorOverlayRenderer,
          { activeRegionId: region?.id },
        ) > 0

        if (level === "region" && region) {
          // Region-level focus mask: darken other countries (all continents) + same-country
          // provinces outside the active region so user focuses on one region.
          paintFocusMask(
            countriesData?.features as GeoJSON.Feature[] || [],
            adminData.features as GeoJSON.Feature[],
            country.code,
            region.id,
            fogLayer,
            fogRenderer,
          )
        } else {
          // Country-level: original fog of war for locked regions
          paintFogOfWar(adminData.features as GeoJSON.Feature[], regions, fogLayer, fogRenderer, {
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
              if (item.visited) onRegionSelectRef.current(item)
              else onRegionWishRef.current?.(item)
            }
            resourceMarker(item, region?.id === item.id, isWished, handlePin).addTo(resources)
          })
        }
      } else if (level === "country" && country && regions.length) {
        // No admin1 geometry: soft dark discs as fallback mask slices
        regions.filter(item => !item.visited).forEach(item => {
          L.circle(item.focus, {
            renderer: fogRenderer,
            radius: 150000,
            stroke: true,
            color: "#061014",
            weight: 8,
            fillColor: "#010507",
            fillOpacity: 0.62,
            opacity: 0.35,
            interactive: false,
            className: "atlas-fog-mask",
          }).addTo(fogLayer)
        })
        regions.forEach(item => {
          const isWished = wishedRegionKeysRef.current.includes(`${country.code}:${item.id}`)
          const handlePin = () => {
            if (item.visited) onRegionSelectRef.current(item)
            else onRegionWishRef.current?.(item)
          }
          resourceMarker(item, region?.id === item.id, isWished, handlePin).addTo(resources)
        })
      }
      setDetailReady(level === "continent" || Boolean(adminData))
    })

    Promise.all([flightComplete, terrainComplete, geometryComplete]).then(() => {
      if (cancelled || requestId !== requestIdRef.current) return
      map.invalidateSize({ animate: false, pan: false })
      map.fire("viewreset")
      requestAnimationFrame(() => {
        if (cancelled || requestId !== requestIdRef.current) return
        transitionPanes.forEach(pane => {
          pane.classList.remove("is-switching")
          pane.classList.add("is-ready")
        })
        revealTimer = window.setTimeout(() => setTravelling(false), 190)
      })
    }).catch(error => {
      if (cancelled || controller.signal.aborted) return
      console.warn(error)
      transitionPanes.forEach(pane => pane.classList.remove("is-switching"))
      setTravelling(false)
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
        if (item.visited) onRegionSelectRef.current(item)
        else onRegionWishRef.current?.(item)
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
    attractions.forEach(attraction => {
      const isSelected = attraction.id === selectedAttraction?.id
      const coordinate = `${attraction.lat_wgs84.toFixed(3)}° · ${attraction.lng_wgs84.toFixed(3)}°`
      const icon = ATTRACTION_ICONS[attraction.category_l1] || "✦"
      const html = isSelected
        ? `<div class="attraction-map-pin is-selected kind-${attraction.selection_kind}"><img src="${escapeHtml(attraction.image_url)}" alt=""/><div><span>📍</span><p><b>${escapeHtml(attraction.name)}</b><small>${coordinate} · ${KIND_LABELS[attraction.selection_kind]}</small></p></div></div>`
        : `<div class="attraction-map-pin kind-${attraction.selection_kind}"><span>${icon}</span><b>${escapeHtml(attraction.name)}</b><small>${KIND_LABELS[attraction.selection_kind]} · ${attraction.category_l2}</small></div>`
      const marker = L.marker([attraction.lat_wgs84, attraction.lng_wgs84], {
        pane: "atlas-attraction-pane",
        keyboard: true,
        title: `${attraction.name} · ${coordinate}`,
        icon: L.divIcon({ className: `atlas-div-icon ${isSelected ? "selected-attraction-icon" : ""}`, iconSize: isSelected ? [184, 132] : [112, 55], iconAnchor: isSelected ? [92, 128] : [16, 52], html }),
        zIndexOffset: isSelected ? 600 : 0,
      })
      marker.on("click", () => onAttractionSelectRef.current(attraction))
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
  }, [attractions, level, selectedAttraction?.id])

  useEffect(() => {
    const map = mapRef.current
    if (!map || level !== "region") return
    const previousId = previousSelectedAttractionRef.current
    if (selectedAttraction) {
      // Bug 2 fix: don't auto-fly if user is actively zooming/panning
      if (userZoomedRef.current) return
      flyingRef.current = true
      map.flyTo([selectedAttraction.lat_wgs84, selectedAttraction.lng_wgs84], 8.75, { animate: true, duration: 1.15, easeLinearity: 0.18 })
        .once("moveend", () => { flyingRef.current = false })
    } else if (previousId && region) {
      if (userZoomedRef.current) return
      flyingRef.current = true
      map.flyTo(region.focus, 7.4, { animate: true, duration: 1.05, easeLinearity: 0.2 })
        .once("moveend", () => { flyingRef.current = false })
    }
    previousSelectedAttractionRef.current = selectedAttraction?.id || null
  }, [level, region?.id, selectedAttraction?.id])

  return (
    <div className={`flat-atlas-map level-${level} ${travelling ? "is-flying" : ""} ${cityDetailMode ? "city-detail-mode" : ""}`}>
      <div ref={containerRef} className="leaflet-canvas" />
      <div className="map-unroll-curtain left" aria-hidden="true"/><div className="map-unroll-curtain right" aria-hidden="true"/>
      <div className="map-paper-edge left"/><div className="map-paper-edge right"/>
      <div className="map-scanline" />
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
      {selectedAttraction && <div className="city-focus-status"><span>📍 POSITION LOCKED</span><b>{selectedAttraction.name}</b><small>LAT {selectedAttraction.lat_wgs84.toFixed(4)}° · LNG {selectedAttraction.lng_wgs84.toFixed(4)}°</small></div>}
      {travelling && <div className="flat-map-flight"><i/><span>ATLAS SYNC</span><b>{region?.name || country?.name || continent}</b><small>同步新地形、卫星瓦片与边界…</small></div>}
    </div>
  )
}
