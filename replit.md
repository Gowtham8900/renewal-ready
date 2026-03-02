# Renewal Ready

## Overview
Mobile-first SaaS platform that helps professional license holders prepare everything needed for renewal. Phase 1 focuses on Utah DOPL Contractor License renewal. The app does NOT perform the official renewal — it only helps users prepare documents/data and hand off to desktop via MyLicenseOne.

Designed to scale to multiple states, license types, white-label government deployments, and enterprise contractor firms.

## Tech Stack
- **Frontend**: React + TypeScript + Tailwind CSS + Shadcn UI + Wouter (routing)
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: Email/password with bcrypt, session-based (HttpOnly cookies), roles (USER/ADMIN/ORG_ADMIN)
- **File Storage**: Local filesystem (/uploads), abstracted for future S3
- **PDF Parsing**: pdf-parse for text extraction and COI validation
- **Sessions**: MemoryStore (dev), connect-pg-simple (production)
- **Billing**: Stripe scaffold (routes exist, not yet implemented — free during beta)

## Architecture
```
client/src/
  pages/
    landing.tsx       - Landing page
    auth-login.tsx    - Login page
    auth-signup.tsx   - Signup page
    dashboard.tsx     - List/create renewal packets
    packet-detail.tsx - Main checklist + uploads + data entry + dropzone
    handoff.tsx       - Desktop handoff view (no auth needed, token-based)
    admin.tsx         - Admin analytics dashboard
  lib/
    auth.tsx          - Auth context provider
    queryClient.ts    - TanStack Query setup

server/
  index.ts    - Express app setup + seed
  routes.ts   - All API routes (auth, packets, documents, handoff, admin, billing, config)
  storage.ts  - Database storage layer (IStorage interface)
  db.ts       - Drizzle + pg pool setup
  validation.ts - COI/document validation + readiness scoring
  seed.ts     - Demo data + Utah config seeder

shared/
  schema.ts   - Drizzle schema + Zod schemas + types
```

## Key Features
1. **Renewal Checklist** - 8 items with weighted readiness score (total 100)
2. **Document Upload & Validation** - PDF text extraction, COI address validation, drag-drop dropzone
3. **Desktop Handoff** - Secure 24hr token links for desktop completion
4. **Admin Analytics** - Packet counts, avg readiness score, COI/WC fail rates, incomplete items
5. **Ready to Renew Badge** - Appears at >= 95% readiness with guidance to complete
6. **Fix Guidance Panels** - Inline guidance when documents fail validation
7. **CE Warnings** - Alerts for insufficient total hours (<6) and live hours (<3)
8. **Multi-State Architecture** - States, LicenseTypes, RequirementTemplates tables for future expansion

## Database Tables
- **users** (id, email, passwordHash, name, role, isAdmin, organizationId)
- **organizations** (id, name, ownerId, stripeCustomerId, subscriptionStatus)
- **states** (id, code, name, active)
- **license_types** (id, stateId, code, name, renewalFee, renewalCycleDays, portalUrl)
- **requirement_templates** (id, licenseTypeId, key, label, type, weight, config, sortOrder)
- **renewal_packets** (checklist fields, license info, workers comp path, stateId, licenseTypeId)
- **documents** (file metadata, extracted text, validation status)
- **handoff_tokens** (hashed tokens, expiry, revocation)

## Demo Accounts
- demo@renewalready.com / demo123
- admin@renewalready.com / admin123

## Environment Variables
- DATABASE_URL (auto-provisioned)
- SESSION_SECRET
- SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS (optional, for email)
- STRIPE_SECRET (future use)

## Deployment
- Build: `npm run build` → dist/
- Start: `npm run start`
- Session store: connect-pg-simple (auto-creates session table)
- Cookies: secure + sameSite in production, trust proxy enabled
