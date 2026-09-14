# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary:** Parents/guardians of pediatric patients. They use the product day-to-day on phones and browsers to reserve clinic capacity, monitor live queue position remotely, present a digital ticket at check-in, and manage child profiles and notification preferences.

**Secondary (still first-class Operate surfaces):** Clinic staff. When design trade-offs arise, parent clarity wins; staff UI must remain clear, intuitive, and polished—not an afterthought.

- **Secretary:** Front-desk operator bound to one assigned branch; publishes schedules, starts the queue, checks in arrivals (QR / code), applies penalties, gates entry to the doctor, and may run a full-screen queue monitor.
- **Doctor:** Clinical provider (system enforces one active doctor account); can create/publish schedules for any branch, start the queue, control the live queue session, and complete consultations.
- **Admin:** Back-office operator for staff/parent accounts, branches, and reports. Per-branch queue and SMS rules are configured by each Secretary.

## Product Purpose

PlusQueue digitizes multi-branch pediatric clinic patient flow so families can reserve slots and follow their turn without camping the waiting room, while staff enforce capacity, attendance, and one-consultation-at-a-time operations with an immutable history for accountability.

Success means orderly clinic days, accurate live queue transparency for parents, and role-isolated staff control that does not break consultation integrity or slot capacity.

## Positioning

A centralized queue engine that keeps a permanent ticket identity (`queueNumber`) while dynamically reordering turn (`queueOrder` / penalties), enforces a hard consultation lock, isolates operations by branch, and gives parents real-time in-app / Web Push / SMS transparency—rules neighboring generic booking or display-board tools cannot truthfully claim as one system.

## Operating Context

Used across physical pediatric clinic branches (product defaults include Angeles and Magalang). Parents act remotely before arrival and at the desk with a QR or 6-character code; secretaries run the floor; the doctor runs the consultation room; admin configures the business structure. Authoritative workflows and invariants live in `docs/` (SystemBusinessRules, QueueEngineRules, ReservationRules, NotificationRules, FullSystemDescriptionAndRules).

## Capabilities and Constraints

**Confirmed capabilities**

- Parent self-registration (SMS OTP phone verify → email/password → email verification → first child profile onboarding), then reserve, monitor, cancel (pre–check-in), and receive persistent Notification Center + Web Push + clinic SMS.
- Secretary schedule publish / queue start, check-in, penalties/forfeit, send-to-doctor, walk-ins, branch-scoped operations.
- Doctor schedule create/publish / queue start (any branch), queue session control (pause / resume / close), and consultation completion with optional notes.
- Admin staff/branch/user management. Per-branch queue and SMS rules (penalty move-back, late limit, templates / near-turn threshold) are configured by each Secretary.
- Capacitor Android wrapper around the same web app (not a separate native design language).

**Hard constraints to preserve**

- One consultation at a time.
- Permanent ticket number vs dynamic queue order; official penalties only for reordering.
- One active reservation per parent per clinic date.
- Secretary branch isolation; one active doctor account.
- No physical deletes of reservations or audit history.
- Parent cannot cancel after check-in.
- Parents only receive persistent notifications; staff get local toasts.
- Business logic belongs in `client/src/services/`; UI must not own domain rules.
- Stack is the existing React 19 + Vite + Firebase Auth/RTDB + Express/Cloud Functions push path (JavaScript, not TypeScript).

**Undecided**

- Formal marketing positioning beyond the product name and logo (no campaign voice locked beyond operational clarity).

## Brand Commitments

- **Product name:** PlusQueue (binding for branding, headers, and identity UI).
- **Official logo:** Stylized rounded plus/cross mark in blue, coral/pink, and yellow with parent/child hand silhouettes (user-confirmed official mark). Binding for branding, headers, and identity-related UI. Durable file path once saved: `brand/plusqueue-logo.png`.
- Voice should stay clear and operational for clinic use; do not invent a separate consumer-marketing brand kit beyond the name and logo unless the user adds one.

## Evidence on Hand

- Official PlusQueue logo: confirmed by the product owner; place the durable PNG at `brand/plusqueue-logo.png` for reuse in builds
- Authoritative product/rules docs: `docs/SystemBusinessRules.md`, `docs/QueueEngineRules.md`, `docs/ReservationRules.md`, `docs/NotificationRules.md`, `docs/FullSystemDescriptionAndRules.md`
- Live product UI and copy in `client/src/` (role pages, services, notification templates)
- No marketing testimonials, press quotes, or fabricated case studies—future work must not invent them

## Product Principles

1. **Parents first, staff still sharp** — Optimize for parent day-to-day confidence; staff tools stay polished when trade-offs allow.
2. **Queue integrity over convenience** — Consultation lock, capacity, FIFO-with-penalties, and branch isolation beat shortcut UX.
3. **Remote clarity, clinic truth** — Parents should always know where they stand without guessing; the desk remains the source of check-in truth.
4. **Immutable accountability** — History and audit trail outrank destructive cleanup or “soft” rewriting of the past.
5. **Identity is PlusQueue** — Name and official logo anchor recognition; do not substitute generic clinic branding.

## Accessibility & Inclusion

WCAG 2.2 Level AA is the accessibility baseline for future UI/UX work.
