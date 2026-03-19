# Fase 7 - Matchmaking + Ops stream (SSE)

Fase 7 agrega capacidades para operación en tiempo real y emparejamiento:

- **Matchmaking queue** (`queue_join`) que empareja de 2 en 2 en una sala arena.
- **Eventos operativos por SSE** (`GET /ops/stream`) para observar auth, joins, matches, respawns y conexiones.
- **Snapshot y estado por sala** con `match_found` + `state_update`.
- **Test de integración** (`phase7/tests/integration.test.js`) validando health + matchmaking + métricas.

## Ejecutar gateway
```bash
cd phase7/gateway
npm start
```

Variables:
- `PORT` (default `8130`)
- `GW_DEMO_TOKEN` (default `gw-phase7-demo`)

## Ejecutar cliente web
```bash
python -m http.server 8000
```
Abrir: `http://localhost:8000/phase7/web-client/index.html`

## Endpoints
- `GET /health`
- `GET /rooms`
- `GET /metrics`
- `GET /ops/stream` (SSE)
- `WS /ws`

## Test integración
```bash
node phase7/tests/integration.test.js
```
