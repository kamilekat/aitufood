-- AituFood: relational equivalent of the Firestore data model (for comparison only).
-- The live database is Cloud Firestore; these constraints are enforced there by firestore.rules.
CREATE TABLE users (
  uid         TEXT PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE CHECK (email LIKE '%@astanait.edu.kz'),
  full_name   TEXT NOT NULL CHECK (length(full_name) BETWEEN 2 AND 60),
  role        TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'staff')),
  consent_at  TIMESTAMP NOT NULL,
  created_at  TIMESTAMP NOT NULL
);

CREATE TABLE categories (
  category_id TEXT PRIMARY KEY,
  name        TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 40),
  sort_order  INTEGER NOT NULL CHECK (sort_order >= 0)
);

CREATE TABLE menu_items (
  item_id     TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES categories(category_id) ON DELETE RESTRICT,
  name        TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 60),
  price       INTEGER NOT NULL CHECK (price BETWEEN 100 AND 10000),
  description TEXT CHECK (length(description) <= 200),
  available   BOOLEAN NOT NULL DEFAULT TRUE,
  photo_url   TEXT,
  updated_at  TIMESTAMP NOT NULL
);

CREATE TABLE time_slots (
  slot_id      TEXT PRIMARY KEY,
  date         DATE NOT NULL,
  start_time   TEXT NOT NULL,
  capacity     INTEGER NOT NULL CHECK (capacity BETWEEN 1 AND 30),
  booked_count INTEGER NOT NULL DEFAULT 0 CHECK (booked_count BETWEEN 0 AND capacity),
  UNIQUE (date, start_time)
);

CREATE TABLE orders (
  order_id   TEXT PRIMARY KEY,
  order_no   INTEGER NOT NULL UNIQUE,
  user_id    TEXT NOT NULL REFERENCES users(uid) ON DELETE RESTRICT,
  slot_id    TEXT NOT NULL REFERENCES time_slots(slot_id) ON DELETE RESTRICT,
  status     TEXT NOT NULL DEFAULT 'new'
             CHECK (status IN ('new', 'cooking', 'ready', 'picked_up', 'cancelled')),
  total      INTEGER NOT NULL CHECK (total > 0),
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);

CREATE TABLE order_items (
  order_id       TEXT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
  item_id        TEXT NOT NULL REFERENCES menu_items(item_id) ON DELETE RESTRICT,
  quantity       INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 10),
  price_at_order INTEGER NOT NULL CHECK (price_at_order > 0),
  PRIMARY KEY (order_id, item_id)
);

CREATE TABLE audit_log (
  log_id    TEXT PRIMARY KEY,
  user_id   TEXT REFERENCES users(uid) ON DELETE SET NULL,
  action    TEXT NOT NULL
            CHECK (action IN ('login', 'register', 'order_created', 'status_changed', 'menu_updated')),
  target_id TEXT NOT NULL,
  at        TIMESTAMP NOT NULL
);
