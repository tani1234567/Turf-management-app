# 🏟️ TURF MANAGEMENT SYSTEM - V2.1 UPDATE PLAN

## 📋 UPDATE OVERVIEW

This document contains updates and enhancements to the Master Plan V2. These changes should be integrated into the existing development without disrupting current progress.

**Current Development Status:** Prompt 15 (as per user's progress)
**Update Version:** V2.1
**Date Created:** February 2026

---

## 🎯 SUMMARY OF V2.1 CHANGES

| # | Feature | Description | Impact Level |
|---|---------|-------------|--------------|
| 1 | **Configurable Advance Payment** | Per-turf advance payment settings with timing options | High |
| 2 | **Zero-Fee UPI Payments** | Direct UPI payments to owner with manual verification | High |
| 3 | **Slot Locking Mechanism** | Prevents double booking when advance payment enabled | Critical |
| 4 | **Manager Turf Requests** | Manager can request to add turfs (Owner approves) | Medium |
| 5 | **Turf Edit Logs** | All turf edits by manager are logged | Low |
| 6 | **Owner Operations FAB** | Floating button for owners with operational permissions | Low |
| 7 | **Enhanced Booking Status Flow** | New statuses for payment verification workflow | High |
| 8 | **Payment Verification System** | Manager verifies UPI payments with screenshot proof | High |
| 9 | **Fraud Prevention** | Track failed payment attempts, ban system | Medium |

---

## 🔐 SLOT LOCKING MECHANISM

### Problem Solved
Without slot locking, two users could pay advance for the same slot, forcing manager to manually refund one user.

### Solution: Two-Tier Locking

| Lock Type | Duration | Trigger | Release |
|-----------|----------|---------|---------|
| **Soft Lock** | 10 minutes | User clicks "Pay & Book" | Payment submitted OR timeout |
| **Hard Lock** | Until resolved | Payment submitted | Confirmed/Rejected/Cancelled |

### Lock Behavior by Status

| Status | Lock | Others See |
|--------|------|------------|
| `pending_payment` | Soft (10 min) | "Try again in 10 mins" |
| `payment_submitted` | Hard | "Slot not available" |
| `awaiting_payment` | Hard | "Slot not available" |
| `pending` (no advance) | None | Can book |
| `expired` | None | Can book |

### Schema Addition
```javascript
// In bookings/{bookingId}
slotLock: {
  isLocked: true,
  lockType: "soft",           // "soft" | "hard"
  lockedAt: timestamp,
  lockExpiry: timestamp,      // Only for soft lock
  lockReason: "payment_pending"
}
```

---

## 📊 DATABASE SCHEMA UPDATES

### 1. UPDATED: companies/{companyId}

Add the following fields to existing `companies` collection:

```javascript
// companies/{companyId} - ADD THESE FIELDS
{
  // ... existing fields remain unchanged ...
  
  // NEW: Payment Configuration
  paymentConfig: {
    // UPI Details (Primary - Zero Fee)
    upiEnabled: true,
    upiId: "greenarena@ybl",                    // Owner's UPI ID
    upiQrCode: "gs://bucket/companies/companyId/upi_qr.png", // Uploaded QR image
    upiHolderName: "Green Sports Arena",        // Display name for payments
    
    // Bank Details (For reference/alternative)
    bankDetails: {
      accountNumber: "1234567890",
      ifscCode: "HDFC0001234",
      accountHolderName: "Green Sports Arena Pvt Ltd",
      bankName: "HDFC Bank"
    },
    
    // Razorpay (Optional - only for subscription payments)
    razorpayEnabled: false,
    razorpayAccountId: null,
    
    // Settings
    preferredPaymentMethod: "upi",              // "upi" | "razorpay" | "both"
    
    updatedAt: timestamp,
    updatedBy: "ownerId"
  },
  
  // NEW: Track verified UPI transactions (prevent reuse)
  verifiedTransactions: [
    {
      txnId: "123456789012",
      date: "2026-01-15",
      amount: 1500,
      bookingId: "bookingId"
    }
    // Keep last 90 days of transactions
  ]
}
```

### 2. UPDATED: turfs/{turfId}

Add/modify the following fields in existing `turfs` collection:

```javascript
// turfs/{turfId} - ADD/MODIFY THESE FIELDS
{
  // ... existing fields remain unchanged ...
  
  // MODIFIED: Created by (now supports manager requests)
  createdBy: "ownerId",                         // or "managerId" if created via request
  createdByRole: "owner",                       // "owner" | "manager"
  
  // NEW: If created by manager request
  creationRequest: {
    requestedBy: "managerId",                   // null if owner created directly
    requestedAt: timestamp,
    approvedBy: "ownerId",
    approvedAt: timestamp
  },
  
  // NEW: Advance Payment Configuration (Manager can edit)
  advancePayment: {
    isRequired: false,                          // false = user can choose, true = mandatory
    percentage: 50,                             // 0, 10, 25, 50, 100
    paymentTiming: "before_approval",           // "before_approval" | "after_approval"
    paymentTimeout: 120,                        // minutes (max 2 hours, only for after_approval)
    
    // Payment method preference
    allowedMethods: ["upi", "cash_at_venue"],   // Available options for user
    
    // Tracking
    lastUpdatedBy: "managerId",
    lastUpdatedAt: timestamp
  }
}
```

### 3. NEW COLLECTION: turf_requests/{requestId}

```javascript
// turf_requests/{requestId} - NEW COLLECTION
{
  requestId: "auto-generated",
  companyId: "companyId",
  
  // Requester
  requestedBy: "managerId",
  requestedByName: "Rahul Manager",
  requestedAt: timestamp,
  
  // Turf Details (same structure as turf document)
  turfData: {
    name: "Green Arena - Powai",
    location: {
      address: "456, Hiranandani Gardens, Powai",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400076",
      googleMapsLink: "https://maps.google.com/?q=...",
      coordinates: { latitude: 19.1176, longitude: 72.9060 }
    },
    operatingHours: {
      monday: { isOpen: true, openTime: "06:00", closeTime: "23:00" },
      // ... other days
    },
    images: ["gs://..."],
    coverImage: "gs://...",
    grounds: [
      {
        groundId: "ground-1",
        name: "Ground-1",
        sports: ["cricket", "football"],
        pricing: { /* ... */ },
        amenities: ["floodlights", "parking"],
        isActive: true
      }
    ],
    amenities: ["parking", "restrooms"],
    advancePayment: {
      isRequired: true,
      percentage: 50,
      paymentTiming: "after_approval",
      paymentTimeout: 120,
      allowedMethods: ["upi", "cash_at_venue"]
    }
  },
  
  // Status
  status: "pending",                            // pending | approved | rejected
  
  // If approved
  approvedBy: "ownerId",
  approvedAt: timestamp,
  createdTurfId: "turfId",                      // Reference to created turf
  
  // If rejected
  rejectedBy: "ownerId",
  rejectedAt: timestamp,
  rejectionReason: "Location too close to existing turf",
  
  // Metadata
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### 4. NEW COLLECTION: turf_edit_logs/{logId}

```javascript
// turf_edit_logs/{logId} - NEW COLLECTION
{
  logId: "auto-generated",
  turfId: "turfId",
  companyId: "companyId",
  
  // Who made the change
  editedBy: "managerId",
  editedByRole: "manager",                      // "manager" | "owner"
  editedByName: "Rahul Manager",
  
  // What changed
  editType: "pricing_update",                   // pricing_update | timing_update | advance_settings | ground_added | ground_removed | details_update | images_update
  
  // Change details
  changes: {
    field: "grounds[0].pricing.cricket.weekday.evening.hourlyRate",
    oldValue: 1500,
    newValue: 1800,
    summary: "Updated cricket evening rate from ₹1500 to ₹1800"
  },
  
  // Timestamp
  editedAt: timestamp
}
```

### 5. UPDATED: bookings/{bookingId}

Replace the `payment` section with enhanced version:

```javascript
// bookings/{bookingId} - REPLACE payment SECTION
{
  // ... existing fields remain unchanged ...
  
  // UPDATED: Status (new values added)
  status: "pending",
  // NEW Status values:
  // "pending_payment"     - User needs to pay advance (before_approval flow)
  // "payment_submitted"   - User submitted payment proof, waiting verification
  // "awaiting_payment"    - Approved, waiting for payment (after_approval flow)
  // "payment_rejected"    - Payment verification failed
  // "expired"             - Payment timeout (after_approval flow)
  // Existing: "pending" | "confirmed" | "in_progress" | "completed" | "cancelled" | "rejected"
  
  // REPLACED: Payment section (complete replacement)
  payment: {
    // Slot pricing
    slotAmount: 3000,                           // What owner set (total booking amount)
    
    // Advance config (copied from turf at booking time)
    advanceConfig: {
      isRequired: true,
      percentage: 50,
      paymentTiming: "after_approval",          // "before_approval" | "after_approval"
      paymentTimeout: 120                       // minutes
    },
    
    // Calculated amounts
    advanceAmount: 1500,                        // 50% of slotAmount
    remainingAmount: 1500,                      // To be paid at venue
    
    // Advance Payment Details
    advance: {
      status: "pending",                        // "pending" | "submitted" | "verified" | "rejected" | "not_required"
      method: "upi",                            // "upi" | "cash" | "not_applicable"
      
      // UPI Payment Details (filled by user)
      upiDetails: {
        transactionId: "123456789012",          // 12-digit UPI ref number
        paidToUpiId: "greenarena@ybl",
        paidFromUpiId: "user@paytm",            // Optional
        amount: 1500,
        paidAt: timestamp,                      // User enters approximate time
        screenshotUrl: "gs://bucket/bookings/bookingId/payment_proof.jpg"
      },
      
      // Verification (by manager)
      verification: {
        isVerified: false,
        verifiedBy: "managerId",
        verifiedByRole: "manager",              // "manager" | "owner"
        verifiedAt: timestamp,
        verificationNote: "Payment confirmed in bank statement",
        
        // If rejected
        rejectionReason: "Transaction ID not found",
        attemptNumber: 1                        // Track which attempt this was
      },
      
      submittedAt: timestamp,                   // When user submitted proof
      
      // Payment timeout (only if paymentTiming = "after_approval")
      paymentDeadline: timestamp,               // approvedAt + paymentTimeout minutes
      isExpired: false                          // true if deadline passed without payment
    },
    
    // On-ground Payment (at venue - collected by caretaker)
    onGround: {
      status: "pending",                        // "pending" | "collected" | "partial"
      cashAmount: 0,
      onlineAmount: 0,                          // If they pay remaining via UPI at venue
      totalCollected: 0,
      collectedBy: "caretakerId",
      collectedAt: timestamp,
      notes: ""
    },
    
    // Refund tracking (if booking rejected after payment)
    refund: {
      isRequired: false,
      refundAmount: 0,
      refundReason: "",
      refundStatus: "not_required",             // "not_required" | "pending" | "completed"
      refundMethod: "",                         // "upi" (manual by owner)
      refundedBy: "ownerId",
      refundedAt: null,
      refundNote: ""
    },
    
    // Totals
    totalPaid: 0,
    totalPending: 3000,
    isFullyPaid: false
  },
  
  // NEW: Payment attempt tracking (for fraud prevention)
  paymentAttempts: [
    {
      attemptNumber: 1,
      transactionId: "123456789012",
      screenshotUrl: "gs://...",
      submittedAt: timestamp,
      status: "rejected",                       // "submitted" | "verified" | "rejected"
      rejectionReason: "Transaction ID not found"
    }
  ],
  
  // ... rest of existing fields remain unchanged ...
}
```

### 6. UPDATED: users/{userId}

Add fraud prevention tracking for users:

```javascript
// users/{userId} - ADD THESE FIELDS
{
  // ... existing fields remain unchanged ...
  
  // NEW: Payment history tracking (for fraud prevention)
  paymentHistory: {
    totalSubmissions: 25,
    verifiedPayments: 23,
    rejectedPayments: 2,
    lastRejectionDate: timestamp,
    consecutiveRejections: 0,                   // Reset on successful payment
    
    // Ban status
    isBanned: false,
    banReason: "",
    banStartDate: null,
    banEndDate: null,                           // null = permanent, date = temporary
    bannedBy: "adminId"
  }
}
```

---

## 🔄 UPDATED BOOKING STATUS FLOW

### Complete Status Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        BOOKING STATUS FLOW V2.1                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    NO ADVANCE REQUIRED                               │   │
│  │                                                                     │   │
│  │  User books → "pending" → Manager approves → "confirmed"            │   │
│  │                    ↓                                                │   │
│  │              Manager rejects → "rejected"                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │              ADVANCE REQUIRED - BEFORE APPROVAL                      │   │
│  │                                                                     │   │
│  │  User selects slot                                                  │   │
│  │        ↓                                                            │   │
│  │  "pending_payment" ← User must pay advance first                    │   │
│  │        ↓                                                            │   │
│  │  User pays UPI + submits proof                                      │   │
│  │        ↓                                                            │   │
│  │  "payment_submitted" ← Waiting for manager verification             │   │
│  │        ↓                                                            │   │
│  │  ┌─────────────┬─────────────────┐                                  │   │
│  │  │ VERIFIED    │ NOT VERIFIED    │                                  │   │
│  │  │     ↓       │       ↓         │                                  │   │
│  │  │ "pending"   │ "payment_       │ ← Can retry (max 3 attempts)     │   │
│  │  │     ↓       │  rejected"      │                                  │   │
│  │  │ ┌───────┬───────┐             │                                  │   │
│  │  │ │APPROVE│REJECT │             │                                  │   │
│  │  │ │   ↓   │   ↓   │             │                                  │   │
│  │  │ │"conf- │"rejec-│ ← Refund    │                                  │   │
│  │  │ │irmed" │ted"   │   tracked   │                                  │   │
│  │  └─┴───────┴───────┴─────────────┘                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │              ADVANCE REQUIRED - AFTER APPROVAL                       │   │
│  │                                                                     │   │
│  │  User selects slot                                                  │   │
│  │        ↓                                                            │   │
│  │  "pending" ← No payment yet, waiting for approval                   │   │
│  │        ↓                                                            │   │
│  │  ┌─────────────┬─────────────────┐                                  │   │
│  │  │ APPROVE     │ REJECT          │                                  │   │
│  │  │     ↓       │    ↓            │                                  │   │
│  │  │ "awaiting_  │ "rejected"      │                                  │   │
│  │  │  payment"   │                 │                                  │   │
│  │  │     ↓       │                 │                                  │   │
│  │  │ Timer starts (120 min max)    │                                  │   │
│  │  │     ↓                         │                                  │   │
│  │  │ ┌─────────────┬─────────────┐ │                                  │   │
│  │  │ │ USER PAYS   │ TIMEOUT     │ │                                  │   │
│  │  │ │     ↓       │     ↓       │ │                                  │   │
│  │  │ │ "payment_   │ "expired"   │ │ ← Slot released                  │   │
│  │  │ │ submitted"  │             │ │                                  │   │
│  │  │ │     ↓       │             │ │                                  │   │
│  │  │ │ VERIFY →    │             │ │                                  │   │
│  │  │ │ "confirmed" │             │ │                                  │   │
│  │  └─┴─────────────┴─────────────┴─┘                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    CONFIRMED → COMPLETION                            │   │
│  │                                                                     │   │
│  │  "confirmed" → Booking time arrives → "in_progress"                 │   │
│  │                                              ↓                      │   │
│  │                              Caretaker collects remaining           │   │
│  │                                              ↓                      │   │
│  │                                        "completed"                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    CANCELLATION (Any Stage)                          │   │
│  │                                                                     │   │
│  │  Any status → User/Manager cancels → "cancelled"                    │   │
│  │                                          ↓                          │   │
│  │                              If advance paid → Track refund         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Status Definitions

| Status | Description | Who Can Change | Next Possible States |
|--------|-------------|----------------|---------------------|
| `pending_payment` | User selected slot, must pay advance (before_approval) | User (pays) | `payment_submitted`, `cancelled` |
| `payment_submitted` | User paid & submitted proof, waiting verification | Manager (verify) | `pending`, `payment_rejected` |
| `payment_rejected` | Payment verification failed | User (retry) | `payment_submitted` (retry), `cancelled` |
| `pending` | Waiting for manager approval | Manager (approve/reject) | `confirmed`, `rejected`, `awaiting_payment` |
| `awaiting_payment` | Approved, user must pay within timeout (after_approval) | User (pays), System (timeout) | `payment_submitted`, `expired` |
| `expired` | Payment timeout - slot released | None (terminal) | - |
| `confirmed` | Booking confirmed, ready for play | System (time), User (cancel) | `in_progress`, `cancelled` |
| `in_progress` | User is currently playing | Caretaker (complete) | `completed` |
| `completed` | Booking finished | None (terminal) | - |
| `rejected` | Manager rejected booking | None (terminal) | - |
| `cancelled` | Cancelled by user/manager | None (terminal) | - |

---

## 🔐 SECURITY RULES UPDATES

Add these rules to existing Firestore security rules:

```javascript
// ADD TO EXISTING SECURITY RULES

// Turf Requests collection
match /turf_requests/{requestId} {
  // Managers can create requests for their company
  allow create: if isManager() && 
    belongsToCompany(request.resource.data.companyId);
  
  // Managers can read their own requests
  allow read: if isSignedIn() && (
    belongsToCompany(resource.data.companyId) ||
    request.auth.uid == resource.data.requestedBy
  );
  
  // Only owners can approve/reject
  allow update: if isCompanyOwner(resource.data.companyId);
  
  // Only owners can delete
  allow delete: if isCompanyOwner(resource.data.companyId);
}

// Turf Edit Logs collection
match /turf_edit_logs/{logId} {
  // Managers and owners can read logs for their company
  allow read: if (isManager() || isOwner()) && 
    belongsToCompany(resource.data.companyId);
  
  // Only system (Cloud Functions) or authorized users can create
  allow create: if isSignedIn() && (
    (isManager() && canManageTurf(request.resource.data.turfId)) ||
    (hasOperationalPermissions() && belongsToCompany(request.resource.data.companyId))
  );
  
  // No updates or deletes allowed (immutable audit log)
  allow update: if false;
  allow delete: if isAdmin();
}
```

---

## 📱 NEW/UPDATED SCREENS

### New Screens to Add

| Screen | Location | Description |
|--------|----------|-------------|
| `PaymentSettingsScreen.js` | `src/screens/owner/` | Owner configures UPI details |
| `UpiPaymentScreen.js` | `src/screens/user/` | User pays via UPI deep link |
| `PaymentConfirmationScreen.js` | `src/screens/user/` | User submits payment proof |
| `PaymentSubmittedScreen.js` | `src/screens/user/` | Confirmation after submission |
| `VerifyPaymentScreen.js` | `src/screens/manager/` | Manager verifies payment |
| `TurfRequestScreen.js` | `src/screens/manager/` | Manager submits turf request |
| `PendingTurfRequestsScreen.js` | `src/screens/owner/` | Owner views/approves turf requests |
| `TurfEditLogsScreen.js` | `src/screens/owner/` | Owner views turf edit history |
| `AdvancePaymentSettingsScreen.js` | `src/screens/manager/` | Manager configures advance settings |

### Updated Screens

| Screen | Changes |
|--------|---------|
| `OwnerDashboardScreen.js` | Add pending turf requests section, FAB for operations mode |
| `ManagerDashboardScreen.js` | Add "Request New Turf" button |
| `BookingScreen.js` | Handle advance payment config, show UPI payment option |
| `BookingManagementScreen.js` | Add payment verification workflow |
| `TurfSettingsScreen.js` | Add advance payment configuration section |
| `CompanySettingsScreen.js` | Add payment configuration section |

---

## 📂 NEW FILES TO CREATE

### Utility Files

```
src/utils/upiUtils.js          - UPI deep link generation
src/utils/paymentUtils.js      - Payment calculations
```

### API Files

```
src/api/firebase/payments.js   - Payment-related Firestore operations
src/api/firebase/turfRequests.js - Turf request operations
```

### Component Files

```
src/components/payment/UpiQRDisplay.js
src/components/payment/PaymentProofUpload.js
src/components/payment/PaymentStatusBadge.js
src/components/payment/AdvancePaymentConfig.js
src/components/turf/TurfRequestCard.js
```

---

## ⚡ CLOUD FUNCTIONS UPDATES

### New Cloud Functions

#### 1. Payment Verification Reminder (Every 30 mins check)

```javascript
// functions/src/paymentFunctions.js

exports.checkPendingPaymentVerifications = functions.pubsub
  .schedule('*/30 * * * *') // Every 30 minutes
  .timeZone('Asia/Kolkata')
  .onRun(async (context) => {
    // Find bookings with status "payment_submitted" 
    // that have been waiting > 30 mins since last reminder
    
    const pendingBookings = await admin.firestore()
      .collection('bookings')
      .where('status', '==', 'payment_submitted')
      .get();
    
    for (const doc of pendingBookings.docs) {
      const booking = doc.data();
      const submittedAt = booking.payment.advance.submittedAt?.toDate();
      
      if (!submittedAt) continue;
      
      const minutesSinceSubmission = (Date.now() - submittedAt.getTime()) / (1000 * 60);
      
      // Send reminder every 30 minutes
      if (minutesSinceSubmission >= 30) {
        const reminderCount = Math.floor(minutesSinceSubmission / 30);
        
        // Notify turf managers
        await notifyTurfManagers(booking.turfId, {
          type: 'payment_verification_pending',
          title: '⏳ Payment Pending Verification',
          body: `${booking.userName}'s payment of ₹${booking.payment.advanceAmount} needs verification (waiting ${Math.floor(minutesSinceSubmission)} mins)`,
          data: { bookingId: doc.id }
        });
        
        // After 2 hours, escalate to owner
        if (minutesSinceSubmission >= 120) {
          await notifyOwners(booking.companyId, {
            type: 'payment_verification_escalation',
            title: '🚨 Urgent: Payment Verification Overdue',
            body: `${booking.userName}'s payment pending verification for over 2 hours`,
            data: { bookingId: doc.id }
          });
        }
      }
    }
  });
```

#### 2. Payment Timeout Handler (For after_approval flow)

```javascript
exports.checkPaymentTimeouts = functions.pubsub
  .schedule('*/5 * * * *') // Every 5 minutes
  .timeZone('Asia/Kolkata')
  .onRun(async (context) => {
    const now = admin.firestore.Timestamp.now();
    
    // Find bookings that are awaiting payment and past deadline
    const expiredBookings = await admin.firestore()
      .collection('bookings')
      .where('status', '==', 'awaiting_payment')
      .where('payment.advance.paymentDeadline', '<=', now)
      .get();
    
    for (const doc of expiredBookings.docs) {
      const booking = doc.data();
      
      // Update status to expired
      await doc.ref.update({
        status: 'expired',
        'payment.advance.isExpired': true,
        'statusHistory': admin.firestore.FieldValue.arrayUnion({
          status: 'expired',
          timestamp: new Date().toISOString(),
          changedBy: 'system',
          reason: 'Payment timeout - slot released'
        }),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // Notify user
      await sendNotification(booking.userId, {
        type: 'booking_expired',
        title: 'Booking Expired ⏰',
        body: `Your booking for ${booking.turfName} expired due to payment timeout. The slot is now available for others.`
      });
      
      // Notify manager
      await notifyTurfManagers(booking.turfId, {
        type: 'booking_expired',
        title: 'Booking Payment Expired',
        body: `${booking.userName}'s booking expired. Slot is now available.`
      });
    }
  });
```

#### 3. Turf Request Approval Handler

```javascript
exports.onTurfRequestUpdated = functions.firestore
  .document('turf_requests/{requestId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    
    // Only trigger if status changed to approved
    if (before.status !== 'approved' && after.status === 'approved') {
      const batch = admin.firestore().batch();
      
      // Create turf document from request data
      const turfRef = admin.firestore().collection('turfs').doc();
      const turfData = {
        ...after.turfData,
        turfId: turfRef.id,
        companyId: after.companyId,
        createdBy: after.requestedBy,
        createdByRole: 'manager',
        creationRequest: {
          requestedBy: after.requestedBy,
          requestedAt: after.requestedAt,
          approvedBy: after.approvedBy,
          approvedAt: after.approvedAt
        },
        managerIds: [after.requestedBy], // Auto-assign requesting manager
        caretakerIds: [],
        isActive: true,
        isVerified: false,
        rating: 0,
        totalReviews: 0,
        stats: {
          totalBookings: 0,
          totalRevenue: 0,
          utilizationRate: 0
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      batch.set(turfRef, turfData);
      
      // Update manager's assigned turfs
      const managerRef = admin.firestore().collection('users').doc(after.requestedBy);
      batch.update(managerRef, {
        assignedTurfIds: admin.firestore.FieldValue.arrayUnion(turfRef.id)
      });
      
      // Update company stats
      const companyRef = admin.firestore().collection('companies').doc(after.companyId);
      const totalGrounds = after.turfData.grounds?.length || 0;
      batch.update(companyRef, {
        'stats.totalTurfs': admin.firestore.FieldValue.increment(1),
        'stats.totalGrounds': admin.firestore.FieldValue.increment(totalGrounds)
      });
      
      // Update request with created turf ID
      batch.update(change.after.ref, {
        createdTurfId: turfRef.id
      });
      
      await batch.commit();
      
      // Notify manager
      await sendNotification(after.requestedBy, {
        type: 'turf_request_approved',
        title: 'Turf Request Approved! 🎉',
        body: `Your request for "${after.turfData.name}" has been approved. You can now manage bookings.`
      });
    }
    
    // If rejected
    if (before.status !== 'rejected' && after.status === 'rejected') {
      await sendNotification(after.requestedBy, {
        type: 'turf_request_rejected',
        title: 'Turf Request Not Approved',
        body: `Your request for "${after.turfData.name}" was not approved. Reason: ${after.rejectionReason || 'No reason provided'}`
      });
    }
  });
```

#### 4. Turf Edit Logger

```javascript
exports.onTurfUpdated = functions.firestore
  .document('turfs/{turfId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const turfId = context.params.turfId;
    
    // Skip if no actual changes or if it's a system update
    if (JSON.stringify(before) === JSON.stringify(after)) return;
    
    // Get the user who made the change (from metadata or lastUpdatedBy field)
    const editedBy = after.lastUpdatedBy || after.updatedBy;
    if (!editedBy) return; // System update, no logging needed
    
    // Detect what changed
    const changes = detectChanges(before, after);
    
    if (changes.length === 0) return;
    
    // Get user details
    const userDoc = await admin.firestore().collection('users').doc(editedBy).get();
    const userData = userDoc.data();
    
    // Create log entries for each change
    const batch = admin.firestore().batch();
    
    for (const change of changes) {
      const logRef = admin.firestore().collection('turf_edit_logs').doc();
      batch.set(logRef, {
        logId: logRef.id,
        turfId: turfId,
        companyId: after.companyId,
        editedBy: editedBy,
        editedByRole: userData?.role || 'unknown',
        editedByName: userData?.name || 'Unknown',
        editType: change.type,
        changes: {
          field: change.field,
          oldValue: change.oldValue,
          newValue: change.newValue,
          summary: change.summary
        },
        editedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    
    await batch.commit();
  });

function detectChanges(before, after) {
  const changes = [];
  
  // Check pricing changes
  if (JSON.stringify(before.grounds) !== JSON.stringify(after.grounds)) {
    changes.push({
      type: 'pricing_update',
      field: 'grounds',
      oldValue: 'previous pricing',
      newValue: 'updated pricing',
      summary: 'Ground/pricing configuration updated'
    });
  }
  
  // Check operating hours
  if (JSON.stringify(before.operatingHours) !== JSON.stringify(after.operatingHours)) {
    changes.push({
      type: 'timing_update',
      field: 'operatingHours',
      oldValue: 'previous hours',
      newValue: 'updated hours',
      summary: 'Operating hours updated'
    });
  }
  
  // Check advance payment settings
  if (JSON.stringify(before.advancePayment) !== JSON.stringify(after.advancePayment)) {
    changes.push({
      type: 'advance_settings',
      field: 'advancePayment',
      oldValue: before.advancePayment,
      newValue: after.advancePayment,
      summary: 'Advance payment settings updated'
    });
  }
  
  // Check basic details
  if (before.name !== after.name) {
    changes.push({
      type: 'details_update',
      field: 'name',
      oldValue: before.name,
      newValue: after.name,
      summary: `Name changed from "${before.name}" to "${after.name}"`
    });
  }
  
  return changes;
}
```

---

## 🔔 NEW NOTIFICATION TYPES

Add these to existing notification types:

| Type | Recipient | Trigger | Priority |
|------|-----------|---------|----------|
| `payment_verification_pending` | Manager | Payment submitted, needs verification | High |
| `payment_verification_escalation` | Owner | Payment pending > 2 hours | Critical |
| `payment_verified` | User | Manager verified payment | High |
| `payment_rejected` | User | Manager couldn't verify payment | High |
| `booking_awaiting_payment` | User | Booking approved, pay within timeout | High |
| `booking_expired` | User, Manager | Payment timeout | Medium |
| `payment_reminder` | User | 10/30/60 mins before payment deadline | Medium |
| `turf_request_created` | Owner | Manager submitted turf request | Medium |
| `turf_request_approved` | Manager | Owner approved turf request | High |
| `turf_request_rejected` | Manager | Owner rejected turf request | Medium |

---

## 📅 UPDATED DEVELOPMENT PROMPTS

### Integration Strategy

These updates should be integrated into existing development. Here's how each week's prompts should be modified:

---

### WEEK 3-4 UPDATES: Owner - Company & Turf Registration

**Additional Tasks:**
- Add UPI payment configuration to company setup
- Add UPI QR code upload functionality
- Create `PaymentSettingsScreen.js` for owner

**Modified Deliverables:**
- ✅ Owner can configure UPI payment details
- ✅ UPI QR code upload working

---

### WEEK 5-6 UPDATES: User - Turf Discovery & Booking

**Additional Tasks:**
- Check turf's advance payment config before booking
- Implement UPI payment flow:
  - Show UPI deep link button
  - Show QR code fallback
  - Create payment confirmation screen
  - Implement screenshot upload
- Handle both payment timing flows (before/after approval)

**Modified Deliverables:**
- ✅ UPI payment flow complete
- ✅ Payment proof submission working
- ✅ Both payment timing modes working

---

### WEEK 7-8 UPDATES: Manager - Booking Management

**Additional Tasks:**
- Add payment verification screen
- Show payment proof in booking details
- Implement verify/reject payment workflow
- Add "Request New Turf" functionality
- Create turf request form

**Modified Deliverables:**
- ✅ Manager can verify UPI payments
- ✅ Manager can request new turfs
- ✅ Payment verification workflow complete

---

### WEEK 12 UPDATES: Payment Integration

**Replace Razorpay Tasks with:**
- Keep Razorpay ONLY for subscription payments (owner pays for service)
- Remove Razorpay from booking advance payments
- Implement UPI direct payment system
- Create payment verification Cloud Functions
- Implement payment timeout handler
- Implement fraud prevention (max 3 attempts)

**Modified Deliverables:**
- ✅ UPI payment system complete
- ✅ Payment verification working
- ✅ Timeout handling working
- ✅ Fraud prevention active
- ✅ Razorpay for subscriptions only

---

### NEW WEEK 14.5 ADDITION: Manager Turf Management

**Tasks:**
- Create turf request submission flow
- Create owner turf request approval screen
- Implement turf edit logging
- Add advance payment settings screen for manager
- Create turf edit logs viewer for owner

**Deliverables:**
- ✅ Manager can request new turfs
- ✅ Owner can approve/reject turf requests
- ✅ All turf edits are logged
- ✅ Manager can configure advance payment

---

## 🎨 UI/UX SPECIFICATIONS

### UPI Payment Screen Layout

```
┌─────────────────────────────────────────┐
│  ← PAY VIA UPI                          │
├─────────────────────────────────────────┤
│                                         │
│  Pay ₹1,500 to Green Sports Arena       │
│                                         │
│  ┌─────────────────────────────────────┐│
│  │     [📱 Pay ₹1,500 via UPI]         ││  ← Primary CTA (opens UPI app)
│  │     Opens your default UPI app       ││
│  └─────────────────────────────────────┘│
│                                         │
│  Or pay using                           │
│  ┌────────┐ ┌────────┐ ┌────────┐      │
│  │ [GPay] │ │[PhonePe]│ │[Paytm] │      │  ← App shortcuts
│  └────────┘ └────────┘ └────────┘      │
│                                         │
│  ─────────── OR SCAN QR ───────────     │
│                                         │
│  ┌─────────────────────────────────────┐│
│  │         ╔═══════════════╗           ││
│  │         ║   [QR CODE]   ║           ││
│  │         ╚═══════════════╝           ││
│  │     Scan with any UPI app           ││
│  └─────────────────────────────────────┘│
│                                         │
│  Manual Details                         │
│  UPI ID: greenarena@ybl     [📋 Copy]   │
│  Amount: ₹1,500             [📋 Copy]   │
│                                         │
│  ┌─────────────────────────────────────┐│
│  │     [✓ I've Made the Payment]       ││  ← Goes to confirmation
│  └─────────────────────────────────────┘│
│                                         │
└─────────────────────────────────────────┘
```

### Payment Confirmation Screen Layout

```
┌─────────────────────────────────────────┐
│  ← CONFIRM PAYMENT                      │
├─────────────────────────────────────────┤
│                                         │
│  UPI Transaction ID *                   │
│  ┌─────────────────────────────────────┐│
│  │ 123456789012                        ││
│  └─────────────────────────────────────┘│
│  💡 Find in UPI app → Transaction History│
│                                         │
│  Where to find Transaction ID?          │
│  [GPay help] [PhonePe help] [Paytm help]│
│                                         │
│  Payment Screenshot *                   │
│  ┌─────────────────────────────────────┐│
│  │  [📷 Take Photo] [🖼️ Gallery]       ││
│  └─────────────────────────────────────┘│
│  📸 Must show: Amount, UPI ID, Txn ID   │
│                                         │
│  Payment Summary                        │
│  ───────────────────────────────────    │
│  Amount Paid           ₹1,500           │
│  Paid To               Green Sports     │
│  ───────────────────────────────────    │
│                                         │
│  ┌─────────────────────────────────────┐│
│  │     [Submit for Verification]       ││
│  └─────────────────────────────────────┘│
│                                         │
│  ⚠️ False details → Account suspension  │
│                                         │
└─────────────────────────────────────────┘
```

### Manager Payment Verification Screen

```
┌─────────────────────────────────────────┐
│  ← VERIFY PAYMENT                       │
├─────────────────────────────────────────┤
│                                         │
│  👤 Rahul Kumar                         │
│  📞 +91 98765 43210                     │
│                                         │
│  📅 15 Jan 2026 • 17:00 - 19:00         │
│  🏏 Cricket • Ground-1                  │
│  💰 Total: ₹3,000                       │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  💳 PAYMENT DETAILS                     │
│  Amount:          ₹1,500                │
│  UPI ID:          greenarena@ybl        │
│  Transaction ID:  123456789012          │
│  Submitted:       10 mins ago           │
│                                         │
│  📸 PAYMENT PROOF                       │
│  ┌─────────────────────────────────────┐│
│  │     [Payment Screenshot]            ││
│  │     [🔍 View Full Size]             ││
│  └─────────────────────────────────────┘│
│                                         │
│  ✓ Check UPI app/bank to verify         │
│                                         │
│  ┌─────────────────────────────────────┐│
│  │  [✓ Payment Verified - Approve]     ││  ← Green
│  └─────────────────────────────────────┘│
│                                         │
│  ┌─────────────────────────────────────┐│
│  │  [✗ Payment Not Found - Reject]     ││  ← Red
│  └─────────────────────────────────────┘│
│                                         │
└─────────────────────────────────────────┘
```

### Owner Dashboard - Turf Requests Section

```
┌─────────────────────────────────────────┐
│  OWNER DASHBOARD                        │
├─────────────────────────────────────────┤
│                                         │
│  ⚠️ PENDING TURF REQUESTS (2)           │  ← NEW SECTION
│  ┌─────────────────────────────────────┐│
│  │ 🏟️ Green Arena - Powai             ││
│  │    Requested by: Rahul (Manager)    ││
│  │    2 grounds • Cricket, Football    ││
│  │    [View] [✓ Approve] [✗ Reject]    ││
│  └─────────────────────────────────────┘│
│                                         │
│  📊 Company Overview                    │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │ Revenue │ │ Turfs   │ │ Bookings│   │
│  │ ₹3.5L   │ │   3     │ │   450   │   │
│  └─────────┘ └─────────┘ └─────────┘   │
│                                         │
│  ... rest of dashboard ...              │
│                                         │
│                          ╭─────────────╮│
│                          │ 🔧 Ops Mode ││  ← FAB (if operational permissions)
│                          ╰─────────────╯│
└─────────────────────────────────────────┘
```

---

## 📋 HELPER IMAGES REQUIRED

Create these helper images for payment guidance:

1. `gpay-txn-help.png` - Screenshot showing where to find Transaction ID in Google Pay
2. `phonepe-txn-help.png` - Screenshot showing where to find Transaction ID in PhonePe
3. `paytm-txn-help.png` - Screenshot showing where to find Transaction ID in Paytm
4. `gpay-icon.png` - Google Pay app icon (40x40)
5. `phonepe-icon.png` - PhonePe app icon (40x40)
6. `paytm-icon.png` - Paytm app icon (40x40)

---

## ✅ TESTING CHECKLIST FOR V2.1 FEATURES

### UPI Payment Flow Testing

- [ ] UPI deep link opens on Android
- [ ] UPI deep link opens on iOS
- [ ] QR code displays correctly
- [ ] Copy UPI ID works
- [ ] Copy amount works
- [ ] Screenshot upload from camera
- [ ] Screenshot upload from gallery
- [ ] Transaction ID validation
- [ ] Payment submission creates correct booking status
- [ ] Manager receives verification notification

### Payment Verification Testing

- [ ] Manager can view payment proof
- [ ] Manager can approve payment
- [ ] Manager can reject payment
- [ ] User notified on verification
- [ ] User notified on rejection
- [ ] User can retry after rejection (up to 3 times)
- [ ] User banned after 3 false attempts

### Payment Timeout Testing (After Approval Flow)

- [ ] Timer starts after approval
- [ ] User receives reminder at 10 mins
- [ ] User receives reminder at 30 mins
- [ ] User receives reminder at 60 mins
- [ ] Booking expires at timeout
- [ ] Slot released after expiry
- [ ] Notifications sent correctly

### Turf Request Testing

- [ ] Manager can create turf request
- [ ] All turf details captured correctly
- [ ] Owner receives notification
- [ ] Owner can view request details
- [ ] Owner can approve request
- [ ] Turf created on approval
- [ ] Manager auto-assigned to turf
- [ ] Owner can reject with reason
- [ ] Manager notified of outcome

### Turf Edit Logging Testing

- [ ] Pricing changes logged
- [ ] Operating hours changes logged
- [ ] Advance settings changes logged
- [ ] Log shows who made change
- [ ] Log shows when change was made
- [ ] Owner can view edit history

---

## 🔄 MIGRATION NOTES

### For Existing Data

If you have existing bookings/turfs, run these migrations:

```javascript
// Migration: Add advancePayment to existing turfs
async function migrateTurfsAddAdvancePayment() {
  const turfs = await admin.firestore().collection('turfs').get();
  
  const batch = admin.firestore().batch();
  
  turfs.docs.forEach(doc => {
    if (!doc.data().advancePayment) {
      batch.update(doc.ref, {
        advancePayment: {
          isRequired: false,
          percentage: 0,
          paymentTiming: "before_approval",
          paymentTimeout: 120,
          allowedMethods: ["upi", "cash_at_venue"],
          lastUpdatedBy: null,
          lastUpdatedAt: null
        }
      });
    }
  });
  
  await batch.commit();
  console.log('Migration complete: advancePayment added to turfs');
}

// Migration: Add paymentConfig to existing companies
async function migrateCompaniesAddPaymentConfig() {
  const companies = await admin.firestore().collection('companies').get();
  
  const batch = admin.firestore().batch();
  
  companies.docs.forEach(doc => {
    if (!doc.data().paymentConfig) {
      batch.update(doc.ref, {
        paymentConfig: {
          upiEnabled: false,
          upiId: null,
          upiQrCode: null,
          upiHolderName: null,
          bankDetails: null,
          razorpayEnabled: false,
          razorpayAccountId: null,
          preferredPaymentMethod: "upi",
          updatedAt: null,
          updatedBy: null
        },
        verifiedTransactions: []
      });
    }
  });
  
  await batch.commit();
  console.log('Migration complete: paymentConfig added to companies');
}
```

---

## 📊 SUMMARY

### Key Changes in V2.1

| Feature | Before (V2) | After (V2.1) |
|---------|-------------|--------------|
| **Advance Payment** | Razorpay (2% fee) | UPI Direct (0% fee) |
| **Payment Verification** | Automatic | Manual by manager |
| **Payment Timing** | Only before approval | Configurable (before/after) |
| **Turf Creation** | Owner only | Owner creates OR Manager requests |
| **Turf Editing** | No logging | All edits logged |
| **Owner Operations** | Separate navigation | FAB button for quick access |

### Files Changed Summary

| Type | Count | Files |
|------|-------|-------|
| New Screens | 9 | Payment, Verification, Turf Requests |
| Updated Screens | 6 | Dashboard, Booking, Settings |
| New Collections | 2 | turf_requests, turf_edit_logs |
| Updated Collections | 4 | companies, turfs, bookings, users |
| New Cloud Functions | 4 | Payment verification, Timeout, Turf requests |
| New Utilities | 2 | upiUtils.js, paymentUtils.js |

---

## 🚀 IMPLEMENTATION PRIORITY

### Phase 1 (Critical - Do First)
1. UPI Payment Configuration (Owner setup)
2. UPI Payment Flow (User side)
3. Payment Verification (Manager side)
4. Updated booking status flow

### Phase 2 (Important - Do Second)
5. Payment timeout handling
6. Payment reminders
7. Fraud prevention

### Phase 3 (Enhancement - Do Later)
8. Manager turf requests
9. Turf edit logging
10. Owner operations FAB

---

**This V2.1 Update Plan is designed to integrate seamlessly with your existing V2 Master Plan. Follow the implementation priority to minimize disruption to your current development progress.**
