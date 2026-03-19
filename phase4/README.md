# Fase 4 - Hardening inicial + observabilidad

Esta fase continúa el spike de gameplay con foco en operación:

- **Auth simple por token** (`auth`) antes de aceptar acciones.
- **Métricas runtime** por endpoint (`GET /metrics`).
- **Logs estructurados JSON** para eventos de conexión.
- **Cliente web** con login (token), gameplay, y consulta de métricas.

## Ejecutar

### 1) Gateway
```bash
cd phase4/gateway
npm start
```

Variables opcionales:
- `PORT` (default `8100`)
- `GW_DEMO_TOKEN` (default `gw-phase4-demo`)

### 2) Cliente
Desde la raíz del repo:
```bash
python -m http.server 8000
```
Abrir `http://localhost:8000/phase4/web-client/index.html`.

## Endpoints

- `GET /health`
- `GET /snapshot`
- `GET /metrics`
- `WS /ws`
