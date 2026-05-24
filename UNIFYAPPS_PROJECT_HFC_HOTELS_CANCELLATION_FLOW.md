# UnifyApps FDSE Project Answer Bank - HFC Hotels Cancellation Flow

> Audience: private interview prep for Prakhar.
> Goal: explain the HFC Hotels cancellation flow as a senior FDSE (Forward Deployed Software Engineer) / product-minded technical owner.
> Source material inspected: Hotels cancellation frontend design, HFC Hotels backend interfaces/code, hotel booking flow design.
> Guardrail: use "I led / owned" only if true for your actual work. If asked for exact role, say "I owned the integration/design slice I worked on" instead of claiming full product ownership.

---

## 1. Terms To Say With Full Forms

Use the full form once, then the abbreviation.

- HFC (High Frequency Categories): Amazon internal category platform area. In this project, HFC Hotels means the hotel booking and post-booking flow.
- FDSE (Forward Deployed Software Engineer): engineer who works close to customers/stakeholders to design and deploy practical solutions.
- MMT (MakeMyTrip): the hotel partner / Online Travel Agency partner used for hotel inventory, booking, cancellation, and refund data.
- OTA (Online Travel Agency): a travel marketplace such as MakeMyTrip, Expedia, or Booking.com.
- OD (Order Details): Amazon post-purchase page where a customer sees booking status, cancellation status, refund summary, and help actions.
- YO (Your Orders): Amazon order list / post-purchase entry point.
- TYP (Thank You Page): post-payment confirmation page.
- CTA (Call To Action): button or link that asks the customer to take an action, such as "Cancel booking".
- API (Application Programming Interface): contract for services to communicate.
- DDB (DynamoDB): Amazon DynamoDB, a managed NoSQL database.
- SQS (Simple Queue Service): Amazon Web Services queue used to decouple producers and consumers.
- SNS (Simple Notification Service): Amazon Web Services publish-subscribe notification service.
- SFN (Step Functions): AWS Step Functions, managed state-machine workflow service.
- DLQ (Dead-Letter Queue): queue where failed messages go after retries are exhausted.
- SLA (Service Level Agreement): committed external availability or response target.
- SLO (Service Level Objective): internal reliability target.
- SSR (Server-Side Rendering): server returns rendered HTML to the browser.
- CSR (Client-Side Rendering): JavaScript renders the page in the browser.
- Redux: frontend state-management library used to store page state.
- Idempotency: safe repeat behavior; retrying the same action should not duplicate side effects.
- Refund orchestration: the backend process that cancels with the partner, updates Amazon order state, and initiates customer refund.

---

## 2. 30-Second Pitch

I worked on the HFC Hotels cancellation experience as an end-to-end post-booking flow, not just a frontend page. The customer problem was simple: after booking a hotel, the customer needs to see cancellation policy, refund amount, cancellation charges, and final cancellation status clearly before they commit.

The system had two surfaces. On the frontend, the cancellation page showed itinerary details, free-cancellation messaging, refund breakup, policy details, and success/failure states. On the backend, the flow exposed client APIs (Application Programming Interfaces) for cancellation review, initiate cancellation, and cancellation status, plus internal APIs for partner cancellation, refund initiation, and polling cancellation status.

The senior design point was separating "review" from "confirm". Review is read-heavy and explains money to the customer. Confirm is a state mutation, so it needs idempotency, durable status, retries, partner error handling, refund handoff, and observability.

---

## 3. Simple Problem Explanation

The customer wants to cancel a hotel booking. Before the customer presses confirm, the system must answer:

- What hotel and dates am I cancelling?
- Is the booking refundable?
- What cancellation charges apply?
- How much refund will I receive?
- When will the refund arrive?
- What happens if partner cancellation or refund fails?

The hard part is that the booking is split across multiple systems:

- Amazon owns customer identity, order state, payment, and post-purchase page.
- MMT (MakeMyTrip) owns partner-side hotel cancellation/refund data.
- Checkout / OMS (Order Management System) owns payment and refund state.
- HFC Hotels service owns category logic and customer-facing contracts.

So the design is really a state-consistency problem across partner, category, order, and payment systems.

---

## 4. PM / Product Framing

If an interviewer asks "why was this important?", answer like this:

> "Cancellation is a trust-critical post-purchase flow. If customers cannot see the refund breakup or if cancellation status is unclear, they contact support, lose trust, or hesitate to book again. I treated the project as reducing post-booking anxiety: show policy before confirmation, make money movement transparent, and keep failure states explicit instead of hiding them behind generic errors."

Success metrics to mention:

- Cancellation review API (Application Programming Interface) success rate.
- Cancellation confirmation success rate.
- Partner cancellation failure rate.
- Refund initiation failure rate.
- Cancellation status polling latency.
- Drop-off from cancellation review to confirm.
- Support contacts for "where is my refund?".
- OD (Order Details) page correctness after cancellation.
- DLQ (Dead-Letter Queue) count for failed internal workflows.

Product tradeoff:

> "The customer should never have to infer the refund amount. We would rather show a clear failure state or retry than show an incorrect refund estimate."

---

## 5. High-Level Design

```text
Customer
  |
  | opens /hotels/cancellation/{orderId}
  v
Hotels Frontend (CSR/SSR, Redux)
  |
  | POST /client/v1/cancel/review
  v
HFC Hotels Service
  |
  | fetch order + booking details
  | call MMT Cancellation Review API
  v
MMT (MakeMyTrip) Partner APIs
  |
  | cancellation breakup / policy / refund details
  v
HFC Hotels Service
  |
  | returns itinerary + policy + refund breakup
  v
Cancellation Review Page
  |
  | customer confirms cancellation
  v
POST /client/v1/cancel/confirm
  |
  v
HFC Hotels Service
  |
  | persists cancellation record in DDB (DynamoDB)
  | calls internal cancellation workflow
  v
Internal Cancellation APIs
  |
  +--> /internal/v1/cancel/confirm  -> cancel with MMT
  +--> /internal/v1/cancel/refund   -> initiate refund
  +--> /internal/v1/cancel/poll     -> poll partner status
  |
  v
Checkout / OMS (Order Management System)
  |
  | refund and order-state update
  v
OD (Order Details) / YO (Your Orders) / notifications
```

Interview wording:

> "I split the system into review, mutation, and status. Review is safe to retry. Confirm is a side effect and must be idempotent. Status is what lets frontend, support, and retries converge after partial failures."

---

## 6. Low-Level Design

### Client APIs

From the code contracts:

- `POST /client/v1/cancel/review`: returns cancellation review details.
- `POST /client/v1/cancel/confirm`: starts cancellation.
- `POST /client/v1/cancel/status`: fetches cancellation status from storage.

These are customer-facing APIs (Application Programming Interfaces). They must have careful response shaping because the frontend renders money, policy, and action states directly from them.

### Internal APIs

From the internal resource:

- `POST /internal/v1/cancel/confirm`: cancel ticket/booking with partner.
- `POST /internal/v1/cancel/refund`: initiate refund.
- `POST /internal/v1/cancel/poll`: poll cancellation status.

These are internal workflow APIs. They separate partner cancellation from refund movement, which is important because partner cancellation can succeed while refund initiation is still pending.

### Data Model

Key entities to explain:

- `CancellationDAO`: DDB (DynamoDB) record for cancellation state.
- `CancellationBO`: business object used by service layer.
- `CancellationBreakup`: refund amount, cancellation charge, discount deduction, and total refund.
- `CancellationStatus`: status used for frontend polling and backend recovery.
- `CancellationMode`: whether cancellation came from user, partner, or hotel.

### UI Components

From the frontend design:

- Header: page title.
- ItineraryDetails: hotel image, hotel name, stay dates, room count, guest count.
- FreeCancellationInfo: free-cancellation deadline messaging.
- RefundDetails: total paid, cancellation charges, discount deduction, refund amount.
- CancellationPolicy: reusable policy component from pre-booking flow.
- Confirm button: triggers cancellation API (Application Programming Interface).
- AlertStatusBox: common success/failure response component.

Interview wording:

> "The frontend was not just a form. It was the customer's contract: what exactly am I cancelling, what money do I get back, and what state am I in after pressing confirm?"

---

## 7. End-To-End Flow

```text
1. Customer opens OD (Order Details) and clicks Cancel Booking.
2. Frontend routes to /hotels/cancellation/{orderId}.
3. Frontend calls cancellation review API (Application Programming Interface).
4. Backend validates order ownership and booking eligibility.
5. Backend calls MMT (MakeMyTrip) cancellation review / policy API.
6. Backend returns itinerary, policy, cancellation charges, and refund amount.
7. Customer confirms.
8. Backend creates or updates cancellation record in DDB (DynamoDB).
9. Backend calls partner cancellation API.
10. If partner confirms cancellation, backend initiates refund through Checkout / OMS (Order Management System).
11. Frontend polls cancellation status.
12. OD (Order Details), YO (Your Orders), email, and SMS reflect the final state.
```

Critical invariant:

> "The customer confirmation step should create a durable cancellation state before external side effects. That lets the system recover if partner cancellation or refund initiation fails midway."

---

## 8. Reliability And Failure Handling

### Failure Cases

- MMT (MakeMyTrip) cancellation review API fails before confirmation.
- Customer presses confirm twice.
- MMT cancellation confirm succeeds but refund initiation fails.
- Refund succeeds but OD (Order Details) does not update immediately.
- Partner cancellation remains unknown / in-progress.
- Cancellation status polling times out.

### Handling Strategy

- Review failures: show retryable UI error, do not create mutation.
- Confirm double-click: use idempotency (safe repeat behavior) by `orderCode + cancellationId`.
- Partner timeout: mark status as pending/unknown, poll via internal API.
- Refund failure: separate refund initiation step so cancellation state is not lost.
- Permanent partner decline: map to customer-safe failure state.
- Internal retries exhausted: push to DLQ (Dead-Letter Queue) or operational queue for replay.

Interview wording:

> "The main failure I designed around was partial success. In travel systems, partial success is more dangerous than total failure. If partner cancellation succeeds but refund status is not updated, the customer is stuck. So I separated partner cancellation state, Amazon order state, and refund state instead of pretending cancellation is one atomic call."

---

## 9. Leadership / Team-Lead Answer

Use this for "How did you lead this?"

> "I treated Hotels cancellation as a cross-system contract, not a screen. I aligned the frontend contract, backend API contract, partner contract, and refund contract separately. That made communication easier because product could reason about customer states, frontend could reason about components and errors, backend could reason about idempotency and retries, and operations could reason about alarms and DLQs."

If you want a stronger version:

> "My role was to keep the project from becoming an ambiguous shared ownership problem. I wrote down the state model: review, confirm, poll, refund, terminal success, terminal failure. Then I mapped each state to the owning system and the customer-facing UI. That document became the common language across product, frontend, backend, and partner discussions."

Use only if true:

> "I was the primary technical owner for both the backend cancellation flow and frontend-state integration."

Safe version:

> "I owned the technical design slice I worked on and coordinated with the relevant frontend/backend/partner owners to make the contracts explicit."

---

## 10. Design Choices And Tradeoffs

| Choice | Why | Cost | Interview line |
|---|---|---|---|
| Separate review and confirm APIs (Application Programming Interfaces) | Review is read-only; confirm mutates state | More endpoints | "Read and write paths have different failure semantics." |
| Store cancellation status in DDB (DynamoDB) | Fast lookup for polling and recovery | Need status lifecycle discipline | "Frontend polling needs a durable truth source." |
| Reuse cancellation policy component | Consistent policy display across pre-booking and post-booking | Component has to work in both contexts | "Reuse was safe because the semantic meaning was the same." |
| Poll cancellation status | Partner status may be async/unknown | More moving parts | "Unknown is a real state in travel integrations." |
| Separate refund initiation from partner cancellation | Handles partial success | More state transitions | "Cancellation and refund are different business mutations." |
| Alert on partner/internal API failures | Faster on-call triage | More alarms to tune | "Post-booking failures are customer-trust failures." |

---

## 11. Likely Interview Questions And Answers

### Q1. Walk me through the hotel cancellation system.

> "Customer starts from OD (Order Details), opens the cancellation page, and first sees a review state. The review API (Application Programming Interface) fetches order details, calls MMT (MakeMyTrip) for cancellation policy and refund breakup, and returns itinerary plus money details. Only after the customer confirms do we create cancellation state and trigger partner cancellation and refund orchestration. The core design was to separate review, mutation, and polling so we can handle partial failures safely."

### Q2. Why not make one API that reviews and cancels?

> "Because review and cancel have different risk profiles. Review is safe to retry and should be optimized for clarity. Cancel is a side effect: it talks to partner systems, updates order state, and initiates refund. If we combine them, a page refresh or retry can accidentally become a business mutation. Separating them keeps the customer contract and system contract clean."

### Q3. What was the hardest backend problem?

> "Partial failure. A hotel cancellation can succeed at the partner but fail while updating Amazon order state or refund state. So the system needs durable cancellation status, retryable internal APIs, and a customer-visible status page. I would rather show 'cancellation in progress' correctly than falsely show success or failure."

### Q4. What was the hardest frontend problem?

> "The page had to explain money and policy clearly without making the user wait too long. We broke the page into components: itinerary details, free cancellation info, refund details, policy, confirm action, and status alert. The frontend needed to treat failure states as real product states, not generic errors."

### Q5. How did you handle partner failures?

> "Partner failures were classified as retryable or non-retryable. Transient failures like timeouts or 5xx would retry or move to operational recovery. Partner-declined or invalid-state responses were mapped to terminal states. The important thing was not to hide partner uncertainty. Unknown status is a first-class state and the poll API handles it."

### Q6. Where does this map to UnifyApps FDSE work?

> "It is the same shape as an enterprise integration. A customer-facing workflow sits on top of a legacy partner system, order/payment systems, and frontend state. The FDSE skill is making the contracts explicit: what is the source of truth, what is retryable, what is terminal, and what does the customer see at each state."

### Q7. What would you improve in production?

> "I would strengthen idempotency around confirm cancellation, add explicit audit events for every transition, publish business metrics like refund-delay buckets, and ensure DLQ (Dead-Letter Queue) replay tooling is operator-friendly. The next level is not just making cancellation work; it is making support able to answer any customer in under a minute."

### Q8. How would you explain this to a product manager?

> "Cancellation is a trust funnel. The customer is already anxious. Our job is to reduce ambiguity: show what is being cancelled, show policy, show refund amount, show expected refund date, and show a truthful state after confirmation. The engineering design exists to protect that customer promise."

---

## 12. Behavioral Stories

### Story - Aligning Frontend And Backend

Situation: The cancellation page needed policy, refund breakup, itinerary details, and status messaging.

Task: Prevent frontend/backend mismatch where UI assumes fields that partner APIs may not always return.

Action: Define a stable response contract with explicit nullable/empty states and separate success/failure components.

Result: Frontend could render success, failure, and pending states without guessing; backend could evolve partner handling without breaking the UI.

### Story - Saying No To Over-Automation

Situation: Product may want cancellation to feel instant.

Task: Keep customer experience fast without lying about partner or refund state.

Action: Separate "request accepted" from "partner cancellation confirmed" from "refund initiated".

Result: The system remains honest in partial-failure conditions.

---

## 13. One-Line Closers

- "The architecture was simple on purpose: review, confirm, poll, refund, notify."
- "The product risk was customer trust; the technical risk was partial success."
- "The FDSE lesson is that every enterprise workflow needs an explicit state model before code."
- "I designed it so support, frontend, and backend all talk about the same cancellation state."
