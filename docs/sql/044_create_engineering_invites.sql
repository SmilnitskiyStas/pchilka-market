-- Personal, single-use Telegram invitations. Raw tokens are never stored.
CREATE TABLE IF NOT EXISTS engineering_invites (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  token_hash CHAR(64) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_by VARCHAR(20) NULL,
  used_at DATETIME NULL,
  revoked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
