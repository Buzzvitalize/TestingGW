# Blueprint inicial — Login + Base de Datos (GodsWar 2.48.001 USA)

> Objetivo: reconstruir desde cero una base **ordenada y mantenible** para un servidor privado de GodsWar, empezando por autenticación (Login), cuentas y personajes.

---

## 1) Alcance de esta fase

En esta fase **NO** vamos a “completar todo el juego”.
Primero dejamos estable:

1. `DBServer` online y conectado a MySQL/MariaDB.
2. `LoginServer` online y validando credenciales.
3. `GameServer` inicializando y leyendo datos base.
4. Cliente (`gw_setup_2.48.001_usa.exe`) autenticando contra tu infraestructura local.

---

## 2) Convención de nombres recomendada (nueva)

Para evitar confusiones con dumps viejos:

- Base de cuentas: **`AccountDB`**
- Base del juego: **`GameDB`**

Usuarios sugeridos:

- `gw_account` → permisos solo sobre `AccountDB`
- `gw_game` → permisos solo sobre `GameDB`

> Si prefieres un solo usuario técnico al inicio, úsalo temporalmente y luego separa por seguridad.

---

## 3) Estructura de proyecto recomendada

```text
/workspace/TestingGW
├─ docs/
│  ├─ Blueprint_Login_AccountDB_GameDB.md   # este documento
│  └─ Runbook_Operativo.md                  # siguiente entrega
├─ sql/
│  ├─ 001_create_databases.sql
│  ├─ 002_accountdb_core.sql
│  ├─ 003_gamedb_core.sql
│  └─ 100_seed_minimo.sql
├─ GW 2.0/
│  ├─ Server Files (Compiled)/
│  └─ Server Files (Source)/
└─ Client/
```

---

## 4) Orden de arranque (run order)

Siempre iniciar en este orden:

1. **MySQL/MariaDB**
2. **DBServer**
3. **LoginServer**
4. **GameServer**
5. **Cliente**

Si falla login, revisar en este mismo orden.

---

## 5) Matriz de configuración mínima

### LoginServer
Archivo actual de referencia: `GW 2.0/Server Files (Compiled)/loginserver/config.ini`

Campos críticos:

- `IP`: IP LAN real del host servidor
- `ListenPort`: puerto login (ej. `5999`)
- `Version`: debe coincidir con build cliente usada
- DB:
  - `DBServer=127.0.0.1` (si DB local)
  - `DBName=AccountDB` (nuevo nombre)

### DBServer
Archivo actual de referencia: `GW 2.0/Server Files (Compiled)/dbserver/config.ini`

Campos críticos:

- `IP`: IP LAN real
- `ListenPort`: puerto DBServer (ej. `5000`)
- DB:
  - `DBServer=127.0.0.1`
  - `DBName=GameDB` (nuevo nombre)

---

## 6) Blueprint de datos (modelo inicial)

> Este es un modelo limpio y extensible. En la fase de migración se puede adaptar al esquema exacto que espere el binario del servidor.

### 6.1 `AccountDB`

Tablas mínimas:

- `accounts`
  - `account_id` (PK)
  - `username` (UNIQUE)
  - `password_hash`
  - `password_salt`
  - `email`
  - `status` (active/banned)
  - `last_login_at`
  - `created_at`, `updated_at`

- `account_sessions`
  - `session_id` (PK)
  - `account_id` (FK)
  - `ip_address`
  - `login_at`
  - `logout_at`
  - `result_code`

- `account_security_events`
  - `event_id` (PK)
  - `account_id`
  - `event_type` (failed_login, password_change, etc.)
  - `ip_address`
  - `payload_json`
  - `created_at`

### 6.2 `GameDB`

Tablas mínimas:

- `characters`
  - `char_id` (PK)
  - `account_id` (index)
  - `name` (UNIQUE)
  - `class_id`, `gender`
  - `level`, `exp`
  - `map_id`, `pos_x`, `pos_y`, `pos_z`
  - `hp`, `mp`
  - `created_at`, `updated_at`

- `character_stats`
  - `char_id` (PK/FK)
  - `str_stat`, `agi_stat`, `vit_stat`, `int_stat`
  - `free_points`

- `inventory_items`
  - `item_uid` (PK)
  - `char_id` (index)
  - `item_id`
  - `slot`
  - `count`
  - `bind_state`

- `quests_state`
  - `char_id`, `quest_id` (PK compuesto)
  - `state`
  - `progress`
  - `updated_at`

- `world_runtime_flags`
  - `flag_key` (PK)
  - `flag_value`
  - `updated_at`

---

## 7) Estrategia de compatibilidad con binarios antiguos

Como el servidor original es legacy, hay que hacerlo por capas:

1. **Capa A — Esquema limpio** (el de este blueprint).
2. **Capa B — Compatibilidad**: crear vistas/procedimientos o tablas espejo según lo que el ejecutable realmente consulte.
3. **Capa C — Migración**: mover datos sin romper login/personaje.

Regla: nunca romper la Capa A; compatibilidad se agrega encima.

---

## 8) Checklist de implementación (paso a paso)

### Paso 1 — Preparar DB

- Crear `AccountDB` y `GameDB`.
- Crear usuarios `gw_account` y `gw_game`.
- Asignar permisos mínimos.

### Paso 2 — Cargar esquema base

- Ejecutar `sql/001_create_databases.sql`.
- Ejecutar `sql/002_accountdb_core.sql`.
- Ejecutar `sql/003_gamedb_core.sql`.
- Ejecutar `sql/100_seed_minimo.sql`.

### Paso 3 — Configurar servicios

- Editar `loginserver/config.ini` → `DBName=AccountDB`.
- Editar `dbserver/config.ini` → `DBName=GameDB`.
- Ajustar IP/puertos a LAN real.

### Paso 4 — Prueba técnica

- Arranque completo (DBServer → LoginServer → GameServer).
- Crear cuenta de prueba.
- Login cliente.
- Crear personaje.
- Entrar mapa inicial.

### Paso 5 — Trazabilidad

- Guardar logs de cada servicio por fecha.
- Anotar errores y SQL ejecutado.
- Versionar cada cambio en git.

---

## 9) Definición de “Done” para esta fase

Se considera completada cuando:

- [ ] Login funcional con `AccountDB`.
- [ ] Creación y persistencia de personaje en `GameDB`.
- [ ] Reconexión sin pérdida de datos.
- [ ] Logs de login y errores básicos disponibles.

---

## 10) Siguiente entrega sugerida

Crear `docs/Runbook_Operativo.md` con:

- comandos exactos de arranque/parada,
- diagnóstico rápido por síntoma,
- plan de backup y restore,
- flujo de despliegue sin downtime.
