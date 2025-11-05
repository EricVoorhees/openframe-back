# Tier System - Quick Reference

## 🎯 What It Does

**Before ANY AI request**, the system automatically checks:

1. ✅ User identity (Firebase UID)
2. ✅ Payment status (if Pro/Enterprise)
3. ✅ Token quota remaining
4. ✅ Concurrent agents limit
5. ✅ Account status (active/suspended)

**Result:** ✅ Allowed or ❌ Denied with specific reason

---

## 📊 The 3 Tiers

| Feature               | Free  | Pro ($29/mo) | Enterprise ($299/mo) |
| --------------------- | ----- | ------------ | -------------------- |
| **Tokens/Month**      | 50K   | 1M           | 10M                  |
| **Concurrent Agents** | 1     | 3            | 10                   |
| **Tasks/Minute**      | 5     | 20           | 100                  |
| **Features**          | Basic | Advanced     | All + Custom         |
| **Payment**           | None  | Required     | Required             |

---

## 🔄 How It Works (Simple)

```
User makes AI request
         ↓
Check Firebase for user tier
         ↓
Is paid? (if not free) → NO → ❌ 403: Payment required
         ↓ YES
Tokens left? → NO → ❌ 403: Quota exceeded
         ↓ YES
Agents available? → NO → ❌ 403: Max agents reached
         ↓ YES
✅ Process request
         ↓
Track tokens used
Update concurrent agent count
```

---

## 🚀 Quick Setup

### 1. Enable Firestore

```bash
# Firebase Console → Firestore Database → Create Database
```

### 2. Environment Variables

```bash
# Already in your backend/.env
FIREBASE_PROJECT_ID=your-project
FIREBASE_PRIVATE_KEY="..."
FIREBASE_CLIENT_EMAIL=...
```

### 3. That's It!

The system automatically:

- Creates user record on first request
- Starts them on FREE tier
- Tracks usage in real-time

---

## 📡 API Examples

### Get User Stats

```bash
GET /api/agent/stats
Authorization: Bearer <firebase-token>

# Returns:
{
  "tier": "pro",
  "isPaid": true,
  "usage": {
    "tokensUsed": 45000,
    "tokensRemaining": 955000
  },
  "limits": {
    "currentConcurrentAgents": 1,
    "maxConcurrentAgents": 3
  }
}
```

### Upgrade User (Admin/Webhook)

```bash
POST /api/admin/users/USER_UID/tier
X-API-Key: <service-key>

{
  "uid": "user-123",
  "tier": "pro",
  "isPaid": true,
  "paymentStatus": "active"
}
```

---

## 💳 Stripe Integration (3 Steps)

### 1. Frontend: Create Subscription

```typescript
const session = await stripe.checkout.sessions.create({
  metadata: { uid: user.uid }, // ⭐ Important!
  line_items: [{ price: "price_pro", quantity: 1 }],
  mode: "subscription",
});
```

### 2. Stripe: Setup Webhook

```
Dashboard → Webhooks → Add Endpoint
URL: https://your-api.com/api/webhooks/stripe
Events: customer.subscription.*
```

### 3. Done!

Backend automatically:

- Receives webhook
- Updates user tier
- User can immediately use Pro features

---

## 🎨 Frontend Usage

### Check Before Showing AI Button

```typescript
const stats = await apiClient.getUserStats();

const canUseAI =
  stats.isPaid &&
  stats.usage.tokensRemaining > 0 &&
  stats.limits.currentConcurrentAgents < stats.limits.maxConcurrentAgents;

<button disabled={!canUseAI}>Ask AI</button>;
```

### Handle Errors

```typescript
try {
  await apiClient.createTask({...});
} catch (error) {
  if (error.response?.status === 403) {
    // Show upgrade modal
    showUpgradeModal(error.response.data.message);
  }
}
```

---

## 🔧 Common Tasks

### Manually Upgrade User

```bash
curl -X POST http://localhost:3001/api/admin/users/USER_UID/tier \
  -H "X-API-Key: your-service-key" \
  -d '{"uid":"USER_UID","tier":"pro","isPaid":true,"paymentStatus":"active"}'
```

### Grant Bonus Tokens

```bash
curl -X POST http://localhost:3001/api/admin/users/USER_UID/grant-tokens \
  -H "X-API-Key: your-service-key" \
  -d '{"tokens":100000}'
```

### Reset Billing Cycle

```bash
curl -X POST http://localhost:3001/api/admin/users/USER_UID/reset-billing \
  -H "X-API-Key: your-service-key"
```

---

## 📍 Firestore Structure

```
/users/{uid}
  - tier: "free" | "pro" | "enterprise"
  - isPaid: true/false
  - paymentStatus: "active" | "past_due" | etc.
  - tokensUsedThisMonth: 45000
  - currentConcurrentAgents: 1
  - billingCycleEnd: Timestamp

/usage_logs/{logId}
  - uid: "user-123"
  - tokensUsed: 500
  - timestamp: Timestamp
```

---

## ❓ FAQ

**Q: What happens when a free user tries to use AI?**
A: ✅ Works! Up to 50K tokens/month, 1 agent at a time.

**Q: What if they hit the limit?**
A: ❌ 403 error with message: "Monthly limit exceeded. Upgrade to Pro?"

**Q: How do concurrent agents work?**
A: When task starts: `currentConcurrentAgents++`
When task finishes: `currentConcurrentAgents--`
If at max: ❌ 403: "Max concurrent agents reached"

**Q: How does billing cycle reset?**
A: Auto-resets after 30 days. Sets `tokensUsedThisMonth = 0`.

**Q: Can I test without Stripe?**
A: ✅ Yes! Use admin API to manually set tier.

**Q: What about Firebase costs?**
A: ~$0.06 per 100K document reads. For 1000 users = ~$5-10/month.

---

## 🚨 Error Messages Explained

| Error                           | Meaning                      | Solution                          |
| ------------------------------- | ---------------------------- | --------------------------------- |
| "Payment required"              | Pro/Enterprise user not paid | Complete payment or use admin API |
| "Subscription is past_due"      | Payment failed               | Update payment method             |
| "Monthly limit exceeded"        | Out of tokens                | Wait for reset or upgrade         |
| "Max concurrent agents reached" | Too many tasks running       | Wait or upgrade tier              |

---

## 📚 Full Documentation

See **[TIER_SYSTEM_GUIDE.md](./TIER_SYSTEM_GUIDE.md)** for complete details.

---

## ✅ Checklist

- [ ] Firestore enabled in Firebase Console
- [ ] Environment variables configured
- [ ] Security rules set (users read-only from client)
- [ ] Stripe webhook configured (if using Stripe)
- [ ] Frontend checks tier before showing AI features
- [ ] Error handling shows upgrade prompts

---

**You're ready to handle thousands of users with proper tier management! 🎉**
