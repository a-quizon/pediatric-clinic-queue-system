# Project Turnover Ownership

Document who owns each production asset after the capstone is handed over. Fill every **TO FILL** cell before go-live. **Never** store real passwords, API keys, or private key files in this document.

## Ownership table

| Asset | Current owner | Owner after turnover | How to transfer | Credentials / keys needed (names only) |
|-------|---------------|----------------------|-----------------|----------------------------------------|
| Firebase project (production) `pediatric-clinic-queue-system` | TO FILL | TO FILL | Google Cloud / Firebase Console → Users and permissions; add new Owner, then remove departing owners | Google account with Owner role; billing account |
| Firebase project (staging) `pediatric-clinic-queue-testing` | TO FILL | TO FILL | Same as production | Google account |
| Custom domain / DNS (if any) | TO FILL | TO FILL | Registrar DNS + Firebase Hosting custom domain | Domain registrar login; DNS access |
| Source code GitHub repo | TO FILL | TO FILL | Transfer repo ownership or add admins; update branch protection | GitHub org/user admin |
| Firebase Hosting site(s) | TO FILL | TO FILL | Follows Firebase project ownership | Deploy via Firebase CLI with project access |
| Cloud Functions + env (VAPID, TextBee, etc.) | TO FILL | TO FILL | Share password-manager vault entry; rotate keys after handoff | `VAPID_*`, `TEXTBEE_API_KEY`, `TEXTBEE_DEVICE_ID`, service account JSON (store privately) |
| Realtime Database + Auth | TO FILL | TO FILL | Follows Firebase project | Console + service account for Admin SDK |
| TextBee account / Android gateway device | TO FILL | TO FILL | Transfer TextBee account email; physical handoff of the SMS phone/device | TextBee dashboard login; device SIM PIN if any |
| Production System Admin accounts | TO FILL | TO FILL | Create/rotate via Admin SDK (`docs/AdminBreakGlass.md`); record uids privately | Admin email + password in password manager |
| Google Play / Capacitor Android signing (if published) | TO FILL | TO FILL | Play Console user invite; keystore handoff | Play Console; keystore file + passwords (private) |
| Billing (Blaze / Cloud) | TO FILL | TO FILL | Move billing account or update payment profile | Cloud Billing admin |

## Questions you must answer (checklist)

1. Who is the **clinic / school / organization** legal owner after defense?
2. Which **Google account** will be Firebase Owner for production? For staging?
3. Who pays **Google Cloud / Firebase Blaze** billing after turnover?
4. Is there a **custom domain**? Who owns the registrar account?
5. Who will hold the **GitHub** admin role?
6. Who physically keeps the **TextBee SMS phone/device**, and which email owns TextBee?
7. Where will **service account JSON** and VAPID/TextBee secrets live (password manager name)?
8. How many **production System Admin** accounts, and who knows the break-glass procedure?
9. Will the **staging** project stay for demos, or be deleted?
10. Who is on-call to run **backup/restore** (`docs/BackupAndRestorePlan.md`)?

## Related docs

- `docs/AdminBreakGlass.md` — admin/doctor credential recovery (Admin SDK)
- `docs/BackupAndRestorePlan.md` — backup frequency and restore drills
- `docs/RoleMigrationChecklist.md` — role separation deploy checklist
