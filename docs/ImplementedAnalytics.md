# Implemented analytics (Admin)

Copy-ready list of metrics the Admin Dashboard and Admin Reports actually compute from Firebase Realtime Database. None of these measure waiting-time reduction or overcrowding.

## Admin Dashboard

| Metric | Source |
|--------|--------|
| Registered Parents | Count of `users` with `role: "parent"` |
| Active Staff | Count of active `doctor` + `secretary` (not deleted) |
| Clinic Branches | Count of `branchConfigurations` |
| Current Clinic Operation | Per branch: published schedule state (active / paused / closed / published) with date and hours |
| Clinic Branches preview | Branch name and address |
| Recent Audit Logs | Latest 10 `auditLogs` entries |

## Admin Reports → Clinic Overview

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
| Per completed session: Total, Checked Up, Cancelled, Forfeited / penalized, Completion % | Reservations for that schedule; forfeited set is `forfeited` / `penalized` / `late_limit_reached` |
| Session reservation drawer | Full reservation list for the selected schedule |

## Not implemented

- Average waiting time, wait-time reduction, overcrowding %, or before/after clinic throughput studies.
