---
version: 1
slug: "client-src-pages-parent"
primary_target: "client/src/pages/parent"
related_targets: ["client/src/pages/auth","client/src/components/parent","client/src/components/auth"]
---

# Parent + shared auth — surface brief

Mode: Operate. Audience: parents on phones in daylight clinic / home / transit. Task: reserve, see ticket vs turn, present QR, manage children and alerts.

## Direction contract

THESIS: PlusQueue is a waiting-room window, not a dashboard. You read your ticket through one frost pane onto the live room; now-serving is a lit mark that never needs hunting. Refuses nested SaaS cards, KPI tiles, and charcoal instrument chrome.

OWN-WORLD: Daylight aqua-to-peach wash (logo blue #2F6FDB, coral #EE7A96, gold #F0C53A). Frosted laminated glass panels (one blur layer, ~78% white, 18px blur). Lexend. Deep teal ink #16344A, never gray-on-color. PlusQueue mark as the window badge. Rows inside a pane are inset, not second glass.

STORY: A parent opens the app and can say, in one glance, their permanent ticket number, how many are ahead, and who is being served — then take one next action (reserve, open QR, wait).

FIRST VIEWPORT: Phone. Gradient canvas. Glass header: logo + PlusQueue + bell. One frost ticket window: huge ticket number (existing “My Queue Number” string) beside people ahead; a now-serving strip with a coral-gold pip on the live row. Waiting families as a horizontal chip row that never wraps (scrolls). Glass footer four-key nav. Primary action is a solid mark-blue pad, not a gradient pill.

FORM: Assigned grounded candidate 7 `daylight-waiting-room-frost` from seed `ea5cf75d`. User pinned glass healthcare over the prior drum-machine world. Signature interaction: now-serving pip holds until noticed (180ms press-flash on keys); live rerank keeps row identity. Raises: guide-span of first/last numbers in view (lexicon); one frost layer (exposure sheets); literal zone names (quote grammar); one dominant plane on phones (rain garden).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Constraints

- Operational copy identical. Identity lockups may say PlusQueue.
- No service/Firebase/route/handler-order changes.
- Tokens scoped to `.pq-shell` so staff dashboards do not inherit body font/palette.
- WCAG 2.2 AA, 44px targets, `:focus-visible`.
- Shared staff modals (ConfirmationModal, MessageModal, InformationModal, DeleteAccountModal, ReservationStatusBadge) stay untouched so staff UI is not restyled.
