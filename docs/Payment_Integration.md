# Cashfree Payment Integration — Implementation Guide

> **Status:** Backend functions written. Frontend complete. API keys set. Ready for: `npm install` in functions/, Cloud Function deploy, webhook registration.

---

## What Was Built

### Files Created / Modified

| File | Status | Purpose |
|---|---|---|
| `functions/src/cashfreeFunctions.js` | ✅ Created | `createCashfreeOrder` callable + `cashfreeWebhook` HTTP function |
| `functions/index.js` | ✅ Updated | Exports the two new CF functions |
| `functions/package.json` | ✅ Updated | Added `axios` dependency |
| `functions/.env` | ✅ Created | API keys set (gitignored) |
| `functions/.env.example` | ✅ Created | Template for env file |
| `src/hooks/useCashfreePayment.js` | ✅ Created | Calls `createCashfreeOrder` via `firebase/functions` |
| `src/screens/user/CashfreePaymentScreen.js` | ✅ Created | WebView-based payment screen |
| `src/navigation/UserNavigator.js` | ✅ Updated | Registered `CashfreePayment` stack screen |
| `src/screens/user/BookingConfirmationScreen.js` | ✅ Updated | Routes to `CashfreePayment` instead of `UpiPayment` |

### Why WebView (not a native SDK)

The package name `cashfree-pg-react-native` does not exist on npm. Cashfree's React Native SDK was not published there. Instead, we use `react-native-webview` (already in the project) to load Cashfree's JS SDK inside the app. This:
- Requires zero new npm packages
- Requires no EAS rebuild
- Works with the current dev client
- Handles all UPI apps natively by intercepting `intent://` and `upi://` deep links

---

## Payment Flow (Implemented)

```
User taps "Proceed to Pay" → BookingConfirmationScreen
  ↓
createBookingWithTransaction() → Firestore booking (status: payment_pending, soft lock 10min)
  ↓
navigation.replace("CashfreePayment", { bookingId, amount, ... })
  ↓
CashfreePaymentScreen mounts
  → useCashfreePayment.createOrder() → firebase/functions httpsCallable
    → createCashfreeOrder Cloud Function
      → POST https://sandbox.cashfree.com/pg/orders
      → saves payment doc in Firestore payments/{paymentId}
      → stamps cashfreeOrderId on booking doc
      → returns { paymentSessionId, orderId }
  ↓
WebView loads with Cashfree JS SDK HTML
  → cashfree.checkout({ paymentSessionId, returnUrl: "https://payment-done.playgrid.local" })
  → Cashfree checkout UI renders
  ↓
User selects UPI app → intent:// URL fired
  → onShouldStartLoadWithRequest intercepts it
  → Linking.openURL() opens the native UPI app
  ↓
User pays in UPI app (GPay/PhonePe/Paytm) → returns to app
  ↓
Cashfree redirects WebView to https://payment-done.playgrid.local
  → handleCheckoutReturn() fires → phase = VERIFYING
  → starts Firestore real-time listener on bookings/{bookingId}
  ↓
Cashfree sends webhook → cashfreeWebhook Cloud Function
  → verifies HMAC-SHA256 signature
  → Firestore transaction:
    → payments/{id}: status = success
    → bookings/{id}: status = confirmed, paymentStatus = paid, slotLock released
  → sends FCM push notification to user
  ↓
Firestore listener in app fires
  → booking.status === "confirmed" → navigation.replace("BookingSuccess")
```

---

## Step-by-Step: What To Do Next

### Step 1 — Install dependencies in functions

```bash
cd functions
npm install
```

This installs `axios` which was added to `functions/package.json`.

### Step 2 — Deploy Cloud Functions

```bash
firebase deploy --only functions:createCashfreeOrder,functions:cashfreeWebhook
```

After deploy, your webhook URL will be:
```
https://us-central1-sowin-power.cloudfunctions.net/cashfreeWebhook
```

### Step 3 — Register Webhook URL in Cashfree Dashboard

1. Go to: https://merchant.cashfree.com/merchants/pg (sandbox: https://test.cashfree.com/)
2. Navigate to: **Developers → Webhooks**
3. Click **Add Webhook Endpoint**
4. URL: `https://us-central1-sowin-power.cloudfunctions.net/cashfreeWebhook`
5. Events to select:
   - `PAYMENT_SUCCESS_WEBHOOK`
   - `PAYMENT_FAILED_WEBHOOK`
   - `PAYMENT_USER_DROPPED_WEBHOOK`
6. Save

### Step 4 — Test the flow

Test UPI IDs (Cashfree sandbox):
| UPI ID | Result |
|---|---|
| `success@upi` | Payment succeeds |
| `failure@upi` | Payment fails |

1. Open the app, pick a turf with advance payment enabled
2. Select a slot → Booking Summary → "Proceed to Pay"
3. Cashfree checkout WebView opens
4. Enter test UPI: `success@upi`
5. Watch screen switch to "Verifying..."
6. Check Firebase Functions logs: `firebase functions:log --only cashfreeWebhook`
7. App should auto-navigate to Booking Success

---

## Architecture Notes

### Cloud Function Calling (No New Native Modules)

The hook uses `firebase/functions` from the web SDK (already installed as `firebase: "^12.8.0"`):
```js
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../services/firebase/config';

const functions = getFunctions(app);
const createCashfreeOrderFn = httpsCallable(functions, 'createCashfreeOrder');
```
This makes a standard HTTPS call — no `@react-native-firebase/functions` needed.

### WebView UPI Intent Handling

When Cashfree's checkout page fires a UPI deep link (`intent://`, `upi://`, etc.), the WebView's `onShouldStartLoadWithRequest` intercepts it:
```js
if (UPI_SCHEMES.some(s => url.startsWith(s))) {
  Linking.openURL(url); // opens GPay / PhonePe / Paytm natively
  return false;          // block WebView from trying to navigate
}
```

### Return URL Detection

After payment, Cashfree redirects to `returnUrl = "https://payment-done.playgrid.local"`. The WebView intercepts this:
```js
if (url.startsWith("https://payment-done.playgrid.local")) {
  handleCheckoutReturn(); // switch to VERIFYING phase + start Firestore listener
  return false;
}
```

### Webhook → Firestore → App confirmation

The app doesn't trust the WebView return alone — the Firestore listener on `bookings/{bookingId}` waits for `status === "confirmed"` which is only set after the `cashfreeWebhook` Cloud Function verifies the HMAC signature and confirms with Cashfree's servers. This prevents false confirmations.

### Slot Locking

| Event | Slot state |
|---|---|
| Booking created | `slotLock: { isLocked: true, lockType: "soft", lockExpiry: +10min }` |
| Webhook: PAID | `slotLock.isLocked = false`, booking → `confirmed` |
| Webhook: FAILED/EXPIRED | `slotLock.isLocked = false`, booking → `cancelled` |
| Timer expires (missed webhook) | Existing `releaseExpiredSlotLocks` scheduled function cleans up |

---

## Checklist

### Backend
- [x] `cashfreeFunctions.js` — createCashfreeOrder + cashfreeWebhook
- [x] `functions/index.js` — exports wired
- [x] `functions/package.json` — axios added
- [x] `functions/.env` — test API keys set
- [ ] `cd functions && npm install`
- [ ] `firebase deploy --only functions:createCashfreeOrder,functions:cashfreeWebhook`

### Frontend
- [x] `useCashfreePayment.js` — uses `firebase/functions` httpsCallable
- [x] `CashfreePaymentScreen.js` — WebView + UPI intent handling + Firestore listener
- [x] `UserNavigator.js` — screen registered
- [x] `BookingConfirmationScreen.js` — routes to CashfreePayment

### Testing
- [ ] Register webhook URL in Cashfree sandbox dashboard
- [ ] Test with `success@upi` → confirm booking confirmed + FCM notification
- [ ] Test with `failure@upi` → confirm booking cancelled, slot freed
- [ ] Check Firebase Functions logs for webhook receipt

---

## Environment Variables

| Variable | Value |
|---|---|
| `CASHFREE_ENV` | `TEST` (switch to `PRODUCTION` after KYC) |
| `CASHFREE_APP_ID_TEST` | Set in `functions/.env` ✅ |
| `CASHFREE_SECRET_KEY_TEST` | Set in `functions/.env` ✅ |

For production deployment (instead of .env file):
```bash
firebase functions:config:set \
  cashfree.env="TEST" \
  cashfree.app_id_test="YOUR_ID" \
  cashfree.secret_key_test="YOUR_SECRET"
```
Then update `cashfreeFunctions.js` to read from `functions.config().cashfree.*` instead of `process.env.*`.

---

## Old Manual UPI Screens (Kept)

`UpiPaymentScreen`, `PaymentConfirmationScreen`, `PaymentSubmittedScreen` are unchanged — they handle chat-based payment requests (manager sends payment card in chat). Only the **advance booking** path uses Cashfree now.

---

*Last updated: 2026-05-10*

