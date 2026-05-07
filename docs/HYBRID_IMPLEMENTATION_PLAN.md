# Turf-1701 — Hybrid Architecture Implementation Plan
**Team:** 3 Developers | **Timeline:** 7 Weeks | **Goal:** Production-ready app for real owner testing

---

## Architecture Decision

### Why Hybrid (Firebase + PostgreSQL) and Not One or the Other

| Need | Best Tool | Reason |
|------|-----------|--------|
| Login / OTP authentication | Firebase Auth | Already built, phone OTP works perfectly |
| Real-time chat + negotiation cards | Firebase Firestore | `onSnapshot` is instant — replacing this adds months of work |
| Push notifications | Firebase Cloud Messaging | Native mobile push, no alternative needed |
| Image storage (turf photos, payment screenshots) | Firebase Storage | Already integrated, no reason to change |
| Slot lock (10-min timer) | Firebase Firestore | Temporary data, no persistence needed |
| Bookings, payments, revenue data | PostgreSQL (Supabase) | ACID transactions, no data loss, complex queries |
| Analytics and reporting | PostgreSQL (Supabase) | SQL aggregations — impossible cleanly in Firestore |
| Expenses, reviews, subscriptions | PostgreSQL (Supabase) | Relational integrity, foreign keys, audit trail |
| Users, companies, turfs | PostgreSQL (Supabase) | Clean joins across all tables |

### Final Architecture Diagram

```
Mobile App (React Native + Expo)
           │
           │  All HTTP requests carry Firebase Auth JWT token
           ▼
┌──────────────────────────────────────────────────────┐
│              Express.js Middleware                    │
│              Firebase Cloud Functions                 │
│                                                      │
│  helmet │ cors │ rate-limiter │ auth │ validator     │
│                                                      │
│  /api/bookings    /api/payments    /api/slots        │
│  /api/users       /api/expenses    /api/reviews      │
│  /api/companies   /api/turfs       /api/analytics    │
│  /api/subscriptions                                  │
└───────────────┬──────────────────────────────────────┘
                │
     ┌──────────┴─────────────┐
     │                        │
     ▼                        ▼
PostgreSQL                Firebase
(Supabase)                (Keep as-is)
────────────              ──────────────────────
users                     Firebase Auth (login)
companies                 Firebase Storage (images)
turfs                     Firestore chats (real-time)
grounds                   Firestore slot_locks (temp)
bookings                  FCM notifications
payments
booking_history
expenses
reviews
subscriptions
blocked_slots
maintenance_logs
invite_codes
```

---

## Team Assignments

```
Dev 1 — Backend Lead
  Owns: Express.js middleware, API routes, Cloud Functions updates
  Skills needed: Node.js, Express, SQL queries

Dev 2 — Database Engineer
  Owns: Supabase setup, PostgreSQL schema, Row-Level Security,
        migration scripts, backups, DB utilities
  Skills needed: PostgreSQL, SQL, Supabase dashboard

Dev 3 — Mobile Integration
  Owns: Mobile API client, screen refactoring, end-to-end testing
  Skills needed: React Native, existing Firebase services knowledge
```

---

## Prerequisites (Do This Before Week 1 — Day 0)

### All 3 Devs — Same Day Setup

**1. Create Supabase project:**
```
1. Go to supabase.com → New Project
2. Name: turf-1701-prod
3. Region: ap-south-1 (Mumbai — closest to India)
4. Save the password securely
5. After creation, go to Settings → API
6. Copy: Project URL, anon key, service_role key
```

**2. Install Supabase CLI:**
```bash
npm install -g supabase
supabase login
```

**3. Add environment variables to Firebase Functions:**
```bash
# In functions/ directory
firebase functions:config:set \
  supabase.url="https://xxxx.supabase.co" \
  supabase.service_key="your-service-role-key"
```

**4. Install dependencies in functions/:**
```bash
cd functions
npm install express helmet cors express-rate-limit express-validator morgan pg @supabase/supabase-js
```

**5. Create shared .env.local for mobile app:**
```bash
# In project root
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=your-anon-key
API_BASE_URL=https://us-central1-sowin-power.cloudfunctions.net/api
```

**6. Set up GitHub branch protection:**
```
main branch:
  - Require PR review from 1 member before merge
  - Require status checks to pass
  - No direct pushes to main

Branch naming:
  dev1/feature-name
  dev2/feature-name
  dev3/feature-name
```

---

## PostgreSQL Schema (Dev 2 implements in Week 1)

Run all of this in Supabase → SQL Editor in order.

### Step 1: Enable Extensions

```sql
-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable better text search
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
```

---

### Step 2: Core Tables

```sql
-- ─────────────────────────────────────────────────────
-- USERS
-- id matches Firebase Auth UID exactly
-- ─────────────────────────────────────────────────────
CREATE TABLE users (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  phone                 TEXT UNIQUE NOT NULL,
  email                 TEXT,
  role                  TEXT NOT NULL CHECK (role IN ('user','caretaker','manager','owner','admin')),
  company_id            TEXT,                         -- filled after joining/creating company
  avatar_url            TEXT,
  fcm_token             TEXT,                         -- push notification token
  is_active             BOOLEAN DEFAULT TRUE,
  is_suspended          BOOLEAN DEFAULT FALSE,
  suspension_reason     TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────
-- COMPANIES
-- A company owns one or more turfs
-- ─────────────────────────────────────────────────────
CREATE TABLE companies (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  owner_id              TEXT NOT NULL REFERENCES users(id),
  phone                 TEXT,
  email                 TEXT,
  address               TEXT,
  city                  TEXT,
  logo_url              TEXT,
  upi_id                TEXT,
  upi_holder_name       TEXT,
  subscription_status   TEXT DEFAULT 'inactive' CHECK (subscription_status IN ('active','inactive','grace','expired')),
  subscription_end_date TIMESTAMPTZ,
  is_active             BOOLEAN DEFAULT TRUE,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key from users to companies (after both tables exist)
ALTER TABLE users ADD CONSTRAINT fk_users_company
  FOREIGN KEY (company_id) REFERENCES companies(id);

-- ─────────────────────────────────────────────────────
-- TURFS
-- A turf belongs to a company and has multiple grounds
-- ─────────────────────────────────────────────────────
CREATE TABLE turfs (
  id                    TEXT PRIMARY KEY,
  company_id            TEXT NOT NULL REFERENCES companies(id),
  name                  TEXT NOT NULL,
  description           TEXT,
  address               TEXT,
  city                  TEXT,
  latitude              DECIMAL(10,8),
  longitude             DECIMAL(11,8),
  sports                TEXT[],                       -- ['football','cricket']
  amenities             TEXT[],                       -- ['parking','floodlights']
  cover_image_url       TEXT,
  image_urls            TEXT[],
  is_active             BOOLEAN DEFAULT TRUE,
  rating                DECIMAL(3,2) DEFAULT 0,
  total_reviews         INTEGER DEFAULT 0,
  payment_timing        TEXT DEFAULT 'before_approval'
                          CHECK (payment_timing IN ('before_approval','after_approval')),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────
-- GROUNDS
-- Each turf has one or more bookable grounds/courts
-- ─────────────────────────────────────────────────────
CREATE TABLE grounds (
  id                    TEXT PRIMARY KEY,             -- 'ground-0', 'ground-1'
  turf_id               TEXT NOT NULL REFERENCES turfs(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,               -- 'Ground A', 'Court 1'
  sport                 TEXT,
  price_per_hour        DECIMAL(10,2),
  advance_amount        DECIMAL(10,2),
  capacity              INTEGER,
  surface_type          TEXT,
  is_active             BOOLEAN DEFAULT TRUE,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);
```

---

### Step 3: Booking Tables

```sql
-- ─────────────────────────────────────────────────────
-- BOOKINGS
-- Core transactional table — most critical
-- ─────────────────────────────────────────────────────
CREATE TABLE bookings (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               TEXT NOT NULL REFERENCES users(id),
  turf_id               TEXT NOT NULL REFERENCES turfs(id),
  ground_id             TEXT NOT NULL REFERENCES grounds(id),
  company_id            TEXT NOT NULL REFERENCES companies(id),
  date                  DATE NOT NULL,
  start_time            TIME NOT NULL,
  end_time              TIME NOT NULL,
  total_amount          DECIMAL(10,2) NOT NULL,
  advance_amount        DECIMAL(10,2),
  remaining_amount      DECIMAL(10,2),
  status                TEXT NOT NULL DEFAULT 'pending_payment'
                          CHECK (status IN (
                            'pending_payment',
                            'payment_submitted',
                            'pending',
                            'confirmed',
                            'in_progress',
                            'completed',
                            'cancelled',
                            'rejected',
                            'expired',
                            'payment_rejected'
                          )),
  notes                 TEXT,
  has_review            BOOLEAN DEFAULT FALSE,
  review_id             UUID,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent double booking at DB level (most important constraint)
  -- Two bookings on same turf+ground+date cannot have overlapping times
  EXCLUDE USING gist (
    turf_id WITH =,
    ground_id WITH =,
    date WITH =,
    tsrange(
      (date + start_time)::timestamp,
      (date + end_time)::timestamp
    ) WITH &&
  ) WHERE (status IN ('confirmed','in_progress','payment_submitted','pending_payment'))
);

-- ─────────────────────────────────────────────────────
-- BOOKING STATUS HISTORY
-- Full audit trail of every status change
-- ─────────────────────────────────────────────────────
CREATE TABLE booking_history (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id            UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  status                TEXT NOT NULL,
  changed_by            TEXT REFERENCES users(id),
  changed_by_role       TEXT,
  reason                TEXT,
  changed_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────
-- BLOCKED SLOTS
-- Manager/owner manually blocks time slots
-- ─────────────────────────────────────────────────────
CREATE TABLE blocked_slots (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  turf_id               TEXT NOT NULL REFERENCES turfs(id),
  ground_id             TEXT NOT NULL REFERENCES grounds(id),
  start_date            DATE NOT NULL,
  end_date              DATE NOT NULL,
  start_time            TIME,
  end_time              TIME,
  all_day               BOOLEAN DEFAULT FALSE,
  reason                TEXT,
  blocked_by            TEXT NOT NULL REFERENCES users(id),
  created_at            TIMESTAMPTZ DEFAULT NOW()
);
```

---

### Step 4: Payment Tables

```sql
-- ─────────────────────────────────────────────────────
-- PAYMENTS
-- One payment record per booking
-- transaction_id UNIQUE enforces fraud prevention at DB level
-- ─────────────────────────────────────────────────────
CREATE TABLE payments (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id            UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  company_id            TEXT NOT NULL REFERENCES companies(id),
  transaction_id        TEXT,
  screenshot_url        TEXT,
  amount                DECIMAL(10,2),
  paid_to_upi_id        TEXT,
  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','submitted','verified','rejected')),
  submitted_at          TIMESTAMPTZ,
  verified_by           TEXT REFERENCES users(id),
  verified_at           TIMESTAMPTZ,
  rejected_by           TEXT REFERENCES users(id),
  rejected_at           TIMESTAMPTZ,
  rejection_reason      TEXT,
  verification_note     TEXT,
  attempt_number        INTEGER DEFAULT 1,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Unique transaction ID per company (prevents reuse fraud)
CREATE UNIQUE INDEX unique_txn_per_company
  ON payments (company_id, transaction_id)
  WHERE transaction_id IS NOT NULL;

-- ─────────────────────────────────────────────────────
-- PAYMENT HISTORY
-- Multiple payment attempts per booking
-- ─────────────────────────────────────────────────────
CREATE TABLE payment_attempts (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id            UUID NOT NULL REFERENCES bookings(id),
  attempt_number        INTEGER NOT NULL,
  transaction_id        TEXT,
  screenshot_url        TEXT,
  amount                DECIMAL(10,2),
  status                TEXT,
  submitted_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────
-- USER PAYMENT HISTORY
-- Fraud prevention: track consecutive rejections
-- ─────────────────────────────────────────────────────
CREATE TABLE user_payment_history (
  user_id                     TEXT PRIMARY KEY REFERENCES users(id),
  total_submissions           INTEGER DEFAULT 0,
  verified_payments           INTEGER DEFAULT 0,
  rejected_payments           INTEGER DEFAULT 0,
  consecutive_rejections      INTEGER DEFAULT 0,
  last_rejection_date         TIMESTAMPTZ,
  is_banned                   BOOLEAN DEFAULT FALSE,
  ban_reason                  TEXT,
  ban_start_date              TIMESTAMPTZ,
  ban_end_date                TIMESTAMPTZ,
  banned_by                   TEXT
);
```

---

### Step 5: Subscription Tables

```sql
-- ─────────────────────────────────────────────────────
-- SUBSCRIPTIONS
-- Platform subscription for owners (per ground pricing)
-- ─────────────────────────────────────────────────────
CREATE TABLE subscriptions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id            TEXT NOT NULL REFERENCES companies(id),
  turf_ids              TEXT[],
  total_grounds         INTEGER NOT NULL,
  months                INTEGER NOT NULL,
  price_per_ground      DECIMAL(10,2),
  tier_discount         DECIMAL(5,2),
  duration_discount     DECIMAL(5,2),
  discount_amount       DECIMAL(10,2),
  final_amount          DECIMAL(10,2) NOT NULL,
  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','active','expired','cancelled')),
  started_at            TIMESTAMPTZ,
  expires_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────
-- SUBSCRIPTION PAYMENTS
-- Payment records for platform subscriptions
-- ─────────────────────────────────────────────────────
CREATE TABLE subscription_payments (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id       UUID REFERENCES subscriptions(id),
  company_id            TEXT NOT NULL REFERENCES companies(id),
  transaction_ref       TEXT UNIQUE NOT NULL,
  amount                DECIMAL(10,2) NOT NULL,
  screenshot_url        TEXT,
  status                TEXT NOT NULL DEFAULT 'initiated'
                          CHECK (status IN ('initiated','proof_submitted','verified','completed','failed')),
  upi_link              TEXT,
  initiated_by          TEXT REFERENCES users(id),
  verified_by           TEXT REFERENCES users(id),
  initiated_at          TIMESTAMPTZ DEFAULT NOW(),
  expires_at            TIMESTAMPTZ,
  verified_at           TIMESTAMPTZ
);
```

---

### Step 6: Operations Tables

```sql
-- ─────────────────────────────────────────────────────
-- EXPENSES
-- Operational expense tracking per turf
-- ─────────────────────────────────────────────────────
CREATE TABLE expenses (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id            TEXT NOT NULL REFERENCES companies(id),
  turf_id               TEXT NOT NULL REFERENCES turfs(id),
  category              TEXT NOT NULL,
  amount                DECIMAL(10,2) NOT NULL,
  description           TEXT,
  receipt_urls          TEXT[],
  added_by              TEXT NOT NULL REFERENCES users(id),
  added_by_role         TEXT,
  expense_date          DATE DEFAULT CURRENT_DATE,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────
-- REVIEWS
-- User reviews for turfs after completed bookings
-- ─────────────────────────────────────────────────────
CREATE TABLE reviews (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  turf_id               TEXT NOT NULL REFERENCES turfs(id),
  user_id               TEXT NOT NULL REFERENCES users(id),
  booking_id            UUID REFERENCES bookings(id),
  rating                DECIMAL(2,1) NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment               TEXT,
  status                TEXT DEFAULT 'active' CHECK (status IN ('active','flagged','removed')),
  response              TEXT,
  responded_by          TEXT REFERENCES users(id),
  responded_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),

  -- One review per booking
  UNIQUE (booking_id)
);

-- ─────────────────────────────────────────────────────
-- MAINTENANCE LOGS
-- Caretaker reports issues at turfs
-- ─────────────────────────────────────────────────────
CREATE TABLE maintenance_logs (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  turf_id               TEXT NOT NULL REFERENCES turfs(id),
  company_id            TEXT NOT NULL REFERENCES companies(id),
  ground_name           TEXT,
  issue_type            TEXT NOT NULL,
  issue_type_label      TEXT,
  priority              TEXT NOT NULL CHECK (priority IN ('low','medium','high','critical')),
  priority_label        TEXT,
  description           TEXT,
  image_urls            TEXT[],
  status                TEXT DEFAULT 'reported'
                          CHECK (status IN ('reported','in_progress','resolved','rejected')),
  reported_by           TEXT NOT NULL REFERENCES users(id),
  reported_by_name      TEXT,
  resolved_by           TEXT REFERENCES users(id),
  resolved_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────
-- INVITE CODES
-- Manager and caretaker join a company via invite code
-- ─────────────────────────────────────────────────────
CREATE TABLE invite_codes (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code                  TEXT UNIQUE NOT NULL,
  company_id            TEXT NOT NULL REFERENCES companies(id),
  turf_id               TEXT REFERENCES turfs(id),
  role                  TEXT NOT NULL CHECK (role IN ('manager','caretaker')),
  created_by            TEXT NOT NULL REFERENCES users(id),
  used_by               TEXT REFERENCES users(id),
  is_used               BOOLEAN DEFAULT FALSE,
  expires_at            TIMESTAMPTZ,
  used_at               TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);
```

---

### Step 7: Performance Indexes

```sql
-- Bookings — most queried table
CREATE INDEX idx_bookings_turf_date      ON bookings (turf_id, date);
CREATE INDEX idx_bookings_user           ON bookings (user_id);
CREATE INDEX idx_bookings_company        ON bookings (company_id);
CREATE INDEX idx_bookings_status         ON bookings (status);
CREATE INDEX idx_bookings_date           ON bookings (date);

-- Payments
CREATE INDEX idx_payments_booking        ON payments (booking_id);
CREATE INDEX idx_payments_company        ON payments (company_id);
CREATE INDEX idx_payments_status         ON payments (status);

-- Expenses for analytics
CREATE INDEX idx_expenses_company_date   ON expenses (company_id, expense_date);
CREATE INDEX idx_expenses_turf           ON expenses (turf_id);

-- Reviews
CREATE INDEX idx_reviews_turf            ON reviews (turf_id);

-- Maintenance
CREATE INDEX idx_maintenance_turf        ON maintenance_logs (turf_id);
CREATE INDEX idx_maintenance_status      ON maintenance_logs (status);
```

---

### Step 8: Auto-Update Timestamps

```sql
-- Function to auto-update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER trigger_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_turfs_updated_at
  BEFORE UPDATE ON turfs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_maintenance_updated_at
  BEFORE UPDATE ON maintenance_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

### Step 9: Row-Level Security (Database-Level Protection)

```sql
-- Enable RLS on all sensitive tables
ALTER TABLE users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies         ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses          ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews           ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_logs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_codes      ENABLE ROW LEVEL SECURITY;

-- NOTE: All DB writes go through the Express middleware using the
-- service_role key which bypasses RLS.
-- RLS is a second layer of protection for direct Supabase access.

-- Users can only read their own profile via direct access
CREATE POLICY users_own_data ON users
  FOR ALL USING (id = current_setting('app.user_id', true));

-- Bookings visible to the user who made them
CREATE POLICY bookings_user_access ON bookings
  FOR SELECT USING (user_id = current_setting('app.user_id', true));
```

---

## Firestore — What Stays (Do Not Touch)

```
chats/{chatId}                  ← Real-time chat. Keep entirely.
  └── messages/{messageId}      ← Negotiation cards, text messages. Keep entirely.

slot_locks (temporary)          ← 10-min timer. Keep in Firestore.
                                   Delete doc after expiry, no migration needed.
```

**Update existing Firestore rules** (harden before launch):

```javascript
// firestore.rules — replace entire file
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Chats — only participants can read/write
    match /chats/{chatId} {
      allow read, write: if request.auth != null &&
        request.auth.uid in resource.data.participants;

      match /messages/{messageId} {
        allow read, write: if request.auth != null &&
          request.auth.uid in
          get(/databases/$(database)/documents/chats/$(chatId)).data.participants;
      }
    }

    // Slot locks — any authenticated user can read
    // Only Cloud Functions (admin SDK) write to this
    match /slot_locks/{lockId} {
      allow read: if request.auth != null;
      allow write: if false; // only Cloud Functions write this
    }

    // Deny everything else — all other data is in PostgreSQL
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

---

## Database Helper (Dev 2 builds in Week 1)

**Create `functions/src/db/client.js`:**
```javascript
const { createClient } = require("@supabase/supabase-js");
const functions = require("firebase-functions");

let supabase = null;

function getDB() {
  if (!supabase) {
    const url = functions.config().supabase.url;
    const key = functions.config().supabase.service_key;
    supabase = createClient(url, key);
  }
  return supabase;
}

// Generic query helpers used by all routes

async function findById(table, id) {
  const { data, error } = await getDB()
    .from(table)
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

async function insert(table, record) {
  const { data, error } = await getDB()
    .from(table)
    .insert(record)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function update(table, id, updates) {
  const { data, error } = await getDB()
    .from(table)
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function query(table, filters = {}, options = {}) {
  let q = getDB().from(table).select(options.select || "*");
  Object.entries(filters).forEach(([col, val]) => {
    if (Array.isArray(val)) {
      q = q.in(col, val);
    } else {
      q = q.eq(col, val);
    }
  });
  if (options.orderBy) q = q.order(options.orderBy, { ascending: options.ascending ?? true });
  if (options.limit)   q = q.limit(options.limit);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

module.exports = { getDB, findById, insert, update, query };
```

---

## Express Middleware Setup (Dev 1 builds in Week 1)

**`functions/src/api/app.js`:**
```javascript
const express = require("express");
const helmet  = require("helmet");
const cors    = require("cors");
const morgan  = require("morgan");
const { errorHandler }  = require("./middleware/errorHandler");
const { generalLimiter } = require("./middleware/rateLimiter");

const app = express();

app.use(helmet());
app.use(cors({
  origin: [
    "https://sowin-power.web.app",
    "https://sowin-power.firebaseapp.com",
  ],
  methods: ["GET","POST","PUT","DELETE"],
  allowedHeaders: ["Content-Type","Authorization"],
}));
app.use(express.json({ limit: "10kb" }));
app.use(morgan("combined"));
app.use(generalLimiter);

// Block parameter pollution
app.use((req, res, next) => {
  Object.keys(req.query).forEach(k => {
    if (Array.isArray(req.query[k])) req.query[k] = req.query[k][0];
  });
  next();
});

// Block bots
app.use((req, res, next) => {
  const ua = req.headers["user-agent"] || "";
  if (!ua || ua.includes("sqlmap") || ua.includes("nikto")) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
});

app.use("/api/bookings",      require("./routes/bookings"));
app.use("/api/payments",      require("./routes/payments"));
app.use("/api/slots",         require("./routes/slots"));
app.use("/api/users",         require("./routes/users"));
app.use("/api/expenses",      require("./routes/expenses"));
app.use("/api/reviews",       require("./routes/reviews"));
app.use("/api/analytics",     require("./routes/analytics"));
app.use("/api/companies",     require("./routes/companies"));
app.use("/api/turfs",         require("./routes/turfs"));
app.use("/api/subscriptions", require("./routes/subscriptions"));
app.use("/api/maintenance",   require("./routes/maintenance"));

app.get("/api/health", (req, res) =>
  res.json({ status: "ok", timestamp: new Date().toISOString() })
);

app.use((req, res) => res.status(404).json({ error: "Route not found" }));
app.use(errorHandler);

module.exports = app;
```

**Add to bottom of `functions/index.js`:**
```javascript
const app = require("./src/api/app");
exports.api = functions.https.onRequest(app);
```

---

**`functions/src/api/middleware/auth.js`:**
```javascript
const admin = require("firebase-admin");

async function verifyToken(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }
  try {
    const decoded = await admin.auth().verifyIdToken(header.split("Bearer ")[1]);
    req.user = decoded; // { uid, role, email, companyId }
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token. Please log in again." });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({
        error: `Access denied. Requires: ${roles.join(" or ")}`,
      });
    }
    next();
  };
}

module.exports = { verifyToken, requireRole };
```

---

**`functions/src/api/middleware/rateLimiter.js`:**
```javascript
const rateLimit = require("express-rate-limit");

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 100,
  message: { error: "Too many requests. Try again later." },
});

const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 5,
  message: { error: "Too many payment attempts. Wait before retrying." },
});

const bookingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 10,
  message: { error: "Too many booking attempts. Try again later." },
});

module.exports = { generalLimiter, paymentLimiter, bookingLimiter };
```

---

**`functions/src/api/middleware/errorHandler.js`:**
```javascript
function errorHandler(err, req, res, next) {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);

  if (err.code === "23505") // PostgreSQL unique violation
    return res.status(409).json({ error: "Duplicate entry. This record already exists." });

  if (err.code === "23503") // PostgreSQL foreign key violation
    return res.status(400).json({ error: "Referenced record does not exist." });

  if (err.code === "P0001") // PostgreSQL exclusion constraint (double booking)
    return res.status(409).json({ error: "This slot is already booked." });

  const map = {
    validation: [400, err.message],
    not_found:  [404, err.message],
    forbidden:  [403, err.message],
    conflict:   [409, err.message],
  };

  if (map[err.type]) {
    const [status, message] = map[err.type];
    return res.status(status).json({ error: message, fields: err.fields });
  }

  return res.status(500).json({ error: "Something went wrong. Please try again." });
}

function createError(type, message, fields = null) {
  const err = new Error(message);
  err.type = type;
  if (fields) err.fields = fields;
  return err;
}

module.exports = { errorHandler, createError };
```

---

## Mobile App API Client (Dev 3 builds in Week 1)

**Create `src/services/api/client.js`:**
```javascript
import auth from "@react-native-firebase/auth";

// Switch between local emulator and production
const BASE_URL = __DEV__
  ? "http://localhost:5001/sowin-power/us-central1/api"
  : "https://us-central1-sowin-power.cloudfunctions.net/api";

async function request(method, path, body = null) {
  const user = auth().currentUser;
  if (!user) throw new Error("Not authenticated. Please log in.");

  const token = await user.getIdToken();

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : null,
  });

  const data = await res.json();

  if (!res.ok) {
    const err = new Error(data.error || "Request failed");
    err.status = res.status;
    err.fields = data.fields;
    throw err;
  }

  return data;
}

export const api = {
  get:    (path)       => request("GET",    path),
  post:   (path, body) => request("POST",   path, body),
  put:    (path, body) => request("PUT",    path, body),
  delete: (path)       => request("DELETE", path),
};
```

---

## 7-Week Sprint Plan

### Week 1 — Foundation (All 3 Devs Parallel)

**Dev 1 — Backend Lead:**
```
Day 1: Set up functions/src/api/ folder structure
Day 2: Build app.js (Express + all middleware)
Day 3: Build auth.js + rateLimiter.js + errorHandler.js
Day 4: Wire to functions/index.js, local test with emulator
Day 5: Code review with team, fix issues
```

**Dev 2 — Database Engineer:**
```
Day 1: Create Supabase project, set region to Mumbai
Day 2: Run schema Steps 1-4 (users, companies, turfs, grounds, bookings)
Day 3: Run schema Steps 5-7 (payments, subscriptions, operations, indexes)
Day 4: Run Steps 8-9 (triggers, RLS), verify all tables in dashboard
Day 5: Build functions/src/db/client.js, test all helpers
```

**Dev 3 — Mobile Integration:**
```
Day 1: Read all 12 Firebase service files, list every Firestore call
Day 2: Build src/services/api/client.js
Day 3: Set up dev/prod environment switching
Day 4: List all screens that need refactoring (priority order)
Day 5: Refactor first simple screen as proof of concept
```

**End of Week 1 Gate:**
- [ ] `GET /api/health` returns 200
- [ ] Auth middleware rejects requests without token
- [ ] All PostgreSQL tables exist in Supabase dashboard
- [ ] Mobile API client makes one successful authenticated request

---

### Week 2 — Bookings + Slots

**Dev 1:**
```
Day 1-2: Build /api/bookings routes (GET list, GET by id, POST create, PUT cancel)
Day 3-4: Build /api/slots routes (GET availability, POST block, DELETE block)
Day 5:   Build bookingValidators.js (Joi), integration test all routes
```

**Dev 2:**
```
Day 1-2: Write slot conflict check SQL query + test with sample data
Day 3:   Add btree_gist extension for exclusion constraint, verify double-booking prevention
Day 4:   Seed test data (2 companies, 3 turfs, 5 grounds, 10 users)
Day 5:   Write booking_history trigger (auto-insert on status change)
```

```sql
-- Auto-insert booking history on status change (Dev 2 writes this)
CREATE OR REPLACE FUNCTION log_booking_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO booking_history (booking_id, status, changed_at)
    VALUES (NEW.id, NEW.status, NOW());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_booking_history
  AFTER UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION log_booking_status_change();
```

**Dev 3:**
```
Day 1-2: Refactor BookingScreen.js → use api.get('/slots/availability?...')
Day 3-4: Refactor BookingsScreen.js → use api.get('/bookings?turfId=...')
Day 5:   Test full booking flow on Android device
```

**End of Week 2 Gate:**
- [ ] Booking creation fails if slot is taken (DB constraint tested)
- [ ] Slot availability endpoint returns correct result
- [ ] BookingScreen uses API, not Firestore directly

---

### Week 3 — Payments

**Dev 1:**
```
Day 1-2: Build POST /api/payments/submit
         - transaction ID format validation
         - booking ownership check
         - duplicate txn check (DB unique index)
         - status transition validation
Day 3-4: Build PUT /api/payments/:id/verify
         Build PUT /api/payments/:id/reject
Day 5:   Build paymentValidators.js, test all payment routes
```

**Dev 2:**
```
Day 1-2: Set up fraud prevention queries
         - consecutive rejection counter
         - auto-ban after 3 rejections
         - company-level verified transactions check
Day 3-4: Verify UNIQUE constraint on (company_id, transaction_id)
         Test duplicate transaction rejection at DB level
Day 5:   Set up daily automated Supabase backup
         (Supabase Dashboard → Settings → Backups → Enable)
```

**Dev 3:**
```
Day 1-2: Refactor PaymentConfirmationScreen.js
         → uploadPaymentProof() still uses Firebase Storage
         → submitPaymentForVerification() → api.post('/payments/submit')
Day 3-4: Refactor VerifyPaymentScreen.js (manager side)
         → api.put('/payments/:id/verify')
Day 5:   Full payment flow test: submit → verify → confirmed
```

**End of Week 3 Gate:**
- [ ] Payment submission saves to PostgreSQL
- [ ] Duplicate transaction ID rejected at DB level
- [ ] Manager payment verification works through API
- [ ] Payment screenshot still saves to Firebase Storage (unchanged)

---

### Week 4 — Analytics, Expenses, Reviews, Companies, Turfs

**Dev 1:**
```
Day 1: Build /api/analytics routes (revenue, bookings count, occupancy)
Day 2: Build /api/expenses routes (CRUD)
Day 3: Build /api/reviews routes (add, list, respond)
Day 4: Build /api/companies + /api/turfs routes
Day 5: Build /api/maintenance routes
```

**Key analytics SQL queries for Dev 1:**
```javascript
// Monthly revenue per turf
const { data } = await getDB().rpc('monthly_revenue', {
  p_company_id: companyId,
  p_month: '2025-01'
});

// Create this function in Supabase SQL Editor (Dev 2):
```

```sql
-- Dev 2 creates these analytics functions
CREATE OR REPLACE FUNCTION monthly_revenue(p_company_id TEXT, p_month TEXT)
RETURNS TABLE (turf_id TEXT, turf_name TEXT, revenue DECIMAL, booking_count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.turf_id,
    t.name,
    COALESCE(SUM(p.amount), 0) as revenue,
    COUNT(b.id) as booking_count
  FROM bookings b
  JOIN turfs t ON t.id = b.turf_id
  LEFT JOIN payments p ON p.booking_id = b.id AND p.status = 'verified'
  WHERE b.company_id = p_company_id
    AND TO_CHAR(b.date, 'YYYY-MM') = p_month
    AND b.status IN ('confirmed','completed')
  GROUP BY b.turf_id, t.name;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION occupancy_rate(p_turf_id TEXT, p_date DATE)
RETURNS DECIMAL AS $$
DECLARE
  total_slots INTEGER := 14; -- 7am-9pm = 14 hours
  booked_slots INTEGER;
BEGIN
  SELECT COUNT(*) INTO booked_slots
  FROM bookings
  WHERE turf_id = p_turf_id
    AND date = p_date
    AND status IN ('confirmed','in_progress','completed');
  RETURN ROUND((booked_slots::DECIMAL / total_slots) * 100, 2);
END;
$$ LANGUAGE plpgsql;
```

**Dev 2:**
```
Day 1-2: Write analytics SQL functions (monthly_revenue, occupancy_rate, top_users)
Day 3-4: Write expense aggregation queries
Day 5:   Performance test all queries with 10,000 rows of seed data
```

**Dev 3:**
```
Day 1-2: Refactor OwnerAnalyticsDashboardScreen.js + AnalyticsDashboardScreen.js
Day 3:   Refactor ExpenseTrackingScreen.js
Day 4:   Refactor ReviewManagementScreen.js
Day 5:   Refactor TurfManagementScreen.js + AddTurfScreen.js
```

**End of Week 4 Gate:**
- [ ] Analytics dashboard shows data from PostgreSQL
- [ ] Expense tracking works through API
- [ ] Feature parity: every screen that was using Firestore now uses API

---

### Week 5 — Hardening & Testing

**Dev 1:**
```
Day 1-2: Write integration tests for all 40+ endpoints
Day 3:   Load test with artillery (simulate 100 concurrent users)
Day 4:   Fix all issues found in testing
Day 5:   Security audit — verify no route missing auth middleware
```

**Load test script:**
```yaml
# artillery-test.yml
config:
  target: "http://localhost:5001/sowin-power/us-central1/api"
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Warm up"
    - duration: 120
      arrivalRate: 100
      name: "Peak load"

scenarios:
  - name: "Check slot availability"
    requests:
      - get:
          url: "/api/slots/availability?turfId=test&groundId=g1&date=2025-06-01&startTime=10:00&endTime=12:00"
          headers:
            Authorization: "Bearer {{ $processEnvironment.TEST_TOKEN }}"
```

**Dev 2:**
```
Day 1:   Verify all foreign keys are enforced (try inserting orphan records)
Day 2:   Verify double-booking exclusion constraint (concurrent booking test)
Day 3:   Backup restore drill (restore to test project, verify data)
Day 4:   Set up Supabase alerts (email on DB errors, slow queries)
Day 5:   Document all environment variables and secrets
```

**Dev 3:**
```
Day 1-3: Full end-to-end testing across all 5 roles on real Android device
         Role: user → search → book → pay → receive confirmation
         Role: manager → view bookings → verify payment
         Role: owner → view analytics → manage team
         Role: caretaker → log maintenance issue
         Role: admin → view all companies
Day 4:   Fix all UI issues found in testing
Day 5:   Test on 3 different Android versions (Android 10, 12, 14)
```

**End of Week 5 Gate:**
- [ ] All 40+ endpoints tested and passing
- [ ] Load test: 100 concurrent users with < 500ms response time
- [ ] Zero P0 (crash) or P1 (data loss) bugs
- [ ] Backup restore works correctly

---

### Week 6 — Deployment

**Dev 1 (Monday–Tuesday):**
```bash
# Deploy Cloud Functions (middleware)
cd functions
npm run deploy

# Verify
curl https://us-central1-sowin-power.cloudfunctions.net/api/api/health
```

**Dev 2 (Monday–Tuesday):**
```bash
# Supabase is already live (it's cloud-hosted)
# Switch from free tier to Pro if needed for production
# Supabase Dashboard → Settings → Billing → Upgrade

# Verify all tables exist in production
supabase db dump --db-url postgresql://...

# Enable point-in-time recovery (Pro feature — worth it for real data)
# Supabase Dashboard → Settings → Backups → Enable PITR
```

**Dev 3 (Monday–Wednesday):**
```bash
# Build production APK
npx expo run:android --variant release

# Install on test devices
adb install -r build/app-release.apk
```

**Wednesday — All Team:**
```
Full team smoke test:
1. Install fresh build on 2 Android devices
2. Register as new owner (not using existing test accounts)
3. Create a company and add a turf
4. Book a slot as a user
5. Submit payment
6. Verify as manager
7. Check analytics dashboard
8. Report maintenance issue as caretaker
```

**Thursday–Friday:**
```
Onboard first 2–3 real turf owners (controlled)
Monitor Firebase Functions logs every 2 hours
Monitor Supabase Dashboard → Query Performance
Have all 3 devs on WhatsApp ready to fix issues immediately
```

---

### Week 7 — Buffer + Stabilization

```
This week is reserved for:
- Issues discovered by real owners
- Performance optimizations based on real usage patterns
- Edge cases not caught in testing
- Onboarding 5–10 more owners
```

---

## Data Migration (From Existing Firestore to PostgreSQL)

> IMPORTANT: Since you have NO live users yet, this is a one-time
> script run, not a live migration. This is the easiest possible migration.

**Dev 2 owns this — run at end of Week 4:**

**Create `scripts/migrate-firestore-to-postgres.js`:**
```javascript
const admin = require("firebase-admin");
const { createClient } = require("@supabase/supabase-js");

// Initialize
const serviceAccount = require("./serviceAccountKey.json");
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db = admin.firestore();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// ─── Migrate Users ───────────────────────────────────────
async function migrateUsers() {
  console.log("Migrating users...");
  const snapshot = await db.collection("users").get();

  for (const doc of snapshot.docs) {
    const d = doc.data();
    const { error } = await supabase.from("users").upsert({
      id:         doc.id,
      name:       d.name || d.displayName || "Unknown",
      phone:      d.phone || d.phoneNumber || "",
      email:      d.email || null,
      role:       d.role || "user",
      company_id: d.companyId || null,
      avatar_url: d.avatar || d.avatarUrl || null,
      fcm_token:  d.fcmToken || null,
      is_active:  d.isActive !== false,
      created_at: d.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    });
    if (error) console.error(`User ${doc.id}:`, error.message);
  }
  console.log(`✓ Migrated ${snapshot.size} users`);
}

// ─── Migrate Companies ───────────────────────────────────
async function migrateCompanies() {
  console.log("Migrating companies...");
  const snapshot = await db.collection("companies").get();

  for (const doc of snapshot.docs) {
    const d = doc.data();
    const { error } = await supabase.from("companies").upsert({
      id:                   doc.id,
      name:                 d.name || "Unknown Company",
      owner_id:             d.ownerId || d.owner_id,
      phone:                d.phone || null,
      upi_id:               d.upiId || d.upi_id || null,
      upi_holder_name:      d.upiHolderName || null,
      subscription_status:  d.subscriptionStatus || "inactive",
      is_active:            d.isActive !== false,
      created_at:           d.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    });
    if (error) console.error(`Company ${doc.id}:`, error.message);
  }
  console.log(`✓ Migrated ${snapshot.size} companies`);
}

// ─── Migrate Turfs ───────────────────────────────────────
async function migrateTurfs() {
  console.log("Migrating turfs...");
  const snapshot = await db.collection("turfs").get();

  for (const doc of snapshot.docs) {
    const d = doc.data();

    // Insert turf
    const { error: turfError } = await supabase.from("turfs").upsert({
      id:           doc.id,
      company_id:   d.companyId,
      name:         d.name,
      description:  d.description || null,
      address:      d.address || null,
      city:         d.city || null,
      sports:       d.sports || [],
      amenities:    d.amenities || [],
      cover_image_url: d.coverImage || d.imageUrl || null,
      is_active:    d.isActive !== false,
      rating:       d.rating || 0,
      total_reviews: d.totalReviews || 0,
      payment_timing: d.paymentTiming || "before_approval",
      created_at:   d.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    });
    if (turfError) { console.error(`Turf ${doc.id}:`, turfError.message); continue; }

    // Insert each ground within the turf
    const grounds = d.grounds || [];
    for (const g of grounds) {
      const { error: groundError } = await supabase.from("grounds").upsert({
        id:             g.id || g.groundId,
        turf_id:        doc.id,
        name:           g.name || g.groundName,
        sport:          g.sport || null,
        price_per_hour: g.pricePerHour || g.price || 0,
        advance_amount: g.advanceAmount || 0,
        capacity:       g.capacity || null,
        surface_type:   g.surfaceType || null,
        is_active:      g.isActive !== false,
      });
      if (groundError) console.error(`Ground ${g.id}:`, groundError.message);
    }
  }
  console.log(`✓ Migrated ${snapshot.size} turfs`);
}

// ─── Migrate Bookings ────────────────────────────────────
async function migrateBookings() {
  console.log("Migrating bookings...");
  const snapshot = await db.collection("bookings").get();
  let success = 0, failed = 0;

  for (const doc of snapshot.docs) {
    const d = doc.data();

    // Insert booking
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .upsert({
        id:               doc.id,   // keep Firestore ID for reference
        user_id:          d.userId,
        turf_id:          d.turfId,
        ground_id:        d.groundId?.replace(/-/g, "_"),  // normalize
        company_id:       d.companyId,
        date:             d.date,
        start_time:       d.startTime,
        end_time:         d.endTime,
        total_amount:     d.totalAmount || 0,
        advance_amount:   d.payment?.advanceAmount || 0,
        status:           d.status,
        created_at:       d.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        updated_at:       d.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      })
      .select()
      .single();

    if (bookingError) {
      console.error(`Booking ${doc.id}:`, bookingError.message);
      failed++;
      continue;
    }

    // Migrate payment record
    if (d.payment?.advance) {
      const p = d.payment.advance;
      await supabase.from("payments").upsert({
        booking_id:       booking.id,
        company_id:       d.companyId,
        transaction_id:   p.upiDetails?.transactionId || null,
        screenshot_url:   p.upiDetails?.screenshotUrl || null,
        amount:           p.upiDetails?.amount || d.payment?.advanceAmount || 0,
        paid_to_upi_id:   p.upiDetails?.paidToUpiId || null,
        status:           p.status || "pending",
        submitted_at:     p.submittedAt ? new Date(p.submittedAt).toISOString() : null,
        verified_by:      p.verification?.verifiedBy || null,
        verified_at:      p.verification?.verifiedAt
                          ? new Date(p.verification.verifiedAt).toISOString() : null,
      });
    }

    // Migrate status history
    const history = d.statusHistory || [];
    for (const h of history) {
      await supabase.from("booking_history").insert({
        booking_id:     booking.id,
        status:         h.status,
        changed_by:     h.changedBy !== "system" ? h.changedBy : null,
        changed_by_role: h.changedByRole || null,
        reason:         h.reason || null,
        changed_at:     h.timestamp ? new Date(h.timestamp).toISOString() : new Date().toISOString(),
      });
    }

    success++;
  }
  console.log(`✓ Migrated ${success} bookings (${failed} failed)`);
}

// ─── Migrate Reviews ─────────────────────────────────────
async function migrateReviews() {
  console.log("Migrating reviews...");
  const snapshot = await db.collection("reviews").get();
  for (const doc of snapshot.docs) {
    const d = doc.data();
    const { error } = await supabase.from("reviews").upsert({
      id:           doc.id,
      turf_id:      d.turfId,
      user_id:      d.userId,
      booking_id:   d.bookingId || null,
      rating:       d.rating,
      comment:      d.comment || null,
      status:       d.status || "active",
      created_at:   d.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    });
    if (error) console.error(`Review ${doc.id}:`, error.message);
  }
  console.log(`✓ Migrated ${snapshot.size} reviews`);
}

// ─── Migrate Expenses ────────────────────────────────────
async function migrateExpenses() {
  console.log("Migrating expenses...");
  const snapshot = await db.collection("expenses").get();
  for (const doc of snapshot.docs) {
    const d = doc.data();
    const { error } = await supabase.from("expenses").upsert({
      id:           doc.id,
      company_id:   d.companyId,
      turf_id:      d.turfId,
      category:     d.category,
      amount:       d.amount,
      description:  d.description || null,
      receipt_urls: d.receiptUrls || [],
      added_by:     d.addedBy,
      added_by_role: d.addedByRole || null,
      expense_date: d.date || new Date().toISOString().split("T")[0],
      created_at:   d.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    });
    if (error) console.error(`Expense ${doc.id}:`, error.message);
  }
  console.log(`✓ Migrated ${snapshot.size} expenses`);
}

// ─── Run Migration ───────────────────────────────────────
async function runMigration() {
  console.log("Starting Firestore → PostgreSQL migration...\n");
  console.log("Order matters — do NOT change the sequence (foreign key dependencies)");
  console.log("────────────────────────────────────────────────────────────────\n");

  await migrateUsers();        // Must be first (other tables reference users)
  await migrateCompanies();    // Must be before turfs
  await migrateTurfs();        // Must be before bookings
  await migrateBookings();     // Must be after users + companies + turfs
  await migrateReviews();      // Must be after bookings
  await migrateExpenses();     // Must be after companies + turfs

  console.log("\n────────────────────────────────────────────────────────────────");
  console.log("Migration complete.");
  console.log("Run verification queries in Supabase dashboard to confirm counts.");
}

runMigration().catch(console.error);
```

**Run migration:**
```bash
# Dry run first — just logs, no writes
node scripts/migrate-firestore-to-postgres.js --dry-run

# Real run
SUPABASE_URL=xxx SUPABASE_SERVICE_KEY=xxx node scripts/migrate-firestore-to-postgres.js
```

**Verify after migration:**
```sql
-- Run in Supabase SQL Editor to verify counts match Firestore
SELECT 'users'     as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'companies',               COUNT(*) FROM companies
UNION ALL
SELECT 'turfs',                   COUNT(*) FROM turfs
UNION ALL
SELECT 'bookings',                COUNT(*) FROM bookings
UNION ALL
SELECT 'payments',                COUNT(*) FROM payments
UNION ALL
SELECT 'reviews',                 COUNT(*) FROM reviews
UNION ALL
SELECT 'expenses',                COUNT(*) FROM expenses;
```

---

## API Endpoint Reference (Complete)

| Method | Endpoint | Role Access | PostgreSQL Table |
|--------|----------|-------------|-----------------|
| GET | /api/health | Public | — |
| GET | /api/users/profile | Self | users |
| PUT | /api/users/profile | Self | users |
| GET | /api/companies/:id | Staff | companies |
| POST | /api/companies | Owner | companies |
| GET | /api/turfs | All | turfs |
| GET | /api/turfs/:id | All | turfs, grounds |
| POST | /api/turfs | Owner | turfs |
| PUT | /api/turfs/:id | Manager, Owner | turfs |
| GET | /api/bookings | Manager, Owner, Admin | bookings |
| GET | /api/bookings/:id | Owner or Staff | bookings |
| POST | /api/bookings | User | bookings |
| PUT | /api/bookings/:id/cancel | Owner or Admin | bookings |
| POST | /api/payments/submit | User | payments |
| PUT | /api/payments/:id/verify | Manager, Owner, Admin | payments |
| PUT | /api/payments/:id/reject | Manager, Owner, Admin | payments |
| GET | /api/slots/availability | All | bookings |
| POST | /api/slots/block | Manager, Owner | blocked_slots |
| DELETE | /api/slots/block/:id | Manager, Owner | blocked_slots |
| GET | /api/expenses | Manager, Owner | expenses |
| POST | /api/expenses | Manager, Owner, Caretaker | expenses |
| GET | /api/reviews?turfId= | All | reviews |
| POST | /api/reviews | User | reviews |
| PUT | /api/reviews/:id/respond | Manager, Owner | reviews |
| GET | /api/analytics/revenue | Manager, Owner | bookings, payments |
| GET | /api/analytics/occupancy | Manager, Owner | bookings |
| GET | /api/maintenance | Manager, Owner | maintenance_logs |
| POST | /api/maintenance | Caretaker, Staff | maintenance_logs |
| PUT | /api/maintenance/:id | Manager, Owner | maintenance_logs |
| GET | /api/subscriptions | Owner, Admin | subscriptions |
| POST | /api/subscriptions/initiate | Owner | subscriptions |
| PUT | /api/subscriptions/:id/verify | Admin | subscriptions |

---

## Security Checklist

| # | Layer | Measure | Status |
|---|-------|---------|--------|
| 1 | Network | CORS restricted to app domain | Week 1 |
| 2 | Network | HTTPS only (Firebase enforces this) | Week 1 |
| 3 | Request | Helmet security headers | Week 1 |
| 4 | Request | Request body size limit 10kb | Week 1 |
| 5 | Request | Bot/scanner detection | Week 1 |
| 6 | Auth | Firebase token on every request | Week 1 |
| 7 | Auth | Role-based access control | Week 1 |
| 8 | Rate | General: 100 req / 15 min | Week 1 |
| 9 | Rate | Payment: 5 req / 15 min | Week 1 |
| 10 | Rate | Booking: 10 req / hour | Week 1 |
| 11 | Input | Joi validation on all POST/PUT | Week 2 |
| 12 | Input | Parameter pollution prevention | Week 1 |
| 13 | Data | Duplicate transaction ID at DB level | Week 3 |
| 14 | Data | Double booking exclusion constraint | Week 2 |
| 15 | Data | Foreign key constraints | Week 1 |
| 16 | Data | Booking ownership check before payment | Week 3 |
| 17 | DB | Row-Level Security on all tables | Week 1 |
| 18 | DB | Auto daily backups (Supabase) | Week 3 |
| 19 | Firestore | Deny-all rules (except chat) | Week 5 |
| 20 | Error | Centralized handler (no leak) | Week 1 |

---

## What Firebase Handles (Permanent — Never Migrate)

| Feature | Firebase Service | Why Keep |
|---------|-----------------|----------|
| Login + OTP | Firebase Auth | Phone OTP works perfectly, token works with middleware |
| Real-time chat | Firestore (chats collection) | `onSnapshot` = instant, no polling |
| Negotiation cards | Firestore (messages subcollection) | Real-time state changes |
| Push notifications | FCM | Native Android/iOS integration |
| Payment screenshots | Firebase Storage | Already working, linked by URL in PostgreSQL |
| Turf images | Firebase Storage | Same |
| Slot lock timer | Firestore (slot_locks) | Temporary data, no history needed |

---

## Environment Variables Summary

```bash
# Firebase Functions config
firebase functions:config:set \
  supabase.url="https://xxxx.supabase.co" \
  supabase.service_key="service_role_key_here"

# Mobile app (.env.local)
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=anon_key_here
API_BASE_URL=https://us-central1-sowin-power.cloudfunctions.net/api
API_BASE_URL_DEV=http://localhost:5001/sowin-power/us-central1/api
```

---

## Daily Standup Template

```
Date: ___________

Dev 1 (Backend):
  Yesterday: _______________
  Today: _______________
  Blocker: _______________

Dev 2 (Database):
  Yesterday: _______________
  Today: _______________
  Blocker: _______________

Dev 3 (Mobile):
  Yesterday: _______________
  Today: _______________
  Blocker: _______________

Week gate check: Pass / Fail
```

---

## Week-by-Week Gate Summary

| Week | Gate Criteria |
|------|--------------|
| 1 | Health endpoint live, schema in Supabase, API client working |
| 2 | Booking flow end-to-end through API + PostgreSQL |
| 3 | Payment flow end-to-end, duplicate txn rejected at DB level |
| 4 | Feature parity — all screens off Firestore (except chat) |
| 5 | Load test passed, zero P0 bugs, backup restore tested |
| 6 | Deployed to production, first real owner onboarded |
| 7 | 5–10 owners onboarded, all issues from real usage fixed |
