USE AccountDB;

-- Cuenta de ejemplo (password_hash debe reemplazarse por hash real del algoritmo que use tu login)
INSERT INTO accounts (username, password_hash, email, status)
VALUES ('admin', 'REPLACE_WITH_REAL_HASH', 'admin@example.local', 1)
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

USE GameDB;

-- Flag runtime de ejemplo
INSERT INTO world_runtime_flags (flag_key, flag_value)
VALUES ('server_name', 'GodsWar Reborn')
ON DUPLICATE KEY UPDATE flag_value = VALUES(flag_value), updated_at = CURRENT_TIMESTAMP;
