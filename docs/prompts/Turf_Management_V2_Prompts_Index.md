# 🏟️ TURF MANAGEMENT SYSTEM V2 - PROMPT INDEX & QUICK REFERENCE

## 📚 Document Structure

The complete development guide is split into 3 parts:
- **Part 1**: Prompts 1-12 (Weeks 1-4) - Setup, Auth, Owner Basics
- **Part 2**: Prompts 13-36 (Weeks 3-11) - Features, Booking, Chat
- **Part 3**: Prompts 37-57 (Weeks 11-20) - Advanced, Testing, Deployment

---

## 📋 COMPLETE PROMPT INDEX

### PHASE 1: FOUNDATION & MVP (Weeks 1-12)

#### Week 1-2: Project Setup & Authentication
| # | Prompt | Description | Part |
|---|--------|-------------|------|
| 1 | Project Initialization | Expo setup, folder structure, dependencies | 1 |
| 2 | Firebase Configuration | Auth, Firestore, Storage setup | 1 |
| 3 | Redux Store Setup | All slices, middleware, persistence | 1 |
| 4 | Navigation Setup | Role-based routing for 5 roles | 1 |
| 5 | Common UI Components | Button, Input, Card, etc. | 1 |
| 6 | Login & OTP Screens | Phone auth, OTP verification | 1 |
| 7 | Role Selection & Profile | Role picker, profile setup | 1 |
| 8 | Owner Company Setup | Company creation, invite code | 1 |
| 9 | Join Company Flow | Manager/Caretaker invite code | 1 |
| 10 | Firestore Security Rules | Complete rules for 4-tier system | 1 |

#### Week 3-4: Owner - Company & Turf Management
| # | Prompt | Description | Part |
|---|--------|-------------|------|
| 11 | Owner Dashboard | Company-wide stats, overview | 1 |
| 12 | Turf Management | Add/Edit turfs, grounds, pricing | 1 |
| 13 | Pricing Configurator | Sport/time-based pricing component | 2 |
| 14 | Invite Code Management | View, copy, share, regenerate | 2 |
| 15 | Manager Management | View, suspend, modify turfs | 2 |
| 16 | Caretaker Management | Assign, reassign, suspend | 2 |
| 17 | Operational Settings | Toggle permissions, select turfs | 2 |

#### Week 5-6: User - Turf Discovery & Booking
| # | Prompt | Description | Part |
|---|--------|-------------|------|
| 18 | User Home Screen | Search, filters, turf cards | 2 |
| 19 | Turf Detail Screen | Images, pricing, reviews, CTA | 2 |
| 20 | Booking Flow | Date → Sport → Time → Ground | 2 |
| 21 | Booking Confirmation | 5-second dialog, create booking | 2 |
| 22 | Price Calculation | Pricing engine, time breakdown | 2 |
| 23 | Booking History | Upcoming, completed, cancel | 2 |

#### Week 7-8: Manager - Booking Management
| # | Prompt | Description | Part |
|---|--------|-------------|------|
| 24 | Manager Dashboard | Turf-level stats, quick actions | 2 |
| 25 | Turf Selection | Multi-turf managers | 2 |
| 26 | Booking Management | Approve/reject with conflict check | 2 |
| 27 | Calendar View | Month/week/day, all booking types | 2 |
| 28 | Manual Booking | Offline booking creation | 2 |
| 29 | Slot Blocking | Maintenance, events blocking | 2 |

#### Week 9-10: Chat System
| # | Prompt | Description | Part |
|---|--------|-------------|------|
| 30 | Chat Architecture | Firebase setup, hooks, Redux | 2 |
| 31 | Chat List Screen | User and manager views | 2 |
| 32 | Chat Screen | Messages, cards, input | 2 |
| 33 | Negotiation Cards | Price negotiation flow | 2 |
| 34 | Quick Booking | Book from chat | 2 |

#### Week 11: Caretaker Module
| # | Prompt | Description | Part |
|---|--------|-------------|------|
| 35 | Caretaker Dashboard | Assignment-aware UI | 2 |
| 36 | Caretaker Calendar | Time-based visibility | 2 |
| 37 | Payment Collection | Cash/online, validation | 3 |
| 38 | Time Extension | Extend booking if available | 3 |
| 39 | Maintenance Logs | Report issues with photos | 3 |

#### Week 12: Payment Integration
| # | Prompt | Description | Part |
|---|--------|-------------|------|
| 40 | Razorpay Integration | Advance, full payment, refund | 3 |
| 41 | Subscription Payment | Owner subscription system | 3 |

---

### PHASE 2: ADVANCED FEATURES (Weeks 13-16)

#### Week 13-14: Analytics & Reviews
| # | Prompt | Description | Part |
|---|--------|-------------|------|
| 42 | Manager Analytics | Turf-level charts, export | 3 |
| 43 | Owner Analytics | Company-wide, manager performance | 3 |
| 44 | Expense Tracking | Add, list, summarize expenses | 3 |
| 45 | Review System | Write, respond, moderate | 3 |
| 46 | Notification System | FCM, in-app, all types | 3 |

#### Week 14.5: Academy System
| # | Prompt | Description | Part |
|---|--------|-------------|------|
| 47 | Academy Management | Create academy, schedule | 3 |
| 48 | Session Generation | Cloud function, auto-generate | 3 |
| 49 | Academy Renewal | Notifications, renewal flow | 3 |

#### Week 15-16: Subscription & Admin
| # | Prompt | Description | Part |
|---|--------|-------------|------|
| 50 | Subscription Functions | Daily check, grace period | 3 |
| 51 | Admin Panel | Company management, manual updates | 3 |
| 52 | Suspension Cleanup | 30-day deletion function | 3 |

---

### PHASE 3: TESTING & DEPLOYMENT (Weeks 17-20)

| # | Prompt | Description | Part |
|---|--------|-------------|------|
| 53 | E2E Testing | All flows, performance, edge cases | 3 |
| 54 | Bug Fixes & Optimization | Performance, error handling | 3 |
| 55 | Web Optimization | Responsive, PWA | 3 |
| 56 | Deployment Prep | Stores, hosting, monitoring | 3 |
| 57 | Launch Checklist | Final verification, launch | 3 |

---

## 🔑 KEY V2 CHANGES SUMMARY

| Feature | Description |
|---------|-------------|
| 4-Tier Hierarchy | Owner → Manager → Caretaker → User |
| Owner Entity | Business owners create companies |
| Invite Codes | Manager/Caretaker join via codes |
| Operational Permissions | Owners can optionally do manager tasks |
| Caretaker Assignment | Wait for assignment after joining |
| Suspension System | 30-day deletion after suspension |
| Time-Based Visibility | Caretakers see limited info for future |
| Sport-First Booking | Date → Sport → Time → ALL Grounds |

---

## 🛠️ TECH STACK QUICK REFERENCE

| Category | Technology |
|----------|------------|
| Frontend | React Native Expo (iOS, Android, Web) |
| Language | JavaScript (NOT TypeScript) |
| Backend | Firebase (Firestore, Auth, Storage, Functions, FCM) |
| Payment | Razorpay |
| SMS | MSG91 |
| Maps | Google Maps API |
| State | Redux Toolkit + RTK Query |
| UI | React Native Paper |
| Charts | react-native-chart-kit |

---

## 📁 FOLDER STRUCTURE

```
src/
├── api/
│   ├── firebase/
│   │   ├── config.js
│   │   ├── auth.js
│   │   ├── firestore.js
│   │   ├── storage.js
│   │   └── chat.js
│   ├── razorpay/
│   └── googleMaps/
├── components/
│   ├── common/
│   ├── booking/
│   ├── chat/
│   ├── turf/
│   └── analytics/
├── screens/
│   ├── auth/
│   ├── user/
│   ├── owner/
│   ├── manager/
│   ├── caretaker/
│   └── admin/
├── navigation/
├── store/slices/
├── hooks/
├── utils/
├── constants/
├── theme/
└── assets/
```

---

## 📊 DATABASE COLLECTIONS

| Collection | Description |
|------------|-------------|
| users | All users (all roles) |
| companies | Company with subscription, invite code |
| turfs | Turf with grounds, pricing, hours |
| bookings | All bookings with status, payment |
| chats | User-company chat threads |
| messages | Subcollection of chats |
| reviews | User reviews with responses |
| notifications | All notifications |
| expenses | Manager expenses |
| maintenance_logs | Caretaker issue reports |
| blocked_slots | Blocked time slots |
| academies | Academy definitions |
| academy_sessions | Auto-generated sessions |
| analytics | Pre-aggregated metrics |
| admin_logs | Admin actions |
| owner_logs | Owner actions |

---

## ⏰ ESTIMATED TIMELINE

| Phase | Weeks | Focus |
|-------|-------|-------|
| Foundation | 1-4 | Setup, Auth, Owner |
| Core Features | 5-8 | Booking, Manager |
| Chat & Caretaker | 9-11 | Chat, Caretaker |
| Payments | 12 | Razorpay, Subscription |
| Advanced | 13-16 | Analytics, Academy, Admin |
| Testing | 17-18 | E2E, Bug fixes |
| Deployment | 19-20 | Web, Stores, Launch |

**Total: 20 Weeks (5 Months)**

---

## ✅ TESTING CHECKPOINTS

Each prompt includes specific checkpoints. General testing approach:

1. **After each prompt**: Verify checkpoint items
2. **After each week**: Integration test between features
3. **After each phase**: Full flow test for affected roles
4. **Before launch**: Complete E2E test for all roles

---

## 🚀 GETTING STARTED

1. Download all 3 parts of the prompts
2. Start with Prompt 1 in Part 1
3. Copy-paste each prompt to Claude Code
4. Complete the checkpoint before moving on
5. Reference the master plan for detailed specs

**Good luck building your Turf Management System! 🏟️**
