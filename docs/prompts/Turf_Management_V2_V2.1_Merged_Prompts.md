# 🏟️ TURF MANAGEMENT SYSTEM - MERGED V2 + V2.1 PROMPTS

## 📋 Overview

This document merges the remaining V2 prompts (40-57) with V2.1 enhancements to create an optimized development sequence. Starting from **Prompt 40**, this plan integrates:

- ✅ UPI Zero-Fee Payment System (replaces Razorpay for bookings)
- ✅ Configurable Advance Payment Settings
- ✅ Payment Verification Workflow
- ✅ **Slot Locking Mechanism** (prevents double booking)
- ✅ Manager Turf Requests System
- ✅ Turf Edit Logging
- ✅ Owner Operations FAB

**Current Status:** You've completed Prompts 1-39
**Remaining Prompts:** 40-68 (29 prompts)

---

## 🔐 SLOT LOCKING MECHANISM (CRITICAL FEATURE)

This prevents the scenario where two users pay for the same slot.

### Lock Types

| Lock Type | Duration | When Created | When Released |
|-----------|----------|--------------|---------------|
| **Soft Lock** | 10 minutes | User clicks "Pay & Book" | Payment submitted OR timeout |
| **Hard Lock** | Until resolved | Payment submitted | Booking confirmed/rejected/cancelled |

### User Experience

| Scenario | What User Sees |
|----------|----------------|
| Slot available | Can proceed to booking |
| Slot has soft lock | "Try again in 10 mins" |
| Slot has hard lock | "This slot is not available" |

### Status → Lock Mapping

| Status | Lock Type | Can Others Book? |
|--------|-----------|------------------|
| `pending_payment` | Soft (10 min) | No - "Try again in 10 mins" |
| `payment_submitted` | Hard | No |
| `pending` (after approval flow) | None | Yes (multiple requests allowed) |
| `pending` (before approval, verified) | Hard | No |
| `awaiting_payment` | Hard | No |
| `confirmed` | Hard | No |
| `expired` | Released | Yes |
| `rejected` | Released | Yes |
| `cancelled` | Released | Yes |

### Flow Diagrams

**Before Approval (User Pays First):**
```
User selects slot
       ↓
[Check: Available?] ──No──→ "Try again in 10 mins"
       ↓ Yes
Booking Summary Screen
       ↓
User clicks "Pay & Book"
       ↓
[Create Booking + SOFT LOCK (10 min)]
Status: pending_payment
       ↓
UPI Payment Screen (timer visible)
       ↓
┌──────────────────┬─────────────────┐
│ User pays        │ Timer expires   │
│      ↓           │      ↓          │
│ [HARD LOCK]      │ Lock released   │
│ Status:          │ Status: expired │
│ payment_submitted│ Slot available  │
└──────────────────┴─────────────────┘
```

**After Approval (Manager Approves First):**
```
Multiple users request same slot
       ↓
All get status: pending (NO LOCK)
       ↓
Manager sees all requests
       ↓
Manager approves ONE user
       ↓
[HARD LOCK for approved user]
Status: awaiting_payment
       ↓
Other requests → Auto-rejected
       ↓
Approved user has paymentTimeout to pay
```

---

## 🔄 KEY CHANGES FROM ORIGINAL V2

| Original Prompt | Change | Reason |
|-----------------|--------|--------|
| Prompt 40 (Razorpay) | **REPLACED** | UPI payment for bookings, Razorpay only for subscriptions |
| Prompt 41 (Subscription) | **KEPT** | Razorpay still used for owner subscriptions |
| New Prompts 40-46 | **ADDED** | UPI payment system, verification, advance settings |
| New Prompts 60-63 | **ADDED** | Manager turf requests, edit logging, owner FAB |

---

## 📊 MERGED PROMPT SEQUENCE

| New # | Original | Week | Feature | Priority |
|-------|----------|------|---------|----------|
| 40 | NEW | 12 | UPI Payment Configuration (Owner) | Critical |
| 41 | NEW | 12 | Advance Payment Settings (Turf) | Critical |
| 42 | NEW | 12 | UPI Payment Screen (User) | Critical |
| 43 | NEW | 12 | Payment Confirmation Screen (User) | Critical |
| 44 | NEW | 12 | Payment Verification Screen (Manager) | Critical |
| 45 | NEW | 12 | Payment Status & Booking Flow Updates | Critical |
| 46 | NEW | 12 | Payment Cloud Functions | Critical |
| 47 | V2-41 | 12 | Subscription Payment (Razorpay - Owner) | High |
| 48 | V2-42 | 13 | Manager Analytics Dashboard | High |
| 49 | V2-43 | 13 | Owner Analytics Dashboard | High |
| 50 | V2-44 | 13 | Expense Tracking | Medium |
| 51 | V2-45 | 14 | Review System | Medium |
| 52 | V2-46 | 14 | Notification System | High |
| 53 | V2-47 | 14.5 | Academy Management | Medium |
| 54 | V2-48 | 14.5 | Academy Session Generation | Medium |
| 55 | V2-49 | 14.5 | Academy Renewal | Medium |
| 56 | V2-50 | 15 | Subscription Cloud Functions | High |
| 57 | NEW | 15 | Manager Turf Request System | Medium |
| 58 | NEW | 15 | Owner Turf Request Approval | Medium |
| 59 | NEW | 15 | Turf Edit Logging System | Low |
| 60 | NEW | 15 | Owner Operations FAB | Low |
| 61 | V2-51 | 16 | Admin Panel | High |
| 62 | V2-52 | 16 | Suspension Cleanup Function | Medium |
| 63 | NEW | 16 | Fraud Prevention System | Medium |
| 64 | V2-53 | 17 | E2E Testing (Updated for V2.1) | High |
| 65 | V2-54 | 17-18 | Bug Fixes & Optimization | High |
| 66 | V2-55 | 19 | Web Version Optimization | Medium |
| 67 | V2-56 | 19-20 | Deployment Preparation | Critical |
| 68 | V2-57 | 20 | Launch Checklist (Updated for V2.1) | Critical |

**Total: 29 prompts (40-68)**

---

# WEEK 12: PAYMENT SYSTEM (V2.1 - UPI)

---

## Prompt 40: UPI Payment Configuration (Owner Setup)
```
We're implementing a zero-fee UPI payment system for advance payments. Owners will configure their UPI details so customers can pay directly to them.

**Requirements:**

1. **Update Company Schema:**
   Add to companies/{companyId}:
   ```javascript
   paymentConfig: {
     upiEnabled: true,
     upiId: "greenarena@ybl",
     upiQrCode: "gs://bucket/companies/companyId/upi_qr.png",
     upiHolderName: "Green Sports Arena",
     bankDetails: {
       accountNumber: "1234567890",
       ifscCode: "HDFC0001234",
       accountHolderName: "Green Sports Arena Pvt Ltd",
       bankName: "HDFC Bank"
     },
     preferredPaymentMethod: "upi",
     updatedAt: timestamp,
     updatedBy: "ownerId"
   },
   verifiedTransactions: [] // Track verified UPI transactions
   ```

2. **Create src/screens/owner/PaymentSettingsScreen.js:**
   
   **UI Sections:**
   - Header: "Payment Settings"
   - UPI Configuration Section:
     - Toggle: "Enable UPI Payments"
     - UPI ID input with validation (contains @)
     - Display Name input
     - UPI QR Code upload (image picker)
     - QR preview after upload
   - Bank Details Section (optional, for reference):
     - Account Number
     - IFSC Code
     - Account Holder Name
     - Bank Name
   - Save button

3. **QR Code Upload:**
   - Use expo-image-picker
   - Upload to Firebase Storage: companies/{companyId}/upi_qr.png
   - Show preview after upload
   - Allow re-upload

4. **Validation:**
   - UPI ID format: must contain @
   - Display name: required, min 3 chars
   - QR Code: required if UPI enabled

5. **On Save:**
   - Update company document with paymentConfig
   - Show success message

6. **Add to Owner Settings/Dashboard:**
   - Add "Payment Settings" menu item in owner settings
   - Show warning banner on dashboard if UPI not configured: "⚠️ Configure UPI to receive advance payments"

**Checkpoint:**
- Payment settings screen loads
- UPI ID validation works
- QR code upload and preview works
- Settings save to Firestore correctly
- Warning shows if UPI not configured
```

---

## Prompt 41: Advance Payment Settings (Per-Turf Configuration)
```
Create the advance payment configuration system that managers can set per-turf.

**Requirements:**

1. **Update Turf Schema:**
   Add to turfs/{turfId}:
   ```javascript
   advancePayment: {
     isRequired: false,          // false = optional, true = mandatory
     percentage: 50,             // 0, 10, 25, 50, 100
     paymentTiming: "before_approval",  // "before_approval" | "after_approval"
     paymentTimeout: 120,        // minutes (max 120 for after_approval)
     allowedMethods: ["upi", "cash_at_venue"],
     lastUpdatedBy: "managerId",
     lastUpdatedAt: timestamp
   }
   ```

2. **Create src/screens/manager/AdvancePaymentSettingsScreen.js:**
   
   **UI Layout:**
   ```
   ┌─────────────────────────────────────────┐
   │ ← Advance Payment Settings             │
   │    [Turf Name]                          │
   ├─────────────────────────────────────────┤
   │                                         │
   │ Require Advance Payment                 │
   │ [Toggle Switch]                         │
   │                                         │
   │ ℹ️ When enabled, customers must pay     │
   │    advance to confirm booking           │
   │                                         │
   │ ─────────────────────────────────────   │
   │                                         │
   │ Advance Percentage                      │
   │ [10%] [25%] [50%] [100%]  ← Chips      │
   │                                         │
   │ ─────────────────────────────────────   │
   │                                         │
   │ When should customer pay?               │
   │                                         │
   │ ○ Before you approve                    │
   │   Customer pays first, then you         │
   │   approve/reject. Refund if rejected.   │
   │                                         │
   │ ● After you approve                     │
   │   You approve first, customer has       │
   │   limited time to pay.                  │
   │                                         │
   │ ─────────────────────────────────────   │
   │                                         │
   │ Payment Timeout (if After Approval)     │
   │ [30 min ▼] [60 min] [90 min] [120 min] │
   │                                         │
   │ ℹ️ Booking expires if not paid within   │
   │    this time after your approval        │
   │                                         │
   │ ─────────────────────────────────────   │
   │                                         │
   │ [Save Settings]                         │
   │                                         │
   └─────────────────────────────────────────┘
   ```

3. **Conditional UI:**
   - Show percentage/timing options only if isRequired = true
   - Show timeout only if paymentTiming = "after_approval"
   - Disable save if invalid combination

4. **Access Control:**
   - Manager can edit for assigned turfs
   - Owner with operational permissions can edit any turf

5. **Logging:**
   - Log changes to turf_edit_logs collection (we'll create this later)
   - Include who changed, what changed, when

6. **Integration:**
   - Add "Advance Payment" section in TurfSettingsScreen
   - Or create separate menu item in manager dashboard

7. **Default Values for New Turfs:**
   ```javascript
   advancePayment: {
     isRequired: false,
     percentage: 0,
     paymentTiming: "before_approval",
     paymentTimeout: 120,
     allowedMethods: ["upi", "cash_at_venue"],
     lastUpdatedBy: null,
     lastUpdatedAt: null
   }
   ```

**Checkpoint:**
- Settings screen renders correctly
- Toggle shows/hides dependent options
- Percentage chips work
- Timing radio buttons work
- Timeout dropdown shows only for "after_approval"
- Settings save to Firestore
- Manager can only edit assigned turfs
```

---

## Prompt 42: UPI Payment Screen (User Side)
```
Create the UPI payment screen that opens UPI apps with pre-filled payment details.
This screen includes a countdown timer as the slot is locked for 10 minutes.

**Requirements:**

1. **Create src/utils/upiUtils.js:**
   ```javascript
   // Generate UPI deep link URL
   export function generateUpiUrl({ upiId, name, amount, transactionNote, bookingId }) {
     const params = new URLSearchParams({
       pa: upiId,                    // Payee UPI ID
       pn: name,                     // Payee Name
       am: amount.toString(),        // Amount
       cu: 'INR',                    // Currency
       tn: transactionNote || `Booking ${bookingId}`,
       tr: bookingId || ''           // Transaction Reference
     });
     return `upi://pay?${params.toString()}`;
   }

   // Check if UPI apps available
   export async function canOpenUpi() {
     const upiUrl = 'upi://pay?pa=test@upi&am=1';
     return await Linking.canOpenURL(upiUrl);
   }

   // Open UPI app with payment details
   export async function openUpiApp({ upiId, name, amount, transactionNote, bookingId }) {
     const upiUrl = generateUpiUrl({ upiId, name, amount, transactionNote, bookingId });
     try {
       const canOpen = await Linking.canOpenURL(upiUrl);
       if (canOpen) {
         await Linking.openURL(upiUrl);
         return { success: true };
       }
       return { success: false, error: 'NO_UPI_APP' };
     } catch (error) {
       return { success: false, error: 'OPEN_FAILED' };
     }
   }
   ```

2. **Create src/screens/user/UpiPaymentScreen.js:**
   
   **Props/Params:**
   - bookingId
   - amount (advance amount)
   - upiId (from company.paymentConfig)
   - upiHolderName
   - qrCodeUrl
   - turfName
   - lockExpiry (timestamp when slot lock expires)

   **UI Layout:**
   ```
   ┌─────────────────────────────────────────┐
   │ ← PAY VIA UPI                          │
   ├─────────────────────────────────────────┤
   │                                         │
   │ ┌─────────────────────────────────────┐ │
   │ │  ⏱️ Complete payment in 08:45       │ │  ← COUNTDOWN TIMER (red bg)
   │ │  Slot will be released after timeout │ │
   │ └─────────────────────────────────────┘ │
   │                                         │
   │        Pay ₹1,500                       │
   │        to Green Sports Arena            │
   │                                         │
   │ ┌─────────────────────────────────────┐ │
   │ │     [📱 Pay ₹1,500 via UPI]         │ │  ← Primary button
   │ │     Opens your default UPI app       │ │
   │ └─────────────────────────────────────┘ │
   │                                         │
   │         Or pay using                    │
   │   [GPay]  [PhonePe]  [Paytm]           │  ← App icons
   │                                         │
   │   ─────────── OR SCAN QR ───────────   │
   │                                         │
   │         ╔═══════════════╗               │
   │         ║   [QR CODE]   ║               │
   │         ╚═══════════════╝               │
   │     Scan with any UPI app               │
   │                                         │
   │   ─────────────────────────────────    │
   │                                         │
   │   Manual Details                        │
   │   UPI ID: greenarena@ybl    [📋 Copy]   │
   │   Amount: ₹1,500            [📋 Copy]   │
   │                                         │
   │ ┌─────────────────────────────────────┐ │
   │ │     [✓ I've Made the Payment]       │ │
   │ └─────────────────────────────────────┘ │
   │                                         │
   └─────────────────────────────────────────┘
   ```

3. **Countdown Timer Implementation:**
   ```javascript
   const [timeRemaining, setTimeRemaining] = useState(0);
   
   useEffect(() => {
     // Calculate remaining time from lockExpiry
     const calculateRemaining = () => {
       const now = new Date().getTime();
       const expiry = lockExpiry.toDate().getTime();
       const remaining = Math.max(0, Math.floor((expiry - now) / 1000));
       return remaining;
     };
     
     setTimeRemaining(calculateRemaining());
     
     const interval = setInterval(() => {
       const remaining = calculateRemaining();
       setTimeRemaining(remaining);
       
       if (remaining <= 0) {
         clearInterval(interval);
         // Navigate back with expiry message
         Alert.alert(
           'Time Expired',
           'Your slot hold has expired. Please try booking again.',
           [{ text: 'OK', onPress: () => navigation.navigate('Home') }]
         );
       }
     }, 1000);
     
     return () => clearInterval(interval);
   }, [lockExpiry]);
   
   // Format time as MM:SS
   const formatTime = (seconds) => {
     const mins = Math.floor(seconds / 60);
     const secs = seconds % 60;
     return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
   };
   ```

4. **Timer UI Component:**
   ```javascript
   <View style={[styles.timerBanner, timeRemaining < 60 && styles.timerUrgent]}>
     <Icon name="clock-outline" size={20} color="#fff" />
     <Text style={styles.timerText}>
       Complete payment in {formatTime(timeRemaining)}
     </Text>
     <Text style={styles.timerSubtext}>
       Slot will be released after timeout
     </Text>
   </View>
   ```
   
   **Styling:**
   - Normal (>60s): Orange/amber background
   - Urgent (<60s): Red background, text pulses

5. **Functionality:**
   - "Pay via UPI" button → calls openUpiApp()
   - App icon buttons → same action
   - QR code displays from qrCodeUrl
   - Copy buttons use Clipboard API
   - "I've Made the Payment" → navigate to PaymentConfirmationScreen
   - Timer expires → Show alert and navigate to Home

6. **Handle Back Press:**
   ```javascript
   // Warn user before leaving
   useEffect(() => {
     const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
       Alert.alert(
         'Cancel Payment?',
         'If you leave, your slot hold will be released and others can book it.',
         [
           { text: 'Stay', style: 'cancel' },
           { text: 'Leave', style: 'destructive', onPress: () => {
             // Release lock immediately
             releaseSlotLock(bookingId);
             navigation.goBack();
           }}
         ]
       );
       return true; // Prevent default back
     });
     
     return () => backHandler.remove();
   }, []);
   ```

7. **After UPI App Opens:**
   - Show alert after 1 second: "Payment Completed?"
   - Options: "No, Try Again" | "Yes, I Paid"
   - "Yes" → navigate to PaymentConfirmationScreen
   - Timer continues even while in UPI app

8. **Install Required Packages:**
   - expo-clipboard for copy functionality

**Checkpoint:**
- Countdown timer shows and counts down
- Timer turns red when < 60 seconds
- Screen navigates away when timer expires
- Back press shows warning dialog
- UPI deep link opens GPay/PhonePe/Paytm
- Amount and UPI ID pre-filled in UPI app
- QR code displays correctly
- Copy buttons work with feedback
- Navigation to confirmation screen works
```

---

## Prompt 43: Payment Confirmation Screen (User Submits Proof)
```
Create the payment confirmation screen where users submit payment proof.

**Requirements:**

1. **Create src/screens/user/PaymentConfirmationScreen.js:**

   **UI Layout:**
   ```
   ┌─────────────────────────────────────────┐
   │ ← CONFIRM PAYMENT                      │
   ├─────────────────────────────────────────┤
   │                                         │
   │  ✓ Great! Now verify your payment       │
   │                                         │
   │  UPI Transaction ID *                   │
   │  ┌─────────────────────────────────────┐│
   │  │ 123456789012                        ││
   │  └─────────────────────────────────────┘│
   │  💡 Find in UPI app → Transaction History│
   │                                         │
   │  Where to find Transaction ID?          │
   │  [GPay] [PhonePe] [Paytm]  ← Help images│
   │                                         │
   │  ─────────────────────────────────────  │
   │                                         │
   │  Payment Screenshot *                   │
   │  ┌─────────────────────────────────────┐│
   │  │  [📷 Take Photo] [🖼️ Gallery]       ││
   │  └─────────────────────────────────────┘│
   │  📸 Must show: Amount, UPI ID, Txn ID   │
   │                                         │
   │  [Screenshot Preview if uploaded]       │
   │                                         │
   │  ─────────────────────────────────────  │
   │                                         │
   │  Payment Summary                        │
   │  Amount Paid           ₹1,500           │
   │  Paid To               Green Sports     │
   │  UPI ID                greenarena@ybl   │
   │                                         │
   │  ┌─────────────────────────────────────┐│
   │  │     [Submit for Verification]       ││
   │  └─────────────────────────────────────┘│
   │                                         │
   │  ⚠️ False details → Account suspension  │
   │                                         │
   └─────────────────────────────────────────┘
   ```

2. **Transaction ID Input:**
   - Allow 10-35 characters (different apps have different formats)
   - Auto-capitalize
   - Show validation error if too short/long

3. **Screenshot Upload:**
   - Use expo-image-picker
   - Options: Camera or Gallery
   - Compress to 80% quality before upload
   - Show preview after selection
   - Allow removal and re-upload

4. **Helper Images:**
   - Create placeholder components showing where to find txn ID
   - Can be horizontal ScrollView with app-specific help

5. **Create src/api/firebase/payments.js:**
   ```javascript
   // Upload payment proof screenshot
   export async function uploadPaymentProof(bookingId, imageUri) {
     const response = await fetch(imageUri);
     const blob = await response.blob();
     const fileName = `payment_proof_${Date.now()}.jpg`;
     const storageRef = ref(storage, `bookings/${bookingId}/${fileName}`);
     await uploadBytes(storageRef, blob);
     return await getDownloadURL(storageRef);
   }

   // Submit payment for verification
   export async function submitPaymentForVerification(bookingId, paymentDetails) {
     const bookingRef = doc(firestore, 'bookings', bookingId);
     await updateDoc(bookingRef, {
       status: 'payment_submitted',
       'payment.advance.status': 'submitted',
       'payment.advance.upiDetails': {
         transactionId: paymentDetails.transactionId,
         paidToUpiId: paymentDetails.paidToUpiId,
         amount: paymentDetails.amount,
         paidAt: paymentDetails.paidAt,
         screenshotUrl: paymentDetails.screenshotUrl
       },
       'payment.advance.submittedAt': serverTimestamp(),
       'statusHistory': arrayUnion({
         status: 'payment_submitted',
         timestamp: new Date().toISOString(),
         changedBy: 'user',
         reason: 'Payment proof submitted'
       }),
       updatedAt: serverTimestamp()
     });
   }
   ```

6. **On Submit:**
   - Validate transaction ID (not empty, correct length)
   - Validate screenshot exists
   - Upload screenshot to Storage
   - Call submitPaymentForVerification
   - Navigate to PaymentSubmittedScreen

7. **Create src/screens/user/PaymentSubmittedScreen.js:**
   - Success illustration/icon
   - "Payment Submitted!" message
   - Booking summary
   - "What happens next?" explanation
   - "View My Bookings" button
   - "Back to Home" button

**Checkpoint:**
- Transaction ID input validates correctly
- Screenshot upload works (camera + gallery)
- Preview displays after upload
- Submit uploads screenshot and updates booking
- Navigation to success screen works
- Booking status changes to "payment_submitted"
```

---

## Prompt 44: Payment Verification Screen (Manager Side)
```
Create the payment verification screen for managers to verify UPI payments.

**Requirements:**

1. **Create src/screens/manager/VerifyPaymentScreen.js:**

   **UI Layout:**
   ```
   ┌─────────────────────────────────────────┐
   │ ← VERIFY PAYMENT                       │
   ├─────────────────────────────────────────┤
   │                                         │
   │  👤 Rahul Kumar                         │
   │  📞 +91 98765 43210      [📞 Call]      │
   │                                         │
   │  ┌─────────────────────────────────────┐│
   │  │ 📅 15 Jan 2026 • 17:00 - 19:00     ││
   │  │ 🏏 Cricket • Ground-1              ││
   │  │ 💰 Total: ₹3,000                   ││
   │  └─────────────────────────────────────┘│
   │                                         │
   │  ─────────────────────────────────────  │
   │                                         │
   │  💳 PAYMENT DETAILS                     │
   │                                         │
   │  Amount:           ₹1,500               │
   │  UPI ID:           greenarena@ybl       │
   │  Transaction ID:   123456789012         │
   │  Submitted:        10 mins ago          │
   │                                         │
   │  📸 PAYMENT PROOF                       │
   │  ┌─────────────────────────────────────┐│
   │  │                                     ││
   │  │     [Payment Screenshot]            ││
   │  │                                     ││
   │  │        [🔍 View Full Size]          ││
   │  │                                     ││
   │  └─────────────────────────────────────┘│
   │                                         │
   │  ─────────────────────────────────────  │
   │                                         │
   │  ✓ Check your UPI app or bank to verify │
   │                                         │
   │  ┌─────────────────────────────────────┐│
   │  │  [✓ Payment Verified - Approve]     ││  ← Green
   │  └─────────────────────────────────────┘│
   │                                         │
   │  ┌─────────────────────────────────────┐│
   │  │  [✗ Payment Not Found - Reject]     ││  ← Red
   │  └─────────────────────────────────────┘│
   │                                         │
   │  ℹ️ Contact customer before rejecting   │
   │                                         │
   └─────────────────────────────────────────┘
   ```

2. **Full Size Image Modal:**
   - Tap screenshot or "View Full Size" → opens modal
   - Pinch to zoom
   - Close button

3. **Verification Logic:**

   **On "Payment Verified - Approve":**
   ```javascript
   async function verifyPayment(bookingId, managerId, managerRole) {
     const bookingRef = doc(firestore, 'bookings', bookingId);
     await updateDoc(bookingRef, {
       status: 'pending',  // Now waiting for slot approval (or 'confirmed' if auto-approve)
       'payment.advance.status': 'verified',
       'payment.advance.verification': {
         isVerified: true,
         verifiedBy: managerId,
         verifiedByRole: managerRole,
         verifiedAt: serverTimestamp(),
         verificationNote: 'Payment confirmed'
       },
       'statusHistory': arrayUnion({
         status: 'payment_verified',
         timestamp: new Date().toISOString(),
         changedBy: managerId,
         changedByRole: managerRole,
         reason: 'Payment verified'
       }),
       updatedAt: serverTimestamp()
     });
     
     // Send notification to user
     // ... notification code
   }
   ```

   **On "Payment Not Found - Reject":**
   - Show modal asking for rejection reason
   - Reasons: "Transaction ID not found", "Wrong amount", "Payment to wrong UPI", "Screenshot unclear", "Other"
   - Track attempt number
   
   ```javascript
   async function rejectPayment(bookingId, managerId, managerRole, reason) {
     const bookingRef = doc(firestore, 'bookings', bookingId);
     const booking = await getDoc(bookingRef);
     const attemptNumber = (booking.data().paymentAttempts?.length || 0) + 1;
     
     await updateDoc(bookingRef, {
       status: attemptNumber >= 3 ? 'payment_rejected' : 'pending_payment',
       'payment.advance.status': 'rejected',
       'payment.advance.verification': {
         isVerified: false,
         verifiedBy: managerId,
         verifiedByRole: managerRole,
         verifiedAt: serverTimestamp(),
         rejectionReason: reason,
         attemptNumber: attemptNumber
       },
       'paymentAttempts': arrayUnion({
         attemptNumber,
         transactionId: booking.data().payment.advance.upiDetails.transactionId,
         screenshotUrl: booking.data().payment.advance.upiDetails.screenshotUrl,
         submittedAt: booking.data().payment.advance.submittedAt,
         status: 'rejected',
         rejectionReason: reason
       }),
       'statusHistory': arrayUnion({
         status: 'payment_rejected',
         timestamp: new Date().toISOString(),
         changedBy: managerId,
         changedByRole: managerRole,
         reason: reason
       }),
       updatedAt: serverTimestamp()
     });
     
     // Notify user
     // If attemptNumber < 3: "Payment not verified. Please try again."
     // If attemptNumber >= 3: "Maximum attempts reached. Booking cancelled."
   }
   ```

4. **Access from Booking Management:**
   - Add "Verify Payment" button on booking cards with status "payment_submitted"
   - Or show payment verification section in booking details

5. **Notifications:**
   - Notify user on verification: "Payment verified! Your booking request is pending approval."
   - Notify user on rejection: "Payment could not be verified. Reason: [reason]. Please try again."

**Checkpoint:**
- Payment details display correctly
- Screenshot loads and can be viewed full size
- Verify updates booking status correctly
- Reject asks for reason and updates booking
- Notifications sent to user
- After 3 failed attempts, booking is cancelled
```

---

## Prompt 45: Slot Locking & Booking Flow Updates
```
Update the booking flow to integrate slot locking mechanism and new payment statuses.
This is a CRITICAL prompt that ensures no double-booking when advance payments are enabled.

**KEY CONCEPT: Slot Locking Strategy**

┌─────────────────────────────────────────────────────────────────┐
│  BEFORE APPROVAL (User pays first)                              │
│  ─────────────────────────────────                              │
│                                                                 │
│  User selects slot → Booking Summary Screen                     │
│         ↓                                                       │
│  Check availability (BEFORE showing summary)                    │
│         ↓                                                       │
│  If slot locked → Show "Try again in 10 mins"                   │
│  If available → Show summary + "Pay & Book" button              │
│         ↓                                                       │
│  User clicks "Pay & Book"                                       │
│         ↓                                                       │
│  Create booking with SOFT LOCK (10 mins)                        │
│  Status: "pending_payment"                                      │
│         ↓                                                       │
│  Navigate to UPI Payment Screen (timer visible)                 │
│         ↓                                                       │
│  User submits payment → HARD LOCK (no expiry)                   │
│  Status: "payment_submitted"                                    │
│         ↓                                                       │
│  Manager verifies → Status: "pending" (awaiting approval)       │
│         ↓                                                       │
│  Manager approves → Status: "confirmed"                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  AFTER APPROVAL (Manager approves first)                        │
│  ─────────────────────────────────────                          │
│                                                                 │
│  User selects slot → Booking Summary Screen                     │
│         ↓                                                       │
│  Check availability (exclude "pending" - multiple allowed)      │
│         ↓                                                       │
│  User clicks "Request Booking"                                  │
│         ↓                                                       │
│  Create booking with NO LOCK                                    │
│  Status: "pending"                                              │
│         ↓                                                       │
│  Manager sees all requests for same slot                        │
│         ↓                                                       │
│  Manager approves ONE → HARD LOCK + auto-reject others          │
│  Status: "awaiting_payment" (with timeout)                      │
│         ↓                                                       │
│  Approved user pays → Manager verifies → "confirmed"            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

**Requirements:**

1. **Update Booking Schema:**
   Add slot locking fields to bookings/{bookingId}:
   ```javascript
   {
     // ... existing fields ...
     
     status: "pending_payment",
     // Status values:
     // "pending_payment"     - Soft lock, user paying (10 min expiry)
     // "payment_submitted"   - Hard lock, awaiting verification
     // "pending"             - No lock (after_approval) OR hard lock (before_approval verified)
     // "awaiting_payment"    - Hard lock, approved waiting payment
     // "payment_rejected"    - Lock released, user can retry
     // "expired"             - Lock released, timeout
     // "confirmed"           - Hard lock, final
     // "rejected"            - Lock released
     // "cancelled"           - Lock released
     
     // NEW: Slot Lock
     slotLock: {
       isLocked: true,
       lockType: "soft",           // "soft" (10 min) | "hard" (until resolved)
       lockedAt: timestamp,
       lockExpiry: timestamp,      // Only for soft lock (10 mins from lockedAt)
       lockReason: "payment_pending"  // "payment_pending" | "payment_submitted" | "awaiting_payment" | "approved"
     },
     
     // Updated payment section
     payment: {
       slotAmount: 3000,
       
       advanceConfig: {
         isRequired: true,
         percentage: 50,
         paymentTiming: "before_approval",
         paymentTimeout: 120
       },
       
       advanceAmount: 1500,
       remainingAmount: 1500,
       
       advance: {
         status: "pending",
         method: "upi",
         upiDetails: { /* ... */ },
         verification: { /* ... */ },
         submittedAt: null,
         paymentDeadline: null,
         isExpired: false
       },
       
       onGround: { /* ... */ },
       refund: { /* ... */ },
       
       totalPaid: 0,
       totalPending: 3000,
       isFullyPaid: false
     },
     
     paymentAttempts: []
   }
   ```

2. **Create src/utils/slotLockUtils.js:**
   ```javascript
   import { doc, getDoc, updateDoc, collection, query, where, getDocs, serverTimestamp, Timestamp } from 'firebase/firestore';
   import { firestore } from '../api/firebase/config';
   
   const SOFT_LOCK_DURATION = 10 * 60 * 1000; // 10 minutes in ms
   
   /**
    * Check if a slot is available (considering locks)
    */
   export async function checkSlotAvailability(turfId, groundId, date, startTime, endTime, paymentTiming = 'before_approval') {
     
     // Statuses that ALWAYS block the slot
     const hardBlockStatuses = [
       'confirmed',
       'in_progress',
       'awaiting_payment',    // Approved, waiting payment
       'payment_submitted'    // Paid, waiting verification
     ];
     
     // Statuses that block ONLY for before_approval flow
     const softBlockStatuses = ['pending_payment'];
     
     // For before_approval: also block if payment verified but pending approval
     // (status = 'pending' with advance.status = 'verified')
     
     // Query hard blocks
     const hardBlockQuery = query(
       collection(firestore, 'bookings'),
       where('turfId', '==', turfId),
       where('groundId', '==', groundId),
       where('date', '==', date),
       where('status', 'in', hardBlockStatuses)
     );
     
     const hardBlocks = await getDocs(hardBlockQuery);
     
     for (const docSnap of hardBlocks.docs) {
       const booking = docSnap.data();
       if (timeOverlaps(startTime, endTime, booking.startTime, booking.endTime)) {
         return {
           available: false,
           reason: 'booked',
           message: 'This slot is not available'
         };
       }
     }
     
     // Query soft blocks (pending_payment with active lock)
     const softBlockQuery = query(
       collection(firestore, 'bookings'),
       where('turfId', '==', turfId),
       where('groundId', '==', groundId),
       where('date', '==', date),
       where('status', 'in', softBlockStatuses)
     );
     
     const softBlocks = await getDocs(softBlockQuery);
     
     for (const docSnap of softBlocks.docs) {
       const booking = docSnap.data();
       if (timeOverlaps(startTime, endTime, booking.startTime, booking.endTime)) {
         // Check if lock is still active
         const lockExpiry = booking.slotLock?.lockExpiry?.toDate();
         if (lockExpiry && lockExpiry > new Date()) {
           return {
             available: false,
             reason: 'being_booked',
             message: 'Try again in 10 mins'  // Always show 10 mins per requirement
           };
         }
         // Lock expired - slot is available (cleanup will handle the booking)
       }
     }
     
     // For before_approval: check pending bookings with verified payment
     if (paymentTiming === 'before_approval') {
       const pendingVerifiedQuery = query(
         collection(firestore, 'bookings'),
         where('turfId', '==', turfId),
         where('groundId', '==', groundId),
         where('date', '==', date),
         where('status', '==', 'pending'),
         where('payment.advance.status', '==', 'verified')
       );
       
       const pendingVerified = await getDocs(pendingVerifiedQuery);
       
       for (const docSnap of pendingVerified.docs) {
         const booking = docSnap.data();
         if (timeOverlaps(startTime, endTime, booking.startTime, booking.endTime)) {
           return {
             available: false,
             reason: 'booked',
             message: 'This slot is not available'
           };
         }
       }
     }
     
     // Check academy sessions
     const academyQuery = query(
       collection(firestore, 'academy_sessions'),
       where('turfId', '==', turfId),
       where('groundId', '==', groundId),
       where('date', '==', date),
       where('isCancelled', '==', false)
     );
     
     const academySessions = await getDocs(academyQuery);
     
     for (const docSnap of academySessions.docs) {
       const session = docSnap.data();
       if (timeOverlaps(startTime, endTime, session.startTime, session.endTime)) {
         return {
           available: false,
           reason: 'academy',
           message: `Reserved for ${session.academyName}`
         };
       }
     }
     
     // Check blocked slots
     const blockedQuery = query(
       collection(firestore, 'blocked_slots'),
       where('turfId', '==', turfId),
       where('groundId', '==', groundId)
     );
     
     const blockedSlots = await getDocs(blockedQuery);
     
     for (const docSnap of blockedSlots.docs) {
       const block = docSnap.data();
       if (date >= block.startDate && date <= block.endDate) {
         for (const slot of block.timeSlots) {
           if (timeOverlaps(startTime, endTime, slot.startTime, slot.endTime)) {
             return {
               available: false,
               reason: 'blocked',
               message: block.reason || 'Slot is blocked'
             };
           }
         }
       }
     }
     
     return { available: true };
   }
   
   /**
    * Create a soft lock when user initiates payment
    */
   export async function createSoftLock(bookingId) {
     const now = new Date();
     const lockExpiry = new Date(now.getTime() + SOFT_LOCK_DURATION);
     
     await updateDoc(doc(firestore, 'bookings', bookingId), {
       'slotLock': {
         isLocked: true,
         lockType: 'soft',
         lockedAt: Timestamp.fromDate(now),
         lockExpiry: Timestamp.fromDate(lockExpiry),
         lockReason: 'payment_pending'
       }
     });
     
     return lockExpiry;
   }
   
   /**
    * Convert soft lock to hard lock when payment submitted
    */
   export async function convertToHardLock(bookingId, reason = 'payment_submitted') {
     await updateDoc(doc(firestore, 'bookings', bookingId), {
       'slotLock': {
         isLocked: true,
         lockType: 'hard',
         lockedAt: serverTimestamp(),
         lockExpiry: null,  // No expiry for hard lock
         lockReason: reason
       }
     });
   }
   
   /**
    * Release lock (on cancellation, rejection, expiry)
    */
   export async function releaseLock(bookingId) {
     await updateDoc(doc(firestore, 'bookings', bookingId), {
       'slotLock': {
         isLocked: false,
         lockType: null,
         lockedAt: null,
         lockExpiry: null,
         lockReason: null
       }
     });
   }
   
   /**
    * Check if time ranges overlap
    */
   export function timeOverlaps(start1, end1, start2, end2) {
     return start1 < end2 && end1 > start2;
   }
   ```

3. **Update BookingSummaryScreen.js:**
   
   This screen shows BEFORE the payment screen. Lock check happens here.
   
   ```javascript
   // src/screens/user/BookingSummaryScreen.js
   
   import { checkSlotAvailability } from '../../utils/slotLockUtils';
   
   export default function BookingSummaryScreen({ route, navigation }) {
     const { turf, ground, sport, date, startTime, endTime, totalAmount } = route.params;
     const [isAvailable, setIsAvailable] = useState(null);
     const [availabilityMessage, setAvailabilityMessage] = useState('');
     const [isLoading, setIsLoading] = useState(true);
     const [isBooking, setIsBooking] = useState(false);
     
     const advanceConfig = turf.advancePayment;
     const advanceAmount = advanceConfig.isRequired 
       ? Math.round(totalAmount * advanceConfig.percentage / 100) 
       : 0;
     
     // Check availability on mount
     useEffect(() => {
       checkAvailability();
     }, []);
     
     const checkAvailability = async () => {
       setIsLoading(true);
       const result = await checkSlotAvailability(
         turf.turfId,
         ground.groundId,
         date,
         startTime,
         endTime,
         advanceConfig.paymentTiming
       );
       
       setIsAvailable(result.available);
       if (!result.available) {
         setAvailabilityMessage(result.message);
       }
       setIsLoading(false);
     };
     
     const handleBooking = async () => {
       if (!isAvailable) return;
       
       setIsBooking(true);
       
       try {
         // Re-check availability (in case someone booked while viewing)
         const recheck = await checkSlotAvailability(
           turf.turfId, ground.groundId, date, startTime, endTime,
           advanceConfig.paymentTiming
         );
         
         if (!recheck.available) {
           Alert.alert('Slot Unavailable', recheck.message);
           setIsAvailable(false);
           setAvailabilityMessage(recheck.message);
           setIsBooking(false);
           return;
         }
         
         // Create booking based on payment timing
         if (advanceConfig.isRequired && advanceConfig.paymentTiming === 'before_approval') {
           // BEFORE APPROVAL: Create booking with soft lock, go to payment
           const booking = await createBookingWithSoftLock({
             turf, ground, sport, date, startTime, endTime,
             totalAmount, advanceAmount, advanceConfig
           });
           
           navigation.replace('UpiPayment', {
             bookingId: booking.id,
             amount: advanceAmount,
             upiId: turf.companyPaymentConfig.upiId,
             upiHolderName: turf.companyPaymentConfig.upiHolderName,
             qrCodeUrl: turf.companyPaymentConfig.upiQrCode,
             turfName: turf.name,
             lockExpiry: booking.lockExpiry
           });
         } 
         else if (advanceConfig.isRequired && advanceConfig.paymentTiming === 'after_approval') {
           // AFTER APPROVAL: Create booking without lock, wait for approval
           await createBookingWithoutLock({
             turf, ground, sport, date, startTime, endTime,
             totalAmount, advanceAmount, advanceConfig
           });
           
           navigation.replace('BookingRequested', {
             message: 'Your booking request has been submitted. You will be notified when the manager approves it.'
           });
         }
         else {
           // NO ADVANCE: Create booking without lock
           await createBookingWithoutLock({
             turf, ground, sport, date, startTime, endTime,
             totalAmount, advanceAmount: 0, advanceConfig
           });
           
           navigation.replace('BookingRequested', {
             message: 'Your booking request has been submitted.'
           });
         }
       } catch (error) {
         Alert.alert('Error', 'Failed to create booking. Please try again.');
       } finally {
         setIsBooking(false);
       }
     };
     
     if (isLoading) {
       return <LoadingScreen message="Checking availability..." />;
     }
     
     return (
       <View style={styles.container}>
         {/* Show unavailable message if slot is locked */}
         {!isAvailable && (
           <View style={styles.unavailableBanner}>
             <Icon name="clock-outline" size={24} color="#f44336" />
             <Text style={styles.unavailableText}>{availabilityMessage}</Text>
             <Button mode="outlined" onPress={checkAvailability}>
               Check Again
             </Button>
           </View>
         )}
         
         {/* Booking Summary */}
         <Card style={styles.summaryCard}>
           <Text style={styles.turfName}>{turf.name}</Text>
           <Text>{ground.name} • {sport}</Text>
           <Text>{formatDate(date)} • {startTime} - {endTime}</Text>
           
           <Divider style={styles.divider} />
           
           <View style={styles.priceRow}>
             <Text>Slot Amount</Text>
             <Text>₹{totalAmount}</Text>
           </View>
           
           {advanceConfig.isRequired && (
             <>
               <View style={styles.priceRow}>
                 <Text>Advance ({advanceConfig.percentage}%)</Text>
                 <Text style={styles.advanceAmount}>₹{advanceAmount}</Text>
               </View>
               <View style={styles.priceRow}>
                 <Text>Due at venue</Text>
                 <Text>₹{totalAmount - advanceAmount}</Text>
               </View>
               
               <View style={styles.infoBox}>
                 <Icon name="information-outline" size={16} />
                 <Text style={styles.infoText}>
                   {advanceConfig.paymentTiming === 'before_approval'
                     ? 'Pay advance now. Manager will review your request after payment verification.'
                     : 'Request now. Pay advance after manager approves your booking.'
                   }
                 </Text>
               </View>
             </>
           )}
         </Card>
         
         {/* Action Button */}
         <Button
           mode="contained"
           onPress={handleBooking}
           disabled={!isAvailable || isBooking}
           loading={isBooking}
           style={styles.bookButton}
         >
           {!isAvailable 
             ? 'Slot Unavailable'
             : advanceConfig.isRequired && advanceConfig.paymentTiming === 'before_approval'
               ? `Pay ₹${advanceAmount} & Book`
               : 'Request Booking'
           }
         </Button>
       </View>
     );
   }
   
   // Helper function to create booking with soft lock
   async function createBookingWithSoftLock({ turf, ground, sport, date, startTime, endTime, totalAmount, advanceAmount, advanceConfig }) {
     const now = new Date();
     const lockExpiry = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes
     
     const bookingRef = doc(collection(firestore, 'bookings'));
     
     const bookingData = {
       bookingId: bookingRef.id,
       userId: auth.currentUser.uid,
       userName: auth.currentUser.displayName || 'User',
       userPhone: auth.currentUser.phoneNumber,
       companyId: turf.companyId,
       turfId: turf.turfId,
       turfName: turf.name,
       groundId: ground.groundId,
       groundName: ground.name,
       sport: sport,
       date: date,
       startTime: startTime,
       endTime: endTime,
       
       status: 'pending_payment',
       
       slotLock: {
         isLocked: true,
         lockType: 'soft',
         lockedAt: Timestamp.fromDate(now),
         lockExpiry: Timestamp.fromDate(lockExpiry),
         lockReason: 'payment_pending'
       },
       
       payment: {
         slotAmount: totalAmount,
         advanceConfig: advanceConfig,
         advanceAmount: advanceAmount,
         remainingAmount: totalAmount - advanceAmount,
         advance: {
           status: 'pending',
           method: 'upi',
           upiDetails: null,
           verification: null,
           submittedAt: null,
           paymentDeadline: null,
           isExpired: false
         },
         onGround: {
           status: 'pending',
           cashAmount: 0,
           onlineAmount: 0,
           totalCollected: 0,
           collectedBy: null,
           collectedAt: null
         },
         refund: {
           isRequired: false,
           refundAmount: 0,
           refundStatus: 'not_required'
         },
         totalPaid: 0,
         totalPending: totalAmount,
         isFullyPaid: false
       },
       
       paymentAttempts: [],
       
       statusHistory: [{
         status: 'pending_payment',
         timestamp: now.toISOString(),
         changedBy: auth.currentUser.uid,
         changedByRole: 'user',
         reason: 'Booking created, awaiting payment'
       }],
       
       createdAt: serverTimestamp(),
       updatedAt: serverTimestamp()
     };
     
     await setDoc(bookingRef, bookingData);
     
     return {
       id: bookingRef.id,
       lockExpiry: lockExpiry
     };
   }
   
   // Helper function to create booking without lock (for after_approval or no advance)
   async function createBookingWithoutLock({ turf, ground, sport, date, startTime, endTime, totalAmount, advanceAmount, advanceConfig }) {
     const now = new Date();
     
     const bookingRef = doc(collection(firestore, 'bookings'));
     
     const bookingData = {
       // ... similar to above but:
       status: 'pending',
       slotLock: {
         isLocked: false,
         lockType: null,
         lockedAt: null,
         lockExpiry: null,
         lockReason: null
       },
       // ... rest of fields
     };
     
     await setDoc(bookingRef, bookingData);
     
     // Notify manager
     await notifyTurfManagers(turf.turfId, {
       type: 'booking_request',
       title: 'New Booking Request',
       body: `${auth.currentUser.displayName} requested ${sport} on ${formatDate(date)}`
     });
     
     return { id: bookingRef.id };
   }
   ```

4. **Update Manager Booking Approval (After Approval Flow):**
   
   When manager approves one request, lock that slot and auto-reject others.
   
   ```javascript
   // In manager's approveBooking function
   
   async function approveBookingAfterApprovalFlow(bookingId, managerId, managerRole) {
     const bookingRef = doc(firestore, 'bookings', bookingId);
     const bookingSnap = await getDoc(bookingRef);
     const booking = bookingSnap.data();
     
     // Use transaction to prevent race conditions
     await runTransaction(firestore, async (transaction) => {
       
       // 1. Check if slot is still available
       const conflictQuery = query(
         collection(firestore, 'bookings'),
         where('turfId', '==', booking.turfId),
         where('groundId', '==', booking.groundId),
         where('date', '==', booking.date),
         where('status', 'in', ['confirmed', 'awaiting_payment', 'payment_submitted'])
       );
       
       const conflicts = await getDocs(conflictQuery);
       
       for (const conflictDoc of conflicts.docs) {
         const conflict = conflictDoc.data();
         if (timeOverlaps(booking.startTime, booking.endTime, conflict.startTime, conflict.endTime)) {
           throw new Error('Slot already assigned to another booking');
         }
       }
       
       // 2. Calculate payment deadline
       const paymentDeadline = new Date(Date.now() + booking.payment.advanceConfig.paymentTimeout * 60 * 1000);
       
       // 3. Approve this booking with hard lock
       transaction.update(bookingRef, {
         status: 'awaiting_payment',
         'slotLock': {
           isLocked: true,
           lockType: 'hard',
           lockedAt: serverTimestamp(),
           lockExpiry: Timestamp.fromDate(paymentDeadline),
           lockReason: 'awaiting_payment'
         },
         'payment.advance.paymentDeadline': Timestamp.fromDate(paymentDeadline),
         'statusHistory': arrayUnion({
           status: 'awaiting_payment',
           timestamp: new Date().toISOString(),
           changedBy: managerId,
           changedByRole: managerRole,
           reason: 'Booking approved, awaiting payment'
         }),
         updatedAt: serverTimestamp()
       });
       
       // 4. Find and reject other pending requests for same slot
       const otherPendingQuery = query(
         collection(firestore, 'bookings'),
         where('turfId', '==', booking.turfId),
         where('groundId', '==', booking.groundId),
         where('date', '==', booking.date),
         where('status', '==', 'pending')
       );
       
       const otherPending = await getDocs(otherPendingQuery);
       
       const rejectedUserIds = [];
       
       for (const otherDoc of otherPending.docs) {
         if (otherDoc.id === bookingId) continue;
         
         const other = otherDoc.data();
         if (timeOverlaps(booking.startTime, booking.endTime, other.startTime, other.endTime)) {
           transaction.update(otherDoc.ref, {
             status: 'rejected',
             'statusHistory': arrayUnion({
               status: 'rejected',
               timestamp: new Date().toISOString(),
               changedBy: 'system',
               changedByRole: 'system',
               reason: 'Slot assigned to another user'
             }),
             updatedAt: serverTimestamp()
           });
           
           rejectedUserIds.push(other.userId);
         }
       }
       
       return rejectedUserIds;
     });
     
     // Notify approved user
     await sendNotification(booking.userId, {
       type: 'booking_approved_pay_now',
       title: 'Booking Approved! 🎉',
       body: `Pay ₹${booking.payment.advanceAmount} within ${booking.payment.advanceConfig.paymentTimeout} mins to confirm.`
     });
     
     // Notify rejected users
     for (const rejectedUserId of rejectedUserIds) {
       await sendNotification(rejectedUserId, {
         type: 'booking_rejected',
         title: 'Booking Not Available',
         body: 'The slot was assigned to another user. Please try a different time.'
       });
     }
   }
   ```

5. **Update BookingCard Component:**
   Add status badge for new statuses:
   
   ```javascript
   const getStatusBadge = (status) => {
     const statusConfig = {
       'pending_payment': { color: '#FF9800', text: 'Payment Required', icon: 'cash' },
       'payment_submitted': { color: '#2196F3', text: 'Verifying Payment', icon: 'clock-check' },
       'awaiting_payment': { color: '#FF5722', text: 'Pay Now', icon: 'alert' },
       'payment_rejected': { color: '#f44336', text: 'Payment Failed', icon: 'close-circle' },
       'expired': { color: '#9E9E9E', text: 'Expired', icon: 'clock-remove' },
       'pending': { color: '#FFC107', text: 'Pending Approval', icon: 'clock' },
       'confirmed': { color: '#4CAF50', text: 'Confirmed', icon: 'check-circle' },
       'in_progress': { color: '#00BCD4', text: 'In Progress', icon: 'play-circle' },
       'completed': { color: '#9E9E9E', text: 'Completed', icon: 'check-all' },
       'rejected': { color: '#f44336', text: 'Rejected', icon: 'close' },
       'cancelled': { color: '#9E9E9E', text: 'Cancelled', icon: 'cancel' }
     };
     
     return statusConfig[status] || { color: '#9E9E9E', text: status, icon: 'help' };
   };
   ```

6. **User Booking History Updates:**
   Show appropriate actions based on status:
   
   ```javascript
   // In BookingHistoryScreen or BookingCard
   
   const renderActionButton = (booking) => {
     switch (booking.status) {
       case 'awaiting_payment':
         return (
           <View>
             <Text style={styles.deadline}>
               Pay within {getTimeRemaining(booking.payment.advance.paymentDeadline)}
             </Text>
             <Button mode="contained" onPress={() => navigateToPayment(booking)}>
               Pay ₹{booking.payment.advanceAmount}
             </Button>
           </View>
         );
       
       case 'payment_rejected':
         const attempts = booking.paymentAttempts?.length || 0;
         if (attempts < 3) {
           return (
             <View>
               <Text style={styles.errorText}>
                 Payment verification failed. {3 - attempts} attempts remaining.
               </Text>
               <Button mode="contained" onPress={() => navigateToPayment(booking)}>
                 Retry Payment
               </Button>
             </View>
           );
         } else {
           return (
             <Text style={styles.errorText}>
               Maximum payment attempts reached. Booking cancelled.
             </Text>
           );
         }
       
       case 'pending_payment':
         return (
           <Button mode="contained" onPress={() => navigateToPayment(booking)}>
             Continue Payment
           </Button>
         );
       
       default:
         return null;
     }
   };
   ```

**Checkpoint:**
- Slot shows "Try again in 10 mins" when soft locked
- User cannot proceed to payment if slot is locked
- Booking creates with soft lock (10 min expiry)
- Soft lock converts to hard lock on payment submission
- After approval: Multiple requests allowed, one approval locks slot
- Auto-reject other pending requests when one is approved
- Status badges show correctly for all new statuses
- User booking history shows appropriate actions
- Transaction prevents race conditions
```

---

## Prompt 46: Payment & Slot Lock Cloud Functions
```
Create Cloud Functions for payment timeout handling, verification reminders, and slot lock expiry.

**Requirements:**

1. **Create functions/src/slotLockFunctions.js:**

   **Function 1: releaseExpiredSlotLocks (Every 2 minutes)**
   
   This function releases soft locks that have expired (user didn't complete payment in 10 mins).
   
   ```javascript
   exports.releaseExpiredSlotLocks = functions.pubsub
     .schedule('*/2 * * * *')  // Every 2 minutes
     .timeZone('Asia/Kolkata')
     .onRun(async (context) => {
       const now = admin.firestore.Timestamp.now();
       
       // Find bookings with expired soft locks (pending_payment status)
       const expiredSoftLocks = await admin.firestore()
         .collection('bookings')
         .where('status', '==', 'pending_payment')
         .where('slotLock.lockExpiry', '<=', now)
         .get();
       
       console.log(`Found ${expiredSoftLocks.size} expired soft locks`);
       
       for (const doc of expiredSoftLocks.docs) {
         const booking = doc.data();
         
         // Update status to expired and release lock
         await doc.ref.update({
           status: 'expired',
           'slotLock': {
             isLocked: false,
             lockType: null,
             lockedAt: null,
             lockExpiry: null,
             lockReason: null
           },
           'statusHistory': admin.firestore.FieldValue.arrayUnion({
             status: 'expired',
             timestamp: new Date().toISOString(),
             changedBy: 'system',
             changedByRole: 'system',
             reason: 'Payment not completed within 10 minutes - slot released'
           }),
           updatedAt: admin.firestore.FieldValue.serverTimestamp()
         });
         
         // Notify user
         await sendNotification(booking.userId, {
           type: 'booking_expired',
           title: 'Booking Expired',
           body: 'Payment was not completed in time. The slot is now available for others.',
           data: { bookingId: doc.id }
         });
         
         console.log(`Released soft lock for booking ${doc.id}`);
       }
       
       return null;
     });
   ```

2. **Create functions/src/paymentFunctions.js:**

   **Function 2: checkPaymentTimeouts (Every 5 minutes)**
   
   This handles "awaiting_payment" bookings (after approval flow) where user didn't pay in time.
   
   ```javascript
   exports.checkPaymentTimeouts = functions.pubsub
     .schedule('*/5 * * * *')  // Every 5 minutes
     .timeZone('Asia/Kolkata')
     .onRun(async (context) => {
       const now = admin.firestore.Timestamp.now();
       
       // Find bookings awaiting payment with expired deadline
       const expiredPayments = await admin.firestore()
         .collection('bookings')
         .where('status', '==', 'awaiting_payment')
         .where('payment.advance.paymentDeadline', '<=', now)
         .get();
       
       console.log(`Found ${expiredPayments.size} expired payment deadlines`);
       
       for (const doc of expiredPayments.docs) {
         const booking = doc.data();
         
         // Update status to expired and release lock
         await doc.ref.update({
           status: 'expired',
           'payment.advance.isExpired': true,
           'slotLock': {
             isLocked: false,
             lockType: null,
             lockedAt: null,
             lockExpiry: null,
             lockReason: null
           },
           'statusHistory': admin.firestore.FieldValue.arrayUnion({
             status: 'expired',
             timestamp: new Date().toISOString(),
             changedBy: 'system',
             changedByRole: 'system',
             reason: 'Payment timeout - slot released'
           }),
           updatedAt: admin.firestore.FieldValue.serverTimestamp()
         });
         
         // Notify user
         await sendNotification(booking.userId, {
           type: 'booking_expired',
           title: 'Booking Expired ⏰',
           body: `Your booking for ${booking.turfName} expired. The slot is now available for others.`,
           data: { bookingId: doc.id }
         });
         
         // Notify manager
         await notifyTurfManagers(booking.turfId, {
           type: 'booking_expired',
           title: 'Booking Payment Expired',
           body: `${booking.userName}'s booking expired due to payment timeout.`,
           data: { bookingId: doc.id }
         });
         
         console.log(`Expired booking ${doc.id} due to payment timeout`);
       }
       
       return null;
     });
   ```

   **Function 3: sendPaymentVerificationReminders (Every 30 minutes)**
   ```javascript
   exports.sendPaymentVerificationReminders = functions.pubsub
     .schedule('*/30 * * * *')  // Every 30 minutes
     .timeZone('Asia/Kolkata')
     .onRun(async (context) => {
       const thirtyMinsAgo = admin.firestore.Timestamp.fromDate(
         new Date(Date.now() - 30 * 60 * 1000)
       );
       
       // Find bookings submitted > 30 mins ago and not yet verified
       const pendingVerifications = await admin.firestore()
         .collection('bookings')
         .where('status', '==', 'payment_submitted')
         .where('payment.advance.submittedAt', '<=', thirtyMinsAgo)
         .get();
       
       for (const doc of pendingVerifications.docs) {
         const booking = doc.data();
         const submittedAt = booking.payment.advance.submittedAt.toDate();
         const minutesPending = Math.floor((Date.now() - submittedAt.getTime()) / (1000 * 60));
         
         // Send reminder to managers
         await notifyTurfManagers(booking.turfId, {
           type: 'payment_verification_pending',
           title: '⏳ Payment Needs Verification',
           body: `${booking.userName}'s payment of ₹${booking.payment.advanceAmount} pending for ${minutesPending} mins`,
           data: { bookingId: doc.id }
         });
         
         // After 2 hours, escalate to owner
         if (minutesPending >= 120) {
           await notifyCompanyOwners(booking.companyId, {
             type: 'payment_verification_escalation',
             title: '🚨 Urgent: Payment Verification Overdue',
             body: `${booking.userName}'s payment pending for over 2 hours`,
             data: { bookingId: doc.id }
           });
         }
       }
       
       return null;
     });
   ```

   **Function 4: sendPaymentDeadlineReminders (Every 10 minutes)**
   ```javascript
   exports.sendPaymentDeadlineReminders = functions.pubsub
     .schedule('*/10 * * * *')  // Every 10 minutes
     .timeZone('Asia/Kolkata')
     .onRun(async (context) => {
       const now = Date.now();
       
       const awaitingPayment = await admin.firestore()
         .collection('bookings')
         .where('status', '==', 'awaiting_payment')
         .get();
       
       for (const doc of awaitingPayment.docs) {
         const booking = doc.data();
         const deadline = booking.payment.advance.paymentDeadline?.toDate();
         if (!deadline) continue;
         
         const minsRemaining = Math.floor((deadline.getTime() - now) / (1000 * 60));
         
         // Send reminders at 60, 30, 10 minutes before deadline
         if (minsRemaining === 60 || minsRemaining === 30 || minsRemaining === 10) {
           await sendNotification(booking.userId, {
             type: 'payment_reminder',
             title: `⏰ ${minsRemaining} minutes left to pay`,
             body: `Complete payment for your ${booking.turfName} booking before it expires.`,
             data: { bookingId: doc.id }
           });
         }
       }
       
       return null;
     });
   ```

3. **Helper Functions:**
   ```javascript
   // functions/src/helpers/notificationHelpers.js
   
   const admin = require('firebase-admin');
   
   async function sendNotification(userId, notification) {
     const userDoc = await admin.firestore().collection('users').doc(userId).get();
     const userData = userDoc.data();
     
     if (!userData) return;
     
     // Create notification document
     await admin.firestore().collection('notifications').add({
       userId,
       userRole: userData.role,
       type: notification.type,
       title: notification.title,
       body: notification.body,
       relatedId: notification.data?.bookingId || null,
       relatedType: 'booking',
       action: {
         screen: 'BookingDetails',
         params: notification.data || {}
       },
       isRead: false,
       createdAt: admin.firestore.FieldValue.serverTimestamp()
     });
     
     // Send FCM push notification
     if (userData.fcmTokens && userData.fcmTokens.length > 0) {
       try {
         await admin.messaging().sendMulticast({
           tokens: userData.fcmTokens,
           notification: {
             title: notification.title,
             body: notification.body
           },
           data: {
             type: notification.type,
             ...notification.data
           }
         });
       } catch (error) {
         console.error('FCM send error:', error);
       }
     }
   }
   
   async function notifyTurfManagers(turfId, notification) {
     const turfDoc = await admin.firestore().collection('turfs').doc(turfId).get();
     const turf = turfDoc.data();
     
     if (!turf || !turf.managerIds) return;
     
     for (const managerId of turf.managerIds) {
       await sendNotification(managerId, notification);
     }
   }
   
   async function notifyCompanyOwners(companyId, notification) {
     const companyDoc = await admin.firestore().collection('companies').doc(companyId).get();
     const company = companyDoc.data();
     
     if (!company || !company.ownerUserIds) return;
     
     for (const ownerId of company.ownerUserIds) {
       await sendNotification(ownerId, notification);
     }
   }
   
   module.exports = { sendNotification, notifyTurfManagers, notifyCompanyOwners };
   ```

4. **Update functions/index.js:**
   ```javascript
   const slotLockFunctions = require('./src/slotLockFunctions');
   const paymentFunctions = require('./src/paymentFunctions');
   
   // Slot Lock Functions
   exports.releaseExpiredSlotLocks = slotLockFunctions.releaseExpiredSlotLocks;
   
   // Payment Functions
   exports.checkPaymentTimeouts = paymentFunctions.checkPaymentTimeouts;
   exports.sendPaymentVerificationReminders = paymentFunctions.sendPaymentVerificationReminders;
   exports.sendPaymentDeadlineReminders = paymentFunctions.sendPaymentDeadlineReminders;
   ```

5. **Deploy Functions:**
   ```bash
   cd functions
   npm install
   firebase deploy --only functions
   ```

6. **Test Scenarios:**
   - Create a pending_payment booking, wait 10+ minutes, verify it expires
   - Create an awaiting_payment booking, verify deadline reminders send
   - Submit payment, wait 30+ minutes, verify manager reminder sends
   - Verify owner escalation after 2 hours

**Checkpoint:**
- Soft lock expiry function releases locks after 10 minutes
- Payment timeout function expires bookings correctly
- Verification reminders send every 30 mins
- Deadline reminders send at 60, 30, 10 mins
- Escalation to owner after 2 hours
- All notifications create documents and send FCM
- Functions deploy without errors
```

---

## Prompt 47: Subscription Payment System (Owner - Razorpay)
```
Create the subscription payment system for owners using Razorpay.

Note: This is the ONLY place where Razorpay is used. Booking advance payments use UPI.

**Requirements:**

1. **Setup Razorpay:**
   - Install: npm install react-native-razorpay (or expo alternative)
   - Create Razorpay account and get API keys
   - Store keys in environment variables

2. **Create src/api/razorpay/subscription.js:**
   ```javascript
   // Create order for subscription payment
   export async function createSubscriptionOrder(companyId, months, totalAmount) {
     // Call Cloud Function to create Razorpay order
     const response = await functions.httpsCallable('createSubscriptionOrder')({
       companyId,
       months,
       amount: totalAmount * 100 // Razorpay expects paise
     });
     return response.data;
   }
   
   // Initiate payment
   export async function initiateSubscriptionPayment(orderData, companyInfo) {
     const options = {
       key: RAZORPAY_KEY,
       amount: orderData.amount,
       currency: 'INR',
       name: 'Turf Booking Platform',
       description: `Subscription for ${orderData.months} month(s)`,
       order_id: orderData.orderId,
       prefill: {
         contact: companyInfo.phone,
         email: companyInfo.email
       },
       theme: { color: '#5D5FEF' }
     };
     
     return new Promise((resolve, reject) => {
       RazorpayCheckout.open(options)
         .then(resolve)
         .catch(reject);
     });
   }
   
   // Verify payment
   export async function verifySubscriptionPayment(paymentData) {
     const response = await functions.httpsCallable('verifySubscriptionPayment')(paymentData);
     return response.data;
   }
   ```

3. **Cloud Functions for Subscription:**
   ```javascript
   // functions/src/subscriptionPaymentFunctions.js
   
   exports.createSubscriptionOrder = functions.https.onCall(async (data, context) => {
     const { companyId, months, amount } = data;
     
     const razorpay = new Razorpay({
       key_id: functions.config().razorpay.key_id,
       key_secret: functions.config().razorpay.key_secret
     });
     
     const order = await razorpay.orders.create({
       amount: amount,
       currency: 'INR',
       receipt: `sub_${companyId}_${Date.now()}`
     });
     
     return {
       orderId: order.id,
       amount: order.amount,
       currency: order.currency
     };
   });
   
   exports.verifySubscriptionPayment = functions.https.onCall(async (data, context) => {
     const { orderId, paymentId, signature, companyId, months } = data;
     
     // Verify signature
     const crypto = require('crypto');
     const generatedSignature = crypto
       .createHmac('sha256', functions.config().razorpay.key_secret)
       .update(`${orderId}|${paymentId}`)
       .digest('hex');
     
     if (generatedSignature !== signature) {
       throw new functions.https.HttpsError('invalid-argument', 'Invalid signature');
     }
     
     // Update subscription
     const companyRef = admin.firestore().collection('companies').doc(companyId);
     const company = await companyRef.get();
     const currentEnd = company.data().subscription.subscriptionEndDate?.toDate() || new Date();
     const newEnd = new Date(Math.max(currentEnd.getTime(), Date.now()));
     newEnd.setMonth(newEnd.getMonth() + months);
     
     await companyRef.update({
       'subscription.status': 'active',
       'subscription.subscriptionEndDate': admin.firestore.Timestamp.fromDate(newEnd),
       'subscription.lastPaymentDate': admin.firestore.FieldValue.serverTimestamp(),
       'subscription.lastPaymentAmount': data.amount / 100,
       'subscription.paymentHistory': admin.firestore.FieldValue.arrayUnion({
         date: admin.firestore.FieldValue.serverTimestamp(),
         amount: data.amount / 100,
         method: 'online',
         transactionId: paymentId,
         months: months
       })
     });
     
     // Reactivate turfs if they were deactivated
     const turfs = await admin.firestore()
       .collection('turfs')
       .where('companyId', '==', companyId)
       .get();
     
     for (const turf of turfs.docs) {
       await turf.ref.update({ isActive: true });
     }
     
     return { success: true };
   });
   ```

4. **Create/Update src/screens/owner/SubscriptionScreen.js:**
   - Current subscription display
   - Pricing calculator based on grounds
   - Payment duration selector (1, 3, 6, 12 months)
   - Discount display for longer durations
   - Pay button → Razorpay checkout
   - Payment history list

**Checkpoint:**
- Subscription screen shows current status
- Pricing calculates correctly
- Razorpay checkout opens
- Payment verifies and updates subscription
- Turfs reactivate after payment
- Payment history shows
```

---

# WEEK 13-14: ANALYTICS, REVIEWS & NOTIFICATIONS

---

## Prompt 48: Manager Analytics Dashboard
```
[Keep original V2 Prompt 42 content]

Create the analytics dashboard for managers with turf-level metrics.

**Requirements:**

1. **Date Range Selector:** Today, Week, Month, Custom
2. **KPI Cards:** Bookings, Revenue, Utilization, Avg Value, Cancellation Rate
3. **Charts:**
   - Revenue Trend (Line)
   - Sport-wise Breakdown (Pie)
   - Peak Hours (Bar)
   - Ground Utilization (Bar)
4. **Data Table:** Sortable columns, Export button

**NEW V2.1 Addition:**
5. **Payment Breakdown Section:**
   - UPI Advance collected
   - Cash at venue collected
   - Online at venue collected
   - Payment verification rate

6. **Export Function:** Generate XLSX file with xlsx library

**Checkpoint:**
- All KPIs display correctly
- Charts render properly
- Payment breakdown shows UPI vs cash
- Export generates valid Excel file
```

---

## Prompt 49: Owner Analytics Dashboard
```
[Keep original V2 Prompt 43 content]

Create the owner analytics dashboard with company-wide metrics.

**Requirements:**

1. **Company-Wide KPIs:** Total Revenue, Bookings, Turfs, Managers, Utilization
2. **Cross-Turf Comparison Chart:** Revenue by turf
3. **Manager Performance Table:** Bookings, Revenue per manager
4. **Financial Summary:** Revenue vs Expenses, Profit/Loss
5. **Subscription ROI:** Revenue vs subscription cost

**NEW V2.1 Addition:**
6. **Payment Analytics:**
   - Total advance collected via UPI
   - Verification success rate
   - Average payment verification time
   - Payment timeout rate

**Checkpoint:**
- Company-wide metrics aggregate correctly
- Cross-turf comparison works
- Manager performance accurate
- Payment analytics display
```

---

## Prompt 50: Expense Tracking Feature
```
[Keep original V2 Prompt 44 - No changes needed]
```

---

## Prompt 51: Review System
```
[Keep original V2 Prompt 45 - No changes needed]
```

---

## Prompt 52: Notification System
```
[Keep original V2 Prompt 46 content]

**Additional V2.1 Notification Types:**
Add these to the notification types:

- `payment_verification_pending` - Manager: payment needs verification
- `payment_verification_escalation` - Owner: payment pending too long
- `payment_verified` - User: payment verified
- `payment_rejected` - User: payment not verified
- `booking_awaiting_payment` - User: approved, pay now
- `booking_expired` - User/Manager: payment timeout
- `payment_reminder` - User: X mins left to pay
- `turf_request_created` - Owner: manager requested turf
- `turf_request_approved` - Manager: turf request approved
- `turf_request_rejected` - Manager: turf request rejected

**Checkpoint:**
- All notification types work
- FCM delivers correctly
- In-app notifications show
```

---

# WEEK 14.5: ACADEMY SYSTEM

---

## Prompt 53: Academy Management Screen
```
[Keep original V2 Prompt 47 - No changes needed]
```

---

## Prompt 54: Academy Session Generation
```
[Keep original V2 Prompt 48 - No changes needed]
```

---

## Prompt 55: Academy Renewal System
```
[Keep original V2 Prompt 49 - No changes needed]
```

---

# WEEK 15: SUBSCRIPTION & TURF REQUESTS

---

## Prompt 56: Subscription Cloud Functions
```
[Keep original V2 Prompt 50 - No changes needed]
```
---

## Prompt 57: Manager Turf Request System (NEW V2.1)
```
Create the system for managers to request adding new turfs.

**Requirements:**

1. **Create turf_requests Collection:**
   ```javascript
   // turf_requests/{requestId}
   {
     requestId: "auto-generated",
     companyId: "companyId",
     requestedBy: "managerId",
     requestedByName: "Rahul Manager",
     requestedAt: timestamp,
     
     turfData: {
       name: "Green Arena - Powai",
       location: { /* full location object */ },
       operatingHours: { /* full hours object */ },
       images: ["gs://..."],
       coverImage: "gs://...",
       grounds: [ /* grounds array */ ],
       amenities: ["parking", "restrooms"],
       advancePayment: { /* advance config */ }
     },
     
     status: "pending",  // pending | approved | rejected
     
     // If approved
     approvedBy: "ownerId",
     approvedAt: timestamp,
     createdTurfId: "turfId",
     
     // If rejected
     rejectedBy: "ownerId",
     rejectedAt: timestamp,
     rejectionReason: "Location too close",
     
     createdAt: timestamp,
     updatedAt: timestamp
   }
   ```

2. **Add to Manager Dashboard:**
   - "Request New Turf" button (FAB or menu item)
   - Badge showing pending requests count

3. **Create src/screens/manager/TurfRequestScreen.js:**
   - Same multi-step form as AddTurfScreen (reuse components)
   - Step 1: Basic Details
   - Step 2: Location
   - Step 3: Operating Hours
   - Step 4: Grounds Setup
   - Step 5: Pricing
   - Step 6: Advance Payment Settings
   - Submit button: "Submit for Owner Approval"

4. **On Submit:**
   - Create turf_requests document
   - Status: "pending"
   - Notify all company owners
   - Show success message: "Request submitted! Owner will review."

5. **Manager's Pending Requests View:**
   - List of their submitted requests
   - Status badge (Pending/Approved/Rejected)
   - View details
   - If rejected: Show reason

**Checkpoint:**
- Manager can access turf request form
- All steps work correctly
- Request creates document
- Owners receive notification
- Manager can view their requests
```

---

## Prompt 58: Owner Turf Request Approval (NEW V2.1)
```
Create the owner interface for approving/rejecting turf requests.

**Requirements:**

1. **Add to Owner Dashboard:**
   - "Pending Turf Requests (2)" section
   - Shows when there are pending requests
   - Card for each request with quick actions

2. **Create src/screens/owner/PendingTurfRequestsScreen.js:**
   - List all pending requests
   - Each card shows:
     - Turf name
     - Location (city)
     - Requested by (manager name)
     - Request date
     - Ground count
     - Quick preview of details
     - [View Full] [Approve] [Reject] buttons

3. **Turf Request Details Modal/Screen:**
   - All turf details in read-only view
   - Images gallery
   - Location on map
   - Operating hours
   - Grounds and pricing
   - Advance payment config
   - Action buttons at bottom

4. **Approve Flow:**
   - Confirmation: "Approve this turf? The manager will be auto-assigned."
   - On confirm, trigger Cloud Function (from Prompt 46's function)
   - Show success message
   - Navigate back to list

5. **Reject Flow:**
   - Modal asking for rejection reason
   - Required input
   - On confirm:
     - Update request status to "rejected"
     - Add rejection reason
     - Notify manager
   - Show confirmation

6. **Cloud Function: onTurfRequestUpdated**
   (If not already created in Prompt 46)
   - Triggers on status change to "approved"
   - Creates turf document from turfData
   - Auto-assigns requesting manager
   - Updates company stats
   - Notifies manager

**Checkpoint:**
- Owner sees pending requests on dashboard
- Can view full request details
- Approve creates turf and assigns manager
- Reject asks for reason and notifies manager
- Stats update correctly
```

---

## Prompt 59: Turf Edit Logging System (NEW V2.1)
```
Create the audit logging system for turf edits.

**Requirements:**

1. **Create turf_edit_logs Collection:**
   ```javascript
   // turf_edit_logs/{logId}
   {
     logId: "auto-generated",
     turfId: "turfId",
     companyId: "companyId",
     editedBy: "managerId",
     editedByRole: "manager",  // "manager" | "owner"
     editedByName: "Rahul Manager",
     editType: "pricing_update",  // pricing_update | timing_update | advance_settings | ground_added | ground_removed | details_update
     changes: {
       field: "grounds[0].pricing.cricket.weekday.evening.hourlyRate",
       oldValue: 1500,
       newValue: 1800,
       summary: "Updated cricket evening rate from ₹1500 to ₹1800"
     },
     editedAt: timestamp
   }
   ```

2. **Create src/utils/turfEditLogger.js:**
   ```javascript
   export async function logTurfEdit(turfId, companyId, userId, userRole, userName, editType, changes) {
     await addDoc(collection(firestore, 'turf_edit_logs'), {
       turfId,
       companyId,
       editedBy: userId,
       editedByRole: userRole,
       editedByName: userName,
       editType,
       changes,
       editedAt: serverTimestamp()
     });
   }
   
   export function detectTurfChanges(before, after) {
     const changes = [];
     
     // Check pricing
     if (JSON.stringify(before.grounds) !== JSON.stringify(after.grounds)) {
       changes.push({
         type: 'pricing_update',
         field: 'grounds',
         summary: 'Ground/pricing configuration updated'
       });
     }
     
     // Check operating hours
     if (JSON.stringify(before.operatingHours) !== JSON.stringify(after.operatingHours)) {
       changes.push({
         type: 'timing_update',
         field: 'operatingHours',
         summary: 'Operating hours updated'
       });
     }
     
     // Check advance payment
     if (JSON.stringify(before.advancePayment) !== JSON.stringify(after.advancePayment)) {
       changes.push({
         type: 'advance_settings',
         field: 'advancePayment',
         summary: 'Advance payment settings updated'
       });
     }
     
     // Check name
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

3. **Integrate with Turf Editing:**
   - In EditTurfScreen, after saving:
     - Compare old vs new data
     - Log each significant change
   - In AdvancePaymentSettingsScreen, after saving:
     - Log advance payment changes

4. **Create src/screens/owner/TurfEditLogsScreen.js:**
   - List all edit logs for a turf (or all turfs)
   - Filter by turf, manager, date range, edit type
   - Each log shows:
     - Who made change
     - What changed (summary)
     - When
     - Before/after values if applicable
   - Infinite scroll with pagination

5. **Add to Owner Turf Details:**
   - "View Edit History" button
   - Opens TurfEditLogsScreen filtered for that turf

**Checkpoint:**
- Edits to turfs create log entries
- Log entries contain correct information
- Owner can view edit history
- Filters work correctly
- Pagination works
```

---

## Prompt 60: Owner Operations FAB (NEW V2.1)
```
Create the floating action button for owners with operational permissions.

**Requirements:**

1. **Update OwnerDashboardScreen.js:**
   Add FAB when hasOperationalPermissions is true:
   
   ```javascript
   {user.hasOperationalPermissions && (
     <FAB
       icon="briefcase-clock"
       label="Operations"
       style={styles.fab}
       onPress={navigateToOperationsMode}
     />
   )}
   ```

2. **Operations Mode Navigation:**
   When FAB pressed:
   - Navigate to a "Manager-like" interface
   - But owner still has owner privileges

3. **Create src/screens/owner/OperationsModeScreen.js:**
   - Similar to ManagerDashboardScreen
   - Turf selector dropdown (all turfs or selected from managedTurfIds)
   - Quick actions:
     - Pending Bookings
     - Today's Calendar
     - Chats
     - Verify Payments
   - Back button returns to Owner Dashboard

4. **Alternative: Tab Navigation Toggle**
   Instead of FAB, add toggle in header:
   ```
   [👔 Owner] ⇄ [🔧 Operations]
   ```
   - Owner mode: Shows owner dashboard
   - Operations mode: Shows manager-like dashboard

5. **Turf Selection in Operations Mode:**
   - If managedTurfIds is empty: Can select any turf
   - If managedTurfIds has values: Can only select those turfs
   - Selected turf persists during session

6. **Track Role in Actions:**
   - When owner approves booking in operations mode:
     - changedByRole should be "owner"
   - When owner verifies payment:
     - verifiedByRole should be "owner"

**Checkpoint:**
- FAB shows only for owners with operational permissions
- Operations mode shows manager-like interface
- Turf selection works correctly
- Actions track role as "owner"
- Can return to owner dashboard
```

---

# WEEK 16: ADMIN & CLEANUP

---

## Prompt 61: Admin Panel - Company Management
```
[Keep original V2 Prompt 51 content]

**Additional V2.1 Requirements:**
- Show UPI payment configuration status for each company
- Show payment verification metrics
- Manual ability to mark payments as verified (for support cases)

**Checkpoint:**
- Platform overview accurate
- Manual subscription update works
- Admin actions logged
- Can view company payment config
```

---

## Prompt 62: Suspension Cleanup Function
```
[Keep original V2 Prompt 52 - No changes needed]
```

---

## Prompt 63: Fraud Prevention System (NEW V2.1)
```
Create the fraud prevention system for payment abuse.

**Requirements:**

1. **Update User Schema:**
   Add to users/{userId}:
   ```javascript
   paymentHistory: {
     totalSubmissions: 0,
     verifiedPayments: 0,
     rejectedPayments: 0,
     lastRejectionDate: null,
     consecutiveRejections: 0,
     isBanned: false,
     banReason: "",
     banStartDate: null,
     banEndDate: null,  // null = permanent
     bannedBy: null
   }
   ```

2. **Track Payment Attempts:**
   When payment is verified:
   - Increment totalSubmissions and verifiedPayments
   - Reset consecutiveRejections to 0
   
   When payment is rejected:
   - Increment totalSubmissions and rejectedPayments
   - Increment consecutiveRejections
   - Set lastRejectionDate

3. **Auto-Ban Logic:**
   When consecutiveRejections >= 3:
   - Set isBanned = true
   - Set banReason = "Multiple failed payment verifications"
   - Set banStartDate = now
   - Set banEndDate = 7 days from now (temporary)
   - Notify user

4. **Ban Check on Booking:**
   Before allowing user to book:
   ```javascript
   function canUserBook(user) {
     if (!user.paymentHistory?.isBanned) return true;
     if (user.paymentHistory.banEndDate === null) return false; // Permanent
     if (user.paymentHistory.banEndDate.toDate() > new Date()) return false;
     return true; // Ban expired
   }
   ```

5. **Transaction ID Reuse Prevention:**
   Before accepting payment submission:
   - Check company's verifiedTransactions array
   - If transactionId already exists, reject: "This transaction ID has already been used"

6. **Add Verified Transaction Tracking:**
   When payment is verified:
   ```javascript
   await updateDoc(companyRef, {
     verifiedTransactions: arrayUnion({
       txnId: transactionId,
       date: new Date().toISOString().split('T')[0],
       amount: amount,
       bookingId: bookingId
     })
   });
   ```

7. **Cloud Function: Cleanup Old Transactions**
   Daily, remove verifiedTransactions older than 90 days

8. **Admin Panel Addition:**
   - View banned users
   - Unban user manually
   - View user's payment history

**Checkpoint:**
- Payment stats tracked per user
- Auto-ban after 3 consecutive rejections
- Banned users cannot book
- Transaction ID reuse prevented
- Admin can manage bans
```

---

# WEEK 17-20: TESTING & DEPLOYMENTd

---

## Prompt 64: E2E Testing (Updated for V2.1)
```
[Based on V2 Prompt 53, with V2.1 additions]

**Additional Test Scenarios for V2.1:**

**Slot Locking Tests (CRITICAL):**
- [ ] User A selects slot → Slot shows available
- [ ] User A proceeds to booking summary → Still available
- [ ] User A clicks "Pay & Book" → Soft lock created (10 min)
- [ ] User B tries same slot → Shows "Try again in 10 mins"
- [ ] User B cannot proceed to payment for locked slot
- [ ] User A completes payment → Soft lock converts to hard lock
- [ ] User B still sees slot as unavailable
- [ ] User A abandons payment → After 10 mins, lock released
- [ ] User B can now book the slot
- [ ] Concurrent booking attempt → Only one succeeds (transaction)

**Before Approval Flow Tests:**
- [ ] User pays first → Status: pending_payment
- [ ] Payment submitted → Status: payment_submitted (hard lock)
- [ ] Manager verifies → Status: pending (still locked)
- [ ] Manager approves → Status: confirmed
- [ ] Manager rejects after payment → Lock released, refund tracked

**After Approval Flow Tests:**
- [ ] Multiple users request same slot → All get status: pending (no lock)
- [ ] Manager approves User A → User A gets awaiting_payment (hard lock)
- [ ] Other pending requests → Auto-rejected with notification
- [ ] User A pays within timeout → Status: confirmed
- [ ] User A misses timeout → Status: expired, lock released

**UPI Payment Flow Tests:**
- [ ] User can see UPI payment screen when advance required
- [ ] Countdown timer shows and counts down from 10:00
- [ ] Timer turns red when < 60 seconds
- [ ] Timer expires → User kicked back with message
- [ ] Back button shows warning about losing slot
- [ ] UPI deep link opens with correct details
- [ ] Screenshot upload works
- [ ] Transaction ID validation works
- [ ] Payment submission updates booking status
- [ ] Manager receives verification notification
- [ ] Manager can view and verify payment
- [ ] Manager can reject with reason
- [ ] User notified on verification/rejection
- [ ] Retry flow works (up to 3 attempts)
- [ ] Booking cancelled after 3 failed attempts

**Payment Timing Tests:**
- [ ] Before approval: User pays → Manager verifies → Manager approves
- [ ] After approval: Manager approves → User pays → Manager verifies
- [ ] Payment timeout expires booking correctly
- [ ] Reminder notifications send at correct times (60, 30, 10 mins)
- [ ] Verification reminders send every 30 mins to manager
- [ ] Owner escalation after 2 hours

**Turf Request Tests:**
- [ ] Manager can submit turf request
- [ ] Owner receives notification
- [ ] Owner can view request details
- [ ] Owner can approve → Turf created
- [ ] Owner can reject with reason → Manager notified

**Fraud Prevention Tests:**
- [ ] Transaction ID reuse blocked
- [ ] User banned after 3 consecutive rejections
- [ ] Banned user cannot book
- [ ] Ban expires correctly (7 days)

**Edge Cases:**
- [ ] UPI app not installed → QR fallback works
- [ ] Network failure during payment submission → Graceful error
- [ ] Concurrent payment verification → No race condition
- [ ] Company without UPI configured → Shows setup message
- [ ] User closes app during payment → Can resume from booking history
- [ ] Manager tries to approve already-locked slot → Error message
- [ ] Cloud function misses execution → Next run catches up

**Performance Tests:**
- [ ] Slot availability check < 500ms
- [ ] Lock creation < 200ms
- [ ] Booking summary loads < 1 second
- [ ] Payment screen loads < 1 second

**Checkpoint:**
- All test scenarios pass
- Slot locking prevents double booking
- Performance targets met
- Edge cases handled gracefully
```

---

## Prompt 65: Bug Fixes & Optimization
```
[Keep original V2 Prompt 54, with V2.1 considerations]

**Additional V2.1 Optimizations:**
- Image compression for payment screenshots
- Efficient queries for payment verification pending list
- Cache company payment config
- Optimize turf edit log queries

**Checkpoint:**
- No known bugs
- App runs smoothly
- Security audit passed
```

---

## Prompt 66: Web Version Optimization
```
[Keep original V2 Prompt 55 - No changes needed]

**V2.1 Note:**
- UPI deep links won't work on web
- Show QR code prominently for web users
- Add "Open in mobile app" suggestion for payment
```

---

## Prompt 67: Deployment Preparation
```
[Keep original V2 Prompt 56, updated for V2.1]

**Additional V2.1 Checklist:**
- [ ] All payment Cloud Functions deployed
- [ ] Payment reminder schedules active
- [ ] Fraud prevention functions active
- [ ] turf_requests collection security rules deployed
- [ ] turf_edit_logs collection security rules deployed
- [ ] Company payment config migration run (for existing companies)
- [ ] Turf advance payment config migration run

**Checkpoint:**
- All assets ready
- EAS builds successful
- Cloud Functions deployed
- Monitoring active
```

---

## Prompt 68: Launch Checklist (Updated for V2.1)
```
[Based on V2 Prompt 57, with V2.1 additions]

**V2.1 Specific Checklist:**

**Payment System:**
- [ ] UPI payment flow tested end-to-end
- [ ] Payment verification flow tested
- [ ] Payment timeout tested
- [ ] Fraud prevention tested
- [ ] All payment notifications working

**Turf Requests:**
- [ ] Request submission tested
- [ ] Approval/rejection tested
- [ ] Notifications working

**Edit Logging:**
- [ ] All edit types logged correctly
- [ ] Logs viewable by owner

**Data Migrations:**
- [ ] Existing companies have paymentConfig (default UPI disabled)
- [ ] Existing turfs have advancePayment (default not required)

**Checkpoint:**
- All V2 + V2.1 checklist items complete
- Apps submitted to stores
- Web version live
- Team ready for support
```

---

# 📋 QUICK REFERENCE

## V2.1 New Status Flow
```
NO ADVANCE:
pending → confirmed → in_progress → completed

BEFORE APPROVAL (UPI):
pending_payment → payment_submitted → pending → confirmed → ...
       ↓ (rejected)
  payment_rejected → (retry) → payment_submitted → ...

AFTER APPROVAL (UPI):
pending → awaiting_payment → payment_submitted → confirmed → ...
               ↓ (timeout)
            expired
```

## V2.1 New Collections
- `turf_requests` - Manager turf requests
- `turf_edit_logs` - Audit trail for turf edits

## V2.1 New Screens
| Screen | Role | Purpose |
|--------|------|---------|
| PaymentSettingsScreen | Owner | Configure UPI |
| AdvancePaymentSettingsScreen | Manager | Configure advance |
| UpiPaymentScreen | User | Make UPI payment |
| PaymentConfirmationScreen | User | Submit proof |
| PaymentSubmittedScreen | User | Success message |
| VerifyPaymentScreen | Manager | Verify payment |
| TurfRequestScreen | Manager | Request new turf |
| PendingTurfRequestsScreen | Owner | Approve/reject |
| TurfEditLogsScreen | Owner | View edit history |
| OperationsModeScreen | Owner | Manager-like interface |

## Payment Method Summary
| Payment Type | Method | Fee |
|--------------|--------|-----|
| Booking Advance | UPI Direct | 0% |
| On-ground Payment | Cash/UPI | 0% |
| Owner Subscription | Razorpay | 2% |

---

**Total Prompts: 68 (was 57)**
**New Prompts Added: 15**
**Estimated Additional Time: 2-3 weeks**

**Good luck with your development! 🚀**
