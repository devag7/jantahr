# Indian employment law that JantaHR implements — status as of September 2026

Research notes behind the payroll, leave, exit and privacy rules in this codebase. Every row says what the law is, what the
app does, and what is still open. **This is engineering research, not legal advice** — have a Chartered Accountant /
labour-law counsel sign off before running live payroll. Rates change by notification; most values below live in the
database or in one constant so they can be updated without a release.

## 1. Labour codes (in force 21 November 2025)

The Code on Wages 2019, Industrial Relations Code 2020, Code on Social Security 2020 and OSH Code 2020 replaced 29 central
labour laws on **21-Nov-2025**. Final **Central Rules for all four codes were notified on 8-May-2026**; state rules apply
where the state is the "appropriate government" and several states are still notifying theirs.

| Topic | Rule | JantaHR |
|---|---|---|
| **Uniform "wages"** | Wages = Basic + DA + retaining allowance. HRA, conveyance, special allowances, employer PF, bonus, overtime, commission etc. are excluded — **but if the excluded items exceed 50% of total remuneration, the excess is added back to wages** (Code on Wages s.2(y) proviso). MoLE FAQs (Mar-2026): employer PF share and statutory bonus count in remuneration; gratuity and ESI do not; annual performance incentives are not wages. Remuneration in kind counts up to 15% of wages. | `engine/labour-code.ts` `codeWages()`. Applied to PF wages on every slip for wage months ending on/after 21-Nov-2025 (warning on the slip when it bites), to gratuity, leave encashment and F&F. Company switch `labourCodeWages` (default on). Default salary structure now pays **Basic = 50% of CTC**. |
| Open question | Whether PF must be paid on the added-back amount *above* the EPF ceiling is not settled; contributions above the ceiling remain voluntary. | PF wages are topped up, then capped at the ceiling. |
| **Wage payment deadline** | Monthly wages **before the 7th** of the next month (Code on Wages s.17(1)). | Compliance calendar item per wage month; turns *Done* when the payroll run is marked paid. |
| **Final settlement** | Wages of an employee who resigns, is removed/dismissed or retrenched: **within 2 working days** (s.17(2)). Gratuity keeps its own 30-day clock. | Calendar item per approved separation (last working day + 2 working days, skipping the company's weekly offs); done when F&F is approved. |
| **Gratuity** | 15/26 × last wages × years; >6 months rounds up; ₹20 lakh cap. **Fixed-term employees qualify after 1 year** (pro rata). Applies on the labour-code wage definition for payments on/after 21-Nov-2025. | `calcGratuity(wages, years, { fixedTerm })`; employment type "Fixed-term" added. |
| **Statutory bonus** | Eligible if wages ≤ **₹21,000/month**; bonus computed on **₹7,000 or the minimum wage, whichever is higher**, at 8.33–20% (S.O. 4710(E) & 4711(E), 25-Aug-2026, retrospective to 21-Nov-2025). Pay within 8 months of year end. Which minimum wage (central vs state) is disputed. | Bonus report takes the calculation ceiling as input; calendar item 30 Nov. |
| **Leave** | Annual leave: 1 day per 20 days worked once 180 days are worked in a calendar year; **carry-forward capped at 30 days**; all accumulated leave encashable on separation. | Default Privilege Leave carry-forward changed 45 → 30. Accrual remains monthly (policy-configurable). |
| **Overtime** | Twice the ordinary rate; **max 125 hours per quarter** (OSH Central Rules 2026); consent required. | `/compliance/overtime` flags employees at ≥80% / over the cap per calendar quarter. OT pay itself is entered as one-time pay. |
| Payslips, registers | Electronic wage slips and registers (Wage Rules Forms I, IV, V, IX); appointment letters in prescribed format. | Payslip PDF + salary register CSV. Prescribed form layouts **not** reproduced. |

## 2. Social security

| Topic | Rule | JantaHR |
|---|---|---|
| **EPF wage ceiling** | Raised **₹15,000 → ₹25,000/month with effect from 17-Sep-2026** (Gazette S.O. 5109(E), Code on Social Security s.2(89); Cabinet approval 16-Sep-2026). Employee 12% (max ₹3,000), EPS 8.33% (max ₹2,083), EDLI and admin 0.5% (max ₹125 each). ~51 lakh more workers become mandatorily covered. | `PF_CEILING_HISTORY` in `engine/statutory.ts`; ceiling chosen by wage month. |
| September 2026 split month | EPFO has **not** issued the filing method for the month that straddles the change. | `PF_CEILING_TRANSITION=PRO_RATA` (default: 16 days at ₹15k + 14 days at ₹25k) or `NEXT_WAGE_MONTH` (₹15k for all of September). Re-check EPFO's ECR release notes before filing September ECR (due 15-Oct-2026). |
| ESI | Ceiling unchanged at **₹21,000** (₹25,000 for persons with disability); 0.75% + 3.25%. Contribution periods Apr–Sep and Oct–Mar; an employee covered at the start stays covered until the period ends even if wages rise (notification 8-May-2026). Uses the Social Security Code wage definition. | `calcESI(wages, stayCovered)`; slip checks earlier slips in the same period. Disability ceiling **not** modelled. |
| PM-VBRY (Employment Linked Incentive) | 1-Aug-2025 to 31-Jul-2027: up to ₹15,000 to first-time EPF members and up to ₹3,000/month per additional hire to employers; needs Aadhaar-authenticated UANs and regular ECRs. | Not tracked. UAN-missing warning on slips helps eligibility. |

## 3. Income tax (Income-tax Act 2025, from 1 April 2026)

| Topic | Rule | JantaHR |
|---|---|---|
| New Act | The Income-tax Act, 2025 replaced the 1961 Act from **1-Apr-2026**; "previous year / assessment year" became **"tax year"**. Salary TDS is **s.392** (was s.192/192A). | Tax statement PDF shows the governing Act and section. |
| Forms | **Form 130** replaces Form 16; **Form 143** replaces Form 24Q; **Form 124** replaces Form 12BB; **Form 122** records the regime choice. | `salaryTdsLaw(fyStartYear)` picks names by year in PDFs, report file names and UI. |
| Slabs FY 2026-27 | Unchanged from FY 2025-26 (Budget 2026 made no slab change): new regime 0–4 L nil, 5/10/15/20/25/30% at 4 L steps to 24 L; ₹75,000 standard deduction; rebate up to ₹60,000 for income ≤ ₹12 L with marginal relief. Old regime unchanged (₹50,000 SD, ₹12,500 rebate ≤ ₹5 L). | Already implemented; slab tables in DB. |
| **HRA metros** | Income-tax Rules 2026 add **Bengaluru, Hyderabad, Pune and Ahmedabad** to the 50% list (with Delhi, Mumbai, Kolkata, Chennai). | Declaration form lists the cities by year. |
| Allowances & perquisites (Rules 2026) | Children education ₹3,000/month/child (was ₹100); hostel ₹9,000 (was ₹300); meal ₹200/meal (was ₹50); car perquisite ₹5,000/₹7,000 + driver ₹3,000; accommodation 10% / 7.5% / 5%. | Salary components carry an exemption type (`CHILD_EDUCATION`, `HOSTEL`, `MEAL`); TDS projection and the regime comparison exempt up to the limit for the tax year (education/hostel: old regime, max 2 children from the declaration; meal ₹200 × 22 meals/month: both regimes). Default components CEA, HOSTEL, MEAL added. Car/accommodation perquisite values are **not** modelled. |
| Due dates | TDS deposit by the 7th (March: 30 April); quarterly return 31 Jul / 31 Oct / 31 Jan / 31 May; certificate by 15 June. | Compliance calendar; HR marks each as filed with the challan/acknowledgement number. |

## 4. State levies

| State | Change | JantaHR |
|---|---|---|
| **Odisha** | Professional tax **repealed from 1-Apr-2026** (Repeal Ordinance notified 21-Apr-2026). | PT slabs have `effectiveTo`; Odisha ends 31-Mar-2026, so no PT from April 2026. |
| Karnataka | From 1-Apr-2025 (Act 33 of 2025): nil up to ₹25,000; ₹200/month, ₹300 in February (₹2,500/year). LWF ₹50 employee + ₹100 employer per year. | Slabs already correct; LWF corrected (was ₹20/₹40). |
| Maharashtra | Men: nil ≤ ₹7,500, ₹175 to ₹10,000, then ₹200 (₹300 Feb). Women: nil ≤ ₹25,000 (from Apr-2023). | Already correct. |
| Madhya Pradesh | ₹166 (₹174 last month) and ₹208 (₹212 last month). | Corrected from ₹167 / ₹208 flat. |
| Tamil Nadu, Kerala | Half-yearly on half-year gross. TN is levied by each local body (Chennai Corporation: nil ≤ ₹21,000; ₹180 / 425 / 930 / 1,025 / 1,250). Kerala: nil < ₹12,000 up to ₹1,250. | Slabs with `frequency = HALF_YEARLY`; deducted in Sep & Mar (TN) / Aug & Feb (Kerala) on earned-so-far + projected half-year gross. Other TN local bodies need their own slab rows. |

## 5. Data protection — DPDP Act 2023 & DPDP Rules 2025

Rules notified **13/14-Nov-2025** with phased commencement: Board provisions immediately; Consent Manager registration
from **Nov-2026**; notice, security, breach, rights and retention duties from **13-May-2027** (MeitY floated cutting this
to 12 months for Significant Data Fiduciaries in Jan-2026; no amending notification found as of Sep-2026).

| Duty | Rule | JantaHR |
|---|---|---|
| Employment data | s.7(i) "legitimate use" — employment purposes need no consent; anything beyond (wellness profiling, marketing, third-party AI) does. | Only selfie, GPS and third-party-AI uses are consent-gated. |
| Rights & grievances | Respond **within 90 days** (r.14). | Request due date = 90 days; overdue flag; calendar item. |
| Breach | Tell affected people without delay; **detailed report to the Board within 72 hours** (r.7). | Breach register shows the 72-hour deadline and "overdue"; calendar item. |
| Safeguards | Encryption, access control, masking, logging; **logs kept ≥ 1 year**; processor contracts (r.6). | AES-256-GCM PII, RBAC, masked views, audit log (never purged). |
| Penalties | Up to ₹250 crore (safeguards), ₹200 crore (breach notice / children). | — |

## 6. Not implemented — known gaps

State-specific rules under the codes · prescribed register/form layouts · minimum-wage floor checks · ESI disability ceiling · Rules-2026 car / accommodation perquisite valuation · PM-VBRY tracking · Form 130/143 file generation
in the official FVU format · night-shift consent for women (OSH Rules) · appointment-letter template in the prescribed
format · annual health check tracking for 40+ employees in covered sectors.

## Sources

- Labour codes in force 21-Nov-2025: [TaxGuru](https://taxguru.in/corporate-law/labour-code.html), [PwC](https://www.pwc.in/tax-knowledge-hub/new-labour-codes.html)
- Central Rules notified 8-May-2026: [BDO](https://www.bdo.in/en-gb/insights/alerts-updates/alert-final-central-rules-notified-under-all-four-labour-codes), [DLA Piper](https://knowledge.dlapiper.com/dlapiperknowledge/globalemploymentlatestdevelopments/2026/Key-considerations-of-the-notified-Central-Rules-under-Indias-Labour-Codes), [TeamLease RegTech](https://www.teamleaseregtech.com/updates/article/55678/code-on-wages-central-rules-2026/), [KPMG](https://kpmg.com/xx/en/our-insights/gms-flash-alert/2026/flash-alert-2026-127.html), [SCC Online — OSH rules](https://www.scconline.com/blog/post/2026/05/13/osh-central-rules-2026-key-highlights-and-compliance-guide/)
- Wage definition & 50% rule: [Code on Wages s.2 (bare act)](https://www.advocatekhoj.com/library/bareActs/codeonwages/2.php), [SCC Online — MoLE FAQs analysis](https://www.scconline.com/blog/post/2026/04/26/ministry-faqs-four-labour-codes-india-2026/), [Numerica](https://numericaconsulting.com/blog/new-labour-code-faqs-employers-india-2025/)
- Wage payment timelines: [Code on Wages s.17](https://indiankanoon.org/doc/151218690/)
- Leave under OSH Code: [LawSikho](https://lawsikho.com/blog/working-hours-overtime-leave-labour-codes/), [HL Kumar & Associates](https://hlkumarandassociates.com/leave-and-leave-encashment-under-the-labour-codes/)
- EPF ceiling ₹25,000: [SCC Online](https://www.scconline.com/blog/post/2026/09/17/cabinet-approves-epfo-wage-ceiling-limit-from-15000-to-25000/), [SGCMS](https://www.sgcms.com/regulatory-updates/epfo-wage-ceiling-increased-from-15000-to-25000/), [CorpLawUpdates](https://www.corplawupdates.in/updates/epfo-wage-ceiling-rs-25000-cabinet-approval-2026), [NatLawReview](https://natlawreview.com/article/raising-epfo-bar-central-government-increases-wage-ceiling-inr-25000)
- ESI 2026: [ClearTax](https://cleartax.in/s/esi-rate), [Lexology — SS Rules](https://www.lexology.com/library/detail.aspx?g=d55c3bc4-7b5a-487b-b21a-9ae502fecd6c)
- Bonus notifications Aug-2026: [SCC Online](https://www.scconline.com/blog/post/2026/08/26/bonus-rules-under-code-on-wages-eligibility-calculation/), [Pradeep's Pen](https://pradeepspen.wordpress.com/2026/09/04/perplexity-in-payment-of-bonus-under-wages-code-s-o-4710e-dt-25-08-2026/)
- Gratuity: [LLR](https://labourlawreporter.com/gratuity.asp), [Bajaj Finserv](https://www.bajajfinserv.in/investments/gratuity-rules)
- Income-tax Act 2025 / s.392 / forms: [ClearTax s.392](https://cleartax.in/s/section-392-income-tax-act-2025), [ClearTax TDS changes](https://cleartax.in/s/tds-and-tcs-changes-from-april-2026), [TaxGuru — Rules 2026](https://taxguru.in/income-tax/new-income-tax-rules-2026-notified-taxpayer-know.html), [ClearTax slabs](https://cleartax.in/s/income-tax-slabs)
- HRA metros: [TaxGuru](https://taxguru.in/income-tax/hra-exemption-8-cities-qualify-50-percent-exemption-practical-guide.html)
- Professional tax: [Zoho Payroll](https://www.zoho.com/in/payroll/academy/taxes-and-compliance/professional-tax-rules.html), [Odisha repeal — SCC Online](https://www.scconline.com/blog/post/2026/04/23/odisha-repeals-levy-of-professional-tax-effective-from-1-april-2026/), [Karnataka amendment — TaxGuru](https://taxguru.in/corporate-law/karnataka-tax-profession-trades-callings-employments-amendment-act2025.html), [Maharashtra women — TaxGuru](https://taxguru.in/goods-and-service-tax/profession-tax-maharashtra-monthly-salary-rs-25000-women.html)
- LWF: [Patron Accounting](https://www.patronaccounting.com/blog/labour-welfare-fund-india-contribution-rates-due-dates)
- PM-VBRY: [ClearTax](https://cleartax.in/s/pradhan-mantri-viksit-bharat-rozgar-yojana)
- DPDP Rules 2025: [PIB](https://static.pib.gov.in/WriteReadData/specificdocs/documents/2025/nov/doc20251117695301.pdf), [Scrut](https://www.scrut.io/post/dpdp-rules), [Sansa Legal](https://www.sansalegal.com/post/how-to-comply-with-the-dpdp-act-2023-before-the-may-2027-enforcement-deadline), [MeitY timeline proposal — Chambers](https://chambers.com/articles/meity-plans-to-cut-short-dpdp-compliance-timeline-and-notify-cross-border-restrictions-for-sdfs), [dpdpa.com Rule 6](https://www.dpdpa.com/dpdparules/rule6.html)
