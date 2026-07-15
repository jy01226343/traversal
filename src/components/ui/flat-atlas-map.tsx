import { useEffect, useRef, useState } from "react"
import L from "leaflet"
import { RESOURCE_ICONS, getRegionResourceSpots, type DestinationCountry, type DestinationRegion, type DestinationSpot } from "@/data/destinations"

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
  onCountrySelect: (country: PickedCountry) => void
  onRegionSelect: (region: DestinationRegion) => void
}

const continentConfig: Record<string, { file: string; focus: [number, number]; zoom: number }> = {
  亚洲: { file: "asia", focus: [34, 105], zoom: 3.25 },
  欧洲: { file: "europe", focus: [50, 14], zoom: 4 },
  大洋洲: { file: "oceania", focus: [-24, 135], zoom: 3.5 },
  北美: { file: "north-america", focus: [43, -105], zoom: 3.5 },
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

function resourceMarker(region: DestinationRegion, selected: boolean, onSelect: () => void) {
  const primary = region.resources[0]
  const icon = RESOURCE_ICONS[primary?.type] || "✦"
  const html = `<div class="map-resource-pin ${region.visited ? "is-visited" : "is-unvisited"} ${selected ? "is-selected" : ""}"><span>${icon}</span><b>${region.name}</b><small>${primary?.type || "旅行"} ${primary?.score || region.heat}</small></div>`
  const marker = L.marker(region.focus, {
    icon: L.divIcon({ html, className: "atlas-div-icon", iconSize: [118, 56], iconAnchor: [59, 50] }),
    pane: "atlas-resource-pane",
    keyboard: true,
    title: `${region.name} · ${primary?.type || "旅行"}`,
  })
  marker.on("click", onSelect)
  return marker
}

export function FlatAtlasMap({
  continent,
  level,
  country,
  region,
  regions,
  onCountrySelect,
  onRegionSelect,
}: FlatAtlasMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const boundaryLayerRef = useRef<L.LayerGroup | null>(null)
  const resourceLayerRef = useRef<L.LayerGroup | null>(null)
  const spotLayerRef = useRef<L.LayerGroup | null>(null)
  const boundaryRendererRef = useRef<L.Canvas | null>(null)
  const resourceRendererRef = useRef<L.Canvas | null>(null)
  const imageryLayerRef = useRef<L.TileLayer | null>(null)
  const requestIdRef = useRef(0)
  const onCountrySelectRef = useRef(onCountrySelect)
  const onRegionSelectRef = useRef(onRegionSelect)
  const [travelling, setTravelling] = useState(true)
  const [detailReady, setDetailReady] = useState(false)
  const [selectedSpot, setSelectedSpot] = useState<DestinationSpot | null>(null)
  const [cityDetailMode, setCityDetailMode] = useState(false)
  onCountrySelectRef.current = onCountrySelect
  onRegionSelectRef.current = onRegionSelect

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
    const resourcePane = map.createPane("atlas-resource-pane")
    boundaryPane.style.zIndex = "430"
    resourcePane.style.zIndex = "440"
    boundaryRendererRef.current = L.canvas({ pane: "atlas-boundary-pane", padding: 0.8, tolerance: 8 })
    resourceRendererRef.current = L.canvas({ pane: "atlas-resource-pane", padding: 0.8, tolerance: 8 })
    imageryLayerRef.current = L.tileLayer("https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 18,
      attribution: "Imagery © Esri, Maxar, Earthstar Geographics",
    }).addTo(map)
    L.control.zoom({ position: "bottomleft" }).addTo(map)
    boundaryLayerRef.current = L.layerGroup().addTo(map)
    resourceLayerRef.current = L.layerGroup().addTo(map)
    spotLayerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    const redraw = () => requestAnimationFrame(() => map.invalidateSize({ animate: false, pan: false }))
    const syncDetailMode = () => setCityDetailMode(map.getZoom() >= 9.2)
    const resizeObserver = new ResizeObserver(redraw)
    resizeObserver.observe(containerRef.current)
    window.addEventListener("orientationchange", redraw)
    map.on("zoomend", syncDetailMode)
    const settleTimers = [80, 320, 720].map(delay => window.setTimeout(redraw, delay))
    redraw()
    return () => {
      resizeObserver.disconnect()
      window.removeEventListener("orientationchange", redraw)
      map.off("zoomend", syncDetailMode)
      settleTimers.forEach(timer => window.clearTimeout(timer))
      map.remove()
      mapRef.current = null
      boundaryRendererRef.current = null
      resourceRendererRef.current = null
      imageryLayerRef.current = null
      spotLayerRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const boundaries = boundaryLayerRef.current
    const resources = resourceLayerRef.current
    const spots = spotLayerRef.current
    const boundaryRenderer = boundaryRendererRef.current
    const resourceRenderer = resourceRendererRef.current
    const imagery = imageryLayerRef.current
    if (!map || !boundaries || !resources || !spots || !boundaryRenderer || !resourceRenderer || !imagery) return
    const requestId = ++requestIdRef.current
    const controller = new AbortController()
    let cancelled = false
    let flightTimer = 0
    let tileTimer = 0
    let revealTimer = 0
    let onMoveEnd = () => {}
    let onTilesReady = () => {}
    const boundaryPane = map.getPane("atlas-boundary-pane")
    const resourcePane = map.getPane("atlas-resource-pane")
    const transitionPanes = [boundaryPane, resourcePane].filter(Boolean) as HTMLElement[]

    setTravelling(true)
    setDetailReady(false)
    transitionPanes.forEach(pane => {
      pane.classList.add("is-switching")
      pane.classList.remove("is-ready")
    })
    boundaries.clearLayers()
    resources.clearLayers()
    spots.clearLayers()
    setSelectedSpot(null)
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

    map.flyTo(target, zoom, { animate: true, duration: flightDuration, easeLinearity: 0.16 })

    const continentUrl = `/geo/continents/${config.file}.geojson`
    const loadGeoJson = async (url: string) => {
      const response = await fetch(url, { signal: controller.signal })
      if (!response.ok) throw new Error(`Unable to load map geometry: ${url}`)
      return response.json() as Promise<GeoJSON.FeatureCollection>
    }
    const adminPromise = level !== "continent" && country
      ? loadGeoJson(`/geo/admin1/${country.code.toLowerCase()}.geojson`)
      : Promise.resolve<GeoJSON.FeatureCollection | null>(null)

    const geometryComplete = Promise.all([loadGeoJson(continentUrl), adminPromise]).then(([data, adminData]) => {
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

        regions.filter(item => !item.visited).forEach(item => {
          L.circle(item.focus, {
            renderer: resourceRenderer,
            radius: level === "region" ? 65000 : 115000,
            stroke: true,
            color: "#081315",
            weight: 2,
            fillColor: "#010708",
            fillOpacity: 0.62,
            opacity: 0.7,
            interactive: false,
          }).addTo(resources)
        })
        regions.forEach(item => resourceMarker(item, region?.id === item.id, () => onRegionSelectRef.current(item)).addTo(resources))
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

  const focusSpot = (spot: DestinationSpot) => {
    const map = mapRef.current
    const spotLayer = spotLayerRef.current
    if (!map || !spotLayer) return
    setSelectedSpot(spot)
    setCityDetailMode(true)
    spotLayer.clearLayers()
    const coordinate = `${spot.focus[0].toFixed(3)}° · ${spot.focus[1].toFixed(3)}°`
    L.marker(spot.focus, {
      pane: "atlas-resource-pane",
      keyboard: true,
      title: `${spot.name} · ${coordinate}`,
      icon: L.divIcon({
        className: "atlas-city-icon",
        iconSize: [226, 164],
        iconAnchor: [113, 154],
        html: `<div class="city-location-pin"><img src="${spot.image}" alt="${spot.name}实景"/><div><span>📍</span><p><b>${spot.name}</b><small>${coordinate}</small></p></div><a href="${spot.sourceUrl}" target="_blank" rel="noreferrer">${spot.imageSource} ↗</a></div>`,
      }),
    }).addTo(spotLayer)
    map.flyTo(spot.focus, 11.35, { animate: true, duration: 1.35, easeLinearity: 0.18 })
  }

  const returnToRegion = () => {
    const map = mapRef.current
    const spotLayer = spotLayerRef.current
    if (!map || !spotLayer || !region) return
    spotLayer.clearLayers()
    setSelectedSpot(null)
    setCityDetailMode(false)
    map.flyTo(region.focus, 7.4, { animate: true, duration: 1.05, easeLinearity: 0.2 })
  }

  return (
    <>
      <div className={`flat-atlas-map level-${level} ${travelling ? "is-flying" : ""} ${cityDetailMode ? "city-detail-mode" : ""}`}>
        <div ref={containerRef} className="leaflet-canvas" />
        <div className="map-unroll-curtain left" aria-hidden="true"/><div className="map-unroll-curtain right" aria-hidden="true"/>
        <div className="map-paper-edge left"/><div className="map-paper-edge right"/>
        <div className="map-scanline" />
        <div className="flat-map-hud"><span><i className={detailReady || level === "continent" ? "ready" : ""}/>{level === "continent" ? "10M COUNTRY BORDERS" : "10M PROVINCE BORDERS"}</span><b>SATELLITE DETAIL · Z{level === "region" ? "7.4" : level === "country" ? "5.4" : continentConfig[continent].zoom}</b></div>
        {selectedSpot && <div className="city-focus-status"><span>📍 POSITION LOCKED</span><b>{selectedSpot.name}</b><small>LAT {selectedSpot.focus[0].toFixed(4)}° · LNG {selectedSpot.focus[1].toFixed(4)}°</small></div>}
        {travelling && <div className="flat-map-flight"><i/><span>ATLAS SYNC</span><b>{region?.name || country?.name || continent}</b><small>同步新地形、卫星瓦片与边界…</small></div>}
      </div>
      {level === "region" && region && <aside className={`map-local-playbook ${selectedSpot ? "is-city-focused" : ""}`} aria-label={`${region.name}活动特色`}>
        <header><span>LOCAL PLAYBOOK</span><b>{selectedSpot ? selectedSpot.name : `${region.name} · 活动特色`}</b>{selectedSpot && <button type="button" onClick={returnToRegion}>← 返回地区</button>}</header>
        {!selectedSpot && <div>{region.resources.map(resource => <article key={resource.type}>
          <span className="playbook-icon">{RESOURCE_ICONS[resource.type] || "✦"}</span>
          <section><b>{resource.type}<em>{resource.score}</em></b><p>{getRegionResourceSpots(region, resource.type).slice(0, 2).map(spot => <button type="button" onClick={() => focusSpot(spot)} key={spot.name}><span>{spot.name}</span><i>聚焦城市 →</i></button>)}</p></section>
        </article>)}</div>}
      </aside>}
    </>
  )
}
