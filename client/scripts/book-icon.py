"""Generate launcher PNGs from the same simple open-book geometry as the vector."""
from pathlib import Path
import struct
import zlib

root = Path(__file__).resolve().parents[1] / 'android/app/src/main/res'
left = [(31, 36), (41, 34), (53, 39), (53, 72), (41, 67), (31, 69)]
right = [(55, 39), (67, 34), (77, 36), (77, 69), (67, 67), (55, 72)]

def inside(x, y, polygon):
    result = False
    for a, b in zip(polygon, polygon[1:] + polygon[:1]):
        if (a[1] > y) != (b[1] > y) and x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]:
            result = not result
    return result

def png(path, size, foreground=False, rounded=False):
    rows = bytearray()
    for y in range(size):
        rows.append(0)
        for x in range(size):
            samples = []
            for dy in (0.25, 0.75):
                for dx in (0.25, 0.75):
                    px, py = (x + dx) * 108 / size, (y + dy) * 108 / size
                    color = (15, 76, 81, 255)
                    if foreground or (rounded and (px - 54) ** 2 + (py - 54) ** 2 > 54 ** 2):
                        color = (0, 0, 0, 0)
                    if inside(px, py, left) or inside(px, py, right):
                        color = (255, 255, 255, 255)
                    samples.append(color)
            rows.extend(round(sum(c[i] for c in samples) / 4) for i in range(4))
    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data))
    path.write_bytes(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(rows)) + chunk(b'IEND', b''))

for density, size in [('mdpi', 48), ('hdpi', 72), ('xhdpi', 96), ('xxhdpi', 144), ('xxxhdpi', 192)]:
    folder = root / ('mipmap-' + density)
    png(folder / 'ic_launcher.png', size)
    png(folder / 'ic_launcher_round.png', size, rounded=True)
    png(folder / 'ic_launcher_foreground.png', round(size * 108 / 48), foreground=True)
