# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Turf-1701 is a multi-role turf (sports ground) management mobile application built with React Native + Expo and Firebase backend. It supports 5 user roles: user, caretaker, manager, owner, and admin — each with distinct navigation flows, screens, and permissions.

## Development Commands

```bash
# Start Expo dev server
npx expo start

# Run on specific platform
npx expo run:android
npx expo run:ios
npx expo start --web

# Firebase Cloud Functions
cd functions && npm run serve    # Local emulator
cd functions && npm run deploy   # Deploy functions
cd functions && npm run logs     # View function logs
```

There is no test runner or linter configured in this project.

## Architecture

### Role-Based Navigation (src/navigation/)

`RootNavigator` is the top-level router. It checks auth state and user role, then delegates to one of:
- `AuthNavigator` — Login → OTP → Role selection → Profile setup flow
- `UserNavigator` — Bottom tabs: Home, Search, Bookings, Chat, Profile
- `ManagerNavigator` — Bottom tabs: Dashboard, Bookings, Calendar, Chat, Settings
- `OwnerNavigator` — Bottom tabs: Dashboard, Turfs, Team, Settings
- `CaretakerNavigator` — Bottom tabs: Dashboard, Calendar, Profile (checks turf assignment first)

Each role navigator uses a Tab Navigator nested inside a Stack Navigator. Tab screens are the primary views; stack screens are modal/detail overlays pushed on top.

### State Management (src/store/)

Redux Toolkit with 4 slices:
- `authSlice` — User profile, auth state, role
- `bookingSlice` — Booking data
- `companySlice` — Company/organization data
- `ownerSlice` — Owner-specific operations

Access via `useAppDispatch()` and `useAppSelector()` hooks.

### Firebase Services Layer (src/services/firebase/)

All Firestore operations go through service modules, not called directly from screens:
- `firestore.js` — Generic CRUD: `getDocument`, `addDocument`, `updateDocument`, `queryDocuments`, `subscribeToDocument`
- `booking.js` — Slot management, booking creation, cancellation
- `chat.js` — Real-time messaging and price negotiation cards
- `payments.js` — UPI payment verification and status tracking
- `subscriptionPayments.js` — Subscription tier handling
- `reviews.js` — Review CRUD
- `expenses.js` — Expense tracking

**Cross-platform pattern:** Services detect `Platform.OS === "web"` to switch between Firebase Modular SDK (web) and React Native Firebase (native). The `config.js` file initializes the appropriate SDK.

### Cloud Functions (functions/)

Node 20 runtime. Key functions handle:
- Slot lock expiration (`releaseExpiredSlotLocks`)
- Payment timeouts and reminders (`checkPaymentTimeouts`, `sendPaymentVerificationReminders`)
- Booking/negotiation lifecycle notifications (`onBookingStatusChange`, `onNegotiationStatusChange`)
- Daily cleanup of expired negotiations (scheduled at 3 AM IST)
- Maintenance log notifications

### Custom Hooks (src/hooks/)

- `useAuth()` — Auth state, user data, role checks; subscribes to auth changes and fetches company data
- `useChat()` / `useUserChats()` / `useCompanyChats()` — Chat operations with real-time Firestore listeners
- `usePermissions()` — Role-based permission checking using role hierarchy
- `useSelectedTurf()` — Tracks which turf is selected (manager/caretaker context)
- `useNotifications()` — Push notification setup and handling

### Role Hierarchy (src/constants/roles.js)

```
user < caretaker < manager < owner < admin
```

Owner, manager, and caretaker roles require company association. Manager and caretaker must join via invite code.

### Key Business Logic in Utils (src/utils/)

- `priceUtils.js` — Complex pricing calculations with taxes/discounts
- `slotLockUtils.js` — Slot locking mechanism to prevent double-booking
- `upiUtils.js` — UPI payment URL formatting and validation
- `subscriptionPricing.js` — Subscription tier pricing
- `inviteCodeUtils.js` — Invite code generation and validation

## Conventions

- **Screens:** PascalCase with `Screen` suffix (e.g., `HomeScreen.js`), organized by role under `src/screens/{role}/`
- **Components:** PascalCase in `src/components/`, grouped by domain (booking/, chat/, turf/, caretaker/)
- **Hooks:** `use` prefix, camelCase (e.g., `useAuth.js`)
- **Services:** camelCase (e.g., `firestore.js`)
- **Screen structure:** hooks → state → effects → handlers → render
- **Firebase project ID:** sowin-power
- **Expo project:** com.tanmaydevil.Turf1701

## Important Notes

- Firestore security rules (`firestore.rules`) are currently permissive (allow all reads/writes for authenticated users) — not production-ready
- Firebase config values are in `src/services/firebase/config.js` (not env vars)
- The app uses React Navigation v6 with `@react-navigation/stack`, `@react-navigation/bottom-tabs`
- UI framework is `react-native-paper` (Material Design) with `@expo/vector-icons` (MaterialCommunityIcons)
- New Architecture and edge-to-edge mode are enabled in app.json
