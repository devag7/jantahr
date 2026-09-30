# Compliance notes & known limits

JantaHR computes statutory amounts from **data stored in the database** (slabs, ceilings, rates) plus a small amount
of code-level logic. Nothing here replaces review by a Chartered Accountant / Company Secretary.
Laws change by notification — treat the seed values as a starting point. The dated research behind the current rules
(labour codes, EPF ₹25,000 ceiling, Income-tax Act 2025, DPDP Rules 2025) is in [`legal-2026.md`](legal-2026.md).

## What the payroll engine assumes

| Statute | Implementation | Verify |
|---|---|---|
| **EPF** | Employee 12 % of PF wages (PF-flagged components, topped up to 50 % of remuneration under the labour codes), capped at ₹15,000 up to 16-Sep-2026 and ₹25,000 from 17-Sep-2026 (September 2026 pro rata by default — `PF_CEILING_TRANSITION`). Employer 12 % = 8.33 % EPS (on capped wages) + balance EPF. EDLI 0.5 % and admin 0.5 % on capped wages, per employee (the ₹500 establishment minimum is **not** applied). Voluntary contribution on actual wages is supported by the engine (`calcPF(…, false)`) but not exposed as a setting. | Wage ceiling, admin-charge minimum, treatment of international workers |
| **ESI** | 0.75 % + 3.25 % on ESI-flagged earnings when the month's wages ≤ ₹21,000, rounded up. An employee covered earlier in the Apr–Sep / Oct–Mar contribution period stays covered to its end. | Eligibility carry-over across contribution periods |
| **Professional tax** | Slabs per state in `ProfessionalTaxSlab` (gender-specific and February overrides). Seeded: MH, KA, WB, TG, AP, GJ, MP, OD (ends 31-Mar-2026 — repealed), AS, JH. Slab versions carry `effectiveFrom` / `effectiveTo`. Half-yearly states are supported (Tamil Nadu — Chennai Corporation rates, Kerala); annual states (e.g. Bihar) are not. | **Every slab value and effective date** |
| **LWF** | `LwfRate` per state with deduction months. Seeded: MH, KA, GJ, TG, WB. | Amounts and months per state |
| **TDS (s.192 → s.392 of the Income-tax Act 2025 from 1-Apr-2026)** | Projected annual taxable salary (year-to-date + this month + recurring future months) → tax by regime → (tax − TDS so far) ÷ remaining months. FY 2025-26 slabs, ₹75k / ₹50k standard deduction, 87A rebate with marginal relief (new regime ≤ ₹12 L), surcharge with marginal relief, 4 % cess, senior-citizen exemption, HRA exemption, 80C / 80CCD(1B) / 80D / 24(b) / other Chapter VI-A from approved-or-pending declarations, employee PF counted under 80C, professional tax under old regime. Not modelled: previous-employer income, perquisites, Section 89 relief, capital-gains / other-income adjustments, employer NPS 80CCD(2). | Slabs, rebate limits, declaration proofs, mid-year regime changes |
| **Gratuity** | (15 × last wages × years) ÷ 26 with the >6-month rounding rule, ₹20 L cap; ~4y240d eligibility, **1 year for fixed-term staff**. Wages = Basic + DA topped up to 50 % of remuneration. Computed in F&F; monthly 4.81 % provision is informational. | Eligibility policy, cap, applicability |
| **Bonus** | `min(Basic+DA, ₹7,000) × months × rate` for average wages ≤ ₹21,000, rate 8.33–20 %. Uses the Act's default wage ceiling; state minimum wages are not consulted. | State minimum wage, allocable-surplus test |
| **Leave encashment** | (Basic + DA) ÷ 30 per day. Tax treatment (Sec 10(10AA)) is not modelled — it is taxed as regular salary. | |
| **Form 16 / 24Q** | The app produces a **summary PDF** and a **deductee-wise CSV extract**. The official Form 16 must come from the TRACES-validated 24Q filed with NSDL RPU. | |
| **ECR** | ECR v2 `#~#` text layout; UAN must be present. Validate on the EPFO portal before submission. | |

## Attendance & payroll rules worth knowing

* Unmarked working days are **paid and flagged** unless the run is created with "treat unmarked days as LOP" (or HR runs
  *Mark unmarked days absent* first). A half-day worked with no leave applied counts as 0.5 LOP.
* Once a month's payroll is **approved**, leave applications/cancellations, attendance edits, salary revisions and one-time
  pay for that period are blocked; reopen the run to change it.
* Night-shift attendance is grouped by the IST calendar day of the first punch; shifts crossing midnight need review.
* Times are India-local (IST). Date-only values are stored as UTC midnight.

## Data protection (DPDP Act 2023)

Implemented and tested (`/privacy/*`, web: *Privacy & my data* and *Data protection*, mobile: Profile → Privacy):

| DPDP topic | What the app does |
|---|---|
| Notice (s.5) | Versioned employee privacy notice with a recorded acknowledgement; bumping `NOTICE_VERSION` asks everyone to re-read it |
| Consent & withdrawal (s.6) | Append-only consent ledger for optional uses — selfie at check-in, GPS at check-in, third-party AI model. A withdrawal is **enforced immediately**: selfie/GPS are not stored, the assistant stops calling the LLM. Employment, payroll and statutory processing is treated as a s.7 legitimate use and is not consent-gated. Absence of a record means "not asked" and is treated as allowed. |
| Right of access (s.11) | One-click JSON export of everything held about the person (profile with own PAN/Aadhaar/bank in clear, leave, attendance, payslips, claims, consents…); HR can produce the same for an access request. Every export is audit-logged. |
| Correction / erasure / grievance / nomination (s.12-14) | Employee request queue with the 90-day due date from DPDP Rules r.14 and overdue flag; closing needs a resolution note the employee sees. |
| Retention & erasure (s.8(7)) | Only people who have **left** can be erased. Inside `DATA_RETENTION_YEARS` (default 8) after the last working day, erasure is **partial**: contact details, family, addresses, Aadhaar, photo, selfies/GPS/IPs, non-KYC documents and sessions go; name, DOB, PAN, bank, UAN/ESIC/PF and payroll records stay. After that window the record is fully anonymised (login account rewritten and disabled). Requires typing the employee code. |
| Breach handling (s.8(6)) | Breach register with severity, containment notes, "Board notified" and "employees notified" timestamps, one-click in-app + email notice to all employees; a breach cannot be closed until the Board notification is recorded. **The app does not file with the Data Protection Board.** |
| Applicants | Careers form requires accepting a notice (timestamp stored); non-hired applicants are anonymised after `APPLICANT_RETENTION_MONTHS` (default 12) by the nightly job. |
| Security safeguards (s.8(5)) | Role + reporting-line scoping, masked PII, AES-256-GCM for PAN / Aadhaar / bank account, audit log of every write, refresh-token revocation, nightly purge of stale tokens and read notifications, data stored in ap-south-1 with the provided Terraform. |

Not implemented — add before onboarding customers with DPDP obligations: Data Protection Officer / Consent Manager workflow, DPIA for significant-data-fiduciary status, cross-border transfer register, processor (sub-processor) agreements, verifiable parental consent (no minors are modelled), consent capture for non-employee data such as emergency contacts and nominees, and an immutable/WORM audit store. Erasure of free text inside helpdesk tickets and audit-log payloads is not attempted. Have counsel review the notice wording and retention periods.

## Not built yet

Bank-API salary disbursement · SSO (SAML/OIDC) · Slack/Teams and Tally/Zoho Books integrations · custom workflow builder ·
multi-language UI · push-notification service (FCM) · OCR for receipts · WebSocket push (the web app polls every 30 s) ·
BullMQ job queue (cron jobs run in-process; if you run several API replicas, move them to a single worker) ·
Excel (.xlsx) exports (CSV only) · 360° feedback and PIPs · SOC 2 / ISO 27001 controls.
