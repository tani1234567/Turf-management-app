/**
 * Seed script — adds sample offers to Firestore `offers` collection.
 * Run from the functions/ directory:
 *   node seedOffers.js
 *
 * Requires Application Default Credentials. If you get an auth error, run:
 *   gcloud auth application-default login
 * or set GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json
 */

const admin = require("firebase-admin");

admin.initializeApp({ projectId: "sowin-power" });

const db = admin.firestore();

const now = admin.firestore.Timestamp.now();
const inDays = (n) =>
  admin.firestore.Timestamp.fromDate(new Date(Date.now() + n * 24 * 60 * 60 * 1000));

const offers = [
  // ─── FEATURED ───────────────────────────────────────────────────────────────

  {
    title: "20% Off on All Football Gear",
    description:
      "Get 20% off on all football boots, shin guards, and jerseys at Decathlon. Valid on in-store and online purchases. Minimum order ₹999.",
    category: "sports_equipment",
    brandName: "Decathlon",
    bannerImage: null,
    discount: "20% OFF",
    couponCode: "TURF20",
    externalLink: "https://www.decathlon.in",
    validUntil: inDays(30),
    isFeatured: true,
    isActive: true,
    createdAt: now,
  },
  {
    title: "Free Protein Shake on Every Order",
    description:
      "Order any meal above ₹299 from HustleFuel and get a complimentary chocolate protein shake. Delivery across Pune & Mumbai.",
    category: "food_beverage",
    brandName: "HustleFuel",
    bannerImage: null,
    discount: "Free Shake",
    couponCode: "PLAYGRID",
    externalLink: null,
    validUntil: inDays(14),
    isFeatured: true,
    isActive: true,
    createdAt: now,
  },
  {
    title: "30% Off Your First Month of Coaching",
    description:
      "Enroll in any football or cricket coaching program at Elite Sports Academy and get 30% off your first month. Experienced coaches, flexible batches.",
    category: "academy",
    brandName: "Elite Sports Academy",
    bannerImage: null,
    discount: "30% OFF",
    couponCode: "GRIDCOACH30",
    externalLink: null,
    validUntil: inDays(45),
    isFeatured: true,
    isActive: true,
    createdAt: now,
  },

  // ─── SPORTS EQUIPMENT ────────────────────────────────────────────────────────

  {
    title: "Flat ₹500 Off on Nike Footwear",
    description:
      "Exclusive discount on Nike football and running shoes. Visit the nearest Nike store or shop online. Minimum purchase ₹3000.",
    category: "sports_equipment",
    brandName: "Nike",
    bannerImage: null,
    discount: "₹500 OFF",
    couponCode: "NIKE500",
    externalLink: "https://www.nike.com/in",
    validUntil: inDays(21),
    isFeatured: false,
    isActive: true,
    createdAt: now,
  },
  {
    title: "Buy 1 Get 1 on Sports Accessories",
    description:
      "Buy any sports accessory (gloves, knee pads, grip tape) and get the second one free. At all Sports Station outlets.",
    category: "sports_equipment",
    brandName: "Sports Station",
    bannerImage: null,
    discount: "Buy 1 Get 1",
    couponCode: null,
    externalLink: "https://www.sportsstation.in",
    validUntil: inDays(10),
    isFeatured: false,
    isActive: true,
    createdAt: now,
  },
  {
    title: "15% Off Puma Sports Collection",
    description:
      "Flat 15% off on Puma's entire sports collection including tracksuits, jerseys, and training footwear. Online exclusive.",
    category: "sports_equipment",
    brandName: "Puma",
    bannerImage: null,
    discount: "15% OFF",
    couponCode: "PUMA15",
    externalLink: "https://in.puma.com",
    validUntil: inDays(18),
    isFeatured: false,
    isActive: true,
    createdAt: now,
  },

  // ─── FOOD & BEVERAGE ─────────────────────────────────────────────────────────

  {
    title: "Energy Drink Bundle at 25% Off",
    description:
      "Stock up on Gatorade. Buy any 6-pack of Gatorade sports drinks and get 25% off. Available at all partner retailers and quick commerce.",
    category: "food_beverage",
    brandName: "Gatorade",
    bannerImage: null,
    discount: "25% OFF",
    couponCode: "GATORADE25",
    externalLink: null,
    validUntil: inDays(20),
    isFeatured: false,
    isActive: true,
    createdAt: now,
  },
  {
    title: "Post-Game Meal Combo at ₹199",
    description:
      "High-protein post-game meal combo — grilled chicken wrap + protein shake + banana. Available on Zomato and Swiggy.",
    category: "food_beverage",
    brandName: "FitBowl Kitchen",
    bannerImage: null,
    discount: "Combo ₹199",
    couponCode: "FITGAME",
    externalLink: null,
    validUntil: inDays(7),
    isFeatured: false,
    isActive: true,
    createdAt: now,
  },
  {
    title: "Free Red Bull with Booking",
    description:
      "Book any turf on PlayGrid and get a complimentary Red Bull at the venue. Show your booking confirmation to the caretaker.",
    category: "food_beverage",
    brandName: "Red Bull",
    bannerImage: null,
    discount: "Free Can",
    couponCode: null,
    externalLink: null,
    validUntil: inDays(30),
    isFeatured: false,
    isActive: true,
    createdAt: now,
  },

  // ─── TURF PROMOS ─────────────────────────────────────────────────────────────

  {
    title: "Weekend Special — Book 2 Hours, Get 1 Free",
    description:
      "Book any 2-hour slot on weekends at Champion's Arena and get an extra hour absolutely free. Valid for all grounds.",
    category: "turf_promo",
    brandName: "Champion's Arena",
    bannerImage: null,
    discount: "1 Hr Free",
    couponCode: "CHAMPARENA",
    externalLink: null,
    validUntil: inDays(21),
    isFeatured: false,
    isActive: true,
    createdAt: now,
  },
  {
    title: "Inaugural Offer — 40% Off All Slots",
    description:
      "Celebrating the launch of our new FIFA-standard turf! Book any slot this month and enjoy 40% off. Limited time only.",
    category: "turf_promo",
    brandName: "ProGround Sports",
    bannerImage: null,
    discount: "40% OFF",
    couponCode: "PROLAUNCH",
    externalLink: null,
    validUntil: inDays(15),
    isFeatured: false,
    isActive: true,
    createdAt: now,
  },
  {
    title: "Monthly Membership at ₹1999",
    description:
      "Unlimited bookings (up to 2 hrs/day) for the entire month. Includes access to all 3 grounds and free locker storage.",
    category: "turf_promo",
    brandName: "Green Field Turf",
    bannerImage: null,
    discount: "₹1999/month",
    couponCode: "GFMEMBER",
    externalLink: null,
    validUntil: inDays(60),
    isFeatured: false,
    isActive: true,
    createdAt: now,
  },

  // ─── ACADEMY ─────────────────────────────────────────────────────────────────

  {
    title: "Summer Football Camp — Registrations Open",
    description:
      "4-week summer football camp for ages 8–18. Professional coaching, FIFA-standard turf, kit included. Morning and evening batches available.",
    category: "academy",
    brandName: "Goal Masters Academy",
    bannerImage: null,
    discount: "Early Bird 20%",
    couponCode: "GMCAMP20",
    externalLink: null,
    validUntil: inDays(25),
    isFeatured: false,
    isActive: true,
    createdAt: now,
  },
  {
    title: "Cricket Batting Masterclass",
    description:
      "Two-day intensive batting masterclass with a certified BCCI coach. Limited to 12 participants per batch. All skill levels welcome.",
    category: "academy",
    brandName: "StrikeZone Cricket",
    bannerImage: null,
    discount: "₹500 Off",
    couponCode: "SZMASTER",
    externalLink: "https://strikezone.in",
    validUntil: inDays(12),
    isFeatured: false,
    isActive: true,
    createdAt: now,
  },
];

async function seed() {
  console.log(`\n🌱  Seeding ${offers.length} offers to Firestore (project: sowin-power)...\n`);

  const batch = db.batch();
  const col = db.collection("offers");

  offers.forEach((offer, i) => {
    const ref = col.doc();
    batch.set(ref, offer);
    console.log(`  [${String(i + 1).padStart(2, "0")}] ${offer.brandName.padEnd(22)} — ${offer.title.slice(0, 50)}`);
  });

  await batch.commit();
  console.log(`\n✅  Done! ${offers.length} offers written.\n`);
}

seed().catch((err) => {
  console.error("\n❌  Seed failed:", err.message);
  if (err.code === 7 || err.message?.includes("credentials")) {
    console.error(
      "\n  Auth error. Fix options:\n" +
      "  1. Run: gcloud auth application-default login\n" +
      "  2. Set GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json\n" +
      "     (Download from Firebase Console → Project Settings → Service Accounts)\n"
    );
  }
  process.exit(1);
});
