#!/usr/bin/env python3
"""Generates the PWA icons (PNG, pure stdlib) into ../icons next to this script."""
import os
import struct
import zlib

TOP = (158, 44, 36)
BOTTOM = (226, 110, 40)
CARD = (255, 250, 240)
LINE = (146, 74, 60)
ACCENT = (178, 58, 46)


def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def in_rounded_rect(x, y, x0, y0, x1, y1, r):
    if x < x0 or x > x1 or y < y0 or y > y1:
        return False
    cx = min(max(x, x0 + r), x1 - r)
    cy = min(max(y, y0 + r), y1 - r)
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r


def render(size, pad_ratio):
    s = size * 2
    pad = int(s * pad_ratio)
    x0, y0 = pad, pad
    x1, y1 = s - pad, s - pad
    r = int(s * 0.09)
    lw = int(s * 0.30)
    lh = max(2, int(s * 0.045))
    gap = int(s * 0.075)
    first_y = int(s * 0.52)
    lines_y = [first_y, first_y + gap, first_y + 2 * gap]
    lx0 = int(s * 0.30)
    card_h = y1 - y0
    buf = bytearray(s * s * 4)
    for y in range(s):
        t = y / s
        base = lerp(TOP, BOTTOM, t)
        dy = (y / s - 0.12) ** 2
        for x in range(s):
            dx = (x / s - 0.72) ** 2
            g = max(0.0, 1.0 - (dx + dy) * 2.2)
            c = tuple(min(255, int(base[i] + 42 * g)) for i in range(3))
            if in_rounded_rect(x, y, x0, y0, x1, y1, r):
                c = CARD
                if y < y0 + card_h * 0.45:
                    f = 1.0 - (y - y0) / (card_h * 0.45)
                    c = tuple(min(255, int(c[i] + 12 * f)) for i in range(3))
                for ly in lines_y:
                    w = int(lw * 0.62) if ly == lines_y[0] else lw
                    if in_rounded_rect(x, y, lx0, ly, lx0 + w, ly + lh, lh // 2):
                        c = ACCENT if ly == lines_y[0] else LINE
            i = (y * s + x) * 4
            buf[i] = c[0]
            buf[i + 1] = c[1]
            buf[i + 2] = c[2]
            buf[i + 3] = 255
    out = bytearray(size * size * 4)
    for y in range(size):
        for x in range(size):
            for ch in range(4):
                total = 0
                for dy in range(2):
                    for dx in range(2):
                        total += buf[((2 * y + dy) * s + (2 * x + dx)) * 4 + ch]
                out[(y * size + x) * 4 + ch] = total // 4
    return bytes(out)


def chunk(tag, data):
    return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)


def write_png(path, size, rgba):
    raw = b''.join(b'\x00' + rgba[y * size * 4:(y + 1) * size * 4] for y in range(size))
    ihdr = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)
    with open(path, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))


def main():
    out = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', 'icons'))
    os.makedirs(out, exist_ok=True)
    write_png(os.path.join(out, 'icon-192.png'), 192, render(192, 0.10))
    write_png(os.path.join(out, 'icon-512.png'), 512, render(512, 0.10))
    write_png(os.path.join(out, 'icon-maskable-512.png'), 512, render(512, 0.22))
    write_png(os.path.join(out, 'apple-touch-icon.png'), 180, render(180, 0.0))
    print('icons written to', out)


if __name__ == '__main__':
    main()
