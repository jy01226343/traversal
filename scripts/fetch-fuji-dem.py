#!/usr/bin/env python
"""下载富士山/河口湖区域真实 DEM（Mapzen Terrarium, AWS 公开桶），
拼接裁剪为 16-bit 高度图 + 元数据，供前端 Three.js 地形位移使用。

Terrarium 解码: height = R*256 + G + B/256 - 32768 (米)
"""
import io, json, math, os, urllib.request

WEST, EAST = 138.55, 139.05
SOUTH, NORTH = 35.25, 35.62
ZOOM = 12
OUT_DIR = "public/terrain/fuji"

def lon2x(lon, z): return int((lon + 180.0) / 360.0 * (2 ** z))
def lat2y(lat, z):
    r = math.radians(lat)
    return int((1.0 - math.log(math.tan(r) + 1.0 / math.cos(r)) / math.pi) / 2.0 * (2 ** z))
def x2lon(x, z): return x / (2 ** z) * 360.0 - 180.0
def y2lat(y, z):
    n = math.pi - 2.0 * math.pi * y / (2 ** z)
    return math.degrees(math.atan(math.sinh(n)))

x0, x1 = lon2x(WEST, ZOOM), lon2x(EAST, ZOOM)
y0, y1 = lat2y(NORTH, ZOOM), lat2y(SOUTH, ZOOM)  # y 向下
print(f"tiles x {x0}..{x1} y {y0}..{y1}")

from PIL import Image
W = (x1 - x0 + 1) * 256
H = (y1 - y0 + 1) * 256
canvas = Image.new("RGB", (W, H))
for tx in range(x0, x1 + 1):
    for ty in range(y0, y1 + 1):
        url = f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{ZOOM}/{tx}/{ty}.png"
        with urllib.request.urlopen(url, timeout=30) as r:
            tile = Image.open(io.BytesIO(r.read())).convert("RGB")
        canvas.paste(tile, ((tx - x0) * 256, (ty - y0) * 256))
        print("ok", tx, ty)

# 裁剪到精确边界
tile_west, tile_north = x2lon(x0, ZOOM), y2lat(y0, ZOOM)
tile_east, tile_south = x2lon(x1 + 1, ZOOM), y2lat(y1 + 1, ZOOM)
def px(lon): return int((lon - tile_west) / (tile_east - tile_west) * W)
def py(lat): return int((tile_north - lat) / (tile_north - tile_south) * H)
crop = canvas.crop((px(WEST), py(NORTH), px(EAST), py(SOUTH)))
print("cropped size:", crop.size)

# Terrarium 解码 -> 16-bit PNG（存储 height + 1000，0.01m 精度用 float→65535 映射更简单：
# 采用线性映射 h = vmin + v/65535*(vmax-vmin)）
import numpy as np
arr = np.asarray(crop).astype(np.float32)
h = arr[..., 0] * 256.0 + arr[..., 1] + arr[..., 2] / 256.0 - 32768.0
vmin, vmax = float(h.min()), float(h.max())
print(f"height range: {vmin:.1f} .. {vmax:.1f} m")
q = np.round((h - vmin) / (vmax - vmin) * 65535.0).astype(np.uint16)
os.makedirs(OUT_DIR, exist_ok=True)
Image.fromarray(q, mode="I;16").save(os.path.join(OUT_DIR, "fuji-dem.png"))
meta = {
    "west": WEST, "east": EAST, "south": SOUTH, "north": NORTH,
    "width": int(q.shape[1]), "height": int(q.shape[0]),
    "minElevation": vmin, "maxElevation": vmax,
    "source": "Mapzen Terrarium terrain tiles (AWS elevation-tiles-prod), zoom 12",
    "note": "PNG 16-bit gray; elevation = minElevation + v/65535*(maxElevation-minElevation)",
}
with open(os.path.join(OUT_DIR, "fuji-dem.json"), "w", encoding="utf-8") as f:
    json.dump(meta, f, ensure_ascii=False, indent=2)

# 快速校验：富士山顶（35.3606, 138.7274）应接近 3776m
def sample(lon, lat):
    ix = int((lon - WEST) / (EAST - WEST) * q.shape[1])
    iy = int((NORTH - lat) / (NORTH - SOUTH) * q.shape[0])
    return vmin + q[iy, ix] / 65535.0 * (vmax - vmin)
print("summit sample:", round(sample(138.7274, 35.3606), 1), "m (expect ~3700)")
print("kawaguchiko sample:", round(sample(138.755, 35.517), 1), "m (expect ~830)")
