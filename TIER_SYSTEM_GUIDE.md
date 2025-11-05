# User Tier & Payment System Guide

Complete guide to the multi-tier user management system with Firebase integration.

## 📊 Overview

This system provides **professional-grade user tier management** with:
- ✅ **3 Tiers:** Free, Pro, Enterprise
- ✅ **Firebase Authentication & Firestore** for real-time tracking
- ✅ **Payment Verification** before AI usage
- ✅ **Multiple Concurrent Agents** per user (tier-based limits)
- ✅ **Real-time Token Tracking** synced with Firebase
- ✅ **Stripe Webhook Integration** for automatic upgrades/downgrades
- ✅ **Admin API** for manual tier management

---

## 🎯 Tier Configurations

### **Free Tier**
```typescript
{
  tier: 'free',
  monthlyTokenLimit: 50000,        // 50K tokens/month
  maxConcurrentAgents: 1,          // Only 1 AI agent at a time
  tasksPerMinute: 5,               // Rate limit
  features: ['basic_ai', 'patch', 'explain'],
  price: 0
}
```

### **Pro Tier** ($29/month)
```typescript
{
  tier: 'pro',
  monthlyTokenLimit: 1000000,      // 1M tokens/month
  maxConcurrentAgents: 3,          // 3 AI agents simultaneously
  tasksPerMinute: 20,              // Higher rate limit
  features: ['basic_ai', 'patch', 'explain', 'generate_test', 
             'lint_fix', 'priority_queue'],
  price: 2900  // $29.00
}
```

### **Enterprise Tier** ($299/month)
```typescript
{
  tier: 'enterprise',
  monthlyTokenLimit: 10000000,     // 10M tokens/month
  maxConcurrentAgents: 10,         // 10 AI agents simultaneously
  tasksPerMinute: 100,             // Highest rate limit
  features: ['all', 'dedicated_support', 'custom_models', 'sla'],
  price: 29900  // $299.00
}
```

---

## 🔄 How It Works

### **1. User Creates Account**
```
Frontend: Firebase Auth login
      ↓
Backend receives first request
      ↓
FirebaseService.upsertUserData()
      ↓
Creates Firestore document:
  /users/{uid}
    - tier: 'free'
    - isPaid: false
    - tokensUsedThisMonth: 0
    - currentConcurrentAgents: 0
```

### **2. User Requests AI Task**
```
POST /api/agent/tasks
  Authorization: Bearer <firebase-token>
      ↓
Middleware: verifyFirebaseToken
  - Validates token
  - Extracts uid
      ↓
Middleware: verifyTierAccess
  - Gets user from Firestore
  - Checks: isPaid (if not free tier)
  - Checks: paymentStatus === 'active'
  - Checks: tokensUsed < limit
  - Checks: concurrentAgents < max
      ↓
✅ ALLOWED → Increment concurrentAgents
❌ DENIED → Return 403 with reason
```

### **3. Task Processing**
```
Worker picks up task
      ↓
Increment: currentConcurrentAgents + 1
      ↓
Execute AI task (HumanLayer)
      ↓
Task completes
      ↓
Track: tokensUsedThisMonth + tokens
      ↓
Decrement: currentConcurrentAgents - 1
```

### **4. Billing Cycle Reset**
```
Every 30 days:
      ↓
Check: billingCycleEnd < now
      ↓
Reset:
  - tokensUsedThisMonth = 0
  - tasksCompletedThisMonth = 0
  - billingCycleStart = now
  - billingCycleEnd = now + 30 days
```

---

## 🔐 Security Checks

### **Before Every AI Request:**

1. **Identity Verification** ✅
   ```typescript
   // Firebase token verification
   const uid = await verifyFirebaseToken(idToken);
   ```

2. **Payment Status** ✅
   ```typescript
   if (tier !== 'free' && !isPaid) {
     return '403: Payment required';
   }
   ```

3. **Account Status** ✅
   ```typescript
   if (paymentStatus !== 'active' && paymentStatus !== 'trialing') {
     return '403: Subscription is past_due/canceled';
   }
   ```

4. **Token Quota** ✅
   ```typescript
   if (tokensUsedThisMonth >= monthlyTokenLimit) {
     return '403: Monthly limit exceeded';
   }
   ```

5. **Concurrent Agents** ✅
   ```typescript
   if (currentConcurrentAgents >= maxConcurrentAgents) {
     return '403: Max concurrent agents reached';
   }
   ```

---

## 📁 Firestore Data Structure

### **User Document** (`/users/{uid}`)
```typescript
{
  uid: "firebase-uid",
  email: "user@example.com",
  tier: "pro",                    // free | pro | enterprise
  isPaid: true,
  paymentStatus: "active",        // active | past_due | canceled | trialing | none
  
  // Stripe integration
  stripeCustomerId: "cus_...",
  stripeSubscriptionId: "sub_...",
  
  // Usage tracking (real-time)
  tokensUsedThisMonth: 45000,
  tasksCompletedThisMonth: 120,
  currentConcurrentAgents: 2,     // How many agents running NOW
  
  // Timestamps
  createdAt: Timestamp,
  updatedAt: Timestamp,
  billingCycleStart: Timestamp,
  billingCycleEnd: Timestamp,
  
  // Features
  enabledFeatures: ["basic_ai", "patch", "explain", ...]
}
```

### **Usage Log Collection** (`/usage_logs`)
```typescript
{
  uid: "firebase-uid",
  tokensUsed: 500,
  timestamp: Timestamp,
  type: "task_completion"
}
```

---

## 🚀 API Endpoints

### **User Stats** (Frontend)
```bash
GET /api/agent/stats
Authorization: Bearer <firebase-token>

Response:
{
  "tier": "pro",
  "isPaid": true,
  "paymentStatus": "active",
  "usage": {
    "tokensUsed": 45000,
    "tokensRemaining": 955000,
    "tasksCompleted": 120
  },
  "limits": {
    "maxConcurrentAgents": 3,
    "currentConcurrentAgents": 1
  },
  "billingCycle": {
    "endsAt": "2025-12-04T12:00:00Z"
  }
}
```

### **Update User Tier** (Admin/Webhook)
```bash
POST /api/admin/users/:uid/tier
Headers:
  X-API-Key: <service-api-key>
Body:
{
  "uid": "user-123",
  "tier": "pro",
  "isPaid": true,
  "paymentStatus": "active",
  "stripeCustomerId": "cus_...",
  "stripeSubscriptionId": "sub_..."
}
```

### **Grant Bonus Tokens** (Admin)
```bash
POST /api/admin/users/:uid/grant-tokens
Headers:
  X-API-Key: <service-api-key>
Body:
{
  "tokens": 100000  // Grant 100K bonus tokens
}
```

### **Stripe Webhook**
```bash
POST /api/webhooks/stripe
Headers:
  Stripe-Signature: <stripe-signature>
Body:
{
  "type": "customer.subscription.updated",
  "data": {
    "object": {
      "id": "sub_...",
      "customer": "cus_...",
      "status": "active",
      "metadata": {
        "uid": "firebase-uid"  // IMPORTANT: Add this when creating subscription
      }
    }
  }
}
```

---

## 💳 Stripe Integration

### **1. Create Subscription (Frontend)**
```typescript
// In your frontend checkout
const { error } = await stripe.checkout.sessions.create({
  customer_email: user.email,
  metadata: {
    uid: user.uid,  // ⭐ CRITICAL: Pass Firebase UID
  },
  line_items: [{
    price: 'price_pro_monthly',  // Your Stripe price ID
    quantity: 1,
  }],
  mode: 'subscription',
  success_url: 'https://yourapp.com/success',
  cancel_url: 'https://yourapp.com/cancel',
});
```

### **2. Stripe Webhook (Backend)**
```typescript
// backend/src/routes/webhooks.ts handles:
// - customer.subscription.created
// - customer.subscription.updated
// - customer.subscription.deleted
// - invoice.payment_failed

// Automatically updates user tier in Firestore
```

### **3. Setup Webhook in Stripe**
```bash
# Add webhook endpoint in Stripe Dashboard:
URL: https://your-api.com/api/webhooks/stripe

Events to listen for:
✅ customer.subscription.created
✅ customer.subscription.updated  
✅ customer.subscription.deleted
✅ invoice.payment_succeeded
✅ invoice.payment_failed
```

---

## 🎨 Frontend Integration

### **Check User Access Before Showing AI Button**
```typescript
import { apiClient } from './services/api';

const UserDashboard = () => {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    async function loadStats() {
      const data = await apiClient.getUserStats();
      setStats(data);
    }
    loadStats();
  }, []);

  const canUseAI = stats && 
    stats.isPaid && 
    stats.paymentStatus === 'active' &&
    stats.usage.tokensRemaining > 0 &&
    stats.limits.currentConcurrentAgents < stats.limits.maxConcurrentAgents;

  return (
    <div>
      <h2>Your Plan: {stats?.tier}</h2>
      <p>Tokens Used: {stats?.usage.tokensUsed} / {stats?.usage.tokensUsed + stats?.usage.tokensRemaining}</p>
      <p>Active Agents: {stats?.limits.currentConcurrentAgents} / {stats?.limits.maxConcurrentAgents}</p>
      
      {!canUseAI && (
        <div className="upgrade-banner">
          <p>Upgrade to continue using AI features</p>
          <button onClick={handleUpgrade}>Upgrade to Pro</button>
        </div>
      )}
      
      <button disabled={!canUseAI} onClick={handleAIRequest}>
        Ask AI
      </button>
    </div>
  );
};
```

### **Handle 403 Errors Gracefully**
```typescript
try {
  const task = await apiClient.createTask({...});
} catch (error) {
  if (error.response?.status === 403) {
    const data = error.response.data;
    
    // Show specific message
    showNotification(data.message);
    
    // Show upgrade modal if needed
    if (data.paymentStatus !== 'active') {
      openUpgradeModal();
    }
  }
}
```

---

## 🔧 Configuration

### **Environment Variables**
```bash
# Add to backend/.env
FIREBASE_PROJECT_ID=your-project
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com

# Optional: Stripe integration
STRIPE_PRO_PRICE_ID=price_pro_monthly
STRIPE_ENTERPRISE_PRICE_ID=price_enterprise_monthly
```

### **Firestore Setup**
```bash
# 1. Enable Firestore in Firebase Console
# 2. Create indexes (if needed for queries)
# 3. Set security rules:
```

```javascript
// Firestore Security Rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read their own data
    match /users/{uid} {
      allow read: if request.auth != null && request.auth.uid == uid;
      allow write: if false;  // Only backend can write
    }
    
    // Usage logs - backend only
    match /usage_logs/{logId} {
      allow read, write: if false;  // Backend only
    }
  }
}
```

---

## 📊 Monitoring & Analytics

### **Track Key Metrics**
```typescript
// Usage metrics per tier
const metrics = await db.collection('users')
  .where('tier', '==', 'pro')
  .get();

// Total tokens used this month
const totalTokens = users.reduce((sum, user) => 
  sum + user.tokensUsedThisMonth, 0
);

// Average concurrent agents
const avgConcurrent = users.reduce((sum, user) => 
  sum + user.currentConcurrentAgents, 0
) / users.length;
```

### **Cost Tracking**
```typescript
// Estimate monthly cost
const costPerToken = 0.00001;  // $0.01 per 1K tokens
const monthlyCost = totalTokens * costPerToken;

// Revenue
const revenue = (proCoun t * 29) + (enterpriseCount * 299);

// Profit margin
const margin = revenue - monthlyCost;
```

---

## 🧪 Testing

### **Test Tier Access**
```bash
# 1. Create test user (Free tier)
curl -X POST http://localhost:3001/api/agent/tasks \
  -H "Authorization: Bearer <firebase-token>" \
  -H "Content-Type: application/json" \
  -d '{"projectId":"test", ...}'

# Should work (within free limits)

# 2. Exhaust free tier
# Make 50K+ tokens worth of requests

# 3. Try again
# Should get 403: Monthly limit exceeded

# 4. Upgrade to Pro
curl -X POST http://localhost:3001/api/admin/users/USER_UID/tier \
  -H "X-API-Key: <service-key>" \
  -d '{"uid":"USER_UID","tier":"pro","isPaid":true,"paymentStatus":"active"}'

# 5. Try again
# Should work (Pro has 1M limit)
```

### **Test Concurrent Agents**
```bash
# Start 3 tasks simultaneously as Free user (limit: 1)
# 1st request: ✅ Accepted
# 2nd request: ❌ 403: Max concurrent agents reached

# Upgrade to Pro (limit: 3)
# All 3 requests: ✅ Accepted
```

---

## 🎓 Best Practices

### **1. Always Check Custom Claims (Frontend)**
```typescript
// Firebase Auth custom claims for client-side checks
const token = await firebase.auth().currentUser.getIdTokenResult();
const tier = token.claims.tier;  // 'free', 'pro', 'enterprise'
const isPaid = token.claims.isPaid;

if (tier === 'free') {
  showUpgradePrompt();
}
```

### **2. Show Real-time Usage**
```typescript
// Poll stats every 30 seconds
setInterval(async () => {
  const stats = await apiClient.getUserStats();
  updateUsageDisplay(stats);
}, 30000);
```

### **3. Graceful Degradation**
```typescript
// If concurrent limit reached, show queue position
if (error.message.includes('concurrent agents')) {
  showMessage('All agents busy. You're in queue position 3');
}
```

### **4. Upsell Opportunities**
```typescript
// Show upgrade modal when user hits limits
if (tokensRemaining < 5000) {
  showModal('You're running low on tokens. Upgrade to Pro?');
}
```

---

## 🚨 Troubleshooting

### **Issue: "Payment required" but user paid**
```bash
# Check Firestore user document
# Verify isPaid === true and paymentStatus === 'active'

# Manual fix:
POST /api/admin/users/:uid/tier
{"tier":"pro","isPaid":true,"paymentStatus":"active"}
```

### **Issue: Concurrent agents stuck**
```bash
# Manually reset (if worker crashed)
# In Firestore, set currentConcurrentAgents = 0
```

### **Issue: Token count wrong**
```bash
# Check usage_logs collection for history
# Reset if needed:
POST /api/admin/users/:uid/reset-billing
```

---

## 📈 Scaling Considerations

### **For 1000+ Users**
- ✅ Firestore indexes on `tier` and `paymentStatus`
- ✅ Cache tier configs in Redis
- ✅ Batch write usage logs (every 10 tasks)

### **For 10000+ Users**
- ✅ Separate read replicas for Firestore
- ✅ Move usage logs to BigQuery for analytics
- ✅ Implement caching layer for user data

---

## 📝 Summary

You now have:
- ✅ **3-tier system** with automatic payment verification
- ✅ **Real-time tracking** in Firebase Firestore
- ✅ **Multiple concurrent agents** per user (tier-based)
- ✅ **Stripe webhooks** for automatic upgrades
- ✅ **Admin API** for manual management
- ✅ **Professional security** with multiple checks
- ✅ **Comprehensive monitoring** and analytics

**Ready to scale to thousands of paying users!** 🚀

