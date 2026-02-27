# 🏟️ TURF MANAGEMENT SYSTEM V2 - DEVELOPMENT PROMPTS (Part 3)

## Prompts 37-57: Weeks 11-20

---

### Prompt 35: Caretaker Dashboard & Assignment Status
```
Create the caretaker dashboard with assignment-aware features.

**Requirements:**

1. **WaitingForAssignmentScreen.js:** (when isAssigned == false)
   - Friendly message explaining waiting status
   - Company name displayed
   - Refresh button to check status

2. **CaretakerDashboardScreen.js:** (when isAssigned == true)
   - Assigned turf name
   - Today's bookings overview
   - Daily stats
   - Quick actions

3. **Navigation Logic:** Check isAssigned before rendering

4. **Real-time Assignment Listener:** Auto-redirect when assigned

**Checkpoint:**
- Unassigned caretakers see waiting screen
- Assigned caretakers see dashboard
- Real-time assignment detection works
```

---

### Prompt 36: Caretaker Calendar with Time-Based Visibility
```
Create the caretaker calendar with restricted visibility for future dates.

**Requirements:**

Create src/screens/caretaker/CalendarScreen.js:

**Key V2 Feature: Time-Based Visibility**

**For TODAY:**
- Full booking details visible
- Customer name and phone (with call button)
- Booking time, Amount, Ground, Sport
- Action buttons: Mark Attendance, Collect Payment, Extend

**For FUTURE DATES:**
- Limited visibility
- Customer name: Visible
- Customer phone: HIDDEN
- Booking time: HIDDEN
- Amount: Visible
- NO action buttons

**Calendar Features:**
- Week view with date selector
- Today highlighted
- Color coding for status

**Checkpoint:**
- Today shows full details
- Future shows limited details
- Phone and time hidden for future
- Actions only for today
```

---

### Prompt 37: Payment Collection Feature (Caretaker)
```
Create the payment collection feature for caretakers.

**Requirements:**

Create src/screens/caretaker/PaymentCollectionScreen.js:

1. **Booking Details Section:** Customer, Date, Time, Duration
2. **Amount Breakdown:** Base, Extension, Advance, Due
3. **Payment Collection Form:**
   - Cash Amount input
   - Online Amount input (GPay/PhonePe)
   - Validation: Cash + Online = Amount Due
4. **On Confirm:** Update booking with payment details, status = 'completed'
5. **Partial Payment Handling:** Allow with notes
6. **No-Show Handling:** Mark as no-show button

**Checkpoint:**
- Payment form works
- Validation prevents incorrect amounts
- Booking updates correctly
- No-show option works
```

---

### Prompt 38: Time Extension Feature (Caretaker)
```
Create the booking time extension feature for caretakers.

**Requirements:**

Create src/components/caretaker/ExtensionModal.js:

1. **Extension Options:** 30 min, 1 hour, 1.5 hours, 2 hours, Custom
2. **Availability Check:** Check if next slot is free
3. **Extension Preview:** New end time, Extension charge
4. **On Confirm:** Add extension time slot to booking
5. **Extension Payment:** Add to amount due

**Checkpoint:**
- Extension options display
- Availability check works
- Price calculation correct
- Cannot extend if next slot taken
```

---

### Prompt 39: Maintenance Log Feature (Caretaker)
```
Create the maintenance reporting feature for caretakers.

**Requirements:**

Create src/screens/caretaker/MaintenanceLogScreen.js:

1. **Report Issue Form:**
   - Ground selection
   - Issue type: Lighting, Ground Condition, Equipment, Safety, Other
   - Description
   - Priority: Low/Medium/High
   - Photo upload (multiple)
2. **On Submit:** Create maintenance_logs document
3. **My Reports List:** Show reported issues with status
4. **Notification:** Notify manager when reported

**Checkpoint:**
- Issue creation works
- Image upload works
- Manager notification sent
```

---

### Prompt 40: Razorpay Integration
```
Create the Razorpay payment integration for the app.

**Requirements:**

1. **Setup:** Install react-native-razorpay, configure keys
2. **Create src/api/razorpay/payment.js:**
   - createOrder(amount, bookingId)
   - initiatePayment(orderData, userInfo)
   - verifyPayment(paymentId, orderId, signature)

3. **Payment Flows:**
   - Advance Payment (10% for tournaments)
   - Full Payment (optional)
   - Refund Processing

4. **Cloud Functions:**
   - createRazorpayOrder
   - verifyRazorpayPayment

5. **Payment UI Components:** PaymentButton, PaymentStatusModal

**Checkpoint:**
- Test mode payment works
- Order creation works
- Payment verification works
- Booking updates on payment
```

---

### Prompt 41: Subscription Payment System (Owner)
```
Create the subscription payment system for owners.

**Requirements:**

Create src/screens/owner/SubscriptionScreen.js:

1. **Current Subscription Display:** Status, Grounds, Rate, End date
2. **Pricing Calculator:** Show tiers, auto-calculate based on grounds
3. **Payment Flow:** Select duration, Razorpay checkout
4. **Grace Period Handling:** Warning messages, Pay Now button
5. **Payment History:** List past payments, download invoice

**Checkpoint:**
- Subscription status displays correctly
- Pricing calculator works
- Payment processes correctly
- Grace period warnings show
```

---

### Prompt 42: Manager Analytics Dashboard
```
Create the analytics dashboard for managers with turf-level metrics.

**Requirements:**

Create src/screens/manager/AnalyticsScreen.js:

1. **Date Range Selector:** Today, Week, Month, Custom
2. **KPI Cards:** Bookings, Revenue, Utilization, Avg Value, Cancellation Rate
3. **Charts:**
   - Revenue Trend (Line)
   - Sport-wise Breakdown (Pie)
   - Peak Hours (Bar)
   - Ground Utilization (Bar)
4. **Data Table:** Sortable columns, Export button
5. **Export Function:** Generate XLSX file with xlsx library

**Checkpoint:**
- All KPIs display correctly
- Charts render properly
- Export generates valid Excel file
```

---

### Prompt 43: Owner Analytics Dashboard
```
Create the owner analytics dashboard with company-wide metrics.

**Requirements:**

Create src/screens/owner/AnalyticsScreen.js:

1. **Company-Wide KPIs:** Total Revenue, Bookings, Turfs, Managers, Utilization
2. **Cross-Turf Comparison Chart:** Revenue by turf
3. **Manager Performance Table:** Bookings, Revenue per manager
4. **Financial Summary:** Revenue vs Expenses, Profit/Loss
5. **Subscription ROI:** Revenue vs subscription cost

**Checkpoint:**
- Company-wide metrics aggregate correctly
- Cross-turf comparison works
- Manager performance accurate
```

---

### Prompt 44: Expense Tracking Feature
```
Create the expense tracking feature for managers and owners.

**Requirements:**

Create src/screens/manager/ExpenseTrackingScreen.js:

1. **Add Expense Form:** Category, Amount, Description, Date, Receipt image
2. **Expense List:** Grouped by month, filterable
3. **Monthly Summary:** Total by category, pie chart
4. **Owner View:** See all expenses across turfs

**Checkpoint:**
- Add expense works
- Receipt upload works
- Monthly summary accurate
```

---

### Prompt 45: Review System
```
Create the review system for users and response feature for managers/owners.

**Requirements:**

1. **WriteReviewScreen.js:** Star rating, comment, submit
2. **ReviewCard Component:** Display review with response
3. **Manager Response:** Add response to review
4. **Review Moderation:** Flag inappropriate reviews
5. **Rating Aggregation:** Update turf average rating

**Checkpoint:**
- Users can write reviews
- Manager can respond
- Rating calculation correct
```

---

### Prompt 46: Notification System
```
Create the comprehensive notification system.

**Requirements:**

1. **Setup Firebase Cloud Messaging:** Request permission, store token
2. **Create src/hooks/useNotifications.js:** Handle foreground/background
3. **Notification Types:** booking_*, chat_*, subscription_*, academy_*, etc.
4. **Cloud Function sendNotification:** Get tokens, create document, send FCM
5. **NotificationsScreen:** List all, mark as read, navigate

**Checkpoint:**
- Push notifications work
- FCM token saved correctly
- Notifications appear in app
```

---

### Prompt 47: Academy Management Screen
```
Create the academy management system for recurring bookings.

**Requirements:**

Create src/screens/manager/AcademyManagementScreen.js:

1. **Academy List:** All academies with status badges
2. **Add Academy Flow:**
   - Step 1: Basic Details (name, sport, ground, contact)
   - Step 2: Schedule (days of week, time range)
   - Step 3: Contract Period (start date, duration 1-3 months)
   - Step 4: Payment (total, cash/online split)
3. **On Submit:** Create academy document, trigger session generation
4. **Academy Document Structure:** As per master plan

**Checkpoint:**
- Academy creation works
- Schedule selection works
- Contract period calculates correctly
```

---

### Prompt 48: Academy Session Generation
```
Create the Cloud Function for auto-generating academy sessions.

**Requirements:**

1. **Cloud Function: generateAcademySessions**
   - Trigger: Academy document created
   - Generate session for each matching day in contract period
   - Batch write all sessions
   - Update academy stats

2. **Update Availability Check:** Include academy_sessions in conflict check

3. **Session Cancellation:**
   - Manager can cancel individual sessions
   - Sets availableForBooking = true
   - Opens slot for regular bookings

4. **Session Status Updates:** Mark past sessions as completed

**Checkpoint:**
- Sessions auto-generate
- Correct number created
- Sessions block regular bookings
- Cancellation opens slot
```

---

### Prompt 49: Academy Renewal System
```
Create the academy renewal notification and management system.

**Requirements:**

1. **Cloud Function: sendAcademyRenewalReminders**
   - Run daily at 9 AM
   - Find academies expiring in 5 days
   - Send notification to creator
   - Mark notification sent

2. **Renewal Screen:** Show expiring, renew button, generate new sessions

3. **Academy Expiry:** Status changes to 'expired'

**Checkpoint:**
- Renewal notifications send 5 days before
- Renewal extends contract
- New sessions generated
```

---

### Prompt 50: Subscription Cloud Functions
```
Create the subscription management Cloud Functions.

**Requirements:**

1. **Daily Subscription Check:**
   - Find expired subscriptions
   - Move to grace_period
   - Notify owners
   - After grace period: deactivate turfs

2. **Expiry Warning Notifications:** At 7, 3, 1 days before

3. **Reactivation on Payment:** Reactivate turfs, update status

**Checkpoint:**
- Daily check runs correctly
- Grace period activates
- Turfs deactivate after grace
- Reactivation works
```

---

### Prompt 51: Admin Panel - Company Management
```
Create the admin panel for platform management.

**Requirements:**

1. **AdminDashboardScreen.js:** Platform overview stats
2. **CompanyManagementScreen.js:** List, search, filter companies
3. **Company Details:** Full info, subscription, admin actions
4. **Manual Subscription Update:** For offline payments
5. **Admin Logs:** Track all admin actions

**Checkpoint:**
- Platform overview accurate
- Manual subscription update works
- Admin actions logged
```

---

### Prompt 52: Suspension Cleanup Function
```
Create the Cloud Function for deleting suspended users after 30 days.

**Requirements:**

**Cloud Function: processSuspendedUserDeletion**
- Run daily at 2 AM
- Find users with canBeDeletedAfter <= now
- Remove from company arrays
- Remove from turf arrays
- Delete user document

**Checkpoint:**
- Function runs daily
- Only deletes users past 30-day mark
- Proper cleanup of references
```

---

### Prompt 53: End-to-End Testing Setup
```
Create comprehensive test scenarios for the application.

**Requirements:**

1. **Test Scenarios Document:**
   - User Flow Tests (registration, booking, cancel, review)
   - Owner Flow Tests (registration, turf, team, subscription)
   - Manager Flow Tests (join, approve, academy, chat)
   - Caretaker Flow Tests (join, assignment, payment, extension)
   - Cross-Role Tests (conflicts, notifications, permissions)

2. **Performance Tests:** Load time, creation time, delivery time

3. **Edge Cases:** Network failure, concurrent bookings, pagination

**Checkpoint:**
- All test scenarios pass
- Performance targets met
- Edge cases handled
```

---

### Prompt 54: Bug Fixes & Optimization
```
Address common issues and optimize the application.

**Requirements:**

1. **Common Bug Fixes:** Query limits, memory leaks, navigation state, timezone issues
2. **Performance Optimizations:** Lazy loading, image caching, React.memo, virtualized lists
3. **Error Handling:** Global boundary, Firebase errors, network recovery
4. **Security Audit:** Firestore rules, API keys, input sanitization

**Checkpoint:**
- No known bugs
- App runs smoothly
- Security audit passed
```

---

### Prompt 55: Web Version Optimization
```
Optimize the application for web deployment.

**Requirements:**

1. **Web-Specific Styling:** Responsive layout, hover states, sidebar navigation
2. **Web Features:** Browser notifications, web share, file download
3. **PWA Support:** Manifest, service worker, install prompt
4. **SEO (if needed):** Meta tags, Open Graph

**Checkpoint:**
- Web version fully functional
- Responsive on all screen sizes
- PWA features work
```

---

### Prompt 56: Deployment Preparation
```
Prepare the application for production deployment.

**Requirements:**

1. **Environment Configuration:** Production Firebase, API keys
2. **App Store (iOS):** Icons, screenshots, privacy policy, EAS config
3. **Play Store (Android):** Icons, feature graphic, screenshots, EAS config
4. **Web Deployment:** Firebase Hosting, custom domain, SSL
5. **Monitoring:** Sentry, Firebase Analytics
6. **Documentation:** User guide, Admin guide, Deployment runbook

**Checkpoint:**
- All assets ready
- EAS builds successful
- Web deployment working
- Monitoring active
```

---

### Prompt 57: Launch Checklist
```
Final checklist before launch.

**Requirements:**

1. **Pre-Launch Checklist:**
   
   **Code Quality:**
   - [ ] All console.logs removed
   - [ ] No hardcoded test data
   - [ ] Error boundaries in place
   - [ ] Loading states everywhere
   - [ ] Empty states everywhere

   **Security:**
   - [ ] Firestore rules tested
   - [ ] API keys secured
   - [ ] HTTPS enforced
   - [ ] Input validation

   **Functionality:**
   - [ ] All flows tested on iOS
   - [ ] All flows tested on Android
   - [ ] All flows tested on Web
   - [ ] Payments work in production mode
   - [ ] Notifications work

   **Data:**
   - [ ] Database indexes created
   - [ ] Sample data removed
   - [ ] Analytics reset

   **Legal:**
   - [ ] Privacy policy live
   - [ ] Terms of service live
   - [ ] Cookie consent (web)

2. **Launch Day:**
   - Deploy Cloud Functions
   - Deploy Firestore rules
   - Deploy web version
   - Submit iOS app
   - Submit Android app
   - Monitor for errors

3. **Post-Launch:**
   - Monitor error rates
   - Watch for user feedback
   - Ready hotfix process

**Checkpoint:**
- All checklist items complete
- Apps submitted to stores
- Web version live
- Team ready for support
```

---

# 📋 QUICK REFERENCE

## Entity Hierarchy
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

## Booking Status Flow
```
pending → confirmed → in_progress → completed
    ↓
rejected/cancelled
```

## Calendar Color Legend
```
🟢 Green    = Available
🟡 Yellow   = Partially booked
🔴 Red      = Fully booked
🔵 Blue     = Confirmed booking
🟠 Orange   = Academy session
⚫ Grey     = Past/Disabled/Blocked
```

## User Roles & Permissions
```
User      → Book, Chat, Review
Owner     → Company setup, Turfs, Subscription, Analytics, Managers
          → (Optional) All manager tasks if operational permissions enabled
Manager   → Bookings, Chat, Analytics (turf-level), Caretakers, Academy
Caretaker → View bookings (assigned turf), Collect payments, Report issues
Admin     → Platform management, Subscriptions
```

## Payment Flow
```
Booking Created → Advance (optional) → On-ground Payment
                      ↓                       ↓
                  Razorpay              Cash + Online
```

## Suspension Flow
```
Owner suspends Manager/Caretaker
         ↓
Status: isSuspended = true
         ↓
30 days later → Cloud Function deletes user
```

## Invite Code Flow
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

**Document Version:** 2.0
**Total Prompts:** 57
**Estimated Development Time:** 20 Weeks

**Good luck with your development! 🚀**
