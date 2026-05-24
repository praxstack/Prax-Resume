# UnifyApps FDSE Project Answer Bank - HFC Flights Offline Modification

> Audience: private interview prep for Prakhar.
> Goal: explain the HFC Flights offline modification / schedule-change system with senior FDSE (Forward Deployed Software Engineer), PM (Product Manager), and system-design depth.
> Source material inspected: MMT Webhook Info, MMT-AMZ Flights CPT discussion summaries, Flights Offline Modification BRD, existing private answer-bank docs.
> Guardrail: if exact partner ownership is challenged, say "I worked with partner/integration stakeholders" unless you can truthfully say you directly managed MMT (MakeMyTrip) and airline conversations.

---

## 1. Terms To Say With Full Forms

- HFC (High Frequency Categories): Amazon internal category platform area.
- FDSE (Forward Deployed Software Engineer): engineer embedded close to customer/stakeholder problems to build solutions.
- PM (Product Manager): product owner responsible for customer problem, scope, metrics, and roadmap.
- MMT (MakeMyTrip): partner Online Travel Agency system sending flight booking modification webhooks.
- OTA (Online Travel Agency): travel marketplace such as MakeMyTrip, Expedia, or Booking.com.
- CPT (Contacts Per Transaction): customer-support contact rate per booking/transaction.
- bps (basis points): 1 bps = 0.01 percentage points.
- PNR (Passenger Name Record): airline booking reference.
- GDS (Global Distribution System): travel distribution network for airline inventory and reservations.
- LCC (Low-Cost Carrier): airline model like IndiGo or SpiceJet.
- FNO / FNOP (Flight Non-Operational): airline/partner signal that a flight segment is not operational.
- TDCWA (Ticket Directly Cancelled With Airline): customer cancelled the ticket directly with the airline.
- ODC (Origin Date Change / Date Change): customer-side date/time change at airline.
- IROP (Irregular Operations): airline disruption such as cancellation, delay, or operational change.
- Webhook: HTTP callback from MMT (MakeMyTrip) to Amazon when an event occurs.
- SQS (Simple Queue Service): Amazon Web Services queue used for event buffering.
- DLQ (Dead-Letter Queue): queue for poison or exhausted messages.
- DynamoDB (Amazon DynamoDB): managed NoSQL database used for dedupe (deduplication), state, or audit.
- Dedupe key (Deduplication key): stable key used to detect duplicate events.
- Idempotency: safe repeat behavior; same event can be retried without duplicate side effects.
- At-least-once delivery: event can arrive one or more times; duplicates are expected.
- Exactly-once side effect: the business mutation happens once even if processing retries.
- Step Functions (AWS Step Functions): managed state-machine workflow service.
- API (Application Programming Interface): contract for systems to communicate.
- OD (Order Details): post-purchase page where customers see booking status.
- YO (Your Orders): Amazon order list/post-purchase entry point.
- UCF (User Communication Framework): internal framework for customer notifications such as email/SMS.
- SLA (Service Level Agreement): external committed target.
- SLO (Service Level Objective): internal reliability target.
- COE (Correction of Error): Amazon-style incident/root-cause write-up.
- RCA (Root Cause Analysis): investigation of why a failure happened.
- Offline modification: booking change processed outside the immediate customer checkout flow.

---

## 2. 30-Second Pitch

I designed the flight offline modification system as an event-driven partner integration. MMT (MakeMyTrip) sends schedule-change webhooks when an airline cancels, reschedules, or modifies a flight segment, and Amazon needs to update the booking, customer communication, OD (Order Details), refund/claim flow, and support context.

The customer problem was measurable: airline disruption cases were a major CPT (Contacts Per Transaction) driver. The BRD (Business Requirements Document) quantified 43 bps (basis points) CPT (Contacts Per Transaction): 31 bps from airline cancellations, 8 bps from customer-direct airline cancellations, and 4 bps from schedule changes. The system goal was to turn silent partner events into trustworthy Amazon-side booking state and communication.

My architecture used webhook ingestion, SQS (Simple Queue Service) buffering, DynamoDB (Amazon DynamoDB) dedupe (deduplication) and state, Step Functions (AWS Step Functions) for branching workflows, and audit/manual escalation for unsafe cases.

---

## 3. Simple Problem Explanation

Flight systems are messy because the customer can buy on Amazon, the airline can change the flight, and MMT (MakeMyTrip) may be the first party to know. Amazon cannot rely only on its original booking data after purchase.

The system needs to answer:

- Did an airline event happen?
- Which booking and segment does it affect?
- Is the event terminal, like cancellation, or non-terminal, like schedule change?
- Should Amazon update OD (Order Details), send SMS/email, initiate refund/claim flow, or ask support to verify?
- What if the same webhook arrives twice?
- What if two webhooks arrive for two segments of the same booking?
- What if MMT (MakeMyTrip) has ambiguous data?

The clean mental model:

```text
Webhook tells us: "Something changed."
Booking Details API tells us: "What exactly changed."
Our workflow decides: "What should Amazon safely do next."
```

---

## 4. PM / Product Framing

Use this if asked "why did this matter?"

> "The problem was not just that a backend event was missing. The customer was seeing stale truth. If an airline cancelled a flight and Amazon still showed the trip as normal, the customer either missed the disruption or called support. That created a trust problem and a measurable support-cost problem. I framed the product goal as: every meaningful airline-side disruption should become a customer-visible Amazon state with the right next action."

Metrics to mention:

- 10-15% of total flight bookings affected by airline-initiated reschedules or cancellations.
- 43 bps (basis points) CPT (Contacts Per Transaction) total opportunity.
- 31 bps airline cancellation.
- 8 bps TDCWA (Ticket Directly Cancelled With Airline).
- 4 bps schedule changes.
- Target CPT (Contacts Per Transaction) reduction: 20-30 bps depending on conservative vs. target calculation.
- Customer communication coverage for OD (Order Details), email, SMS, and later WhatsApp if platform support exists.
- Duplicate webhook rate.
- Unknown/manual escalation rate.
- Time from MMT (MakeMyTrip) webhook arrival to Amazon-visible OD (Order Details) update.

Product phasing:

- Phase 0: FNO / FNOP (Flight Non-Operational) and terminal cancellation path.
- Phase 0.5: IndiGo Plan B flows like refund, alternate flight, accept revised timing.
- Phase 1: broader schedule-change taxonomy: delayed, early, date change, flight changed, again as per schedule.

---

## 5. High-Level Design

```text
Airline / GDS / LCC (Global Distribution System / Low-Cost Carrier)
  |
  | airline cancellation / delay / reschedule / Plan B
  v
MMT (MakeMyTrip)
  |
  | POST /flights/webhook/booking/modify
  | event_type = SCHEDULE_CHANGE
  | event_sub_type = FLIGHT_NON_OPERATIONAL / SEGMENT_CANCEL /
  |                  SCHEDULED_CHANGED / DATE_CHANGE /
  |                  PLAN_B_ALT_FLIGHT / PLAN_B_CHNG_ACCEPT
  v
Amazon Partner Gateway / CheckoutConsumer proxy
  |
  | forward to Flights API
  v
Flights Webhook Processor
  |
  | validate payload
  | compute dedupe key
  | write dedupe/state to DynamoDB (Amazon DynamoDB)
  v
SQS (Simple Queue Service)
  |
  | at-least-once delivery; duplicates expected
  v
Step Functions (AWS Step Functions)
  |
  +--> call MMT Booking Details API
  +--> parse modificationTypeObjectMap per segment
  +--> classify event
  +--> branch workflow
        |
        +--> FNO / airline cancelled
        +--> SEGMENT_CANCEL / TDCWA
        +--> SCHEDULED_CHANGED / delay or early
        +--> DATE_CHANGE
        +--> Plan B refund / alternate / accept
        +--> unsafe or contradictory -> manual escalation
  |
  v
Amazon Booking State + Audit + Communications
  |
  +--> OD (Order Details) / YO (Your Orders)
  +--> Email / SMS / e-ticket
  +--> Claim refund CTA (Call To Action)
  +--> Support / CS (Customer Support) context
```

Core line:

> "The webhook is not the source of truth; it is the trigger. The MMT (MakeMyTrip) Booking Details API is the source of truth for affected segments."

---

## 6. Event Taxonomy

Events from MMT (MakeMyTrip):

- `SCHEDULE_CHANGE + FLIGHT_NON_OPERATIONAL`: FNO / FNOP (Flight Non-Operational).
- `SCHEDULE_CHANGE + SEGMENT_CANCEL`: can mean TDCWA (Ticket Directly Cancelled With Airline), airline cancelled, or Plan B refund.
- `SCHEDULE_CHANGE + SCHEDULED_CHANGED`: delayed, early, again as per schedule, flight changed, airline rescheduled.
- `SCHEDULE_CHANGE + DATE_CHANGE`: customer changed date/time at airline.
- `SCHEDULE_CHANGE + PLAN_B_ALT_FLIGHT`: customer selected alternate flight.
- `SCHEDULE_CHANGE + PLAN_B_CHNG_ACCEPT`: customer accepted revised flight timing.

Important ambiguity:

> "SEGMENT_CANCEL is intentionally treated with generic customer messaging because MMT may not know whether the origin was customer-direct airline cancellation or airline-initiated cancellation. When source is ambiguous, product language must not overstate causality."

---

## 7. Low-Level Design

### Dedupe Key

Use a stable dedupe (deduplication) key based on the event identity:

```text
bookingId + eventType + eventSubType + affectedSegmentId + sourceRequestId/eventId
```

If `event_id` is null or unreliable, use a deterministic fallback from booking, segment, subtype, and created timestamp bucket.

Interview wording:

> "I never assume partner webhooks are exactly-once. MMT (MakeMyTrip) can retry and SQS (Simple Queue Service) is at-least-once delivery. So idempotency is not optional; it is the core correctness primitive."

### Segment-Level Processing

MMT (MakeMyTrip) sends webhooks at booking-segment level. A two-segment booking can produce two events. The workflow must avoid conflicting updates for the same booking.

Design:

- Process per affected segment.
- Use booking-level ordering or per-booking queue partitioning if multi-segment conflicts are observed.
- Store each segment outcome separately.
- Aggregate for OD (Order Details) display.

### Source Of Truth

The webhook gives event metadata. After receiving it:

```text
Call MMT Booking Details API
  -> inspect flightDetails
  -> segmentGroupDetailList
  -> segmentDetails
  -> modificationTypeObjectMap
```

That node identifies cancelled, rescheduled, or modified segments.

### Workflow Branches

```text
Validate event
  |
  +--> duplicate -> no-op
  +--> invalid payload -> DLQ (Dead-Letter Queue) / manual review
  +--> known event
        |
        +--> fetch booking details
        +--> classify
        +--> update offline modification state
        +--> update customer-facing state
        +--> send communication
        +--> audit
```

---

## 8. Reliability And Recovery

### What Can Go Wrong

- Duplicate webhook.
- Late webhook after customer already cancelled on Amazon.
- Multi-segment webhooks arrive milliseconds apart.
- MMT (MakeMyTrip) Booking Details API throttles or returns incomplete data.
- Schedule-change enum mapping is unclear.
- FNO (Flight Non-Operational) later gets reinstated.
- OD (Order Details) update succeeds but communication fails.
- Communication succeeds but booking state update fails.

### Controls

- DynamoDB (Amazon DynamoDB) conditional write for dedupe (deduplication).
- SQS (Simple Queue Service) buffering for partner bursts.
- DLQ (Dead-Letter Queue) for poison events.
- Step Functions (AWS Step Functions) retries with backoff.
- Audit events for every state transition.
- Manual escalation for contradictory or ambiguous cases.
- Alarms on rare events such as post-FNO reinstatement.
- Generic messaging when event source cannot be proven.

Senior line:

> "The design goal was not to automate every case. It was to automate high-confidence cases and make low-confidence cases visible, replayable, and supportable."

---

## 9. Leadership / Stakeholder Answer

Use this for "How did you manage communication with MMT, airlines, and internal teams?"

> "I treated the project as six contracts, not one feature. There was a partner event contract with MMT (MakeMyTrip), a source-of-truth contract through Booking Details API, a workflow contract for event classification, a frontend contract for OD (Order Details) and YO (Your Orders), a communications contract for SMS/email/e-ticket, and an operations contract for support and manual review. My job was to make each contract explicit so product, support, MMT, frontend, backend, and operations were not interpreting the same event differently."

Strong version if true:

> "I drove the BRD, ran the design review, coordinated with the MMT (MakeMyTrip) integration counterpart, and kept product scope phased so Phase 0 shipped instead of waiting for the full schedule-change taxonomy."

Safe version:

> "I worked on the design/implementation and helped turn ambiguous partner event behavior into a written internal contract."

How to explain partner communication:

> "I did not ask the partner for a perfect API (Application Programming Interface). I asked precise questions: Can events duplicate? Can they arrive out of order? Is FNO terminal? Which node tells us affected segments? How do we identify affected passengers? What should Amazon do if the same segment has FNO and schedule-change events? Those answers shaped the state machine."

---

## 10. Product Tradeoffs

| Tradeoff | Decision | Why |
|---|---|---|
| Completeness vs time-to-market | Phase FNO first | FNO was high-impact and easier to classify. |
| Specific messaging vs safe messaging | Use generic messaging for SEGMENT_CANCEL ambiguity | Avoid telling customers wrong causality. |
| Full automation vs human verification | Escalate contradictory inputs | Travel changes can affect money and journey correctness. |
| Booking-level vs segment-level processing | Segment-level processing | MMT (MakeMyTrip) emits segment-level signals. |
| Real-time sync vs async pipeline | Async webhook + queue | Protects against partner bursts and downstream outages. |
| One big service vs workflow state machine | Step Functions (AWS Step Functions) | Branching and retries are visible and auditable. |

---

## 11. Likely Interview Questions And Answers

### Q1. Walk me through the system.

> "MMT (MakeMyTrip) receives or deduces airline-side events and sends Amazon a webhook at `/flights/webhook/booking/modify`. We validate the event, dedupe it using a stable event key in DynamoDB (Amazon DynamoDB), buffer it through SQS (Simple Queue Service), call the MMT Booking Details API to identify affected segments, and then run a Step Functions (AWS Step Functions) workflow based on subtype. The workflow updates offline modification state, customer-facing OD (Order Details) messages, communication, and audit. If the event is contradictory or incomplete, we escalate rather than corrupt booking state."

### Q2. Why call Booking Details API after webhook?

> "Because the webhook is a trigger, not enough truth. It tells us that a booking had a schedule-change event. It may not fully identify affected passengers or all segment details. Booking Details API gives the current partner-side truth through `modificationTypeObjectMap`, so the workflow makes decisions based on current source-of-truth data."

### Q3. Why SQS?

> "Partner webhooks are bursty. One airline disruption can create hundreds of affected bookings. SQS (Simple Queue Service) absorbs bursts, isolates downstream failures, and makes at-least-once delivery explicit. Once I accept at-least-once delivery, idempotency becomes a clear design requirement instead of an afterthought."

### Q4. Why DynamoDB for dedupe?

> "The access pattern is key-value: have I seen this event for this booking/segment before? DynamoDB (Amazon DynamoDB) conditional writes give atomic dedupe without application locks. A relational table could work, but it is heavier for this exact single-key idempotency problem."

### Q5. How did you decide FNO was terminal?

> "MMT (MakeMyTrip) advised treating FNO / FNOP (Flight Non-Operational) as a terminal cancellation-like event for Phase 0, while acknowledging rare reinstatements. So the product decision was to process FNO as terminal, alarm on any later trigger for the same cancelled segment, and route exceptions to manual handling. That gave us a safe Phase 0 without waiting for every rare edge case."

### Q6. What if MMT sends duplicate events?

> "The first event writes a dedupe key and proceeds. A duplicate hits the same key and becomes a no-op or returns the previous outcome. This is how we get exactly-once side effects on top of at-least-once delivery."

### Q7. What if customer cancelled on Amazon and later MMT sends SEGMENT_CANCEL?

> "We check internal cancellation state first. If the segment is already being cancelled through Amazon's own flow, the MMT event should not create a second modification. It should be ignored or linked as external confirmation depending on the status."

### Q8. How would you improve this for UnifyApps-style enterprise deployments?

> "I would make the event-contract mapping configurable per partner, add a UI for replay/manual review, add a schema-drift detector for webhook payload changes, and expose operational dashboards: duplicate rate, classification rate, manual-review rate, communication success, and time-to-customer-visible update."

### Q9. How do you explain this as PM plus FDSE?

> "The PM problem was 43 bps of support contacts and stale customer truth. The FDSE problem was a flaky, ambiguous partner event stream. I connected the two by phasing scope, making contracts explicit, and building an idempotent state machine around partner reality."

---

## 12. Behavioral Stories

### Story - Ambiguous Partner Contract

Situation: MMT (MakeMyTrip) event subtypes did not always map cleanly to customer-visible meaning.

Task: Prevent wrong customer communication.

Action: Ask precise partner questions, document subtype semantics, and use generic messaging where origin could not be proven.

Result: The system avoided overclaiming and made ambiguous cases supportable.

### Story - Scope Management

Situation: Full schedule-change taxonomy included FNO, TDCWA, date changes, delays, flight changes, reinstatements, and Plan B flows.

Task: Ship meaningful value without waiting for all edge cases.

Action: Phase FNO first, define alarms/manual fallback for rare reinstatement, and leave broader taxonomy for later phases.

Result: The team could ship a high-impact slice while keeping long-term extensibility.

---

## 13. One-Line Closers

- "The webhook was the signal; Booking Details API was the truth."
- "I designed for at-least-once delivery and exactly-once business side effects."
- "The product call was phased safety: automate clear cases first, escalate ambiguous ones."
- "This is exactly the UnifyApps FDSE shape: legacy partner APIs, ambiguous business events, and reliable customer-facing automation."
