# Discount & Coupon System — Full Design Plan

**Project:** SportSphere / Turf-1701  
**Date:** 2026-05-29  
**Scope:** App (React Native) + Admin Panel (Web)

---

## 1. Overview

Two distinct coupon channels exist side-by-side:

| Channel | Created By | Controlled By Company | Shown Where | Absorbed By |
|---------|-----------|----------------------|-------------|-------------|
| **Turf Coupons** | Admin (us, in coordination with company) | Toggle ON/OFF only | Discover page → Turf Offers | Turf company's revenue |
| **Platform Coupons** | Admin (us) | No control | App-wide, marketing | PlayGrid absorbs the cost |

Companies **cannot create or configure** their own coupons. When a company wants to run an offer, they coordinate with us and we create it in the admin panel. The company then has a simple toggle in the app (Settings → Offers) to activate or pause their assigned coupons.

Both coupon types must work across:
- Turfs **with** advance booking (online payment collected)
- Turfs **with no** advance booking (pay at venue)
- Chat-based bookings (negotiated price)

---

## 2. Core Business Rules

### 2.1 Stacking Rule
- A user can apply **only one coupon per booking** — either a turf coupon OR a platform coupon, not both.
- Platform coupons take precedence if a user has one, but the UI lets the user pick which to apply.

### 2.2 Discount Applies to Total, Not Just Advance
The discount reduces the **total booking amount** first. The advance percentage is then calculated on the **discounted total**. This is the correct UX — the user sees a genuinely lower price, not a fractional reduction of just the advance.

```
Example:
  Total booking:    ₹1,000
  20% coupon:       - ₹200
  Discounted total: ₹800
  Advance (50%):    ₹400   ← user pays now
  Remaining:        ₹400   ← user pays at venue
```

### 2.3 No-Advance Booking ("Pay at Venue") Turfs
- The coupon is validated and saved with the booking.
- No online payment is collected.
- The booking record stores the discount details so the turf staff can see the applicable discount.
- User gets a **coupon voucher view** inside the booking detail screen to show at venue.
- The turf company settles with PlayGrid separately (for platform coupons) — that is an operational/contractual matter, outside the app scope for now.

### 2.4 Chat / Negotiated Bookings
- **Turf coupons: NOT applicable** — the owner/manager has already set a custom price via negotiation. Applying a turf coupon on top of a manually negotiated price creates conflict.
- **Platform coupons: APPLICABLE** — a marketing coupon from PlayGrid is independent of any price negotiation. Applied at the payment step when the user taps "Pay Advance."
- If the turf has no advance requirement, the platform coupon is saved with the booking and shown as a venue voucher.

### 2.5 Minimum Booking Amount
Every coupon can specify a `minBookingAmount`. The coupon is only valid if `totalAmount >= minBookingAmount`.

### 2.6 Per-User Limit
Every coupon has a `perUserLimit` (default 1). This prevents abuse of single-use marketing coupons.

### 2.7 Max Discount Cap (for percentage coupons)
A percentage coupon (e.g., 20% OFF) can have a `maxDiscountAmount` cap (e.g., max ₹200 off). This prevents large bookings from wiping out the entire discount budget.

---

## 3. Firestore Data Model

### 3.1 `coupons` Collection

```
coupons/{couponId}
```

| Field | Type | Description |
|-------|------|-------------|
| `code` | string | Uppercase unique code (e.g., "TURF20", "PLAY50") |
| `title` | string | Display name (e.g., "20% Off Weekend Bookings") |
| `description` | string | Short marketing copy |
| `channel` | `"turf"` \| `"platform"` | Who created it |
| `companyId` | string \| null | Set for turf coupons; null for platform |
| `turfIds` | string[] \| null | Restrict to specific turfs (turf coupons only) |
| `createdBy` | string | userId of creator |
| `discountType` | `"percentage"` \| `"flat"` | Discount calculation method |
| `discountValue` | number | % value or flat ₹ amount |
| `maxDiscountAmount` | number \| null | Cap for percentage discounts |
| `minBookingAmount` | number | Minimum booking total required |
| `validFrom` | timestamp | Coupon activation date |
| `validTo` | timestamp | Coupon expiry date |
| `totalUsageLimit` | number \| null | Max total redemptions (null = unlimited) |
| `usageCount` | number | Current total redemptions (auto-incremented) |
| `perUserLimit` | number | Max uses per user (default 1) |
| `applicableToNegotiated` | boolean | false for turf coupons, true for platform |
| `applicableToNoAdvance` | boolean | Whether coupon works for pay-at-venue turfs |
| `companyStatus` | `"active"` \| `"paused"` | Company's toggle — only field the company can write |
| `status` | `"active"` \| `"paused"` \| `"expired"` | Admin-controlled master status |

> The effective status of a coupon is `"active"` only when **both** `status === "active"` AND `companyStatus === "active"`. Admin's `status` overrides — if admin pauses, company toggle has no effect.
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

**Example — Turf Coupon:**
```json
{
  "code": "WEEKEND20",
  "title": "20% Off Weekend Slots",
  "channel": "turf",
  "companyId": "company_abc",
  "turfIds": ["turf_xyz"],
  "discountType": "percentage",
  "discountValue": 20,
  "maxDiscountAmount": 250,
  "minBookingAmount": 500,  
  "validFrom": "2026-06-01T00:00:00Z",
  "validTo": "2026-06-30T23:59:59Z",
  "totalUsageLimit": 100,
  "usageCount": 14,
  "perUserLimit": 2,
  "applicableToNegotiated": false,
  "applicableToNoAdvance": true,
  "status": "active"
}
```

**Example — Platform Coupon:**
```json
{
  "code": "PLAY50",
  "title": "₹50 Off Your First Booking",
  "channel": "platform",
  "companyId": null,
  "turfIds": null,
  "discountType": "flat",
  "discountValue": 50,
  "maxDiscountAmount": null,
  "minBookingAmount": 200,
  "validFrom": "2026-06-01T00:00:00Z",
  "validTo": "2026-12-31T23:59:59Z",
  "totalUsageLimit": null,
  "perUserLimit": 1,
  "applicableToNegotiated": true,
  "applicableToNoAdvance": true,
  "status": "active"
}
```

---

### 3.2 `couponUsages` Collection

```
couponUsages/{usageId}
```

| Field | Type | Description |
|-------|------|-------------|
| `couponId` | string | Reference to coupon |
| `couponCode` | string | Denormalized for easy lookup |
| `userId` | string | Who used it |
| `bookingId` | string | Booking it was applied to |
| `companyId` | string | Turf company of the booking |
| `turfId` | string | Specific turf |
| `channel` | `"turf"` \| `"platform"` | Coupon channel |
| `originalAmount` | number | Booking total before discount |
| `discountAmount` | number | Amount actually discounted |
| `finalAmount` | number | Amount after discount |
| `advanceAmount` | number | Advance paid (0 if no-advance turf) |
| `usedAt` | timestamp | |

**Composite index required:** `(userId, couponId)` — to enforce `perUserLimit`.

---

### 3.3 Booking Document — Added Fields

Add these fields to the existing booking document structure:

```json
"coupon": {
  "applied": false,
  "code": null,
  "couponId": null,
  "channel": null,
  "discountType": null,
  "discountValue": null,
  "discountAmount": null,
  "originalAmount": null
}
```

Also update the `payment` sub-object to reference the post-discount amounts:

```json
"payment": {
  "slotAmount": 1000,           // original before discount
  "discountAmount": 200,        // from coupon (0 if none)
  "finalAmount": 800,           // slotAmount - discountAmount
  "advanceAmount": 400,         // 50% of finalAmount
  "remainingAmount": 400,       // finalAmount - advanceAmount
  ...existing fields...
}
```

---

## 4. Discount Calculation Engine

### 4.1 New Utility — `src/utils/couponUtils.js`

```
validateCoupon(couponCode, context) → { valid, coupon, error }
calculateDiscount(coupon, totalAmount) → { discountAmount, finalAmount }
```

**`validateCoupon` context object:**
```js
{
  userId,
  turfId,
  companyId,
  totalAmount,
  bookingDate,
  isNegotiatedBooking,   // boolean
  hasAdvancePayment,     // boolean (turf has advance requirement)
}
```

**Validation checks (in order):**
1. Coupon code exists → else "Invalid coupon code"
2. Status is `"active"` → else "This coupon is no longer active"
3. Current date between `validFrom` and `validTo` → else "Coupon expired" or "Coupon not yet active"
4. If `channel === "turf"`: `turfId` must be in `coupon.turfIds` (if turfIds is set) and `companyId` must match → else "Coupon not valid for this turf"
5. If `isNegotiatedBooking && !coupon.applicableToNegotiated` → "Coupon cannot be applied to negotiated bookings"
6. `totalAmount >= coupon.minBookingAmount` → else `"Minimum booking amount ₹{n} required"`
7. `coupon.totalUsageLimit !== null && coupon.usageCount >= coupon.totalUsageLimit` → "Coupon limit reached"
8. Check `couponUsages` where `userId == userId && couponId == couponId`: count < `perUserLimit` → else "You have already used this coupon"
9. All checks pass → return `{ valid: true, coupon }`

**`calculateDiscount` logic:**
```js
if (discountType === "flat") {
  discountAmount = Math.min(discountValue, totalAmount); // can't discount more than total
} else {
  // percentage
  discountAmount = (discountValue / 100) * totalAmount;
  if (maxDiscountAmount !== null) {
    discountAmount = Math.min(discountAmount, maxDiscountAmount);
  }
  discountAmount = Math.floor(discountAmount); // always floor to rupees, no paise
}
finalAmount = totalAmount - discountAmount;
```

---

## 5. App UI Changes

### 5.1 Discover Page — Turf Offers Section

Each turf card on the Discover screen gets an **Offers badge** if the turf has active coupons:

```
┌─────────────────────────────────┐
│  [Turf Image]              🏷 2 Offers │
│  Turf Name                             │
│  ⭐ 4.5 · 5km                          │
└─────────────────────────────────┘
```

Tapping the turf card opens **TurfDetailScreen**. A new horizontal scrollable **"Offers & Deals"** section appears below the amenities row:

```
Offers & Deals  ─────────────────────
┌──────────────────┐  ┌──────────────┐
│ 🏷 WEEKEND20      │  │ 🏷 FLAT100   │
│ 20% Off Weekend  │  │ ₹100 Off on  │
│ Max ₹250 off     │  │ bookings ₹600│
│ Valid till Jun 30│  │ Valid 30 days│
│ [Copy Code]      │  │ [Copy Code]  │
└──────────────────┘  └──────────────┘
```

- The coupon code is shown and has a **Copy** button.
- After copying, a toast says "Code copied! Apply it during booking."
- Platform coupons are NOT shown here — they're discovered via banners/notifications.

---

### 5.2 BookingConfirmationScreen — Coupon Input

Below the price breakdown and above the payment method selector, add:

```
─────────────────────────────────────
  Have a coupon?
  ┌────────────────────────┬────────┐
  │ Enter coupon code      │ APPLY  │
  └────────────────────────┴────────┘
  
  ✅ WEEKEND20 applied — You save ₹200
  [Remove]
─────────────────────────────────────

  Price Breakdown
  Slot (Evening 1h)    ₹1,000
  Discount (WEEKEND20)  - ₹200
  ─────────────────────────────
  Total                  ₹800
  
  Advance (50%)          ₹400   ← PAY NOW
  Remaining              ₹400   ← Pay at venue
```

**UX details:**
- The APPLY button calls `validateCoupon()` and shows inline error if invalid.
- A loading spinner shows while validation runs (async Firestore check).
- Removing the coupon restores the original amounts.
- If the turf is "no advance" (pay at venue), the layout reads:
  ```
  Total after discount:    ₹800
  Payment:         Pay at Venue
  Your coupon voucher will be shown in booking details.
  ```

---

### 5.3 BookingDetailScreen — Coupon Voucher

For **no-advance turfs** with an applied coupon:

```
┌─────────────────────────────────┐
│  🎟 Coupon Applied              │
│  Code: WEEKEND20                │
│  Discount: 20% off = ₹200 saved │
│  Show this screen at the venue  │
│  to claim your discount.        │
└─────────────────────────────────┘
```

For **advance turfs**, the coupon is informational (discount already baked into advance paid).

---

### 5.4 Chat Booking — PaymentScreen

When a user opens the payment flow from a chat booking card (manager requested advance):
- If it's a negotiated booking, show **only** the platform coupon input.
- Add a note: "Turf coupons don't apply to negotiated bookings."
- The platform coupon validation context passes `isNegotiatedBooking: true`.

---

## 6. Firestore Service Layer

### 6.1 New Service — `src/services/firebase/coupons.js`

**Functions to implement:**

```js
// Fetch active coupons for a specific turf (for Discover page)
getTurfCoupons(turfId, companyId) → coupon[]

// Validate a coupon code before booking confirmation
// Performs all checks including per-user usage count
validateCouponForBooking(couponCode, context) → { valid, coupon, error }

// Atomically record coupon usage + update usageCount + create coupon usage doc
// Called inside the booking creation transaction
recordCouponUsage(couponId, bookingId, usageData) → void

// For admin: list all coupons (platform + turf) with pagination
listCoupons(filters, pagination) → { coupons, total }

// Fetch company's assigned coupons (for owner/manager toggle screen)
getCompanyCoupons(companyId) → coupon[]

// Company toggle — only allowed write for owner/manager
// Updates companyStatus field only; all other fields are admin-only
setCompanyCouponStatus(couponId, companyId, status: "active" | "paused") → void

// Admin only: create either type of coupon
createCoupon(couponData) → couponId

// Admin only: update any coupon field
updateCoupon(couponId, updates) → void

// Admin only: hard delete a coupon
deleteCoupon(couponId) → void
```

**`recordCouponUsage` — must run inside the booking Firestore transaction:**
```
transaction.update(couponRef, { usageCount: increment(1) })
transaction.set(usageRef, { ...usageData })
transaction.update(bookingRef, { coupon: {...}, payment: {...} })
```
This prevents race conditions where two users try to use the last slot of a limited coupon simultaneously.

---

## 7. Booking Creation Flow — Updated

### 7.1 Regular Booking with Advance Payment

```
User opens BookingConfirmationScreen
  ↓
[Optional] User enters coupon code
  ↓
validateCouponForBooking() called
  → If invalid: show error, coupon not applied
  → If valid: show discount, update displayed amounts
  ↓
User selects payment method (UPI or Cash at Venue)
  ↓
User taps "Confirm Booking"
  ↓
Firestore transaction begins:
  1. Re-validate slot availability (same as today)
  2. If coupon applied:
     a. Re-fetch coupon document (inside transaction)
     b. Re-check usageCount < totalUsageLimit (double-check)
     c. Re-check user's usage count
     d. Increment coupon.usageCount
     e. Write couponUsages document
  3. Create booking document with coupon fields + discounted payment amounts
  4. Create/update slot lock
Transaction commits
  ↓
User redirected to PaymentConfirmationScreen (or booking success for pay-at-venue)
```

### 7.2 Regular Booking — No Advance (Pay at Venue)

```
Same flow until payment method selection
  ↓
User selects "Cash at Venue"
  ↓
Coupon (if applied) is saved with booking as a voucher
  ↓
Booking status → "confirmed" immediately (no payment_submitted step)
  ↓
BookingDetailScreen shows coupon voucher card
```

### 7.3 Chat Booking with Platform Coupon

```
Manager sends "Payment Request" card in chat
  ↓
User taps "Pay Advance" on the card
  ↓
App navigates to PaymentConfirmationScreen (existing flow)
  ↓
NEW: Before the screenshot upload step, show coupon input:
  "Have a PlayGrid coupon? Apply it to reduce your advance."
  ↓
User applies platform coupon (only platform coupons allowed here)
  ↓
Coupon validation runs (with isNegotiatedBooking: true)
  ↓
If valid:
  - Booking document is updated with coupon fields
  - Payment amounts are recalculated (advance reduced)
  - usageCount incremented + couponUsages doc written
  ↓
User uploads UPI screenshot for the discounted advance amount
  ↓
Normal payment verification flow continues
```

**Important:** For chat bookings, the coupon is applied as a separate `updateDocument` call (not inside the initial booking creation transaction, since the booking already exists). A Cloud Function should verify the coupon wasn't already applied to this booking to prevent double-application.

---

## 8. Admin Panel — Coupon Management

**Routes to add in turf-admin-panel:**
```
/coupons                    → List all coupons (platform + turf)
/coupons/new                → Create platform coupon
/coupons/:id                → Edit / view usage stats
/coupons/:id/usages         → List all redemptions for this coupon
```

### 8.1 Coupon List Page `/coupons`

**Filters:**
- Channel (All / Platform / Turf)
- Status (Active / Paused / Expired)
- Company (dropdown for turf coupons)
- Date range

**Table columns:**
| Code | Title | Channel | Type | Value | Used / Limit | Valid Until | Status | Actions |
|------|-------|---------|------|-------|--------------|-------------|--------|---------|

**Actions per row:** Edit · Pause/Resume · View Usages · Delete

### 8.2 Create / Edit Platform Coupon Form

```
Code *            [PLAY50          ]  [Auto-generate]
Title *           [₹50 Off First Booking         ]
Description       [Use on your first booking!    ]
Discount Type *   ○ Percentage  ● Flat Amount
Discount Value *  [₹ 50          ]
Max Discount Cap  [Leave blank for no cap        ]
Min Booking Amt   [₹ 200         ]
Valid From *      [2026-06-01]
Valid To *        [2026-12-31]
Total Usage Limit [Leave blank for unlimited     ]
Per User Limit *  [1             ]
Apply to negotiated bookings?  [✓]
Apply to no-advance bookings?  [✓]
Status            [Active ▼]

[Cancel]  [Save Coupon]
```

### 8.3 Coupon Detail / Analytics Page

```
PLAY50  ·  ₹50 Flat Off  ·  Active
────────────────────────────────────────
Redemptions:  247 / unlimited
Total Discount Given:  ₹12,350
Avg Booking Value:  ₹680
Top Turfs Using This Coupon: ...

[Redemption History Table]
Date | User | Turf | Booking Amt | Discount | Final Amt
...
```

### 8.4 Owner/Manager — Coupon Toggle (App-side)

Owners and managers **cannot create coupons**. They see only the coupons admin has assigned to their company, with a simple toggle to activate or pause each one.

**Screen to add in app (owner/manager side):**
```
OwnerNavigator / ManagerNavigator:
  Settings → "Offers & Coupons" → CompanyCouponToggleScreen
```

**CompanyCouponToggleScreen layout:**
```
Offers & Coupons
────────────────────────────────────────
  WEEKEND20
  20% Off Weekend Slots · Max ₹250
  Valid: Jun 1 – Jun 30
  Used: 14 / 100
  [   ●  ON   ]  ← toggle (writes companyStatus only)

  FLAT100
  ₹100 Off bookings above ₹600
  Valid: Ongoing
  Used: 7 / 50
  [  ○  OFF   ]

────────────────────────────────────────
  Want to run a new offer?
  Contact PlayGrid support to set one up.
```

- Toggling calls `setCompanyCouponStatus()` which only writes the `companyStatus` field.
- If admin has paused the coupon (`status === "paused"`), the toggle is disabled and shows "Paused by PlayGrid."
- No create/edit/delete capability for the company.

---

## 9. Cloud Functions

### 9.1 `expireCoupons` — Scheduled (daily, 12:00 AM IST)

```js
// Query coupons where validTo < now AND status == "active"
// Update status → "expired"
```

### 9.2 `onCouponUsageCreate` — Firestore trigger

```
Trigger: onCreate on couponUsages/{usageId}
Purpose: Send notification to owner/manager when their turf coupon is used.
```

```js
// If channel === "turf":
//   Notify company via FCM: "Your coupon {code} was used by {user} on {turfName}"
```

### 9.3 `validateCouponHTTPS` — HTTPS Callable Function (optional but recommended)

Move the core coupon validation logic server-side to prevent client-side tampering. The app calls this function instead of reading Firestore directly.

```js
// Input: { couponCode, userId, turfId, companyId, totalAmount, isNegotiated }
// Output: { valid, coupon (stripped), error }
// The function reads Firestore server-side; client cannot spoof usage counts.
```

---

## 10. Discover Page — Platform Banner

To surface **platform coupons** to users:

- Add a horizontal banner section at the top of DiscoverScreen (above the search bar) — similar to a promotional carousel.
- Admin can configure these banners via admin panel (simple collection: `platformBanners`).
- Each banner links to a deep-link that pre-fills the coupon code on the booking confirmation screen.
- This is where "PLAY50 — ₹50 off your first booking" type messaging lives.

**`platformBanners` document:**
```json
{
  "imageUrl": "...",
  "title": "₹50 Off First Booking",
  "couponCode": "PLAY50",
  "validTo": "2026-12-31",
  "isActive": true
}
```

---

## 11. Security Rules Additions

```javascript
// coupons:
//   - read: any authenticated user (to validate codes)
//   - create/delete: admin only
//   - update: admin can update any field;
//             owner/manager can ONLY update companyStatus on their own company's coupons

match /coupons/{couponId} {
  allow read: if request.auth != null;
  allow create: if isAdmin();
  allow update: if isAdmin() ||
    (isMOrAbove() &&
     resource.data.companyId == getUserCompanyId() &&
     // company can only touch companyStatus — no other field changes allowed
     request.resource.data.diff(resource.data).affectedKeys().hasOnly(["companyStatus", "updatedAt"]));
  allow delete: if isAdmin();
}

// couponUsages:
//   - read: admin, or the user who owns the usage, or company manager/owner
//   - write: only via Cloud Function or transaction (backend-enforced)
match /couponUsages/{usageId} {
  allow read: if isAdmin() || 
    resource.data.userId == request.auth.uid ||
    (isMOrAbove() && resource.data.companyId == getUserCompanyId());
  allow write: if false; // only Cloud Functions or server-side transactions
}
```

---

## 12. Implementation Phases

### Phase 1 — Data Layer & Validation Engine ✅
- [x] Create `coupons` and `couponUsages` Firestore collections with test data (`functions/seedCoupons.js`)
- [x] Write `src/utils/couponUtils.js` — `calculateDiscount`, `isCouponEffectivelyActive`, `buildCouponBookingPayload`, `buildEmptyCoupon`
- [x] Write `src/services/firebase/coupons.js` — `validateCouponForBooking`, `getTurfCoupons`, `getCompanyCoupons`, `setCompanyCouponStatus`
- [x] Update booking creation transaction to include coupon recording (`firestore.js` — both native and web SDK paths)
- [x] Add `coupon: buildEmptyCoupon()` and `discountAmount`/`finalAmount` to booking schema (`BookingConfirmationScreen.js`)

### Phase 2 — BookingConfirmationScreen Integration ✅
- [x] Add coupon input field to BookingConfirmationScreen (coupon card with TextInput + Apply button)
- [x] Wire up validation and price recalculation on the UI (`handleApplyCoupon` → `validateCouponForBooking` → `setAppliedCoupon` → `priceBreakdown` memo recomputes)
- [x] Update price breakdown display to show discount line (green "Discount (CODE) − ₹X" row)
- [x] Handle both advance and no-advance scenarios (advance recalculated on discounted total; no-advance total auto-updates)

### Phase 3 — Discover Page Offers ✅
- [x] Add `getTurfCoupons()` call in TurfDetailScreen (fetched inside `fetchTurfDetails` after turf data loads)
- [x] Build "Offers & Deals" horizontal scroll section in TurfDetailScreen (`TurfOfferCard` with copy-code button, discount label, validity countdown)
- [ ] Offers badge on turf browsing cards — deferred: DiscoverScreen shows marketing `offers` collection, not turf listings; badge belongs on HomeScreen/SearchScreen turf cards (different screen scope)
- [x] Add platform banner carousel to DiscoverScreen (`platformBanners` Firestore collection; tap copies coupon code to clipboard)

### Phase 4 — Chat Booking Integration ✅
- [x] Add `applyCouponToExistingBooking` to `coupons.js` — atomic transaction: re-validates coupon, records usage, updates existing booking fields
- [x] Add coupon step in chat booking payment flow — `CashfreePaymentScreen` now starts with `PHASE.COUPON` for negotiated bookings, before order creation
- [x] Validate and record coupon usage for chat bookings — `handleApplyCoupon` validates, `handleProceedFromCoupon` calls `applyCouponToExistingBooking` atomically then creates Cashfree order with discounted advance
- [x] `ChatScreen.handlePayNow` updated to pass `totalAmount`, `companyId`, `turfId`, `isNegotiatedBooking: true`
- Note: Only platform coupons apply (turf coupons blocked by `isNegotiatedBooking: true` validation check)

### Phase 5 — Owner/Manager App Screens ✅
- [x] `CompanyCouponToggleScreen` created (`src/screens/owner/CompanyCouponToggleScreen.js`) — shared by both owner and manager
- [x] Registered in `OwnerNavigator` and `ManagerNavigator` as `"CompanyCouponToggle"`
- [x] Added "Offers & Coupons" item to `OwnerSettingsScreen` Business section and `manager/SettingsScreen` Turf Management section
- [x] Toggle calls `setCompanyCouponStatus` (writes `companyStatus` only) with optimistic UI update + revert on failure
- [x] Admin override: if `status !== "active"`, toggle is disabled + shows "Paused by PlayGrid" / "Expired" banner
- [x] LIVE badge shown when both `status === "active"` AND `companyStatus === "active"`
- [x] Empty state + "Contact PlayGrid support" message when no coupons assigned

### Phase 6 — Admin Panel ✅ (already complete)
- [x] `/config/coupons` — list page with channel/status/company/date filters + bulk actions
- [x] `/config/coupons/new` — create coupon form (platform + turf, real-time code availability check)
- [x] `/config/coupons/[id]` — edit form + inline analytics (stats cards, 30-day line chart, top turfs bar chart)
- [x] `/config/coupons/[id]/usages` — dedicated usage history page with CSV export
- [x] `/config/banners` + `/new` + `/[id]` — platform banner management
- [x] All queries, mutations, types, sidebar links already wired

### Phase 7 — Cloud Functions ✅
- [x] `expireCoupons` — `onSchedule("0 0 * * *", IST)` — expires both `active` and `paused` coupons past their `validTo`; batch-commits in chunks of 400
- [x] `onCouponUsageCreate` — `onDocumentCreated("couponUsages/{usageId}")` — notifies company owners via FCM when their turf coupon is used (platform coupons skipped — PlayGrid absorbs that cost)
- [x] `validateCouponHTTPS` — `onCall` — all 8 validation steps server-side; returns stripped coupon (no admin fields); prevents client-side spoofing of usage counts
- [x] `coupon_used` notification type added to `notificationHelpers.js` → navigates to Settings screen
- [x] All three registered in `functions/index.js`

---

## 13. Edge Cases & Gotchas

| Scenario | Handling |
|----------|----------|
| User applies coupon, but another user exhausts the limit before they confirm | The booking transaction re-checks `usageCount` inside the transaction. The second user's transaction will fail and they see "Coupon limit reached." |
| Coupon expires between code entry and confirmation | Re-check `validTo` inside the transaction. |
| Discount amount > total amount | `calculateDiscount` clamps discount to `totalAmount` so final amount is never negative. |
| Platform coupon applied to no-advance turf in chat booking | Valid — coupon saved as voucher, no online payment, user shows at venue. |
| Turf coupon code entered for a different turf | Validation check 4 catches this: turfId mismatch → "Coupon not valid for this turf." |
| Manager applies coupon on behalf of user (admin action) | Not supported in V1. Only the user applying their own coupon during booking is supported. |
| Refund/cancellation with coupon | The coupon usage is NOT reversed on cancellation (standard policy — prevents coupon farming). The coupon document's `usageCount` stays incremented. Document this in T&Cs. |
| Coupon code is case-insensitive | Always `.trim().toUpperCase()` on input before lookup. Store codes in UPPERCASE. |

---

## 14. File Locations Summary

### App (Turf-1701)
```
src/
  utils/
    couponUtils.js              ← NEW: validation & calculation engine
  services/firebase/
    coupons.js                  ← NEW: Firestore operations for coupons
  screens/user/
    BookingConfirmationScreen.js ← EDIT: add coupon input + discount display
    BookingDetailScreen.js       ← EDIT: add coupon voucher card
    PaymentConfirmationScreen.js ← EDIT: add platform coupon input for chat bookings
    DiscoverScreen.js            ← EDIT: add platform banner carousel
  screens/user/turf/
    TurfDetailScreen.js          ← EDIT: add Offers & Deals section
  screens/owner/
    CompanyCouponToggleScreen.js ← NEW: toggle-only view for assigned coupons
  screens/manager/
    (reuses CompanyCouponToggleScreen — same screen, same logic)
  components/
    coupons/
      CouponInputField.js        ← NEW: reusable coupon input + apply button
      CouponVoucherCard.js       ← NEW: voucher display for pay-at-venue bookings
      TurfOfferCard.js           ← NEW: offer card for TurfDetailScreen
```

### Admin Panel (turf-admin-panel)
```
src/
  pages/
    CouponListPage.jsx           ← NEW
    CouponFormPage.jsx           ← NEW
    CouponDetailPage.jsx         ← NEW
    BannerManagementPage.jsx     ← NEW
  services/
    couponService.js             ← NEW: Firestore reads/writes for admin
  components/
    coupons/
      CouponTable.jsx            ← NEW
      CouponFilters.jsx          ← NEW
      CouponAnalyticsCard.jsx    ← NEW
```

### Cloud Functions (functions/)
```
functions/
  src/
    coupons/
      expireCoupons.js           ← NEW: scheduled expiry
      onCouponUsageCreate.js     ← NEW: notification trigger
      validateCouponHTTPS.js     ← NEW: server-side validation callable
  index.js                       ← EDIT: export new functions
```
