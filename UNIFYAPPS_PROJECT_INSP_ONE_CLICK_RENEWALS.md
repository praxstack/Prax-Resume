# UnifyApps FDSE × Product — INSP One-Click Renewals (Auto Insurance): Long-Form Project Answers

> **Audience:** me (Prakhar), preparing the **Amazon ISNP One-Click Auto-Insurance Renewals** project for a UnifyApps Sr. FDSE / Product loop.
>
> **Source basis:**
> - `Interview-Prep/AllProjectAndOtherFiles/OneCickRenewals.pdf` — overall design summary I authored.
> - `Interview-Prep/AllProjectAndOtherFiles/Design_INPayments_Insurance_Auto_OneClickRenewals_Design_WebHome.pdf` — full design doc.
> - `Interview-Prep/AllProjectAndOtherFiles/Renewal_URL_INPayments_Insurance_Auto_OneClickRenewals_Design_Renewal.pdf` — Renewal URL component spec.
> - `Interview-Prep/AllProjectAndOtherFiles/_ One-Click Renewals Overview HLD.drawio.png` — HLD diagram.
>
> **Why this project for FDSE × Product:** repeat-purchase product flow for a regulated category (auto insurance), customer-pain measured in expired-policy lapse rates, multi-system orchestration across ISNP Renewal Service / ISNP Gateway (AppSync GraphQL) / Heimdall (insurer-facing) / Enigma (DynamoDB), explicit cross-team contracts with the insurer (Acko), regulatory edge cases (policy already expired → inspection flow), customer-experience polish (auto-prefill + one-click). Pure FDSE × Product shape.

---

## 0. The dual-role pitch (memorize verbatim)

> "I owned One-Click Renewals for the Amazon Auto-Insurance product line — the system that turns a policy renewal from a 12-step new-purchase journey into a single click. Business case: every expired auto-insurance policy without renewal is regulatory non-compliance for the customer and lost revenue for Amazon. Customers were dropping off at every step of the existing renewal flow because the system asked them to re-enter vehicle details, re-pick the plan, re-pick the covers, re-pick the add-ons. I designed the end-to-end flow: T-60-day trigger from the ISNP Renewal Service, pre-processing pipeline that calls Acko (the insurer partner) to fetch the renewal plan and creates a new application, three customer ingresses (renewal reminders via email/push/APD, marketing banners, GetVehicles widget on the landing page) all carrying the renewal URL with pre-filled price, the customer lands on the Quotes page with everything auto-selected, hits Continue once, lands on the Review page directly skipping the Application page, pays, done. The Product judgment I'm proudest of: 'if the customer edits any field other than pincode, it ceases to be a renewal' — that single rule preserves data integrity for the renewal cohort while still letting customers fix typos."

---

## 1. The 90-second extension (when they say "go deeper")

> "Auto insurance is a regulated category with a hard expiry date. If the policy lapses, the customer drives uninsured (illegal) and faces a 30-day inspection-required gap before re-insuring. Renewal isn't optional — it's a regulatory must. So the customer-pain wasn't 'we want to make renewal easier' (a nice-to-have); it was 'every dropped-off renewal is a customer driving uninsured' (a real risk). That framing unlocked the engineering investment.
>
> The system has four moving parts. **(1) ISNP Renewal Service** — owns the T-60-days trigger lifecycle. After every policy purchase, schedules a callback at T-60. When the callback fires, kicks off pre-processing. **(2) ISNP Gateway** (AppSync GraphQL) — the orchestration layer. On callback, asks Heimdall to fetch the renewal plan from Acko (using the previous policy's application as the key), and asks Enigma to create a new application with pre-filled details. **(3) Heimdall** — insurer-facing layer. Talks to Acko's APIs for plan fetching, premium calculation, application creation. **(4) Enigma** — DynamoDB-backed application store. Manages application state and pre-fill logic.
>
> After pre-processing, the renewal URL plus price gets attached to every customer ingress: the renewal reminder email/push, the auto-insurance landing page Renew Now widget, the Your Orders Renew Policy button. Customer clicks any of those, lands on the Quotes page with vehicle details, plan, covers, and add-ons all pre-selected. One click and they're on the Review page (the system skips the Application page entirely because pre-fill made it redundant). Pay, done.
>
> The Product calls I'm proudest of: pre-fill on Quotes page (vs sending them back through the full new-purchase flow), skip the Application page (made redundant by pre-fill), the 'edit any field other than pincode → no longer a renewal' rule, and the cleanup workflow when renewal succeeds at Acko OR at Amazon (kill all stale ingresses immediately so we never spam a customer who's already renewed)."

---

## 2. Project facts (memorize the numbers)

| Fact | Number / Detail |
|---|---|
| **Business case** | Auto-insurance policy lapse rate — every dropped renewal is regulatory non-compliance for the customer + lost revenue for Amazon |
| **Trigger schedule** | T-60 days before policy expiry (T = expiry date) — set up at policy purchase, fired by ISNP Renewal Service |
| **Pre-processing** | T-60 callback → ISNP Gateway calls Heimdall (Acko-facing) for renewal plan + Enigma (DynamoDB) for new application creation |
| **Customer ingresses (Phase 0)** | Renewal reminders (email + push + APD), marketing banners, GetVehicles widget on auto-insurance landing page |
| **Customer ingresses (Phase 1)** | Auto-Insurance Landing Page widget ("Renew Now" box, 60 days before expiry), Your Orders "Renew Policy" button (60 days before expiry) |
| **Vehicle Number ingress (P0)** | If customer types a renewal vehicle number on purchase journey → all details auto-fetch, kick off renewal purchase journey |
| **Pre-filled fields** | Vehicle details, plan, covers, add-ons — all auto-selected on Quotes page based on previous year's policy |
| **Renewal-cohort invariant** | Customer edits any vehicle field other than pincode → ceases to be a renewal (treated as fresh purchase) |
| **Application page bypass** | Customer goes Quotes → Review directly (skips the new-purchase-only Application page) |
| **Expired-policy fallback** | If policy already expired → shift to Inspection flow (regulatory requirement: 30-day vehicle inspection before re-insuring) |
| **Cleanup trigger** | Customer renews on Acko.com directly OR on Amazon → all stale renewal ingresses (URLs, widgets, reminders) cleaned up immediately |
| **Drop-off recovery** | Customer drops off mid-purchase → resumes via Recent Searches widget |
| **Insurer partner** | Acko (the auto-insurance underwriter we partner with) |
| **Internal services I aligned with** | ISNP Renewal Service (T-60 trigger lifecycle), ISNP Gateway (AppSync GraphQL orchestration), Heimdall (insurer-facing), Enigma (DynamoDB application store), ISNP Reminder Service (email/push/APD comms), Marketing (banner placement), Auto Insurance Landing Page team, YO/OD post-purchase team |
| **Tech stack** | AWS (Lambda + AppSync GraphQL + DynamoDB + Step Functions for the trigger lifecycle), Java for the renewal/orchestration code, React frontend for the customer ingresses |
| **Out of scope (Phase 0)** | Multi-vehicle bulk renewal, partial-renewal (renew one cover but not another), inter-insurer renewal switching |

---

## 3. High-Level Design (architecture walkthrough)

```
                        ┌────────────────────────────────────────┐
                        │   T0: Customer purchases auto-insurance │
                        │   policy on Amazon                      │
                        └────────────────────┬───────────────────┘
                                             │
                                             ▼
                        ┌────────────────────────────────────────┐
                        │   ISNP Renewal Service                  │
                        │                                         │
                        │   On purchase event:                    │
                        │   • Schedule T-60-day trigger          │
                        │     (T = policy expiry date)            │
                        │   • Persist trigger in trigger store   │
                        │     keyed on policy_id                  │
                        └────────────────────┬───────────────────┘
                                             │
                                             ▼ (60 days before expiry)
                        ┌────────────────────────────────────────┐
                        │   T-60: Trigger fires                   │
                        │                                         │
                        │   ISNP Renewal Service receives         │
                        │   callback for policy P. Starts the     │
                        │   pre-processing pipeline.              │
                        └────────────────────┬───────────────────┘
                                             │
                                             ▼
              ┌────────────────────────────────────────────────────┐
              │   ISNP Gateway (AppSync GraphQL orchestration)     │
              │                                                    │
              │   1. Renewal Service calls Gateway with policy_id │
              │   2. Gateway calls Heimdall:                      │
              │      • Fetch renewal plan from Acko using the     │
              │        previous policy's application as the key   │
              │      • Get the renewal premium                    │
              │   3. Gateway calls Enigma:                        │
              │      • Create new application pre-filled with     │
              │        last-year's vehicle + plan + covers +      │
              │        add-ons                                     │
              │      • Return new application_id                  │
              │   4. Gateway returns combined response to         │
              │      Renewal Service:                              │
              │      { renewal_url, renewal_price,                │
              │        application_id }                            │
              └────────────────┬───────────────────────────────────┘
                               │
                               ▼
              ┌────────────────────────────────────────────────────┐
              │   ISNP Renewal Service: ATTACH PHASE               │
              │                                                    │
              │   Now attach (renewal_url, renewal_price) to       │
              │   every customer ingress:                          │
              │                                                    │
              │   • Reminder emails (T-30, T-15, T-7, T-3, T-1)   │
              │     via ISNP Reminder Service                      │
              │   • Push notifications                             │
              │   • APD (Amazon Post-Description)                  │
              │   • Marketing banners                              │
              │   • Auto-insurance landing page "Renew Now" widget │
              │   • Your Orders "Renew Policy" button              │
              │   • GetVehicles widget                             │
              └────────────────┬───────────────────────────────────┘
                               │
                               ▼
                ┌──────────────────────────────────────────────┐
                │   Customer clicks any ingress → renewal_url  │
                │                                               │
                │   URL lands customer on Quotes page with:    │
                │   • Vehicle details pre-filled (from last    │
                │     year's policy)                            │
                │   • Plan auto-selected                        │
                │   • Covers auto-selected                      │
                │   • Add-ons auto-selected                     │
                │   • Renewal price pre-displayed              │
                │                                               │
                │   On the Quotes page UI:                     │
                │   • Banner: "Renewing your policy from       │
                │     last year — same plan + covers + add-ons"│
                │   • CTA: "Continue"                          │
                └──────────────┬───────────────────────────────┘
                               │
                               ▼
                ┌──────────────────────────────────────────────┐
                │   Customer clicks Continue                    │
                │                                               │
                │   System checks the "Renewal Cohort" rule:   │
                │   • Has the customer edited any vehicle       │
                │     field OTHER than pincode?                │
                │   • If YES → ceases to be a renewal,         │
                │     fall through to fresh-purchase flow      │
                │   • If NO → proceed to renewal Review page   │
                │                                               │
                │   Skip the Application page entirely (made    │
                │   redundant by pre-fill).                    │
                └──────────────┬───────────────────────────────┘
                               │
                               ▼
                ┌──────────────────────────────────────────────┐
                │   Review Page                                 │
                │                                               │
                │   Customer reviews policy + premium + covers,│
                │   confirms, pays.                            │
                └──────────────┬───────────────────────────────┘
                               │
                               ▼
                ┌──────────────────────────────────────────────┐
                │   Renewal Successful                          │
                │                                               │
                │   ISNP Renewal Service triggers cleanup:     │
                │   • Mark renewal_url + price as              │
                │     CONSUMED across all ingresses             │
                │   • Suppress remaining T-30 / T-15 / etc.    │
                │     reminder emails                          │
                │   • Hide "Renew Now" widget on landing page  │
                │   • Hide "Renew Policy" button on YO         │
                │   • Hide GetVehicles widget                  │
                └──────────────────────────────────────────────┘
                               │
                               ▼
              ┌────────────────────────────────────────────────────┐
              │   ALSO Cleanup if customer renewed on Acko.com    │
              │   (i.e., bypassed Amazon)                          │
              │                                                    │
              │   ISNP Renewal Service polls Acko renewal-status  │
              │   API daily (or on-demand). If renewal completed   │
              │   on Acko's side, run the same cleanup workflow    │
              │   above — treat it as if the customer renewed on   │
              │   Amazon.                                          │
              └────────────────────────────────────────────────────┘
                               │
                               ▼
              ┌────────────────────────────────────────────────────┐
              │   ALSO Cleanup if policy expires (T+0)            │
              │                                                    │
              │   • Suppress all renewal ingresses                │
              │   • Switch the Auto Insurance widget to            │
              │     "Inspection Required" (because the policy is   │
              │     now expired — 30-day inspection regulatory     │
              │     requirement applies)                            │
              └────────────────────────────────────────────────────┘
```

### Key invariants (drill these in)

1. **T-60-day trigger is the single source of timing truth.** All ingresses fire off the same trigger event from ISNP Renewal Service. The renewal_url and renewal_price are pre-computed once and attached to every ingress — no per-ingress recomputation.
2. **Pre-fill is from the previous policy's application, not from the customer's profile.** Because: vehicle details (registration, model variant, etc.) live on the previous application, not on the customer record. Acko's renewal-plan API is keyed on the previous application id.
3. **The "edit anything but pincode → no longer renewal" rule.** Pincode is the only field a customer might legitimately need to edit (they moved). Any other edit (vehicle, plan, covers) means they're not actually renewing — they're buying differently. Treat as fresh purchase, not renewal-with-edits, to preserve the renewal-cohort data integrity.
4. **Skip the Application page in renewal flow.** Application page exists in fresh purchase to collect vehicle + nominee details. In renewal, both are pre-filled, so the page would just be a "click Continue again" speed-bump. Eliminating it removes a known drop-off point.
5. **Cleanup is triggered on three events, not just one.** Renewal on Amazon, renewal on Acko (out-of-band), policy expiry. All three converge on the same cleanup workflow — kill stale ingresses everywhere.
6. **Drop-off recovery via Recent Searches.** If the customer abandons the renewal mid-purchase, the application stays alive and shows up in the Recent Searches widget so they can resume without restarting.
7. **Expired policy → inspection flow, not renewal.** Regulatory: a customer with an expired auto-insurance policy can't just "renew" — they need a vehicle inspection first (30-day gap rule). The system detects expiry on click and routes to the inspection flow with the right messaging.
8. **Renewal data freshness boundary.** Renewal_price is computed at T-60 by Heimdall via Acko, and remains valid through the renewal window (typically 60 days). On click, we re-validate price against Acko before payment to catch the rare case where insurance pricing shifts due to a regulatory or insurer-side change.

---

## 4. Low-Level Design (decisions worth defending)

### 4.1 Why T-60 days as the trigger window

> "Auto-insurance renewal in India is a 60-day window: customers can renew up to 60 days before expiry without any inspection. Below 60 days you start losing the early-bird discount; below 30 days you start risking the inspection-required gap if expiry hits before renewal completes. T-60 is the right earliest-fire moment because it (a) catches every customer in the no-inspection-required window, (b) gives Engineering the maximum time to retry / recover from any partner-side hiccup, (c) gives Marketing the maximum time to land the customer through reminder cadence (T-30 / T-15 / T-7 / T-3 / T-1)."

### 4.2 Why ISNP Gateway (AppSync GraphQL) as the orchestration layer

> "Three reasons. One — multiple data sources need to be combined in one response. The renewal-URL ingestion needs renewal_plan (from Heimdall → Acko), application_id (from Enigma), and renewal_price (computed by Heimdall). GraphQL is the natural fit for 'compose multiple sub-services into one client-facing query' patterns. Two — AppSync gave us managed connections to DynamoDB (Enigma) and Lambda resolvers (Heimdall) with zero infrastructure to maintain. Three — schema-first contract: the Gateway schema is the single source of truth for what the Renewal Service can ask for, which made cross-team contract conversations easier. The alternative (REST orchestration with manual stitching) would have meant more glue code in the Renewal Service itself."

### 4.3 Why Heimdall for the insurer-facing layer (instead of direct Acko calls from Gateway)

> "Two reasons. One — single point of partner-API translation. Acko's APIs evolve on Acko's timeline; Heimdall absorbs those changes so no other internal service needs to know. Two — multi-insurer future. Today we have Acko; tomorrow we might add another underwriter for inter-insurer renewal switching. Heimdall is the abstraction that makes that swap a one-config change instead of a re-architecture. Pure dependency-inversion — depend on the insurer-facing interface, not on the specific insurer."

### 4.4 Why Enigma uses DynamoDB (not RDS) for application store

> "Three reasons. One — application records have a natural single-key access pattern: the application_id. DynamoDB hash-key access is sub-millisecond. Two — application schema evolves: new fields get added per insurer, per state, per regulatory cycle. DynamoDB's schemaless nature handles this without table migrations. Three — application state has bursty read patterns: T-60 trigger fires, then T-30 reminder, T-15, T-7, T-3, T-1, then customer click traffic. DynamoDB scales for the bursts without provisioning. RDS would have required write-tier provisioning for the trigger bursts."

### 4.5 Why pre-fill on Quotes page (not on Review page directly)

> "The customer needs a moment of 'this is what's being renewed' before clicking pay. Quotes page provides that — the customer sees vehicle, plan, covers, add-ons, all pre-selected, with a 'this is your renewal' banner. Skipping straight to Review would feel jarring (customer clicks email → sees only the price + Pay button) and would also remove the 'edit pincode if needed' option which is the only legitimate edit path. Quotes page is the right surface — visible enough to confirm, low-friction enough to keep one-click-feel."

### 4.6 The "edit anything but pincode → no longer renewal" rule

**The setup.** A customer on the renewal Quotes page edits the vehicle make/model. Is this still a renewal?

**The product call.** No. Edit any field except pincode → drop the renewal context, treat as fresh purchase.

**Reasoning.**
- Renewal data integrity matters: the renewal cohort metric depends on "did the customer renew the same vehicle with the same plan." Allowing edits on vehicle/plan/covers and still calling it "renewal" pollutes the metric.
- Pincode is the one field a customer might legitimately need to edit because they moved house. That's not a "different policy" — it's the same policy with a registered-address update.
- Any other edit (different vehicle, different plan tier, dropped a cover) means the customer is buying differently. Fresh purchase flow.

**How to articulate it.**
> "Pincode is the one legitimate edit on a renewal. Any other field-edit means the customer is making a different purchase decision. Treat that as fresh purchase to preserve the renewal-cohort data integrity. Documented in the design doc, agreed with Product."

### 4.7 Three convergent cleanup triggers

> "Cleanup needs to happen on three events, not just one: customer renewed on Amazon, customer renewed on Acko (out-of-band, bypassing Amazon), or policy hit expiry. All three converge on the same cleanup workflow — suppress reminders, hide widgets, kill the renewal_url. The risk we're mitigating: 'don't spam a customer who's already renewed.' Detecting Acko-side renewal is the trickiest — we poll Acko's renewal-status API daily for active renewal cohorts. The latency cost is bounded (worst case: customer renews on Acko Monday, gets one stale reminder Tuesday morning before our daily poll runs Tuesday evening); the alternative (real-time webhook from Acko) wasn't available at Phase 0. Phase 1 candidate."

---

## 5. Three product decisions worth defending

### Decision 1 — Skip the Application page entirely in the renewal flow

**The setup.** New-purchase flow goes Quotes → Application → Review. Application collects vehicle details + nominee details. In renewal, both are already pre-filled.

**The product call.** Eliminate the Application page from the renewal flow.

**Reasoning.**
- Pre-fill makes the page contentless — customer would just click Continue.
- Eliminating it removes a known drop-off point. Each extra step in a multi-step funnel costs measurable conversion.
- The "edit anything but pincode" rule already handles the edge case of legitimate edits.

**How to articulate it.**
> "Conversion math. Every step in a regulated-purchase funnel costs drop-off. Pre-fill made the Application page redundant. Eliminating it shrunk the renewal funnel from 12 steps to 3, which is the difference between 'one-click' marketing language being honest and being aspirational."

### Decision 2 — "Edit anything but pincode → no longer renewal"

Already covered in §4.6. Interviewer-ready: **"Pincode is the only legitimate edit (customer moved). Anything else is a different purchase decision. Treat as fresh purchase to preserve renewal-cohort data integrity."**

### Decision 3 — Three convergent cleanup triggers (Amazon-renewal / Acko-renewal / expiry)

Already covered in §4.7. Interviewer-ready: **"Don't spam a customer who's already renewed. Cleanup converges on three events; daily poll for Acko-side renewal because real-time webhook wasn't available. The bounded latency cost (one stale reminder) was acceptable for Phase 0."**

---

## 6. Leadership stories (STAR format)

### Story 1 — Owning the partner-API contract with Acko

**Situation.** Acko (the insurer) had a renewal-plan API that returned the renewal premium given a previous-application id. The contract was loosely documented — some fields were under-specified, the failure modes weren't enumerated, the rate-limit was unclear.

**Task.** Convert the loose Acko contract into a written, version-controlled, MoM-backed integration spec.

**Action.**
1. Set up a sync with Acko's tech counterpart. Walked in with a one-page question list: "Here's our T-60 use case, here are the 5 questions blocking us, here's how each maps to a specific code path."
2. Got Acko's answers in writing. Captured: rate-limit (RPS at our partner-tier), retry-on-4xx vs retry-on-5xx semantics, idempotency guarantees, expected response latency, failure modes (insurer-side outage → graceful degradation needed).
3. Designed Heimdall to absorb those failure modes. On Acko outage, return cached renewal-plan data with a "stale" marker; fail-fast on regulatory-blocker errors (expired policy, vehicle blocklist).
4. Documented the contract in the design doc. Got Acko sign-off.

**Result.** Phase 0 launched with a clean partner contract. When Acko shifted some field semantics in a quarterly release, we had a written delta against the original contract; the change was a 1-line update in Heimdall, no other service touched.

**Why this story works for FDSE + Product.**
- **FDSE signal:** treated the insurer like an enterprise integration partner — explicit contract, MoM-backed, version-controlled.
- **Product signal:** turned a verbal/email contract into a written artifact that survived insurer-side iteration.

---

### Story 2 — The "skip Application page" debate with Product

**Situation.** Original Phase 0 spec had the renewal flow going Quotes → Application → Review (mirroring fresh purchase). Product was hesitant to drop the Application page because "regulatory might require it."

**Task.** Make the case to drop it.

**Action.**
1. Investigated the regulatory question. Application page collects vehicle details + nominee details; both are present in the previous policy data. No regulatory ask requires re-entry on renewal.
2. Pulled funnel data from the existing renewal flow (customers who manually renewed via fresh-purchase path). Application page was a measurable drop-off point.
3. Took the proposal to Product: "Drop the Application page in renewal. Vehicle + nominee come from previous policy. No regulatory requirement to re-collect. Funnel data shows it's a drop-off point. Edge case handled by 'edit anything but pincode' rule."
4. Got the call: drop it.

**Result.** Renewal funnel shrunk from 12 steps (fresh-purchase mirror) to 3 steps (click → Quotes → Review → Pay). Conversion improved measurably in Phase 0.

**Why this story works for FDSE + Product.**
- **FDSE signal:** verified the regulatory claim instead of accepting it; brought funnel data to the conversation.
- **Product signal:** turned a "feels safer to keep it" instinct into a data-backed conversation that ended in better conversion.

---

### Story 3 — Designing the cleanup workflow for Acko-side renewal

**Situation.** During design, surfaced the edge case: "What if the customer renews on Acko.com directly, bypassing Amazon? Our renewal reminders will keep firing and our widgets will keep showing."

**Task.** Decide how to detect Acko-side renewal and trigger cleanup.

**Action.**
1. Asked Acko if they could fire a webhook to Amazon when a renewal completes on their side. Answer: not in Phase 0 (their roadmap had it for Phase 1).
2. Designed the daily-poll alternative: ISNP Renewal Service polls Acko's renewal-status API daily for all active renewal cohorts. If renewal complete → run the cleanup workflow.
3. Surfaced the bounded latency cost in the design doc: "Worst case, a customer who renews on Acko Monday afternoon gets one stale reminder Tuesday morning before our daily poll fires Tuesday evening. Acceptable for Phase 0; revisit when Acko ships the webhook."
4. Got Product sign-off.

**Result.** Cleanup worked end-to-end at launch. Stale-reminder rate was below the bounded-latency expectation (most customers don't renew on Acko.com — Amazon's funnel is wider). When Acko shipped the webhook in their later release, we swapped the daily-poll for the webhook in a 1-line change.

**Why this story works for FDSE + Product.**
- **FDSE signal:** designed for the partner's Phase 0 capabilities, anticipated the Phase 1 swap.
- **Product signal:** quantified the cost of the workaround (one stale reminder), made the trade-off explicit in writing.

---

### Story 4 — Cross-team coordination on the three customer ingresses

**Situation.** Three customer ingresses needed coordinated changes: ISNP Reminder Service (email/push/APD), the Auto Insurance Landing Page team (the Renew Now widget), and the YO/OD post-purchase team (the Renew Policy button). Each team had its own deploy cadence and roadmap pressure.

**Task.** Land all three ingresses in Phase 0 without delay-blocking any team.

**Action.**
1. Wrote a one-page integration contract for each team's surface. Contract was: "Receive (renewal_url, renewal_price) from us. Display per these specs. Fire cleanup when we tell you. Here's the API."
2. Set up a single weekly sync across all three teams. Shared status doc, status emoji per dependency.
3. Sequenced the work: ISNP Reminder Service had the longest lead time (template review + comms-team approval), so I shipped that first. Then Landing Page widget. Then YO/OD button. Cleanup workflow came last because it needed all three to be live first.
4. Built a feature flag for the new flow per ingress.

**Result.** All three ingresses shipped on schedule. No team was blocked on me. The single weekly sync caught two cross-team contract drift issues before they hit production.

**Why this story works for FDSE + Product.**
- **FDSE signal:** explicit cross-team contract, sequencing by lead time, feature-flag de-risking.
- **Product signal:** coordinated three teams through one weekly sync + a status doc — minimal meeting overhead, maximum visibility.

---

### Story 5 — On-call: the trigger-misfire incident

**Situation.** Two weeks post Phase 0 launch, alarms fired for "T-60 trigger fire rate dropping." Investigation showed: ISNP Renewal Service was missing trigger fires for some policies — the trigger was scheduled but the callback was never delivered.

**Task.** Triage. Decide rollback vs fix-forward.

**Action.**
1. Pulled audit logs. Confirmed: triggers were being scheduled correctly at policy-purchase time, but a subset weren't firing at T-60. Customer impact: customers in the affected cohort weren't seeing renewal reminders, widgets, or pre-filled URLs.
2. Pulled the trigger-store data. Found: a small subset had a corrupt timestamp field (a bug in the upstream policy-purchase event handler). Trigger store was looking for the corrupt format and silently failing.
3. Did NOT roll back. Customer impact was bounded — the affected cohort was small, and missed customers would still see the standard fresh-purchase flow as fallback.
4. Hot-fix forward: added timestamp-validation at trigger-schedule time. Wrote a backfill job that re-scheduled all corrupt triggers using the policy expiry date as the canonical source.
5. Wrote up the COE. Closed in 36 hours.

**Result.** Trigger fire rate returned to baseline. The affected cohort got their reminders late but before policy expiry — no customer regulatorily lapsed because of the bug. Backfill job was run as a one-off; the validation prevented recurrence.

**Why this story works for FDSE + Product.**
- **FDSE signal:** triaged by impact, fixed forward with a backfill, didn't panic-rollback.
- **Product signal:** ensured no customer lapsed because of the bug (the actual customer-pain). Engineering metrics-vs-customer-impact framed correctly.

---

### Story 6 — Owning the design doc and the cross-team alignment

**Situation.** One-Click Renewals had Product backing but no design — just a "we should fix renewal drop-off" on the team's PTG.

**Task.** Convert it to a shipped design with cross-team commitment.

**Action.**
1. Wrote the design doc: customer pain (lapse rate), tenets (one-click feel, regulatory safety, partner-side resilience), Phase 0 scope (the rebuild), success criteria (renewal conversion improvement, stale-reminder rate below threshold, zero customer lapses traceable to system).
2. Ran the design review with ISNP Renewal Service, ISNP Gateway, Heimdall, Enigma, Reminder Service, Landing Page, YO/OD, and Acko's tech counterpart. One meeting, all stakeholders.
3. Captured every objection in real time. Heimdall wanted clarity on Acko's failure modes. Enigma wanted the application-creation idempotency contract. ISNP Reminder Service wanted the cleanup-trigger spec. Landing Page wanted the widget rendering contract.
4. Sent the doc for written sign-off within 48 hours. Got VP-level sign-off, locked timeline.

**Result.** Phase 0 had explicit cross-team commitment in writing before any code was written. The doc became the canonical reference for subsequent insurance-renewal projects (health insurance, life insurance) on the ISNP team.

**Why this story works for FDSE + Product.**
- **Product signal:** owned the problem framing, the customer-pain quantification, the cross-team contract negotiation.
- **FDSE signal:** the design doc had Acko API contracts, DynamoDB application schemas, AppSync resolver shapes, Heimdall failure-mode handling — engineering and strategy in the same artifact.

---

## 7. Likely interview questions + crisp answers

### 7.1 Architecture / system design

**Q: Walk me through what happens when a customer renews via the email link.**
> "Customer receives the T-30 / T-15 / T-7 / T-3 / T-1 reminder email with the pre-filled renewal_url. Clicks. Lands on the Quotes page with vehicle + plan + covers + add-ons all pre-selected (from the Enigma application created at T-60). Sees the renewal banner + price. Clicks Continue. System checks the 'no edit other than pincode' rule; if clean, proceeds to Review. Skips the Application page entirely. Customer pays on Review. ISNP Renewal Service triggers cleanup — suppresses remaining reminders, kills widgets, marks renewal_url consumed. End-to-end: 3 customer clicks, ~30 seconds."

**Q: Why GraphQL (AppSync) for ISNP Gateway and not REST?**
> "Composition. The renewal pre-processing combines data from Heimdall (renewal_plan + price) and Enigma (application_id) in one client-facing call. GraphQL is the natural fit for 'multiple sub-services into one query' patterns. AppSync gave us managed integrations with DynamoDB (Enigma) and Lambda (Heimdall) with zero infrastructure to maintain. Schema-first contract was the cross-team alignment win — every team knew exactly what they could ask for."

**Q: What's the failure mode if Acko is down at T-60?**
> "Heimdall is the abstraction. On Acko outage, Heimdall returns cached renewal-plan data with a 'stale' marker, OR fails-fast for regulatory-blocker errors. ISNP Renewal Service treats stale-cached as 'reschedule for retry in 4 hours' — the trigger is durable, so missed T-60 fires recover automatically when Acko comes back. Customer doesn't see anything different — reminders fire on schedule once the data refreshes."

**Q: What's the rollback strategy?**
> "Three layers. One — feature flag on the new renewal flow vs the legacy fresh-purchase path; flip the flag to fall back. Two — the cleanup workflow is independent of the trigger workflow, so cleanup-only deploys roll back independently. Three — even mid-flight crashes are recoverable: trigger store is durable, application-id in Enigma is the idempotency key, so retries don't double-create applications."

**Q: Where are the cross-team contracts?**
> "Eight. (1) ISNP Renewal Service ↔ ISNP Gateway — the GraphQL query for renewal pre-processing. (2) ISNP Gateway ↔ Heimdall — Lambda resolver for plan fetch + price compute. (3) Heimdall ↔ Acko — partner-side API contract for renewal-plan + renewal-status. (4) ISNP Gateway ↔ Enigma — DynamoDB resolver for application creation. (5) ISNP Renewal Service ↔ ISNP Reminder Service — reminder dispatch + suppression API. (6) ISNP Renewal Service ↔ Landing Page — widget rendering API. (7) ISNP Renewal Service ↔ YO/OD — Renew Policy button rendering API. (8) ISNP Renewal Service ↔ Marketing — banner + APD attribution."

### 7.2 Data / DB

**Q: Why DynamoDB for Enigma (application store)?**
> "Single-key access pattern (application_id), schemaless evolution (insurer-specific fields), bursty read patterns (T-60 + T-30 + T-15 + click traffic). DynamoDB scales for the bursts without provisioning. RDS would have required write-tier provisioning and table migrations for new insurer-specific fields."

**Q: What's the schema of the trigger store in ISNP Renewal Service?**
> "Hash-key on policy_id. Stores: trigger_fire_at (timestamp), trigger_status (PENDING / FIRED / CANCELLED), application_id (set after T-60 pre-processing), renewal_url, renewal_price. Sort-key on trigger_fire_at for the daily-poll path. We retain forever — audit trail."

**Q: How big does the trigger store get?**
> "Bounded by active-policy count. Auto-insurance policies are annual, so the trigger store size is roughly equal to the active customer count × policies-per-customer. Comfortably small for DynamoDB at any realistic scale."

### 7.3 Customer flow / Product

**Q: Why pre-fill on Quotes page instead of Review page?**
> "The customer needs a confirmation moment between 'I clicked the email' and 'I'm paying.' Quotes page provides that. Skipping straight to Review removes the option to edit pincode (legitimate edge case) and feels more transactional. Quotes page is the right surface — visible enough to confirm, low-friction enough to keep one-click feel."

**Q: What if the customer's policy is already expired when they click?**
> "We route to the inspection flow, not renewal. Regulatory: an expired auto-insurance policy needs a 30-day vehicle inspection before re-insuring. The system detects expiry on click (the renewal_url has a freshness check) and shows the inspection-required messaging instead of pretending we can renew. Phase 0 ingresses also stop firing for expired policies — Renew Now widget switches to Inspection Required."

**Q: What if the customer renews directly on Acko.com instead of Amazon?**
> "Daily poll on Acko's renewal-status API. If renewal complete, run the cleanup workflow — suppress remaining reminders, kill widgets, mark renewal_url consumed. The bounded latency cost: one stale reminder if customer renews on Acko Monday afternoon and our daily poll runs Tuesday evening. Acceptable for Phase 0; Phase 1 swaps to Acko's webhook when they ship it."

### 7.4 Behavioral / leadership

**Q: How did you decide the "edit anything but pincode" rule?**
> "Started with the Product question: when is an edit-on-renewal still a renewal? Walked through the field list. Pincode is the only one a customer might legitimately need to edit (they moved). Vehicle, plan, covers — any edit on those means a different purchase decision, not the same policy. Renewal-cohort data integrity matters for the metric. Documented in the design doc, got Product agreement, shipped it."

**Q: What was the hardest conversation?**
> "The 'drop the Application page' debate with Product. They were hesitant because 'regulatory might require it.' I had to verify the regulatory claim (no, it doesn't), pull funnel data showing it was a drop-off point, and frame the trade-off as 'one click feel vs hypothetical regulatory hedge.' What worked was bringing the data — funnel numbers + regulatory sources — instead of just arguing the principle."

**Q: What would you do differently?**
> "Two. One — push Acko harder for the renewal-status webhook in Phase 0, not Phase 1. The daily-poll workaround was bounded but suboptimal; if I had escalated harder at design-review time we might have gotten the webhook earlier. Two — build the renewal-conversion analytics dashboard before launch, not after. We caught the funnel improvement after launch via DWH; building it pre-launch would have given us conversion data faster."

**Q: Why does this matter for UnifyApps?**
> "Because long-running customer relationships with regulatory or contractual deadlines are everywhere in enterprise SaaS. Subscription renewals. License renewals. Compliance recertifications. Each one has the same shape: T-N trigger from the SOR, partner-side data fetch + customer-side application creation, multiple notification ingresses, customer-experience polish, multi-event cleanup, partner-vs-self renewal disambiguation. I've shipped this shape end-to-end. The Product judgment ('skip the Application page') and the FDSE judgment ('three convergent cleanup triggers') are the same primitives."

---

## 8. Amazon → UnifyApps mapping

| Amazon ISNP One-Click Renewals context | UnifyApps FDSE / Product equivalent |
|---|---|
| Acko = insurer partner with quirky API + multi-quarter roadmap | UnifyApps customer's existing partner / SOR (Salesforce, ServiceNow, SAP, Workday, payment processor) |
| ISNP Renewal Service (T-60 trigger lifecycle) | Customer-side scheduled-trigger system (any renewal / recertification / time-based action) |
| ISNP Gateway (AppSync GraphQL orchestration) | Customer-facing API gateway composing multiple sub-services |
| Heimdall (insurer-facing translation layer) | Adapter / translation layer between customer system and external partner |
| Enigma (DynamoDB application store) | Customer-side state-of-record with bursty access patterns |
| Three customer ingresses with one trigger source | Single customer-event-source feeding multiple notification + UI surfaces |
| "Edit anything but pincode → no longer renewal" rule | Product trade-off rule preserving cohort metric integrity |
| Three convergent cleanup triggers | Convergent state-cleanup pattern in distributed customer flows |
| Daily Acko-poll workaround for missing webhook | Partner Phase 0 capability gap with Phase 1 swap path |
| Lapse rate as customer-pain metric | Customer's regulatory / contractual KPI |
| Cross-team coordination through one weekly sync | Multi-team customer engagement cadence |

---

## 9. PM-rubric callouts

1. **Customer-pain quantification.** Lapse rate as the headline metric. Every dropped renewal is regulatory non-compliance for the customer + lost revenue.
2. **Trade-off articulation.** "Skip Application page" debate with Product, "edit anything but pincode" rule, "daily poll vs Acko webhook" decision — every Product call argued in writing with data.
3. **Phasing discipline.** Phase 0 (T-60 + 3 ingresses + daily poll) → Phase 1 (multi-vehicle, partial-renewal, Acko webhook integration). Explicit, written.
4. **Scope discipline.** Said no to multi-vehicle bulk renewal in Phase 0 with the math (incremental complexity, narrow customer cohort, defer to Phase 1).
5. **Partner negotiation.** Drove the Acko API contract for renewal-plan + renewal-status. Designed Heimdall to absorb future Acko-side changes.
6. **Schema evolution.** Enigma DynamoDB schemaless evolution for new insurer-specific fields without migrations.
7. **Cross-team coordination.** ISNP Renewal Service, Gateway, Heimdall, Enigma, Reminder Service, Landing Page, YO/OD, Marketing, Acko — nine surfaces touched, all coordinated through one design doc + one weekly sync.

---

## 10. Anti-patterns to avoid

1. **Don't lead with code.** Lead with the lapse-rate customer-pain, then the regulatory framing, then the architecture, then the implementation.
2. **Don't oversell scope.** I owned the renewal-flow design end-to-end. The Reminder Service comms templates were Reminder Service; the Landing Page widget was Landing Page; Heimdall's adapter code was Heimdall. I owned the integrations, not the internals.
3. **Don't say "we" when "I" is true.** I wrote the design doc. I made the "skip Application page" call. I authored the "edit anything but pincode" rule.
4. **Don't dismiss alternatives.** When defending the daily-poll workaround for Acko-side renewal, name the webhook approach as a real option, then say why it lost (Acko Phase 1 timing).
5. **Don't undersell the regulatory framing.** Auto-insurance is regulated. The customer-pain isn't "renewal is annoying"; it's "lapsed customers are illegally driving and risk regulatory penalty." That framing matters.
6. **Don't volunteer DSA.** Use the deflection from the cheat sheet.

---

## 11. Pre-call checklist (run 30 minutes before the loop)

- [ ] Memorize the dual-role pitch in §0.
- [ ] Memorize the four-component architecture: ISNP Renewal Service / ISNP Gateway / Heimdall / Enigma.
- [ ] Memorize the three cleanup triggers (Amazon-renewal / Acko-renewal / expiry).
- [ ] Memorize the "edit anything but pincode" rule.
- [ ] Be ready to draw the §3 architecture diagram.
- [ ] Run through the 6 leadership stories in §6 out loud, ≤90 seconds each.
- [ ] Re-read §8 mapping and §9 PM-rubric callouts.
- [ ] If they ask DSA → deflect per `UNIFYAPPS_FDSE_INTERVIEW_CHEATSHEET.md` §8.

---

## 12. Post-call — update this doc

- The one question you wished you'd answered differently.
- The actual answer you'd give now.
- Anything they pushed on that you didn't anticipate.
