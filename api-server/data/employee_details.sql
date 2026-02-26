BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS offices (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  service_id INTEGER,
  type TEXT NOT NULL,
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL,
  CHECK (type IN ('TOP_LEVEL','DIVISION'))
);
CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY,
  full_name TEXT NOT NULL,
  office_id INTEGER NOT NULL,
  FOREIGN KEY (office_id) REFERENCES offices(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_employees_office_id ON employees(office_id);
CREATE TABLE IF NOT EXISTS employee_details (
  id INTEGER PRIMARY KEY,
  employee_id INTEGER NOT NULL UNIQUE,
  position TEXT,
  email TEXT,
  phone TEXT,
  hire_date TEXT,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);
COMMIT;
