# Fase 6 - Rooms + Replay export + integración

Fase 6 añade capacidades multi-sala y trazabilidad de partidas:

- **Rooms** por `roomId` (join dinámico)
- **Broadcast por sala** con `state_update`
- **Replay export** por sala vía `GET /replay?roomId=...`
- **Listado de rooms** vía `GET /rooms`
- **Prueba de integración** (`phase6/tests/integration.test.js`)

## Ejecutar gateway
```bash
cd phase6/gateway
npm start
```

Variables:
- `PORT` (default `8120`)
- `GW_DEMO_TOKEN` (default `gw-phase6-demo`)

## Ejecutar web client
Desde raíz:
```bash
python -m http.server 8000
```
Abrir: `http://localhost:8000/phase6/web-client/index.html`

## Test integración
```bash
node phase6/tests/integration.test.js
```
