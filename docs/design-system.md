# JantaHR design system

Codified from `apple-DESIGN.md` (the Apple web design analysis supplied by the product owner) and applied to both the
marketing site and the product UI. Each rule is written so that a violation can be pointed at; the test below each rule
is how review checks it. Values are measured from the reference, not paraphrased.

Design read: marketing site + HR/payroll product for Indian SME buyers and their employees, in an Apple-style
premium-restraint language. Dials: marketing `DESIGN_VARIANCE 7 / MOTION_INTENSITY 5 / VISUAL_DENSITY 3`; product UI
`4 / 3 / 5`. Tokens live in `packages/frontend/src/app/globals.css` and `tailwind.config.ts`.

## Colour

| Token | Light | Dark | Use |
|---|---|---|---|
| `--primary` Action Blue | `#0066cc` | `#2997ff` (Sky Link Blue) | every interactive element: buttons, links, focus, selected state |
| `--ring` Focus Blue | `#0071e3` | `#2997ff` | 2px focus ring only |
| `--foreground` Ink | `#1d1d1f` | `#f5f5f7` | all text |
| `--muted-foreground` | `#6e6e73` | `#a1a1a6` | secondary text (the reference's `#7a7a7a` fails WCAG AA at 4.29:1, so secondary text uses Apple's `#6e6e73`, 5.07:1; `#7a7a7a` is only for disabled text) |
| `--background` Parchment | `#f5f5f7` | `#161617` | page canvas |
| `--card` Canvas | `#ffffff` | `#1d1d1f` → tiles `#272729` | cards, tables, dialogs |
| `--border` Hairline | `#e0e0e0` | `#38383a` | 1px card / chip borders |
| divider-soft | `#f0f0f0` | `#2a2a2c` | row dividers inside cards |
| `--input` | `#86868b` | `#6e6e73` | form-field borders (3:1 non-text contrast) |
| global nav | `#000000` | `#000000` | the 44px global bar, the only pure black |

Rules
1. **One accent.** Action Blue is the only colour on interactive elements. *Test: does any button, link, toggle or
   selected state use a hue other than `--primary` (or `--destructive` for destroy actions)?*
2. **Status is not accent.** Workflow states (approved, pending, rejected) render as neutral pills with coloured text
   from four fixed semantic tokens (`--success #008009`, `--warning #b64400`, `--destructive #d70015`, `--info` = primary)
   at ≥ 4.5:1 on Parchment. *Test: is any status shown as a filled colour block?*
3. **No gradients, no glows.** *Test: grep for `gradient(` and `shadow-[0_0` in components.*
3b. **Notices are neutral.** Warnings, errors and tips inside a page sit on a Parchment (`bg-muted`) surface with a
   hairline; only the icon and, when needed, the text carry the semantic colour. *Test: grep for
   `bg-(warning|destructive|success|info)/` finds only the two calendar grids and the destructive button's hover.*
   Exception: attendance and leave **calendar cells** are a data visualisation and use 15% tints of the status colour,
   the way Calendar tints events.

## Type

System stack first so Apple devices render SF Pro; Inter (variable, `next/font`) elsewhere, per the reference's
substitute note. Weight ladder **300 / 400 / 600 / 700**. 500 does not exist.

| Role | Size / weight / line-height / tracking | Tailwind |
|---|---|---|
| hero-display (marketing) | 56 / 600 / 1.07 / -0.28px | `text-hero` |
| display-lg (marketing tiles) | 40 / 600 / 1.1 / 0 | `text-display` |
| display-md (product page titles, = iOS Large Title) | 34 / 600 / 1.47 / -0.374px | `text-title` |
| lead (marketing sub-copy) | 28 / 400 / 1.14 / 0.196px | `text-lead` |
| tagline (section titles, sub-nav name) | 21 / 600 / 1.19 / 0.231px | `text-tagline` |
| body / body-strong | 17 / 400 or 600 / 1.47 / -0.374px | `text-body` |
| caption / caption-strong (product UI default) | 14 / 400 or 600 / 1.43 / -0.224px | `text-caption` |
| body-strong | 17 / 600 / 1.24 / -0.374px | `text-body-strong` |
| dense-link (footer and utility link lists) | 17 / 400 / 2.41 / 0 | `text-dense-link` |
| button-large (store hero CTA) | 18 / 300 / 1.0 / 0 | `text-button-large` |
| caption-strong | 14 / 600 / 1.29 / -0.224px | `text-caption-strong` |
| button-utility | 14 / 400 / 1.29 / -0.224px | `text-button-utility` |
| fine-print (wrapping) | 12 / 400 / 1.33 / -0.12px | `text-fine` |
| nav-link, single-line fine print | 12 / 400 / 1.0 / -0.12px | `text-nav-link` |
| micro-legal | 10 / 400 / 1.3 / -0.08px | `text-micro` |

Rules
4. **No weight 500.** *Test: `grep -r "font-medium" src` returns nothing.*
5. **Marketing body is 17px**; product UI runs at caption 14px because it is dense tabular work (the reference's own
   exception: "the footer goes deliberately dense"). *Test: marketing paragraphs use `text-body`.*
6. **Negative tracking only at ≥ 14px.** *Test: no `tracking-tight` on 12px text.*

## Shape

| Radius | Value | Only for |
|---|---|---|
| pill | 9999px | primary / secondary buttons, search field, status chips, segmented controls, configurator chips |
| `rounded-sm` | 8px | compact utility buttons (icon buttons, table row actions, dark utility buttons) |
| `rounded-md` | 11px | form inputs, selects, text areas, dropdown menus (the Pearl-capsule grammar) |
| `rounded-lg` | 18px | cards, dialogs, sheets, image frames inside cards |
| none | 0 | full-bleed marketing tiles |

Rule 7. *Test: no `rounded-xl`, `rounded-2xl`, `rounded-[` other than the tokens; tiles are square-cornered.*

## Elevation

Rule 8. **Exactly one shadow**: `3px 5px 30px 0 rgba(0, 0, 0, 0.22)` (`shadow-product`), and only on product
screenshots resting on a surface. Cards, buttons, menus and dialogs are flat; floating layers (sub-nav, menus, sticky
bars) use a Parchment 80% fill with `backdrop-filter: saturate(180%) blur(20px)` and a hairline.
*Test: grep for `shadow-` finds only `shadow-product` and `shadow-none`.*

## Interaction

Rule 9. Every button presses with `scale(0.95)`. *Test: `buttonVariants` base includes `active:scale-[0.95]`.*
Rule 10. Focus is a 2px solid Focus Blue outline, offset 2px. *Test: no custom focus styles bypass `--ring`.*
Rule 11. Touch targets ≥ 44px for primary actions and form fields; 32px compact actions are allowed only inside tables
and the desktop global nav (the reference's precision-desktop exception).

## Navigation

Rule 12. **Two bars, one line each.** A 44px black global nav (brand, sections at 12px, search, notifications,
account) and a 52px frosted sub-nav (section name in tagline type on the left, section pages at 14px, one primary CTA
on the right when the page has one). No sidebar. *Test: at 1024px neither bar wraps.*

## Marketing rhythm

Rule 13. Sections are full-bleed tiles that alternate Parchment / White / Tile-1 dark; the colour change is the divider
(no borders between tiles). Each tile: headline (display-lg), one line of lead copy (≤ 20 words), at most two pill CTAs,
and one real product screenshot with `shadow-product`. This is the reference's deliberate "colour block story" and
overrides the generic single-theme rule.
Rule 14. No em dash or en dash anywhere in visible copy; no eyebrow on more than one section in three.


Rule 15. **Screenshots fail open.** The scroll `reveal` animates transform only, never opacity, so a screenshot is
visible in any browser or tool that does not advance scroll timelines. Below-the-fold shots are `loading="lazy"`, ship
a `srcset` of 640 / 1080 / 1600 px copies plus the original (`components/marketing/shots.ts`) and carry width, height
and alt text. *Test: `test/site-ui.mjs` ("scroll reveal never hides", "every screenshot below the fold").*

### Marketing patterns

- **Product tour** (`product-tour.tsx`). A segmented control (Radix Tabs, arrow keys) over one framed screenshot in a
  16:10 frame with `shadow-product`. Only the first view is in the HTML (eager, `fetchpriority="high"`, the LCP
  image); the others load after the page and cross-fade in 150 ms, with no fade under reduced motion.
  Rule: one tour per page, in the hero only. *Test: site-ui "only the first tour image is in the HTML".*
- **Trust strip.** Plain facts with a lucide icon each, no cards, logos or numbers the product does not produce,
  directly under the hero on a white band. Rule: every claim is a fact the code or a constant backs
  (`RULES_CURRENT_TO` is shared with the law section). *Test: site-ui "trust strip has four plain facts".*
- **Module cell (bento).** One cell per module in `nav.constants.ts`: icon, a 4 to 8 word title, one sentence, and
  the first plan that includes the module, read from the plan catalogue. One large cell; at most two cells carry a
  real screenshot. Rule: no invented badge; plan names come from `lowestPlanWith`. *Test: site-ui "one module cell
  per gated module".*
- **Step row.** Three steps named by their verb ("Run payroll"), one sentence each, a row from 640 px and a column
  below, in an ordered list. No numbers, connecting lines or animation. *Test: site-ui "steps are named by their
  verbs".*
- **Long-form page** (`legal-page.tsx`). 70 character column at 17 px, headed sections with anchors, an "On this
  page" list when the text passes 1,500 words, underlined inline links (`INLINE_LINK`). *Test: site-ui "long-form
  pages".*

## Dates and numbers

Rule 16. One format, from `lib/format`: `07 Oct 2026` for dates, `Oct 2026` for pay months, `2:30 pm` for times
(India time), rupees with Indian grouping (`₹1,20,194`). No `toLocaleDateString` with `month: 'short'` (it prints
"Sept") and no `toLocaleString()` without a locale. *Test: `src/lib/format/format.test.mjs`; `grep -rn
"toLocaleDateString" src` finds only the weekday name.*

## Product patterns

- **Page header.** Every page uses `PageHeader`: title equal to its nav label, one muted line of description, the
  primary action on the right and secondary actions in the "More" menu beside it. *Test: each `PageHeader title`
  matches a label in `nav.constants.ts`; no page renders more than one filled button in its header.*
- **Tables** (`DataTable`). Header row sticky under the two bars from 1024 px; below that the table scrolls inside
  its card with the first column pinned and text columns at least 8rem wide. Numeric columns are right-aligned in
  tabular figures. *Test: no screen in `scripts/ui-screens.mjs` reports horizontal overflow at 390 px.*
- **Save bar** (`SaveBar`). Long forms keep their save action in a frosted bar stuck to the bottom of the screen,
  padded clear of the Help button. *Test: the employee and settings forms end in `SaveBar`.*
- **Forms.** Label above, hint below, error below the field (replacing the hint), `aria-invalid` and
  `aria-describedby` on the control, required fields marked with `*` and `aria-required`, a disabled and labelled
  sending state, and a success state that says what happens next (`contact-form.tsx`). *Test: site-ui "contact".*
- **Charts.** Colours from the chart tokens only; each chart is an image whose accessible name states its numbers.
  *Test: every chart component takes a required `label`.*

## Type in code

Product UI uses the tokens only: `text-fine` (12), `text-caption` (14), `text-body` (17), `text-tagline` (21),
`text-title` (34, `text-[28px]` below `sm`). Tailwind's `text-xs` to `text-3xl` are not used. *Test:
`grep -rE "text-(xs|sm|base|lg|xl|2xl|3xl)\b" src` returns nothing.*

## Mobile

`packages/mobile/src/theme.tsx` carries the same tokens in React Native: Parchment `#f5f5f7` canvas (iOS black in
dark mode), 18pt cards with a hairline, 11pt fields with the `#86868b` border, pill buttons that press to 95%, Action
Blue as the only accent (`#0071e3` fill / `#2997ff` text in dark mode), statuses as coloured text on neutral pills,
native switches for consent, SF Pro through the system font at 34 / 21 / 17 / 14 / 12.

## Rebuild check

Rebuilding the dashboard from these rules alone (Parchment page, white 18px cards with hairlines and no shadow, 34px
title, 14px table text, pill blue CTAs, black 44px bar over a frosted 52px sub-nav) reproduces the reference's chassis;
the only choices the rules leave open are content, which is the product's.
