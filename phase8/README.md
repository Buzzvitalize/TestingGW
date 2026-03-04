# Fase 8 - Tournament rounds + simulación + export NDJSON

Fase 8 extiende matchmaking con componentes de operación y análisis:

- **Tournament por sala** con rondas (`round`) y finalización tras 3 rondas.
- **Simulación HTTP** de sala (`GET /simulate?roomId=...&ticks=...`) para generar actividad controlada.
- **Export NDJSON** de eventos (`GET /events.ndjson?roomId=...`) para debug/ingesta.
- **Test de integración** para health + match + simulate + export + métricas.

## Ejecutar gateway
```bash
cd phase8/gateway
npm start
```

Variables:
- `PORT` (default `8140`)
- `GW_DEMO_TOKEN` (default `gw-phase8-demo`)

## Ejecutar cliente
```bash
python -m http.server 8000
```
Abrir: `http://localhost:8000/phase8/web-client/index.html`

## Endpoints
- `GET /health`
- `GET /rooms`
- `GET /metrics`
- `GET /simulate?roomId=...&ticks=...`
- `GET /events.ndjson?roomId=...`
- `WS /ws`

## Test integración
```bash
node phase8/tests/integration.test.js
```
