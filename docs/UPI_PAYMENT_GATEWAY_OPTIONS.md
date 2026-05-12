# UPI Payment Gateway Options — Low/No Commission APIs

> **Context:** Turf-1701 currently uses manual UPI payment collection for advance bookings and subscriptions. This document evaluates automated UPI payment gateway APIs with zero, low, or annually charged pricing models as a replacement — to improve UX and automate payment confirmation.

---

## Why Manual UPI is a Problem

- No automated payment confirmation → staff has to verify screenshots
- User experience is poor — no instant booking confirmation
- Subscription renewals can't be automated
- No refund automation
- No dispute/chargeback support

---

## Shortlisted Gateways

### 1. Cashfree Payments ⭐ Recommended

| Property | Details |
|---|---|
| UPI Commission | **0%** on UPI (true zero MDR) |
| Promotional Rate | **1.6% flat** on all domestic methods (new merchants: Sept 2025 – Jul 2026, min 40% UPI volume) |
| React Native SDK | ✅ Official SDK on npm |
| Webhooks | ✅ With signature verification |
| Settlement | **T+1** standard; **T+15min** instant settlement available |
| Setup Fee | None |
| Annual Fee | None |

**Strengths:**
- Fastest settlement in the industry (T+1)
- Official React Native SDK: `cashfree-pg-react-native`
- Webhook callbacks with HMAC signature verification
- Auto-refunds supported
- Strong API docs

**Best for Turf-1701:** Advance booking payments and subscription payments with instant confirmation callbacks.

**Docs:** https://www.cashfree.com/docs/payments/online/mobile/react-native

---

### 2. Paytm Payment Gateway ⭐ Best for Startups

| Property | Details |
|---|---|
| UPI Commission | **0% lifetime** (government mandated zero MDR) |
| RuPay Debit | 0% |
| Credit Cards | 1.99% |
| React Native SDK | ✅ Available |
| Webhooks | ✅ |
| Settlement | T+2 to T+3 (standard) |
| Setup Fee | None |
| Annual Fee | None |
| Startup Program | ✅ "Paytm for Startups" — zero fees for bootstrapped startups |

**Strengths:**
- Government-mandated zero commission on UPI forever
- Paytm for Startups program waives all fees
- Complete payment suite (UPI, cards, wallets, netbanking)
- Good for Indian market adoption

**Docs:** https://business.paytm.com/pricing  
**Startup Program:** https://business.paytm.com/paytm-startups

---

### 3. PhonePe for Business

| Property | Details |
|---|---|
| UPI Commission (bank-to-bank) | **0%** |
| UPI via Wallet (>₹2,000) | Up to 1.1% |
| Online PG | 2% |
| React Native SDK | ✅ Available |
| Webhooks | ✅ |
| Settlement | Not publicly specified |
| Setup Fee | None |
| Annual Fee | None |

**Strengths:**
- True zero commission on bank-to-bank UPI (most turf bookings will be this type)
- No setup or annual fees
- Large PhonePe user base in India

**Docs:** https://business.phonepe.com/

---

### 4. Razorpay

| Property | Details |
|---|---|
| UPI Commission | **2%** (0% MDR + 2% platform fee) |
| Standard Rate | 2% + 18% GST |
| React Native SDK | ✅ Official, well-documented |
| Webhooks | ✅ Async, near real-time |
| Settlement | T+2 to T+3; instant at 0.25% extra |
| Setup Fee | None |
| Annual Fee | None |
| Enterprise | Custom rates for ₹5L+/month |

**Strengths:**
- Best documentation and developer experience
- Most mature React Native SDK
- Razorpay Subscriptions API built-in (great for turf subscriptions)
- Autopay/e-mandate for recurring payments
- Best dispute/refund automation

**Note:** 2% is not zero commission, but the developer experience and subscription API may justify the cost.

**Docs:** https://razorpay.com/docs/payments/payment-gateway/react-native-integration/standard/  
**Subscriptions:** https://razorpay.com/docs/payments/subscriptions/

---

### 5. PayU

| Property | Details |
|---|---|
| UPI Commission | **2% + 18% GST** |
| React Native SDK | ✅ Official npm package: `payu-upi-react` |
| Webhooks | ✅ S2S callbacks |
| Settlement | T+2 to T+3 |
| Setup Fee | None |
| Annual Fee | None |

**Note:** Not the cheapest option. Included for reference; not recommended over Cashfree/Paytm.

---

### 6. Juspay (HyperCheckout / HyperUPI)

| Property | Details |
|---|---|
| UPI Commission | 1.5% – 2.5% (custom quote) |
| React Native SDK | ✅ |
| Webhooks | ✅ |
| Settlement | Not publicly specified |
| Startup Plan | No free tier; contact required |

**Strengths:**
- HyperUPI claims 90%+ UPI success rate (higher than competitors)
- Best for high-volume merchants facing drop-offs

**Note:** Pricing requires a sales call. Not suitable if you want transparent self-serve pricing.

---

### 7. Easebuzz

| Property | Details |
|---|---|
| UPI Commission | Up to 1.1% (interchange-based) |
| React Native SDK | ✅ |
| Webhooks | ✅ |
| Custom Pricing | Requires contacting sales |

**Note:** Positioned as low-margin but not self-serve. Suitable for volume-based negotiation later.

---

### 8. Instamojo ❌ Not Recommended

| Property | Details |
|---|---|
| UPI Commission | **5% + ₹3 per transaction** |
| React Native SDK | ❌ No official SDK (community package, 4 years old) |

Way too expensive for this use case. Skip.

---

### 9. Decentro (Banking API) — Enterprise Only

| Property | Details |
|---|---|
| Pricing | Monthly SaaS + per-API call |
| UPI Support | ✅ UPI Collections API v2 |
| React Native | Limited |

**Note:** Built for fintech/enterprise banking integrations, not app-level payment collection. Overkill and more expensive for Turf-1701's use case.

---

## Comparison Table

| Gateway | UPI Rate | React Native | Webhooks | Settlement | Startup Plan | Verdict |
|---|---|---|---|---|---|---|
| **Cashfree** | 0% | ✅ Official | ✅ | T+1 | Promo 1.6% | ⭐ Best overall |
| **Paytm** | 0% lifetime | ✅ | ✅ | T+2-T+3 | ✅ Zero fees | ⭐ Best for 0 cost |
| **PhonePe** | 0% (bank UPI) | ✅ | ✅ | N/A | ✅ No fees | Good option |
| **Razorpay** | 2% + GST | ✅ Best DX | ✅ | T+2-T+3 | ❌ | Best if subscription API needed |
| **PayU** | 2% + GST | ✅ | ✅ | T+2-T+3 | ❌ | Average |
| **Juspay** | 1.5-2.5% | ✅ | ✅ | N/A | ❌ | High-volume only |
| **Easebuzz** | ~1.1% | ✅ | ✅ | N/A | ❌ | Contact for rates |
| **Instamojo** | 5% + ₹3 | ❌ | ✅ | N/A | ❌ | ❌ Skip |
| **Decentro** | Custom API | Limited | ✅ | N/A | ❌ | Enterprise only |

---

## Recommendation for Turf-1701

### Phase 1 — Booking Advance Payments
**Use Cashfree or Paytm.**

- Both offer 0% UPI commission
- Both have official React Native SDKs
- Cashfree has T+1 settlement + instant option (great for slot confirmations)
- Paytm Startups program = zero cost for early stage

### Phase 2 — Subscription Recurring Payments
**Use Razorpay Subscriptions** (even at 2%) OR **Cashfree Subscriptions**.

- Razorpay has the most mature Subscriptions/Autopay API in India
- Supports UPI Autopay (eMandate) for recurring monthly/annual plans
- Webhook events for `subscription.charged`, `subscription.halted`, etc.

---

## Integration Pattern for React Native (Cashfree Example)

```js
// 1. Backend creates order and returns order_id + payment_session_id
// 2. App calls Cashfree SDK with session ID
// 3. Cashfree handles UPI intent/collect flow natively
// 4. Backend webhook receives PAYMENT_SUCCESS / PAYMENT_FAILED event
// 5. Update Firestore booking/subscription status

import { CFPaymentGatewayService } from 'react-native-cashfree-pg-sdk';

const startPayment = async (sessionId, orderId) => {
  const session = new CFSession(sessionId, orderId, CFEnvironment.PRODUCTION);
  await CFPaymentGatewayService.doPayment(session);
};
```

**Webhook flow:**
```
User pays via UPI app
    → Cashfree confirms with bank
        → POST to your Cloud Function webhook URL
            → Cloud Function updates Firestore booking status
                → App gets real-time update via Firestore listener
```

---

## Next Steps

1. **Sign up** on Cashfree or Paytm for Business (takes ~1 day for KYC)
2. **Get API keys** (test + production)
3. Replace manual UPI in booking flow with SDK-based checkout
4. Add a Cloud Function webhook endpoint to handle payment events
5. Wire up Firestore booking status update on webhook confirmation
6. For subscriptions: evaluate Razorpay Subscriptions API separately

---

*Research date: 2026-05-09*  
*All pricing subject to change — verify on official sites before integrating.*
