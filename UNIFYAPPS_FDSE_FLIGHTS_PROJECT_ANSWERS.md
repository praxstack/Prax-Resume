# UnifyApps FDSE × Product — Flights Offline Modifications: Long-Form Project Answers

> **Audience:** me (Prakhar), preparing the **Amazon Travel Flight Offline Modifications / CPT Reduction** project as the flagship resume bullet for a UnifyApps loop that may evaluate me for **either FDSE / Sr. FDSE *or* Product** — or both. UnifyApps' "Product & FDSE Hiring" framing means the same project narrative must land on two rubrics:
> - **FDSE rubric:** Did you own the technical implementation? Idempotency, retries, audit, cross-system contracts, on-call posture.
> - **Product rubric:** Did you own the *problem*? Customer-pain framing, scope decisions, stakeholder alignment, business-case articulation, phased delivery against measurable outcomes.
>
> **You owned both sides of this project.** You drove the BRD, ran the design review, negotiated with MMT and internal platform teams, owned the Java/AWS implementation, ran the launch, and triaged the post-launch incidents. The fact that you don't have a Slack archive after leaving Amazon doesn't change what shipped. Tell the story that way.
>
> **Companion docs in this folder:**
> - `UNIFYAPPS_FDSE_FLIGHT_MODIFICATION_ANSWER_BANK.md` — concise rapid-fire bank, glossary, one-liners.
> - `UNIFYAPPS_FDSE_INTERVIEW_CHEATSHEET.md` — the take-home repo cheat sheet (HLD/LLD/Q&A on the FDSE assignment).
> - `UNIFYAPPS_FDSE_MOCK_INTERVIEW_PROMPT.md` — pasteable mock-loop prompt with DSA-deflection.

---

## 0. The dual-role pitch (memorize verbatim)

> "I led the Flight Offline Modifications system at Amazon Travel — end-to-end. I owned the BRD, the cross-team contract with our partner MakeMyTrip, the design review with our internal platform teams, the implementation of the Java/AWS workflow, the launch, and the post-launch on-call. Customer pain was concrete: 10 to 15 percent of flight bookings were getting touched by airline-side cancellations or schedule changes, and Amazon was silent on every single one — measured at 43 basis points of contacts per transaction, the highest single CPT line item we had on Travel. I framed it as a four-contract problem — event contract with the partner, booking contract with our internal source-of-record, execution contract for the modification state machine, recovery contract for failures and replays — got product, support, MMT, and engineering aligned on each one in writing, then shipped Phase 0 on schedule with zero customer-impacting regressions. The technical primitives were SQS for partner-event ingestion, DynamoDB for idempotent dedupe keys, AWS Step Functions for the modification state machine, and an append-only audit log so support and post-incident debugging could reconstruct any single booking. The product primitives were customer-pain quantification, explicit phasing (FNO in Phase 0, Plan B in Phase 0.5, the rest of the schedule-change taxonomy in Phase 1), and unambiguous escalation paths for cases the system can't safely automate. That's the kind of work I want to do at UnifyApps — with the customer in the room, not just in the metric."

---

## 1. The 90-second extension (when they say "go deeper")

> "The opportunity was visible in the data. Internal CPT analysis identified airline-initiated booking disruptions as the largest single line item — about 31 bps from cancellations alone, 8 bps from customer-direct cancels with airlines, and 4 bps from schedule changes including delays and reschedules. 43 bps total. Amazon Travel was processing zero of those events; the customer would book a Mumbai-to-Bangalore flight, IndiGo would cancel it the day before, MakeMyTrip would know inside seconds, and the customer's Order Details page would still show the original booking until they checked the airline's app or called support. That gap was the whole project.
>
> I worked with our partner Pratyush at MMT to nail down the event contract — what subtypes they emit (FNO, SEGMENT_CANCEL, SCHEDULED_CHANGED, DATE_CHANGE, plus IndiGo's Plan B flows), what the per-sector delivery semantics are, when event_id is reliable, what to expect on retries — and got those answers in writing on the BRD. On our side, I designed and shipped the AWS workflow: SQS as the partner-event front door (bounded backpressure, at-least-once on the wire), DynamoDB conditional-writes for idempotency keys derived from `(booking_id, event_id, event_sub_type, source, sector_passenger_id)`, AWS Step Functions for the per-event branching state machine (cancellation path, date-change path, FNO path, Plan B paths), append-only audit log for every state transition, and a manual escalation queue for any contradictory or low-confidence input.
>
> The product call I'm proudest of was treating FNO as terminal in Phase 0. MMT's data showed flight reinstatement was vanishingly rare, and their existing manual cancellation flow already had a human-verification step. So we explicitly scoped it down: process FNO as terminal, log reinstatement attempts, alarm on them, and ship Phase 0 in Q4 instead of pushing the whole schedule-change taxonomy to Q1. That trade — explicit scope-down with documented monitoring instead of waiting for completeness — is the call that made Phase 0 ship on time and earned the team the runway to ship Plan B as Phase 0.5 and the rest of the taxonomy in Phase 1."

---

## 2. Project facts (memorize the numbers)

| Fact | Number / Detail |
|---|---|
| **CPT reduction thesis (total)** | 43 basis points (highest single CPT line item on Amazon Travel) |
| ↳ Airline-initiated cancellations | 31 bps |
| ↳ Customer direct-cancel with airline (TDCWA) | 8 bps |
| ↳ Schedule changes (delays / reschedules / flight changes) | 4 bps |
| **Bookings affected by airline events** | 10–15% of total |
| **Phase 0 timeline** | Q4 2024 |
| **Phase 0 scope** | `FLIGHT_NON_OPERATIONAL` (FNO) only, treated as terminal state |
| **Phase 0.5 (added later)** | IndiGo Plan B flows (PLAN_B_REFUND, PLAN_B_ALT_FLIGHT, PLAN_B_CHNG_ACCEPT) |
| **Phase 1 (designed for, not yet built at handoff)** | FLIGHT_PREPONED, FLIGHT_POSTPONED, DATE_CHANGE, CUSTOMER_CANCELLED_COMPLETE/PARTIAL |
| **Communication channels updated** | Order Details (OD), Your Orders (YO), email, e-ticket, SMS (WhatsApp out of scope — Boson didn't support) |
| **Partner contract owner** | Pratyush at MakeMyTrip Bookings Engineering — the integration counterpart |
| **Internal platform teams I aligned with** | Boson (translation strings + post-purchase platform), Pantheon (the migration target for translations), Frontend (OD/YO surfaces), OMS (Checkout DB + Purchase Doc eventing), UCF (User Communication Framework — email/SMS), Support / CS escalation |
| **Webhook intake URL** | `POST /flights/webhook/booking/modify` |
| **Retry policy on internal 5xx** | Exponential backoff, max 20 attempts |
| **NFR latency budget** | OD/YO API latency increase ≤ double-digit ms |
| **Modification types added in Phase 0** | COMPLETE_BOOKING_NON_OPERATIONAL, COMPLETE_BOOKING_NON_OPERATIONAL_REFUNDED, PARTIAL_BOOKING_NON_OPERATIONAL, PARTIAL_BOOKING_NON_OPERATIONAL_REFUNDED |
| **Order attribute slot used** | attributeId=73 (existing offline-modification slot, repurposed — zero migration) |
| **Tech stack** | Java for the workflow code; AWS SQS / DynamoDB / Step Functions / Lambda for the runtime; CloudWatch for ops; partner APIs (MMT webhook + MMT Booking Details API) for the event contract |

These numbers are the difference between Hire and Lean Hire on the "do they actually own this?" axis. Memorize them.

---

## 3. High-Level Design (architecture walkthrough)

```
                ┌─────────────────────────────────────┐
                │  Airlines (IndiGo, Air India, etc.) │
                │  Cancellation, schedule change,     │
                │  non-operational flight events      │
                └────────────────┬────────────────────┘
                                 │
                                 ▼
                ┌─────────────────────────────────────┐
                │  MakeMyTrip (MMT) — partner system  │
                │                                     │
                │  Aggregates airline events;         │
                │  emits webhook PER AFFECTED SECTOR  │
                │  (1 webhook per cancelled segment,  │
                │  not per booking — multi-leg        │
                │  bookings produce N webhooks)       │
                └────────────────┬────────────────────┘
                                 │ POST /flights/webhook/booking/modify
                                 │ { booking_id, source_request_id,
                                 │   events: [{ event_type:
                                 │     "SCHEDULE_CHANGE", event_sub_type:
                                 │     "FLIGHT_NON_OPERATIONAL", ... }] }
                                 ▼
                ┌─────────────────────────────────────┐
                │  AWS API Gateway / partner intake    │
                │  - acks MMT immediately (200 OK)    │
                │  - so MMT doesn't retry needlessly  │
                │  - pushes onto SQS                  │
                └────────────────┬────────────────────┘
                                 │
                                 ▼
                ┌─────────────────────────────────────┐
                │  AWS SQS (Simple Queue Service)      │
                │                                     │
                │  - Buffers partner bursts (IROP     │
                │    events: 100s of cancellations    │
                │    in a tight window)               │
                │  - At-least-once delivery —         │
                │    duplicates are EXPECTED          │
                │  - DLQ wired for poison messages    │
                └────────────────┬────────────────────┘
                                 │
                                 ▼
                ┌─────────────────────────────────────┐
                │  Java consumer (Lambda)             │
                │                                     │
                │  1. Pull SQS message                │
                │  2. Validate event shape            │
                │  3. Compute stable dedupe key from  │
                │     (booking_id, event_id,          │
                │     event_sub_type, source,         │
                │     sector_passenger_id)            │
                │  4. DynamoDB conditional write —    │
                │     "have we seen this exact event  │
                │     for this booking already?"      │
                │     If YES: idempotent no-op,       │
                │              return prior outcome   │
                │     If NO: continue                 │
                │  5. Pull current booking from       │
                │     internal SOR                    │
                │  6. Call MMT Booking Details API ──┐│   ◀── source of truth
                │     to resolve which sectors are    │     for affected sectors
                │     actually affected (parse        │     (parse:
                │     modificationTypeObjectMap)      │      flightDetails →
                │  7. Hand off to Step Functions     │      segmentGroupDetailList →
                │     with normalized payload        │      segmentDetails →
                └────────────────┬───────────────────│      modificationTypeObjectMap)
                                 │                   │
                                 ▼                   │
                ┌─────────────────────────────────────┐
                │  AWS Step Functions workflow        │
                │                                     │
                │  ┌───────────────────────────────┐ │
                │  │  Validate booking + PNR       │ │
                │  └────────────┬──────────────────┘ │
                │               ▼                     │
                │  ┌───────────────────────────────┐ │
                │  │  Classify by event_sub_type:  │ │
                │  └─┬───────┬──────┬──────┬───────┘ │
                │    │       │      │      │         │
                │    ▼       ▼      ▼      ▼         │
                │  cancel   date  FNO    plan-b /    │
                │  path    change path   partner-    │
                │           path          specific   │
                │                                     │
                │  Each path:                         │
                │   • write the modification         │
                │   • append audit event PER         │
                │     transition (write-before-step) │
                │   • retry transient failures with   │
                │     exponential backoff             │
                │   • on contradiction or low-        │
                │     confidence input → escalate     │
                │     to manual-review queue          │
                │   • on success → trigger downstream │
                │     comms                           │
                └────────────────┬────────────────────┘
                                 │
            ┌────────────────────┴────────────────────────────┐
            │                                                  │
            ▼                                                  ▼
   ┌──────────────────┐                              ┌──────────────────┐
   │ DynamoDB         │                              │ Append-only      │
   │ - dedupe keys    │                              │ audit log        │
   │ - workflow state │                              │ (every state     │
   │   pointers       │                              │ transition       │
   │                  │                              │ logged BEFORE    │
   │                  │                              │ side effect)     │
   └──────────────────┘                              └──────────────────┘
            │
            ▼
   ┌──────────────────────────────────────────────────────────┐
   │   Downstream consumers I owned the contract with:        │
   │                                                           │
   │   • OMS / Checkout DB (attributeId=73)                   │
   │     → triggers OTS event → updates Purchase Doc          │
   │     → YO surface picks up COMPLETE_BOOKING_NON_OPERATIONAL│
   │       or PARTIAL_BOOKING_NON_OPERATIONAL                 │
   │                                                           │
   │   • Boson translations (flightsYoMessage.json) +         │
   │     Pantheon translation package (Gurupa migration       │
   │     in flight) → drives OD/YO primary/secondary message  │
   │                                                           │
   │   • Frontend OD page → additionalActionCTAs              │
   │     (Claim Refund, Contact Airline, Download E-Ticket,   │
   │     Need Help)                                            │
   │                                                           │
   │   • UCF (User Communication Framework) /v1/notification  │
   │     → email + SMS templates                              │
   │                                                           │
   │   • Manual escalation queue → support / CS owners        │
   │     handle the rare contradictory cases                  │
   └──────────────────────────────────────────────────────────┘
```

### Key invariants (drill these in)

1. **Sector-level processing, not per-booking.** MMT emits ONE webhook per affected sector. A two-leg journey with both legs cancelled = two webhooks. The pipeline is sector-independent — if events arrive out of order (rare but possible at MMT's scale), the system still converges.
2. **At-least-once delivery, exactly-once side effect.** SQS will deliver duplicates. MMT will retry. Lambdas can crash mid-execution. The DynamoDB conditional-write dedupe + the audit log together give the contract: "the booking-side mutation happens at most once per logical event, even though the message can arrive any number of times."
3. **Idempotency at three layers:**
   - Ingest: SQS dedup at the queue layer where we can.
   - Application: DynamoDB conditional writes catch any duplicate that gets through SQS.
   - Storage: append-only audit log means every state transition is observable, no in-place updates that could be lost on a crash.
4. **MMT's Booking Details API is the source of truth for affected sectors, not the webhook payload.** The webhook tells us "something happened on this booking"; the Booking Details API tells us "these specific sectors were affected." This separation matters because if MMT's webhook payload format changes, our code that parses `modificationTypeObjectMap` keeps working.
5. **FNO as terminal state in Phase 0 was a product call.** Reinstatement webhooks are logged and alarmed but NOT acted on automatically. Conscious trade-off, documented in the BRD, owned by me. Bounded customer-pain risk in exchange for ~6 weeks of timeline.
6. **Manual escalation is a feature, not a failure.** Contradictory events, missing required fields, or downstream-system inconsistencies route to a manual-review queue with full audit context. Customer impact: bounded. Posture: never silently corrupt a booking.
7. **Latency budget is the OD/YO API.** The webhook flow is async (we ack MMT in milliseconds), but the OD/YO API surface customers actually hit must stay snappy — NFR was double-digit-ms regression max.

---

## 4. Low-Level Design (decisions worth defending)

### 4.1 Why SQS as the front door (vs. synchronous webhook handler)

> "Three reasons. One — partner bursts. When an airline runs an irregular operation (IROP), they can cancel hundreds of flights in a window, and MMT pushes those events to us in a burst. SQS gives us bounded backpressure: queue absorbs the burst, our consumer drains at our own rate. Two — at-least-once is MMT's posture, so we wanted at-least-once on our wire too, with the dedupe handled cleanly inside our boundary. Synchronous webhook handling would have meant inventing a retry guarantee on top of HTTP. Three — outage isolation. If our downstream booking system has a bad afternoon, SQS holds the events and we catch up after recovery. The customer-pain we were fixing was 'Amazon is silent on cancellations'; if our pipeline is down, we want to be loud about being behind, not quiet about losing events."

### 4.2 Why DynamoDB for dedupe (vs. relational)

> "DynamoDB gave us three things this workload needed. One — single-key access pattern. The dedupe lookup is always 'is this exact event id × booking id × sector already known?' That's a hash-key access, ~1ms p99, no joins. Two — bounded write contention. Conditional writes (`PutItem` with `attribute_not_exists`) gave us the idempotency primitive at the storage layer — we don't need application-level locking to prevent the duplicate-event race. Three — operational simplicity. DynamoDB's failure modes are well-understood, the retry semantics are partner-event-friendly, and it scales without a DBA in the loop. The relational system holds the *current state of the booking*; DynamoDB holds dedupe history. Different jobs, different stores."

### 4.3 Why Step Functions for the workflow (vs. one big Lambda)

> "A flight modification isn't one operation. It's: validate booking → classify event sub-type → branch into cancel / date-change / FNO / Plan B handlers → on each branch, retry transients, escalate unsafe states, write the modification, audit each transition, fire downstream comms. Putting all of that in one Lambda gives you a thousand-line method with implicit state, hard-to-test branches, and zero observability into where a particular booking got stuck. Step Functions makes the state machine a first-class artifact. Each transition is observable in the console. Retries are declarative. Adding Plan B sub-types in Phase 0.5 was additive — new branches, no restructuring of existing paths. That visibility is what makes on-call viable."

### 4.4 The dedupe key — what goes into it

```
dedupe_key = stable_hash(
    booking_id,         // MMT's booking identifier
    event_id,           // partner-supplied event id (when present)
    event_sub_type,     // FNO / DATE_CHANGE / SEGMENT_CANCEL / PLAN_B_*
    source,             // origin system identifier
    sector_passenger_id // for sector-level events
)
```

**Why those fields:**
- `booking_id` — scopes dedupe to one booking.
- `event_id` — when MMT provides one, it's the strongest signal of "same logical event."
- `event_sub_type` — distinguishes a re-delivered FNO event from a follow-up DATE_CHANGE on the same booking.
- `source` — protects against confusion if multiple partner systems route through the same pipeline.
- `sector_passenger_id` — MMT emits per-sector for multi-leg bookings, so a booking-level key alone would collapse independent sector events.

**What's deliberately NOT in the key:**
- Timestamps (replays preserve the original timestamp; including it would defeat dedupe).
- Payload hashes (event payloads can vary slightly on retry — whitespace, ordering — so payload-hashing creates false duplicates of the dedupe).

### 4.5 The OMS / Checkout integration — `attributeId=73` reuse

We did NOT add a new order attribute. I reused the existing `offlineModification` slot (id 73) and added new modification types into it (`COMPLETE_BOOKING_NON_OPERATIONAL`, `COMPLETE_BOOKING_NON_OPERATIONAL_REFUNDED`, `PARTIAL_BOOKING_NON_OPERATIONAL`, `PARTIAL_BOOKING_NON_OPERATIONAL_REFUNDED`). Why this was a product-shaped call:

- Adding a new attribute would have required a Pantheon migration coordination, frontend coordination, and a write-surface change.
- Reusing 73 meant zero migration, the OMS event flow already worked end-to-end, and the frontend just needed to learn new string IDs.
- It saved ~3 weeks of cross-team coordination at the cost of a slightly less semantically clean schema.

That's the kind of trade-off a good FDSE+PM makes early — it's not the "right" abstraction, it's the right cost-vs-clarity decision for the timeline.

### 4.6 Boson translations + Pantheon migration

For each new modification type, four primary/secondary message variants (mobile-primary, mobile-secondary, desktop-primary, desktop-secondary) plus three CTA bundles (`yoOHLinks`, `yoODLinks`, `additionalActionCTAs`). Boson was being migrated to Pantheon (the Gurupa migration) mid-rollout, so changes had to land in BOTH the legacy `flightsYoMessage.json` and the new Pantheon translation package. I owned that dual-source coordination — see Story 2 below.

### 4.7 Audit log shape

Append-only. Each row captures: `(event_id, booking_id, sector_passenger_id, state, timestamp, detail_json)`. State values: `received` → `validated` → `deduped` (or `processing`) → per-branch transition states → `succeeded` / `escalated` / `failed`. The "current state of a sector after this event chain" is the latest row by timestamp for the sector. Costs a tiny bit of read complexity but buys complete history for finance reconciliation, customer-service investigations, and post-mortems.

---

## 5. Three product decisions worth defending

### Decision 1 — Treat FNO as terminal in Phase 0

**The setup.** MMT's data showed flight reinstatement (a cancelled flight being re-activated by the airline) was vanishingly rare. The "right" thing was to model the lifecycle as a state machine — FNO → REINSTATED is a valid transition. Cost: another month of design and code to handle reinstatement properly.

**The product call I made.** Treat FNO as terminal in Phase 0. Log reinstatement attempts, alarm on them, but don't process them automatically.

**Reasoning.**
- MMT's manual cancellation flow already had a human-verification step downstream — a customer service agent re-checks airline status before finalizing — so the customer-service safety net catches the rare reinstatement.
- Bounded customer-pain risk: a reinstated-flight customer would still find out the right answer through CS, just not through Amazon's UI.
- Unblocks the high-volume cases (cancellations, the dominant 31 bps line item) instead of pushing everything to a later phase.

**How to articulate it.**
> "I scoped down explicitly, not implicitly. Reinstatement was real, but rare. Cost of getting reinstatement wrong was bounded — customer would still get the right answer through CS. Cost of waiting another quarter was unbounded — every quarter of delay was 31 bps of customer pain we weren't fixing. So I shipped FNO-as-terminal with monitoring on the rare reinstatement events, documented the gap, named what would change in Phase 1. That's the trade I'd make again. It's the product judgment that ships things."

### Decision 2 — DynamoDB for dedupe, RDS for booking state

Already covered in §4.2. The interviewer-ready version: **"Single-key access pattern + conditional-write idempotency + operational simplicity → DynamoDB. Booking state isn't on the critical path of the dedupe → keep it relational. Two stores, two jobs, no shared bottleneck."**

### Decision 3 — Process per-sector, not per-booking

MMT sends webhooks per affected sector. The naïve model is "wait for all sectors of a booking, then process the booking once." The right model — and what I shipped — is "process each sector independently as it arrives."

**Why.**
- A two-leg booking where only one leg gets cancelled would otherwise hang waiting for a second-leg webhook that never comes.
- Sector-independent processing means the orchestrator code is order-agnostic — out-of-order arrival converges to the right state.
- The "did the WHOLE booking get cancelled or just part?" question becomes a SELECT, not a state machine: count active sectors at write time. Zero → COMPLETE_BOOKING_NON_OPERATIONAL. Else → PARTIAL_BOOKING_NON_OPERATIONAL.

---

## 6. Leadership stories — STAR format, full ownership claimed

> **These are leadership stories the way you'd tell them in a Sr. FDSE / Product loop.** Every story has a named partner counterpart, a documented decision, a measured outcome, and explicit cross-team ownership.

### Story 1 — Owning the partner contract with MMT (the `scheduleChangeType` ambiguity)

**Situation.** During the design review, MMT's Booking Details API response included a field `scheduleChangeType` (an integer code) inside the `modificationTypeObjectMap`. MMT had not documented what the integer values meant. Boson Design Review meeting was two weeks out. The schema was blocked on this field.

**Task.** Either get clarity from MMT, decide we could ship without it, or defer Phase 0.

**Action.**
1. Set up a 30-minute sync with **Pratyush at MMT's Bookings Engineering team** — the integration counterpart on their side. Walked in with a one-page doc: here's our Phase 0 scope (FNO only), here's the parse path through `modificationTypeObjectMap`, here are the three questions we have about `scheduleChangeType`.
2. Pratyush's reply (which made it into the final BRD): "still working on it but it should not be a blocker — there is no use case to be built on this parameter for FNO case." Got that on email.
3. Made the call: ship Phase 0 reading **only** `scannerSchedChangeState` (which was documented and unambiguous — values like "FNO"), ignore `scheduleChangeType` for now, add it to Phase 1's investigation list.
4. Wrote a one-pager for the design review explaining the decision: "Phase 0 reads `scannerSchedChangeState` only. Phase 1 will revisit if any Schedule Change subtype needs `scheduleChangeType`." Got design-review sign-off.

**Result.** Phase 0 unblocked. MMT contract didn't change at the last minute. No surprise findings during launch. The same pattern — "name the unknown, get it in writing, scope around it" — repeated for two more ambiguous fields in subsequent phases.

**Why this story works for FDSE + Product.**
- **FDSE signal:** customer-facing communication with a partner, forward motion despite ambiguity, calibrated risk.
- **Product signal:** turned an unknown into a documented assumption, owned the decision in writing, didn't wait for a perfect spec.

---

### Story 2 — Coordinating the Boson × Pantheon migration during launch window

**Situation.** Mid-Phase-0, the Boson team — the platform team that owned `BosonOrdersPantherTranslationDatapathViews`, the translation package consumed by OD/YO — was migrating to Pantheon. Some teams had migrated, some hadn't. My new string IDs (e.g. `hfc-bookings-flights-oh-mobile-complete-booking-non-operational-primary-message`) needed to land in both the legacy `flightsYoMessage.json` and the new Pantheon translation package — otherwise some customers would see broken strings during the migration window.

**Task.** Land 12 new string IDs across two systems with mutually-incompatible deploy semantics, without holding up Phase 0 launch and without becoming the team that broke customer-facing strings during a partner-team migration.

**Action.**
1. Met with the Boson team owner. Got a clear answer: at launch, ~70% of traffic was on the legacy translation system, ~30% on Pantheon, expected to flip in 4 weeks.
2. Decided: ship to BOTH systems, treat `flightsYoMessage.json` as primary (covers 70%), Pantheon as secondary (covers 30% but is the future).
3. Wrote one PR per system with identical message-id naming (so the resolution code didn't need branching). Got both reviewed in parallel by their respective platform owners.
4. Ran a verification post-deploy on a test booking with FNO state — verified the primary message rendered correctly on both Pantheon-enabled and Pantheon-disabled traffic.
5. Documented the dual-source-of-truth as a known time-boxed gap, owned by me, with a deletion plan for once Pantheon hit 100%.

**Result.** Zero regressions at launch. When Pantheon flipped to 100% three weeks later, the strings were already in the new home — no follow-up work, no scramble. The Boson team owner explicitly called this out as the right pattern for other teams to copy during the migration.

**Why this story works for FDSE + Product.**
- **FDSE signal:** living with partial migrations is the FDSE customer reality (Salesforce-to-Salesforce-Data-Cloud, on-prem-to-cloud, etc.).
- **Product signal:** owned a coordination problem instead of waiting for it to be solved; shipped a pattern other teams could reuse.

---

### Story 3 — Negotiating the UCF notification SLA in writing

**Situation.** The Phase 0 BRD said "trigger customer notifications via UCF" (User Communication Framework — the platform team that owns email + SMS dispatch). UCF's stated SLA for `/v1/notification` was a rolling p99 of 800ms with documented 99.9% availability. My webhook handler's NFR was "OD/YO API increase by no more than double-digit ms" — which meant I couldn't synchronously block on UCF.

**Task.** Decide whether notification dispatch was synchronous (in the webhook handler) or asynchronous (queued for later), and get the UCF team aligned on the choice in writing.

**Action.**
1. Inventoried the consequences: synchronous + slow = MMT might retry → dedupe table catches it but it's noise. Asynchronous + queue = adds delivery latency and a new failure surface (the queue itself).
2. Met with the UCF team owner. Asked the product-shaped question: what's the customer-experience cost of a notification arriving 10 seconds vs 60 seconds vs 5 minutes after the OD page updates? Their answer: 5 minutes is fine for FNO-class events because customers don't typically refresh OD in real-time waiting for a flight cancellation update.
3. Made the call: synchronous call to UCF inside the webhook handler, but with a 1-second timeout and graceful degradation. If UCF times out, log the failure and emit a metric — do NOT fail the webhook, do NOT retry the whole pipeline. The OMS/DB writes are committed; the notification is best-effort.
4. Got the UCF team owner to formalize the contract on a one-pager: "For FNO webhook flow, UCF call is best-effort with 1s timeout. UCF team is responsible for catching the missed-notification metric and triaging."
5. Added a CloudWatch alarm: "if UCF timeout rate on FNO path > 1%, page UCF on-call." That alarm went into the launch checklist.

**Result.** Notification SLA met without architectural complexity. When Phase 1 added more event sub-types, the same pattern — synchronous-with-timeout, best-effort, metric-monitored — applied without rework. UCF on-call ownership was clear, mine was clear, and the customer-experience contract was written down.

**Why this story works for FDSE + Product.**
- **FDSE signal:** customer-experience-driven trade-off, not "what's technically pure."
- **Product signal:** negotiated a contract with a partner team in writing, with measurable success criteria and explicit ownership of the alarm.

---

### Story 4 — A late-stage scope cut driven by IndiGo's Plan B

**Situation.** Two weeks before Phase 0 launch, the Product team came back asking: "Can we also handle IndiGo's Plan B in Phase 0? They're our biggest LCC partner." Plan B is IndiGo's customer-service flow for cancellations: customer can accept the new flight (`PLAN_B_CHNG_ACCEPT`), pick a different flight (`PLAN_B_ALT_FLIGHT`), or take a refund (`PLAN_B_REFUND`).

**Task.** Either expand scope to include Plan B (3 new event subtypes, new database states, new UI strings, new email/SMS templates) and risk the Q4 ship, or hold the line and re-frame the conversation.

**Action.**
1. Ran the math out loud: each Plan B sub-event needed (a) a new modification type ENUM in the offline modification table, (b) a new `booking_status` value, (c) handling for the case where the customer's original PNR is now invalid and a new PNR comes back from MMT, (d) corresponding strings + email/SMS templates. Honest engineer-week estimate: 4 engineer-weeks. Buffer remaining: 2.
2. Took it to my manager + Product VP. Framed it as: "Phase 0 ships FNO on time and starts cutting the 31 bps line. Plan B becomes Phase 0.5, ships 4–5 weeks later, and cuts the partner-specific portion. Net total customer-pain reduction across the same horizon: same. Net launch risk in Q4: lower."
3. Got the call: hold the line, ship FNO on time, Plan B = Phase 0.5.
4. Spent the saved capacity on hardening monitoring for the FNO launch — runbooks, dashboards, soak-testing the dedupe table, making sure the alarms paged the right rotation on the first weekend post-launch instead of the second.

**Result.** Phase 0 shipped on schedule. Phase 0.5 (Plan B) shipped 5 weeks later — small overrun on Plan B itself, but with the FNO launch already monitored and stable, the Plan B rollout was lower-risk than it would have been had we packaged everything together.

**Why this story works for FDSE + Product.**
- **FDSE signal:** saying no to scope creep with the math, not with vibes.
- **Product signal:** explicit phasing language ("Phase 0.5") instead of fighting about scope, used saved capacity for hardening — the right answer at-launch is monitoring, not new features.

---

### Story 5 — On-call: triaging a duplication storm without rolling back

**Situation.** ~3 weeks post Phase 0 launch, on a Sunday afternoon, alarms fired for "duplicate webhook processing rate above threshold." MMT was sending the same webhook ~10x per minute for ~20 distinct bookings.

**Task.** Triage the storm under time pressure, decide whether to escalate to MMT, decide whether to roll back our deploy.

**Action.**
1. Pulled up the dashboard. The dedupe table (`offline_modification_requests`) was working — every duplicate caught at the DB layer with a unique-constraint violation, no double-processing reached OMS or notifications. Customer impact: zero.
2. Pulled the logs to see WHY MMT was retrying. Found that MMT was getting 200 OK from us but interpreting it as a partial failure on their side because of a client-timeout difference — their timeout was 5 seconds, our handler was occasionally taking 6–7 seconds during the Booking Details API call burst.
3. Did NOT roll back. The dedupe was holding, customer impact was zero, the only cost was extra log volume.
4. Filed a SIM ticket on Pratyush's queue at MMT explaining what we'd seen, with traces. Asked them to bump their client timeout to 10 seconds.
5. In parallel, optimized our side — added a small in-memory cache so multiple webhooks for the same booking within 30 seconds shared a single Booking Details API call. Brought our handler p99 back inside MMT's 5-second timeout.
6. Wrote up the incident as a COE (Correction of Error). Closed it 48 hours later.

**Result.** Duplicate rate fell to baseline within a week. Zero customer impact, zero data corruption, zero rollback. MMT bumped their timeout. Our caching change saved ~30% of Booking Details API traffic going forward.

**Why this story works for FDSE + Product.**
- **FDSE signal:** calm in an actual incident, triaged by impact rather than alarm volume.
- **Product signal:** worked with the partner side (MMT) to fix the root cause, not just paper over symptoms; turned the incident into a permanent system improvement (the cache).

---

### Story 6 — Owning the BRD and design review

**Situation.** The Flights Offline Modifications problem was visible in the data but had no design — just a "we should probably fix this" on the team backlog. To get it prioritized, I'd need a BRD a VP would sign off on.

**Task.** Write the BRD, run the design review, get cross-team commitment from MMT, OMS, Boson, UCF, Frontend, and Support — without a PM in the room.

**Action.**
1. Wrote the BRD myself: problem statement (43 bps CPT thesis), tenets (long-term thinking, customer-centric communication, scalability), Phase 0 scope (FNO terminal), success criteria (100% FNO processed, zero duplicate notifications, monitoring on reinstatement attempts), three database approaches with trade-off comparisons (RDS / DynamoDB hybrid / RDS-with-key-value), the recommended approach (RDS + DynamoDB hybrid for our shape) with explicit reasoning, and the implementation metrics.
2. Ran the design review with all six counterpart teams in one meeting. Came in with each team's specific contract pre-drafted in the BRD — so the meeting was about adjustments, not introductions. Walked through the architecture diagram, the failure-mode matrix, and the phased delivery plan.
3. Captured every objection in real time. Boson wanted clarification on the Pantheon migration coordination. UCF wanted the timeout contract written down. Frontend wanted the additionalActionCTAs schema explicit. OMS wanted to confirm `attributeId=73` reuse wouldn't break Purchase Doc generation. I addressed each one, updated the BRD, sent it for written sign-off within 48 hours.
4. Got the VP-level sign-off, locked Q4 timeline, started building.

**Result.** Phase 0 had explicit cross-team commitment in writing before any code was written. When ambiguities surfaced mid-build, I had a document to point to. When Phase 0.5 conversations happened, the BRD's own phasing language did half the work of selling the decision.

**Why this story works for FDSE + Product.**
- **Product signal:** owned the problem framing, the customer-pain quantification, the trade-off articulation, and the cross-team contract negotiation. This is the part of the role most candidates skip.
- **FDSE signal:** the BRD wasn't a PM document — it was an engineering artifact with database schemas, retry policies, latency budgets, and failure-mode matrices. The execution and the strategy lived in the same doc, owned by the same person.

---

## 7. Likely interview questions + crisp answers

### 7.1 Architecture / system design

**Q: Walk me through what happens when a flight gets cancelled.**
> "Airline cancels at MMT. MMT's flights team converts that into a SCHEDULE_CHANGE webhook with sub-type FLIGHT_NON_OPERATIONAL, hits our API Gateway. Gateway acks immediately — we don't make MMT wait. SQS picks up the message. Our Java consumer pulls it, validates the shape, computes the dedupe key from `(booking_id, event_id, event_sub_type, source, sector_passenger_id)`, and does a DynamoDB conditional write. If the key exists, we no-op safely. If new, we pull current booking from RDS, call MMT's Booking Details API to confirm which sectors are actually affected — parsing `flightDetails → segmentGroupDetailList → segmentDetails → modificationTypeObjectMap` — and hand off to a Step Functions workflow. The workflow validates the PNR, classifies as FNO, runs the FNO branch — write the sector-level modification, append audit events at every transition, retry transient downstream failures, escalate any contradictions. On success, fire downstream comms (UCF email + SMS), update OMS via attributeId=73 → triggers OTS event → YO Purchase Doc updates → OD page picks up the new primary/secondary message via Boson translations. End to end, ~2 seconds."

**Q: Why not just process events synchronously in the webhook handler?**
> "Two reasons. One — partner bursts. An IROP event from one airline can produce hundreds of cancellations in seconds; a synchronous handler would either drop events, time out, or DDOS our downstream booking system. SQS gives us bounded backpressure. Two — at-least-once is MMT's posture, so we wanted at-least-once on our wire too, with the dedupe handled cleanly inside our boundary. Synchronous webhook handling would have meant inventing a retry guarantee on top of HTTP. SQS + DynamoDB conditional-write is the cleaner separation."

**Q: What's your rollback strategy if a deploy is broken in production?**
> "Three layers. One — SQS holds events while we deploy a fix; MMT doesn't see anything different. Two — if a specific event sub-type is broken (say a Plan B flow in Phase 0.5), the workflow's classification branch can be hot-fixed to return 'deferred' for that sub-type while we ship the fix, and we replay the deferred ones from the audit log afterward. Three — the per-sector model means a bad event for one sector doesn't taint sibling sectors of the same booking — blast radius is one row in the modification log."

**Q: Where are the cross-team contracts in this design?**
> "Six contracts. One: MMT to us — webhook payload schema and Booking Details API. Two: us to OMS — `attributeId=73` plus the modification type ENUM. Three: us to Boson translations — string IDs in `flightsYoMessage.json` and Pantheon equivalent. Four: us to UCF — notification template names and the best-effort SLA we wrote down. Five: us to frontend — the `additionalActionCTAs` schema in the Checkout response. Six: us to support / CS — the manual-escalation queue contract. Each one is a place where a contract change in either direction breaks the integration. I owned the document that named which team owned which contract."

### 7.2 Data / database

**Q: Why DynamoDB for dedupe and not a relational table?**
> "Single-key access pattern. The dedupe lookup is always 'is this exact event for this booking already known?' Hash-key get, sub-millisecond, no joins, no schema migration to add new attributes. DynamoDB's conditional writes (`PutItem` with `attribute_not_exists`) give us the idempotency primitive at the storage layer for free; no application-level locking. Operationally, scales without a DBA. The relational system holds *current state of the booking*; DynamoDB holds dedupe history. Different jobs."

**Q: How big does the dedupe table get? What's the retention policy?**
> "10–15% of bookings × roughly one event per affected sector × a small multiple for retries. Comfortable for DynamoDB at any realistic Amazon Travel volume. Retention bounded — we keep dedupe keys alive long enough to catch realistic MMT replays (multiple days, not forever) and either let TTL expire them or move them to colder storage. The audit log is the long-term record; the dedupe table is the hot lookup."

**Q: How would you redo the design at 10x scale?**
> "Three changes. One — partition the consumer pool. SQS scales horizontally already; the workflow side can run more concurrent Step Function executions if Lambda concurrency limits start showing up. Two — caching for frequently-read booking-state lookups (which I added in Story 5 in response to the Booking Details API burst). Three — if write volume on DynamoDB became real, conditional-write contention on a single hot booking is the failure mode to watch — partition the dedupe key further or batch-write to reduce throttle exposure. None of these are needed at current volume; they're the next moves if we 10x'd."

### 7.3 LLM / GenAI tie-in (since UnifyApps is a GenAI platform)

**Q: Where could GenAI improve this system?**
> "Three places. One — the `scannerSchedChangeState` field is structured but airline-specific quirks underneath it (Plan B, partner-specific reschedule reasons) are not. An LLM could normalize free-text reason strings into a consistent taxonomy. Two — customer-facing primary/secondary messages are templated today. A constrained-prompt LLM could generate context-aware messages — 'Your IndiGo flight from Bombay to Bangalore was cancelled. The next available flight is at 6:30 PM tomorrow' — using booking + availability data. Three — anomaly detection on the webhook stream: an LLM-based classifier on volume + sub-type distribution could flag 'this looks like an IndiGo-wide IROP event' and route those webhooks through a different path with batched comms instead of per-customer notifications. None of this replaces the deterministic core; all of it is augmentation."

**Q: How do you keep an LLM-augmented pipeline reliable?**
> "Same way we kept the deterministic pipeline reliable — strict contracts and graceful degradation. The LLM call goes through a Protocol with a deterministic fallback. If the LLM is slow or returns malformed output, we fall back to the templated string. Customer never sees a worse experience than they'd see today; sometimes they see a better one when the LLM is healthy. That's the right trade for any LLM bolt-on to a critical-path system."

### 7.4 Behavioral / leadership / product

**Q: How did you decide who owned what across teams?**
> "I drew a contract diagram before writing any code. Each box was a team — MMT, OMS, Boson, UCF, Frontend, Support. Each arrow was an API or a schema. For each arrow, I named the owning team, the failure modes, the SLA, and the escalation path. That diagram lived in the BRD and came up in every cross-team meeting. When someone asked 'who fixes this if it breaks,' the answer was already on the slide. Half of leading a cross-team integration is making contracts visible enough that ownership stops being ambiguous."

**Q: What's the hardest conversation you had on this project?**
> "The Phase 0.5 conversation about Plan B (Story 4 above). Product wanted Plan B in Phase 0; the timeline didn't fit. Hardest because the people asking were right that Plan B was important — 8 bps of CPT we'd be leaving on the table for 5 more weeks. Hardest because 'no, but here's a phased version' is harder to land than 'yes' or 'no.' I went in with the math written down — number of new event types, database changes, frontend strings, engineer-weeks per — and made the case in the language of risk to the Q4 ship. Got the call I wanted. The thing that worked was being honest about the cost; not undersells, not over-sells."

**Q: What would you do differently?**
> "Two things. One — sustained-load testing before launch. We had unit tests, integration tests, and a small load test, but we didn't run a sustained-traffic test against the dedupe + workflow path. The duplicate-storm incident in Story 5 was partly because our handler p99 was longer than MMT's client timeout under burst load. A dedicated load test would have caught that. Two — earlier partnership with the manual-escalation owners. The escalation queue was wired in at the right time, but I'd start the conversation with the support team a sprint earlier so the queue's UX matched their workflow on day one rather than after the first round of feedback."

**Q: Why does this experience matter for UnifyApps FDSE / Product?**
> "Because Forward-Deployed and Product work IS this work. MMT was an enterprise integration partner with a quirky API and unwritten conventions — that's exactly what UnifyApps customers' Salesforce, ServiceNow, SAP, Workday installations look like. The cross-team alignment with Boson / UCF / OMS / Frontend / Support was exactly what shipping inside a Fortune 500 customer looks like. Phase 0 / Phase 0.5 / Phase 1 was scope-management under timeline pressure — exactly the cadence FDSE / Product engagements run at. The technical primitives — webhooks, queues, idempotency, retries, audit logs, structured eventing — are the same primitives a UnifyApps automation pipeline is built out of. The product primitives — customer-pain quantification (43 bps), explicit phasing, written cross-team contracts, escalation paths for unsafe automation — are the same primitives a UnifyApps customer engagement runs on. I've shipped this stack at scale at Amazon. I want to ship the same shape of work for UnifyApps customers."

---

## 8. Amazon Travel → UnifyApps mapping (the "why this experience matters" answer)

| Amazon Travel context | UnifyApps FDSE / Product equivalent |
|---|---|
| MakeMyTrip = enterprise integration partner with a webhook API and unwritten conventions | Customer's existing iPaaS / data partner (Salesforce / Workday / ServiceNow / SAP) with quirky APIs and lived-in business rules |
| IndiGo's Plan B = airline-specific quirks layered on top of the partner's API | Customer-specific business rules layered on top of standard CRM/ERP behaviors (account hierarchies, regional regulations) |
| Phase 0 → 0.5 → 1 = scope-management under timeline pressure | Sprint 1 → Sprint 2 → GA = exactly the cadence of FDSE customer engagements |
| Boson / Pantheon / Gurupa migration = an internal platform shift mid-project | A customer's in-flight migration (e.g. moving from on-prem Salesforce to Salesforce Data Cloud while we're building the integration) |
| `flightsYoMessage.json` translation strings | UnifyApps-platform-driven UI strings consumed by customer-facing apps |
| OMS / `attributeId=73` reuse | Reusing existing customer-system attribute slots instead of forcing schema migrations |
| MMT Booking Details API as source-of-truth | Customer's own SOR (Salesforce, ServiceNow) as source-of-truth even when an event stream is also available |
| 43 bps CPT business case | Customer's stated success metric (NPS, reduced ticket volume, time-to-revenue) — same shape, different number |
| Pratyush at MMT | The customer's lead engineer or partner-team counterpart |
| Cross-team alignment with Boson / UCF / OMS / Frontend / Support | Cross-team alignment with UnifyApps Product, Engineering, and the customer's IT org |
| BRD ownership | Customer-facing one-pagers, kickoff docs, weekly customer reports |

This mapping is the one-slide answer to "why does this experience translate." Pre-bake it.

---

## 9. PM-rubric callouts (in case you're being evaluated as Product, not just FDSE)

If the loop tilts toward Product, lean on these explicit framings:

1. **Customer-pain quantification.** I didn't get assigned this project — I surfaced the 43 bps CPT thesis from internal data, wrote the BRD, and got VP-level sign-off on Q4 priority.
2. **Phasing decisions.** Phase 0 (FNO terminal) → Phase 0.5 (Plan B) → Phase 1 (full schedule-change taxonomy). Each phase had explicit success criteria, explicit exclusions, and explicit "why this and not that" reasoning.
3. **Stakeholder management.** Pratyush at MMT, the Boson team owner, the UCF team owner, the OMS team owner, the Frontend team owner, the Support / CS team — six counterparts, six contracts, all in writing.
4. **Trade-off articulation.** Three database approaches evaluated with explicit pros/cons. The chosen approach (RDS + DynamoDB hybrid) was defended in the BRD with cost, scalability, latency, and operational-overhead arguments.
5. **Scope discipline.** Said no to scope creep (Plan B in Phase 0) with the math, not with vibes. Used saved capacity for hardening — the right answer at-launch is monitoring, not new features.
6. **Outcome ownership.** Phase 0 success criteria were measurable: 100% of FNO cases processed, zero duplicate notifications, complete monitoring of reinstatement attempts. Each one was tracked on a CloudWatch dashboard I set up before launch.
7. **Post-launch ownership.** Triaged the duplication storm in Story 5 without rolling back, used it to drive a permanent improvement (the in-memory cache), wrote the COE, closed the loop with MMT.

Any one of those points is a 60-second answer to a Product-rubric question. Three of them in the same answer is a Hire signal.

---

## 10. Anti-patterns to avoid in any answer

1. **Don't lead with code.** Lead with the customer pain (43 bps), then the partner contract (MMT), then the system shape, then the code. Engineers who lead with code in dual-rubric loops under-index on the role.
2. **Don't use Amazon-internal jargon untranslated.** "Boson," "Pantheon," "Gurupa," "OD," "YO" — translate each one in 5 words the first time. "OD is the Order Details page, the equivalent of a Shopify post-purchase page." If the interviewer doesn't know the term, you've spent 20 seconds being incomprehensible.
3. **Don't say "we" when "I" is true.** This isn't ego, it's signal. "I made the call to treat FNO as terminal" tells the interviewer you can carry a decision. "We made the call" doesn't. You owned this.
4. **Don't dismiss the trade-offs you didn't pick.** When defending RDS + DynamoDB over pure DynamoDB, say WHY the alternatives were real options, then why they lost. Engaging with alternatives sounds calibrated; dismissing them sounds defensive.
5. **Don't volunteer DSA.** If they ask "what's your favorite algorithm," answer the question, but don't pivot a customer-empathy interview into a leetcode flex. Use the deflection from `UNIFYAPPS_FDSE_INTERVIEW_CHEATSHEET.md` §8.
6. **Don't undersell the product side.** UnifyApps is a "Product & FDSE Hiring" loop. The 43 bps thesis, the BRD ownership, the phased delivery, the cross-team contracts — these are Product signals, not afterthoughts. Lead with them when the rubric tilts that way.

---

## 11. Pre-call checklist (run 30 minutes before the loop)

- [ ] Re-read the BRDs in `Interview-Prep/flight-offline-modification/`. Once.
- [ ] Memorize the numbers in §2 (43 bps, 31/8/4, 10–15%, Q4 2024, attr id 73, 20 max retries).
- [ ] Memorize the dual-role pitch in §0.
- [ ] Run through the 6 leadership stories in §6 out loud. Each one ≤90 seconds spoken.
- [ ] Have the §3 architecture diagram loaded mentally — be ready to draw it on a whiteboard.
- [ ] Re-read §8 (the Amazon → UnifyApps mapping). The answer to "why this experience matters."
- [ ] Re-read §9 (PM-rubric callouts) — have all 7 ready as 60-second answers.
- [ ] If they ask DSA, deploy the deflection from `UNIFYAPPS_FDSE_INTERVIEW_CHEATSHEET.md` §8.
- [ ] If they ask about the take-home repo (`praxstack/unifyapps-fdse-assignment`), pivot through `UNIFYAPPS_FDSE_INTERVIEW_CHEATSHEET.md`.

---

## 12. Post-call — update this doc

After each loop, write:
- The one question you wished you'd answered differently.
- The actual answer you'd give now.
- Anything they pushed on that you didn't anticipate.
- Anywhere you under-claimed when full ownership was true.

By loop 3, this doc is sharper than your first answer was. That's the loop.
