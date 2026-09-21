# Doctor User Manual

A short clinic-day guide for the doctor role in PlusQueue (the clinic queue web app).

Unlike the secretary, you can see **all clinic branches**.

**Screenshots:** Real captures were not taken (the app has no mock/test data mode, and screenshots would show live clinic records). Each section has a labeled placeholder. Replace it with a photo later.

---

## How to move around

After you sign in, use the left menu (computer) or the bar at the bottom (phone):

| Menu item | What it is |
| --- | --- |
| Dashboard | Today’s summary |
| Queue | Live line and consultation |
| Schedules | Create, publish, and start clinic days |
| Reports & Analytics | Completed-day numbers and charts (computer menu; on phone, open it from Profile) |
| Profile | Your account, password, and log out |

On a phone, Dashboard is **Home**, and Reports & Analytics is not in the bottom bar — open it from **Profile**.

The secretary can also **pause, resume, close, and end** the queue. Use whichever desk is free. Completing a consultation is **doctor-only**.

---

## 1. Logging In

Sign in with the email (or phone) and password given to you by the administrator.

1. Open the app in a browser.
2. Type your **email or phone number**.
3. Type your **password**.
4. Click **Sign In**.
5. You are taken to Dashboard.

Forgot your password? Click **Forgot Password?** on the sign-in screen. You can also change your password later under Profile → **Security**.

Do not use **Create Account** on the sign-in screen. That is for parents. Staff accounts are created by the administrator.

*[Screenshot: Sign in screen]*

---

## 2. Viewing the Queue

This is your live view of who is with you and who is still waiting.

1. Click **Queue** in the menu.
2. If a clinic day is running, you see the branch, date, and session controls at the top. Status shows **Active**, **Paused**, or **Queue Closed**.
3. **Current Consultation** shows the patient in your room (name, age, sex, and the parent’s stated concern). Walk-ins have a **Walk-in** tag.
4. **Waiting Queue** lists everyone still in line, with their queue number and whether they are checked in. Checked-in time is shown on a wide screen.

The **queue number** is the ticket number. It does not change.

If no session is running, you will see “No Clinic Queue is Currently Active.” Start the queue from **Schedules** first.

Click **View Details** (or the consultation card) to open the same patient info in a larger popup. Waiting rows are not tappable from this screen.

The secretary is the one who **sends** the next checked-in patient to you. You do not send patients, penalize, or request check-in from this screen.

*[Screenshot: Doctor Queue — Current Consultation and Waiting Queue]*

---

## 3. Starting the Queue

Start the live line when the clinic floor is ready. Parents can then check in, and consultations can begin.

1. Open **Schedules**.
2. Find the **Published** card for today’s clinic.
3. Click **Start Queue**.
4. Review the details.
5. Click **Start Queue** again.
6. You are taken to Queue.

You can run only **one** live queue at a time. End the current one before starting another. A yellow note appears on Schedules if a queue is already running.

*[Screenshot: Published schedule card with Start Queue]*

---

## 4. Pause, resume, close, and end the clinic session

These buttons sit at the top of **Queue**. The secretary has the same four actions on Manage Queue.

| Button | What it does |
| --- | --- |
| Pause (pause icon) | Temporarily stop the live session. Check-in can still happen. You cannot complete a consultation while paused. |
| Play (play icon) | Resume after a pause. |
| Lock (lock icon) | Close the queue to **new** reservations. People already in line keep their place. Consultations continue. |
| End Clinic Session (square icon + label) | End the clinic day. Only works when **nobody is waiting and nobody is in consultation**. |

Closing the queue **cannot be undone**. After you lock it, pause/play go away. Only **End Clinic Session** remains.

You can also lock the queue while it is paused.

### Pause

1. On Queue, click the **pause** button.
2. Status shows **Paused**.

### Resume

1. Click the **play** button.
2. Status shows **Active** again.

### Close the queue to new reservations

1. Click the **lock** button.
2. Read the confirmation.
3. Click **Close Queue**.

### End the clinic session

1. Finish remaining patients first.
2. Click **End Clinic Session**.
3. Confirm **End Clinic Session**.

This marks the schedule completed. It then appears in Reports.

If you are busy with a patient, the secretary can do any of these four actions for you.

*[Screenshot: Queue session controls]*

---

## 5. Completing a consultation

Mark the visit finished when you are done with the patient in your room. Only **one** patient can be in consultation at a time.

1. On **Queue**, find **Current Consultation**.
2. Click **Complete Consultation**.
3. For a **parent reservation**, you may type optional **Doctor's Notes** (the parent can see these later).
4. For a **walk-in**, notes are turned off. Walk-ins have no parent app account, so there is nowhere to send notes.
5. Click **Complete Session**.

The room is then free for the next patient the secretary sends.

You cannot complete a consultation while the queue is **paused**. Resume first.

*[Screenshot: Complete Consultation popup]*

---

## 6. Publishing a reservation schedule

A **schedule** is a clinic day (branch, date, hours, how many slots). Parents can book only after you **publish** it.

You can create schedules for **any** branch. Clinic hours are filled in automatically from that branch’s opening and closing times. You cannot type different hours here.

You cannot create two schedules for the **same branch on the same date**.

### Create a draft

1. Open **Schedules**.
2. Click the round **+** button (bottom right).
3. Choose the **branch** and **clinic date**.
4. Check that **Clinic Hours** appear.
5. Type **slot capacity**.
6. Click **Create Schedule**.

A draft is not visible to parents yet.

You can search schedules or filter by Draft / Published / Completed.

### Publish

1. On the draft card, click **Publish**.
2. Review the details.
3. Click **Publish Schedule**.

Parents can now reserve slots.

Drafts can also be **Edit**ed or **Delete**d. After the queue is running (or closed to new bookings), click **Open Queue Control** on the card to jump to Queue.

*[Screenshot: Schedules page with Publish]*

---

## 7. Viewing Reports & Analytics

This page shows numbers for **finished** clinic days only (after you or the secretary end the session).

1. On a computer, click **Reports & Analytics** in the left menu.
2. On a phone, open **Profile**, then tap **Reports & Analytics**.

**Filters**

- **Branch** — one clinic, or **All Branches**.
- **Date range** — **Today**, **This Week**, **This Month**, or **This Year** (This Year is the default).

Click **Reset** to go back to All Branches and This Year.

You will see:

- Totals: Total, Checked Up, Cancelled, Forfeited, Completion %
- **Reservation Trend** — bookings over time
- **Outcome Distribution** — checked up vs cancelled vs forfeited
- **Session History** — one row per completed clinic day (paginated if there are many)

*[Screenshot: Reports & Analytics screen]*

---

## 8. Reviewing the doctor’s report

The report is the **Reports & Analytics** page (including **Session History**). It is built from each completed schedule and **every ticket on that day**.

| Number | Meaning |
| --- | --- |
| **Total** | All reservations that day — parent app bookings **and** walk-ins |
| **Checked Up** | Visits you finished (Complete Consultation) |
| **Cancelled** | Tickets that were cancelled (parent, or a walk-in cancelled at the desk) |
| **Forfeited** | Tickets lost because the parent did not check in in time |
| **Completion** | Checked Up ÷ Total |

Walk-ins count the same as regular reservations. They are not listed in a separate report.

Nothing appears here until a clinic session is **ended**.

*[Screenshot: Session History table]*

---

## 9. Other doctor tools

### Dashboard (Home)

First screen after login. Pick a schedule from the dropdown to see today’s counts:

- Total Reservations
- Waiting, In Consult, Completed
- Checked In, Cancelled, Forfeited

A **Schedule Overview** (Draft / Published / Active / Completed counts) sits beside it.

A compact Queue view appears on a **wide computer screen**. On a phone, use the **Queue** tab, or tap **Open Queue Control** when a session is published.

You can hide a **completed today** session from this dropdown (the **X** on that row). It stays available under Schedules.

*[Screenshot: Dashboard]*

### Profile

Update your name, title, contact number, and clinic name. Email cannot be changed here. Change your password under **Security**. Clinic branch addresses are listed here (set by the administrator).

1. Open **Profile**.
2. Edit the fields you need.
3. Click **Save Information**.

To log out: click **Log Out**, then confirm.

On a phone, Profile is a menu: **Account Settings**, **Reports & Analytics**, and **About System** (app name and version).

*[Screenshot: Profile]*
