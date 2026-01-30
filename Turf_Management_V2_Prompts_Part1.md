# 🏟️ TURF MANAGEMENT SYSTEM V2 - DEVELOPMENT PROMPTS (Part 1)

## 📋 Overview

This document contains **57 detailed prompts** organized by week to help you build the Turf Management System V2 using Claude Code. Each prompt includes:
- Clear objectives
- Specific implementation requirements
- Testable checkpoints
- Reference to the master plan sections

---

## 🔑 KEY CHANGES IN V2

Before starting development, understand these critical V2 changes:

1. **4-Tier Hierarchy**: Owner → Manager → Caretaker → User
2. **Owner Entity**: Business owners who create companies and manage subscriptions
3. **Invite Code System**: Managers and Caretakers join via invite codes
4. **Operational Permissions**: Owners can optionally do manager tasks
5. **Caretaker Assignment**: Caretakers wait for assignment after joining
6. **Suspension System**: 30-day deletion after suspension
7. **Multiple Owners**: One company can have multiple owners

---

## 📚 HOW TO USE THESE PROMPTS

### With Claude Code:
1. Copy the prompt for your current development stage
2. Paste it into Claude Code
3. Wait for implementation
4. Test using the checkpoint criteria
5. Fix any issues before moving to the next prompt

### Best Practices:
- Complete each prompt fully before moving on
- Test thoroughly at each checkpoint
- Keep the master plan document handy for reference
- Use error handling prompts if you encounter issues

---

# PHASE 1: FOUNDATION & MVP (Weeks 1-12)

---

## WEEK 1-2: PROJECT SETUP & AUTHENTICATION

### Prompt 1: Project Initialization
```
I'm building a Turf Management System using React Native Expo with Firebase backend. This is a multi-tenant sports turf booking platform with a 4-tier hierarchy: Owner → Manager → Caretaker → User.

Please help me initialize the project with the following requirements:

**Tech Stack:**
- React Native Expo (iOS, Android, Web)
- JavaScript (NOT TypeScript)
- Firebase (Firestore, Authentication, Storage, Cloud Functions, FCM)
- Redux Toolkit with RTK Query
- React Native Paper for UI
- React Navigation v6

**Tasks:**
1. Initialize Expo project with blank template
2. Install and configure all required dependencies:
   - Firebase SDK (@react-native-firebase packages or firebase web SDK for Expo)
   - React Navigation (native, stack, bottom-tabs)
   - Redux Toolkit
   - React Native Paper
   - expo-image-picker
   - expo-location
   - Other necessary Expo packages

3. Create the folder structure as per the master plan:
   src/
   ├── api/firebase/
   ├── components/common/
   ├── screens/auth/
   ├── screens/user/
   ├── screens/owner/
   ├── screens/manager/
   ├── screens/caretaker/
   ├── screens/admin/
   ├── navigation/
   ├── store/slices/
   ├── hooks/
   ├── utils/
   ├── constants/
   ├── theme/
   └── assets/

4. Create configuration files:
   - app.json with proper Expo config
   - babel.config.js
   - .env file structure for environment variables

5. Create constants files:
   - src/constants/roles.js (user, owner, manager, caretaker, admin)
   - src/constants/colors.js (app theme colors)
   - src/constants/config.js (Firebase config placeholder)

**Checkpoint:** 
- Project runs with `npx expo start`
- All dependencies install without errors
- Folder structure is created correctly
```

---

### Prompt 2: Firebase Configuration
```
Now let's configure Firebase for our Turf Management System.

**Requirements:**
1. Create src/api/firebase/config.js with:
   - Firebase initialization using environment variables
   - Export auth, firestore, storage instances
   - Support for both development and production environments

2. Create src/api/firebase/auth.js with these functions:
   - sendOTP(phoneNumber) - Send OTP via Firebase Phone Auth
   - verifyOTP(verificationId, otp) - Verify OTP and return user
   - signOut() - Sign out current user
   - getCurrentUser() - Get current authenticated user
   - onAuthStateChanged(callback) - Listen to auth state changes

3. Create src/api/firebase/firestore.js with generic CRUD:
   - createDocument(collection, data) - Auto-generate ID
   - createDocumentWithId(collection, id, data) - Custom ID
   - getDocument(collection, id)
   - updateDocument(collection, id, data)
   - deleteDocument(collection, id)
   - queryDocuments(collection, conditions, orderBy, limit)
   - listenToDocument(collection, id, callback)
   - listenToQuery(collection, conditions, callback)

4. Create src/api/firebase/storage.js with:
   - uploadImage(uri, path) - Upload image and return download URL
   - deleteImage(path)
   - getImageUrl(path)

**Firebase Project Setup Instructions:**
- Create a new Firebase project
- Enable Phone Authentication
- Create Firestore database (start in test mode)
- Enable Storage
- Get configuration keys

**Checkpoint:**
- Firebase initializes without errors
- Can send test OTP (use Firebase test phone numbers)
- Firestore read/write works
```

---

### Prompt 3: Redux Store Setup
```
Set up Redux Toolkit store for state management in our Turf Management System.

**Requirements:**
1. Create src/store/store.js:
   - Configure store with all slices
   - Add Redux Persist for auth state persistence
   - Configure middleware

2. Create the following slices in src/store/slices/:

   a) authSlice.js:
   - State: user, isAuthenticated, isLoading, error, role
   - Actions: setUser, setRole, logout, setLoading, setError
   - Handle: user | owner | manager | caretaker | admin roles

   b) userSlice.js:
   - State: profile, bookings, favorites
   - Actions: setProfile, addBooking, updateBooking, setFavorites

   c) ownerSlice.js (NEW for V2):
   - State: company, turfs, managers, caretakers, subscription
   - Actions: setCompany, addTurf, updateTurf, setManagers, setCaretakers

   d) companySlice.js (NEW for V2):
   - State: currentCompany, inviteCode, stats
   - Actions: setCompany, updateInviteCode, updateStats

   e) turfSlice.js:
   - State: turfs, selectedTurf, grounds
   - Actions: setTurfs, selectTurf, updateTurf

   f) bookingSlice.js:
   - State: bookings, pendingBookings, selectedBooking
   - Actions: setBookings, addBooking, updateBookingStatus

   g) chatSlice.js:
   - State: chats, activeChat, messages, unreadCount
   - Actions: setChats, setActiveChat, addMessage, markAsRead

   h) notificationSlice.js:
   - State: notifications, unreadCount
   - Actions: setNotifications, addNotification, markAsRead

3. Create src/store/middleware/firestoreMiddleware.js:
   - Handle Firestore sync actions
   - Log state changes in development

4. Wrap App.js with Redux Provider

**Checkpoint:**
- Redux DevTools shows all slices
- State persists after app restart (auth slice)
- Actions dispatch correctly
```

---

### Prompt 4: Navigation Setup with Role-Based Routing
```
Create the complete navigation structure for our 4-tier role system.

**Requirements:**
1. Create src/navigation/AppNavigator.js:
   - Root navigator that checks auth state
   - Routes to AuthNavigator or role-specific navigator
   - Handles deep linking setup

2. Create src/navigation/AuthNavigator.js with screens:
   - SplashScreen
   - WelcomeScreen
   - LoginScreen
   - OTPVerificationScreen
   - RoleSelectionScreen
   - ProfileSetupScreen
   - JoinCompanyScreen (for manager/caretaker)
   - OwnerSetupScreen (company creation)

3. Create src/navigation/UserNavigator.js (Bottom Tabs):
   - Home (turf discovery)
   - Bookings (booking history)
   - Chat (chat list)
   - Profile

4. Create src/navigation/OwnerNavigator.js (Bottom Tabs) - NEW:
   - Dashboard (company-wide stats)
   - Turfs (turf management)
   - Team (managers & caretakers)
   - Settings (subscription, company settings)

5. Create src/navigation/ManagerNavigator.js (Bottom Tabs):
   - Dashboard (turf-level stats)
   - Bookings (pending/confirmed)
   - Chat
   - More (settings, academy, expenses)

6. Create src/navigation/CaretakerNavigator.js:
   - Calendar (today's bookings)
   - History (past bookings)
   - Profile
   - Note: Show "Waiting for Assignment" screen if unassigned

7. Create src/navigation/AdminNavigator.js:
   - Dashboard
   - Companies
   - Subscriptions
   - Settings

8. Create navigation helper function:
   function getNavigatorForRole(role, isAssigned = true) {
     switch(role) {
       case 'user': return UserNavigator;
       case 'owner': return OwnerNavigator;
       case 'manager': return ManagerNavigator;
       case 'caretaker': return isAssigned ? CaretakerNavigator : WaitingScreen;
       case 'admin': return AdminNavigator;
     }
   }

**Checkpoint:**
- Navigation works for all 5 roles
- Bottom tabs display correctly per role
- Auth flow redirects properly
- Deep linking works (test with expo-linking)
```

---

### Prompt 5: Common UI Components
```
Create reusable UI components for consistent design across the app.

**Requirements:**
Create the following in src/components/common/:

1. Button.js:
   - Variants: primary, secondary, outline, text, danger
   - Props: title, onPress, loading, disabled, icon, fullWidth
   - Use React Native Paper as base

2. Input.js:
   - Support for: text, phone, email, password, multiline
   - Props: label, value, onChange, error, placeholder, leftIcon, rightIcon
   - Phone input with country code picker (+91 default)

3. Card.js:
   - Elevated card with shadow
   - Props: children, onPress, style, elevation

4. LoadingSpinner.js:
   - Full screen loading overlay
   - Props: visible, message

5. ErrorBoundary.js:
   - Catch and display errors gracefully
   - Retry button

6. EmptyState.js:
   - Display when lists are empty
   - Props: icon, title, description, actionLabel, onAction

7. ConfirmDialog.js:
   - Modal confirmation dialog
   - Props: visible, title, message, onConfirm, onCancel, confirmText, cancelText, danger

8. Avatar.js:
   - User profile picture with fallback
   - Props: uri, name, size (small, medium, large)

9. Badge.js:
   - Status badge
   - Props: status (success, warning, error, info), text

10. OTPInput.js:
    - 6-digit OTP input with auto-focus
    - Props: value, onChange, length, autoFocus

11. PhoneInput.js:
    - Phone number input with country code
    - Props: value, onChange, error

12. ImagePicker.js:
    - Select image from camera or gallery
    - Props: value, onChange, label, multiple

**Theme Setup:**
Create src/theme/theme.js with:
- Colors (primary, secondary, background, surface, error, etc.)
- Typography (heading, body, caption sizes)
- Spacing (xs, sm, md, lg, xl)
- Border radius values

Create src/theme/globalStyles.js with common style objects

**Checkpoint:**
- All components render without errors
- Theme colors apply correctly
- Components work on iOS, Android, and Web
```

---

### Prompt 6: Login & OTP Verification Screens
```
Create the authentication screens for phone-based login.

**Requirements:**

1. Create src/screens/auth/SplashScreen.js:
   - App logo centered
   - Loading indicator
   - Auto-navigate after 2 seconds based on auth state
   - Check if user exists in Firestore after Firebase auth

2. Create src/screens/auth/WelcomeScreen.js:
   - App branding/logo
   - "Login" button
   - "Sign Up" button (both go to same LoginScreen)
   - Brief feature highlights

3. Create src/screens/auth/LoginScreen.js:
   - Phone number input with +91 country code
   - Validation: 10-digit Indian phone number
   - "Send OTP" button
   - Firebase Phone Authentication integration
   - Handle errors (invalid number, too many requests)
   - Loading state while sending OTP
   - Use FirebaseRecaptchaVerifierModal for web

4. Create src/screens/auth/OTPVerificationScreen.js:
   - Display entered phone number (masked: +91 98***43210)
   - 6-digit OTP input (auto-focus, auto-submit on complete)
   - 60-second countdown timer
   - "Resend OTP" button (enabled after countdown)
   - "Change Number" link to go back
   - Verify OTP with Firebase
   - On success:
     - Check if user exists in Firestore
     - If exists: Navigate to role-based dashboard
     - If new: Navigate to RoleSelectionScreen
   - Handle errors (invalid OTP, expired OTP)

**Implementation Notes:**
- Use useRef for verification ID storage
- Implement proper error handling
- Show toast/snackbar for errors
- Test with Firebase test phone numbers during development

**Checkpoint:**
- OTP sends successfully to valid Indian phone numbers
- OTP verification works correctly
- Timer counts down properly
- Resend OTP works after countdown
- Error messages display appropriately
- Existing users navigate to their dashboard
- New users navigate to role selection
```

---

### Prompt 7: Role Selection & Profile Setup
```
Create the role selection and initial profile setup screens for new users.

**Requirements:**

1. Create src/screens/auth/RoleSelectionScreen.js:
   - Four role options with icons:
     - "I am a User" (Customer) - People icon
     - "I am a Turf Owner" - Building icon (NEW in V2)
     - "I am a Manager" - Briefcase icon
     - "I am a Caretaker" - Tools icon
   - Each option shows brief description
   - On selection, navigate to ProfileSetupScreen with role param
   - Store selected role temporarily

2. Create src/screens/auth/ProfileSetupScreen.js:
   - Profile picture upload (optional)
   - Name input (required)
   - Email input (optional but validated)
   - Based on role:
     - User: Save to Firestore → Navigate to UserDashboard
     - Owner: Navigate to OwnerSetupScreen
     - Manager: Navigate to JoinCompanyScreen
     - Caretaker: Navigate to JoinCompanyScreen
   
   - Create user document in Firestore with structure:
   {
     userId: auth.uid,
     phone: phoneNumber,
     name: name,
     email: email,
     profilePicture: imageUrl || null,
     role: selectedRole,
     createdAt: serverTimestamp(),
     lastLoginAt: serverTimestamp(),
     isActive: true,
     isSuspended: false,
     fcmTokens: []
   }

3. Add role-specific fields based on selection:
   - For 'user': favorites: []
   - For 'owner': companyId: null, hasOperationalPermissions: false, managedTurfIds: []
   - For 'manager': companyId: null, assignedTurfIds: [], selectedTurfId: null
   - For 'caretaker': companyId: null, assignedTurfId: null, isAssigned: false

**Checkpoint:**
- Role selection works correctly
- Profile picture uploads to Firebase Storage
- User document creates in Firestore
- Navigation flows correctly based on role
- Form validation works (required fields)
```

---

### Prompt 8: Owner Registration - Company Setup (NEW V2)
```
Create the Owner registration flow with company creation.

**Requirements:**

1. Create src/screens/auth/OwnerSetupScreen.js:
   Multi-step form with the following sections:

   **Step 1: Personal Preferences**
   - Checkbox: "I want to manage day-to-day operations"
     - Help text: "Enable this to approve bookings, handle chats, etc."
     - If checked, can later select specific turfs or "All Turfs"
   - This sets hasOperationalPermissions in user document

   **Step 2: Company Information**
   - Company Name (required)
   - Company Logo (image upload)
   - Company Description
   - Company Phone (pre-filled with owner's phone)
   - Company Email (pre-filled with owner's email)

   **Step 3: Business Details**
   - GST Number (optional, validated format)
   - PAN Number (optional, validated format)

   **On Submit:**
   - Generate unique 8-character invite code (e.g., "GREEN123")
   - Use Firestore batch write to create:
   
   a) Company document:
   {
     companyId: auto-generated,
     name: companyName,
     ownerUserIds: [userId], // Array for multiple owners
     phone: companyPhone,
     email: companyEmail,
     logo: logoUrl,
     description: description,
     gstNumber: gstNumber,
     panNumber: panNumber,
     inviteCode: {
       code: generatedCode,
       link: `https://turfbooking.app/join/${generatedCode}`,
       createdAt: serverTimestamp(),
       lastChangedAt: serverTimestamp(),
       lastChangedBy: userId
     },
     subscription: {
       status: 'trial',
       trialStartDate: serverTimestamp(),
       trialEndDate: // 30 days from now,
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
   }
   
   b) Update user document:
   {
     role: 'owner',
     companyId: companyRef.id,
     hasOperationalPermissions: checked,
     managedTurfIds: [] // Empty = all turfs
   }

2. Create invite code generator function in src/utils/inviteCodeUtils.js:
   function generateInviteCode() {
     // Generate 8-character alphanumeric code
     // Must be unique (check against existing codes)
   }

3. Navigate to OwnerDashboard on success

**Checkpoint:**
- Company creates successfully in Firestore
- Invite code generates correctly (8 chars, alphanumeric)
- User document updates with companyId
- Batch write is atomic (all or nothing)
- Trial subscription starts automatically (30 days)
- Owner navigates to dashboard
```

---

### Prompt 9: Manager/Caretaker Join Company Flow (NEW V2)
```
Create the invite code system for Managers and Caretakers to join companies.

**Requirements:**

1. Create src/screens/auth/JoinCompanyScreen.js:
   
   **UI Elements:**
   - Heading: "Join a Company"
   - Subtitle: "Enter the invite code shared by your turf owner"
   - Text input for invite code (8 characters, auto-capitalize)
   - "Validate Code" button
   - OR divider
   - "Paste Invite Link" option
   
   **Flow:**
   
   a) Validate Invite Code:
   - Query companies where inviteCode.code == entered code
   - If found: Show company details (name, logo)
   - If not found: Show error "Invalid invite code"
   
   b) For Manager role:
   - After validation, fetch all turfs for this company
   - Show turf selection list (multi-select)
   - Require at least one turf selection
   - Help text: "Owner can modify your turf assignments later"
   
   c) For Caretaker role:
   - Show info: "After joining, you'll be in 'Waiting for Assignment' status"
   - Show info: "A manager or owner will assign you to a specific turf"
   - No turf selection (assignment happens later)
   
   d) "Join Company" button:
   
   **For Manager:**
   // Batch write:
   // 1. Update user document
   {
     companyId: company.id,
     assignedTurfIds: selectedTurfs,
     selectedTurfId: selectedTurfs[0],
     isActive: true,
     isSuspended: false
   }
   
   // 2. Add to company.managers array
   arrayUnion(userId)
   
   // 3. Add to each selected turf's managerIds
   for each turfId: arrayUnion(userId)
   
   **For Caretaker:**
   // Batch write:
   // 1. Update user document
   {
     companyId: company.id,
     assignedTurfId: null,
     isAssigned: false,
     isActive: true,
     isSuspended: false
   }
   
   // 2. Add to company.caretakers array
   arrayUnion(userId)
   
   // 3. Add to company.unassignedCaretakers array
   arrayUnion(userId)

2. Handle deep link for invite:
   - URL format: https://turfbooking.app/join/GREEN123
   - Parse code from URL and auto-fill

3. Error handling:
   - Invalid code
   - Company has no turfs (for managers)
   - Network errors

**Checkpoint:**
- Invite code validation works
- Company details display on valid code
- Manager can select multiple turfs
- Caretaker joins as unassigned
- Batch writes are atomic
- Error messages display correctly
- Navigation to respective dashboards works
```

---

### Prompt 10: Firestore Security Rules
```
Create comprehensive Firestore security rules for the 4-tier role system.

**Requirements:**

Create firestore.rules file with:

1. Helper functions:
   - isSignedIn()
   - getUserData()
   - isUser() / isOwner() / isManager() / isCaretaker() / isAdmin()
   - belongsToCompany(companyId)
   - isCompanyOwner(companyId)
   - hasOperationalPermissions()
   - canManageTurf(turfId) - Check if manager is assigned OR owner has permissions

2. Collection rules:

   a) users/
   - Read: Any signed-in user
   - Create: Only self (auth.uid == userId)
   - Update: Self OR admin OR owner (for suspension)
   - Delete: Self OR admin

   b) companies/
   - Read: Any signed-in user
   - Create: Only owners
   - Update: Company owners OR admin
   - Delete: Admin only

   c) turfs/
   - Read: Public (for user discovery)
   - Create: Company owner only
   - Update: Owner OR assigned manager OR owner with operational permissions
   - Delete: Owner OR admin

   d) bookings/
   - Read: Own bookings OR company staff
   - Create: Any signed-in user
   - Update: Owner booking OR manager OR caretaker (for payment/attendance)
   - Delete: Admin only

   e) chats/ and messages subcollection:
   - Read: Participant (user) OR company staff (managers)
   - Create: Signed-in users
   - Update: Participants only

   f) reviews/
   - Read: Public
   - Create: Users with completed booking
   - Update: Owner of review OR manager (for response)
   - Delete: Owner of review OR admin

   g) academies/ and academy_sessions/
   - Read: Company staff + users (to see blocked slots)
   - Create: Manager OR owner with operational permissions
   - Update: Manager OR owner with operational permissions
   - Delete: Manager OR owner with operational permissions

   h) analytics/
   - Read: Manager OR owner of company
   - Write: Cloud Functions only

   i) admin_logs/ and owner_logs/
   - Read: Admin (admin_logs) OR company owner (owner_logs)
   - Create: Respective roles
   - Update/Delete: None

**Checkpoint:**
- Deploy rules: `firebase deploy --only firestore:rules`
- Test each rule with Firebase emulator
- Verify owners can't access other companies
- Verify managers can only access assigned turfs
- Verify caretakers can only access their assigned turf
```

---

## WEEK 3-4: OWNER - COMPANY & TURF MANAGEMENT

### Prompt 11: Owner Dashboard Screen
```
Create the Owner Dashboard with company-wide statistics and overview.

**Requirements:**

Create src/screens/owner/OwnerDashboardScreen.js:

1. **Header Section:**
   - Company logo and name
   - Subscription status badge (Trial/Active/Expired)
   - Days remaining in trial/subscription
   - Quick action: "Add Turf" button

2. **KPI Cards Row (Company-wide stats):**
   - Total Revenue (₹) - with trend percentage
   - Total Bookings - with trend percentage
   - Active Turfs - count
   - Active Managers - count
   - Utilization Rate (%) - average across all turfs

3. **Quick Stats Section:**
   - Today's Bookings count
   - Pending Approvals count (if hasOperationalPermissions)
   - Unassigned Caretakers count
   - Unread Messages (if hasOperationalPermissions)

4. **Recent Activity List:**
   - Show last 5 activities:
     - New bookings
     - Manager joined
     - Caretaker assigned
     - Payments received
   - Each item shows: activity type, time ago, details

5. **Navigation Cards:**
   - "Manage Turfs" → TurfManagementScreen
   - "Manage Team" → Team management
   - "View Analytics" → Detailed analytics
   - "Subscription" → Subscription management

6. **Data Fetching:**
   - Listen to company document for real-time updates
   - Aggregate stats from analytics collection
   - Show loading state while fetching

7. **Pull to Refresh:**
   - Implement RefreshControl

**Checkpoint:**
- Dashboard loads without errors
- Stats display correctly (even with 0 values)
- Real-time updates work
- Pull to refresh works
- Navigation to all sections works
- Subscription status shows correctly (Trial with days remaining)
```

---

### Prompt 12: Turf Management Screens (Owner)
```
Create the turf listing and management screens for owners.

**Requirements:**

1. Create src/screens/owner/TurfManagementScreen.js:
   
   **UI:**
   - List of all turfs owned by company
   - Each turf card shows:
     - Cover image
     - Name
     - Location (city)
     - Total grounds
     - Active status (green/red badge)
     - Managers assigned count
     - Quick stats: Today's bookings, Revenue this month
   - FAB: "Add New Turf"
   - Search/filter by name, city
   - Sort by: Name, Revenue, Bookings

   **Actions per turf:**
   - Tap: View turf details
   - Long press: Quick actions menu (Edit, View Analytics, Deactivate)

2. Create src/screens/owner/AddTurfScreen.js:
   
   Multi-step wizard:

   **Step 1: Basic Details**
   - Turf Name (required)
   - Description
   - Cover Image upload
   - Additional Images (up to 5)

   **Step 2: Location**
   - Address line
   - City (required)
   - State
   - Pincode
   - Google Maps integration:
     - Search by address
     - Pick location on map
     - Auto-fill coordinates
   - Google Maps link generation

   **Step 3: Operating Hours**
   - For each day (Mon-Sun):
     - Toggle: Open/Closed
     - If open: Start time, End time
   - "Copy to all days" option for convenience

   **Step 4: Grounds Setup**
   - "Add Ground" button
   - For each ground:
     - Ground Name (e.g., "Ground-1")
     - Sports available (multi-select: cricket, football, badminton, etc.)
     - Amenities (floodlights, changing room, parking, etc.)
   - Can add multiple grounds

   **Step 5: Pricing**
   - For each ground → each sport:
     - Weekday pricing:
       - Morning (time range + hourly rate)
       - Afternoon (time range + hourly rate)
       - Evening (time range + hourly rate)
     - Weekend pricing (same structure)
   - Or "All Day" single rate option
   - Price preview showing different scenarios

   **On Submit:**
   - Create turf document with all data
   - Update company stats (totalTurfs, totalGrounds)
   - Generate QR codes (global and turf-specific)
   - Navigate to TurfManagementScreen

3. Create src/screens/owner/EditTurfScreen.js:
   - Same structure as AddTurfScreen
   - Pre-fill existing data
   - Track changes
   - Update document on save

**Checkpoint:**
- Turf list displays correctly
- Add turf wizard completes all steps
- Google Maps location picker works
- Multiple grounds can be added
- Pricing per sport per time slot works
- Edit turf updates correctly
- QR codes generate
- Company stats update
```

---

*Continue to Part 2 for Prompts 13-36*
