# Super Admin Panel — Project Plan

**Project codename:** `turf-admin-panel`
**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · shadcn/ui · Firebase Web SDK + Admin SDK · TanStack Query
**Hosting:** Vercel
**Backend:** Same Firebase project as `Turf-1701` mobile app (`sowin-power`)
**Status:** Planning — mobile admin section being removed in parallel

---

## 1. Why a Separate Web Panel?

The admin section in the mobile app was 31 screens of placeholder scaffolds (`AdminScaffold` component, ~876 LOC) with zero real implementation. Before any of it was built, we made the call to extract it. The reasons:

| Problem with mobile admin | Web panel solves it |
|---|---|
| Every release goes through Play Store / App Store review (1–7 days) | Vercel deploy is ~30 seconds, no review |
| Dashboards, tables, CSV exports, and bulk ops are awful on a phone | Desktop layouts: data tables, multi-column views, keyboard shortcuts |
| Admin code ships in EVERY user's app bundle (~30–40% size cost) | Admin code lives only on the web; mobile bundle is leaner |
| Internal team needs to install dev builds or get TestFlight access | Anyone with admin role just visits `admin.yourdomain.com` |
| Two codebases drift (RN admin vs internal tooling) | One panel, one source of truth |
| No real auditing tools, file uploads, or PDF generation on RN | First-class on web |

**The kicker:** mobile admin was never built. We're not migrating, we're greenfielding.

---

## 2. Architecture Overview

```
┌─────────────────────┐         ┌─────────────────────┐
│   Mobile App (RN)   │         │  Admin Panel (Web)  │
│   user / caretaker  │         │   admin / staff     │
│   manager / owner   │         │                     │
└──────────┬──────────┘         └──────────┬──────────┘
           │                               │
           │       Firebase (sowin-power)  │
           │                               │
           ▼                               ▼
   ┌────────────────────────────────────────────┐
   │  Firestore  ·  Auth  ·  Storage  ·  FCM    │
   │           Cloud Functions (shared)         │
   └────────────────────────────────────────────┘
```

**Key principle:** the mobile app and web panel are two clients of the **same Firebase backend**. They share data, security rules, Cloud Functions, and storage. They do **not** share UI code.

---

## 3. Tech Stack & Why

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js 14 (App Router) | Server components for data fetching, server actions for mutations, file-based routing, Vercel-native |
| Language | TypeScript | Type-safety against shared Firestore schema |
| Styling | Tailwind CSS + shadcn/ui | Fast iteration, copy-paste components, no runtime CSS-in-JS overhead |
| Data fetching (client) | TanStack Query (React Query) | Caching, optimistic updates, real-time refetch |
| Forms | React Hook Form + Zod | Schema validation matches Firestore schema |
| Tables | TanStack Table | Sortable, filterable, paginated data tables |
| Charts | Recharts or Tremor | Dashboards, analytics |
| Auth | Firebase Auth (Web SDK) | Same auth as mobile; users can log in with same credentials |
| Server-side Firebase | Firebase Admin SDK | Used in API routes / server actions for privileged ops, custom claims |
| Hosting | Vercel | Zero-config Next.js deploys, preview branches, edge functions |
| Domain | `admin.<yourdomain>.com` | Subdomain isolation |

---

## 4. Authentication & Authorization

### 4.1 The Custom Claims Pattern

**Do not** check `user.role === "admin"` from a Firestore document on the client. That field is mutable and can leak. Instead use **Firebase Auth custom claims**.

```ts
// One-time setup script (run via Firebase Admin SDK):
import { auth } from 'firebase-admin'
await auth().setCustomUserClaims(uid, { role: 'super_admin' })
```

After this, the user's ID token contains `{ role: 'super_admin' }` — verifiable on the server, in security rules, and immutable from the client.

### 4.2 Roles

```ts
type AdminRole =
  | 'super_admin'    // Full access, can manage other admins
  | 'support_admin'  // Tickets, disputes, user help
  | 'finance_admin'  // Subscriptions, refunds, payment verification
  | 'read_only'      // Auditors, read everything, write nothing
```

### 4.3 Auth Flow

1. User goes to `admin.yourdomain.com` → redirected to `/login`
2. Firebase Auth sign-in (email/password or Google)
3. Server reads ID token, checks custom claim `role`
4. If no admin role → sign out, show "Not authorized"
5. If admin role → set HTTP-only session cookie, redirect to `/dashboard`
6. Middleware protects all `/(admin)` routes
7. Per-route role checks (e.g., `/refunds` requires `finance_admin` or `super_admin`)

### 4.4 Firestore Security Rules

```js
match /admin_logs/{doc} {
  allow read: if request.auth.token.role in ['super_admin', 'support_admin', 'finance_admin', 'read_only'];
  allow write: if request.auth.token.role in ['super_admin', 'support_admin', 'finance_admin'];
}

match /companies/{id} {
  allow read: if request.auth != null;  // mobile users can read
  allow write: if request.auth.token.role in ['super_admin', 'finance_admin']
               || /* existing owner check */;
}

match /feature_flags/{doc} {
  allow read: if true;  // mobile reads flags
  allow write: if request.auth.token.role == 'super_admin';
}
```

---

## 5. Project Structure

```
turf-admin-panel/
├── app/
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx
│   ├── (admin)/
│   │   ├── layout.tsx              # Sidebar + header shell
│   │   ├── dashboard/
│   │   │   └── page.tsx
│   │   ├── companies/
│   │   │   ├── page.tsx            # CompanyList
│   │   │   └── [id]/
│   │   │       └── page.tsx        # CompanyDetail
│   │   ├── users/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── bookings/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── payments/
│   │   │   ├── verification/page.tsx
│   │   │   ├── refunds/page.tsx
│   │   │   └── fraud/page.tsx
│   │   ├── subscriptions/
│   │   │   ├── page.tsx
│   │   │   ├── [id]/page.tsx
│   │   │   └── new/page.tsx        # ManualSubscription
│   │   ├── support/
│   │   │   ├── tickets/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   └── disputes/
│   │   │       ├── page.tsx
│   │   │       └── [id]/page.tsx
│   │   ├── moderation/
│   │   │   └── reviews/page.tsx
│   │   ├── system/
│   │   │   ├── health/page.tsx
│   │   │   ├── errors/page.tsx
│   │   │   └── costs/page.tsx
│   │   ├── analytics/page.tsx
│   │   ├── reports/page.tsx
│   │   ├── config/
│   │   │   ├── pricing/page.tsx
│   │   │   ├── booking/page.tsx
│   │   │   ├── notifications/page.tsx
│   │   │   └── flags/page.tsx
│   │   ├── admins/page.tsx         # AdminManagement
│   │   ├── audit/page.tsx
│   │   └── bulk/page.tsx
│   ├── api/
│   │   └── admin/
│   │       ├── verify-payment/route.ts
│   │       ├── ban-user/route.ts
│   │       ├── refund/route.ts
│   │       └── ...
│   ├── layout.tsx
│   └── middleware.ts               # Route protection
├── components/
│   ├── ui/                         # shadcn primitives
│   ├── data-table/
│   ├── charts/
│   ├── sidebar.tsx
│   └── audit-log-entry.tsx
├── lib/
│   ├── firebase/
│   │   ├── client.ts               # Web SDK init
│   │   ├── admin.ts                # Admin SDK init (server-only)
│   │   └── auth.ts                 # Session cookie helpers
│   ├── queries/                    # TanStack Query hooks per collection
│   │   ├── use-companies.ts
│   │   ├── use-users.ts
│   │   └── ...
│   ├── mutations/                  # Server actions
│   ├── types/                      # Shared schema types
│   └── utils/
├── public/
├── .env.local                      # Firebase config + service account
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 6. Data Model (Shared with Mobile)

All collections already exist in the `sowin-power` Firebase project. Schema is **read** here — we don't redefine it, we just type it.

### Collections the panel reads from

| Collection | Purpose | Used by panel screens |
|---|---|---|
| `users` | All users (any role) | Users, Bookings, Disputes |
| `companies` | Turf operator companies | Companies, Subscriptions, Audit |
| `turfs` | Turf properties | Companies → Turfs tab |
| `bookings` | Every booking | Bookings, Disputes, Refunds |
| `subscriptions` | Company subscription state | Subscriptions, Dashboard |
| `payment_submissions` | UPI proof uploads awaiting verification | Payment Verification queue |
| `chats` | Negotiation/support threads | User Detail, Booking Detail |
| `reviews` | User reviews | Review Moderation |

### Collections the panel writes to (admin-only)

| Collection | Purpose | Created by |
|---|---|---|
| `admin_logs` | Every admin action — who, what, target, before/after, timestamp, reason | Every mutation in panel |
| `admin_users` | Admin role + permissions registry | AdminManagement screen |
| `fraud_flags` | User fraud flags (manual + auto) | Fraud Dashboard, Cloud Functions |
| `refunds` | Refund records | Booking Detail, RefundTracker |
| `disputes` | Booking disputes | DisputeList |
| `support_tickets` | Support cases | SupportTicketList |
| `feature_flags` | Runtime feature toggles | FeatureFlagsScreen |
| `notification_templates` | Push/SMS templates | NotificationTemplates |
| `pricing_config` | Subscription tier pricing | PricingConfig |
| `booking_config` | Booking system settings | BookingConfig |
| `error_logs` | Cloud Function errors (written by CF, read by panel) | (CF writes, panel reads) |
| `cost_logs` | API usage costs (written by CF) | (CF writes, panel reads) |

### TypeScript types

Mirror the schema in `lib/types/`:

```ts
// lib/types/booking.ts
export interface Booking {
  id: string
  userId: string
  userName: string
  userPhone: string
  companyId: string
  turfId: string
  groundId: string
  date: string                     // YYYY-MM-DD
  startTime: string                // HH:mm
  endTime: string
  status: BookingStatus
  payment: {
    advance: { amount: number; totalCollected: number; ... }
    onGround: { amount: number; totalCollected: number; ... }
    online:   { amount: number; totalCollected: number; ... }
  }
  // ...
}
```

---

## 7. Cloud Functions

The panel **does not** run privileged DB writes from the client. Anything sensitive goes through a Cloud Function or Next.js API route (which uses Firebase Admin SDK server-side).

### Functions to implement (in `functions/` of mobile repo, shared)

**Payments:**
- `verifyPayment({bookingId, adminId})` — mark payment verified
- `rejectPayment({bookingId, reason, adminId})`
- `initiateRefund({bookingId, amount, reason})`
- `markRefundCompleted({refundId})`

**Users:**
- `banUser({userId, durationDays, reason})` — `null` durationDays = permanent
- `unbanUser({userId, reason})`
- `forceLogout({userId})` — revoke refresh tokens
- `deleteUserAccount({userId, reason})` — soft-delete + anonymize
- `mergeDuplicateUsers({primaryUid, duplicateUids})`

**Subscriptions:**
- `manuallyActivateSubscription({companyId, plan, durationMonths, paymentRecord})`
- `extendTrial({companyId, days, reason})`
- `applyDiscount({companyId, percentOff, durationMonths})`
- `pauseSubscription({companyId, reason})`
- `forceExpireSubscription({companyId, reason})`
- `generateInvoice({subscriptionId})` — returns Storage URL

**Disputes & Support:**
- `requestEvidence({disputeId, message})`
- `resolveDispute({disputeId, decision, refundAmount?})`

**Bulk:**
- `batchSendNotification({filter, title, body})`
- `batchExtendTrial({companyIds, days})`
- `batchExportData({collection, filters})`
- `batchDeactivateExpiredCompanies()`

**Auth admin:**
- `setAdminRole({uid, role})` — sets custom claim, super_admin only
- `revokeAdminRole({uid})`

### Function pattern

```ts
// functions/src/admin/banUser.ts
export const banUser = onCall(async (request) => {
  // 1. Verify caller is admin via custom claim
  if (!['super_admin', 'support_admin'].includes(request.auth?.token.role)) {
    throw new HttpsError('permission-denied', 'Admin only')
  }

  const { userId, durationDays, reason } = request.data

  // 2. Update user doc
  await db.collection('users').doc(userId).update({
    banned: true,
    banExpiresAt: durationDays
      ? Timestamp.fromMillis(Date.now() + durationDays * 86400e3)
      : null,  // permanent
    banReason: reason,
  })

  // 3. Revoke active sessions
  await admin.auth().revokeRefreshTokens(userId)

  // 4. Write audit log
  await db.collection('admin_logs').add({
    adminId: request.auth.uid,
    adminEmail: request.auth.token.email,
    action: 'ban_user',
    targetType: 'user',
    targetId: userId,
    payload: { durationDays, reason },
    createdAt: FieldValue.serverTimestamp(),
  })

  return { success: true }
})
```

**Every mutation writes to `admin_logs`.** No exceptions.

---

## 8. Build Order (P0 → P3)

Build the panel in priority order. Don't try to do everything at once.

### **Sprint 0 — Foundation (1 week)**
- Next.js project setup, Tailwind, shadcn/ui, TanStack Query
- Firebase Web SDK + Admin SDK init
- Login page + session cookie + middleware
- Set custom claim script for first super_admin
- Sidebar layout + protected route shell
- Empty `/dashboard` page proving auth works end-to-end

### **Sprint 1 — P0 (2 weeks)**
- Dashboard with KPI cards (counts only — no charts yet)
- User list (search, filter, pagination, sortable table)
- Company list (same)
- Booking list (same)
- Payment verification queue (the most P0 of P0 — manual UPI verification is daily ops)
- `admin_logs` viewer (Audit Log)

### **Sprint 2 — P1 (2 weeks)**
- User Detail (6 tabs)
- Company Detail (6 tabs)
- Booking Detail (full timeline + actions)
- Subscription list + detail
- Manual subscription creation form
- Refund tracker

### **Sprint 3 — P2 (2 weeks)**
- Support tickets (list + detail with message thread)
- Dispute resolution
- Review moderation
- Fraud dashboard
- Platform analytics with charts (Recharts)

### **Sprint 4 — P3 (2 weeks)**
- System health (Firebase quota monitoring)
- Error logs viewer (real-time tail of Cloud Function errors)
- Cost tracker
- Reports (PDF/Excel generation, scheduled jobs)
- Bulk operations
- All config screens (pricing, booking, notification templates, feature flags)
- Admin management (managing other admins)

---

## 9. Real-time vs Polling

Some screens benefit from real-time updates:

| Screen | Strategy |
|---|---|
| Payment verification queue | **Real-time** Firestore `onSnapshot` — new submissions pop in |
| Support ticket detail | **Real-time** message thread |
| Error logs | **Polling** every 10s (high volume, real-time would be expensive) |
| Dashboard KPIs | **Server-side rendering** with `revalidate: 60` (1 min cache) |
| Tables (companies, users, bookings) | **TanStack Query** with manual refresh + background refetch |

---

## 10. Mobile App Cleanup (Companion Work)

Done in parallel with this plan, in the mobile repo:

1. ✅ Delete `src/screens/admin/` (entire folder, 31 files)
2. ✅ Delete `src/navigation/AdminNavigator.js`
3. ✅ Remove `AdminNavigator` export from `src/navigation/index.js`
4. ✅ Update `src/navigation/RootNavigator.js` — remove the `admin` case from the role switch
5. ✅ Keep `"admin"` in `src/constants/roles.js` — still valid in Firestore, but mobile never authenticates one (admins log in directly to the web panel)
6. ✅ Verify `useAuth` and any role checks still compile

Admins **do not** sign in to the mobile app. They go straight to the web panel URL. No redirect screen is needed in the mobile app.

**Bundle savings:** ~876 LOC + dependent imports + removed navigation tree.

---

## 11. Environment Variables

```bash
# .env.local (Vercel: same vars in dashboard)

# Public — exposed to browser
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=sowin-power.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=sowin-power
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Server-only — Admin SDK
FIREBASE_ADMIN_PROJECT_ID=sowin-power
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=

# Session
SESSION_SECRET=               # for JWT cookie signing
```

The Admin SDK service account JSON: download from Firebase Console → Project Settings → Service Accounts → Generate new private key. **Never commit it.** Paste fields into Vercel env.

---

## 12. Deployment

**Initial setup:**
1. Push repo to GitHub
2. Import to Vercel — auto-detects Next.js
3. Add env vars in Vercel dashboard
4. Add custom domain `admin.yourdomain.com` → Vercel handles SSL
5. Every push to `main` = production deploy
6. Every PR = preview deploy with unique URL

**Branch strategy:**
- `main` → production (`admin.yourdomain.com`)
- `develop` → staging (`admin-staging.yourdomain.com`)
- Feature branches → preview URLs

---

## 13. Step-by-Step: How to Start

```bash
# 1. Create the project
npx create-next-app@latest turf-admin-panel \
  --typescript --tailwind --app --src-dir --import-alias "@/*"

cd turf-admin-panel

# 2. Install core deps
npm install firebase firebase-admin @tanstack/react-query \
  react-hook-form @hookform/resolvers zod \
  @tanstack/react-table recharts \
  lucide-react clsx tailwind-merge

# 3. Add shadcn/ui
npx shadcn@latest init
npx shadcn@latest add button card table dialog form input \
  select dropdown-menu sidebar badge

# 4. Set up Firebase Web SDK
# → Create lib/firebase/client.ts (initializeApp + getAuth + getFirestore)

# 5. Set up Firebase Admin SDK
# → Create lib/firebase/admin.ts (server-only, import 'server-only')

# 6. Build login page + middleware
# → Use Firebase Auth signInWithEmailAndPassword
# → Get ID token, send to /api/session, server verifies + sets cookie
# → middleware.ts checks cookie on all /(admin) routes

# 7. One-time: set first super_admin
# → Run a node script using Admin SDK:
#   admin.auth().setCustomUserClaims(YOUR_UID, { role: 'super_admin' })

# 8. Build the dashboard layout (sidebar, header, content area)

# 9. Build /dashboard with hardcoded data first, then wire to Firestore

# 10. Iterate through screens by priority (Sprint 1 list above)
```

---

## 14. Open Decisions

Things to nail down before Sprint 1:

- [ ] Domain name for the panel (`admin.X.com` — what's X?)
- [ ] Will super_admins be invited via Firebase Console manually, or via a self-service invite flow?
- [ ] Email/password login or Google sign-in only? (Google is more secure for staff)
- [ ] Two-factor auth requirement? (Recommended for super_admin)
- [ ] Audit log retention — keep forever, or auto-archive after N months?
- [ ] Real-time Firestore listeners cost — set a quota alert
- [ ] Who pays the Vercel bill — free tier handles this for a while

---

## 15. Maintenance & Ops

**Daily:**
- Payment verification queue (the most-used screen)
- New support tickets
- Error log spikes

**Weekly:**
- Refund tracker — anything overdue
- Dispute resolution turnaround
- Subscription renewals coming up

**Monthly:**
- Auto-generated business reports
- Cost tracker review
- Feature flag cleanup (remove flags for shipped features)

**Quarterly:**
- Audit log review
- Admin user permission audit (revoke ex-staff)
- Firestore security rules review

---

## 16. Migration Checklist (Mobile → Web)

### Mobile repo (this repo)
- [x] Delete `src/screens/admin/` directory
- [x] Delete `src/navigation/AdminNavigator.js`
- [x] Remove `AdminNavigator` export from `src/navigation/index.js`
- [x] Remove the `admin` case from `getMainNavigator` in `src/navigation/RootNavigator.js`
- [ ] Run app, verify no broken imports
- [ ] Commit: `chore: remove admin section, moving to separate web panel`

### Firebase
- [ ] Add custom claims for first super_admin (manual one-time script)
- [ ] Update Firestore security rules to use `request.auth.token.role` for admin checks
- [ ] Deploy updated rules

### New web repo
- [ ] Create `turf-admin-panel` repo on GitHub
- [ ] Follow Section 13 step-by-step
- [ ] Connect to Vercel
- [ ] Configure custom domain
- [ ] Sprint 0 deliverable: working login + protected dashboard

---

## 17. Reference Material

- **Next.js App Router docs:** https://nextjs.org/docs/app
- **Firebase Web SDK:** https://firebase.google.com/docs/web/setup
- **Firebase Admin SDK:** https://firebase.google.com/docs/admin/setup
- **Custom claims:** https://firebase.google.com/docs/auth/admin/custom-claims
- **shadcn/ui:** https://ui.shadcn.com
- **TanStack Query:** https://tanstack.com/query
- **TanStack Table:** https://tanstack.com/table
- **Vercel deploy:** https://vercel.com/docs/frameworks/nextjs

---

**Last updated:** 2026-05-09
**Owner:** Tanmay
**Status:** Ready to start Sprint 0 once mobile cleanup is merged
