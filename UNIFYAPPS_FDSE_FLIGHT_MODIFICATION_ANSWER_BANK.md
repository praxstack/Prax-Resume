# UnifyApps FDSE (Forward Deployed Software Engineer) - Flight Modification System Answer Bank

> Purpose: interview answers for explaining the Amazon Travel flight modification
> system in a UnifyApps FDSE (Forward Deployed Software Engineer) loop. Use this
> to sound like a technical owner who can lead integrations, manage ambiguity,
> and communicate with business and partner stakeholders.
>
> Honesty guardrail: your resume supports Amazon Travel, flight schedule changes,
> SQS (Simple Queue Service), DynamoDB (Amazon DynamoDB)-backed dedupe
> (deduplication) keys, audit logging, automated offline modifications
> (booking changes processed outside the immediate customer checkout flow),
> Step Functions (AWS Step Functions), partner APIs (Application Programming
> Interfaces), 43 bps (basis points) CPT (Contacts Per Transaction), and support-cost
> reduction. Direct communication with MMT (MakeMyTrip) or airline teams should
> be used only if true. Otherwise say "partner operations / airline integration
> stakeholders."

---

## 1. Terms To Say With Full Forms

Use the full form once, then the abbreviation. The rest of this file also
keeps full forms inline so you do not need to return to this glossary mid-study.

- OTA (Online Travel Agency): a travel marketplace like MakeMyTrip, Expedia, or Booking.com.
- MMT (MakeMyTrip): an Indian OTA and travel booking platform.
- FDSE (Forward Deployed Software Engineer): engineer who works close to enterprise customers to design and deploy solutions.
- AWS (Amazon Web Services): cloud platform used here for SQS, DynamoDB, Lambda, and Step Functions.
- CRM (Customer Relationship Management): system holding customer or booking support data.
- PNR (Passenger Name Record): airline booking reference for a passenger itinerary.
- GDS (Global Distribution System): travel distribution network used to search and manage airline inventory.
- NDC (New Distribution Capability): airline API standard for richer airline retailing and booking.
- SQS (Simple Queue Service): AWS (Amazon Web Services) queue used to decouple producers and consumers.
- DLQ (Dead-Letter Queue): queue/table where failed records go for later replay.
- CPT (Contacts Per Transaction): customer-support contact rate per booking or transaction.
- bps (basis points): 1 bps = 0.01 percentage points; 43 bps = 0.43 percentage points.
- SLA (Service Level Agreement): committed availability or response target.
- SLO (Service Level Objective): internal reliability target.
- API (Application Programming Interface): contract for systems to talk to each other.
- ETA (Estimated Time of Arrival): expected completion or arrival time.
- TAT (Turnaround Time): time taken to complete an operation.
- COE (Correction of Error): Amazon-style incident/root-cause write-up.
- RCA (Root Cause Analysis): investigation of why a failure happened.
- IaC (Infrastructure as Code): defining infrastructure in code, such as AWS CDK.
- AWS CDK (Amazon Web Services Cloud Development Kit): framework for defining AWS infra in code.
- Lambda (AWS Lambda): serverless compute service used to run event-driven code.
- Step Functions (AWS Step Functions): AWS state-machine service for workflows.
- DynamoDB (Amazon DynamoDB): managed NoSQL (non-relational) database used here for dedupe/audit state.
- Idempotency: safe repeat behavior; same request can be retried without duplicating side effects.
- Dedupe key (Deduplication key): stable key used to detect duplicate events.
- At-least-once delivery: event may arrive one or more times, so duplicates are expected.
- Exactly-once side effect: even if processing retries, the business mutation should happen once.
- Webhook: HTTP callback sent by one system to notify another system of an event.
- Offline modification: booking change processed outside the immediate customer checkout flow.

---

## 2. 60-Second Answer - "How Did You Design The Flight Modification System?"

I designed an event-driven flight modification system for real-time schedule
changes in Amazon Travel. In plain terms, when an airline or partner system sent
a schedule-change event - cancellation, date change, or non-operational flight -
we needed to update the customer booking safely without creating duplicate
modifications or losing auditability.

The design was SQS (Simple Queue Service) for ingestion, DynamoDB (Amazon
DynamoDB, managed NoSQL/non-relational database) for dedupe (deduplication) keys
and state, and Step Functions (AWS Step Functions, state-machine workflow
service) for orchestration. The workflow validated the booking, classified the
event type, applied the right offline modification (booking change outside the
immediate customer checkout flow) path, logged every transition, retried
transient failures, and escalated unsafe cases for manual handling.

The main engineering principle was idempotency (safe repeat behavior: the same
request can be retried without duplicating side effects), meaning the same event
could be processed multiple times without applying the booking change multiple
times. That matters because airline and partner systems often have at-least-once
delivery (the event may arrive one or more times), where the same update can be
resent or retried. This system addressed one of the highest-impact customer pain
categories, around 43 bps (basis points) CPT (Contacts Per Transaction), and
reduced support cost.

---

## 3. 2-Minute Leadership Answer - Team Lead / FDSE (Forward Deployed Software Engineer) Framing

I treated the flight modification work less like a single backend feature and
more like an enterprise integration. The difficult part was not writing one API
(Application Programming Interface) handler; it was aligning product, support,
partner operations, and engineering on what "correct" meant when schedule-change
data was messy or repeated.

I broke the problem into four contracts:

1. Event contract: what information must come from the airline or partner event.
2. Booking contract: how we map that event to the internal Amazon Travel booking.
3. Execution contract: which state-machine path handles cancellation, date
   change, or non-operational flight.
4. Recovery contract: what happens when the data is incomplete, the downstream
   service fails, or the same event arrives twice.

That gave the team a shared language. Product could reason about customer pain,
support could reason about contact reduction, and engineering could reason about
idempotency (safe repeat behavior), retries, audit, and failure states. I owned
the technical design, code reviews, rollout sequencing, and operational
readiness. The FDSE (Forward Deployed Software Engineer)-style lesson is that
the system only works if the integration contract is clear enough for both
engineers and business stakeholders to trust.

---

## 4. Architecture Explanation

```text
Airline / partner schedule-change event
        |
        v
SQS (Simple Queue Service)
        |
        v
AWS Lambda (serverless compute) / Java service consumer
        |
        v
Normalize event into internal booking-change model
        |
        v
DynamoDB (Amazon DynamoDB) dedupe (deduplication) check
        |
        +--> duplicate event: safely no-op / return previous outcome
        |
        v
Step Functions (AWS Step Functions) workflow
        |
        +--> validate booking and PNR (Passenger Name Record)
        +--> classify change type
        +--> cancellation path
        +--> date-change path
        +--> non-operational-flight path
        +--> retry transient failures
        +--> audit every state transition
        +--> manual escalation if unsafe
```

The clean way to explain it:

- SQS (Simple Queue Service) gave us buffering and at-least-once delivery (the
  event may arrive one or more times).
- DynamoDB (Amazon DynamoDB) gave us a fast dedupe (deduplication) store keyed
  by booking/event identity.
- Step Functions (AWS Step Functions) made the workflow explicit instead of
  hiding branching logic in one large service method.
- Audit logs made support and post-incident debugging possible.
- Manual fallback protected customers when automation was unsafe.

---

## 5. How I Communicated With Stakeholders

### Safe Version - Use This Unless Direct MMT (MakeMyTrip) / Airline Ownership Is True

I worked through partner operations and internal travel stakeholders rather than
assuming the partner API (Application Programming Interface) was perfect. The
questions I pushed were operational:

- Can the same schedule-change event be sent twice?
- Can events arrive out of order?
- Which timestamp is authoritative?
- What fields are mandatory for cancellation versus date change?
- What should happen if the airline data conflicts with the current booking?
- What SLA (Service Level Agreement) or TAT (Turnaround Time) matters for support?

That helped convert an ambiguous partner-data problem into a system contract.
Once the contract was clear, the implementation became much safer: dedupe
(deduplication) keys, retry policy, audit logging, and manual escalation all
followed from those answers.

### If Direct MMT (MakeMyTrip) / Airline Communication Was Actually True

I coordinated with MMT (MakeMyTrip), airline integration stakeholders, and
internal partner operations to clarify schedule-change semantics. The key was
not asking for a perfect API (Application Programming Interface). The key was
asking precise questions around duplicates, ordering, required fields, retry
behavior, and escalation paths.

For example, if an airline sends both "date change" and "non-operational flight"
events for the same PNR (Passenger Name Record), we needed to know which event
is authoritative and whether the second event supersedes the first. Those
answers directly shaped the DynamoDB (Amazon DynamoDB) dedupe (deduplication)
model, Step Functions (AWS Step Functions) branches, and manual fallback rules.

Use only if true:

> I was the primary technical owner for translating partner/event behavior into
> our internal workflow contract.

Do not say unless true:

> I personally managed the commercial relationship with MMT (MakeMyTrip) or
> airlines.

---

## 6. "What Was Hard About It?"

The hard part was the edge-case behavior, not the happy path.

A simple schedule change is easy: receive event, find booking, modify booking.
But real travel systems are messy:

- The same event can be sent multiple times.
- Events can arrive late or out of order.
- Airline payloads may be incomplete.
- A booking may already be cancelled.
- A downstream system may timeout after partially applying a change.
- Support needs to know exactly what happened to answer a customer.

So I designed the system around safe automation. If the event was valid and
deduped (deduplicated), we automated it. If the event was unsafe or
contradictory, we escalated with enough audit context for manual resolution.
That is the tradeoff: automate high-confidence cases aggressively, but never
silently corrupt a customer booking.

---

## 7. "How Did You Lead The Team?"

I led by turning ambiguity into explicit contracts.

Instead of starting with implementation, I first aligned the team on failure
modes: duplicate events, late events, missing fields, downstream timeouts, and
manual fallback. Then I broke the project into milestones:

1. Ingest schedule-change events through SQS (Simple Queue Service).
2. Normalize events into an internal booking-change model.
3. Add DynamoDB (Amazon DynamoDB) dedupe (deduplication) keys for idempotency
   (safe repeat behavior).
4. Build the Step Functions (AWS Step Functions) workflow for modification
   paths.
5. Add audit logging and operational visibility.
6. Roll out gradually and monitor CPT (Contacts Per Transaction), failures, and
   manual escalations.

My communication style was to make the risk visible. For product and operations,
I explained it in customer terms: "this prevents duplicate changes and reduces
support contacts." For engineers, I explained it in system terms: "this gives us
at-least-once processing (events may arrive one or more times) with effectively
once-only side effects."

---

## 8. "How Does This Relate To UnifyApps FDSE (Forward Deployed Software Engineer)?"

This maps very directly to UnifyApps FDSE (Forward Deployed Software Engineer)
work.

UnifyApps customers will also have messy enterprise systems, ambiguous business
processes, old APIs (Application Programming Interfaces), and integration edge
cases. The job is not just to write code; it is to understand the customer's
process, find the failure modes, design the workflow, deploy it safely, and
communicate tradeoffs clearly.

The flight modification system is the same shape:

- External partner system sends imperfect events.
- Internal workflow normalizes and validates them.
- Downstream side effects must be idempotent.
- Auditability is required for trust.
- Unsafe cases need human escalation.
- The technical owner must communicate with both engineers and business teams.

That is why I see it as FDSE (Forward Deployed Software Engineer)-relevant
experience, not just backend experience.

---

## 9. "What Would You Improve Now?"

If I were designing it again, I would improve three areas.

First, I would make the partner event contract more explicit with schema
versioning. Different airline or OTA (Online Travel Agency) integrations can
represent the same business event differently, so adapter-level schema contracts
would reduce ambiguity.

Second, I would build stronger replay tooling. Support or operations should be
able to safely replay one booking modification from the audit trail without
needing engineering intervention.

Third, I would add better operational dashboards: duplicate rate, retry rate,
manual-escalation rate, modification success rate, event lag, and downstream
error rate. For customer-facing workflows, trust comes from visibility.

---

## 10. Rapid-Fire Q&A

### Q: Why SQS (Simple Queue Service)?

SQS (Simple Queue Service) decouples schedule-change producers from our
consumers. If an airline or partner sends a burst of updates, we can buffer and
process safely instead of dropping events or overwhelming downstream services.

### Q: Why DynamoDB (Amazon DynamoDB)?

DynamoDB (Amazon DynamoDB) is low-latency and operationally simple for key-based
dedupe (deduplication). We needed to quickly answer: "Have we already processed
this event for this booking?"

### Q: Why Step Functions (AWS Step Functions)?

Step Functions (AWS Step Functions) made the workflow explicit. Flight
modification is not one straight-line API call; it has states, retries,
branches, and terminal outcomes.

### Q: What is idempotency (safe repeat behavior) here?

Idempotency (safe repeat behavior) means the same schedule-change event can be
retried or received again without applying the same booking modification twice.

### Q: What is the dedupe (deduplication) key?

Conceptually, a dedupe (deduplication) key should combine stable identifiers
such as booking id, event id or schedule-change id, source, and change type. The
exact production key depends on the upstream event contract. The goal is stable
identity for the same logical event.

### Q: Why not just process events synchronously?

Because partner events can burst, downstream services can fail, and schedule
changes are not always safe to process immediately. A queue plus workflow gives
us backpressure, retries, and observability.

### Q: What if two events conflict?

Do not guess silently. Use ordering rules if the source provides authoritative
timestamps or sequence numbers. If not, route to manual review with full audit
context.

### Q: How did you reduce support cost?

By automating high-confidence schedule changes and making unsafe cases
traceable. The system addressed a high-impact customer pain category around
43 bps (basis points) CPT (Contacts Per Transaction), which means fewer
customers needed to contact support for those modification flows.

### Q: What did you own?

Based on the resume-safe wording: I owned the technical design and
implementation of the idempotent (safe to retry) Java webhook (HTTP callback)
workflow pieces, including SQS (Simple Queue Service) ingestion, DynamoDB
(Amazon DynamoDB)-backed dedupe (deduplication), audit logging, offline
modification (booking change outside the immediate customer checkout flow)
automation, and Step Functions (AWS Step Functions) orchestration.

---

## 11. One-Liners To Memorize

- "The hard part was not receiving the event; it was making the side effect safe."
- "At-least-once delivery (events may arrive one or more times) means duplicate
  events are normal, not exceptional."
- "I designed for exactly-once business effect (one business mutation despite
  retries) on top of retryable infrastructure."
- "For product, I framed it as customer pain and support cost. For engineering,
  I framed it as idempotency (safe repeat behavior), auditability, and
  failure-state design."
- "Unsafe automation is worse than manual handling, so the system needed a clear
  manual fallback."
- "This is why I see FDSE (Forward Deployed Software Engineer) as a natural fit:
  ambiguous customer process, legacy systems, integration contracts, fast
  delivery, and production ownership."
