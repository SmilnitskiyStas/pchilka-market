-- Individual admin-panel permissions. Existing administrators retain full access;
-- existing editors receive no module access until it is explicitly assigned.
SET NAMES utf8mb4;

ALTER TABLE admin_users
  ADD COLUMN permissions JSON NULL AFTER role;

UPDATE admin_users
SET permissions = JSON_ARRAY()
WHERE permissions IS NULL;

ALTER TABLE admin_users
  MODIFY COLUMN permissions JSON NOT NULL;
