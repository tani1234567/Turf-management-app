# Turf-1701 Middleware Implementation Plan
**Timeline:** 1 Month | **Goal:** Secure REST API + Production Deploy

---

## Decision: Express.js on Firebase Cloud Functions

### Why Not Spring Boot
| Reason | Detail |
|--------|--------|
| Language switch | Spring Boot needs Java/Kotlin — your entire codebase is JavaScript |
| Timeline risk | Learning Java + Spring in 1 month is too risky alongside building features |
| Hosting cost | Spring Boot needs a separate server (Railway/GCP = $5–20/month) during testing |
| Cold starts | Spring Boot cold starts take 3–5s vs Express 500ms |
| Firebase integration | Firebase Admin SDK works natively and easily in Node.js |

### Why Express.js on Firebase Functions
| Reason | Detail |
|--------|--------|
| Same language | JavaScript — no context switching, same team, same codebase |
| Already set up | `functions/` directory already exists and is deployed |
| No extra hosting | Runs on Firebase — pay per request, free tier is generous |
| Security | helmet, cors, rate limiting, input validation — all available as npm packages |
| Auth | Firebase Admin SDK verifies tokens natively in 2 lines of code |
| Scalability | Auto-scales with Firebase infrastructure |
| Timeline | Week 1 foundation ready — realistic in 1 month |

---

## Architecture Overview

```
Mobile App (React Native + Expo)
            │
            │  HTTP requests with Firebase Auth token
            ▼
┌───────────────────────────────────────┐
│     REST API (Express.js)             │
│     Firebase Cloud Functions          │
│                                       │
│  ┌─────────────────────────────────┐  │
│  │  Security Middleware Layer      │  │
│  │  - helmet (security headers)    │  │
│  │  - cors (allowed origins)       │  │
│  │  - rate limiter (per IP/user)   │  │
│  │  - auth (Firebase token verify) │  │
│  │  - input validator (Joi)        │  │
│  │  - error handler (centralized)  │  │
│  └─────────────────────────────────┘  │
│                                       │
│  ┌─────────────────────────────────┐  │
│  │  Route Layer                    │  │
│  │  POST /api/bookings             │  │
│  │  GET  /api/bookings/:id         │  │
│  │  POST /api/payments/submit      │  │
│  │  PUT  /api/payments/:id/verify  │  │
│  │  GET  /api/slots/availability   │  │
│  │  POST /api/slots/block          │  │
│  │  GET  /api/users/profile        │  │
│  └─────────────────────────────────┘  │
└───────────────────────────────────────┘
            │
            ▼
┌───────────────────────────────────────┐
│     Firebase Backend                  │
│  ┌──────────┐  ┌──────────────────┐   │
│  │Firestore │  │ Firebase Auth    │   │
│  │(Database)│  │ (Authentication) │   │
│  └──────────┘  └──────────────────┘   │
│  ┌──────────────────────────────────┐  │
│  │ Firebase Storage (Images/Files) │  │
│  └──────────────────────────────────┘  │
└───────────────────────────────────────┘
```

---

## Folder Structure (Final State)

```
functions/
├── index.js                          ← Add: exports.api = functions.https.onRequest(app)
├── package.json                      ← Add new dependencies
└── src/
    ├── api/                          ← NEW: entire middleware layer lives here
    │   ├── app.js                    ← Express app setup, middleware, routes
    │   ├── middleware/
    │   │   ├── auth.js               ← Firebase token verification + role check
    │   │   ├── rateLimiter.js        ← Rate limits per endpoint type
    │   │   ├── validate.js           ← Reusable validation runner
    │   │   └── errorHandler.js       ← Centralized error responses
    │   ├── routes/
    │   │   ├── bookings.js           ← Booking CRUD endpoints
    │   │   ├── payments.js           ← Payment submit + verify endpoints
    │   │   ├── slots.js              ← Slot availability + block endpoints
    │   │   └── users.js              ← User profile endpoints
    │   └── validators/
    │       ├── bookingValidators.js  ← Booking input rules
    │       └── paymentValidators.js  ← Payment input rules
    ├── slotLockFunctions.js          ← Existing (keep as-is)
    ├── paymentFunctions.js           ← Existing (keep as-is)
    ├── bookingNotificationFunctions.js ← Existing (keep as-is)
    └── helpers/
        └── notificationHelpers.js   ← Existing (keep as-is)

src/
└── services/
    └── api/                         ← NEW: mobile app API client
        └── client.js                ← Single fetch wrapper with auto-auth token
```

---

## Week 1: Foundation & Security Core (Days 1–7)

### Day 1–2: Install Dependencies & Set Up Express App

**Run in `functions/` directory:**
```bash
cd functions
npm install express helmet cors express-rate-limit express-validator morgan
```

**Create `functions/src/api/app.js`:**
```javascript
const express = require("express");
const helmet  = require("helmet");
const cors    = require("cors");
const morgan  = require("morgan");
const { errorHandler } = require("./middleware/errorHandler");
const { generalLimiter } = require("./middleware/rateLimiter");

const bookingRoutes = require("./routes/bookings");
const paymentRoutes = require("./routes/payments");
const slotRoutes    = require("./routes/slots");
const userRoutes    = require("./routes/users");

const app = express();

// 1. Security headers (prevents XSS, clickjacking, sniffing)
app.use(helmet());

// 2. CORS — only allow your app origins
app.use(cors({
  origin: [
    "https://sowin-power.web.app",
    "https://sowin-power.firebaseapp.com",
  ],
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// 3. Parse JSON — block payloads over 10kb
app.use(express.json({ limit: "10kb" }));

// 4. Request logging
app.use(morgan("combined"));

// 5. General rate limit on all routes
app.use(generalLimiter);

// 6. Block parameter pollution (arrays in query params)
app.use((req, res, next) => {
  Object.keys(req.query).forEach(key => {
    if (Array.isArray(req.query[key])) {
      req.query[key] = req.query[key][0];
    }
  });
  next();
});

// 7. Block suspicious bots
app.use((req, res, next) => {
  const ua = req.headers["user-agent"] || "";
  if (!ua || ua.includes("sqlmap") || ua.includes("nikto")) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
});

// Routes
app.use("/api/bookings", bookingRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/slots",    slotRoutes);
app.use("/api/users",    userRoutes);

// Health check
app.get("/api/health", (req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

// 404
app.use((req, res) => res.status(404).json({ error: "Route not found" }));

// Central error handler (must be last)
app.use(errorHandler);

module.exports = app;
```

**Add to bottom of `functions/index.js`:**
```javascript
// REST API
const app = require("./src/api/app");
exports.api = functions.https.onRequest(app);
```

---

### Day 3–4: Auth Middleware

**Create `functions/src/api/middleware/auth.js`:**
```javascript
const admin = require("firebase-admin");

/**
 * Verify Firebase ID token on every request.
 * Attaches decoded user to req.user = { uid, role, email, ... }
 */
async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split("Bearer ")[1];

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    console.error("[Auth] Token verification failed:", error.message);
    return res.status(401).json({ error: "Invalid or expired token. Please log in again." });
  }
}

/**
 * Role-based access control.
 * Usage: requireRole("manager") or requireRole("owner", "admin")
 */
function requireRole(...roles) {
  return (req, res, next) => {
    const userRole = req.user?.role;
    if (!roles.includes(userRole)) {
      return res.status(403).json({
        error: `Access denied. This action requires: ${roles.join(" or ")}`,
      });
    }
    next();
  };
}

module.exports = { verifyToken, requireRole };
```

---

### Day 5: Rate Limiter

**Create `functions/src/api/middleware/rateLimiter.js`:**
```javascript
const rateLimit = require("express-rate-limit");

// General: 100 requests per 15 minutes per IP
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Payment: 5 attempts per 15 minutes per IP (strict)
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "Too many payment attempts. Please wait before trying again." },
});

// Booking creation: 10 per hour per IP
const bookingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: "Too many booking attempts. Please try again in an hour." },
});

// Auth-sensitive: 3 per 10 minutes (e.g. role changes, admin actions)
const strictLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 3,
  message: { error: "Too many requests for this action. Please wait." },
});

module.exports = { generalLimiter, paymentLimiter, bookingLimiter, strictLimiter };
```

---

### Day 6–7: Error Handler & Centralized Responses

**Create `functions/src/api/middleware/errorHandler.js`:**
```javascript
/**
 * Centralized error handler.
 * Never expose internal error details to clients.
 */
function errorHandler(err, req, res, next) {
  // Always log full error server-side
  console.error(`[ERROR] ${req.method} ${req.path} — ${err.message}`, err.stack);

  // Validation errors
  if (err.type === "validation") {
    return res.status(400).json({ error: err.message, fields: err.fields || [] });
  }

  // Not found
  if (err.type === "not_found") {
    return res.status(404).json({ error: err.message });
  }

  // Forbidden
  if (err.type === "forbidden") {
    return res.status(403).json({ error: err.message });
  }

  // Conflict (e.g. slot already booked)
  if (err.type === "conflict") {
    return res.status(409).json({ error: err.message });
  }

  // Firebase permission denied
  if (err.code === "permission-denied") {
    return res.status(403).json({ error: "Permission denied." });
  }

  // Firebase not found
  if (err.code === "not-found") {
    return res.status(404).json({ error: "Resource not found." });
  }

  // Default — never expose stack traces or internal messages
  return res.status(500).json({ error: "Something went wrong. Please try again." });
}

/**
 * Helper to create typed errors in routes.
 * Usage: throw createError("not_found", "Booking not found")
 */
function createError(type, message, fields = null) {
  const err = new Error(message);
  err.type = type;
  if (fields) err.fields = fields;
  return err;
}

module.exports = { errorHandler, createError };
```

---

## Week 2: Core API Routes (Days 8–14)

### Day 8–9: Booking Routes

**Create `functions/src/api/routes/bookings.js`:**
```javascript
const router = require("express").Router();
const admin  = require("firebase-admin");
const { verifyToken, requireRole } = require("../middleware/auth");
const { bookingLimiter } = require("../middleware/rateLimiter");
const { createError } = require("../middleware/errorHandler");
const { validateCreateBooking } = require("../validators/bookingValidators");

const db = admin.firestore();

// All booking routes require valid auth token
router.use(verifyToken);

// ─────────────────────────────────────────────────────────────
// GET /api/bookings/:id — Get single booking
// Access: the user who booked, or manager/owner of that turf, or admin
// ─────────────────────────────────────────────────────────────
router.get("/:id", async (req, res, next) => {
  try {
    const doc = await db.collection("bookings").doc(req.params.id).get();
    if (!doc.exists) return next(createError("not_found", "Booking not found"));

    const booking = doc.data();
    const { uid, role } = req.user;

    const isAuthorized =
      role === "admin" ||
      booking.userId === uid ||
      (["manager", "owner"].includes(role) && booking.companyId === req.user.companyId);

    if (!isAuthorized) return next(createError("forbidden", "You do not have access to this booking"));

    res.json({ id: doc.id, ...booking });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────
// GET /api/bookings?turfId=xxx&date=YYYY-MM-DD&status=xxx
// Access: manager, owner, admin only
// ─────────────────────────────────────────────────────────────
router.get("/", requireRole("manager", "owner", "admin"), async (req, res, next) => {
  try {
    const { turfId, date, status } = req.query;

    if (!turfId) return res.status(400).json({ error: "turfId query param is required" });

    let query = db.collection("bookings").where("turfId", "==", turfId);
    if (date)   query = query.where("date", "==", date);
    if (status) query = query.where("status", "==", status);

    const snapshot = await query.get();
    const bookings = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    res.json({ bookings, count: bookings.length });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────
// POST /api/bookings — Create new booking
// Access: user role only
// ─────────────────────────────────────────────────────────────
router.post("/", bookingLimiter, requireRole("user"), validateCreateBooking, async (req, res, next) => {
  try {
    const { turfId, groundId, date, startTime, endTime, amount } = req.body;

    // Server-side slot conflict check (cannot trust client)
    const conflicts = await db.collection("bookings")
      .where("turfId", "==", turfId)
      .where("date", "==", date)
      .where("status", "in", ["confirmed", "in_progress", "awaiting_payment", "payment_submitted"])
      .get();

    const hasConflict = conflicts.docs.some(d => {
      const b = d.data();
      const sameGround = b.groundId === groundId;
      const timeOverlap = b.startTime < endTime && b.endTime > startTime;
      return sameGround && timeOverlap;
    });

    if (hasConflict) return next(createError("conflict", "This slot is no longer available. Please choose a different time."));

    // Date must not be in the past
    const today = new Date().toISOString().split("T")[0];
    if (date < today) return res.status(400).json({ error: "Cannot book a slot in the past" });

    const booking = {
      userId: req.user.uid,
      turfId,
      groundId,
      date,
      startTime,
      endTime,
      totalAmount: amount,
      status: "pending_payment",
      slotLock: { isLocked: false },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const ref = await db.collection("bookings").add(booking);
    res.status(201).json({ id: ref.id, message: "Booking created", status: "pending_payment" });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────
// PUT /api/bookings/:id/cancel — Cancel a booking
// Access: the user who booked, or admin
// ─────────────────────────────────────────────────────────────
router.put("/:id/cancel", async (req, res, next) => {
  try {
    const doc = await db.collection("bookings").doc(req.params.id).get();
    if (!doc.exists) return next(createError("not_found", "Booking not found"));

    const booking = doc.data();

    if (booking.userId !== req.user.uid && req.user.role !== "admin") {
      return next(createError("forbidden", "You can only cancel your own bookings"));
    }

    if (["in_progress", "completed"].includes(booking.status)) {
      return res.status(400).json({ error: "Cannot cancel a booking that is already in progress or completed" });
    }

    await doc.ref.update({
      status: "cancelled",
      "slotLock.isLocked": false,
      cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
      cancelledBy: req.user.uid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ success: true, message: "Booking cancelled successfully" });
  } catch (err) { next(err); }
});

module.exports = router;
```

---

### Day 10–11: Payment Routes

**Create `functions/src/api/routes/payments.js`:**
```javascript
const router = require("express").Router();
const admin  = require("firebase-admin");
const { verifyToken, requireRole } = require("../middleware/auth");
const { paymentLimiter } = require("../middleware/rateLimiter");
const { createError } = require("../middleware/errorHandler");

const db = admin.firestore();
router.use(verifyToken);

// ─────────────────────────────────────────────────────────────
// POST /api/payments/submit — User submits payment proof
// Access: user role only
// ─────────────────────────────────────────────────────────────
router.post("/submit", paymentLimiter, requireRole("user"), async (req, res, next) => {
  try {
    const { bookingId, transactionId, screenshotUrl, amount } = req.body;

    // Input validation
    if (!bookingId || !transactionId || !screenshotUrl) {
      return res.status(400).json({ error: "bookingId, transactionId and screenshotUrl are required" });
    }
    if (transactionId.length < 10 || transactionId.length > 35) {
      return res.status(400).json({ error: "Transaction ID must be 10–35 characters" });
    }
    if (!/^[A-Z0-9]+$/.test(transactionId)) {
      return res.status(400).json({ error: "Transaction ID must contain only uppercase letters and numbers" });
    }

    const bookingDoc = await db.collection("bookings").doc(bookingId).get();
    if (!bookingDoc.exists) return next(createError("not_found", "Booking not found"));

    const booking = bookingDoc.data();

    // Security: user must own this booking
    if (booking.userId !== req.user.uid) {
      return next(createError("forbidden", "You can only submit payment for your own bookings"));
    }

    // Block double submission
    if (booking.status === "payment_submitted") {
      return res.status(400).json({ error: "Payment proof already submitted. Please wait for verification." });
    }

    // Booking must be in pending_payment state
    if (booking.status !== "pending_payment") {
      return res.status(400).json({ error: `Cannot submit payment for a booking with status: ${booking.status}` });
    }

    // Duplicate transaction ID check across all bookings for this company
    if (booking.companyId) {
      const companyDoc = await db.collection("companies").doc(booking.companyId).get();
      const usedTxns = companyDoc.data()?.verifiedTransactions || [];
      if (usedTxns.some(t => t.txnId === transactionId)) {
        return res.status(400).json({ error: "This transaction ID has already been used for another booking." });
      }
    }

    const currentAttempts = booking.paymentAttempts?.length || 0;

    await bookingDoc.ref.update({
      status: "payment_submitted",
      "payment.advance.status": "submitted",
      "payment.advance.transactionId": transactionId,
      "payment.advance.screenshotUrl": screenshotUrl,
      "payment.advance.amount": amount || 0,
      "payment.advance.submittedAt": admin.firestore.FieldValue.serverTimestamp(),
      "slotLock.isLocked": true,
      "slotLock.lockType": "hard",
      "slotLock.lockExpiry": null,
      "slotLock.lockReason": "payment_submitted",
      paymentAttempts: admin.firestore.FieldValue.arrayUnion({
        attemptNumber: currentAttempts + 1,
        transactionId,
        screenshotUrl,
        submittedAt: new Date().toISOString(),
        status: "submitted",
      }),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ success: true, message: "Payment submitted successfully. Awaiting verification." });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────
// PUT /api/payments/:bookingId/verify — Manager verifies payment
// Access: manager, owner, admin
// ─────────────────────────────────────────────────────────────
router.put("/:bookingId/verify", requireRole("manager", "owner", "admin"), async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const { note } = req.body;

    const doc = await db.collection("bookings").doc(bookingId).get();
    if (!doc.exists) return next(createError("not_found", "Booking not found"));

    const booking = doc.data();

    if (booking.status !== "payment_submitted") {
      return res.status(400).json({ error: "This booking does not have a pending payment to verify." });
    }

    await doc.ref.update({
      status: "confirmed",
      "payment.advance.status": "verified",
      "payment.advance.verifiedBy": req.user.uid,
      "payment.advance.verifiedAt": admin.firestore.FieldValue.serverTimestamp(),
      "payment.advance.verificationNote": note || "",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ success: true, message: "Payment verified. Booking is now confirmed." });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────
// PUT /api/payments/:bookingId/reject — Manager rejects payment
// Access: manager, owner, admin
// ─────────────────────────────────────────────────────────────
router.put("/:bookingId/reject", requireRole("manager", "owner", "admin"), async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const { reason } = req.body;

    if (!reason) return res.status(400).json({ error: "Rejection reason is required" });

    const doc = await db.collection("bookings").doc(bookingId).get();
    if (!doc.exists) return next(createError("not_found", "Booking not found"));

    await doc.ref.update({
      status: "payment_rejected",
      "payment.advance.status": "rejected",
      "payment.advance.rejectedBy": req.user.uid,
      "payment.advance.rejectedAt": admin.firestore.FieldValue.serverTimestamp(),
      "payment.advance.rejectionReason": reason,
      "slotLock.isLocked": false,
      "slotLock.lockType": null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ success: true, message: "Payment rejected." });
  } catch (err) { next(err); }
});

module.exports = router;
```

---

### Day 12: Slot Routes

**Create `functions/src/api/routes/slots.js`:**
```javascript
const router = require("express").Router();
const admin  = require("firebase-admin");
const { verifyToken, requireRole } = require("../middleware/auth");

const db = admin.firestore();
router.use(verifyToken);

// ─────────────────────────────────────────────────────────────
// GET /api/slots/availability?turfId=&groundId=&date=&startTime=&endTime=
// Access: all authenticated users
// ─────────────────────────────────────────────────────────────
router.get("/availability", async (req, res, next) => {
  try {
    const { turfId, groundId, date, startTime, endTime } = req.query;

    if (!turfId || !groundId || !date || !startTime || !endTime) {
      return res.status(400).json({
        error: "All params required: turfId, groundId, date, startTime, endTime"
      });
    }

    // Block past date queries
    const today = new Date().toISOString().split("T")[0];
    if (date < today) {
      return res.json({ available: false, reason: "past_date" });
    }

    const snapshot = await db.collection("bookings")
      .where("turfId", "==", turfId)
      .where("date", "==", date)
      .where("status", "in", ["confirmed", "in_progress", "awaiting_payment", "payment_submitted"])
      .get();

    const hasConflict = snapshot.docs.some(d => {
      const b = d.data();
      return b.groundId === groundId && b.startTime < endTime && b.endTime > startTime;
    });

    res.json({ available: !hasConflict });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────
// POST /api/slots/block — Manager blocks a slot
// Access: manager, owner
// ─────────────────────────────────────────────────────────────
router.post("/block", requireRole("manager", "owner", "admin"), async (req, res, next) => {
  try {
    const { turfId, groundId, startDate, endDate, startTime, endTime, reason, allDay } = req.body;

    if (!turfId || !groundId || !startDate) {
      return res.status(400).json({ error: "turfId, groundId and startDate are required" });
    }

    const ref = await db.collection("blocked_slots").add({
      turfId,
      groundId,
      startDate,
      endDate: endDate || startDate,
      startTime: startTime || null,
      endTime: endTime || null,
      allDay: allDay || false,
      reason: reason || "Blocked by management",
      blockedBy: req.user.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(201).json({ id: ref.id, message: "Slot blocked successfully" });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────
// DELETE /api/slots/block/:id — Remove a blocked slot
// Access: manager, owner, admin
// ─────────────────────────────────────────────────────────────
router.delete("/block/:id", requireRole("manager", "owner", "admin"), async (req, res, next) => {
  try {
    const doc = await db.collection("blocked_slots").doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: "Blocked slot not found" });

    await doc.ref.delete();
    res.json({ success: true, message: "Slot unblocked" });
  } catch (err) { next(err); }
});

module.exports = router;
```

---

### Day 13: User Routes

**Create `functions/src/api/routes/users.js`:**
```javascript
const router = require("express").Router();
const admin  = require("firebase-admin");
const { verifyToken, requireRole } = require("../middleware/auth");
const { strictLimiter } = require("../middleware/rateLimiter");

const db = admin.firestore();
router.use(verifyToken);

// GET /api/users/profile — Get own profile
router.get("/profile", async (req, res, next) => {
  try {
    const doc = await db.collection("users").doc(req.user.uid).get();
    if (!doc.exists) return res.status(404).json({ error: "Profile not found" });
    res.json({ id: doc.id, ...doc.data() });
  } catch (err) { next(err); }
});

// PUT /api/users/profile — Update own profile
router.put("/profile", async (req, res, next) => {
  try {
    const { name, phone, avatar } = req.body;

    // Only allow safe fields to be updated
    const updateData = {};
    if (name)   updateData.name   = String(name).trim().substring(0, 100);
    if (phone)  updateData.phone  = String(phone).trim();
    if (avatar) updateData.avatar = String(avatar).trim();

    updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    await db.collection("users").doc(req.user.uid).update(updateData);
    res.json({ success: true, message: "Profile updated" });
  } catch (err) { next(err); }
});

// GET /api/users/:id — Admin gets any user's profile
router.get("/:id", requireRole("admin"), async (req, res, next) => {
  try {
    const doc = await db.collection("users").doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: "User not found" });
    res.json({ id: doc.id, ...doc.data() });
  } catch (err) { next(err); }
});

module.exports = router;
```

---

### Day 14: Input Validators

**Create `functions/src/api/validators/bookingValidators.js`:**
```javascript
const { body, validationResult } = require("express-validator");

const validateCreateBooking = [
  body("turfId")
    .notEmpty().withMessage("turfId is required")
    .isString().trim(),

  body("groundId")
    .notEmpty().withMessage("groundId is required")
    .isString().trim(),

  body("date")
    .notEmpty().withMessage("date is required")
    .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage("date must be YYYY-MM-DD format"),

  body("startTime")
    .notEmpty().withMessage("startTime is required")
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage("startTime must be HH:mm format"),

  body("endTime")
    .notEmpty().withMessage("endTime is required")
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage("endTime must be HH:mm format"),

  body("amount")
    .notEmpty().withMessage("amount is required")
    .isFloat({ min: 1, max: 100000 }).withMessage("amount must be between 1 and 100,000"),

  // Run validation and return errors if any
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: "Validation failed",
        fields: errors.array().map(e => ({ field: e.path, message: e.msg })),
      });
    }
    next();
  },
];

module.exports = { validateCreateBooking };
```

---

## Week 3: Firestore Security Rules + Database Protection (Days 15–21)

### Day 15–17: Harden Firestore Rules

**Replace contents of `firestore.rules`:**
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ── Helper functions ──────────────────────────────────────
    function isSignedIn()   { return request.auth != null; }
    function isAdmin()      { return request.auth.token.role == 'admin'; }
    function isOwner()      { return request.auth.token.role == 'owner'; }
    function isManager()    { return request.auth.token.role == 'manager'; }
    function isCaretaker()  { return request.auth.token.role == 'caretaker'; }
    function isUser()       { return request.auth.token.role == 'user'; }
    function isStaff()      { return isManager() || isOwner() || isAdmin(); }
    function isOwnerOf(uid) { return request.auth.uid == uid; }

    // ── Users ─────────────────────────────────────────────────
    match /users/{userId} {
      allow read:   if isSignedIn() && (isOwnerOf(userId) || isAdmin());
      allow create: if isSignedIn() && isOwnerOf(userId);
      allow update: if isSignedIn() && isOwnerOf(userId);
      allow delete: if isAdmin();
    }

    // ── Bookings ──────────────────────────────────────────────
    match /bookings/{bookingId} {
      allow read: if isSignedIn() && (
        resource.data.userId == request.auth.uid || isStaff()
      );
      allow create: if isSignedIn() && isUser();
      allow update: if isSignedIn() && (
        (resource.data.userId == request.auth.uid &&
         request.resource.data.status == 'cancelled') ||
        isStaff()
      );
      allow delete: if isAdmin();
    }

    // ── Companies ─────────────────────────────────────────────
    match /companies/{companyId} {
      allow read:   if isSignedIn();
      allow create: if isSignedIn() && isOwner();
      allow update: if isSignedIn() && (isOwner() || isAdmin());
      allow delete: if isAdmin();
    }

    // ── Turfs ─────────────────────────────────────────────────
    match /turfs/{turfId} {
      allow read:   if true;
      allow create: if isSignedIn() && (isOwner() || isAdmin());
      allow update: if isSignedIn() && (isManager() || isOwner() || isAdmin());
      allow delete: if isSignedIn() && (isOwner() || isAdmin());
    }

    // ── Chats ─────────────────────────────────────────────────
    match /chats/{chatId} {
      allow read, write: if isSignedIn() &&
        request.auth.uid in resource.data.participants;

      match /messages/{messageId} {
        allow read, write: if isSignedIn() &&
          request.auth.uid in
          get(/databases/$(database)/documents/chats/$(chatId)).data.participants;
      }
    }

    // ── Blocked Slots ─────────────────────────────────────────
    match /blocked_slots/{slotId} {
      allow read:   if isSignedIn();
      allow write:  if isSignedIn() && isStaff();
    }

    // ── Maintenance Logs ──────────────────────────────────────
    match /maintenance_logs/{logId} {
      allow read:   if isSignedIn() && isStaff();
      allow create: if isSignedIn() && (isCaretaker() || isStaff());
      allow update: if isSignedIn() && isStaff();
      allow delete: if isAdmin();
    }

    // ── Deny everything else ──────────────────────────────────
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

---

### Day 18–19: Mobile App API Client

**Create `src/services/api/client.js` in the mobile app:**
```javascript
import auth from "@react-native-firebase/auth";

const BASE_URL = "https://us-central1-sowin-power.cloudfunctions.net/api";

async function apiRequest(method, path, body = null) {
  const currentUser = auth().currentUser;
  if (!currentUser) throw new Error("Not authenticated. Please log in.");

  const token = await currentUser.getIdToken();

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : null,
  });

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.error || "Request failed");
    error.status = response.status;
    throw error;
  }

  return data;
}

export const api = {
  get:    (path)       => apiRequest("GET",    path),
  post:   (path, body) => apiRequest("POST",   path, body),
  put:    (path, body) => apiRequest("PUT",    path, body),
  delete: (path)       => apiRequest("DELETE", path),
};
```

**Migration example in screens:**
```javascript
// BEFORE (direct Firestore)
import { submitPaymentForVerification } from "../../services/firebase/payments";
await submitPaymentForVerification(bookingId, { transactionId, screenshotUrl, amount });

// AFTER (via middleware)
import { api } from "../../services/api/client";
await api.post("/payments/submit", { bookingId, transactionId, screenshotUrl, amount });
```

---

### Day 20–21: Screens to Migrate

Migrate these one by one — in order of priority:

| Priority | Screen | Old service | New API endpoint |
|----------|--------|-------------|-----------------|
| 1 | `PaymentConfirmationScreen.js` | `submitPaymentForVerification()` | `POST /api/payments/submit` |
| 2 | `VerifyPaymentScreen.js` | Direct Firestore update | `PUT /api/payments/:id/verify` |
| 3 | `BookingScreen.js` | `checkSlotAvailability()` | `GET /api/slots/availability` |
| 4 | `BookingsScreen.js` | Direct Firestore query | `GET /api/bookings?turfId=...` |
| 5 | `BookingConfirmationScreen.js` | `createBooking()` | `POST /api/bookings` |

---

## Week 4: Testing & Deployment (Days 22–30)

### Day 22–24: Local Testing with Firebase Emulator

**Start emulator:**
```bash
cd functions
npm run serve
# Emulator runs at: http://localhost:5001/sowin-power/us-central1/api
```

**Get a Firebase token for testing:**
```javascript
// Add this temporarily to any screen in the app
import auth from "@react-native-firebase/auth";
const token = await auth().currentUser.getIdToken();
console.log("TOKEN:", token);
```

**Test each endpoint with curl:**
```bash
TOKEN="paste-your-token-here"
BASE="http://localhost:5001/sowin-power/us-central1/api/api"

# Health check (no auth needed)
curl $BASE/health

# Check slot availability
curl "$BASE/slots/availability?turfId=abc&groundId=g1&date=2025-02-01&startTime=10:00&endTime=12:00" \
  -H "Authorization: Bearer $TOKEN"

# Submit payment
curl -X POST $BASE/payments/submit \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"bookingId":"xxx","transactionId":"TXN1234567890","screenshotUrl":"https://...","amount":500}'

# Test rate limiter (run 6 times quickly — should get 429 on 6th)
for i in {1..6}; do curl -X POST $BASE/payments/submit -H "Authorization: Bearer $TOKEN" -d '{}'; done
```

---

### Day 25: Deploy to Firebase

```bash
# Deploy Cloud Functions (includes the new Express API)
cd functions
npm run deploy

# Deploy Firestore security rules
firebase deploy --only firestore:rules

# Deploy Storage rules
firebase deploy --only storage

# Verify deployment
curl https://us-central1-sowin-power.cloudfunctions.net/api/api/health
```

---

### Day 26–27: Update Mobile App Screens

Migrate each screen (see Day 20–21 table). Test on Android device after each migration.

---

### Day 28: End-to-End Testing on Device

Test full flows on a real Android device:

```
User flow:
1. Login → OTP → Profile
2. Search turfs
3. Select slot → check availability via API
4. Create booking via API
5. Upload payment screenshot
6. Submit payment via API
7. Wait for manager verification

Manager flow:
1. Login
2. View pending payments
3. Verify payment via API
4. Confirm booking
```

---

### Day 29–30: Monitor & Fix

```bash
# Watch live Cloud Function logs
cd functions && npm run logs

# Or filter by API errors only
firebase functions:log --only api
```

**Check Firebase Console for:**
- Functions → Error rate (should be < 1%)
- Firestore → Rules tab → Denied requests (should be 0 for legitimate users)
- Authentication → Sign-in activity (watch for unusual spikes)

---

## Security Checklist

| # | Security Measure | Where Implemented | Status |
|---|-----------------|-------------------|--------|
| 1 | Firebase Auth token on every request | `auth.js` middleware | Week 1 |
| 2 | Role-based access control | `requireRole()` in every route | Week 1 |
| 3 | General rate limiting (100 req/15min) | `rateLimiter.js` | Week 1 |
| 4 | Payment rate limiting (5 req/15min) | `rateLimiter.js` | Week 1 |
| 5 | Security headers (XSS, clickjacking) | `helmet()` | Week 1 |
| 6 | CORS restricted to your domain | `cors()` config | Week 1 |
| 7 | Request body size limit (10kb) | `express.json({ limit })` | Week 1 |
| 8 | Input validation (format, length, type) | `bookingValidators.js` | Week 2 |
| 9 | Server-side slot conflict check | `bookings.js` POST route | Week 2 |
| 10 | Duplicate transaction ID prevention | `payments.js` POST route | Week 2 |
| 11 | Parameter pollution prevention | `app.js` middleware | Week 1 |
| 12 | Firestore security rules (deny-by-default) | `firestore.rules` | Week 3 |
| 13 | Users can only access own data | Firestore rules + route checks | Week 3 |
| 14 | Centralized error handler (no leaks) | `errorHandler.js` | Week 1 |
| 15 | Bot/suspicious agent blocking | `app.js` middleware | Week 1 |

---

## API Endpoint Reference

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/health` | Public | Health check |
| GET | `/api/bookings` | Manager/Owner/Admin | List bookings by turf |
| GET | `/api/bookings/:id` | Owner or Staff | Get single booking |
| POST | `/api/bookings` | User | Create new booking |
| PUT | `/api/bookings/:id/cancel` | Owner (user) or Admin | Cancel booking |
| POST | `/api/payments/submit` | User | Submit payment proof |
| PUT | `/api/payments/:id/verify` | Manager/Owner/Admin | Verify payment |
| PUT | `/api/payments/:id/reject` | Manager/Owner/Admin | Reject payment |
| GET | `/api/slots/availability` | All auth users | Check slot availability |
| POST | `/api/slots/block` | Manager/Owner/Admin | Block a slot |
| DELETE | `/api/slots/block/:id` | Manager/Owner/Admin | Unblock a slot |
| GET | `/api/users/profile` | Self | Get own profile |
| PUT | `/api/users/profile` | Self | Update own profile |
| GET | `/api/users/:id` | Admin | Get any user's profile |

---

## Base URL After Deployment

```
https://us-central1-sowin-power.cloudfunctions.net/api
```

All requests must include:
```
Authorization: Bearer <firebase-id-token>
Content-Type: application/json
```
