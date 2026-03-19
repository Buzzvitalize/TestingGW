# Fase 5 - Sesión reanudable + leaderboard + pruebas de integración

Esta fase añade capacidades orientadas a producto:

- **Session resume** (estado preservado por `sessionId` en memoria)
- **Leaderboard** (`GET /leaderboard`) por score de daño
- **Combat log** (`GET /combat-log`) para trazabilidad de eventos
- **Test de integración automatizado** (`phase5/tests/integration.test.js`)

## Ejecutar gateway
```bash
cd phase5/gateway
npm start
```

Variables:
- `PORT` (default `8110`)
- `GW_DEMO_TOKEN` (default `gw-phase5-demo`)

## Ejecutar cliente
Desde raíz del repo:
```bash
python -m http.server 8000
```
Abrir: `http://localhost:8000/phase5/web-client/index.html`

## Ejecutar test de integración
Desde raíz del repo:
```bash
node phase5/tests/integration.test.js
```
