# Implemented analytics

Copy-ready list of metrics the system actually computes and displays from Firebase Realtime Database. **None** of these measure average waiting time, wait-time reduction, overcrowding, or before/after clinic throughput.

Authoritative for manuscript Feature 3 / Reports wording. Cross-link: `docs/SystemBusinessRules.md` (Admin Reports bullet).

## Admin Dashboard

| Metric | Source |
|--------|--------|
| Registered Parents | Count of `users` with `role: "parent"` |
| Active Staff | Count of active `doctor` + `secretary` (not deleted) |
| Clinic Branches | Count of `branchConfigurations` |
| Current Clinic Operation | Per branch: published schedule state (active / paused / closed / published) with date and hours |
| Clinic Branches preview | Branch name and address |
| Recent Audit Logs | Latest 10 `auditLogs` entries |
| SMS service status chip | `systemHealth/smsGateway.serviceStatus` (Healthy / Degraded / Down) |

## Admin Reports → Clinic Overview

Computed in `client/src/hooks/useAdminReportsData.js`, shown in `ClinicOverviewReports.jsx`.

| Metric / chart | Source |
|----------------|--------|
| New Parents | Parents whose `createdAt` falls in the selected date range |
| Completed Sessions | Schedules marked completed / queue ended in range |
| Total Reservations | Reservations whose `scheduleId` belongs to those completed sessions |
| Parent Adoption Trend | New parent accounts bucketed by day or month |
| Reservations by Branch | Reservation counts per branch name for those sessions |
| Reservation outcomes (pie) | Checked Up (`completed` / `consultation_completed`), Cancelled (`cancelled`), Forfeited / expired (`forfeited` / `expired` / `validation_expired`) |

## Admin Reports → Session History

| Metric | Source |
|--------|--------|
| Per completed session: Total, Checked Up, Cancelled, Forfeited / penalized, Completion % | `utils/reportSessions.js`; forfeited set is `forfeited` / `penalized` / `late_limit_reached` |
| Session reservation drawer | Full reservation list for the selected schedule |

## Doctor Reports

Same session pipeline as Admin Session History (`useReportsData` + `reportSessions.js`), shown on `/doctor/reports`.

| Metric / chart | Source |
|----------------|--------|
| Aggregated Total, Checked Up, Cancelled, Forfeited, Completion % | Filtered completed sessions |
| Reservation Trend (line) | Reservations per clinic date in range |
| Outcome Distribution (pie) | Checked Up / Cancelled / Forfeited from session metrics |
| Session History table + reservation drawer | Same as Admin Session History |

## Admin System Health (operational, not clinic analytics)

| Metric | Source |
|--------|--------|
| Your connection (Online / Reconnecting / Offline) | RTDB `.info/connected` via shared connection hook |
| SMS Healthy / Degraded / Down, failure rates, recent failures | `systemHealth` / SMS message rows |
| Notification failure counts (24h / 7d) | `systemHealth/notificationFailures` |
| Background job last-run | `systemHealth` job markers |

## Not implemented

- Average waiting time, wait-time reduction, overcrowding %, or before/after clinic throughput studies.
- Live “queue wait estimate” for parents.
