-- ============================================================
-- PM Scheduler — Initial Schema
-- ============================================================
-- Synced from Synergy (read-only, managed by nightly sync script)

CREATE TABLE customers (
  id             SERIAL PRIMARY KEY,
  synergy_id     VARCHAR NOT NULL UNIQUE,
  name           VARCHAR NOT NULL,
  account_number VARCHAR,
  ar_terms       VARCHAR,
  credit_hold    BOOLEAN DEFAULT FALSE,
  billing_address TEXT,
  synced_at      TIMESTAMPTZ
);

CREATE TABLE contacts (
  id          SERIAL PRIMARY KEY,
  customer_id INT REFERENCES customers(id) ON DELETE CASCADE,
  synergy_id  VARCHAR,
  name        VARCHAR,
  email       VARCHAR,
  phone       VARCHAR,
  is_primary  BOOLEAN DEFAULT FALSE
);

CREATE TABLE products (
  id          SERIAL PRIMARY KEY,
  synergy_id  VARCHAR NOT NULL UNIQUE,
  number      VARCHAR NOT NULL,
  description VARCHAR,
  unit_price  DECIMAL(10,2),
  synced_at   TIMESTAMPTZ
);

-- ============================================================
-- Owned by PM System
-- ============================================================

CREATE TABLE users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      VARCHAR NOT NULL UNIQUE,
  name       VARCHAR NOT NULL,
  role       TEXT CHECK (role IN ('manager','coordinator','technician')),
  active     BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE equipment (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id           INT REFERENCES customers(id),
  default_technician_id UUID REFERENCES users(id),
  make                  VARCHAR,
  model                 VARCHAR,
  serial_number         VARCHAR,
  description           TEXT,
  location_on_site      VARCHAR,
  active                BOOLEAN DEFAULT TRUE,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE pm_schedules (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id UUID REFERENCES equipment(id) ON DELETE CASCADE,
  frequency    TEXT CHECK (frequency IN ('monthly','quarterly','semi-annual','annual')),
  billing_type TEXT CHECK (billing_type IN ('flat_rate','time_and_materials','contract')),
  flat_rate    DECIMAL(10,2),
  active       BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE pm_tickets (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pm_schedule_id         UUID REFERENCES pm_schedules(id),
  equipment_id           UUID REFERENCES equipment(id),
  customer_id            INT REFERENCES customers(id),
  assigned_technician_id UUID REFERENCES users(id),
  created_by_id          UUID REFERENCES users(id),
  month                  INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year                   INT NOT NULL,
  status                 TEXT CHECK (status IN ('unassigned','assigned','in_progress','completed','billed')) DEFAULT 'unassigned',
  scheduled_date         DATE,
  completed_date         DATE,
  completion_notes       TEXT,
  hours_worked           DECIMAL(5,2),
  parts_used             JSONB DEFAULT '[]',
  billing_amount         DECIMAL(10,2),
  billing_exported       BOOLEAN DEFAULT FALSE,
  created_at             TIMESTAMPTZ DEFAULT now(),
  updated_at             TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE sync_log (
  id             SERIAL PRIMARY KEY,
  sync_type      VARCHAR CHECK (sync_type IN ('customers','contacts','products','full')),
  started_at     TIMESTAMPTZ,
  completed_at   TIMESTAMPTZ,
  records_synced INT,
  status         TEXT CHECK (status IN ('running','success','failed')),
  error_message  TEXT
);
