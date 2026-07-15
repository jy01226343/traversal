import * as THREE from "three"
import type { ActiveWeatherCell, WeatherKind } from "@/data/climate"

export interface WeatherSystem {
  cell: ActiveWeatherCell
  root: THREE.Group
  object: THREE.Object3D
  positions: Float32Array
  velocities: Float32Array
  seeds: Float32Array
  linePositions: Float32Array | null
  fogMesh: THREE.Mesh | null
  heatMesh: THREE.Mesh | null
  flashLight: THREE.PointLight | null
  flashMesh: THREE.Mesh | null
  nextFlash: number
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

function orientOnSurface(object: THREE.Object3D, lat: number, lon: number, radius: number) {
  const anchor = latLonToVector(lat, lon, radius)
  const normal = anchor.clone().normalize()
  object.position.copy(anchor)
  object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal)
}

function initParticles(cell: ActiveWeatherCell) {
  const count = cell.count
  const positions = new Float32Array(count * 3)
  const velocities = new Float32Array(count * 3)
  const seeds = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2
    const r = Math.sqrt(Math.random()) * cell.radius
    positions[i * 3] = Math.cos(a) * r
    positions[i * 3 + 1] = Math.random() * cell.height
    positions[i * 3 + 2] = Math.sin(a) * r
    seeds[i] = Math.random() * Math.PI * 2
    const kind = cell.kind
    if (kind === "rain" || kind === "storm") {
      velocities[i * 3] = (Math.random() - 0.5) * 0.003
      velocities[i * 3 + 1] = -(0.024 + Math.random() * 0.04) * cell.intensity * (kind === "storm" ? 1.25 : 1)
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.003
    } else if (kind === "snow") {
      velocities[i * 3] = (Math.random() - 0.5) * 0.004
      velocities[i * 3 + 1] = -(0.003 + Math.random() * 0.006) * cell.intensity
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.004
    } else if (kind === "heat") {
      velocities[i * 3] = (Math.random() - 0.5) * 0.003
      velocities[i * 3 + 1] = (0.004 + Math.random() * 0.008) * cell.intensity
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.003
    } else {
      // fog drifts
      velocities[i * 3] = (Math.random() - 0.5) * 0.002
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.001
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.002
    }
  }
  return { positions, velocities, seeds }
}

function makeRainLines(cell: ActiveWeatherCell, positions: Float32Array, storm: boolean) {
  const count = cell.count
  const linePositions = new Float32Array(count * 6)
  const streak = (storm ? 0.028 : 0.018) + cell.intensity * 0.014
  for (let i = 0; i < count; i++) {
    const ix = i * 3
    const lx = i * 6
    linePositions[lx] = positions[ix]
    linePositions[lx + 1] = positions[ix + 1]
    linePositions[lx + 2] = positions[ix + 2]
    linePositions[lx + 3] = positions[ix]
    linePositions[lx + 4] = positions[ix + 1] - streak
    linePositions[lx + 5] = positions[ix + 2]
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute("position", new THREE.BufferAttribute(linePositions, 3))
  const material = new THREE.LineBasicMaterial({
    color: storm ? 0xb0c4ff : 0x9ecceb,
    transparent: true,
    opacity: storm ? 0.72 : 0.55 + cell.intensity * 0.2,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  return { lines: new THREE.LineSegments(geometry, material), linePositions, streak }
}

function makePoints(cell: ActiveWeatherCell, positions: Float32Array, color: number, size: number, opacity: number) {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3))
  const material = new THREE.PointsMaterial({
    color,
    size,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  })
  return new THREE.Points(geometry, material)
}

export function buildWeatherSystem(cell: ActiveWeatherCell, earthRadius: number): WeatherSystem {
  const root = new THREE.Group()
  const surface = earthRadius + 0.02
  const { positions, velocities, seeds } = initParticles(cell)
  let object: THREE.Object3D
  let linePositions: Float32Array | null = null
  let fogMesh: THREE.Mesh | null = null
  let heatMesh: THREE.Mesh | null = null
  let flashLight: THREE.PointLight | null = null
  let flashMesh: THREE.Mesh | null = null
  let streak = 0.02

  if (cell.kind === "rain" || cell.kind === "storm") {
    const built = makeRainLines(cell, positions, cell.kind === "storm")
    object = built.lines
    linePositions = built.linePositions
    streak = built.streak
    if (cell.kind === "storm") {
      flashLight = new THREE.PointLight(0xdde8ff, 0, earthRadius * 0.8, 2)
      flashLight.position.set(0, cell.height * 0.7, 0)
      root.add(flashLight)
      flashMesh = new THREE.Mesh(
        new THREE.SphereGeometry(cell.radius * 0.55, 16, 12),
        new THREE.MeshBasicMaterial({
          color: 0xe8f0ff,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      )
      flashMesh.position.set(0, cell.height * 0.55, 0)
      root.add(flashMesh)
    }
  } else if (cell.kind === "snow") {
    object = makePoints(cell, positions, 0xf4fbff, 0.012 + cell.intensity * 0.006, 0.88)
  } else if (cell.kind === "heat") {
    object = makePoints(cell, positions, 0xffb070, 0.016 + cell.intensity * 0.01, 0.55)
    heatMesh = new THREE.Mesh(
      new THREE.SphereGeometry(cell.radius * 1.1, 24, 16),
      new THREE.MeshBasicMaterial({
        color: 0xff7a3c,
        transparent: true,
        opacity: 0.12 + cell.intensity * 0.1,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    )
    heatMesh.scale.set(1, 0.45, 1)
    heatMesh.position.y = cell.height * 0.25
    root.add(heatMesh)
  } else {
    // fog
    object = makePoints(cell, positions, 0xd8e2e6, 0.04 + cell.intensity * 0.03, 0.22)
    fogMesh = new THREE.Mesh(
      new THREE.SphereGeometry(cell.radius * 1.15, 28, 18),
      new THREE.MeshBasicMaterial({
        color: 0xcfd8dc,
        transparent: true,
        opacity: 0.16 + cell.intensity * 0.14,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    )
    fogMesh.scale.set(1.1, 0.38, 1.1)
    fogMesh.position.y = cell.height * 0.15
    root.add(fogMesh)
  }

  object.frustumCulled = false
  root.add(object)
  orientOnSurface(root, cell.location[0], cell.location[1], surface)
  root.userData.streak = streak

  return {
    cell,
    root,
    object,
    positions,
    velocities,
    seeds,
    linePositions,
    fogMesh,
    heatMesh,
    flashLight,
    flashMesh,
    nextFlash: 1.5 + Math.random() * 3.5,
  }
}

export function updateWeatherSystem(system: WeatherSystem, delta: number, wind: number, time: number) {
  const { cell, positions, velocities, seeds, object, linePositions, fogMesh, heatMesh, flashLight, flashMesh } = system
  const count = cell.count
  const kind = cell.kind
  const streak = (system.root.userData.streak as number) || 0.02

  for (let i = 0; i < count; i++) {
    const ix = i * 3
    const drift = kind === "snow" || kind === "fog" ? 0.0009 : kind === "heat" ? 0.0005 : 0.00025
    positions[ix] += velocities[ix] * delta + Math.sin(seeds[i] + wind) * drift * delta
    positions[ix + 1] += velocities[ix + 1] * delta
    positions[ix + 2] += velocities[ix + 2] * delta + Math.cos(seeds[i] * 1.3 + wind * 0.7) * drift * 0.8 * delta

    let recycle = false
    if (kind === "heat") {
      recycle = positions[ix + 1] > cell.height || Math.hypot(positions[ix], positions[ix + 2]) > cell.radius * 1.15
    } else if (kind === "fog") {
      recycle = Math.hypot(positions[ix], positions[ix + 2]) > cell.radius * 1.2 || positions[ix + 1] < 0 || positions[ix + 1] > cell.height
    } else {
      recycle = positions[ix + 1] < 0 || Math.hypot(positions[ix], positions[ix + 2]) > cell.radius * 1.15
    }

    if (recycle) {
      const a = Math.random() * Math.PI * 2
      const r = Math.sqrt(Math.random()) * cell.radius
      positions[ix] = Math.cos(a) * r
      positions[ix + 1] = kind === "heat" ? Math.random() * cell.height * 0.25 : cell.height * (0.55 + Math.random() * 0.45)
      if (kind === "fog") positions[ix + 1] = Math.random() * cell.height * 0.6
      positions[ix + 2] = Math.sin(a) * r
    }

    if (linePositions) {
      const lx = i * 6
      linePositions[lx] = positions[ix]
      linePositions[lx + 1] = positions[ix + 1]
      linePositions[lx + 2] = positions[ix + 2]
      linePositions[lx + 3] = positions[ix]
      linePositions[lx + 4] = positions[ix + 1] - streak
      linePositions[lx + 5] = positions[ix + 2]
    }
  }

  const geo = (object as THREE.Points | THREE.LineSegments).geometry
  const attr = geo.getAttribute("position") as THREE.BufferAttribute
  attr.needsUpdate = true

  if (fogMesh) {
    const mat = fogMesh.material as THREE.MeshBasicMaterial
    mat.opacity = (0.14 + cell.intensity * 0.12) * (0.85 + Math.sin(time * 0.0012 + seeds[0]) * 0.15)
    fogMesh.rotation.y += 0.0008 * delta
  }

  if (heatMesh) {
    const mat = heatMesh.material as THREE.MeshBasicMaterial
    mat.opacity = (0.1 + cell.intensity * 0.1) * (0.8 + Math.sin(time * 0.002 + seeds[0]) * 0.2)
    heatMesh.scale.y = 0.4 + Math.sin(time * 0.0015) * 0.08
  }

  if (flashLight && flashMesh) {
    system.nextFlash -= delta * 0.016
    const mat = flashMesh.material as THREE.MeshBasicMaterial
    if (system.nextFlash <= 0) {
      flashLight.intensity = 2.8 + Math.random() * 3.5
      mat.opacity = 0.55 + Math.random() * 0.35
      system.nextFlash = 1.2 + Math.random() * 4.5
    } else {
      flashLight.intensity *= 0.82
      mat.opacity *= 0.78
    }
  }
}

export function disposeWeatherSystem(system: WeatherSystem) {
  system.root.traverse(obj => {
    const mesh = obj as THREE.Mesh
    if (mesh.geometry) mesh.geometry.dispose()
    if (mesh.material) {
      const mat = mesh.material
      if (Array.isArray(mat)) mat.forEach(m => m.dispose())
      else (mat as THREE.Material).dispose()
    }
  })
}

export function kindIcon(kind: WeatherKind) {
  if (kind === "storm") return "⚡"
  if (kind === "snow") return "❄"
  if (kind === "fog") return "☁"
  if (kind === "heat") return "☀"
  return "☂"
}
