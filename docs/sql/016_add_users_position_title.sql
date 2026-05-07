-- Add optional position title for inventory users.
-- Compatible with older MySQL versions.

SET NAMES utf8mb4;

ALTER TABLE users
  ADD COLUMN position_title VARCHAR(120) NULL AFTER surname;
