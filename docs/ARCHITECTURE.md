# Turf-1701 — Architecture & Design Reference

> Multi-role turf management mobile app · React Native + Expo · Firebase backend

---

## Table of Contents

1. [User Entities & Role Hierarchy](#1-user-entities--role-hierarchy)
2. [Authentication & Onboarding Flow](#2-authentication--onboarding-flow)
3. [Navigation Architecture](#3-navigation-architecture)
4. [App Workflow by Role](#4-app-workflow-by-role)
5. [Data Model (Firestore)](#5-data-model-firestore)
6. [Data Stream & Real-Time Architecture](#6-data-stream--real-time-architecture)
7. [State Management (Redux)](#7-state-management-redux)
8. [Firebase Services Layer](#8-firebase-services-layer)
9. [Cloud Functions](#9-cloud-functions)
10. [Component Hierarchy](#10-component-hierarchy)
11. [Pricing & Business Logic](#11-pricing--business-logic)
12. [Payment & Booking Lifecycle](#12-payment--booking-lifecycle)
13. [Push Notifications Pipeline](#13-push-notifications-pipeline)
14. [Subscription System](#14-subscription-system)

---

## 1. User Entities & Role Hierarchy

### Role Pyramid

```
                    ┌─────────────┐
                    │    ADMIN    │  ← Platform super-admin
                    └──────┬──────┘
                           │
                    ┌──────┴──────┐
                    │    OWNER    │  ← Business owner, manages company
                    └──────┬──────┘
                           │
              ┌────────────┴────────────┐
              │                         │
       ┌──────┴──────┐           ┌──────┴──────┐
       │   MANAGER   │           │  CARETAKER  │
       └──────┬──────┘           └──────┬──────┘
              │                         │
              └────────────┬────────────┘
                           │
                    ┌──────┴──────┐
                    │    USER     │  ← End customer
                    └─────────────┘
```

**Hierarchy order (ascending permission):** `user < caretaker < manager < owner < admin`

---

### Entity Definitions

| Entity | Description | Company Required | Invite Code |
|--------|-------------|:---:|:---:|
| **User** | End customer who discovers and books turfs | No | No |
| **Caretaker** | On-site staff; manages day-to-day operations at a single turf | Yes | Yes |
| **Manager** | Oversees bookings, team, and operations across assigned turfs | Yes | Yes |
| **Owner** | Business owner; creates the company, adds turfs, manages team | Yes | No |
| **Admin** | Platform-level super-admin with full system access | No | No |

---

### User Document Shape

```
users/{userId}
├── userId              Firebase Auth UID
├── phone               Login credential (OTP)
├── name, email, avatar Profile info
├── role                user | caretaker | manager | owner | admin
├── isNewUser           Boolean — incomplete profile flag
├── companyId           Links non-users to a company
│
├── [Caretaker fields]
│   ├── isAssigned      Boolean
│   └── assignedTurfId  Turf they manage
│
├── [Manager fields]
│   └── assignedTurfIds[]  Turfs they can access
│
├── [Owner fields]
│   ├── managedTurfIds[]   Empty = all company turfs
│   └── hasOperationalPermissions  Owner acting as manager
│
├── isSuspended, suspensionReason, canBeDeletedAfter
├── fcmTokens{}         Push notification tokens per device
├── wishlistedTurfIds[] User wishlist
├── selectedTurfId      Persisted turf selection (manager/owner)
└── createdAt, updatedAt
```

---

### Owner "Operations Mode"

An owner can optionally enable `hasOperationalPermissions`, which grants access to the `OperationsModeNavigator` — a manager-style interface. The selector `selectCanPerformManagerTasks` resolves to `true` for managers always, and owners conditionally.

```
Owner
├── Default: OwnerNavigator (Dashboard, Turfs, Team, Settings)
└── + hasOperationalPermissions
    └── OperationsModeNavigator (Bookings, Calendar, Chat, Settings)
```

---

## 2. Authentication & Onboarding Flow

```
App Launch
    │
    ▼
RootNavigator
    │
    ├─ isLoading ──────────────► LoadingScreen
    │
    ├─ not authenticated ──────► AuthNavigator
    │
    └─ authenticated
           │
           ├─ isNewUser ────────► AuthNavigator (complete profile)
           │
           └─ role resolved ───► Role Navigator (see §3)
```

### Auth Navigator Flow

```
LoginScreen
    │  (enter phone)
    ▼
OTPScreen
    │  (verify code via Firebase Phone Auth)
    ▼
RoleSelectionScreen ──── new user only
    │  (pick role: user / owner / manager / caretaker)
    ▼
    ├─ user/owner ──► ProfileSetupScreen
    │                      │
    │                      └─ owner ──► OwnerSetupScreen
    │                                      (creates company)
    │
    └─ manager/caretaker ──► JoinCompanyScreen
                                 │  (enter 8-char invite code)
                                 ▼
                             ProfileSetupScreen
```

### OTP / Auth Mechanism

```
Device                Firebase Auth           Firestore
  │                        │                     │
  │── sendOTP(phone) ─────►│                     │
  │◄─ verification ID ─────│                     │
  │                        │                     │
  │── verifyOTP(code) ────►│                     │
  │◄─ Firebase User ───────│                     │
  │                        │                     │
  │── getDocument("users", uid) ────────────────►│
  │◄─ user profile ─────────────────────────────│
  │                        │                     │
  │  (if no profile) ──────────────────────────►│ create user doc
  │                        │                     │
  └── dispatch setUser() → Redux authSlice
```

---

## 3. Navigation Architecture

### Overall Navigator Tree

```
RootNavigator
├── LoadingScreen
├── AuthNavigator (Stack)
│   ├── LoginScreen
│   ├── OTPScreen
│   ├── RoleSelectionScreen
│   ├── ProfileSetupScreen
│   ├── OwnerSetupScreen
│   └── JoinCompanyScreen
│
├── UserNavigator (Stack + Tabs)
│   ├── [Tab] HomeScreen
│   ├── [Tab] SearchScreen
│   ├── [Tab] BookingsScreen
│   ├── [Tab] ChatListScreen
│   ├── [Tab] ProfileScreen
│   └── [Stack] TurfDetailScreen, BookingScreen, BookingConfirmationScreen,
│               BookingSuccessScreen, ChatScreen, UpiPaymentScreen,
│               PaymentConfirmationScreen, PaymentSubmittedScreen,
│               WriteReviewScreen, WishlistScreen, NotificationsScreen
│
├── ManagerNavigator (Stack + Tabs)
│   ├── [Tab] ManagerDashboardScreen
│   ├── [Tab] BookingManagementScreen
│   ├── [Tab] CalendarScreen
│   ├── [Tab] ChatListScreen (company-side)
│   ├── [Tab] ManagerSettingsScreen
│   └── [Stack] CaretakerAssignment, TurfSelection, CreateBooking, BlockSlots,
│               ManagerChatScreen, AdvancePaymentSettings, VerifyPayment,
│               AnalyticsDashboard, ExpenseTracking, ReviewManagement,
│               AcademyManagement, TurfRequestsList, TurfRequestDetail,
│               EditTurf, Notifications
│
├── OwnerNavigator (Stack + Tabs)
│   ├── [Tab] OwnerDashboardScreen
│   ├── [Tab] TurfManagementScreen
│   ├── [Tab] TeamManagementScreen
│   ├── [Tab] OwnerSettingsScreen
│   └── [Stack] AddTurf, EditTurf, InviteCode, ManagerManagement,
│               CaretakerManagement, OperationalSettings, PaymentSettings,
│               SubscriptionPayment, Analytics, ExpenseTracking,
│               ReviewManagement, TurfEditLogs, PendingTurfRequests
│
├── CaretakerNavigator (Stack + Tabs)
│   ├── [Guard] WaitingForAssignmentScreen (if !isAssigned)
│   ├── [Tab] CaretakerDashboardScreen
│   ├── [Tab] CalendarScreen
│   ├── [Tab] CaretakerProfileScreen
│   └── [Stack] PaymentCollection, MaintenanceLog, ExpenseTracking,
│               CaretakerCreateBooking, Notifications
│
├── AdminNavigator (Stack + Tabs)
│   ├── [Tab] AdminDashboardScreen
│   ├── [Tab] CompanyListScreen
│   ├── [Tab] UserListScreen
│   ├── [Tab] BookingListScreen
│   ├── [Tab] More (links to all admin sub-sections)
│   └── [Stack] 30+ admin screens across payments, subscriptions,
│               support, disputes, analytics, config, audit, etc.
│
└── OperationsModeNavigator (Stack + Tabs)  ← Owner with ops perms
    ├── [Tab] OperationsModeScreen (dashboard)
    ├── [Tab] BookingManagementScreen
    ├── [Tab] CalendarScreen
    ├── [Tab] ManagerChatScreen
    ├── [Tab] OperationsSettingsTab
    └── [Stack] Shared manager screens
```

### Header Strategy (User Side)

```
Screen Type          Header Component
───────────────────────────────────────────
HomeScreen           Inline sticky homeTopBar (logo + location + avatar)
Stack screens        <AppHeader> (60px, Ubuntu-Bold, 44px touch targets)
TurfDetailScreen     Overlay buttons on hero image (44px circles)
ChatScreen           Custom header matching AppHeader height + shadow
```

---

## 4. App Workflow by Role

### User Workflow

```
Home
 │
 ├── Browse turfs (map / list)
 │       │
 │       └── TurfDetailScreen
 │               ├── View pricing, images, reviews
 │               ├── Wishlist (toggle)
 │               └── Book Now ──────────────────────────────────────┐
 │                                                                   │
 ├── Search (filter by sport, area, price)                           │
 │                                                                   ▼
 ├── Bookings (view history, status)                         BookingScreen
 │                                                           (pick date, sport, slots)
 ├── Chat (negotiate price with manager)                             │
 │       │                                                           ▼
 │       └── NegotiationCard ──► price accepted ──► BookingConfirmation
 │                                                                   │
 └── Profile                                                         ▼
                                                              UpiPaymentScreen
                                                                   │
                                                    ┌──────────────┼────────────┐
                                                    │              │            │
                                               Pay via UPI   Screenshot    PayLater
                                                    │              │
                                                    └──────┬───────┘
                                                           ▼
                                                  PaymentSubmittedScreen
                                                           │
                                               (manager verifies payment)
                                                           │
                                                           ▼
                                                  BookingSuccessScreen
```

### Manager Workflow

```
Dashboard
 │ (real-time stats: today's bookings, revenue, pending actions)
 │
 ├── Bookings
 │       ├── View all bookings for assigned turfs
 │       ├── CreateBooking (manual entry for walk-ins)
 │       ├── VerifyPayment (mark payment confirmed)
 │       └── BlockSlots (prevent bookings in a time range)
 │
 ├── Calendar
 │       └── Day view of slot states (color-coded)
 │
 ├── Chat
 │       ├── Respond to user inquiries
 │       ├── Send NegotiationCard (counter-offer price)
 │       └── Send PaymentRequestCard
 │
 ├── Settings
 │       ├── TurfSelection (switch active turf)
 │       ├── AdvancePaymentSettings (before/after approval timing)
 │       ├── AcademyManagement
 │       ├── CaretakerAssignment
 │       ├── ExpenseTracking
 │       ├── ReviewManagement
 │       └── AnalyticsDashboard
 │
 └── TurfRequests (pending changes from owner needing approval)
```

### Owner Workflow

```
Dashboard
 │ (revenue, bookings, team, turf health)
 │
 ├── Turfs
 │       ├── TurfManagementScreen
 │       │       ├── AddTurf (create new turf + grounds)
 │       │       ├── EditTurf (modify pricing, name, images)
 │       │       └── TurfEditLogs (audit trail of changes)
 │       └── PendingTurfRequests
 │
 ├── Team
 │       ├── ManagerManagement (view, promote, remove)
 │       ├── CaretakerManagement (assign to turfs)
 │       └── InviteCode (generate/share 8-char code)
 │
 ├── Settings
 │       ├── PaymentSettings (UPI credentials)
 │       ├── OperationalSettings (grant ops perms)
 │       ├── SubscriptionPayment
 │       ├── ExpenseTracking
 │       ├── ReviewManagement
 │       └── Analytics (revenue, occupancy, trends)
 │
 └── [Optional] OperationsMode ──► Manager-style tabs
```

### Caretaker Workflow

```
App Launch
    │
    ├── Not assigned ──► WaitingForAssignmentScreen
    │                       (polls until manager assigns a turf)
    │
    └── Assigned ──► Main Tabs
            │
            ├── Dashboard
            │       ├── Today's bookings at assigned turf
            │       └── Maintenance alerts
            │
            ├── Calendar
            │       ├── CaretakerCreateBooking (walk-in)
            │       └── PaymentCollection (collect cash/UPI on-site)
            │
            └── Profile
                    ├── MaintenanceLog (report issues)
                    └── ExpenseTracking (log operational expenses)
```

### Admin Workflow

```
AdminDashboard
    │
    ├── Companies ──► CompanyList ──► CompanyDetail
    ├── Users ──────► UserList ──────► UserDetail (suspend/unsuspend)
    ├── Bookings ───► BookingList ───► BookingDetail
    │
    └── More (side drawer)
            ├── Payment ──► VerificationQueue, RefundTracker, FraudDashboard
            ├── Subscriptions ──► SubscriptionList, ManualSubscription
            ├── Support ──► SupportTicketList ──► SupportTicketDetail
            ├── Disputes ──► DisputeList ──► DisputeDetail
            ├── Content ──► ReviewModeration
            ├── Analytics ──► PlatformAnalytics, Reports
            ├── Configuration ──► PricingConfig, BookingConfig,
            │                     NotificationTemplates, FeatureFlags
            └── Admin ──► AdminManagement, AuditLog, BulkOperations,
                          SystemHealth, ErrorLogs, CostTracker
```

---

## 5. Data Model (Firestore)

### Collections Overview

```
Firestore
├── users/            One doc per Firebase Auth UID
├── companies/        One doc per business (owner-created)
├── turfs/            Turf locations with grounds[] embedded
├── bookings/         Individual booking records
├── chats/            Chat threads (user ↔ company)
│   └── messages/     Sub-collection of messages
├── negotiations/     Price negotiation records
├── notifications/    Per-user notification docs
├── expenses/         Expense records per turf
├── reviews/          Turf reviews from users
├── slotLocks/        Soft-lock records (TTL 10 min)
├── academies/        Academy session records
├── maintenanceLogs/  Caretaker maintenance reports
└── subscriptions/    Company subscription records
```

### Entity Relationship Diagram

```
┌──────────┐       ┌─────────────┐       ┌───────────┐
│   User   │ N:1   │   Company   │ 1:N   │   Turf    │
│          ├──────►│             │◄──────┤           │
│ companyId│       │ inviteCode  │       │ companyId │
│ role     │       │ managers[]  │       │ grounds[] │
│ assigned │       │ caretakers[]│       │ pricing   │
│ TurfId   │       │ subscription│       │           │
└──────────┘       └─────────────┘       └─────┬─────┘
                                               │
                    ┌──────────────────────────┘
                    │
              ┌─────▼─────┐       ┌───────────────┐
              │  Booking  │       │     Chat      │
              │           │       │               │
              │ userId    │       │ userId        │
              │ turfId    │       │ companyId     │
              │ groundId  │       │ lastMessage   │
              │ date/time │       │ unreadCount{} │
              │ status    │       └───────┬───────┘
              │ amount    │               │ sub-collection
              │ payment   │        ┌──────▼──────┐
              └───────────┘        │   Message   │
                                   │             │
              ┌───────────┐        │ type: text  │
              │   Review  │        │       nego  │
              │           │        │       book  │
              │ userId    │        │       pay   │
              │ turfId    │        │       loc   │
              │ rating    │        └─────────────┘
              │ text      │
              └───────────┘
```

### Key Document Schemas

#### Turf Document

```
turfs/{turfId}
├── name, address, city, area
├── companyId
├── totalGrounds
├── isActive
├── ratings, reviewCount
└── grounds[]
    └── {
        groundId, groundName, sport
        pricing: {
          allDayRate,
          weekday: {
            morning:   { rate }   // 06:00–10:00
            afternoon: { rate }   // 10:00–18:00
            evening:   { rate }   // 18:00–23:00
          }
          weekend: { morning, afternoon, evening }
        }
        images: []
      }
```

#### Booking Document

```
bookings/{bookingId}
├── turfId, groundId, groundName
├── userId, userName, userPhone
├── date (YYYY-MM-DD), startTime (HH:MM), endTime (HH:MM)
├── sport
├── status:        pending | confirmed | in_progress | completed | cancelled | rejected
├── paymentStatus: pending | submitted | verified | failed
├── amount
├── negotiation:   { chatId, offeredPrice }
└── createdAt, updatedAt
```

#### Chat + Message Documents

```
chats/{chatId}
├── participants
│   ├── user:    { userId, name, phone, avatar }
│   └── company: { companyId, name, avatar, turfManagerIds[] }
├── lastMessage
├── unreadCount: { [userId]: N, company: N }
├── status: active | archived
└── createdAt, updatedAt

chats/{chatId}/messages/{msgId}
├── senderId, senderType (user | manager), senderName
├── messageType: text | negotiation | booking | payment_request | location
├── text                        (type: text)
├── negotiation: { offeredPrice, status, timestamp }   (type: negotiation)
├── booking:     { bookingData, status }               (type: booking)
├── paymentRequest: { amount, reason }                 (type: payment_request)
├── location:    { lat, lng, address }                 (type: location)
└── createdAt
```

---

## 6. Data Stream & Real-Time Architecture

### Real-Time Subscriptions Map

```
Component / Hook                    Firestore Listener
─────────────────────────────────────────────────────────────
useAuth (subscribe: true)          users/{uid}          onSnapshot
useSelectedTurf                    turfs/{selectedId}   onSnapshot
useChat(chatId)                    chats/{id}/messages  onSnapshot
useUserChats(userId)               chats (filtered)     onSnapshot
useCompanyChats(companyId)         chats (filtered)     onSnapshot
useNotifications                   notifications (filtered) onSnapshot
CaretakerNavigator (assignment)    users/{uid}          onSnapshot
```

### Data Flow Diagram

```
Firebase Auth ──────────────────────────────────────────────┐
     │                                                       │
     │ auth state change                                     │
     ▼                                                       │
useAuth hook                                                 │
     │                                                       │
     ├── dispatch setUser() ─────────────────► Redux Store   │
     │                                        (authSlice)    │
     └── fetch company doc ─────────────────► Redux Store    │
                                             (companySlice)  │
                                                             │
Firestore ◄──────────────────────────────────────────────────┘
     │                                              ▲
     │  onSnapshot listeners                        │
     ▼                                              │
Real-time data                                      │
     │                                              │
     ├── messages ───► useChat ─────► ChatScreen    │
     ├── chats ──────► useUserChats ► ChatListScreen│
     ├── turfs ──────► useSelectedTurf              │
     └── notifications ► useNotifications           │
                             │                      │
                             └── badge count ───────┘
                                                    │
Screen Actions ─────────────────────────────────────┘
  (tap, form submit)
     │
     ▼
Firebase Service Layer (src/services/firebase/)
     │
     ├── firestore.js  CRUD wrappers
     ├── booking.js    Slot availability + atomic booking
     ├── chat.js       Message send, negotiation, unread
     ├── payments.js   Payment status tracking
     └── auth.js       OTP, sign-out
```

### Booking Creation — Atomic Transaction Flow

```
User confirms booking
        │
        ▼
booking.js: createBookingWithTransaction()
        │
        ▼
Firestore runTransaction()
        ├── Read slotLocks for overlap
        ├── Read bookings for conflict
        ├── [conflict] → throw error → show user message
        └── [clear]
              ├── Write booking doc (status: pending)
              ├── Write slotLock doc (expires: +10 min)
              └── Commit
                   │
                   ▼
        Cloud Function: onBookingCreated
              ├── Send FCM to manager
              └── Schedule lock expiry check
```

### Soft Lock Lifecycle

```
Booking initiated
      │
      ▼
slotLock created (TTL: 10 min)
      │
      ├── User completes payment ──► booking confirmed ──► lock removed
      │
      └── User abandons / timeout
              │
              ▼
      Cloud Function: releaseExpiredSlotLocks
              │
              ▼
      slotLock deleted, slot freed
```

---

## 7. State Management (Redux)

### Store Shape

```
Redux Store
├── auth (authSlice)
│   ├── user: { userId, phone, name, role, companyId, ... }
│   ├── isAuthenticated: boolean
│   ├── isLoading: boolean
│   └── error: string | null
│
├── company (companySlice)
│   ├── currentCompany: { name, inviteCode, stats{} }
│   ├── managers: []
│   ├── caretakers: []
│   ├── unassignedCaretakers: []
│   ├── subscription: { status, trialEndDate, ... }
│   └── isLoading, error
│
├── owner (ownerSlice)
│   ├── turfs: []
│   ├── selectedTurf: {}
│   ├── analytics: { daily, weekly, monthly }
│   ├── financialReports: { revenue, expenses, profit, pendingPayments }
│   ├── pendingActions: { bookingRequests, unassignedCaretakers, ... }
│   └── isLoading, error
│
├── booking (bookingSlice)
│   ├── bookings: []
│   ├── selectedTurf, selectedGround, selectedDate, selectedSport
│   ├── selectedTimeSlots: []
│   └── isLoading, error
│
└── wishlist (wishlistSlice)
    ├── turfIds: []
    └── loading: boolean
```

### Key Selectors

```
authSlice selectors
├── selectUser, selectIsAuthenticated, selectUserRole
├── selectIsUser, selectIsOwner, selectIsManager, selectIsCaretaker, selectIsAdmin
├── selectHasOperationalPermissions
├── selectManagedTurfIds, selectAssignedTurfIds
├── selectIsCaretakerAssigned, selectIsSuspended
└── selectCanPerformManagerTasks  (manager OR owner with ops perms)

companySlice selectors
├── selectCompany, selectCompanyId, selectInviteCode
├── selectManagers, selectCaretakers, selectUnassignedCaretakers
├── selectSubscription, selectIsTrialActive, selectIsSubscriptionActive
└── selectTotalTeamMembers

ownerSlice selectors
├── selectTurfs, selectTotalTurfs, selectTotalGrounds, selectActiveTurfs
├── selectTurfById(id), selectSelectedTurf
├── selectAnalytics, selectFinancialReports
├── selectTotalPendingActions, selectTotalRevenue
└── selectProfit()
```

### Dispatch Flow Example — Login

```
OTPScreen
    │
    │ verifyOTP(phone, code)
    ▼
auth.js service ─────────► Firebase Auth
    │ ◄─────────────────── Firebase User
    │
    │ getDocument("users", uid)
    ▼
firestore.js ────────────► Firestore
    │ ◄────────────────── user doc
    │
    ▼
dispatch(setUser(userData))
    │
    ▼
authSlice reducer ────────► Redux Store updated
    │
    ▼
RootNavigator (useSelector) ─► re-renders ─► role navigator
```

---

## 8. Firebase Services Layer

### Service Module Map

```
src/services/firebase/
├── config.js           SDK init (native: @react-native-firebase, web: modular)
├── firebase-compat.js  Compatibility shim (Platform.OS detection)
├── index.js            Barrel export of all services
│
├── auth.js
│   ├── sendOTP(phoneNumber)
│   ├── verifyOTP(phoneNumber, code)
│   ├── signOut()
│   ├── subscribeToAuthState(callback)
│   └── getCurrentUser()
│
├── firestore.js         Generic CRUD
│   ├── getDocument(collection, docId)
│   ├── getCollection(collection)
│   ├── queryDocuments(collection, [{field, operator, value}])
│   ├── addDocument(collection, data)
│   ├── setDocument(collection, docId, data)
│   ├── updateDocument(collection, docId, updates)
│   ├── deleteDocument(collection, docId)
│   ├── subscribeToDocument(collection, docId, callback)
│   ├── subscribeToCollection(collection, callback, filters)
│   ├── serverTimestamp()
│   ├── runTransaction(callback)
│   └── createBookingWithTransaction(bookingData)   ← atomic
│
├── booking.js
│   ├── checkSlotAvailability(turfId, groundId, date, start, end)
│   ├── createBookingFromNegotiation(negotiationData)
│   ├── createPendingBooking(bookingData)
│   ├── confirmPendingBooking(bookingId)
│   ├── expireConflictingNegotiations(...)
│   └── getBooking(bookingId)
│
├── chat.js
│   ├── getOrCreateChat(userId, companyId, userData, companyData)
│   ├── sendMessage(chatId, {text, senderId, senderType, senderName})
│   ├── sendNegotiationCard(chatId, negotiationData)
│   ├── updateNegotiationStatus(chatId, messageId, status, statusData)
│   ├── sendBookingCard(chatId, bookingData)
│   ├── updateBookingCardStatus(chatId, messageId, status)
│   ├── sendLocationMessage(chatId, locationData)
│   ├── markAsRead(chatId, viewerId, viewerType)
│   ├── listenToMessages(chatId, callback)      → unsubscribe fn
│   ├── listenToUserChats(userId, callback)
│   ├── listenToCompanyChats(companyId, callback)
│   ├── getUserUnreadCount(userId)
│   └── getCompanyUnreadCount(companyId)
│
├── payments.js          UPI payment verification & status tracking
├── subscriptionPayments.js  Subscription tier payments
├── reviews.js           Review CRUD
├── expenses.js          Expense tracking
└── turfImages.js        Firebase Storage upload/management
```

### Cross-Platform Pattern

Every service that touches Firebase detects `Platform.OS`:

```javascript
// Simplified pattern used throughout services
if (Platform.OS === 'web') {
  // Firebase Modular SDK (v9+)
  import { getFirestore, doc, getDoc } from 'firebase/firestore';
} else {
  // @react-native-firebase (native module)
  import firestore from '@react-native-firebase/firestore';
}
```

---

## 9. Cloud Functions

All functions run on **Node 20** runtime under the `functions/` directory.

### Function Categories & Triggers

```
Cloud Functions
│
├── Slot Management
│   └── releaseExpiredSlotLocks        Scheduled — cleanup 10-min soft locks
│
├── Payment Lifecycle
│   ├── checkPaymentTimeouts           Scheduled — auto-expire overdue payments
│   ├── sendPaymentVerificationReminders  Scheduled
│   └── sendPaymentDeadlineReminders   Scheduled
│
├── Booking Lifecycle
│   ├── onBookingCreated               Firestore trigger — new booking
│   ├── onBookingStatusChange          Firestore trigger — status field changes
│   ├── onBookingCreatedOrConfirmed    Firestore trigger — expire conflicting negotiations
│   ├── sendBookingReminders           Scheduled — pre-booking reminders
│   └── autoRejectExpiredPendingBookings  Scheduled
│
├── Negotiation Lifecycle
│   └── onNegotiationStatusChange      Firestore trigger — notify parties
│
├── Turf Management
│   └── onTurfRequestChange            Firestore trigger — pending request notifications
│
├── Academy Management
│   ├── generateAcademySessions        HTTP callable
│   ├── markPastSessionsCompleted      Scheduled — 3 AM IST daily
│   ├── onAcademyStatusChange          Firestore trigger
│   ├── sendAcademyRenewalReminders    Scheduled
│   ├── expireAcademies                Scheduled
│   └── manualGenerateSessions         HTTP callable
│
├── Subscription Management
│   ├── checkSubscriptionExpiry        Scheduled
│   ├── enforceGracePeriod             Scheduled
│   ├── sendSubscriptionExpiryWarnings Scheduled
│   └── onSubscriptionPaymentCompleted Firestore trigger
│
├── User Management
│   └── processSuspendedUserDeletion   Scheduled — delete after grace period
│
├── Fraud Prevention
│   └── cleanupOldTransactions         Scheduled — archive old records
│
└── Utilities
    ├── normalizeGroundId()            Internal helper
    └── testFunction                   Deployment verification
```

### Function ↔ Client Notification Flow

```
Client Action (e.g., booking confirmed)
        │
        ▼
Firestore write (booking status → "confirmed")
        │
        ▼
Cloud Function: onBookingStatusChange (Firestore trigger)
        │
        ├── Determine recipient (userId or companyId)
        ├── Fetch FCM tokens from users/{id}.fcmTokens
        ├── Send FCM message via Firebase Admin SDK
        │
        └── Write notification doc to Firestore
                │
                ▼
        Device receives FCM push notification
                │
                ▼
        useNotifications hook (onSnapshot) picks up new doc
                │
                ▼
        UI badge count updates + notification list refreshes
```

---

## 10. Component Hierarchy

### Shared Component Tree

```
src/components/
│
├── booking/
│   ├── TimeSlotGrid        BookMyShow-style slot picker
│   │     ├── slot cells (color by SLOT_STATUS)
│   │     └── SlotColorLegend
│   └── ConfirmationDialog  Modal for booking confirmation
│
├── chat/
│   ├── ChatBubble          Individual message bubble
│   ├── ChatInput           Text input + send button
│   ├── ChatListItem        Conversation row with unread badge
│   ├── NegotiationCard     Price offer card (accept/reject)
│   ├── NegotiationRequestModal  Send a price offer
│   ├── BookingCard         Booking info card embedded in chat
│   ├── PaymentRequestCard  Payment request display
│   ├── LocationCard        Location sharing card
│   ├── DateSeparator       Date divider in message list
│   └── QuickBookModal      Quick booking without leaving chat
│
├── turf/
│   └── PricingConfigurator  Period-based pricing UI (morning/afternoon/evening)
│
├── caretaker/
│   └── ExtensionModal      Extend an in-progress booking
│
├── user/
│   ├── AnimatedPressable   Pressable with spring animation
│   └── SkeletonLoader      Content loading placeholder
│
├── AppHeader               Shared stack screen header (60px, Ubuntu-Bold)
│   ├── back button (44px)
│   ├── title
│   └── actions[] (right-side icon buttons)
│
└── ReviewCard              Star rating + text display
```

### Screen-Level Component Composition (UserNavigator example)

```
UserNavigator
└── Stack.Navigator
    ├── HomeScreen
    │   ├── homeTopBar (inline, sticky)
    │   │   ├── Logo
    │   │   ├── Location pill
    │   │   └── Avatar with unread badge
    │   └── FlatList
    │       ├── ListHeaderComponent
    │       │   └── SearchBar + Filters
    │       └── TurfCard[] ──► onPress ──► TurfDetailScreen
    │
    ├── TurfDetailScreen
    │   ├── Hero image with overlay buttons
    │   ├── Turf info (name, address, ratings)
    │   ├── Ground tabs
    │   ├── PricingSection
    │   ├── ReviewCard[]
    │   └── Book Now CTA ──► BookingScreen
    │
    ├── BookingScreen
    │   ├── AppHeader
    │   ├── DatePicker
    │   ├── SportSelector
    │   └── TimeSlotGrid ──► confirm ──► BookingConfirmationScreen
    │
    └── ChatScreen
        ├── Custom header (partner name + avatar)
        ├── FlatList (ChatBubble[], DateSeparator[])
        │   ├── NegotiationCard (inline)
        │   ├── BookingCard (inline)
        │   └── PaymentRequestCard (inline)
        └── ChatInput
```

---

## 11. Pricing & Business Logic

### Time Period Definitions

```
Period       Hours           Typical Use
──────────────────────────────────────────
Morning      06:00 – 10:00   Early morning players
Afternoon    10:00 – 18:00   Casual / school bookings
Evening      18:00 – 23:00   Peak demand (highest rates)
```

### Price Calculation Flow

```
BookingScreen: user picks ground, date, start–end time
        │
        ▼
priceUtils.calculateBookingPrice(ground, sport, date, startTime, endTime)
        │
        ├── isWeekend(date)?  → use weekend rates
        │
        ├── breakdownTimeIntoSlots(startTime, endTime, dayPricing)
        │       └── splits booking across periods proportionally
        │           e.g. 17:00–20:00 → 1h afternoon + 2h evening
        │
        ├── calculate subtotal per period segment
        │
        └── return { slots[], subtotal, total, duration, isWeekend }
```

### Subscription Tiers

```
Grounds       Rate/Ground/Month    Discount
──────────────────────────────────────────
1–5           ₹299                 —
6–10          ₹269                 10%
11–20         ₹254                 15%
21+           ₹239                 20%

Duration discounts (stack with tier):
1 month       0%
3 months      5%
6 months      10%
12 months     15%
```

### Slot Color States (BookMyShow style)

```
SLOT_STATUS     Color       Meaning
──────────────────────────────────────────────────────────
AVAILABLE       Green       Can be booked
HIGH_DEMAND     Orange      Few slots left
CONFIRMED       Red         Already booked
ACADEMY         Purple      Reserved for academy session
LOCKED          Yellow      Soft-locked (payment in progress)
PAST            Gray        Time has passed
BLOCKED         Dark Gray   Admin/manager blocked
PENDING         Blue        Awaiting confirmation
```

---

## 12. Payment & Booking Lifecycle

### State Machine

```
[Booking Requested]
        │
        ▼
   status: "pending"
   paymentStatus: "pending"
        │
        ├── Manager rejects ──────────────────► status: "rejected"
        │
        └── Manager accepts (or auto-confirm)
                │
                ▼
           status: "confirmed"
                │
                ├── paymentTiming = "before_approval"
                │       └── user pays before this step
                │
                └── paymentTiming = "after_approval"
                        │
                        ▼
                   User submits UPI screenshot
                        │
                        ▼
                   paymentStatus: "submitted"
                        │
                        ├── Manager verifies ──► paymentStatus: "verified"
                        │                            │
                        │                            ▼
                        │                       status: "in_progress"
                        │                            │
                        │                            ▼
                        │                       status: "completed"
                        │
                        └── Cloud Fn timeout ──► paymentStatus: "failed"
                                                  status: "cancelled"
```

### Payment Timing Modes

```
AdvancePaymentSettings (per turf/ground)
├── before_approval  User pays → manager reviews → confirms
└── after_approval   Manager confirms → user pays → verified
```

---

## 13. Push Notifications Pipeline

```
App startup (native)
        │
        ▼
useNotifications hook
        │
        ├── Request FCM permission
        ├── Get FCM token
        └── updateDocument("users", uid, { fcmTokens: { [deviceId]: token } })

Trigger event (booking/payment/chat)
        │
        ▼
Cloud Function (Firestore trigger or scheduled)
        │
        ├── Fetch recipient's fcmTokens from Firestore
        ├── Send FCM via Firebase Admin SDK
        └── addDocument("notifications", { userId, type, title, body, data, isRead: false })

Device receives push
        │
        ▼
useNotifications (onSnapshot on notifications collection)
        │
        ├── Update unreadCount (computed from isRead)
        ├── Update app badge (Expo Notifications)
        └── Refresh notification list in UI
```

---

## 14. Subscription System

### Trial & Subscription States

```
Company created
        │
        ▼
  status: "trial"  (trialStartDate → trialEndDate, usually 30 days)
        │
        ├── Trial expires without payment ──► status: "expired"
        │                                          │
        │                                          └── grace_period (7 days)
        │                                                  │
        │                                                  └── full restriction
        │
        └── Owner pays subscription
                │
                ▼
         status: "active"  (subscriptionStartDate → subscriptionEndDate)
                │
                ├── Approaching expiry ──► Cloud Fn sends warning notifications
                │
                └── Expires without renewal ──► status: "expired" → grace_period
```

### Subscription Enforcement

```
Cloud Functions (scheduled daily):
├── checkSubscriptionExpiry     Updates status field
├── enforceGracePeriod          Restricts certain operations
└── sendSubscriptionExpiryWarnings  FCM + Firestore notification

Client:
└── selectIsSubscriptionActive / selectIsTrialActive selectors
        └── Used in screens to show upgrade prompts or lock features
```

---

## Key Constants Quick Reference

| Constant | Value | File |
|---|---|---|
| Primary green | `#4CAF50` | `theme.js` |
| User accent (emerald) | `#10B981` | `theme.js` |
| Ops mode color | `#00796B` | `OperationsModeNavigator` |
| Soft lock TTL | 10 minutes | `slotLockUtils.js` |
| Firebase project | `sowin-power` | `config.js` |
| Expo bundle ID | `com.tanmaydevil.Turf1701` | `app.json` |
| Invite code length | 8 chars (alphanumeric) | `inviteCodeUtils.js` |
| Font family | Ubuntu (Regular/Medium/Bold) | `app.json`, `theme.js` |
| UI framework | react-native-paper | `package.json` |
| Icon set | MaterialCommunityIcons (@expo/vector-icons) | Throughout |

---

*Document generated from source — update when schema or navigation structure changes.*
