# Fase 2 - Gateway + render inicial

Esta fase implementa dos hitos del plan:

1. **Gateway mínimo WebSocket**
   - Ruta de socket: `ws://localhost:8080/ws`
   - Mensajes soportados:
     - `{"type":"ping","ts":...}` -> `{"type":"pong",...}`
   - Healthcheck HTTP: `GET /health`

2. **Primer render web de sprite**
   - Cliente estático en `phase2/web-client/`
   - Carga y dibuja un sprite real (`Client/UI/Texture/ico/Hand.ico`) en `canvas`.

## Uso rápido

### 1) Levantar gateway
```bash
cd phase2/gateway
npm start
```

### 2) Levantar cliente estático desde raíz del repo
```bash
python -m http.server 8000
```
Abrir:
- `http://localhost:8000/phase2/web-client/index.html`

Conectar al socket `ws://localhost:8080/ws` y pulsar `Ping`.
