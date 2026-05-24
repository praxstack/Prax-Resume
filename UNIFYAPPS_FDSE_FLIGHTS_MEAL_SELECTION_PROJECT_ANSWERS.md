# UnifyApps FDSE × Product — Flights Meal Selection (Flexi Fares Ancillary): Long-Form Project Answers

> **Audience:** me (Prakhar), preparing the **Amazon Flights Meal Selection (Ancillary / Flexi Fares)** project for a UnifyApps Sr. FDSE / Product loop.
>
> **Source basis:** `Interview-Prep/AllProjectAndOtherFiles/Flights - Meal Selection.pdf` — the design doc I wrote for the Flexi-Fares meal-attach feature, including the four-approach trade-off comparison (Cart vs Redis vs Duplicate-Order vs Modify-Order), the ancillary API extension, the cancellation-charge unification (`seat_charge` → `ancillary_charge`), and the optimization for the seat-state-loss-on-page-reload problem.
>
> **Why this project for FDSE × Product:** revenue-generating ancillary feature with a measurable conversion target (~10% meal attach), end-to-end ownership from MMT API extension through backend persistence to frontend state management, with a hard architectural decision (cart vs cache vs duplicate order vs modify order) made in writing with explicit trade-offs. Pure FDSE × Product shape.

---

## 0. The dual-role pitch (memorize verbatim)

> "I led the Meal Selection feature for Flexi Fares on Amazon Flights — a new add-on that gave upgraded-fare customers a meal-selection screen between seat selection and order review. Business case: Flexi Fares was Amazon Flights' answer to airline upsell revenue, and meal attach rate was the headline ancillary metric we were targeting at ~10%. I owned the design from the partner-side API extension (adding `MEALS` and `MEAL_PREFERENCE` feature flags to MMT's Addons API) through the backend persistence (extending the existing `flight_addon` table to support meals as a separate entry, `seat_charge` → `ancillary_charge` rename for cancellation refunds), through the frontend state management (Redux store extension, sector-keyed selected-meals map), through the cancellation-flow integration (meal as non-refundable line item across OD, email, refund summary). The architectural call I'm proudest of was Approach-1 (Use Cart to support addons) over the alternatives — duplicate orders, modify-order, or pure Redis cache — because it was the only one that scaled to future ancillaries (baggage, lounge, insurance) without architectural rework."

---

## 1. The 90-second extension (when they say "go deeper")

> "Meal selection looked simple from the customer side: pick a veg or non-veg meal, see it in the order review, see the charge, see it on the e-ticket. The complexity was hidden in the architecture. Flights had four major surfaces touching meal: the ancillary page (where customer picks the meal), the order review page (where the meal charge shows up in the breakup), the cancellation flow (where the meal charge needs to be a non-refundable line item with the right label), and the OD page (where each passenger's meal needs to appear next to their name and seat). Each surface needed coordinated changes — not a code change in one place, but a contract change across MMT's Addons API → my backend Ancillary API → my Order Review API → my Cancellation API → my OD enrichment.
>
> The biggest design decision was where to store the meal selection between the meal-pick screen and the actual booking commit. Four approaches on the table — Cart Service (extend the existing promotions cart), Redis cache (segment-keyed temporary store), Duplicate Orders (create a new order on every change), and Modify Order (mutate the existing order before payment). I evaluated each on Scalability, Backward Compatibility, Long-Term Thinking, Operational Excellence, Time to Market, Cost, Robustness, Latency, and Auditing. Approach-1 (Cart) won because it was the only one that handled future ancillaries without rework — when we add baggage in Phase 2, it's the same cart abstraction with one new addonType.
>
> The Product judgment I'm proudest of: deprioritizing the 'Add Meal on Review for base-fare customers' feature. Mental model was 'meal attach is ~10%, customers who chose base fare are interested in no-frills, taking them through meal selection slows down their booking journey.' That deprioritization saved engineering time and improved conversion for the dominant customer segment. Documented in the design doc, agreed with Product."

---

## 2. Project facts (memorize the numbers)

| Fact | Number / Detail |
|---|---|
| **Business case** | Flexi Fares ancillary revenue — meal attach rate target ~10% |
| **Feature scope (Phase 0)** | Meal selection screen for upgraded-fare (Flexi Fares) customers; deprioritized for base-fare |
| **Position in flow** | After Seat Selection, before Order Review (new screen in the booking funnel) |
| **MMT API extension** | Added `MEALS` and `MEAL_PREFERENCE` feature flags to MMT Addons API `ff` parameter (was: SEATS only; now: comma-separated list) |
| **Backend storage** | `flight_addon` table — meal is a separate row per (passenger, sector) with `type=MEALS`, `item=<meal_code>`, `fare=<price>` |
| **Cancellation refund schema rename** | `seat_charge` → `ancillary_charge` in `flight_cancellations` and `cancellation_breakups` tables; backward-compat preserved for future per-addon split |
| **Frontend state shape** | `ancillary.selectedMeal: { "BLR-BOM": ["VGRW", "NVPE"] }` — sector-keyed array of meal codes, length ≤ # passengers |
| **Order Review API addition** | `mealCharges` line item in `priceDetails.breakup` |
| **OD response addition** | `meal` and `meal_status` per traveller, similar to `seat_no` and `seat_status` |
| **Init Booking API extension** | `addonType=MEALS` for meals, `MEAL_PREFERENCE` for free preferences (Vegetarian Jain, etc.) |
| **MMT Cancel Preview** | MMT sends combined `ANCILLARY_DEDUCTION_CHARGES` (not split per-addon); we render as combined "Seat/Meal charge" in refund breakup |
| **Meal icons** | Fetched from MMT CDN: `https://imgak.mmtcdn.com/flights/assets/media/dt/ancillaries/meals/...` with default fallbacks for veg/non-veg/unknown |
| **Refundability** | Meals non-refundable (Phase 0); `isRefundable` field added in meals section for future when MMT supports per-addon refund |
| **Internal teams I aligned with** | MMT (Addons API extension), Backend (Order Review + Cancellation + OD APIs), Frontend (Redux store + meal-selection page + skip-CTA + reload handling), Cart Service (for the Approach-1 cart extension), Product (the "deprioritize base-fare meal-on-review" call) |
| **Tech stack** | Java backend (`HFCFlightService`), MySQL RDS (`flight_addon`, `flight_cancellations`, `cancellation_breakups`), React + Redux frontend, Redis cache (for the seat-state-on-reload optimization), AWS AppConfig (for the meal-icon URL config) |
| **Out of scope (deliberately)** | Accounting / fund-flow of meal charge; selection of meals after booking; custom meal ordering by popularity (Phase 1 candidate) |
| **Boson Design Review SIM** | BDR-12910 |
| **MMT Jira** | AMZMMTFL-1001 |

---

## 3. High-Level Design (architecture walkthrough)

```
                        ┌────────────────────────────────┐
                        │   Customer on Traveller Details │
                        │   (Flexi Fares booking funnel)  │
                        └──────────────┬─────────────────┘
                                       │
                                       ▼
                        ┌────────────────────────────────┐
                        │   Seat Selection Screen         │
                        │                                 │
                        │   On click "Continue":          │
                        │   • Save seats to Redux         │
                        │   • POST /ancillary/selections  │  ◀── async save
                        │     to Redis (sector-keyed)     │      (so reload
                        └──────────────┬──────────────────┘      doesn't lose
                                       │                         seat selection)
                                       ▼
                        ┌────────────────────────────────┐
                        │   ★ NEW: Meal Selection Screen  │
                        │                                 │
                        │   Renders only if:              │
                        │   • upgraded fare (Flexi)       │
                        │   • meals[] OR mealPreferences[]│
                        │     present in ancillary resp   │
                        │                                 │
                        │   UI:                           │
                        │   • Veg + Non-veg buckets       │
                        │   • First 3 each, "See More"    │
                        │     to expand                   │
                        │   • Meal preferences shown      │
                        │     separately (no veg/nv split)│
                        │   • Skip Meal CTA (unless       │
                        │     isMandatory=true)           │
                        │                                 │
                        │   On selection:                 │
                        │   • Push meal_code to Redux     │
                        │     selectedMeal[sector]        │
                        │   • Length check: ≤ # pax       │
                        │   • Toaster on overflow         │
                        └──────────────┬──────────────────┘
                                       │
                                       ▼
              ┌──────────────────────────────────────────────────┐
              │   AMZ Ancillary API (POST)                       │
              │                                                   │
              │   Calls MMT Addons API (GET):                    │
              │   ?itId={itinerary_id}&ff=SEATS,MEALS,MEAL_PREF  │  ◀── multi-flag
              │                                                   │      query (no
              │   Returns combined response:                      │      latency hit
              │   {                                               │      per spec)
              │     onward: {...},                                │
              │     return: {...},                                │
              │     sectors: {                                    │
              │       "BLR-BOM": {                                │
              │         seats: {...},                            │
              │         meals: {                                  │  ◀── new section
              │           isMandatory: true,                      │
              │           meals: [{ code, type, name,             │
              │                    icon, price }],                │
              │           mealPreferences: [{ code, type,         │
              │                              icon, name,          │
              │                              price=0 }]           │
              │         }                                          │
              │       }                                            │
              │     }                                              │
              │   }                                                │
              └──────────────┬───────────────────────────────────┘
                             │
                             ▼
                        ┌────────────────────────────────┐
                        │   Order Review Screen           │
                        │                                 │
                        │   Calls Order Review API:       │
                        │   • mealCharges line item       │
                        │     in priceDetails.breakup     │
                        │   • Shown only if > 0           │
                        │   • "(Non-refundable)" tag      │
                        └──────────────┬──────────────────┘
                                       │
                                       ▼
                        ┌────────────────────────────────┐
                        │   Init Booking (Validate Fare)  │
                        │                                 │
                        │   POST to MMT Hold API with:    │
                        │   travellerAddons: [            │
                        │     {addonType:"SEATS",         │
                        │      itemCode:"34A", price:150},│
                        │     {addonType:"MEALS",         │
                        │      itemCode:"VGTR", price:400}│  ◀── meals as
                        │   ]                              │      separate entry
                        │                                  │      next to seats
                        │   On Hold success:               │
                        │   • Persist to flight_addon DB:  │
                        │     row per (sector_passenger,   │
                        │     type=MEALS, item=meal_code,  │
                        │     fare=price, status=PENDING/  │
                        │     CONFIRMED)                   │
                        │   • If meal NOT in HOLD response │
                        │     "travelerAddons" → meal      │
                        │     sold out, error UI similar   │
                        │     to seat-sold-out             │
                        └──────────────┬──────────────────┘
                                       │
                                       ▼
                        ┌────────────────────────────────┐
                        │   Order Confirmation            │
                        │                                 │
                        │   • OD page: meal name +        │
                        │     meal_status per traveller   │
                        │   • Email + e-ticket: meal name │
                        │     under each passenger        │
                        │   • Payment breakup includes    │
                        │     "Meal charge"               │
                        └──────────────┬──────────────────┘
                                       │
                                       ▼
                        ┌────────────────────────────────┐
                        │   Cancellation Flow             │
                        │                                 │
                        │   MMT Cancel Preview returns    │
                        │   combined "ANCILLARY_DEDUCTION │
                        │    _CHARGES" (not split per     │
                        │   addon)                        │
                        │                                 │
                        │   AMZ Cancel Details renames:   │
                        │   seat_charge → ancillary_charge│  ◀── single field for
                        │                                 │      seat + meal +
                        │   UI label: "Seat/Meal charge   │      future ancillaries;
                        │   (Non-refundable)"             │      backward-compat for
                        │                                 │      future per-addon split
                        │   Persisted in flight_          │
                        │   cancellations: ancillary_     │
                        │   charges column added; seat_   │
                        │   charges column kept for       │
                        │   future per-addon split        │
                        └────────────────────────────────┘
```

### Key invariants (drill these in)

1. **Meals are separate `flight_addon` rows, not nested in seats.** Same primary key shape as seats (`type`, `item`, `fare`, `sector_passenger_id`). The schema is "addons are addons" — seats and meals are sibling rows with different `type` values. This makes future ancillaries (baggage, lounge) addable with zero schema changes.
2. **MMT API is multi-flag — no latency cost for combined fetch.** Single GET to MMT Addons API with `ff=SEATS,MEALS,MEAL_PREFERENCE` returns everything. Per MMT confirmation: no latency impact for multiple flags.
3. **Meal section is conditional on fare upgrade.** Meal selection screen renders only if upgraded fare AND `meals[]` or `mealPreferences[]` is non-empty. Base-fare customers skip the screen entirely (deprioritized add-meal-on-review CTA).
4. **`isMandatory` controls the Skip CTA visibility.** Some Flexi Fares include free meals where customer must pick one — `isMandatory: true` removes the Skip button. Otherwise Skip is shown.
5. **Sector-keyed Redux state.** `selectedMeal` is `Map<sector, Array<meal_code>>`. Length must be ≤ # passengers; toaster on overflow. Same shape as `selectedSeat` for consistency.
6. **Meals non-refundable in Phase 0; schema-extensible.** `isRefundable` field is added in the meal response as a boolean for future when MMT supports per-airline meal refund. Today it's always false.
7. **Cancel charge unification: `seat_charge` → `ancillary_charge`.** Single field covers seats + meals (and future ancillaries). UI label is "Seat/Meal charge" until MMT supports per-addon refund split. Backward-compat preserved by keeping `seat_charges` column in the DB for future re-introduction.
8. **Page-reload optimization: save selected seats to Redis BEFORE meal screen.** Otherwise reloading the meal page loses seat state because Redux is in-memory. Trade-off: data inconsistency risk if save call fails — accepted because the alternative (showing a loader between seat and meal screens) was Product-rejected.

---

## 4. Low-Level Design (decisions worth defending)

### 4.1 Approach-1 (Cart Service) won over Redis / Duplicate-Order / Modify-Order

The single biggest architecture decision of the project. Comparison table from the design doc:

| Approach | Scalability | Backward Compat | Long-Term Thinking | Op Excellence | Time to Market | Cost | Robustness | Latency | Auditing |
|---|---|---|---|---|---|---|---|---|---|
| **1. Use Cart for addons** ✅ | High | High | High | High | High (dep on Cart) | Low | High | Medium | High |
| 2. Redis cache | High | High | Medium | High | Medium | High | High | Low | High |
| 3. Duplicate orders | Low | High | Low | Low | Low | Medium | Medium | Low | High |
| 4. Modify existing order | Low | Low | Low | Low | Medium | Low | Low | High | Low |

**Why Cart won, in interviewer-ready phrasing:**

> "Three reasons. One — long-term thinking. We were going to add baggage, lounge, and insurance as future ancillaries. Cart-extension is the only approach that handles them with one new `addonType` enum value, no architectural rework. Approaches 3 and 4 would each require a re-architecture per addon. Two — backward compat. The Cart Service was already production-ready for promotions; extending it for addons was a clear additive change that didn't break promotion-only callers. Modify-Order would have broken every existing integration that assumed order amount was final at initiation. Three — auditing. Cart maintains a clean state-of-record before order initiation; Modify-Order would mutate orders post-initiation, which breaks the audit chain Payments and Finance teams rely on."

### 4.2 Why we chose `flight_addon` row-per-meal over a JSON column on the booking

> "Two reasons. One — query patterns. The OD page needs 'meal_name + meal_status per traveller' — that's a join, not a JSON parse. Storing meals as rows keyed by `sector_passenger_id` makes that a one-line SQL query. JSON column would force per-row JSON parsing on every read. Two — refund accounting. Meal is a non-refundable line item; cancellation must reference the specific meal item code and fare for the audit trail. Row-per-meal is structurally cleaner for accounting than 'meals' as a JSON blob inside the booking row."

### 4.3 Why `seat_charge` → `ancillary_charge` rename (not seat-and-meal-as-separate columns)

> "MMT only sends a combined `ANCILLARY_DEDUCTION_CHARGES` in the cancellation preview. Per Pratyush's confirmation in our partner sync, MMT couldn't split the deduction by addon type — the airline doesn't provide that breakdown. So we couldn't put 'meal_charge' as a separate refund column even if we wanted to. The right call was: rename the field to reflect the actual semantics ('this column is the total ancillary deduction'), keep the old `seat_charges` column as a placeholder for future per-addon split, label the UI as 'Seat/Meal charge' until MMT splits it. The alternative — adding a separate `meal_charge` column today and stuffing zero into it — would have been misleading."

### 4.4 Why we extended the MMT API with feature flags instead of a new endpoint

> "Pratyush's team had already designed the `ff` parameter for SEATS support. Adding `MEALS` and `MEAL_PREFERENCE` as comma-separated values was an additive change with no version-bump and no new endpoint. Per MMT, no latency cost for multi-flag queries. Building a new endpoint would have been more 'pure' but cost a partner-side coordination cycle for zero customer benefit. The right call was leverage the existing pattern."

### 4.5 Why `selectedMeal` is sector-keyed Map<sector, Array<meal_code>>

> "Same shape as `selectedSeat` for consistency. Each sector has its own meal selection because meals are flight-specific (the BLR-BOM leg has different meals than the BOM-DEL leg). Array of meal_codes (not a Set) because customers can pick the same meal twice for different passengers — count of meal X = number of occurrences of meal_code X in the array. Length cap at # passengers prevents over-selection."

### 4.6 The Redis-cache-on-reload optimization (and its risk)

> "When customer goes from seat selection to meal selection and reloads the meal page, Redux is wiped. We solve this by POST-ing selected seats to a Redis cache before navigating to meal screen, then GET on reload. The risk: API failure in the save call → mismatch between user's intent and backend state. Mitigation: client-side acks the save success before navigating. The alternative — showing a loader between screens — was Product-rejected as too clunky. So we accept the small data-inconsistency risk for the better UX."

### 4.7 Why we deprioritized "Add Meal on Order Review for base-fare customers"

**The setup.** Original spec called for a "Select Meal" CTA on the order review screen for base-fare customers — they'd skip meal selection initially and could add later.

**The product call.** Deprioritized for Phase 0.

**Reasoning.**
- Meal attach rate is ~10%. Customers who picked base fare are explicitly opting for no-frills.
- Adding the on-review CTA means architectural complexity (meal selection AFTER order is created — Approach-1 Cart vs Approach-3 Duplicate-Order conversation re-applies).
- Phase 0 conversion target was upgraded-fare customers (the ~10% who actually opt in for ancillaries).
- Deprioritizing freed engineering time for the higher-impact path.

**How to articulate it.**
> "I called it: meal attach is ~10%, base-fare customers are by definition no-frills, the engineering cost is real, and the Phase 0 conversion target is upgraded-fare. The on-review CTA is a Phase 1 candidate when we have data on actual conversion. Cut from scope, documented as deprioritized in the design doc, agreed with Product."

---

## 5. Three product decisions worth defending

### Decision 1 — Approach-1 (Cart) over the alternatives

Already covered in §4.1. Interviewer-ready: **"Cart was the only approach that handled future ancillaries with one new `addonType`. The other three each would have required architectural rework per new addon. Long-term thinking won."**

### Decision 2 — Deprioritizing "add meal on review for base-fare customers"

Already covered in §4.7. Interviewer-ready: **"Meal attach is ~10%, base-fare customers are no-frills, engineering cost is real. Cut from scope, Phase 1 candidate."**

### Decision 3 — `seat_charge` → `ancillary_charge` rename (with backward-compat)

Already covered in §4.3. Interviewer-ready: **"MMT can't split the deduction. Rename to reflect actual semantics, keep old column for future split, label UI accordingly. Calibrated honesty about partner constraints."**

---

## 6. Leadership stories (STAR format)

### Story 1 — Owning the four-approach trade-off comparison

**Situation.** The biggest open question on the design was where to store the meal selection between the meal-pick screen and the actual booking commit. Four approaches on the table; engineering folks had preferences but no consensus.

**Task.** Drive the design decision by trade-off comparison, not by debate.

**Action.**
1. Wrote up the four approaches in the design doc: Cart, Redis cache, Duplicate Orders, Modify Order. Each got a section: summary, design diagram, pros, cons, and an explicit "what does this cost us in 12 months when we add baggage?"
2. Built the comparison table (§4.1 above) — 9 dimensions × 4 approaches = 36 cells, each filled with High/Medium/Low and a short reasoning.
3. Took it to Boson Design Review (SIM BDR-12910) with my recommendation pre-stated. The conversation was about whether my reasoning held, not about which approach was best — that part was already on a table everyone could read.
4. Got sign-off on Approach-1 (Cart). Documented the decision.

**Result.** Phase 0 shipped on Approach-1. When baggage came up as a Phase 2 candidate, the implementation effort was estimated at "one new `addonType`" — exactly as predicted. The trade-off table got reused as the template for subsequent ancillary design decisions.

**Why this story works for FDSE + Product.**
- **FDSE signal:** evaluated alternatives systematically, picked the right abstraction for long-term scalability.
- **Product signal:** turned a debate into a decision artifact other teams could read in 5 minutes.

---

### Story 2 — Negotiating the MMT Addons API extension

**Situation.** MMT's Addons API was built for SEATS only — single feature flag, single response shape. To support meals, we needed MMT to extend the `ff` parameter to accept multiple flags and return combined seat + meal data.

**Task.** Get MMT to extend the API in a backward-compatible way without a partner-side latency regression.

**Action.**
1. Wrote a one-page proposal for the MMT counterpart (Pratyush's team): "Extend `ff` from single-flag to comma-separated multi-flag. Add `MEALS` and `MEAL_PREFERENCE` flag values. Return combined response. Backward-compat preserved (single-flag callers see no change)."
2. Validated the latency claim with MMT in the partner sync — confirmed no latency impact for multi-flag. Got it on email.
3. Proposed the response shape (§3 above) — `meals` section under each sector, with `meals[]`, `mealPreferences[]`, and `isMandatory` flag. MMT counter-proposed a simpler shape; we negotiated and landed on the version that supported the Skip-CTA rendering and the veg/non-veg/preference split.
4. Filed AMZMMTFL-1001 to track the API extension on MMT's side.
5. After MMT shipped the extension, integrated on our end.

**Result.** API extension shipped on schedule. Single-flag callers (older code paths) continued to work. New callers got the extended response. No partner-side breakage.

**Why this story works for FDSE + Product.**
- **FDSE signal:** negotiated a backward-compatible API extension instead of forking endpoints.
- **Product signal:** worked with the partner to extend the contract instead of working around it.

---

### Story 3 — The page-reload optimization debate (loader vs Redis cache)

**Situation.** Mid-implementation, customer testing revealed: customer goes seat → meal → reloads meal page → seat selection is gone (Redux is wiped). Two options: (a) show a loader between seat and meal screens while we save to backend, (b) async-save to Redis cache and accept the small data-inconsistency risk.

**Task.** Decide.

**Action.**
1. Talked to Product about the customer experience cost of each. Product rejected the loader approach: "Customers don't expect a loading screen between seat and meal selection — they expect immediate transition."
2. Designed the Redis-cache approach: POST `/ancillary/selections` async on transition out of seat select, GET on reload of meal screen.
3. Surfaced the risk explicitly in the design doc: "API failure during save → mismatch between user's intent and backend state. Mitigation: client-side acks save success before navigating away. Edge case where save fails silently → on next navigation we have stale state."
4. Took the trade-off to Boson Design Review with the recommendation. Got sign-off.
5. Implemented with metrics on save-failure rate.

**Result.** Reload preserved selection. Save-failure rate stayed below 0.1% in production. The pattern (async-save-to-cache-on-screen-transition) became the standard for subsequent multi-step flows on Flights.

**Why this story works for FDSE + Product.**
- **Product signal:** customer-experience trade-off, not engineering purity. Documented the risk explicitly.
- **FDSE signal:** added metrics on the failure mode so we'd know if the trade-off broke.

---

### Story 4 — Cancellation flow integration with the `seat_charge` → `ancillary_charge` rename

**Situation.** Cancellation flow had a `seat_charge` column in `flight_cancellations` that powered the refund breakup ("Seat charge — Non-refundable"). With meals added, this column needed to cover meal charges too. MMT's cancel preview only sent combined `ANCILLARY_DEDUCTION_CHARGES`, no per-addon split.

**Task.** Land the schema change and UI relabel without breaking existing cancellations.

**Action.**
1. Designed the schema change: rename `seat_charge` → `ancillary_charge` semantically; keep the old `seat_charges` column in the DB as a placeholder for future per-addon split.
2. Backward-compat plan: existing cancellations have non-zero `seat_charges` and zero `ancillary_charges`; new cancellations have zero `seat_charges` and non-zero `ancillary_charges`. Both old and new readers handle both columns.
3. Updated UI label to "Seat/Meal charge (Non-refundable)" — accurately describes the combined deduction.
4. Got Cancellation team sign-off on the rename. Coordinated the schema migration with their deploy.
5. Verified post-deploy on test cancellations: refund breakup math correct, label correct, audit trail intact.

**Result.** Schema change shipped with no backward-compat breaks. When MMT eventually supported per-addon refund split (Phase 2), we re-introduced the per-addon columns without touching `ancillary_charge`.

**Why this story works for FDSE + Product.**
- **FDSE signal:** schema change with backward-compat designed in (kept `seat_charges` column as future-state placeholder).
- **Product signal:** UI relabel that honestly described what the column was — not deceptive, accurately reflects partner-side reality.

---

### Story 5 — Designing the OD page meal display with the Frontend team

**Situation.** OD page needed to show meal-name + meal-status per traveller, similar to the existing seat display. Frontend team wanted a tabular per-passenger layout; backend already shipped the `meal` and `meal_status` fields per traveller in the OD response.

**Task.** Land the UI without forcing the Frontend team into a re-render of the entire OD page.

**Action.**
1. Sat with the Frontend lead. Walked through the existing OD response structure for travellers (`first_name`, `last_name`, `pnr_no`, `seat_no`, `seat_status`).
2. Confirmed the contract: I'd add `meal` (string, meal name) and `meal_status` (string, CONFIRMED/PENDING/FAILED) fields per traveller in the OD response. Same shape as seat — same client-side rendering pattern.
3. Frontend extended the existing `<TravellerDetails>` component to show the new fields conditionally (only if `meal` is non-empty). Existing rendering for non-meal bookings unchanged.
4. Verified in test: customers without meals saw no change; customers with meals saw the new field next to their seat info. Layout was tabular, consistent with the design system.

**Result.** OD page extended cleanly. No regression on non-meal bookings. Frontend rendering pattern reused for the eventual baggage and lounge ancillaries with no further backend coordination.

**Why this story works for FDSE + Product.**
- **FDSE signal:** picked the right contract shape (sibling field, not nested object) to minimize Frontend rework.
- **Product signal:** identified the customer-experience win — same UI pattern across seats, meals, and future ancillaries — and designed the contract to make that easy.

---

## 7. Likely interview questions + crisp answers

### 7.1 Architecture / system design

**Q: Walk me through what happens when a customer picks a meal.**
> "Customer is on the meal selection page (rendered only for upgraded-fare with meals available). Picks a meal. Frontend pushes the meal_code into Redux `ancillary.selectedMeal[sector]`. Length check vs # passengers; toaster on overflow. On 'Continue,' navigates to order review. Order Review API includes the `mealCharges` line item in `priceDetails.breakup`. On 'Proceed to Payment,' Init Booking is called — meals are sent to MMT Hold API as `addonType=MEALS` next to seats. On Hold success, persisted to `flight_addon` table as a separate row per (passenger, sector) with `type=MEALS`. OD response includes `meal` and `meal_status` fields per traveller; e-ticket and email include the meal name. End-to-end, the meal selection flows through 5 surfaces with one consistent contract."

**Q: Why is meal attached to `sector_passenger`, not just `sector` or just `passenger`?**
> "Meal is per-passenger per-sector. Different passengers can pick different meals on the same sector (one veg, one non-veg). Same passenger can pick different meals on different sectors (lighter on the short hop, full meal on the long one). The natural key is the join: `sector_passenger_id`. That's the same shape as the seat row, which is also per-passenger per-sector."

**Q: What's the failure mode if MMT's Hold API returns success but doesn't include the meal in `travelerAddons`?**
> "Means meal is sold out. Same failure mode as seat-sold-out today. We surface an error in the Frontend (similar messaging to seat-sold-out), let the customer either pick a different meal or proceed without it, and don't persist a meal row in the DB. The booking still succeeds; only the meal addon fails."

**Q: How would you redo this for 10x scale?**
> "Three changes I'd be ready to discuss. One — cache the meal-availability response for popular sectors with short TTL (ancillary data is stable for a session). Two — partition the `flight_addon` table by booking date for write throughput at scale. Three — async OD enrichment: instead of computing meal+seat fields on every OD read, denormalize them as a flattened JSON blob populated at booking time. None are needed at current volume."

### 7.2 Data / DB

**Q: Why is meal a separate row in `flight_addon` instead of a meal column on the booking?**
> "Same query patterns as seats. OD page joins on traveller → seat row + meal row. Cancellation references both rows for refund accounting. JSON-column-on-booking would force per-row JSON parsing on every read and would conflate seat-and-meal as one logical unit, which is wrong: they're independent. Row-per-addon is the natural model."

**Q: How big does `flight_addon` get?**
> "Bounded by booking volume × addon-attach-rate. Meal attach is targeted at ~10%, seat selection is higher. At Amazon Flights' booking volume, we're talking a few hundred thousand rows per day. RDS handles this comfortably with the existing indexing. We retain forever — audit trail."

**Q: Why keep the `seat_charges` column in the DB after renaming to `ancillary_charges`?**
> "Backward compat for existing rows + future per-addon refund split. Today, MMT can't split the deduction. When MMT eventually supports per-addon refund (Phase 2 candidate), we re-introduce the per-addon columns and keep `ancillary_charges` as the backward-compat total. The old `seat_charges` column is reserved for that future state."

### 7.3 Frontend

**Q: Why Redux for meal state instead of component state?**
> "Three reasons. One — the meal selection is shared across multiple screens (meal-select page, order review page, init booking). Component state would force prop-drilling. Two — Redux DevTools made debugging trivial during development. Three — the same Redux store shape is reused by seats, so the codebase has consistent state-management patterns across addons."

**Q: How do you handle the page reload on meal selection (where Redux is wiped)?**
> "Async save to Redis on transition out of seat select. POST `/ancillary/selections` with the selected seats. On reload of meal page, GET the same endpoint to rehydrate seat selection. Risk: save-failure means stale state. Mitigation: client-side acks save success before navigating, and we have metrics on save-failure rate (kept below 0.1% in production). The alternative — showing a loader between screens — was Product-rejected for UX reasons."

### 7.4 Behavioral / leadership

**Q: How did you decide on Approach-1 (Cart) over the alternatives?**
> "Wrote up all four approaches in the design doc with a 9-dimension comparison table. Cart won on Long-Term Thinking and Backward Compat — it was the only one that scaled to baggage/lounge/insurance with one new `addonType`. The other three would each require architectural rework per addon. Took the table to Boson Design Review with my recommendation pre-stated; the conversation was about whether my reasoning held, not which approach to pick. That table format became the template for subsequent ancillary decisions."

**Q: What was the hardest conversation?**
> "The on-review-CTA-for-base-fare deprioritization. Product wanted it; Engineering capacity was tight; conversion data wasn't yet available. I argued for cutting it: meal attach is ~10%, base-fare customers are no-frills, the engineering cost is real, and we'd have data after Phase 0 to revisit. Product agreed on the data-driven framing — measure first, then decide on Phase 1."

**Q: What would you do differently?**
> "Two. One — push harder for MMT to split the cancellation refund per addon at the partner side. We accepted the combined `ANCILLARY_DEDUCTION_CHARGES` because it was the path of least resistance, but the UI label 'Seat/Meal charge' is awkward. A clean per-addon refund would have made the customer experience tighter. Two — design the addon-attach analytics dashboard before launch, not after. We caught the meal attach rate after launch via DWH; building it pre-launch would have given us conversion data faster."

**Q: Why does this matter for UnifyApps?**
> "Because revenue-generating ancillary features are the work UnifyApps customers do. Add a new pricing tier. Add a new product type. Add a new payment method. Each one has the same shape: a partner-side API extension, a backend persistence schema change, a frontend UI extension, a cancellation/refund integration, and a deprioritization conversation. I've shipped this shape end-to-end. The Product judgment ('what to cut from scope and why') and the FDSE judgment ('which abstraction scales to future ancillaries') are the same primitives."

---

## 8. Amazon → UnifyApps mapping

| Amazon Flights Meal Selection context | UnifyApps FDSE / Product equivalent |
|---|---|
| MMT Addons API extension (multi-flag `ff` parameter) | UnifyApps customer's existing partner API extended for new feature |
| Cart Service extension (Approach-1) for ancillaries | Customer's existing data model extended for new product types — pick the abstraction that scales |
| Four-approach comparison with 9-dimension trade-off table | Customer-facing trade-off articulation — make decisions readable in 5 minutes |
| Phase 0 (upgraded fare only) → Phase 1 (base fare on review) | Sprint-by-sprint scope discipline |
| `seat_charge` → `ancillary_charge` rename (with backward-compat) | Schema evolution at customer with backward-compat — no Big Bang migrations |
| Redis cache for cross-screen state preservation | Customer-side caching for multi-step flows; trade-off visibility-vs-UX |
| Boson Design Review (BDR-12910) sign-off process | Customer architecture review process |
| MMT Jira (AMZMMTFL-1001) for partner-side tracking | Customer-side ticket tracking for partner-driven changes |
| Meal attach rate ~10% target | Customer's stated conversion / feature-attach target |
| Skip CTA visibility based on `isMandatory` | Customer-experience trade-off based on feature-availability data |

---

## 9. PM-rubric callouts

1. **Customer-pain quantification.** Meal attach rate target ~10% — articulated in the design doc as the headline ancillary metric.
2. **Trade-off articulation.** Four-approach comparison with 9 dimensions — made the architecture decision readable in 5 minutes.
3. **Phasing discipline.** Phase 0 (upgraded fare) → Phase 1 (base fare on review) — explicit, written, with measurable success criteria.
4. **Scope discipline.** Said no to "add meal on review for base-fare customers" with the math (~10% attach, no-frills segment, eng-cost real).
5. **Partner negotiation.** Drove MMT API extension (multi-flag `ff`) instead of waiting for a new endpoint or workaround.
6. **Schema evolution.** `seat_charge` → `ancillary_charge` rename with backward-compat preserved — no Big Bang.
7. **Cross-team coordination.** MMT, Backend, Frontend, Cart Service, Cancellation, OD enrichment, e-ticket, email — eight surfaces touched, all coordinated through the design doc.

---

## 10. Anti-patterns to avoid

1. **Don't lead with code.** Lead with the meal-attach business case (~10%), then the customer flow, then the architectural trade-off, then the implementation.
2. **Don't oversell scope.** I owned the meal-selection design end-to-end. The Cart Service extension was a coordinated change with the Cart team; UCF email/SMS was UCF; MMT API extension was MMT. I owned the integrations, not the internals of those teams.
3. **Don't say "we" when "I" is true.** I wrote the design doc. I made the Approach-1 call. I authored the trade-off table.
4. **Don't dismiss alternatives.** When defending Approach-1 (Cart), name Approach-3 (Duplicate-Order) as a real option, then say why it lost.
5. **Don't undersell the Product side.** Deprioritizing the base-fare on-review CTA is a Product decision. Cutting scope with the math is Product judgment.
6. **Don't volunteer DSA.** Use the deflection from the cheat sheet.

---

## 11. Pre-call checklist (run 30 minutes before the loop)

- [ ] Memorize the dual-role pitch in §0.
- [ ] Memorize the four-approach trade-off table (§4.1).
- [ ] Memorize the Approach-1 vs Approach-3 reasoning.
- [ ] Be ready to draw the §3 architecture diagram.
- [ ] Run through the 5 leadership stories in §6 out loud, ≤90 seconds each.
- [ ] Re-read §8 mapping and §9 PM-rubric callouts.
- [ ] If they ask DSA → deflect per `UNIFYAPPS_FDSE_INTERVIEW_CHEATSHEET.md` §8.

---

## 12. Post-call — update this doc

- The one question you wished you'd answered differently.
- The actual answer you'd give now.
- Anything they pushed on that you didn't anticipate.
