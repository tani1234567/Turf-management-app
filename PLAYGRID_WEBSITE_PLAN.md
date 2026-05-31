# SportSphere — Marketing Website Plan
## Brand Website: Full Strategy & Implementation Blueprint

**Owner:** Tanmay
**Product:** SportSphere — India's Multi-Role Sports Venue Platform
**Website Purpose:** Brand marketing, user acquisition, B2B lead generation (venue owners), SEO
**Planned Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS · Framer Motion · shadcn/ui
**Last Updated:** 2026-05-29
**Status:** Ready to implement — start at THE PROMPT below

---

## THE PROMPT
> **Copy everything inside the code block below and paste it into Claude Code (or any capable AI agent) to build the entire SportSphere website end-to-end. No additional context is needed — this prompt is fully self-contained.**

```
You are building the complete SportSphere marketing website from scratch. SportSphere is an Indian sports venue management mobile app (React Native + Expo + Firebase) that connects 4 user roles: Players (book turfs), Managers (run daily operations), Owners (manage the business), and Caretakers (on-ground staff). The website's goal is to drive app downloads and B2B venue owner signups.

Work in a dedicated project folder called `sportsphere-website`. Use task tracking throughout — create a task list at the start and mark each one done as you go. Never assume you are done until you have verified the output in browser.

═══════════════════════════════════════════════════════════════
AGENTIC WORKFLOW — EXECUTE IN ORDER, NO SKIPPING
═══════════════════════════════════════════════════════════════

TASK LIST (create this with a task tracker before starting):
T1  Scaffold Next.js 15 project
T2  Install all dependencies
T3  Configure Tailwind, fonts, global CSS
T4  Build layout: Navbar + Footer
T5  Build Home page (8 sections)
T6  Build Features page (4 role sections)
T7  Build For Business page (6 sections)
T8  Build Compare page (5 sections)
T9  Build Pricing page (5 sections)
T10 Add Framer Motion animations to all pages
T11 Mobile responsiveness pass
T12 SEO metadata on all pages
T13 Run `next build` — fix all errors
T14 Verify output in browser / dev server

═══════════════════════════════════════════════════════════════
T1 — PROJECT SCAFFOLD
═══════════════════════════════════════════════════════════════

Run:
  npx create-next-app@latest sportsphere-website \
    --typescript --tailwind --app --src-dir \
    --import-alias "@/*" --no-eslint

Then cd into it.

═══════════════════════════════════════════════════════════════
T2 — INSTALL DEPENDENCIES
═══════════════════════════════════════════════════════════════

  npm install framer-motion lucide-react react-hook-form zod @hookform/resolvers
  npm install @radix-ui/react-tabs @radix-ui/react-accordion @radix-ui/react-dialog
  npm install clsx tailwind-merge class-variance-authority
  npm install next-sitemap

  npx shadcn@latest init  (select: dark style, zinc base, yes CSS variables)
  npx shadcn@latest add button card badge tabs accordion dialog

═══════════════════════════════════════════════════════════════
T3 — DESIGN SYSTEM
═══════════════════════════════════════════════════════════════

BRAND IDENTITY
  App name:       SportSphere
  Tagline:        "The Complete Sports Venue Platform."
  Brand green:    #4CAF50  (primary — matches app's USER_COLOR exactly)
  Brand dark:     #388E3C  (hover / pressed states)
  Glow:           rgba(76,175,80,0.25)

COLOR PALETTE — add to globals.css as CSS variables:
  --brand:          #4CAF50
  --brand-dark:     #388E3C
  --brand-glow:     rgba(76,175,80,0.25)
  --bg:             #080B08      /* near-black with the faintest green tint */
  --surface:        #101410      /* card bg */
  --surface-2:      #181E18      /* elevated card bg */
  --border:         #2A342A
  --text:           #F0F4F0
  --muted:          #8A9E8A

  ROLE COLORS (use for role-specific cards and sections only):
  --role-player:    #4CAF50
  --role-manager:   #3B82F6
  --role-owner:     #9C27B0
  --role-caretaker: #F97316

FONTS — add to layout.tsx via next/font:
  import { Space_Grotesk, Inter } from "next/font/google"
  spaceGrotesk({ subsets:["latin"], variable:"--font-heading", weight:["400","500","600","700"] })
  inter({ subsets:["latin"], variable:"--font-body" })

  --font-heading:   Space Grotesk  → all H1–H4, stat callouts, nav links
  --font-body:      Inter          → paragraphs, UI labels, form fields

TAILWIND ADDITIONS — extend tailwind.config.ts:
  theme.extend.colors: { brand:"#4CAF50", "brand-dark":"#388E3C", surface:"#101410", "surface-2":"#181E18", border-brand:"#2A342A" }
  theme.extend.fontFamily: { heading:["var(--font-heading)"], body:["var(--font-body)"] }

COMPONENT STYLE RULES:
  Cards:       rounded-2xl border border-[#2A342A] bg-[#101410] shadow-lg
  Glow card:   add   box-shadow: 0 0 40px rgba(76,175,80,0.12) on hover
  CTA primary: bg-[#4CAF50] text-black font-semibold rounded-full px-6 py-3 hover:bg-[#388E3C]
  CTA outline: border border-[#4CAF50] text-[#4CAF50] rounded-full px-6 py-3 hover:bg-[#4CAF50]/10
  Section:     py-24 on desktop, py-14 on mobile, max-w-7xl mx-auto px-6
  Headings:    font-heading tracking-tight
  Body text:   font-body text-[#8A9E8A] leading-relaxed

IMAGES — use Unsplash. For each image below, use the format:
  https://images.unsplash.com/photo-{ID}?auto=format&fit=crop&w={W}&q=85

  HERO BACKGROUND (dark stadium with floodlit green field):
    ID: 1574629810360-7efbbe195018  W:1920
    alt: "Floodlit sports stadium at night"

  FOOTBALL FIELD (aerial, green pitch):
    ID: 1508098682722-e99c643e7f0b  W:1200
    alt: "Aerial view of football pitch"

  CRICKET STADIUM:
    ID: 1540747913346-19212a4b717a  W:1200
    alt: "Cricket stadium with floodlights"

  SPORTS ACTION (players on field):
    ID: 1431324155629-1a6deb1dec8d  W:1200
    alt: "Athletes playing on sports field"

  BADMINTON COURT:
    ID: 1626224583764-f87db24ac4ea  W:900
    alt: "Indoor badminton court"

  VENUE MANAGEMENT (person with tablet at venue):
    ID: 1551434678-e076c223a692  W:900
    alt: "Venue manager with tablet"

  OWNER B2B (modern sports complex):
    ID: 1459865264687-595d652de67e  W:1200
    alt: "Modern sports complex aerial view"

  For all images: wrap in a Next.js <Image> component with layout="fill" or fixed dimensions.
  Always overlay with a semi-transparent dark gradient where text sits on top:
    bg gradient: linear-gradient(to bottom, rgba(8,11,8,0.7) 0%, rgba(8,11,8,0.95) 100%)

═══════════════════════════════════════════════════════════════
T4 — LAYOUT: NAVBAR + FOOTER
═══════════════════════════════════════════════════════════════

FILE: src/components/layout/Navbar.tsx
  Sticky top nav, backdrop-blur, bg rgba(8,11,8,0.85)
  Left: SportSphere logo (green circle with S + wordmark in Space Grotesk bold)
  Center (desktop): Home · Features · For Business · Why SportSphere · Pricing
  Right: "Download App" button (primary green pill, links to #download-section)
  Mobile: hamburger → full-screen overlay menu with same links

FILE: src/components/layout/Footer.tsx
  Dark bg (#060806), top border rgba(76,175,80,0.2)
  Row 1: Logo + tagline "The Complete Sports Venue Platform."
  Row 2 (4 cols): Product (Features, For Business, Pricing, Compare) | Company (About, Contact) | Legal (Privacy, Terms) | Follow Us (Instagram, Twitter/X, LinkedIn)
  Row 3: App store badges (Google Play + App Store, both greyed/placeholder)
  Row 4: © SportSphere 2026. All rights reserved.

═══════════════════════════════════════════════════════════════
T5 — HOME PAGE  /
═══════════════════════════════════════════════════════════════

FILE: src/app/page.tsx  (8 sections in order)

─── SECTION 1: HERO ────────────────────────────────────────────
Full-viewport height.
Background: hero stadium image (Unsplash ID: 1574629810360-7efbbe195018) with dark gradient overlay.
Centered content, vertically middle-aligned.

Eyebrow (small badge):  ● India's Sports Venue Operating System
H1:  "Book. Negotiate. Manage. Grow."
H2 subline: "SportSphere connects players, managers, owners, and on-ground caretakers in one real-time platform — from slot booking to business analytics."

CTA row:
  Primary button: "Download on Google Play" (with Google Play icon)
  Secondary button: "Get on App Store" (outline, with Apple icon)
  Below buttons, small text: "Free for players. Subscription for venue owners."

Scroll indicator: animated bouncing chevron-down at bottom.

Framer Motion: headline words slide up with staggered 0.1s delays. Buttons fade in after headline.

─── SECTION 2: TRUST BAR ───────────────────────────────────────
Thin strip below hero. Bg rgba(76,175,80,0.05), border-y border-[#2A342A].
Horizontally centered, 4 items separated by vertical dividers:

  🏟️  500+ Venue Partners  |  👥  4 Roles, One Platform  |  ⚡  Real-Time Operations  |  📍  Mumbai & Expanding

Framer Motion: fade in with slight upward translate on scroll.

─── SECTION 3: "WHO IS SPORTSPHERE FOR?" ───────────────────────
Heading: "Built for Every Role at the Turf"
Sub: "Whether you're booking a game, managing a shift, owning a venue, or working on the ground — SportSphere has a dedicated experience designed for you."

4 cards in a 2×2 grid (desktop) / vertical stack (mobile):
  Each card: role icon, colored top border, role name, tagline, feature bullets, "See Features →" link

  Card 1 — FOR PLAYERS       (border-color: #4CAF50)
    Icon: user/person
    Tagline: "Find a turf, negotiate the price, and lock your slot."
    Bullets:
      • Browse turfs by area and sport
      • Negotiate pricing directly via chat
      • Lock your slot in real time — no double-bookings
      • Manage bookings, raise disputes, write reviews

  Card 2 — FOR MANAGERS      (border-color: #3B82F6)
    Icon: briefcase
    Tagline: "Your shift, your dashboard, your decisions."
    Bullets:
      • Live KPI dashboard: revenue, bookings, pending actions
      • Accept, reject, or counter-offer booking requests
      • Create academy sessions and recurring blocks
      • Expense tracking and revenue analytics

  Card 3 — FOR OWNERS        (border-color: #9C27B0)
    Icon: building
    Tagline: "Run your entire sports business from one screen."
    Bullets:
      • Multi-turf, multi-ground management
      • Period-based dynamic pricing per ground
      • Team management with invite codes
      • Operations Mode — step in as manager instantly

  Card 4 — FOR CARETAKERS    (border-color: #F97316)
    Icon: hard-hat / tools
    Tagline: "Your on-ground work, finally digitized."
    Bullets:
      • Daily booking schedule and shift view
      • Cash collection tracker (separate from online)
      • Maintenance issue reporting with photos
      • Instant walk-in booking creation

Framer Motion: cards slide in from bottom with 0.15s stagger on scroll.

─── SECTION 4: DIFFERENTIATORS SPOTLIGHT ───────────────────────
Background: slightly lighter surface (#101410).
Heading: "What Makes SportSphere Different"
Sub: "These aren't just features. They're capabilities no other sports venue platform has built."

6 feature blocks in a 3×2 grid. Each: large icon (green), bold title, 2-sentence explanation.
NO common features here — only what competitors don't have.

  1. REAL-TIME SLOT LOCKING
     Icon: lock
     "When a player taps Pay, their slot is locked for 15 minutes — visible as a live pulsing indicator to every manager on the calendar. Zero double-bookings. Zero disputes over 'I was there first'."

  2. PRICE NEGOTIATION VIA CHAT
     Icon: message-circle
     "Players propose their price. Managers counter. Both parties accept — inside a structured chat flow. The negotiated price flows directly into the booking. No more back-and-forth calls."

  3. PERIOD-BASED DYNAMIC PRICING
     Icon: clock
     "Morning, Afternoon, and Evening slots each carry their own rate — with separate weekday and weekend pricing. Finally, pricing that reflects how venues actually earn."

  4. THE CARETAKER MODULE
     Icon: clipboard-check
     "On-ground staff get their own app: daily task view, cash collection log, maintenance reporting with photo uploads, and direct connection to the management layer. Completely new to the market."

  5. OPERATIONS MODE
     Icon: shield
     "Owners can step inside any of their turfs and run it as manager — live calendar, bookings, chat — without a separate login or handing over credentials. One tap."

  6. ACADEMY SESSION MANAGEMENT
     Icon: repeat
     "Create recurring coaching sessions with day, time, sport, and pricing. Auto-generates session slots, tracks completion, and sends renewal reminders before expiry."

Framer Motion: fade-up with stagger on scroll for each block.

─── SECTION 5: BOOKING FLOW VISUAL ─────────────────────────────
Background: dark with faint green grid lines (CSS: repeating-linear-gradient).
Heading: "Book a Turf in Under a Minute"

Horizontal stepper (scrollable on mobile), 6 steps:
  1. Browse → Pick sport & area → see nearby turfs
  2. Select Date → visual calendar picker
  3. Choose Slot → color-coded 30-min grid (green=free, amber=locked, red=booked)
  4. Confirm → ground, pricing breakdown, payment selection
  5. Lock & Pay → slot locked instantly, UPI payment
  6. Done → confirmation + open chat with manager

Each step: step number circle (green), bold title, 1-line description, connecting dashed line to next.

Framer Motion: steps reveal left-to-right as user scrolls into the section.

─── SECTION 6: THE PLATFORM DIAGRAM ────────────────────────────
Heading: "One Platform. The Complete Chain."
Sub: "Every person at the venue is connected. In real time."

Central diagram (build with absolutely positioned divs or SVG):
  Center: SportSphere logo circle (glowing green border)
  4 orbiting nodes: Player (bottom-left), Manager (top-left), Owner (top-right), Caretaker (bottom-right)
  Connecting lines with animated "data flow" dots traveling along them

Below diagram: 1-line callout per connection:
  Player ↔ Manager: "Negotiation, booking confirmation, payment requests"
  Manager ↔ Owner: "Live analytics, team management, operations access"
  Owner ↔ Caretaker: "Assignment, task delegation, maintenance reports"
  Caretaker ↔ Manager: "Cash collection sync, walk-in bookings, expense logs"

Framer Motion: nodes scale in with spring physics, connecting lines draw themselves.

─── SECTION 7: TESTIMONIALS (PLACEHOLDER) ──────────────────────
Heading: "What the Turf Community Says"
3 cards (carousel on mobile, 3-col on desktop):
  Card 1: Rahul M., Player, Mumbai ★★★★★ — "Finally an app where I can negotiate the price. Booked a 7 PM slot for ₹200 less than listed. The manager countered, we agreed, done."
  Card 2: Priya K., Venue Manager, Andheri ★★★★★ — "The dashboard shows me everything — today's revenue, pending bookings, caretaker cash collections. Stopped using WhatsApp for operations."
  Card 3: Arun S., Venue Owner, Navi Mumbai ★★★★★ — "Operations Mode is a game-changer. When my manager was out, I stepped in myself, handled 3 bookings, and was back on the owner dashboard in 10 minutes."

Note: Mark these clearly as illustrative testimonials (small italic disclaimer below).

─── SECTION 8: OWNER CTA BANNER ────────────────────────────────
Full-width. Background: dark image (Unsplash ID: 1459865264687-595d652de67e) with heavy dark overlay.
Green accent gradient on left edge (4px solid green bar).

Heading: "Running a Sports Venue? SportSphere Runs It Better."
Sub: "Subscription plans from ₹239/ground/month. No setup fee. 30-day free trial."
CTA: "See Business Plans →" → /pricing

Framer Motion: slide in from left on scroll.

═══════════════════════════════════════════════════════════════
T6 — FEATURES PAGE  /features
═══════════════════════════════════════════════════════════════

FILE: src/app/features/page.tsx

─── SECTION 1: HERO ────────────────────────────────────────────
Heading: "Everything in One App. For Everyone at the Venue."
Sub: "A dedicated feature set for every role — not a one-size-fits-all booking tool."

Sticky role switcher tabs below heading:
  Players | Managers | Owners | Caretakers
  Clicking each tab smoothly scrolls to that role's section anchor.
  Active tab: green underline indicator.

─── SECTION 2: PLAYER FEATURES  #players ───────────────────────
Two-column (text left, static phone frame right).
Only include features that matter to a player's decision to download:

  Turf Discovery
    Browse by Mumbai zone, sport type, amenities, and rating. Each listing shows real photos, pricing, and slot availability.

  Color-Coded Slot Grid
    30-minute intervals, 6 AM–11 PM. Green = available, Amber = temporarily locked, Red = booked. Clarity at a glance.

  Price Negotiation
    Propose your price in the booking chat. Manager counters or accepts. Agreed price applies to the booking automatically.

  Real-Time Slot Lock
    On payment initiation, your slot is locked for 15 minutes. Visible to all managers — the slot is yours while you pay.

  Booking History & Status
    Past and upcoming bookings in one screen. Cancel, raise a dispute, or write a review from the same place.

  Disputes & Support
    Payment issue, quality complaint, overcharge — raise a ticket, get admin-backed resolution, receive refunds when due.

  Wishlist
    Save turfs you love. Come back when you're ready.

─── SECTION 3: MANAGER FEATURES  #managers ─────────────────────
Two-column (phone left, text right — mirrored layout for visual variety).

  Live Operations Dashboard
    Today's bookings, live revenue counter, pending approval queue, and caretaker cash collection — all on one screen. Filter by Today / Week / Month.

  Booking Management
    Accept, reject, or modify bookings. Create bookings manually for walk-in customers. Full control over every slot.

  Chat & Negotiation Center
    Respond to player price proposals. Counter-offer, accept, or decline — with a full negotiation trail. Send payment requests directly in chat.

  Visual Booking Calendar
    Monthly and weekly views with color-coded slots. See the full picture for any ground at any time.

  Academy & Recurring Sessions
    Create coaching programs that repeat on selected days at set times. Auto-generates slots, tracks completions, sends renewal reminders.

  Slot Blocking
    Block specific slots for maintenance, private events, or academy time. Prevents accidental bookings.

  Advance Payment Collection
    Collect a % or fixed amount upfront. Track remaining balances. Supports online and cash payment for the remainder.

  Expense Tracking
    Log maintenance, utilities, staff salary, equipment, cleaning, marketing, rent, and insurance. With receipt photos, date, and notes. Full category breakdown.

  Holiday Schedule
    Mark dates as holidays to close the venue without blocking individual slots manually.

  Revenue Analytics
    Charts for booking trends, revenue by payment method, peak hours, and expense breakdowns. Exportable.

  Customer Phonebook
    All customers who've ever booked. Contact info in one place.

  Review Management
    View all star ratings and written reviews. Respond to customers from the manager app.

─── SECTION 4: OWNER FEATURES  #owners ─────────────────────────
Full-width feature blocks (alternating image-text layout).

  5-Step Turf Setup
    Create a fully configured turf in one guided flow: Basic Details → Location & Maps → Operating Hours → Grounds → Pricing. Done in under 10 minutes.

  Multi-Turf, Multi-Ground Management
    Manage unlimited turfs, each with multiple grounds. Every ground independently configurable with its own sports, capacity, and pricing.

  Period-Based Dynamic Pricing
    Set separate rates for Morning (6–10 AM), Afternoon (10 AM–6 PM), and Evening (6–11 PM). Independent weekday and weekend rates per period, per ground.

  Amenity Configuration
    Per-ground toggles: floodlights, changing rooms, parking, drinking water, restrooms, cafeteria, first aid, WiFi, seating, equipment rental.

  Team Management with Invite Codes
    Generate unique invite codes for managers and caretakers. They scan it to join your company. Regenerate to revoke access instantly.

  Operations Mode
    Step into any turf and operate it as its manager — bookings, calendar, chat — without logging out. Return to owner dashboard with one tap.

  Subscription Management
    View active plan, upgrade tier, track payment history and invoice records.

  Turf Edit Audit Logs
    Every change to a turf's configuration — pricing, operating hours, ground details — is logged with timestamp, editor identity, and a before/after record.

  Cross-Turf Analytics
    Aggregate revenue, per-turf booking performance, expense vs. income comparison, and team activity — all in one owner-level dashboard.

─── SECTION 5: CARETAKER FEATURES  #caretakers ─────────────────
Two-column (text left, phone right).

  Daily Shift Dashboard
    Today's full schedule at a glance: bookings by time, current status (completed, ongoing, upcoming), and cash collection totals for the day.

  Cash Collection Tracker
    Log cash collected for each booking separately from online payments. Daily totals, with per-booking breakdowns visible to the manager.

  Walk-In Booking Creation
    Create instant bookings for customers who show up at the ground — no app required on the customer's side.

  Maintenance Issue Reporting
    Report problems (lighting, ground condition, equipment, safety) with a photo, priority level, and description. Manager notified immediately. Status tracked to resolution.

  Expense Logging
    Quick entry for ground-level costs: cleaning supplies, minor equipment, small repairs. Receipt upload supported.

  Waiting State
    New caretakers without an assigned turf see a dedicated "Waiting for Assignment" screen — clean onboarding with no confusion.

═══════════════════════════════════════════════════════════════
T7 — FOR BUSINESS PAGE  /for-business
═══════════════════════════════════════════════════════════════

FILE: src/app/for-business/page.tsx

─── SECTION 1: HERO ────────────────────────────────────────────
Background: venue management image (Unsplash ID: 1551434678-e076c223a692) with dark overlay.
Heading: "Your Turf Business Deserves Better Software."
Sub: "Stop managing bookings on WhatsApp. SportSphere gives you the tools to run, grow, and understand your sports venue — all from your phone."
CTA: "Start Your Free Trial →"  (primary) + "See Pricing" (outline)

─── SECTION 2: THE PROBLEM WE SOLVE ────────────────────────────
Heading: "Sound Familiar?"
Sub: "Every venue owner has these problems. Most just accept them."

6 before/after cards (2-col grid, each card split green/dark):
  Before: "Bookings come over WhatsApp — duplicates, missed slots, disputes over who booked first."
  After: "Real-time slot locking — the moment someone pays, the slot is theirs and all managers see it."

  Before: "You don't know today's revenue until your caretaker calls you at night."
  After: "Live dashboard: revenue counter, bookings completed, cash vs. online split — always current."

  Before: "Price negotiations happen over calls. No record, no trail, outcomes disputed."
  After: "Every negotiation is in the app: proposal, counter, acceptance — searchable and timestamped."

  Before: "Walk-in customers depend on your caretaker calling you for approval."
  After: "Caretaker creates the booking in the app. You see it instantly. No calls needed."

  Before: "Managing 2 turfs means juggling 2 WhatsApp groups and 2 notebooks."
  After: "All turfs, all grounds, all teams — one owner dashboard. Switch with a tap."

  Before: "You have no idea what expenses went where last month."
  After: "Categorized expense tracking with receipts. Manager and caretaker logs in one place."

─── SECTION 3: HOW IT WORKS (ONBOARDING) ───────────────────────
Heading: "Get Your Venue Live in Under an Hour"
4 numbered steps (horizontal timeline on desktop, vertical on mobile):

  1  Download & Create Owner Account
     Phone number → OTP → Select "I'm an Owner" → Set up company profile (name, GST, business details).

  2  Set Up Your Turf — 5-Step Wizard
     Add name, photos, location (with Google Maps link), operating hours by day, grounds, and pricing per period per ground. ~10 minutes.

  3  Invite Your Team
     Generate one invite code for managers, one for caretakers. They download the app, enter the code, and are instantly part of your company.

  4  Go Live
     Activate your turf. Players can now find, book, and negotiate. You manage everything from your dashboard.

─── SECTION 4: DEEP-DIVE FEATURE ACCORDIONS ────────────────────
Heading: "Everything You Need to Run a Professional Venue"

Accordion items (expandable, each with icon + expanded detail):

  Pricing & Revenue Control
    Period-based pricing: set different rates for morning, afternoon, and evening. Weekday vs. weekend splits per ground. Advance payment collection — define the % or fixed amount required upfront. Remaining balance tracked per booking.

  Team & Role Management
    Managers access bookings, calendar, expenses, and analytics for their assigned turf. Caretakers access daily schedule and cash logging. Permissions are role-limited — a caretaker can't touch pricing. Invite codes can be regenerated to revoke access.

  Dispute & Support Resolution
    Players can raise disputes: refunds, service quality, overcharges, cancellations. Disputes are admin-backed, with a full status trail (Open → Under Review → Resolved → Closed). Refunds are processed through the platform.

  Audit Logs & Accountability
    Every change to turf configuration — pricing, hours, ground details — is logged with who made it and when. Owners always know what changed and can hold the right person accountable.

  Subscription & Billing
    Plans are priced per ground, with volume discounts for more grounds and duration discounts for longer commitments. Subscription includes all roles — no per-user seat fees. 7-day grace period after expiry before turfs deactivate.

  Fraud Prevention
    Payment verification is monitored. Users who repeatedly submit invalid proof are automatically suspended. Keeps your platform clean.

─── SECTION 5: PRICING TEASER ──────────────────────────────────
Simple 2-card layout (links to /pricing for full details):
  Starter: ₹299 / ground / month — single turf, 1–5 grounds
  Enterprise: ₹239 / ground / month — multi-turf, 21+ grounds, full feature set
  "See All Plans →" CTA

─── SECTION 6: FAQ ──────────────────────────────────────────────
Accordion FAQ (use Radix Accordion):
  Q: How long does it take to set up my turf?
  A: Most owners complete the 5-step setup in under 10 minutes. Operating hours, grounds, pricing, and team setup included.

  Q: Can I manage multiple turfs from one account?
  A: Yes. The owner dashboard aggregates all your turfs. Each can have its own team, pricing, and configuration.

  Q: Do my managers and caretakers need to pay separately?
  A: No. All staff roles are included in the owner subscription — no per-user fees.

  Q: How does price negotiation work?
  A: Players propose a price via chat. Your manager sees the proposal and can accept, reject, or counter. The agreed price is automatically applied. You always have a full record.

  Q: What if a player disputes a booking?
  A: The player opens a dispute ticket. It goes through a review process with admin involvement. If resolved in the player's favor, a refund is processed. Outcomes are logged.

  Q: Is there a free trial?
  A: Yes. 30 days free with any plan. No setup fee, no credit card required to start.

  Q: Can I block slots for private events or maintenance?
  A: Yes. Managers and owners can block any slot range on any ground, with a note. Blocked slots show as unavailable to players.

  Q: What happens when my subscription expires?
  A: There's a 7-day grace period where everything continues normally. After that, your turfs are deactivated for new bookings until you renew. Existing booking data is preserved.

─── SECTION 7: LEAD CAPTURE FORM ───────────────────────────────
Heading: "Ready to Get Started? Let's Talk."
Form (React Hook Form + Zod validation):
  Fields: Full Name*, Business Name*, City*, Phone Number* (+91), Number of Grounds*, Message (optional)
  Submit: "Request a Demo" → POST to /api/lead
  On success: show green success message "We'll reach out within 24 hours."

FILE: src/app/api/lead/route.ts
  Receives form data, logs it, returns 200.
  (Integrate with Firebase or Formspree in production — leave a TODO comment.)

═══════════════════════════════════════════════════════════════
T8 — COMPARE PAGE  /compare
═══════════════════════════════════════════════════════════════

FILE: src/app/compare/page.tsx

─── SECTION 1: HERO ────────────────────────────────────────────
Dark background with subtle animated green grid lines (CSS animation).
Eyebrow badge: "Why SportSphere"
Heading: "Competitors Solve Half the Problem. We Solve All of It."
Sub: "Booking apps stop at booking. Management SaaS ignores the player. SportSphere is the only product that serves the complete venue ecosystem."

─── SECTION 2: THE MISSING LAYER ───────────────────────────────
Heading: "The Gap Nobody Has Filled"
Sub: "Two industries exist in parallel and never communicate. SportSphere bridges them."

Visual: two "worlds" side-by-side connected by SportSphere in the center.
  Left world:  "PLAYER APPS" (Playo, Hudle, BookMyCourt) — "Booking only. Player experience stops at confirmation."
  Center:      SportSphere logo with green glow — "Both. Connected. Real-Time."
  Right world: "MANAGEMENT SaaS" (SportsCube, desktop tools) — "No mobile. No player-facing app. No negotiation."

Below diagram, 4 callout boxes (one per gap):
  "No competitor has a CARETAKER module — the on-ground staff who collect cash and manage the physical space are invisible in every other app."
  "No competitor supports PRICE NEGOTIATION — the way Indian sports culture actually works."
  "No competitor lets owners step into OPERATIONS MODE — a manager override without credential sharing."
  "No competitor offers PERIOD-BASED DYNAMIC PRICING — morning and evening slots earn differently, and platforms should reflect that."

─── SECTION 3: FEATURE COMPARISON TABLE ────────────────────────
Heading: "Feature by Feature"
Filter buttons: All · Booking · Operations · Team · Analytics · Support

Table (sticky first column):
  Rows: SportSphere ★ | Playo | Hudle | BookMyCourt | SportsCube
  SportSphere row: green background highlight

  Columns (grouped by filter):
  BOOKING:
    Real-Time Slot Locking        ✅ ❌ ❌ ❌ ❌
    Player Booking App            ✅ ✅ ✅ ✅ ❌
    Price Negotiation via Chat    ✅ ❌ ❌ ❌ ❌
    Booking Calendar              ✅ ❌ Partial ❌ ✅

  OPERATIONS:
    Period-Based Dynamic Pricing  ✅ ❌ ❌ ❌ Partial
    Caretaker Dedicated App       ✅ ❌ ❌ ❌ ❌
    Operations Mode               ✅ ❌ ❌ ❌ ❌
    Slot Blocking                 ✅ ❌ ❌ ❌ Partial
    Holiday Schedule              ✅ ❌ ❌ ❌ ❌
    Academy Session Management    ✅ ❌ ❌ ❌ ❌
    Cash Collection Tracking      ✅ ❌ ❌ ❌ ❌
    Advance Payment Collection    ✅ ❌ ❌ ❌ Partial

  TEAM:
    Manager + Caretaker Roles     ✅ ❌ ❌ ❌ Partial
    Invite Code Onboarding        ✅ ❌ ❌ ❌ ❌
    Multi-Turf Owner Dashboard    ✅ ❌ ❌ ❌ ✅

  ANALYTICS:
    Expense Tracking              ✅ ❌ ❌ ❌ Partial
    Revenue Charts                ✅ ❌ Partial ❌ ✅
    Audit Logs                    ✅ ❌ ❌ ❌ ❌

  SUPPORT:
    Dispute & Refund System       ✅ ❌ ❌ ❌ ❌
    Support Ticket System         ✅ Partial ❌ ❌ ❌

Cell values: ✅ green · ⚠️ (partial) amber · ❌ muted red

─── SECTION 4: USP DEEP DIVES ──────────────────────────────────
6 blocks in alternating full-width layout (image left / text right, then flipped):

  REAL-TIME SLOT LOCKING
  Image: Unsplash ID 1574629810360-7efbbe195018 (crop to portrait)
  "A player taps Pay. The slot immediately switches to 'locked' — amber, pulsing, visible to every manager watching the calendar. 15 minutes to complete payment. If payment fails, the lock releases automatically. This is how double-booking becomes impossible, not just less likely."

  PRICE NEGOTIATION
  Image: Unsplash ID 1431324155629-1a6deb1dec8d
  "Indian sports culture runs on negotiation. Every other platform ignores this. SportSphere builds a structured negotiation protocol into the chat: player proposes, manager counters or accepts, both agree — and the agreed price is automatically applied to the booking with a full timestamp trail."

  THE CARETAKER APP
  Image: Unsplash ID 1551434678-e076c223a692
  "Caretakers exist at every turf in India. They collect cash, manage walk-ins, report maintenance issues. Every other app treats them as invisible. SportSphere gives them a dedicated mobile role: daily schedule, cash log, maintenance reporting with photo uploads, and a direct channel to management. First in the market."

  PERIOD-BASED DYNAMIC PRICING
  Image: Unsplash ID 1508098682722-e99c643e7f0b
  "A 7 PM Friday slot and a 10 AM Tuesday slot are not worth the same to a venue owner. SportSphere supports three pricing periods per day — Morning, Afternoon, Evening — each independently set for weekdays and weekends. Per ground. That's up to 6 distinct price points per ground, reflecting real market value."

  OPERATIONS MODE
  Image: Unsplash ID 1459865264687-595d652de67e
  "A manager calls in sick. A major event needs the owner's direct touch. Operations Mode lets any owner instantly take over a specific turf's operations — viewing its live calendar, managing bookings, and handling chat — without handing over their credentials or setting up a secondary account."

  FULL AUDIT TRAIL
  Image: Unsplash ID 1540747913346-19212a4b717a
  "Every change to a turf's configuration — a pricing edit, an operating hours update, a ground modification — is logged: timestamp, the person who made it, and a before/after record. Owners always know who changed what and when. Accountability without effort."

─── SECTION 5: CLOSING CTA ─────────────────────────────────────
Heading: "SportSphere isn't a booking app upgrade. It's a new category."
Two CTAs: "Download the App" (player) + "Get Started as Owner" (owner → /for-business)

═══════════════════════════════════════════════════════════════
T9 — PRICING PAGE  /pricing
═══════════════════════════════════════════════════════════════

FILE: src/app/pricing/page.tsx

─── SECTION 1: HERO ────────────────────────────────────────────
Heading: "Simple Pricing. No Hidden Fees. Cancel Anytime."
Sub: "Priced per ground, not per user. Your whole team is included."
Toggle row: Monthly | 3 Months (-5%) | 6 Months (-10%) | 12 Months (-15% + "Best Value" badge)
Toggle switches all pricing cards simultaneously.

─── SECTION 2: PRICING TIERS ───────────────────────────────────
3 cards (horizontal on desktop, stacked on mobile):

  STARTER                         ₹299/ground/month*
  For single-turf venues, 1–5 grounds
  Includes:
    ✓ Full player booking experience
    ✓ Manager + Caretaker roles (unlimited)
    ✓ Booking management & visual calendar
    ✓ Chat & price negotiation
    ✓ Real-time slot locking
    ✓ Basic analytics (Today / Week / Month)
    ✓ Support ticket system
  CTA: "Start Free Trial"

  GROWTH  [MOST POPULAR badge]    ₹269/ground/month*  (-10% off — 6–10 grounds)
  For established venues with 6–10 grounds
  Everything in Starter, plus:
    ✓ Period-based dynamic pricing
    ✓ Advance payment collection
    ✓ Expense tracking with receipt uploads
    ✓ Academy & recurring session management
    ✓ Holiday schedule overrides
    ✓ Customer phonebook
    ✓ Revenue analytics export
    ✓ Audit logs
    ✓ Priority support
  CTA: "Start Free Trial"

  ENTERPRISE                      ₹239/ground/month*  (-20% off — 21+ grounds)
  For multi-turf operators & sports complexes
  Everything in Growth, plus:
    ✓ Unlimited turfs & grounds
    ✓ Multi-turf owner dashboard
    ✓ Operations Mode
    ✓ Dispute & refund management
    ✓ Dedicated onboarding manager
    ✓ SLA-backed support
  CTA: "Contact Sales"

*Disclaimer below cards: "Prices shown are indicative and exclusive of 18% GST. Final pricing confirmed at signup. Duration discounts applied on full upfront payment."

─── SECTION 3: WHAT'S ALWAYS FREE ──────────────────────────────
Green-bordered info box:
  "SportSphere is always FREE for players.
   Owners pay for the operational platform that powers their venue.
   No booking fees charged to players through SportSphere."

Bullets:
  ✓ Player app download and use
  ✓ Slot booking and negotiations
  ✓ Reviews and ratings
  ✓ Support ticket submission

─── SECTION 4: DURATION DISCOUNT TABLE ─────────────────────────
Visual table: effective monthly cost at each commitment level
All 3 plans × all 4 durations.
Header note: "Pay once, save more."

─── SECTION 5: FAQ ──────────────────────────────────────────────
  Q: Is there a setup fee?
  A: No. Download, create an account, set up your turf, go live. Zero upfront cost.

  Q: What's included per ground count tier?
  A: 1–5 grounds: Starter rate. 6–10: Growth rate (applies to all grounds). 11–20: 15% off. 21+: Enterprise rate.

  Q: Can I switch plans mid-cycle?
  A: Yes. Upgrades are prorated to the remaining days. Downgrades apply at next renewal.

  Q: Do my managers and caretakers need separate subscriptions?
  A: No. All staff are included in your owner subscription — no per-seat fees.

  Q: What happens when my subscription expires?
  A: A 7-day grace period begins. After that, your turfs are deactivated for new bookings until renewed. Your data is never deleted.

  Q: Is there a free trial?
  A: Yes — 30 days free on any plan. No payment required to start.

  Q: Is GST included in the prices shown?
  A: No. Prices shown exclude 18% GST, which will be added at checkout.

═══════════════════════════════════════════════════════════════
T10 — FRAMER MOTION ANIMATIONS
═══════════════════════════════════════════════════════════════

Create a shared util: src/lib/animations.ts
  export const fadeUp = { hidden:{opacity:0,y:32}, visible:{opacity:1,y:0,transition:{duration:0.6,ease:[0.25,0.46,0.45,0.94]}} }
  export const fadeIn = { hidden:{opacity:0}, visible:{opacity:1,transition:{duration:0.5}} }
  export const stagger = { visible:{transition:{staggerChildren:0.12}} }
  export const scaleIn = { hidden:{opacity:0,scale:0.92}, visible:{opacity:1,scale:1,transition:{duration:0.5,ease:"easeOut"}} }

Apply via whileInView + viewport={{once:true, amount:0.2}} on all sections.

Specific animations:
  Hero headline:      fadeUp, each word/line staggered 0.1s
  Role cards:         stagger + fadeUp per card
  Feature blocks:     stagger + scaleIn
  Stepper steps:      left-to-right sequential reveal
  Platform diagram:   scaleIn for center + spring for orbiting nodes
  Comparison table:   fade in row by row
  USP blocks:         alternating slide-in-left / slide-in-right
  Pricing cards:      stagger + fadeUp
  Stats:              count-up animation using Framer Motion useMotionValue + useTransform
  Navbar:             background opacity transitions from 0 to 0.85 on scroll (useScroll)

Green glow pulse animation (CSS keyframes in globals.css):
  @keyframes glow-pulse { 0%,100%{box-shadow:0 0 20px rgba(76,175,80,0.3)} 50%{box-shadow:0 0 40px rgba(76,175,80,0.6)} }
  Apply .animate-glow-pulse to the center node in the platform diagram.

═══════════════════════════════════════════════════════════════
T11 — MOBILE RESPONSIVENESS
═══════════════════════════════════════════════════════════════

Breakpoints: sm(640) md(768) lg(1024) xl(1280)

  Navbar: hidden links below lg, hamburger menu with slide-down animation
  Hero: text centered, smaller font on mobile (text-4xl → text-2xl)
  Role cards: 2-col on md, 1-col on sm
  Feature blocks: single col on mobile, text above image
  Comparison table: horizontal scroll container on mobile (overflow-x-auto)
  Pricing cards: stacked vertically on mobile
  Stepper: vertical layout on mobile
  Platform diagram: scale down, simplified node placement
  Footer: 2-col grid on mobile

═══════════════════════════════════════════════════════════════
T12 — SEO
═══════════════════════════════════════════════════════════════

Each page: export const metadata: Metadata = { title:"...", description:"...", openGraph:{...} }

  /         "SportSphere — India's Sports Venue Platform | Book, Manage, Grow"
  /features "App Features by Role — Players, Managers, Owners, Caretakers | SportSphere"
  /for-business "Venue Management Software for Sports Ground Owners | SportSphere"
  /compare  "Why SportSphere? vs Playo, Hudle, BookMyCourt | Feature Comparison"
  /pricing  "SportSphere Pricing — Venue Subscription Plans for Ground Owners"

next-sitemap config: siteUrl "https://sportsphere.app", output "export"
robots.txt: allow all, sitemap link included.

Schema markup (JSON-LD in layout.tsx):
  SoftwareApplication: name SportSphere, applicationCategory SportsApplication, operatingSystem Android iOS, offers pricing info.

═══════════════════════════════════════════════════════════════
T13 — BUILD & VERIFY
═══════════════════════════════════════════════════════════════

  npm run build            ← must complete with 0 errors
  npm run dev              ← verify each page in browser
  npx next-sitemap         ← generate sitemap.xml

VERIFICATION CHECKLIST:
  □ Home page: all 8 sections visible, hero image loads, animations run
  □ Features page: role tab switcher works and scrolls correctly
  □ For Business page: accordion expands, lead form validates and submits
  □ Compare page: filter buttons filter table rows, table is scrollable on mobile
  □ Pricing page: duration toggle switches all 3 cards simultaneously
  □ Navbar: sticky on scroll, mobile menu opens/closes
  □ Footer: all links present, no broken hrefs
  □ All images load (Unsplash URLs work)
  □ No console errors in browser
  □ Lighthouse score on Home: Performance ≥85, Accessibility ≥90

═══════════════════════════════════════════════════════════════
T14 — DEPLOYMENT (Vercel)
═══════════════════════════════════════════════════════════════

  npx vercel              ← follow prompts to link/create project
  npx vercel --prod       ← deploy to production

Environment variables needed: none for now (lead form uses API route that logs locally).
Custom domain: set "sportsphere.app" in Vercel dashboard (configure DNS after).
```

---

## 1. Brand & Corrections Reference

**App Name:** SportSphere (changed from PlayGrid/Turf-1701)
**Roles (4 only):** User (Player) · Manager · Caretaker · Owner
- Admin exists in code but is internal/system-only — do not reference it on the website
**Primary Brand Color:** `#4CAF50` (matches app's USER_COLOR exactly)
**Sports count:** 8 sports are supported in the codebase (Cricket, Football, Badminton, Tennis, Pickleball, Basketball, Volleyball, Hockey) — but this is not a differentiating stat and should not be featured prominently on the site
**Payment:** UPI is the primary method. Don't over-emphasize payment as a differentiator — it is common across competitors

---

## 2. Competitive Landscape & Market Gap

### Direct Competitors

| Platform | What They Do | Key Weakness |
|---|---|---|
| **Playo** | Social sports network + basic venue booking | Booking-only; zero operational tools; no manager/caretaker layer |
| **Hudle** | Slot booking for sports venues | No negotiation, no caretaker, no expense tracking |
| **BookMyCourt** | Online court reservations | No chat, no multi-role, no team management |
| **SportsCube** | Venue management SaaS (desktop-heavy) | No mobile app for end-users; player and owner use different products |
| **MyGround** | Basic turf listing + booking | No real-time slot locking; no payment integration |

### The Gap (what nobody has built)

```
╔══════════════════════════════════════════════════════════════════╗
║              THE GAP COMPETITORS LEAVE OPEN                      ║
╠══════════════════════════════════════════════════════════════════╣
║  ✗  Booking apps serve players only.                             ║
║     Management SaaS serves owners only.                          ║
║     Nobody bridges BOTH in a single mobile-first product.        ║
║                                                                  ║
║  ✗  No competitor has a CARETAKER MODULE — on-ground staff       ║
║     who physically collect cash are invisible in every app.      ║
║                                                                  ║
║  ✗  No competitor supports PRICE NEGOTIATION — the way           ║
║     Indian sports culture actually operates.                     ║
║                                                                  ║
║  ✗  No competitor lets owners use OPERATIONS MODE —              ║
║     step into a turf as manager without credential sharing.      ║
║                                                                  ║
║  ✗  No competitor has PERIOD-BASED DYNAMIC PRICING —             ║
║     morning, afternoon, evening, weekday, weekend — per ground.  ║
║                                                                  ║
║  ✗  No competitor tracks ACADEMY SESSIONS —                      ║
║     recurring coaching bookings with auto-generation.            ║
║                                                                  ║
║  ✗  No competitor has admin-backed DISPUTE RESOLUTION —          ║
║     structured refund processing with a full status trail.       ║
╚══════════════════════════════════════════════════════════════════╝
```

---

## 3. Full Feature Inventory (Source of Truth)

### User / Player
- Browse turfs by Mumbai zone, sport, amenities, rating
- Multi-step booking: date → sport → 30-min slot grid → ground → confirm
- Color-coded slot availability (green/amber/red)
- Real-time slot locking (15-min hold on payment initiation)
- Price negotiation via chat (propose → counter → accept)
- UPI payment with transaction screenshot verification
- Booking history, cancellation
- Wishlist (save favorite turfs)
- Reviews & star ratings
- Support tickets + dispute system (refund / quality / overcharge / cancellation)
- Dispute status tracking (Open → Under Review → Resolved → Closed)
- Push notifications
- Fraud detection (auto-ban after 3 consecutive failed payment proofs)

### Manager
- Live KPI dashboard (revenue, bookings, pending actions, caretaker cash) — Today/Week/Month filter
- Accept / reject / counter-offer / create bookings
- Visual booking calendar (monthly + weekly, color-coded)
- Chat & negotiation center (full trail, payment requests)
- Manual booking creation for walk-in customers
- Slot blocking (maintenance, events, academy)
- Advance payment collection (% or fixed amount, multiple methods for remainder)
- Academy / recurring session management (days, times, sport, pricing — auto-generates slots)
- Expense tracking (9 categories, 30+ subcategories, receipt uploads)
- Holiday schedule override
- Revenue analytics with charts and CSV export
- Customer phonebook
- Review management (view + respond)
- Caretaker assignment to turfs

### Owner
- Multi-step turf creation wizard (details → location + maps → hours → grounds → pricing)
- Multi-turf, multi-ground management (unlimited)
- Period-based dynamic pricing: Morning/Afternoon/Evening × Weekday/Weekend × per ground = up to 6 price points per ground
- 10 amenity types configurable per ground
- Activate / deactivate turfs
- Team management with invite codes (generate, share, regenerate to revoke)
- Operations Mode (step into any turf as manager — full calendar, bookings, chat)
- Subscription management (view plan, upgrade, payment history)
- Turf edit audit logs (who changed what, with before/after)
- Cross-turf analytics (revenue, bookings, expenses)
- Operational permissions (toggle what managers can access)
- Subscription tiers: ₹299 (1–5 grounds) / ₹269 (6–10) / ₹254 (11–20) / ₹239 (21+) per ground/month
- Duration discounts: 1mo (0%) / 3mo (-5%) / 6mo (-10%) / 12mo (-15%)
- Subscription grace period: 7 days after expiry before turfs deactivate

### Caretaker
- Daily shift dashboard (today's schedule, stats, cash totals)
- "Waiting for Assignment" state (new caretakers without a turf)
- Cash collection tracker (per-booking, daily totals, separate from online)
- Walk-in booking creation (instant, cash payment)
- Maintenance issue reporting (type, priority, photo upload) → manager notified
- Expense logging (4 categories, 10 subcategories)
- Monthly calendar view
- Push notifications

### Platform-Wide
- OTP-based authentication (phone number)
- Role selection at signup
- Role-specific onboarding flows
- Real-time Firestore listeners (live updates across all dashboards)
- Firebase Cloud Functions automation:
  - Auto-reject pending bookings after 1 hour
  - Release expired slot locks
  - Payment verification reminders + timeouts
  - Academy session auto-generation and completion marking
  - Subscription expiry checks (daily 2:30 AM IST)
  - Grace period enforcement (daily 3:30 AM IST)
  - Dispute-to-refund automation
  - Fraud tracking cleanup

---

## 4. Design System Reference

### Color Palette
```css
/* Brand — matches app's USER_COLOR */
--brand:           #4CAF50;
--brand-dark:      #388E3C;
--brand-glow:      rgba(76,175,80,0.25);

/* Backgrounds */
--bg:              #080B08;      /* near-black, faint green tint */
--surface:         #101410;
--surface-2:       #181E18;
--border:          #2A342A;

/* Text */
--text:            #F0F4F0;
--muted:           #8A9E8A;

/* Role colors */
--role-player:     #4CAF50;
--role-manager:    #3B82F6;
--role-owner:      #9C27B0;
--role-caretaker:  #F97316;
```

### Typography
- **Headings:** `Space Grotesk` — modern, geometric, tech-forward
- **Body:** `Inter` — clean, readable
- **Stats/numbers:** `Space Grotesk` Bold — draws the eye

### Image Sources (Unsplash)
| Use | Unsplash Photo ID | Subject |
|---|---|---|
| Hero background | `1574629810360-7efbbe195018` | Floodlit stadium at night |
| Football field | `1508098682722-e99c643e7f0b` | Aerial football pitch |
| Cricket stadium | `1540747913346-19212a4b717a` | Cricket ground |
| Sports action | `1431324155629-1a6deb1dec8d` | Athletes on field |
| Badminton court | `1626224583764-f87db24ac4ea` | Indoor court |
| Venue management | `1551434678-e076c223a692` | Person with tablet at venue |
| Sports complex | `1459865264687-595d652de67e` | Aerial sports complex |

URL format: `https://images.unsplash.com/photo-{ID}?auto=format&fit=crop&w={W}&q=85`

---

## 5. Website Architecture — 5 Pages

```
/ (Home)
├── /features          — Full feature breakdown by role
├── /for-business      — Owner/Manager B2B pitch + lead form
├── /compare           — Why SportSphere vs. competitors
└── /pricing           — Subscription tiers with toggle
```

Navigation: Sticky top, backdrop-blur, persistent "Download App" green pill CTA.

---

## 6. Technical Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js 15 (App Router) | SSG + RSC for fast SEO pages |
| Language | TypeScript | Type safety |
| Styling | Tailwind CSS v4 | Rapid utility-first styling |
| Components | shadcn/ui | Pre-built accessible primitives |
| Animation | Framer Motion | Scroll-triggered, spring physics |
| Icons | Lucide React | Consistent, tree-shakeable |
| Forms | React Hook Form + Zod | Lead capture validation |
| SEO | next-sitemap | Auto sitemap + robots.txt |
| Deployment | Vercel | Zero-config, global edge |

---

## 7. Build Phases

| Phase | Scope | Target |
|---|---|---|
| 1 | Scaffold + design system + layout | Day 1 |
| 2 | Home page — all 8 sections | Day 1–2 |
| 3 | Features page — 4 role sections | Day 2–3 |
| 4 | For Business page + lead form API | Day 3–4 |
| 5 | Compare + Pricing pages | Day 4–5 |
| 6 | Framer Motion animations pass | Day 5 |
| 7 | Mobile responsiveness + SEO + deploy | Day 6 |

---

## 8. Placeholder Values to Replace Before Launch

| Item | Placeholder | Replace With |
|---|---|---|
| App store URLs | `#` | Real Play Store + App Store links |
| Pricing numbers | ₹299/269/254/239 | Confirmed commercial rates |
| Testimonials | Illustrative names/quotes | Real user/owner quotes |
| App screenshots | Unsplash images | Actual app screenshots by role |
| Lead form endpoint | console.log | Firebase / Formspree production endpoint |
| Social links | `#` | Real Instagram, Twitter/X, LinkedIn handles |
| Venue count | "500+" | Real Firebase data |
| Domain | sportsphere.app | Confirmed domain after purchase |

---

*All feature descriptions, pricing tiers, role capabilities, and technical details are derived directly from the Turf-1701 production codebase. App name updated to SportSphere per product decision.*
