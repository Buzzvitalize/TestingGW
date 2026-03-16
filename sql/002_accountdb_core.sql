USE AccountDB;

CREATE TABLE IF NOT EXISTS accounts (
  account_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(32) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  password_salt VARCHAR(64) DEFAULT NULL,
  email VARCHAR(128) DEFAULT NULL,
  status TINYINT NOT NULL DEFAULT 1,
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (account_id),
  UNIQUE KEY uq_accounts_username (username)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS account_sessions (
  session_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  account_id BIGINT UNSIGNED NOT NULL,
  ip_address VARCHAR(45) NOT NULL,
  login_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  logout_at DATETIME NULL,
  result_code INT NOT NULL DEFAULT 0,
  PRIMARY KEY (session_id),
  KEY idx_account_sessions_account_id (account_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS account_security_events (
  event_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  account_id BIGINT UNSIGNED NULL,
  event_type VARCHAR(64) NOT NULL,
  ip_address VARCHAR(45) NULL,
  payload_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (event_id),
  KEY idx_acc_sec_events_account_id (account_id),
  KEY idx_acc_sec_events_type (event_type)
) ENGINE=InnoDB;
