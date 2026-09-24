# System Audit Report — Pediatric Clinic Queue System (Plus Queue)

**Date:** 2026-09-24  
**Branch:** `main`  
**Remediation:** Critical → High → Medium fixes applied 2026-09-24 (see §12). Remaining: H9 dep audit, leftover Medium/Low, admin dual-allow finish, demo seed scripts.  
**Environment used for audit:** Local → **`pediatric-clinic-queue-testing`**. Production was not targeted.  
**Regression tests:** `npm test` (Node built-in runner) — C4 transitions + H2 booking caps.

---

## 12. Remediation log (2026-09-24)

| ID | Status | Notes |
|----|--------|-------|
| C1 | **Fixed (partial)** | Full-tree reservation read blocked; staff + `parentId` / `scheduleId` queries allowed (schedule mates still visible — denormalized public queue would be needed for full isolation) |
| C2 | **Fixed** | Parent write only own `parentId`; staff retain write; CF Admin recalculates queue so parents need not update peers |
| C3 | **Fixed** | `users/$uid/role` (+ branch fields) `.validate` — only doctor/admin may change |
| C4 | **Fixed** | `reservationTransitions.js` + service guards; tests in `client/tests/` |
| C5 | **Fixed** | Prod Functions require `RTDB_URL`; staging keeps testing default |
| H1 | **Fixed** | `/sms-tester` DEV-only; SMS test API always needs `SMS_TEST_SECRET` |
| H2 | **Fixed** | Atomic `parentBookingCaps/{uid}` transaction + tests |
| H3 | **Fixed** | Secretary schedule writes scoped to assigned branch |
| H4 | **Fixed** | `users/$uid` read = self or staff |
| H5 | **Fixed** | `CORS_ORIGINS` whitelist (empty = permissive for local) |
| H6 | **Fixed** | In-memory rate limits on resolve-identifier + password-reset claim |
| H7 | **Fixed** | Validate UI rejects terminal statuses incl. forfeited / clinic-cancelled |
| H8 | **Fixed** | `updateQueueStatus` rejects `dayClosed` |
| H9 | **Deferred** | `npm audit` vulns — upgrade carefully in a dedicated pass |
| M1 | **Fixed** | Publish no longer calls SCHEDULE_AVAILABLE; docs updated |
| M5 | **Fixed** | Audit log write = doctor/admin only (not secretary) |
| M10 | **Fixed** | Reports “Today” uses Manila date |
| M14 | **Fixed** | `client/.env` removed from git index |
| M2–M4, M6–M9, M11–M13, Lows | **Open** | Not blocking demo core security |

**Deploy reminder:** Deploy `database.rules.json` + Functions to **staging** before demo. Set `CORS_ORIGINS` and production `RTDB_URL` when promoting.

---

## 1. Summary

**Overall health (post-remediation):** Critical IDOR/privilege and transition holes addressed in rules + services; claim path has atomic multi-date caps; build and new unit tests pass. Remaining risk: schedule-scoped reservation reads still expose other patients on the same day to parents; dependency CVEs (H9); admin dual-allow unfinished.

| Severity | Original | Fixed / deferred |
|----------|--------:|------------------:|
| Critical | 5 | 5 fixed (C1 partial) |
| High | 9 | 8 fixed, H9 deferred |
| Medium | 14 | 4 fixed (M1,M5,M10,M14), rest open |
| Low | 8 | open |

### Top remaining before demo day

1. Deploy hardened rules + Functions to staging and smoke-test parent cancel / staff queue.  
2. Set `CORS_ORIGINS` for hosted origins; `SMS_TEST_SECRET` if using tester locally.  
3. H9 — patch react-router / audit when time allows.  
4. Finish admin → doctor checklist (deactivate leftover admin).  
5. Optional: denormalize public queue board to finish C1 schedule-mate PHI.

---

## 2. Mid-change work status (not counted as bugs)

| Item | Status | Notes |
|------|--------|-------|
| DFA-style schedule calendar (staff + parent) | **Done** | `StaffScheduleCalendar`, `ParentScheduleCalendar`, `scheduleCalendarService` |
| Publish Range + Copy Previous Week | **Done** (still present) | UI buttons + service methods |
| Date modal Start Queue + close clinic; Start Queue on Manage Queue | **Done** | Calendar modal + `StartTodayQueue` on Manage Queue / Doctor Queue Control |
| Remove “schedule available” parent notification | **Done** | Publish path quiet; docs updated |
| Admin → Doctor transfer | **In progress** | Powers under `/doctor/*`; leftover `admin` dual-allowed; orphan `admin/Dashboard.jsx` |
| Reservation multi-booking limit | **Done** (+ atomic cap) | Max 2 dates; `bookingLocks` + `parentBookingCaps` |
| Separate demo env + seed/reset | **Partial** | Staging project exists; **no** seed/reset scripts |

---

## 3. Findings table (original audit)

Original findings retained below for history. See §12 for fix status.

| ID | Sev | Area | Feature | What happens | How to reproduce (verified / suspected) | Expected | Actual | Suspected cause | Suggested fix | Effort |
|----|-----|------|---------|--------------|-------------------------------------------|----------|--------|-----------------|---------------|--------|
| C1 | Critical | Security / IDOR | Reservations read | Any signed-in user can read the entire `reservations` tree (PHI: children, phones, concerns). | Code: `database.rules.json` `.read: auth != null`. Suspected: parent DevTools `get(ref(db,'reservations'))`. | Own / role-scoped reads | Global auth read | Over-broad rules | Scope `.read` by `parentId === auth.uid` or staff role (+ branch for secretary) | Medium |
| C2 | Critical | Security / IDOR | Reservations write | Any active parent/secretary/doctor can `update` **any** existing reservation (status, notes, etc.). No ownership check in `cancelReservation`. | Call `cancelReservation(otherId)` or raw client `update`. | Parent only own; staff only allowed transitions | Any active role can mutate any row | Rules lack `parentId`/`validate`; services lack guards | Rules + service ownership + transition checks | Large |
| C3 | Critical | Security / RBAC | Role escalation | Parent can write `users/{ownUid}/role` to `doctor`/`admin` via raw RTDB (UI `updateUserProfile` sanitizes, rules do not). | Suspected: authenticated parent `update(users/uid,{role:'doctor'})`. | Role immutable except clinic admin | Self-write allowed | `$uid.write` with no field `.validate` | Reject role/status/branch changes unless actor is doctor/admin | Medium |
| C4 | Critical | Queue / Reservation | State machine | Mutators (`cancel`, `checkIn`, `sendToDoctor`, `completeConsultation`) do not check prior status. Parent cancel after check-in blocked only in UI. | Code review `reservationService.js:425-515`; QRTicket hides button but service is open. | Disallowed transitions rejected | Direct calls succeed | Missing guards | Enforce allowed transitions in service (+ transactions); mirror in rules | Medium |
| C5 | Critical | Deploy | Cloud Functions DB | Functions default `DATABASE_URL` is **staging** if `RTDB_URL` unset. | `client/functions/index.js:3-6` | Prod Functions → prod RTDB | Default → testing | Hardcoded fallback | Require `RTDB_URL` per project; fail closed if missing in prod | Small |
| H1 | High | Security | SMS tester | `/sms-tester` is a public SPA route. Non-prod SMS test API has no secret. | Open `/sms-tester` while API reachable. | Dev-only / auth | Public route | `AppRoutes.jsx` registers page | Remove from prod build or protect; always require secret | Small |
| H2 | High | Concurrency | Multi-date cap | Cap check is a plain read before per-date lock; parallel claims on **different** dates can exceed 2. | Suspected race: two tabs book two new dates while holding one. | Atomic max 2 dates | TOCTOU possible | `parentOverMultiDateCap` outside transaction | Parent booking counter transaction or single lock node | Medium |
| H3 | High | RBAC | Secretary schedules | Rules allow any secretary to write any branch’s schedules (closures are branch-scoped; schedules are not). | Suspected: secretary `set` schedule with other branch. | Assigned branch only | Cross-branch write allowed | Schedules `.write` omits branch check | Match `clinicClosures` branch rule | Medium |
| H4 | High | Security / Privacy | Users read | Any auth user can read any `users/$uid` (email, phone, role). | Rules `$uid.read: auth != null` | Private / staff | Global | Over-broad | Self or doctor/admin only | Medium |
| H5 | High | Security | CORS | Express/Functions API use open CORS (`origin: true` / default). | Any origin + stolen Bearer | App origins only | Reflective / open | `cors()` defaults | Whitelist Hosting origins | Small |
| H6 | High | Auth | Rate limits | No app-level rate limit on `resolve-identifier` or password login; OTP has per-phone limits only. | Code: no `express-rate-limit`. | Throttled auth helpers | Unlimited resolve | Missing middleware | Add IP/email throttles | Medium |
| H7 | High | Validation | Check-in terminal | Validate UI does not block `forfeited` / `cancelled_by_clinic` / `expired` before check-in. | Code `ValidateReservation.jsx` guard list. | Reject terminal | Can proceed to service | Incomplete status list | Expand guards; service rejects | Small |
| H8 | High | Integrity | Start queue on closed day | `updateQueueStatus` has no `dayClosed` guard (UI mostly blocks). | Direct service call. | Reject | Allowed | Service assumes UI | Guard in `scheduleService` | Small |
| H9 | High | Deps | npm audit | Client: 12 vulns (1 critical tar via tooling, 8 high incl. react-router). Server/Functions: firebase-admin chain. | `npm audit` | Patched | Vulnerable deps | Outdated packages | `npm audit fix` + retest; upgrade react-router | Medium |
| M1 | Medium | Notifications | SCHEDULE_AVAILABLE | Still fires once per publish/copy/range via `/api/schedules/notify-available`. | Publish any day; code call chain in `scheduleCalendarService`. | Removed (per product intent) | Still active | Removal not started | Delete notify calls + event + docs | Small |
| M2 | Medium | Notifications | Observer gap | Client observer does not toast clinic-cancel / slot-reserved / schedule-available (push/center may still deliver). | Code `NotificationObserver.jsx` | Consistent channels | Gap for some events | Incomplete observer | Align or document | Small |
| M3 | Medium | Audit | Sensitive actions | Cancel, check-in, send-to-doctor, complete consult, parent self-deactivate: **no** audit log. Publish/close/start/deactivate user: yes. | Grep `logAuditEvent` vs mutators | Audit sensitive ops | Gaps | Not instrumented | Add audit calls | Medium |
| M4 | Medium | Security | Staff push | Any staff can `POST /send-notification` to any parent with custom title/body. | `server/routes/push.js` | Restricted events | Broad staff power | `isStaff` only | Allowlist events; doctor-only custom | Medium |
| M5 | Medium | Security | Audit forge | Secretaries can write `auditLogs`. | Rules `.write` includes secretary | Server/doctor only | Client forge possible | Broad write | Admin SDK or doctor-only write | Medium |
| M6 | Medium | Admin migration | Dual-allow asymmetry | Leftover `admin` gets Users/Branches/Audit UI + many APIs but **cannot** write schedules/reservations in rules. | Rules + `AppRoutes` | Single doctor-admin | Split powers | Transition leftover | Finish checklist; deactivate admin; remove dual-allow | Medium |
| M7 | Medium | UX | Confirm cancel | Reserve page cancel has no confirmation (QRTicket does). | `ReserveQueue.jsx` | Confirm destructive | Immediate | Inconsistent UX | Reuse ConfirmationModal | Small |
| M8 | Medium | UX / A11y | Modals | No focus trap; many modals skip `ModalScrim` scroll lock; MessageModal weaker a11y than InformationModal. | Component grep | Focus trap + lock | Partial | Inconsistent components | Standardize on ModalScrim + dialog role | Medium |
| M9 | Medium | UX | Error as empty | Notification subscribe onError → `[]` (looks empty). ScheduleManagement failures console-only. | Code paths | Show error | Silent/empty | onError handler | Surface error toasts | Small |
| M10 | Medium | Time | Reports “Today” | Reports use device local `new Date()`, not Manila. | `useReportsData.js` | Asia/Manila | Local TZ | Missing `manilaDate` | Use Manila helpers | Small |
| M11 | Medium | Performance | Full-tree listeners | `subscribeToAllReservations`, UserManagement `users` root, Reports full schedules+reservations. | Code | Scoped queries + pagination | Full trees | Convenience listeners | Query by schedule/date; paginate users | Large |
| M12 | Medium | Bundle | Main chunk | Production main JS ~1.6 MB minified. | Vite build warning | Code-split | Monolith | Few dynamic imports | Route-level lazy load | Medium |
| M13 | Medium | Deploy | Hosting target | `.firebaserc` maps `plusqueue` only under **testing**; default project is **production**. | `client/.firebaserc` | Clear prod/staging targets | Prod target missing | Incomplete config | Add prod hosting target mapping | Small |
| M14 | Medium | Hygiene | Tracked `client/.env` | `client/.env` is **git-tracked** (Firebase web config + VAPID public). Not private server keys, but bad practice / wrong-env risk. | `git ls-files client/.env` | Example only | Tracked env | Accidental add | Untrack; keep `.env.example`; rotate if needed | Small |
| L1 | Low | Dead code | rollingValidation | No-op service still imported from reservation/schedule paths. | `rollingValidationService.js` | Removed | Dead calls | Legacy | Delete imports | Small |
| L2 | Low | Dead code | Orphan pages | `admin/Dashboard.jsx`, `ParentQRCode.jsx`, `AdminLayout` unused in routes. | AppRoutes | Removed or routed | Orphans | Migration | Delete or wire | Small |
| L3 | Low | Dead code | createReservation | Client create path unused (rules block new sets). | No callers | Removed | Dead export | Legacy | Delete | Small |
| L4 | Low | Lint | ESLint | 249 problems (237 errors) — unused vars, react-hooks setState-in-effect, etc. | `npm run lint` | Clean | Fails | Debt | Fix incrementally; don’t block demo on all | Medium |
| L5 | Low | Integrity | Legacy statuses on close | `validation_open` / `waiting_for_window` not in clinic-cancellable set. | Status sets | Cancel or ignore | May linger active | Incomplete sets | Include or migrate | Small |
| L6 | Low | Auth | OTP races | Attempt counter update not transactional (**suspected** slight over-5). | `otpService.js` | Atomic | Suspected race | Plain update | Transaction | Small |
| L7 | Low | Console | Dev logs | Many `console.log/error` in client services including `firebaseConfig` “Firebase Connected”. | Grep | Quiet prod | Noise | Leftover | Gate behind DEV | Small |
| L8 | Low | Deps | Unused axios | Listed in client deps; HTTP uses `fetch`. | package.json | Remove unused | Present | Unused | Remove | Small |

---

## 4. Feature status matrix

| Feature | Status | Notes |
|---------|--------|-------|
| Auth login (email/phone + password) | Works with issues | Phone needs API; no rate limit (H6) |
| Parent register + SMS OTP + email verify + child onboarding | Untested live | Code path present; OTP limits exist; SMS not exercised in audit |
| Parent reserve (calendar → claim → children) | Works with issues | Claim validates capacity/date/cap server-side; rules IDOR (C1–C2); multi-date race (H2) |
| Parent cancel | Works with issues | UI OK pre–check-in; service unguarded (C4) |
| Parent queue monitor / QR ticket | Works with issues | Relies on queue engine; PHI readable by other parents (C1) |
| Parent notifications center + prefs | Works with issues | Errors look empty (M9); SCHEDULE_AVAILABLE still sent (M1) |
| Parent history / profile / children | Untested live | Code present |
| Secretary publish / copy / close day | Works with issues | Cross-branch schedule write (H3); SCHEDULE_AVAILABLE (M1) |
| Secretary Start Queue (calendar + Manage Queue card) | Works | UI + service; closed-day start only if bypassing UI (H8) |
| Secretary validate / check-in | Works with issues | Terminal status gap (H7); unguarded service (C4) |
| Secretary Manage Queue (penalize, send, session controls) | Untested live | Eligibility service + UI present |
| Secretary walk-in | Untested live | Claim `walk_in` mode server-validated |
| Secretary system settings (queue/SMS templates) | Untested live | Branch-scoped config service |
| Doctor queue control + complete consult | Works with issues | Same unguarded mutators (C4) |
| Doctor schedules / reports | Works with issues | Reports TZ (M10); full-tree load (M11) |
| Doctor Users / Branches / Audit | Works with issues | Dual-allow admin (M6); full users tree (M11); forgeable audit (M5) |
| Password reset (5/day Manila) | Untested live | Server claim path present |
| Account deactivate / soft-delete / last-doctor lock | Untested live | Guards in `adminService`; no flag/abuse workflow |
| Web Push / SMS delivery | Untested | Dual engines present; deliberately not fired |
| Admin standalone role UI | Not implemented | Redirects to doctor; orphan dashboard |
| Demo seed/reset | Not implemented | Staging only |
| Automated tests / CI | Not implemented | 0 test files; no `.github` |

---

## 5. Traceability highlights (Feature × Role × UI × API × DB × Test)

| Path | UI | Server/API | DB | Test |
|------|----|------------|-----|------|
| Parent book | ReserveQueue | `POST /api/reservations/claim` (+ Functions claim) | schedules.booking txn + bookingLocks + reservations | **None** |
| Parent cancel | QRTicket / Reserve | Client RTDB `update` only | reservations (+ Functions slotRelease) | **None** |
| Publish schedule | Staff calendar | Client RTDB + `notify-available` | schedules + notifications | **None** |
| Start/pause queue | Manage Queue / Doctor | Client `updateQueueStatus` | schedules | **None** |
| Check-in | Validate | Client `checkInReservation` | reservations | **None** |
| Delete user | UserManagement | `POST /api/admin/delete-user` / callable | Auth + users | **None** |
| OTP | Register | `/api/auth/sms/*` | smsOtps (Admin SDK) | **None** |

**Gaps:** Most clinical mutations are **client→RTDB** with weak rules (not API-validated). Claim path is the main solid server gate.

---

## 6. Static checks executed

| Check | Result |
|-------|--------|
| `npm run build` (client) | **Pass** (warnings: ~1.6 MB chunk, ineffective dynamic imports) |
| `npm run lint` (client) | **Fail** — 249 problems (237 errors, 12 warnings) |
| Typecheck | **N/A** (JavaScript only) |
| Automated tests | **None** — cannot run |
| `npm audit` client | 12 vulns (1 critical, 8 high, 3 moderate) |
| `npm audit` server | 13 vulns (2 high, 10 moderate, 1 low) |
| `npm audit` functions | 12 vulns (1 high, 11 moderate) |
| Local `GET /api/health` | `{"status":"ok"}` |

---

## 7. Test gaps (add first — critical paths only)

Do **not** over-engineer. After Critical/High fixes, add:

1. **Claim API unit/integration** (Functions runtime or emulator): capacity full, past date, closed day, one-per-date, multi-date cap=2, walk-in branch denial, parent cannot walk_in.  
2. **Reservation transition unit tests:** cancel only from reserved/waiting; complete only from with_doctor/in_consultation; check-in rejects terminal.  
3. **Rules unit tests** (Firebase Rules emulator): parent cannot read/write others’ reservations; cannot set `role`; secretary cannot write other branch schedules.  
4. **Smoke E2E (manual or Playwright later):** parent book→cancel; secretary publish→start→check-in→send; doctor complete.

**Ask before installing** Jest/Vitest/Playwright if you want automation beyond Functions’ existing stub.

---

## 8. What could not be verified

- Real Web Push delivery to devices / OS banners  
- Real SMS via textbee (intentionally not sent)  
- Live privilege-escalation / IDOR probes on staging (no disposable accounts/seed; would mutate PHI-adjacent data)  
- Concurrent double-book race under load (logic reviewed only)  
- Penalty timer Cloud Function firing on the minute  
- Capacitor Android build / native notifications  
- Production project config and deployed rules (out of scope)  
- Whether leftover production `admin` accounts still exist  
- UI at 375px visually (code review only; no browser screenshot pass)  
- Full lint zero-fix (suite fails; not treated as runtime blockers)

---

## 9. Demo-day smoke checklist (ordered)

### Prep
- [ ] `firebase use staging` / confirm app points at **testing**  
- [ ] Disable or avoid `/sms-tester`; confirm no accidental SMS templates to real numbers  
- [ ] Seed/publish **fake** days for Angeles (and Magalang if demoing branches)  
- [ ] Fake parent + secretary + doctor accounts ready  

### Parent
- [ ] Register or login → reserve open day → Save Information → see ticket/QR  
- [ ] Second upcoming date OK; third blocked by cap message  
- [ ] Cancel before check-in; slot frees  
- [ ] Notifications list opens (ignore SCHEDULE_AVAILABLE spam if publish demo)  

### Secretary
- [ ] Publish range / single day / copy week  
- [ ] Date modal: close day with waiting reservation → parent sees clinic-cancelled  
- [ ] Start Queue from calendar **or** Manage Queue card  
- [ ] Validate code/QR → check-in → Send to Doctor (only one consult)  
- [ ] Pause / resume / penalize (optional)  

### Doctor
- [ ] Complete consultation with notes  
- [ ] Users: create secretary / deactivate test parent  
- [ ] Confirm last doctor cannot deactivate self  
- [ ] Branches + Audit Logs load  
- [ ] Reports Clinic Overview loads  

### Negative (quick)
- [ ] Parent cannot open `/doctor/users`  
- [ ] Secretary cannot open doctor users  
- [ ] Login inactive account fails  

---

## 10. Approach coverage notes

| # | Approach | Applied? |
|---|----------|----------|
| 1 | Static checks | Yes |
| 2 | Traceability matrix | Yes (summary §5) |
| 3 | Existing automated tests | Yes — none exist |
| 4 | API/integration testing | Code-path + health only; no mutating fixture suite |
| 5 | RBAC testing | Rules + route + API code review; live matrix not executed |
| 6 | State-transition / boundary | Code review of services + claim runtime |
| 7 | Date/time | Code review (Manila helpers + Reports gap) |
| 8 | Concurrency | Claim transactions reviewed; multi-date race documented |
| 9 | Data integrity | Slot release onWrite reviewed; audit gaps noted |
| 10 | E2E journeys | Code wiring verified; not browser-run |
| 11 | Notifications / jobs | Call chains traced; delivery not fired |
| 12 | Security OWASP-style | Rules + auth endpoints + CORS + secrets hygiene |
| 13 | UI/UX | Component/pattern review; no device lab |
| 14 | Performance | Listeners + bundle measured |
| 15 | Deployment / config | `.firebaserc`, Functions default URL, dual rules copies |

---

## 11. Stop point

**No fixes applied.** Awaiting approval to remediate in priority order (Critical → High → Medium), small commits tied to finding IDs, with regression tests for Critical/High (after agreeing on test tooling).
