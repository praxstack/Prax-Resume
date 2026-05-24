# UnifyApps FDSE × Product — HFC Hotels Cancellation Flow: Long-Form Project Answers

> **Audience:** me (Prakhar), preparing the **Amazon HFC Hotels Cancellation Flow (end-to-end, backend + frontend)** as a flagship resume bullet for a UnifyApps Sr. FDSE / Product loop.
>
> **Why this project for FDSE × Product:** customer-facing transactional flow with money on the line, end-to-end ownership across frontend (Redux + SSR/CSR + Tuxedo design system) and backend (HFCHotelARestService + Checkout + OMS + RDS + payment refund pipeline), real CPT business case (Hotels Tickets Reduction PTG), explicit cross-team contracts (Hotels backend, Boson translations, Frontend, Checkout, OMS, Payments, Customer Service / Special Claims). Every demand of the UnifyApps "Product & FDSE Hiring" rubric maps onto this work — customer empathy, system design, partner integration, scope management, on-call posture.
>
> **Companion docs in this folder:**
> - `UNIFYAPPS_FDSE_FLIGHT_MODIFICATION_ANSWER_BANK.md`
> - `UNIFYAPPS_FDSE_FLIGHTS_PROJECT_ANSWERS.md`
> - `UNIFYAPPS_FDSE_INTERVIEW_CHEATSHEET.md` (take-home repo)
> - `UNIFYAPPS_FDSE_MOCK_INTERVIEW_PROMPT.md`
> - **This doc** + the other three project answer docs (Flights Offline Modifications, Flights Meal Selection, INSP One-Click Renewals).

---

## 0. The dual-role pitch (memorize verbatim)

> "I owned the Hotels Cancellation Flow at Amazon — the end-to-end customer-facing journey that lets a customer cancel a hotel booking, see the refund breakup, and trigger the actual refund through Amazon's payment pipeline. The product context: Hotels was a high-CPT category — every cancellation was a customer-pain moment with money on the line, and the legacy flow was inconsistent across surfaces (Order Details said one number, the email said another, the cancellation page said a third). I rebuilt it across the full stack: a `/hotels/cancellation/orderId` route powered by a Redux-driven React frontend with SSR for the first paint and CSR for the interactive cancellation step, a thin backend orchestrator on the Hotels Java service that called the partner cancellation API, computed the refund breakup deterministically, persisted the cancellation request to RDS, called OMS to mark the order cancelled, kicked off the refund pipeline, and updated the audit trail. The frontend was componentized — `<ItineraryDetails>`, `<FreeCancellationInfo>`, `<RefundDetails>`, `<CancellationPolicy>`, `<AlertStatusBox>` — so we could reuse the same components on the pre-booking cancellation policy view. End-to-end, a cancellation took ~3 seconds from click to refund-initiated, with a single audited number that matched across the cancellation page, OD, and the confirmation email. That's a Product call — 'one number across all surfaces' — landed by FDSE-level execution across six teams."

That paragraph is the answer to "walk me through your most impactful customer-facing project."

---

## 1. The 90-second extension (when they say "go deeper")

> "Hotels cancellation is harder than it looks because three things have to be in lockstep: (1) the partner CRS — for HFC that meant the hotel-aggregator partner who owned the actual inventory cancellation — (2) Amazon's checkout/OMS state-of-record, and (3) the refund pipeline that actually moves money back. If any of those drifts, the customer sees the wrong number and CPT explodes.
>
> I designed the flow as a four-contract problem. **Event contract:** the click on 'Cancel' on the OD page lands on `/hotels/cancellation/orderId` — that route is owned by Boson (the post-purchase platform) and the hand-off to my backend is the Cancellation API call. **Booking contract:** the partner CRS is the source of truth for whether the room is actually cancellable at the time of the click — free-cancellation window vs. partial penalty vs. fully non-refundable — so the page always re-fetches policy and refund computation server-side instead of trusting cached data. **Execution contract:** if the partner cancel succeeds, I write to OMS, mark the order cancelled, persist a row in `flights_cancellations`-equivalent for hotels, kick off Payments to refund. If the partner cancel fails, I show the `<AlertStatusBox>` failure variant with a 'Try again' CTA — the order stays as-is, no half-state. **Recovery contract:** if my backend crashes between partner-cancel-success and OMS-update, the audit trail flags the order as 'cancellation in flight' and the OMS reconciler picks it up.
>
> The thing I'm proudest of is the single-number invariant. Before this rebuild, OD, email, and the cancellation page each had their own breakup-rendering code path with subtle drift on Amazon's convenience fee handling. I unified the breakup computation in one server-side function — `computeRefundBreakup(order, partner_cancel_response)` — and every surface called the same function. Single source of truth for refund math, zero drift, and the surfaces that previously diverged became refactors of one common service."

---

## 2. Project facts (memorize the numbers)

| Fact | Number / Detail |
|---|---|
| **Business case** | Hotels Tickets Reduction PTG — high-CPT category, every cancellation was a customer-pain moment with money on the line; refund-discrepancy contacts were the dominant ticket type |
| **Cancellation entry point** | `/hotels/cancellation/orderId` route (Boson-owned, hand-off via Cancellation API) |
| **Frontend stack** | React + Redux + Tuxedo (Amazon's design system); SSR for first paint of itinerary + policy, CSR for the interactive cancel + refund step |
| **Backend stack** | Java on HFC Hotels services (`HFCHotelARestService`, `HFCHotelsWebService`, `HFCHotelsHorizonteService`); MySQL RDS for cancellations + breakups; Checkout DB for OMS state |
| **Key components** | `<Header>`, `<ItineraryDetails>`, `<FreeCancellationInfo>`, `<RefundDetails>`, `<CancellationPolicy>`, `<AlertStatusBox>`, `<Button>` |
| **End-to-end latency** | ~3 seconds (click → partner cancel → OMS update → refund initiated → success page) |
| **Single-number invariant** | One server-side `computeRefundBreakup()` function powers the cancellation page, OD, email, and refund summary |
| **Internal platform teams I aligned with** | Hotels backend (HFCHotelARestService owners), Boson (post-purchase platform + translations), Frontend (Tuxedo design system + Order Details surface), Checkout / OMS (order-state-of-record), Payments (refund pipeline), Customer Service (Special Claims escalation) |
| **What I owned (resume-safe)** | The full cancellation flow: frontend Redux + components + SSR/CSR split, backend orchestrator, RDS schema for hotel cancellations, OMS integration, refund-breakup computation, error handling + manual escalation |
| **NFRs locked** | Page load time as low as possible; localization of all strings; metrics + monitoring on every 4xx/5xx error |
| **Tech stack** | React + Redux, Tuxedo design tokens, Java (Spring/Coral on HFC), MySQL RDS, AWS (HFCHotelsWebServiceCDK, HFCCheckoutService, HFCCheckoutConsumerV2), CloudWatch for ops |

These numbers separate "I worked on the cancellation page" from "I owned the cancellation flow." Memorize them.

---

## 3. High-Level Design (architecture walkthrough — backend + frontend)

```
                          ┌─────────────────────────────────┐
                          │   Customer on Order Details      │
                          │   (post-booking experience)      │
                          │                                  │
                          │   Clicks "Cancel Booking" CTA   │
                          └──────────────┬───────────────────┘
                                         │
                                         ▼
              ┌─────────────────────────────────────────────────────────┐
              │   FRONTEND — React + Redux                              │
              │                                                         │
              │   Route: /hotels/cancellation/orderId                   │
              │                                                         │
              │   Page composition:                                     │
              │   ┌─────────────────────────────┐                      │
              │   │ <Header> "Cancellation"     │                      │
              │   ├─────────────────────────────┤                      │
              │   │ <ItineraryDetails>          │  ← server-rendered    │
              │   │  (hotel name, dates,        │     for first paint   │
              │   │   rooms, guests)            │                      │
              │   ├─────────────────────────────┤                      │
              │   │ <FreeCancellationInfo>      │                      │
              │   │  (free-cancel window text)  │                      │
              │   ├─────────────────────────────┤                      │
              │   │ <RefundDetails>             │  ← interactive — CSR  │
              │   │  Total Paid                 │     re-renders on     │
              │   │  Cancellation Charges       │     refund response   │
              │   │  Discount Deduction         │                      │
              │   │  Refund Amount              │                      │
              │   ├─────────────────────────────┤                      │
              │   │ <CancellationPolicy>        │  ← reused from        │
              │   │  (same component as         │     pre-booking       │
              │   │   pre-booking flow)         │                      │
              │   ├─────────────────────────────┤                      │
              │   │ <Button> "Cancel Booking"   │                      │
              │   └──────────────┬──────────────┘                      │
              │                  │ POST                                │
              │                  ▼                                     │
              │   ┌──────────────────────────────────────────┐         │
              │   │ Cancellation API call                    │         │
              │   │ POST /hotels/cancellation/{orderId}      │         │
              │   └──────────────────────────────────────────┘         │
              │                  │                                     │
              │   Response handled in <AlertStatusBox>:                │
              │   • Success → success state + redirect to OD           │
              │   • Failure → failure state + "Try again" CTA          │
              └──────────────────┼──────────────────────────────────────┘
                                 │
                                 ▼
              ┌──────────────────────────────────────────────┐
              │  BACKEND — HFCHotelARestService (Java)        │
              │                                               │
              │  cancellationController.cancel(orderId):      │
              │    1. Validate order belongs to user          │
              │    2. Idempotency check (in-flight cancel?)   │
              │    3. Fetch order from Checkout DB / OMS      │
              │    4. Fetch latest cancellation policy from   │
              │       partner CRS (NOT cached — must be       │
              │       authoritative at click time)            │
              │    5. computeRefundBreakup(order, policy)     │  ◀── single source
              │       returns deterministic { breakup,        │     of truth for the
              │                              refundAmount }   │     refund math
              │    6. Call partner Cancel API                 │
              │    7. On partner success:                     │
              │       a. Persist cancellation row to RDS      │
              │          (hotel_cancellations,                │
              │           cancellation_breakups)              │
              │       b. Audit log: "cancellation_initiated"  │
              │       c. Call OMS:                            │
              │          /oms/internal/v1/order/update/{}     │
              │          status = ORDER_CANCELLED             │
              │       d. Trigger Payments refund pipeline    │
              │          (async, idempotent on cancellation_id)│
              │       e. Trigger UCF email + SMS              │
              │          (best-effort, separate SLA)          │
              │       f. Return 200 with breakup + ETA        │
              │    8. On partner failure:                     │
              │       a. Audit log: "cancellation_failed"     │
              │       b. Return 4xx with error code           │
              │       c. Order state unchanged                │
              └────────────────────┬──────────────────────────┘
                                   │
        ┌──────────────────────────┼──────────────────────────────┐
        │                          │                              │
        ▼                          ▼                              ▼
  ┌──────────┐         ┌─────────────────────┐         ┌──────────────────┐
  │ MySQL    │         │ Partner Hotel CRS   │         │ Checkout / OMS   │
  │ RDS      │         │                     │         │                  │
  │          │         │ - Authoritative for │         │ - State-of-record│
  │ • hotel_ │         │   cancellation      │         │   for the order  │
  │   cancel │         │   policy at click   │         │                  │
  │   lations│         │   time              │         │ • order_         │
  │ • cancel-│         │ - Returns          │         │   attributes     │
  │   lation_│         │   computed         │         │   (attributeId   │
  │   breakup│         │   penalty +        │         │   = offline      │
  │ • audit_ │         │   refund amount    │         │   modification)  │
  │   log    │         └─────────────────────┘         │ • Triggers OTS   │
  └──────────┘                                          │   event for YO   │
                                                       └──────────────────┘
                                   │
                                   ▼
              ┌──────────────────────────────────────────────┐
              │  Downstream consumers I owned the contract   │
              │  with:                                        │
              │                                               │
              │   • OMS / Checkout DB → drives YO update     │
              │   • Boson translations → strings on OD/YO    │
              │     "Booking cancelled. Refund will appear   │
              │     in your original payment method by ..."  │
              │   • Frontend OD page → status pill changes    │
              │     to "Cancelled" + refund-status banner    │
              │   • UCF (User Communication Framework) →     │
              │     email + SMS confirmation                  │
              │   • Payments refund pipeline (async,         │
              │     idempotent on cancellation_id)            │
              │   • Customer Service / Special Claims →      │
              │     escalation queue for failed partner      │
              │     cancels (manual handling)                │
              └──────────────────────────────────────────────┘
```

### Key invariants (drill these in)

1. **Single-number invariant.** Refund-breakup math runs ONCE on the server in `computeRefundBreakup()`. The cancellation page, OD page, email, SMS, and refund summary all consume the same number. Zero drift across surfaces.
2. **Authoritative-at-click-time policy.** Cancellation policy is NOT cached. We re-fetch from the partner CRS on every cancellation page load because cancellation windows shift in real time (free-cancel cutoff is by-the-minute for some properties).
3. **Atomic cross-system handoff.** Partner cancel → RDS persist → OMS update → Payments trigger. If any link breaks, the audit log shows exactly where, and the OMS reconciler retries the failed link without re-cancelling at the partner.
4. **Idempotent refund.** Payments pipeline is idempotent on `cancellation_id`. Re-trigger on retry produces zero duplicate refunds.
5. **Fail-fast UI.** If the partner Cancel API returns 4xx (e.g., already-cancelled, past-cancellation-window, room-already-checked-in), the user sees `<AlertStatusBox>` with a precise message, the order state on Amazon stays as-is, and a "Try again" CTA preserves the user's place. NEVER half-state.
6. **SSR for first paint, CSR for the interactive step.** Itinerary + policy render server-side so the page is readable in <200ms on a slow connection. The cancel action is CSR — we want the loading state and the success/failure transition rendered without a page reload.
7. **Component reuse for `<CancellationPolicy>`.** Same component that powers the pre-booking policy disclosure powers the cancellation-confirmation policy view. One component, two surfaces. If the policy text changes once (and it does — translations, regulatory updates), it changes everywhere.

---

## 4. Low-Level Design (decisions worth defending)

### 4.1 Why SSR for first paint + CSR for the interactive step (not pure SSR or pure CSR)

> "Three reasons. One — first-paint speed. Cancellation pages are read more than they're acted on; many users come to confirm 'is this booking still cancellable for free?' and leave. SSR gets the itinerary, policy, and refund preview on screen in <200ms, even on slow Indian mobile networks. Two — interactivity quality. The cancel action is single-shot but the response is rich (success animation, refund-ETA banner, redirect on success, error variant on failure). Doing that as a server-side redirect is jarring. CSR + Redux for the action handler gives us a controlled UI transition. Three — reuse with the OD page. OD is already CSR-heavy because of its post-purchase widgets. Sharing Redux store shape and component tree means the cancellation page reuses OD's components for free."

### 4.2 Why componentize so aggressively (`<ItineraryDetails>`, `<FreeCancellationInfo>`, `<RefundDetails>`, `<CancellationPolicy>`, `<AlertStatusBox>`)

> "The cancellation flow shares 80% of its visual surface with the pre-booking review flow and the OD post-booking flow. Componentizing each visual unit means policy text changes once, status-box behavior changes once, refund-breakup rendering changes once. Anti-pattern would be to write a monolithic `<CancellationPage>` and re-implement what already lives in pre-booking. The way I scoped components: each one has a single Redux selector or prop input, single rendering responsibility, and zero cross-talk. `<RefundDetails>` doesn't know whether it's on cancellation page or OD; it just renders the breakup it's handed."

### 4.3 Why re-fetch cancellation policy on every page load (no cache)

> "Cancellation policy is time-sensitive. A booking that's free-cancellable at 11:59pm becomes 50%-charge-cancellable at 12:00am. If we cached policy on the listing or hotel-detail page and used the cached value on the cancellation page, we'd show the user 'free cancellation' and then either silently charge them or show an error after they click cancel. Both are CPT-amplifying. The right call is to re-fetch from the partner CRS on every cancellation page load, accept the 200–400ms latency hit, and surface the authoritative policy before the user makes the decision."

### 4.4 Why `computeRefundBreakup()` is a single server-side function (not duplicated per surface)

> "Before the rebuild, the OD page, the cancellation page, and the email each had their own breakup-rendering logic. They drifted on Amazon's convenience fee handling — OD subtracted it differently from email's calculation. CPT was full of 'why does my email say one number and the page say another?' tickets. I unified the math in one server-side function. The cancellation page calls it. OD calls it. The email template includes its output verbatim. SMS gets the same number from the same source. Zero drift, single audit trail, single place to change the rules. This is the kind of thing a Product owner would call a customer-trust call; it's also a good FDSE call because it kills a class of bugs."

### 4.5 Why `<AlertStatusBox>` is shared across success and failure states (not two components)

> "Same surface, different content. Both states have a status icon, an API message, a primary CTA. Building two components would mean two style updates every time Tuxedo design tokens shift (and Tuxedo had a refresh during the project). One component with `success | failure` props means one place to change. The cost is a slightly larger component prop surface; the benefit is design consistency across cancellation and other transactional flows that adopted the same component."

### 4.6 Why the Payments refund pipeline is async (not in the cancellation API response)

> "Two reasons. One — refund pipeline depends on the original payment method. UPI refunds are near-instant; credit cards take 3–5 business days. Wallets are sub-second. Blocking the cancellation API response on refund completion would make the user wait 5 seconds for nothing meaningful. Two — refund pipeline failures are recoverable separately. If Payments is having a bad day, the cancellation should still succeed; the refund just gets retried by the Payments reconciler. So the cancellation API persists the cancellation, fires-and-forgets the Payments trigger, and returns the ETA to the user. The success page says 'Refund of ₹X will appear in your original payment method by [date]' — that ETA comes from the Payments contract for that payment method, not from a real-time refund-completion status."

### 4.7 RDS schema for hotel cancellations

```sql
CREATE TABLE hotel_cancellations (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id VARCHAR(64) NOT NULL UNIQUE,        -- Amazon order id
    extension_id BIGINT NOT NULL,                 -- FK → order_extension
    partner_booking_id VARCHAR(128),              -- partner's booking id
    cancellation_request_id VARCHAR(64) UNIQUE,   -- our internal id (idempotency key for refund)
    cancellation_charge_inr INT,                  -- penalty in paise
    refund_amount_inr INT,                        -- refund amount in paise
    convenience_fee_deducted INT,
    discount_deducted INT,
    status VARCHAR(32) NOT NULL,                  -- INITIATED / PARTNER_CANCELLED / OMS_UPDATED / REFUND_INITIATED / COMPLETED / FAILED
    failure_reason VARCHAR(256),
    initiated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    INDEX idx_status (status),
    INDEX idx_extension_id (extension_id)
);

CREATE TABLE hotel_cancellation_breakups (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    cancellation_id BIGINT NOT NULL,
    line_item_type VARCHAR(64) NOT NULL,          -- TOTAL_PAID / CANCELLATION_CHARGE / DISCOUNT_DEDUCTION / REFUND_AMOUNT / CONVENIENCE_FEE
    amount_inr INT,
    label_text VARCHAR(128),                      -- localizable string id reference
    FOREIGN KEY (cancellation_id) REFERENCES hotel_cancellations(id)
);
```

**Two design choices to defend:**

1. **`status` is a state machine column** — `INITIATED → PARTNER_CANCELLED → OMS_UPDATED → REFUND_INITIATED → COMPLETED`, or `→ FAILED` at any step. The reconciler reads `status` to decide which step to retry. Append-only `failure_reason` for ops debugging.
2. **`cancellation_charge_inr` and `refund_amount_inr` are stored in paise (integer)**, NOT in float rupees. Floating-point money math is a CPT generator. Server-side `computeRefundBreakup()` does all integer arithmetic.

---

## 5. Three product decisions worth defending

### Decision 1 — One server-side `computeRefundBreakup()` shared across every surface

**The setup.** Pre-rebuild, OD, cancellation page, email, and SMS each computed the breakup independently. Drift on convenience-fee handling caused customer "your numbers don't match" tickets — high CPT, low engineering glamour, expensive in trust.

**The product call I made.** Centralize the breakup math in one server-side function. Refactor every consuming surface to call it. Accept ~6 weeks of refactor cost across four surfaces and three teams.

**Reasoning.**
- The cost of "one more month" was zero customer-pain; the cost of "one more drift bug" was 100s of CPT contacts per week.
- Centralizing now meant the next breakup-rule change (e.g., GST rule changes, new Amazon-side discount logic) was a one-line change instead of four.
- Forced a useful conversation across teams: "what is THE definition of refund for a hotel cancellation?" That conversation was overdue.

**How to articulate it.**
> "I made the trade-off explicit: 6 engineering-weeks now for a permanent class of bugs killed forever. The Product framing was 'one number across every surface'; the FDSE framing was 'kill the duplicate code paths'. Same call, two languages."

### Decision 2 — Re-fetch policy on every cancellation page load (no cache)

Already covered in §4.3. Interviewer-ready: **"Cancellation policy is time-sensitive. The 200–400ms latency cost of re-fetching is dwarfed by the CPT cost of telling the user one thing and charging them another. Authoritative at click-time, always."**

### Decision 3 — Component reuse with `<CancellationPolicy>` between pre-booking and post-booking

Already covered in §4.2. Interviewer-ready: **"The same policy text rendered on the listing-page review surface, the order-review page, and the cancellation page. Three places, one component, one Redux selector. Policy text changes once, it changes everywhere — including translations."**

---

## 6. Leadership stories (STAR format, full ownership claimed)

### Story 1 — Owning the four-team rollout (Hotels backend, Boson, Frontend, Payments)

**Situation.** The cancellation flow rebuild touched four teams — Hotels backend (where I worked), Boson translations (for the strings that powered OD/YO post-cancellation), Frontend (the Tuxedo design system + the OD widget that needed to consume the new cancellation status), and Payments (the refund pipeline that had its own deploy cadence).

**Task.** Land the rebuild without holding up any of the four teams' independent roadmaps.

**Action.**
1. Wrote a one-page integration contract for each team's surface: "Here's what you'll receive from us, here's the timeline, here's the error budget, here's the rollback plan."
2. Set up a single weekly 30-minute sync across all four teams. Same time, same day, every week. Running notes in a shared doc. Status emoji per dependency.
3. Sequenced the work: Boson translations had the longest lead time (translation review process), so I shipped the string IDs first. Then the Payments refund-pipeline integration. Then Frontend. Then the cancellation page rollout last — by then everything it depended on was already in production.
4. Built a feature flag for the new flow so we could A/B test the refund-breakup display before fully rolling out.

**Result.** No team was blocked on me, and I wasn't blocked on any of them. Phase 0 of the rebuild shipped on schedule. The single-number invariant was tested in shadow mode for two weeks before flipping the flag — zero discrepancy reports post-launch.

**Why this story works for FDSE + Product.**
- **FDSE signal:** explicit cross-team contract, sequencing by lead time, feature-flag de-risking.
- **Product signal:** owned the coordination problem instead of waiting; turned a 4-team rollout into a single weekly meeting that everyone could read in 30 seconds.

---

### Story 2 — Saying no to "merge cancellation with pre-booking review"

**Situation.** Mid-rebuild, the Frontend team proposed merging the cancellation page with the pre-booking review page into a single "policy + breakup viewer" component. The argument: 80% of the components are shared anyway, and a unified surface would reduce maintenance.

**Task.** Decide whether to expand scope (merge both flows) or hold the line on cancellation rebuild only.

**Action.**
1. Listed the actual shared surface: 4 components (`<CancellationPolicy>`, `<RefundDetails>`, `<ItineraryDetails>`, `<AlertStatusBox>`) out of 8 on the cancellation page. The other 4 had cancellation-specific behavior that wouldn't generalize.
2. Listed the divergent behavior: pre-booking review has fare upsells, dynamic policy ("if you book now, free cancel until..."), and inventory holds. Cancellation has refund computation, partner cancel call, and OMS state change. Merging means a god component with two divergent behavior trees.
3. Took it to the Frontend lead. Framed it as: "Sharing the 4 components is correct and we already do that. Merging the wrappers means coupling two divergent flows that change for different reasons. That's the wrong abstraction." Used a one-page diagram to show why.
4. Got the call: keep them separate, share the components only.

**Result.** Cancellation rebuild stayed scoped. Pre-booking review got the same component refactor on its own timeline three months later when its team had capacity, with no cancellation-page coupling to worry about.

**Why this story works for FDSE + Product.**
- **FDSE signal:** picked the right abstraction — share components, not wrappers.
- **Product signal:** said no to scope merge with the math, with a one-pager other people could read.

---

### Story 3 — A 4xx that wasn't a 4xx (the partner-already-cancelled edge case)

**Situation.** Two weeks into the rollout, alarms fired for "cancellation API 4xx rate spiking." Investigation showed: the partner CRS was returning 4xx with reason "ALREADY_CANCELLED" for ~5% of requests.

**Task.** Triage the alert, decide whether to roll back or fix forward.

**Action.**
1. Pulled the dashboard. The 4xx rate was spiking, but customer impact was zero — the customers were seeing `<AlertStatusBox>` with the partner's error message, and on retry the second cancel succeeded (because the first one had actually gone through, the partner just hadn't returned 200).
2. Talked to the partner support team. Confirmed: the partner's cancel API had a known race condition where the cancel succeeded but the response was sometimes 4xx if the booking was double-tapped within ~500ms.
3. Did NOT roll back. Customer impact was zero.
4. Fix forward: added a "reconcile if 4xx with `ALREADY_CANCELLED`" path. On 4xx-already-cancelled, we'd query the partner for the booking's current status, and if it was indeed cancelled, treat it as a successful cancel from our side, persist the row, fire OMS, fire refund. Net effect: customer sees one success transition instead of "fail then retry → succeed."
4. Wrote the COE. Closed the incident in 36 hours.

**Result.** 4xx alarm rate dropped to baseline. Customer-experience improved (no more retry-needed flow). Partner support got a written test case from us they could repro on their side.

**Why this story works for FDSE + Product.**
- **FDSE signal:** triaged by impact, fixed forward with a reconcile path, didn't panic-rollback.
- **Product signal:** turned a partner-side bug into a UX improvement on our side without waiting for the partner to fix theirs.

---

### Story 4 — Negotiating the refund-ETA contract with Payments

**Situation.** The cancellation success page said "Refund of ₹X will appear in your original payment method by [date]." The "[date]" came from Payments. Pre-rebuild, the date was sometimes wrong — Payments would tell us "5 business days" but for a UPI refund the actual ETA was sub-second. Customers got false expectations both ways (over-promised and under-promised).

**Task.** Get a precise refund-ETA-by-payment-method contract from Payments.

**Action.**
1. Met with the Payments team. Asked for a single source of truth: "What's the canonical ETA for a refund of payment method X?"
2. Got a payment-method-keyed ETA table from them: UPI = 0–4 hours; Wallet = sub-second; Credit Card = 3–5 business days; Net Banking = 1–2 business days.
3. Wrote the contract in our design doc: "Cancellation API response includes refund_eta_text computed by Payments-owned function `getRefundEtaText(payment_method)`. We render verbatim. We don't second-guess."
4. Added a metric on "user-reported refund delay vs. Payments-stated ETA" so we'd know if the table drifted.

**Result.** Refund-ETA accuracy improved measurably. Customer Service contacts about "where's my refund" dropped because the ETA was now accurate. Payments owned the function; we owned the rendering.

**Why this story works for FDSE + Product.**
- **FDSE signal:** explicit contract, single source of truth, metrics to detect drift.
- **Product signal:** customer-experience-driven trade-off (don't over-promise, don't under-promise).

---

### Story 5 — On-call: the Tuxedo design-token migration that broke the success page

**Situation.** Tuxedo (Amazon's design system) shipped a major version bump that changed token names. My `<AlertStatusBox>` component referenced an old token name. Late on a Friday, alarms fired for "cancellation page render rate dropping."

**Task.** Triage, fix, decide rollback vs. fix-forward.

**Action.**
1. Pulled up the page in a fresh browser. The success state was rendering as a blank box — the new Tuxedo version had renamed the success-status token, and my component was referencing the old name. Failure state rendered fine.
2. Customer impact: visible. People who successfully cancelled saw a blank success area instead of the confirmation. They thought the cancel had failed.
3. Decided: hot-fix forward, not rollback. Rollback meant rolling back Tuxedo across the org, which was a multi-team coordination problem we couldn't do in 30 minutes.
4. Pushed a hot-fix that referenced the new token name, plus a shim for the old name in case anything else relied on it. Deployed via emergency change.
5. Wrote the COE. Added a Tuxedo-version check to the CI that would catch token renames at PR time, not at deploy time.

**Result.** Hot-fix deployed in ~45 minutes. Cancellation page rendered correctly. The CI check caught two more token-rename bugs in the next month before they hit production.

**Why this story works for FDSE + Product.**
- **FDSE signal:** calm in incident, picked the right rollback level, turned the incident into a permanent CI improvement.
- **Product signal:** prioritized fix-forward because customer-experience was visible and rollback was a bigger blast radius.

---

### Story 6 — Owning the BRD and the cross-team alignment

**Situation.** The cancellation rebuild was identified as a CPT line item but had no design — just a "we should fix this" on the Hotels Tickets Reduction PTG.

**Task.** Convert it from "we should fix this" to a shipped design with cross-team commitment.

**Action.**
1. Wrote the BRD myself. Sections: customer pain quantification (refund-discrepancy CPT contacts per week), tenets (single number across surfaces, authoritative-at-click-time policy, fail-fast UI), Phase 0 scope (the rebuild), success criteria (zero refund-discrepancy reports, ≥99.9% success rate, ≤3s end-to-end).
2. Ran the design review with Hotels backend, Boson, Frontend, Checkout / OMS, Payments, and Customer Service. One meeting, all stakeholders. Pre-drafted each team's contract in the BRD so the meeting was about adjustments, not introductions.
3. Captured every objection in real time. Boson wanted clarity on string-ID naming. Payments wanted the refund-ETA contract pinned. Frontend wanted the design tokens listed. Customer Service wanted the manual-escalation queue spec'd.
4. Sent the BRD for written sign-off within 48 hours. Got VP-level sign-off, locked the timeline.

**Result.** Phase 0 had explicit cross-team commitment in writing before any code was written. When ambiguities surfaced during rollout, I had a document to point to. The same BRD became the template for the next cancellation flow rebuild on the Trains category six months later.

**Why this story works for FDSE + Product.**
- **Product signal:** owned the problem framing, the customer-pain quantification, the trade-off articulation, the cross-team contract negotiation.
- **FDSE signal:** the BRD wasn't a PM-only doc — it had RDS schemas, refund-pipeline contract, design-token references, error-handling matrix.

---

## 7. Likely interview questions + crisp answers

### 7.1 Architecture / system design

**Q: Walk me through what happens when a customer clicks "Cancel Booking."**
> "Click lands on `/hotels/cancellation/orderId`, owned by Boson. Page is SSR for the first paint — itinerary, policy, refund preview render in <200ms. The cancel button is CSR — Redux dispatches an action, calls `POST /hotels/cancellation/{orderId}` on my backend. Backend validates ownership, idempotency-checks for in-flight cancels, fetches the order from Checkout/OMS, re-fetches authoritative policy from the partner CRS, runs `computeRefundBreakup()`, calls partner Cancel API, persists to RDS, calls OMS to mark order cancelled, fires Payments refund pipeline (async, idempotent on cancellation_id), fires UCF for email + SMS, returns 200 with the breakup and refund ETA. Frontend transitions `<AlertStatusBox>` to success state, redirects to OD after 3 seconds. End-to-end: ~3 seconds."

**Q: Why not put the cancel into a queue and process async?**
> "Three reasons. One — customers expect immediate confirmation that the cancel succeeded. Async + 'we'll email you when it's done' is worse UX. Two — refund computation is deterministic and fast, no reason to defer it. Three — the partner Cancel API is the slow link, and queuing wouldn't make it faster. Where I do go async: the Payments refund pipeline (refund completion is minutes-to-days depending on payment method) and UCF notifications (best-effort, separate SLA). The cancellation API itself is sync end-to-end."

**Q: What's the rollback strategy if a deploy is broken?**
> "Three layers. One — feature flag on the new flow vs. the legacy flow; flip the flag to fall back to legacy. Two — the cancellation API is independent of the rest of the Hotels service, so its deploy is independently rollback-able. Three — even mid-cancellation crashes are recoverable: the audit log shows where the flow stopped, and the OMS reconciler retries the next step (RDS → OMS → Payments) without re-cancelling at the partner. Worst case: partial state in our DB but consistent with the partner's actual state."

**Q: Where are the cross-team contracts?**
> "Six. One: Hotels backend ↔ partner CRS — the Cancel API and the cancellation-policy fetch. Two: us ↔ Checkout / OMS — the order-status update plus the OTS event. Three: us ↔ Boson translations — string IDs for OD and email. Four: us ↔ Frontend — the Cancellation API request/response shape and the `<AlertStatusBox>` props. Five: us ↔ Payments — the refund-pipeline trigger plus the refund-ETA function. Six: us ↔ Customer Service — the manual-escalation queue for failed partner cancels. Each is documented and has a named owner."

### 7.2 Data / DB

**Q: Why store amounts in paise (integer) instead of rupees (float)?**
> "Floating-point math on money is a CPT generator. ₹0.30 + ₹0.30 ≠ ₹0.60 in float. We do all arithmetic in paise (integer), display in rupees. One bug class killed permanently."

**Q: Why is `cancellation_request_id` separate from the auto-increment `id`?**
> "Auto-increment id is an internal pointer. `cancellation_request_id` is the idempotency key that flows downstream to Payments. Payments dedupes on this id, so retries are safe. Separating them means I can change the internal id structure without breaking the external contract."

**Q: How big does this table get?**
> "Bounded by hotel-booking volume × cancellation rate (typically 5–15%). Comfortably small for RDS. We retain forever — this is the audit log."

### 7.3 Frontend

**Q: Why Redux instead of plain React state?**
> "Three reasons. One — the cancellation page shares state with the OD page (the order data is already in the OD Redux store; we hydrate the cancellation page from it). Two — the `<AlertStatusBox>` state transitions are driven by API responses, and Redux's middleware makes that testable. Three — Redux DevTools are how Frontend debugged state issues during the rollout. Without Redux, every state change would be inside a component, and we'd be debugging via console.log."

**Q: Why SSR for the first paint?**
> "Cancellation pages are read more than they're acted on. Many users come to confirm 'is this still cancellable for free?' and never click cancel. Getting the itinerary + policy + refund preview on screen in <200ms (vs. 1–2s for CSR with a backend round-trip) is the difference between 'this works' and 'this is broken.' SSR is the right call for the read-heavy first paint."

**Q: How do you handle localization?**
> "Every customer-facing string is a stringId resolved by Boson translations. The component receives the stringId as a prop, renders via the translation library. Pre-rebuild we had hard-coded strings; post-rebuild every string is locale-aware. The `<CancellationPolicy>` component, for instance, has zero hard-coded copy."

### 7.4 Behavioral / leadership

**Q: How did you decide who owned what across teams?**
> "Drew the contract diagram before code. Each box: a team. Each arrow: an API or schema. For each arrow: owning team, failure modes, SLA, escalation. That diagram lived in the BRD. When ambiguity came up later, we referenced the diagram. Half of leading a 4-team rollout is making contracts visible enough that ownership stops being negotiable."

**Q: What's the hardest conversation?**
> "The Tuxedo design-token incident in Story 5 was technically the hardest moment, but the hardest *conversation* was Story 4 — pinning Payments to a per-payment-method refund ETA contract. They had reasons (real ones) for the existing 5-day default. I had reasons (CPT data) for needing precision. Took three meetings to land. The thing that worked was bringing the customer-pain numbers, not just the engineering ask."

**Q: What would you do differently?**
> "Two. One — soak-test the refund-pipeline integration longer before the rollout. We caught most issues with the feature flag, but two edge cases (Wallet refunds + a specific Net Banking variant) only showed up after launch. Two — write the Tuxedo CI check before the rebuild, not after the incident. Hindsight is cheap; it would have caught the token-rename issue in Story 5."

**Q: Why does this experience matter for UnifyApps?**
> "Because customer-facing transactional flows with money on the line are the work UnifyApps customers do every day. Salesforce-driven refund flows. ServiceNow-driven cancellations. SAP-driven order modifications. Every one has the same shape: a UI surface, a backend orchestrator, partner system as source of truth, internal SOR, async downstream pipelines, audit log, manual escalation. I've shipped this shape end-to-end. The product judgment ('one number across surfaces') and the FDSE judgment ('idempotent + state machine + reconciler') are the same primitives I'd bring to a UnifyApps customer engagement."

---

## 8. Amazon → UnifyApps mapping

| Amazon HFC Hotels Cancellation context | UnifyApps FDSE / Product equivalent |
|---|---|
| Hotel partner CRS = source of truth for cancellation policy | Customer's external partner SOR (e.g., a CRS, a payment processor, a logistics partner) |
| Refund pipeline async + idempotent on cancellation_id | Any async customer-facing pipeline (refunds, fulfillment, notifications) with idempotent re-trigger |
| `computeRefundBreakup()` single source of truth | UnifyApps customer's "single number" rule — same total across emails, dashboards, customer apps |
| Tuxedo design tokens | UnifyApps customer's existing design system / component library |
| Boson translations + string IDs | UnifyApps platform-driven UI strings consumed by customer-facing apps |
| OMS attribute reuse pattern | Reusing existing customer-system slots instead of forcing schema migrations |
| 4-team weekly sync | The "single weekly meeting" cadence that keeps a customer engagement on rails |
| BRD with VP-level sign-off | Customer-facing one-pagers + kickoff decks that lock scope and timeline |
| Hotels Tickets Reduction PTG | Customer's stated business outcome (NPS, ticket volume, time-to-revenue) |

---

## 9. PM-rubric callouts (in case you're being evaluated as Product)

1. **Customer-pain quantification.** Surfaced the refund-discrepancy CPT thesis from internal data, wrote the BRD, got VP-level sign-off.
2. **Single-number invariant.** A Product call ("one number across every surface") that I executed across four teams.
3. **Authoritative-at-click-time policy.** Customer-experience-driven trade-off (200–400ms latency cost to avoid CPT explosion).
4. **Component reuse strategy.** Pre-booking and post-booking share components, NOT wrappers — right abstraction for the right reason.
5. **Refund-ETA accuracy.** Negotiated Payments contract: per-payment-method ETA, written contract, drift metrics.
6. **Manual-escalation queue.** Failed partner cancels route to Customer Service / Special Claims with full audit context — system never silently corrupts a booking.
7. **Outcome ownership.** Phase 0 success criteria measurable (zero refund-discrepancy reports, ≥99.9% success rate, ≤3s end-to-end). All tracked on a CloudWatch dashboard before launch.

---

## 10. Anti-patterns to avoid

1. **Don't lead with code.** Lead with customer pain, then the surface map, then the four-contract problem, then the implementation.
2. **Don't say "we" when "I" is true.** I owned this end-to-end. Tell it that way.
3. **Don't oversell the scope.** Refund-pipeline implementation was Payments. UCF notification was UCF. I owned the integration with each, not their internals. Calibrated honesty about scope.
4. **Don't use untranslated jargon.** "Tuxedo," "Boson," "OMS," "OD," "YO," "OTS" — translate each one in 5 words the first time.
5. **Don't dismiss alternatives.** When defending SSR-first-paint + CSR-action, name CSR-only and SSR-only as real options, then say why each lost.
6. **Don't undersell the product side.** UnifyApps is a "Product & FDSE Hiring" loop. The single-number invariant, the cross-team BRD, the refund-ETA negotiation — these are Product wins. Lead with them when the rubric tilts that way.

---

## 11. Pre-call checklist (run 30 minutes before the loop)

- [ ] Memorize the dual-role pitch in §0.
- [ ] Memorize the four-contract framing (event / booking / execution / recovery).
- [ ] Memorize the single-number invariant story.
- [ ] Be ready to draw the §3 architecture diagram.
- [ ] Run through the 6 leadership stories in §6 out loud, ≤90 seconds each.
- [ ] Re-read §8 mapping and §9 PM-rubric callouts.
- [ ] If they ask DSA → deflect per `UNIFYAPPS_FDSE_INTERVIEW_CHEATSHEET.md` §8.

---

## 12. Post-call — update this doc

After each loop:
- The one question you wished you'd answered differently.
- The actual answer you'd give now.
- Anything they pushed on that you didn't anticipate.
- Anywhere you under-claimed when full ownership was true.
