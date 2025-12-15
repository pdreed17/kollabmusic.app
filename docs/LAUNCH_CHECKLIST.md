# Kollab Launch Checklist

Last Updated: December 11, 2025

---

## BEFORE Beta Testing (Blockers)

These MUST be done before anyone tests your app:

- [x] **Apple Developer Account** ($99/year)
  - Required for TestFlight distribution
  - https://developer.apple.com/programs/enroll/
  - **Status: Complete!**

- [x] **Fix password reset OR document workaround**
  - ~~Currently no email service configured~~
  - Uses Supabase's built-in `resetPasswordForEmail` with deep link
  - Deep link: `kollabmusic://reset-password`
  - **Status: Complete!** (ResetPasswordScreen implemented)

- [x] **Configure Supabase URL settings** (REQUIRED for password reset)
  - Go to: Supabase Dashboard → Authentication → URL Configuration
  - Set **Site URL** to: `kollabmusic://`
  - Add to **Redirect URLs**: `kollabmusic://reset-password`
  - **Status: Complete!**

- [x] **Host Privacy Policy & ToS online**
  - HTML files created and ready to deploy
  - Location: `docs/legal/privacy-policy.html`
  - Location: `docs/legal/terms-of-service.html`
  - **Deploy to:** GitHub Pages, Vercel, Netlify, or any static host
  - Example URLs after deployment:
    - `https://kollabapp.com/privacy-policy.html`
    - `https://kollabapp.com/terms-of-service.html`

- [x] **Remove fake "Export My Data" button**
  - ~~Currently shows success but does nothing~~
  - **Status: Removed from Settings screen**

- [ ] **Test on real devices**
  - iOS physical device
  - Android physical device
  - Emulators don't catch all issues

- [ ] **Fix critical bugs**
  - Any crashes = no useful feedback

---

## DURING Beta Testing (4-6 Weeks)

Since beta users get **Pro for free**, payments aren't urgent.

### Week 1
- [ ] **Sentry error tracking**
  - See crashes as they happen
  - Free tier: 5K errors/month
  - https://sentry.io

- [ ] **Domain registration**
  - kollabapp.com or similar
  - Needed for emails and web app

### Week 2
- [ ] **Email service setup**
  - Resend (recommended), SendGrid, or Supabase Edge Functions
  - Password reset emails
  - Welcome emails (optional)
  - Notification emails (optional)

- [ ] **Business emails**
  - privacy@kollabapp.com
  - legal@kollabapp.com
  - support@kollabapp.com

### Week 3
- [ ] **Stripe integration (start)**
  - Create Stripe account
  - Implement subscription checkout
  - Handle webhooks (payment success/failure)

- [ ] **Web companion app (start)**
  - React or Next.js
  - Same Supabase backend
  - File upload from desktop

### Week 4
- [ ] **Stripe integration (finish)**
  - Test payment flows
  - Billing portal integration

- [ ] **Web companion app (finish)**
  - Deploy to app.kollabapp.com
  - Vercel or Netlify (free tier)

- [ ] **Implement real data export**
  - GDPR requirement for EU users
  - Export user data as JSON/ZIP

### Week 5
- [ ] **App Store preparation**
  - App icons (all required sizes)
  - Screenshots (iPhone, iPad sizes)
  - App description and keywords
  - Privacy policy URL
  - Terms of service URL

- [ ] **Google Play Developer Account** ($25 one-time)
  - Takes 48 hours to verify
  - https://play.google.com/console/signup

### Week 6
- [ ] **Final testing**
  - Full flow testing on both platforms
  - Payment flow testing (Stripe test mode)

- [ ] **Submit to App Stores**
  - iOS App Store review: 1-3 days typically
  - Google Play review: 1-7 days typically

---

## PUBLIC LAUNCH

After beta testing and store approval:

- [ ] Announce launch
- [ ] Monitor error tracking
- [ ] Respond to user feedback
- [ ] Iterate based on usage

---

## Estimated Costs

| Item | Cost |
|------|------|
| Domain (kollabapp.com) | ~$12/year |
| Apple Developer | $99/year |
| Google Play | $25 one-time |
| Email service (Resend) | Free tier |
| Stripe | 2.9% + $0.30 per transaction |
| Sentry | Free tier |
| Web hosting (Vercel) | Free tier |
| **Total to launch** | **~$140 + domain** |

---

## Current App Configuration

### Subscription Tiers

**Free Tier:**
- 3 owned projects
- 3 active collaborations
- 8 tracks per project
- 200 MB storage

**Pro Tier ($4.99/month or $53.89/year - 10% discount):**
- Unlimited projects
- Unlimited collaborations
- Unlimited tracks
- 5 GB storage

### Beta Mode
- First 50 users automatically get Pro
- Configured in: `src/config/beta.config.ts`

---

## Third-Party Services

### Currently Using
- **Supabase** - Auth, Database, Storage

### Need to Add
- **Stripe** - Payment processing
- **Email service** - Transactional emails
- **Sentry** - Error tracking (recommended)

### NOT Using (Intentionally)
- Analytics/tracking - "We don't track you" is a feature

---

## Files to Update Before Launch

| File | What to Update |
|------|----------------|
| `src/screens/PrivacyPolicyScreen.tsx` | Email addresses once you have them |
| `src/screens/TermsOfServiceScreen.tsx` | Email addresses once you have them |
| `src/screens/SettingsScreen.tsx` | Remove Export button OR implement it |
| `app.json` | Bundle ID, version numbers |
| `.env` | Add Stripe keys, Sentry DSN |

---

## Contact Emails (Configured)

Email forwarding is set up in Porkbun for kollabmusic.app:

- billing@kollabmusic.app ✅
- feedback@kollabmusic.app ✅
- legal@kollabmusic.app ✅
- privacy@kollabmusic.app ✅
- support@kollabmusic.app ✅

**Status:** Complete! All emails forward to your personal inbox.
