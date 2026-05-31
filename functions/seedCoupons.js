/**
 * Seed script — adds sample coupons to Firestore `coupons` collection.
 * Run from the functions/ directory:
 *   node seedCoupons.js
 *
 * Requires Application Default Credentials. If you get an auth error, run:
 *   gcloud auth application-default login
 * or set GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json
 *
 * Replace REPLACE_WITH_REAL_COMPANY_ID and REPLACE_WITH_REAL_TURF_ID with
 * actual IDs from your Firestore `companies` and `turfs` collections before
 * running against a real environment.
 */

const admin = require("firebase-admin");

admin.initializeApp({ projectId: "sowin-power" });

const db = admin.firestore();

const inDays = (n) =>
  admin.firestore.Timestamp.fromDate(
    new Date(Date.now() + n * 24 * 60 * 60 * 1000)
  );

const coupons = [
  // ─── PLATFORM COUPONS (created by PlayGrid) ──────────────────────────────

  {
    code: "PLAY50",
    title: "₹50 Off Your First Booking",
    description: "Use on your first PlayGrid booking!",
    channel: "platform",
    companyId: null,
    turfIds: null,
    discountType: "flat",
    discountValue: 50,
    maxDiscountAmount: null,
    minBookingAmount: 200,
    validFrom: inDays(0),
    validTo: inDays(365),
    totalUsageLimit: null,
    usageCount: 0,
    perUserLimit: 1,
    applicableToNegotiated: true,
    applicableToNoAdvance: true,
    // Platform coupons don't have companyStatus — default to "active"
    companyStatus: "active",
    status: "active",
    createdBy: "admin",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  },

  {
    code: "MONSOON30",
    title: "30% Off — Monsoon Special",
    description: "30% off all bookings this monsoon season. Max ₹300 off.",
    channel: "platform",
    companyId: null,
    turfIds: null,
    discountType: "percentage",
    discountValue: 30,
    maxDiscountAmount: 300,
    minBookingAmount: 500,
    validFrom: inDays(0),
    validTo: inDays(90),
    totalUsageLimit: 500,
    usageCount: 0,
    perUserLimit: 2,
    applicableToNegotiated: true,
    applicableToNoAdvance: true,
    companyStatus: "active",
    status: "active",
    createdBy: "admin",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  },

  // ─── TURF COUPONS (created by admin in coordination with company) ─────────
  // Replace the placeholder IDs before running against a real environment.

  {
    code: "WEEKEND20",
    title: "20% Off Weekend Slots",
    description: "Save 20% on all weekend bookings. Max ₹250 off.",
    channel: "turf",
    companyId: "rMdBYDK1NQKPATHbEIAD",
    turfIds: ["turf_1769500158620_jr1aqrwyi", "turf_1769536212995_h7134cwv8"],
    discountType: "percentage",
    discountValue: 20,
    maxDiscountAmount: 250,
    minBookingAmount: 500,
    validFrom: inDays(0),
    validTo: inDays(30),
    totalUsageLimit: 100,
    usageCount: 0,
    perUserLimit: 2,
    applicableToNegotiated: false,
    applicableToNoAdvance: true,
    companyStatus: "active",
    status: "active",
    createdBy: "admin",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  },

  {
    code: "FLAT100",
    title: "₹100 Off on Bookings Above ₹600",
    description: "Flat ₹100 off when your total booking exceeds ₹600.",
    channel: "turf",
    companyId: "rMdBYDK1NQKPATHbEIAD",
    turfIds: ["turf_1769500158620_jr1aqrwyi", "turf_1769536212995_h7134cwv8"],
    discountType: "flat",
    discountValue: 100,
    maxDiscountAmount: null,
    minBookingAmount: 600,
    validFrom: inDays(0),
    validTo: inDays(60),
    totalUsageLimit: 50,
    usageCount: 0,
    perUserLimit: 1,
    applicableToNegotiated: false,
    applicableToNoAdvance: true,
    companyStatus: "active",
    status: "active",
    createdBy: "admin",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  },
];

async function seed() {
  console.log(`Seeding ${coupons.length} coupons...`);

  for (const coupon of coupons) {
    // Use code as document ID for easy lookup by code in queries
    const docRef = db.collection("coupons").doc(coupon.code);
    const existing = await docRef.get();

    if (existing.exists) {
      console.log(`  SKIP  ${coupon.code} — already exists`);
    } else {
      await docRef.set(coupon);
      console.log(`  ADDED ${coupon.code} — ${coupon.title}`);
    }
  }

  console.log("Done.");
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
