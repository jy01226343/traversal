const PI = Math.PI
const AXIS = 6378245.0
const ECCENTRICITY = 0.006693421622965943

function outsideChina(lat: number, lng: number) {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271
}

function transformLat(x: number, y: number) {
  let result = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x))
  result += (20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2 / 3
  result += (20 * Math.sin(y * PI) + 40 * Math.sin(y / 3 * PI)) * 2 / 3
  result += (160 * Math.sin(y / 12 * PI) + 320 * Math.sin(y * PI / 30)) * 2 / 3
  return result
}

function transformLng(x: number, y: number) {
  let result = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x))
  result += (20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2 / 3
  result += (20 * Math.sin(x * PI) + 40 * Math.sin(x / 3 * PI)) * 2 / 3
  result += (150 * Math.sin(x / 12 * PI) + 300 * Math.sin(x / 30 * PI)) * 2 / 3
  return result
}

export function wgs84ToGcj02(lat: number, lng: number): [number, number] {
  if (outsideChina(lat, lng)) return [lat, lng]
  let dLat = transformLat(lng - 105, lat - 35)
  let dLng = transformLng(lng - 105, lat - 35)
  const radLat = lat / 180 * PI
  let magic = Math.sin(radLat)
  magic = 1 - ECCENTRICITY * magic * magic
  const sqrtMagic = Math.sqrt(magic)
  dLat = dLat * 180 / ((AXIS * (1 - ECCENTRICITY)) / (magic * sqrtMagic) * PI)
  dLng = dLng * 180 / (AXIS / sqrtMagic * Math.cos(radLat) * PI)
  return [lat + dLat, lng + dLng]
}

export function gcj02ToWgs84(lat: number, lng: number): [number, number] {
  if (outsideChina(lat, lng)) return [lat, lng]
  const [gcjLat, gcjLng] = wgs84ToGcj02(lat, lng)
  return [lat * 2 - gcjLat, lng * 2 - gcjLng]
}

export function bd09ToWgs84(lat: number, lng: number): [number, number] {
  const x = lng - 0.0065
  const y = lat - 0.006
  const z = Math.sqrt(x * x + y * y) - 0.00002 * Math.sin(y * PI * 3000 / 180)
  const theta = Math.atan2(y, x) - 0.000003 * Math.cos(x * PI * 3000 / 180)
  const gcjLng = z * Math.cos(theta)
  const gcjLat = z * Math.sin(theta)
  return gcj02ToWgs84(gcjLat, gcjLng)
}
