# Codebase Guide

This repository is a full-stack TypeScript app for helping users prepare professional-license renewal packets before finishing renewal in an external portal.

## High-level architecture

- **Client:** React + Wouter + TanStack Query + shadcn/radix UI (`client/src`).
- **Server:** Express + session auth + upload/validation routes (`server`).
- **Data:** PostgreSQL via Drizzle ORM schemas in `shared/schema.ts` and storage implementation in `server/storage.ts`.

## Runtime flow

1. `server/index.ts` boots Express, adds JSON/body middleware, registers routes, seeds baseline data, and serves Vite in dev or static assets in production.
2. The client mounts in `client/src/main.tsx` and renders route-level pages from `client/src/App.tsx`.
3. Auth state comes from `GET /api/auth/me` in `client/src/lib/auth.tsx`, and protected routes redirect unauthenticated users to `/auth/login`.
4. Packet operations are handled through REST endpoints in `server/routes.ts`, with DB access delegated to `storage` methods in `server/storage.ts`.

## Core domain model

Important tables/types in `shared/schema.ts`:

- `users`, `organizations`
- `states`, `license_types`, `requirement_templates`
- `renewal_packets` (the central checklist entity)
- `documents` (uploads, extraction result, validation status)
- `handoff_tokens` (hashed, expiring desktop handoff links)

`CHECKLIST_WEIGHTS` and `calculateReadinessScore()` define the readiness score used by dashboard/detail views.

## API surface (server/routes.ts)

- **Auth:** signup/login/logout/me
- **Packet CRUD:** list/create/get/update/delete packets
- **Documents:** upload, delete, download
- **Handoff:** generate and consume tokenized handoff links
- **Admin:** aggregated readiness and failure analytics
- **Catalog/config:** states, license types, requirement templates, COI email template
- **Billing stubs:** placeholder checkout/subscription/webhook routes

## Validation behavior

`server/validation.ts` contains:

- COI address token checks
- Workers comp certificate/waiver checks
- License number formatting and WTH id helper
- Weighted readiness scoring across 8 checklist items

Document upload route behavior in `server/routes.ts`:

- Required types (COI/workers comp docs) must be PDFs.
- PDF text extraction uses `pdf-parse`.
- Validation status is persisted (`PASS`, `FAIL`, `UNKNOWN`, `MANUAL_CONFIRM`).

## Frontend page map

- `landing.tsx`: marketing/entry
- `auth-login.tsx`, `auth-signup.tsx`: session entry
- `dashboard.tsx`: packet list + create
- `packet-detail.tsx`: checklist workflow, uploads, readiness score, handoff generation
- `handoff.tsx`: token-based desktop handoff view
- `admin.tsx`: admin analytics

## Notable implementation details

- Session storage uses MemoryStore in development and `connect-pg-simple` in production when `DATABASE_URL` is set.
- Uploads are organized under `/uploads/<userId>/<packetId>/...`.
- The storage layer has a duplicate return statement in `getRequirementsByLicenseType`; behavior is unaffected because the first return exits, but it is a cleanup candidate.

## Useful commands

- `npm run dev` – start full app in development
- `npm run check` – TypeScript typecheck
- `npm run build` – production build
- `npm run start` – run built server
- `npm run db:push` – push Drizzle schema changes
