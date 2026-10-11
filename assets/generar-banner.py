"""Genera assets/aura-finanzas-banner.svg: título en bloques 3D al estilo de Notas Aura."""
from pathlib import Path


W, H = 88, 128
DEPTH_X, DEPTH_Y = 20, -20
GLYPHS = {
    "N": [[(0, 128), (0, 0), (26, 0), (62, 66), (62, 0), (88, 0), (88, 128), (62, 128), (26, 62), (26, 128)]],
    "O": [[(0, 0), (88, 0), (88, 128), (0, 128)], [(26, 32), (26, 96), (62, 96), (62, 32)]],
    "T": [[(0, 0), (88, 0), (88, 28), (58, 28), (58, 128), (30, 128), (30, 28), (0, 28)]],
    "A": [[(0, 128), (0, 28), (26, 0), (62, 0), (88, 28), (88, 128), (62, 128), (62, 91), (26, 91), (26, 128)], [(26, 31), (26, 65), (62, 65), (62, 31)]],
    "S": [[(88, 0), (88, 28), (26, 28), (26, 49), (62, 49), (88, 74), (88, 103), (62, 128), (0, 128), (0, 100), (62, 100), (62, 79), (26, 79), (0, 54), (0, 25), (26, 0)]],
    "U": [[(0, 0), (26, 0), (26, 96), (62, 96), (62, 0), (88, 0), (88, 100), (62, 128), (26, 128), (0, 100)]],
    "R": [[(0, 0), (62, 0), (88, 26), (88, 66), (67, 84), (88, 128), (58, 128), (39, 90), (26, 90), (26, 128), (0, 128)], [(26, 28), (26, 62), (62, 62), (62, 28)]],
    "F": [[(0, 0), (88, 0), (88, 28), (26, 28), (26, 50), (72, 50), (72, 78), (26, 78), (26, 128), (0, 128)]],
    "I": [[(10, 0), (78, 0), (78, 28), (58, 28), (58, 100), (78, 100), (78, 128), (10, 128), (10, 100), (30, 100), (30, 28), (10, 28)]],
    "Z": [[(0, 0), (88, 0), (88, 28), (38, 100), (88, 100), (88, 128), (0, 128), (0, 100), (50, 28), (0, 28)]],
}


def path(contours):
    return " ".join("M" + " L".join(f"{x},{y}" for x, y in contour) + " Z" for contour in contours)


def side_faces(contours, accent):
    result = []
    for contour in contours:
        for p, q in zip(contour, contour[1:] + contour[:1]):
            dx, dy = q[0] - p[0], q[1] - p[1]
            if dy * DEPTH_X - dx * DEPTH_Y <= 0:
                continue
            points = [p, q, (q[0] + DEPTH_X, q[1] + DEPTH_Y), (p[0] + DEPTH_X, p[1] + DEPTH_Y)]
            color = ("#b9e8f8" if accent else "#8bd4f2") if dy <= 0 else ("#397d9d" if accent else "#176b98")
            result.append(f'<polygon points="{" ".join(f"{x},{y}" for x, y in points)}" fill="{color}" stroke="#10415e" stroke-width="1.4" stroke-linejoin="round"/>')
    return "".join(result)


parts = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="320" viewBox="0 0 1200 320" role="img" aria-labelledby="title desc">',
    '<title id="title">AURA FINANZAS</title>',
    '<desc id="desc">Letras azules de bloque con caras superiores claras y laterales oscuros sobre fondo oscuro. Tus finanzas en local: EUR y GBP, céntimo a céntimo.</desc>',
    '<defs><linearGradient id="blue" x2="0" y2="1"><stop stop-color="#35aae0"/><stop offset="1" stop-color="#1686c2"/></linearGradient><linearGradient id="ice" x2="0" y2="1"><stop stop-color="#9bdaf2"/><stop offset="1" stop-color="#65bae0"/></linearGradient></defs>',
    '<rect width="1200" height="320" fill="#0d1117"/>',
]

cursor = 0
letters = [(ch, i) for i, ch in enumerate("AURA FINANZAS") if ch != " "]
for ch, index in letters:
    contours = GLYPHS[ch]
    accent = index >= 5
    fill = "url(#ice)" if accent else "url(#blue)"
    d = path(contours)
    parts.append(f'<g transform="translate({cursor} 0)">')
    parts.append(f'<path d="{d}" transform="translate({DEPTH_X} {DEPTH_Y})" fill="#145b82" fill-rule="evenodd"/>')
    parts.append(side_faces(contours, accent))
    parts.append(f'<path d="{d}" fill="{fill}" fill-rule="evenodd" stroke="#0e4868" stroke-width="2" stroke-linejoin="round"/>')
    parts.append('</g>')
    cursor += W + (42 if index == 3 else 12)

width = cursor - 12 + DEPTH_X
scale = 1080 / width
x = (1200 - width * scale) / 2
y = 55
art = "".join(parts[5:])
parts = parts[:5] + [f'<g transform="translate({x:.2f} {y}) scale({scale:.5f})">{art}</g>']
parts.append('<text x="600" y="279" text-anchor="middle" fill="#f4f8fc" font-family="Arial, Helvetica, sans-serif" font-size="25" font-weight="500">Tus finanzas en local: EUR y GBP, céntimo a céntimo, sin inventar nada.</text>')
parts.append('</svg>')

out = Path("assets/aura-finanzas-banner.svg")
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text("\n".join(parts) + "\n", encoding="utf-8")
print(out.resolve())

