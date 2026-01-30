# Navigate to your preferred location
cd ~/Projects  # or wherever you want

# Create project folder
mkdir turf-management-app
cd turf-management-app

# Open in VS Code
code .
```

### Step 5: First Claude Code Command

Now here's how to use Claude Code effectively. Open Claude Code panel and type:

---

## 📋 CLAUDE CODE PROMPTS - WEEK BY WEEK

Below are the exact prompts you should give to Claude Code for each week. Copy-paste these prompts one by one as you progress.

---

### 🗓️ WEEK 1-2: Project Setup & Authentication

#### Prompt 1: Initialize Expo Project
```
Initialize a new Expo project with TypeScript for a turf management app. 
Setup the following:
1. Create Expo project with TypeScript template
2. Install these dependencies:
   - @react-navigation/native, @react-navigation/stack, @react-navigation/bottom-tabs
   - firebase (v9+)
   - @reduxjs/toolkit, react-redux
   - react-native-paper
   - expo-status-bar
   - react-native-safe-area-context
   - react-native-screens
3. Create folder structure as per the master plan:
   /src
     /components
     /screens
     /navigation
     /services
     /store
     /utils
     /hooks
     /constants
     /types
4. Setup basic App.tsx with navigation container
```

#### Prompt 2: Firebase Configuration
```
Setup Firebase configuration for the turf management app:
1. Create /src/services/firebase/config.ts with Firebase initialization
2. Create /src/services/firebase/auth.ts with phone authentication functions:
   - sendOTP(phoneNumber)
   - verifyOTP(verificationId, code)
   - signOut()
3. Create /src/services/firebase/firestore.ts with basic Firestore helpers
4. Create .env.example file with required Firebase config variables
5. Add firebase config to .gitignore

Use Firebase v9 modular syntax.
```

#### Prompt 3: Redux Store Setup
```
Setup Redux store for the turf management app:
1. Create /src/store/index.ts with configureStore
2. Create /src/store/slices/authSlice.ts with:
   - State: user, isAuthenticated, isLoading, error
   - Actions: setUser, setLoading, setError, logout
3. Create /src/store/slices/bookingSlice.ts with:
   - State: bookings, selectedTurf, selectedDate, isLoading
   - Actions: setBookings, setSelectedTurf, setSelectedDate
4. Create custom hooks in /src/hooks/:
   - useAuth.ts
   - useAppDispatch.ts
   - useAppSelector.ts
```

#### Prompt 4: Authentication Screens
```
Create authentication screens for the turf management app:

1. /src/screens/auth/LoginScreen.tsx
   - Phone number input with country code (+91)
   - "Send OTP" button
   - Use react-native-paper components
   - Clean UI with app logo placeholder

2. /src/screens/auth/OTPScreen.tsx
   - 6-digit OTP input
   - Resend OTP timer (30 seconds)
   - Verify button
   - Auto-verify on 6 digits entered

3. /src/screens/auth/RoleSelectionScreen.tsx
   - Three role cards: User, Manager, Caretaker
   - Each card with icon and description
   - Selection saves to Firestore users collection

4. /src/screens/auth/ProfileSetupScreen.tsx
   - Name input
   - Email input (optional)
   - Profile picture upload (optional)
   - Save button

Connect all screens with Redux and Firebase auth.
```

#### Prompt 5: Navigation Setup
```
Setup complete navigation for turf management app with role-based routing:

1. /src/navigation/AuthNavigator.tsx
   - Login -> OTP -> RoleSelection -> ProfileSetup

2. /src/navigation/UserNavigator.tsx (BottomTabs)
   - Home, Search, Bookings, Chat, Profile

3. /src/navigation/ManagerNavigator.tsx (BottomTabs)
   - Dashboard, Bookings, Calendar, Chat, Settings

4. /src/navigation/CaretakerNavigator.tsx (BottomTabs)
   - Today, Calendar, Profile

5. /src/navigation/RootNavigator.tsx
   - Check auth state
   - Route to correct navigator based on user role

6. /src/navigation/types.ts
   - All navigation type definitions

Use @react-navigation/native with proper TypeScript types.
```

---

### 🗓️ WEEK 3-4: Manager - Turf Registration

#### Prompt 6: Firestore Collections Setup
```
Create Firestore service files for turf management:

1. /src/services/firebase/collections/users.ts
   - createUser(userId, userData)
   - getUser(userId)
   - updateUser(userId, data)

2. /src/services/firebase/collections/companies.ts
   - createCompany(companyData)
   - getCompany(companyId)
   - updateCompany(companyId, data)
   - getCompaniesByManager(managerId)

3. /src/services/firebase/collections/turfs.ts
   - createTurf(turfData)
   - getTurf(turfId)
   - updateTurf(turfId, data)
   - getTurfsByCompany(companyId)
   - searchTurfs(filters)

4. /src/types/database.ts
   - Define all TypeScript interfaces matching the Firestore schema from master plan:
   - User, Company, Turf, Ground, Booking, Chat, etc.

Use Firebase v9 modular syntax with proper TypeScript types.
```

#### Prompt 7: Company Registration Screen
```
Create company registration screen for managers:

/src/screens/manager/CompanyRegistrationScreen.tsx
- Company name input
- Business type dropdown (Individual, Partnership, Pvt Ltd)
- GST number (optional)
- Address input
- Contact details
- Save to Firestore companies collection
- Navigate to turf registration after save

Use react-native-paper components with form validation.
```

#### Prompt 8: Turf Registration - Multi-step Form
```
Create multi-step turf registration form for managers:

/src/screens/manager/turf-registration/
  - TurfRegistrationScreen.tsx (main container with stepper)
  - Step1BasicDetails.tsx (name, description, images)
  - Step2Location.tsx (Google Maps picker, address)
  - Step3OperatingHours.tsx (open/close time per day)
  - Step4Grounds.tsx (add multiple grounds with dimensions)
  - Step5Pricing.tsx (sport-based, time-based pricing)
  - Step6Review.tsx (review all details, submit)

Features:
- Progress stepper at top
- Next/Back buttons
- Form validation per step
- Image upload to Firebase Storage
- Google Maps integration for location picker
- Dynamic pricing form (weekday/weekend, morning/afternoon/evening)

Create reusable form components in /src/components/forms/
```

#### Prompt 9: QR Code Generation
```
Implement QR code generation for turfs:

1. Install expo-barcode-generator or react-native-qrcode-svg

2. Create /src/utils/qrCode.ts
   - generateGlobalQRCode(companyId) - links to all turfs
   - generateTurfQRCode(turfId) - links to specific turf
   - QR data format: { type: 'turf'|'company', id: string }

3. Create /src/components/QRCodeDisplay.tsx
   - Display QR code with download option
   - Share functionality

4. Update turf creation to auto-generate QR codes
   - Store QR code URLs in Firestore
```

---

### 🗓️ WEEK 5-6: User - Turf Discovery & Booking

#### Prompt 10: User Home Screen
```
Create user home screen with turf discovery:

/src/screens/user/HomeScreen.tsx
- Search bar at top
- Location-based "Nearby Turfs" section
- "Popular Turfs" section
- "Recently Viewed" section
- Turf cards showing:
  - Image
  - Name
  - Rating
  - Distance
  - Starting price
  - Sports available (icons)

/src/components/TurfCard.tsx
- Reusable turf card component
- Tap navigates to TurfDetailScreen

Implement search with debounce (300ms delay).
```

#### Prompt 11: Search & Filters
```
Create search and filter functionality:

/src/screens/user/SearchScreen.tsx
- Search input with real-time results
- Filter button opens filter modal

/src/components/FilterModal.tsx
- Sport type filter (multi-select)
- Price range slider
- Rating filter (minimum stars)
- Distance filter
- Availability filter (show only available today)
- Apply/Reset buttons

/src/services/firebase/collections/turfs.ts
- Update searchTurfs() to handle all filters
- Implement Firestore compound queries
```

#### Prompt 12: Turf Detail Screen
```
Create turf detail screen:

/src/screens/user/TurfDetailScreen.tsx

Sections:
1. Image carousel (swipeable)
2. Basic info (name, rating, reviews count)
3. Location with "Get Directions" button (opens Google Maps)
4. Operating hours
5. Amenities list with icons
6. Grounds list with sports and pricing
7. Reviews section (latest 3, "See All" button)
8. "Book Now" floating button at bottom

/src/components/ImageCarousel.tsx
/src/components/AmenitiesList.tsx
/src/components/GroundCard.tsx
/src/components/ReviewCard.tsx
```

#### Prompt 13: Booking Flow - Date & Sport Selection
```
Create booking flow - Step 1 & 2:

/src/screens/user/booking/BookingScreen.tsx (container)

/src/screens/user/booking/DateSelectionStep.tsx
- Calendar component (next 30 days)
- Highlight available/partially available/fully booked dates
- Color coding: Green=available, Yellow=partial, Red=full
- Select date to proceed

/src/screens/user/booking/SportSelectionStep.tsx
- Show sports available at selected turf
- Sport cards with icons
- Select sport to proceed

/src/components/BookingCalendar.tsx
- Custom calendar component
- Fetch availability from Firestore for date colors
```

#### Prompt 14: Booking Flow - Time & Ground Selection
```
Create booking flow - Step 3 & 4:

/src/screens/user/booking/TimeSelectionStep.tsx
- Time slot grid (30-min intervals)
- Show pricing per slot based on time period
- Allow selecting continuous time range
- Highlight: Available (green), Booked (red), Selected (blue)
- Show total duration and price as slots are selected

/src/screens/user/booking/GroundSelectionStep.tsx
- Show ALL grounds simultaneously (key feature!)
- Each ground card shows:
  - Ground name & dimensions
  - Availability status for selected time
  - Price for selected sport & time
  - "Select" button (disabled if unavailable)
- User sees all options at once, picks the best one

/src/utils/pricing.ts
- calculateBookingPrice(ground, sport, date, startTime, endTime)
- Implement time-period based pricing (morning/afternoon/evening)
- Handle weekday vs weekend pricing
```

#### Prompt 15: Booking Confirmation
```
Create booking confirmation flow:

/src/screens/user/booking/BookingSummaryStep.tsx
- Selected turf, ground, sport
- Date and time range
- Price breakdown:
  - Base price per period
  - Total duration
  - Final amount
- "Confirm Booking" button

/src/components/ConfirmationDialog.tsx
- 5-second countdown timer
- "Confirming in 5... 4... 3..." text
- "Cancel" button to stop
- Auto-confirms when timer reaches 0
- Creates booking in Firestore with status: 'pending'

/src/services/firebase/collections/bookings.ts
- createBooking(bookingData)
- getBookingsByUser(userId)
- getBookingsByTurf(turfId, date)
- updateBookingStatus(bookingId, status)
```

---

### 🗓️ WEEK 7-8: Manager - Booking Management

#### Prompt 16: Manager Dashboard
```
Create manager dashboard:

/src/screens/manager/DashboardScreen.tsx

KPI Cards Row:
- Today's Bookings (count)
- Pending Requests (count with badge)
- Today's Revenue (amount)
- This Month Revenue (amount)

Quick Actions:
- "Add Manual Booking" button
- "Block Slots" button
- "View Calendar" button

Recent Activity:
- Last 5 booking requests
- Tap to view details

/src/components/manager/KPICard.tsx
/src/components/manager/QuickActionButton.tsx
```

#### Prompt 17: Pending Requests Screen
```
Create pending booking requests screen for manager:

/src/screens/manager/PendingRequestsScreen.tsx
- List of all pending bookings
- Each item shows:
  - User name & phone
  - Turf & ground
  - Date & time
  - Requested price
  - "Approve" and "Reject" buttons

/src/components/manager/BookingRequestCard.tsx
- Expandable card with full details
- Quick actions: Approve, Reject, Call User

Implement approval logic:
- Check for conflicts before approving
- If conflict exists, show error
- On approve: Update status to 'confirmed', notify user
- On reject: Update status to 'rejected', notify user with reason
```

#### Prompt 18: Manager Calendar View
```
Create calendar view for manager (Google Calendar style):

/src/screens/manager/CalendarScreen.tsx
- Month/Week/Day view toggle
- Show all grounds in parallel columns (day view)
- Color-coded bookings:
  - Blue: Confirmed
  - Yellow: Pending
  - Orange: Academy sessions
  - Grey: Blocked slots
- Tap booking to see details
- Long press to add manual booking

/src/components/manager/CalendarView.tsx
- Custom calendar grid
- Support all three views
- Smooth navigation between dates

/src/components/manager/BookingBlock.tsx
- Visual block showing booking on calendar
- Shows time, user name, sport
```

#### Prompt 19: Race Condition Prevention
```
Implement race condition prevention for booking approval:

/src/services/firebase/collections/bookings.ts

Update the approveBooking function to use Firestore Transaction:

async function approveBookingWithLock(bookingId: string): Promise<{success: boolean, error?: string}> {
  // Use runTransaction to:
  // 1. Read the booking
  // 2. Check for conflicts with other confirmed bookings
  // 3. Check for academy sessions blocking the slot
  // 4. If no conflicts, update status to 'confirmed'
  // 5. If conflicts, return error without updating
  
  // This prevents double-booking when two managers approve simultaneously
}

Create /src/utils/availability.ts:
- checkSlotAvailability(turfId, groundId, date, startTime, endTime)
- Returns: { available: boolean, conflictType?: 'booking'|'academy', conflictDetails?: string }
```

#### Prompt 20: Manual Booking & Slot Blocking
```
Create manual booking and slot blocking for manager:

/src/screens/manager/ManualBookingScreen.tsx
- Select ground
- Select sport
- Select date and time
- Enter customer details (name, phone)
- Enter payment details (cash received)
- Creates booking with status: 'confirmed', source: 'manual'

/src/screens/manager/BlockSlotsScreen.tsx
- Select ground(s) - multi-select
- Select date range
- Select time range
- Enter reason (maintenance, tournament, etc.)
- Creates entries in blocked_slots collection

/src/services/firebase/collections/blockedSlots.ts
- createBlockedSlot(data)
- getBlockedSlots(turfId, dateRange)
- deleteBlockedSlot(slotId)
```

---

### 🗓️ WEEK 9-10: Chat System with Negotiation

#### Prompt 21: Chat List Screen
```
Create chat list screen:

/src/screens/chat/ChatListScreen.tsx
- List of all conversations
- Each item shows:
  - Other party's name & avatar
  - Last message preview (truncated)
  - Timestamp
  - Unread count badge
- Search chats by name
- Real-time updates using Firestore onSnapshot

/src/components/chat/ChatListItem.tsx
- Avatar, name, last message, time, unread badge
- Different styling for unread chats

/src/services/firebase/collections/chats.ts
- getChatsByUser(userId)
- createChat(participants)
- subscribeToChats(userId, callback)
```

#### Prompt 22: Chat Screen with Real-time Messages
```
Create chat screen using react-native-gifted-chat:

/src/screens/chat/ChatScreen.tsx
- Install and use react-native-gifted-chat
- Real-time message sync with Firestore
- Message types:
  - text (normal messages)
  - negotiation_card (custom render)
  - booking_card (custom render)
  - location (show map preview)
  - image (show image)
- Typing indicator
- Read receipts
- "Book Now" floating button for users

/src/services/firebase/collections/messages.ts
- sendMessage(chatId, message)
- subscribeToMessages(chatId, callback)
- markAsRead(chatId, userId)
```

#### Prompt 23: Negotiation Card Component
```
Create negotiation card for chat:

/src/components/chat/NegotiationCard.tsx

Display:
- Turf & ground name
- Date and time requested
- Original price
- Offered price (user's offer)
- Status badge (pending/accepted/rejected/countered/expired)

Actions (for manager):
- "Accept" button - creates booking at offered price
- "Counter" button - opens counter offer modal
- "Reject" button - with reason input

Actions (for user):
- "Accept Counter" button (if countered)
- "Cancel Request" button

/src/components/chat/CounterOfferModal.tsx
- Input for counter price
- Optional message
- Send button

Implement negotiation flow:
1. User sends negotiation request
2. Manager can accept/counter/reject
3. If countered, user can accept/counter/cancel
4. On accept, check slot availability and create booking
5. Auto-expire if slot gets booked by another user
```

#### Prompt 24: Booking Card & Quick Book
```
Create booking card and quick booking from chat:

/src/components/chat/BookingCard.tsx
- Shows confirmed booking details in chat
- Turf, ground, date, time, price
- Status (confirmed, completed, cancelled)
- "View Details" button

/src/components/chat/QuickBookButton.tsx
- Floating button in chat for users
- Opens quick booking modal

/src/components/chat/QuickBookModal.tsx
- Pre-filled with turf from current chat
- Select ground, sport, date, time
- Shows price
- "Send Request" - creates negotiation card
- "Book at Listed Price" - creates direct booking

Manager can also send booking cards:
- "Suggest Booking" action
- Pre-fills slot details
- User can accept or modify
```

---

### 🗓️ WEEK 11: Caretaker Module

#### Prompt 25: Caretaker Dashboard & Today View
```
Create caretaker dashboard and today's view:

/src/screens/caretaker/DashboardScreen.tsx
- Today's date prominently displayed
- Summary cards:
  - Total bookings today
  - Completed
  - Upcoming
  - Revenue collected
- List of today's bookings (full details visible)

/src/screens/caretaker/TodayBookingsScreen.tsx
- List of all bookings for today
- Each booking shows:
  - Customer name
  - Phone number (with call button)
  - Time slot
  - Ground & sport
  - Amount to collect
  - Status (upcoming/in-progress/completed)
- Actions:
  - "Mark Arrived" button
  - "Collect Payment" button
  - "Extend Time" button

Implement visibility rules:
- Today's bookings: Show ALL details (name, phone, time, amount)
- Future bookings: Show LIMITED details (name, amount only - NO time, NO phone)
```

#### Prompt 26: Caretaker Calendar with Visibility Rules
```
Create caretaker calendar with restricted visibility:

/src/screens/caretaker/CalendarScreen.tsx
- Calendar view for selecting date
- Today highlighted
- Bookings count per day

/src/screens/caretaker/DayBookingsScreen.tsx
- Accessed by tapping a date on calendar
- If selected date is TODAY:
  - Show full booking details (name, phone, time, amount)
  - Show action buttons
- If selected date is FUTURE:
  - Show limited details (name, amount only)
  - Hide time slots and phone numbers
  - Show message: "Full details available on the day"
  - No action buttons

/src/utils/caretakerPermissions.ts
- isToday(date): boolean
- getVisibleFields(date): string[]
- canPerformActions(date): boolean
```

#### Prompt 27: Payment Collection Modal
```
Create payment collection for caretaker:

/src/components/caretaker/PaymentCollectionModal.tsx

Display:
- Total amount due
- Advance paid (if any)
- Remaining amount

Input:
- Cash amount received (number input)
- Online amount received (number input)
- Total must equal remaining amount (validation)

Actions:
- "Collect Payment" button
- Validates cash + online = remaining
- Updates booking with payment details
- Marks booking as 'completed'

/src/services/firebase/collections/bookings.ts
- collectPayment(bookingId, paymentDetails)
  - paymentDetails: { cashAmount, onlineAmount, collectedBy, collectedAt }
```

#### Prompt 28: Time Extension Feature
```
Create time extension feature for caretaker:

/src/components/caretaker/ExtendTimeModal.tsx

Display:
- Current end time
- Available extension options (30min, 60min, 90min)
- Each option shows:
  - New end time
  - Additional cost
  - Availability status (green check or red X)

Logic:
- Check if next slot is available
- Calculate additional cost based on time period pricing
- Show unavailable options as disabled with reason

Actions:
- Select extension duration
- "Confirm Extension" button
- Updates booking:
  - Adds to timeSlots array (extension info)
  - Updates endTime
  - Updates totalAmount
  - Records extension in statusHistory

/src/utils/extensionCalculator.ts
- checkExtensionAvailability(bookingId, duration)
- calculateExtensionPrice(booking, duration)
```

#### Prompt 29: Maintenance Logs
```
Create maintenance log feature for caretaker:

/src/screens/caretaker/MaintenanceLogScreen.tsx
- List of maintenance issues reported
- "Report Issue" floating button

/src/components/caretaker/ReportIssueModal.tsx
- Select ground
- Issue category dropdown:
  - Turf damage
  - Lighting issue
  - Equipment problem
  - Cleanliness
  - Other
- Description text input
- Photo upload (optional)
- Priority: Low, Medium, High
- Submit button

/src/services/firebase/collections/maintenanceLogs.ts
- createMaintenanceLog(data)
- getLogsByTurf(turfId)
- updateLogStatus(logId, status)

Manager can view and update maintenance logs from their dashboard.
```

---

### 🗓️ WEEK 12: Payment Integration

#### Prompt 30: Razorpay Integration
```
Integrate Razorpay payment gateway:

1. Install: npm install react-native-razorpay

2. Create /src/services/payment/razorpay.ts
   - initializePayment(options)
   - Options: amount, currency, orderId, customerInfo
   - Handle success/failure callbacks

3. Create /src/components/payment/PaymentButton.tsx
   - "Pay Now" button
   - Shows amount
   - Triggers Razorpay checkout

4. Implement payment flows:
   a. Advance payment (10% for tournaments)
   b. Full payment option
   c. Handle payment success:
      - Update booking with payment reference
      - Update payment status
   d. Handle payment failure:
      - Show error message
      - Allow retry

5. Create /src/screens/payment/PaymentStatusScreen.tsx
   - Success animation and details
   - Failure message with retry option
   - Receipt download option

Note: For Expo, we need to use expo-dev-client or bare workflow for Razorpay.
Alternative: Use Razorpay web checkout in WebView for managed workflow.
```

#### Prompt 31: Refund System
```
Implement refund system:

/src/services/payment/refunds.ts
- initiateRefund(bookingId, reason)
- calculateRefundAmount(booking, cancellationTime)

Refund policy implementation:
- More than 24 hours before: 100% refund
- 12-24 hours before: 75% refund
- 6-12 hours before: 50% refund
- Less than 6 hours: No refund

/src/screens/user/CancelBookingScreen.tsx
- Show booking details
- Show refund amount based on policy
- Cancellation reason dropdown
- "Cancel Booking" button
- Confirmation dialog

/src/screens/manager/RefundRequestsScreen.tsx
- List of refund requests
- Approve/Reject actions
- Process refund through Razorpay
```

---

### 🗓️ WEEK 13: Analytics & Reports

#### Prompt 32: Manager Analytics Dashboard
```
Create analytics dashboard for manager:

/src/screens/manager/AnalyticsScreen.tsx

KPI Cards Row:
- Total Revenue (this month)
- Total Bookings (this month)
- Average Booking Value
- Occupancy Rate %

Charts Section:
1. Revenue Trend (Line Chart) - Last 30 days
2. Bookings by Sport (Pie Chart)
3. Peak Hours (Bar Chart) - Hourly distribution
4. Revenue by Ground (Bar Chart)

Install: npm install react-native-chart-kit

/src/components/analytics/
- KPICard.tsx
- RevenueLineChart.tsx
- SportPieChart.tsx
- PeakHoursBarChart.tsx
- GroundRevenueChart.tsx

/src/services/analytics/calculations.ts
- calculateMonthlyRevenue(bookings)
- calculateOccupancyRate(bookings, totalSlots)
- groupBookingsBySport(bookings)
- groupBookingsByHour(bookings)
```

#### Prompt 33: Data Table & Excel Export
```
Create data table with Excel export:

/src/screens/manager/ReportsScreen.tsx
- Date range picker (from-to)
- Filter by ground, sport, status
- "Generate Report" button
- "Export to Excel" button

/src/components/analytics/DataTable.tsx
- Excel-like table view
- Columns: Date, Customer, Ground, Sport, Time, Amount, Status
- Sortable columns (tap header to sort)
- Scrollable horizontally and vertically

/src/utils/excelExport.ts
Install: npm install xlsx expo-file-system expo-sharing

- exportToExcel(bookings, dateRange)
- Creates XLSX file with two sheets:
  1. "Bookings" - All booking details
  2. "Summary" - Aggregated stats
- Saves to device and opens share dialog

Test export functionality thoroughly.
```

#### Prompt 34: Expense Tracking
```
Create expense tracking for manager:

/src/screens/manager/ExpensesScreen.tsx
- List of expenses
- Filter by category, date range
- Total expenses summary
- "Add Expense" floating button

/src/components/manager/AddExpenseModal.tsx
- Amount input
- Category dropdown:
  - Maintenance
  - Utilities
  - Staff Salary
  - Equipment
  - Marketing
  - Other
- Description
- Date picker
- Receipt photo upload (optional)
- Save button

/src/services/firebase/collections/expenses.ts
- createExpense(data)
- getExpensesByCompany(companyId, dateRange)
- updateExpense(expenseId, data)
- deleteExpense(expenseId)

Add expenses to analytics dashboard:
- Profit = Revenue - Expenses
- Expense breakdown pie chart
```

---

### 🗓️ WEEK 14: Notifications & Reviews

#### Prompt 35: Push Notifications Setup
```
Setup Firebase Cloud Messaging for push notifications:

1. Install: expo-notifications

2. Create /src/services/notifications/setup.ts
   - requestPermissions()
   - getFCMToken()
   - saveFCMToken(userId, token)

3. Create /src/services/notifications/handlers.ts
   - handleForegroundNotification(notification)
   - handleBackgroundNotification(notification)
   - handleNotificationPress(notification)

4. Update App.tsx:
   - Initialize notifications on app start
   - Register notification handlers
   - Save FCM token on login

5. Create notification types handler:
   - booking_request -> Navigate to pending requests
   - booking_confirmed -> Navigate to booking details
   - booking_reminder -> Navigate to booking details
   - chat_message -> Navigate to chat
   - payment_received -> Navigate to booking details

6. Create /src/screens/NotificationCenterScreen.tsx
   - List all notifications
   - Mark as read on tap
   - Clear all button
```

#### Prompt 36: SMS Notifications (MSG91)
```
Create SMS notification service for web users:

Note: SMS sending should be done via Cloud Functions, not directly from app.

1. Create Firebase Cloud Function: sendSMS
   - Receives: phone, message, templateId
   - Calls MSG91 API
   - Returns success/failure

2. Create /src/services/notifications/sms.ts
   - sendSMS(phone, templateType, variables)
   - Template types:
     - OTP
     - BOOKING_CONFIRMED
     - BOOKING_REMINDER
     - PAYMENT_RECEIVED
     - SUBSCRIPTION_EXPIRY

3. Update notification sending logic:
   - Check user's platform (mobile/web)
   - If mobile: Send push notification
   - If web: Send SMS + in-app notification

4. Create SMS templates in MSG91 dashboard:
   - Booking confirmation template
   - Reminder template
   - Payment template
```

#### Prompt 37: Review System
```
Create review system:

/src/screens/user/WriteReviewScreen.tsx
- Star rating (1-5) - tap to select
- Written review text input
- Optional: Add photos
- Submit button
- Can only review after completing a booking

/src/components/ReviewCard.tsx
- User name and avatar
- Star rating display
- Review text
- Date
- Manager response (if any)
- Helpful count

/src/screens/user/TurfReviewsScreen.tsx
- Average rating display
- Rating breakdown (5-star, 4-star, etc.)
- Filter by rating
- Sort by: Most recent, Most helpful
- List of all reviews

/src/screens/manager/ReviewManagementScreen.tsx
- List of reviews for manager's turfs
- "Respond" button for each review
- Response text input
- Flag inappropriate reviews

/src/services/firebase/collections/reviews.ts
- createReview(data)
- getReviewsByTurf(turfId)
- addManagerResponse(reviewId, response)
- flagReview(reviewId, reason)
```

---

### 🗓️ WEEK 14.5: Academy System

#### Prompt 38: Academy Management Screens
```
Create academy management for manager:

/src/screens/manager/academy/AcademyListScreen.tsx
- List of all academies
- Each item shows:
  - Academy name
  - Days (Mon, Wed, Fri etc.)
  - Time slot
  - Contract end date
  - Payment status
- "Add Academy" floating button
- Tap to view details

/src/screens/manager/academy/AcademyDetailScreen.tsx
- Full academy details
- Upcoming sessions list
- Payment history
- "Cancel Session" action per session
- "Renew Contract" button
- "End Academy" button
```

#### Prompt 39: Add Academy Form
```
Create add academy form:

/src/screens/manager/academy/AddAcademyScreen.tsx

Step 1 - Basic Details:
- Academy/Batch name
- Contact person name
- Contact phone

Step 2 - Schedule:
- Select ground
- Select sport
- Select days of week (multi-select: Mon, Tue, Wed, etc.)
- Select time range (start time - end time)

Step 3 - Contract:
- Contract duration: 1 month, 2 months, 3 months
- Start date picker
- Auto-calculate end date

Step 4 - Payment:
- Total contract amount
- Payment received (cash)
- Payment received (online)
- Payment due date

Step 5 - Review & Create:
- Show all details
- "Create Academy" button
- On create:
  - Save to academies collection
  - Auto-generate all sessions
  - Block slots in availability check

/src/services/firebase/collections/academies.ts
- createAcademy(data)
- generateAcademySessions(academyId, schedule, dateRange)
- getAcademiesByCompany(companyId)
```

#### Prompt 40: Academy Session Management
```
Implement academy session management:

/src/services/firebase/collections/academySessions.ts
- getSessionsByAcademy(academyId)
- getSessionsByDate(turfId, groundId, date)
- cancelSession(sessionId, reason)
- When session cancelled:
  - Update session status to 'cancelled'
  - Slot becomes available for regular booking

Update availability checking:
/src/utils/availability.ts
- checkSlotAvailability() now also checks academy_sessions
- If blocked by academy, return:
  { available: false, conflictType: 'academy', academyName: '...' }

Update calendar view:
- Show academy sessions in orange color
- Different from regular bookings (blue)
- Shows academy name on hover/tap

Update booking flow:
- If user selects time blocked by academy:
  - Show message: "Reserved for [Academy Name]"
  - Disable booking for that slot
```

#### Prompt 41: Academy Renewal System
```
Implement academy renewal system:

/src/services/firebase/collections/academies.ts
- checkExpiringAcademies() - finds academies expiring in 5 days
- renewAcademy(academyId, newEndDate, paymentDetails)
- On renewal:
  - Update endDate
  - Generate new sessions for extended period
  - Update payment records

/src/components/manager/AcademyRenewalCard.tsx
- Shows in manager dashboard
- Academy name
- Expiry date
- "Renew Now" button

/src/screens/manager/academy/RenewAcademyScreen.tsx
- Current contract details
- New duration selection
- New payment details
- "Renew" button

Cloud Function (already created):
- sendAcademyRenewalReminders - runs daily at 9 AM
- Sends notification 5 days before expiry
```

---

### 🗓️ WEEK 15: Subscription System

#### Prompt 42: Subscription Management
```
Create subscription management for manager:

/src/screens/manager/SubscriptionScreen.tsx
- Current plan display:
  - Status (trial/active/grace_period/expired)
  - Subscription end date
  - Number of grounds
  - Monthly cost
- If trial: Days remaining in trial
- If grace_period: Warning banner with days remaining
- If expired: Turfs deactivated message

/src/components/manager/SubscriptionCard.tsx
- Visual card showing subscription status
- Progress bar for trial/grace period

/src/screens/manager/SubscriptionPaymentScreen.tsx
- Plan breakdown:
  - ₹299 × number of grounds
  - Volume discount if applicable
  - Final amount
- Payment options (Razorpay)
- On successful payment:
  - Update subscription status to 'active'
  - Set new end date (1 month from now)
  - Reactivate turfs if they were deactivated
```

#### Prompt 43: Trial & Grace Period Logic
```
Implement subscription lifecycle:

/src/services/subscription/lifecycle.ts

1. startFreeTrial(companyId):
   - Set status: 'trial'
   - Set trialEndDate: 30 days from now
   - Set subscriptionEndDate: same as trialEndDate

2. checkSubscriptionStatus(companyId):
   - If trial and past trialEndDate -> move to grace_period
   - If active and past subscriptionEndDate -> move to grace_period
   - If grace_period and past gracePeriodEndDate -> move to expired
   - Return current status

3. activateSubscription(companyId, paymentDetails):
   - Set status: 'active'
   - Set subscriptionEndDate: 1 month from payment
   - Clear grace period dates
   - Reactivate turfs

4. deactivateTurfs(companyId):
   - Set all turfs isActive: false
   - Users can't see or book these turfs

5. reactivateTurfs(companyId):
   - Set all turfs isActive: true

Cloud Function handles automatic transitions (already created in Week 9).
```

---

### 🗓️ WEEK 16: Admin Panel

#### Prompt 44: Admin Dashboard
```
Create admin dashboard:

/src/screens/admin/DashboardScreen.tsx

Platform Overview Cards:
- Total Companies
- Total Turfs
- Total Grounds
- Active Subscriptions
- Total Revenue (platform)
- Total Users

Charts:
- New signups trend (line chart)
- Revenue trend (line chart)
- Subscription status breakdown (pie chart)

Quick Actions:
- "Manage Companies" button
- "Manage Subscriptions" button
- "View Reports" button
- "System Logs" button

Recent Activity:
- Latest company registrations
- Latest subscription payments
- Latest support tickets
```

#### Prompt 45: Company Management (Admin)
```
Create company management for admin:

/src/screens/admin/CompaniesScreen.tsx
- List of all companies
- Search by name, manager name
- Filter by subscription status
- Each item shows:
  - Company name
  - Manager name & phone
  - Number of turfs/grounds
  - Subscription status
  - Monthly revenue

/src/screens/admin/CompanyDetailScreen.tsx
- Full company details
- All turfs list
- Subscription history
- Payment history
- Manager contact
- Actions:
  - "Edit Subscription" button
  - "Deactivate Company" button
  - "Contact Manager" button
```

#### Prompt 46: Manual Subscription Management (Admin)
```
Create manual subscription management for admin:

/src/screens/admin/EditSubscriptionScreen.tsx
- Company details display
- Current subscription status
- Editable fields:
  - Status dropdown (trial, active, grace_period, expired)
  - Subscription end date picker
  - Notes field
- "Update Subscription" button
- Audit log of changes

Use cases:
- Extend trial for promising companies
- Grant free months for feedback/referrals
- Fix payment issues manually
- Handle special enterprise deals

/src/services/firebase/collections/subscriptionAudit.ts
- logSubscriptionChange(companyId, changes, adminId, reason)
- getAuditLog(companyId)
```

#### Prompt 47: Admin Reports & System Logs
```
Create admin reports and system logs:

/src/screens/admin/ReportsScreen.tsx
- Date range picker
- Report types:
  - Revenue report (total, by company)
  - Signup report (new companies, conversion rate)
  - Subscription report (active, churned, trial)
- Export to Excel
- Email report option

/src/screens/admin/SystemLogsScreen.tsx
- Real-time log viewer
- Filter by:
  - Log level (info, warning, error)
  - Service (auth, booking, payment, notification)
  - Date range
- Search logs
- Export logs

/src/services/firebase/collections/systemLogs.ts
- getLogs(filters)
- createLog(level, service, message, metadata)

Add logging throughout the app:
- Auth events (login, logout, failed attempts)
- Booking events (created, confirmed, cancelled)
- Payment events (success, failure, refund)
- Error events (API failures, crashes)
```

---

### 🗓️ WEEK 17-18: Testing & Bug Fixes

#### Prompt 48: Testing Setup
```
Setup testing infrastructure:

1. Install testing dependencies:
   npm install --save-dev jest @testing-library/react-native @testing-library/jest-native

2. Create /src/__tests__/ folder structure:
   /src/__tests__/
     /components/
     /screens/
     /services/
     /utils/
     /integration/

3. Create test utilities:
   /src/__tests__/utils/testUtils.tsx
   - renderWithProviders() - wraps component with Redux, Navigation
   - mockFirebase() - mock Firebase calls
   - createMockUser(), createMockBooking(), etc.

4. Create sample tests:
   /src/__tests__/utils/pricing.test.ts
   - Test calculateBookingPrice for various scenarios
   - Test time period detection
   - Test weekday/weekend pricing

   /src/__tests__/components/BookingCalendar.test.tsx
   - Test date selection
   - Test availability colors
   - Test disabled dates
```

#### Prompt 49: Critical Flow Tests
```
Create integration tests for critical flows:

/src/__tests__/integration/bookingFlow.test.ts
Test complete booking flow:
1. User selects turf
2. User selects date, sport, time
3. User confirms booking
4. Booking created with pending status
5. Manager approves
6. Booking status changes to confirmed
7. User receives notification

/src/__tests__/integration/paymentFlow.test.ts
Test payment flow:
1. User initiates payment
2. Razorpay checkout opens
3. Payment successful
4. Booking updated with payment details
5. Receipt generated

/src/__tests__/integration/negotiationFlow.test.ts
Test chat negotiation:
1. User sends negotiation card
2. Manager receives notification
3. Manager counters
4. User accepts counter
5. Booking created at negotiated price
6. Other negotiations for same slot expire

Run tests: npm test
```

#### Prompt 50: Bug Fixing Checklist
```
Create comprehensive bug fixing checklist and fix identified issues:

Review and fix these common issues:

1. Race Conditions:
   - Double booking prevention working?
   - Negotiation expiry on slot booking?
   - Payment status updates atomic?

2. Edge Cases:
   - Booking at midnight (date boundary)
   - Booking across time periods (afternoon to evening)
   - Extension when next slot is academy session
   - Refund calculation at exact boundaries

3. UI/UX Issues:
   - Loading states on all async operations
   - Error messages user-friendly
   - Empty states for lists
   - Pull-to-refresh working
   - Keyboard avoiding views

4. Performance:
   - List virtualization (FlatList)
   - Image optimization
   - Query pagination
   - Redux state normalized

5. Security:
   - Firestore rules tested
   - Phone number validation
   - Input sanitization
   - Payment verification

Create /docs/TESTING_CHECKLIST.md with all test cases.
```

---

### 🗓️ WEEK 19: Web Version & Polish

#### Prompt 51: Web Responsiveness
```
Ensure web version is fully responsive:

1. Create /src/utils/responsive.ts
   - useResponsive() hook
   - Returns: { isMobile, isTablet, isDesktop, screenWidth }

2. Update layouts for web:
   - Navigation: Side drawer on desktop, bottom tabs on mobile
   - Lists: Grid layout on desktop, single column on mobile
   - Forms: Two-column on desktop, single column on mobile
   - Modals: Centered dialogs on desktop, full screen on mobile

3. Update key screens:
   - HomeScreen: Grid of turf cards on desktop
   - BookingScreen: Side-by-side calendar and slots on desktop
   - ChatScreen: Three-panel layout on desktop (list, chat, details)
   - AnalyticsScreen: Dashboard grid on desktop

4. Test on:
   - Chrome, Firefox, Safari
   - Mobile browsers
   - Different screen sizes (320px to 1920px)

5. Fix web-specific issues:
   - Hover states
   - Cursor changes
   - Keyboard navigation
   - Focus indicators
```

#### Prompt 52: UI Polish & States
```
Add polish to all screens:

1. Loading States:
   Create /src/components/common/LoadingState.tsx
   - Skeleton loaders for lists
   - Spinner for buttons
   - Full screen loading overlay

2. Error States:
   Create /src/components/common/ErrorState.tsx
   - Error icon
   - Error message
   - "Retry" button
   - "Go Back" button

3. Empty States:
   Create /src/components/common/EmptyState.tsx
   - Illustration
   - Message
   - Action button (if applicable)
   - Examples:
     - "No bookings yet" with "Book Now" button
     - "No turfs found" with "Adjust Filters" button
     - "No messages" with illustration

4. Success States:
   Create /src/components/common/SuccessAnimation.tsx
   - Lottie animation
   - Success message
   - Auto-dismiss or action button

5. Implement throughout app:
   - Every list should have empty state
   - Every API call should have loading/error handling
   - Every form submission should show loading
```

#### Prompt 53: Final Testing Checklist
```
Create and execute final testing checklist:

/docs/FINAL_TESTING.md

## User Flows
- [ ] Sign up with new phone number
- [ ] Search and filter turfs
- [ ] Complete booking flow
- [ ] Cancel booking and receive refund
- [ ] Write review
- [ ] Chat with manager
- [ ] Negotiate price

## Manager Flows
- [ ] Register company and turf
- [ ] Approve/reject bookings
- [ ] Create manual booking
- [ ] Block slots
- [ ] Create academy
- [ ] Cancel academy session
- [ ] View analytics and export
- [ ] Manage subscription

## Caretaker Flows
- [ ] View today's bookings (full details)
- [ ] View future bookings (limited details)
- [ ] Collect payment
- [ ] Extend time
- [ ] Report maintenance issue

## Admin Flows
- [ ] View platform dashboard
- [ ] Manage companies
- [ ] Update subscriptions manually
- [ ] View reports

## Edge Cases
- [ ] Offline behavior
- [ ] Slow network
- [ ] Session expiry
- [ ] Concurrent bookings
- [ ] Payment failures

Execute all tests on iOS, Android, and Web.
```

---

### 🗓️ WEEK 20: Deployment

#### Prompt 54: Production Build Setup
```
Setup production builds:

1. Create production Firebase project:
   - New project: turf-management-prod
   - Enable all required services
   - Setup Firestore indexes
   - Deploy Cloud Functions
   - Configure Firebase rules

2. Setup EAS Build:
   npm install -g eas-cli
   eas login
   eas build:configure

3. Create /eas.json:
   {
     "build": {
       "production": {
         "env": {
           "FIREBASE_API_KEY": "...",
           ...
         }
       }
     }
   }

4. Create production builds:
   eas build --platform ios --profile production
   eas build --platform android --profile production

5. Setup app signing:
   - iOS: Apple Developer certificates
   - Android: Upload key to Play Console

6. Test production builds on real devices.
```

#### Prompt 55: App Store Submission
```
Prepare and submit to app stores:

1. App Store (iOS):
   - Create app in App Store Connect
   - Fill app information:
     - Name: TurfBook (or your chosen name)
     - Subtitle
     - Description
     - Keywords
     - Screenshots (all device sizes)
     - App preview video (optional)
   - Privacy policy URL
   - Support URL
   - Age rating questionnaire
   - Upload build via EAS or Transporter
   - Submit for review

2. Play Store (Android):
   - Create app in Google Play Console
   - Fill store listing:
     - Title
     - Short description
     - Full description
     - Screenshots
     - Feature graphic
   - Content rating questionnaire
   - Privacy policy
   - Upload AAB file
   - Submit for review

3. Create assets:
   /assets/store/
   - icon-1024.png (App Store)
   - feature-graphic.png (Play Store)
   - screenshots/ (all sizes)
   - preview-video.mp4 (optional)

4. Write compelling store descriptions.
```

#### Prompt 56: Web Deployment & Monitoring
```
Deploy web version and setup monitoring:

1. Deploy to Firebase Hosting:
   npx expo export:web
   firebase deploy --only hosting

   OR

   Deploy to Vercel:
   - Connect GitHub repo
   - Configure build settings
   - Deploy

2. Setup custom domain:
   - Add domain in Firebase/Vercel
   - Update DNS records
   - Enable SSL

3. Setup error monitoring (Sentry):
   npm install @sentry/react-native
   
   Create /src/services/monitoring/sentry.ts
   - Initialize Sentry
   - Configure error boundaries
   - Track performance

4. Setup analytics:
   - Firebase Analytics (mobile)
   - Google Analytics (web)
   - Track key events:
     - Screen views
     - Booking completed
     - Payment successful
     - User signup

5. Create /docs/DEPLOYMENT.md with:
   - All deployment URLs
   - Environment variables
   - Deployment commands
   - Rollback procedures
```

#### Prompt 57: Documentation & Launch
```
Create final documentation and launch:

1. User Documentation:
   /docs/USER_GUIDE.md
   - How to book a turf
   - How to cancel booking
   - How to write review
   - FAQs

2. Manager Documentation:
   /docs/MANAGER_GUIDE.md
   - How to register turf
   - How to manage bookings
   - How to use analytics
   - How to manage academy
   - Subscription management

3. Technical Documentation:
   /docs/TECHNICAL.md
   - Architecture overview
   - Database schema
   - API documentation
   - Cloud Functions
   - Deployment guide

4. Create README.md:
   - Project overview
   - Tech stack
   - Setup instructions
   - Environment variables
   - Deployment commands

5. Launch checklist:
   - [ ] All tests passing
   - [ ] Production Firebase configured
   - [ ] Apps approved on stores
   - [ ] Web deployed and working
   - [ ] Monitoring configured
   - [ ] Documentation complete
   - [ ] Support email setup
   - [ ] Social media accounts ready

🚀 LAUNCH!
```

---

## 💡 TIPS FOR USING CLAUDE CODE EFFECTIVELY

### Best Practices

1. **One prompt at a time**: Don't combine multiple prompts. Complete one, verify it works, then move to next.

2. **Review generated code**: Always read through the code Claude generates. Understand it before moving forward.

3. **Test frequently**: After each prompt, run the app and test the new feature.

4. **Ask for explanations**: If you don't understand something, ask Claude to explain:
```
   Explain how the availability checking function works step by step.
```

5. **Fix errors immediately**: If you see an error, tell Claude:
```
   I'm getting this error: [paste error]. Please fix it.
```

6. **Iterate on UI**: If UI doesn't look right:
```
   The booking card looks too cramped. Add more padding and spacing.
```

### Common Commands in Claude Code
```
# Start development server
npx expo start

# Run on iOS simulator
npx expo run:ios

# Run on Android emulator
npx expo run:android

# Run on web
npx expo start --web

# Install a package
npm install [package-name]

# Run tests
npm test

# Build for production
eas build --platform all
```

### If You Get Stuck

Tell Claude:
```
I'm stuck on [feature]. The current code is doing [X] but I expect [Y]. 
Here's the error/behavior I see: [describe]
Please help me debug and fix this.