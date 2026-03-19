# Fase 3 - Combate, inventario, skills y NPC (spike)

Esta fase agrega un spike funcional de gameplay sobre WebSocket:

- **Combate básico** (`attack`)
- **Uso de skills** (`use_skill` con costo de maná)
- **Uso de inventario** (`use_item`)
- **Estado de NPC** sincronizado
- **Broadcast de estado** (`state_update`) para múltiples clientes

## Ejecutar

### 1) Gateway
```bash
cd phase3/gateway
npm start
```

### 2) Cliente web
Desde la raíz del repo:
```bash
python -m http.server 8000
```
Abrir `http://localhost:8000/phase3/web-client/index.html`.

## Endpoints

- `GET /health`
- `GET /snapshot`
- `WS /ws`

## Mensajes soportados (cliente -> gateway)

- `{"type":"move","dx":16,"dy":0}`
- `{"type":"attack"}`
- `{"type":"use_skill","skillId":"fireball"}`
- `{"type":"use_item","itemId":"potion-small"}`
