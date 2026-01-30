# 🏟️ TURF MANAGEMENT SYSTEM V2 - DEVELOPMENT PROMPTS (Part 2)

## Prompts 13-36: Weeks 3-11

---

### Prompt 13: Turf Pricing Configuration Component
```
Create a reusable pricing configuration component for turfs.

**Requirements:**

Create src/components/turf/PricingConfigurator.js:

1. **Input Props:**
   - grounds: Array of ground objects with sports
   - initialPricing: Existing pricing data (for edit mode)
   - onChange: Callback with updated pricing

2. **UI Structure:**
   
   Tab navigation for each ground:
   [Ground-1] [Ground-2] [Ground-3]
   
   For selected ground, show sport tabs:
   [Cricket] [Football] [Badminton]
   
   For selected sport, show pricing form:
   
   Weekday Pricing:
   - Morning: Time range picker (06:00 to 10:00) + Hourly Rate input
   - Afternoon: Time range picker (10:00 to 18:00) + Hourly Rate input
   - Evening: Time range picker (18:00 to 23:00) + Hourly Rate input
   
   Weekend Pricing (similar structure)

3. **Features:**
   - Time pickers for slot ranges
   - Currency input with ₹ formatting
   - "Copy weekday to weekend" checkbox
   - "Copy to all sports" option
   - Validation: No time gaps, rates > 0
   - Preview calculator: "2 hours on Saturday evening = ₹3000"

4. **Output Format:**
   {
     "ground-1": {
       cricket: {
         weekday: {
           morning: { start: "06:00", end: "10:00", hourlyRate: 1000 },
           afternoon: { start: "10:00", end: "18:00", hourlyRate: 800 },
           evening: { start: "18:00", end: "23:00", hourlyRate: 1500 }
         },
         weekend: { /* same structure */ }
       },
       football: { /* same structure */ }
     },
     "ground-2": { /* ... */ }
   }

**Checkpoint:**
- Component renders for multiple grounds
- Sport tabs switch correctly
- Time pickers work
- Pricing saves in correct format
- Copy functions work
- Preview calculator accurate
```

---

### Prompt 14: Invite Code Management (Owner)
```
Create the invite code management screen for owners.

**Requirements:**

Create src/screens/owner/InviteCodeScreen.js:

1. **Display Current Code:**
   - Large, prominent display of current code (e.g., "GREEN123")
   - "Copy Code" button with success feedback
   - Show invite link: https://turfbooking.app/join/GREEN123
   - "Copy Link" button
   - "Share" button (opens native share sheet)

2. **QR Code Display:**
   - Generate QR code for the invite link using react-native-qrcode-svg
   - "Download QR" option (save to device)
   - "Print QR" option

3. **Code Statistics:**
   - Total managers joined using this code
   - Total caretakers joined using this code
   - Last used date

4. **Regenerate Code:**
   - "Regenerate Code" button
   - Confirmation dialog: "This will invalidate the current code. Anyone with the old code won't be able to join. Proceed?"
   - Generate new unique 8-character code
   - Update company document:
     {
       'inviteCode.code': newCode,
       'inviteCode.link': newLink,
       'inviteCode.lastChangedAt': serverTimestamp(),
       'inviteCode.lastChangedBy': ownerId
     }
   - Log action in owner_logs collection

5. **Instructions Section:**
   - "How to invite Managers" - step by step
   - "How to invite Caretakers" - step by step
   - What happens when they join

**Helper Functions in src/utils/inviteCodeUtils.js:**
   - generateUniqueInviteCode() - 8 alphanumeric chars, check uniqueness
   - checkCodeExists(code) - query companies
   - generateInviteQRCode(link) - return QR component

**Checkpoint:**
- Current code displays correctly
- Copy functions work with feedback
- Share sheet opens
- QR code generates and displays
- Regenerate creates new unique code
- Old code becomes invalid immediately
- Action logged in owner_logs
```

---

### Prompt 15: Manager Management Screen (Owner)
```
Create the manager management screen for owners to view, modify, and suspend managers.

**Requirements:**

Create src/screens/owner/ManagerManagementScreen.js:

1. **Manager List:**
   - Show all managers in the company (from company.managers array)
   - Each card displays:
     - Profile picture / avatar with fallback
     - Name
     - Phone number
     - Status badge (Active = green, Suspended = red)
     - Assigned turfs count
     - Joined date (relative: "Joined 2 weeks ago")
   - Search by name/phone
   - Filter tabs: All, Active, Suspended

2. **Manager Card Actions:**
   - Tap card: View manager details modal
   - "Edit Turfs" button
   - "Suspend" button (for active) / "Reinstate" button (for suspended)

3. **View Manager Details Modal:**
   - Full profile information
   - List of assigned turfs with names
   - Performance stats (if available from analytics):
     - Bookings handled this month
     - Revenue generated
   - Action buttons at bottom

4. **Edit Turf Assignments Modal:**
   - Show all company turfs as checkboxes
   - Pre-select currently assigned turfs
   - Require at least one selection
   - On save (batch write):
     - Remove manager from old turfs' managerIds
     - Add manager to new turfs' managerIds
     - Update user's assignedTurfIds and selectedTurfId
     - Log action in owner_logs

5. **Suspend Manager Flow:**
   - Tap "Suspend" button
   - Confirmation dialog with reason input (required)
   - On confirm (batch write):
     - Update user document:
       {
         isSuspended: true,
         suspendedAt: serverTimestamp(),
         suspendedBy: ownerId,
         suspensionReason: reason,
         canBeDeletedAfter: Timestamp 30 days from now
       }
     - Log in owner_logs:
       {
         companyId,
         performedBy: ownerId,
         performedByRole: 'owner',
         action: 'manager_suspended',
         targetType: 'user',
         targetId: managerId,
         details: { reason },
         timestamp: serverTimestamp()
       }
   - Show message: "Manager suspended. They will lose access immediately. Account can be permanently deleted after 30 days."

6. **Reinstate Manager Flow:**
   - Confirmation dialog
   - Clear suspension fields (isSuspended: false, suspendedAt: null, etc.)
   - Log action in owner_logs

7. **Empty State:**
   - If no managers: "No managers yet"
   - Show invite code and "Share Invite Code" button

**Checkpoint:**
- Manager list displays correctly with all info
- Search and filter work
- Turf assignment editing works with batch write
- Suspension flow works completely
- Reinstate flow works
- All actions logged in owner_logs
- Suspended managers immediately can't access app
```

---

### Prompt 16: Caretaker Management Screen (Owner with Operational Permissions)
```
Create the caretaker management screen for owners.

**Requirements:**

Create src/screens/owner/CaretakerManagementScreen.js:

1. **Access Control:**
   - First check: if (!user.hasOperationalPermissions)
   - Show message: "Enable operational permissions in settings to manage caretakers"
   - Button: "Go to Settings" → navigates to OperationalSettingsScreen
   - If has permissions, show full screen

2. **Caretaker Sections:**

   **Section 1: Unassigned Caretakers**
   - Header: "Waiting for Assignment (3)"
   - Collapsible section
   - List from company.unassignedCaretakers
   - Each card shows:
     - Avatar, Name, Phone
     - Joined date
     - "Assign to Turf" button
   - Empty state: "No caretakers waiting for assignment"

   **Section 2: Assigned Caretakers**
   - Header: "Active Caretakers (5)"
   - Grouped by turf (collapsible groups)
   - Each card shows:
     - Avatar, Name, Phone
     - Assigned turf name
     - Assigned date
     - Status badge
   - Actions: "Reassign", "Unassign", "Suspend"

3. **Assign Caretaker Modal:**
   - Caretaker info at top
   - Turf selection dropdown (show all company turfs)
   - Note: "One caretaker is typically assigned to one turf"
   - "Assign" button
   - On assign (batch write):
     - Update caretaker: { assignedTurfId: turfId, isAssigned: true }
     - Add to turf: { caretakerIds: arrayUnion(caretakerId) }
     - Remove from company: { unassignedCaretakers: arrayRemove(caretakerId) }
     - Log in owner_logs

4. **Reassign Caretaker:**
   - Same modal as assign
   - On reassign:
     - Remove from old turf's caretakerIds
     - Add to new turf's caretakerIds
     - Update caretaker's assignedTurfId
     - Log action

5. **Unassign Caretaker:**
   - Confirmation: "This will remove the caretaker from their turf. They will see 'Waiting for Assignment' screen."
   - On confirm:
     - Update caretaker: { assignedTurfId: null, isAssigned: false }
     - Remove from turf's caretakerIds
     - Add to company's unassignedCaretakers
     - Log action

6. **Suspend Caretaker:**
   - Same flow as manager suspension
   - Also unassign from turf if assigned
   - Remove from company.caretakers and company.unassignedCaretakers

7. **Reinstate Caretaker:**
   - Clear suspension fields
   - Add back to company.caretakers and company.unassignedCaretakers
   - Status: unassigned (needs to be reassigned)

**Checkpoint:**
- Access control works correctly
- Unassigned section displays correctly
- Assignment works with all document updates
- Reassignment works
- Unassignment works
- Suspension works (including unassign)
- Reinstate works
- All actions logged in owner_logs
```

---

### Prompt 17: Owner Operational Settings Screen
```
Create the operational permissions settings screen for owners.

**Requirements:**

Create src/screens/owner/OperationalSettingsScreen.js:

1. **Header:**
   - Title: "Operational Permissions"
   - Subtitle: "Control your involvement in day-to-day operations"

2. **Main Toggle:**
   - Large switch: "Enable Operational Permissions"
   - Description below: "When enabled, you can:"
     - Approve and reject booking requests
     - Respond to customer chats
     - Create and manage academies
     - Block time slots
     - Assign caretakers to turfs
     - Track expenses (add/edit)

3. **Turf Selection (shown only when toggle is ON):**
   - Section header: "Select turfs to manage"
   - Radio options:
     - "All turfs" (default, recommended)
     - "Specific turfs only"
   - If "Specific turfs" selected:
     - Show list of turfs with checkboxes
     - At least one must be selected
     - Validation error if none selected

4. **Permission Preview Table:**
   Show comparison table:
   
   | Feature | Without Permissions | With Permissions |
   |---------|--------------------|--------------------|
   | View Company Analytics | ✅ Full | ✅ Full |
   | View Booking Details | Aggregated only | ✅ Full access |
   | Approve/Reject Bookings | ❌ | ✅ |
   | Respond to Chats | ❌ | ✅ |
   | Create Academies | ❌ | ✅ |
   | Block Slots | ❌ | ✅ |
   | Assign Caretakers | ❌ | ✅ |
   | Track Expenses | View only | ✅ Add/Edit |
   | Manage Managers | ✅ Always | ✅ Always |
   | Manage Subscription | ✅ Always | ✅ Always |

5. **Save Button:**
   - "Save Settings" button at bottom
   - On save:
     - Update user document:
       {
         hasOperationalPermissions: boolean,
         managedTurfIds: selectedTurfs // empty array = all turfs
       }
     - Show success toast: "Settings saved successfully"

**Create Custom Hook: src/hooks/usePermissions.js**

export function usePermissions() {
  const user = useSelector(state => state.auth.user);
  
  const canApproveBookings = () => {
    if (user.role === 'manager') return true;
    if (user.role === 'owner' && user.hasOperationalPermissions) return true;
    return false;
  };
  
  const canManageTurf = (turfId) => {
    if (user.role === 'manager') {
      return user.assignedTurfIds?.includes(turfId);
    }
    if (user.role === 'owner' && user.hasOperationalPermissions) {
      return user.managedTurfIds?.length === 0 || user.managedTurfIds?.includes(turfId);
    }
    return false;
  };
  
  const canAccessChat = () => {
    return user.role === 'manager' || 
           (user.role === 'owner' && user.hasOperationalPermissions);
  };
  
  const canCreateAcademy = () => {
    return user.role === 'manager' || 
           (user.role === 'owner' && user.hasOperationalPermissions);
  };
  
  return { canApproveBookings, canManageTurf, canAccessChat, canCreateAcademy };
}

**Checkpoint:**
- Toggle works correctly
- Turf selection appears/hides based on toggle
- User document updates correctly
- Permission hook works throughout app
```

---

### Prompt 18: User Home Screen with Turf Discovery
```
Create the user home screen with turf search and discovery features.

**Requirements:**

Create src/screens/user/HomeScreen.js:

1. **Header Section:**
   - Greeting: "Hello, {userName}!"
   - Location indicator: "📍 Mumbai"
   - Notification bell icon with badge

2. **Search Bar:**
   - Placeholder: "Search turfs, sports, locations..."
   - On focus: Show recent searches

3. **Quick Filters (Horizontal ScrollView):**
   - Chips: All, Cricket, Football, Badminton, Tennis, etc.
   - Tap to filter turfs by sport

4. **Turf Cards:**
   - Toggle: Grid view / List view
   - FlatList with pagination
   - Each card: Cover image, Name, Location, Rating, Starting price, Sports
   - Tap: Navigate to TurfDetailScreen

5. **Filter Modal:**
   - Price range slider
   - Sports (multi-select)
   - Amenities (multi-select)
   - Rating (minimum)
   - Distance (maximum)

6. **Data Fetching:**
   - Query: turfs where isActive == true
   - Pagination (10 per page)
   - Pull to refresh

**Checkpoint:**
- Home screen loads turfs
- Search works correctly
- Sport filters work
- Pagination loads more turfs
- Navigation to turf details works
```

---

### Prompt 19: Turf Detail Screen
```
Create the turf detail screen showing all turf information.

**Requirements:**

Create src/screens/user/TurfDetailScreen.js:

1. **Image Gallery:** Full-width carousel of turf images
2. **Basic Info:** Turf name, Location, Rating, Operating hours
3. **Grounds Section:** List of grounds with sports and amenities
4. **Pricing Preview:** Sample prices table
5. **Amenities Section:** Grid of amenities with icons
6. **Location Section:** Map preview, Address, "Get Directions"
7. **Reviews Section:** Average rating, Recent reviews, "See All"
8. **Bottom CTA:** Fixed "Check Availability" button
9. **Actions:** Share turf, Add to favorites

**Checkpoint:**
- All sections display correctly
- Image gallery works
- Maps integration works
- Navigation to booking works
```

---

### Prompt 20: Booking Screen - Date & Sport Selection (Sport-First Flow)
```
Create the booking screen implementing the V2 sport-first booking flow.

**Requirements:**

Create src/screens/user/BookingScreen.js:

**The V2 booking flow is: Date → Sport → Time Range → View ALL Grounds**

**Step 1: Date Selection**
- Calendar showing next 45 days
- Color coding: Past (Grey), Available (Green), Partial (Yellow), Fully booked (Red)

**Step 2: Sport Selection**
- Show all sports available at this turf
- Display as cards with icons
- Single selection

**Step 3: Time Range Selection**
- BookMyShow-style time slot picker
- 30-minute intervals
- Show prices and availability status
- User selects START and END time
- Minimum 1 hour

**Step 4: Ground Selection (KEY V2 FEATURE)**
- Show ALL grounds that support selected sport
- For EACH ground simultaneously display:
  - Availability status
  - Calculated price
  - Price breakdown
- User taps desired available ground

**Checkpoint:**
- Calendar displays correctly
- Sport selection works
- Time slot picker works
- All grounds display with prices
- Price calculation accurate
```

---

### Prompt 21: Booking Confirmation with 5-Second Dialog
```
Create the booking confirmation flow with the 5-second confirmation dialog.

**Requirements:**

**Step 5: Booking Summary**
- Summary Card with all details
- Price breakdown
- Special requests input
- Cancellation policy

**5-Second Confirmation Dialog:**
Create src/components/booking/ConfirmationDialog.js:
- Modal with summary
- Circular progress (5 seconds)
- "Cancel" and "Confirm Now" buttons
- Button enabled only after 5 seconds

**On Confirm:**
- Verify slot still available (Firebase Transaction)
- Create booking document with status: 'pending'
- Handle race condition
- Navigate to confirmation screen

**Checkpoint:**
- Summary displays all details
- 5-second countdown works
- Booking creates correctly
- Race condition handled
```

---

### Prompt 22: Price Calculation Engine
```
Create the comprehensive pricing calculation utility.

**Requirements:**

Create src/utils/priceUtils.js:

1. **calculateBookingPrice(ground, sport, date, startTime, endTime)**
   - Determine weekday/weekend
   - Break time into pricing periods
   - Calculate price for each period
   - Return total and breakdown

2. **breakdownTimeIntoSlots(startTime, endTime, dayPricing)**
   - Handle cross-period bookings (e.g., afternoon to evening)
   - Return array of slot details with rates

3. **Helper Functions:**
   - isWeekend(dateStr)
   - timeToMinutes(timeStr)
   - minutesToTime(minutes)
   - calculateDuration(startTime, endTime)

4. **calculateExtensionPrice(originalBooking, extensionMinutes)**
   - Calculate price for extension period only

5. **formatPrice(amount)** - Format as ₹1,500
6. **formatDuration(hours)** - Format as "2h" or "1h 30m"

**Checkpoint:**
- Single period calculation works
- Cross- calculations accurate
- Weekend detection works
- Extension calculation works
```

---

### Prompt 23: User Booking History Screen
```
Create the booking history screen for users.

**Requirements:**

Create src/screens/user/BookingHistoryScreen.js:

1. **Tab Navigation:** Upcoming, Completed, Cancelled
2. **Booking List:** Real-time updates, sorted by date
3. **Booking Card Component:** Status badges, actions
4. **Booking Details Modal:** Full information, status timeline
5. **Actions:** Cancel booking, Write Review, Contact Turf
6. **Cancel Booking Flow:** Refund policy display, confirmation, document update

**Checkpoint:**
- All tabs work correctly
- Cancel flow works with refund calculation
- Review prompt shows for completed bookings
```

---

### Prompt 24: Manager Dashboard Screen
```
Create the manager dashboard with turf-level statistics.

**Requirements:**

Create src/screens/manager/ManagerDashboardScreen.js:

1. **Turf Selector:** Dropdown for assigned turfs (if multiple)
2. **Today's Overview:** Current/next booking highlight
3. **KPI Cards:** Pending Requests, Today's Revenue, Week's Bookings, Utilization
4. **Quick Actions Grid:** Approve, Calendar, Academy, Block, Expenses, Assign Caretaker
5. **Pending Bookings Preview:** First 3 with quick approve/reject
6. **Recent Activity Feed:** Last 5 activities

**Checkpoint:**
- Turf selector works and persists
- All KPIs display correctly
- Quick actions navigate properly
- Real-time updates work
```

---

### Prompt 25: Manager Turf Selection Screen
```
Create the turf selection screen for managers assigned to multiple turfs.

**Requirements:**

Create src/screens/manager/TurfSelectionScreen.js:

1. Show all turfs in manager's assignedTurfIds
2. Each card shows: image, name, location, today's stats
3. Selection updates user.selectedTurfId
4. Auto-skip if only one turf assigned

**Create Custom Hook: src/hooks/useSelectedTurf.js**
- Listen to selected turf document
- Provide changeTurf function
- Return turf data, isLoading, hasMultipleTurfs

**Checkpoint:**
- Shows only assigned turfs
- Selection updates user document
- Auto-skip with single turf
- Hook provides turf data throughout app
```

---

### Prompt 26: Booking Management Screen (Pending Requests)
```
Create the booking management screen for approving/rejecting booking requests.

**Requirements:**

Create src/screens/manager/BookingManagementScreen.js:

1. **Tabs:** Pending (with count badge), Confirmed, Completed, Cancelled
2. **Pending Booking Card:** Customer info, booking details, quick actions
3. **Approve Flow:** 
   - Use Firebase Transaction
   - Check for conflicts (other bookings, academy sessions)
   - Create confirmed booking
   - Handle SLOT_TAKEN error
4. **Reject Flow:** Require reason, update status
5. **Conflict Detection:** Show warning for overlapping pending requests
6. **Filters:** Date range, Sport, Ground

**Checkpoint:**
- Approve uses transaction for race condition
- Transaction catches conflicts
- Reject requires reason
- Conflict warning shows
- All tabs filter correctly
```

---

### Prompt 27: Manager Calendar View Screen
```
Create the calendar view showing all bookings and availability.

**Requirements:**

Create src/screens/manager/CalendarViewScreen.js:

1. **Views:** Month, Week, Day (default)
2. **Booking Display:** Colored blocks with customer info
3. **Color Coding:**
   - Pending: Yellow
   - Confirmed: Blue
   - In Progress: Green
   - Completed: Grey
   - Academy: Orange
   - Blocked: Grey striped
4. **Quick Actions:** Create booking, View details on tap
5. **Ground Filter:** All grounds or specific ground
6. **Legend:** Color coding explanation

**Checkpoint:**
- All three views work
- Bookings display with correct colors
- Academy sessions show distinctly
- Quick actions work
```

---

### Prompt 28: Manual Booking Creation (Manager)
```
Create the manual/offline booking creation feature for managers.

**Requirements:**

Create src/screens/manager/CreateBookingScreen.js:

1. **Customer Details:** Phone input with auto-search existing users
2. **Booking Details:** Ground, Sport, Date, Time selection
3. **Booking Type:** Regular, Tournament, Offline
4. **Payment Section:** Advance toggle, payment method
5. **Create Booking:** Status = 'confirmed' (skip pending)
6. **For New Customers:** Create minimal user document

**Checkpoint:**
- Existing customer detection works
- Price calculation accurate
- Booking status is 'confirmed' (not pending)
- Manager can add notes
```

---

### Prompt 29: Slot Blocking Feature (Manager)
```
Create the slot blocking feature for maintenance, private events, etc.

**Requirements:**

Create src/screens/manager/BlockSlotsScreen.js:

1. **Block Types:** Single Day, Date Range, Recurring
2. **Block Form:** Date(s), Ground, Time range, Reason
3. **Visual Preview:** Calendar with highlighted blocks
4. **Conflict Check:** Show existing bookings in range, options to handle
5. **Create Block:** Create blocked_slots document
6. **View/Delete Blocks:** List existing, unblock option
7. **Integration:** Update checkGroundAvailability to include blocks

**Checkpoint:**
- All block types work
- Conflict detection shows existing bookings
- Blocks appear in calendar
- User booking excludes blocked slots
```

---

### Prompt 30: Chat System Architecture
```
Create the chat system infrastructure for user-company communication.

**Requirements:**

1. **Create src/api/firebase/chat.js:**
   - getOrCreateChat(userId, companyId)
   - sendMessage(chatId, message)
   - sendNegotiationCard(chatId, negotiationData)
   - updateNegotiationStatus(chatId, messageId, status)
   - markAsRead(chatId, userId)
   - listenToMessages(chatId, callback)
   - listenToUserChats(userId, callback)
   - listenToCompanyChats(companyId, callback)

2. **Create src/hooks/useChat.js:**
   - messages, isLoading
   - sendTextMessage, sendNegotiation

**Checkpoint:**
- Chat creation works
- Message sending works
- Real-time listening works
- Unread counts update
```

---

### Prompt 31: Chat List Screen
```
Create the chat list screens for both users and managers.

**Requirements:**

1. **User ChatListScreen:** List of chats with companies
2. **Manager ChatListScreen:** All company chats, negotiation indicators
3. **ChatListItem Component:** 
   - Avatar, name, last message preview
   - Timestamp, unread badge
   - Negotiation indicator icon
4. **Real-time Updates:** Firestore listeners

**Checkpoint:**
- User chat list shows companies
- Manager chat list shows users
- Unread badges show and update
- Navigation to ChatScreen works
```

---

### Prompt 32: Chat Screen with Messages
```
Create the main chat screen for messaging.

**Requirements:**

Create src/screens/ChatScreen.js:

1. **Header:** Avatar, Name, Call button (manager), Info button
2. **Messages List:** Inverted FlatList, grouped by date
3. **Message Types:** Text, Negotiation Card, Booking Card, Location
4. **Chat Input:** Text input, Send, Attachment, "Request Booking" (user)
5. **Mark as Read:** On screen open

**Checkpoint:**
- Messages display correctly by type
- Text messages send and appear immediately
- Input area works
- "Request Booking" button visible for users
```

---

### Prompt 33: Negotiation Card Component & Flow
```
Create the negotiation card system for price negotiations.

**Requirements:**

1. **NegotiationCard Component:** Display booking request with status
2. **NegotiationRequestModal (User):** Create booking request with proposed price
3. **Manager Response Actions:** Accept, Counter, Reject
4. **Accept Flow:**
   - Use Firebase Transaction
   - Check slot availability
   - Create booking with negotiated price
   - Update negotiation status
5. **Counter Flow:** Create new negotiation card with manager's price
6. **Reject Flow:** Update status with reason
7. **Expire Other Negotiations:** Cloud Function when slot booked

**Checkpoint:**
- User can create negotiation request
- Manager sees action buttons
- Accept creates booking with transaction
- Race condition handled
- Expired negotiations update
```

---

### Prompt 34: Quick Booking from Chat
```
Create the "Quick Book" feature for booking directly from chat.

**Requirements:**

1. **Quick Book Button:** In chat input area (user only)
2. **Quick Book Modal:** Simplified booking form (ground, sport, date, time)
3. **On Confirm:** Create pending booking, send message to chat
4. **Manager Quick Confirm:** Approve button on booking request message
5. **Location Share:** Manager can share turf location after confirmation

**Checkpoint:**
- Quick book modal works
- Creates pending booking
- Manager can approve from chat
- Location sharing works
```

---

### Prompt 35: Caretaker Dashboard & Assignment Status
```
Create the caretaker dashboard with assignment-aware features.

**Requirements:**

1. **WaitingForAssignmentScreen.js:** (when isAssigned == false)
   - Friendly message explaining waiting status
   - Company name displayed
   - Refresh button to check status
   - Auto-redirect when assigned (real-time listener)

2. **CaretakerDashboardScreen.js:** (when isAssigned == true)
   - Assigned turf name
   - Today's bookings overview
   - Quick stats (completed, pending payment, total collection)
   - Today's earnings (cash vs online)
   - Quick actions
   - Upcoming booking cards

3. **Navigation Logic:** Check isAssigned before rendering

**Checkpoint:**
- Unassigned caretakers see waiting screen
- Assigned caretakers see dashboard
- Real-time assignment detection works
- Dashboard shows correct data
```

---

### Prompt 36: Caretaker Calendar with Time-Based Visibility
```
Create the caretaker calendar with restricted visibility for future dates.

**Requirements:**

Create src/screens/caretaker/CalendarScreen.js:

**KEY V2 FEATURE: Time-Based Visibility**

**For TODAY - Full Visibility:**
- Customer name and phone (with call button)
- Exact booking time
- Amount, sport, ground
- Action buttons: Mark Attendance, Collect Payment, Extend, No-Show

**For FUTURE DATES - Limited Visibility:**
- Customer name: Visible
- Phone: "🔒 Hidden"
- Time: "🔒 Hidden"
- Amount: Visible
- NO action buttons
- Info banner explaining restriction

**Implementation:**
- Week view with date selector
- Today highlighted
- Check isToday before rendering card type
- FullBookingCard vs LimitedBookingCard components

**Academy Sessions:**
- Orange color coding
- Show academy name
- No customer details

**Color Coding:**
- Confirmed: Blue
- In Progress: Green
- Completed: Grey
- No-Show: Red
- Academy: Orange

**Checkpoint:**
- Today shows full details
- Future shows limited details (phone/time hidden)
- Call button only for today
- Action buttons only for today
- Academy sessions display correctly
```

---

## 📋 PART 2 QUICK REFERENCE

### Prompts Covered:

| # | Prompt | Week |
|---|--------|------|
| 13 | Pricing Configurator | 3-4 |
| 14 | Invite Code Management | 3-4 |
| 15 | Manager Management | 3-4 |
| 16 | Caretaker Management | 3-4 |
| 17 | Operational Settings | 3-4 |
| 18 | User Home Screen | 5-6 |
| 19 | Turf Detail Screen | 5-6 |
| 20 | Booking Flow | 5-6 |
| 21 | Booking Confirmation | 5-6 |
| 22 | Price Calculation | 5-6 |
| 23 | Booking History | 5-6 |
| 24 | Manager Dashboard | 7-8 |
| 25 | Turf Selection | 7-8 |
| 26 | Booking Management | 7-8 |
| 27 | Calendar View | 7-8 |
| 28 | Manual Booking | 7-8 |
| 29 | Slot Blocking | 7-8 |
| 30 | Chat Architecture | 9-10 |
| 31 | Chat List Screen | 9-10 |
| 32 | Chat Screen | 9-10 |
| 33 | Negotiation Cards | 9-10 |
| 34 | Quick Booking | 9-10 |
| 35 | Caretaker Dashboard | 11 |
| 36 | Caretaker Calendar | 11 |

### Key Components Created:
- PricingConfigurator.js
- BookingCard.js
- NegotiationCard.js
- ChatListItem.js
- FullBookingCard.js
- LimitedBookingCard.js
- ConfirmationDialog.js

### Key Hooks Created:
- usePermissions.js
- useSelectedTurf.js
- useChat.js

### Key Utilities Created:
- priceUtils.js
- inviteCodeUtils.js

---

**Continue to Part 3 for Prompts 37-57**

**Document Version:** 2.0
**Part:** 2 of 3
