#!/usr/bin/env python3
from __future__ import annotations
import json
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CLIENT_DIR = ROOT / "Client"
OUT_JSON = ROOT / "phase1" / "asset_inventory.json"
OUT_MD = ROOT / "phase1" / "ASSET_INVENTORY.md"

BROWSER_READY = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".ico", ".wav", ".ogg", ".mp3", ".ttf", ".otf", ".json", ".txt", ".xml"}


def scan_assets() -> dict:
    ext_counter: Counter[str] = Counter()
    dir_counter: Counter[str] = Counter()
    samples: defaultdict[str, list[str]] = defaultdict(list)

    for path in CLIENT_DIR.rglob("*"):
        if not path.is_file():
            continue
        rel = path.relative_to(ROOT)
        top_dir = rel.parts[1] if len(rel.parts) > 1 else "."
        ext = path.suffix.lower() or "<noext>"

        ext_counter[ext] += 1
        dir_counter[top_dir] += 1
        if len(samples[ext]) < 5:
            samples[ext].append(str(rel))

    browser_ready = sum(c for e, c in ext_counter.items() if e in BROWSER_READY)
    legacy = sum(c for e, c in ext_counter.items() if e not in BROWSER_READY)

    return {
        "root": str(CLIENT_DIR.relative_to(ROOT)),
        "total_files": sum(ext_counter.values()),
        "extensions": [{"ext": e, "count": c, "browser_ready": e in BROWSER_READY, "samples": samples[e]} for e, c in ext_counter.most_common()],
        "top_directories": [{"directory": d, "count": c} for d, c in dir_counter.most_common()],
        "summary": {
            "browser_ready_files": browser_ready,
            "legacy_or_custom_files": legacy,
        },
    }


def write_markdown(data: dict) -> None:
    lines = [
        "# Inventario de assets (Fase 1)",
        "",
        f"- Carpeta analizada: `{data['root']}`",
        f"- Total de archivos: **{data['total_files']}**",
        f"- Browser-ready (directo): **{data['summary']['browser_ready_files']}**",
        f"- Legacy/custom (requieren pipeline): **{data['summary']['legacy_or_custom_files']}**",
        "",
        "## Top extensiones",
        "",
        "| Extensión | Cantidad | ¿Web directa? |",
        "|---|---:|:---:|",
    ]

    for row in data["extensions"][:15]:
        lines.append(f"| `{row['ext']}` | {row['count']} | {'Sí' if row['browser_ready'] else 'No'} |")

    lines.extend([
        "",
        "## Top carpetas",
        "",
        "| Carpeta | Cantidad |",
        "|---|---:|",
    ])

    for row in data["top_directories"][:12]:
        lines.append(f"| `{row['directory']}` | {row['count']} |")

    lines.extend([
        "",
        "## Conclusión técnica rápida",
        "",
        "El cliente contiene una mezcla grande de formatos propietarios (`.jcs`, `.gwo`, `.water`, `.gwm`, `.texture`) junto con formatos utilizables en web (`.wav`, `.ogg`, `.ttf`, `.xml`, `.ico`).",
        "Para un cliente web, conviene crear un pipeline de conversión para mapas/sprites legacy y priorizar reuso inmediato de audio/fuentes/textos.",
    ])

    OUT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    data = scan_assets()
    OUT_JSON.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    write_markdown(data)
    print(f"Wrote {OUT_JSON.relative_to(ROOT)} and {OUT_MD.relative_to(ROOT)}")
