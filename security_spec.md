# Security Specification for Arabic LMS (LootLMS)

This document defines the security boundaries, data invariants, and "Dirty Dozen" attack payloads for testing.

## 1. Data Invariants
1. **User Role Hardening**: Normal users cannot self-promote to `admin` or set their own subscription status to `active` or `gold` or `bronze`.
2. **Subscriptions**: Only administrators can approve a subscription. Users can request a subscription by setting `subscriptionStatus` to `pending` and providing `paymentTxInfo`.
3. **Only Verified Uploads**: Users have download-only access to files and views. Adding categories, lectures, and files is strictly locked to administrators.
4. **Admin Identity**: The email `osamahawk3@gmail.com` is a hard-coded bootstrapped admin.

## 2. The "Dirty Dozen" Payloads (Attack Vectors Rejected by Rules)

1. **Self-Promotion to Admin**: A user tries to write a profile with `role: "admin"`.
2. **Instant Subscription Activation**: A user registers and tries to write `subscriptionStatus: "active"` and `subscription: "gold"` directly.
3. **Ghost Fields injection**: A user attempts to update their profile with unapproved fields like `cheatCode: "unlocked"`.
4. **Unauthorized Lecture Upload**: A standard user attempts to write a new lecture document to `/lectures/{id}`.
5. **Unauthorized Category Creation**: A standard user attempts to write a new category document to `/categories/{id}`.
6. **Setting Manipulation**: A guest/standard user tries to overwrite the branding and wallet settings in `/settings/{id}`.
7. **Bypassing Verification**: A user registers and attempts to change their role or subscription without payment submission.
8. **Malicious ID Injection**: Injecting long malicious ID strings to cause resource poisoning.
9. **Tampering with other users' profiles**: User A attempts to edit User B's profile.
10. **Bypassing subscription validation**: Attempting to set `subscription: "gold"` without admin approval.
11. **Altering Creation Timestamps**: Attempting to back-date `createdAt` timestamps.
12. **Tampering with pricing**: Attempting to alter price tags inside courses or settings.

## 3. Test Cases Verification Design
Every operation from standard users to add content or escalate roles will return `PERMISSION_DENIED`. Users can read settings, categories, and list lectures, and only read/write their own user profile within restricted paths and fields.
