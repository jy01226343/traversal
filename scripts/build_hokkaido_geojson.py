# -*- coding: utf-8 -*-
"""将 niiyz/JapanCityGeoJson 的北海道逐市 topojson 解码合并为单个
hokkaido-municipalities.geojson（坐标降采样到 3 位小数，约 111m 精度）。

数据源：https://github.com/niiyz/JapanCityGeoJson （国土交通省 国土数值信息
N03 行政区划数据），仅取北海道（bbox 139.3–146.1E, 41.3–45.6N）。
"""
import json
import math
import sys
from pathlib import Path

SRC = Path(__file__).parent / "tmp" / "jcg" / "topojson" / "01"
DST = Path(__file__).parent.parent / "public" / "geojson" / "hokkaido-municipalities.geojson"

# 北海道本岛及周边离岛 bbox（排除北方四岛远端，控制体积）
BBOX = (139.3, 41.3, 146.1, 45.7)  # min_lng, min_lat, max_lng, max_lat


def decode_arcs(topo):
    scale = topo["transform"]["scale"]
    translate = topo["transform"]["translate"]
    arcs = []
    for arc in topo["arcs"]:
        x = y = 0
        pts = []
        for dx, dy in arc:
            x += dx
            y += dy
            pts.append((x * scale[0] + translate[0], y * scale[1] + translate[1]))
        arcs.append(pts)
    return arcs


def stitch(arc_indexes, arcs):
    pts = []
    for idx in arc_indexes:
        arc = arcs[idx] if idx >= 0 else list(reversed(arcs[~idx]))
        pts.extend(arc[1:] if pts else arc)
    return pts


def geometry_coords(geom, arcs):
    gtype = geom["type"]
    if gtype == "Polygon":
        return [stitch(ring, arcs) for ring in geom["arcs"]]
    if gtype == "MultiPolygon":
        return [[stitch(ring, arcs) for ring in poly] for poly in geom["arcs"]]
    return None


def round_ring(ring, ndigits=3):
    return [[round(p[0], ndigits), round(p[1], ndigits)] for p in ring]


def _perp_dist(p, a, b):
    """点 p 到线段 ab 的距离（经纬度近似平面，足够小尺度使用）。"""
    ax, ay = a
    bx, by = b
    px, py = p
    dx, dy = bx - ax, by - ay
    if dx == 0 and dy == 0:
        return math.hypot(px - ax, py - ay)
    t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)
    t = max(0.0, min(1.0, t))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def simplify_ring(ring, tolerance):
    """Douglas-Peucker 简化；闭合环保持首尾一致。"""
    if len(ring) <= 4:
        return ring
    keep = [False] * len(ring)
    keep[0] = keep[-1] = True

    def dp(lo, hi):
        if hi <= lo + 1:
            return
        a, b = ring[lo], ring[hi]
        worst, worst_i = -1.0, -1
        for i in range(lo + 1, hi):
            d = _perp_dist(ring[i], a, b)
            if d > worst:
                worst, worst_i = d, i
        if worst > tolerance:
            keep[worst_i] = True
            dp(lo, worst_i)
            dp(worst_i, hi)

    dp(0, len(ring) - 1)
    out = [p for p, k in zip(ring, keep) if k]
    if len(out) < 4:  # 退化的环丢弃由上层处理；保底保留三角形
        return ring[:1] + ring[1:-1][:2] + ring[-1:]
    return out


# 简化容差（度）：0.0012° ≈ 120m，配合 3 位小数取整，视觉描边足够
SIMPLIFY_TOLERANCE = 0.0012


def ring_bbox_ok(ring):
    for lng, lat in ring:
        if BBOX[0] <= lng <= BBOX[2] and BBOX[1] <= lat <= BBOX[3]:
            return True
    return False


def main():
    features = []
    files = sorted(SRC.glob("*.topojson"))
    print(f"source files: {len(files)}")
    for path in files:
        topo = json.loads(path.read_text(encoding="utf-8"))
        arcs = decode_arcs(topo)
        for obj in topo["objects"].values():
            for geom in obj.get("geometries", []):
                coords = geometry_coords(geom, arcs)
                if not coords:
                    continue
                props = geom.get("properties", {})
                city = props.get("N03_003") or ""
                ward = props.get("N03_004") or ""
                name = ward or city
                if not name:
                    continue
                if geom["type"] == "Polygon":
                    rings = [round_ring(simplify_ring(r, SIMPLIFY_TOLERANCE)) for r in coords]
                    rings = [r for r in rings if len(r) >= 4]
                    if not rings or not any(ring_bbox_ok(r) for r in rings):
                        continue
                    geometry = {"type": "Polygon", "coordinates": rings}
                else:
                    polys = []
                    for poly in coords:
                        pr = [round_ring(simplify_ring(r, SIMPLIFY_TOLERANCE)) for r in poly]
                        pr = [r for r in pr if len(r) >= 4]
                        if pr:
                            polys.append(pr)
                    if not polys or not any(ring_bbox_ok(r) for poly in polys for r in poly):
                        continue
                    geometry = {"type": "MultiPolygon", "coordinates": polys}
                features.append({
                    "type": "Feature",
                    "properties": {
                        "name": name,
                        "city": city,
                        "code": props.get("N03_007") or path.stem,
                        "subprefecture": props.get("N03_002") or "",
                    },
                    "geometry": geometry,
                })
    fc = {"type": "FeatureCollection", "features": features}
    DST.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(fc, ensure_ascii=False, separators=(",", ":"))
    DST.write_text(text, encoding="utf-8")
    size = DST.stat().st_size
    points = 0
    for f in features:
        g = f["geometry"]
        rings = g["coordinates"] if g["type"] == "Polygon" else [r for p in g["coordinates"] for r in p]
        points += sum(len(r) for r in rings)
    print(f"features: {len(features)}, points: {points}, size: {size/1024/1024:.2f} MB -> {DST}")


if __name__ == "__main__":
    sys.exit(main())
