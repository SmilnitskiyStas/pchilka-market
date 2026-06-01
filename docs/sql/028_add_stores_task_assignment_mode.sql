ALTER TABLE stores
  ADD COLUMN task_assignment_mode VARCHAR(30) NOT NULL DEFAULT 'personal' AFTER address_line;

UPDATE stores
SET task_assignment_mode = 'personal'
WHERE task_assignment_mode NOT IN ('personal', 'shared', 'hybrid');
