# Secretary User Manual

A short desk guide for the secretary role in PlusQueue (the clinic queue web app).

You only see **your assigned branch**. Other clinics do not appear.

**Screenshots:** Real captures were not taken (the app has no mock/test data mode, and screenshots would show live clinic records). Each section has a labeled placeholder. Replace it with a photo later.

---

## How to move around

After you sign in, use the left menu (computer) or the bar at the bottom (phone):

| Menu item | What it is |
| --- | --- |
| Dashboard | Today’s summary |
| Schedules | Create, publish, and start clinic days |
| Validate Reservation | Check in a parent with QR or a code |
| Manage Queue | Run the live line |
| Profile | Your account, walk-in patients, settings, log out |

**Live Queue Monitor** is a large waiting-room screen. Open it from Manage Queue (it opens in a new tab).

---

## 1. Logging In

Sign in with the email (or phone) and password given to you by the administrator.

1. Open the app in a browser.
2. Type your **email or phone number**.
3. Type your **password**.
4. Click **Sign In**.
5. You are taken to Dashboard.

Forgot your password? Click **Forgot Password?** on the sign-in screen.

*[Screenshot: Sign in screen]*

---

## 2. Manage Queue overview

This is the desk screen for the **live line** (who is waiting, who is with the doctor, and who is next).

It only works after someone starts the queue for today (see [Start the queue](#start-the-queue)). If no queue is running, you will see “No Active Queue.”

You will see:

- **Session controls** — pause, close, or end the clinic day
- **Session Duration** — how long the queue has been running
- **Request Check-In** — pings the next parent who is not yet at the desk
- **Current Consultation** — the patient with the doctor
- **Waiting Queue** — everyone still in line, in current turn order

Each row shows a **queue number** (the ticket number on the parent’s reservation). That number does not change. The **order of the list** can change if someone is marked late.

Tap a patient row to see parent contact details (or walk-in details).

*[Screenshot: Manage Queue screen]*

---

## 3. Adding a Walk-in Patient

Add a child who has **no parent app account** (they walked in, or a parent called the clinic). They are checked in right away — no QR scan.

1. Open **Profile**.
2. Click **Walk-in Patient**.
3. Choose a **schedule** from the dropdown (date, hours, and how many slots are left). The list includes **Upcoming** published schedules and queues already **Active Now** (or **Paused**). Closed or ended clinic days do not appear. Adding a walk-in to an Active Now queue puts them at the next place in the live line.
4. Optional: type **Parent's Name** and **Parent's Phone** (10 digits after +63). Use this for phone-in bookings so the clinic can text them. Leave blank for in-person walk-ins. If you enter a phone and the queue is already running, they get the “active queue” text (queue number and position). If the queue has not started yet, they get the usual reservation-details text.
5. Type **how many children** (1–10). One walk-in group uses **one slot**.
6. For each child, fill in **name**, **age** (1–25), and **sex**.
7. Optional: type the **concern** (reason for visit).
8. Click **Check In Walk-in**.

The patient appears in Manage Queue with a **Walk-in** tag.

*[Screenshot: Walk-in Patient form]*

---

## 4. Validating / scanning a parent’s QR code

This checks a **parent reservation** at the desk so they join the live line as “Checked In.”

The clinic queue must already be **started**. If it is not, you will see “Clinic Queue Not Started.”

1. Open **Validate Reservation**.
2. Point the camera at the parent’s QR code, **or** type their **6-character code**.
3. The code checks itself when all 6 characters are entered.
4. On success, you see the child’s name and queue number. Click **OK**.

If the camera does not start, click **Start Camera**. Allow camera access if the browser asks.

If several cameras appear, pick the one facing the parent (usually the back camera on a phone).

**Common results**

| Message | Meaning |
| --- | --- |
| Patient Checked In Successfully | Done |
| Invalid Code | Code not found, or it belongs to another branch |
| Already Checked In | Already scanned |
| Patient Currently In Consultation | They are already with the doctor |
| Queue Closed | Clinic day already ended |

*[Screenshot: Scan to Check In screen]*

---

## 5. Penalizing a late parent

Use this when the **next person in line** is not at the desk when called.

**Penalize** = move them back in line and start a late clock. If they still do not check in before the clock runs out, they **lose the slot** (forfeited).

1. Open **Manage Queue**.
2. Find the waiting row with the **Penalize** button (the first parent who is not checked in, or a walk-in who is first in line).
3. Wait until the button is ready. It may count down first (grace time so a parent walking in is not marked late too quickly).
4. Click **Penalize**.

**What you will see**

- They drop several places down the list (how many is set in System Configuration).
- A **Forfeit in …** timer appears on their row.
- If they check in (QR/code) before time runs out, they stay in line at the new place and the timer stops.
- If time runs out, they are removed from the line automatically.

You can penalize the same person more than once. Extra penalties move them back again but **do not restart** the first timer.

If Penalty Move-Back is set to **0**, clicking Penalize **removes them immediately** (no move-back, no timer).

*[Screenshot: Waiting Queue with Penalize button]*

---

## 6. Cancelling a walk-in reservation

You can cancel **walk-in** tickets only. Parent app reservations cannot be cancelled from the secretary desk.

1. Open **Manage Queue**.
2. Click the walk-in patient’s row.
3. Click **Cancel Reservation**.
4. Click **Cancel Reservation** again to confirm.

The slot opens up and the line updates.

*[Screenshot: Walk-in contact popup with Cancel Reservation]*

---

## 7. Pause, resume, close, and end the clinic session

These buttons sit at the top of **Manage Queue**.

| Button | What it does |
| --- | --- |
| Pause (pause icon) | Temporarily stop the live session. Check-in can still happen. |
| Play (play icon) | Resume after a pause. |
| Lock (lock icon) | Close the queue to **new** reservations. People already in line keep their place. Consultations continue. |
| Stop (square icon) | End the clinic day. Only works when **nobody is waiting and nobody is with the doctor**. |

### Pause

1. On Manage Queue, click the **pause** button.
2. Status shows **Paused**.

### Resume

1. Click the **play** button.
2. Status shows **Active Session** again.

### Close the queue to new reservations

1. Click the **lock** button.
2. Read the confirmation.
3. Click **Close Queue**.

Parents can no longer book this schedule. Existing tickets stay valid.

### End the clinic session

1. Finish remaining patients first (empty waiting list, empty consultation room).
2. Click the **square** button.
3. Click **End Clinic Session**.

This finishes the schedule for the day.

*[Screenshot: Queue session controls]*

---

## 8. Publishing a reservation schedule

A **schedule** is a clinic day (date, hours, how many slots). Parents can book only after you **publish** it.

You only create schedules for your assigned branch.

### Create a draft

1. Open **Schedules**.
2. Click the round **+** button (bottom right).
3. Fill in **date**, **opening time**, **closing time**, and **slot capacity**.
4. Save.

A draft is not visible to parents yet.

### Publish

1. On the draft card, click **Publish**.
2. Review the details.
3. Click **Publish Schedule**.

Parents can now reserve slots.

### Start the queue

Start when the floor is ready (desk check-in, sending patients to the doctor).

1. On the published card, click **Start Queue**.
2. Review the details.
3. Click **Start Queue**.
4. You are taken to Manage Queue.

You can run only **one** live queue at a time. End the current one before starting another.

Drafts can also be **Edit**ed or **Delete**d. After publish, use **Manage Queue** on an active card to jump back to the desk screen.

*[Screenshot: Schedules page with Publish / Start Queue]*

---

## 9. System Configuration settings

These rules apply **only to your branch**. Open them from **Profile** → **System Configuration**.

Save Queue Rules and SMS Settings **separately**.

### Queue Rules

| Setting | What it controls |
| --- | --- |
| **Penalty Move-Back** (0–10) | How many places a late parent is moved down the line. **0** means Penalize removes them immediately. |
| **Penalty Grace Period** (0–5 min) | How long after someone becomes next in line before **Penalize** is available. |
| **Penalty Timer** (5–30 min) | After Penalize, how long they have to check in before they lose the slot. |

Click **Save Queue Rules**.

### SMS settings

These are the text messages parents receive.

| Setting | What it controls |
| --- | --- |
| **Near Turn — Patients Ahead** | Send the “your turn is near” text when this many people (or fewer) are still ahead. Each reservation gets this text only once. |
| **Near Turn Message** | The text of that reminder. |
| **Reservation Confirmed Message** | Text after a parent books, before the queue has started. |
| **Active Queue Reservation Message** | Text instead, if they book **after** the queue has already started. |
| **Penalty Message** | Text when someone is marked late. |
| **Forfeiture Message** | Text when they lose the slot for being too late. |
| **Queue Started Message** | Text when you start the queue for the day. |

Gray buttons like `{queueNumber}` insert that detail into the message. Click **Save SMS Settings**.

*[Screenshot: System Configuration — Queue Rules]*

*[Screenshot: System Configuration — SMS settings]*

---

## 10. Other secretary tools

### Dashboard (Home)

First screen after login. Shows today’s published schedule, who is with the doctor, counts (waiting / checked in / completed), a compact queue, and recent activity.

*[Screenshot: Dashboard]*

### Request Check-In

On Manage Queue, click **Request Check-In** to remind the next parent who is not yet checked in to come to the desk. There is a short wait before you can send another reminder.

*[Screenshot: Request Check-In button]*

### Send to Doctor

When the consultation room is empty, the **first waiting patient** who is **Checked In** gets a **Send to Doctor** button.

1. Confirm they are ready.
2. Click **Send to Doctor**.

Only **one** patient can be with the doctor at a time. The button appears again after the doctor finishes.

*[Screenshot: Send to Doctor on the first waiting row]*

### Live Queue Monitor

A large screen for the waiting room: **Now Serving** and **Next In Queue** (queue numbers only, no names).

1. On Manage Queue, click **Live Queue Monitor**.
2. Optionally click the fullscreen button.

Paused and closed queues show a banner at the top.

*[Screenshot: Live Queue Monitor]*

### Profile and log out

**Profile** shows your name, email, phone, and assigned branch.

1. Open **Profile**.
2. Click **Log Out**.
3. Confirm.

*[Screenshot: Profile with Walk-in, System Configuration, and Log Out]*
