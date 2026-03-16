-- 001_create_databases.sql
-- Base limpia para GodsWar (fase login + personaje básico)

CREATE DATABASE IF NOT EXISTS AccountDB
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE DATABASE IF NOT EXISTS GameDB
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- Usuarios técnicos (ajusta passwords antes de producción)
CREATE USER IF NOT EXISTS 'gw_account'@'%' IDENTIFIED BY 'change_this_account_pwd';
CREATE USER IF NOT EXISTS 'gw_game'@'%' IDENTIFIED BY 'change_this_game_pwd';

GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON AccountDB.* TO 'gw_account'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON GameDB.* TO 'gw_game'@'%';

FLUSH PRIVILEGES;
