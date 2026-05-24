# UnifyApps FDSE Project Answer Bank - Flights Meal Selection

> Audience: private interview prep for Prakhar.
> Goal: explain the Flights Meal Selection / meal preference project as a product-minded FDSE (Forward Deployed Software Engineer) with system-design depth.
> Source material inspected: Flights Meal Selection design, Flights Meal-Select Custom Meal Ordering design.
> Guardrail: describe "I designed / implemented the slice" if you did not own the entire launch.

---

## 1. Terms To Say With Full Forms

- FDSE (Forward Deployed Software Engineer): engineer close to customer/business problems who builds deployable solutions.
- PM (Product Manager): owner of product scope, customer journey, metrics, and rollout.
- MMT (MakeMyTrip): partner Online Travel Agency API provider for flight ancillary options.
- OTA (Online Travel Agency): travel marketplace such as MakeMyTrip or Expedia.
- SSR (Server-Side Rendering): server returns rendered HTML.
- CSR (Client-Side Rendering): frontend renders page in browser using JavaScript.
- Redux: frontend state-management library.
- API (Application Programming Interface): contract between systems.
- SSR / add-on: in airline systems, SSR can mean Special Service Request; meal and seat selections are add-on/Special Service Request-like items.
- Add-on / Ancillary: extra purchase or preference attached to a flight, such as seat, meal, baggage.
- PNR (Passenger Name Record): airline booking reference.
- OD (Order Details): post-purchase page.
- OR (Order Review): checkout review page before payment.
- TYP (Thank You Page): post-payment confirmation page.
- DWH (Data Warehouse): analytics store for reporting.
- RDS (Relational Database Service): managed relational database.
- DynamoDB (Amazon DynamoDB): managed NoSQL database.
- AppConfig (AWS AppConfig): configuration service for runtime flags/configuration.
- Redis: in-memory cache used for low-latency temporary state.
- TTL (Time To Live): expiry period for cached or stored data.
- TTM (Time To Market): speed to launch.
- P95 / P99: 95th / 99th percentile latency.
- DDB (DynamoDB): Amazon DynamoDB.
- MRU (Most Recently Used): ordering by recent usage.
- Idempotency: safe repeat behavior for writes.

---

## 2. 30-Second Pitch

Flights Meal Selection extended the flight add-on platform from seats to meals. Product wanted meal selection as part of Flexi Fares, with an expected total meal attach rate around 9-10%, domestic around 10%, international around 3%, and Flexi Fare attach close to 100%.

The technical problem was not just adding a meal page. We had to extend the ancillary API (Application Programming Interface), persist meal selections per passenger/sector, show meal charges on Order Review and OD (Order Details), include meals in hold/booking requests to MMT (MakeMyTrip), handle sold-out or unfulfilled meals, and make refund breakups correctly show non-refundable ancillary charges.

The product-minded design choice was to build an add-on-agnostic architecture. Meals were the first new add-on after seats, but the system should later support baggage or other ancillaries with minimal architectural change.

---

## 3. Simple Problem Explanation

When a customer books a flight, the airline may offer add-ons:

- Seats.
- Meals.
- Meal preferences for free meal scenarios.
- Future add-ons like baggage.

For a normal booking, customer selects flight -> traveller details -> seat selection -> meal selection -> order review -> payment.

The system must keep all these things consistent:

- What meals are available per sector?
- Which passenger selected which meal?
- Is selection mandatory for a Flexi Fare?
- Is the meal paid or free?
- Did MMT (MakeMyTrip) actually confirm the meal during hold/booking?
- What if meal was sold out?
- How do we show meal charge in OD (Order Details), e-ticket, email, and cancellation refund breakup?

The hard part is that selection state starts in frontend Redux, then becomes backend state, then becomes partner state, then becomes post-order display state.

---

## 4. PM / Product Framing

Use this for "why did this matter?"

> "Meals were a monetization and customer-experience add-on. The product goal was to improve the upgraded fare journey without slowing down the base booking journey. That is why the meal page appears for upgraded fare customers, while base fare meal selection on Order Review was deprioritized. The design balanced attach rate, page latency, and booking simplicity."

Key metrics:

- Total meal attach rate: 9-10%.
- Domestic attach rate: around 10%.
- International attach rate: around 3%.
- Flexi Fare meal attach: near 100%.
- Booking increase target: around 10% in product projection.
- Meal selection page load latency.
- Ancillary API (Application Programming Interface) P95 / P99.
- Meal selection failure rate.
- Booking successful but meal confirmation failed rate.
- Meal revenue and commission.
- Skip Meal Selection CTA (Call To Action) click rate.
- Meal click events on frontend.

Product line:

> "The principle was: do not slow down customers who do not want add-ons, but make the add-on journey rich for customers who paid for upgraded fares."

---

## 5. High-Level Design

```text
Customer
  |
  | Traveller Details / Seat Selection
  v
Ancillary API (Application Programming Interface)
  |
  | calls MMT Addons API with ff=SEATS,MEALS,MEAL_PREFERENCE
  v
MMT (MakeMyTrip) Addons API
  |
  | returns seats + meals + meal preferences per sector
  v
Flights Service
  |
  | enrich with icons from AWS AppConfig
  | reorder using user meal history / popular meals if enabled
  | hide meals for base fare if not mandatory
  v
Frontend Meal Selection Page (Redux)
  |
  | user selects meal(s) per sector/passenger
  v
Order Review (OR)
  |
  | show mealCharges line item
  v
Init Booking / Hold Flow
  |
  | send addonType = MEALS or MEAL_PREFERENCE to MMT Hold API
  v
Booking Confirmation
  |
  | persist in flight_addon table
  v
OD (Order Details) / E-ticket / Email / Cancellation
  |
  | show meal status, meal charge, ancillary charge refund treatment
```

Core line:

> "Meals were implemented as another ancillary, not as a one-off meal feature."

---

## 6. Backend LLD

### Ancillary API

Existing API already returned seat details. The change was to extend it to include meal details.

MMT (MakeMyTrip) Addons API request:

```text
ff=SEATS,MEALS,MEAL_PREFERENCE
```

Important product/tech detail:

- The request structure to Amazon's Ancillary API stayed the same.
- The response added `meals` under each sector.
- `meals` and `mealPreferences` are returned as empty arrays instead of null.
- If base fare customer and meal is not mandatory, the service can omit meals to avoid showing the page.

### Response Shape

```text
sector
  flightKey
  availableSeats
  seats
  meals
    isMandatory
    meals[]
      code
      type
      name
      icon
      price
    mealPreferences[]
      code
      type
      name
      icon
      price
```

### Init Booking

If meal is selected, frontend sends meal details in init booking request, similar to seats.

```text
journey_addons
  flightKey
  travellerAddons
    travellerId
      addons
        addonType = MEALS / MEAL_PREFERENCE
        itemCode
        sellPrice
```

Selections are saved in `flight_addon` table with type `MEALS`.

### Hold API

During hold / validate fare flow, the system sends selected meal add-ons to MMT (MakeMyTrip). If MMT cannot fulfill a meal, it may not return it in `travellerAddons`.

Interview wording:

> "A selected meal is not confirmed until the partner hold/booking flow acknowledges it. So the UI can show selected state, but backend must persist and later reconcile confirmed/pending/failed state."

---

## 7. Frontend Design

Main flow:

```text
Traveller Details
  -> Seat Selection
  -> Meal Selection
  -> Order Review
  -> Payment
```

Frontend state:

```text
ancillary
  selectedMeal
    sector -> array of meal codes
```

Rules:

- Number of selected meals for a sector cannot exceed passenger count.
- Deselect removes one occurrence of the meal code.
- Count of each meal code is derived from array occurrences.
- Meal codes are mapped to traveller IDs before init booking.
- If `isMandatory` is true, Skip Meal Selection CTA (Call To Action) should not appear.
- If meal image fails to load, fallback icon from AWS AppConfig is used.

PM line:

> "The UI rule was to keep meal selection fast: show first few meals by type, allow see-more expansion, and avoid forcing base-fare users through a page they do not need."

---

## 8. Meal Preference / Personalization Design

The custom meal ordering document considered how to order meals based on:

1. User's previous meal-selection history.
2. Airline recommended popular meals from AWS AppConfig.
3. Other meals from MMT (MakeMyTrip) Addons API.

### Approach 1 - RDS (Relational Database Service)

Use existing `order_extension` and `flight_addon` tables:

- Add `customer_id` to `order_extension`.
- Add `airline_code` to `flight_addon`.
- Query X most recent unique meals per customer and airline.
- Prefetch into Redis to avoid customer-facing latency.

Pros:

- Low TTM (Time To Market).
- Uses existing tables.

Cons:

- Large tables: `flight_addon` millions of rows and `order_extension` hundreds of millions.
- Query complexity.
- Risk of customer-facing latency without cache.

### Approach 2 - DynamoDB (Amazon DynamoDB) - Recommended

Create `flightsUserPreferences`:

```text
Partition key: customer_id
Sort key: prefType = RECENT_MEALS
pref:
  DF:
    6E: [{ meal_code, timestamp }]
  IF:
    AI: [{ meal_code, timestamp }]
```

Pros:

- Add-on independent.
- Fast key-value access.
- Extensible to recent searches, consent, or other preferences.
- Low read/write processing overhead.

Cons:

- Higher TTM (Time To Market).
- Duplicate storage with RDS (Relational Database Service).

### Approach 3 - OpenSearch

Use existing flights user index.

Pros:

- Reuses user preference store.

Cons:

- Search index is not ideal as source of truth for frequently updated preference writes.

Interview line:

> "RDS was fastest, DynamoDB was cleaner long-term. The recommended design used DynamoDB because the access pattern was a customer preference lookup, not a relational reporting query."

---

## 9. Meal Reordering Logic

```text
preferenceList = recent user meals + airline popular meals
partnerMealList = meals from MMT Addons API

matchingMeals = meals from partner list that appear in preferenceList
nonMatchingMeals = remaining partner meals
sort matchingMeals by preference rank
return matchingMeals + nonMatchingMeals
```

Complexity:

- `n` = partner meal count.
- `m` = preference count.
- Build preference map: O(m).
- Scan partner meals: O(n).
- Sort matching meals: O(k log k), where `k <= n`.
- In practice, meal counts are small (under about 50), so operational cost is constant-ish.

Interview wording:

> "This is personalization, but bounded personalization. If the preference service fails, the booking flow should still work with partner/default meal ordering."

---

## 10. Cancellation / Refund Treatment

Meals are treated as ancillary charges.

Changes:

- Order Review shows `mealCharges`.
- OD (Order Details) shows meal name/status per passenger.
- E-ticket/email include meal details.
- Cancellation refund breakup shows "Seat/Meal charge" or `ancillary_charge`.
- Meals are non-refundable in current design unless partner later returns refundability per add-on.

Design choice:

> "We renamed the concept from seat charge to ancillary charge because the business meaning changed. Seats were no longer the only add-on. That backward-compatible naming decision prevents a future baggage add-on from forcing another schema rework."

---

## 11. Reliability And Edge Cases

Edge cases:

- MMT Addons API latency is high (document notes P95 around 5.8 seconds and P99 around 5.9 seconds).
- Meal selection page reload loses Redux state.
- Saving selected seats/meals asynchronously may fail.
- MMT Hold API does not confirm selected meal.
- Meal is sold out between selection and booking.
- Base fare user should not be slowed by meal flow.
- Meal icon missing or image CDN fails.

Controls:

- No customer-facing flow should fail due to meal reordering.
- Use empty arrays instead of null for meal nodes.
- Use AWS AppConfig for fallback icons and popular meals.
- Persist selected add-ons before relying on them after reload.
- Treat hold response as source of confirmed add-ons.
- Use metrics for "booking successful but meal confirmation failed".

Senior line:

> "The main reliability call was making meal personalization non-blocking. If personalization fails, customers should still be able to book the flight."

---

## 12. Leadership / Stakeholder Answer

> "I framed this as a platform extension. Product wanted meals for Flexi Fares, but engineering needed to avoid building a one-off page. I aligned the work around an ancillary model: the same request/response shapes, persistence, order review breakup, cancellation treatment, and post-order display should work for seats today, meals now, and baggage later."

If asked about cross-team communication:

> "The coordination points were product for attach-rate and customer journey, frontend for page flow and Redux state, backend for ancillary/booking contracts, partner integration for MMT (MakeMyTrip) Addons/Hold behavior, payments/refunds for ancillary charge treatment, and analytics for attach/revenue/failure metrics."

Strong version if true:

> "I owned the technical design review and pushed the team away from hardcoding meals into the seat-selection model."

Safe version:

> "I contributed to the design/implementation with the platform-extension lens: keep it add-on independent and failure-isolated."

---

## 13. Tradeoffs

| Tradeoff | Choice | Why |
|---|---|---|
| Fast launch vs long-term preference store | DynamoDB preferred; RDS possible for low TTM | Customer preference lookup is key-value shaped. |
| Personalization vs booking reliability | Personalization non-blocking | Booking should not fail because preference fetch fails. |
| Base fare monetization vs booking speed | Base fare meal CTA deprioritized | Avoid slowing no-frills customers. |
| Async save vs consistency | Async save is fast but risky | If save fails and page reloads, customer can lose selections. |
| Seat-specific schema vs ancillary schema | Ancillary naming | Future add-ons become easier. |
| Partner truth vs frontend selected state | Partner hold response wins | Selection is not confirmation. |

---

## 14. Likely Interview Questions And Answers

### Q1. Walk me through meal selection.

> "After seat selection, upgraded fare customers see Meal Selection. The ancillary API calls MMT (MakeMyTrip) Addons API with feature flags for seats, meals, and meal preferences. Backend returns sector-level meals with price, type, icon, and mandatory flag. Frontend stores selections in Redux, sends them in init booking as add-ons, MMT Hold confirms what was fulfilled, and backend persists meals in `flight_addon`. Then Order Review, OD (Order Details), e-ticket, email, and cancellation refund breakup all consume that persisted add-on state."

### Q2. Why not build meals as a separate service?

> "Because meals are an ancillary. Seats, meals, and baggage share the same lifecycle: discover options, select per passenger/sector, include in hold/booking, persist, show in order review, and handle cancellation/refund. A separate meal service would duplicate that lifecycle and make future add-ons harder."

### Q3. Why DynamoDB for meal preferences?

> "The access pattern is: for this customer, get recent meals by airline and journey type. That is key-value preference lookup. DynamoDB (Amazon DynamoDB) is better shaped for that than joining two large RDS (Relational Database Service) tables on the customer-facing path."

### Q4. What happens if preference lookup fails?

> "The customer still sees meals from MMT (MakeMyTrip). We fall back to airline popular meals from AWS AppConfig or partner order. Preference lookup should never block flight booking."

### Q5. What is the hardest edge case?

> "Frontend state consistency. If seats are selected, then the customer moves to meal selection and reloads the page, Redux state can disappear. Saving selected add-ons to backend/Redis helps, but async save can fail. The safest version waits for save acknowledgment, but product may prefer speed. That is a real latency vs consistency tradeoff."

### Q6. How do you handle meal sold out?

> "MMT Hold API is the confirmation point. If selected meal is not returned/confirmed by hold, we treat it like seat unavailability: show a recoverable message, remove or mark failed add-on, and do not charge for an unfulfilled meal."

### Q7. How does this show PM skill?

> "The PM skill was not just knowing the attach-rate target. It was protecting the main booking funnel. Meal attach matters, but a meal page must not reduce core booking conversion. That is why the flow is targeted to upgraded fares and personalization is non-blocking."

### Q8. How does this map to UnifyApps?

> "This is an enterprise workflow extension: take an existing platform, add a new object type, preserve backward compatibility, integrate partner APIs, keep failure isolated, and expose metrics. That is exactly the FDSE skill set."

---

## 15. One-Line Closers

- "Meals were an ancillary-platform extension, not a meal page."
- "Frontend selected state is not partner-confirmed state."
- "Personalization improves attach rate, but it must never block booking."
- "I would defend the design as add-on agnostic: seats today, meals now, baggage later."

