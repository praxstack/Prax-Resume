# UnifyApps FDSE (Forward Deployed Software Engineer) Project Answer Bank - INSP/ISNP (Insurance Platform) One-Click Renewal

> Audience: private interview prep for Prakhar.
> Goal: explain the Insurance One-Click Renewal system as a senior FDSE (Forward Deployed Software Engineer), technical lead, and product-minded owner.
> Use case: UnifyApps FDSE (Forward Deployed Software Engineer) interview, especially when asked to show enterprise workflow thinking beyond the assignment.

---

## 0. Guardrails Before You Speak

Use this doc as interview prep, not as a source for exact public claims unless the metric or responsibility appears on your resume.

Truth-safe wording:

> "I worked on / designed a key slice of the One-Click Renewal system."

Stronger wording only if accurate:

> "I led the technical design for the renewal URL strategy, application-linking model, and rollout plan across UI, Gateway, Renewal Service, and partner integrations."

When describing leadership, do not say "I managed 20 people" unless true. Say:

> "I was the technical owner for the design thread. I aligned PM (Product Manager), UI, Gateway, Reminders, Marketing, and partner-integration stakeholders around the same state model."

---

## 1. Source Docs Read

Local docs inspected under `Interview-Prep/AllProjectAndOtherFiles/`:

- `[1-click renewals] Overall design.pdf`
- `[1-click renewals] Overall design (1).pdf`
- `Design_INPayments_Insurance_Auto_OneClickRenewals_Design_WebHome.pdf`
- `Design_INPayments_Insurance_Auto_OneClickRenewals_Design_WebHome (1).pdf`
- `Design_INPayments_Insurance_Auto_OneClickRenewals_Design_WebHome (2).pdf`
- `Renewal_URL_INPayments_Insurance_Auto_OneClickRenewals_Design_Renewal.pdf`
- `Renewal_Purchase_Journey_INPayments_Insurance_Auto_OneClickRenewals.pdf`
- `OneCickRenewals.pdf`
- `OneClickRenewals.png`
- `_ One-Click Renewals Overview HLD.drawio.png`
- `AmazonGql For ISNP Gateway Layer [Wiki].pdf`

Docs present but exported as permission/error pages locally:

- `One-Click Renewals Task Plan.pdf`
- `One-Click Renewals Task Plan (1).pdf`
- `Design choices of Reminder & Renewals.pdf`
- `Design choices of Reminder & Renewals (1).pdf`

The prep below is grounded in the readable design docs and diagrams.

---

## 2. Terms To Say With Full Forms

Use the full form once, then the abbreviation.

This document repeats full forms in headings and major interview answers so you can jump into any section without going back to the glossary.

- INSP / ISNP (Insurance Platform): Amazon insurance platform area. The docs use ISNP and INSP-style naming interchangeably.
- FDSE (Forward Deployed Software Engineer): engineer close to the customer/business problem who owns design, implementation, integration, and production rollout.
- PM (Product Manager): product owner responsible for customer problem, scope, and metrics.
- Acko: third-party insurance partner / insurer used for auto-insurance plans and renewal checks.
- NAWS (Native Amazon Web Services): Amazon internal/native AWS-based infrastructure.
- AWS (Amazon Web Services): cloud infrastructure platform.
- AppSync (AWS AppSync): managed GraphQL API service used by Gateway.
- GraphQL (Graph Query Language): API query language where clients request exactly the fields they need.
- API (Application Programming Interface): contract for two systems to communicate.
- Ajax (Asynchronous JavaScript and XML): browser-side request made after HTML page load.
- SSR (Server-Side Rendering): HTML generated on the server before reaching the browser.
- DDB / DynamoDB (Amazon DynamoDB): managed NoSQL database.
- GSI (Global Secondary Index): alternate DynamoDB query index.
- DWH (Data Warehouse): analytics store used by marketing/operations.
- Lambda (AWS Lambda): serverless compute used for async or scheduled jobs.
- ECS (Elastic Container Service): AWS container orchestration service.
- HEX-AWS: internal AWS-hosted service framework mentioned in Gateway/AppSync migration context.
- VTL (Velocity Template Language): mapping language used by AppSync resolvers.
- YO (Your Orders): Amazon order-list page.
- OD (Order Details): Amazon order details page.
- APD (Amazon Push Delivery): push notification channel mentioned with renewal reminders.
- Ingress: customer entry point into renewal, such as email reminder, push notification, marketing banner, vehicle number, Renew Now widget, YO (Your Orders), or OD (Order Details).
- Renewal URL: link that starts renewal flow.
- Customer-specific URL: renewal URL with old application ID, for example `/auto-insurance/renew?id=A1`.
- Generic URL: renewal URL without old application ID, for example `/auto-insurance/renew`.
- T-60: 60 days before policy expiry date.
- A1: old policy application due for renewal.
- A2: existing renewal application already linked to A1.
- A3: newly created replacement renewal application when A2 is absent or invalid.
- Policy application: stored insurance application/policy record.
- Applicant Store: store containing applicant/customer details.
- PolicyApplicationStore: store containing application and policy state.
- MetaStore: metadata store referenced in latency data.
- Milestone engine: state/routing engine that decides which page the user should land on based on fields present in the application.
- Quote Generation: partner/API call that generates eligible plans and premium quote.
- Quote Finalization: call that finalizes the selected quote before review/payment.
- Heimdall: partner integration layer used to communicate with Acko.
- Enigma: policy/application data service.
- Gateway layer: AppSync/GraphQL layer connecting UI and backend services.
- Renewal Service: service responsible for renewal triggers, preprocessing, ingress integration, price sync, and clean-up.
- Idempotency: safe repeat behavior where retries do not duplicate business side effects.
- Clean-up: stopping renewal reminders, banners, and widgets after renewal or expiry.
- Price sync: refreshing renewal price after endorsement, claim, or partner-side change.
- SLA (Service Level Agreement): external availability or response-time commitment.
- SLO (Service Level Objective): internal reliability target.
- TTM (Time To Market): speed to launch.
- RCA (Root Cause Analysis): investigation of why a failure happened.

---

## 3. 30-Second Pitch

> "One-Click Renewal was built to reduce friction in auto-insurance renewals. The customer had already given us vehicle, applicant, and policy context during the original purchase, so renewal should not restart from a blank form. I treated it as a workflow orchestration problem: multiple ingresses like reminders, marketing banners, vehicle number entry, Renew Now widget, YO (Your Orders), and OD (Order Details) all needed to land the customer safely on Quotes with prior plan, covers, and add-ons pre-selected. The core technical decision was using old application A1 as the stable renewal URL anchor, while resolving or creating the current renewal app A2/A3 behind the scenes and linking them both ways. That made the URL stable, prevented stale applications, supported clean-up after Amazon or Acko renewal, and kept the system extensible for future insurance categories."

Shorter version:

> "I did not design it as just a deep link. I designed it as a stateful renewal workflow: stable URL, safe data fetch, old-new application linking, milestone routing, partner quote generation, and clean-up."

---

## 4. Explain It In Easy Language

Before One-Click Renewal, renewal behaved too much like buying insurance from scratch:

```text
Reminder click
  -> generic landing page
  -> enter vehicle details again
  -> enter applicant details again
  -> choose plan again
  -> review
  -> pay
```

But renewal is not a new relationship. Amazon already knows the old policy, the vehicle, the selected plan, the covers, and the add-ons.

After One-Click Renewal:

```text
Reminder / widget / order page / vehicle number
  -> renewal URL or renewal detection
  -> fetch old policy A1
  -> reuse or create renewal app A2/A3
  -> land on Quotes page
  -> previous plan/covers/add-ons already selected
  -> skip Application page
  -> review
  -> pay
```

Simple analogy:

> "It is like renewing a gym membership. The gym should not ask your name, address, and membership type again. It should show your existing plan, ask if you want to continue, and take payment. The hard part is making sure every reminder, banner, and order page points to the same correct renewal state."

---

## 5. Product / PM (Product Manager) Framing

Use this for "why did this matter?"

> "The business problem was renewal conversion and customer effort. Auto insurance is form-heavy, and every repeated form field is a drop-off point. One-Click Renewal reduced friction by reusing existing policy context and moving the customer directly to the decision point: quote review and payment."

Product goals:

- Reduce renewal journey steps.
- Use prior policy data instead of asking again.
- Pre-select previous plan, covers, and add-ons.
- Skip Application page where data is already known.
- Support multiple customer ingresses.
- Handle expired policies by starting inspection flow.
- Stop reminders once customer renews through Amazon or Acko.
- Avoid stale renewal applications and broken old email links.

PM (Product Manager) style answer:

> "I would define success as renewal conversion lift, click-to-quote latency, percentage of customers landing directly on Quotes, drop-off from Quotes to Review, reminder clean-up correctness, and support contacts caused by stale or wrong renewal prompts."

Resume-backed metric guardrail:

> "If the interviewer has my resume, I can mention the 60%+ renewal lift stated there. If not, I would speak in terms of target metrics rather than inventing exact numbers."

---

## 6. HLD (High-Level Design)

```text
Customer Ingresses
  |
  |-- Renewal reminders: Email / Push / APD (Amazon Push Delivery)
  |-- Marketing banners
  |-- Vehicle number / GetVehicles
  |-- Renew Now widget on landing page
  |-- YO (Your Orders) / OD (Order Details)
  |
  v
Renewal URL or renewal detection
  |
  |-- customer-specific: /auto-insurance/renew?id=A1
  |-- generic:          /auto-insurance/renew
  |
  v
ISNP/INSP Horizonte UI (Insurance Platform UI)
  |
  |-- returns loader HTML only
  |-- fires Ajax (Asynchronous JavaScript and XML) request for sensitive data
  |
  v
Gateway Layer - AppSync (AWS AppSync) / GraphQL (Graph Query Language)
  |
  |-- fetch A1 old policy application from PolicyApplicationStore
  |-- check renewal eligibility
  |-- find linked A2 renewal application
  |-- if A2 valid: return A2 + applicant details
  |-- if A2 absent/invalid:
        |
        |-- call Quote Generation through Heimdall -> Acko if price needed
        |-- create A3 renewal application using A1 data
        |-- copy applicant details from A1 to A3
        |-- link A1 <-> A3
        |-- return A3 + applicant details
  |
  v
Milestone Engine
  |
  |-- enough fields present -> Quotes page
  |-- proposal/order exists -> Review / next page
  |
  v
Quotes Page
  |
  |-- previous plan, covers, add-ons pre-selected
  |-- renewal messaging shown
  |
  v
Review Page -> Payment -> Renewal Success
  |
  v
Renewal Service
  |
  |-- clean up reminders/widgets/banners
  |-- update renewal URL/price on partner changes
```

Senior summary:

> "Gateway owns the synchronous UI path. Renewal Service owns the asynchronous lifecycle around triggers, ingresses, price sync, and clean-up. Heimdall owns insurer communication with Acko. That boundary was the main design decision."

---

## 7. HLD (High-Level Design): Preprocessing, Journey, Clean-Up

```text
PREPROCESSING FLOW - Phase 1

Policy purchased
  -> T-60 trigger scheduled
  -> ISNP/INSP (Insurance Platform) Renewal Service gets callback
  -> Gateway/AppSync fetches A1
  -> Gateway calls Heimdall -> Acko for renewal plan details
  -> Gateway creates/links A2 or A3
  -> Renewal Service attaches URL and optional price to ingresses
```

```text
PURCHASE JOURNEY - Phase 0/1

Customer clicks ingress
  -> renewal URL hits UI
  -> UI returns loader
  -> Ajax (Asynchronous JavaScript and XML) calls Gateway/AppSync (AWS AppSync)
  -> Gateway resolves A1 -> A2/A3
  -> Milestone engine redirects to Quotes
  -> Quotes pre-selects previous plan/covers/add-ons
  -> Continue skips Application page
  -> Review -> Payment
```

```text
PRICE SYNC AND CLEAN-UP

Acko endorsement / claim / renewal
  -> Heimdall notifies Amazon
  -> Renewal Service decides update vs clean-up
  -> Gateway refreshes price or updates renewal application
  -> Customer ingresses get updated or removed

Amazon renewal success
  -> Orchestrator / DWH (Data Warehouse) Lambda (AWS Lambda) notifies Renewal Service
  -> Renewal Service cleans up ingresses
```

Why this matters:

> "The journey is not complete when payment succeeds. If reminders keep firing after renewal, the system is wrong from the customer's point of view. Clean-up is part of correctness."

---

## 8. LLD (Low-Level Design): Application State Model

Core objects:

```text
A1 = old accepted policy application due for renewal
A2 = current linked renewal application, if already created
A3 = new renewal application created when A2 is missing or invalid
```

Two-way link:

```text
A1.renewalDetails.renewalApplicationId = A2 or A3
A2/A3.renewalDetails.parentApplicationId = A1
```

Why two-way link:

- From old policy A1, the system can find the current renewal attempt.
- From renewal app A2/A3, the system can find the parent policy.
- Clean-up can know which original policy was renewed.
- Stale applications can be controlled.
- If A2 is discarded/invalid, A3 can be created and linked without breaking old URLs.

State table:

| State / Object | Meaning | System action |
|---|---|---|
| A1 accepted and due in [T-60, T] | Eligible old policy | Allow renewal |
| A1 not due yet | Too early | Error or safe fallback |
| A1 already renewed | Renewal completed | Clean-up / do not activate ingress |
| A2 linked and valid | Renewal app already exists | Reuse A2 |
| A2 linked but invalid/discarded | Existing renewal app cannot continue | Create A3 and relink |
| A3 created | New working renewal app | Copy data, link both ways, continue |
| Policy expired | Renewal needs inspection | Start inspection flow |

Interview line:

> "The data model decision was the heart of the system. Old application A1 is the stable business anchor. Renewal application A2 or A3 is the mutable working copy."

---

## 9. LLD (Low-Level Design): Customer-Specific URL Flow

Customer-specific URL:

```text
/auto-insurance/renew?id=A1
```

Flow:

```text
1. Customer clicks reminder / YO (Your Orders) / OD (Order Details) / Renew Now widget.
2. UI receives /renew?id=A1.
3. UI returns loader HTML.
4. Browser fires Ajax (Asynchronous JavaScript and XML) call to Gateway/AppSync (AWS AppSync).
5. Gateway fetches A1 from PolicyApplicationStore.
6. Gateway checks:
   - A1 exists
   - A1 is due for renewal
   - A1 is not already renewed
7. Gateway checks A1.renewalDetails.renewalApplicationId.
8. If A2 exists and is valid:
   - fetch A2
   - fetch applicant details
   - return A2
9. If A2 absent or invalid:
   - optionally call Quote Generation via Heimdall -> Acko
   - create A3 using A1 data
   - copy applicant details to A3
   - set A3.renewalDetails.parentApplicationId = A1
   - set A1.renewalDetails.renewalApplicationId = A3
   - return A3
10. Milestone engine routes customer to Quotes.
```

Why not use A2/A3 in the URL?

> "A2 and A3 can become invalid, discarded, or replaced. A1 is stable because it represents the policy due for renewal. Keeping A1 in the URL means old emails and widgets keep working even if the backend recreates the renewal application."

---

## 10. LLD (Low-Level Design): Generic URL Flow

Generic URL:

```text
/auto-insurance/renew
```

Why it exists:

- Marketing banners could not reliably inject customer-specific application ID from DWH (Data Warehouse) segments.
- A generic URL is static and easy for the marketing system to place.

Flow:

```text
1. Customer clicks marketing banner.
2. UI hits /auto-insurance/renew without A1.
3. Gateway uses customer identity from session.
4. Gateway queries accepted policies using customerId + applicationStatus index.
5. Gateway filters policies whose expiry date is within [T-60, T].
6. If multiple policies match, apply deterministic selection.
   - docs mention preference such as active over expired
   - car over bike when expiry ties
7. Resolve selected A1 using the same A1 -> A2/A3 logic.
8. Return renewal application and applicant details.
9. Milestone engine lands customer on Quotes.
```

Tradeoff:

> "Generic URL improves marketing integration but costs more backend work and higher latency because the backend has to discover the eligible policy."

---

## 11. Ingress Matrix

| Ingress | Phase | URL type | Price shown? | Reason |
|---|---:|---|---|---|
| Renewal reminders: Email / Push / APD (Amazon Push Delivery) | P0 | Customer-specific `/renew?id=A1` | Not in P0 | Reminder service already has A1 |
| Marketing banners | P0 | Generic `/renew` | No | DWH/marketing path cannot inject A1 reliably |
| Vehicle number / GetVehicles | P0 | No URL required | No | Acko returns vehicle details and `isRenewal` flag |
| Recent Searches | P0 | Existing application resume | No | Drafted/finalized/sent-for-payment apps already show |
| Renew Now widget on landing page | P1 | Customer-specific `/renew?id=A1` | Optional/future | Widget is tied to known policy row |
| YO (Your Orders) | P1 | Customer-specific `/renew?id=A1` | Not core requirement | Order page can carry policy application |
| OD (Order Details) | P1 | Customer-specific `/renew?id=A1` | Not core requirement | Order details page can carry policy application |

Interview line:

> "I did not force one URL strategy everywhere. Customer-specific URL is better when the ingress knows the policy. Generic URL is the practical compromise for marketing."

---

## 12. Renewal Purchase Journey Details

Entry points:

1. Renewal URL attached to an ingress.
2. Registration number entered on landing page.
3. Customer enters full details in normal flow, and Acko later returns `isRenewal=true`.

Rules:

- Renewal URL or registration number should land customer on Quotes page directly.
- Quotes page should pre-select previous plan, covers, and add-ons.
- Quotes page should show renewal messaging.
- Continue from Quotes should skip Application page and land on Review page.
- If customer edits vehicle details other than pincode, renewal flow stops and normal flow starts.
- If customer drops off, show in Recent Searches in P0 and Renew Now widget in P1.
- If policy is expired, start inspection flow.

Why skip Application page:

> "Application page mostly asks details the system already has from A1: applicant name, email, expiry date, registration number, and vehicle details. In renewal, the safer UX is to reuse verified prior data and ask the customer to review, not retype."

Why disable vehicle edits except pincode:

> "Acko was the source of truth for renewal eligibility and primarily checked registration number. If we let customers freely edit vehicle details, we would need a complex local eligibility engine. Disabling edits except pincode was simpler, safer, and closer to partner behavior."

---

## 13. Quote Generation And saveMilestone

Quote Generation resolver change:

```text
quoteGeneration request
  -> call Acko for eligible plans
  -> if renewal:
       fetch parent accepted application using customerId + applicationStatus
       filter by same registration number
       fetch previous plan / covers / add-ons
       include parentApplicationId in response
  -> UI pre-selects previous selections
```

saveMilestone resolver change:

```text
saveMilestone request includes parentApplicationId
  -> create/update renewal application
  -> set renewalApp.renewalDetails.parentApplicationId = parentApplicationId
  -> fetch parent A1
  -> set parent.renewalDetails.renewalApplicationId = renewalAppId
  -> save parent
```

Why this matters:

> "This handles the case where renewal is detected through registration number rather than a renewal URL. We still establish the same A1 <-> A2/A3 relationship before the journey continues."

---

## 14. Service Responsibility Split

### Gateway Layer - AppSync (AWS AppSync) / GraphQL (Graph Query Language)

Gateway/AppSync handles:

- UI-driven Ajax calls.
- Customer-specific URL resolution.
- Generic URL resolution.
- Fetching A1/A2/A3 from Enigma / PolicyApplicationStore.
- Fetching applicant details from Applicant Store.
- Calling existing Quote Generation flow.
- Returning data for the milestone engine.

Why:

> "Gateway already sat between UI, policy data, applicant data, and partner-backed quote generation. Reusing it for request/response renewal resolution avoided duplicating authentication and data-service wiring."

### Renewal Service

Renewal Service handles:

- T-60 trigger lifecycle.
- Preprocessing renewal URL and optional price.
- Attaching renewal URL/price to customer ingresses.
- Price sync after endorsement or claim.
- Clean-up after renewal from Amazon or Acko.
- Future ingress integration.

Why:

> "Renewal Service is the right place for asynchronous lifecycle work. It needs custom metrics, logs, retries, and integrations with systems that may not speak GraphQL."

### Heimdall

Heimdall handles:

- Communication with Acko.
- Plan/price fetch through insurer APIs.
- Notifications from Acko after endorsement, claim, or partner-side renewal.

Why:

> "Heimdall was the existing partner bridge. The design keeps partner integration centralized instead of letting every new service call Acko directly."

### Enigma

Enigma handles:

- Policy/application data fetch and update.
- Creating new applications.
- Updating renewal details.

---

## 15. Why AppSync Was Not Enough For Everything

AppSync (AWS AppSync) is useful for GraphQL request/response flow, but the docs call out real limitations:

- Debugging and custom metrics are weaker.
- AppSync often returns HTTP 200 even when resolver-level business errors happen.
- VTL (Velocity Template Language) resolvers become hard to maintain for complex logic.
- Batch, throttling, and observability are limited compared with owning a service.
- Query/mutation and resolver limits make long async workflows awkward.

Interview answer:

> "I would not turn AppSync into a workflow engine. I used AppSync/Gateway for synchronous UI data resolution because it already had the right integrations. I used Renewal Service for async orchestration because it needed retries, metrics, logs, non-GraphQL ingress integrations, and future extensibility."

---

## 16. Compute Choice For Renewal Service

Docs recommend Lambda (AWS Lambda) for Renewal Service because:

- Trigger-driven async workload.
- Low expected TPS (transactions per second) for auto-insurance renewal scale in the docs.
- Cost-effective for periodic processing.
- Likely dependency package size within Lambda limits.
- Easy to integrate with scheduled callbacks and event-driven cleanup.

When to move away from Lambda:

- High sustained throughput.
- Long-running workflows.
- Large dependency graph.
- Need always-warm low latency.
- Heavy custom networking or long batch jobs.

Interview line:

> "Lambda was a pragmatic phase-one compute choice. If renewal became a high-throughput multi-category platform service, I would move the long-running orchestration to ECS or a workflow engine, but I would not start there."

---

## 17. Security Design

Important detail:

The renewal URL should not return all policy/applicant data in the first HTML response.

Actual design:

```text
Customer hits /auto-insurance/renew?id=A1
  -> Horizonte returns loader HTML
  -> browser fires Ajax call
  -> Ajax path goes through authenticated/encrypted rails
  -> Gateway returns sensitive renewal data
```

Why:

- Initial HTML travels over public network and can expose decrypted data if overloaded.
- Sensitive applicant, policy, and vehicle data should stay behind authenticated API calls.
- Existing Ajax path had encryption/decryption support for sensitive fields.

Interview line:

> "The first page load is only a shell. Sensitive data comes through the secure Ajax path. That is the right split for UX and data protection."

---

## 18. Reliability And Edge Cases

| Edge case | Handling |
|---|---|
| A1 old application not found | Safe error/fallback to landing page |
| A1 not due for renewal | Do not start renewal |
| A1 already renewed | Do not activate ingress; clean-up |
| A2 exists and valid | Reuse A2 |
| A2 exists but invalid/discarded | Create A3 and relink A1 |
| Customer renews through Amazon | Orchestrator/DWH Lambda notifies Renewal Service for clean-up |
| Customer renews directly through Acko | Acko -> Heimdall -> Renewal Service clean-up |
| Acko endorsement/claim changes price | Heimdall notifies Renewal Service; price sync refreshes ingress |
| Marketing URL has no A1 | Generic URL uses customer identity and policy lookup |
| Registration number flow has no URL | Acko returns `isRenewal`; Gateway fetches prior selection |
| Customer edits vehicle details except pincode | Stop renewal and start normal flow |
| Policy expired | Start inspection flow |
| Customer drops off | Recent Searches in P0; Renew Now widget in P1 |

Senior line:

> "The most dangerous product bug was stale communication: asking a customer to renew after they already renewed. Clean-up was part of correctness, not a notification nice-to-have."

---

## 19. Latency And Performance Talking Points

Doc-provided P90 (90th percentile) latency values:

- Policy Application Store query P90: about 70 ms.
- Applicant Store query P90: about 80 ms.
- Policy Application Store save P90: about 90 ms.
- Applicant Store save P90: about 80 ms.
- Quote Generation P90: about 350 ms.
- MetaStore query P90: about 6 ms.

How to explain:

> "The cheap path is reusing an existing valid A2. The expensive path is creating A3 because it may require quote generation, application save, applicant copy, and parent update. So I would track separate latency SLOs (Service Level Objectives) for reuse path versus create path."

Rough sequential budget for create path:

```text
fetch A1                  ~ 70 ms
quote generation          ~350 ms
save A3                   ~ 90 ms
fetch applicant A1        ~ 80 ms
save applicant A3         ~ 80 ms
update parent A1          ~ 90 ms
--------------------------------
sequential rough total    ~760 ms plus network/framework overhead
```

Do not overclaim this as exact production latency. Say:

> "This is a rough sequential estimate from doc P90s. In production I would measure the real resolver waterfall and parallelize independent calls where safe."

---

## 20. Phasing

Phase 0:

- Renewal reminders: Email, Push, APD (Amazon Push Delivery).
- Marketing banners.
- Vehicle number / GetVehicles.
- Renewal purchase journey.
- Recent Searches drop-off support.
- Clean-up after successful renewal from Amazon or Acko.

Phase 1:

- Renew Now widget on landing page.
- YO (Your Orders) / OD (Order Details) renewal button.
- T-60 trigger creation.
- Preprocessing renewal URL and price.
- Price sync from Acko after endorsement/claim.

How to justify phasing:

> "Phase 0 proved the customer journey and reduced friction quickly. Phase 1 added proactive lifecycle automation: triggers, price sync, widgets, and deeper ingress integration. That sequencing balanced TTM (Time To Market) with architecture correctness."

---

## 21. Tradeoffs

| Tradeoff | Choice | What we gained | What we sacrificed |
|---|---|---|---|
| Customer-specific URL vs generic URL | Hybrid | Specific path where A1 known, generic path for marketing | More resolver logic |
| Put A1 vs A2/A3 in URL | Put A1 | Stable URL even if renewal app changes | Need backend resolution |
| Fetch on click vs preprocess at T-60 | Mix by phase | Faster P0, stronger P1 | P0 cannot show all prices upfront |
| Gateway/AppSync vs Renewal Service | Split responsibility | UI flow stays in Gateway, async flow in service | More components |
| Disable vehicle edits vs validate all edits | Disable except pincode | Simpler, safer, partner-aligned | Less flexibility for customer |
| Existing stores vs new DB | Existing stores | Faster launch, no new data domain | Application model carries more lifecycle state |
| Recent Searches vs Renew Now widget | P0 Recent Searches, P1 widget | Launch now, improve later | P0 UX less dedicated |
| Lambda vs ECS/service | Lambda initially | Cost-effective async trigger handling | Not ideal for long-running heavy workflows |

---

## 22. System Design Extension: If Scale Increases 10x

If the interviewer asks how you productionize this at larger scale:

```text
Policy expiry stream / scheduler
  -> queue by expiry window
  -> Renewal workers
  -> idempotent preprocessing by A1
  -> Gateway/Enigma/Heimdall calls with rate limits
  -> per-ingress update workers
  -> audit table + DLQ (Dead-Letter Queue)
  -> observability dashboards
```

Controls I would add:

- Idempotency key on preprocessing: `renewal-preprocess:{A1}:{expiryDate}`.
- DLQ (Dead-Letter Queue) for failed ingress updates.
- Retry with backoff for Heimdall/Acko failures.
- Per-ingress rate limits so marketing/reminder updates do not overload downstreams.
- Audit events for `triggered`, `preprocessed`, `url_attached`, `price_synced`, `cleaned_up`.
- Dashboard for stale reminders after renewal.
- Alert when clean-up failures exceed threshold.
- Batch scheduling around T-60 to avoid thundering herd.

Senior answer:

> "At small scale, the main risk is correctness. At larger scale, the main risk is fan-out: one policy renewal can touch reminders, banners, widgets, price sync, and cleanup. I would make every fan-out idempotent and observable."

---

## 23. Leadership Answer: How I Led The Design

Use this if asked "How did you lead?"

> "I led by turning a vague renewal requirement into a concrete state model. The PM (Product Manager) cared about fewer steps and higher renewal conversion. UI cared about where to land the customer. Gateway cared about what data was needed for milestone routing. Reminders and Marketing cared about how to attach URLs. Heimdall/Acko cared about partner source-of-truth and renewal state. I aligned everyone around one invariant: A1 is the stable old policy, A2/A3 is the working renewal application, and every ingress should resolve through that model."

How to sound senior:

> "The communication challenge was that each team saw only its own part. Marketing saw a banner link, UI saw a redirect, Gateway saw GraphQL resolvers, and Acko saw quote generation. My job was to make the end-to-end lifecycle explicit: trigger, URL, quote, application state, payment, clean-up."

Stakeholder map:

| Stakeholder | Their concern | What I clarified |
|---|---|---|
| PM (Product Manager) | Customer friction and conversion | Journey from ingress to payment |
| UI / Horizonte | Which page to land on | Milestone engine fields and loader/Ajax flow |
| Gateway/AppSync | Data fetching and mutations | A1 -> A2/A3 resolver workflow |
| Reminders | Email/push URL generation | Use `/renew?id=A1` in P0 |
| Marketing | Static banners | Use generic `/renew` |
| Heimdall / Acko | Partner price and renewal truth | Partner remains source of quote/renewal events |
| Operations | Stale reminders and failure debugging | Clean-up, metrics, and audit events |

---

## 24. Communication With Partner / Cross-Team Teams

If asked "How did you communicate with Acko / partner / internal teams?"

Best hypothetical answer:

> "I would structure partner conversations around contracts, not implementation. With Acko, the contract is: when given policy/vehicle context, return renewal eligibility, eligible plans, renewal price, and whether a policy is already renewed or requires inspection. With internal teams, the contract is: Gateway owns synchronous data resolution, Renewal Service owns lifecycle fan-out, and Reminders/Marketing only need a URL or update callback. That avoids meetings where everyone debates internals instead of agreeing on inputs, outputs, and failure cases."

Meeting style:

- Start with customer journey diagram.
- Confirm source of truth for each field.
- Confirm which team owns each API (Application Programming Interface).
- Confirm failure behavior before coding.
- Confirm launch phase and out-of-scope items.
- Write down one state model that every team uses.

Strong line:

> "The biggest leadership move was forcing the discussion from 'which link do we send?' to 'what state machine are we committing to?'"

---

## 25. Interview Q&A (Questions And Answers) - Core Design

### Q1. Walk me through One-Click Renewal.

> "A customer enters through an ingress like reminder email, marketing banner, vehicle number, Renew Now widget, YO (Your Orders), or OD (Order Details). If the ingress knows the old policy, we use `/auto-insurance/renew?id=A1`; if not, like marketing banners, we use generic `/auto-insurance/renew`. The UI returns a loader and then makes an Ajax (Asynchronous JavaScript and XML) call to Gateway/AppSync (AWS AppSync). Gateway resolves A1, checks eligibility, reuses valid A2 or creates A3, links old and new applications, and returns enough data for the milestone engine to land the customer directly on Quotes. Quotes pre-selects prior plan, covers, and add-ons. After success, Renewal Service cleans up reminders and other ingresses."

### Q2. What was the most important design decision?

> "Using A1, the old policy application, as the stable URL anchor. Renewal applications are working copies and can become invalid or be recreated. A1 is the durable business object. That decision made old email links stable and let the backend safely resolve to the latest valid renewal application."

### Q3. Why did you need a two-way link?

> "A one-way link is enough for one screen, but not enough for operations. A1 -> A2/A3 lets old policy find the renewal attempt. A2/A3 -> A1 lets a renewal success clean up the correct parent policy. That is what prevents stale applications and stale reminders."

### Q4. Why not create a new application every time the URL is clicked?

> "That creates stale renewal applications and makes clean-up ambiguous. If the customer completes one of several renewal applications, you need to know which old policy it corresponds to. Reuse-valid-or-create-new is safer: check A2 first, create A3 only when needed."

### Q5. Why not put the new renewal application ID in the URL?

> "Because a renewal application can be discarded or invalidated after the email is already sent. If the URL contains A2 and A2 becomes invalid, the customer gets a broken journey. If the URL contains A1, the backend can repair the journey by creating A3."

### Q6. Why use a generic URL for marketing banners?

> "Marketing banners were driven from DWH (Data Warehouse) targeting and could not reliably inject customer-specific application IDs into the banner. A generic URL lets marketing use a static link, and the backend discovers the eligible policy from the logged-in customer context."

### Q7. Why Gateway/AppSync for URL resolution?

> "Gateway already integrated with UI, policy application data, applicant data, and quote generation paths. For synchronous UI resolution, reusing Gateway avoided creating duplicate auth and data access in Renewal Service."

### Q8. Why Renewal Service at all?

> "Because the lifecycle around renewal is asynchronous and multi-ingress: triggers, reminder updates, banner updates, price sync, and clean-up. AppSync is not a good workflow engine. Renewal Service gives us custom metrics, logs, retries, and non-GraphQL integrations."

### Q9. Why not store everything in a new renewal database?

> "The renewal state is tightly tied to policy applications. Existing PolicyApplicationStore and Applicant Store already contain the data and lifecycle. Adding a new DB would create synchronization problems before solving a real scale issue."

### Q10. Why Lambda for Renewal Service?

> "The workload is trigger-driven: T-60 callbacks, preprocessing, price sync, and clean-up. Lambda is cost-effective and operationally simple for that shape. I would revisit ECS or a workflow engine only if throughput, dependency size, or long-running orchestration outgrew Lambda."

---

## 26. Interview Q&A (Questions And Answers) - Product And PM (Product Manager)

### Q1. What customer problem did this solve?

> "Renewal should not feel like buying a fresh policy. The customer already gave us details last year, so the product should remember them, pre-select their prior choices, and take them to review/payment faster."

### Q2. What were your success metrics?

> "Renewal conversion, click-to-Quotes success rate, quote-to-payment conversion, drop-off rate, percentage of renewals using pre-fill, stale reminder rate after renewal, and customer support contacts related to renewal confusion."

### Q3. What would you ship in Phase 0?

> "I would ship the journey first: reminders, banners, vehicle-number flow, direct Quotes landing, previous selection pre-fill, Application page skip, Recent Searches recovery, and clean-up. I would defer proactive T-60 preprocessing with price sync to Phase 1."

### Q4. Why not build everything in Phase 0?

> "Because the customer value came from reducing journey friction. Price sync, widgets, and trigger preprocessing are important, but they increase integration complexity. Phase 0 proves the renewal path; Phase 1 makes it proactive and richer."

### Q5. How did you make product and engineering tradeoffs?

> "I separated customer-visible value from platform completeness. Customer-visible value was landing on Quotes with pre-filled data. Platform completeness was T-60 trigger, price sync, and all ingresses. That separation let us launch safely without blocking on every integration."

---

## 27. Interview Q&A (Questions And Answers) - Reliability

### Q1. What happens if Acko price changes after endorsement or claim?

> "Acko notifies Amazon through Heimdall. Renewal Service receives the event, calls Gateway/Heimdall as needed to fetch fresh renewal plan details, updates the renewal application, and updates the renewal price wherever the ingress shows it."

### Q2. What happens if the customer renews directly on Acko?

> "Acko notifies Amazon through Heimdall. Renewal Service treats that as a clean-up event and removes or disables Amazon renewal communications for that policy."

### Q3. What if the customer renews on Amazon?

> "The Amazon renewal success path notifies Renewal Service through orchestrator or DWH (Data Warehouse) Lambda (AWS Lambda). Renewal Service cleans up reminders/widgets/banners so the customer does not continue seeing renewal prompts."

### Q4. What is the worst failure mode?

> "Stale communication after renewal. From the customer perspective, that means Amazon is asking them to renew something they already renewed. That erodes trust and can cause support contacts."

### Q5. How would you monitor it?

> "I would track URL resolution success, A1-not-found, not-due, already-renewed, A2-reuse rate, A3-create rate, quote-generation failures, clean-up failures, price-sync failures, stale reminder count, and p90/p99 latency by path."

---

## 28. Interview Q&A (Questions And Answers) - Security

### Q1. Why not put all policy data in HTML?

> "Because policy and applicant data is sensitive. The first SSR (Server-Side Rendering) HTML response should only return a loader. The actual renewal data should come through authenticated Ajax (Asynchronous JavaScript and XML), where the existing encryption/decryption path handles sensitive fields."

### Q2. What sensitive data exists here?

> "Applicant name, email, vehicle registration, policy details, prior plan, covers, add-ons, and potentially address/pincode. Even if not all fields are equally sensitive, the safe pattern is to avoid putting decrypted policy state in initial HTML."

### Q3. What would you add for production hardening?

> "Authorization checks on A1 access, signed/short-lived links if needed, audit logs for renewal data fetch, rate limits on generic URL lookup, and field-level encryption where required."

---

## 29. Interview Q&A (Questions And Answers) - UnifyApps Mapping

### Q1. How does One-Click Renewal map to UnifyApps?

> "It has the same shape as an enterprise automation workflow. Multiple source systems own different parts of truth: customer ingress, policy store, applicant store, partner insurer, UI routing, and notifications. The platform has to orchestrate data, APIs, customer workflow, retries, and clean-up. That is exactly the FDSE (Forward Deployed Software Engineer) problem space."

### Q2. What would you build on UnifyApps for this?

> "I would model policy expiry as a trigger, policy/application lookup as a connector, Acko quote fetch as an API (Application Programming Interface) integration, renewal app creation as a workflow step, and clean-up as downstream actions to reminders, banners, and widgets. I would add human-review or exception queues for ambiguous eligibility, missing policy, and partner failures."

### Q3. What FDSE skill does this show?

> "It shows the ability to sit between product, customer-facing UX, backend data, partner APIs, and operations. The hard part was not one service; it was making the whole lifecycle correct."

---

## 30. Behavioral Story - Leadership

Use this STAR (Situation, Task, Action, Result) structure.

Situation:

> "Renewal was not one team's feature. It touched reminders, marketing banners, auto-insurance UI, Gateway/AppSync, application storage, Heimdall/Acko, and clean-up."

Task:

> "My task was to turn a broad 'one-click renewal' ask into a concrete design that could be phased and implemented without breaking customer trust."

Action:

> "I framed the design around one invariant: A1 is the stable old policy, A2/A3 is the working renewal application. Then I mapped every ingress to either customer-specific URL or generic URL, defined Gateway versus Renewal Service ownership, and made clean-up a first-class requirement instead of a later notification concern."

Result:

> "That gave teams a shared contract. UI knew what data to expect, Gateway knew resolver responsibilities, Reminders and Marketing knew which URL type to use, and partner integration knew how Acko renewal events fed clean-up."

Strong close:

> "The leadership part was reducing ambiguity. Once the state model was clear, implementation discussions became much smaller."

---

## 31. Behavioral Story - Tradeoff

Question:

> "Tell me about a time you made a tradeoff."

Answer:

> "In One-Click Renewal, we had to choose what ID goes into the renewal URL. Putting the new renewal application ID looked simple because it could take the user directly to a working application. But it was brittle: if that application became invalid, old reminder links would break. I chose the old application ID A1 as the stable URL anchor and resolved the working renewal app server-side. The tradeoff was extra backend logic, but the gain was stable customer links, easier cleanup, and a cleaner lifecycle."

---

## 32. Behavioral Story - Customer Communication

Question:

> "How do you communicate a complex design to non-engineers?"

Answer:

> "I avoid starting with services. For One-Click Renewal, I would start with the customer sentence: 'They should click renew and land on their previous plan without retyping details.' Then I show the journey: reminder -> Quotes -> Review -> payment. Only after that do I explain the technical objects: A1 is old policy, A2/A3 is renewal attempt, and clean-up stops stale reminders. That keeps PM (Product Manager) and stakeholder conversations anchored to customer outcome, while still giving engineering enough precision to build."

---

## 33. Behavioral Story - Incident / On-Call

Hypothetical if asked about a failure:

> "If renewal reminders kept going out after successful renewal, I would first confirm whether the renewal success event reached Renewal Service. Then I would check whether the A1 <-> A2/A3 link exists, whether clean-up fired for the right ingress, and whether the downstream reminder/banner system acknowledged the update. I would stop the bleeding by disabling the affected segment or ingress, then backfill clean-up for impacted A1s. The RCA (Root Cause Analysis) would focus on why clean-up was not idempotent or observable enough."

---

## 34. Questions To Ask The Interviewer

Ask these if they turn the project into a system design discussion:

- "Is the priority first conversion lift, operational correctness, or adding more ingresses?"
- "Which system is source of truth for renewal eligibility: our platform or the insurer?"
- "Do customer ingresses need to show price, or is URL-only enough?"
- "What is the acceptable stale-reminder rate after renewal?"
- "Do we need to support multiple insurers or only Acko initially?"
- "Are marketing systems able to inject customer-specific IDs, or do we need generic URL?"
- "What is the expected policy volume around T-60, and do we need queue-based fan-out?"

---

## 35. Rapid-Fire Table

| Question | Crisp answer |
|---|---|
| What is A1? | Old policy application due for renewal. |
| What is A2? | Existing renewal application linked to A1. |
| What is A3? | Newly created renewal application when A2 is absent or invalid. |
| Why A1 in URL? | A1 is stable; A2/A3 can be recreated. |
| Customer-specific URL? | `/auto-insurance/renew?id=A1`. |
| Generic URL? | `/auto-insurance/renew`. |
| Why generic URL? | Marketing banners cannot reliably inject A1. |
| Why two-way link? | Resolve renewal state in both directions and support clean-up. |
| Why loader plus Ajax? | Avoid sensitive data in SSR (Server-Side Rendering) HTML; fetch through secure path using Ajax (Asynchronous JavaScript and XML). |
| Why AppSync/Gateway? | Existing UI/data/quote integrations. |
| Why Renewal Service? | Async triggers, ingress integration, price sync, clean-up, metrics. |
| Why Heimdall? | Existing partner bridge to Acko. |
| What happens if Acko renewal succeeds? | Heimdall notifies Amazon; Renewal Service cleans up ingresses. |
| What if policy expired? | Start inspection flow. |
| What if vehicle details change? | Stop renewal flow except pincode edit. |
| What is Phase 0? | Core journey, reminders, banners, vehicle number, cleanup. |
| What is Phase 1? | Renew Now widget, YO (Your Orders) / OD (Order Details), T-60 trigger, price sync. |
| Biggest risk? | Stale reminders after renewal. |
| Best metric? | Renewal conversion plus stale-reminder rate. |

---

## 36. One-Line Closers

- "A1 is the stable anchor; A2/A3 is the working renewal copy."
- "One-Click Renewal is not a link feature; it is a lifecycle workflow."
- "Gateway handles synchronous UI resolution; Renewal Service handles async lifecycle."
- "Clean-up is product correctness, not notification polish."
- "The senior design move was creating one state model every team could share."
- "This maps directly to UnifyApps: integrate multiple systems, automate the workflow, and make failure states recoverable."
