# Inventario de assets (Fase 1)

- Carpeta analizada: `Client`
- Total de archivos: **5504**
- Browser-ready (directo): **170**
- Legacy/custom (requieren pipeline): **5334**

## Top extensiones

| Extensión | Cantidad | ¿Web directa? |
|---|---:|:---:|
| `.jcs` | 2341 | No |
| `.gwo` | 1500 | No |
| `.dat` | 786 | No |
| `.water` | 370 | No |
| `.ini` | 118 | No |
| `.gwm` | 117 | No |
| `.xml` | 91 | Sí |
| `.wav` | 55 | Sí |
| `.hmp` | 28 | No |
| `.texture` | 25 | No |
| `.lua` | 20 | No |
| `.ogg` | 15 | Sí |
| `.scc` | 8 | No |
| `.exe` | 4 | No |
| `.dll` | 4 | No |

## Top carpetas

| Carpeta | Cantidad |
|---|---:|
| `Characters` | 2208 |
| `Map` | 1620 |
| `Text` | 786 |
| `Monster` | 464 |
| `UI` | 193 |
| `Effect` | 117 |
| `Sound` | 55 |
| `Settings` | 25 |
| `BGM` | 15 |
| `Fonts` | 5 |
| `Log` | 2 |
| `GodsWar.exe` | 1 |

## Conclusión técnica rápida

El cliente contiene una mezcla grande de formatos propietarios (`.jcs`, `.gwo`, `.water`, `.gwm`, `.texture`) junto con formatos utilizables en web (`.wav`, `.ogg`, `.ttf`, `.xml`, `.ico`).
Para un cliente web, conviene crear un pipeline de conversión para mapas/sprites legacy y priorizar reuso inmediato de audio/fuentes/textos.
