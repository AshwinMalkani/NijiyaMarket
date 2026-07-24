-- Nijiya Market: initial schema

-- pin_hash is NULL for people who have been invited (tagged as a companion by a
-- friend) but haven't signed up yet. They claim the row by signing up with the
-- same phone number, which carries over every tag and nudge waiting for them.
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  pin_hash TEXT,
  invited_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  claimed_at TEXT
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL
);

CREATE TABLE login_attempts (
  phone TEXT NOT NULL,
  attempted_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_login_attempts_phone ON login_attempts(phone, attempted_at);

CREATE TABLE sections (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '🛒',
  sort INTEGER NOT NULL DEFAULT 0
);

INSERT INTO sections (slug, name, emoji, sort) VALUES
  ('alcohol', 'Alcohol', '🍶', 1),
  ('sweet',   'Sweet',   '🍡', 2),
  ('savory',  'Savory',  '🍘', 3);

CREATE TABLE items (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  section_id INTEGER NOT NULL REFERENCES sections(id),
  description TEXT,
  price_cents INTEGER,
  photo_key TEXT,
  barcode TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Scanning a barcode we've seen before matches the existing item instead of
-- creating a duplicate, so this is the dedupe key as much as a lookup key.
CREATE UNIQUE INDEX idx_items_barcode ON items(barcode) WHERE barcode IS NOT NULL;

CREATE TABLE ratings (
  id INTEGER PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES items(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  score REAL NOT NULL CHECK (score >= 0 AND score <= 10),
  notes TEXT,
  tried_on TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (item_id, user_id)
);

CREATE TABLE rating_companions (
  rating_id INTEGER NOT NULL REFERENCES ratings(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  PRIMARY KEY (rating_id, user_id)
);

CREATE TABLE pending_ratings (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  item_id INTEGER NOT NULL REFERENCES items(id),
  tagged_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  dismissed_at TEXT,
  UNIQUE (user_id, item_id)
);

CREATE TABLE rating_photos (
  id INTEGER PRIMARY KEY,
  rating_id INTEGER NOT NULL REFERENCES ratings(id) ON DELETE CASCADE,
  photo_key TEXT NOT NULL
);

CREATE INDEX idx_ratings_item ON ratings(item_id);
CREATE INDEX idx_ratings_user ON ratings(user_id);
CREATE INDEX idx_items_section ON items(section_id);
CREATE INDEX idx_pending_user ON pending_ratings(user_id, dismissed_at);
