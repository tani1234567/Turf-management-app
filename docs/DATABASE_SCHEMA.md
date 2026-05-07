# Turf-1701 — Database Schema Reference

> **Backend:** Cloud Firestore (NoSQL document database)
> **Project ID:** `sowin-power`
> **Auth:** Firebase Phone Auth (OTP)
> **Storage:** Firebase Storage (images, receipts, payment proofs)

---

## Collections Overview

| # | Collection | Description | Sub-collections |
|---|---|---|---|
| 1 | `users` | All app users (every role) | — |
| 2 | `companies` | Business entities (owner-created) | — |
| 3 | `turfs` | Turf locations with embedded grounds | — |
| 4 | `bookings` | Booking records | — |
| 5 | `chats` | Chat threads (user ↔ company) | `messages` |
| 6 | `notifications` | Per-user push notification records | — |
| 7 | `reviews` | User reviews for turfs | — |
| 8 | `expenses` | Operational expense records | — |
| 9 | `blocked_slots` | Manager-blocked time ranges | — |
| 10 | `academies` | Academy programme records | — |
| 11 | `maintenance_logs` | Caretaker maintenance reports | — |
| 12 | `turf_requests` | Manager requests to add new turfs | — |

---

## Collection Relationships

```
users ──────────────────────────────────────────────────────────────┐
  │ companyId                                                        │
  ▼                                                                  │
companies                                                           │
  │ (turfs belong to company)                                        │
  ▼                                                                  │
turfs                                                               │
  │ (grounds embedded as array)                                      │
  │                                                                  │
  ├──► bookings ◄─── users (userId)                                  │
  │       │                                                          │
  │       ├── reviews ◄─── users (userId)                            │
  │       └── (payment proofs → Firebase Storage)                    │
  │                                                                  │
  ├──► blocked_slots                                                 │
  ├──► academies                                                     │
  ├──► maintenance_logs ◄─── users (caretaker)                       │
  └──► turf_requests ◄─── users (manager)                           │
                                                                     │
chats ◄───────────────────── users (userId) ◄───────────────────────┘
  │ companyId
  └─► messages (sub-collection)

notifications ◄─── users (userId, one doc per notification)
expenses ◄─── turfs (turfId) + users (addedBy)
```

---

## 1. `users` Collection

**Document ID:** Firebase Auth UID

```
users/{userId}
```

| Field | Type | Description |
|---|---|---|
| `userId` | string | Firebase Auth UID (mirrors doc ID) |
| `phone` | string | Phone number used for OTP login |
| `name` | string | Display name |
| `email` | string \| null | Email address |
| `avatar` | string \| null | Profile image URL (Firebase Storage) |
| `role` | string | `user` \| `caretaker` \| `manager` \| `owner` \| `admin` |
| `isNewUser` | boolean | `true` until profile setup is complete |
| `companyId` | string \| null | Links to `companies/{id}` — null for role `user` |
| `createdAt` | timestamp | Account creation time |
| `updatedAt` | timestamp | Last profile update |

### Role-specific fields

#### Caretaker fields
| Field | Type | Description |
|---|---|---|
| `isAssigned` | boolean | Whether assigned to a turf |
| `assignedTurfId` | string \| null | `turfs/{id}` they manage |

#### Manager fields
| Field | Type | Description |
|---|---|---|
| `assignedTurfIds` | string[] | Turf IDs they can access (empty = none) |
| `selectedTurfId` | string \| null | Currently active turf (persisted) |

#### Owner fields
| Field | Type | Description |
|---|---|---|
| `managedTurfIds` | string[] | Specific turfs they manage (empty = all company turfs) |
| `hasOperationalPermissions` | boolean | Grants access to manager-style operations mode |
| `selectedTurfId` | string \| null | Currently active turf |

#### Suspension fields
| Field | Type | Description |
|---|---|---|
| `isSuspended` | boolean | Account suspension flag |
| `suspendedAt` | timestamp \| null | When suspended |
| `suspendedBy` | string \| null | Admin userId who suspended |
| `suspensionReason` | string \| null | Reason text |
| `canBeDeletedAfter` | timestamp \| null | Grace period end for auto-deletion |

#### Payment fraud tracking (on user doc)
| Field | Type | Description |
|---|---|---|
| `paymentHistory.totalSubmissions` | number | Total payment proofs submitted |
| `paymentHistory.verifiedPayments` | number | Payments successfully verified |
| `paymentHistory.rejectedPayments` | number | Payments rejected by managers |
| `paymentHistory.consecutiveRejections` | number | Current streak of rejections |
| `paymentHistory.lastRejectionDate` | timestamp | Last rejection timestamp |
| `paymentHistory.isBanned` | boolean | Banned from booking |
| `paymentHistory.banReason` | string \| null | Reason for ban |
| `paymentHistory.banStartDate` | timestamp \| null | — |
| `paymentHistory.banEndDate` | timestamp \| null | null = permanent ban |
| `paymentHistory.bannedBy` | string | `"system"` or admin userId |

#### User-only fields
| Field | Type | Description |
|---|---|---|
| `wishlistedTurfIds` | string[] | Turf IDs the user has wishlisted |

#### FCM / notifications
| Field | Type | Description |
|---|---|---|
| `fcmTokens` | map | `{ [deviceId]: tokenString }` — push notification tokens per device |

---

## 2. `companies` Collection

**Document ID:** Auto-generated

```
companies/{companyId}
```

| Field | Type | Description |
|---|---|---|
| `name` | string | Business name |
| `inviteCode` | string | 8-char alphanumeric code for managers/caretakers to join |
| `ownerId` | string | `users/{id}` of the owner |
| `createdAt` | timestamp | — |
| `updatedAt` | timestamp | — |

### Stats sub-object
| Field | Type | Description |
|---|---|---|
| `stats.totalTurfs` | number | Count of turfs |
| `stats.totalGrounds` | number | Count of grounds across all turfs |
| `stats.totalBookings` | number | Lifetime booking count |
| `stats.totalRevenue` | number | Lifetime revenue (₹) |
| `stats.activeUsers` | number | Users who have booked at least once |

### Team arrays
| Field | Type | Description |
|---|---|---|
| `managers` | string[] | Array of manager userIds |
| `caretakers` | string[] | Array of caretaker userIds |
| `unassignedCaretakers` | string[] | Caretakers not yet assigned to a turf |

### Subscription sub-object
| Field | Type | Description |
|---|---|---|
| `subscription.status` | string | `trial` \| `active` \| `expired` \| `grace_period` |
| `subscription.trialStartDate` | timestamp | — |
| `subscription.trialEndDate` | timestamp | — |
| `subscription.subscriptionStartDate` | timestamp \| null | — |
| `subscription.subscriptionEndDate` | timestamp \| null | — |
| `subscription.gracePeriodEndDate` | timestamp \| null | After expiry, 7-day window |
| `subscription.totalGrounds` | number | Grounds billed |
| `subscription.pricePerGroundMonthly` | number | ₹ rate |
| `subscription.totalMonthlyFee` | number | ₹ before discounts |
| `subscription.discount` | number | Discount percentage applied |

### Fraud prevention
| Field | Type | Description |
|---|---|---|
| `verifiedTransactions` | array | `[{ txnId, date, amount, bookingId }]` — used to prevent transaction ID reuse |

---

## 3. `turfs` Collection

**Document ID:** Auto-generated

```
turfs/{turfId}
```

| Field | Type | Description |
|---|---|---|
| `name` | string | Turf display name |
| `description` | string \| null | About the turf |
| `companyId` | string | `companies/{id}` |
| `isActive` | boolean | Visible to users |
| `rating` | number | Average star rating (auto-calculated from reviews) |
| `reviewCount` | number | Count of active reviews |
| `totalGrounds` | number | Count of ground objects in `grounds[]` |
| `coverImage` | string \| null | Hero image URL |
| `images` | string[] | Additional image URLs |
| `amenities` | string[] | Merged amenities from all grounds |
| `createdAt` | timestamp | — |
| `updatedAt` | timestamp | — |

### Location sub-object
| Field | Type | Description |
|---|---|---|
| `location.address` | string | Street address |
| `location.city` | string | City name |
| `location.state` | string \| null | State |
| `location.pincode` | string \| null | PIN code |
| `location.coordinates.lat` | number \| null | Latitude |
| `location.coordinates.lng` | number \| null | Longitude |
| `location.googleMapsLink` | string \| null | Direct Maps link |

### Operating hours
| Field | Type | Description |
|---|---|---|
| `operatingHours` | map | `{ openTime: "HH:MM", closeTime: "HH:MM" }` |

### Embedded `grounds` array

Each element in `grounds[]`:

| Field | Type | Description |
|---|---|---|
| `groundId` | string | e.g. `ground_0`, `ground_1` |
| `groundName` | string | Display name (e.g. "Ground A") |
| `sport` | string | Primary sport |
| `amenities` | string[] | Ground-specific amenities |
| `images` | string[] | Ground image URLs |
| `pricing.allDayRate` | number \| null | Flat all-day rate (₹) |
| `pricing.weekday.morning.rate` | number | ₹/hr, 06:00–10:00 |
| `pricing.weekday.afternoon.rate` | number | ₹/hr, 10:00–18:00 |
| `pricing.weekday.evening.rate` | number | ₹/hr, 18:00–23:00 |
| `pricing.weekend.morning.rate` | number | ₹/hr, 06:00–10:00 |
| `pricing.weekend.afternoon.rate` | number | ₹/hr, 10:00–18:00 |
| `pricing.weekend.evening.rate` | number | ₹/hr, 18:00–23:00 |

---

## 4. `bookings` Collection

**Document ID:** Auto-generated (created via Firestore transaction to prevent double-booking)

```
bookings/{bookingId}
```

### Core identifiers
| Field | Type | Description |
|---|---|---|
| `userId` | string | `users/{id}` of the booker |
| `userName` | string | Display name snapshot |
| `userPhone` | string | Phone snapshot |
| `userEmail` | string | Email snapshot |
| `companyId` | string | `companies/{id}` |
| `turfId` | string | `turfs/{id}` |
| `turfName` | string | Snapshot at booking time |
| `groundId` | string | Ground within the turf |
| `groundName` | string | Ground name snapshot |

### Booking details
| Field | Type | Description |
|---|---|---|
| `bookingType` | string | `regular` \| `academy` \| `walk_in` |
| `sport` | string | Sport being played |
| `date` | string | `YYYY-MM-DD` |
| `startTime` | string | `HH:MM` |
| `endTime` | string | `HH:MM` |
| `totalDuration` | number | Hours (float) |
| `timeSlots` | array | `[{ startTime, endTime, duration, hourlyRate, amount }]` — per-period breakdown |

### Pricing
| Field | Type | Description |
|---|---|---|
| `baseAmount` | number | Original price at standard rate (₹) |
| `totalAmount` | number | Final price after negotiation (₹) |
| `totalPrice` | number | Alias for `totalAmount` (legacy) |

### Status
| Field | Type | Description |
|---|---|---|
| `status` | string | See status values below |
| `statusHistory` | array | `[{ status, timestamp, changedBy, changedByRole, reason }]` |
| `createdAt` | timestamp | — |
| `requestedAt` | timestamp | — |
| `confirmedAt` | timestamp \| null | — |
| `updatedAt` | timestamp | — |

**Status values:**
```
pending → confirmed → in_progress → completed
       ↘ rejected
       → pending_payment → payment_submitted → confirmed (auto)
                        → payment_rejected   (user retries)
       → cancelled
```

### Flags
| Field | Type | Description |
|---|---|---|
| `hasReview` | boolean | Set to `true` after user writes a review |
| `reviewId` | string \| null | `reviews/{id}` reference |
| `approvedBy` | string \| null | UserId of manager who approved |
| `approvedAt` | string \| null | ISO timestamp |

### Negotiation sub-object
| Field | Type | Description |
|---|---|---|
| `negotiation.isNegotiated` | boolean | Was price negotiated via chat? |
| `negotiation.requestedPrice` | number | Price the user requested (₹) |
| `negotiation.finalPrice` | number | Agreed final price (₹) |
| `negotiation.chatId` | string | `chats/{id}` where negotiation happened |
| `negotiation.negotiationCardId` | string | `messages/{id}` of the negotiation card |

### Payment sub-object
| Field | Type | Description |
|---|---|---|
| `payment.slotAmount` | number | Total booking amount (₹) |
| `payment.advanceAmount` | number | Advance payment required (₹) |
| `payment.remainingAmount` | number | Balance after advance (₹) |
| `payment.advancePaid` | boolean | — |
| `payment.remainingPaid` | boolean | — |
| `payment.totalPaid` | number | Running total paid (₹) |
| `payment.totalPending` | number | Amount still owed (₹) |
| `payment.isFullyPaid` | boolean | — |

#### `payment.advanceConfig` sub-object
| Field | Type | Description |
|---|---|---|
| `payment.advanceConfig.isRequired` | boolean | — |
| `payment.advanceConfig.percentage` | number | % of total as advance |
| `payment.advanceConfig.paymentTiming` | string | `before_approval` \| `after_approval` |
| `payment.advanceConfig.paymentTimeout` | number | Minutes before advance expires |

#### `payment.advance` sub-object
| Field | Type | Description |
|---|---|---|
| `payment.advance.status` | string | `pending` \| `submitted` \| `verified` \| `rejected` \| `expired` \| `not_required` |
| `payment.advance.method` | string | `upi` |
| `payment.advance.upiId` | string \| null | UPI ID to pay to |
| `payment.advance.upiHolderName` | string \| null | — |
| `payment.advance.paymentDeadline` | string | ISO timestamp for payment expiry |
| `payment.advance.submittedAt` | timestamp \| null | When user submitted proof |
| `payment.advance.isExpired` | boolean | — |

#### `payment.advance.upiDetails` (set when submitted)
| Field | Type | Description |
|---|---|---|
| `transactionId` | string | UPI transaction reference |
| `paidToUpiId` | string | UPI ID payment was sent to |
| `paidFromUpiId` | string \| null | Sender UPI ID (optional) |
| `amount` | number | Amount paid (₹) |
| `paidAt` | string | ISO timestamp of payment |
| `screenshotUrl` | string | Firebase Storage URL of proof screenshot |

#### `payment.advance.verification` (set when verified/rejected)
| Field | Type | Description |
|---|---|---|
| `isVerified` | boolean | — |
| `verifiedBy` | string | Manager userId |
| `verifiedByRole` | string | `manager` \| `owner` |
| `verifiedAt` | timestamp | — |
| `verificationNote` | string | Optional note |
| `rejectionReason` | string \| null | — |
| `attemptNumber` | number | Which attempt this is |

### Payment attempts history
| Field | Type | Description |
|---|---|---|
| `paymentAttempts` | array | `[{ attemptNumber, transactionId, screenshotUrl, submittedAt, status, rejectionReason? }]` |

### Slot lock sub-object
| Field | Type | Description |
|---|---|---|
| `slotLock.isLocked` | boolean | Is slot currently locked? |
| `slotLock.lockType` | string \| null | `soft` (TTL 10 min) \| `hard` (permanent until status change) |
| `slotLock.lockedAt` | string \| null | ISO timestamp |
| `slotLock.lockExpiry` | string \| null | ISO timestamp — null means no expiry (hard lock) |
| `slotLock.lockReason` | string \| null | `payment_pending` \| `payment_submitted` \| `approved` \| `awaiting_advance_payment` |

---

## 5. `chats` Collection + `messages` Sub-collection

### `chats/{chatId}`

| Field | Type | Description |
|---|---|---|
| `status` | string | `active` \| `archived` |
| `hasActiveNegotiation` | boolean | Is a negotiation card currently pending/countered? |
| `createdAt` | timestamp | — |
| `updatedAt` | timestamp | — |

#### `participants` sub-object
| Field | Type | Description |
|---|---|---|
| `participants.user.userId` | string | — |
| `participants.user.name` | string | Snapshot |
| `participants.user.phone` | string | Snapshot |
| `participants.user.avatar` | string \| null | — |
| `participants.company.companyId` | string | — |
| `participants.company.name` | string | Snapshot |
| `participants.company.avatar` | string \| null | — |
| `participants.company.turfManagerIds` | string[] | Manager userIds for this company |

#### `lastMessage` sub-object
| Field | Type | Description |
|---|---|---|
| `lastMessage.text` | string | Preview text |
| `lastMessage.senderId` | string | — |
| `lastMessage.senderType` | string | `user` \| `manager` |
| `lastMessage.timestamp` | timestamp | — |
| `lastMessage.type` | string | Message type |

#### `unreadCount` map
| Field | Type | Description |
|---|---|---|
| `unreadCount.[userId]` | number | Unread count for the user |
| `unreadCount.company` | number | Unread count for company/manager side |

---

### `chats/{chatId}/messages/{messageId}`

| Field | Type | Description |
|---|---|---|
| `type` | string | `text` \| `negotiation_card` \| `booking_card` \| `payment_request_card` \| `location` \| `image` |
| `senderId` | string | — |
| `senderType` | string | `user` \| `manager` |
| `senderName` | string | — |
| `timestamp` | timestamp | Message sent time |
| `read` | boolean | — |

#### For `type: "text"`
| Field | Type | Description |
|---|---|---|
| `text` | string | Message body |

#### For `type: "image"`
| Field | Type | Description |
|---|---|---|
| `imageUrl` | string | Firebase Storage URL |
| `text` | string | Empty string |

#### For `type: "location"`
| Field | Type | Description |
|---|---|---|
| `location.turfId` | string | — |
| `location.turfName` | string | — |
| `location.address` | string | — |
| `location.city` | string | — |
| `location.googleMapsLink` | string | — |
| `location.coordinates` | object \| null | `{ lat, lng }` |

#### For `type: "negotiation_card"`
| Field | Type | Description |
|---|---|---|
| `negotiationCard.turfId` | string | — |
| `negotiationCard.turfName` | string | — |
| `negotiationCard.groundId` | string | — |
| `negotiationCard.groundName` | string | — |
| `negotiationCard.companyId` | string \| null | — |
| `negotiationCard.sport` | string | — |
| `negotiationCard.date` | string | `YYYY-MM-DD` |
| `negotiationCard.startTime` | string | `HH:MM` |
| `negotiationCard.endTime` | string | `HH:MM` |
| `negotiationCard.duration` | number \| null | Hours |
| `negotiationCard.originalPrice` | number | Standard price (₹) |
| `negotiationCard.requestedPrice` | number | Offered price (₹) |
| `negotiationCard.isNegotiation` | boolean | — |
| `negotiationCard.senderId` | string | — |
| `negotiationCard.senderName` | string | — |
| `negotiationCard.senderType` | string | — |
| `negotiationCard.senderPhone` | string | — |
| `negotiationCard.senderEmail` | string | — |
| `negotiationCard.message` | string | Optional note |
| `negotiationCard.status` | string | `pending` \| `accepted` \| `rejected` \| `countered` \| `expired` |
| `negotiationCard.counterPrice` | number \| null | Manager counter-offer (₹) |
| `negotiationCard.respondedBy` | string \| null | — |
| `negotiationCard.respondedByName` | string \| null | — |
| `negotiationCard.respondedAt` | timestamp \| null | — |
| `negotiationCard.bookingId` | string \| null | Set when accepted → booking created |
| `negotiationCard.expiredAt` | timestamp \| null | Set when slot taken by another user |
| `negotiationCard.expiredReason` | string \| null | — |

#### For `type: "booking_card"`
| Field | Type | Description |
|---|---|---|
| `bookingCard.bookingId` | string | — |
| `bookingCard.turfId` | string | — |
| `bookingCard.turfName` | string | — |
| `bookingCard.groundId` | string | — |
| `bookingCard.groundName` | string | — |
| `bookingCard.sport` | string | — |
| `bookingCard.date` | string | `YYYY-MM-DD` |
| `bookingCard.startTime` | string | `HH:MM` |
| `bookingCard.endTime` | string | `HH:MM` |
| `bookingCard.totalAmount` | number | ₹ |
| `bookingCard.status` | string | `pending` \| `confirmed` \| `rejected` |
| `bookingCard.respondedAt` | timestamp \| null | — |

#### For `type: "payment_request_card"`
| Field | Type | Description |
|---|---|---|
| `paymentRequestCard.bookingId` | string | — |
| `paymentRequestCard.turfId` | string | — |
| `paymentRequestCard.turfName` | string | — |
| `paymentRequestCard.groundId` | string \| null | — |
| `paymentRequestCard.groundName` | string \| null | — |
| `paymentRequestCard.sport` | string \| null | — |
| `paymentRequestCard.date` | string \| null | — |
| `paymentRequestCard.startTime` | string \| null | — |
| `paymentRequestCard.endTime` | string \| null | — |
| `paymentRequestCard.totalAmount` | number | ₹ |
| `paymentRequestCard.advanceAmount` | number | ₹ advance required |
| `paymentRequestCard.paymentDeadline` | string | ISO timestamp |
| `paymentRequestCard.upiId` | string \| null | — |
| `paymentRequestCard.upiHolderName` | string \| null | — |
| `paymentRequestCard.qrCodeUrl` | string \| null | — |
| `paymentRequestCard.companyId` | string \| null | — |
| `paymentRequestCard.status` | string | `pending` \| `paid` \| `approved_without_payment` \| `expired` |
| `paymentRequestCard.respondedAt` | timestamp \| null | — |

---

## 6. `notifications` Collection

**Document ID:** Auto-generated

```
notifications/{notificationId}
```

| Field | Type | Description |
|---|---|---|
| `userId` | string | Recipient `users/{id}` |
| `type` | string | `booking` \| `payment` \| `message` \| `maintenance_report` \| `system` |
| `title` | string | Notification title |
| `body` | string | Notification body text |
| `relatedId` | string \| null | ID of related document (e.g. bookingId) |
| `relatedType` | string \| null | Type of related document (e.g. `"maintenance_log"`) |
| `turfId` | string \| null | Context turf |
| `turfName` | string \| null | — |
| `isRead` | boolean | `false` until user views it |
| `createdAt` | timestamp | — |

---

## 7. `reviews` Collection

**Document ID:** Auto-generated

```
reviews/{reviewId}
```

| Field | Type | Description |
|---|---|---|
| `turfId` | string | `turfs/{id}` |
| `companyId` | string | `companies/{id}` |
| `bookingId` | string \| null | `bookings/{id}` the review is for |
| `userId` | string | `users/{id}` who wrote it |
| `userName` | string | Snapshot |
| `rating` | number | 1–5 stars |
| `text` | string | Review body |
| `status` | string | `active` \| `flagged` \| `removed` |
| `createdAt` | timestamp | — |
| `updatedAt` | timestamp | — |

### Manager response
| Field | Type | Description |
|---|---|---|
| `response` | string \| null | Manager's public reply |
| `respondedBy` | string \| null | Manager userId |
| `respondedByName` | string \| null | — |
| `respondedByRole` | string \| null | `manager` \| `owner` |
| `respondedAt` | string \| null | ISO timestamp |

### Flag fields (set when flagged)
| Field | Type | Description |
|---|---|---|
| `flaggedBy` | string \| null | userId who flagged |
| `flaggedByName` | string \| null | — |
| `flaggedByRole` | string \| null | — |
| `flagReason` | string \| null | — |
| `flaggedAt` | string \| null | ISO timestamp |

---

## 8. `expenses` Collection

**Document ID:** Auto-generated

```
expenses/{expenseId}
```

| Field | Type | Description |
|---|---|---|
| `companyId` | string | `companies/{id}` |
| `turfId` | string | `turfs/{id}` |
| `category` | string | e.g. `maintenance`, `utilities`, `staff_salary`, `equipment`, `cleaning`, `marketing`, `rent`, `insurance`, `other` |
| `subcategory` | string \| null | Sub-category within category |
| `amount` | number | ₹ |
| `date` | string | `YYYY-MM-DD` |
| `description` | string \| null | Notes |
| `receiptUrls` | string[] | Firebase Storage URLs of receipt images |
| `addedBy` | string | `users/{id}` who logged it |
| `addedByRole` | string | `caretaker` \| `manager` \| `owner` |
| `addedByName` | string | Snapshot |
| `createdAt` | timestamp | — |
| `updatedAt` | timestamp | — |

---

## 9. `blocked_slots` Collection

**Document ID:** Auto-generated

```
blocked_slots/{blockId}
```

| Field | Type | Description |
|---|---|---|
| `turfId` | string | `turfs/{id}` |
| `groundId` | string \| null | null = block applies to all grounds |
| `startDate` | string | `YYYY-MM-DD` |
| `endDate` | string | `YYYY-MM-DD` (same as startDate for single day) |
| `startTime` | string | `HH:MM` |
| `endTime` | string | `HH:MM` |
| `allDay` | boolean | Block entire operating day |
| `reason` | string | Display reason (e.g. "Maintenance") |
| `reasonType` | string | Category of reason |
| `timeSlots` | array | `[{ startTime, endTime }]` — populated when not allDay |
| `blockedBy` | string | Manager userId |
| `blockedByName` | string | Snapshot |
| `blockedByRole` | string | `manager` \| `owner` |

### Recurring block fields
| Field | Type | Description |
|---|---|---|
| `recurringDays` | string[] | e.g. `["monday", "wednesday"]` |
| `recurringEndDate` | string | `YYYY-MM-DD` — last recurrence date |

---

## 10. `academies` Collection

**Document ID:** Auto-generated

```
academies/{academyId}
```

| Field | Type | Description |
|---|---|---|
| `name` | string | Academy name |
| `sport` | string | Sport |
| `turfId` | string | `turfs/{id}` |
| `turfName` | string | Snapshot |
| `groundId` | string | Ground within the turf |
| `groundName` | string | Snapshot |
| `contactName` | string | Academy contact person |
| `contactPhone` | string | — |
| `status` | string | `active` \| `paused` \| `expired` \| `completed` |
| `sessionCount` | number | Total sessions to generate |
| `sessionsGenerated` | boolean | Cloud Function sets this after generating sessions |
| `createdBy` | string | Manager userId |
| `createdByName` | string | Snapshot |
| `createdAt` | timestamp | — |
| `updatedAt` | timestamp | — |

### Contract sub-object
| Field | Type | Description |
|---|---|---|
| `contract.startDate` | string | `YYYY-MM-DD` |
| `contract.endDate` | string | `YYYY-MM-DD` |
| `contract.durationMonths` | number | — |

### Payment sub-object
| Field | Type | Description |
|---|---|---|
| `payment.totalAmount` | number | ₹ total contract value |
| `payment.cashAmount` | number | ₹ paid in cash |
| `payment.onlineAmount` | number | ₹ paid online |

### Schedule sub-object
| Field | Type | Description |
|---|---|---|
| `schedule.days` | array | `[{ day: "monday", startTime, endTime }]` |

---

## 11. `maintenance_logs` Collection

**Document ID:** Auto-generated

```
maintenance_logs/{logId}
```

| Field | Type | Description |
|---|---|---|
| `turfId` | string | `turfs/{id}` |
| `turfName` | string | Snapshot |
| `groundId` | string | Affected ground |
| `groundName` | string | Snapshot |
| `issueType` | string | e.g. `lighting`, `surface`, `equipment`, `plumbing`, `cleaning` |
| `issueTypeLabel` | string | Display label |
| `description` | string | Detailed description (min 10 chars) |
| `priority` | string | `low` \| `medium` \| `high` \| `critical` |
| `priorityLabel` | string | Display label |
| `photos` | string[] | Firebase Storage URLs of photos |
| `status` | string | `pending` \| `in_progress` \| `resolved` \| `closed` |
| `reportedBy` | string | Caretaker userId |
| `reportedByName` | string | Snapshot |
| `reportedByPhone` | string \| null | — |
| `createdAt` | timestamp | — |
| `updatedAt` | timestamp | — |

### Resolution fields (set when resolved)
| Field | Type | Description |
|---|---|---|
| `resolvedBy` | string \| null | Manager/owner userId |
| `resolvedByName` | string \| null | — |
| `resolvedAt` | timestamp \| null | — |
| `resolutionNotes` | string \| null | — |

---

## 12. `turf_requests` Collection

**Document ID:** Auto-generated

Manager-submitted requests to add a new turf, pending owner approval.

```
turf_requests/{requestId}
```

| Field | Type | Description |
|---|---|---|
| `companyId` | string | `companies/{id}` |
| `requestedBy` | string | Manager userId |
| `requestedByName` | string | Snapshot |
| `status` | string | `pending` \| `approved` \| `rejected` |
| `createdAt` | timestamp | — |
| `updatedAt` | timestamp | — |

### Proposed turf data sub-object
| Field | Type | Description |
|---|---|---|
| `turfData.name` | string | Proposed turf name |
| `turfData.description` | string \| null | — |
| `turfData.coverImage` | string \| null | — |
| `turfData.images` | string[] | — |
| `turfData.location.address` | string \| null | — |
| `turfData.location.city` | string | — |
| `turfData.location.state` | string \| null | — |
| `turfData.location.pincode` | string \| null | — |
| `turfData.location.coordinates.lat` | number \| null | — |
| `turfData.location.coordinates.lng` | number \| null | — |
| `turfData.location.googleMapsLink` | string \| null | — |
| `turfData.operatingHours` | map | `{ openTime, closeTime }` |
| `turfData.grounds` | array | Array of ground objects (same shape as `turfs.grounds[]`) |
| `turfData.amenities` | string[] | — |
| `turfData.totalGrounds` | number | — |

---

## Firebase Storage Structure

```
Firebase Storage (sowin-power.firebasestorage.app)
├── bookings/{bookingId}/
│   └── payment_proof_{timestamp}.jpg      ← UPI payment screenshots
│
├── expenses/{expenseId}/
│   └── receipt_{timestamp}_{index}.jpg    ← Expense receipts
│
├── chats/{chatId}/images/
│   └── chat_{timestamp}.jpg               ← Images shared in chat
│
├── turfs/{turfId}/
│   └── (turf and ground images)           ← Managed via turfImages.js
│
└── maintenance/
    └── (maintenance report photos)
```

---

## Firestore Indexes Required

| Collection | Fields | Order | Use Case |
|---|---|---|---|
| `bookings` | `turfId`, `date`, `status` | — | Slot availability check |
| `bookings` | `userId`, `createdAt` | desc | User booking history |
| `bookings` | `companyId`, `date` | — | Manager calendar view |
| `chats` | `participants.user.userId`, `updatedAt` | desc | User chat list |
| `chats` | `participants.company.companyId`, `updatedAt` | desc | Company chat list |
| `chats/{id}/messages` | `timestamp` | asc | Message thread |
| `notifications` | `userId`, `createdAt` | desc | Notification feed |
| `reviews` | `turfId`, `status`, `createdAt` | desc | Turf review list |
| `expenses` | `turfId`, `date` | desc | Turf expense list |
| `expenses` | `companyId`, `date` | desc | Company expense report |
| `blocked_slots` | `turfId` | — | Calendar / availability |
| `academies` | `turfId`, `status` | — | Academy list |
| `maintenance_logs` | `turfId`, `status` | — | Maintenance queue |
| `turf_requests` | `companyId`, `status` | — | Owner approval queue |

---

## Firestore Security Rules (Current — Development Only)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

> **Warning:** These rules allow any authenticated user to read/write all documents. Production rules must restrict access per role and document ownership before launch.

---

## Data Integrity Notes

- **Booking atomicity:** All booking creations use `runTransaction()` — slot conflict checks and document writes are atomic.
- **Fraud prevention:** `companies.verifiedTransactions[]` stores all verified UPI transaction IDs to block reuse. User consecutive rejections auto-ban after 3 strikes.
- **Slot locks:** `bookings.slotLock` embedded directly on the booking document. Soft locks expire after 10 minutes; hard locks have no expiry and are cleared only on status change.
- **Rating calculation:** `turfs.rating` and `turfs.reviewCount` are recalculated on every review add/remove via `reviews.js:updateTurfRating()`.
- **Subscription enforcement:** `companies.subscription.status` is updated by scheduled Cloud Functions daily; clients read this field to gate features.
- **Ground IDs:** Legacy format `ground-0` and current format `ground_0` are normalized before comparison using `normalizeGroundId()` — both are equivalent in all availability checks.
