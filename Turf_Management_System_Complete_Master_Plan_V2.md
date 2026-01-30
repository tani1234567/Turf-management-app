# 🏟️ TURF MANAGEMENT SYSTEM - COMPLETE MASTER PLAN (V2)

---

## 📋 TABLE OF CONTENTS

1. Executive Summary
2. Project Overview
3. Tech Stack
4. Database Architecture (Firestore)
5. Security Rules
6. Application Architecture
7. Feature Specifications
   - Authentication System
   - Primary Booking System (Calendar Flow)
   - Chat System with Negotiation
   - Pricing Calculation Engine
   - Caretaker Module
   - Manager Analytics Dashboard
   - Owner Analytics Dashboard
   - Academy System
   - Admin Panel
8. Notification System
9. Firebase Cloud Functions
10. Week-by-Week Development Plan
11. Business Plan
12. Risk Mitigation & Contingency Plans
13. Conclusion

---

## 1. EXECUTIVE SUMMARY

A comprehensive multi-tenant turf booking platform connecting **Users**, **Turf Owners**, **Company Managers**, and **Caretakers**. Built with React Native Expo (mobile + web) and Firebase backend using JavaScript, featuring real-time bookings, negotiations via chat, flexible pricing, and subscription-based business model.

### Entity Hierarchy

```
Turf Owner (Business Owner/Investor)
    ↓ (controls/manages)
Manager (Operations Manager)
    ↓ (controls/assigns)
Caretaker (On-ground Staff)
```

---

## 2. PROJECT OVERVIEW

### Core Vision

Create a seamless turf booking experience similar to booking.com but specifically designed for sports turf management with:
- Real-time availability
- Price negotiation capabilities
- Multi-stakeholder workflow management (Owner → Manager → Caretaker → User)

### Key Booking Methods

| Method | Description | Use Case |
|--------|-------------|----------|
| **⭐ PRIMARY: Calendar Booking** | Fixed price, user selects Date → Sport → Time Range, sees ALL grounds at once | Regular bookings (90%+ of cases) |
| **💬 SECONDARY: Chat Negotiation** | Optional price modification through chat | Special cases, tournaments, price negotiation |

### Development Timeline: 20 Weeks (5 Months)

- **Phase 1**: Foundation & MVP (Weeks 1-12)
- **Phase 2**: Advanced Features (Weeks 13-16)
- **Phase 3**: Testing & Deployment (Weeks 17-20)

---

## 3. TECH STACK (FINALIZED)

| Category | Technology | Notes |
|----------|------------|-------|
| **Frontend** | React Native Expo | iOS, Android, Web |
| **Language** | JavaScript | Not TypeScript |
| **Backend** | Firebase | Firestore, Authentication, Storage, Cloud Functions, FCM |
| **Payment Gateway** | Razorpay | Lowest fees in India: 2% vs Stripe 2.9% |
| **SMS Provider** | MSG91 | ₹0.15/SMS (cheaper than Twilio ₹0.50/SMS) |
| **Maps** | Google Maps API | With Places API |
| **State Management** | Redux Toolkit | With RTK Query |
| **UI Library** | React Native Paper | + Custom Components |
| **Charts** | react-native-chart-kit | + Victory Native |

---

## 4. DATABASE ARCHITECTURE (FIRESTORE)

### Collection Structure

#### 1. users/
```javascript
{
  userId: "auto-generated",
  phone: "+919876543210",
  name: "John Doe",
  email: "john@example.com",
  role: "user", // user | owner | manager | caretaker | admin
  profilePicture: "gs://...",
  createdAt: timestamp,
  lastLoginAt: timestamp,
  isActive: true,
  isSuspended: false, // For manager/caretaker suspension
  suspendedAt: timestamp, // When suspended
  suspendedBy: "ownerId", // Who suspended
  suspensionReason: "Performance issues",
  canBeDeletedAfter: timestamp, // 30 days after suspension
  fcmTokens: ["token1", "token2"], // Multiple devices
  favorites: ["turfId1", "turfId2"], // Future feature
  
  // Only if role = owner
  companyId: "companyId",
  hasOperationalPermissions: true, // Can do manager tasks if true
  managedTurfIds: ["turfId1", "turfId2"], // If operational permissions enabled, which turfs (empty array = all turfs)
  
  // Only if role = manager
  companyId: "companyId",
  assignedTurfIds: ["turfId1", "turfId2"], // Turfs manager is assigned to
  selectedTurfId: "turfId", // Current working turf
  
  // Only if role = caretaker
  companyId: "companyId",
  assignedTurfId: "turfId", // Single turf only (null if unassigned)
  isAssigned: false // true when assigned to a turf
}
```

#### 2. companies/
```javascript
{
  companyId: "auto-generated",
  name: "Green Sports Arena",
  
  // Multiple Owners Support
  ownerUserIds: ["ownerId1", "ownerId2"], // Array of owner userIds
  
  phone: "+919876543210",
  email: "company@example.com",
  logo: "gs://...",
  description: "Best turfs in Mumbai",
  
  // Business details
  gstNumber: "27XXXXX1234X1ZX",
  panNumber: "ABCDE1234F",
  
  // Invite Code for Manager/Caretaker joining (No expiry, unlimited uses)
  inviteCode: {
    code: "GREEN123", // Alphanumeric code
    link: "https://turfbooking.app/join/GREEN123", // Shareable link
    createdAt: timestamp,
    lastChangedAt: timestamp,
    lastChangedBy: "ownerId" // Any owner can change
  },
  
  // Subscription (Owner manages this)
  subscription: {
    status: "trial", // trial | active | expired | grace_period
    trialStartDate: timestamp,
    trialEndDate: timestamp, // 30 days from start
    subscriptionStartDate: timestamp,
    subscriptionEndDate: timestamp,
    gracePeriodEndDate: timestamp, // 7 days after expiry
    totalGrounds: 5,
    pricePerGroundMonthly: 299,
    totalMonthlyFee: 1495,
    discount: 10, // % for >10 grounds
    lastPaymentDate: timestamp,
    lastPaymentAmount: 1495,
    paymentHistory: [
      {
        date: timestamp,
        amount: 1495,
        method: "online", // online | offline
        transactionId: "razorpay_xxx",
        paidBy: "ownerId"
      }
    ]
  },
  
  // Managers (join via invite code, unlimited)
  managers: ["managerId1", "managerId2"], // Array of manager userIds
  
  // Caretakers (join via invite code, assigned by manager/owner)
  caretakers: ["caretakerId1", "caretakerId2"], // Array of caretaker userIds
  unassignedCaretakers: ["caretakerId3"], // Joined but not assigned to turf yet
  
  // Statistics
  stats: {
    totalTurfs: 3,
    totalGrounds: 7,
    totalBookings: 1250,
    totalRevenue: 350000,
    activeUsers: 450
  },
  
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### 3. turfs/
```javascript
{
  turfId: "auto-generated",
  companyId: "companyId",
  name: "Green Arena - Andheri",
  
  // Created by Owner (Only owners can create/delete turfs)
  createdBy: "ownerId",
  
  // Location
  location: {
    address: "123, Link Road, Andheri West",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400058",
    googleMapsLink: "https://maps.google.com/?q=19.1234,72.5678",
    coordinates: {
      latitude: 19.1234,
      longitude: 72.5678
    }
  },
  
  // Images
  images: [
    "gs://bucket/turfs/turfId/image1.jpg",
    "gs://bucket/turfs/turfId/image2.jpg"
  ],
  coverImage: "gs://...",
  
  // Operating hours
  operatingHours: {
    monday: { isOpen: true, openTime: "06:00", closeTime: "23:00" },
    tuesday: { isOpen: true, openTime: "06:00", closeTime: "23:00" },
    wednesday: { isOpen: true, openTime: "06:00", closeTime: "23:00" },
    thursday: { isOpen: true, openTime: "06:00", closeTime: "23:00" },
    friday: { isOpen: true, openTime: "06:00", closeTime: "23:00" },
    saturday: { isOpen: true, openTime: "06:00", closeTime: "23:00" },
    sunday: { isOpen: true, openTime: "06:00", closeTime: "23:00" }
  },
  
  // Grounds
  totalGrounds: 2,
  grounds: [
    {
      groundId: "ground-1",
      name: "Ground-1",
      sports: ["cricket", "football"], // Multiple sports on same ground
      
      // Pricing per sport per time slot
      pricing: {
        cricket: {
          weekday: {
            morning: { start: "06:00", end: "10:00", hourlyRate: 1000 },
            afternoon: { start: "10:00", end: "18:00", hourlyRate: 800 },
            evening: { start: "18:00", end: "23:00", hourlyRate: 1500 }
          },
          weekend: {
            morning: { start: "06:00", end: "10:00", hourlyRate: 1200 },
            afternoon: { start: "10:00", end: "18:00", hourlyRate: 1000 },
            evening: { start: "18:00", end: "23:00", hourlyRate: 1800 }
          }
        },
        football: {
          weekday: {
            morning: { start: "06:00", end: "10:00", hourlyRate: 1500 },
            afternoon: { start: "10:00", end: "18:00", hourlyRate: 1200 },
            evening: { start: "18:00", end: "23:00", hourlyRate: 2000 }
          },
          weekend: {
            morning: { start: "06:00", end: "10:00", hourlyRate: 1800 },
            afternoon: { start: "10:00", end: "18:00", hourlyRate: 1500 },
            evening: { start: "18:00", end: "23:00", hourlyRate: 2500 }
          }
        }
      },
      amenities: ["floodlights", "changing_room", "parking", "water"],
      isActive: true
    },
    {
      groundId: "ground-2",
      name: "Ground-2",
      sports: ["pickleball", "badminton"],
      pricing: {
        pickleball: {
          weekday: { allDay: { start: "06:00", end: "23:00", hourlyRate: 600 } },
          weekend: { allDay: { start: "06:00", end: "23:00", hourlyRate: 800 } }
        },
        badminton: {
          weekday: { allDay: { start: "06:00", end: "23:00", hourlyRate: 500 } },
          weekend: { allDay: { start: "06:00", end: "23:00", hourlyRate: 700 } }
        }
      },
      amenities: ["floodlights", "parking"],
      isActive: true
    }
  ],
  
  // Facilities
  amenities: ["parking", "restrooms", "cafeteria", "first_aid"],
  
  // QR Code (Both Owner and Manager can generate)
  qrCode: {
    globalQR: "https://turfbooking.app/company/companyId", // All turfs
    turfSpecificQR: "https://turfbooking.app/turf/turfId" // This turf only
  },
  
  // Reviews
  rating: 4.5,
  totalReviews: 120,
  
  // Statistics
  stats: {
    totalBookings: 450,
    totalRevenue: 125000,
    utilizationRate: 78 // Percentage of slots booked
  },
  
  // Assigned Managers (can have multiple, manager self-selects then owner can modify)
  managerIds: ["managerId1", "managerId2"],
  
  // Assigned Caretakers (can have multiple but rare, one caretaker = one turf)
  caretakerIds: ["caretakerId1"],
  
  // Status
  isActive: true, // Based on subscription
  isVerified: true, // Admin verification
  
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### 4. bookings/
```javascript
{
  bookingId: "auto-generated",
  
  // Entities
  userId: "userId",
  userName: "John Doe",
  userPhone: "+919876543210",
  companyId: "companyId",
  turfId: "turfId",
  turfName: "Green Arena - Andheri",
  groundId: "ground-1",
  groundName: "Ground-1",
  
  // Booking Details
  bookingType: "regular", // regular | tournament | offline
  sport: "cricket",
  date: "2026-01-15", // YYYY-MM-DD
  
  // Time Slots (supports extensions)
  timeSlots: [
    {
      startTime: "17:00",
      endTime: "18:00",
      duration: 1, // hours
      hourlyRate: 1500,
      amount: 1500
    },
    // If extended by 30 mins
    {
      startTime: "18:00",
      endTime: "18:30",
      duration: 0.5,
      hourlyRate: 1500,
      amount: 750, // (1500 * 0.5)
      isExtension: true,
      extendedAt: timestamp,
      extendedBy: "caretakerId"
    }
  ],
  
  // Calculated fields
  startTime: "17:00", // First slot start
  endTime: "18:30", // Last slot end
  totalDuration: 1.5, // Total hours
  
  // Pricing
  baseAmount: 1500,
  extensionAmount: 750,
  totalAmount: 2250,
  
  // Status
  status: "pending", // pending | confirmed | in_progress | completed | cancelled | rejected
  
  // Status History (for tracking)
  statusHistory: [
    {
      status: "pending",
      timestamp: timestamp,
      changedBy: "userId",
      changedByRole: "user",
      reason: "Booking request created"
    },
    {
      status: "confirmed",
      timestamp: timestamp,
      changedBy: "managerId",
      changedByRole: "manager", // or "owner" if owner with operational permissions
      reason: "Approved by manager"
    }
  ],
  
  // Payment Details
  payment: {
    advanceAmount: 225, // 10% mandatory for tournaments
    advancePaid: true,
    advancePaymentMethod: "razorpay",
    advanceTransactionId: "pay_xxx",
    advancePaymentDate: timestamp,
    remainingAmount: 2025,
    remainingPaid: false,
    
    // On-ground payment (filled by caretaker)
    onGroundPayment: {
      cashAmount: 1000,
      onlineAmount: 1025, // GPay/PhonePe/etc
      onlineProof: "gs://...", // Photo of payment screenshot (future)
      totalPaid: 2025,
      paidAt: timestamp,
      receivedBy: "caretakerId"
    },
    
    // Refund
    refundAmount: 0,
    refundReason: "",
    refundDate: null,
    refundTransactionId: ""
  },
  
  // Negotiation (if booking via chat)
  negotiation: {
    isNegotiated: true,
    requestedPrice: 1200,
    finalPrice: 1500,
    chatId: "chatId",
    negotiationCardId: "cardId"
  },
  
  // Special requests
  specialRequests: "Need extra footballs",
  notes: "VIP customer",
  
  // Attendance
  attendance: {
    showedUp: true,
    markedBy: "caretakerId",
    markedAt: timestamp,
    noShowReason: ""
  },
  
  // Cancellation
  cancellation: {
    isCancelled: false,
    cancelledBy: "userId", // userId | managerId | ownerId
    cancelledByRole: "user",
    cancelledAt: timestamp,
    cancellationReason: "Weather bad",
    refundPercentage: 90, // 10% cut if <1 hour
    refundAmount: 2025
  },
  
  // Timestamps
  createdAt: timestamp,
  requestedAt: timestamp,
  confirmedAt: timestamp,
  completedAt: timestamp,
  updatedAt: timestamp,
  
  // Lock mechanism (prevent race condition)
  lock: {
    isLocked: false,
    lockedBy: "managerId",
    lockedAt: timestamp,
    lockExpiry: timestamp // 2 minutes lock
  }
}
```

#### 5. chats/
```javascript
{
  chatId: "auto-generated",
  
  // Participants
  participants: {
    user: {
      userId: "userId",
      name: "John Doe",
      phone: "+919876543210",
      profilePicture: "gs://..."
    },
    company: {
      companyId: "companyId",
      name: "Green Sports Arena",
      logo: "gs://...",
      // All turf managers can view and reply (no assignment)
      turfManagerIds: ["managerId1", "managerId2"]
    }
  },
  
  // Chat metadata
  lastMessage: {
    text: "Is slot available?",
    senderId: "userId",
    senderType: "user", // user | manager | caretaker
    timestamp: timestamp,
    type: "text" // text | negotiation_card | booking_card | location
  },
  
  // Unread counts
  unreadCount: {
    user: 2,
    company: 0
  },
  
  // Location context (for managers with multiple turfs)
  contextTurfId: null, // Set when negotiation card is sent
  
  createdAt: timestamp,
  updatedAt: timestamp
}

// SUBCOLLECTION: chats/{chatId}/messages
{
  messageId: "auto-generated",
  
  // Sender
  senderId: "userId",
  senderType: "user", // user | manager | caretaker
  senderName: "John Doe",
  
  // Message content
  type: "text", // text | negotiation_card | booking_card | location | image
  text: "Is slot available?",
  
  // If type = negotiation_card
  negotiationCard: {
    turfId: "turfId",
    turfName: "Green Arena",
    groundId: "ground-1",
    sport: "cricket",
    date: "2026-01-15",
    startTime: "17:00",
    endTime: "18:00",
    duration: 1,
    originalPrice: 1500,
    negotiatedPrice: 1200,
    status: "pending", // pending | accepted | rejected | expired
    respondedAt: timestamp,
    respondedBy: "managerId",
    respondedByRole: "manager"
  },
  
  // If type = booking_card
  bookingCard: {
    bookingId: "bookingId",
    turfName: "Green Arena",
    date: "2026-01-15",
    time: "17:00 - 18:00",
    amount: 1500,
    status: "confirmed"
  },
  
  // If type = location
  location: {
    address: "Green Arena, Andheri",
    googleMapsLink: "https://maps.google.com/..."
  },
  
  // If type = image
  imageUrl: "gs://...",
  
  // Read status
  isRead: false,
  readAt: timestamp,
  
  // Timestamps
  timestamp: timestamp,
  createdAt: timestamp
}
```

#### 6. reviews/
```javascript
{
  reviewId: "auto-generated",
  
  // Entities
  userId: "userId",
  userName: "John Doe",
  userProfilePicture: "gs://...",
  turfId: "turfId",
  turfName: "Green Arena",
  companyId: "companyId",
  bookingId: "bookingId", // Must have completed booking
  
  // Review content
  rating: 4.5, // 1-5 stars
  comment: "Great turf, well maintained!",
  
  // Manager response
  response: {
    text: "Thank you for your feedback!",
    respondedBy: "managerId",
    respondedByRole: "manager", // manager | owner (with operational permissions)
    respondedAt: timestamp
  },
  
  // Moderation
  isFlagged: false,
  flaggedBy: "managerId",
  flagReason: "Inappropriate language",
  isVisible: true,
  
  // Edit history
  isEdited: false,
  editedAt: timestamp,
  
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### 7. notifications/
```javascript
{
  notificationId: "auto-generated",
  
  // Recipient
  userId: "userId",
  userRole: "user", // user | owner | manager | caretaker
  
  // Notification content
  type: "booking_confirmed", // See notification types below
  title: "Booking Confirmed!",
  body: "Your booking for Green Arena on Jan 15 is confirmed",
  
  // Related data
  relatedId: "bookingId", // bookingId | chatId | reviewId
  relatedType: "booking", // booking | chat | review | payment
  
  // Action
  action: {
    screen: "BookingDetails",
    params: { bookingId: "bookingId" }
  },
  
  // Status
  isRead: false,
  readAt: timestamp,
  
  // Delivery
  pushSent: true,
  pushSentAt: timestamp,
  smsSent: false, // Only for web users or important notifications
  smsContent: "Your booking is confirmed. Details: ...",
  
  createdAt: timestamp
}
```

#### 8. expenses/ (Manager/Owner feature)
```javascript
{
  expenseId: "auto-generated",
  companyId: "companyId",
  turfId: "turfId", // Optional, if expense is turf-specific
  category: "maintenance", // maintenance | utilities | staff_salary | equipment | other
  amount: 5000,
  description: "Ground leveling work",
  
  // Receipt
  receiptImage: "gs://...",
  
  // Tracking
  addedBy: "managerId", // or ownerId with operational permissions
  addedByRole: "manager", // manager | owner
  date: "2026-01-15",
  createdAt: timestamp
}
```

#### 9. maintenance_logs/ (Caretaker feature)
```javascript
{
  logId: "auto-generated",
  turfId: "turfId",
  groundId: "ground-1",
  issueType: "lighting", // lighting | ground_condition | equipment | other
  description: "Two floodlights not working",
  priority: "high", // low | medium | high
  
  // Images
  images: ["gs://...", "gs://..."],
  
  // Status
  status: "reported", // reported | in_progress | resolved
  reportedBy: "caretakerId",
  reportedAt: timestamp,
  resolvedBy: "managerId", // or ownerId with operational permissions
  resolvedByRole: "manager",
  resolvedAt: timestamp,
  resolutionNotes: "Replaced bulbs",
  
  createdAt: timestamp
}
```

#### 10. blocked_slots/ (Manager/Owner feature for bulk blocking)
```javascript
{
  blockId: "auto-generated",
  turfId: "turfId",
  groundId: "ground-1",
  
  // Date range
  startDate: "2026-01-20",
  endDate: "2026-01-22",
  
  // Time slots
  timeSlots: [
    { startTime: "06:00", endTime: "12:00" },
    { startTime: "14:00", endTime: "18:00" }
  ],
  
  reason: "Maintenance work",
  blockedBy: "managerId", // or ownerId with operational permissions
  blockedByRole: "manager",
  createdAt: timestamp
}
```

#### 11. academies/ (Academy management)
```javascript
{
  academyId: "auto-generated",
  companyId: "companyId",
  turfId: "turfId",
  groundId: "ground-1",
  
  // Academy Details
  name: "Elite Football Academy",
  sport: "football", // Single sport
  description: "Professional football training",
  contactPerson: "Rahul Sharma",
  contactPhone: "+919876543210",
  
  // Schedule - Recurring weekly pattern
  schedule: {
    // Manager selects which days (can be any combination)
    daysOfWeek: ["monday", "wednesday", "friday"], // Can be any days
    startTime: "19:00",
    endTime: "21:00",
    duration: 2 // hours
  },
  
  // Contract Period
  startDate: "2026-01-01", // Contract start
  endDate: "2026-01-31", // Contract end (1 month minimum)
  contractDuration: 1, // months (1-3 months max)
  autoRenew: false, // Always false - manager renews manually
  
  // Payment (Manager enters total amount)
  payment: {
    totalAmount: 50000, // Total for the month
    paymentType: "mixed", // cash | online | mixed
    cashAmount: 30000,
    onlineAmount: 20000,
    paymentDate: timestamp,
    paymentNotes: "Paid in full for January 2026",
    paymentProof: "gs://...", // Optional photo
    paymentHistory: [
      {
        month: "January 2026",
        amount: 50000,
        cashAmount: 30000,
        onlineAmount: 20000,
        paidDate: timestamp,
        receivedBy: "managerId"
      }
    ]
  },
  
  // Renewal tracking
  renewal: {
    nextRenewalDate: "2026-01-25", // 5 days before expiry
    renewalNotificationSent: false,
    lastRenewalDate: null
  },
  
  // Statistics
  stats: {
    totalSessions: 12, // 3 days × 4 weeks
    completedSessions: 8,
    cancelledSessions: 1,
    upcomingSessions: 3,
    totalRevenue: 50000
  },
  
  // Status
  status: "active", // active | expired | cancelled
  isActive: true,
  
  // Metadata
  createdBy: "managerId", // or ownerId with operational permissions
  createdByRole: "manager",
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### 12. academy_sessions/ (Auto-generated from academy schedule)
```javascript
{
  sessionId: "auto-generated",
  academyId: "academyId",
  
  // References
  companyId: "companyId",
  turfId: "turfId",
  groundId: "ground-1",
  
  // Session Details
  academyName: "Elite Football Academy",
  sport: "football",
  date: "2026-01-20", // Specific Monday
  dayOfWeek: "monday",
  startTime: "19:00",
  endTime: "21:00",
  duration: 2,
  
  // Status
  status: "scheduled", // scheduled | completed | cancelled
  
  // Cancellation (Only manager/owner with operational permissions can cancel)
  isCancelled: false,
  cancellationReason: "",
  cancelledAt: null,
  cancelledBy: null, // managerId/ownerId if cancelled
  cancelledByRole: null,
  
  // Notes
  managerNotes: "Session completed successfully",
  
  // When cancelled, slot becomes available for regular booking
  availableForBooking: false, // true if cancelled
  
  // Auto-generated
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### 13. analytics/ (Pre-aggregated data for dashboards)
```javascript
{
  analyticsId: "auto-generated",
  companyId: "companyId",
  turfId: "turfId", // Optional, for turf-specific analytics (null for company-wide)
  period: "daily", // daily | weekly | monthly | yearly
  date: "2026-01-15", // For daily, week start for weekly, etc.
  
  // Metrics
  metrics: {
    totalBookings: 25,
    totalRevenue: 35000,
    totalAdvancePayments: 3500,
    totalOnGroundPayments: 31500,
    totalCashPayments: 15000,
    totalOnlinePayments: 16500,
    totalCancellations: 2,
    noShows: 1,
    utilizationRate: 82, // Percentage
    peakHours: ["17:00-18:00", "18:00-19:00"],
    
    // Sport-wise breakdown
    sportBreakdown: {
      cricket: { bookings: 15, revenue: 22500 },
      football: { bookings: 10, revenue: 12500 }
    },
    
    // New vs repeat customers
    newCustomers: 5,
    repeatCustomers: 20,
    
    // Average booking value
    averageBookingValue: 1400,
    
    // Manager performance (for owner dashboard - company-wide analytics only)
    managerPerformance: {
      "managerId1": {
        bookingsHandled: 15,
        revenueGenerated: 22500,
        avgResponseTime: 5 // minutes
      },
      "managerId2": {
        bookingsHandled: 10,
        revenueGenerated: 12500,
        avgResponseTime: 8
      }
    }
  },
  
  createdAt: timestamp
}
```

#### 14. admin_logs/ (For admin panel)
```javascript
{
  logId: "auto-generated",
  adminId: "adminUserId",
  action: "subscription_updated", // subscription_updated | company_verified | etc.
  targetType: "company", // company | turf | user
  targetId: "companyId",
  changes: {
    field: "subscription.status",
    oldValue: "expired",
    newValue: "active",
    reason: "Offline payment received"
  },
  timestamp: timestamp
}
```

#### 15. owner_logs/ (For tracking owner/manager actions)
```javascript
{
  logId: "auto-generated",
  companyId: "companyId",
  
  // Action performer
  performedBy: "ownerId",
  performedByRole: "owner", // owner | manager
  
  // Action details
  action: "manager_suspended", // manager_suspended | caretaker_assigned | turf_created | invite_code_changed | etc.
  targetType: "user", // user | turf | caretaker | company
  targetId: "managerId",
  
  // Details
  details: {
    reason: "Performance issues",
    previousState: { isSuspended: false },
    newState: { isSuspended: true }
  },
  
  timestamp: timestamp
}
```
---

## 5. SECURITY RULES (FIRESTORE)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper functions
    function isSignedIn() {
      return request.auth != null;
    }
    
    function getUserData() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }
    
    function isUser() {
      return isSignedIn() && getUserData().role == 'user';
    }
    
    function isOwner() {
      return isSignedIn() && getUserData().role == 'owner';
    }
    
    function isManager() {
      return isSignedIn() && getUserData().role == 'manager';
    }
    
    function isCaretaker() {
      return isSignedIn() && getUserData().role == 'caretaker';
    }
    
    function isAdmin() {
      return isSignedIn() && getUserData().role == 'admin';
    }
    
    function isDocOwner(userId) {
      return isSignedIn() && request.auth.uid == userId;
    }
    
    function belongsToCompany(companyId) {
      return isSignedIn() && getUserData().companyId == companyId;
    }
    
    function isCompanyOwner(companyId) {
      return isOwner() && belongsToCompany(companyId);
    }
    
    function isCompanyManager(companyId) {
      return isManager() && belongsToCompany(companyId);
    }
    
    function hasOperationalPermissions() {
      return isOwner() && getUserData().hasOperationalPermissions == true;
    }
    
    function canManageTurf(turfId) {
      let userData = getUserData();
      // Manager assigned to turf
      if (userData.role == 'manager') {
        return turfId in userData.assignedTurfIds;
      }
      // Owner with operational permissions (all turfs or specific turfs)
      if (userData.role == 'owner' && userData.hasOperationalPermissions) {
        return userData.managedTurfIds.size() == 0 || turfId in userData.managedTurfIds;
      }
      return false;
    }
    
    // Users collection
    match /users/{userId} {
      allow read: if isSignedIn();
      allow create: if isSignedIn() && request.auth.uid == userId;
      allow update: if isDocOwner(userId) || isAdmin() || 
        (isOwner() && belongsToCompany(resource.data.companyId)); // Owner can suspend/update managers/caretakers
      allow delete: if isDocOwner(userId) || isAdmin();
    }
    
    // Companies collection
    match /companies/{companyId} {
      allow read: if isSignedIn();
      allow create: if isOwner(); // Only owners can create companies
      allow update: if isCompanyOwner(companyId) || isAdmin(); // Only owners can update company
      allow delete: if isAdmin();
    }
    
    // Turfs collection
    match /turfs/{turfId} {
      allow read: if true; // Public reading for browsing
      allow create: if isCompanyOwner(request.resource.data.companyId); // Only owners create turfs
      allow update: if isCompanyOwner(resource.data.companyId) || 
        (isCompanyManager(resource.data.companyId) && canManageTurf(turfId)) ||
        (hasOperationalPermissions() && belongsToCompany(resource.data.companyId)) ||
        isAdmin();
      allow delete: if isCompanyOwner(resource.data.companyId) || isAdmin(); // Only owners delete turfs
    }
    
    // Bookings collection
    match /bookings/{bookingId} {
      allow read: if isSignedIn() && (
        isDocOwner(resource.data.userId) ||
        belongsToCompany(resource.data.companyId) ||
        (isCaretaker() && getUserData().assignedTurfId == resource.data.turfId)
      );
      allow create: if isSignedIn();
      allow update: if isSignedIn() && (
        isDocOwner(resource.data.userId) ||
        (isCompanyManager(resource.data.companyId) && canManageTurf(resource.data.turfId)) ||
        (hasOperationalPermissions() && belongsToCompany(resource.data.companyId)) ||
        (isCaretaker() && getUserData().assignedTurfId == resource.data.turfId)
      );
      allow delete: if isAdmin();
    }
    
    // Chats collection
    match /chats/{chatId} {
      allow read: if isSignedIn() && (
        request.auth.uid == resource.data.participants.user.userId ||
        belongsToCompany(resource.data.participants.company.companyId)
      );
      allow create: if isSignedIn();
      allow update: if isSignedIn() && (
        request.auth.uid == resource.data.participants.user.userId ||
        belongsToCompany(resource.data.participants.company.companyId)
      );
      
      // Messages subcollection
      match /messages/{messageId} {
        allow read: if isSignedIn() && (
          request.auth.uid == get(/databases/$(database)/documents/chats/$(chatId)).data.participants.user.userId ||
          belongsToCompany(get(/databases/$(database)/documents/chats/$(chatId)).data.participants.company.companyId)
        );
        allow create: if isSignedIn();
        allow update: if isSignedIn();
      }
    }
    
    // Reviews collection
    match /reviews/{reviewId} {
      allow read: if true; // Public
      allow create: if isUser();
      allow update: if isDocOwner(resource.data.userId) ||
        ((isManager() || (isOwner() && hasOperationalPermissions())) && belongsToCompany(resource.data.companyId));
      allow delete: if isDocOwner(resource.data.userId) || isAdmin();
    }
    
    // Notifications collection
    match /notifications/{notificationId} {
      allow read: if isDocOwner(resource.data.userId);
      allow create: if isSignedIn();
      allow update: if isDocOwner(resource.data.userId);
      allow delete: if isDocOwner(resource.data.userId);
    }
    
    // Expenses collection
    match /expenses/{expenseId} {
      allow read: if (isManager() || isOwner()) && belongsToCompany(resource.data.companyId);
      allow create: if (isManager() || (isOwner() && hasOperationalPermissions())) && 
        belongsToCompany(request.resource.data.companyId);
      allow update: if (isManager() || isOwner()) && belongsToCompany(resource.data.companyId);
      allow delete: if (isManager() || isOwner()) && belongsToCompany(resource.data.companyId);
    }
    
    // Maintenance logs
    match /maintenance_logs/{logId} {
      allow read: if isSignedIn() && (
        belongsToCompany(get(/databases/$(database)/documents/turfs/$(resource.data.turfId)).data.companyId) ||
        (isCaretaker() && getUserData().assignedTurfId == resource.data.turfId)
      );
      allow create: if isCaretaker();
      allow update: if isManager() || isCaretaker() || (isOwner() && hasOperationalPermissions());
    }
    
    // Blocked slots
    match /blocked_slots/{blockId} {
      allow read: if isSignedIn();
      allow create: if (isManager() && canManageTurf(request.resource.data.turfId)) ||
        (hasOperationalPermissions() && belongsToCompany(get(/databases/$(database)/documents/turfs/$(request.resource.data.turfId)).data.companyId));
      allow update: if (isManager() && canManageTurf(resource.data.turfId)) ||
        (hasOperationalPermissions() && belongsToCompany(get(/databases/$(database)/documents/turfs/$(resource.data.turfId)).data.companyId));
      allow delete: if (isManager() && canManageTurf(resource.data.turfId)) ||
        (hasOperationalPermissions() && belongsToCompany(get(/databases/$(database)/documents/turfs/$(resource.data.turfId)).data.companyId));
    }
    
    // Academies
    match /academies/{academyId} {
      allow read: if isSignedIn(); // All can read to check blocked slots
      allow create: if (isManager() && canManageTurf(request.resource.data.turfId)) ||
        (hasOperationalPermissions() && belongsToCompany(request.resource.data.companyId));
      allow update: if (isManager() && canManageTurf(resource.data.turfId)) ||
        (hasOperationalPermissions() && belongsToCompany(resource.data.companyId));
      allow delete: if (isManager() && canManageTurf(resource.data.turfId)) ||
        (hasOperationalPermissions() && belongsToCompany(resource.data.companyId));
    }
    
    // Academy sessions
    match /academy_sessions/{sessionId} {
      allow read: if isSignedIn(); // Users need to see blocked slots
      allow create: if false; // Only Cloud Functions create
      allow update: if (isManager() && canManageTurf(resource.data.turfId)) ||
        (hasOperationalPermissions() && belongsToCompany(resource.data.companyId));
      allow delete: if (isManager() && canManageTurf(resource.data.turfId)) ||
        (hasOperationalPermissions() && belongsToCompany(resource.data.companyId));
    }
    
    // Analytics (read for owners and managers, write via Cloud Functions)
    match /analytics/{analyticsId} {
      allow read: if (isManager() || isOwner()) && belongsToCompany(resource.data.companyId);
      allow write: if false; // Only Cloud Functions can write
    }
    
    // Owner logs
    match /owner_logs/{logId} {
      allow read: if isOwner() && belongsToCompany(resource.data.companyId);
      allow create: if (isOwner() || isManager()) && belongsToCompany(request.resource.data.companyId);
    }
    
    // Admin logs (admin only)
    match /admin_logs/{logId} {
      allow read: if isAdmin();
      allow create: if isAdmin();
    }
  }
}
```

---

## 6. APPLICATION ARCHITECTURE

### Folder Structure

```
turf-management-system/
├── src/
│   ├── api/                          # API layer
│   │   ├── firebase/
│   │   │   ├── auth.js               # Authentication methods
│   │   │   ├── firestore.js          # Firestore CRUD operations
│   │   │   ├── storage.js            # File upload/download
│   │   │   ├── cloudFunctions.js     # Cloud Functions calls
│   │   │   └── fcm.js                # Push notifications
│   │   ├── razorpay/
│   │   │   └── payment.js            # Payment integration
│   │   ├── msg91/
│   │   │   └── sms.js                # SMS notifications
│   │   └── googleMaps/
│   │       └── maps.js               # Maps API
│   │
│   ├── components/                   # Reusable components
│   │   ├── common/
│   │   │   ├── Button.js
│   │   │   ├── Input.js
│   │   │   ├── Card.js
│   │   │   ├── LoadingSpinner.js
│   │   │   ├── ErrorBoundary.js
│   │   │   ├── EmptyState.js
│   │   │   └── ConfirmDialog.js
│   │   ├── booking/
│   │   │   ├── BookingCard.js
│   │   │   ├── SlotPicker.js
│   │   │   ├── Calendar.js
│   │   │   ├── PriceCalculator.js
│   │   │   └── BookingStatusBadge.js
│   │   ├── chat/
│   │   │   ├── ChatBubble.js
│   │   │   ├── NegotiationCard.js
│   │   │   ├── BookingCard.js
│   │   │   ├── ChatInput.js
│   │   │   └── TypingIndicator.js
│   │   ├── turf/
│   │   │   ├── TurfCard.js
│   │   │   ├── GroundCard.js
│   │   │   ├── PricingTable.js
│   │   │   ├── AmenitiesChips.js
│   │   │   └── RatingStars.js
│   │   ├── analytics/
│   │   │   ├── RevenueChart.js
│   │   │   ├── BookingTrendChart.js
│   │   │   ├── UtilizationChart.js
│   │   │   ├── ManagerPerformanceChart.js  # NEW - For owner dashboard
│   │   │   ├── CrossTurfComparisonChart.js # NEW - For owner dashboard
│   │   │   └── StatCard.js
│   │   └── qr/
│   │       ├── QRDisplay.js
│   │       └── QRScanner.js
│   │
│   ├── screens/                      # All app screens
│   │   ├── auth/
│   │   │   ├── LoginScreen.js
│   │   │   ├── OTPVerificationScreen.js
│   │   │   ├── RoleSelectionScreen.js
│   │   │   ├── ProfileSetupScreen.js
│   │   │   └── JoinCompanyScreen.js      # NEW - For manager/caretaker joining via invite code
│   │   ├── user/
│   │   │   ├── HomeScreen.js
│   │   │   ├── TurfDetailScreen.js
│   │   │   ├── BookingScreen.js
│   │   │   ├── BookingHistoryScreen.js
│   │   │   ├── ChatListScreen.js
│   │   │   ├── ChatScreen.js
│   │   │   ├── ProfileScreen.js
│   │   │   └── ReviewScreen.js
│   │   ├── owner/                        # NEW - Owner screens
│   │   │   ├── OwnerDashboardScreen.js       # Company-wide stats & analytics
│   │   │   ├── CompanySetupScreen.js         # Initial company registration
│   │   │   ├── TurfManagementScreen.js       # View all turfs
│   │   │   ├── AddTurfScreen.js              # Create new turf
│   │   │   ├── EditTurfScreen.js             # Edit turf details
│   │   │   ├── ManagerManagementScreen.js    # View/suspend managers
│   │   │   ├── CaretakerManagementScreen.js  # View/suspend caretakers (if operational permissions)
│   │   │   ├── AnalyticsScreen.js            # Company-wide analytics & financial reports
│   │   │   ├── FinancialReportsScreen.js     # Profit/Loss, Revenue vs Expenses
│   │   │   ├── SubscriptionScreen.js         # Manage subscription & payments
│   │   │   ├── CompanySettingsScreen.js      # Edit company profile
│   │   │   ├── InviteCodeScreen.js           # View/regenerate invite code
│   │   │   ├── QRCodesScreen.js              # Generate global & turf-specific QR
│   │   │   ├── OperationalSettingsScreen.js  # Toggle operational permissions & select turfs
│   │   │   └── ProfileScreen.js
│   │   ├── manager/
│   │   │   ├── ManagerDashboardScreen.js
│   │   │   ├── TurfSelectionScreen.js        # Select which turf to manage (from assigned turfs)
│   │   │   ├── BookingManagementScreen.js
│   │   │   ├── CalendarViewScreen.js
│   │   │   ├── ChatListScreen.js
│   │   │   ├── ChatScreen.js
│   │   │   ├── AnalyticsScreen.js            # Turf-level analytics only
│   │   │   ├── ExpenseTrackingScreen.js
│   │   │   ├── QRCodesScreen.js
│   │   │   ├── BlockSlotsScreen.js
│   │   │   ├── AcademyManagementScreen.js
│   │   │   ├── CaretakerAssignmentScreen.js  # Assign unassigned caretakers to turf
│   │   │   └── ProfileScreen.js
│   │   ├── caretaker/
│   │   │   ├── CaretakerDashboardScreen.js
│   │   │   ├── WaitingForAssignmentScreen.js # NEW - Shown when unassigned
│   │   │   ├── CalendarScreen.js
│   │   │   ├── BookingDetailsScreen.js
│   │   │   ├── PaymentCollectionScreen.js
│   │   │   ├── MaintenanceLogScreen.js
│   │   │   ├── ChatScreen.js
│   │   │   ├── QRScreen.js
│   │   │   └── ProfileScreen.js
│   │   └── admin/
│   │       ├── AdminDashboardScreen.js
│   │       ├── CompanyManagementScreen.js
│   │       ├── SubscriptionManagementScreen.js
│   │       ├── RevenueReportsScreen.js
│   │       └── SystemLogsScreen.js
│   │
│   ├── navigation/                   # Navigation setup
│   │   ├── AppNavigator.js           # Root navigator
│   │   ├── AuthNavigator.js          # Auth flow
│   │   ├── UserNavigator.js          # User bottom tabs
│   │   ├── OwnerNavigator.js         # NEW - Owner bottom tabs
│   │   ├── ManagerNavigator.js       # Manager bottom tabs
│   │   ├── CaretakerNavigator.js     # Caretaker navigation
│   │   └── AdminNavigator.js         # Admin navigation
│   │
│   ├── store/                        # Redux state management
│   │   ├── store.js                  # Redux store configuration
│   │   ├── slices/
│   │   │   ├── authSlice.js
│   │   │   ├── userSlice.js
│   │   │   ├── ownerSlice.js         # NEW
│   │   │   ├── companySlice.js       # NEW
│   │   │   ├── turfSlice.js
│   │   │   ├── bookingSlice.js
│   │   │   ├── chatSlice.js
│   │   │   └── notificationSlice.js
│   │   └── middleware/
│   │       └── firestoreMiddleware.js
│   │
│   ├── hooks/                        # Custom hooks
│   │   ├── useAuth.js
│   │   ├── useBooking.js
│   │   ├── useChat.js
│   │   ├── useFirestore.js
│   │   ├── useLocation.js
│   │   ├── useNotifications.js
│   │   └── usePermissions.js         # NEW - Check operational permissions
│   │
│   ├── utils/                        # Helper functions
│   │   ├── dateUtils.js              # Date formatting, calculations
│   │   ├── priceUtils.js             # Price calculations
│   │   ├── validationUtils.js        # Form validations
│   │   ├── bookingUtils.js           # Booking logic helpers
│   │   ├── notificationUtils.js      # Notification helpers
│   │   ├── permissionUtils.js        # NEW - Permission checks for owner/manager
│   │   └── exportUtils.js            # Excel export
│   │
│   ├── constants/                    # Constants
│   │   ├── colors.js
│   │   ├── sports.js
│   │   ├── amenities.js
│   │   ├── bookingStatus.js
│   │   ├── roles.js                  # NEW - Role constants (user, owner, manager, caretaker, admin)
│   │   └── config.js                 # Firebase config, API keys
│   │
│   ├── theme/                        # Theme configuration
│   │   ├── theme.js                  # React Native Paper theme
│   │   └── globalStyles.js           # Global styles
│   │
│   ├── assets/                       # Static assets
│   │   ├── images/
│   │   ├── icons/
│   │   └── fonts/
│   │
│   └── App.js                        # Root component
│
├── functions/                        # Firebase Cloud Functions
│   ├── src/
│   │   ├── bookingFunctions.js       # Booking-related functions
│   │   ├── notificationFunctions.js  # Send notifications
│   │   ├── analyticsFunctions.js     # Pre-aggregate analytics
│   │   ├── subscriptionFunctions.js  # Check subscriptions
│   │   ├── academyFunctions.js       # Academy session generation
│   │   ├── suspensionFunctions.js    # NEW - Handle 30-day deletion after suspension
│   │   └── cleanupFunctions.js       # Data cleanup
│   ├── index.js
│   └── package.json
│
├── app.json                          # Expo configuration
├── package.json
├── babel.config.js
├── .env                              # Environment variables
└── README.md
```
## 7. FEATURE SPECIFICATIONS

---

### 7.1 AUTHENTICATION SYSTEM

#### Registration Process - User Journey

```
1. App Launch → Splash Screen (2s)
2. Welcome Screen → "Login" or "Sign Up"
3. Phone Number Input Screen
   - Input: Phone number with country code picker
   - Validation: Must be valid 10-digit number
   - Button: "Send OTP"
4. OTP Verification Screen
   - Firebase sends OTP automatically
   - 6-digit OTP input
   - Timer: 60 seconds
   - "Resend OTP" button (enabled after 60s)
   - Auto-submit when 6 digits entered
5. If New User → Role Selection Screen
   - "I am a User" (Customer)
   - "I am a Turf Owner" (NEW)
   - "I am a Manager"
   - "I am a Caretaker"
6. Based on role selection:

   FOR USER:
   - Profile Setup Screen (Name, Email, Profile Picture)
   - → User Dashboard

   FOR OWNER (NEW):
   - Profile Setup Screen (Name, Email, Profile Picture)
   - Operational Permissions Checkbox: "I want to manage day-to-day operations"
     - If checked: Can select specific turfs or "All Turfs"
   - Company Setup Screen (Company Name, Logo, GST, PAN, etc.)
   - → Owner Dashboard

   FOR MANAGER:
   - Profile Setup Screen (Name, Email, Profile Picture)
   - Join Company Screen
     - Enter Invite Code OR
     - Enter Shareable Link
   - Select Turfs to Manage (from available turfs in the company)
   - → Manager Dashboard

   FOR CARETAKER:
   - Profile Setup Screen (Name, Email, Profile Picture)
   - Join Company Screen (Enter Invite Code or Link)
   - Status: "Waiting for assignment" (unassigned state)
   - → Caretaker Dashboard (limited view until assigned)

7. Dashboard (based on role)
```

#### Implementation Example

```javascript
// src/screens/auth/LoginScreen.js
import { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import { PhoneAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth, firebaseConfig } from '../../api/firebase/config';

export default function LoginScreen({ navigation }) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationId, setVerificationId] = useState('');
  const recaptchaVerifier = useRef(null);

  const sendOTP = async () => {
    try {
      const phoneProvider = new PhoneAuthProvider(auth);
      const verificationId = await phoneProvider.verifyPhoneNumber(
        `+91${phoneNumber}`,
        recaptchaVerifier.current
      );
      setVerificationId(verificationId);
      navigation.navigate('OTPVerification', { verificationId, phoneNumber });
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to send OTP');
    }
  };

  return (
    <View>
      <FirebaseRecaptchaVerifierModal
        ref={recaptchaVerifier}
        firebaseConfig={firebaseConfig}
      />
      <TextInput
        placeholder="Enter phone number"
        keyboardType="phone-pad"
        value={phoneNumber}
        onChangeText={setPhoneNumber}
        maxLength={10}
      />
      <TouchableOpacity onPress={sendOTP}>
        <Text>Send OTP</Text>
      </TouchableOpacity>
    </View>
  );
}

// src/screens/auth/OTPVerificationScreen.js
export default function OTPVerificationScreen({ route, navigation }) {
  const { verificationId, phoneNumber } = route.params;
  const [otp, setOTP] = useState('');

  const verifyOTP = async () => {
    try {
      const credential = PhoneAuthProvider.credential(verificationId, otp);
      const userCredential = await signInWithCredential(auth, credential);
      
      // Check if user exists in Firestore
      const userDoc = await getDoc(doc(firestore, 'users', userCredential.user.uid));
      
      if (!userDoc.exists()) {
        // New user - go to role selection
        navigation.navigate('RoleSelection', { 
          userId: userCredential.user.uid, 
          phoneNumber 
        });
      } else {
        // Existing user - go to dashboard based on role
        const userData = userDoc.data();
        navigateToDashboard(userData.role, navigation);
      }
    } catch (error) {
      Alert.alert('Error', 'Invalid OTP');
    }
  };

  return (
    <View>
      <OTPInput value={otp} onChange={setOTP} length={6} />
      <TouchableOpacity onPress={verifyOTP}>
        <Text>Verify OTP</Text>
      </TouchableOpacity>
    </View>
  );
}

// Helper function to navigate based on role
function navigateToDashboard(role, navigation) {
  switch(role) {
    case 'user':
      navigation.replace('UserDashboard');
      break;
    case 'owner':
      navigation.replace('OwnerDashboard');
      break;
    case 'manager':
      navigation.replace('ManagerDashboard');
      break;
    case 'caretaker':
      navigation.replace('CaretakerDashboard');
      break;
    case 'admin':
      navigation.replace('AdminDashboard');
      break;
  }
}
```

#### Owner Registration Flow (NEW)

```javascript
// src/screens/auth/OwnerSetupScreen.js
export default function OwnerSetupScreen({ route, navigation }) {
  const { userId, phoneNumber, name, email, profilePicture } = route.params;
  
  // Operational permissions
  const [hasOperationalPermissions, setHasOperationalPermissions] = useState(false);
  const [managedTurfIds, setManagedTurfIds] = useState([]); // Empty = all turfs
  
  // Company details
  const [companyName, setCompanyName] = useState('');
  const [companyLogo, setCompanyLogo] = useState(null);
  const [gstNumber, setGstNumber] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [companyPhone, setCompanyPhone] = useState(phoneNumber);
  const [companyEmail, setCompanyEmail] = useState(email);
  const [description, setDescription] = useState('');

  const createCompany = async () => {
    try {
      const batch = writeBatch(firestore);
      
      // Generate invite code
      const inviteCode = generateInviteCode(); // e.g., "GREEN123"
      
      // Create company document
      const companyRef = doc(collection(firestore, 'companies'));
      const companyData = {
        name: companyName,
        ownerUserIds: [userId], // Array for multiple owners
        phone: companyPhone,
        email: companyEmail,
        logo: companyLogo,
        description: description,
        gstNumber: gstNumber,
        panNumber: panNumber,
        inviteCode: {
          code: inviteCode,
          link: `https://turfbooking.app/join/${inviteCode}`,
          createdAt: serverTimestamp(),
          lastChangedAt: serverTimestamp(),
          lastChangedBy: userId
        },
        subscription: {
          status: 'trial',
          trialStartDate: serverTimestamp(),
          trialEndDate: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)), // 30 days
          totalGrounds: 0,
          pricePerGroundMonthly: 299,
          totalMonthlyFee: 0,
          discount: 0,
          paymentHistory: []
        },
        managers: [],
        caretakers: [],
        unassignedCaretakers: [],
        stats: {
          totalTurfs: 0,
          totalGrounds: 0,
          totalBookings: 0,
          totalRevenue: 0,
          activeUsers: 0
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      batch.set(companyRef, companyData);
      
      // Update user document
      const userRef = doc(firestore, 'users', userId);
      batch.update(userRef, {
        role: 'owner',
        companyId: companyRef.id,
        hasOperationalPermissions: hasOperationalPermissions,
        managedTurfIds: managedTurfIds, // Empty array means all turfs
        name: name,
        email: email,
        profilePicture: profilePicture
      });
      
      await batch.commit();
      
      navigation.replace('OwnerDashboard');
    } catch (error) {
      Alert.alert('Error', 'Failed to create company');
    }
  };

  return (
    <ScrollView>
      <Text>Setup Your Company</Text>
      
      {/* Company Details */}
      <TextInput
        label="Company Name"
        value={companyName}
        onChangeText={setCompanyName}
      />
      <ImagePicker
        label="Company Logo"
        value={companyLogo}
        onChange={setCompanyLogo}
      />
      <TextInput label="GST Number" value={gstNumber} onChangeText={setGstNumber} />
      <TextInput label="PAN Number" value={panNumber} onChangeText={setPanNumber} />
      <TextInput label="Description" value={description} onChangeText={setDescription} multiline />
      
      {/* Operational Permissions Checkbox */}
      <View style={styles.checkboxContainer}>
        <Checkbox
          value={hasOperationalPermissions}
          onValueChange={setHasOperationalPermissions}
        />
        <Text>I want to manage day-to-day operations (approve bookings, handle chats, etc.)</Text>
      </View>
      
      <Text style={styles.helpText}>
        You can change this setting anytime from Settings
      </Text>
      
      <TouchableOpacity onPress={createCompany}>
        <Text>Create Company</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function generateInviteCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
```

#### Join Company Screen (Manager/Caretaker)

```javascript
// src/screens/auth/JoinCompanyScreen.js
export default function JoinCompanyScreen({ route, navigation }) {
  const { userId, role, name, email, profilePicture } = route.params; // role: 'manager' or 'caretaker'
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [company, setCompany] = useState(null);
  const [availableTurfs, setAvailableTurfs] = useState([]);
  const [selectedTurfs, setSelectedTurfs] = useState([]); // For managers only

  const validateInviteCode = async () => {
    setLoading(true);
    try {
      // Find company with this invite code
      const companiesQuery = query(
        collection(firestore, 'companies'),
        where('inviteCode.code', '==', inviteCode.toUpperCase())
      );
      const snapshot = await getDocs(companiesQuery);
      
      if (snapshot.empty) {
        Alert.alert('Error', 'Invalid invite code');
        setLoading(false);
        return;
      }
      
      const companyDoc = snapshot.docs[0];
      setCompany({ id: companyDoc.id, ...companyDoc.data() });
      
      if (role === 'manager') {
        // Fetch turfs for selection
        const turfsQuery = query(
          collection(firestore, 'turfs'),
          where('companyId', '==', companyDoc.id)
        );
        const turfsSnapshot = await getDocs(turfsQuery);
        const turfs = turfsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAvailableTurfs(turfs);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to validate code');
    }
    setLoading(false);
  };

  const joinCompany = async () => {
    if (!company) return;
    
    // Validate manager must select at least one turf
    if (role === 'manager' && selectedTurfs.length === 0) {
      Alert.alert('Error', 'Please select at least one turf to manage');
      return;
    }
    
    setLoading(true);
    try {
      const batch = writeBatch(firestore);
      
      // Update user document
      const userRef = doc(firestore, 'users', userId);
      const userData = {
        companyId: company.id,
        role: role,
        name: name,
        email: email,
        profilePicture: profilePicture,
        isActive: true,
        isSuspended: false
      };
      
      if (role === 'manager') {
        userData.assignedTurfIds = selectedTurfs;
        userData.selectedTurfId = selectedTurfs[0] || null;
        
        // Add manager to company
        batch.update(doc(firestore, 'companies', company.id), {
          managers: arrayUnion(userId)
        });
        
        // Add manager to each selected turf
        for (const turfId of selectedTurfs) {
          batch.update(doc(firestore, 'turfs', turfId), {
            managerIds: arrayUnion(userId)
          });
        }
      } else {
        // Caretaker - initially unassigned
        userData.assignedTurfId = null;
        userData.isAssigned = false;
        
        // Add to company's caretakers and unassigned list
        batch.update(doc(firestore, 'companies', company.id), {
          caretakers: arrayUnion(userId),
          unassignedCaretakers: arrayUnion(userId)
        });
      }
      
      batch.set(userRef, userData, { merge: true });
      await batch.commit();
      
      navigation.replace(role === 'manager' ? 'ManagerDashboard' : 'CaretakerDashboard');
    } catch (error) {
      Alert.alert('Error', 'Failed to join company');
    }
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Join a Company</Text>
      <Text style={styles.subtitle}>Enter the invite code shared by your turf owner</Text>
      
      <TextInput
        value={inviteCode}
        onChangeText={setInviteCode}
        placeholder="e.g., GREEN123"
        autoCapitalize="characters"
        style={styles.input}
      />
      
      <TouchableOpacity onPress={validateInviteCode} disabled={loading}>
        <Text>{loading ? 'Validating...' : 'Validate Code'}</Text>
      </TouchableOpacity>
      
      {company && (
        <View style={styles.companyInfo}>
          <Text style={styles.companyName}>Company: {company.name}</Text>
          
          {role === 'manager' && availableTurfs.length > 0 && (
            <View style={styles.turfSelection}>
              <Text style={styles.sectionTitle}>Select Turfs to Manage:</Text>
              <Text style={styles.helpText}>(Owner can modify this later)</Text>
              {availableTurfs.map(turf => (
                <TouchableOpacity
                  key={turf.id}
                  style={[
                    styles.turfItem,
                    selectedTurfs.includes(turf.id) && styles.turfItemSelected
                  ]}
                  onPress={() => {
                    if (selectedTurfs.includes(turf.id)) {
                      setSelectedTurfs(selectedTurfs.filter(id => id !== turf.id));
                    } else {
                      setSelectedTurfs([...selectedTurfs, turf.id]);
                    }
                  }}
                >
                  <Text>{turf.name}</Text>
                  <Text style={styles.turfLocation}>{turf.location.city}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          
          {role === 'caretaker' && (
            <View style={styles.caretakerInfo}>
              <Text>After joining, you will be in "Waiting for Assignment" status.</Text>
              <Text>A manager or owner will assign you to a specific turf.</Text>
            </View>
          )}
          
          <TouchableOpacity 
            onPress={joinCompany} 
            disabled={loading || (role === 'manager' && selectedTurfs.length === 0)}
            style={styles.joinButton}
          >
            <Text>{loading ? 'Joining...' : 'Join Company'}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
```

---

### 7.2 PRIMARY BOOKING SYSTEM - CALENDAR FLOW

#### Complete User Booking Journey (Fixed Price)

| Step | Description | Details |
|------|-------------|---------|
| **Step 1** | Turf Selection | Via QR scan (turf pre-selected), search (name/location/sport), or home screen browse |
| **Step 2** | View Turf Details | Images, location, amenities, reviews; Click "Check Availability" button |
| **Step 3** | Select Date | Calendar view (next 45 days enabled); Color-coded availability indicators |
| **Step 4** ⭐ | Select Sport | Shows all sports available at this turf; User selects ONE sport (e.g., Cricket); This determines which grounds are eligible |
| **Step 5** ⭐ | Select Time Range | User selects START time (e.g., 17:00); User selects END time (e.g., 19:00); System calculates duration automatically |
| **Step 6** ⭐ | View ALL Ground Availability | System shows ALL grounds that support selected sport; For EACH ground simultaneously displays: Availability status, Calculated fixed price, Price breakdown |
| **Step 7** | Select Ground & Confirm | User taps desired available ground; Reviews summary with fixed price; 5-second confirmation dialog; Booking created (status: pending) |
| **Step 8** | Manager/Owner Approval | Manager (or Owner with operational permissions) sees request, approves; Booking confirmed ✅ |

#### Calendar Color Coding

| Color | Status |
|-------|--------|
| 🟢 Green | Fully available |
| 🟡 Yellow | Partially booked |
| 🔴 Red | Fully booked |
| ⚫ Grey | Past dates (disabled) |
| 🟠 Orange | Academy sessions (blocked) |
| 🔵 Blue | Confirmed bookings |

#### Time Slot Picker Features

- BookMyShow-style slot picker
- Shows pricing per slot based on:
  - Time of day (morning/afternoon/evening)
  - Day type (weekday/weekend)
- Minimum 1 hour, 30-min intervals
- Shows "Booked" for unavailable slots
- Multi-select for multiple hours
- Real-time price calculation

#### 5-Second Confirmation Dialog

- Shows final details
- "Are you sure?" message
- Progress indicator (5s countdown)
- After 5s: "Confirm Booking" button enabled

---

### 7.3 CHAT SYSTEM WITH NEGOTIATION (SECONDARY METHOD)

#### Chat Architecture

```
Users Collection
       ↓
Chats Collection (user-company pairs)
       ↓
Messages Subcollection
       ├── Text messages
       ├── Negotiation cards
       ├── Booking cards
       └── Location shares
```

#### Chat Access Rules

| Role | Chat Access |
|------|-------------|
| User | Own chats only |
| Manager | Chats for turfs they manage (all turf managers can view & reply - no assignment) |
| Owner | NO chat access (read-only oversight not implemented) |
| Caretaker | NO chat access |

#### Message Types

**1. Text Message**
```javascript
{
  type: 'text',
  text: 'Is the turf available tomorrow?',
  senderId: 'userId',
  senderType: 'user',
  timestamp: Timestamp
}
```

**2. Negotiation Card** (sent by user)
```javascript
{
  type: 'negotiation_card',
  text: 'Requesting booking',
  senderId: 'userId',
  senderType: 'user',
  negotiationCard: {
    turfId: 'turfId',
    turfName: 'Green Arena',
    groundId: 'ground-1',
    sport: 'cricket',
    date: '2026-01-15',
    startTime: '17:00',
    endTime: '18:00',
    duration: 1,
    originalPrice: 1500,
    negotiatedPrice: 1200, // User's offer
    status: 'pending' // pending | accepted | rejected | expired
  },
  timestamp: Timestamp
}
```

**3. Booking Card** (sent when booking confirmed)
```javascript
{
  type: 'booking_card',
  text: 'Booking confirmed!',
  senderId: 'managerId',
  senderType: 'manager',
  bookingCard: {
    bookingId: 'bookingId',
    turfName: 'Green Arena',
    date: '2026-01-15',
    time: '17:00 - 18:00',
    amount: 1200,
    status: 'confirmed',
    location: {
      address: '123, Link Road, Andheri',
      googleMapsLink: 'https://maps.google.com/...'
    }
  },
  timestamp: Timestamp
}
```

#### Negotiation Flow - Detailed Steps

**User Side:**
1. User enters chat with company
2. Types message or clicks "Request Booking"
3. If clicks "Request Booking":
   - Modal opens with booking form
   - Select turf (if company has multiple)
   - Select ground
   - Select sport
   - Select date
   - Check availability → Shows available slots
   - Select time slot(s)
   - System shows original price
   - User can modify price (negotiation)
   - User adds message (optional)
   - Click "Send Request"
4. Negotiation card appears in chat
5. Status: "Pending" with loading indicator
6. User waits for manager response

**Manager Side:**
1. Manager receives notification "New negotiation request"
2. Opens chat, sees negotiation card
3. Card shows:
   - User name
   - Turf, ground, sport
   - Date, time
   - Original price: ₹1500
   - User's offer: ₹1200
   - Buttons: [Accept ₹1200] [Counter Offer] [Reject]

4. Manager actions:

**Option A - Accept:**
- Clicks "Accept ₹1200"
- System checks slot availability (Firebase Transaction)
- If available: Creates booking, sends booking card to user
- If taken: Shows "Slot already booked, negotiation expired"

**Option B - Counter Offer:**
- Clicks "Counter Offer"
- Enters new price (₹1350)
- Sends counter offer card
- Now user sees: [Accept ₹1350] [Counter Again] [Cancel]

**Option C - Reject:**
- Clicks "Reject"
- Optionally adds reason
- Card status changes to "Rejected"

---

### 7.4 PRICING CALCULATION ENGINE

#### Dynamic Pricing Logic

```javascript
// src/utils/priceUtils.js

/**
 * Calculate price for a booking based on:
 * - Ground
 * - Sport
 * - Date (weekday/weekend)
 * - Time slots
 */
export function calculateBookingPrice(ground, sport, date, startTime, endTime) {
  // 1. Determine day type
  const dayType = isWeekend(date) ? 'weekend' : 'weekday';
  
  // 2. Get pricing for this sport
  const sportPricing = ground.pricing[sport];
  if (!sportPricing) {
    throw new Error(`No pricing found for sport: ${sport}`);
  }
  const dayPricing = sportPricing[dayType];
  
  // 3. Break down time range into slots
  const slots = breakdownTimeIntoSlots(startTime, endTime, dayPricing);
  
  // 4. Calculate total
  let totalAmount = 0;
  let breakdown = [];
  
  for (const slot of slots) {
    const slotPrice = slot.hourlyRate * slot.duration;
    totalAmount += slotPrice;
    breakdown.push({
      period: slot.period,
      time: `${slot.start} - ${slot.end}`,
      duration: slot.duration,
      rate: slot.hourlyRate,
      amount: slotPrice
    });
  }
  
  return {
    totalAmount,
    breakdown,
    baseRate: slots[0]?.hourlyRate || 0
  };
}

/**
 * Example: 17:00 - 19:30
 * If pricing structure is:
 *   evening (18:00-23:00): 1500/hr
 *   afternoon (10:00-18:00): 800/hr
 * 
 * Result:
 *   17:00-18:00: 1 hour @ 800 = 800
 *   18:00-19:30: 1.5 hours @ 1500 = 2250
 *   Total: 3050
 */
function breakdownTimeIntoSlots(startTime, endTime, dayPricing) {
  const slots = [];
  let currentTime = startTime;
  
  // Sort pricing periods by start time
  const periods = Object.entries(dayPricing).sort((a, b) => {
    return timeToMinutes(a[1].start) - timeToMinutes(b[1].start);
  });
  
  while (currentTime < endTime) {
    // Find which pricing period this time falls into
    const period = periods.find(([name, config]) => {
      return currentTime >= config.start && currentTime < config.end;
    });
    
    if (!period) {
      throw new Error(`No pricing period found for time: ${currentTime}`);
    }
    
    const [periodName, periodConfig] = period;
    
    // Calculate how much time is in this period
    const periodEnd = periodConfig.end;
    const slotEnd = endTime < periodEnd ? endTime : periodEnd;
    const durationMinutes = timeToMinutes(slotEnd) - timeToMinutes(currentTime);
    const durationHours = durationMinutes / 60;
    
    slots.push({
      period: periodName,
      start: currentTime,
      end: slotEnd,
      duration: durationHours,
      hourlyRate: periodConfig.hourlyRate
    });
    
    currentTime = slotEnd;
  }
  
  return slots;
}

function timeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

function isWeekend(dateStr) {
  const date = new Date(dateStr);
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday or Saturday
}

/**
 * Calculate extension price
 */
export function calculateExtensionPrice(originalBooking, extensionMinutes) {
  const currentEndTime = originalBooking.endTime;
  const newEndTime = addMinutes(currentEndTime, extensionMinutes);
  const ground = originalBooking.ground;
  const sport = originalBooking.sport;
  const date = originalBooking.date;
  
  // Calculate price for the extension period only
  const extensionPrice = calculateBookingPrice(
    ground,
    sport,
    date,
    currentEndTime,
    newEndTime
  );
  
  return {
    extensionAmount: extensionPrice.totalAmount,
    newEndTime,
    newTotalAmount: originalBooking.totalAmount + extensionPrice.totalAmount
  };
}

// Example usage:
const ground = {
  groundId: 'ground-1',
  pricing: {
    cricket: {
      weekday: {
        morning: { start: '06:00', end: '10:00', hourlyRate: 1000 },
        afternoon: { start: '10:00', end: '18:00', hourlyRate: 800 },
        evening: { start: '18:00', end: '23:00', hourlyRate: 1500 }
      },
      weekend: {
        morning: { start: '06:00', end: '10:00', hourlyRate: 1200 },
        afternoon: { start: '10:00', end: '18:00', hourlyRate: 1000 },
        evening: { start: '18:00', end: '23:00', hourlyRate: 1800 }
      }
    }
  }
};

const result = calculateBookingPrice(ground, 'cricket', '2026-01-15', '17:00', '19:30');
console.log(result);
// {
//   totalAmount: 3050,
//   breakdown: [
//     { period: 'afternoon', time: '17:00 - 18:00', duration: 1, rate: 800, amount: 800 },
//     { period: 'evening', time: '18:00 - 19:30', duration: 1.5, rate: 1500, amount: 2250 }
//   ],
//   baseRate: 800
// }
```
---

### 7.5 CARETAKER MODULE

#### Caretaker Assignment Flow (NEW)

```
1. Caretaker signs up → Selects "I am a Caretaker" → Enters company invite code
2. Caretaker joins company → Status: "Unassigned" (appears in unassignedCaretakers list)
3. Caretaker Dashboard shows "Waiting for Assignment" screen
4. Manager/Owner (with operational permissions) sees caretaker in "Unassigned Caretakers" list
5. Manager/Owner assigns caretaker to a specific turf
6. Caretaker now has access to that turf's bookings
7. One caretaker = One turf (strict rule)
```

#### Caretaker Suspension Rules

| Action | Who Can Do | Result |
|--------|------------|--------|
| Suspend Caretaker | Manager or Owner | Caretaker loses access, status = suspended |
| Delete Caretaker | After 30 days of suspension | Permanent removal via Cloud Function |

#### Calendar View with Time-Based Visibility Rules

**Current Date Bookings (Full Visibility):**
```
┌─────────────────────────────────────┐
│  Today - Jan 15, 2026               │
├─────────────────────────────────────┤
│                                     │
│  17:00 - 18:00                      │
│  Rahul Kumar                        │
│  +91 98765 43210   [📞 Call]        │
│  Ground-1 • Cricket                 │
│  Amount: ₹1,500                     │
│  Advance: ₹150 (Paid)               │
│  [Mark Attendance] [Collect Payment]│
│                                     │
│  18:00 - 19:00                      │
│  Priya Sharma                       │
│  +91 98123 45678   [📞 Call]        │
│  Ground-2 • Badminton               │
│  Amount: ₹700                       │
│  No Advance                         │
│  [Mark Attendance] [Collect Payment]│
│                                     │
└─────────────────────────────────────┘
```

**Future Dates (Limited Visibility):**
```
┌─────────────────────────────────────┐
│  Tomorrow - Jan 16, 2026            │
├─────────────────────────────────────┤
│                                     │
│  Amit Patel                         │
│  Amount: ₹2,000                     │
│  Time: 🔒 Hidden                    │
│                                     │
│  Sneha Reddy                        │
│  Amount: ₹1,200                     │
│  Time: 🔒 Hidden                    │
│                                     │
└─────────────────────────────────────┘
```

#### Caretaker Actions (Today Only)

| Action | Description |
|--------|-------------|
| **Mark Attendance** | Confirms user showed up for booking |
| **Collect Payment** | Records cash + online payment split |
| **Extend Time** | Adds 30/60/90 min extension if next slot available |
| **Call User** | Direct phone call to user |
| **Report Issue** | Log maintenance issues |

#### Payment Collection Modal

- Shows total amount and advance paid
- Two input fields: Cash Amount (₹) and Online Amount (₹)
- Validates: Cash + Online = Remaining Amount
- Records who collected payment
- Updates booking status to "completed"

#### Time Extension Modal

- Shows current end time and amount
- Extension options: 30 min, 1 hour, 1.5 hours
- Checks next slot availability in real-time
- Shows extension charge and new total
- If next slot booked: "⚠️ Cannot extend - next slot is booked"

---

### 7.6 MANAGER ANALYTICS DASHBOARD

#### Manager Dashboard - Turf-Level Analytics Only

Managers can **only** see analytics for turfs they are assigned to (assignedTurfIds).

#### KPI Cards

| Metric | Icon | Color |
|--------|------|-------|
| Total Bookings | 📅 calendar-check | Green |
| Revenue | 💰 currency-inr | Blue |
| Utilization | 📈 chart-line | Orange |
| Avg Value | 📊 trending-up | Purple |

#### Charts Available

1. **Revenue Trend** (Line Chart)
   - Shows daily/weekly/monthly revenue
   - Bezier curve for smooth visualization

2. **Sport-wise Revenue** (Pie Chart)
   - Breakdown by sport type
   - Shows booking count and revenue per sport

3. **Peak Booking Hours** (Bar Chart)
   - Hourly booking distribution
   - Identifies busiest time slots

#### Excel-Like Data Table

| Column | Type |
|--------|------|
| Date | Sortable |
| Time | Text |
| Customer | Text |
| Phone | Text |
| Ground | Text |
| Sport | Text |
| Duration (hrs) | Numeric |
| Amount (₹) | Numeric |
| Advance (₹) | Numeric |
| Cash (₹) | Numeric |
| Online (₹) | Numeric |
| Status | Badge |
| Booked At | Timestamp |

#### Export to Excel

- Creates XLSX file with two sheets:
  - **Bookings**: All booking data
  - **Summary**: KPI metrics
- Uses `xlsx` library for generation
- Shares via `expo-sharing`

---

### 7.7 OWNER ANALYTICS DASHBOARD (NEW)

#### Owner Dashboard - Company-Wide Analytics

Owners see aggregated data across **ALL turfs** in their company.

#### Owner-Specific KPI Cards

| Metric | Icon | Color | Description |
|--------|------|-------|-------------|
| Total Revenue | 💰 | Blue | All turfs combined |
| Total Bookings | 📅 | Green | All turfs combined |
| Active Turfs | 🏟️ | Orange | Number of turfs |
| Active Managers | 👥 | Purple | Number of non-suspended managers |
| Active Caretakers | 🧑‍💼 | Teal | Number of assigned caretakers |
| Subscription Status | ⭐ | Gold | Trial/Active/Expired |

#### Owner-Exclusive Charts

1. **Cross-Turf Revenue Comparison** (Bar Chart)
   - Revenue by turf
   - Identify best/worst performing turfs

2. **Manager Performance** (Table/Chart)
   - Bookings handled per manager
   - Revenue generated per manager
   - Average response time (optional)

3. **Financial Reports** (Line + Pie)
   - Profit/Loss overview
   - Revenue vs Expenses
   - Payment method breakdown (Cash vs Online)

4. **Turf Utilization Heatmap**
   - Which turfs are most/least utilized
   - Peak hours across all turfs

#### Owner Dashboard Layout

```
┌─────────────────────────────────────────────────────┐
│  OWNER DASHBOARD - Green Sports Arena               │
├─────────────────────────────────────────────────────┤
│                                                     │
│  [📊 Overview]  [🏟️ Turfs]  [👥 Team]  [💳 Billing] │
│                                                     │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │₹3.5L    │ │450      │ │3        │ │5        │   │
│  │Revenue  │ │Bookings │ │Turfs    │ │Managers │   │
│  │+15% ↑   │ │+8% ↑    │ │         │ │         │   │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘   │
│                                                     │
│  [Revenue by Turf - Bar Chart]                      │
│  ████████████████ Andheri    ₹1.5L                  │
│  ████████████     Bandra     ₹1.0L                  │
│  ████████         Juhu       ₹1.0L                  │
│                                                     │
│  [Manager Performance]                              │
│  ┌────────────────────────────────────────────┐     │
│  │ Manager     │ Bookings │ Revenue │ Status  │     │
│  │ Rahul       │ 150      │ ₹1.2L   │ Active  │     │
│  │ Priya       │ 120      │ ₹1.0L   │ Active  │     │
│  │ Amit        │ 180      │ ₹1.3L   │ Active  │     │
│  └────────────────────────────────────────────┘     │
│                                                     │
│  [Financial Summary - This Month]                   │
│  Revenue:  ₹3,50,000                                │
│  Expenses: ₹50,000                                  │
│  Net:      ₹3,00,000                                │
│                                                     │
└─────────────────────────────────────────────────────┘
```

#### Owner Permissions Based on Operational Checkbox

| Feature | Without Operational Permissions | With Operational Permissions |
|---------|--------------------------------|------------------------------|
| View Company Analytics | ✅ Full | ✅ Full |
| View Individual Booking Details | ❌ Aggregated only | ✅ Full access |
| Approve/Reject Bookings | ❌ | ✅ |
| Respond to Chats | ❌ | ✅ |
| Create Academies | ❌ | ✅ |
| Block Slots | ❌ | ✅ |
| Assign Caretakers | ❌ | ✅ |
| Track Expenses | ❌ (View only) | ✅ (Add/Edit) |
| Manage Managers (suspend) | ✅ Always | ✅ Always |
| Manage Subscription | ✅ Always | ✅ Always |
| Create/Delete Turfs | ✅ Always | ✅ Always |
| Edit Company Profile | ✅ Always | ✅ Always |
| Generate QR Codes | ✅ Always | ✅ Always |
| Change Invite Code | ✅ Always | ✅ Always |

#### Operational Permissions Settings Screen

```javascript
// src/screens/owner/OperationalSettingsScreen.js
export default function OperationalSettingsScreen() {
  const { userId } = useAuth();
  const [hasOperationalPermissions, setHasOperationalPermissions] = useState(false);
  const [managedTurfIds, setManagedTurfIds] = useState([]);
  const [manageAllTurfs, setManageAllTurfs] = useState(true);
  const [turfs, setTurfs] = useState([]);
  
  const saveSettings = async () => {
    await updateDoc(doc(firestore, 'users', userId), {
      hasOperationalPermissions,
      managedTurfIds: manageAllTurfs ? [] : managedTurfIds // Empty array = all turfs
    });
    Alert.alert('Success', 'Settings saved');
  };
  
  return (
    <View>
      <Text style={styles.title}>Operational Permissions</Text>
      
      <View style={styles.checkboxRow}>
        <Checkbox
          value={hasOperationalPermissions}
          onValueChange={setHasOperationalPermissions}
        />
        <Text>Enable operational permissions (manage day-to-day operations)</Text>
      </View>
      
      {hasOperationalPermissions && (
        <View style={styles.turfSelection}>
          <Text style={styles.subtitle}>Select turfs to manage:</Text>
          
          <View style={styles.checkboxRow}>
            <Checkbox
              value={manageAllTurfs}
              onValueChange={setManageAllTurfs}
            />
            <Text>Manage all turfs</Text>
          </View>
          
          {!manageAllTurfs && (
            <View>
              {turfs.map(turf => (
                <View key={turf.id} style={styles.checkboxRow}>
                  <Checkbox
                    value={managedTurfIds.includes(turf.id)}
                    onValueChange={(checked) => {
                      if (checked) {
                        setManagedTurfIds([...managedTurfIds, turf.id]);
                      } else {
                        setManagedTurfIds(managedTurfIds.filter(id => id !== turf.id));
                      }
                    }}
                  />
                  <Text>{turf.name}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
      
      <Button title="Save Settings" onPress={saveSettings} />
    </View>
  );
}
```

#### Manager Management Screen (Owner)

```javascript
// src/screens/owner/ManagerManagementScreen.js
export default function ManagerManagementScreen() {
  const { companyId, userId } = useAuth();
  const [managers, setManagers] = useState([]);
  
  const suspendManager = async (managerId, reason) => {
    const batch = writeBatch(firestore);
    
    // Update manager status
    batch.update(doc(firestore, 'users', managerId), {
      isSuspended: true,
      suspendedAt: serverTimestamp(),
      suspendedBy: userId,
      suspensionReason: reason,
      canBeDeletedAfter: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)) // 30 days
    });
    
    // Log the action
    batch.set(doc(collection(firestore, 'owner_logs')), {
      companyId,
      performedBy: userId,
      performedByRole: 'owner',
      action: 'manager_suspended',
      targetType: 'user',
      targetId: managerId,
      details: { reason },
      timestamp: serverTimestamp()
    });
    
    await batch.commit();
    Alert.alert('Success', 'Manager suspended. They can be permanently deleted after 30 days.');
  };
  
  const reinstateManager = async (managerId) => {
    const batch = writeBatch(firestore);
    
    batch.update(doc(firestore, 'users', managerId), {
      isSuspended: false,
      suspendedAt: null,
      suspendedBy: null,
      suspensionReason: null,
      canBeDeletedAfter: null
    });
    
    // Log the action
    batch.set(doc(collection(firestore, 'owner_logs')), {
      companyId,
      performedBy: userId,
      performedByRole: 'owner',
      action: 'manager_reinstated',
      targetType: 'user',
      targetId: managerId,
      timestamp: serverTimestamp()
    });
    
    await batch.commit();
    Alert.alert('Success', 'Manager reinstated');
  };
  
  const modifyManagerTurfs = async (managerId, newTurfIds) => {
    const batch = writeBatch(firestore);
    
    // Get current assigned turfs
    const managerDoc = await getDoc(doc(firestore, 'users', managerId));
    const currentTurfIds = managerDoc.data().assignedTurfIds || [];
    
    // Remove manager from old turfs
    for (const turfId of currentTurfIds) {
      if (!newTurfIds.includes(turfId)) {
        batch.update(doc(firestore, 'turfs', turfId), {
          managerIds: arrayRemove(managerId)
        });
      }
    }
    
    // Add manager to new turfs
    for (const turfId of newTurfIds) {
      if (!currentTurfIds.includes(turfId)) {
        batch.update(doc(firestore, 'turfs', turfId), {
          managerIds: arrayUnion(managerId)
        });
      }
    }
    
    // Update manager's assigned turfs
    batch.update(doc(firestore, 'users', managerId), {
      assignedTurfIds: newTurfIds,
      selectedTurfId: newTurfIds[0] || null
    });
    
    await batch.commit();
    Alert.alert('Success', 'Manager turf assignments updated');
  };
  
  return (
    <View>
      <Text style={styles.title}>Manager Management</Text>
      
      {managers.map(manager => (
        <Card key={manager.id} style={styles.managerCard}>
          <View style={styles.managerHeader}>
            <Avatar source={{ uri: manager.profilePicture }} />
            <View>
              <Text style={styles.managerName}>{manager.name}</Text>
              <Text style={styles.managerPhone}>{manager.phone}</Text>
            </View>
            <Badge 
              status={manager.isSuspended ? 'error' : 'success'}
              text={manager.isSuspended ? 'Suspended' : 'Active'}
            />
          </View>
          
          <Text>Assigned Turfs: {manager.assignedTurfIds?.length || 0}</Text>
          
          <View style={styles.buttonRow}>
            <Button 
              title="Edit Turfs" 
              onPress={() => openTurfSelectionModal(manager)}
            />
            {manager.isSuspended ? (
              <Button 
                title="Reinstate" 
                onPress={() => reinstateManager(manager.id)}
              />
            ) : (
              <Button 
                title="Suspend" 
                color="red"
                onPress={() => openSuspendDialog(manager)}
              />
            )}
          </View>
        </Card>
      ))}
    </View>
  );
}
```
---

### 7.8 ACADEMY SYSTEM

#### Overview

**Purpose**: Allow managers (or owners with operational permissions) to bulk-book recurring slots for academies (e.g., football coaching, cricket training) that block those time slots from regular user bookings.

#### Key Features

| Feature | Description |
|---------|-------------|
| Recurring Schedule | Manager selects any combination of days (Mon-Sun) |
| Contract Period | 1-3 months, manually renewable |
| Auto-Generation | All sessions auto-generated for contract period |
| Slot Blocking | Academy slots blocked from regular bookings |
| Payment Tracking | Track cash + online payments for academy |
| Session Cancellation | Manager/Owner (with operational permissions) can cancel individual sessions |
| Renewal Notifications | 5 days before expiry reminder |

#### Academy Creation Form

1. **Basic Details**
   - Academy Name (e.g., "Elite Football Academy")
   - Ground selection
   - Sport selection (single sport)
   - Contact Person
   - Contact Phone
   - Description (optional)

2. **Schedule**
   - Select days (any combination: Mon-Wed-Fri, etc.)
   - Start Time (e.g., 19:00)
   - End Time (e.g., 21:00)
   - Duration auto-calculated

3. **Contract Period**
   - Start Date picker
   - Duration: 1 Month / 2 Months / 3 Months
   - End Date auto-calculated
   - Shows total sessions to be generated

4. **Payment**
   - Total Amount (₹)
   - Cash Amount (₹)
   - Online Amount (₹)
   - Payment Notes (optional)
   - Validation: Cash + Online = Total

#### Session Generation Logic

```javascript
// Generate all academy sessions for the contract period
export async function generateAcademySessions(academyId, academyData) {
  const sessions = [];
  const startDate = new Date(academyData.startDate);
  const endDate = new Date(academyData.endDate);
  const { daysOfWeek, startTime, endTime, duration } = academyData.schedule;
  
  let currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.toLocaleDateString('en-US', { weekday: 'lowercase' });
    
    // Check if this day is in the academy schedule
    if (daysOfWeek.includes(dayOfWeek)) {
      const sessionData = {
        academyId,
        companyId: academyData.companyId,
        turfId: academyData.turfId,
        groundId: academyData.groundId,
        academyName: academyData.name,
        sport: academyData.sport,
        date: currentDate.toISOString().split('T')[0],
        dayOfWeek,
        startTime,
        endTime,
        duration,
        status: 'scheduled',
        isCancelled: false,
        availableForBooking: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      sessions.push(sessionData);
    }
    
    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  // Batch create all sessions
  for (const session of sessions) {
    await addDoc(collection(firestore, 'academy_sessions'), session);
  }
  
  return sessions.length;
}
```

#### Updated Availability Check (Include Academy Sessions)

```javascript
export async function checkGroundAvailability(turfId, groundId, date, startTime, endTime) {
  // Get regular bookings
  const bookingsQuery = query(
    collection(firestore, 'bookings'),
    where('turfId', '==', turfId),
    where('groundId', '==', groundId),
    where('date', '==', date),
    where('status', 'in', ['confirmed', 'in_progress', 'pending'])
  );
  const bookingsSnapshot = await getDocs(bookingsQuery);
  const bookings = bookingsSnapshot.docs.map(doc => doc.data());
  
  // Get academy sessions for this date
  const academySessionsQuery = query(
    collection(firestore, 'academy_sessions'),
    where('turfId', '==', turfId),
    where('groundId', '==', groundId),
    where('date', '==', date),
    where('isCancelled', '==', false) // Only active sessions
  );
  const academySessionsSnapshot = await getDocs(academySessionsQuery);
  const academySessions = academySessionsSnapshot.docs.map(doc => ({
    ...doc.data(),
    type: 'academy'
  }));
  
  // Combine bookings and academy sessions
  const allBlockedSlots = [
    ...bookings.map(b => ({
      start: b.startTime,
      end: b.endTime,
      type: 'booking',
      id: b.bookingId
    })),
    ...academySessions.map(s => ({
      start: s.startTime,
      end: s.endTime,
      type: 'academy',
      id: s.sessionId,
      academyName: s.academyName
    }))
  ];
  
  // Check for time overlaps
  const conflicts = allBlockedSlots.filter(slot =>
    timeOverlaps(startTime, endTime, slot.start, slot.end)
  );
  
  if (conflicts.length > 0) {
    const academyConflict = conflicts.find(c => c.type === 'academy');
    return {
      status: 'unavailable',
      details: {
        message: academyConflict
          ? `Reserved for ${academyConflict.academyName}`
          : 'Already booked',
        conflictType: academyConflict ? 'academy' : 'booking',
        conflicts
      }
    };
  }
  
  return {
    status: 'available',
    details: { message: 'Fully available for booking' }
  };
}
```

---

### 7.9 ADMIN PANEL

#### Admin Panel Features

| Section | Features |
|---------|----------|
| **1. Platform Overview** | Total companies registered, Total turfs/grounds, Total active subscriptions, Total revenue (subscription fees), Total users, Total bookings |
| **2. Company Management** | View all companies, Search companies, View company details, Verify/unverify companies, View company subscription status, Manually update subscriptions, Deactivate/reactivate companies |
| **3. Subscription Management** | View all subscriptions, Filter by status (active/expired/trial/grace_period), Manually activate subscription (offline payment), Set subscription end date, Apply discounts, View payment history |
| **4. Revenue Reports** | Monthly recurring revenue (MRR), Yearly revenue, Revenue by company, Churn rate, Growth metrics, Export financial reports |
| **5. User Management** | View all users, Search users, View user activity, Ban/unban users, View user bookings |
| **6. System Monitoring** | Total database reads/writes (Firebase usage), Storage usage, Cloud Functions execution count, API costs, Error logs, Performance metrics |
| **7. Support & Moderation** | Review flagged content, Moderate reviews, Handle disputes, Support tickets |
| **8. Platform Settings** | Subscription pricing, Platform commission (if applicable), Payment gateway settings, Notification templates, Terms & conditions updates |

#### Manual Subscription Update

```javascript
// Admin - Manual Subscription Update
function ManualSubscriptionUpdate({ companyId }) {
  const [endDate, setEndDate] = useState(new Date());
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('offline');
  
  const handleUpdate = async () => {
    const companyRef = doc(firestore, 'companies', companyId);
    
    await updateDoc(companyRef, {
      'subscription.status': 'active',
      'subscription.subscriptionEndDate': Timestamp.fromDate(endDate),
      'subscription.lastPaymentDate': Timestamp.now(),
      'subscription.lastPaymentAmount': parseInt(amount),
      'subscription.paymentHistory': arrayUnion({
        date: Timestamp.now(),
        amount: parseInt(amount),
        method: 'offline',
        note: 'Manual update by admin'
      })
    });
    
    // Log admin action
    await addDoc(collection(firestore, 'admin_logs'), {
      adminId: auth.currentUser.uid,
      action: 'subscription_updated',
      targetType: 'company',
      targetId: companyId,
      changes: {
        field: 'subscription.status',
        newValue: 'active',
        endDate: endDate.toISOString(),
        amount: parseInt(amount)
      },
      timestamp: Timestamp.now()
    });
    
    Alert.alert('Success', 'Subscription updated successfully');
  };
  
  return (
    <View>
      <TextInput 
        label="Amount (₹)" 
        value={amount} 
        onChangeText={setAmount} 
        keyboardType="numeric" 
      />
      <DatePicker 
        value={endDate} 
        onChange={setEndDate} 
        label="Subscription End Date" 
      />
      <Button mode="contained" onPress={handleUpdate}>
        Update Subscription
      </Button>
    </View>
  );
}
```
---

## 8. NOTIFICATION SYSTEM

### Notification Types

| Type | Recipient | Trigger |
|------|-----------|---------|
| `booking_request` | Manager, Owner (if operational) | New booking request created |
| `booking_confirmed` | User | Manager/Owner approves booking |
| `booking_rejected` | User | Manager/Owner rejects booking |
| `booking_cancelled` | User/Manager/Owner | Booking cancelled |
| `booking_reminder` | User | 1 hour before booking |
| `booking_completed` | User | Booking marked complete |
| `negotiation_request` | Manager | User sends negotiation card |
| `negotiation_accepted` | User | Manager accepts offer |
| `negotiation_rejected` | User | Manager rejects offer |
| `negotiation_counter` | User | Manager sends counter offer |
| `negotiation_expired` | User | Slot booked by another user |
| `chat_message` | User/Manager | New chat message |
| `payment_received` | Manager, Owner | Payment collected |
| `review_received` | Manager, Owner | New review posted |
| `review_response` | User | Manager/Owner responds to review |
| `subscription_expiring` | Owner | 7 days before expiry |
| `subscription_expired` | Owner | Subscription expired |
| `subscription_renewed` | Owner | Subscription renewed |
| `academy_renewal` | Manager | Academy contract expiring in 5 days |
| `manager_suspended` | Manager | Manager suspended by owner |
| `manager_reinstated` | Manager | Manager reinstated by owner |
| `caretaker_assigned` | Caretaker | Caretaker assigned to turf |
| `caretaker_unassigned` | Caretaker | Caretaker removed from turf |

### Push Notification Implementation

```javascript
async function sendNotification(userId, notification) {
  const userDoc = await getDoc(doc(firestore, 'users', userId));
  const userData = userDoc.data();
  
  // Store in notifications collection
  await addDoc(collection(firestore, 'notifications'), {
    userId,
    userRole: userData.role,
    ...notification,
    isRead: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  
  // Send push notification
  if (userData.fcmTokens && userData.fcmTokens.length > 0) {
    await admin.messaging().sendMulticast({
      tokens: userData.fcmTokens,
      notification: {
        title: notification.title,
        body: notification.body
      },
      data: {
        type: notification.type,
        ...notification.action
      }
    });
  }
}

async function sendSMS(phone, message) {
  // MSG91 integration
  const msg91ApiKey = functions.config().msg91.api_key;
  const msg91SenderId = functions.config().msg91.sender_id;
  
  await fetch('https://api.msg91.com/api/v5/flow/', {
    method: 'POST',
    headers: {
      'authkey': msg91ApiKey,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      sender: msg91SenderId,
      mobiles: phone,
      message: message
    })
  });
}

// Notify all company owners
async function notifyOwners(companyId, notification) {
  const companyDoc = await getDoc(doc(firestore, 'companies', companyId));
  const company = companyDoc.data();
  
  for (const ownerId of company.ownerUserIds) {
    await sendNotification(ownerId, notification);
  }
}

// Notify managers of a specific turf
async function notifyTurfManagers(turfId, notification) {
  const turfDoc = await getDoc(doc(firestore, 'turfs', turfId));
  const turf = turfDoc.data();
  
  for (const managerId of turf.managerIds) {
    await sendNotification(managerId, notification);
  }
}
```

---

## 9. FIREBASE CLOUD FUNCTIONS

### Key Cloud Functions to Implement

#### 1. On Booking Created - Check Conflicts and Notify

```javascript
// functions/src/bookingFunctions.js
exports.onBookingCreated = functions.firestore
  .document('bookings/{bookingId}')
  .onCreate(async (snap, context) => {
    const booking = snap.data();
    const bookingId = context.params.bookingId;
    
    // Check for overlapping bookings (race condition prevention)
    const conflicts = await checkBookingConflicts(booking);
    
    if (conflicts.length > 0) {
      // Mark as rejected
      await snap.ref.update({
        status: 'rejected',
        'statusHistory': admin.firestore.FieldValue.arrayUnion({
          status: 'rejected',
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          reason: 'Slot already booked'
        })
      });
      
      // Notify user
      await sendNotification(booking.userId, {
        type: 'booking_rejected',
        title: 'Booking Failed',
        body: 'The slot was already booked by another user.'
      });
      return;
    }
    
    // Notify managers of this turf
    await notifyTurfManagers(booking.turfId, {
      type: 'booking_request',
      title: 'New Booking Request',
      body: `${booking.userName} requested booking for ${booking.date}`
    });
    
    // Also notify owners with operational permissions for this turf
    const companyDoc = await admin.firestore().collection('companies').doc(booking.companyId).get();
    const company = companyDoc.data();
    
    for (const ownerId of company.ownerUserIds) {
      const ownerDoc = await admin.firestore().collection('users').doc(ownerId).get();
      const owner = ownerDoc.data();
      
      if (owner.hasOperationalPermissions) {
        // Check if owner manages this turf (empty array = all turfs)
        if (owner.managedTurfIds.length === 0 || owner.managedTurfIds.includes(booking.turfId)) {
          await sendNotification(ownerId, {
            type: 'booking_request',
            title: 'New Booking Request',
            body: `${booking.userName} requested booking for ${booking.date}`
          });
        }
      }
    }
  });
```

#### 2. On Booking Approved - Handle Negotiations

```javascript
exports.onBookingApproved = functions.firestore
  .document('bookings/{bookingId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    
    // Only trigger if status changed to confirmed
    if (before.status !== 'confirmed' && after.status === 'confirmed') {
      // If there was a negotiation, expire other pending negotiations for same slot
      if (after.negotiation?.chatId) {
        await expireOtherNegotiations(
          after.turfId,
          after.groundId,
          after.date,
          after.startTime,
          after.endTime,
          after.negotiation.chatId
        );
      }
      
      // Notify user
      await sendNotification(after.userId, {
        type: 'booking_confirmed',
        title: 'Booking Confirmed!',
        body: `Your booking for ${after.turfName} on ${after.date} is confirmed`
      });
      
      // Update analytics
      await updateAnalytics(after.companyId, after.turfId, 'booking_confirmed');
    }
  });
```

#### 3. Daily Subscription Check

```javascript
exports.checkSubscriptions = functions.pubsub
  .schedule('0 0 * * *') // Every day at midnight
  .timeZone('Asia/Kolkata')
  .onRun(async (context) => {
    const now = admin.firestore.Timestamp.now();
    
    // Find expiring subscriptions
    const expiring = await admin.firestore()
      .collection('companies')
      .where('subscription.subscriptionEndDate', '<=', now)
      .where('subscription.status', '==', 'active')
      .get();
    
    for (const doc of expiring.docs) {
      const company = doc.data();
      const gracePeriodEnd = new Date(company.subscription.subscriptionEndDate.toDate());
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7);
      
      await doc.ref.update({
        'subscription.status': 'grace_period',
        'subscription.gracePeriodEndDate': admin.firestore.Timestamp.fromDate(gracePeriodEnd)
      });
      
      // Notify all company owners
      for (const ownerId of company.ownerUserIds) {
        await sendNotification(ownerId, {
          type: 'subscription_expired',
          title: 'Subscription Expired',
          body: 'Your subscription has expired. Please renew within 7 days.'
        });
        
        // Send SMS as well
        const owner = await admin.firestore().collection('users').doc(ownerId).get();
        await sendSMS(owner.data().phone, 
          `Your turf subscription has expired. Renew within 7 days to avoid deactivation.`
        );
      }
    }
    
    // Deactivate turfs after grace period
    const expired = await admin.firestore()
      .collection('companies')
      .where('subscription.gracePeriodEndDate', '<=', now)
      .where('subscription.status', '==', 'grace_period')
      .get();
    
    for (const doc of expired.docs) {
      await doc.ref.update({ 'subscription.status': 'expired' });
      
      // Deactivate all turfs
      const turfs = await admin.firestore()
        .collection('turfs')
        .where('companyId', '==', doc.id)
        .get();
      
      for (const turf of turfs.docs) {
        await turf.ref.update({ isActive: false });
      }
    }
  });
```

#### 4. Pre-Aggregate Analytics Daily

```javascript
exports.aggregateAnalytics = functions.pubsub
  .schedule('0 1 * * *') // Every day at 1 AM
  .timeZone('Asia/Kolkata')
  .onRun(async (context) => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];
    
    // Get all companies
    const companies = await admin.firestore().collection('companies').get();
    
    for (const companyDoc of companies.docs) {
      const companyId = companyDoc.id;
      const company = companyDoc.data();
      
      // Get yesterday's bookings for the whole company
      const bookingsSnapshot = await admin.firestore()
        .collection('bookings')
        .where('companyId', '==', companyId)
        .where('date', '==', dateStr)
        .get();
      
      const bookings = bookingsSnapshot.docs.map(doc => doc.data());
      
      // Calculate company-wide metrics (for owners)
      const companyMetrics = calculateDailyMetrics(bookings);
      
      // Add manager performance data
      companyMetrics.managerPerformance = {};
      for (const managerId of company.managers) {
        const managerBookings = bookings.filter(b => 
          b.statusHistory?.some(sh => sh.changedBy === managerId && sh.changedByRole === 'manager')
        );
        companyMetrics.managerPerformance[managerId] = {
          bookingsHandled: managerBookings.length,
          revenueGenerated: managerBookings.reduce((sum, b) => sum + b.totalAmount, 0)
        };
      }
      
      // Store company-wide analytics
      await admin.firestore().collection('analytics').add({
        companyId,
        turfId: null, // null means company-wide
        period: 'daily',
        date: dateStr,
        metrics: companyMetrics,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // Also store turf-specific analytics (for managers)
      const turfs = await admin.firestore()
        .collection('turfs')
        .where('companyId', '==', companyId)
        .get();
      
      for (const turfDoc of turfs.docs) {
        const turfBookings = bookings.filter(b => b.turfId === turfDoc.id);
        const turfMetrics = calculateDailyMetrics(turfBookings);
        
        await admin.firestore().collection('analytics').add({
          companyId,
          turfId: turfDoc.id,
          period: 'daily',
          date: dateStr,
          metrics: turfMetrics,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    }
  });
```

#### 5. Send Booking Reminders

```javascript
exports.sendBookingReminders = functions.pubsub
  .schedule('0 * * * *') // Every hour
  .timeZone('Asia/Kolkata')
  .onRun(async (context) => {
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    const todayStr = now.toISOString().split('T')[0];
    const reminderTime = oneHourLater.toTimeString().substring(0, 5);
    
    // Find bookings starting in 1 hour
    const bookings = await admin.firestore()
      .collection('bookings')
      .where('date', '==', todayStr)
      .where('startTime', '==', reminderTime)
      .where('status', '==', 'confirmed')
      .get();
    
    for (const doc of bookings.docs) {
      const booking = doc.data();
      await sendNotification(booking.userId, {
        type: 'booking_reminder',
        title: 'Booking Reminder',
        body: `Your booking at ${booking.turfName} starts in 1 hour`
      });
    }
  });
```

#### 6. Academy Renewal Reminders

```javascript
exports.sendAcademyRenewalReminders = functions.pubsub
  .schedule('0 9 * * *') // Every day at 9 AM
  .timeZone('Asia/Kolkata')
  .onRun(async (context) => {
    const fiveDaysFromNow = new Date();
    fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);
    const dateStr = fiveDaysFromNow.toISOString().split('T')[0];
    
    // Find academies expiring in 5 days
    const academies = await admin.firestore()
      .collection('academies')
      .where('endDate', '==', dateStr)
      .where('status', '==', 'active')
      .where('renewal.renewalNotificationSent', '==', false)
      .get();
    
    for (const doc of academies.docs) {
      const academy = doc.data();
      
      // Notify the creator (manager or owner)
      await sendNotification(academy.createdBy, {
        type: 'academy_renewal',
        title: 'Academy Contract Expiring',
        body: `${academy.name} contract expires in 5 days. Renew to continue.`
      });
      
      // Mark notification sent
      await doc.ref.update({
        'renewal.renewalNotificationSent': true
      });
    }
  });
```

#### 7. Process Suspended User Deletion (After 30 Days)

```javascript
exports.processSuspendedUserDeletion = functions.pubsub
  .schedule('0 2 * * *') // Every day at 2 AM
  .timeZone('Asia/Kolkata')
  .onRun(async (context) => {
    const now = admin.firestore.Timestamp.now();
    
    // Find users who can be deleted (30 days after suspension)
    const usersToDelete = await admin.firestore()
      .collection('users')
      .where('isSuspended', '==', true)
      .where('canBeDeletedAfter', '<=', now)
      .get();
    
    for (const userDoc of usersToDelete.docs) {
      const user = userDoc.data();
      const batch = admin.firestore().batch();
      
      // Remove from company's managers/caretakers list
      if (user.companyId) {
        const companyRef = admin.firestore().collection('companies').doc(user.companyId);
        
        if (user.role === 'manager') {
          batch.update(companyRef, {
            managers: admin.firestore.FieldValue.arrayRemove(userDoc.id)
          });
          
          // Remove from all assigned turfs
          for (const turfId of user.assignedTurfIds || []) {
            const turfRef = admin.firestore().collection('turfs').doc(turfId);
            batch.update(turfRef, {
              managerIds: admin.firestore.FieldValue.arrayRemove(userDoc.id)
            });
          }
        } else if (user.role === 'caretaker') {
          batch.update(companyRef, {
            caretakers: admin.firestore.FieldValue.arrayRemove(userDoc.id),
            unassignedCaretakers: admin.firestore.FieldValue.arrayRemove(userDoc.id)
          });
          
          // Remove from assigned turf
          if (user.assignedTurfId) {
            const turfRef = admin.firestore().collection('turfs').doc(user.assignedTurfId);
            batch.update(turfRef, {
              caretakerIds: admin.firestore.FieldValue.arrayRemove(userDoc.id)
            });
          }
        }
      }
      
      // Delete the user document
      batch.delete(userDoc.ref);
      
      await batch.commit();
      
      console.log(`Deleted suspended user: ${userDoc.id}`);
    }
  });
```

#### Helper Functions

```javascript
async function checkBookingConflicts(booking) {
  const conflicts = await admin.firestore()
    .collection('bookings')
    .where('turfId', '==', booking.turfId)
    .where('groundId', '==', booking.groundId)
    .where('date', '==', booking.date)
    .where('status', 'in', ['confirmed', 'in_progress'])
    .get();
  
  return conflicts.docs.filter(doc => {
    const existingBooking = doc.data();
    return timeOverlaps(
      booking.startTime, booking.endTime,
      existingBooking.startTime, existingBooking.endTime
    );
  });
}

function timeOverlaps(start1, end1, start2, end2) {
  return start1 < end2 && end1 > start2;
}

async function expireOtherNegotiations(turfId, groundId, date, startTime, endTime, excludeChatId) {
  // Find all pending negotiation cards for the same slot
  const chats = await admin.firestore().collection('chats').get();
  
  for (const chatDoc of chats.docs) {
    if (chatDoc.id === excludeChatId) continue;
    
    const messages = await chatDoc.ref.collection('messages')
      .where('type', '==', 'negotiation_card')
      .where('negotiationCard.status', '==', 'pending')
      .where('negotiationCard.turfId', '==', turfId)
      .where('negotiationCard.groundId', '==', groundId)
      .where('negotiationCard.date', '==', date)
      .get();
    
    for (const msgDoc of messages.docs) {
      const card = msgDoc.data().negotiationCard;
      if (timeOverlaps(startTime, endTime, card.startTime, card.endTime)) {
        await msgDoc.ref.update({
          'negotiationCard.status': 'expired',
          'negotiationCard.expiryReason': 'Slot booked by another user'
        });
        
        // Notify user
        const chat = chatDoc.data();
        await sendNotification(chat.participants.user.userId, {
          type: 'negotiation_expired',
          title: 'Slot No Longer Available',
          body: 'The slot you requested has been booked by another user.'
        });
      }
    }
  }
}

function calculateDailyMetrics(bookings) {
  const completedBookings = bookings.filter(b => b.status === 'completed');
  const totalRevenue = completedBookings.reduce((sum, b) => sum + b.totalAmount, 0);
  const totalCash = completedBookings.reduce((sum, b) => sum + (b.payment?.onGroundPayment?.cashAmount || 0), 0);
  const totalOnline = completedBookings.reduce((sum, b) => sum + (b.payment?.onGroundPayment?.onlineAmount || 0) + (b.payment?.advanceAmount || 0), 0);
  
  const sportBreakdown = {};
  for (const booking of completedBookings) {
    if (!sportBreakdown[booking.sport]) {
      sportBreakdown[booking.sport] = { bookings: 0, revenue: 0 };
    }
    sportBreakdown[booking.sport].bookings++;
    sportBreakdown[booking.sport].revenue += booking.totalAmount;
  }
  
  return {
    totalBookings: bookings.length,
    completedBookings: completedBookings.length,
    totalRevenue,
    totalCashPayments: totalCash,
    totalOnlinePayments: totalOnline,
    totalCancellations: bookings.filter(b => b.status === 'cancelled').length,
    noShows: bookings.filter(b => b.attendance?.showedUp === false).length,
    sportBreakdown,
    averageBookingValue: completedBookings.length > 0 ? totalRevenue / completedBookings.length : 0
  };
}
```
---

## 10. WEEK-BY-WEEK DEVELOPMENT PLAN

### Phase 1: Foundation & MVP (Weeks 1-12)

#### WEEK 1-2: Project Setup & Authentication

**Tasks:**
- Initialize Expo project
- Setup Firebase (Authentication, Firestore, Storage)
- Configure environment variables
- Setup folder structure
- Install all dependencies
- Configure navigation (React Navigation)
- Setup Redux store
- Create auth screens:
  - Login Screen
  - OTP Verification Screen
  - Role Selection Screen (User, Owner, Manager, Caretaker)
  - Profile Setup Screen
  - Join Company Screen (for Manager/Caretaker with invite code)
  - Owner Company Setup Screen (NEW)
- Implement phone + OTP authentication
- Implement role-based navigation
- Test authentication flow for all roles

**Deliverables:**
- ✅ Working authentication system
- ✅ Role-based navigation setup (User, Owner, Manager, Caretaker, Admin)
- ✅ Firebase project configured
- ✅ Owner can create company
- ✅ Manager/Caretaker can join via invite code

---

#### WEEK 3-4: Owner - Company & Turf Registration

**Tasks:**
- Create owner dashboard screen
- Create company settings screen
- Create invite code management screen
- Create turf management screen (list all turfs)
- Create turf registration screen with multi-step form:
  - Basic details (name, description)
  - Location (Google Maps integration)
  - Operating hours
  - Images upload
  - Grounds configuration
  - Sports and pricing setup
- Implement image upload to Firebase Storage
- Implement dynamic pricing form (sport + time-based)
- Generate QR codes (global + turf-specific)
- Implement subscription display (trial status)
- Test turf creation flow

**Deliverables:**
- ✅ Owner dashboard complete
- ✅ Company settings working
- ✅ Complete turf registration system (Owner creates turfs)
- ✅ QR code generation
- ✅ Invite code generation and sharing

---

#### WEEK 5-6: User - Turf Discovery & Booking

**Tasks:**
- Create user home screen
- Implement search functionality (name, location, sport)
- Implement filters (price, rating, availability)
- Create turf detail screen
- Implement Google Maps integration (show location)
- Create booking flow:
  - Ground selection
  - Sport selection
  - Date picker (calendar)
  - Time slot picker (BookMyShow-style)
  - Price calculation
  - Booking summary
  - 5-second confirmation dialog
- Implement booking creation (pending status)
- Test booking flow end-to-end

**Deliverables:**
- ✅ Working search and discovery
- ✅ Complete booking flow (user side)
- ✅ Pending bookings created

---

#### WEEK 7-8: Manager - Booking Management & Turf Selection

**Tasks:**
- Create manager dashboard
- Create turf selection screen (from assigned turfs)
- Create pending requests screen
- Create calendar view (Google Calendar-style)
- Implement booking approval/rejection
- Implement Firebase Transaction for conflict prevention
- Implement manual booking creation (offline bookings)
- Implement bulk slot blocking
- Create booking details screen
- Test race condition scenarios
- Test double booking prevention

**Deliverables:**
- ✅ Manager can select assigned turfs
- ✅ Manager can approve/reject bookings
- ✅ Calendar view working
- ✅ Race condition prevented
- ✅ Manual booking creation

---

#### WEEK 9-10: Chat System with Negotiation

**Tasks:**
- Create chat list screen
- Create chat screen (using react-native-gifted-chat)
- Implement real-time messaging
- Implement negotiation card component
- Implement booking card component
- Implement negotiation flow:
  - User sends request
  - Manager accepts/rejects/counters
  - Auto-expiry on slot booking
- Implement "Book from Chat" (quick booking)
- Implement typing indicators
- Implement read receipts
- Ensure all turf managers can view/reply to chats
- Test chat system

**Deliverables:**
- ✅ Working real-time chat
- ✅ Negotiation system functional
- ✅ Quick booking from chat
- ✅ Multiple managers can respond

---

#### WEEK 11: Caretaker Module & Assignment System

**Tasks:**
- Create caretaker dashboard
- Create "Waiting for Assignment" screen (for unassigned caretakers)
- Create calendar screen with booking visibility rules:
  - Today: Full visibility
  - Future: Limited visibility (no time/phone)
- Implement payment collection modal
- Implement time extension modal
- Implement attendance marking
- Implement maintenance log feature
- Create caretaker assignment screen (for Manager/Owner)
- Implement assign/unassign/reassign caretaker functionality
- Test caretaker workflows

**Deliverables:**
- ✅ Caretaker assignment system working
- ✅ Caretaker can view bookings (assigned turf only)
- ✅ Payment collection working
- ✅ Time extension working
- ✅ Maintenance logs

---

#### WEEK 12: Payment Integration

**Tasks:**
- Integrate Razorpay SDK
- Implement advance payment (10% for tournaments)
- Implement payment success/failure handling
- Implement refund logic (cancellation policy)
- Connect subscription payments for owners
- Test payment flows
- Handle payment errors

**Deliverables:**
- ✅ Razorpay integration complete
- ✅ Advance payment working
- ✅ Refund system working
- ✅ Subscription payment for owners

---

### Phase 2: Advanced Features (Weeks 13-16)

#### WEEK 13: Analytics & Reports (Owner + Manager)

**Tasks:**
- Create owner analytics dashboard (company-wide):
  - Cross-turf revenue comparison
  - Manager performance metrics
  - Financial reports (profit/loss)
  - All turfs utilization
- Create manager analytics dashboard (turf-level only):
  - Revenue charts (Line, Bar, Pie)
  - KPI cards
  - Booking trends
- Implement Excel-like data table
- Implement Excel export (XLSX)
- Create expense tracking feature
- Implement pre-aggregated analytics (Cloud Functions)
- Test analytics accuracy

**Deliverables:**
- ✅ Owner analytics dashboard complete
- ✅ Manager analytics dashboard complete
- ✅ Excel export working
- ✅ Expense tracking functional

---

#### WEEK 14: Notifications, Reviews & Manager Management

**Tasks:**
- Setup Firebase Cloud Messaging (FCM)
- Implement push notifications for all events
- Integrate MSG91 for SMS (web users)
- Create in-app notification center
- Implement review system:
  - User submits review
  - Manager/Owner responds
  - Review moderation
- Create owner manager management screen:
  - View all managers
  - Suspend/reinstate managers
  - Modify manager turf assignments
- Implement suspension logic (30-day delete)
- Test notifications on iOS and Android

**Deliverables:**
- ✅ Push notifications working
- ✅ SMS notifications working
- ✅ Review system complete
- ✅ Manager suspension system working

---

#### WEEK 14.5: Academy System

**Tasks:**
- Create academy management screens (manager/owner)
- Implement "Add Academy" form:
  - Select ground, sport
  - Select days of week (any combination)
  - Set time range
  - Set contract duration (1-3 months)
  - Enter payment details (cash + online)
- Implement academy session auto-generation
- Update availability check to exclude academy sessions
- Update calendar to show academy slots (orange)
- Implement session cancellation (manager/owner only)
- Implement renewal notification system
- Create academy payment tracking
- Test academy slot blocking

**Deliverables:**
- ✅ Academy creation working
- ✅ Sessions auto-generated
- ✅ Calendar shows academy slots
- ✅ Slot blocking prevents regular bookings
- ✅ Manager/Owner can cancel individual sessions
- ✅ Payment tracking functional
- ✅ Renewal notifications working

---

#### WEEK 15: Subscription System (Owner Managed)

**Tasks:**
- Implement 30-day free trial
- Implement subscription payment (Razorpay) - Owner pays
- Implement grace period (7 days)
- Implement turf deactivation after expiry
- Create subscription management screen (owner)
- Cloud Function for daily subscription check
- Notify all owners on subscription events
- Test subscription lifecycle

**Deliverables:**
- ✅ Subscription system working
- ✅ Trial period functional
- ✅ Auto-deactivation working
- ✅ Owner can manage subscription

---

#### WEEK 16: Admin Panel

**Tasks:**
- Create admin dashboard
- Create company management screen
- Create subscription management screen
- Implement manual subscription update
- Create revenue reports
- Create system logs viewer
- Implement admin authentication
- Test admin features

**Deliverables:**
- ✅ Admin panel complete
- ✅ Manual subscription updates working
- ✅ Revenue reports generated

---

### Phase 3: Testing & Deployment (Weeks 17-20)

#### WEEK 17-18: Testing & Bug Fixes

**Tasks:**
- Comprehensive testing:
  - User flows
  - Owner flows (NEW)
  - Manager flows
  - Caretaker flows
  - Admin flows
- Test on multiple devices (iOS, Android, Web)
- Test edge cases:
  - Multiple owners
  - Manager turf reassignment
  - Caretaker assignment/unassignment
  - Owner operational permissions toggle
  - Suspension and 30-day deletion
- Fix all bugs
- Performance optimization
- Security audit

**Deliverables:**
- ✅ Bug-free application
- ✅ Performance optimized
- ✅ Security validated

---

#### WEEK 19: Web Version & Polish

**Tasks:**
- Test web version thoroughly
- Implement responsive design for web
- Handle web-specific features (SMS for notifications)
- Polish UI/UX
- Add loading states
- Add error states
- Add empty states
- Final testing

**Deliverables:**
- ✅ Web version fully functional
- ✅ UI polished
- ✅ All states handled

---

#### WEEK 20: Deployment

**Tasks:**
- Build production apps (EAS Build)
- Submit to App Store (iOS)
- Submit to Play Store (Android)
- Deploy web version (Firebase Hosting / Vercel)
- Setup production Firebase
- Setup monitoring (Sentry)
- Create user documentation
- Create video tutorials
- Launch! 🚀

**Deliverables:**
- ✅ Apps live on stores
- ✅ Web version deployed
- ✅ Documentation complete
---

## 11. BUSINESS PLAN

### Revenue Model

#### Subscription Pricing (Owner Pays)

| Grounds | Price/Ground/Month | Discount |
|---------|-------------------|----------|
| 1-5 grounds | ₹299/ground | - |
| 6-10 grounds | ₹269/ground | 10% off |
| 11-20 grounds | ₹254/ground | 15% off |
| 21+ grounds | ₹239/ground | 20% off |

**Example:**
```
Company with 3 turfs, 8 total grounds:
₹269 × 8 = ₹2,152/month
₹25,824/year

30-day free trial for all new companies
Owner manages subscription (not manager)
```

### Revenue Projections (Year 1)

| Period | Companies | Avg Grounds | Total Grounds | Monthly Revenue |
|--------|-----------|-------------|---------------|-----------------|
| Month 1-3 | 10 | 5 | 50 | ₹14,950 |
| Month 4-6 | 30 | 6 | 180 | ₹48,420 |
| Month 7-9 | 60 | 7 | 420 | ₹1,12,560 |
| Month 10-12 | 100 | 8 | 800 | ₹2,15,200 |

**Year 1 Total Revenue:** ~₹12-15 lakhs
**Year 2 Projection:** ₹40-50 lakhs
**Year 3 Projection:** ₹1-1.5 crores

### Market Analysis

**Target Market:**
- Sports turf owners in India
- Initial focus: Mumbai, Pune, Bangalore, Delhi
- Market size: ~10,000+ turfs across major cities
- Growth: Sports infrastructure growing 15% YoY

**Competitive Advantage:**
- Real-time negotiation via chat (unique feature)
- Multi-stakeholder (Owner → Manager → Caretaker → User) approach
- Flexible pricing (sport + time-based)
- Subscription model (predictable revenue)
- White-label potential (future)
- Clear hierarchy with owner oversight

### Marketing Strategy

**Launch Strategy:**
1. Partnership with 5-10 pilot turfs (free for 3 months)
2. Create case studies and testimonials
3. Social media marketing (Instagram, Facebook)
4. Google Ads (local targeting)
5. Referral program (owner refers another owner)

**Growth Strategy:**
1. SEO optimization for "turf booking near me"
2. Partnerships with sports leagues/tournaments
3. Integration with sports apps
4. Influencer marketing (sports content creators)
5. Offline marketing (flyers at turfs)

### Cost Structure

**Monthly Operating Costs (Initial):**

| Service | Cost Range |
|---------|------------|
| Firebase (Firestore) | ₹2,000-5,000 |
| Firebase (Storage) | ₹1,000-2,000 |
| Firebase (Cloud Functions) | ₹1,000-3,000 |
| Firebase (Authentication) | Free tier |
| **Total Firebase** | **₹4,000-10,000/month** |
| Razorpay | 2% per transaction (no monthly fee) |
| MSG91 (SMS) | ~₹150/month (1,000 SMS @ ₹0.15) |
| Google Maps API | ₹5,000-10,000/month |
| Apple Developer | ₹8,250/year ($99) |
| Google Play | ₹2,000 one-time ($25) |
| Domain | ₹1,000/year |
| Monitoring | ₹2,000/month |
| **Total Monthly Cost** | **₹15,000-25,000** |

**Break-even:** ~50-80 grounds subscribed

### Future Monetization Opportunities

1. **Transaction Commission** (Optional):
   - 2-3% commission on bookings
   - Implemented after platform maturity

2. **Premium Features**:
   - Advanced analytics (₹500/month extra)
   - API access for integrations
   - Priority support

3. **Advertisement**:
   - Sports equipment brands
   - Sports nutrition brands
   - Featured turf listings

4. **White-label**:
   - Sell platform to large turf chains
   - Custom branding
   - One-time fee + monthly maintenance

---

## 12. RISK MITIGATION & CONTINGENCY PLANS

### Technical Risks

| Risk | Mitigation | Contingency |
|------|------------|-------------|
| Firebase Costs Exceed Budget | Implement data pagination, optimize queries | Migrate to self-hosted backend (Node.js + MongoDB) |
| Razorpay Integration Issues | Thorough testing in sandbox | Have Cashfree as backup payment gateway |
| App Store Rejection | Follow guidelines strictly | Address issues and resubmit, have web version as backup |

### Business Risks

| Risk | Mitigation | Contingency |
|------|------------|-------------|
| Low Adoption by Turf Owners | Free trial, pilot programs, clear ROI demonstration | Pivot to B2C model (direct to users) |
| Competition from Established Players | Focus on unique features (negotiation, owner-manager hierarchy) | Partner with competitors or get acquired |
| Payment Default by Companies | Grace period, reminders, auto-deactivation | Strict enforcement, legal action if needed |
| Manager/Caretaker Abuse | Suspension system, owner oversight, 30-day deletion | Clear terms of service, owner control |

### Operational Risks

| Risk | Mitigation | Contingency |
|------|------------|-------------|
| Owner-Manager Conflicts | Clear permission boundaries, logs | Dispute resolution process |
| Multiple Owner Disagreements | Equal permissions (checkbox-based) | Recommend primary contact |
| Caretaker Assignment Issues | Clear assignment workflow | Allow unassignment and reassignment |

---

## 13. CONCLUSION

This master plan provides:

✅ Complete database architecture with Owner entity
✅ Detailed feature specifications for all roles
✅ Clear permission matrix (Owner → Manager → Caretaker)
✅ Week-by-week development timeline
✅ Code implementations for complex features
✅ Business model with revenue projections
✅ Risk mitigation strategies

### New Features Added in V2

1. **Owner Entity** - Business owner who oversees the company
2. **Operational Permissions** - Toggle for owners to do manager tasks
3. **Invite Code System** - Manager/Caretaker join via code
4. **Caretaker Assignment** - Direct assignment by Manager/Owner
5. **Manager Suspension** - Owner can suspend managers (30-day delete)
6. **Owner Analytics** - Company-wide reports and manager performance
7. **Turf Ownership** - Only owners create/delete turfs
8. **Multiple Owners** - One company can have multiple owners

### Next Steps

1. Review and approve this plan
2. Setup development environment (Week 1)
3. Begin Sprint 1: Authentication with all roles
4. Weekly reviews and adjustments
5. Launch in 20 weeks!

### Success Metrics

| Metric | Target |
|--------|--------|
| Companies onboarded (Year 1) | 100 |
| Bookings processed | 10,000+ |
| User satisfaction | 95%+ |
| App crash rate | <1% |
| Break-even | Month 6 |

---

## 📌 QUICK REFERENCE

### Entity Hierarchy
```
Owner (Business Owner)
  ├── Creates company
  ├── Creates/deletes turfs
  ├── Manages subscription
  ├── Suspends managers/caretakers
  └── (Optional) Operational tasks
        ↓
Manager (Operations)
  ├── Joins via invite code
  ├── Selects turfs to manage
  ├── Approves/rejects bookings
  ├── Handles chats
  ├── Assigns caretakers
  └── Creates academies
        ↓
Caretaker (On-ground)
  ├── Joins via invite code
  ├── Waits for assignment
  ├── Collects payments
  └── Reports issues
```

### Booking Status Flow
```
pending → confirmed → in_progress → completed
    ↓
rejected/cancelled
```

### Calendar Color Legend
```
🟢 Green    = Available
🟡 Yellow   = Partially booked
🔴 Red      = Fully booked
🔵 Blue     = Confirmed booking
🟠 Orange   = Academy session
⚫ Grey     = Past/Disabled
```

### User Roles & Permissions
```
User      → Book, Chat, Review
Owner     → Company setup, Turfs, Subscription, Analytics, Managers
          → (Optional) All manager tasks if operational permissions enabled
Manager   → Bookings, Chat, Analytics (turf-level), Caretakers, Academy
Caretaker → View bookings (assigned turf), Collect payments, Report issues
Admin     → Platform management, Subscriptions
```

### Payment Flow
```
Booking Created → Advance (optional) → On-ground Payment
                      ↓                       ↓
                  Razorpay              Cash + Online
```

### Suspension Flow
```
Owner suspends Manager/Caretaker
         ↓
Status: isSuspended = true
         ↓
30 days later → Cloud Function deletes user
```

### Invite Code Flow
```
Owner creates company → Invite code generated
         ↓
Manager enters code → Selects turfs → Joins
         ↓
Caretaker enters code → Joins as unassigned
         ↓
Manager/Owner assigns caretaker to turf
```

---

**This is your complete blueprint for building a production-ready turf management system with Owner-Manager-Caretaker hierarchy. Let's build it! 🚀**
