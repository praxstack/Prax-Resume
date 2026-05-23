# UnifyApps FDSE — Interview Cheat Sheet

> **Audience:** me (Prakhar), reviewing right before a UnifyApps Sr. Forward-Deployed Software Engineer loop.
> **Source of truth:** `https://github.com/praxstack/unifyapps-fdse-assignment` @ commit `9f35fc7` — both CI and Security workflows green, 76 tests passing.
> **Companion:** `UNIFYAPPS_FDSE_MOCK_INTERVIEW_PROMPT.md` (the role-play prompt).

---

## 0. The 30-second pitch (memorize verbatim)

> "I built a thin slice of UnifyApps' value prop: heterogeneous documents from S3, parsed by an LLM behind a Protocol so OpenRouter can be swapped for on-prem Llama on day one, written into a flaky legacy CRM through a hand-rolled circuit breaker plus tenacity retries plus sha256 idempotency keys, with every state transition written to a SQLite WAL audit log *before* the action runs — so a crash mid-pipeline is fully observable post-mortem and replay is safe. End-to-end, 8 documents in, 6 succeeded, 1 duplicate, 1 parse-failed, 0 dropped, 576 milliseconds. 76 tests cover every path. CI gate at 70 percent coverage. The repo is public and shipped."

That paragraph is the answer to "walk me through what you built." Nothing else opens the same way.

---

## 1. Problem statement (verbatim from the assignment form)

> **Title:** Enterprise Data + Agentic Workflow Integration
>
> Design a system that ingests structured and unstructured data from a heterogeneous source (S3-style), uses an LLM to extract a normalized schema, and writes it to a legacy enterprise CRM that is unreliable. The system must be production-grade: idempotent, observable, resilient to transient failures, and safe to replay after a crash.
>
> Deliverables:
> - Architecture diagram in README.
> - Data-flow mapping from source → schema → CRM.
> - Working Python code demonstrating idempotency keys, exponential backoff, circuit breaker, dead-letter queue, audit log.
> - A short walkthrough video (Loom) is optional but encouraged.

What was actually shipped extends this with: tests (Hypothesis property tests + integration), threat model, multi-stage Docker, CI + Security pipelines, 8 sample fixtures spanning 5 input formats including a deliberate replay duplicate.

---

## 2. High-Level Design (HLD)

```
┌─────────────────┐    iter_documents()       ┌────────────────┐
│  S3 / Local FS  │ ─────────────────────────▶│   Ingester     │
│  (samples/*)    │   (FileIngester or        │   Protocol     │
│                 │    S3Ingester stub)       │                │
└─────────────────┘                           └───────┬────────┘
                                                      │ RawDocument
                                                      │   (source_id, content_hash, format, payload)
                                                      ▼
                                              ┌────────────────┐
                                              │   Parser       │
                                              │   Protocol     │
                                              │   (LLM)        │
                                              └───┬────────┬───┘
                                                  │        │
                                  OpenRouterParser│        │ MockParser
                                  (real LLM,      │        │ (deterministic
                                   structured     │        │  fixtures —
                                   output,        │        │  tests + demo)
                                   Pydantic       │        │
                                   validation)    │        │
                                                  ▼        ▼
                                              ParsedRecord
                                              (NormalizedContact, confidence, rationale)
                                                      │
                                                      │  if confidence < threshold
                                                      │      → human review path → DLQ
                                                      │  else
                                                      ▼
                                              ┌────────────────┐
                                              │  Orchestrator  │  ◀── audit_event(state) BEFORE every step
                                              └───────┬────────┘
                                                      │ CRMUpsertRequest
                                                      │ (idempotency_key = sha256(source_id + content_hash))
                                                      ▼
                                              ┌────────────────┐
                                              │ Circuit Breaker│   ◀── 3-state (CLOSED/OPEN/HALF_OPEN)
                                              │     +          │       thread-safe, time.monotonic()
                                              │ Tenacity Retry │   ◀── exp backoff + jitter
                                              │     +          │       retry on CRMTransientError only
                                              │ idempotency    │   ◀── replay-safe
                                              └───────┬────────┘
                                                      │
                                          httpx POST /contacts
                                                      ▼
                                              ┌────────────────┐
                                              │ Legacy CRM     │   ◀── (mock_crm: FastAPI w/ fault injection
                                              │ (or mock_crm)  │       — 429s, 503s, latency spikes,
                                              │                │       idempotency-key replay)
                                              └───────┬────────┘
                                                      │
                                            success / 4xx / 5xx
                                                      │
                                  ┌───────────────────┼───────────────────┐
                                  ▼                   ▼                   ▼
                          ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
                          │ AuditStore   │   │  RunStats    │   │     DLQ      │
                          │ SQLite WAL   │   │  counters    │   │ (same SQLite │
                          │ append-only  │   │              │   │  store)      │
                          └──────────────┘   └──────────────┘   └──────────────┘
                                                                       ▲
                                                                       │
                                                                  cli dlq replay
                                                                  (idempotent —
                                                                   safe to retry)
```

### Key invariants (drill these in)

1. **Idempotency:** `idempotency_key = sha256(source_id || content_hash)`. Replaying any document — same fixture, same DLQ entry, anything — produces zero duplicate CRM rows because the mock CRM dedupes on the same key.
2. **Write-before-step:** Every state transition (run start, parse start, parse done, CRM call start, CRM call done, DLQ enqueue, run finalize) writes to the SQLite audit log *before* the side effect. A crash mid-pipeline is observable post-mortem from the audit alone.
3. **Crash safety:** SQLite opened in WAL journal mode + `synchronous=NORMAL`. (run_id, source_id) primary key on the audit row prevents duplicate work on resume.
4. **Failure routing:**
   - Transient (5xx, 429, network/timeout) → `CRMTransientError` → retried by tenacity → trips breaker on threshold.
   - Permanent (4xx other than 429) → `CRMPermanentError` → routed to DLQ immediately, no retry budget burned.
   - Breaker open → `CircuitOpenError` raised fast → record routed to DLQ with retry-after hint.
   - Parser fails → `ParseError` → counted in `parse_failed`, not retried (it's deterministic for the same input).
5. **Confidence gate:** `confidence < min_confidence` → human-review label → DLQ. The "agentic workflow" is bounded — never silently writes a low-confidence row.

---

## 3. Low-Level Design (LLD)

### 3.1 Data contracts (`src/agentic_onboard/schemas.py`)

```python
class SourceFormat(StrEnum):
    EML, JSON, CSV, OCR_JSON, TXT, ...

class RawDocument(BaseModel):
    source_id: str          # "samples/01-email-thread.eml"
    content_hash: str       # sha256 of raw bytes
    format: SourceFormat
    payload: bytes | str

class NormalizedContact(BaseModel):
    name: str
    email: str | None
    phone: str | None
    company: str | None
    source: str

class ParsedRecord(BaseModel):
    contact: NormalizedContact
    confidence: float        # constrained to [0.0, 1.0]
    rationale: str           # free-text, why the parser is/isn't sure

class CRMUpsertRequest(BaseModel):
    idempotency_key: str     # sha256(source_id || content_hash)
    contact: NormalizedContact

class RunStats(BaseModel):
    ingested: int
    succeeded: int
    duplicate: int           # idempotency replays
    parse_failed: int
    dlq: int
    total_latency_ms: int
```

### 3.2 Circuit breaker (`src/agentic_onboard/circuit_breaker.py`)

State machine, thread-safe, single lock:

```
CLOSED ──[N consecutive transient failures]──▶ OPEN
  ▲                                              │
  │                                              │ [recovery_timeout elapsed]
  │                                              ▼
  └──[probe success]── HALF_OPEN ◀──[probe permitted, 1 in flight]
                          │
                          └─[probe failure]─▶ OPEN (re-open)
```

- Thresholds: `failure_threshold=5`, `recovery_timeout=30s` — both env-tunable via Settings.
- Timer: `time.monotonic()` (NOT `time.time()`) — so NTP slews don't reset the recovery window.
- `CircuitOpenError(retry_after=N)` carries the seconds-until-recovery hint so the orchestrator can DLQ-with-schedule.
- Emits structured logs at every transition (CLOSED→OPEN, OPEN→HALF_OPEN, HALF_OPEN→CLOSED, HALF_OPEN→OPEN) so a post-mortem can reconstruct the breaker's behavior from logs alone.

### 3.3 Resilient CRM client (`src/agentic_onboard/crm_client.py`)

Layering, top to bottom:

```
upsert_contact(req)
  │
  ├─▶ breaker.allow_request()   → if OPEN, raise CircuitOpenError
  │
  ├─▶ @retry(stop=stop_after_attempt(3),
  │          wait=wait_exponential_jitter(initial=0.5, max=10),
  │          retry=retry_if_exception_type(CRMTransientError))
  │   │
  │   ├─▶ httpx.Client.post("/contacts", json=req, headers={"Idempotency-Key": req.idempotency_key})
  │   │
  │   ├─▶ status 2xx     → breaker.record_success()  → return CRMUpsertResponse
  │   ├─▶ status 4xx¬429 → raise CRMPermanentError   (no retry, no breaker)
  │   ├─▶ status 5xx,429 → breaker.record_failure() → raise CRMTransientError (tenacity retries)
  │   └─▶ httpx error    → breaker.record_failure() → raise CRMTransientError (tenacity retries)
```

The breaker check sits **inside** the retry loop, not outside. That ordering matters:
- Transient HTTP failures should both retry AND count toward opening the breaker.
- A permanent 4xx (validation error) should NOT count toward opening the breaker (the downstream is healthy, our payload is wrong).

### 3.4 Audit + DLQ (`src/agentic_onboard/audit.py`)

SQLite tables:

```sql
CREATE TABLE runs (
    run_id TEXT PRIMARY KEY,
    started_at REAL NOT NULL,
    finished_at REAL,
    status TEXT,                  -- in_progress | succeeded | failed
    stats_json TEXT
);

CREATE TABLE audit_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL,
    source_id TEXT NOT NULL,
    state TEXT NOT NULL,          -- ingested | parsing | parsed | upserting | upserted | dlq | duplicate
    timestamp REAL NOT NULL,
    detail_json TEXT,
    UNIQUE(run_id, source_id, state)   -- replay-safe
);

CREATE TABLE dlq (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL,
    source_id TEXT NOT NULL,
    error_class TEXT,
    error_detail TEXT,
    payload_json TEXT,
    enqueued_at REAL,
    retry_count INTEGER DEFAULT 0,
    UNIQUE(run_id, source_id)
);
```

PRAGMAs at open: `journal_mode=WAL`, `synchronous=NORMAL`.

### 3.5 Orchestrator agent loop (`src/agentic_onboard/orchestrator.py`)

```python
def run(self) -> RunStats:
    audit.start_run(run_id)
    for raw_doc in ingester.iter_documents():
        audit.append_event(run_id, raw_doc.source_id, "ingested")

        # idempotency check at orchestrator layer
        if audit.has_succeeded(raw_doc.source_id):
            stats.duplicate += 1
            audit.append_event(run_id, raw_doc.source_id, "duplicate")
            continue

        try:
            audit.append_event(run_id, raw_doc.source_id, "parsing")
            parsed = parser.parse(raw_doc)
            audit.append_event(run_id, raw_doc.source_id, "parsed",
                               detail={"confidence": parsed.confidence})
        except ParseError as e:
            stats.parse_failed += 1
            audit.append_event(run_id, raw_doc.source_id, "parse_failed",
                               detail={"error": str(e)})
            continue

        if parsed.confidence < settings.min_confidence:
            audit.enqueue_dlq(run_id, raw_doc.source_id,
                              error_class="LowConfidence",
                              detail=parsed.rationale)
            stats.dlq += 1
            continue

        req = CRMUpsertRequest(
            idempotency_key=sha256(raw_doc.source_id + raw_doc.content_hash),
            contact=parsed.contact,
        )

        try:
            audit.append_event(run_id, raw_doc.source_id, "upserting")
            crm.upsert_contact(req)
            audit.append_event(run_id, raw_doc.source_id, "upserted")
            stats.succeeded += 1
        except (CRMPermanentError, CircuitOpenError) as e:
            audit.enqueue_dlq(run_id, raw_doc.source_id,
                              error_class=type(e).__name__,
                              detail=str(e))
            stats.dlq += 1

    audit.finalize_run(run_id, stats)
    return stats
```

Note the order of operations in the success path: write `upserting` event → call CRM → write `upserted` event. If we crash between the CRM call and the second audit write, the next run sees `upserting` without `upserted` and the orchestrator treats that source_id as in-flight, NOT succeeded → idempotency key dedupes the eventual replay at the CRM layer.

---

## 4. Trade-offs (be ready to defend each)

| Choice | Why I made it | What it costs | When I'd reverse it |
|---|---|---|---|
| **Hand-roll the breaker** | The principal-engineer signal IS the breaker code; bringing in `pybreaker` would hide what UnifyApps wants to see. | ~150 lines I have to maintain. | Production at scale, where I want the maintained library and metrics adapters. |
| **SQLite for audit + DLQ** | One-binary, file-on-disk, WAL-safe, no separate infra to spin up for a take-home. Crash-recoverable. | Single-writer (fine for 1 worker, breaks at fan-out). No multi-process. | Throughput > ~500 docs/sec OR multi-host worker pool → Postgres + a real queue (Redis Streams, Kafka). |
| **Tenacity over hand-roll** | Decorator-based retry policy is testable, swappable, and well-known. Composes cleanly with the breaker. | One more dep. | Never, on Python. |
| **Pydantic-Settings singleton** | Type-safe env config with a single source of truth; no scattered `os.getenv()`. | None worth mentioning. | Never. |
| **Confidence threshold = 0.7** | Conservative default for a take-home. The threshold is env-tunable so a customer can dial it per-tenant. | The number is arbitrary; in production it's per-customer per-document-type. | Day one with a real customer — replace with a per-format calibrated threshold from a back-tested holdout set. |
| **OpenRouter (not OpenAI direct)** | Single API key, model-agnostic, lets a customer swap GPT-4o for Claude Sonnet for a local Llama-3 by changing one Settings field. | Adds a hop, marginal latency. | Never on this stack. |
| **MockParser is a separate class, not a low-temp real parser** | Tests must be deterministic AND wall-clock fast (offline, no network). Low-temp real LLM is neither. Also: MockParser's canned cases include the parse-failed and low-confidence paths, which exercise orchestrator branches the real parser would only hit by accident. | Two parsers to keep in sync. | Never — this IS the test-double pattern. |
| **`time.monotonic()` for the breaker timer** | Wall-clock can jump backwards (NTP slew, container clock skew). Breakers driven by wall-clock have woken up early under known production incidents. | Slightly less obvious than `time.time()`. | Never. |
| **70% coverage gate, not 90%** | 90% means tests for `__init__.py` and stat counters; 70% lets me skip the trivial and lock the meaningful (every error path, every state transition, the breaker state machine, the idempotency replay). | A reviewer who reads coverage % without reading what's covered will undervalue this. | Customer demands it — they'll get the number, but it doesn't make the system safer. |
| **No real S3, only `samples/`** | Take-home time-box. The Ingester Protocol is the abstraction; S3Ingester is a thin stub that satisfies it. The orchestrator code does not change. | Reviewer might want to see boto3. | Day one with a real customer — drop in a paginated, range-aware boto3 client behind the same Protocol. |

---

## 5. Likely interview questions + crisp answers

### 5.1 Resilience

**Q: Why hand-roll the breaker?**
> I wanted the breaker to be the part of the codebase a UnifyApps reviewer can read in five minutes and trust. Pulling in `pybreaker` would have moved that reading into someone else's repo. Production-at-scale, I'd swap it in.

**Q: Why three states and not two?**
> Two-state breakers re-open the floodgates the instant the cool-down ends, so a downstream that's still flapping gets blasted. The half-open state lets exactly one probe through; success closes, failure re-opens. It's the difference between a sync and an async health check.

**Q: What happens if you crash between the audit write and the CRM call?**
> The audit log shows `upserting` without a matching `upserted`. On replay, the orchestrator's idempotency check sees that source_id is not in the `succeeded` set and re-runs it. The CRM dedupes on the idempotency key — same `sha256(source_id + content_hash)` — so the second run is a no-op at the CRM layer. Net effect: at-least-once delivery, exactly-once side effects.

**Q: When would your idempotency story break?**
> If the source mutates the file but reuses the source_id, the content_hash changes, the idempotency key changes, and the CRM thinks it's a new record. That's the right behavior — but only if the customer's CRM honors `Idempotency-Key`. A legacy CRM that doesn't would need an application-layer dedupe table on our side, with a TTL. I'd build that on day one for a customer with a flat-key CRM.

**Q: Why retry on 503 but not on 422?**
> 503 is the downstream telling me to back off; the operation might succeed if I try again. 422 is the downstream telling me my payload is wrong; retrying is just burning my retry budget on a guaranteed failure. They go in different buckets and the buckets get treated differently end-to-end.

**Q: Where would you draw the line for a 408 / 502 from a CDN?**
> 408 is a request-timeout: transient, retry. 502 from a CDN is ambiguous — it could be the origin returning malformed bytes (permanent if my payload is wrong) or the CDN failing to reach the origin (transient). Default to transient with a low retry cap (2 attempts) and aggressive logging so a real human can re-classify if a pattern emerges.

### 5.2 LLM intuition

**Q: How do you handle hallucinated values?**
> Pydantic schema validation catches the obvious — wrong type, wrong shape, missing required field. For the harder case (right shape, wrong value: "phone": "9999999999"), I rely on three things: structured-output mode at the API layer; a per-field validator (e.g., E.164 for phone); and the confidence-gate / human-review escalation. Anything I can't verify deterministically, I gate behind confidence.

**Q: How do you measure parser accuracy in production without ground truth?**
> Three signals. (1) Schema validity rate — what fraction of LLM responses pass Pydantic? (2) Confidence distribution — has the median dropped? Are we sending more to human review? (3) Customer feedback loop — when a human corrects a parsed record, that correction goes back as eval data. Over weeks, you have a labeled set without ever doing explicit annotation.

**Q: Why `MockParser` if you can just lower the LLM temperature?**
> Three reasons. (1) Tests must run offline — no network, no API key, hermetic. (2) Tests must be wall-clock fast — even a low-temp LLM call is hundreds of milliseconds; my full test suite runs in under 30 seconds. (3) Determinism: the canned cases include the parse-failed and low-confidence paths, which the real parser would only hit by accident. MockParser is a fixture-driven test double, the standard pattern.

**Q: How would you swap OpenRouter for an on-prem Llama deployment?**
> Change one Settings field (`llm_base_url`) and one Settings field (`llm_model`). The Parser Protocol doesn't move. The orchestrator doesn't change. The tests don't change. That's what the Protocol is for — it's the abstraction the customer's data-residency constraint pivots on.

### 5.3 Customer / FDSE-specific

**Q: Tuesday. The customer's CRM returns 502 every 30 seconds for 10 seconds. CISO won't whitelist for 2 weeks. Demo is Friday. Go.**
> First, I'm not going to "go" — I'm going to slow down for ninety seconds and separate two problems: (a) the technical pattern of bursty 502s, (b) the social constraint of the CISO timeline. They have different solutions.
>
> On (a), the burst is structural — every 30 seconds for 10 seconds — so it's not random failures, it's a known maintenance window or a load balancer rotating. The breaker as configured (5 failures → 30s recovery) will probably ride right over it: the breaker opens, waits 30s, probes, finds the service healthy, closes. If the burst is longer than my recovery_timeout, I bump recovery_timeout to 60s. I'd also dial my retry policy to be more patient — wait_exponential_jitter with a higher max — so I don't burn retries inside the bad window.
>
> On (b), I'd ship behind the existing customer egress that I CAN reach. Maybe that's a customer-side proxy, maybe it's running my orchestrator on their VM. I'd negotiate a single demo with the customer engineer pair-debugging next to me — that's probably the highest-leverage thing I can do all week. And I'd be explicit with the VP that "live by Friday" means demo, not production GA — production GA is the day after the CISO unblocks egress.
>
> What I would NOT promise on Friday: SLA, throughput numbers I haven't load-tested against the real gateway, or a workaround that involves the customer turning off their security policy.

**Q: The CISO says they'll never whitelist. Does the integration ship?**
> Yes, but the architecture changes. We deploy on the customer's network (Docker on their VM, or their k8s cluster), use their internal CRM endpoint, and the only egress is the LLM call — which the customer's data-residency policy might also block. If it does, we're at on-prem Llama, which is the Protocol-swap scenario from earlier. The integration ships either way; only the deployment topology and the LLM swap depend on the CISO.

**Q: You're embedded for 4 weeks. Day 1, the customer says "we want everything in two weeks." What do you say?**
> "Show me what you have today." That's the first 30 minutes. Then I'd cut the scope to one specific input format, one specific CRM record type, one specific user. Get THAT live in week 1. Earn the right to expand scope in week 2. The risk of trying to build everything in two weeks is that nothing is live in four weeks, and the customer thinks UnifyApps doesn't ship. The risk of building one thing in week 1 is that the customer is mildly disappointed and then thrilled.

**Q: How do you say no to a customer who wants something you don't think is right?**
> I don't lead with "no." I lead with "what are you actually trying to do?" 80% of the time, the thing they're asking for is one of three reasonable solutions to a problem they haven't named. Once I know the problem, I can tell them which of the three I'd do, why, and what the failure modes of the other two are. If after all that they still want the bad option — sometimes for political reasons that are real — I do the bad option, document the trade-off in the customer's own language, and make sure my email proposing the better path is searchable.

### 5.4 On-call

**Q: Tell me about a 3am page that taught you something.**
*(If real example: tell it with — what fired, what I checked first, what was wrong, what I shipped to make it never page again. Skip the heroics; emphasize the post-mortem.)*

*(If no real on-call experience yet, lean on this:)*
> I haven't been formally on-call in a 24×7 rotation, but I've owned production systems at Cloudbeds — internal tools that, when they broke, broke other engineers' workflows. The pattern I learned: the first 5 minutes of an outage is for confirming the page is real, looking at the dashboard, and posting in the ops channel. The next 10 minutes is for either rolling back the most recent deploy or reading the audit log to find the last good state. Action only after observation. If I haven't formed a hypothesis by minute 15, I'm asking for help, not flailing harder.

### 5.5 Why-this-role

**Q: Why UnifyApps and not a pure GenAI startup?**
> Pure GenAI startups are mostly building demos. UnifyApps is putting GenAI into production at customers who actually pay for software. The interesting engineering — idempotency, resilience, observability, customer-specific edge cases — only shows up when the integration has to survive its first paying customer's bad day. That's the work I want.

**Q: Why FDSE and not a regular SDE role?**
> FDSE is the role where the customer is on the other side of the screen, not the other side of the building. I get faster signal. I'd rather be told "this is wrong" by the actual user in week 2 than by a PM in week 8.

**Q: What's the gap on your resume / why this assignment?**
> I built this assignment specifically to close the GenAI surface-area gap on my resume. I'm an SDE with strong systems chops and weak public LLM artifacts. The repo is the public artifact. Everything you'll see in it I shipped in roughly 6 hours, with green CI and Security workflows, on the first attempt — because the systems chops were already there.

---

## 6. STAR-format behavioral stories (have one ready for each)

> Fill these in with your real Cloudbeds / past-job stories. The placeholders below are the *shape*; you replace with specifics. Keep each story to ≤90 seconds spoken.

**S — Shipping with incomplete information**
- Situation:
- Task:
- Action: (what's the ONE technical decision that mattered?)
- Result: (number, customer outcome, or what got unblocked)

**S — Saying no to a customer / stakeholder**
- Situation:
- Task:
- Action:
- Result:

**S — A tough debugging session**
- Situation: (specific symptom, not "things were broken")
- Task:
- Action: (what did you check first? what was the wrong hypothesis?)
- Result: (root cause, fix, what stopped it from happening again)

**S — Working with a difficult constraint (legacy system, junior teammate, ambiguous spec)**
- Situation:
- Task:
- Action:
- Result:

**S — Owning a production incident**
- Situation:
- Task:
- Action: (the first 15 minutes — what did you DO?)
- Result: (post-mortem? runbook? auto-remediation?)

---

## 7. Quick-fire answer table (for the rapid-fire round)

| Question | Answer (≤2 sentences) |
|---|---|
| What's `idempotency_key` made of? | `sha256(source_id || content_hash)`. Stable across replays of the same logical document; changes if the source mutates. |
| Why WAL? | Reader-writer concurrency with crash-safety, no per-write fsync latency. |
| Why a Protocol for the parser? | So OpenRouterParser, MockParser, and a future on-prem Llama parser are interchangeable without touching the orchestrator. |
| Coverage target? | 70% gate. The 30% that's NOT covered is `__init__.py`, `__repr__` methods, and stat counters. Every error path is covered. |
| Test count? | 76. Unit + Hypothesis property + FastAPI TestClient integration + httpx.MockTransport CRM client tests. |
| Demo run output? | 8 in → 6 succeeded, 1 duplicate, 1 parse_failed, 0 dropped, 576 ms. |
| Why Typer over argparse? | Type-driven CLI parsing with autocompletion; aligns with the Pydantic-everywhere choice. |
| Why FastAPI for the mock? | Pydantic-native validation + automatic OpenAPI; the mock CRM is a real test double, not a mock library. |
| What does the security pipeline run? | gitleaks (secret scan), pip-audit (CVE check), CodeQL (Python SAST). |
| What's NOT in the repo that production would have? | OpenTelemetry traces, Prometheus metrics, multi-worker orchestration, real S3, per-tenant quotas, on-prem LLM connector. |
| Crash-recovery story in one line? | Audit log written before every state transition + idempotency key on every CRM call → at-least-once delivery, exactly-once side effects. |
| What's `min_confidence`? | Default 0.7, env-tunable. Anything below routes to the human-review DLQ. |
| What's the deepest Python concept you used? | `typing.Protocol` for structural typing across the Parser and Ingester abstractions. |
| What's the simplest? | A `for` loop in the orchestrator. The "agent" is a bounded loop. |
| Why no LangChain / CrewAI / LangGraph? | UnifyApps wants engineers who can build, not engineers who hide behind a framework. The "agent" is 50 lines I can defend. |

---

## 8. The DSA deflection

If anyone — interviewer, recruiter, your own anxiety — pushes you toward a leetcode round, the one-liner is:

> "FDSE doesn't gate on leetcode. The signal is systems design + LLM intuition + customer empathy + on-call calmness. I've shipped a public repo that proves the first three. The fourth I'd love to talk about. Where do you want to go?"

Polite. Confident. Redirects to your strongest ground.

---

## 9. Pre-call checklist (run this 30 minutes before the loop)

- [ ] Repo is public and the last commit shows green CI + Security badges. (Open the GitHub page in a tab.)
- [ ] `python -m agentic_onboard run samples/` runs locally end-to-end in <2 seconds. (Run it once, leave the terminal output on screen — paste-ready if asked.)
- [ ] README.md is open in another tab — Mermaid diagram visible.
- [ ] ARCHITECTURE.md is open — sequence diagram and failure-mode matrix visible.
- [ ] You can explain the breaker state machine without looking at the code.
- [ ] You know your `min_confidence` value (0.7) and can defend it.
- [ ] You have one STAR story ready for each of the 5 behavioral buckets.
- [ ] Water. Bathroom. No notifications.
- [ ] Run `UNIFYAPPS_FDSE_MOCK_INTERVIEW_PROMPT.md` against ChatGPT for 30 minutes the night before. Note the questions you tripped on.

---

## 10. Post-call — update this doc

After every real (or mock) loop, add:
- The one question you wish you'd answered differently.
- The actual answer you'd give now.
- Anything the interviewer pushed on that you hadn't anticipated.

This doc compounds — by the third loop, the cheat sheet is sharper than your first answer was.
