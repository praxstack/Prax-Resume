# UnifyApps FDSE × Product — HFC Flights Offline Modifications: Long-Form Project Answers

> **Audience:** me (Prakhar), preparing the **Amazon HFC Flight Service Offline Modifications / CPT Reduction** project for a UnifyApps Sr. FDSE / Product loop.
>
> **Source basis:** This doc is grounded in two partner-facing artifacts I authored / co-owned:
> - `Interview-Prep/AllProjectAndOtherFiles/MMT_Webhook_Info.pdf` — MMT's own write-up of the schedule-change webhook contract, the event taxonomy, and the modification parsing rules.
> - `Interview-Prep/AllProjectAndOtherFiles/MMT-AMZ Discussion Summary for Flights CPT.pdf` — my own October-2024 partner-meeting summary doc capturing MoMs with Pratyush, Gururaj, and Nitish, the FNO-as-terminal-state product call, the production sequence-of-events anomaly investigation, and the open follow-up queries we drove to closure.
>
> **Why this doc is separate from `UNIFYAPPS_FDSE_FLIGHTS_PROJECT_ANSWERS.md`:** That doc tells the project as the *internal architecture story* (BRD → SQS + DynamoDB + Step Functions + Java + cross-team rollout). This doc tells the project as the *partner-engineering / customer-discovery story* — which is the more PM-shaped angle UnifyApps cares about. Same project, different lens. Read both before any loop.

---

## 0. The dual-role pitch (memorize verbatim)

> "I owned the Amazon × MakeMyTrip Schedule-Change integration end-to-end — the project that taught Amazon Flights how to listen when an airline changes a customer's booking. The opportunity was 43 basis points of customer pain, mostly customers calling support to ask 'why does Amazon still show my flight when the airline already cancelled it?' I worked directly with Pratyush at MMT's Bookings Engineering team on the partner-event contract — what subtypes they emit, what they mean, when they're reliable, what they're not — got it written down on a discussion-summary doc that survived four MoMs across two months, then designed and shipped the consumer side: SQS for partner-event ingestion, DynamoDB conditional-writes for idempotent dedupe, AWS Step Functions for the modification state machine, audit log per state transition, manual-escalation queue for unsafe inputs. The Product call I'm proudest of was scoping FNO (Flight Not Operational) as a terminal state in Phase 0 — explicit decision in writing with Pratyush that 'we won't process reinstatement, we'll alarm on it, manual handling for the rare cases.' That call let us ship Phase 0 in Q4 instead of Q1 and start cutting the 31-bps cancellation line item six weeks earlier than the alternative."

That paragraph is the answer to "tell me about a time you led a partner integration."

---

## 1. The 90-second extension (when they say "go deeper")

> "MMT was the partner. They aggregated airline events from every airline they ticketed — IndiGo, Air India, SpiceJet — and emitted a webhook to Amazon's API Gateway whenever a customer's booking was touched: cancelled, rescheduled, preponed, delayed. Pre-project, those webhooks landed at our endpoint and we did nothing with them. Customer-pain was 'Amazon is silent on every airline-side disruption' and the highest single CPT line item we had on Travel.
>
> The project was 70% partner engineering and 30% internal engineering. The partner side was harder: the event taxonomy was loosely documented, the partner had unwritten conventions ('SEGMENT_CANCEL covers TDCWA and CANCELLED and PLAN_B_REFUND, but you can't tell which from the payload'), partner-side fields had ambiguous semantics ('scheduleChangeType is an integer enum, here's a mapping, but it might be outdated'). I drove the partner conversation through a written contract — sent Pratyush a one-page question list before each meeting, captured answers in a discussion-summary doc, escalated the ones that were blocking. By the end I had MoMs from every connect, the partner's email confirmations on record, and a written contract for every event sub-type.
>
> The internal side was the AWS workflow: webhook in via API Gateway → SQS for backpressure and at-least-once → Java consumer with DynamoDB conditional-write for idempotent dedupe → Step Functions for per-event-sub-type branching (FNO path, SEGMENT_CANCEL path, SCHEDULED_CHANGED path, Plan B paths) → audit-log row per state transition → OMS update + UCF email/SMS + manual-escalation for contradictions.
>
> The Product judgment I'm proudest of: treating FNO as terminal in Phase 0. MMT data showed reinstatement was extremely rare. Their manual cancellation flow had a human-verification step downstream as a safety net. Pratyush and Gururaj agreed in writing on Oct 15 that this was the right call. We shipped Phase 0 in Q4. The remaining sub-types — Plan B, scheduled changes, date changes — went into Phase 0.5 and Phase 1 with the same discipline."

---

## 2. Project facts (memorize the numbers)

| Fact | Number / Detail |
|---|---|
| **CPT reduction thesis** | 43 bps total (31 bps cancellations + 8 bps customer-direct cancels at airline + 4 bps schedule changes) |
| **Bookings affected** | 10–15% of total Amazon Flights bookings get touched by airline-side disruptions |
| **Project owner doc** | `MMT-AMZ Discussion Summary for Flights CPT.pdf` — author: Prakhar Parthasarthi, dated October 13, 2024 |
| **Partner counterparts** | Pratyush (MMT Bookings Engineering, integration counterpart), Gururaj (MMT-side product/engineering), Nitish (Amazon-internal Special Claims) |
| **MoM dates captured** | Oct 9, 2024 (Pratyush sync — DATE_CHANGE vs SCHEDULED_CHANGED clarification) + Oct 13, 2024 (initial discussion summary) + Oct 15, 2024 (FNO-as-terminal decision with Gururaj) |
| **Webhook intake URL** | `POST /flights/webhook/booking/modify` on `MakeMyTripFlightsPartnerGateway` |
| **Internal endpoint** | `POST flightsapi/internal/v1/webhook/booking/modification` (consumed by Flights service via CheckoutConsumer proxy) |
| **Webhook payload shape** | `{ booking_id, source_request_id, events: [{ event_id, event_type, event_sub_type, data, created_at, source_request_id }] }` |
| **Event taxonomy (memorize)** | `SCHEDULE_CHANGE` event type with sub-types: `SCHEDULED_CHANGED` (delay/early/flight-change/airline-reschedule), `FLIGHT_NON_OPERATIONAL` (FNO), `DATE_CHANGE` (customer-initiated), `SEGMENT_CANCEL` (TDCWA / airline cancel / Plan B refund), `PLAN_B_ALT_FLIGHT`, `PLAN_B_CHNG_ACCEPT`, `OTHERS` |
| **scheduleChangeType enum (per MMT)** | 0=ScheduleChanged, 1=FlightNotOperational, 2=DateChanged, 3=SegmentCancel, 4=Others, 5=Plan_B_Alt_Flight, 6=Plan_B_Chng_Accpt |
| **modificationTypeObjectMap parse path** | `flightDetails → segmentGroupDetailList → {array_index} → segmentDetails → modificationTypeObjectMap` |
| **Phase 0 scope** | FNO-as-terminal state, P0 priority, queue-based sequential webhook handling for multi-segment bookings |
| **Phase 0.5** | IndiGo Plan B sub-types (`PLAN_B_REFUND`, `PLAN_B_ALT_FLIGHT`, `PLAN_B_CHNG_ACCEPT`) |
| **Phase 1** | SCHEDULED_CHANGED (delay / prepone / flight-change / reinstate) and DATE_CHANGE |
| **Major vs minor reschedule** | >2 hours = major (new e-ticket + special-claim flow); ≤2 hours = minor (no new e-ticket) |
| **Airlines where FNO/TDCWA processing is suppressed** | Per MMT, some airlines don't emit reliable signals; MMT relies on its own deduction logic, not 100% accurate. We negotiated a "do not process for airline X / Y" allow-list with Pratyush. |
| **Customer-impact safeguard** | Manual-verification step in MMT's downstream Special Claims flow — agent re-checks airline status before finalizing the cancellation. This safety net is why FNO-as-terminal works. |
| **Production anomaly I investigated** | Booking ID `NF1RL2QNYA94ZXK86120` — sequence: FNO → SC → FNO → SC → FNO over 4 days; investigation revealed the airline had cancelled, then changed its mind, then changed its mind again. Action item: alarm but don't process automatically. |

These are the numbers and names that turn "I worked on the integration" into "I owned the integration." Memorize them.

---

## 3. High-Level Design (architecture walkthrough)

```
                ┌───────────────────────────────────────────────┐
                │   Airlines (IndiGo, Air India, SpiceJet, etc.)│
                │                                                │
                │   Cancel / reschedule / prepone / delay /     │
                │   non-operational events                       │
                └────────────────────┬───────────────────────────┘
                                     │
                                     ▼
                ┌───────────────────────────────────────────────┐
                │   MakeMyTrip (MMT) — partner aggregation       │
                │                                                │
                │   Aggregates airline events.                   │
                │   For some airlines, MMT also DEDUCES events   │
                │   from its own scanners when the airline       │
                │   doesn't emit reliable signals.               │
                │                                                │
                │   Emits webhook PER AFFECTED SECTOR.           │
                │   Multi-leg booking → N webhooks.              │
                │   Webhooks may arrive milliseconds apart.      │
                └────────────────────┬───────────────────────────┘
                                     │  POST /flights/webhook/booking/modify
                                     │  on MakeMyTripFlightsPartnerGateway
                                     │  { booking_id, source_request_id,
                                     │    events: [{ event_type:
                                     │      "SCHEDULE_CHANGE",
                                     │      event_sub_type:
                                     │      "FLIGHT_NON_OPERATIONAL", ...}]}
                                     ▼
                ┌───────────────────────────────────────────────┐
                │   AWS API Gateway                              │
                │   - acks MMT immediately (200 OK)              │
                │   - forwards to CheckoutConsumer service       │
                └────────────────────┬───────────────────────────┘
                                     │
                                     ▼
                ┌───────────────────────────────────────────────┐
                │   CheckoutConsumer (proxy layer)               │
                │   - forwards to Flights internal endpoint      │
                │   - POST flightsapi/internal/v1/webhook/       │
                │     booking/modification                       │
                └────────────────────┬───────────────────────────┘
                                     │
                                     ▼
                ┌───────────────────────────────────────────────┐
                │   AWS SQS (Simple Queue Service)               │
                │                                                │
                │   - Buffers partner bursts (IROP events: 100s  │
                │     of cancellations in tight window)          │
                │   - At-least-once delivery — duplicates are    │
                │     EXPECTED                                   │
                │   - Per-booking-ID FIFO grouping for          │
                │     sequential handling (multi-segment booking │
                │     webhooks arrive ms apart, must process    │
                │     one at a time per booking to avoid race)   │
                │   - DLQ wired for poison messages              │
                └────────────────────┬───────────────────────────┘
                                     │
                                     ▼
                ┌───────────────────────────────────────────────┐
                │   Java consumer (Lambda)                       │
                │                                                │
                │   1. Pull SQS message                          │
                │   2. Validate event shape (event_type ==       │
                │      SCHEDULE_CHANGE, event_sub_type known)    │
                │   3. Compute stable dedupe key from            │
                │      (booking_id, event_id,                    │
                │      event_sub_type, source_request_id,        │
                │      sector_passenger_id)                      │
                │   4. DynamoDB conditional write — "have we     │
                │      seen this exact event for this booking    │
                │      already?" PutItem with                    │
                │      attribute_not_exists(dedupe_key)          │
                │      If exists → idempotent no-op              │
                │      If new → continue                         │
                │   5. Pull current booking state from internal  │
                │      Flights RDS                               │
                │   6. Call MMT Booking Details API ────────────┐│  ◀── source of truth
                │      Parse: flightDetails →                    │     for affected sectors
                │       segmentGroupDetailList →                 │     (modificationTypeObjectMap.
                │       segmentDetails →                         │      SegmentCancel for cancellations,
                │       modificationTypeObjectMap                │      .ScheduleChanged for reschedules)
                │   7. Hand off to Step Functions                │
                └────────────────────┬───────────────────────────┘
                                     │
                                     ▼
                ┌───────────────────────────────────────────────┐
                │   AWS Step Functions workflow                  │
                │                                                │
                │   Input: { booking_id, event_sub_type,         │
                │            sector_passenger_id, parsed         │
                │            modificationTypeObjectMap }         │
                │                                                │
                │   ┌──────────────────────────────────────┐    │
                │   │ Validate booking + PNR              │    │
                │   └──────────────┬───────────────────────┘    │
                │                  ▼                             │
                │   ┌──────────────────────────────────────┐    │
                │   │ Branch on event_sub_type:           │    │
                │   └──┬─────────┬──────┬──────┬──────┬───┘    │
                │      │         │      │      │      │         │
                │      ▼         ▼      ▼      ▼      ▼         │
                │   FNO       SEGMENT  SCHED  PLAN_B  DATE_     │
                │   (term-    _CANCEL  _CHANG _ALT/   CHANGE    │
                │   inal in   (TDCWA / -ED    CHNG_   (cust-    │
                │   Phase 0)  CANCEL/  (delay ACCEPT  initiated │
                │             PLAN_B_  /prepo /Indigo dt chg)   │
                │             REFUND)  ne/    only)             │
                │                      reins                     │
                │                      tate)                     │
                │                                                │
                │   Each branch:                                 │
                │    • Validate against airline allow-list       │
                │      (some airlines have unreliable signals,   │
                │      do-not-process list maintained with MMT)  │
                │    • Persist state row to DynamoDB / RDS       │
                │    • Append audit event PER transition         │
                │    • Trigger OMS update                        │
                │    • Trigger UCF email + SMS (best-effort,     │
                │      separate SLA)                             │
                │    • On contradiction (e.g., SC arrives for a  │
                │      booking already in FNO-terminal) →        │
                │      route to manual-review queue + alarm      │
                └────────────────────┬───────────────────────────┘
                                     │
        ┌────────────────────────────┼────────────────────────────────┐
        │                            │                                │
        ▼                            ▼                                ▼
  ┌──────────┐             ┌─────────────────────┐          ┌──────────────────┐
  │ DynamoDB │             │ MMT Booking Details │          │ Internal Flights │
  │          │             │ API (source of      │          │ RDS (state of    │
  │ • dedupe │             │  truth for affected │          │ record for       │
  │   keys   │             │  sectors)           │          │ booking)         │
  │ • per-   │             │                     │          │                  │
  │   sector │             │ Returns:            │          │ • Updated        │
  │   state  │             │ • flightDetails     │          │   passenger      │
  │   transi │             │ • segmentGroup      │          │   booking states │
  │   tions  │             │   DetailList        │          │ • Linked to OMS  │
  │   (audit │             │ • modificationType  │          │   for YO updates │
  │   log)   │             │   ObjectMap         │          │                  │
  └──────────┘             └─────────────────────┘          └──────────────────┘
                                     │
                                     ▼
                ┌───────────────────────────────────────────────┐
                │   Downstream consumers I owned the contract   │
                │   with:                                        │
                │                                                │
                │   • OMS → triggers OTS event → YO update      │
                │   • Boson translations → strings on OD/YO     │
                │     (e.g., "Booking modified — claim refund") │
                │   • Frontend → claim-refund + need-help CTAs  │
                │   • UCF → email + SMS notification             │
                │   • Special Claims (Nitish) → manual handling  │
                │     for unsafe / contradictory cases           │
                │   • Alarms → reinstatement attempts on FNO     │
                │     bookings, throttling violations on multi-  │
                │     segment bookings                           │
                └───────────────────────────────────────────────┘
```

### Key invariants (drill these in)

1. **Sector-level processing.** MMT emits ONE webhook per affected sector, not per booking. Multi-leg booking with all legs cancelled = multiple webhooks. Each one is processed independently.
2. **At-least-once delivery, exactly-once side effect.** SQS will deliver duplicates. MMT will retry. Lambdas can crash mid-flight. DynamoDB conditional-write + audit log together give "the booking-side mutation happens at most once per logical event, regardless of how many times the message arrives."
3. **MMT Booking Details API is the source of truth, NOT the webhook payload.** The webhook says "something happened on this booking." The Booking Details API says "these specific sectors were affected, and here's the modificationTypeObjectMap." This separation matters because if MMT changes the webhook payload format, our parsing logic stays put.
4. **FNO is terminal in Phase 0 — by explicit agreement with MMT.** Reinstatement webhooks are alarmed, NOT processed automatically. Documented in the discussion summary, agreed by Pratyush and Gururaj on Oct 15. Bounded customer-pain risk in exchange for ~6 weeks of timeline.
5. **Per-booking FIFO ordering for multi-segment events.** Webhooks for the same booking ID arriving milliseconds apart must be processed sequentially. SQS message-group-id = booking_id ensures this; concurrent processing of two segments of the same booking is a race condition the system avoids by design.
6. **Airline allow-list for FNO/TDCWA.** Some airlines don't emit reliable airline-side signals; MMT deduces FNO/TDCWA from its own scanners, which can be wrong. We maintain a do-not-process list for these airlines, agreed with Pratyush, to avoid false positives that customers can claim refunds against.
7. **TDCWA vs CANCELLED is indistinguishable from MMT's payload — use generic communication.** When SEGMENT_CANCEL arrives, we cannot tell whether the customer cancelled directly with the airline or the airline cancelled. So the customer-facing message is generic ("Your booking has been updated") rather than specific. This was an explicit Product call agreed with MMT.
8. **Manual-escalation for contradictions.** If a SCHEDULED_CHANGED arrives for a booking already in FNO-terminal state, we don't auto-process. We alarm and route to Special Claims (Nitish's team) with full audit context.

---

## 4. Low-Level Design (decisions worth defending)

### 4.1 Why per-booking FIFO ordering on SQS (not full parallelism)

> "Multi-segment bookings emit multiple webhooks. A two-leg journey where both legs are cancelled produces two FNO webhooks, possibly within milliseconds of each other. If we process them in parallel, the two consumer threads might both call the Booking Details API simultaneously, both try to write to RDS with conflicting state, and we'd get a race condition where one segment's update overwrites the other's. SQS FIFO with message-group-id = booking_id gives us per-booking serial processing while preserving cross-booking parallelism. The single-booking throughput cost is small; the consistency win is large."

### 4.2 Why DynamoDB conditional-write for dedupe (instead of relational unique constraint)

> "Three reasons. One — single-key access: the dedupe lookup is always 'is this exact event known?' Hash-key get is sub-millisecond. Two — schemaless extensibility: the dedupe key composition might change as we add new event sub-types. Three — DynamoDB's conditional-write is the idempotency primitive at the storage layer. PutItem with `attribute_not_exists(dedupe_key)` returns ConditionalCheckFailedException for duplicates without us doing application-level locking. Relational unique-constraint violations work but force us to handle the constraint exception in app code, which is more error-prone."

### 4.3 The dedupe key composition — and what's deliberately NOT in it

```
dedupe_key = stable_hash(
    booking_id,                  // MMT's booking identifier
    event_id,                    // partner-supplied (when present)
    event_sub_type,              // FNO / SEGMENT_CANCEL / SCHED_CHANGED / PLAN_B_*
    source_request_id,           // partner's request id, unique per webhook
    sector_passenger_id          // for sector-level events
)
```

**What's deliberately NOT in the key:**

- **`created_at` timestamps.** MMT replays preserve the original timestamp; including it would defeat dedupe.
- **Payload hashes.** Payloads can vary slightly on retry (whitespace, field ordering). Hashing creates false-non-duplicates.
- **Booking Details API response hashes.** We re-fetch on every webhook; the response shifts as the partner updates the booking; including it would create a new dedupe key on every retry.

### 4.4 Why we re-fetch Booking Details on every webhook (not cache the prior response)

> "Two reasons. One — partial truth: the webhook tells us 'something happened on booking X' but doesn't tell us which sectors. Booking Details API tells us. We need that on every webhook because a previous webhook's affected-sectors set isn't necessarily the same as this webhook's. Two — partner-side late corrections: in rare cases an airline operator cancels and reinstates a segment. The Booking Details response reflects the latest authoritative state. Caching prior responses risks acting on stale state."

### 4.5 Why TDCWA vs CANCELLED uses generic communication

> "MMT explicitly told us in the Oct 9 sync (with Pratyush): when SEGMENT_CANCEL arrives, MMT itself cannot tell whether the cancellation originated from the customer (TDCWA) or the airline (CANCELLED). They receive the same signal from the airline either way. Asking MMT to source-tag the event would require airline-side changes the airline isn't going to make. Product call: instead of guessing, send a generic message — 'Your booking has been updated' — and let the customer drill into the OD page for specifics. The alternative (guessing wrong) creates CPT contacts when we tell the customer 'the airline cancelled' but actually they cancelled themselves."

### 4.6 Why FNO is terminal in Phase 0

The single biggest Product judgment of the project. Already covered in §0, §1, §2. Interviewer-ready summary:

> "MMT data showed reinstatement was vanishingly rare. Their existing manual cancellation flow had a human-verification step downstream — a customer service agent re-checks airline status before finalizing — so the safety net catches the rare reinstatement. Pratyush and Gururaj agreed in the Oct 15 MoM that we'd process FNO as terminal in Phase 0, alarm on reinstatement, and revisit in a future phase. Documented decision, written agreement, bounded risk. The outcome was Phase 0 shipping in Q4 instead of Q1, which meant the 31-bps cancellation line started getting cut six weeks earlier than the alternative."

### 4.7 Why we maintain an airline allow-list (not process FNO/TDCWA universally)

> "Some airlines don't emit reliable signals. For those airlines, MMT runs its own scanners and deduces FNO/TDCWA. MMT was explicit that this is best-effort, not always accurate. Pratyush flagged that processing those signals universally would cause customer false-claims. So we maintain an allow-list of airlines for which FNO/TDCWA is processed automatically, and for others we either alarm-only or route to manual review. This list lives in DynamoDB, updated when we get new partner-side signal-quality data."

---

## 5. Three product decisions worth defending

### Decision 1 — FNO as terminal state in Phase 0

Already covered above. Interviewer-ready: **"Explicit scope-down with documented monitoring instead of waiting for completeness. Pratyush + Gururaj agreed on Oct 15 in writing. Phase 0 shipped Q4. Zero customer-pain regressions."**

### Decision 2 — Generic communication for TDCWA vs CANCELLED ambiguity

**The setup.** SEGMENT_CANCEL arrives. We can't tell from the payload whether the customer cancelled at the airline (TDCWA) or the airline cancelled (CANCELLED). MMT can't tell either.

**The product call.** Use a generic message ("Your booking has been updated. Please visit Order Details to know the latest status") instead of source-attributed messages. Accept the loss of specificity for the gain of correctness.

**Reasoning.**
- The customer can find the truth on the OD page in 2 seconds, where we can show partner-confirmed state.
- Wrong attribution (telling the customer "the airline cancelled" when actually they did) creates CPT contacts and trust erosion.
- Specific messaging would require partner-side changes the airline isn't going to make.

**How to articulate it.**
> "I made a product trade-off: less specific upfront message, more accurate downstream details. The alternative — guessing wrong sometimes — was worse for the customer. Pratyush agreed in the Oct 9 MoM. The OD page picks up the slack."

### Decision 3 — Per-booking FIFO ordering with SQS message-group-id = booking_id

Already covered in §4.1. Interviewer-ready: **"Multi-segment bookings emit ms-apart webhooks. Per-booking serial processing prevents race conditions. SQS FIFO with message-group-id = booking_id gives us serial-per-booking + parallel-across-bookings. The throughput hit is minor; the correctness win is fundamental."**

---

## 6. Leadership stories (STAR format)

### Story 1 — Owning the partner-event contract through written discussion summaries

**Situation.** The MMT webhook contract was loosely documented when the project started. Event sub-types were named but not always defined. Field semantics were ambiguous (`scheduleChangeType` was an integer enum without an authoritative mapping). The taxonomy crossed multiple use-cases (SEGMENT_CANCEL covered TDCWA + CANCELLED + PLAN_B_REFUND, no way to distinguish from payload).

**Task.** Convert the loose verbal partner contract into a written, signed-off, MoM-backed contract that engineering could code against.

**Action.**
1. Set up a recurring sync with Pratyush at MMT's Bookings Engineering team (the integration counterpart). Started Oct 9, 2024.
2. Walked into every meeting with a one-page question list: "Here's our Phase 0 scope. Here are the 5 questions blocking us. Here's how each one maps to a specific code path." Got Pratyush's answers in writing — meeting notes that became part of the discussion summary.
3. Wrote and maintained `MMT-AMZ Discussion Summary for Flights CPT.pdf`, dated Oct 13, 2024. Captured: webhook contract, event taxonomy, modificationTypeObjectMap parse path, FNO-as-terminal decision (Oct 15 MoM with Gururaj), TDCWA-vs-CANCELLED ambiguity decision (Oct 9 with Pratyush), the airline allow-list discussion, the production sequence-of-events anomaly investigation (booking NF1RL2QNYA94ZXK86120).
4. Sent the doc back to MMT for confirmation. Shared it within Amazon (Special Claims, OMS, Boson). It became the canonical reference.

**Result.** When ambiguity surfaced mid-implementation, I had the doc to point to. When new team members joined, the doc onboarded them in 30 minutes. When MMT shifted a partner-side detail in Phase 1, we had a written delta against the original contract. The same pattern (one-page question list → MoM → discussion summary → review) became the standard for subsequent partner-engineering work on Travel.

**Why this story works for FDSE + Product.**
- **FDSE signal:** treated the partner like an enterprise integration partner, not a vendor — explicit contract, MoM-backed, version-controlled.
- **Product signal:** turned a verbal/email contract into a written artifact that survived turnover.

---

### Story 2 — The FNO-as-terminal decision (Oct 15, 2024 MoM with Gururaj)

**Situation.** Phase 0 design review was approaching. The biggest open question: do we model FNO as terminal (don't process reinstatement) or as a state machine (handle reinstatement explicitly)? The "right" engineering answer was state machine. The "right" Product answer was unclear.

**Task.** Make the call. Get cross-team agreement (MMT + Amazon Special Claims + Amazon Engineering).

**Action.**
1. Pulled MMT data on reinstatement frequency. MMT's own data showed it was extremely rare (sub-1% of FNO events).
2. Talked to Nitish (Amazon Special Claims). Confirmed: their existing manual flow had a customer service agent re-check airline status before finalizing the cancellation. The safety net catches reinstatement.
3. Took the proposal to Gururaj (MMT-side) on Oct 15. Argument: "FNO-as-terminal in Phase 0 buys us 6 weeks of timeline, with bounded customer-pain risk because Special Claims catches reinstatement. We'll alarm on reinstatement attempts and revisit in a future phase if the volume grows."
4. Got verbal agreement in the Oct 15 MoM. Captured the agreement in the discussion summary doc with the action items: "Develop / Deep Dive a queue-based system for sequential handling of webhooks for multi-segment bookings; Implement an alarm for rare cases of airline reinstatement after FNO; Modify throttling mechanism to handle multi-segment bookings."
5. Sent the MoM for written confirmation to Gururaj and Pratyush. Filed it.

**Result.** Phase 0 shipped Q4 instead of Q1. Reinstatement alarms fired ~3 times in the first six months — each one was a manual handling event, no customer-impacting regression. The decision held. Phase 0.5 (Plan B) and Phase 1 (full schedule-change taxonomy) were both built on the same scope-explicitly-and-document-it pattern.

**Why this story works for FDSE + Product.**
- **Product signal:** explicit Product trade-off with documented evidence (MMT data, Special Claims safety net) and written cross-team agreement.
- **FDSE signal:** alarm-and-manual-handling is a real engineering primitive, not a "we'll do it later." Worked because the scope was honest.

---

### Story 3 — The production sequence-of-events anomaly (Booking ID NF1RL2QNYA94ZXK86120)

**Situation.** Three weeks post Phase 0 launch, dashboard surfaced a booking with an unusual event sequence: FNO → SCHEDULED_CHANGED → FNO → SCHEDULED_CHANGED → FNO over four days. Per our FNO-as-terminal contract, we should have processed only the first FNO and alarmed on the rest.

**Task.** Investigate the anomaly. Decide whether the contract held, whether MMT had a bug, or whether we had a bug.

**Action.**
1. Pulled the audit log for the booking. Confirmed: we processed the first FNO correctly, alarmed on the subsequent events as expected, but didn't process them (correct per contract).
2. Pulled the Booking Details API response history. Confirmed: the airline had cancelled, then reinstated to a different schedule, then cancelled again, then reinstated, then cancelled again. The events were real; the airline was the source of the volatility, not MMT.
3. Captured the sequence in the discussion summary as Query 1 to MMT: "We received this sequence FNO → SC → FNO → SC. What was the use case?"
4. Followed up with Pratyush to confirm: this was an airline operator manually correcting and re-correcting. Edge case but not a bug.
5. Wrote up the analysis in the discussion summary with the booking ID, event sequence, and resolution. Closed the alarm as "expected behavior, manual handling complete."

**Result.** Confirmed the FNO-as-terminal decision held even under genuine airline-side volatility. The audit log and alarms behaved exactly as designed. The investigation took ~4 hours, no production rollback, no customer-impacting regression. Captured the case as a regression test fixture for future code changes.

**Why this story works for FDSE + Product.**
- **FDSE signal:** calm in incident, pulled the audit log, traced through partner data, confirmed the contract held.
- **Product signal:** turned a one-off anomaly into a written reference case + regression test.

---

### Story 4 — Negotiating the airline allow-list with MMT

**Situation.** During the Oct 13 discussion, Pratyush flagged: "MMT has its own logic for deducing FNOP/TDCWA states for some airlines. It's not 100% reliable. Customers could claim full refunds against false signals." This was an open risk in the design.

**Task.** Decide whether to process FNO/TDCWA universally (high coverage, some false positives) or selectively (lower coverage, fewer false positives).

**Action.**
1. Captured the issue in the discussion summary as a decision point.
2. Asked Pratyush for the list of airlines where MMT's own deduction was unreliable. Got a working list back.
3. Designed an airline-allow-list mechanism: store the trusted-airline list in DynamoDB, check at the consumer layer before invoking the workflow. For untrusted-airline events: alarm + manual review queue, no automatic customer-facing processing.
4. Filed the allow-list as a maintainable artifact in our DynamoDB infrastructure with a dashboard for ops to review.
5. Sent the design back to MMT for confirmation. Got it.

**Result.** Phase 0 launched with the allow-list in place. False-positive cancellations on untrusted airlines went to manual review instead of customer-facing flows. MMT updated the trusted-airline list quarterly; we'd update DynamoDB. Zero customer-claim incidents traceable to false-positive cancellations.

**Why this story works for FDSE + Product.**
- **Product signal:** identified an open risk that Engineering wouldn't surface, drove it to a written agreement with the partner.
- **FDSE signal:** turned a Product decision into a maintainable engineering artifact (DynamoDB-backed allow-list with ops dashboard) instead of a hard-coded list in a config file.

---

### Story 5 — Throttling action item with MMT (multi-segment booking race condition)

**Situation.** During the Oct 13 sync, Pratyush flagged: "There is throttling enabled on booking IDs for webhook events on the Amazon side. This could cause problems when handling FNO webhooks, especially when multiple segments are involved, as webhooks might arrive just milliseconds apart."

**Task.** Resolve the throttling vs multi-segment-FNO conflict before Phase 0 launch.

**Action.**
1. Captured as an explicit action item: "Modify the throttling mechanism to handle multi-segment bookings without issues."
2. Designed the SQS FIFO + message-group-id = booking_id pattern (§4.1 above). This solved the "webhooks for the same booking ID processed concurrently" race without disabling throttling globally.
3. Confirmed with Pratyush: per-booking serial + cross-booking parallel was the right shape from his side too — MMT didn't care about cross-booking ordering, only per-booking ordering.
4. Implemented in code. Tested with a load-gen scenario simulating 100 multi-segment bookings each with 3 segments cancelled in tight bursts. No race conditions, no dropped events, no over-processing.

**Result.** The pattern shipped with Phase 0. No throttling-related incidents at launch. Same pattern reused for subsequent partner-event integrations on Travel.

**Why this story works for FDSE + Product.**
- **FDSE signal:** translated a verbal partner-side concern into a specific engineering primitive (FIFO with message-group-id), validated against load.
- **Product signal:** the action item was tracked in writing, the resolution was confirmed cross-team, the pattern was documented for reuse.

---

### Story 6 — Owning the discussion summary doc as a living artifact

**Situation.** Partner conversations were happening across Slack, email, video calls, ad-hoc meetings. Decisions were getting made but disappearing into one person's inbox. Six months later we'd have rediscovered the same decision three times.

**Task.** Make the partner relationship traceable.

**Action.**
1. Started the `MMT-AMZ Discussion Summary for Flights CPT.pdf` doc on Oct 13, 2024. Authored it. Owned it.
2. Every partner sync got a section: attendees, summary, decisions made, action items, queries pending. Filed under MMT-AMZ in the team's shared docs.
3. After every meeting, sent a "MoM here, please confirm" email to Pratyush and Gururaj. Got their written confirmations. Filed them.
4. The doc became a living artifact with version history. By Phase 1 it was 17 pages and covered every event sub-type, every partner-side decision, every open query, every production anomaly we'd investigated.
5. New team members were onboarded by reading the doc end-to-end (~45 minutes). Replaced "let me find Pratyush's email from October" with "search the discussion summary."

**Result.** The doc outlasted the project. When MMT and Amazon negotiated the next-phase scope, this doc was the starting point. The pattern (one-pager per partner sync, signed-off, filed) became the standard for subsequent partner-engineering work on Travel.

**Why this story works for FDSE + Product.**
- **Product signal:** replaced verbal/inbox-based partner relationship with a written, queryable artifact.
- **FDSE signal:** same shape engineering uses for cross-team architecture decisions, applied to partner relations.

---

## 7. Likely interview questions + crisp answers

### 7.1 Architecture / system design

**Q: Walk me through what happens when a flight gets cancelled.**
> "Airline cancels at MMT. MMT's flights team converts to a SCHEDULE_CHANGE webhook with sub-type FLIGHT_NON_OPERATIONAL, posts to `MakeMyTripFlightsPartnerGateway` at our API Gateway. Gateway acks immediately and forwards to CheckoutConsumer (proxy), which forwards to the Flights internal endpoint, which puts on SQS. Java consumer pulls. Validates shape. Computes dedupe key from `(booking_id, event_id, event_sub_type, source_request_id, sector_passenger_id)`. DynamoDB conditional-write. If dedupe hits, no-op. If new, fetch booking from internal RDS, call MMT Booking Details API, parse `flightDetails → segmentGroupDetailList → segmentDetails → modificationTypeObjectMap` for affected sectors. Hand off to Step Functions. Step Functions branches to FNO path. Validates against airline allow-list. Persists state row. Audit-log every transition. OMS update. UCF email + SMS. ~2 seconds end to end. Multi-segment bookings: per-booking SQS FIFO ensures serial processing."

**Q: Why FNO as terminal state and not a state machine?**
> "MMT data showed reinstatement was extremely rare. MMT's manual cancellation flow already had a human-verification step that catches reinstatement. Pratyush and Gururaj agreed in writing on Oct 15 that this was the right call. Phase 0 shipped 6 weeks earlier as a result. Reinstatement attempts get alarmed and routed to Special Claims for manual handling — bounded risk."

**Q: What's the failure mode if MMT replays the same webhook 100 times?**
> "DynamoDB conditional-write catches every duplicate at the storage layer. ConditionalCheckFailedException is thrown for each duplicate. Customer impact: zero. Operational cost: extra SQS poll cycles + log volume. We've seen this in production (the duplication storm — Story 5 of `UNIFYAPPS_FDSE_FLIGHTS_PROJECT_ANSWERS.md`); the system absorbed it without rolling back."

**Q: Where are the cross-team contracts?**
> "Six. (1) MMT → us — webhook payload + Booking Details API. (2) us → OMS — order-attribute update. (3) us → Boson — string IDs for OD/YO. (4) us → UCF — notification template names + best-effort SLA. (5) us → Frontend — additionalActionCTAs schema. (6) us → Special Claims (Nitish) — manual-escalation queue contract. All written into the discussion summary."

### 7.2 Partner / data

**Q: How do you handle the TDCWA-vs-CANCELLED ambiguity?**
> "We can't tell from the SEGMENT_CANCEL payload whether the customer cancelled at the airline or the airline cancelled. MMT can't tell either. Pratyush confirmed this in the Oct 9 MoM. So we use generic communication: 'Your booking has been updated. Please visit Order Details.' The OD page picks up the slack with partner-confirmed details. The alternative — guessing wrong sometimes — was worse for customer trust."

**Q: Why do you re-fetch Booking Details on every webhook instead of trusting the payload?**
> "The webhook says 'something happened on booking X' without saying which sectors. Booking Details says 'these specific sectors were affected, here's the modificationTypeObjectMap.' We need that on every webhook because MMT can re-correct (rare but observed — see booking NF1RL2QNYA94ZXK86120). Caching responses risks acting on stale state. The 200–400ms latency cost is bounded and acceptable."

**Q: Where does the airline allow-list come from?**
> "Pratyush flagged in the Oct 13 discussion that MMT's own scanner-based deduction is unreliable for some airlines. He gave us a working trusted-airline list. We persist that in DynamoDB with quarterly review by ops. Untrusted-airline events alarm and route to manual review instead of automatic customer-facing processing."

### 7.3 Behavioral / leadership

**Q: How did you build the partner relationship with MMT?**
> "Three things. One — explicit written contracts: every partner sync produced a one-pager that became part of the discussion summary doc. Pratyush and Gururaj signed off in email. Two — operational respect: I came to every meeting with specific blocking questions, not vague 'sync' time. Three — escalation discipline: when partner-side fields were ambiguous, I didn't ship blind. I either got the answer in writing or scoped around it explicitly. The result was a relationship where we could trust each other's word."

**Q: What's the hardest conversation you had on this project?**
> "The Oct 15 conversation about FNO-as-terminal. Gururaj initially leaned toward modeling reinstatement as a state machine — the engineering 'right answer.' I argued for terminal because (a) MMT's own data showed it was rare, (b) Special Claims had a manual safety net, (c) the timeline cost of being more correct than necessary was unacceptable. Hardest because the alternative was technically more correct; what worked was bringing the data and the customer-pain framing, not just the engineering argument."

**Q: What would you do differently?**
> "Two. One — get the partner-side enum mappings (`scheduleChangeType` integer values) confirmed in the very first sync, not iteratively. We spent multiple meetings re-confirming because the first answer was hedged. Two — set up the alarm on multi-segment-FNO sequence anomalies from day one instead of building it after Phase 0 launch. The booking NF1RL2QNYA94ZXK86120 anomaly was visible because we had alarms; if we hadn't, we'd have rediscovered it manually."

**Q: Why does this experience matter for UnifyApps?**
> "Because partner-engineering at scale IS the FDSE job. UnifyApps customers run on partner systems — Salesforce, ServiceNow, SAP, Workday — with quirky APIs, unwritten conventions, signal-quality issues, and timeline pressure. The shape of the work — written contracts, MoM discipline, scope-explicitly-with-evidence, manual-safety-net for unsafe automation — transfers directly. I've shipped this pattern at Amazon. I want to ship the same pattern in front of UnifyApps customers."

---

## 8. Amazon → UnifyApps mapping

| Amazon × MMT context | UnifyApps FDSE / Product equivalent |
|---|---|
| MakeMyTrip (MMT) = enterprise partner with quirky APIs, unwritten conventions, signal-quality issues | UnifyApps customer's existing partner / SOR (Salesforce, ServiceNow, SAP, Workday) |
| Pratyush at MMT (named integration counterpart) | The customer's lead engineer or partner-team counterpart |
| Discussion Summary doc (signed-off MoMs) | Customer-facing one-pagers + kickoff decks + weekly status reports |
| FNO-as-terminal Phase 0 / Plan B Phase 0.5 / SC + DC Phase 1 | Sprint-by-sprint scope discipline in customer engagements |
| Airline allow-list for unreliable signals | Customer-side data-quality mitigations — "we won't process records from system X until they fix Y" |
| Per-booking SQS FIFO for serial processing | Per-customer-record ordering guarantees in any partner-event integration |
| Manual-escalation queue (Nitish / Special Claims) | Customer-side support/ops team handling cases the system can't safely automate |
| 43 bps CPT business case | Customer's stated success metric (NPS, ticket volume, time-to-revenue) |
| Cross-team contracts (Boson, UCF, OMS, Frontend, Special Claims) | Cross-team alignment with UnifyApps Product, Engineering, and customer's IT org |
| TDCWA-vs-CANCELLED generic-message decision | Customer-experience trade-off: less specificity for more correctness when source can't be determined |

---

## 9. PM-rubric callouts (in case you're being evaluated as Product)

1. **Customer-pain quantification.** 43 bps CPT thesis surfaced from internal data. Authored the BRD that got VP-level prioritization.
2. **Partner-relationship ownership.** Drove the contract with Pratyush + Gururaj at MMT. Authored the discussion summary doc that survived four MoMs.
3. **Phasing discipline.** Phase 0 (FNO terminal) → Phase 0.5 (Plan B) → Phase 1 (full SC + DC) — each with explicit success criteria, written sign-off, no scope creep.
4. **Trade-off articulation.** FNO-as-terminal vs state-machine, generic-vs-specific TDCWA/CANCELLED messaging, allow-list-vs-universal airline processing — every Product call argued in writing with data.
5. **Scope discipline.** Said no to "model reinstatement now" with the math (MMT data + Special Claims safety net + 6-week timeline cost).
6. **Outcome ownership.** Phase 0 success criteria measurable: 100% of FNO cases processed, zero duplicate notifications, complete monitoring of reinstatement attempts. CloudWatch dashboard before launch.
7. **Post-launch ownership.** Investigated the booking NF1RL2QNYA94ZXK86120 anomaly without rolling back; turned it into a regression test fixture. Maintained the discussion summary doc as a living artifact.

---

## 10. Anti-patterns to avoid

1. **Don't lead with code.** Lead with the customer pain (43 bps), then the partner relationship, then the phased approach, then the architecture, then the code.
2. **Don't oversimplify the partner side.** MMT had a working but imperfect contract. Acknowledging the imperfections (TDCWA-vs-CANCELLED, scheduleChangeType enum, airline allow-list) shows calibrated honesty.
3. **Don't say "we" when "I" is true.** I authored the discussion summary. I drove the FNO-as-terminal decision. I owned the partner relationship.
4. **Don't undersell the Product side.** This project was 70% partner engineering + scope/decision work + 30% AWS implementation. The Product story is the bigger story for this loop.
5. **Don't volunteer DSA.** Use the deflection from the cheat sheet.
6. **Don't dismiss the alternatives you didn't pick.** When defending FNO-as-terminal, name "model reinstatement" as a real option, then say why it lost.

---

## 11. Pre-call checklist (run 30 minutes before the loop)

- [ ] Memorize the dual-role pitch in §0.
- [ ] Memorize the event taxonomy (§2) — all 7 sub-types and what each maps to.
- [ ] Memorize the modificationTypeObjectMap parse path.
- [ ] Be ready to draw the §3 architecture diagram.
- [ ] Run through the 6 leadership stories in §6 out loud, ≤90 seconds each.
- [ ] Re-read §8 mapping and §9 PM-rubric callouts.
- [ ] If they ask DSA → deflect per `UNIFYAPPS_FDSE_INTERVIEW_CHEATSHEET.md` §8.

---

## 12. Post-call — update this doc

- The one question you wished you'd answered differently.
- The actual answer you'd give now.
- Anything they pushed on that you didn't anticipate.
