# Java Agentic Workflow Engine — 2-Week Build Spec

> **Why this exists:** UnifyApps' #1 hiring signal is *"can you ship enterprise GenAI / agentic AI integrations fast?"*. The current resume has zero LLM surface area. This project closes that gap in **14 calendar days** (≈ 60–80 focused hours) and gives you a credible artifact to ship, demo, and talk about in interviews.
>
> **Strategy:** play to your strengths — Java, Spring, idempotent integrations, audit trails — instead of pivoting to a Python/LangChain stack you don't know. UnifyApps is a Java/Kotlin shop (their public stack signals lean JVM-heavy). Showing up with **Spring AI + agentic loop in pure Java** is more differentiated than a generic Python notebook.

---

## 0 · The Pitch (Memorise This)

> *"I built a Java agentic workflow engine — natural-language goal in, planner generates a tool-calling sequence, executor runs it against a pluggable tool registry with idempotency keys and full audit logs. It's the FDSE shape of work in miniature: plug a customer's API in, wire a tool, demo a working agent in days. ~600 LOC of orchestration, Spring AI for the LLM glue, ships with 8 demo scenarios."*

That's your 30-second answer to *"tell me about your GenAI experience."*

---

## 1 · Repo Layout

```
agentic-workflow-java/
├── README.md                       # Hero + quickstart + demo gif
├── pom.xml                         # Java 17, Spring Boot 3, Spring AI
├── docker-compose.yml              # Postgres for run logs
├── .env.example                    # OPENAI_API_KEY, ANTHROPIC_API_KEY
├── src/main/java/com/praxstack/agent/
│   ├── AgentApplication.java
│   ├── core/
│   │   ├── Agent.java              # plan → execute → reflect loop
│   │   ├── Planner.java            # LLM call → ToolCall[]
│   │   ├── Executor.java           # runs ToolCall, handles retries
│   │   ├── ToolSpec.java           # interface
│   │   ├── ToolRegistry.java       # discovery + dispatch
│   │   └── AuditLogger.java        # every step → DB
│   ├── tools/
│   │   ├── HttpFetcherTool.java    # GET/POST any REST API
│   │   ├── SlackPostTool.java      # post to webhook
│   │   ├── SheetsAppendTool.java   # Google Sheets API
│   │   ├── EmailDraftTool.java     # Gmail API draft
│   │   ├── JsonExtractTool.java    # JSONPath / extract field
│   │   └── HumanApprovalTool.java  # blocks for approval
│   ├── api/
│   │   ├── AgentController.java    # POST /run, GET /run/{id}
│   │   └── WebhookController.java  # for async completions
│   └── persistence/
│       ├── AgentRun.java           # entity
│       ├── ToolInvocation.java     # entity
│       └── AgentRunRepository.java
├── src/main/resources/
│   ├── application.yml
│   └── prompts/
│       ├── planner.md              # the planner system prompt
│       └── reflection.md
├── src/test/java/...               # JUnit 5 + Mockito
├── demos/
│   ├── 01-summarize-page.json      # 8-10 demo scenarios
│   ├── 02-slack-daily-digest.json
│   └── ...
└── docs/
    ├── ARCHITECTURE.md             # flow diagram + design decisions
    ├── DEMO.md                     # walkthrough with screenshots
    └── loom-link.md                # 2-min screen recording
```

---

## 2 · The Core Loop (the only thing that matters)

```java
public class Agent {
  public AgentRun run(String goal, AgentContext ctx) {
    AgentRun runRecord = audit.start(goal);
    int step = 0;
    while (step++ < MAX_STEPS) {
      Plan plan = planner.next(goal, ctx, runRecord.history());
      audit.logPlan(runRecord, plan);

      if (plan.isDone()) {
        return audit.finish(runRecord, plan.summary());
      }

      for (ToolCall call : plan.toolCalls()) {
        ToolResult r = executor.invoke(call, ctx);          // retries, dedup
        audit.logToolCall(runRecord, call, r);              // every step persisted
        ctx.observe(r);                                     // feed back into planner
      }
    }
    return audit.finishWithCap(runRecord);
  }
}
```

**Three hard rules** (the differentiators):
1. **Every tool call is idempotent** — caller passes a `dedupKey`; the executor skips if already seen for this run. *(Reuses your Amazon webhook pattern. Talk about this.)*
2. **Every step is persisted** before the next step starts — agent runs are replayable, debuggable, and survive crashes. *(Your COE / audit-trail muscle showing up in agent design.)*
3. **`HumanApprovalTool`** blocks the loop on a configurable list of "high-risk" actions (anything that writes externally, costs money, or sends comms). *(Enterprise-safe agents — exactly what UnifyApps sells.)*

---

## 3 · The Tool Registry

`ToolSpec` interface — one method to implement per tool:

```java
public interface ToolSpec {
  String name();
  String description();           // shown to the LLM
  JsonSchema inputSchema();       // shown to the LLM
  ToolResult invoke(JsonNode input, ToolContext ctx);
}
```

Ship 6 tools — broad enough to demo, narrow enough to finish:

| Tool | What it does | LOC |
|---|---|---|
| `HttpFetcherTool` | GET/POST any URL with headers, returns `{status, body}` | ~80 |
| `JsonExtractTool` | JSONPath query over previous result | ~40 |
| `SlackPostTool` | POST to incoming-webhook URL | ~50 |
| `SheetsAppendTool` | Google Sheets API append-row | ~120 |
| `EmailDraftTool` | Gmail API draft creation | ~120 |
| `HumanApprovalTool` | blocks run, waits for `POST /run/{id}/approve` | ~60 |

The `HttpFetcherTool` alone gets you 80% of demos — any REST API works.

---

## 4 · The 8 Demo Scenarios (your interview ammo)

Each demo is one JSON file in `demos/` — a goal + expected tool calls. Run them with `mvn spring-boot:run -Dgoal=@demos/01-summarize-page.json`.

| # | Goal (natural language) | Tools used | Why it sells |
|---|---|---|---|
| 1 | *"Summarize the latest TechCrunch homepage and post a 3-line digest to Slack #news."* | http, json, slack | Read-only baseline; works in 30 sec |
| 2 | *"Pull yesterday's GitHub commits from praxstack/redis-server-java, count by author, append to my Sheet 'Commit Log'."* | http (gh API), json, sheets | Multi-step + structured output |
| 3 | *"Watch this RSS feed; if any item mentions 'OpenAI' draft me an email."* | http, json, email-draft | Conditional logic + human-in-loop draft |
| 4 | *"Compare the response time of /health on these 3 staging URLs, post the slowest to Slack with the latency number."* | http (×3), json, slack | Parallel-ish tool use, real number |
| 5 | *"Find the top 5 hottest Hacker News stories that mention 'AI agents' and create a Sheets row per story."* | http, json (filter), sheets ×5 | Iteration over a list |
| 6 | *"Read this PDF link, extract the named entities, draft me a brief."* | http, json, email-draft | (Stretch — only if time) |
| 7 | *"Schedule a weekly Monday 9am run of demo #2."* | scheduler + #2 | Recurring agent runs |
| 8 | *"Approval-gated: send this drafted email."* | email-draft, human-approval | Showcase the safety rail |

**Record a 2-minute Loom** running demos 1, 2, 4, 8. That's your interview show-and-tell.

---

## 5 · Day-by-Day Plan

> Effort: ~5 hrs/day × 14 days = ~70 hrs. Bias toward shipping demos over polishing code.

### Week 1 — Get the loop working end-to-end

**Day 1 (Sun) · Scaffolding**
- `mvn archetype` Spring Boot 3.3 + Spring AI starter
- Postgres docker-compose, Flyway migration for `agent_runs` + `tool_invocations`
- Wire `OPENAI_API_KEY` via `.env` (or Anthropic — pick one; Spring AI abstracts both)
- **Done when:** `mvn spring-boot:run` boots, `/health` returns 200

**Day 2 · The planner**
- `Planner.next(goal, history)` → calls Spring AI `ChatClient` with the planner system prompt + JSON-schema tool list
- Parse model response into `Plan { toolCalls: [...], done: bool, summary: ... }`
- Use Spring AI's structured-output binding (`.entity(Plan.class)`)
- **Done when:** giving it goal "say hello in 3 languages" returns a sane no-tool plan

**Day 3 · The executor + first tool**
- `Executor.invoke(toolCall, ctx)` — dispatches via `ToolRegistry.lookup(name)`, applies retry-with-backoff (reuse your patterns), persists `ToolInvocation` row before & after
- Implement `HttpFetcherTool` — Apache HttpClient 5 with timeouts
- **Done when:** demo 1 (TechCrunch summarise) runs end-to-end via curl

**Day 4 · Idempotency + audit log**
- Add `dedupKey = sha256(toolName + canonicalInput)` to `ToolInvocation`; executor short-circuits if already-seen-in-run
- `AuditLogger` writes every plan, tool-call, tool-result row with timing
- `GET /run/{id}` endpoint returns the full timeline as JSON
- **Done when:** retry a failed run mid-flight, only un-done tools re-execute

**Day 5 · Tools 2-3 (Slack + JSON)**
- `SlackPostTool` (incoming webhook) + `JsonExtractTool` (JSONPath via Jayway)
- Demo 1 + demo 4 working
- **Done when:** demo 4 posts a real Slack message

**Day 6 · Tools 4-5 (Sheets + Email)**
- Google API client, OAuth service-account flow (15 min of yak-shaving — eat it)
- `SheetsAppendTool`, `EmailDraftTool`
- **Done when:** demo 2 appends a real row in a real spreadsheet

**Day 7 · Buffer / Catch-up**
- Whatever's behind. Don't move on with broken demos.

### Week 2 — Polish, demo, ship

**Day 8 · HumanApprovalTool + reflection**
- `HumanApprovalTool` — writes `state=PENDING_APPROVAL` to run, blocks loop; `POST /run/{id}/approve` resumes
- Add a 1-step reflection: after each plan, the planner is shown its last action and asked "did that work? what next?"
- **Done when:** demo 8 (approval-gated email) works end-to-end

**Day 9 · Tests**
- JUnit 5 + Mockito covering: planner contract, executor retry, idempotency dedup, audit-log invariants
- Wiremock-based test for `HttpFetcherTool`
- Aim for **80%+ coverage on `core/`**, lower on `tools/`. *(Mirrors your Amazon JaCoCo discipline — talk about it.)*
- **Done when:** `mvn test` passes, JaCoCo gate enabled

**Day 10 · Demos & demo runner**
- Implement remaining demos as JSON files
- CLI: `./agent run demos/01-summarize-page.json`
- All 8 demos green; capture stdout for README

**Day 11 · ARCHITECTURE.md + flow diagram**
- Mermaid diagram of the loop
- 1-page rationale for: why idempotency, why audit-first persistence, why human-approval, why Spring AI over LangChain4j
- This is the doc that will get screenshotted into your interview prep

**Day 12 · README + screenshots**
- Hero with one-line pitch
- 30-second quickstart (`docker compose up` + curl)
- GIF of demo 4 running
- Architecture diagram inline
- Status badge for tests
- **Done when:** a stranger could clone, set 1 env var, and run demo 1 in 5 min

**Day 13 · 2-min Loom**
- Screen-record yourself running demos 1, 2, 4, 8
- Voice-over the architecture: planner → tool registry → executor → audit log → human approval
- Upload to Loom, paste link in README + on resume
- **Done when:** Loom link works, sound is clean

**Day 14 · Ship**
- Push to GitHub public, pinned on profile
- Post on LinkedIn (template below)
- Update resume's "ETA 2 weeks" to "shipped" + add Loom link
- Update LinkedIn headline to include "Agentic AI / Java"

---

## 6 · LinkedIn Launch Post (paste-ready, post Day 14)

> Spent the last two weeks building **a Java agentic workflow engine** — Spring AI + a tool-calling loop with idempotency keys, full audit trails, and a human-approval gate.
>
> Why Java? Because most of the agentic-AI conversation is happening in Python notebooks. The infra most enterprises actually run on is JVM. Wanted to see what the FDSE shape of work — *plug a customer's API into an agent, ship in days* — looks like in pure Java.
>
> 6 tools, 8 demo scenarios, 80% test coverage, ~600 LOC of orchestration.
>
> Repo: github.com/praxstack/agentic-workflow-java
> 2-min walkthrough: [loom link]
>
> Open to chat with anyone building in this space — especially if you're at a company where reliability of the agent matters more than the demo.

---

## 7 · Talking Points (for the FDSE interview)

When they ask *"tell me about a recent project"*:

- **Open with the FDSE framing:** *"The shape of an FDSE's work is plug a customer's API into something useful, fast. I built a Java agentic engine to live that workflow."*
- **Lead with three differentiators they'll appreciate:** idempotency / audit log / approval gate — *"every agent run is replayable; nothing happens twice; nothing risky happens without a human in the loop."*
- **Show one number:** *"6 tools, 8 demos, 80% test coverage. 14 days. Java, not Python — most enterprise infra is JVM."*
- **Close with curiosity:** *"What's UnifyApps' approach to agent reliability — do you persist tool calls? gate destructive actions?"* — flips it into a 2-way conversation; FDSEs are evaluated on customer-conversation chops as much as code.

---

## 8 · Cut-line — what to drop if you slip

If you're behind by Day 9:
- **Cut:** demo 6 (PDF), demo 7 (scheduler), reflection step, EmailDraftTool
- **Keep at all costs:** the core loop, audit log, idempotency, HumanApprovalTool, demos 1+2+4+8, the Loom

The minimum viable artifact = **demos 1, 2, 4, 8 working + 80% coverage on core + 2-min Loom + clean README.** Everything else is bonus.

---

## 9 · Scope Discipline — what NOT to build

Things that will eat your time and not move the needle:

- ❌ A web UI. CLI + JSON demos are stronger signal anyway.
- ❌ Vector DB / RAG. Not what UnifyApps does. Save it for v2.
- ❌ Multi-agent / agent-talking-to-agent. Not the FDSE shape. Cute, irrelevant.
- ❌ Custom prompt-engineering DSL. Use Markdown files in `resources/prompts/`. Done.
- ❌ Local LLM support (Ollama). One paid model is the production reality. Pick OpenAI **or** Anthropic, not both.
- ❌ Bench-marking against LangChain / AutoGen / Bedrock Agents. Not the audience. Don't bait the comparison.
