import { describe, it, expect } from "vitest"
import { wgs84ToGcj02, gcj02ToWgs84, bd09ToWgs84 } from "./coordinates"

describe("wgs84ToGcj02 / gcj02ToWgs84", () => {
  it("中国境外点原样返回（outsideChina 守卫）", () => {
    // 纽约 40.7128, -74.0060 在中国境外
    const [lat, lng] = wgs84ToGcj02(40.7128, -74.006)
    expect(lat).toBeCloseTo(40.7128, 6)
    expect(lng).toBeCloseTo(-74.006, 6)
  })

  it("中国境内点会被偏移（非原值）", () => {
    // 北京天安门 39.9087, 116.3975 在中国境内
    const [lat, lng] = wgs84ToGcj02(39.9087, 116.3975)
    expect(Math.abs(lat - 39.9087)).toBeGreaterThan(0.001)
    expect(Math.abs(lng - 116.3975)).toBeGreaterThan(0.001)
  })

  it("wgs84 -> gcj02 -> wgs84 往返近似还原（境内点）", () => {
    const wgsLat = 39.9087
    const wgsLng = 116.3975
    const [gcjLat, gcjLng] = wgs84ToGcj02(wgsLat, wgsLng)
    const [backLat, backLng] = gcj02ToWgs84(gcjLat, gcjLng)
    // 逆向变换近似还原（误差 < 0.01°，因算法是近似反推）
    expect(Math.abs(backLat - wgsLat)).toBeLessThan(0.01)
    expect(Math.abs(backLng - wgsLng)).toBeLessThan(0.01)
  })

  it("gcj02ToWgs84 境外点原样返回", () => {
    const [lat, lng] = gcj02ToWgs84(48.8566, 2.3522) // 巴黎
    expect(lat).toBeCloseTo(48.8566, 6)
    expect(lng).toBeCloseTo(2.3522, 6)
  })
})

describe("bd09ToWgs84", () => {
  it("北京 BD09 坐标转 WGS84 后接近真实经纬度", () => {
    // 百度地图北京天安门 BD09 约 39.915, 116.404
    // 转 WGS84 应接近真实 39.9087, 116.3975（允许 0.01° 误差）
    const [lat, lng] = bd09ToWgs84(39.915, 116.404)
    expect(Math.abs(lat - 39.9087)).toBeLessThan(0.02)
    expect(Math.abs(lng - 116.3975)).toBeLessThan(0.02)
  })
})
